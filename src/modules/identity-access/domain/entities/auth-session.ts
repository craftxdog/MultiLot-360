import { IdentityUser } from './identity-user';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'bearer';
  user: IdentityUser;
};

export type LoginCommand = {
  email: string;
  password: string;
};

export type RefreshSessionCommand = {
  refreshToken: string;
};

export type LogoutCommand = {
  accessToken: string;
};

export type SignupAdminCommand = {
  email: string;
  password: string;
  name: string;
};

export type AuthProviderUser = {
  id: string;
  email: string;
};

export type AuthProviderSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'bearer';
  authUserId: string;
};
