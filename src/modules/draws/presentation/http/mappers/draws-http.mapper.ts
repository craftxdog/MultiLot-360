import {
  CreateDrawConfigurationCommand,
  OpenDrawShiftCommand,
  UpdateDrawConfigurationCommand,
} from '../../../application';
import {
  ListActiveDrawShiftsQuery,
  ListDrawConfigurationsQuery,
  ListDrawShiftsQuery,
} from '../../../domain';
import {
  CreateDrawConfigurationDto,
  ListActiveDrawShiftsQueryDto,
  ListDrawConfigurationsQueryDto,
  ListDrawShiftsQueryDto,
  OpenDrawShiftDto,
  UpdateDrawConfigurationDto,
} from '../dto';

export class DrawsHttpMapper {
  static toCreateConfigurationCommand(
    dto: CreateDrawConfigurationDto,
  ): CreateDrawConfigurationCommand {
    return {
      code: dto.code,
      time: dto.time,
      tuesdayOnly: dto.tuesdayOnly,
      lockSecondsBefore: dto.lockSecondsBefore,
      reopenSecondsAfter: dto.reopenSecondsAfter,
      active: dto.active,
    };
  }

  static toListConfigurationsQuery(
    dto: ListDrawConfigurationsQueryDto,
  ): ListDrawConfigurationsQuery {
    return {
      active: dto.active,
    };
  }

  static toUpdateConfigurationCommand(
    configurationId: string,
    dto: UpdateDrawConfigurationDto,
  ): UpdateDrawConfigurationCommand {
    return {
      configurationId,
      code: dto.code,
      time: dto.time,
      tuesdayOnly: dto.tuesdayOnly,
      lockSecondsBefore: dto.lockSecondsBefore,
      reopenSecondsAfter: dto.reopenSecondsAfter,
      active: dto.active,
    };
  }

  static toOpenShiftCommand(dto: OpenDrawShiftDto): OpenDrawShiftCommand {
    return {
      configurationId: dto.configurationId,
      date: dto.date,
    };
  }

  static toListShiftsQuery(dto: ListDrawShiftsQueryDto): ListDrawShiftsQuery {
    return {
      date: dto.date,
      status: dto.status,
    };
  }

  static toListActiveShiftsQuery(
    dto: ListActiveDrawShiftsQueryDto,
  ): ListActiveDrawShiftsQuery {
    return {
      date: dto.date,
    };
  }
}
