export type PaginationStrategy = 'cursor' | 'offset';

export type SortDirection = 'asc' | 'desc';

export type CursorPaginationQuery = {
  cursor?: string;
  limit: number;
  sortBy: string;
  sortDirection: SortDirection;
};

export type OffsetPaginationQuery = {
  page: number;
  limit: number;
  sortBy: string;
  sortDirection: SortDirection;
};

export type CursorPaginationMeta = {
  strategy: 'cursor';
  limit: number;
  count: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor: string | null;
  previousCursor: string | null;
  sortBy: string;
  sortDirection: SortDirection;
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
  sortDirection: SortDirection;
};

export type PaginationMeta = CursorPaginationMeta | OffsetPaginationMeta;

export type PaginatedResult<T> = {
  items: T[];
  pagination: PaginationMeta;
  message?: string;
};
