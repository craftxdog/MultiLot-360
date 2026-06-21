import { EnvConfigService } from '../../config/env-config.service';
import { MailerSendMailerService } from './mailersend-mailer.service';
import { TemplateRendererService } from './template-renderer.service';

describe('MailerSendMailerService', () => {
  const envConfig = {
    app: {
      name: 'MultiLot 360 API',
    },
    mailer: {
      enabled: false,
      apiToken: '',
      fromEmail: '',
      fromName: 'MultiLot 360',
      replyToEmail: '',
    },
  } as EnvConfigService;

  it('skips sending when mailer is disabled', async () => {
    const service = new MailerSendMailerService(
      envConfig,
      new TemplateRendererService(),
    );

    await expect(
      service.sendSellerAccessCode({
        recipient: {
          email: 'seller@example.com',
          name: 'Seller',
        },
        sellerName: 'Seller',
        accessCode: '123456',
        expiresInMinutes: 10,
      }),
    ).resolves.toBeUndefined();
  });

  it('normalizes MailerSend API errors', async () => {
    const service = new MailerSendMailerService(
      {
        ...envConfig,
        mailer: {
          ...envConfig.mailer,
          enabled: true,
          apiToken: 'test-token',
          fromEmail: 'no-reply@example.com',
        },
      } as EnvConfigService,
      new TemplateRendererService(),
    );

    Object.defineProperty(service, 'client', {
      value: {
        email: {
          send: jest.fn().mockRejectedValue({
            statusCode: 422,
            body: {
              message: 'The from.email domain must be verified in your account',
            },
          }),
        },
      },
    });

    await expect(
      service.sendSellerInvitation({
        recipient: {
          email: 'seller@example.com',
          name: 'Seller',
        },
        adminName: 'Admin',
        sellerName: 'Seller',
        accessCode: '123456',
        expiresInMinutes: 10,
      }),
    ).rejects.toThrow(
      'MailerSend rejected email status=422: The from.email domain must be verified in your account',
    );
  });
});
