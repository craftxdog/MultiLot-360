import {
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../shared-kernel';
import { Sale, SaleStatus } from '../entities';

export const SALES_REPOSITORY = Symbol('SALES_REPOSITORY');

export type SaleItemInput = {
  number: string;
  prizeMiles: number;
};

export type CreateSaleInput = {
  sellerId: string;
  shiftId: string;
  items: SaleItemInput[];
};

export type VoidSaleInput = {
  saleId: string;
  voidedByUserId: string;
  reason: string;
};

export type SalesVoidPolicy = {
  windowMinutes: number;
};

export type UpdateSalesVoidPolicyInput = {
  windowMinutes: number;
};

export type ListSalesQuery = OffsetPaginationQuery & {
  sellerId?: string;
  shiftId?: string;
  date?: string;
  drawCode?: string;
  number?: string;
  status?: SaleStatus;
};

export interface SalesRepository {
  create(input: CreateSaleInput): Promise<Sale>;
  findById(saleId: string): Promise<Sale | null>;
  list(query: ListSalesQuery): Promise<PaginatedResult<Sale>>;
  void(input: VoidSaleInput): Promise<Sale | null>;
  getVoidPolicy(): Promise<SalesVoidPolicy>;
  updateVoidPolicy(input: UpdateSalesVoidPolicyInput): Promise<SalesVoidPolicy>;
}
