import { PayPrizeCommand } from '../../../application';
import { ListPrizePaymentsQuery } from '../../../domain';
import { ListPrizePaymentsQueryDto, PayPrizeDto } from '../dto';

export class PrizePaymentsHttpMapper {
  static toPayCommand(
    dto: PayPrizeDto,
    paidByUserId?: string,
  ): PayPrizeCommand {
    return {
      resultId: dto.resultId,
      saleId: dto.saleId,
      paidByUserId,
    };
  }

  static toListQuery(dto: ListPrizePaymentsQueryDto): ListPrizePaymentsQuery {
    return {
      resultId: dto.resultId,
      saleId: dto.saleId,
      sellerId: dto.sellerId,
      paidByUserId: dto.paidByUserId,
      date: dto.date,
      drawCode: dto.drawCode,
      paidFrom: dto.paidFrom,
      paidUntil: dto.paidUntil,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
    };
  }
}
