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
  tenantSelector?: string;
};

export type RefreshSessionCommand = {
  refreshToken: string;
  tenantSelector?: string;
};

export type LogoutCommand = {
  accessToken: string;
};

export type RequestPasswordResetCommand = {
  email: string;
};

export type ConfirmPasswordResetCommand = {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
};

export type AdminResetPasswordCommand = {
  actorUserId: string;
  targetUserId: string;
  newPassword: string;
  confirmPassword: string;
};

export type SignupAdminCommand = {
  email: string;
  username: string;
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
