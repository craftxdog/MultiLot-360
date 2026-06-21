import { validateEnv } from './validate-env';

export interface AppConfig {
  app: {
    name: string;
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
    jwtSecret: string;
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
  };

  redis: {
    host: string;
    port: number;
    password: string;
    db: number;
    keyPrefix: string;
  };

  mailer: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
  };
}

export default (): AppConfig => {
  const env = validateEnv(process.env);
  return {
    app: {
      name: env.APP_NAME,
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
      jwtSecret: env.SUPABASE_JWT_SECRET,
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
    },
    redis: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB,
      keyPrefix: env.REDIS_KEY_PREFIX,
    },
    mailer: {
      smtpHost: env.MAILERSEND_SMTP_HOST,
      smtpPort: env.MAILERSEND_SMTP_PORT,
      smtpUser: env.MAILERSEND_SMTP_USER,
      smtpPassword: env.MAILERSEND_SMTP_PASSWORD,
      fromEmail: env.MAILERSEND_FROM_EMAIL,
      fromName: env.MAILERSEND_FROM_NAME,
    },
  };
};
