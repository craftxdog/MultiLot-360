import { EnvConfigService } from '../../config/env-config.service';
import { PrismaService } from '../../infrastructure/database/prisma';
import { BillingProviderService } from './billing-provider.service';
import { SaasBillingService } from './saas-billing.service';

describe('SaasBillingService verified development completion', () => {
  const secret = 'development-secret-at-least-32-characters';
  const runInBillingTransaction = jest.fn((work: () => Promise<unknown>) =>
    work(),
  );
  const executeRaw = jest.fn();
  const queryRaw = jest.fn();
  const getSubscription = jest.fn();
  const prisma = {
    runInBillingTransaction,
    $executeRaw: executeRaw,
    $queryRaw: queryRaw,
  } as unknown as jest.Mocked<PrismaService>;
  const provider = {
    provider: 'DEVELOPMENT',
    getSubscription,
  } as unknown as jest.Mocked<BillingProviderService>;
  const env = {
    billing: {
      provider: 'development',
      developmentSecret: secret,
    },
  } as EnvConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    getSubscription.mockResolvedValue({
      id: 'DEV-subscription',
      customerId: 'DEV-customer',
      status: 'ACTIVE',
      startsAt: new Date('2026-07-16T00:00:00.000Z'),
      nextBillingAt: new Date('2026-08-16T00:00:00.000Z'),
    });
    executeRaw.mockResolvedValue(1);
    queryRaw.mockResolvedValue([
      { tenant_id: '3b236655-b73d-4ce8-9143-e4f9030c2810' },
    ]);
  });

  it('processes a signed completion through the billing worker transaction', async () => {
    const service = new SaasBillingService(prisma, env, provider);
    const result = await service.completeDevelopmentSignup(
      secret,
      '739aa85d-b076-4a35-8ef4-d21929fc9f00',
      'DEV-subscription',
    );

    expect(result).toEqual({
      accepted: true,
      processed: true,
      tenantId: '3b236655-b73d-4ce8-9143-e4f9030c2810',
    });
    expect(runInBillingTransaction).toHaveBeenCalledTimes(2);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects a forged development completion before touching the provider', async () => {
    const service = new SaasBillingService(prisma, env, provider);

    await expect(
      service.completeDevelopmentSignup(
        'wrong-development-secret-value-xxxx',
        '739aa85d-b076-4a35-8ef4-d21929fc9f00',
        'DEV-subscription',
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(getSubscription).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
