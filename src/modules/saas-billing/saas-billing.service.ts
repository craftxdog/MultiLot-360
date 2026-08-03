import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { EnvConfigService } from '../../config/env-config.service';
import { PrismaService } from '../../infrastructure/database/prisma';
import { BillingProviderService } from './billing-provider.service';
import {
  BankTransferSubmissionDto,
  BillingChannel,
  PaidCompanySignupDto,
  PaypalWebhookDto,
  ReviewBankTransferDto,
} from './saas-billing.dto';

type SignupPrice = {
  price_id: string;
  plan_code: string;
  plan_name: string;
  description: string | null;
  limits: Record<string, unknown>;
  features: Record<string, unknown>;
  provider: string;
  provider_price_id: string | null;
  currency: string;
  amount_minor: bigint;
  billing_interval: 'MENSUAL' | 'ANUAL';
};

type StartSignupRow = { profile_id: string; onboarding_session_id: string };
type JsonMap = Record<string, unknown>;
type ProviderEventStatus =
  | 'INCOMPLETA'
  | 'ACTIVA'
  | 'MOROSA'
  | 'PAUSADA'
  | 'CANCELADA';

export type UploadedEvidence = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class SaasBillingService {
  private supabaseAdmin?: SupabaseClient;
  private supabaseSignup?: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvConfigService,
    private readonly providerService: BillingProviderService,
  ) {}

  async listPlans(channel: BillingChannel = 'BANK_TRANSFER') {
    this.assertChannelEnabled(channel);
    const prices = await this.listProviderPrices(channel);
    return prices.map((price) => ({
      id: price.price_id,
      code: price.plan_code,
      name: price.plan_name,
      description: price.description,
      limits: price.limits,
      features: price.features,
      channel: price.provider,
      currency: price.currency,
      amountMinor: Number(price.amount_minor),
      interval: price.billing_interval,
    }));
  }

  async signup(input: PaidCompanySignupDto) {
    if (!this.env.auth.signupEnabled) {
      throw new ForbiddenException('Company signup is disabled');
    }
    const channel = input.paymentMethod ?? 'BANK_TRANSFER';
    this.assertChannelEnabled(channel);
    const price = (await this.listProviderPrices(channel)).find(
      (candidate) => candidate.price_id === input.priceId,
    );
    if (!price) {
      throw new BadRequestException('Selected billing price is not available');
    }

    let authUserId: string | undefined;
    try {
      const { data, error } = await this.signupClient.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: this.env.auth.confirmationUrl,
          data: { name: input.name },
        },
      });
      if (error || !data.user || data.user.identities?.length === 0) {
        throw error ?? new Error('Auth user was not created');
      }
      authUserId = data.user.id;
      const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      const started = await this.prisma.runInBillingTransaction(async () => {
        const rows = await this.prisma.$queryRaw<StartSignupRow[]>(
          Prisma.sql`SELECT * FROM app_private.start_paid_signup(
            ${authUserId}::uuid, ${input.email}, ${input.username}, ${input.name},
            ${input.priceId}::uuid, ${channel}, ${input.companySlug},
            ${input.companyName}, ${input.timezone ?? 'America/Managua'},
            ${price.currency}::char(3), ${expiresAt}
          )`,
        );
        return rows[0];
      });
      if (!started) throw new Error('Pending tenant was not created');
      return {
        onboardingId: started.onboarding_session_id,
        profileId: started.profile_id,
        state: 'PENDING_EMAIL_VERIFICATION',
        tenantState: 'PENDIENTE_PAGO',
        paymentMethod: channel,
        emailVerificationRequired: !data.session,
        next: 'Verify the email, sign in, then open /billing/portal.',
      };
    } catch (error) {
      if (authUserId) {
        await this.admin.auth.admin
          .deleteUser(authUserId)
          .catch(() => undefined);
      }
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      if (this.errorStatus(error) === 429) {
        throw new HttpException(
          'Company signup is temporarily rate limited; try again later',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (this.errorStatus(error) === 400) {
        throw new BadRequestException('The company owner account is invalid');
      }
      throw new ServiceUnavailableException(
        'Could not create the pending company account',
        { cause: error },
      );
    }
  }

  async getPortal() {
    const portal = await this.readPortal();
    await this.attachEvidenceUrls(portal);
    return portal;
  }

  async ensureInitialInvoice() {
    const rows = await this.prisma.$queryRaw<Array<{ invoice_id: string }>>(
      Prisma.sql`SELECT app_private.ensure_initial_bank_invoice() AS invoice_id`,
    );
    return { invoiceId: rows[0]?.invoice_id };
  }

  async startPaypalCheckout() {
    this.assertChannelEnabled('PAYPAL');
    await this.ensureInitialInvoice();
    const portal = await this.readPortal();
    const onboarding = this.objectValue(portal, 'onboarding');
    const providerPlanId = this.stringValue(onboarding, 'providerPriceId');
    const onboardingId = this.stringValue(onboarding, 'id');
    const email = this.stringValue(onboarding, 'email');
    const name = this.stringValue(onboarding, 'ownerName');
    if (!providerPlanId || !onboardingId || !email || !name) {
      throw new BadRequestException(
        'This plan does not have an active PayPal channel',
      );
    }
    const subscription = await this.providerService.createSubscription({
      providerPlanId,
      onboardingId,
      email,
      name,
    });
    try {
      await this.prisma.$executeRaw(
        Prisma.sql`SELECT app_private.bind_portal_paypal_signup(
          ${subscription.id}
        )`,
      );
    } catch (error) {
      await this.providerService
        .cancelSubscription(subscription.id)
        .catch(() => undefined);
      throw new ServiceUnavailableException('Could not bind PayPal checkout', {
        cause: error,
      });
    }
    return {
      onboardingId,
      provider: 'PAYPAL',
      providerSubscriptionId: subscription.id,
      approvalUrl: subscription.approvalUrl,
    };
  }

  async createTransferSubmission(input: BankTransferSubmissionDto) {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ submission_id: string }>
      >(
        Prisma.sql`SELECT app_private.create_bank_transfer_submission(
          ${input.invoiceId}::uuid,${input.bankAccountId}::uuid,
          ${input.reference ?? null},${BigInt(input.amountMinor)},
          ${input.currency}::char(3),${new Date(input.transferredAt)},
          ${input.payerName},${input.sourceAccountLast4 ?? null}::char(4)
        ) AS submission_id`,
      );
      return {
        submissionId: rows[0]?.submission_id,
        state: 'PENDIENTE_EVIDENCIA',
      };
    } catch (error) {
      throw this.mapBillingDatabaseError(
        error,
        'The bank transfer declaration is invalid',
      );
    }
  }

  async uploadEvidence(
    submissionId: string,
    file: UploadedEvidence | undefined,
  ) {
    if (!file) throw new BadRequestException('Evidence file is required');
    this.validateEvidence(file);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const portal = await this.readPortal();
    const tenant = this.objectValue(portal, 'tenant');
    const tenantId = this.stringValue(tenant, 'id');
    if (!tenantId)
      throw new ForbiddenException('Billing tenant is unavailable');
    const extension = this.evidenceExtension(file.mimetype);
    const objectPath = `${tenantId}/${submissionId}/${randomUUID()}.${extension}`;
    const bucket = this.admin.storage.from('billing-evidence');
    const { error } = await bucket.upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (error) {
      throw new ServiceUnavailableException('Evidence upload failed', {
        cause: error,
      });
    }
    try {
      const rows = await this.prisma.$queryRaw<Array<{ evidence_id: string }>>(
        Prisma.sql`SELECT app_private.register_payment_evidence(
          ${submissionId}::uuid,${objectPath},${file.originalname},${file.mimetype},
          ${BigInt(file.size)},${sha256}::char(64)
        ) AS evidence_id`,
      );
      return {
        evidenceId: rows[0]?.evidence_id,
        submissionId,
        state: 'EN_REVISION',
      };
    } catch (error) {
      await bucket.remove([objectPath]).catch(() => undefined);
      throw this.mapBillingDatabaseError(
        error,
        'The payment evidence cannot be registered',
      );
    }
  }

  async listTransferQueue(status = 'EN_REVISION', limit = 100) {
    const rows = await this.prisma.$queryRaw<Array<{ queue: unknown }>>(
      Prisma.sql`SELECT app_private.list_platform_transfer_queue(
        ${status}::public.transferencia_pago_estado,${limit}
      ) AS queue`,
    );
    const queue: unknown[] = Array.isArray(rows[0]?.queue)
      ? (rows[0].queue as unknown[])
      : [];
    for (const item of queue) {
      if (this.isObject(item)) await this.attachEvidenceUrls(item);
    }
    return queue;
  }

  async reviewTransfer(id: string, input: ReviewBankTransferDto) {
    if (input.decision === 'APROBADA' && !input.confirmedBankReference) {
      throw new BadRequestException(
        'Confirmed bank reference is required for approval',
      );
    }
    try {
      const rows = await this.prisma.$queryRaw<Array<{ result: unknown }>>(
        Prisma.sql`SELECT app_private.review_bank_transfer(
          ${id}::uuid,${input.decision}::public.revision_pago_decision,
          ${input.confirmedBankReference ?? null},${input.notes ?? null}
        ) AS result`,
      );
      return rows[0]?.result;
    } catch (error) {
      throw this.mapBillingDatabaseError(
        error,
        'The bank transfer review is invalid',
      );
    }
  }

  async handlePaypalWebhook(
    headers: Record<string, string | string[] | undefined>,
    event: PaypalWebhookDto,
  ) {
    if (
      !(await this.providerService.verifyWebhook(
        headers,
        event as unknown as Record<string, unknown>,
      ))
    ) {
      throw new UnauthorizedException('Invalid PayPal webhook signature');
    }
    const subscriptionId = this.subscriptionId(event);
    if (!subscriptionId) return { accepted: true, processed: false };
    const subscription =
      await this.providerService.getSubscription(subscriptionId);
    const status = this.mapEventStatus(event.event_type, subscription.status);
    const tenantId = await this.processEvent(
      event.id,
      event.event_type,
      event as unknown as Record<string, unknown>,
      subscription,
      status,
    );
    return { accepted: true, processed: true, tenantId };
  }

  async completeDevelopmentSignup(
    secret: string | undefined,
    onboardingId: string,
    providerSubscriptionId: string,
  ) {
    if (this.env.billing.provider !== 'development') {
      throw new ForbiddenException('Development billing is disabled');
    }
    if (!this.safeSecret(secret, this.env.billing.developmentSecret)) {
      throw new UnauthorizedException('Invalid development billing secret');
    }
    await this.prisma.runInBillingTransaction(() =>
      this.prisma.$executeRaw(
        Prisma.sql`SELECT app_private.bind_paid_signup(
          ${onboardingId}::uuid,${providerSubscriptionId}
        )`,
      ),
    );
    const subscription = await this.providerService.getSubscription(
      providerSubscriptionId,
    );
    const tenantId = await this.processEvent(
      `DEV-EVENT-${onboardingId}`,
      'DEVELOPMENT.PAYMENT.COMPLETED',
      { onboardingId, providerSubscriptionId },
      subscription,
      'ACTIVA',
    );
    return { accepted: true, processed: true, tenantId };
  }

  async runBillingCycle(secret: string | undefined, at?: string) {
    if (!this.safeSecret(secret, this.env.billing.workerSecret)) {
      throw new UnauthorizedException('Invalid billing worker secret');
    }
    const rows = await this.prisma.runInBillingTransaction(() =>
      this.prisma.$queryRaw<Array<{ result: unknown }>>(
        Prisma.sql`SELECT app_private.run_billing_cycle(
          ${at ? new Date(at) : new Date()}
        ) AS result`,
      ),
    );
    return rows[0]?.result;
  }

  private async listProviderPrices(
    channel: BillingChannel,
  ): Promise<SignupPrice[]> {
    return this.prisma.runInBillingTransaction(() =>
      this.prisma.$queryRaw<SignupPrice[]>(
        Prisma.sql`SELECT * FROM app_private.list_signup_prices(${channel})`,
      ),
    );
  }

  private async readPortal(): Promise<JsonMap> {
    const rows = await this.prisma.$queryRaw<Array<{ portal: unknown }>>(
      Prisma.sql`SELECT app_private.get_billing_portal() AS portal`,
    );
    return this.isObject(rows[0]?.portal) ? rows[0].portal : {};
  }

  private async processEvent(
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    subscription: {
      id: string;
      customerId: string;
      status: string;
      startsAt: Date | null;
      nextBillingAt: Date | null;
    },
    status: ProviderEventStatus,
  ): Promise<string | null> {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const rows = await this.prisma.runInBillingTransaction(() =>
      this.prisma.$queryRaw<Array<{ tenant_id: string | null }>>(
        Prisma.sql`SELECT app_private.process_subscription_event(
          ${this.providerService.provider},${eventId},${eventType},
          ${payloadHash}::char(64),${JSON.stringify(payload)}::jsonb,
          ${subscription.id},${subscription.customerId},
          ${status}::public.suscripcion_estado,
          ${subscription.startsAt},${subscription.nextBillingAt}
        ) AS tenant_id`,
      ),
    );
    return rows[0]?.tenant_id ?? null;
  }

  private subscriptionId(event: PaypalWebhookDto): string | undefined {
    const resource = event.resource ?? {};
    const agreement = resource.billing_agreement_id;
    if (typeof agreement === 'string') return agreement;
    return typeof resource.id === 'string' &&
      event.event_type.startsWith('BILLING.SUBSCRIPTION.')
      ? resource.id
      : undefined;
  }

  private mapEventStatus(
    eventType: string,
    providerStatus: string,
  ): ProviderEventStatus {
    if (eventType === 'PAYMENT.SALE.COMPLETED') return 'ACTIVA';
    if (eventType === 'PAYMENT.SALE.DENIED') return 'MOROSA';
    switch (providerStatus.toUpperCase()) {
      case 'ACTIVE':
        return 'ACTIVA';
      case 'SUSPENDED':
        return 'PAUSADA';
      case 'CANCELLED':
      case 'EXPIRED':
        return 'CANCELADA';
      default:
        return 'INCOMPLETA';
    }
  }

  private assertChannelEnabled(channel: BillingChannel): void {
    if (channel === 'BANK_TRANSFER') return;
    if (channel === 'PAYPAL' && this.env.billing.paypalEnabled) return;
    if (
      channel === 'DEVELOPMENT' &&
      this.env.billing.provider === 'development'
    ) {
      return;
    }
    throw new ForbiddenException(`${channel} billing is disabled`);
  }

  private validateEvidence(file: UploadedEvidence): void {
    if (file.size < 1 || file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Evidence must be at most 10 MB');
    }
    const valid =
      (file.mimetype === 'application/pdf' &&
        file.buffer.subarray(0, 5).toString('ascii') === '%PDF-') ||
      (file.mimetype === 'image/jpeg' &&
        file.buffer[0] === 0xff &&
        file.buffer[1] === 0xd8 &&
        file.buffer[2] === 0xff) ||
      (file.mimetype === 'image/png' &&
        file.buffer
          .subarray(0, 8)
          .equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          ));
    if (!valid) {
      throw new BadRequestException('Evidence content does not match its type');
    }
  }

  private evidenceExtension(mime: string): string {
    if (mime === 'application/pdf') return 'pdf';
    if (mime === 'image/jpeg') return 'jpg';
    return 'png';
  }

  private async attachEvidenceUrls(value: JsonMap): Promise<void> {
    const evidenceCollections: unknown[][] = [];
    const visit = (candidate: unknown): void => {
      if (Array.isArray(candidate)) {
        for (const item of candidate) visit(item);
      } else if (this.isObject(candidate)) {
        if (Array.isArray(candidate.evidence)) {
          evidenceCollections.push(candidate.evidence);
        }
        for (const item of Object.values(candidate)) visit(item);
      }
    };
    visit(value);
    for (const evidence of evidenceCollections.flat()) {
      if (!this.isObject(evidence)) continue;
      const path = this.stringValue(evidence, 'objectPath');
      if (!path) continue;
      const { data } = await this.admin.storage
        .from('billing-evidence')
        .createSignedUrl(path, 300);
      evidence.signedUrl = data?.signedUrl ?? null;
      delete evidence.objectPath;
      delete evidence.sha256;
    }
  }

  private objectValue(value: JsonMap, key: string): JsonMap {
    return this.isObject(value[key]) ? value[key] : {};
  }

  private stringValue(value: JsonMap, key: string): string | undefined {
    return typeof value[key] === 'string' ? value[key] : undefined;
  }

  private isObject(value: unknown): value is JsonMap {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private safeSecret(actual: string | undefined, expected: string): boolean {
    if (!actual || expected.length < 16 || actual.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  }

  private errorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object' || !('status' in error)) {
      return undefined;
    }
    return typeof error.status === 'number' ? error.status : undefined;
  }

  private mapBillingDatabaseError(error: unknown, message: string): Error {
    const code = this.databaseErrorCode(error);
    if (code === '23505' || code === '55000') {
      return new ConflictException(message, { cause: error });
    }
    if (code === '42501') {
      return new ForbiddenException(message, { cause: error });
    }
    if (code?.startsWith('22') || code?.startsWith('23')) {
      return new BadRequestException(message, { cause: error });
    }
    return error instanceof Error
      ? error
      : new ServiceUnavailableException(message);
  }

  private databaseErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object' || !('meta' in error)) {
      return undefined;
    }
    const meta = error.meta;
    if (!meta || typeof meta !== 'object' || !('driverAdapterError' in meta)) {
      return undefined;
    }
    const adapter = meta.driverAdapterError;
    if (!adapter || typeof adapter !== 'object' || !('cause' in adapter)) {
      return undefined;
    }
    const cause = adapter.cause;
    if (!cause || typeof cause !== 'object' || !('originalCode' in cause)) {
      return undefined;
    }
    return typeof cause.originalCode === 'string'
      ? cause.originalCode
      : undefined;
  }

  private get signupClient(): SupabaseClient {
    this.supabaseSignup ??= createClient(
      this.env.supabase.url,
      this.env.supabase.publishableKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    return this.supabaseSignup;
  }

  private get admin(): SupabaseClient {
    this.supabaseAdmin ??= createClient(
      this.env.supabase.url,
      this.env.supabase.serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    return this.supabaseAdmin;
  }
}
