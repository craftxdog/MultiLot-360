import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { type Transporter } from 'nodemailer';
import { EnvConfigService } from '../../config/env-config.service';
import {
  MailDeliveryError,
  MailRecipient,
  MailerPort,
  SendAccountConfirmationInput,
  SendPasswordRecoveryCodeInput,
  SendSellerAccessCodeInput,
  SendSellerInvitationInput,
} from '../../modules/identity-access/domain';
import { TemplateRendererService } from './template-renderer.service';

type SendTemplateEmailInput = {
  to: MailRecipient;
  subject: string;
  templateName: string;
  context: Record<string, unknown>;
};

type SmtpError = Error & {
  code?: string;
  command?: string;
  response?: string;
  responseCode?: number;
};

type SmtpSendResult = {
  accepted?: string[];
  messageId?: string;
  rejected?: string[];
  response?: string;
};

type MailerSendTransport = Pick<
  Transporter<SmtpSendResult>,
  'close' | 'sendMail' | 'verify'
>;

const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 20_000;

const RETRYABLE_SMTP_CODES = new Set([
  'ECONNECTION',
  'ECONNRESET',
  'EDNS',
  'ESOCKET',
  'ETIMEDOUT',
]);

const AUTHENTICATION_SMTP_CODES = new Set(['EAUTH']);

const isSmtpError = (error: unknown): error is SmtpError =>
  error instanceof Error;

const smtpResponseCode = (error: SmtpError): number | undefined =>
  typeof error.responseCode === 'number' ? error.responseCode : undefined;

const isAuthenticationFailure = (error: SmtpError): boolean =>
  AUTHENTICATION_SMTP_CODES.has(error.code ?? '') ||
  smtpResponseCode(error) === 530 ||
  smtpResponseCode(error) === 535;

const isRetryableFailure = (error: SmtpError): boolean => {
  const responseCode = smtpResponseCode(error);
  return (
    RETRYABLE_SMTP_CODES.has(error.code ?? '') ||
    (responseCode !== undefined && responseCode >= 400 && responseCode < 500)
  );
};

type MailerSendSmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
};

const createMailerSendTransport = (
  config: MailerSendSmtpConfig,
): MailerSendTransport =>
  nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    requireTLS: true,
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    auth: {
      user: config.user,
      pass: config.password,
    },
    tls: {
      minVersion: 'TLSv1.2',
    },
  });

@Injectable()
export class MailerSendMailerService implements MailerPort, OnModuleDestroy {
  private readonly logger = new Logger(MailerSendMailerService.name);
  private readonly transport: MailerSendTransport | null;

  constructor(
    private readonly envConfig: EnvConfigService,
    private readonly templateRenderer: TemplateRendererService,
  ) {
    this.transport = envConfig.mailer.enabled
      ? createMailerSendTransport({
          host: envConfig.mailer.smtpHost,
          port: envConfig.mailer.smtpPort,
          user: envConfig.mailer.smtpUser,
          password: envConfig.mailer.smtpPassword,
        })
      : null;
  }

  async sendSellerInvitation(input: SendSellerInvitationInput): Promise<void> {
    await this.sendTemplateEmail({
      to: input.recipient,
      subject: 'Tu invitación para acceder a MultiLot 360',
      templateName: 'seller-invitation',
      context: {
        adminName: input.adminName,
        sellerName: input.sellerName,
        accessCode: input.accessCode,
        expiresInMinutes: input.expiresInMinutes,
        activationUrl: this.buildSellerActivationUrl(
          input.recipient.email,
          input.accessCode,
        ),
      },
    });
  }

  async sendSellerAccessCode(input: SendSellerAccessCodeInput): Promise<void> {
    await this.sendTemplateEmail({
      to: input.recipient,
      subject: 'Tu nuevo código de acceso a MultiLot 360',
      templateName: 'seller-access-code',
      context: {
        sellerName: input.sellerName,
        accessCode: input.accessCode,
        expiresInMinutes: input.expiresInMinutes,
        activationUrl: this.buildSellerActivationUrl(
          input.recipient.email,
          input.accessCode,
        ),
      },
    });
  }

  async sendAccountConfirmation(
    input: SendAccountConfirmationInput,
  ): Promise<void> {
    await this.sendTemplateEmail({
      to: input.recipient,
      subject: 'Confirma tu cuenta en MultiLot 360',
      templateName: 'account-confirmation',
      context: {
        userName: input.userName,
        confirmationCode: input.confirmationCode,
        expiresInMinutes: input.expiresInMinutes,
        confirmationUrl: this.buildActionUrl(
          this.envConfig.auth.confirmationUrl,
          input.recipient.email,
          input.confirmationCode,
        ),
      },
    });
  }

  async sendPasswordRecoveryCode(
    input: SendPasswordRecoveryCodeInput,
  ): Promise<void> {
    await this.sendTemplateEmail({
      to: input.recipient,
      subject: 'Código para restablecer tu contraseña',
      templateName: 'password-recovery-code',
      context: {
        userName: input.userName,
        recoveryCode: input.recoveryCode,
        expiresInMinutes: input.expiresInMinutes,
        passwordResetUrl: this.buildPasswordResetUrl(input.recipient.email),
      },
    });
  }

  private buildSellerActivationUrl(email: string, accessCode: string): string {
    return this.buildActionUrl(
      this.envConfig.sellerAccess.activationUrl,
      email,
      accessCode,
    );
  }

  private buildPasswordResetUrl(email: string): string {
    const actionUrl = new URL(this.envConfig.auth.passwordResetUrl);
    actionUrl.searchParams.set('email', email.trim().toLowerCase());
    return actionUrl.toString();
  }

  private buildActionUrl(baseUrl: string, email: string, code: string): string {
    const actionUrl = new URL(baseUrl);
    actionUrl.searchParams.set('email', email.trim().toLowerCase());
    actionUrl.searchParams.set('code', code);
    return actionUrl.toString();
  }

  private async sendTemplateEmail(
    input: SendTemplateEmailInput,
  ): Promise<void> {
    if (!this.envConfig.mailer.enabled) {
      this.logger.log(
        `Mailer disabled. Skipping "${input.templateName}" email to ${input.to.email}`,
      );
      return;
    }

    if (!this.transport) {
      throw new MailDeliveryError(
        'MailerSend SMTP transport is not configured',
        'CONFIGURATION',
        false,
      );
    }

    if (!this.envConfig.mailer.fromEmail) {
      throw new MailDeliveryError(
        'MAILERSEND_FROM_EMAIL is required when mailer is enabled',
        'CONFIGURATION',
        false,
      );
    }

    const rendered = this.templateRenderer.render(input.templateName, {
      ...input.context,
      appName: this.envConfig.app.name,
      brandName: this.envConfig.mailer.fromName,
      supportEmail:
        this.envConfig.mailer.replyToEmail || this.envConfig.mailer.fromEmail,
      currentYear: new Date().getFullYear(),
    });

    try {
      const result = await this.transport.sendMail({
        from: {
          address: this.envConfig.mailer.fromEmail,
          name: this.envConfig.mailer.fromName,
        },
        to: [
          {
            address: input.to.email,
            name: input.to.name ?? input.to.email,
          },
        ],
        replyTo: {
          address:
            this.envConfig.mailer.replyToEmail ||
            this.envConfig.mailer.fromEmail,
          name: this.envConfig.mailer.fromName,
        },
        subject: input.subject,
        html: rendered.html,
        text: rendered.text,
      });

      if (result.rejected?.length) {
        throw new MailDeliveryError(
          'MailerSend SMTP rejected one or more recipients',
          'REJECTED',
          false,
        );
      }
    } catch (error) {
      const mailerError = this.toMailDeliveryError(error);
      this.logger.warn(mailerError.message);
      throw mailerError;
    }
  }

  async verifyConnection(): Promise<void> {
    if (!this.envConfig.mailer.enabled) return;
    if (!this.transport) {
      throw new MailDeliveryError(
        'MailerSend SMTP transport is not configured',
        'CONFIGURATION',
        false,
      );
    }

    try {
      await this.transport.verify();
    } catch (error) {
      throw this.toMailDeliveryError(error);
    }
  }

  private toMailDeliveryError(error: unknown): MailDeliveryError {
    if (error instanceof MailDeliveryError) return error;

    if (!isSmtpError(error)) {
      return new MailDeliveryError(
        'MailerSend SMTP failed with an unknown error',
        'UNAVAILABLE',
        true,
      );
    }

    if (isAuthenticationFailure(error)) {
      return new MailDeliveryError(
        'MailerSend SMTP authentication failed',
        'AUTHENTICATION',
        false,
        error,
      );
    }

    if (isRetryableFailure(error)) {
      return new MailDeliveryError(
        `MailerSend SMTP is temporarily unavailable${
          error.code ? ` (${error.code})` : ''
        }`,
        'UNAVAILABLE',
        true,
        error,
      );
    }

    return new MailDeliveryError(
      `MailerSend SMTP rejected the email${
        smtpResponseCode(error) ? ` (status=${smtpResponseCode(error)})` : ''
      }`,
      'REJECTED',
      false,
      error,
    );
  }

  onModuleDestroy(): void {
    this.transport?.close();
  }
}
