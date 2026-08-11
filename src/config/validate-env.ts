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

const resetCodeExpiryMinutes = makeValidator<number>((input) => {
  const value = Number(input);
  if (!Number.isInteger(value) || value < 5 || value > 1440) {
    throw new Error('Expected an integer between 5 and 1440 minutes');
  }
  return value;
});

export function validateEnv(env: NodeJS.ProcessEnv) {
  const validated = cleanEnv(env, {
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
    DB_POOL_MAX: num({ default: 5 }),
    DB_POOL_IDLE_TIMEOUT_MS: num({ default: 30000 }),
    DB_POOL_CONNECTION_TIMEOUT_MS: num({ default: 10000 }),

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
    MAILERSEND_SMTP_HOST: str({ default: 'smtp.hostinger.com' }),
    MAILERSEND_SMTP_PORT: port({ default: 465 }),
    MAILERSEND_SMTP_USER: str({ default: '' }),
    MAILERSEND_SMTP_PASSWORD: str({ default: '' }),
    MAILERSEND_FROM_EMAIL: str({ default: '' }),
    MAILERSEND_FROM_NAME: str({ default: 'MultiLot 360' }),
    MAILERSEND_REPLY_TO_EMAIL: str({ default: '' }),

    SELLER_ACCESS_CODE_EXPIRES_IN_MINUTES: num({ default: 15 }),
    SELLER_ACCESS_CODE_SECRET: str({ default: '' }),
    SELLER_ACTIVATION_URL: url({ default: '' }),

    AUTH_SIGNUP_ENABLED: bool({ default: true }),
    AUTH_ADMIN_ROLE_NAME: str({ default: 'ADMIN' }),
    ACCOUNT_CONFIRMATION_URL: url({ default: '' }),
    PASSWORD_RESET_URL: url({ default: '' }),
    PASSWORD_RESET_CODE_EXPIRES_IN_MINUTES: resetCodeExpiryMinutes({
      default: 60,
    }),

    BILLING_PROVIDER: str({
      choices: ['disabled', 'paypal', 'development'],
      default: 'disabled',
    }),
    BILLING_CHECKOUT_EXPIRES_IN_MINUTES: num({ default: 30 }),
    BILLING_RETURN_URL: url({ default: '' }),
    BILLING_CANCEL_URL: url({ default: '' }),
    BILLING_DEVELOPMENT_SECRET: str({ default: '' }),
    BILLING_WORKER_SECRET: str({ default: '' }),
    PAYPAL_ENABLED: bool({ default: false }),
    PAYPAL_ENVIRONMENT: str({
      choices: ['sandbox', 'live'],
      default: 'sandbox',
    }),
    PAYPAL_CLIENT_ID: str({ default: '' }),
    PAYPAL_CLIENT_SECRET: str({ default: '' }),
    PAYPAL_WEBHOOK_ID: str({ default: '' }),
  });

  if (validated.NODE_ENV === 'production') {
    validateProductionEnv(validated);
  }

  return validated;
}

type ProductionEnv = {
  APP_WEB_URL: string;
  AUTH_SIGNUP_ENABLED: boolean;
  CORS_ORIGINS: string[];
  DATABASE_URL: string;
  DB_POOL_CONNECTION_TIMEOUT_MS: number;
  DB_POOL_IDLE_TIMEOUT_MS: number;
  DB_POOL_MAX: number;
  DB_SSL: boolean;
  LOG_LEVEL: string;
  MAILERSEND_ENABLED: boolean;
  MAILERSEND_FROM_EMAIL: string;
  MAILERSEND_REPLY_TO_EMAIL: string;
  MAILERSEND_SMTP_HOST: string;
  MAILERSEND_SMTP_PORT: number;
  MAILERSEND_SMTP_PASSWORD: string;
  MAILERSEND_SMTP_USER: string;
  REALTIME_ENABLED: boolean;
  REALTIME_REDIS_ENABLED: boolean;
  REDIS_KEY_PREFIX: string;
  REDIS_PASSWORD: string;
  SELLER_ACCESS_CODE_SECRET: string;
  SUPABASE_PROJECT_REF: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
  SWAGGER_ENABLED: boolean;
  BILLING_PROVIDER: string;
  BILLING_WORKER_SECRET: string;
  BILLING_RETURN_URL: string;
  BILLING_CANCEL_URL: string;
  PAYPAL_ENVIRONMENT: string;
  PAYPAL_ENABLED: boolean;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_WEBHOOK_ID: string;
};

function validateProductionEnv(env: ProductionEnv): void {
  const errors: string[] = [];
  const requireLength = (name: string, value: string, minimum: number) => {
    if (value.trim().length < minimum) {
      errors.push(`${name} must contain at least ${minimum} characters`);
    }
  };

  validateHttpsUrl('APP_WEB_URL', env.APP_WEB_URL, errors);
  for (const origin of env.CORS_ORIGINS) {
    validateHttpsOrigin(origin, errors);
  }

  if (env.SWAGGER_ENABLED) {
    errors.push('SWAGGER_ENABLED must be false');
  }
  if (['debug', 'verbose'].includes(env.LOG_LEVEL)) {
    errors.push('LOG_LEVEL cannot be debug or verbose');
  }

  requireLength('SUPABASE_PROJECT_REF', env.SUPABASE_PROJECT_REF, 10);
  requireLength('SUPABASE_PUBLISHABLE_KEY', env.SUPABASE_PUBLISHABLE_KEY, 20);
  requireLength('SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY, 32);
  requireLength('SELLER_ACCESS_CODE_SECRET', env.SELLER_ACCESS_CODE_SECRET, 32);
  requireLength('BILLING_WORKER_SECRET', env.BILLING_WORKER_SECRET, 32);
  requireLength('REDIS_PASSWORD', env.REDIS_PASSWORD, 16);

  const expectedSupabaseUrl = `https://${env.SUPABASE_PROJECT_REF}.supabase.co`;
  if (env.SUPABASE_URL !== expectedSupabaseUrl) {
    errors.push(`SUPABASE_URL must equal ${expectedSupabaseUrl}`);
  }
  validateProductionDatabaseUrl(env.DATABASE_URL, errors);
  if (!env.DB_SSL) {
    errors.push('DB_SSL must be true');
  }
  validateIntegerRange('DB_POOL_MAX', env.DB_POOL_MAX, 1, 10, errors);
  validateIntegerRange(
    'DB_POOL_IDLE_TIMEOUT_MS',
    env.DB_POOL_IDLE_TIMEOUT_MS,
    1000,
    300000,
    errors,
  );
  validateIntegerRange(
    'DB_POOL_CONNECTION_TIMEOUT_MS',
    env.DB_POOL_CONNECTION_TIMEOUT_MS,
    1000,
    60000,
    errors,
  );

  if (!env.REDIS_KEY_PREFIX.toLowerCase().includes('production')) {
    errors.push('REDIS_KEY_PREFIX must identify the production environment');
  }
  if (env.REALTIME_ENABLED && !env.REALTIME_REDIS_ENABLED) {
    errors.push('REALTIME_REDIS_ENABLED must be true when realtime is enabled');
  }

  if (env.MAILERSEND_ENABLED) {
    requireLength('MAILERSEND_SMTP_HOST', env.MAILERSEND_SMTP_HOST, 3);
    requireLength('MAILERSEND_SMTP_USER', env.MAILERSEND_SMTP_USER, 3);
    requireLength('MAILERSEND_SMTP_PASSWORD', env.MAILERSEND_SMTP_PASSWORD, 12);
    if (![465, 587].includes(env.MAILERSEND_SMTP_PORT)) {
      errors.push(
        'MAILERSEND_SMTP_PORT must be 465 for implicit TLS or 587 for STARTTLS',
      );
    }
    validateEmail('MAILERSEND_FROM_EMAIL', env.MAILERSEND_FROM_EMAIL, errors);
    validateEmail(
      'MAILERSEND_REPLY_TO_EMAIL',
      env.MAILERSEND_REPLY_TO_EMAIL,
      errors,
    );
  }

  if (env.PAYPAL_ENABLED) {
    if (env.PAYPAL_ENVIRONMENT !== 'live') {
      errors.push('PAYPAL_ENVIRONMENT must be live when PayPal is enabled');
    }
    requireLength('PAYPAL_CLIENT_ID', env.PAYPAL_CLIENT_ID, 20);
    requireLength('PAYPAL_CLIENT_SECRET', env.PAYPAL_CLIENT_SECRET, 20);
    requireLength('PAYPAL_WEBHOOK_ID', env.PAYPAL_WEBHOOK_ID, 10);
    validateHttpsUrl('BILLING_RETURN_URL', env.BILLING_RETURN_URL, errors);
    validateHttpsUrl('BILLING_CANCEL_URL', env.BILLING_CANCEL_URL, errors);
  }

  if (errors.length > 0) {
    throw new Error(
      `Unsafe production configuration:\n- ${errors.join('\n- ')}`,
    );
  }
}

function validateIntegerRange(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
  errors: string[],
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    errors.push(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
}

function validateHttpsUrl(name: string, value: string, errors: string[]): void {
  try {
    if (new URL(value).protocol !== 'https:') {
      errors.push(`${name} must use HTTPS`);
    }
  } catch {
    errors.push(`${name} must be a valid URL`);
  }
}

function validateHttpsOrigin(origin: string, errors: string[]): void {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' || parsed.origin !== origin) {
      errors.push(`CORS origin must be an exact HTTPS origin: ${origin}`);
    }
  } catch {
    errors.push(`CORS origin is invalid: ${origin}`);
  }
}

function validateProductionDatabaseUrl(value: string, errors: string[]): void {
  try {
    const parsed = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      errors.push('DATABASE_URL must use PostgreSQL');
    }
    if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
      errors.push('DATABASE_URL cannot target localhost');
    }
    const username = decodeURIComponent(parsed.username).toLowerCase();
    if (username === 'postgres' || username.startsWith('postgres.')) {
      errors.push('DATABASE_URL must not use the postgres owner account');
    }
  } catch {
    errors.push('DATABASE_URL must be a valid PostgreSQL URL');
  }
}

function validateEmail(name: string, value: string, errors: string[]): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push(`${name} must be a valid email address`);
  }
}
