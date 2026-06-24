import { CreateCashCutCommand } from '../../../application';
import { ListCashCutsQuery } from '../../../domain';
import { CreateCashCutDto, ListCashCutsQueryDto } from '../dto';

export class CashCutsHttpMapper {
  static toCreateCommand(
    dto: CreateCashCutDto,
    createdByUserId?: string,
  ): CreateCashCutCommand {
    return {
      startDate: dto.startDate,
      endDate: dto.endDate,
      description: dto.description,
      visibleToSellers: dto.visibleToSellers,
      createdByUserId,
    };
  }

  static toListQuery(dto: ListCashCutsQueryDto): ListCashCutsQuery {
    return {
      startDate: dto.startDate,
      endDate: dto.endDate,
      visibleToSellers: dto.visibleToSellers,
      createdByUserId: dto.createdByUserId,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
    };
  }
}
