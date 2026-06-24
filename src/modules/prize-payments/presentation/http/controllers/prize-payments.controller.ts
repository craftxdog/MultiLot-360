import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  CurrentUser,
  Permissions,
  RequireModules,
  SYSTEM_MODULES,
} from '../../../../../common';
import {
  GetPrizePaymentUseCase,
  ListPrizePaymentsUseCase,
  PayPrizeUseCase,
} from '../../../application';
import {
  ListPrizePaymentsQueryDto,
  PayPrizeDto,
  PrizePaymentResponseDto,
} from '../dto';
import { PrizePaymentsHttpMapper } from '../mappers';

@ApiTags('Prize payments')
@ApiBearerAuth()
@Controller('prize-payments')
@RequireModules(SYSTEM_MODULES.pagosPremios)
export class PrizePaymentsController {
  constructor(
    private readonly payPrize: PayPrizeUseCase,
    private readonly getPrizePayment: GetPrizePaymentUseCase,
    private readonly listPrizePayments: ListPrizePaymentsUseCase,
  ) {}

  @Get()
  @Permissions('pagos_premios.read')
  @ApiOkResponse({ type: [PrizePaymentResponseDto] })
  list(@Query() query: ListPrizePaymentsQueryDto) {
    return this.listPrizePayments.execute(
      PrizePaymentsHttpMapper.toListQuery(query),
    );
  }

  @Post()
  @Permissions('pagos_premios.create')
  @ApiCreatedResponse({ type: PrizePaymentResponseDto })
  create(@Body() body: PayPrizeDto, @CurrentUser('id') paidByUserId?: string) {
    return this.payPrize.execute(
      PrizePaymentsHttpMapper.toPayCommand(body, paidByUserId),
    );
  }

  @Get(':saleId')
  @Permissions('pagos_premios.read')
  @ApiParam({
    name: 'saleId',
    format: 'uuid',
    description: 'Paid sale id. This is also the payment id.',
  })
  @ApiOkResponse({ type: PrizePaymentResponseDto })
  get(
    @Param('saleId', new ParseUUIDPipe({ version: '4' }))
    saleId: string,
  ) {
    return this.getPrizePayment.execute({ saleId });
  }
}
