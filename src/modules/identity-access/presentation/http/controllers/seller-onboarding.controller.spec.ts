import {
  MODULES_KEY,
  PERMISSIONS_KEY,
  SYSTEM_MODULES,
} from '../../../../../common';
import { SellerOnboardingController } from './seller-onboarding.controller';

describe('SellerOnboardingController deletion authorization', () => {
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
