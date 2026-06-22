import { CreateResultCommand } from '../../../application';
import { ListResultsQuery, ListWinningSalesQuery } from '../../../domain/ports';
import {
  CreateResultDto,
  ListResultsQueryDto,
  ListWinningSalesQueryDto,
} from '../dto';

export class ResultsHttpMapper {
  static toCreateCommand(
    dto: CreateResultDto,
    createdByUserId?: string,
  ): CreateResultCommand {
    return {
      shiftId: dto.shiftId,
      winningNumber: dto.winningNumber,
      createdByUserId,
    };
  }

  static toListQuery(dto: ListResultsQueryDto): ListResultsQuery {
    return {
      shiftId: dto.shiftId,
      date: dto.date,
      drawCode: dto.drawCode,
      winningNumber: dto.winningNumber,
      createdByUserId: dto.createdByUserId,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
    };
  }

  static toWinningSalesQuery(
    resultId: string,
    dto: ListWinningSalesQueryDto,
  ): ListWinningSalesQuery {
    return {
      resultId,
      sellerId: dto.sellerId,
      paid: dto.paid,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
    };
  }
}
