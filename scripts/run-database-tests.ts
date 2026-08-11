import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: ['.env.development', '.env'] });

const databaseUrl = (() => {
  const value = process.env.DB_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!value) {
    throw new Error('DB_TEST_DATABASE_URL or DATABASE_URL is required.');
  }
  return value;
})();

const testFiles = [
  'multi_tenant_isolation.test.sql',
  'bank_transfer_billing.test.sql',
];

async function main(): Promise<void> {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost')
      ? undefined
      : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (const file of testFiles) {
      const path = join(process.cwd(), 'supabase', 'tests', 'database', file);
      await client.query(readFileSync(path, 'utf8'));
      console.log(`PASS database ${file}`);
    }
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
