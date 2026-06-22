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
  BlockDrawShiftUseCase,
  CloseDrawShiftUseCase,
  CreateDrawConfigurationUseCase,
  GetDrawConfigurationUseCase,
  ListActiveDrawShiftsUseCase,
  ListDrawConfigurationsUseCase,
  ListDrawShiftsUseCase,
  OpenDrawShiftUseCase,
  ReopenDrawShiftUseCase,
  UpdateDrawConfigurationUseCase,
} from '../../../application';
import {
  CreateDrawConfigurationDto,
  DrawConfigurationResponseDto,
  DrawShiftResponseDto,
  ListActiveDrawShiftsQueryDto,
  ListDrawConfigurationsQueryDto,
  ListDrawShiftsQueryDto,
  OpenDrawShiftDto,
  UpdateDrawConfigurationDto,
} from '../dto';
import { DrawsHttpMapper } from '../mappers';

@ApiTags('Draws')
@ApiBearerAuth()
@Controller('draws')
export class DrawsController {
  constructor(
    private readonly createConfiguration: CreateDrawConfigurationUseCase,
    private readonly getConfiguration: GetDrawConfigurationUseCase,
    private readonly updateConfiguration: UpdateDrawConfigurationUseCase,
    private readonly listConfigurations: ListDrawConfigurationsUseCase,
    private readonly openShift: OpenDrawShiftUseCase,
    private readonly blockShift: BlockDrawShiftUseCase,
    private readonly reopenShift: ReopenDrawShiftUseCase,
    private readonly closeShift: CloseDrawShiftUseCase,
    private readonly listActiveShifts: ListActiveDrawShiftsUseCase,
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

  @Get('configurations/:configurationId')
  @RequireModules(SYSTEM_MODULES.sorteos)
  @Permissions('sorteos.read')
  @ApiParam({ name: 'configurationId', format: 'uuid' })
  @ApiOkResponse({ type: DrawConfigurationResponseDto })
  getDrawConfiguration(
    @Param('configurationId', new ParseUUIDPipe({ version: '4' }))
    configurationId: string,
  ) {
    return this.getConfiguration.execute({ configurationId });
  }

  @Patch('configurations/:configurationId')
  @HttpCode(HttpStatus.OK)
  @RequireModules(SYSTEM_MODULES.sorteos)
  @Permissions('sorteos.update')
  @ApiParam({ name: 'configurationId', format: 'uuid' })
  @ApiOkResponse({ type: DrawConfigurationResponseDto })
  updateDrawConfiguration(
    @Param('configurationId', new ParseUUIDPipe({ version: '4' }))
    configurationId: string,
    @Body() body: UpdateDrawConfigurationDto,
  ) {
    return this.updateConfiguration.execute(
      DrawsHttpMapper.toUpdateConfigurationCommand(configurationId, body),
    );
  }

  @Get('shifts/active')
  @RequireModules(SYSTEM_MODULES.turnos)
  @Permissions('turnos.read')
  @ApiOkResponse({ type: [DrawShiftResponseDto] })
  listActiveDrawShifts(@Query() query: ListActiveDrawShiftsQueryDto) {
    return this.listActiveShifts.execute(
      DrawsHttpMapper.toListActiveShiftsQuery(query),
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

  @Patch('shifts/:shiftId/block')
  @HttpCode(HttpStatus.OK)
  @RequireModules(SYSTEM_MODULES.turnos)
  @Permissions('turnos.update')
  @ApiParam({ name: 'shiftId', format: 'uuid' })
  @ApiOkResponse({ type: DrawShiftResponseDto })
  blockDrawShift(
    @Param('shiftId', new ParseUUIDPipe({ version: '4' })) shiftId: string,
  ) {
    return this.blockShift.execute({ shiftId });
  }

  @Patch('shifts/:shiftId/reopen')
  @HttpCode(HttpStatus.OK)
  @RequireModules(SYSTEM_MODULES.turnos)
  @Permissions('turnos.update')
  @ApiParam({ name: 'shiftId', format: 'uuid' })
  @ApiOkResponse({ type: DrawShiftResponseDto })
  reopenDrawShift(
    @Param('shiftId', new ParseUUIDPipe({ version: '4' })) shiftId: string,
  ) {
    return this.reopenShift.execute({ shiftId });
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
