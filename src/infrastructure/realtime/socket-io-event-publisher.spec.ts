import {
  IntegrationEventEnvelope,
  OPERATIONAL_EVENTS,
} from '../../shared-kernel';
import { RealtimeGateway } from './realtime.gateway';
import { SocketIoEventPublisher } from './socket-io-event-publisher';
import { NotificationProjector } from '../../modules/notifications/domain';

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

  it('projects persistent notifications and emits them to the recipient room', async () => {
    const emit = jest.fn();
    const project = jest.fn().mockResolvedValue([
      {
        id: 'notification-id',
        userId: 'user-id',
        type: 'draws.shift.opened',
        title: 'Turno disponible',
        message: 'Se abrió un turno.',
        data: null,
        readAt: null,
        createdAt: new Date('2026-07-06T00:00:00.000Z'),
      },
    ]);
    const gateway = { emit } as unknown as RealtimeGateway;
    const projector = {
      project,
    } as jest.Mocked<NotificationProjector>;
    const publisher = new SocketIoEventPublisher(gateway, projector);

    publisher.publish({
      name: OPERATIONAL_EVENTS.drawShiftOpened,
      aggregateId: 'shift-id',
      audience: { roles: ['VENDEDOR'] },
      payload: { shiftId: 'shift-id' },
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(project).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: OPERATIONAL_EVENTS.notificationCreated,
        aggregateId: 'notification-id',
        audience: { userIds: ['user-id'] },
      }),
    );
  });
});
