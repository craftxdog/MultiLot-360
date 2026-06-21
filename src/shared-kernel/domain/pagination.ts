export type PaginationStrategy = 'cursor' | 'offset';

export type CursorPaginationMeta = {
  strategy: 'cursor';
  limit: number;
  count: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor: string | null;
  previousCursor: string | null;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
};

export type OffsetPaginationMeta = {
  strategy: 'offset';
  page: number;
  limit: number;
  count: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
};

export type PaginationMeta = CursorPaginationMeta | OffsetPaginationMeta;

export type PaginatedResult<T> = {
  items: T[];
  pagination: PaginationMeta;
  message?: string;
};
