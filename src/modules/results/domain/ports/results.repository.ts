import {
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../shared-kernel';
import { DrawResult, WinningSale } from '../entities';

export const RESULTS_REPOSITORY = Symbol('RESULTS_REPOSITORY');

export type CreateResultInput = {
  shiftId: string;
  winningNumber: string;
  createdByUserId?: string;
};

export type ListResultsQuery = OffsetPaginationQuery & {
  shiftId?: string;
  date?: string;
  drawCode?: string;
  winningNumber?: string;
  createdByUserId?: string;
};

export type ListWinningSalesQuery = OffsetPaginationQuery & {
  resultId: string;
  sellerId?: string;
  paid?: boolean;
};

export interface ResultsRepository {
  create(input: CreateResultInput): Promise<DrawResult>;
  findById(resultId: string): Promise<DrawResult | null>;
  list(query: ListResultsQuery): Promise<PaginatedResult<DrawResult>>;
  listWinningSales(
    query: ListWinningSalesQuery,
  ): Promise<PaginatedResult<WinningSale> | null>;
}
