import { Prisma } from '@prisma/client';
import { PaginatedResult } from '../../../../../shared-kernel';
import {
  BatchResult,
  CursorPaginationParams,
  DefaultTypeMap,
  FindAllParams,
  OffsetPaginationParams,
  RepositoryTypeMap,
} from '../types';

export interface IReadRepository<
  T,
  M extends RepositoryTypeMap = DefaultTypeMap,
> {
  findById(
    id: string,
    options?: { include?: M['Include']; select?: M['Select'] },
  ): Promise<T | null>;
  findOne(
    where: M['WhereInput'],
    options?: { include?: M['Include']; select?: M['Select'] },
  ): Promise<T | null>;
  findAll(params?: FindAllParams<M>): Promise<T[]>;
  findCursorPage(
    params: CursorPaginationParams<M>,
  ): Promise<PaginatedResult<T>>;
  findOffsetPage(
    params: OffsetPaginationParams<M>,
  ): Promise<PaginatedResult<T>>;
  count(where?: M['WhereInput']): Promise<number>;
  exists(id: string): Promise<boolean>;
}

export interface IWriteRepository<
  T,
  M extends RepositoryTypeMap = DefaultTypeMap,
> {
  create(data: M['CreateInput']): Promise<T>;
  update(id: string, data: M['UpdateInput']): Promise<T>;
  delete(id: string): Promise<T>;
  upsert(
    where: M['WhereUniqueInput'],
    create: M['CreateInput'],
    update: M['UpdateInput'],
  ): Promise<T>;
  findOrCreate(where: M['WhereInput'], create: M['CreateInput']): Promise<T>;
}

export interface IBulkRepository<M extends RepositoryTypeMap = DefaultTypeMap> {
  createMany(
    data: M['CreateInput'][],
    skipDuplicates?: boolean,
  ): Promise<BatchResult>;
  updateMany(
    where: M['WhereInput'],
    data: M['UpdateInput'],
  ): Promise<BatchResult>;
  deleteMany(where: M['WhereInput']): Promise<BatchResult>;
}

export interface ITransactional {
  transaction<R>(fn: (tx: Prisma.TransactionClient) => Promise<R>): Promise<R>;
}

export interface IRepository<T, M extends RepositoryTypeMap = DefaultTypeMap>
  extends
    IReadRepository<T, M>,
    IWriteRepository<T, M>,
    IBulkRepository<M>,
    ITransactional {}
