export type SupabaseJwtPayload = {
  sub?: string;
  email?: string;
  phone?: string;
  role?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};
