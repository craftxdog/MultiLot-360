import {
  MODULES_KEY,
  PERMISSIONS_KEY,
  SYSTEM_MODULES,
} from '../../../../../common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SellerOnboardingController } from './seller-onboarding.controller';

describe('SellerOnboardingController deletion authorization', () => {
  it('rate limits public seller access confirmation attempts', () => {
    const handler = Reflect.get(
      SellerOnboardingController.prototype,
      'confirmAccessCode',
    ) as object;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(
      ThrottlerGuard,
    );
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(900_000);
  });

  it('protects soft delete with usuarios.delete', () => {
    const handler = Reflect.get(
      SellerOnboardingController.prototype,
      'softDeleteSeller',
    ) as object;

    expect(Reflect.getMetadata(MODULES_KEY, handler)).toEqual([
      SYSTEM_MODULES.usuarios,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      'usuarios.delete',
    ]);
  });

  it('protects hard delete with usuarios.delete', () => {
    const handler = Reflect.get(
      SellerOnboardingController.prototype,
      'hardDeleteSeller',
    ) as object;

    expect(Reflect.getMetadata(MODULES_KEY, handler)).toEqual([
      SYSTEM_MODULES.usuarios,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      'usuarios.delete',
    ]);
  });
});
