import { config as loadEnv } from 'dotenv';

const smokeEnv = loadEnv({ path: '.env.test.local', quiet: true }).parsed ?? {};
const runOperationalSmoke = smokeEnv.REALTIME_E2E_ENABLED === 'true';

describe('Realtime operational smoke (e2e)', () => {
  const smokeTest = runOperationalSmoke ? it : it.skip;

  smokeTest(
    'validates admin and temporary seller sessions end to end',
    async () => {
      const previousEnv = { ...process.env };

      try {
        Object.assign(process.env, smokeEnv);
        const { runRealtimeSmoke } = await import('../scripts/realtime-smoke');
        await runRealtimeSmoke();
      } finally {
        process.env = previousEnv;
      }
    },
    120_000,
  );
});
