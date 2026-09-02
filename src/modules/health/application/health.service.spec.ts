import { EnvConfigService } from '../../../config/env-config.service';
import { PrismaService } from '../../../infrastructure/database/prisma';
import { MailerSendMailerService } from '../../../infrastructure/mailer';
import { HealthCheck, HealthService } from './health.service';

type MailerProbe = {
  checkMailer(): Promise<HealthCheck>;
};

describe('HealthService mailer readiness', () => {
  const prisma = { $queryRaw: jest.fn() } as unknown as PrismaService;
  const mailer = {
    verifyConnection: jest.fn(),
  } as unknown as MailerSendMailerService;

  const createService = (env: string, enabled: boolean) =>
    new HealthService(
      {
        app: { env, name: 'MultiLot 360 API' },
        database: { url: 'postgresql://example.test/postgres' },
        mailer: { enabled },
      } as EnvConfigService,
      prisma,
      mailer,
    );

  const checkMailer = (service: HealthService) =>
    (service as unknown as MailerProbe).checkMailer();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fails closed when production email delivery is disabled', async () => {
    await expect(
      checkMailer(createService('production', false)),
    ).resolves.toEqual({
      status: 'error',
      details: 'Email delivery is disabled',
    });
  });

  it('verifies SMTP once and caches a healthy result', async () => {
    const verifyConnection = jest
      .spyOn(mailer, 'verifyConnection')
      .mockResolvedValue(undefined);
    const service = createService('production', true);

    await expect(checkMailer(service)).resolves.toEqual({ status: 'ok' });
    await expect(checkMailer(service)).resolves.toEqual({ status: 'ok' });
    expect(verifyConnection).toHaveBeenCalledTimes(1);
  });

  it('sanitizes SMTP failures in production and caches the outage', async () => {
    const verifyConnection = jest
      .spyOn(mailer, 'verifyConnection')
      .mockRejectedValue(new Error('535 secret provider response'));
    const service = createService('production', true);

    await expect(checkMailer(service)).resolves.toEqual({
      status: 'error',
      details: 'Email delivery unavailable',
    });
    await expect(checkMailer(service)).resolves.toEqual({
      status: 'error',
      details: 'Email delivery unavailable',
    });
    expect(verifyConnection).toHaveBeenCalledTimes(1);
  });
});
