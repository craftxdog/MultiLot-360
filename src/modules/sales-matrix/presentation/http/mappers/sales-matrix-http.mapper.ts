import { GetSalesMatrixQuery } from '../../../application';
import { GetSalesMatrixQueryDto } from '../dto';

export class SalesMatrixHttpMapper {
  static toQuery(dto: GetSalesMatrixQueryDto): GetSalesMatrixQuery {
    return {
      date: dto.date,
      shiftId: dto.shiftId,
      drawCode: dto.drawCode,
      sellerId: dto.sellerId,
      status: dto.status,
    };
  }
}
