import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Permissions,
  RequireModules,
  Roles,
  SYSTEM_MODULES,
} from '../../../../../common';
import { GetSalesMatrixUseCase } from '../../../application';
import { GetSalesMatrixQueryDto, SalesMatrixResponseDto } from '../dto';
import { SalesMatrixHttpMapper } from '../mappers';

@ApiTags('Sales Matrix')
@ApiBearerAuth()
@Controller('sales-matrix')
@Roles('ADMIN')
@RequireModules(SYSTEM_MODULES.salesMatrix)
export class SalesMatrixController {
  constructor(private readonly getSalesMatrix: GetSalesMatrixUseCase) {}

  @Get()
  @Permissions('matriz_ventas.read')
  @ApiOkResponse({ type: SalesMatrixResponseDto })
  get(@Query() query: GetSalesMatrixQueryDto) {
    return this.getSalesMatrix.execute(SalesMatrixHttpMapper.toQuery(query));
  }
}
