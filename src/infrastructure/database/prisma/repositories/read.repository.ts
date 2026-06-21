import {
  buildCursorPagination,
  buildOffsetPagination,
  getCursorId,
} from '../../../../common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';
import { IReadRepository } from './interfaces';
import {
  CursorPaginationParams,
  CursorPaginatedRepositoryResult,
  DefaultTypeMap,
  FindAllParams,
  ModelName,
  OffsetPaginationParams,
  OffsetPaginatedRepositoryResult,
  RepositoryTypeMap,
} from './types';

export class ReadRepository<
  T extends { id: string },
  M extends RepositoryTypeMap = DefaultTypeMap,
>
  extends BaseRepository<T>
  implements IReadRepository<T, M>
{
  constructor(prisma: PrismaService, modelName: ModelName) {
    super(prisma, modelName);
  }

  async findById(
    id: string,
    options?: { include?: M['Include']; select?: M['Select'] },
  ): Promise<T | null> {
    return this.model.findUnique({
      where: { id },
      ...(options?.include && { include: options.include }),
      ...(options?.select && { select: options.select }),
    });
  }

  async findOne(
    where: M['WhereInput'],
    options?: { include?: M['Include']; select?: M['Select'] },
  ): Promise<T | null> {
    return this.model.findFirst({
      where,
      ...(options?.include && { include: options.include }),
      ...(options?.select && { select: options.select }),
    });
  }

  async findAll(params?: FindAllParams<M>): Promise<T[]> {
    return this.model.findMany(params ?? {});
  }

  async findCursorPage(
    params: CursorPaginationParams<M>,
  ): CursorPaginatedRepositoryResult<T> {
    const { pagination } = params;
    const cursorId = getCursorId(pagination.cursor);
    const records = await this.model.findMany({
      where: params.where,
      take: pagination.limit + 1,
      ...(cursorId && {
        cursor: { id: cursorId },
        skip: 1,
      }),
      orderBy:
        params.orderBy ??
        this.buildOrderBy<M['OrderByInput']>(
          pagination.sortBy,
          pagination.sortDirection,
        ),
      ...(params.include && { include: params.include }),
      ...(params.select && { select: params.select }),
    });

    return buildCursorPagination(records, pagination);
  }

  async findOffsetPage(
    params: OffsetPaginationParams<M>,
  ): OffsetPaginatedRepositoryResult<T> {
    const { pagination } = params;
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.model.findMany({
        where: params.where,
        skip,
        take: pagination.limit,
        orderBy:
          params.orderBy ??
          this.buildOrderBy<M['OrderByInput']>(
            pagination.sortBy,
            pagination.sortDirection,
          ),
        ...(params.include && { include: params.include }),
        ...(params.select && { select: params.select }),
      }),
      this.model.count({ where: params.where }),
    ]);

    return buildOffsetPagination(items, total, pagination);
  }

  async count(where?: M['WhereInput']): Promise<number> {
    return this.model.count({ where });
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.model.count({ where: { id } });
    return result > 0;
  }
}
