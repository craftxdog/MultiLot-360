import {
  IntegrationEventEnvelope,
  OPERATIONAL_EVENTS,
} from '../../shared-kernel';
import { RealtimeGateway } from './realtime.gateway';
import { SocketIoEventPublisher } from './socket-io-event-publisher';

describe('SocketIoEventPublisher', () => {
  it('adds protocol metadata and delegates the event to the gateway', () => {
    const emit = jest.fn<
      void,
      [IntegrationEventEnvelope<{ saleId: string }>]
    >();
    const gateway = {
      emit,
    } as unknown as RealtimeGateway;
    const publisher = new SocketIoEventPublisher(gateway);

    publisher.publish({
      name: OPERATIONAL_EVENTS.saleCreated,
      aggregateId: 'sale-id',
      audience: { sellerIds: ['seller-id'] },
      payload: { saleId: 'sale-id' },
    });

    const envelope = emit.mock.calls[0][0];

    expect(envelope).toMatchObject({
      name: OPERATIONAL_EVENTS.saleCreated,
      aggregateId: 'sale-id',
      version: 1,
      audience: { sellerIds: ['seller-id'] },
      payload: { saleId: 'sale-id' },
    });
    expect(typeof envelope.id).toBe('string');
    expect(Number.isNaN(Date.parse(envelope.occurredAt))).toBe(false);
  });
});
