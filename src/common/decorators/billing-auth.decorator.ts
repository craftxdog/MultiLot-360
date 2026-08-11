import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  BILLING_AUTH_MODE_KEY,
  BillingAuthMode,
} from '../constants/rbac.constant';

export const BillingAuth = (mode: BillingAuthMode = 'portal') =>
  applyDecorators(SetMetadata(BILLING_AUTH_MODE_KEY, mode), ApiBearerAuth());
