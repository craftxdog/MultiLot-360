import {
  IS_PUBLIC_KEY,
  MODULES_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
  SYSTEM_MODULES,
} from '../../../../../common';
import { AuthController } from './auth.controller';

describe('AuthController password reset authorization', () => {
  it('keeps recovery-code confirmation public', () => {
    const handler = Reflect.get(
      AuthController.prototype,
      'confirmPasswordResetSession',
    ) as object;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
  });

  it('keeps secure-link confirmation public', () => {
    const handler = Reflect.get(
      AuthController.prototype,
      'confirmPasswordResetLinkSession',
    ) as object;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
  });

  it('requires authenticated admin RBAC for direct resets', () => {
    const handler = Reflect.get(
      AuthController.prototype,
      'resetPasswordAsAdmin',
    ) as object;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).not.toBe(true);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(MODULES_KEY, handler)).toEqual([
      SYSTEM_MODULES.usuarios,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      'usuarios.update',
    ]);
  });
});
