import { EnvConfigService } from '../../../../config/env-config.service';
import { SellerAccessCodeService } from './seller-access-code.service';

describe('SellerAccessCodeService', () => {
  const service = new SellerAccessCodeService({
    sellerAccess: {
      codeExpiresInMinutes: 15,
      codeSecret: 'test-secret',
    },
  } as EnvConfigService);

  it('generates six digit codes', () => {
    expect(service.generate()).toMatch(/^\d{6}$/);
  });

  it('hashes codes without exposing the raw value', () => {
    const hash = service.hash('123456');

    expect(hash).not.toBe('123456');
    expect(hash).toHaveLength(64);
  });
});
