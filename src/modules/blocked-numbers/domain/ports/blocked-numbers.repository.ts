import {
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../shared-kernel';
import { BlockedNumber, BlockedNumberScope } from '../entities';

export const BLOCKED_NUMBERS_REPOSITORY = Symbol('BLOCKED_NUMBERS_REPOSITORY');

export type CreateBlockedNumbersInput = {
  numbers: string[];
  shiftId?: string;
  date?: string;
  reason?: string;
  createdByUserId?: string;
};

export type ListBlockedNumbersQuery = OffsetPaginationQuery & {
  number?: string;
  scope?: BlockedNumberScope;
  shiftId?: string;
  date?: string;
  drawCode?: string;
  createdByUserId?: string;
};

export interface BlockedNumbersRepository {
  createMany(input: CreateBlockedNumbersInput): Promise<BlockedNumber[]>;
  findById(blockId: string): Promise<BlockedNumber | null>;
  list(query: ListBlockedNumbersQuery): Promise<PaginatedResult<BlockedNumber>>;
  delete(blockId: string): Promise<BlockedNumber | null>;
}
