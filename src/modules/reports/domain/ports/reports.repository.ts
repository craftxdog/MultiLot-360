import {
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../shared-kernel';
import {
  BusinessAnalyticsReport,
  BusinessAnalyticsFilters,
  OperationalOverviewReport,
  OperationalReportFilters,
  SellerOperationalReport,
} from '../entities';

export const REPORTS_REPOSITORY = Symbol('REPORTS_REPOSITORY');

export type ReportAccessScope = {
  currentSellerId?: string;
  actorRoleName?: string;
};

export type GetOperationalOverviewQuery = OperationalReportFilters &
  ReportAccessScope;
export type GetBusinessAnalyticsQuery = BusinessAnalyticsFilters &
  ReportAccessScope;

export type ListSellerOperationalReportsQuery = OffsetPaginationQuery &
  OperationalReportFilters &
  ReportAccessScope;

export interface ReportsRepository {
  getOperationalOverview(
    query: GetOperationalOverviewQuery,
  ): Promise<OperationalOverviewReport>;
  listSellerOperationalReports(
    query: ListSellerOperationalReportsQuery,
  ): Promise<PaginatedResult<SellerOperationalReport>>;
  getBusinessAnalytics(
    query: GetBusinessAnalyticsQuery,
  ): Promise<BusinessAnalyticsReport>;
}
