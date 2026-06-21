import { PaginationMeta } from '../../shared-kernel';
export type {
  CursorPaginationMeta,
  CursorPaginationQuery,
  OffsetPaginationMeta,
  OffsetPaginationQuery,
  PaginatedResult,
  PaginationMeta,
  PaginationStrategy,
  SortDirection,
} from '../../shared-kernel';

export type ApiRequestMeta = {
  requestId?: string;
  method: string;
  path: string;
  timestamp: string;
};

export type ApiActorMeta = {
  userId?: string;
  authUserId?: string;
  username?: string;
  roleId?: string;
  roleName?: string;
  sellerId?: string;
};

export type ApiResponseMeta = {
  request: ApiRequestMeta;
  actor?: ApiActorMeta;
  pagination?: PaginationMeta;
};

export type ApiSuccessResponse<T> = {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta: ApiResponseMeta;
};

export type ApiErrorResponse = {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  meta: ApiResponseMeta;
};
