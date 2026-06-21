import { SetMetadata } from '@nestjs/common';
import { MODULES_KEY, ModuleKey } from '../constants/rbac.constant';

export const RequireModules = (...modules: ModuleKey[]) =>
  SetMetadata(MODULES_KEY, modules);
