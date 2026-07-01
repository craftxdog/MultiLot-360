import {
  IntegrationEventPublisher,
  OperationalEventName,
  operationalAudience,
} from '../../../../shared-kernel';
import { DrawConfiguration, DrawShift } from '../../domain';

export const publishDrawConfigurationEvent = (
  publisher: IntegrationEventPublisher | undefined,
  name: OperationalEventName,
  configuration: DrawConfiguration,
): void => {
  publisher?.publish({
    name,
    aggregateId: configuration.id,
    audience: operationalAudience.draws(),
    payload: {
      configurationId: configuration.id,
      code: configuration.code,
      active: configuration.active,
    },
  });
};

export const publishDrawShiftEvent = (
  publisher: IntegrationEventPublisher | undefined,
  name: OperationalEventName,
  shift: DrawShift,
): void => {
  publisher?.publish({
    name,
    aggregateId: shift.id,
    audience: operationalAudience.draws(),
    payload: {
      shiftId: shift.id,
      configurationId: shift.configuration.id,
      drawCode: shift.configuration.code,
      date: shift.date,
      status: shift.status,
    },
  });
};
