import { EnvConfigService } from '../../../../../config/env-config.service';
import { RecordAuditEventUseCase } from '../../../../audit-logs/application';
import {
  AuthAccountRepository,
  AuthProviderPort,
  IdentityUser,
  MailerPort,
} from '../../../domain';
import { AdminResetPasswordUseCase } from './admin-reset-password.use-case';
import { ConfirmPasswordResetUseCase } from './confirm-password-reset.use-case';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';

type AuditCommand = {
  userId?: string;
  event: string;
  payload?: Record<string, unknown>;
};

const createProvider = (): jest.Mocked<AuthProviderPort> => ({
  createUser: jest.fn(),
  deleteUser: jest.fn(),
  signInWithPassword: jest.fn(),
  refreshSession: jest.fn(),
  generatePasswordRecoveryCode: jest.fn(),
  resetPasswordWithRecoveryCode: jest.fn(),
  adminResetPassword: jest.fn(),
  signOut: jest.fn(),
  verifyAccessToken: jest.fn(),
});

const identity: IdentityUser = {
  id: '0196fd44-a005-722d-8ca2-a3de51c391a0',
  authUserId: 'auth-user-id',
  username: 'usuario.demo',
  name: 'Usuario Demo',
  active: true,
  role: { id: '2', name: 'VENDEDOR' },
  modules: [],
  permissions: [],
};

describe('password reset use cases', () => {
  let authProvider: jest.Mocked<AuthProviderPort>;
  let authAccountRepository: jest.Mocked<AuthAccountRepository>;
  let mailer: jest.Mocked<MailerPort>;
  let auditExecute: jest.Mock<Promise<{ isFailure: boolean }>, [AuditCommand]>;
  let audit: RecordAuditEventUseCase;
  let env: EnvConfigService;

  beforeEach(() => {
    authProvider = createProvider();
    authAccountRepository = {
      createInternalUser: jest.fn(),
      findById: jest.fn(),
      findByAuthUserId: jest.fn(),
    };
    mailer = {
      sendSellerInvitation: jest.fn(),
      sendSellerAccessCode: jest.fn(),
      sendAccountConfirmation: jest.fn(),
      sendPasswordRecoveryCode: jest.fn(),
    };
    auditExecute = jest
      .fn<Promise<{ isFailure: boolean }>, [AuditCommand]>()
      .mockResolvedValue({ isFailure: false });
    audit = { execute: auditExecute } as unknown as RecordAuditEventUseCase;
    env = {
      auth: {
        passwordResetUrl: 'https://app.example.com/restablecer-contrasena',
        passwordResetCodeExpiresInMinutes: 60,
      },
    } as EnvConfigService;
  });

  it('generates and emails a recovery code without returning it', async () => {
    authProvider.generatePasswordRecoveryCode.mockResolvedValue({
      authUserId: identity.authUserId,
      code: '123456',
    });
    authAccountRepository.findByAuthUserId.mockResolvedValue(identity);
    const useCase = new RequestPasswordResetUseCase(
      authProvider,
      authAccountRepository,
      mailer,
      audit,
      env,
    );

    const result = await useCase.execute({ email: ' USER@Example.COM ' });

    expect(result).toMatchObject({ value: { accepted: true } });
    expect(authProvider.generatePasswordRecoveryCode.mock.calls).toEqual([
      [{ email: 'user@example.com' }],
    ]);
    expect(mailer.sendPasswordRecoveryCode.mock.calls).toEqual([
      [
        {
          recipient: { email: 'user@example.com', name: 'Usuario Demo' },
          userName: 'Usuario Demo',
          recoveryCode: '123456',
          expiresInMinutes: 60,
        },
      ],
    ]);
    expect(JSON.stringify(result)).not.toContain('123456');
    expect(auditExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: identity.id,
        event: 'auth.password_reset.code_dispatched',
      }),
    );
    expect(JSON.stringify(auditExecute.mock.calls)).not.toContain('123456');
  });

  it('keeps the request enumeration-safe when generation or delivery fails', async () => {
    authProvider.generatePasswordRecoveryCode.mockRejectedValue(
      new Error('User not found'),
    );
    const useCase = new RequestPasswordResetUseCase(
      authProvider,
      authAccountRepository,
      mailer,
      audit,
      env,
    );

    const result = await useCase.execute({ email: 'missing@example.com' });

    expect(result).toMatchObject({ value: { accepted: true } });
    expect(auditExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth.password_reset.code_dispatch_failed',
      }),
    );
  });

  it('rejects a mismatched password confirmation before validating the OTP', async () => {
    const useCase = new ConfirmPasswordResetUseCase(
      authProvider,
      authAccountRepository,
      audit,
    );

    const result = await useCase.execute({
      email: 'user@example.com',
      code: '123456',
      newPassword: 'NuevaClave2026!',
      confirmPassword: 'OtraClave2026!',
    });

    expect(result).toMatchObject({
      isFailure: true,
      error: { statusCode: 400 },
    });
    expect(authProvider.resetPasswordWithRecoveryCode.mock.calls).toHaveLength(
      0,
    );
    expect(JSON.stringify(auditExecute.mock.calls)).not.toContain('123456');
  });

  it('validates the recovery code, updates the password and audits the user', async () => {
    authProvider.resetPasswordWithRecoveryCode.mockResolvedValue({
      authUserId: identity.authUserId,
    });
    authAccountRepository.findByAuthUserId.mockResolvedValue(identity);
    const useCase = new ConfirmPasswordResetUseCase(
      authProvider,
      authAccountRepository,
      audit,
    );

    const result = await useCase.execute({
      email: 'USER@example.com',
      code: '123456',
      newPassword: 'NuevaClave2026!',
      confirmPassword: 'NuevaClave2026!',
    });

    expect(result).toMatchObject({
      value: { passwordUpdated: true, sessionsRevoked: true },
    });
    expect(authProvider.resetPasswordWithRecoveryCode.mock.calls).toEqual([
      [
        {
          email: 'user@example.com',
          code: '123456',
          newPassword: 'NuevaClave2026!',
        },
      ],
    ]);
    expect(auditExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: identity.id,
        event: 'auth.password_reset.completed',
      }),
    );
  });

  it('maps an invalid recovery code to unauthorized and audits the failure', async () => {
    authProvider.resetPasswordWithRecoveryCode.mockRejectedValue(
      new Error('Token has expired or is invalid'),
    );
    const useCase = new ConfirmPasswordResetUseCase(
      authProvider,
      authAccountRepository,
      audit,
    );

    const result = await useCase.execute({
      email: 'user@example.com',
      code: '123456',
      newPassword: 'NuevaClave2026!',
      confirmPassword: 'NuevaClave2026!',
    });

    expect(result).toMatchObject({
      isFailure: true,
      error: { statusCode: 401 },
    });
    const failureAudit = auditExecute.mock.calls.at(-1)?.[0];
    expect(failureAudit?.event).toBe('auth.password_reset.failed');
    expect(failureAudit?.payload).toMatchObject({
      reason: 'INVALID_OR_EXPIRED_CODE',
    });
  });

  it('allows an authenticated admin use case to reset a linked target directly', async () => {
    authAccountRepository.findById.mockResolvedValue(identity);
    authProvider.adminResetPassword.mockResolvedValue({
      authUserId: identity.authUserId,
    });
    const useCase = new AdminResetPasswordUseCase(
      authProvider,
      authAccountRepository,
      audit,
    );

    const result = await useCase.execute({
      actorUserId: '0196fd44-a005-722d-8ca2-a3de51c391b1',
      targetUserId: identity.id,
      newPassword: 'NuevaClave2026!',
      confirmPassword: 'NuevaClave2026!',
    });

    expect(result).toMatchObject({
      value: {
        passwordUpdated: true,
        sessionsRevoked: true,
        targetUser: { id: identity.id },
      },
    });
    expect(authProvider.adminResetPassword.mock.calls).toEqual([
      [
        {
          authUserId: identity.authUserId,
          newPassword: 'NuevaClave2026!',
        },
      ],
    ]);
    const adminAudit = auditExecute.mock.calls.at(-1)?.[0];
    expect(adminAudit).toMatchObject({
      userId: '0196fd44-a005-722d-8ca2-a3de51c391b1',
      event: 'auth.password_reset.admin_completed',
    });
    expect(adminAudit?.payload).toMatchObject({ targetUserId: identity.id });
    expect(JSON.stringify(auditExecute.mock.calls)).not.toContain(
      'NuevaClave2026!',
    );
  });

  it('prevents an admin reset for an inactive or unlinked target', async () => {
    authAccountRepository.findById.mockResolvedValue({
      ...identity,
      active: false,
    });
    const useCase = new AdminResetPasswordUseCase(
      authProvider,
      authAccountRepository,
      audit,
    );

    const result = await useCase.execute({
      actorUserId: '0196fd44-a005-722d-8ca2-a3de51c391b1',
      targetUserId: identity.id,
      newPassword: 'NuevaClave2026!',
      confirmPassword: 'NuevaClave2026!',
    });

    expect(result).toMatchObject({
      isFailure: true,
      error: { statusCode: 409 },
    });
    expect(authProvider.adminResetPassword.mock.calls).toHaveLength(0);
    expect(auditExecute.mock.calls.at(-1)?.[0]).toMatchObject({
      userId: '0196fd44-a005-722d-8ca2-a3de51c391b1',
      event: 'auth.password_reset.admin_failed',
      payload: { reason: 'TARGET_USER_NOT_ELIGIBLE' },
    });
  });
});
