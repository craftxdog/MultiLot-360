import {
  GetOperationalOverviewQuery,
  ListSellerOperationalReportsQuery,
} from '../../../domain';
import {
  OperationalReportQueryDto,
  SellerOperationalReportsQueryDto,
} from '../dto';

export class ReportsHttpMapper {
  static toOverviewQuery(
    dto: OperationalReportQueryDto,
  ): GetOperationalOverviewQuery {
    return {
      dateFrom: dto.dateFrom,
      dateUntil: dto.dateUntil,
      sellerId: dto.sellerId,
      drawCode: dto.drawCode,
    };
  }

  static toSellerReportsQuery(
    dto: SellerOperationalReportsQueryDto,
  ): ListSellerOperationalReportsQuery {
    return {
      dateFrom: dto.dateFrom,
      dateUntil: dto.dateUntil,
      sellerId: dto.sellerId,
      drawCode: dto.drawCode,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
    };
  }
}
