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
  CloseDrawShiftUseCase,
  CreateDrawConfigurationUseCase,
  ListDrawConfigurationsUseCase,
  ListDrawShiftsUseCase,
  OpenDrawShiftUseCase,
} from '../../../application';
import {
  CreateDrawConfigurationDto,
  DrawConfigurationResponseDto,
  DrawShiftResponseDto,
  ListDrawConfigurationsQueryDto,
  ListDrawShiftsQueryDto,
  OpenDrawShiftDto,
} from '../dto';
import { DrawsHttpMapper } from '../mappers';

@ApiTags('Draws')
@ApiBearerAuth()
@Controller('draws')
export class DrawsController {
  constructor(
    private readonly createConfiguration: CreateDrawConfigurationUseCase,
    private readonly listConfigurations: ListDrawConfigurationsUseCase,
    private readonly openShift: OpenDrawShiftUseCase,
    private readonly closeShift: CloseDrawShiftUseCase,
    private readonly listShifts: ListDrawShiftsUseCase,
  ) {}

  @Get('configurations')
  @RequireModules(SYSTEM_MODULES.sorteos)
  @Permissions('sorteos.read')
  @ApiOkResponse({ type: [DrawConfigurationResponseDto] })
  listDrawConfigurations(@Query() query: ListDrawConfigurationsQueryDto) {
    return this.listConfigurations.execute(
      DrawsHttpMapper.toListConfigurationsQuery(query),
    );
  }

  @Post('configurations')
  @RequireModules(SYSTEM_MODULES.sorteos)
  @Permissions('sorteos.create')
  @ApiCreatedResponse({ type: DrawConfigurationResponseDto })
  createDrawConfiguration(@Body() body: CreateDrawConfigurationDto) {
    return this.createConfiguration.execute(
      DrawsHttpMapper.toCreateConfigurationCommand(body),
    );
  }

  @Get('shifts')
  @RequireModules(SYSTEM_MODULES.turnos)
  @Permissions('turnos.read')
  @ApiOkResponse({ type: [DrawShiftResponseDto] })
  listDrawShifts(@Query() query: ListDrawShiftsQueryDto) {
    return this.listShifts.execute(DrawsHttpMapper.toListShiftsQuery(query));
  }

  @Post('shifts')
  @RequireModules(SYSTEM_MODULES.turnos)
  @Permissions('turnos.create')
  @ApiCreatedResponse({ type: DrawShiftResponseDto })
  openDrawShift(@Body() body: OpenDrawShiftDto) {
    return this.openShift.execute(DrawsHttpMapper.toOpenShiftCommand(body));
  }

  @Patch('shifts/:shiftId/close')
  @HttpCode(HttpStatus.OK)
  @RequireModules(SYSTEM_MODULES.turnos)
  @Permissions('turnos.update')
  @ApiParam({ name: 'shiftId', format: 'uuid' })
  @ApiOkResponse({ type: DrawShiftResponseDto })
  closeDrawShift(
    @Param('shiftId', new ParseUUIDPipe({ version: '4' })) shiftId: string,
  ) {
    return this.closeShift.execute({ shiftId });
  }
}
