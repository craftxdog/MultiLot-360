import { Inject, Injectable, Logger } from '@nestjs/common';
import { RecordAuditEventUseCase } from '../../../../audit-logs/application';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../../shared-kernel';
import {
  AUTH_ACCOUNT_REPOSITORY,
  AUTH_PROVIDER,
  AuthAccountRepository,
  AuthProviderPort,
  ConfirmPasswordResetCommand,
} from '../../../domain';

export type ConfirmPasswordResetResult = {
  passwordUpdated: true;
  sessionsRevoked: true;
};

@Injectable()
export class ConfirmPasswordResetUseCase extends UseCase<
  ConfirmPasswordResetCommand,
  ConfirmPasswordResetResult,
  AppError
> {
  private readonly logger = new Logger(ConfirmPasswordResetUseCase.name);

  constructor(
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: AuthProviderPort,
    @Inject(AUTH_ACCOUNT_REPOSITORY)
    private readonly authAccountRepository: AuthAccountRepository,
    private readonly recordAuditEvent: RecordAuditEventUseCase,
  ) {
    super();
  }

  async execute(
    input: ConfirmPasswordResetCommand,
  ): Promise<Result<ConfirmPasswordResetResult, AppError>> {
    const email = input.email.trim().toLowerCase();

    if (input.newPassword !== input.confirmPassword) {
      await this.auditFailure(email, 'PASSWORD_CONFIRMATION_MISMATCH');
      return ErrorFactory.useCase(
        'La confirmación de contraseña no coincide.',
        undefined,
        400,
      );
    }

    try {
      const recovery = await this.authProvider.resetPasswordWithRecoveryCode({
        email,
        code: input.code,
        newPassword: input.newPassword,
      });
      const user = await this.authAccountRepository.findByAuthUserId(
        recovery.authUserId,
      );

      await this.audit(
        'auth.password_reset.completed',
        {
          email,
          authUserId: recovery.authUserId,
          sessionsRevoked: true,
        },
        user?.id,
      );

      return Result.success({
        passwordUpdated: true,
        sessionsRevoked: true,
      });
    } catch (error) {
      if (this.isSessionRevocationError(error)) {
        await this.auditFailure(email, 'SESSION_REVOCATION_FAILED');
        return ErrorFactory.useCase(
          'La contraseña fue actualizada, pero no fue posible cerrar las sesiones anteriores.',
          error,
          502,
        );
      }

      const invalidCode = this.isRecoveryCodeError(error);
      await this.auditFailure(
        email,
        invalidCode ? 'INVALID_OR_EXPIRED_CODE' : 'PASSWORD_POLICY_REJECTED',
      );

      return ErrorFactory.useCase(
        invalidCode
          ? 'El código de recuperación es inválido o expiró.'
          : 'La nueva contraseña no cumple la política de seguridad.',
        error,
        invalidCode ? 401 : 422,
      );
    }
  }

  private isRecoveryCodeError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    return (
      error.message.startsWith('RECOVERY_CODE_INVALID:') ||
      message.includes('code') ||
      message.includes('token') ||
      message.includes('otp') ||
      message.includes('expired')
    );
  }

  private isSessionRevocationError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.startsWith('SESSION_REVOCATION_FAILED:')
    );
  }

  private async auditFailure(email: string, reason: string): Promise<void> {
    await this.audit('auth.password_reset.failed', { email, reason });
  }

  private async audit(
    event: string,
    payload: Record<string, unknown>,
    userId?: string,
  ): Promise<void> {
    const result = await this.recordAuditEvent.execute({
      userId,
      event,
      payload,
    });

    if (result.isFailure) {
      this.logger.warn(`Could not persist audit event "${event}"`);
    }
  }
}
