import {
  CreateNumberLimitsCommand,
  ExpireNumberLimitCommand,
  UpdateNumberLimitCommand,
} from '../../../application';
import { ListNumberLimitsQuery } from '../../../domain';
import {
  CreateNumberLimitsDto,
  ExpireNumberLimitDto,
  ListNumberLimitsQueryDto,
  UpdateNumberLimitDto,
} from '../dto';

export class NumberLimitsHttpMapper {
  static toCreateCommand(
    dto: CreateNumberLimitsDto,
  ): CreateNumberLimitsCommand {
    return {
      sellerId: dto.sellerId,
      drawConfigurationId: dto.drawConfigurationId,
      drawCode: dto.drawCode,
      numbers: dto.numbers,
      limitMiles: dto.limitMiles,
      validFrom: dto.validFrom,
      validUntil: dto.validUntil,
    };
  }

  static toListQuery(dto: ListNumberLimitsQueryDto): ListNumberLimitsQuery {
    return {
      sellerId: dto.sellerId,
      drawConfigurationId: dto.drawConfigurationId,
      drawCode: dto.drawCode,
      number: dto.number,
      sellerScope: dto.sellerScope,
      drawScope: dto.drawScope,
      active: dto.active,
      validOn: dto.validOn,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
    };
  }

  static toUpdateCommand(
    limitId: string,
    dto: UpdateNumberLimitDto,
  ): UpdateNumberLimitCommand {
    return {
      limitId,
      sellerId: dto.sellerId,
      drawConfigurationId: dto.drawConfigurationId,
      drawCode: dto.drawCode,
      number: dto.number,
      limitMiles: dto.limitMiles,
      validFrom: dto.validFrom,
      validUntil: dto.validUntil,
    };
  }

  static toExpireCommand(
    limitId: string,
    dto: ExpireNumberLimitDto,
  ): ExpireNumberLimitCommand {
    return {
      limitId,
      expiresOn: dto.expiresOn,
    };
  }
}
