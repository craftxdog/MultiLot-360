import {
  AUTH_USER_ID_HEADER,
  REQUEST_ID_HEADER,
  ROLE_ID_HEADER,
  ROLE_NAME_HEADER,
  SELLER_ID_HEADER,
  USER_ID_HEADER,
} from '../constants/request-context.constant';
import { ApiRequest } from '../interfaces/request-context.interface';

const getHeader = (
  request: Pick<ApiRequest, 'headers'>,
  header: string,
): string | undefined => {
  const value = request.headers[header];

  return Array.isArray(value) ? value[0] : value;
};

export const getRequestId = (request: ApiRequest): string | undefined =>
  request.requestId ??
  request.context?.requestId ??
  getHeader(request, REQUEST_ID_HEADER);

export const getUserId = (request: ApiRequest): string | undefined =>
  request.user?.id ??
  request.context?.user?.id ??
  getHeader(request, USER_ID_HEADER);

export const getAuthUserId = (request: ApiRequest): string | undefined =>
  request.user?.authUserId ??
  request.context?.user?.authUserId ??
  getHeader(request, AUTH_USER_ID_HEADER);

export const getRoleId = (request: ApiRequest): string | undefined =>
  request.user?.roleId ??
  request.context?.user?.roleId ??
  getHeader(request, ROLE_ID_HEADER);

export const getRoleName = (request: ApiRequest): string | undefined =>
  request.user?.roleName ??
  request.context?.user?.roleName ??
  getHeader(request, ROLE_NAME_HEADER);

export const getSellerId = (request: ApiRequest): string | undefined =>
  request.seller?.id ??
  request.context?.seller?.id ??
  getHeader(request, SELLER_ID_HEADER);

export const getCurrentUser = (request: ApiRequest) =>
  request.user ?? request.context?.user;

export const getCurrentSeller = (request: ApiRequest) =>
  request.seller ?? request.context?.seller;
