import { Inject, Injectable, Logger } from '@nestjs/common';
import { EnvConfigService } from '../../../../../config/env-config.service';
import { RecordAuditEventUseCase } from '../../../../audit-logs/application';
import { AppError, Result, UseCase } from '../../../../../shared-kernel';
import {
  AUTH_ACCOUNT_REPOSITORY,
  AUTH_PROVIDER,
  AuthAccountRepository,
  AuthProviderPort,
  MAILER_PORT,
  MailerPort,
  RequestPasswordResetCommand,
} from '../../../domain';

export type RequestPasswordResetResult = {
  accepted: true;
  message: string;
};

const GENERIC_RESPONSE =
  'Si existe una cuenta elegible, enviaremos un código para restablecer la contraseña.';

@Injectable()
export class RequestPasswordResetUseCase extends UseCase<
  RequestPasswordResetCommand,
  RequestPasswordResetResult,
  AppError
> {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);

  constructor(
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: AuthProviderPort,
    @Inject(AUTH_ACCOUNT_REPOSITORY)
    private readonly authAccountRepository: AuthAccountRepository,
    @Inject(MAILER_PORT)
    private readonly mailer: MailerPort,
    private readonly recordAuditEvent: RecordAuditEventUseCase,
    private readonly envConfig: EnvConfigService,
  ) {
    super();
  }

  async execute(
    input: RequestPasswordResetCommand,
  ): Promise<Result<RequestPasswordResetResult, AppError>> {
    const email = input.email.trim().toLowerCase();

    try {
      const recovery = await this.authProvider.generatePasswordRecoveryCode({
        email,
      });
      const user = await this.authAccountRepository.findByAuthUserId(
        recovery.authUserId,
      );

      await this.mailer.sendPasswordRecoveryCode({
        recipient: { email, name: user?.name ?? undefined },
        userName: user?.name ?? 'Usuario',
        recoveryCode: recovery.code,
        recoveryTokenHash: recovery.tokenHash,
        expiresInMinutes: this.envConfig.auth.passwordResetCodeExpiresInMinutes,
      });

      await this.audit(
        'auth.password_reset.code_dispatched',
        {
          email,
          authUserId: recovery.authUserId,
          channel: 'email',
          expiresInMinutes:
            this.envConfig.auth.passwordResetCodeExpiresInMinutes,
        },
        user?.id,
      );
    } catch {
      this.logger.warn('Password recovery code could not be dispatched');
      await this.audit('auth.password_reset.code_dispatch_failed', {
        email,
        reason: 'PROVIDER_OR_DELIVERY_ERROR',
      });
    }

    return Result.success({ accepted: true, message: GENERIC_RESPONSE });
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
