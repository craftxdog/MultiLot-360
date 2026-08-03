import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantExecutionContextService } from '../../common';
import {
  NOTIFICATION_PROJECTOR,
  NotificationProjector,
} from '../../modules/notifications/domain';
import {
  IntegrationEventEnvelope,
  IntegrationEventInput,
  IntegrationEventPublisher,
  OPERATIONAL_EVENTS,
} from '../../shared-kernel';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class SocketIoEventPublisher implements IntegrationEventPublisher {
  private readonly logger = new Logger(SocketIoEventPublisher.name);

  constructor(
    private readonly gateway: RealtimeGateway,
    @Optional()
    @Inject(NOTIFICATION_PROJECTOR)
    private readonly notificationProjector?: NotificationProjector,
    @Optional()
    private readonly tenantExecution?: TenantExecutionContextService,
  ) {}

  publish<TPayload>(event: IntegrationEventInput<TPayload>): void {
    const tenantId = event.audience.tenantId ?? this.tenantExecution?.get()?.id;
    if (!tenantId) {
      this.logger.warn(
        `Could not emit ${event.name}: tenant context is missing`,
      );
      return;
    }
    const envelope: IntegrationEventEnvelope<TPayload> = {
      ...event,
      audience: { ...event.audience, tenantId },
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      version: 1,
    };

    try {
      this.gateway.emit(envelope);
    } catch (error) {
      this.logger.warn(
        `Could not emit realtime event ${event.name}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    if (this.notificationProjector) {
      void this.notificationProjector
        .project(envelope)
        .then((notifications) => {
          for (const notification of notifications) {
            this.gateway.emit({
              id: randomUUID(),
              name: OPERATIONAL_EVENTS.notificationCreated,
              aggregateId: notification.id,
              audience: { tenantId, userIds: [notification.userId] },
              payload: notification,
              occurredAt: new Date().toISOString(),
              version: 1,
            });
          }
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `Could not project notifications for ${event.name}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        });
    }
  }
}
