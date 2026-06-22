import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentSeller,
  CurrentUser,
  Permissions,
  RequireModules,
  SYSTEM_MODULES,
} from '../../../../../common';
import {
  CreateSaleUseCase,
  GetSaleUseCase,
  ListSalesUseCase,
  VoidSaleUseCase,
} from '../../../application';
import {
  CreateSaleDto,
  ListSalesQueryDto,
  SaleResponseDto,
  VoidSaleDto,
} from '../dto';
import { SalesHttpMapper } from '../mappers';

@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales')
@RequireModules(SYSTEM_MODULES.ventas)
export class SalesController {
  constructor(
    private readonly createSale: CreateSaleUseCase,
    private readonly listSales: ListSalesUseCase,
    private readonly getSale: GetSaleUseCase,
    private readonly voidSale: VoidSaleUseCase,
  ) {}

  @Get()
  @Permissions('ventas.read')
  @ApiOkResponse({ type: [SaleResponseDto] })
  list(
    @Query() query: ListSalesQueryDto,
    @CurrentSeller('id') currentSellerId?: string,
    @CurrentUser('roleName') actorRoleName?: string,
  ) {
    return this.listSales.execute(
      SalesHttpMapper.toListQuery(query, currentSellerId, actorRoleName),
    );
  }

  @Post()
  @Permissions('ventas.create')
  @ApiCreatedResponse({ type: SaleResponseDto })
  create(
    @Body() body: CreateSaleDto,
    @CurrentSeller('id') currentSellerId?: string,
    @CurrentUser('roleName') actorRoleName?: string,
  ) {
    return this.createSale.execute(
      SalesHttpMapper.toCreateCommand(body, currentSellerId, actorRoleName),
    );
  }

  @Get(':saleId')
  @Permissions('ventas.read')
  @ApiParam({ name: 'saleId', format: 'uuid' })
  @ApiOkResponse({ type: SaleResponseDto })
  get(
    @Param('saleId', new ParseUUIDPipe({ version: '4' }))
    saleId: string,
    @CurrentSeller('id') currentSellerId?: string,
    @CurrentUser('roleName') actorRoleName?: string,
  ) {
    return this.getSale.execute({
      saleId,
      currentSellerId,
      actorRoleName,
    });
  }

  @Patch(':saleId/void')
  @HttpCode(HttpStatus.OK)
  @Permissions('ventas.update')
  @ApiParam({ name: 'saleId', format: 'uuid' })
  @ApiOkResponse({ type: SaleResponseDto })
  void(
    @Param('saleId', new ParseUUIDPipe({ version: '4' }))
    saleId: string,
    @Body() body: VoidSaleDto,
    @CurrentUser('id') voidedByUserId?: string,
    @CurrentSeller('id') currentSellerId?: string,
    @CurrentUser('roleName') actorRoleName?: string,
  ) {
    return this.voidSale.execute(
      SalesHttpMapper.toVoidCommand(
        saleId,
        body,
        voidedByUserId,
        currentSellerId,
        actorRoleName,
      ),
    );
  }
}
