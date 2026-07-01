import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { extractBearerToken } from '../../common';
import { EnvConfigService } from '../../config/env-config.service';
import {
  AccessTokenVerifierService,
  ResolveRequestIdentityUseCase,
} from '../../modules/identity-access/application';
import { IdentityUser } from '../../modules/identity-access/domain';
import { IntegrationEventEnvelope, isFailure } from '../../shared-kernel';
import { realtimeRoom, toAudienceRooms } from './realtime-room';

export const REALTIME_NAMESPACE = '/realtime';
export const REALTIME_READY_EVENT = 'realtime.ready';

type AuthenticatedSocketData = {
  identity?: IdentityUser;
};

type ServerToClientEvents = Record<string, (payload: unknown) => void>;

type AuthenticatedSocket = Socket<
  Record<string, never>,
  ServerToClientEvents,
  Record<string, never>,
  AuthenticatedSocketData
>;

type SocketMiddlewareNext = (error?: Error) => void;

@WebSocketGateway({ namespace: REALTIME_NAMESPACE })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private namespace?: Namespace;

  constructor(
    private readonly envConfig: EnvConfigService,
    private readonly accessTokenVerifier: AccessTokenVerifierService,
    private readonly resolveRequestIdentity: ResolveRequestIdentityUseCase,
  ) {}

  afterInit(namespace: Namespace): void {
    namespace.use((socket, next) => {
      void this.authenticate(socket as AuthenticatedSocket, next);
    });
    this.logger.log(`Realtime namespace ready at ${REALTIME_NAMESPACE}`);
  }

  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const identity = socket.data.identity;

    if (!identity) {
      socket.disconnect(true);
      return;
    }

    const rooms = this.roomsFor(identity);
    await socket.join(rooms);
    socket.emit(REALTIME_READY_EVENT, {
      protocolVersion: 1,
      userId: identity.id,
      roleName: identity.role.name,
      sellerId: identity.seller?.id ?? null,
      modules: identity.modules,
      serverTime: new Date().toISOString(),
    });

    this.logger.debug(
      `Realtime client connected userId=${identity.id} rooms=${rooms.length}`,
    );
  }

  handleDisconnect(socket: AuthenticatedSocket): void {
    const userId = socket.data.identity?.id ?? 'unknown';
    this.logger.debug(`Realtime client disconnected userId=${userId}`);
  }

  emit<TPayload>(event: IntegrationEventEnvelope<TPayload>): void {
    if (!this.envConfig.realtime.enabled || !this.namespace) return;

    const rooms = toAudienceRooms(event.audience);
    if (rooms.length === 0) {
      this.logger.warn(`Realtime event ${event.name} has no audience`);
      return;
    }

    this.namespace.to(rooms).emit(event.name, event);
  }

  private async authenticate(
    socket: AuthenticatedSocket,
    next: SocketMiddlewareNext,
  ): Promise<void> {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        next(this.authError('AUTH_REQUIRED', 'Bearer token is required'));
        return;
      }

      const claims = await this.accessTokenVerifier.verify(token);
      const result = await this.resolveRequestIdentity.execute(claims);

      if (isFailure(result)) {
        next(this.authError('AUTH_REJECTED', result.error.message));
        return;
      }

      socket.data.identity = result.value.user;
      next();
    } catch {
      next(this.authError('AUTH_REJECTED', 'Invalid or expired token'));
    }
  }

  private extractToken(socket: AuthenticatedSocket): string | undefined {
    const authToken: unknown = socket.handshake.auth?.token;

    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    return extractBearerToken({ headers: socket.handshake.headers });
  }

  private roomsFor(identity: IdentityUser): string[] {
    return [
      realtimeRoom.user(identity.id),
      realtimeRoom.role(identity.role.name),
      ...identity.modules.map(realtimeRoom.module),
      ...(identity.seller ? [realtimeRoom.seller(identity.seller.id)] : []),
    ];
  }

  private authError(code: string, message: string): Error {
    const error = new Error(message) as Error & {
      data?: { code: string };
    };
    error.data = { code };
    return error;
  }
}
