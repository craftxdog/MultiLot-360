import { Global, Module } from '@nestjs/common';
import { IdentityAccessModule } from '../../modules/identity-access';
import { INTEGRATION_EVENT_PUBLISHER } from '../../shared-kernel';
import { RealtimeGateway } from './realtime.gateway';
import { SocketIoEventPublisher } from './socket-io-event-publisher';

@Global()
@Module({
  imports: [IdentityAccessModule],
  providers: [
    RealtimeGateway,
    SocketIoEventPublisher,
    {
      provide: INTEGRATION_EVENT_PUBLISHER,
      useExisting: SocketIoEventPublisher,
    },
  ],
  exports: [INTEGRATION_EVENT_PUBLISHER],
})
export class RealtimeModule {}
