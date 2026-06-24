import {
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../shared-kernel';
import { NumberLimit } from '../entities';

export const NUMBER_LIMITS_REPOSITORY = Symbol('NUMBER_LIMITS_REPOSITORY');

export type NumberLimitScopeFilter = 'GLOBAL' | 'SELLER';
export type NumberLimitDrawScopeFilter = 'DEFAULT' | 'DRAW';

export type CreateNumberLimitsInput = {
  sellerId?: string;
  drawConfigurationId?: string;
  drawCode?: string;
  numbers: string[];
  limitMiles: number;
  validFrom: string;
  validUntil?: string;
};

export type UpdateNumberLimitInput = {
  limitId: string;
  sellerId?: string | null;
  drawConfigurationId?: string | null;
  drawCode?: string | null;
  number?: string;
  limitMiles?: number;
  validFrom?: string;
  validUntil?: string | null;
};

export type ExpireNumberLimitInput = {
  limitId: string;
  expiresOn: string;
};

export type ListNumberLimitsQuery = OffsetPaginationQuery & {
  sellerId?: string;
  drawConfigurationId?: string;
  drawCode?: string;
  number?: string;
  sellerScope?: NumberLimitScopeFilter;
  drawScope?: NumberLimitDrawScopeFilter;
  active?: boolean;
  validOn?: string;
};

export interface NumberLimitsRepository {
  createMany(input: CreateNumberLimitsInput): Promise<NumberLimit[]>;
  findById(limitId: string): Promise<NumberLimit | null>;
  update(input: UpdateNumberLimitInput): Promise<NumberLimit | null>;
  expire(input: ExpireNumberLimitInput): Promise<NumberLimit | null>;
  list(query: ListNumberLimitsQuery): Promise<PaginatedResult<NumberLimit>>;
}
