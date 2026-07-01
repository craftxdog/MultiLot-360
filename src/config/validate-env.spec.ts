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
});
