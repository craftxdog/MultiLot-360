import { Prisma } from '@prisma/client';
import {
  CursorPaginationQuery,
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../../shared-kernel';

export type PrismaDelegate<T = unknown> = {
  findUnique: (args: Record<string, any>) => Promise<T | null>;
  findFirst: (args?: Record<string, any>) => Promise<T | null>;
  findMany: (args?: Record<string, any>) => Promise<T[]>;
  create: (args: Record<string, any>) => Promise<T>;
  update: (args: Record<string, any>) => Promise<T>;
  delete: (args: Record<string, any>) => Promise<T>;
  count: (args?: Record<string, any>) => Promise<number>;
  upsert: (args: Record<string, any>) => Promise<T>;
  createMany: (args: Record<string, any>) => Promise<BatchResult>;
  updateMany: (args: Record<string, any>) => Promise<BatchResult>;
  deleteMany: (args: Record<string, any>) => Promise<BatchResult>;
};

export type ModelName = Prisma.ModelName;

export interface RepositoryTypeMap {
  WhereInput: any;
  WhereUniqueInput: any;
  CreateInput: any;
  UpdateInput: any;
  OrderByInput: any;
  Include: any;
  Select: any;
}

export type DefaultTypeMap = RepositoryTypeMap;

export interface FindAllParams<M extends RepositoryTypeMap = DefaultTypeMap> {
  skip?: number;
  take?: number;
  cursor?: M['WhereUniqueInput'];
  where?: M['WhereInput'];
  orderBy?: M['OrderByInput'];
  include?: M['Include'];
  select?: M['Select'];
}

export interface CursorPaginationParams<
  M extends RepositoryTypeMap = DefaultTypeMap,
> {
  pagination: CursorPaginationQuery;
  where?: M['WhereInput'];
  orderBy?: M['OrderByInput'];
  include?: M['Include'];
  select?: M['Select'];
}

export interface OffsetPaginationParams<
  M extends RepositoryTypeMap = DefaultTypeMap,
> {
  pagination: OffsetPaginationQuery;
  where?: M['WhereInput'];
  orderBy?: M['OrderByInput'];
  include?: M['Include'];
  select?: M['Select'];
}

export type CursorPaginatedRepositoryResult<T> = Promise<PaginatedResult<T>>;
export type OffsetPaginatedRepositoryResult<T> = Promise<PaginatedResult<T>>;

export interface BatchResult {
  count: number;
}

export interface SoftDeletableEntity {
  deletedAt?: Date | null;
}

export interface CreatedAtEntity {
  creado_en?: Date;
}
