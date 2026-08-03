import { EnvConfigService } from '../../config/env-config.service';
import { BillingProviderService } from './billing-provider.service';

describe('BillingProviderService development adapter', () => {
  const env = {
    app: {
      name: 'MultiLot 360',
      webUrl: 'http://localhost:8080',
    },
    billing: {
      provider: 'development',
      paypalEnvironment: 'sandbox',
      paypalClientId: '',
      paypalClientSecret: '',
      paypalWebhookId: '',
      returnUrl: 'http://localhost:8080/paid',
      cancelUrl: 'http://localhost:8080/cancelled',
    },
  } as EnvConfigService;

  it('creates a deterministic development approval contract without network access', async () => {
    const service = new BillingProviderService(env);
    const result = await service.createSubscription({
      providerPlanId: 'dev_starter',
      onboardingId: '44a0c47a-a5f8-4735-802a-e001a76f50b3',
      email: 'owner@example.com',
      name: 'Owner Example',
    });

    expect(result.id).toMatch(/^DEV-/);
    expect(result.approvalUrl).toContain('onboarding_id=44a0c47a');
    expect(result.approvalUrl).toContain(
      `subscription_id=${encodeURIComponent(result.id)}`,
    );
  });

  it('provides a valid monthly period for a verified development payment', async () => {
    const service = new BillingProviderService(env);
    const result = await service.getSubscription('DEV-subscription');

    expect(result).toMatchObject({
      customerId: expect.stringContaining('DEV-CUSTOMER') as string,
      status: 'ACTIVE',
      startsAt: expect.any(Date) as Date,
      nextBillingAt: expect.any(Date) as Date,
    });
    expect(result.nextBillingAt!.valueOf()).toBeGreaterThan(
      result.startsAt!.valueOf(),
    );
  });

  it('rejects webhook verification without exposing disabled provider configuration', async () => {
    const service = new BillingProviderService(env);

    await expect(service.verifyWebhook({}, { id: 'unsigned' })).resolves.toBe(
      false,
    );
  });
});
