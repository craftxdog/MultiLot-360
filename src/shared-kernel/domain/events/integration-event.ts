export const INTEGRATION_EVENT_PUBLISHER = Symbol(
  'INTEGRATION_EVENT_PUBLISHER',
);

export type IntegrationEventAudience = {
  modules?: string[];
  roles?: string[];
  sellerIds?: string[];
  userIds?: string[];
};

export type IntegrationEventInput<TPayload = unknown> = {
  name: OperationalEventName;
  aggregateId?: string;
  audience: IntegrationEventAudience;
  payload: TPayload;
};

export type IntegrationEventEnvelope<TPayload = unknown> =
  IntegrationEventInput<TPayload> & {
    id: string;
    occurredAt: string;
    version: 1;
  };

export interface IntegrationEventPublisher {
  publish<TPayload>(event: IntegrationEventInput<TPayload>): void;
}

export const OPERATIONAL_EVENTS = {
  drawConfigurationCreated: 'draws.configuration.created',
  drawConfigurationUpdated: 'draws.configuration.updated',
  drawShiftOpened: 'draws.shift.opened',
  drawShiftBlocked: 'draws.shift.blocked',
  drawShiftReopened: 'draws.shift.reopened',
  drawShiftClosed: 'draws.shift.closed',
  numberLimitsCreated: 'number-limits.created',
  numberLimitUpdated: 'number-limits.updated',
  numberLimitExpired: 'number-limits.expired',
  blockedNumbersCreated: 'blocked-numbers.created',
  blockedNumberDeleted: 'blocked-numbers.deleted',
  saleCreated: 'sales.created',
  saleVoided: 'sales.voided',
  salesVoidPolicyUpdated: 'sales.void-policy.updated',
  resultCreated: 'results.created',
  prizePaid: 'prize-payments.paid',
  cashCutCreated: 'cash-cuts.created',
  systemParameterUpdated: 'parameters.updated',
} as const;

export type OperationalEventName =
  (typeof OPERATIONAL_EVENTS)[keyof typeof OPERATIONAL_EVENTS];

export const operationalAudience = {
  draws: (): IntegrationEventAudience => ({
    modules: ['sorteos', 'turnos'],
    roles: ['VENDEDOR'],
  }),
  numberLimits: (sellerId?: string): IntegrationEventAudience => ({
    modules: ['limites_numero'],
    ...(sellerId ? { sellerIds: [sellerId] } : { roles: ['VENDEDOR'] }),
  }),
  blockedNumbers: (): IntegrationEventAudience => ({
    modules: ['numeros_bloqueados'],
    roles: ['VENDEDOR'],
  }),
  sales: (sellerId: string): IntegrationEventAudience => ({
    modules: ['ventas'],
    sellerIds: [sellerId],
  }),
  salesPolicy: (): IntegrationEventAudience => ({
    modules: ['ventas', 'parametros'],
    roles: ['VENDEDOR'],
  }),
  results: (): IntegrationEventAudience => ({
    modules: ['resultados'],
    roles: ['VENDEDOR'],
  }),
  prizePayments: (sellerId: string): IntegrationEventAudience => ({
    modules: ['pagos_premios'],
    sellerIds: [sellerId],
  }),
  cashCuts: (visibleToSellers: boolean): IntegrationEventAudience => ({
    modules: ['cortes'],
    ...(visibleToSellers && { roles: ['VENDEDOR'] }),
  }),
  parameters: (): IntegrationEventAudience => ({
    modules: ['parametros'],
  }),
};
