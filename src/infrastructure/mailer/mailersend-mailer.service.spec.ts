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
});
