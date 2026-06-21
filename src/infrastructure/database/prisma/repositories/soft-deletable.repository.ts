import { PrismaService } from '../prisma.service';
import { GenericRepository } from './generic.repository';
import {
  CursorPaginationParams,
  CursorPaginatedRepositoryResult,
  DefaultTypeMap,
  FindAllParams,
  ModelName,
  OffsetPaginationParams,
  OffsetPaginatedRepositoryResult,
  RepositoryTypeMap,
  SoftDeletableEntity,
} from './types';

export class SoftDeletableRepository<
  T extends { id: string } & SoftDeletableEntity,
  M extends RepositoryTypeMap = DefaultTypeMap,
> extends GenericRepository<T, M> {
  constructor(prisma: PrismaService, modelName: ModelName) {
    super(prisma, modelName);
  }

  async softDelete(id: string): Promise<T> {
    return this.update(id, { deletedAt: new Date() });
  }

  async restore(id: string): Promise<T> {
    return this.update(id, { deletedAt: null });
  }

  async findAllWithDeleted(params?: FindAllParams<M>): Promise<T[]> {
    return super.findAll(params);
  }

  override async findAll(params?: FindAllParams<M>): Promise<T[]> {
    return super.findAll({
      ...params,
      where: this.withoutDeleted(params?.where),
    });
  }

  override async findCursorPage(
    params: CursorPaginationParams<M>,
  ): CursorPaginatedRepositoryResult<T> {
    return super.findCursorPage({
      ...params,
      where: this.withoutDeleted(params.where),
    });
  }

  override async findOffsetPage(
    params: OffsetPaginationParams<M>,
  ): OffsetPaginatedRepositoryResult<T> {
    return super.findOffsetPage({
      ...params,
      where: this.withoutDeleted(params.where),
    });
  }

  override async findById(
    id: string,
    options?: { include?: M['Include']; select?: M['Select'] },
  ): Promise<T | null> {
    return this.findOne(this.withoutDeleted({ id }), options);
  }

  override async findOne(
    where: M['WhereInput'],
    options?: { include?: M['Include']; select?: M['Select'] },
  ): Promise<T | null> {
    return super.findOne(this.withoutDeleted(where), options);
  }

  override async count(where?: M['WhereInput']): Promise<number> {
    return super.count(this.withoutDeleted(where));
  }

  override async exists(id: string): Promise<boolean> {
    const result = await this.count({ id });
    return result > 0;
  }

  protected withoutDeleted(where?: M['WhereInput']): M['WhereInput'] {
    return this.mergeWhere(where, { deletedAt: null });
  }
}
