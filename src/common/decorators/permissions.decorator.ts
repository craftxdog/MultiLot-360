import { SetMetadata } from '@nestjs/common';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
  PermissionKey,
} from '../constants/rbac.constant';

export const Permissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const AnyPermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
