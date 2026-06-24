import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Permissions,
  RequireModules,
  SYSTEM_MODULES,
} from '../../../../../common';
import {
  GetOperationalOverviewUseCase,
  ListSellerOperationalReportsUseCase,
} from '../../../application';
import {
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
    private readonly getOperationalOverview: GetOperationalOverviewUseCase,
    private readonly listSellerOperationalReports: ListSellerOperationalReportsUseCase,
  ) {}

  @Get('overview')
  @Permissions('ventas.read')
  @ApiOkResponse({ type: OperationalOverviewReportResponseDto })
  overview(@Query() query: OperationalReportQueryDto) {
    return this.getOperationalOverview.execute(
      ReportsHttpMapper.toOverviewQuery(query),
    );
  }

  @Get('sellers')
  @Permissions('ventas.read')
  @ApiOkResponse({ type: [SellerOperationalReportResponseDto] })
  sellers(@Query() query: SellerOperationalReportsQueryDto) {
    return this.listSellerOperationalReports.execute(
      ReportsHttpMapper.toSellerReportsQuery(query),
    );
  }
}
