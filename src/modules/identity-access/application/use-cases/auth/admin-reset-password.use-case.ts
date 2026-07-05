import { Inject, Injectable, Logger } from '@nestjs/common';
import { RecordAuditEventUseCase } from '../../../../audit-logs/application';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../../shared-kernel';
import {
  AdminResetPasswordCommand,
  AUTH_ACCOUNT_REPOSITORY,
  AUTH_PROVIDER,
  AuthAccountRepository,
  AuthProviderPort,
} from '../../../domain';

export type AdminResetPasswordResult = {
  passwordUpdated: true;
  sessionsRevoked: true;
  targetUser: {
    id: string;
    username: string;
  };
};

@Injectable()
export class AdminResetPasswordUseCase extends UseCase<
  AdminResetPasswordCommand,
  AdminResetPasswordResult,
  AppError
> {
  private readonly logger = new Logger(AdminResetPasswordUseCase.name);

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
    input: AdminResetPasswordCommand,
  ): Promise<Result<AdminResetPasswordResult, AppError>> {
    if (input.newPassword !== input.confirmPassword) {
      await this.auditFailure(input, 'PASSWORD_CONFIRMATION_MISMATCH');
      return ErrorFactory.useCase(
        'La confirmación de contraseña no coincide.',
        undefined,
        400,
      );
    }

    const targetUser = await this.authAccountRepository.findById(
      input.targetUserId,
    );

    if (!targetUser) {
      await this.auditFailure(input, 'TARGET_USER_NOT_FOUND');
      return ErrorFactory.useCase(
        'Usuario objetivo no encontrado.',
        undefined,
        404,
      );
    }

    if (!targetUser.active || !targetUser.authUserId) {
      await this.auditFailure(input, 'TARGET_USER_NOT_ELIGIBLE');
      return ErrorFactory.useCase(
        'El usuario objetivo no está activo o no tiene una identidad vinculada.',
        undefined,
        409,
      );
    }

    try {
      await this.authProvider.adminResetPassword({
        authUserId: targetUser.authUserId,
        newPassword: input.newPassword,
      });

      await this.audit(
        input.actorUserId,
        'auth.password_reset.admin_completed',
        {
          targetUserId: targetUser.id,
          targetAuthUserId: targetUser.authUserId,
          targetUsername: targetUser.username,
          sessionsRevoked: true,
        },
      );

      return Result.success({
        passwordUpdated: true,
        sessionsRevoked: true,
        targetUser: {
          id: targetUser.id,
          username: targetUser.username,
        },
      });
    } catch (error) {
      const revocationFailed = this.isSessionRevocationError(error);
      await this.auditFailure(
        input,
        revocationFailed
          ? 'SESSION_REVOCATION_FAILED'
          : 'PROVIDER_OR_PASSWORD_POLICY_ERROR',
        targetUser.id,
      );

      return ErrorFactory.useCase(
        revocationFailed
          ? 'La contraseña fue actualizada, pero no fue posible cerrar las sesiones anteriores.'
          : 'No fue posible restablecer la contraseña del usuario.',
        error,
        revocationFailed ? 502 : 422,
      );
    }
  }

  private isSessionRevocationError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.startsWith('SESSION_REVOCATION_FAILED:')
    );
  }

  private async auditFailure(
    input: AdminResetPasswordCommand,
    reason: string,
    resolvedTargetUserId?: string,
  ): Promise<void> {
    await this.audit(input.actorUserId, 'auth.password_reset.admin_failed', {
      targetUserId: resolvedTargetUserId ?? input.targetUserId,
      reason,
    });
  }

  private async audit(
    actorUserId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const result = await this.recordAuditEvent.execute({
      userId: actorUserId,
      event,
      payload,
    });

    if (result.isFailure) {
      this.logger.warn(`Could not persist audit event "${event}"`);
    }
  }
}
