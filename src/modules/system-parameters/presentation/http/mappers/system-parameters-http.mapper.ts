import { UpsertSystemParameterCommand } from '../../../application';
import { ListSystemParametersQuery } from '../../../domain';
import { ListSystemParametersQueryDto, UpsertSystemParameterDto } from '../dto';

export class SystemParametersHttpMapper {
  static toListQuery(
    dto: ListSystemParametersQueryDto,
  ): ListSystemParametersQuery {
    return {
      key: dto.key,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
    };
  }

  static toUpsertCommand(
    key: string,
    dto: UpsertSystemParameterDto,
  ): UpsertSystemParameterCommand {
    return {
      key,
      value: dto.value,
    };
  }
}
