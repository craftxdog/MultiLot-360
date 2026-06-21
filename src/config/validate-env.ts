import { bool, cleanEnv, makeValidator, num, port, str } from 'envalid';

const csv = makeValidator<string[]>((input) =>
  input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

export function validateEnv(env: NodeJS.ProcessEnv) {
  return cleanEnv(env, {
    APP_NAME: str({ default: 'MultiLot 360 API' }),
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

    AUTH_SIGNUP_ENABLED: bool({ default: true }),
    AUTH_ADMIN_ROLE_NAME: str({ default: 'admin' }),
  });
}
