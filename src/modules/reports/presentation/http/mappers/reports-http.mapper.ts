import {
  GetBusinessAnalyticsQuery,
  GetOperationalOverviewQuery,
  ListSellerOperationalReportsQuery,
} from '../../../domain';
import {
  BusinessAnalyticsQueryDto,
  OperationalReportQueryDto,
  SellerOperationalReportsQueryDto,
} from '../dto';

export class ReportsHttpMapper {
  static toOverviewQuery(
    dto: OperationalReportQueryDto,
    currentSellerId?: string,
    actorRoleName?: string,
  ): GetOperationalOverviewQuery {
    return {
      dateFrom: dto.dateFrom,
      dateUntil: dto.dateUntil,
      sellerId: dto.sellerId,
      drawCode: dto.drawCode,
      currentSellerId,
      actorRoleName,
    };
  }

  static toSellerReportsQuery(
    dto: SellerOperationalReportsQueryDto,
    currentSellerId?: string,
    actorRoleName?: string,
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
      currentSellerId,
      actorRoleName,
    };
  }

  static toBusinessAnalyticsQuery(
    dto: BusinessAnalyticsQueryDto,
    currentSellerId?: string,
    actorRoleName?: string,
  ): GetBusinessAnalyticsQuery {
    return {
      dateFrom: dto.dateFrom,
      dateUntil: dto.dateUntil,
      sellerId: dto.sellerId,
      drawCode: dto.drawCode,
      topLimit: dto.topLimit,
      currentSellerId,
      actorRoleName,
    };
  }
}
