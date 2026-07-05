import { SalesMatrix, SalesMatrixFilters } from '../entities';

export const SALES_MATRIX_REPOSITORY = Symbol('SALES_MATRIX_REPOSITORY');

export interface SalesMatrixRepository {
  get(filters: SalesMatrixFilters): Promise<SalesMatrix>;
}
