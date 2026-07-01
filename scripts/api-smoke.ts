type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

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

type PaginatedData<T> = T[];

type AuthIdentity = {
  user: {
    id: string;
    roleName?: string;
    permissions?: string[];
  };
  seller?: {
    id: string;
  };
};

type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
  };
};

type SellerInvitation = {
  id: string;
  sellerId: string;
  email: string;
  username: string;
  status: string;
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

type NumberLimit = {
  id: string;
  number: string;
  limitMiles: number;
};

type BlockedNumber = {
  id: string;
  number: string;
};

type Sale = {
  id: string;
  status: string;
  totalMiles: number;
};

type Result = {
  id: string;
  winningNumber: string;
};

type WinningSale = {
  saleId: string;
  paid: boolean;
};

type PrizePayment = {
  saleId: string;
  paidAmountMiles: number;
};

type CashCut = {
  id: string;
};

type SystemParameter = {
  key: string;
  value: string;
};

type AuditEvent = {
  id: string;
  event: string;
};

const baseUrl = (
  process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000/api/v1'
).replace(/\/$/, '');
let adminJwt = process.env.SMOKE_ADMIN_JWT;
let sellerJwt = process.env.SMOKE_SELLER_JWT;
const smokeDate =
  process.env.SMOKE_DATE ?? new Date().toISOString().slice(0, 10);
const uniqueSuffix = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const runInvitationFlow = process.env.SMOKE_RUN_INVITATION_FLOW === 'true';
const runOperationalFlow = process.env.SMOKE_RUN_OPERATIONAL_FLOW === 'true';
const requireReadyDependencies =
  process.env.SMOKE_REQUIRE_READY_DEPENDENCIES === 'true';

let total = 0;
let failures = 0;
let existingSellerId = process.env.SMOKE_SELLER_ID;

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
    const token = options.token ?? adminJwt;
    if (!token) throw new Error('An access token is required for this check.');
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20_000),
  });
  const responseText = await response.text();

  return {
    status: response.status,
    body: responseText ? (JSON.parse(responseText) as T) : ({} as T),
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

function skip(name: string, reason: string) {
  console.log(`SKIP ${name} ${reason}`);
}

function expectStatus(
  name: string,
  response: SmokeResponse,
  expectedStatuses: number[],
): boolean {
  if (expectedStatuses.includes(response.status)) {
    pass(name, `status=${response.status}`);
    return true;
  }

  fail(
    name,
    `expected=${expectedStatuses.join('|')} status=${response.status} body=${JSON.stringify(
      response.body,
    )}`,
  );
  return false;
}

function expectEnvelope<T>(
  name: string,
  response: SmokeResponse<ApiEnvelope<T>>,
  expectedStatus: number,
): T {
  const validStatus = expectStatus(name, response, [expectedStatus]);

  if (!validStatus || !response.body.success) {
    throw new Error(`${name} failed.`);
  }

  return response.body.data as T;
}

async function runPublicChecks() {
  expectStatus('root', await request('GET', '', { auth: false }), [200]);
  expectStatus(
    'health liveness',
    await request('GET', '/health', { auth: false }),
    [200],
  );

  const readiness = await request<
    ApiEnvelope<{ status: string; checks?: Record<string, unknown> }>
  >('GET', '/health/ready', { auth: false });
  expectStatus('health readiness endpoint', readiness, [200]);

  if (readiness.body.data?.status === 'ok') {
    pass('health readiness dependencies');
  } else if (!requireReadyDependencies) {
    skip(
      'health readiness dependencies',
      JSON.stringify(readiness.body.data?.checks ?? readiness.body),
    );
  } else {
    fail(
      'health readiness dependencies',
      JSON.stringify(readiness.body.data?.checks ?? readiness.body),
    );
  }
}

async function loginWithCredentials(
  label: string,
  email: string | undefined,
  password: string | undefined,
): Promise<AuthSession | undefined> {
  if (!email || !password) return undefined;

  return expectEnvelope<AuthSession>(
    `${label} login`,
    await request('POST', '/auth/login', {
      auth: false,
      body: { email, password },
    }),
    200,
  );
}

async function runAuthChecks() {
  expectStatus(
    'auth signup validation',
    await request('POST', '/auth/signup', {
      auth: false,
      body: {},
    }),
    [400],
  );
  expectStatus(
    'auth login invalid credentials',
    await request('POST', '/auth/login', {
      auth: false,
      body: {
        email: 'invalid@example.com',
        password: 'InvalidPassword2026!',
      },
    }),
    [401],
  );
  expectStatus(
    'auth refresh invalid token',
    await request('POST', '/auth/refresh', {
      auth: false,
      body: { refreshToken: 'invalid-refresh-token' },
    }),
    [401],
  );
  expectStatus(
    'auth logout requires bearer token',
    await request('POST', '/auth/logout', { auth: false }),
    [401],
  );

  const adminSession = await loginWithCredentials(
    'admin',
    process.env.SMOKE_ADMIN_EMAIL,
    process.env.SMOKE_ADMIN_PASSWORD,
  );
  if (adminSession) {
    const refreshedSession = expectEnvelope<AuthSession>(
      'admin refresh',
      await request('POST', '/auth/refresh', {
        auth: false,
        body: { refreshToken: adminSession.refreshToken },
      }),
      200,
    );
    adminJwt = refreshedSession.accessToken;
  }

  if (!adminJwt) {
    throw new Error(
      'Set SMOKE_ADMIN_JWT or SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD.',
    );
  }

  const adminIdentity = expectEnvelope<AuthIdentity>(
    'auth me admin',
    await request('GET', '/auth/me'),
    200,
  );
  if (adminIdentity.user.roleName?.toUpperCase() !== 'ADMIN') {
    fail('admin role', `role=${adminIdentity.user.roleName ?? 'missing'}`);
  } else {
    pass(
      'admin role',
      `permissions=${adminIdentity.user.permissions?.length ?? 0}`,
    );
  }

  const sellerSession = await loginWithCredentials(
    'seller',
    process.env.SMOKE_SELLER_EMAIL,
    process.env.SMOKE_SELLER_PASSWORD,
  );
  if (sellerSession) sellerJwt = sellerSession.accessToken;

  if (!sellerJwt) {
    skip(
      'seller authentication and RBAC',
      'set SMOKE_SELLER_JWT or seller credentials',
    );
    return;
  }

  const sellerMeResponse = await request<ApiEnvelope<AuthIdentity>>(
    'GET',
    '/auth/me',
    { token: sellerJwt },
  );
  if (!expectStatus('auth me seller', sellerMeResponse, [200])) {
    sellerJwt = undefined;
    return;
  }

  const sellerIdentity = sellerMeResponse.body.data;
  if (!sellerIdentity?.seller?.id) {
    fail('seller profile', 'authenticated user has no seller profile');
    sellerJwt = undefined;
    return;
  }

  existingSellerId ??= sellerIdentity.seller.id;
  pass('seller profile', `sellerId=${sellerIdentity.seller.id}`);
  expectStatus(
    'seller cannot create draw configurations',
    await request('POST', '/draws/configurations', {
      token: sellerJwt,
      body: {
        code: `forbidden-${uniqueSuffix}`,
        time: '23:59:59',
      },
    }),
    [403],
  );
}

async function resolveExistingSellerId() {
  if (existingSellerId) return;

  const email = process.env.SMOKE_EXISTING_SELLER_EMAIL;
  if (!email) return;

  const invitations = expectEnvelope<PaginatedData<SellerInvitation>>(
    'existing seller invitation lookup',
    await request(
      'GET',
      `/identity-access/sellers/invitations?email=${encodeURIComponent(
        email,
      )}&page=1&limit=10`,
    ),
    200,
  );
  existingSellerId = invitations[0]?.sellerId;

  if (existingSellerId) {
    pass('existing seller resolved', `sellerId=${existingSellerId}`);
  }
}

async function runSellerOnboardingChecks() {
  expectEnvelope<PaginatedData<SellerInvitation>>(
    'seller invitations list',
    await request('GET', '/identity-access/sellers/invitations?page=1&limit=5'),
    200,
  );

  if (!runInvitationFlow) {
    skip(
      'seller invitation create/resend/confirm/revoke',
      'set SMOKE_RUN_INVITATION_FLOW=true and SMOKE_INVITATION_EMAIL',
    );
    return;
  }

  const email = process.env.SMOKE_INVITATION_EMAIL;
  if (!email) {
    throw new Error(
      'SMOKE_INVITATION_EMAIL is required when invitation flow is enabled.',
    );
  }

  const username = `smoke.${uniqueSuffix}`;
  const documentId = `${uniqueSuffix.slice(0, 3)}-${uniqueSuffix.slice(
    3,
    9,
  )}-${uniqueSuffix.slice(9, 13)}A`;
  expectEnvelope<{ userId: string; sellerId: string }>(
    'seller invitation create and email send',
    await request('POST', '/identity-access/sellers/invitations', {
      body: {
        email,
        username,
        sellerName: `Smoke Seller ${uniqueSuffix}`,
        documentId,
        phone: '+50588889999',
        address: 'Smoke test address',
        roleName: 'vendedor',
      },
    }),
    201,
  );

  expectEnvelope(
    'seller access code resend and email send',
    await request('POST', '/identity-access/sellers/access-code/resend', {
      body: { email },
    }),
    200,
  );
  expectStatus(
    'seller access code rejects invalid code',
    await request('POST', '/identity-access/sellers/access-code/confirm', {
      auth: false,
      body: {
        email,
        accessCode: '000000',
        password: 'SmokePassword2026!',
      },
    }),
    [422],
  );

  const invitations = expectEnvelope<PaginatedData<SellerInvitation>>(
    'seller invitation lookup before revoke',
    await request(
      'GET',
      `/identity-access/sellers/invitations?email=${encodeURIComponent(
        email,
      )}&username=${encodeURIComponent(username)}&page=1&limit=1`,
    ),
    200,
  );
  const invitation = invitations[0];
  if (!invitation) throw new Error('Created seller invitation was not found.');

  expectEnvelope(
    'seller invitation revoke',
    await request(
      'PATCH',
      `/identity-access/sellers/invitations/${invitation.id}/revoke`,
    ),
    200,
  );
}

async function runOperationalFlowChecks() {
  if (!runOperationalFlow) {
    skip(
      'full operational flow',
      'set SMOKE_RUN_OPERATIONAL_FLOW=true and identify a seller',
    );
    return;
  }

  await resolveExistingSellerId();
  if (!existingSellerId) {
    throw new Error(
      'Set SMOKE_SELLER_ID or SMOKE_EXISTING_SELLER_EMAIL for the operational flow.',
    );
  }

  const configuration = expectEnvelope<DrawConfiguration>(
    'draw configuration create',
    await request('POST', '/draws/configurations', {
      body: {
        code: `codex-smoke-${uniqueSuffix}`,
        time: '23:59:59',
        tuesdayOnly: false,
        lockSecondsBefore: 0,
        reopenSecondsAfter: 86_400,
        active: true,
      },
    }),
    201,
  );

  expectEnvelope<PaginatedData<DrawConfiguration>>(
    'draw configurations list',
    await request('GET', '/draws/configurations?active=true&page=1&limit=5'),
    200,
  );
  expectEnvelope(
    'draw configuration get',
    await request('GET', `/draws/configurations/${configuration.id}`),
    200,
  );
  expectEnvelope(
    'draw configuration update',
    await request('PATCH', `/draws/configurations/${configuration.id}`, {
      body: { reopenSecondsAfter: 86_399 },
    }),
    200,
  );

  const shift = expectEnvelope<DrawShift>(
    'draw shift open',
    await request('POST', '/draws/shifts', {
      body: { configurationId: configuration.id, date: smokeDate },
    }),
    201,
  );
  expectEnvelope<PaginatedData<DrawShift>>(
    'draw shifts list',
    await request('GET', `/draws/shifts?date=${smokeDate}&page=1&limit=5`),
    200,
  );
  expectEnvelope<PaginatedData<DrawShift>>(
    'draw active shifts list',
    await request(
      'GET',
      `/draws/shifts/active?date=${smokeDate}&page=1&limit=5`,
    ),
    200,
  );

  const limits = expectEnvelope<NumberLimit[]>(
    'number limits create batch',
    await request('POST', '/number-limits', {
      body: {
        sellerId: existingSellerId,
        drawConfigurationId: configuration.id,
        numbers: ['20', '30'],
        limitMiles: 1_000,
        validFrom: smokeDate,
      },
    }),
    201,
  );
  const numberLimit = limits[0];
  if (!numberLimit) throw new Error('Number limit batch returned no items.');

  expectEnvelope<PaginatedData<NumberLimit>>(
    'number limits list',
    await request(
      'GET',
      `/number-limits?sellerId=${existingSellerId}&drawConfigurationId=${configuration.id}&page=1&limit=10`,
    ),
    200,
  );
  expectEnvelope(
    'number limit get',
    await request('GET', `/number-limits/${numberLimit.id}`),
    200,
  );
  expectEnvelope(
    'number limit update',
    await request('PATCH', `/number-limits/${numberLimit.id}`, {
      body: { limitMiles: 1_100 },
    }),
    200,
  );

  const blocks = expectEnvelope<BlockedNumber[]>(
    'blocked numbers create',
    await request('POST', '/blocked-numbers', {
      body: {
        numbers: ['98'],
        shiftId: shift.id,
        reason: `Smoke test ${uniqueSuffix}`,
      },
    }),
    201,
  );
  const block = blocks[0];
  if (!block) throw new Error('Blocked number batch returned no items.');

  expectEnvelope<PaginatedData<BlockedNumber>>(
    'blocked numbers list',
    await request(
      'GET',
      `/blocked-numbers?shiftId=${shift.id}&page=1&limit=10`,
    ),
    200,
  );
  expectEnvelope(
    'blocked number get',
    await request('GET', `/blocked-numbers/${block.id}`),
    200,
  );
  expectStatus(
    'blocked number prevents sale',
    await request('POST', '/sales', {
      body: {
        sellerId: existingSellerId,
        shiftId: shift.id,
        items: [{ number: '98', prizeMiles: 1 }],
      },
    }),
    [422],
  );
  expectEnvelope(
    'blocked number delete',
    await request('DELETE', `/blocked-numbers/${block.id}`),
    200,
  );

  const winningSale = expectEnvelope<Sale>(
    'multi-number sale create',
    await request('POST', '/sales', {
      body: {
        sellerId: existingSellerId,
        shiftId: shift.id,
        items: [
          { number: '20', prizeMiles: 10 },
          { number: '30', prizeMiles: 5 },
        ],
      },
    }),
    201,
  );
  const voidableSale = expectEnvelope<Sale>(
    'single-number sale create',
    await request('POST', '/sales', {
      body: {
        sellerId: existingSellerId,
        shiftId: shift.id,
        items: [{ number: '40', prizeMiles: 2 }],
      },
    }),
    201,
  );

  expectEnvelope<PaginatedData<Sale>>(
    'sales list',
    await request(
      'GET',
      `/sales?sellerId=${existingSellerId}&shiftId=${shift.id}&page=1&limit=10`,
    ),
    200,
  );
  expectEnvelope(
    'sale get',
    await request('GET', `/sales/${winningSale.id}`),
    200,
  );
  expectEnvelope(
    'sale void',
    await request('PATCH', `/sales/${voidableSale.id}/void`, {
      body: { reason: `Smoke test void ${uniqueSuffix}` },
    }),
    200,
  );

  const voidPolicy = expectEnvelope<{ windowMinutes: number }>(
    'sales void policy get',
    await request('GET', '/sales/settings/void-policy'),
    200,
  );
  expectEnvelope(
    'sales void policy update',
    await request('PATCH', '/sales/settings/void-policy', {
      body: { windowMinutes: voidPolicy.windowMinutes },
    }),
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
    'closed shift rejects sale',
    await request('POST', '/sales', {
      body: {
        sellerId: existingSellerId,
        shiftId: shift.id,
        items: [{ number: '50', prizeMiles: 1 }],
      },
    }),
    [422],
  );

  const result = expectEnvelope<Result>(
    'result create',
    await request('POST', '/results', {
      body: { shiftId: shift.id, winningNumber: '20' },
    }),
    201,
  );
  expectEnvelope<PaginatedData<Result>>(
    'results list',
    await request('GET', `/results?shiftId=${shift.id}&page=1&limit=10`),
    200,
  );
  expectEnvelope(
    'result get',
    await request('GET', `/results/${result.id}`),
    200,
  );
  const winningSales = expectEnvelope<PaginatedData<WinningSale>>(
    'winning sales list',
    await request('GET', `/results/${result.id}/winning-sales?page=1&limit=10`),
    200,
  );
  if (!winningSales.some((sale) => sale.saleId === winningSale.id)) {
    throw new Error('The winning sale was not returned by the result.');
  }

  const payment = expectEnvelope<PrizePayment>(
    'prize payment create',
    await request('POST', '/prize-payments', {
      body: { resultId: result.id, saleId: winningSale.id },
    }),
    201,
  );
  expectEnvelope<PaginatedData<PrizePayment>>(
    'prize payments list',
    await request(
      'GET',
      `/prize-payments?resultId=${result.id}&page=1&limit=10`,
    ),
    200,
  );
  expectEnvelope(
    'prize payment get',
    await request('GET', `/prize-payments/${payment.saleId}`),
    200,
  );
  expectStatus(
    'duplicate prize payment rejected',
    await request('POST', '/prize-payments', {
      body: { resultId: result.id, saleId: winningSale.id },
    }),
    [409],
  );

  const cut = expectEnvelope<CashCut>(
    'cash cut create',
    await request('POST', '/cash-cuts', {
      body: {
        startDate: smokeDate,
        endDate: smokeDate,
        description: `Codex smoke ${uniqueSuffix}`,
        visibleToSellers: true,
      },
    }),
    201,
  );
  expectEnvelope<PaginatedData<CashCut>>(
    'cash cuts list',
    await request(
      'GET',
      `/cash-cuts?startDate=${smokeDate}&endDate=${smokeDate}&page=1&limit=10`,
    ),
    200,
  );
  expectEnvelope(
    'cash cut get',
    await request('GET', `/cash-cuts/${cut.id}`),
    200,
  );
  expectEnvelope(
    'cash cut summary',
    await request('GET', `/cash-cuts/${cut.id}/summary`),
    200,
  );

  expectEnvelope(
    'operational overview report',
    await request(
      'GET',
      `/reports/overview?dateFrom=${smokeDate}&dateUntil=${smokeDate}`,
    ),
    200,
  );
  expectEnvelope(
    'seller operational reports',
    await request(
      'GET',
      `/reports/sellers?dateFrom=${smokeDate}&dateUntil=${smokeDate}&page=1&limit=10`,
    ),
    200,
  );

  expectEnvelope<PaginatedData<SystemParameter>>(
    'system parameters list',
    await request('GET', '/parameters?page=1&limit=10'),
    200,
  );
  const parameter = expectEnvelope<SystemParameter>(
    'system parameter get',
    await request('GET', '/parameters/sales.void_window_minutes'),
    200,
  );
  expectEnvelope(
    'system parameter upsert',
    await request('PUT', `/parameters/${parameter.key}`, {
      body: { value: parameter.value },
    }),
    200,
  );

  const auditEvents = expectEnvelope<PaginatedData<AuditEvent>>(
    'audit events list',
    await request(
      'GET',
      '/audit-events?event=http.request.completed&page=1&limit=10',
    ),
    200,
  );
  const auditEvent = auditEvents[0];
  if (!auditEvent) throw new Error('No HTTP audit event was returned.');
  expectEnvelope(
    'audit event get',
    await request('GET', `/audit-events/${auditEvent.id}`),
    200,
  );

  expectEnvelope(
    'number limit expire',
    await request('PATCH', `/number-limits/${numberLimit.id}/expire`, {
      body: { expiresOn: smokeDate },
    }),
    200,
  );
  expectEnvelope(
    'draw configuration cleanup deactivate',
    await request('PATCH', `/draws/configurations/${configuration.id}`, {
      body: { active: false },
    }),
    200,
  );

  if (sellerJwt) {
    expectEnvelope<PaginatedData<Sale>>(
      'seller can list own sales',
      await request('GET', '/sales?page=1&limit=10', { token: sellerJwt }),
      200,
    );
    expectStatus(
      'seller cannot access prize payments',
      await request('GET', '/prize-payments?page=1&limit=5', {
        token: sellerJwt,
      }),
      [403],
    );
  }
}

async function main() {
  console.log(`Smoke base URL: ${baseUrl}`);
  console.log(`Smoke date: ${smokeDate}`);

  await runPublicChecks();
  await runAuthChecks();
  await runSellerOnboardingChecks();
  await runOperationalFlowChecks();

  console.log(`Smoke summary: total=${total} failures=${failures}`);
  if (failures > 0) process.exitCode = 1;
}

void main().catch((error) => {
  failures += 1;
  console.error(error);
  process.exitCode = 1;
});
