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
  CreateCashCutUseCase,
  GetCashCutSummaryUseCase,
  GetCashCutUseCase,
  ListCashCutsUseCase,
} from '../../../application';
import {
  CashCutResponseDto,
  CashCutSummaryResponseDto,
  CreateCashCutDto,
  ListCashCutsQueryDto,
} from '../dto';
import { CashCutsHttpMapper } from '../mappers';

@ApiTags('Cash cuts')
@ApiBearerAuth()
@Controller('cash-cuts')
@RequireModules(SYSTEM_MODULES.cortes)
export class CashCutsController {
  constructor(
    private readonly createCashCut: CreateCashCutUseCase,
    private readonly listCashCuts: ListCashCutsUseCase,
    private readonly getCashCut: GetCashCutUseCase,
    private readonly getCashCutSummary: GetCashCutSummaryUseCase,
  ) {}

  @Get()
  @Permissions('cortes.read')
  @ApiOkResponse({ type: [CashCutResponseDto] })
  list(@Query() query: ListCashCutsQueryDto) {
    return this.listCashCuts.execute(CashCutsHttpMapper.toListQuery(query));
  }

  @Post()
  @Permissions('cortes.create')
  @ApiCreatedResponse({ type: CashCutResponseDto })
  create(
    @Body() body: CreateCashCutDto,
    @CurrentUser('id') createdByUserId?: string,
  ) {
    return this.createCashCut.execute(
      CashCutsHttpMapper.toCreateCommand(body, createdByUserId),
    );
  }

  @Get(':cutId')
  @Permissions('cortes.read')
  @ApiParam({ name: 'cutId', format: 'uuid' })
  @ApiOkResponse({ type: CashCutResponseDto })
  get(
    @Param('cutId', new ParseUUIDPipe({ version: '4' }))
    cutId: string,
  ) {
    return this.getCashCut.execute({ cutId });
  }

  @Get(':cutId/summary')
  @Permissions('cortes.read')
  @ApiParam({ name: 'cutId', format: 'uuid' })
  @ApiOkResponse({ type: CashCutSummaryResponseDto })
  summary(
    @Param('cutId', new ParseUUIDPipe({ version: '4' }))
    cutId: string,
  ) {
    return this.getCashCutSummary.execute({ cutId });
  }
}
