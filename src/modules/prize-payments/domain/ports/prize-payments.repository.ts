import {
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../shared-kernel';
import { PrizePayment } from '../entities';

export const PRIZE_PAYMENTS_REPOSITORY = Symbol('PRIZE_PAYMENTS_REPOSITORY');

export type PayPrizeInput = {
  resultId: string;
  saleId: string;
  paidByUserId?: string;
};

export type ListPrizePaymentsQuery = OffsetPaginationQuery & {
  resultId?: string;
  saleId?: string;
  sellerId?: string;
  paidByUserId?: string;
  date?: string;
  drawCode?: string;
  paidFrom?: string;
  paidUntil?: string;
};

export interface PrizePaymentsRepository {
  pay(input: PayPrizeInput): Promise<PrizePayment>;
  findBySaleId(saleId: string): Promise<PrizePayment | null>;
  list(query: ListPrizePaymentsQuery): Promise<PaginatedResult<PrizePayment>>;
}
