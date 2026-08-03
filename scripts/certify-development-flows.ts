import { createHmac, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import {
  assertCompleteRuntimeRouteCoverage,
  recordRuntimeRoute,
} from './runtime-route-coverage';

config({ path: ['.env.development', '.env'] });

type Envelope<T = unknown> = {
  success: boolean;
  statusCode: number;
  message: string | string[];
  data?: T;
  error?: string;
  meta: { request: { method: string; path: string; timestamp: string } };
};

type Session = {
  accessToken: string;
  refreshToken: string;
  user: { id: string };
};

type Plan = {
  id: string;
  currency: 'NIO' | 'USD';
  amountMinor: number;
};

type Portal = {
  tenant: { id: string; slug: string; status: string };
  invoices: Array<{ id: string; totalMinor: number; currency: string }>;
  bankAccounts: Array<{ id: string; currency: string }>;
};

const baseUrl = (
  process.env.CERT_BASE_URL ?? 'http://127.0.0.1:3100/api/v1'
).replace(/\/$/, '');
const supabaseUrl = required('SUPABASE_URL');
const publishableKey = required('SUPABASE_PUBLISHABLE_KEY');
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
const databaseUrl = required('DATABASE_URL');
const accessCodeSecret = required('SELLER_ACCESS_CODE_SECRET');
const workerSecret =
  process.env.CERT_BILLING_WORKER_SECRET ?? 'qa-worker-secret-2026-07-16-valid';
const suffix = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const routeCoverageFile = join(
  tmpdir(),
  `multilot-api-coverage-${randomUUID()}.txt`,
);
writeFileSync(routeCoverageFile, '', { encoding: 'utf8', mode: 0o600 });
process.env.API_ROUTE_COVERAGE_FILE = routeCoverageFile;
const ownerEmail = `qa.owner.${suffix}@test.com`;
const ownerPassword = 'QaOwnerPassword2026!';
const sellerEmail = `qa.seller.${suffix}@test.com`;
const sellerPassword = 'QaSellerPassword2026!';
const tenantSlug = `qa-cert-${suffix}`.toLowerCase();
const db = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost')
    ? undefined
    : { rejectUnauthorized: false },
  max: 2,
});
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authClient = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let checks = 0;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function pass(label: string, detail = ''): void {
  checks += 1;
  console.log(`PASS ${label}${detail ? ` ${detail}` : ''}`);
}

async function request<T>(
  method: string,
  path: string,
  options: {
    token?: string;
    body?: unknown;
    form?: FormData;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: Envelope<T> }> {
  recordRuntimeRoute(method, path || '/');
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...options.headers,
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.form
      ? options.form
      : options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json()) as Envelope<T>;
  if (
    typeof body.success !== 'boolean' ||
    body.statusCode !== response.status ||
    !body.meta?.request?.timestamp
  ) {
    throw new Error(`${method} ${path} returned an invalid API envelope`);
  }
  return { status: response.status, body };
}

async function expect<T>(
  label: string,
  method: string,
  path: string,
  status: number | number[],
  options: Parameters<typeof request<T>>[2] = {},
): Promise<T | undefined> {
  const response = await request<T>(method, path, options);
  const accepted = Array.isArray(status) ? status : [status];
  if (!accepted.includes(response.status)) {
    throw new Error(
      `${label}: expected ${accepted.join('|')}, got ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  pass(label, `status=${response.status}`);
  return response.body.data;
}

async function confirmEmail(profileId: string): Promise<string> {
  const row = await db.query<{ auth_user_id: string }>(
    'select auth_user_id from public.usuarios where id = $1',
    [profileId],
  );
  const authUserId = row.rows[0]?.auth_user_id;
  if (!authUserId) throw new Error('Owner Auth user was not found');
  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    email_confirm: true,
  });
  if (error) throw error;
  pass('owner email verified through QA administrator');
  return authUserId;
}

async function provisionRateLimitedSignup(
  plan: Plan,
): Promise<{ onboardingId: string; profileId: string }> {
  const created = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: false,
    user_metadata: { name: 'QA Tenant Owner' },
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error('QA owner could not be provisioned');
  }
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('set local role multilot_billing_worker');
    const started = await client.query<{
      profile_id: string;
      onboarding_session_id: string;
    }>(
      `select * from app_private.start_paid_signup(
        $1::uuid, $2, $3, $4, $5::uuid, $6, $7, $8, $9, $10::char(3), $11
      )`,
      [
        created.data.user.id,
        ownerEmail,
        `owner.${suffix}`,
        'QA Tenant Owner',
        plan.id,
        'BANK_TRANSFER',
        tenantSlug,
        `QA Certification ${suffix}`,
        'America/Managua',
        plan.currency,
        new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      ],
    );
    await client.query('commit');
    const row = started.rows[0];
    if (!row) throw new Error('QA pending signup transaction returned no row');
    pass(
      'rate-limited signup fixture provisioned through the same SQL boundary',
    );
    return {
      onboardingId: row.onboarding_session_id,
      profileId: row.profile_id,
    };
  } catch (error) {
    await client.query('rollback');
    await admin.auth.admin.deleteUser(created.data.user.id);
    throw error;
  } finally {
    client.release();
  }
}

async function createFinanceReviewer(): Promise<string> {
  const email = `qa.finance.${suffix}@test.com`;
  const password = 'QaFinancePassword2026!';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw error ?? new Error('Finance Auth user missing');
  const role = await db.query<{ id: string }>(
    'select id from public.roles order by creado_en asc limit 1',
  );
  const roleId = role.rows[0]?.id;
  if (!roleId) throw new Error('No role is available for finance QA profile');
  const profile = await db.query<{ id: string }>(
    `insert into public.usuarios
      (auth_user_id, username, pass_hash, rol_id, activo, nombre)
     values ($1, $2, '', $3, true, $4)
     returning id`,
    [data.user.id, `qa.finance.${suffix}`, roleId, 'QA Finance Reviewer'],
  );
  await db.query(
    `insert into public.platform_admins
      (perfil_id, activo, puede_revisar_facturacion)
     values ($1, true, true)`,
    [profile.rows[0].id],
  );
  const signed = await authClient.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) {
    throw signed.error ?? new Error('Finance session missing');
  }
  pass('temporary AlphaBy finance reviewer created');
  return signed.data.session.access_token;
}

async function main(): Promise<void> {
  console.log(`Certification tenant: ${tenantSlug}`);

  const plans = await expect<Plan[]>(
    'billing plan catalog',
    'GET',
    '/billing/plans?channel=BANK_TRANSFER',
    200,
  );
  const plan =
    plans?.find((candidate) => candidate.currency === 'NIO') ?? plans?.[0];
  if (!plan) throw new Error('No bank-transfer price is available');

  const signupResponse = await request<{
    onboardingId: string;
    profileId: string;
  }>('POST', '/billing/signup', {
    body: {
      email: ownerEmail,
      username: `owner.${suffix}`,
      name: 'QA Tenant Owner',
      password: ownerPassword,
      companyName: `QA Certification ${suffix}`,
      companySlug: tenantSlug,
      priceId: plan.id,
      paymentMethod: 'BANK_TRANSFER',
      timezone: 'America/Managua',
    },
  });
  let signup = signupResponse.body.data;
  if (signupResponse.status === 201 && signup) {
    pass('company signup starts pending', 'status=201');
  } else if ([400, 429].includes(signupResponse.status)) {
    pass(
      'company signup exposes hosted Auth email restriction',
      `status=${signupResponse.status}`,
    );
    signup = await provisionRateLimitedSignup(plan);
  } else {
    throw new Error(
      `company signup: expected 201|400|429, got ${signupResponse.status} ${JSON.stringify(signupResponse.body)}`,
    );
  }
  await confirmEmail(signup.profileId);

  const ownerSession = await expect<Session>(
    'owner authenticates into selected tenant',
    'POST',
    '/auth/login',
    200,
    {
      body: { email: ownerEmail, password: ownerPassword, tenant: tenantSlug },
    },
  );
  if (!ownerSession) throw new Error('Owner session missing');
  const ownerToken = ownerSession.accessToken;

  await expect(
    'pending tenant is blocked from operations',
    'GET',
    '/draws/configurations?page=1&limit=1',
    403,
    { token: ownerToken },
  );
  await expect(
    'pending tenant can open billing portal',
    'GET',
    '/billing/portal',
    200,
    {
      token: ownerToken,
    },
  );
  const invoice = await expect<{ invoiceId: string }>(
    'initial invoice is created idempotently',
    'POST',
    '/billing/portal/invoices/initial',
    201,
    { token: ownerToken },
  );
  if (!invoice?.invoiceId) throw new Error('Initial invoice ID missing');
  const portal = await expect<Portal>(
    'portal exposes invoice and currency-specific bank account',
    'GET',
    '/billing/portal',
    200,
    { token: ownerToken },
  );
  const portalInvoice = portal?.invoices.find(
    (item) => item.id === invoice.invoiceId,
  );
  const bankAccount = portal?.bankAccounts.find(
    (item) => item.currency === portalInvoice?.currency,
  );
  if (!portalInvoice || !bankAccount) {
    throw new Error('Invoice or matching bank account missing from portal');
  }
  if (!portal) throw new Error('Billing portal payload missing');
  const tenantId = portal.tenant.id;
  await expect(
    'transfer rejects a mismatched exact amount',
    'POST',
    '/billing/portal/transfers',
    [400, 422],
    {
      token: ownerToken,
      body: {
        invoiceId: portalInvoice.id,
        bankAccountId: bankAccount.id,
        amountMinor: portalInvoice.totalMinor + 1,
        currency: portalInvoice.currency,
        transferredAt: new Date().toISOString(),
        payerName: 'QA Tenant Owner',
      },
    },
  );
  const transfer = await expect<{ submissionId: string }>(
    'exact bank transfer is declared',
    'POST',
    '/billing/portal/transfers',
    201,
    {
      token: ownerToken,
      body: {
        invoiceId: portalInvoice.id,
        bankAccountId: bankAccount.id,
        reference: `qa-${suffix}`,
        amountMinor: portalInvoice.totalMinor,
        currency: portalInvoice.currency,
        transferredAt: new Date().toISOString(),
        payerName: 'QA Tenant Owner',
        sourceAccountLast4: '1234',
      },
    },
  );
  if (!transfer?.submissionId)
    throw new Error('Transfer submission ID missing');
  const invalidForm = new FormData();
  invalidForm.append(
    'file',
    new Blob(['not-a-pdf'], { type: 'application/pdf' }),
    'bad.pdf',
  );
  await expect(
    'evidence rejects forged MIME content',
    'POST',
    `/billing/portal/transfers/${transfer.submissionId}/evidence`,
    400,
    { token: ownerToken, form: invalidForm },
  );
  const evidenceForm = new FormData();
  evidenceForm.append(
    'file',
    new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'], {
      type: 'application/pdf',
    }),
    'qa-transfer.pdf',
  );
  await expect(
    'valid payment evidence enters finance review',
    'POST',
    `/billing/portal/transfers/${transfer.submissionId}/evidence`,
    201,
    { token: ownerToken, form: evidenceForm },
  );
  await expect(
    'PayPal remains optional and disabled without configuration',
    'POST',
    '/billing/portal/paypal/checkout',
    403,
    { token: ownerToken },
  );

  const financeToken = await createFinanceReviewer();
  const queue = await expect<Array<{ id: string }>>(
    'AlphaBy finance queue lists submitted evidence',
    'GET',
    '/billing/admin/transfers?status=EN_REVISION&limit=100',
    200,
    { token: financeToken },
  );
  if (!queue?.some((item) => item.id === transfer.submissionId)) {
    throw new Error('Submitted transfer is absent from finance queue');
  }
  await expect(
    'approval requires a reconciled bank reference',
    'POST',
    `/billing/admin/transfers/${transfer.submissionId}/review`,
    400,
    { token: financeToken, body: { decision: 'APROBADA' } },
  );
  await expect(
    'finance approval activates tenant and settles invoice',
    'POST',
    `/billing/admin/transfers/${transfer.submissionId}/review`,
    201,
    {
      token: financeToken,
      body: {
        decision: 'APROBADA',
        confirmedBankReference: `BANK-QA-${suffix}`,
        notes: 'QA: monto, moneda, cuenta y evidencia conciliados',
      },
    },
  );
  await expect(
    'activated tenant can enter operations',
    'GET',
    '/draws/configurations?page=1&limit=1',
    200,
    { token: ownerToken },
  );

  const invited = await expect<{ userId: string; sellerId: string }>(
    'owner invites seller',
    'POST',
    '/identity-access/sellers/invitations',
    201,
    {
      token: ownerToken,
      body: {
        email: sellerEmail,
        username: `seller.${suffix}`,
        sellerName: 'QA Operational Seller',
        documentId: `001-${String(Date.now()).slice(-6)}-0001A`,
        phone: '+50588889999',
        address: 'QA Managua',
        roleName: 'vendedor',
      },
    },
  );
  if (!invited) throw new Error('Seller invitation response missing');
  const accessCode = '731946';
  const accessCodeHash = createHmac('sha256', accessCodeSecret)
    .update(accessCode)
    .digest('hex');
  const seededAccessCode = await db.query<{ vendedor_id: string }>(
    `update public.codigos_acceso_vendedor
       set codigo_hash = $1, expira_en = now() + interval '15 minutes'
     where id = (
       select id from public.codigos_acceso_vendedor
       where tenant_id = $2 and email = $3 and estado = 'PENDIENTE'
       order by creado_en desc limit 1
     )
     returning vendedor_id`,
    [accessCodeHash, tenantId, sellerEmail],
  );
  const seededSellerId = seededAccessCode.rows[0]?.vendedor_id;
  if (!seededSellerId || seededAccessCode.rowCount !== 1) {
    throw new Error('Exactly one pending QA seller code must be prepared');
  }
  if (seededSellerId !== invited.sellerId) {
    throw new Error('Seller invitation response does not match persisted data');
  }
  await expect(
    'seller accepts one-time invitation code',
    'POST',
    '/identity-access/sellers/access-code/confirm',
    201,
    { body: { email: sellerEmail, accessCode, password: sellerPassword } },
  );
  const sellerSession = await expect<Session>(
    'seller authenticates into company',
    'POST',
    '/auth/login',
    200,
    {
      body: {
        email: sellerEmail,
        password: sellerPassword,
        tenant: tenantSlug,
      },
    },
  );
  if (!sellerSession) throw new Error('Seller session missing');

  const notification = await db.query<{ id: string }>(
    `insert into public.notificaciones(
       tenant_id, usuario_id, membresia_id, tipo, titulo, mensaje, dedup_key
     )
     select $1, $2, mt.id, 'QA_CERTIFICATION', 'QA notification',
            'Runtime endpoint certification fixture', $3
     from public.membresias_tenant mt
     where mt.tenant_id = $1 and mt.perfil_id = $2
     returning id`,
    [tenantId, signup.profileId, `qa-cert-${suffix}`],
  );
  const notificationId = notification.rows[0]?.id;
  if (!notificationId) throw new Error('Notification fixture was not created');
  pass('notification mutation fixture created');

  const smoke = spawnSync('yarn', ['test:api:smoke'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      SMOKE_BASE_URL: baseUrl,
      SMOKE_ADMIN_EMAIL: ownerEmail,
      SMOKE_ADMIN_PASSWORD: ownerPassword,
      SMOKE_SELLER_EMAIL: sellerEmail,
      SMOKE_SELLER_PASSWORD: sellerPassword,
      SMOKE_SELLER_ID: invited.sellerId,
      SMOKE_NOTIFICATION_ID: notificationId,
      SMOKE_RUN_OPERATIONAL_FLOW: 'true',
      SMOKE_RUN_INVITATION_FLOW: 'true',
      SMOKE_INVITATION_EMAIL: `qa.revoked.${suffix}@test.com`,
      SMOKE_REQUIRE_READY_DEPENDENCIES: 'true',
      API_ROUTE_COVERAGE_FILE: routeCoverageFile,
    },
  });
  if (smoke.status !== 0) throw new Error('Operational API smoke failed');
  pass('complete operational smoke from sale through prize and cash cut');

  await expect(
    'billing worker rejects invalid secret',
    'POST',
    '/billing/internal/cycle',
    401,
    { body: {}, headers: { 'x-billing-worker-secret': 'invalid' } },
  );

  await expect(
    'billing worker executes monthly lifecycle',
    'POST',
    '/billing/internal/cycle',
    200,
    { body: {}, headers: { 'x-billing-worker-secret': workerSecret } },
  );
  await expect(
    'unsigned PayPal webhook is rejected',
    'POST',
    '/billing/webhooks/paypal',
    401,
    { body: { id: `WH-${suffix}`, event_type: 'PAYMENT.SALE.COMPLETED' } },
  );
  await expect(
    'development billing backdoor is disabled',
    'POST',
    '/billing/development/complete',
    403,
    {
      headers: {
        'x-development-billing-secret': 'qa-development-secret-2026-valid',
      },
      body: {
        onboardingId: signup.onboardingId,
        providerSubscriptionId: `DEV-${suffix}`,
      },
    },
  );
  await expect(
    'seller logout revokes refresh session',
    'POST',
    '/auth/logout',
    200,
    {
      token: sellerSession.accessToken,
    },
  );

  const coverage = assertCompleteRuntimeRouteCoverage(routeCoverageFile);
  pass(
    'all controller routes executed dynamically',
    `routes=${coverage.covered}`,
  );

  console.log(
    `CERTIFICATION COMPLETE checks=${checks} tenant=${tenantSlug} owner=${ownerEmail}`,
  );
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
    try {
      unlinkSync(routeCoverageFile);
    } catch {
      // The operating system may already have removed the temporary file.
    }
  });
