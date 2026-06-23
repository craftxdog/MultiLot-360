import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
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
  GetSystemParameterUseCase,
  ListSystemParametersUseCase,
  UpsertSystemParameterUseCase,
} from '../../../application';
import {
  ListSystemParametersQueryDto,
  SystemParameterResponseDto,
  UpsertSystemParameterDto,
} from '../dto';
import { SystemParametersHttpMapper } from '../mappers';

@ApiTags('System parameters')
@ApiBearerAuth()
@Controller('parameters')
@RequireModules(SYSTEM_MODULES.parametros)
export class SystemParametersController {
  constructor(
    private readonly listSystemParameters: ListSystemParametersUseCase,
    private readonly getSystemParameter: GetSystemParameterUseCase,
    private readonly upsertSystemParameter: UpsertSystemParameterUseCase,
  ) {}

  @Get()
  @Permissions('parametros.read')
  @ApiOkResponse({ type: [SystemParameterResponseDto] })
  list(@Query() query: ListSystemParametersQueryDto) {
    return this.listSystemParameters.execute(
      SystemParametersHttpMapper.toListQuery(query),
    );
  }

  @Get(':key')
  @Permissions('parametros.read')
  @ApiParam({ name: 'key', example: 'sales.void_window_minutes' })
  @ApiOkResponse({ type: SystemParameterResponseDto })
  get(@Param('key') key: string) {
    return this.getSystemParameter.execute({ key });
  }

  @Put(':key')
  @Permissions('parametros.update')
  @ApiParam({ name: 'key', example: 'sales.void_window_minutes' })
  @ApiOkResponse({ type: SystemParameterResponseDto })
  upsert(@Param('key') key: string, @Body() body: UpsertSystemParameterDto) {
    return this.upsertSystemParameter.execute(
      SystemParametersHttpMapper.toUpsertCommand(key, body),
    );
  }
}
