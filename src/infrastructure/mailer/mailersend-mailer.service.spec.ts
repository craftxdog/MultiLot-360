import { EnvConfigService } from '../../config/env-config.service';
import { MailDeliveryError } from '../../modules/identity-access/domain';
import { MailerSendMailerService } from './mailersend-mailer.service';
import { TemplateRendererService } from './template-renderer.service';

describe('MailerSendMailerService', () => {
  const actionToken = 'A'.repeat(43);
  const envConfig = {
    app: {
      name: 'MultiLot 360 API',
      webUrl: 'https://app.multilot360.com',
    },
    mailer: {
      enabled: false,
      fromEmail: '',
      fromName: 'MultiLot 360',
      replyToEmail: '',
      smtpHost: 'smtp.mailersend.net',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
    },
    sellerAccess: {
      activationUrl: 'https://app.multilot360.com/activar-vendedor',
    },
    auth: {
      confirmationUrl: 'https://app.multilot360.com/confirmar-cuenta',
      passwordResetUrl: 'https://app.multilot360.com/restablecer-contrasena',
    },
  } as EnvConfigService;

  const enabledConfig = {
    ...envConfig,
    mailer: {
      ...envConfig.mailer,
      enabled: true,
      fromEmail: 'no-reply@multilot360.com',
      smtpUser: 'smtp-user',
      smtpPassword: 'smtp-password',
    },
  } as EnvConfigService;

  const setTransport = (
    service: MailerSendMailerService,
    transport: Record<string, jest.Mock>,
  ) => Object.defineProperty(service, 'transport', { value: transport });

  it('skips sending when mailer is disabled', async () => {
    const service = new MailerSendMailerService(
      envConfig,
      new TemplateRendererService(),
    );

    await expect(
      service.sendSellerAccessCode({
        recipient: { email: 'seller@example.com', name: 'Seller' },
        sellerName: 'Seller',
        accessCode: '123456',
        actionToken,
        expiresInMinutes: 10,
      }),
    ).resolves.toBeUndefined();
  });

  it('classifies invalid SMTP credentials without exposing provider details', async () => {
    const service = new MailerSendMailerService(
      enabledConfig,
      new TemplateRendererService(),
    );
    setTransport(service, {
      sendMail: jest.fn().mockRejectedValue(
        Object.assign(new Error('535 secret provider response'), {
          code: 'EAUTH',
          responseCode: 535,
        }),
      ),
      verify: jest.fn(),
      close: jest.fn(),
    });

    const result = service.sendSellerInvitation({
      recipient: { email: 'seller@example.com', name: 'Seller' },
      adminName: 'Admin',
      sellerName: 'Seller',
      accessCode: '123456',
      actionToken,
      expiresInMinutes: 10,
    });

    await expect(result).rejects.toMatchObject({
      name: 'MailDeliveryError',
      message: 'MailerSend SMTP authentication failed',
      reason: 'AUTHENTICATION',
      retryable: false,
    } satisfies Partial<MailDeliveryError>);
  });

  it('classifies SMTP timeouts as retryable outages', async () => {
    const service = new MailerSendMailerService(
      enabledConfig,
      new TemplateRendererService(),
    );
    setTransport(service, {
      sendMail: jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }),
        ),
      verify: jest.fn(),
      close: jest.fn(),
    });

    await expect(
      service.sendSellerAccessCode({
        recipient: { email: 'seller@example.com', name: 'Seller' },
        sellerName: 'Seller',
        accessCode: '123456',
        actionToken,
        expiresInMinutes: 10,
      }),
    ).rejects.toMatchObject({ reason: 'UNAVAILABLE', retryable: true });
  });

  it('classifies rejected recipients as non-retryable delivery failures', async () => {
    const service = new MailerSendMailerService(
      enabledConfig,
      new TemplateRendererService(),
    );
    setTransport(service, {
      sendMail: jest.fn().mockResolvedValue({
        accepted: [],
        rejected: ['seller@example.com'],
      }),
      verify: jest.fn(),
      close: jest.fn(),
    });

    await expect(
      service.sendSellerAccessCode({
        recipient: { email: 'seller@example.com', name: 'Seller' },
        sellerName: 'Seller',
        accessCode: '123456',
        actionToken,
        expiresInMinutes: 10,
      }),
    ).rejects.toMatchObject({ reason: 'REJECTED', retryable: false });
  });

  it('adds only the opaque one-time token to the activation URL', async () => {
    const renderer = new TemplateRendererService();
    const renderSpy = jest.spyOn(renderer, 'render');
    const service = new MailerSendMailerService(enabledConfig, renderer);
    const sendMail = jest
      .fn()
      .mockResolvedValue({ accepted: ['seller@example.com'], rejected: [] });
    setTransport(service, {
      sendMail,
      verify: jest.fn(),
      close: jest.fn(),
    });

    await service.sendSellerInvitation({
      recipient: { email: ' Seller+Demo@Example.com ', name: 'Seller' },
      adminName: 'Admin',
      sellerName: 'Seller',
      accessCode: '123456',
      actionToken,
      expiresInMinutes: 15,
    });

    expect(renderSpy).toHaveBeenCalledWith(
      'seller-invitation',
      expect.objectContaining({
        activationUrl: `https://app.multilot360.com/activar-vendedor?token=${actionToken}`,
      }),
    );
    const activationUrl = String(
      renderSpy.mock.calls.at(-1)?.[1]?.activationUrl,
    );
    expect(activationUrl).not.toContain('seller');
    expect(activationUrl).not.toContain('123456');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('sends the recovery code while keeping it out of the action URL', async () => {
    const renderer = new TemplateRendererService();
    const renderSpy = jest.spyOn(renderer, 'render');
    const service = new MailerSendMailerService(enabledConfig, renderer);
    setTransport(service, {
      sendMail: jest
        .fn()
        .mockResolvedValue({ accepted: ['user@example.com'], rejected: [] }),
      verify: jest.fn(),
      close: jest.fn(),
    });

    await service.sendPasswordRecoveryCode({
      recipient: { email: ' User@Example.com ', name: 'User' },
      userName: 'User',
      recoveryCode: '123456',
      recoveryTokenHash: 'a'.repeat(64),
      expiresInMinutes: 60,
    });

    expect(renderSpy).toHaveBeenCalledWith(
      'password-recovery-code',
      expect.objectContaining({
        recoveryCode: '123456',
        passwordResetUrl: `https://app.multilot360.com/restablecer-contrasena?email=user%40example.com#recovery_token=${'a'.repeat(64)}`,
      }),
    );
    expect(
      String(renderSpy.mock.calls.at(-1)?.[1]?.passwordResetUrl),
    ).not.toContain('123456');
    const passwordResetUrl = String(
      renderSpy.mock.calls.at(-1)?.[1]?.passwordResetUrl,
    );
    expect(new URL(passwordResetUrl).searchParams.has('recovery_token')).toBe(
      false,
    );
    expect(new URL(passwordResetUrl).hash).toContain('recovery_token=');
  });

  it('verifies the SMTP connection without sending an email', async () => {
    const service = new MailerSendMailerService(
      enabledConfig,
      new TemplateRendererService(),
    );
    const verify = jest.fn().mockResolvedValue(true);
    setTransport(service, {
      sendMail: jest.fn(),
      verify,
      close: jest.fn(),
    });

    await expect(service.verifyConnection()).resolves.toBeUndefined();
    expect(verify).toHaveBeenCalledTimes(1);
  });
});
