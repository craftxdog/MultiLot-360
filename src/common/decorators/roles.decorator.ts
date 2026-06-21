import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY, RoleKey } from '../constants/rbac.constant';

export const Roles = (...roles: RoleKey[]) => SetMetadata(ROLES_KEY, roles);
