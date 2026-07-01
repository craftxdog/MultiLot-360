import { bool, cleanEnv, makeValidator, num, port, str, url } from 'envalid';

const csv = makeValidator<string[]>((input) =>
  input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

const absolutePath = makeValidator<string>((input) => {
  const value = input.trim();

  if (!/^\/[a-zA-Z0-9/_.-]*$/.test(value) || value.includes('//')) {
    throw new Error('Expected an absolute URL path');
  }

  return value.length > 1 ? value.replace(/\/$/, '') : value;
});

export function validateEnv(env: NodeJS.ProcessEnv) {
  return cleanEnv(env, {
    APP_NAME: str({ default: 'MultiLot 360 API' }),
    APP_WEB_URL: url({ default: 'http://localhost:8080' }),
    NODE_ENV: str({
      choices: ['development', 'production', 'test', 'staging'],
      default: 'development',
    }),
    PORT: port({ default: 3000 }),
    API_PREFIX: str({ default: 'api/v1' }),
    CORS_ORIGINS: csv({ default: ['http://localhost:3000'] }),
    LOG_LEVEL: str({
      choices: ['debug', 'verbose', 'log', 'warn', 'error'],
      default: 'log',
    }),

    SWAGGER_ENABLED: bool({ default: true }),
    SWAGGER_PATH: str({ default: 'docs' }),

    SUPABASE_PROJECT_REF: str({ default: 'wweiogaeaikasrlldbdy' }),
    SUPABASE_URL: str({
      default: 'https://wweiogaeaikasrlldbdy.supabase.co',
    }),
    SUPABASE_PUBLISHABLE_KEY: str({ default: '' }),
    SUPABASE_SERVICE_ROLE_KEY: str({ default: '' }),
    SUPABASE_JWT_SECRET: str({ default: '' }),

    DATABASE_URL: str({
      default:
        'postgresql://postgres:postgres@localhost:5432/multilot360?schema=public',
    }),
    DIRECT_URL: str({ default: '' }),
    DB_HOST: str({ default: 'db.wweiogaeaikasrlldbdy.supabase.co' }),
    DB_PORT: port({ default: 5432 }),
    DB_USERNAME: str({ default: 'postgres' }),
    DB_PASSWORD: str({ default: '' }),
    DB_DATABASE: str({ default: 'postgres' }),
    DB_SSL: bool({ default: true }),

    REDIS_HOST: str(),
    REDIS_PORT: port({ default: 6379 }),
    REDIS_PASSWORD: str({ default: '' }),
    REDIS_DB: num({ default: 0 }),
    REDIS_KEY_PREFIX: str({ default: 'multilot360:development:' }),

    REALTIME_ENABLED: bool({ default: true }),
    REALTIME_PATH: absolutePath({ default: '/socket.io' }),
    REALTIME_MAX_PAYLOAD_BYTES: num({ default: 16384 }),
    REALTIME_CONNECT_TIMEOUT_MS: num({ default: 10000 }),
    REALTIME_RECOVERY_WINDOW_MS: num({ default: 120000 }),
    REALTIME_REDIS_ENABLED: bool({ default: false }),
    REALTIME_REDIS_KEY: str({ default: 'multilot360:socket.io' }),

    MAILERSEND_ENABLED: bool({ default: false }),
    MAILERSEND_API_TOKEN: str({ default: '' }),
    MAILERSEND_SMTP_HOST: str({ default: 'smtp.mailersend.net' }),
    MAILERSEND_SMTP_PORT: port({ default: 587 }),
    MAILERSEND_SMTP_USER: str({ default: '' }),
    MAILERSEND_SMTP_PASSWORD: str({ default: '' }),
    MAILERSEND_FROM_EMAIL: str({ default: '' }),
    MAILERSEND_FROM_NAME: str({ default: 'MultiLot 360' }),
    MAILERSEND_REPLY_TO_EMAIL: str({ default: '' }),

    SELLER_ACCESS_CODE_EXPIRES_IN_MINUTES: num({ default: 15 }),
    SELLER_ACCESS_CODE_SECRET: str({ default: '' }),
    SELLER_ACTIVATION_URL: url({ default: '' }),

    AUTH_SIGNUP_ENABLED: bool({ default: true }),
    AUTH_ADMIN_ROLE_NAME: str({ default: 'admin' }),
    ACCOUNT_CONFIRMATION_URL: url({ default: '' }),
  });
}
