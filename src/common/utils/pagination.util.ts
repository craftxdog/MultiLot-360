import { CursorPaginationQueryDto, OffsetPaginationQueryDto } from '../dto';
import {
  CursorPaginationMeta,
  OffsetPaginationMeta,
  PaginatedResult,
  PaginationMeta,
} from '../interfaces';
import { decodeCursor, encodeCursor } from './cursor.util';

export type CursorEntity = {
  id: string;
};

export const isPaginatedResult = <T = unknown>(
  value: unknown,
): value is PaginatedResult<T> =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as PaginatedResult<T>).items) &&
  isPaginationMeta((value as PaginatedResult<T>).pagination);

export const isPaginationMeta = (value: unknown): value is PaginationMeta =>
  typeof value === 'object' &&
  value !== null &&
  ((value as PaginationMeta).strategy === 'cursor' ||
    (value as PaginationMeta).strategy === 'offset');

export const getCursorId = (cursor?: string): string | undefined =>
  cursor ? decodeCursor(cursor) : undefined;

export const buildCursorPagination = <T extends CursorEntity>(
  records: T[],
  query: CursorPaginationQueryDto,
): PaginatedResult<T> => {
  const limit = query.limit;
  const hasNextPage = records.length > limit;
  const items = hasNextPage ? records.slice(0, limit) : records;
  const firstItem = items[0];
  const lastItem = items.at(-1);

  const pagination: CursorPaginationMeta = {
    strategy: 'cursor',
    limit,
    count: items.length,
    hasNextPage,
    hasPreviousPage: Boolean(query.cursor),
    nextCursor: hasNextPage && lastItem ? encodeCursor(lastItem.id) : null,
    previousCursor: firstItem ? encodeCursor(firstItem.id) : null,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  };

  return { items, pagination };
};

export const buildOffsetPagination = <T>(
  items: T[],
  total: number,
  query: OffsetPaginationQueryDto,
): PaginatedResult<T> => {
  const totalPages = Math.ceil(total / query.limit);
  const pagination: OffsetPaginationMeta = {
    strategy: 'offset',
    page: query.page,
    limit: query.limit,
    count: items.length,
    total,
    totalPages,
    hasNextPage: query.page < totalPages,
    hasPreviousPage: query.page > 1,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  };

  return { items, pagination };
};

export const getOffsetSkip = (query: OffsetPaginationQueryDto): number =>
  (query.page - 1) * query.limit;
