import { Injectable, Logger } from '@nestjs/common';
import { EmailParams, MailerSend, Recipient, Sender } from 'mailersend';
import { EnvConfigService } from '../../config/env-config.service';
import {
  MailRecipient,
  MailerPort,
  SendAccountConfirmationInput,
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

type MailerSendApiError = {
  statusCode?: number;
  body?: {
    message?: string;
    errors?: Record<string, string[]>;
  };
};

@Injectable()
export class MailerSendMailerService implements MailerPort {
  private readonly logger = new Logger(MailerSendMailerService.name);
  private readonly client: MailerSend | null;

  constructor(
    private readonly envConfig: EnvConfigService,
    private readonly templateRenderer: TemplateRendererService,
  ) {
    this.client = envConfig.mailer.apiToken
      ? new MailerSend({ apiKey: envConfig.mailer.apiToken })
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

  private buildSellerActivationUrl(email: string, accessCode: string): string {
    return this.buildActionUrl(
      this.envConfig.sellerAccess.activationUrl,
      email,
      accessCode,
    );
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

    if (!this.client) {
      throw new Error(
        'MAILERSEND_API_TOKEN is required when mailer is enabled',
      );
    }

    if (!this.envConfig.mailer.fromEmail) {
      throw new Error(
        'MAILERSEND_FROM_EMAIL is required when mailer is enabled',
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
    const sentFrom = new Sender(
      this.envConfig.mailer.fromEmail,
      this.envConfig.mailer.fromName,
    );
    const recipient = new Recipient(input.to.email, input.to.name);
    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo([recipient])
      .setReplyTo(
        new Sender(
          this.envConfig.mailer.replyToEmail || this.envConfig.mailer.fromEmail,
          this.envConfig.mailer.fromName,
        ),
      )
      .setSubject(input.subject)
      .setHtml(rendered.html)
      .setText(rendered.text);

    try {
      await this.client.email.send(emailParams);
    } catch (error) {
      const mailerError = this.toMailerSendError(error);
      this.logger.warn(mailerError.message);
      throw mailerError;
    }
  }

  private toMailerSendError(error: unknown): Error {
    if (this.isMailerSendApiError(error)) {
      const status = error.statusCode ? ` status=${error.statusCode}` : '';
      const message =
        error.body?.message ?? this.firstValidationMessage(error.body?.errors);

      return new Error(
        `MailerSend rejected email${status}: ${
          message ?? 'unknown provider error'
        }`,
      );
    }

    if (error instanceof Error) {
      return new Error(`MailerSend failed to send email: ${error.message}`);
    }

    return new Error('MailerSend failed to send email');
  }

  private isMailerSendApiError(error: unknown): error is MailerSendApiError {
    return Boolean(
      error &&
      typeof error === 'object' &&
      ('statusCode' in error || 'body' in error),
    );
  }

  private firstValidationMessage(
    errors?: Record<string, string[]>,
  ): string | undefined {
    if (!errors) return undefined;

    for (const messages of Object.values(errors)) {
      const [message] = messages;
      if (message) return message;
    }

    return undefined;
  }
}
