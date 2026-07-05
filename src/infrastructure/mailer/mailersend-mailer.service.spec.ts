import { EnvConfigService } from '../../config/env-config.service';
import { MailerSendMailerService } from './mailersend-mailer.service';
import { TemplateRendererService } from './template-renderer.service';

describe('MailerSendMailerService', () => {
  const envConfig = {
    app: {
      name: 'MultiLot 360 API',
      webUrl: 'https://app.multilot360.com',
    },
    mailer: {
      enabled: false,
      apiToken: '',
      fromEmail: '',
      fromName: 'MultiLot 360',
      replyToEmail: '',
    },
    sellerAccess: {
      activationUrl: 'https://app.multilot360.com/activar-vendedor',
    },
    auth: {
      confirmationUrl: 'https://app.multilot360.com/confirmar-cuenta',
      passwordResetUrl: 'https://app.multilot360.com/restablecer-contrasena',
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

  it('adds the normalized email and one-time code to the activation URL', async () => {
    const renderer = new TemplateRendererService();
    const renderSpy = jest.spyOn(renderer, 'render');
    const service = new MailerSendMailerService(
      {
        ...envConfig,
        mailer: {
          ...envConfig.mailer,
          enabled: true,
          apiToken: 'test-token',
          fromEmail: 'no-reply@multilot360.com',
        },
      } as EnvConfigService,
      renderer,
    );
    const send = jest.fn().mockResolvedValue(undefined);

    Object.defineProperty(service, 'client', {
      value: { email: { send } },
    });

    await service.sendSellerInvitation({
      recipient: {
        email: ' Seller+Demo@Example.com ',
        name: 'Seller',
      },
      adminName: 'Admin',
      sellerName: 'Seller',
      accessCode: '123456',
      expiresInMinutes: 15,
    });

    expect(renderSpy).toHaveBeenCalledWith(
      'seller-invitation',
      expect.objectContaining({
        activationUrl:
          'https://app.multilot360.com/activar-vendedor?email=seller%2Bdemo%40example.com&code=123456',
      }),
    );
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends the recovery code while keeping it out of the action URL', async () => {
    const renderer = new TemplateRendererService();
    const renderSpy = jest.spyOn(renderer, 'render');
    const service = new MailerSendMailerService(
      {
        ...envConfig,
        mailer: {
          ...envConfig.mailer,
          enabled: true,
          apiToken: 'test-token',
          fromEmail: 'no-reply@multilot360.com',
        },
      } as EnvConfigService,
      renderer,
    );

    Object.defineProperty(service, 'client', {
      value: { email: { send: jest.fn().mockResolvedValue(undefined) } },
    });

    await service.sendPasswordRecoveryCode({
      recipient: { email: ' User@Example.com ', name: 'User' },
      userName: 'User',
      recoveryCode: '123456',
      expiresInMinutes: 60,
    });

    expect(renderSpy).toHaveBeenCalledWith(
      'password-recovery-code',
      expect.objectContaining({
        recoveryCode: '123456',
        passwordResetUrl:
          'https://app.multilot360.com/restablecer-contrasena?email=user%40example.com',
      }),
    );
    expect(
      String(renderSpy.mock.calls.at(-1)?.[1]?.passwordResetUrl),
    ).not.toContain('123456');
  });
});
