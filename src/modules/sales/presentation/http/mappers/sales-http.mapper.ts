import {
  CreateSaleCommand,
  ListSalesUseCaseQuery,
  VoidSaleCommand,
} from '../../../application';
import { CreateSaleDto, ListSalesQueryDto, VoidSaleDto } from '../dto';

export class SalesHttpMapper {
  static toCreateCommand(
    dto: CreateSaleDto,
    currentSellerId?: string,
    actorRoleName?: string,
  ): CreateSaleCommand {
    return {
      requestedSellerId: dto.sellerId,
      currentSellerId,
      actorRoleName,
      shiftId: dto.shiftId,
      items: dto.items,
    };
  }

  static toListQuery(
    dto: ListSalesQueryDto,
    currentSellerId?: string,
    actorRoleName?: string,
  ): ListSalesUseCaseQuery {
    return {
      sellerId: dto.sellerId,
      shiftId: dto.shiftId,
      date: dto.date,
      drawCode: dto.drawCode,
      number: dto.number,
      status: dto.status,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
      currentSellerId,
      actorRoleName,
    };
  }

  static toVoidCommand(
    saleId: string,
    dto: VoidSaleDto,
    voidedByUserId?: string,
    currentSellerId?: string,
    actorRoleName?: string,
  ): VoidSaleCommand {
    return {
      saleId,
      reason: dto.reason,
      voidedByUserId,
      currentSellerId,
      actorRoleName,
    };
  }
}
