import { IdentityUser } from '../entities';

export const IDENTITY_ACCESS_REPOSITORY = Symbol('IDENTITY_ACCESS_REPOSITORY');

export interface IdentityAccessRepository {
  findByAuthUserId(authUserId: string): Promise<IdentityUser | null>;
}
