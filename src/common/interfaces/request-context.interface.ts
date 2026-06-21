import { Request } from 'express';

export type AuthenticatedUserContext = {
  id: string;
  authUserId?: string | null;
  username?: string;
  roleId?: string;
  roleName?: string;
  active?: boolean;
  modules?: string[];
  permissions?: string[];
};

export type SellerContext = {
  id: string;
  userId: string;
  name?: string;
  active?: boolean;
};

export type ApiRequestContext = {
  requestId?: string;
  user?: AuthenticatedUserContext;
  seller?: SellerContext;
};

export type ApiRequest = Request & {
  requestId?: string;
  user?: AuthenticatedUserContext;
  seller?: SellerContext;
  context?: ApiRequestContext;
};
