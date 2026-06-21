import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env' });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const envFile = `.env.${nodeEnv}`;

if (existsSync(envFile)) {
  loadEnv({ override: true, path: envFile });
}

const datasourceUrl =
  process.env.PRISMA_DATABASE_URL ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error(
    'PRISMA_DATABASE_URL, DIRECT_URL or DATABASE_URL must be defined for Prisma.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: datasourceUrl,
  },
});
