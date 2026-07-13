import { validateEnv } from './validate-env';

describe('validateEnv realtime configuration', () => {
  it('accepts the standard Socket.IO path and applies secure defaults', () => {
    const env = validateEnv({
      REDIS_HOST: 'localhost',
      REALTIME_PATH: '/socket.io',
    });

    expect(env.REALTIME_PATH).toBe('/socket.io');
    expect(env.REALTIME_MAX_PAYLOAD_BYTES).toBe(16_384);
    expect(env.REALTIME_REDIS_ENABLED).toBe(false);
  });

  it('accepts an explicit password recovery redirect URL', () => {
    const env = validateEnv({
      REDIS_HOST: 'localhost',
      PASSWORD_RESET_URL: 'https://app.example.com/restablecer-contrasena',
    });

    expect(env.PASSWORD_RESET_URL).toBe(
      'https://app.example.com/restablecer-contrasena',
    );
    expect(env.PASSWORD_RESET_CODE_EXPIRES_IN_MINUTES).toBe(60);
  });

  it('accepts a hardened production configuration', () => {
    const env = validateEnv(productionEnv());

    expect(env.NODE_ENV).toBe('production');
    expect(env.SWAGGER_ENABLED).toBe(false);
    expect(env.AUTH_SIGNUP_ENABLED).toBe(false);
  });

  it('rejects unsafe production defaults', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        REDIS_HOST: 'redis',
      }),
    ).toThrow('Unsafe production configuration');
  });

  it('rejects development origins and shared secrets in production', () => {
    expect(() =>
      validateEnv({
        ...productionEnv(),
        APP_WEB_URL: 'http://localhost:3000',
        CORS_ORIGINS: 'http://localhost:3000',
        SELLER_ACCESS_CODE_SECRET:
          'supabase-jwt-secret-that-is-long-enough-for-production',
      }),
    ).toThrow(/APP_WEB_URL must use HTTPS/);
  });
});

function productionEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    APP_WEB_URL: 'https://alphaby.cloud',
    CORS_ORIGINS: 'https://alphaby.cloud',
    LOG_LEVEL: 'log',
    SWAGGER_ENABLED: 'false',
    SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
    SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    SUPABASE_PUBLISHABLE_KEY:
      'sb_publishable_production_key_with_sufficient_length',
    SUPABASE_SERVICE_ROLE_KEY:
      'service-role-key-with-sufficient-production-length',
    SUPABASE_JWT_SECRET:
      'supabase-jwt-secret-that-is-long-enough-for-production',
    DATABASE_URL:
      'postgresql://postgres.project:password@pooler.supabase.com:5432/postgres?schema=public',
    DB_SSL: 'true',
    REDIS_HOST: 'redis-production',
    REDIS_PASSWORD: 'redis-production-password',
    REDIS_KEY_PREFIX: 'multilot360:production:',
    REALTIME_ENABLED: 'true',
    REALTIME_REDIS_ENABLED: 'true',
    SELLER_ACCESS_CODE_SECRET: 'independent-seller-code-secret-for-production',
    AUTH_SIGNUP_ENABLED: 'false',
  };
}
