import {
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../shared-kernel';
import { CashCut, CashCutSummary } from '../entities';

export const CASH_CUTS_REPOSITORY = Symbol('CASH_CUTS_REPOSITORY');

export type CreateCashCutInput = {
  startDate: string;
  endDate: string;
  description?: string;
  visibleToSellers?: boolean;
  createdByUserId?: string;
};

export type ListCashCutsQuery = OffsetPaginationQuery & {
  startDate?: string;
  endDate?: string;
  visibleToSellers?: boolean;
  createdByUserId?: string;
};

export interface CashCutsRepository {
  create(input: CreateCashCutInput): Promise<CashCut>;
  findById(cutId: string): Promise<CashCut | null>;
  list(query: ListCashCutsQuery): Promise<PaginatedResult<CashCut>>;
  getSummary(cutId: string): Promise<CashCutSummary | null>;
}
