import { ListAuditEventsQuery } from '../../../domain';
import { ListAuditEventsQueryDto } from '../dto';

export class AuditEventsHttpMapper {
  static toListQuery(dto: ListAuditEventsQueryDto): ListAuditEventsQuery {
    return {
      userId: dto.userId,
      event: dto.event,
      createdFrom: dto.createdFrom,
      createdUntil: dto.createdUntil,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
    };
  }
}
