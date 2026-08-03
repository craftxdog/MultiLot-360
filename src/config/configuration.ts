import { validateEnv } from './validate-env';

export interface AppConfig {
  app: {
    name: string;
    webUrl: string;
    env: string;
    port: number;
    apiPrefix: string;
    corsOrigins: string[];
    logLevel: string;
  };

  swagger: {
    enabled: boolean;
    path: string;
  };

  supabase: {
    projectRef: string;
    url: string;
    publishableKey: string;
    serviceRoleKey: string;
  };

  database: {
    url: string;
    directUrl: string;
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
    poolMax: number;
    poolIdleTimeoutMs: number;
    poolConnectionTimeoutMs: number;
  };

  redis: {
    host: string;
    port: number;
    password: string;
    db: number;
    keyPrefix: string;
  };

  realtime: {
    enabled: boolean;
    path: string;
    maxPayloadBytes: number;
    connectTimeoutMs: number;
    recoveryWindowMs: number;
    redisEnabled: boolean;
    redisKey: string;
  };

  mailer: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
    replyToEmail: string;
  };

  sellerAccess: {
    codeExpiresInMinutes: number;
    codeSecret: string;
    activationUrl: string;
  };

  auth: {
    signupEnabled: boolean;
    adminRoleName: string;
    confirmationUrl: string;
    passwordResetUrl: string;
    passwordResetCodeExpiresInMinutes: number;
  };

  billing: {
    provider: 'disabled' | 'paypal' | 'development';
    paypalEnabled: boolean;
    workerSecret: string;
    checkoutExpiresInMinutes: number;
    returnUrl: string;
    cancelUrl: string;
    developmentSecret: string;
    paypalEnvironment: 'sandbox' | 'live';
    paypalClientId: string;
    paypalClientSecret: string;
    paypalWebhookId: string;
  };
}

export default (): AppConfig => {
  const env = validateEnv(process.env);
  return {
    app: {
      name: env.APP_NAME,
      webUrl: env.APP_WEB_URL,
      env: env.NODE_ENV,
      port: env.PORT,
      apiPrefix: env.API_PREFIX,
      corsOrigins: env.CORS_ORIGINS,
      logLevel: env.LOG_LEVEL,
    },
    swagger: {
      enabled: env.SWAGGER_ENABLED,
      path: env.SWAGGER_PATH,
    },
    supabase: {
      projectRef: env.SUPABASE_PROJECT_REF,
      url: env.SUPABASE_URL,
      publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    database: {
      url: env.DATABASE_URL,
      directUrl: env.DIRECT_URL,
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      database: env.DB_DATABASE,
      ssl: env.DB_SSL,
      poolMax: env.DB_POOL_MAX,
      poolIdleTimeoutMs: env.DB_POOL_IDLE_TIMEOUT_MS,
      poolConnectionTimeoutMs: env.DB_POOL_CONNECTION_TIMEOUT_MS,
    },
    redis: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB,
      keyPrefix: env.REDIS_KEY_PREFIX,
    },
    realtime: {
      enabled: env.REALTIME_ENABLED,
      path: env.REALTIME_PATH,
      maxPayloadBytes: env.REALTIME_MAX_PAYLOAD_BYTES,
      connectTimeoutMs: env.REALTIME_CONNECT_TIMEOUT_MS,
      recoveryWindowMs: env.REALTIME_RECOVERY_WINDOW_MS,
      redisEnabled: env.REALTIME_REDIS_ENABLED,
      redisKey: env.REALTIME_REDIS_KEY,
    },
    mailer: {
      enabled: env.MAILERSEND_ENABLED,
      smtpHost: env.MAILERSEND_SMTP_HOST,
      smtpPort: env.MAILERSEND_SMTP_PORT,
      smtpUser: env.MAILERSEND_SMTP_USER,
      smtpPassword: env.MAILERSEND_SMTP_PASSWORD,
      fromEmail: env.MAILERSEND_FROM_EMAIL,
      fromName: env.MAILERSEND_FROM_NAME,
      replyToEmail: env.MAILERSEND_REPLY_TO_EMAIL,
    },
    sellerAccess: {
      codeExpiresInMinutes: env.SELLER_ACCESS_CODE_EXPIRES_IN_MINUTES,
      codeSecret: env.SELLER_ACCESS_CODE_SECRET,
      activationUrl:
        env.SELLER_ACTIVATION_URL ||
        new URL('/activar-vendedor', env.APP_WEB_URL).toString(),
    },
    auth: {
      signupEnabled: env.AUTH_SIGNUP_ENABLED,
      adminRoleName: env.AUTH_ADMIN_ROLE_NAME,
      confirmationUrl:
        env.ACCOUNT_CONFIRMATION_URL ||
        new URL('/confirmar-cuenta', env.APP_WEB_URL).toString(),
      passwordResetUrl:
        env.PASSWORD_RESET_URL ||
        new URL('/restablecer-contrasena', env.APP_WEB_URL).toString(),
      passwordResetCodeExpiresInMinutes:
        env.PASSWORD_RESET_CODE_EXPIRES_IN_MINUTES,
    },
    billing: {
      provider: env.BILLING_PROVIDER,
      paypalEnabled: env.PAYPAL_ENABLED,
      workerSecret: env.BILLING_WORKER_SECRET,
      checkoutExpiresInMinutes: env.BILLING_CHECKOUT_EXPIRES_IN_MINUTES,
      returnUrl:
        env.BILLING_RETURN_URL ||
        new URL('/facturacion/confirmada', env.APP_WEB_URL).toString(),
      cancelUrl:
        env.BILLING_CANCEL_URL ||
        new URL('/facturacion/cancelada', env.APP_WEB_URL).toString(),
      developmentSecret: env.BILLING_DEVELOPMENT_SECRET,
      paypalEnvironment: env.PAYPAL_ENVIRONMENT,
      paypalClientId: env.PAYPAL_CLIENT_ID,
      paypalClientSecret: env.PAYPAL_CLIENT_SECRET,
      paypalWebhookId: env.PAYPAL_WEBHOOK_ID,
    },
  };
};
