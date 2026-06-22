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
  Permissions,
  RequireModules,
  SYSTEM_MODULES,
} from '../../../../../common';
import {
  CreateNumberLimitsUseCase,
  ExpireNumberLimitUseCase,
  GetNumberLimitUseCase,
  ListNumberLimitsUseCase,
  UpdateNumberLimitUseCase,
} from '../../../application';
import {
  CreateNumberLimitsDto,
  ExpireNumberLimitDto,
  ListNumberLimitsQueryDto,
  NumberLimitResponseDto,
  UpdateNumberLimitDto,
} from '../dto';
import { NumberLimitsHttpMapper } from '../mappers';

@ApiTags('Number limits')
@ApiBearerAuth()
@Controller('number-limits')
@RequireModules(SYSTEM_MODULES.limitesNumero)
export class NumberLimitsController {
  constructor(
    private readonly createNumberLimits: CreateNumberLimitsUseCase,
    private readonly listNumberLimits: ListNumberLimitsUseCase,
    private readonly getNumberLimit: GetNumberLimitUseCase,
    private readonly updateNumberLimit: UpdateNumberLimitUseCase,
    private readonly expireNumberLimit: ExpireNumberLimitUseCase,
  ) {}

  @Get()
  @Permissions('limites_numero.read')
  @ApiOkResponse({ type: [NumberLimitResponseDto] })
  list(@Query() query: ListNumberLimitsQueryDto) {
    return this.listNumberLimits.execute(
      NumberLimitsHttpMapper.toListQuery(query),
    );
  }

  @Post()
  @Permissions('limites_numero.create')
  @ApiCreatedResponse({ type: [NumberLimitResponseDto] })
  create(@Body() body: CreateNumberLimitsDto) {
    return this.createNumberLimits.execute(
      NumberLimitsHttpMapper.toCreateCommand(body),
    );
  }

  @Get(':limitId')
  @Permissions('limites_numero.read')
  @ApiParam({ name: 'limitId', format: 'uuid' })
  @ApiOkResponse({ type: NumberLimitResponseDto })
  get(
    @Param('limitId', new ParseUUIDPipe({ version: '4' }))
    limitId: string,
  ) {
    return this.getNumberLimit.execute({ limitId });
  }

  @Patch(':limitId')
  @HttpCode(HttpStatus.OK)
  @Permissions('limites_numero.update')
  @ApiParam({ name: 'limitId', format: 'uuid' })
  @ApiOkResponse({ type: NumberLimitResponseDto })
  update(
    @Param('limitId', new ParseUUIDPipe({ version: '4' }))
    limitId: string,
    @Body() body: UpdateNumberLimitDto,
  ) {
    return this.updateNumberLimit.execute(
      NumberLimitsHttpMapper.toUpdateCommand(limitId, body),
    );
  }

  @Patch(':limitId/expire')
  @HttpCode(HttpStatus.OK)
  @Permissions('limites_numero.update')
  @ApiParam({ name: 'limitId', format: 'uuid' })
  @ApiOkResponse({ type: NumberLimitResponseDto })
  expire(
    @Param('limitId', new ParseUUIDPipe({ version: '4' }))
    limitId: string,
    @Body() body: ExpireNumberLimitDto,
  ) {
    return this.expireNumberLimit.execute(
      NumberLimitsHttpMapper.toExpireCommand(limitId, body),
    );
  }
}
