import { IdentityUser } from './identity-user';
import { SupabaseJwtPayload } from './supabase-jwt-payload';

export type ResolvedIdentity = {
  claims: SupabaseJwtPayload;
  user: IdentityUser;
};
