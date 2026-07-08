import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CurrentSeller,
  CurrentUser,
  Permissions,
  RequireModules,
  SYSTEM_MODULES,
} from '../../../../../common';
import {
  GetBusinessAnalyticsUseCase,
  GetOperationalOverviewUseCase,
  ListSellerOperationalReportsUseCase,
} from '../../../application';
import {
  BusinessAnalyticsQueryDto,
  BusinessAnalyticsReportResponseDto,
  OperationalOverviewReportResponseDto,
  OperationalReportQueryDto,
  SellerOperationalReportResponseDto,
  SellerOperationalReportsQueryDto,
} from '../dto';
import { ReportsHttpMapper } from '../mappers';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@RequireModules(SYSTEM_MODULES.ventas)
export class ReportsController {
  constructor(
    private readonly getBusinessAnalytics: GetBusinessAnalyticsUseCase,
    private readonly getOperationalOverview: GetOperationalOverviewUseCase,
    private readonly listSellerOperationalReports: ListSellerOperationalReportsUseCase,
  ) {}

  @Get('analytics')
  @Permissions('ventas.read')
  @ApiOkResponse({ type: BusinessAnalyticsReportResponseDto })
  analytics(
    @Query() query: BusinessAnalyticsQueryDto,
    @CurrentSeller('id') currentSellerId?: string,
    @CurrentUser('roleName') actorRoleName?: string,
  ) {
    return this.getBusinessAnalytics.execute(
      ReportsHttpMapper.toBusinessAnalyticsQuery(
        query,
        currentSellerId,
        actorRoleName,
      ),
    );
  }

  @Get('overview')
  @Permissions('ventas.read')
  @ApiOkResponse({ type: OperationalOverviewReportResponseDto })
  overview(
    @Query() query: OperationalReportQueryDto,
    @CurrentSeller('id') currentSellerId?: string,
    @CurrentUser('roleName') actorRoleName?: string,
  ) {
    return this.getOperationalOverview.execute(
      ReportsHttpMapper.toOverviewQuery(query, currentSellerId, actorRoleName),
    );
  }

  @Get('sellers')
  @Permissions('ventas.read')
  @ApiOkResponse({ type: [SellerOperationalReportResponseDto] })
  sellers(
    @Query() query: SellerOperationalReportsQueryDto,
    @CurrentSeller('id') currentSellerId?: string,
    @CurrentUser('roleName') actorRoleName?: string,
  ) {
    return this.listSellerOperationalReports.execute(
      ReportsHttpMapper.toSellerReportsQuery(
        query,
        currentSellerId,
        actorRoleName,
      ),
    );
  }
}
