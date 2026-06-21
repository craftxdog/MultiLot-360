export const REQUEST_ID_HEADER = 'x-request-id';
export const USER_ID_HEADER = 'x-user-id';
export const AUTH_USER_ID_HEADER = 'x-auth-user-id';
export const ROLE_ID_HEADER = 'x-role-id';
export const ROLE_NAME_HEADER = 'x-role-name';
export const SELLER_ID_HEADER = 'x-seller-id';

export const REQUEST_CONTEXT_KEYS = {
  user: 'user',
  seller: 'seller',
  requestId: 'requestId',
} as const;

export const CONTEXT_HEADERS = {
  requestId: REQUEST_ID_HEADER,
  userId: USER_ID_HEADER,
  authUserId: AUTH_USER_ID_HEADER,
  roleId: ROLE_ID_HEADER,
  roleName: ROLE_NAME_HEADER,
  sellerId: SELLER_ID_HEADER,
} as const;
