import { SetMetadata } from '@nestjs/common';
import { SKIP_AUTH_CONTEXT_KEY } from '../constants/rbac.constant';

export const SkipAuthContext = () => SetMetadata(SKIP_AUTH_CONTEXT_KEY, true);
