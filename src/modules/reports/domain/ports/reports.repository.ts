import {
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../shared-kernel';
import {
  OperationalOverviewReport,
  OperationalReportFilters,
  SellerOperationalReport,
} from '../entities';

export const REPORTS_REPOSITORY = Symbol('REPORTS_REPOSITORY');

export type GetOperationalOverviewQuery = OperationalReportFilters;

export type ListSellerOperationalReportsQuery = OffsetPaginationQuery &
  OperationalReportFilters;

export interface ReportsRepository {
  getOperationalOverview(
    query: GetOperationalOverviewQuery,
  ): Promise<OperationalOverviewReport>;
  listSellerOperationalReports(
    query: ListSellerOperationalReportsQuery,
  ): Promise<PaginatedResult<SellerOperationalReport>>;
}
