import {
  CreateDrawConfigurationCommand,
  OpenDrawShiftCommand,
} from '../../../application';
import {
  ListDrawConfigurationsQuery,
  ListDrawShiftsQuery,
} from '../../../domain';
import {
  CreateDrawConfigurationDto,
  ListDrawConfigurationsQueryDto,
  ListDrawShiftsQueryDto,
  OpenDrawShiftDto,
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
}
