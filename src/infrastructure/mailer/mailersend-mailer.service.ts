import { Injectable, Logger } from '@nestjs/common';
import { EmailParams, MailerSend, Recipient, Sender } from 'mailersend';
import { EnvConfigService } from '../../config/env-config.service';
import {
  MailRecipient,
  MailerPort,
  SendAccountConfirmationInput,
  SendSellerAccessCodeInput,
  SendSellerInvitationInput,
} from './domain';
import { TemplateRendererService } from './template-renderer.service';

type SendTemplateEmailInput = {
  to: MailRecipient;
  subject: string;
  templateName: string;
  context: Record<string, unknown>;
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
      subject: 'Tu acceso a MultiLot 360',
      templateName: 'seller-invitation',
      context: {
        adminName: input.adminName,
        sellerName: input.sellerName,
        accessCode: input.accessCode,
        expiresInMinutes: input.expiresInMinutes,
      },
    });
  }

  async sendSellerAccessCode(input: SendSellerAccessCodeInput): Promise<void> {
    await this.sendTemplateEmail({
      to: input.recipient,
      subject: 'Tu codigo de acceso a MultiLot 360',
      templateName: 'seller-access-code',
      context: {
        sellerName: input.sellerName,
        accessCode: input.accessCode,
        expiresInMinutes: input.expiresInMinutes,
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
      },
    });
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

    await this.client.email.send(emailParams);
  }
}
