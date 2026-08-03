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

  it('rejects development origins in production', () => {
    expect(() =>
      validateEnv({
        ...productionEnv(),
        APP_WEB_URL: 'http://localhost:3000',
        CORS_ORIGINS: 'http://localhost:3000',
      }),
    ).toThrow(/APP_WEB_URL must use HTTPS/);
  });

  it('rejects an oversized production database pool', () => {
    expect(() =>
      validateEnv({
        ...productionEnv(),
        DB_POOL_MAX: '11',
      }),
    ).toThrow(/DB_POOL_MAX must be an integer between 1 and 10/);
  });

  it('requires complete SMTP credentials when production email is enabled', () => {
    expect(() =>
      validateEnv({
        ...productionEnv(),
        MAILERSEND_ENABLED: 'true',
        MAILERSEND_SMTP_USER: 'smtp-user',
      }),
    ).toThrow(/MAILERSEND_SMTP_PASSWORD must contain at least 12 characters/);
  });

  it('accepts Hostinger SMTP over implicit TLS on port 465', () => {
    const env = validateEnv({
      ...productionEnv(),
      MAILERSEND_ENABLED: 'true',
      MAILERSEND_SMTP_HOST: 'smtp.hostinger.com',
      MAILERSEND_SMTP_PORT: '465',
      MAILERSEND_SMTP_USER: 'craftzdog@alphaby.cloud',
      MAILERSEND_SMTP_PASSWORD: 'smtp-password',
      MAILERSEND_FROM_EMAIL: 'no-reply@alphaby.cloud',
      MAILERSEND_REPLY_TO_EMAIL: 'soporte@alphaby.cloud',
    });

    expect(env.MAILERSEND_SMTP_PORT).toBe(465);
  });

  it('rejects unsupported SMTP ports in production', () => {
    expect(() =>
      validateEnv({
        ...productionEnv(),
        MAILERSEND_ENABLED: 'true',
        MAILERSEND_SMTP_USER: 'smtp-user',
        MAILERSEND_SMTP_PASSWORD: 'smtp-password',
        MAILERSEND_FROM_EMAIL: 'no-reply@alphaby.cloud',
        MAILERSEND_SMTP_PORT: '2525',
      }),
    ).toThrow(/MAILERSEND_SMTP_PORT must be 465.*587/);
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
    DATABASE_URL:
      'postgresql://multilot_api:password@pooler.supabase.com:5432/postgres?schema=public',
    DB_SSL: 'true',
    DB_POOL_MAX: '3',
    DB_POOL_IDLE_TIMEOUT_MS: '30000',
    DB_POOL_CONNECTION_TIMEOUT_MS: '10000',
    REDIS_HOST: 'redis-production',
    REDIS_PASSWORD: 'redis-production-password',
    REDIS_KEY_PREFIX: 'multilot360:production:',
    REALTIME_ENABLED: 'true',
    REALTIME_REDIS_ENABLED: 'true',
    SELLER_ACCESS_CODE_SECRET: 'independent-seller-code-secret-for-production',
    BILLING_WORKER_SECRET: 'independent-billing-worker-secret-for-production',
    AUTH_SIGNUP_ENABLED: 'false',
  };
}
