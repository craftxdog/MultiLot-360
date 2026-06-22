type HttpMethod = 'GET' | 'POST' | 'PATCH';

type SmokeResponse<T = unknown> = {
  status: number;
  body: T;
};

type ApiEnvelope<T = unknown> = {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: T;
  error?: string;
};

type DrawConfiguration = {
  id: string;
  code: string;
  active: boolean;
};

type DrawShift = {
  id: string;
  date: string;
  status: string;
};

type SellerInvitationListItem = {
  id: string;
  email: string;
  username: string;
};

type AuthSession = {
  accessToken: string;
  refreshToken: string;
};

const baseUrl = (
  process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000/api/v1'
).replace(/\/$/, '');
const adminJwt = process.env.SMOKE_ADMIN_JWT;
const smokeDate =
  process.env.SMOKE_DATE ?? new Date().toISOString().slice(0, 10);
const uniqueSuffix = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const runInvitationFlow = process.env.SMOKE_RUN_INVITATION_FLOW === 'true';

let total = 0;
let failures = 0;

if (!adminJwt) {
  throw new Error('SMOKE_ADMIN_JWT is required.');
}

async function request<T = ApiEnvelope<unknown>>(
  method: HttpMethod,
  path: string,
  options: {
    body?: unknown;
    token?: string;
    auth?: boolean;
  } = {},
): Promise<SmokeResponse<T>> {
  const headers: Record<string, string> = {
    accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  if (options.auth !== false) {
    headers.authorization = `Bearer ${options.token ?? adminJwt}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as T) : ({} as T);

  return {
    status: response.status,
    body,
  };
}

function pass(name: string, detail?: string) {
  total += 1;
  console.log(`PASS ${name}${detail ? ` ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  total += 1;
  failures += 1;
  console.error(`FAIL ${name} ${detail}`);
}

function expectStatus(
  name: string,
  response: SmokeResponse,
  expectedStatuses: number[],
) {
  if (expectedStatuses.includes(response.status)) {
    pass(name, `status=${response.status}`);
    return;
  }

  fail(
    name,
    `expected=${expectedStatuses.join('|')} status=${response.status} body=${JSON.stringify(
      response.body,
    )}`,
  );
}

function expectEnvelope<T>(
  name: string,
  response: SmokeResponse<ApiEnvelope<T>>,
  expectedStatus: number,
): T {
  expectStatus(name, response, [expectedStatus]);

  if (response.status !== expectedStatus || !response.body.success) {
    throw new Error(`${name} failed.`);
  }

  return response.body.data as T;
}

function skip(name: string, reason: string) {
  console.log(`SKIP ${name} ${reason}`);
}

async function runPublicChecks() {
  expectStatus('root', await request('GET', '', { auth: false }), [200]);
  expectStatus(
    'health liveness',
    await request('GET', '/health', { auth: false }),
    [200],
  );

  const readiness = await request<ApiEnvelope<Record<string, unknown>>>(
    'GET',
    '/health/ready',
    { auth: false },
  );
  expectStatus('health readiness', readiness, [200]);

  if (readiness.body.data && readiness.body.data.status !== 'ok') {
    console.log(
      `INFO health readiness payload=${JSON.stringify(readiness.body.data)}`,
    );
  }
}

async function runAuthChecks() {
  expectEnvelope('auth me', await request('GET', '/auth/me'), 200);

  const email = process.env.SMOKE_ADMIN_EMAIL;
  const password = process.env.SMOKE_ADMIN_PASSWORD;

  if (!email || !password) {
    skip(
      'auth login/refresh/logout',
      'set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD',
    );
    return;
  }

  const session = expectEnvelope<AuthSession>(
    'auth login',
    await request('POST', '/auth/login', {
      auth: false,
      body: { email, password },
    }),
    200,
  );

  const refreshed = expectEnvelope<AuthSession>(
    'auth refresh',
    await request('POST', '/auth/refresh', {
      auth: false,
      body: { refreshToken: session.refreshToken },
    }),
    200,
  );

  expectEnvelope(
    'auth logout',
    await request('POST', '/auth/logout', {
      token: refreshed.accessToken,
    }),
    200,
  );
}

async function runSellerOnboardingChecks() {
  expectEnvelope(
    'seller invitations list',
    await request(
      'GET',
      '/identity-access/sellers/invitations?limit=5&offset=0',
    ),
    200,
  );

  if (!runInvitationFlow) {
    skip(
      'seller invitation create/resend/revoke',
      'set SMOKE_RUN_INVITATION_FLOW=true and SMOKE_SELLER_EMAIL',
    );
    return;
  }

  const email = process.env.SMOKE_SELLER_EMAIL;

  if (!email) {
    throw new Error(
      'SMOKE_SELLER_EMAIL is required when invitation flow is enabled.',
    );
  }

  const username = `smoke.${uniqueSuffix}`;
  expectEnvelope<{ userId: string; sellerId: string }>(
    'seller invitation create',
    await request('POST', '/identity-access/sellers/invitations', {
      body: {
        email,
        username,
        sellerName: `Smoke Seller ${uniqueSuffix}`,
        documentId: `SMOKE-${uniqueSuffix}`,
        phone: '+50588889999',
        address: 'Smoke test address',
        roleName: 'vendedor',
      },
    }),
    201,
  );

  expectEnvelope(
    'seller access code resend',
    await request('POST', '/identity-access/sellers/access-code/resend', {
      body: { email },
    }),
    200,
  );

  const invitations = expectEnvelope<SellerInvitationListItem[]>(
    'seller invitation lookup before revoke',
    await request(
      'GET',
      `/identity-access/sellers/invitations?email=${encodeURIComponent(
        email,
      )}&username=${encodeURIComponent(username)}&limit=1&offset=0`,
    ),
    200,
  );
  const pendingInvitation = invitations[0];

  if (!pendingInvitation) {
    throw new Error('Could not find created seller invitation before revoke.');
  }

  expectEnvelope(
    'seller invitation revoke',
    await request(
      'PATCH',
      `/identity-access/sellers/invitations/${pendingInvitation.id}/revoke`,
    ),
    200,
  );

  skip(
    'seller access code confirm',
    'requires reading the emailed OTP manually',
  );
}

async function runDrawChecks() {
  const code = `codex-smoke-${uniqueSuffix}`;

  expectEnvelope(
    'draw configurations list',
    await request('GET', '/draws/configurations?active=true'),
    200,
  );

  const configuration = expectEnvelope<DrawConfiguration>(
    'draw configuration create',
    await request('POST', '/draws/configurations', {
      body: {
        code,
        time: '11:00:00',
        tuesdayOnly: false,
        lockSecondsBefore: 60,
        reopenSecondsAfter: 600,
        active: true,
      },
    }),
    201,
  );

  expectEnvelope(
    'draw configuration get',
    await request('GET', `/draws/configurations/${configuration.id}`),
    200,
  );

  expectEnvelope(
    'draw configuration update',
    await request('PATCH', `/draws/configurations/${configuration.id}`, {
      body: { reopenSecondsAfter: 900 },
    }),
    200,
  );

  const shift = expectEnvelope<DrawShift>(
    'draw shift open',
    await request('POST', '/draws/shifts', {
      body: {
        configurationId: configuration.id,
        date: smokeDate,
      },
    }),
    201,
  );

  expectEnvelope(
    'draw shifts list by date',
    await request('GET', `/draws/shifts?date=${smokeDate}`),
    200,
  );

  expectEnvelope(
    'draw active shifts list',
    await request('GET', `/draws/shifts/active?date=${smokeDate}`),
    200,
  );

  expectEnvelope(
    'draw shift block',
    await request('PATCH', `/draws/shifts/${shift.id}/block`),
    200,
  );

  expectEnvelope(
    'draw shift reopen',
    await request('PATCH', `/draws/shifts/${shift.id}/reopen`),
    200,
  );

  expectEnvelope(
    'draw shift close',
    await request('PATCH', `/draws/shifts/${shift.id}/close`),
    200,
  );

  expectStatus(
    'draw shift invalid transition after close',
    await request('PATCH', `/draws/shifts/${shift.id}/block`),
    [422],
  );

  expectEnvelope(
    'draw shifts list closed',
    await request('GET', `/draws/shifts?date=${smokeDate}&status=CERRADO`),
    200,
  );

  expectEnvelope(
    'draw configuration cleanup deactivate',
    await request('PATCH', `/draws/configurations/${configuration.id}`, {
      body: { active: false },
    }),
    200,
  );
}

async function main() {
  console.log(`Smoke base URL: ${baseUrl}`);
  console.log(`Smoke date: ${smokeDate}`);

  await runPublicChecks();
  await runAuthChecks();
  await runSellerOnboardingChecks();
  await runDrawChecks();

  console.log(`Smoke summary: total=${total} failures=${failures}`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  failures += 1;
  console.error(error);
  process.exitCode = 1;
});
