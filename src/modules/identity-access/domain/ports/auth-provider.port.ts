import {
  AuthProviderSession,
  AuthProviderUser,
  SupabaseJwtPayload,
} from '../entities';

export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');

export type CreateAuthUserInput = {
  email: string;
  password: string;
  name?: string;
  emailConfirmed?: boolean;
};

export type SignInWithPasswordInput = {
  email: string;
  password: string;
};

export interface AuthProviderPort {
  createUser(input: CreateAuthUserInput): Promise<AuthProviderUser>;
  deleteUser(authUserId: string): Promise<void>;
  signInWithPassword(
    input: SignInWithPasswordInput,
  ): Promise<AuthProviderSession>;
  refreshSession(refreshToken: string): Promise<AuthProviderSession>;
  signOut(accessToken: string): Promise<void>;
  verifyAccessToken(accessToken: string): Promise<SupabaseJwtPayload>;
}
