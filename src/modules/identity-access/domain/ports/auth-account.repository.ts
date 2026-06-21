import { IdentityUser } from '../entities';

export const AUTH_ACCOUNT_REPOSITORY = Symbol('AUTH_ACCOUNT_REPOSITORY');

export type CreateInternalUserInput = {
  authUserId: string;
  email: string;
  name: string;
  roleName: string;
};

export interface AuthAccountRepository {
  createInternalUser(input: CreateInternalUserInput): Promise<IdentityUser>;
  findByAuthUserId(authUserId: string): Promise<IdentityUser | null>;
}
