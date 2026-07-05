import { io, Socket } from 'socket.io-client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { ChildProcess, spawn } from 'node:child_process';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';

loadEnv({ path: '.env', quiet: true });
loadEnv({ path: '.env.development', quiet: true });

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

type AuthSession = {
  accessToken: string;
};

type SellerInvitation = {
  userId: string;
  sellerId: string;
  email: string;
};

type ConfirmedSeller = {
  userId: string;
  sellerId: string;
  email: string;
};

type NumberLimit = {
  id: string;
};

type VoidPolicy = {
  windowMinutes: number;
};

type RealtimeReady = {
  protocolVersion: number;
  userId: string;
  roleName: string;
  sellerId: string | null;
  modules: string[];
  serverTime: string;
};

type RealtimeEnvelope<T = Record<string, unknown>> = {
  id: string;
  name: string;
  aggregateId?: string;
  occurredAt: string;
  version: number;
  payload: T;
};

type SellerFixture = {
  accessToken: string;
  authUserId: string;
  userId: string;
  sellerId: string;
  email: string;
  numberLimitIds: string[];
  pool: Pool;
};

type RawApiResponse<T> = {
  status: number;
  body: ApiEnvelope<T>;
};

const apiBaseUrl = (
  process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000/api/v1'
).replace(/\/$/, '');
const realtimeBaseUrl = (
  process.env.REALTIME_SMOKE_BASE_URL ?? apiBaseUrl.replace(/\/api\/v\d+$/, '')
).replace(/\/$/, '');
const realtimePath = process.env.REALTIME_PATH ?? '/socket.io';
const timeoutMs = Number(process.env.REALTIME_SMOKE_TIMEOUT_MS ?? 10_000);
const startLocalServer =
  process.env.REALTIME_SMOKE_START_SERVER?.toLowerCase() === 'true';
const provisionTemporarySeller =
  process.env.REALTIME_SMOKE_PROVISION_SELLER?.toLowerCase() === 'true';
const allowExternalSellerProvision =
  process.env.REALTIME_SMOKE_ALLOW_EXTERNAL_PROVISION?.toLowerCase() === 'true';
const localServerPort = Number(process.env.REALTIME_SMOKE_SERVER_PORT ?? 3001);

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<T> {
  const response = await rawApiRequest<T>(method, path, options);

  if (
    response.status < 200 ||
    response.status >= 300 ||
    !response.body.success ||
    response.body.data === undefined
  ) {
    throw new Error(
      `${method} ${path} failed with ${response.status}: ${response.body.message ?? 'unknown error'}`,
    );
  }

  return response.body.data;
}

async function rawApiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<RawApiResponse<T>> {
  const headers: Record<string, string> = { accept: 'application/json' };

  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return {
    status: response.status,
    body: (await response.json()) as ApiEnvelope<T>,
  };
}

async function resolveAdminToken(): Promise<string> {
  if (process.env.SMOKE_ADMIN_JWT) return process.env.SMOKE_ADMIN_JWT;

  const email = process.env.SMOKE_ADMIN_EMAIL;
  const password = process.env.SMOKE_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Set SMOKE_ADMIN_JWT or SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD.',
    );
  }

  const session = await apiRequest<AuthSession>('POST', '/auth/login', {
    body: { email, password },
  });
  return session.accessToken;
}

function createSocketClient(token?: string): Socket {
  return io(`${realtimeBaseUrl}/realtime`, {
    path: realtimePath,
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
    timeout: timeoutMs,
    reconnection: false,
  });
}

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const onEvent = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };

    socket.once(event, onEvent);
  });
}

async function assertAnonymousConnectionIsRejected(): Promise<void> {
  const socket = createSocketClient();

  try {
    const error = await waitForEvent<Error & { data?: { code?: string } }>(
      socket,
      'connect_error',
    );

    if (error.data?.code !== 'AUTH_REQUIRED') {
      throw new Error(
        `Expected AUTH_REQUIRED, received ${error.data?.code ?? error.message}`,
      );
    }
    console.log('PASS anonymous socket rejected code=AUTH_REQUIRED');
  } finally {
    socket.disconnect();
  }
}

async function assertAuthenticatedEventFlow(
  adminToken: string,
  sellerFixture?: SellerFixture,
): Promise<void> {
  const adminSocket = createSocketClient(adminToken);
  const sellerSocket = sellerFixture
    ? createSocketClient(sellerFixture.accessToken)
    : undefined;
  const adminReadyPromise = waitForEvent<RealtimeReady>(
    adminSocket,
    'realtime.ready',
  );
  const sellerReadyPromise = sellerSocket
    ? waitForEvent<RealtimeReady>(sellerSocket, 'realtime.ready')
    : undefined;

  try {
    const adminReady = await adminReadyPromise;
    if (
      adminReady.protocolVersion !== 1 ||
      !adminReady.userId ||
      adminReady.roleName.toUpperCase() !== 'ADMIN'
    ) {
      throw new Error('Invalid realtime.ready payload');
    }
    console.log(`PASS authenticated socket ready role=${adminReady.roleName}`);

    if (sellerReadyPromise && sellerFixture) {
      const sellerReady = await sellerReadyPromise;
      if (
        sellerReady.roleName.toUpperCase() !== 'VENDEDOR' ||
        sellerReady.sellerId !== sellerFixture.sellerId
      ) {
        throw new Error('Seller realtime identity does not match its profile');
      }
      console.log(
        `PASS authenticated socket ready role=${sellerReady.roleName} sellerId=${sellerReady.sellerId}`,
      );
    }

    const currentPolicy = await apiRequest<VoidPolicy>(
      'GET',
      '/sales/settings/void-policy',
      { token: adminToken },
    );
    const adminEventPromise = waitForEvent<RealtimeEnvelope>(
      adminSocket,
      'sales.void-policy.updated',
    );
    const sellerEventPromise = sellerSocket
      ? waitForEvent<RealtimeEnvelope>(
          sellerSocket,
          'sales.void-policy.updated',
        )
      : undefined;

    if (sellerFixture) {
      const forbidden = await rawApiRequest<VoidPolicy>(
        'PATCH',
        '/sales/settings/void-policy',
        {
          token: sellerFixture.accessToken,
          body: { windowMinutes: currentPolicy.windowMinutes },
        },
      );
      if (forbidden.status !== 403) {
        throw new Error(
          `Seller void-policy mutation expected 403, received ${forbidden.status}`,
        );
      }
      console.log('PASS seller administrative mutation rejected status=403');
    }

    await apiRequest<VoidPolicy>('PATCH', '/sales/settings/void-policy', {
      token: adminToken,
      body: { windowMinutes: currentPolicy.windowMinutes },
    });
    const event = await adminEventPromise;

    if (
      event.name !== 'sales.void-policy.updated' ||
      event.version !== 1 ||
      event.aggregateId !== 'sales.void_window_minutes'
    ) {
      throw new Error('Invalid sales.void-policy.updated event envelope');
    }
    console.log(`PASS admin realtime mutation delivered eventId=${event.id}`);

    if (sellerEventPromise) {
      const sellerEvent = await sellerEventPromise;
      if (sellerEvent.id !== event.id) {
        throw new Error('Admin and seller received different event envelopes');
      }
      console.log(
        `PASS seller received global realtime event eventId=${sellerEvent.id}`,
      );
    }

    if (sellerSocket && sellerFixture) {
      await assertSellerScopedEvent(
        adminSocket,
        sellerSocket,
        adminToken,
        sellerFixture,
      );
    }
  } finally {
    adminSocket.disconnect();
    sellerSocket?.disconnect();
  }
}

async function assertSellerScopedEvent(
  adminSocket: Socket,
  sellerSocket: Socket,
  adminToken: string,
  sellerFixture: SellerFixture,
): Promise<void> {
  const eventName = 'number-limits.created';
  const adminEventPromise = waitForEvent<RealtimeEnvelope>(
    adminSocket,
    eventName,
  );
  const sellerEventPromise = waitForEvent<RealtimeEnvelope>(
    sellerSocket,
    eventName,
  );
  const limits = await apiRequest<NumberLimit[]>('POST', '/number-limits', {
    token: adminToken,
    body: {
      numbers: ['98'],
      limitMiles: 1,
      validFrom: currentManaguaDate(),
      sellerId: sellerFixture.sellerId,
    },
  });
  sellerFixture.numberLimitIds.push(...limits.map((limit) => limit.id));
  const [adminEvent, sellerEvent] = await Promise.all([
    adminEventPromise,
    sellerEventPromise,
  ]);

  if (
    adminEvent.id !== sellerEvent.id ||
    sellerEvent.payload.sellerId !== sellerFixture.sellerId
  ) {
    throw new Error('Seller-scoped number-limit event was routed incorrectly');
  }
  console.log(
    `PASS seller-scoped realtime event delivered eventId=${sellerEvent.id}`,
  );
}

async function createTemporarySeller(
  adminToken: string,
): Promise<SellerFixture> {
  if (!startLocalServer && !allowExternalSellerProvision) {
    throw new Error(
      'Seller provisioning requires a locally started server or REALTIME_SMOKE_ALLOW_EXTERNAL_PROVISION=true',
    );
  }

  const suffix = Date.now().toString().slice(-10);
  const email = `codex.realtime.${suffix}@example.com`;
  const accessCode = randomInt(100000, 1000000).toString();
  const password = `${randomBytes(18).toString('base64url')}Aa1!`;
  const pool = createDatabasePool();
  let invitation: SellerInvitation | undefined;
  let authUserId: string | undefined;

  try {
    invitation = await apiRequest<SellerInvitation>(
      'POST',
      '/identity-access/sellers/invitations',
      {
        token: adminToken,
        body: {
          email,
          username: `codex.rt${suffix}`,
          sellerName: 'Codex Realtime Seller',
          documentId: `001-010190-${suffix.slice(-4)}A`,
          roleName: 'vendedor',
        },
      },
    );

    const secret =
      process.env.SELLER_ACCESS_CODE_SECRET ?? process.env.SUPABASE_JWT_SECRET;
    if (!secret) throw new Error('Seller access-code secret is not configured');
    const accessCodeHash = createHmac('sha256', secret)
      .update(accessCode)
      .digest('hex');
    const update = await pool.query<{ id: string }>(
      `update codigos_acceso_vendedor
         set codigo_hash = $1
       where usuario_id = $2
         and email = $3
         and estado = 'PENDIENTE'
       returning id`,
      [accessCodeHash, invitation.userId, email],
    );
    if (update.rowCount !== 1) {
      throw new Error('Could not prepare temporary seller access code');
    }

    const confirmed = await apiRequest<ConfirmedSeller>(
      'POST',
      '/identity-access/sellers/access-code/confirm',
      { body: { email, accessCode, password } },
    );
    const session = await apiRequest<AuthSession>('POST', '/auth/login', {
      body: { email, password },
    });
    authUserId = readJwtSubject(session.accessToken);

    if (
      confirmed.userId !== invitation.userId ||
      confirmed.sellerId !== invitation.sellerId
    ) {
      throw new Error('Confirmed seller does not match its invitation');
    }

    console.log(
      `PASS temporary seller enrolled sellerId=${confirmed.sellerId}`,
    );
    return {
      accessToken: session.accessToken,
      authUserId,
      userId: confirmed.userId,
      sellerId: confirmed.sellerId,
      email,
      numberLimitIds: [],
      pool,
    };
  } catch (error) {
    await cleanupPartialSeller(pool, invitation?.userId, authUserId);
    throw error;
  }
}

async function cleanupTemporarySeller(fixture?: SellerFixture): Promise<void> {
  if (!fixture) return;

  try {
    await fixture.pool.query('begin');
    if (fixture.numberLimitIds.length > 0) {
      await fixture.pool.query(
        'delete from limites_numero where id = any($1)',
        [fixture.numberLimitIds],
      );
    }
    await fixture.pool.query(
      'delete from auditoria_eventos where usuario_id = $1',
      [fixture.userId],
    );
    await fixture.pool.query('delete from usuarios where id = $1', [
      fixture.userId,
    ]);
    await fixture.pool.query('commit');
    const remaining = await fixture.pool.query<{ exists: boolean }>(
      'select exists(select 1 from usuarios where id = $1) as exists',
      [fixture.userId],
    );
    if (remaining.rows[0]?.exists) {
      throw new Error('Temporary seller database cleanup was incomplete');
    }
    await deleteSupabaseUser(fixture.authUserId);
    console.log(`PASS temporary seller cleaned sellerId=${fixture.sellerId}`);
  } catch (error) {
    await fixture.pool.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await fixture.pool.end();
  }
}

async function cleanupPartialSeller(
  pool: Pool,
  userId?: string,
  authUserId?: string,
): Promise<void> {
  try {
    if (userId) {
      await pool.query('delete from auditoria_eventos where usuario_id = $1', [
        userId,
      ]);
      await pool.query('delete from usuarios where id = $1', [userId]);
    }
    if (authUserId) await deleteSupabaseUser(authUserId);
  } finally {
    await pool.end();
  }
}

async function deleteSupabaseUser(authUserId: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase admin configuration is required for cleanup');
  }

  const { error } = await createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).auth.admin.deleteUser(authUserId);
  if (error)
    throw new Error(`Could not delete Supabase user: ${error.message}`);
}

function createDatabasePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  return new Pool({
    connectionString,
    max: 1,
    ...(process.env.DB_SSL?.toLowerCase() === 'true' && {
      ssl: { rejectUnauthorized: false },
    }),
  });
}

function readJwtSubject(token: string): string {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Invalid seller access token');
  const claims = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as { sub?: string };
  if (!claims.sub) throw new Error('Seller access token has no subject');
  return claims.sub;
}

function currentManaguaDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function startServer(): Promise<ChildProcess> {
  const server = spawn(process.execPath, ['dist/src/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(localServerPort),
      REALTIME_REDIS_ENABLED: 'false',
      ...(provisionTemporarySeller && { MAILERSEND_ENABLED: 'false' }),
    },
    stdio: 'inherit',
  });

  for (let attempt = 1; attempt <= 40; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Local API exited with code ${server.exitCode}`);
    }

    try {
      const response = await fetch(`${apiBaseUrl}/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return server;
    } catch {
      // The process is still starting.
    }

    await delay(250);
  }

  server.kill('SIGTERM');
  throw new Error(`Local API did not become ready at ${apiBaseUrl}`);
}

async function stopServer(server?: ChildProcess): Promise<void> {
  if (!server || server.exitCode !== null) return;

  server.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 3_000);
    server.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

export async function runRealtimeSmoke(): Promise<void> {
  let server: ChildProcess | undefined;
  let sellerFixture: SellerFixture | undefined;

  try {
    if (startLocalServer) server = await startServer();
    const adminToken = await resolveAdminToken();
    if (provisionTemporarySeller) {
      sellerFixture = await createTemporarySeller(adminToken);
    }
    await assertAnonymousConnectionIsRejected();
    await assertAuthenticatedEventFlow(adminToken, sellerFixture);
    console.log('Realtime smoke completed successfully.');
  } finally {
    try {
      await cleanupTemporarySeller(sellerFixture);
    } finally {
      await stopServer(server);
    }
  }
}

if (require.main === module) {
  runRealtimeSmoke().catch((error: unknown) => {
    console.error(
      `Realtime smoke failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
