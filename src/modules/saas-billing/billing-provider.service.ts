import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EnvConfigService } from '../../config/env-config.service';

export type CreateSubscriptionInput = {
  providerPlanId: string;
  onboardingId: string;
  email: string;
  name: string;
};

export type ProviderSubscription = {
  id: string;
  approvalUrl: string;
};

export type ProviderSubscriptionDetails = {
  id: string;
  customerId: string;
  status: string;
  startsAt: Date | null;
  nextBillingAt: Date | null;
};

type PaypalLink = { href?: string; rel?: string };

@Injectable()
export class BillingProviderService {
  private accessToken?: { value: string; expiresAt: number };

  constructor(private readonly env: EnvConfigService) {}

  get provider(): 'PAYPAL' | 'DEVELOPMENT' {
    if (this.env.billing.provider === 'development') return 'DEVELOPMENT';
    if (
      this.env.billing.paypalEnabled ||
      this.env.billing.provider === 'paypal'
    )
      return 'PAYPAL';
    throw new ServiceUnavailableException(
      'Paid company signup is not configured',
    );
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<ProviderSubscription> {
    if (this.provider === 'DEVELOPMENT') {
      const id = `DEV-${randomUUID()}`;
      const approvalUrl = new URL(
        '/facturacion/desarrollo',
        this.env.app.webUrl,
      );
      approvalUrl.searchParams.set('subscription_id', id);
      approvalUrl.searchParams.set('onboarding_id', input.onboardingId);
      return { id, approvalUrl: approvalUrl.toString() };
    }

    const response = await this.paypalRequest<{
      id?: string;
      links?: PaypalLink[];
    }>('/v1/billing/subscriptions', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': input.onboardingId },
      body: JSON.stringify({
        plan_id: input.providerPlanId,
        custom_id: input.onboardingId,
        subscriber: {
          email_address: input.email,
          name: this.paypalName(input.name),
        },
        application_context: {
          brand_name: this.env.app.name,
          user_action: 'SUBSCRIBE_NOW',
          return_url: this.env.billing.returnUrl,
          cancel_url: this.env.billing.cancelUrl,
        },
      }),
    });
    const approvalUrl = response.links?.find(
      (link) => link.rel === 'approve',
    )?.href;
    if (!response.id || !approvalUrl) {
      throw new ServiceUnavailableException(
        'PayPal did not return an approval URL',
      );
    }
    return { id: response.id, approvalUrl };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    if (this.provider === 'DEVELOPMENT') return;
    await this.paypalRequest(
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: 'MultiLot onboarding was not completed',
        }),
      },
    );
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    event: Record<string, unknown>,
  ): Promise<boolean> {
    if (
      !this.env.billing.paypalEnabled &&
      this.env.billing.provider !== 'paypal'
    ) {
      return false;
    }
    const required = (name: string): string => {
      const value = headers[name];
      return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
    };
    const result = await this.paypalRequest<{ verification_status?: string }>(
      '/v1/notifications/verify-webhook-signature',
      {
        method: 'POST',
        body: JSON.stringify({
          transmission_id: required('paypal-transmission-id'),
          transmission_time: required('paypal-transmission-time'),
          cert_url: required('paypal-cert-url'),
          auth_algo: required('paypal-auth-algo'),
          transmission_sig: required('paypal-transmission-sig'),
          webhook_id: this.env.billing.paypalWebhookId,
          webhook_event: event,
        }),
      },
    );
    return result.verification_status === 'SUCCESS';
  }

  async getSubscription(id: string): Promise<ProviderSubscriptionDetails> {
    if (this.provider !== 'PAYPAL') {
      const startsAt = new Date();
      const nextBillingAt = new Date(startsAt);
      nextBillingAt.setUTCMonth(nextBillingAt.getUTCMonth() + 1);
      return {
        id,
        customerId: `DEV-CUSTOMER-${id}`,
        status: 'ACTIVE',
        startsAt,
        nextBillingAt,
      };
    }
    const data = await this.paypalRequest<{
      id?: string;
      status?: string;
      start_time?: string;
      subscriber?: { payer_id?: string };
      billing_info?: { next_billing_time?: string };
    }>(`/v1/billing/subscriptions/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
    const startsAt = this.optionalDate(data.start_time);
    const nextBillingAt = this.optionalDate(
      data.billing_info?.next_billing_time,
    );
    if (!data.id || !data.status) {
      throw new ServiceUnavailableException(
        'PayPal subscription data is incomplete',
      );
    }
    return {
      id: data.id,
      customerId: data.subscriber?.payer_id ?? '',
      status: data.status,
      startsAt,
      nextBillingAt,
    };
  }

  private get paypalBaseUrl(): string {
    return this.env.billing.paypalEnvironment === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  private async paypalRequest<T = unknown>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.paypalBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    const body: T & { message?: string } = text
      ? (JSON.parse(text) as T & { message?: string })
      : ({} as T & { message?: string });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `PayPal request failed (${response.status}): ${body.message ?? 'provider error'}`,
      );
    }
    return body;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 30_000) {
      return this.accessToken.value;
    }
    const credentials = Buffer.from(
      `${this.env.billing.paypalClientId}:${this.env.billing.paypalClientSecret}`,
    ).toString('base64');
    const response = await fetch(`${this.paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!response.ok || !data.access_token) {
      throw new ServiceUnavailableException(
        'Could not authenticate with PayPal',
      );
    }
    this.accessToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 300) * 1000,
    };
    return data.access_token;
  }

  private paypalName(fullName: string): {
    given_name: string;
    surname: string;
  } {
    const parts = fullName.trim().split(/\s+/);
    return {
      given_name: parts.shift() ?? 'Owner',
      surname: parts.join(' ') || 'Company',
    };
  }

  private optionalDate(value?: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date;
  }
}
