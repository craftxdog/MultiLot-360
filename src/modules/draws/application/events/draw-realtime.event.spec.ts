import {
  IntegrationEventPublisher,
  IntegrationEventInput,
  OPERATIONAL_EVENTS,
} from '../../../../shared-kernel';
import { DrawConfiguration, DrawShift } from '../../domain';
import {
  publishDrawConfigurationEvent,
  publishDrawShiftEvent,
} from './draw-realtime.event';

describe('Draw realtime events', () => {
  const configuration: DrawConfiguration = {
    id: 'configuration-id',
    code: '11',
    time: '11:00:00',
    tuesdayOnly: false,
    lockSecondsBefore: 300,
    reopenSecondsAfter: 60,
    active: true,
    createdAt: new Date('2026-06-22T08:00:00.000Z'),
    updatedAt: new Date('2026-06-22T08:00:00.000Z'),
  };

  const createEventPublisher = () => {
    const events: IntegrationEventInput[] = [];
    const publisher: IntegrationEventPublisher = {
      publish: (event) => events.push(event),
    };
    return { events, publisher };
  };

  it('publishes a configuration event for draw subscribers', () => {
    const { events, publisher } = createEventPublisher();

    publishDrawConfigurationEvent(
      publisher,
      OPERATIONAL_EVENTS.drawConfigurationUpdated,
      configuration,
    );

    expect(events[0]).toMatchObject({
      name: OPERATIONAL_EVENTS.drawConfigurationUpdated,
      aggregateId: 'configuration-id',
      audience: {
        modules: ['sorteos', 'turnos'],
        roles: ['VENDEDOR'],
      },
    });
  });

  it('publishes a shift event with its current status', () => {
    const { events, publisher } = createEventPublisher();
    const shift: DrawShift = {
      id: 'shift-id',
      configuration,
      date: '2026-06-22',
      status: 'ABIERTO',
      createdAt: new Date('2026-06-22T08:00:00.000Z'),
      updatedAt: new Date('2026-06-22T08:00:00.000Z'),
    };

    publishDrawShiftEvent(publisher, OPERATIONAL_EVENTS.drawShiftOpened, shift);

    expect(events[0]).toMatchObject({
      name: OPERATIONAL_EVENTS.drawShiftOpened,
      aggregateId: 'shift-id',
      payload: {
        shiftId: 'shift-id',
        drawCode: '11',
        status: 'ABIERTO',
      },
    });
  });
});
