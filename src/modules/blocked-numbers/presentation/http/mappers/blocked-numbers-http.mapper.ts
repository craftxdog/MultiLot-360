import {
  CreateBlockedNumbersCommand,
  DeleteBlockedNumberCommand,
} from '../../../application';
import { ListBlockedNumbersQuery } from '../../../domain';
import { CreateBlockedNumbersDto, ListBlockedNumbersQueryDto } from '../dto';

export class BlockedNumbersHttpMapper {
  static toCreateCommand(
    dto: CreateBlockedNumbersDto,
    createdByUserId?: string,
  ): CreateBlockedNumbersCommand {
    return {
      numbers: dto.numbers,
      shiftId: dto.shiftId,
      date: dto.date,
      reason: dto.reason,
      createdByUserId,
    };
  }

  static toListQuery(dto: ListBlockedNumbersQueryDto): ListBlockedNumbersQuery {
    return {
      number: dto.number,
      scope: dto.scope,
      shiftId: dto.shiftId,
      date: dto.date,
      drawCode: dto.drawCode,
      createdByUserId: dto.createdByUserId,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
    };
  }

  static toDeleteCommand(blockId: string): DeleteBlockedNumberCommand {
    return {
      blockId,
    };
  }
}
