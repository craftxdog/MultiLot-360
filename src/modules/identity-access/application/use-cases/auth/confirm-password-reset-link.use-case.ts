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
  ConfirmPasswordResetLinkCommand,
} from '../../../domain';
import { ConfirmPasswordResetResult } from './confirm-password-reset.use-case';

@Injectable()
export class ConfirmPasswordResetLinkUseCase extends UseCase<
  ConfirmPasswordResetLinkCommand,
  ConfirmPasswordResetResult,
  AppError
> {
  private readonly logger = new Logger(ConfirmPasswordResetLinkUseCase.name);

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
    input: ConfirmPasswordResetLinkCommand,
  ): Promise<Result<ConfirmPasswordResetResult, AppError>> {
    if (input.newPassword !== input.confirmPassword) {
      await this.auditFailure('PASSWORD_CONFIRMATION_MISMATCH');
      return ErrorFactory.useCase(
        'La confirmación de contraseña no coincide.',
        undefined,
        400,
      );
    }

    try {
      const recovery =
        await this.authProvider.resetPasswordWithRecoveryTokenHash({
          tokenHash: input.tokenHash,
          newPassword: input.newPassword,
        });
      const user = await this.authAccountRepository.findByAuthUserId(
        recovery.authUserId,
      );

      await this.audit(
        'auth.password_reset.completed',
        {
          authUserId: recovery.authUserId,
          method: 'secure_link',
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
        await this.auditFailure('SESSION_REVOCATION_FAILED');
        return ErrorFactory.useCase(
          'La contraseña fue actualizada, pero no fue posible cerrar las sesiones anteriores.',
          error,
          502,
        );
      }

      const invalidToken = this.isRecoveryTokenError(error);
      await this.auditFailure(
        invalidToken ? 'INVALID_OR_EXPIRED_LINK' : 'PASSWORD_POLICY_REJECTED',
      );

      return ErrorFactory.useCase(
        invalidToken
          ? 'El enlace de recuperación es inválido o expiró.'
          : 'La nueva contraseña no cumple la política de seguridad.',
        error,
        invalidToken ? 401 : 422,
      );
    }
  }

  private isRecoveryTokenError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    return (
      error.message.startsWith('RECOVERY_TOKEN_INVALID:') ||
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

  private async auditFailure(reason: string): Promise<void> {
    await this.audit('auth.password_reset.failed', {
      method: 'secure_link',
      reason,
    });
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
