import { IntegrationEventEnvelope } from '../../../../shared-kernel';
import { Notification } from '../entities';

export const NOTIFICATION_PROJECTOR = Symbol('NOTIFICATION_PROJECTOR');

export interface NotificationProjector {
  project(event: IntegrationEventEnvelope): Promise<Notification[]>;
}
