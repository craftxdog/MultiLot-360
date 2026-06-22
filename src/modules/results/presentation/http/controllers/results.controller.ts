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
  CreateResultUseCase,
  GetResultUseCase,
  ListResultsUseCase,
  ListWinningSalesUseCase,
} from '../../../application';
import {
  CreateResultDto,
  ListResultsQueryDto,
  ListWinningSalesQueryDto,
  ResultResponseDto,
  WinningSaleResponseDto,
} from '../dto';
import { ResultsHttpMapper } from '../mappers';

@ApiTags('Results')
@ApiBearerAuth()
@Controller('results')
@RequireModules(SYSTEM_MODULES.resultados)
export class ResultsController {
  constructor(
    private readonly createResult: CreateResultUseCase,
    private readonly listResults: ListResultsUseCase,
    private readonly getResult: GetResultUseCase,
    private readonly listWinningSales: ListWinningSalesUseCase,
  ) {}

  @Get()
  @Permissions('resultados.read')
  @ApiOkResponse({ type: [ResultResponseDto] })
  list(@Query() query: ListResultsQueryDto) {
    return this.listResults.execute(ResultsHttpMapper.toListQuery(query));
  }

  @Post()
  @Permissions('resultados.create')
  @ApiCreatedResponse({ type: ResultResponseDto })
  create(
    @Body() body: CreateResultDto,
    @CurrentUser('id') createdByUserId?: string,
  ) {
    return this.createResult.execute(
      ResultsHttpMapper.toCreateCommand(body, createdByUserId),
    );
  }

  @Get(':resultId')
  @Permissions('resultados.read')
  @ApiParam({ name: 'resultId', format: 'uuid' })
  @ApiOkResponse({ type: ResultResponseDto })
  get(
    @Param('resultId', new ParseUUIDPipe({ version: '4' }))
    resultId: string,
  ) {
    return this.getResult.execute({ resultId });
  }

  @Get(':resultId/winning-sales')
  @Permissions('resultados.read')
  @ApiParam({ name: 'resultId', format: 'uuid' })
  @ApiOkResponse({ type: [WinningSaleResponseDto] })
  getWinningSales(
    @Param('resultId', new ParseUUIDPipe({ version: '4' }))
    resultId: string,
    @Query() query: ListWinningSalesQueryDto,
  ) {
    return this.listWinningSales.execute(
      ResultsHttpMapper.toWinningSalesQuery(resultId, query),
    );
  }
}
