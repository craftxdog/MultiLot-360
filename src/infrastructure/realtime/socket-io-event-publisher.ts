import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  IntegrationEventEnvelope,
  IntegrationEventInput,
  IntegrationEventPublisher,
} from '../../shared-kernel';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class SocketIoEventPublisher implements IntegrationEventPublisher {
  private readonly logger = new Logger(SocketIoEventPublisher.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  publish<TPayload>(event: IntegrationEventInput<TPayload>): void {
    const envelope: IntegrationEventEnvelope<TPayload> = {
      ...event,
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
  }
}
