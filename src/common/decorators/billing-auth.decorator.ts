import { SetMetadata } from '@nestjs/common';
import {
  BILLING_AUTH_MODE_KEY,
  BillingAuthMode,
} from '../constants/rbac.constant';

export const BillingAuth = (mode: BillingAuthMode = 'portal') =>
  SetMetadata(BILLING_AUTH_MODE_KEY, mode);
