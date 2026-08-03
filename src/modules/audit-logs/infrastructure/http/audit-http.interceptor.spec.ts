import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { RecordAuditEventUseCase } from '../../application';
import { AuditHttpInterceptor } from './audit-http.interceptor';

describe('AuditHttpInterceptor', () => {
  it('does not mix platform finance mutations into the tenant audit ledger', async () => {
    const execute = jest.fn();
    const interceptor = new AuditHttpInterceptor({
      execute,
    } as unknown as RecordAuditEventUseCase);
    const request = {
      method: 'POST',
      originalUrl: '/api/v1/billing/admin/transfers/id/review',
      user: { id: 'profile-id', platformAdminId: 'platform-admin-id' },
    };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ approved: true }) } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({ approved: true });
    expect(execute).not.toHaveBeenCalled();
  });

  it('redacts password reset credentials from audit payloads', async () => {
    const execute = jest
      .fn<
        ReturnType<RecordAuditEventUseCase['execute']>,
        Parameters<RecordAuditEventUseCase['execute']>
      >()
      .mockResolvedValue({ isFailure: false } as never);
    const interceptor = new AuditHttpInterceptor({
      execute,
    } as unknown as RecordAuditEventUseCase);
    const request = {
      method: 'POST',
      originalUrl: '/api/v1/auth/password/reset/confirm',
      params: {},
      query: {},
      body: {
        actionToken: 'opaque-invitation-token',
        refreshToken: 'recovery-refresh-token',
        newPassword: 'NewSup3rSecret2026!',
        confirmPassword: 'NewSup3rSecret2026!',
        nested: { accessCode: '123456', safe: 'visible' },
      },
      context: { requestId: 'request-id' },
    };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ ok: true }) } as CallHandler;

    await lastValueFrom(interceptor.intercept(context, next));

    expect(execute).toHaveBeenCalledTimes(1);
    const command = execute.mock.calls[0][0];
    expect(command.event).toBe('http.request.completed');
    expect(command.payload).toMatchObject({
      body: {
        actionToken: '[REDACTED]',
        refreshToken: '[REDACTED]',
        newPassword: '[REDACTED]',
        confirmPassword: '[REDACTED]',
        nested: { accessCode: '[REDACTED]', safe: 'visible' },
      },
    });
  });
});
