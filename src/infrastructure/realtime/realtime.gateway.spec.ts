import { Namespace } from 'socket.io';
import { EnvConfigService } from '../../config/env-config.service';
import {
  AccessTokenVerifierService,
  ResolveRequestIdentityUseCase,
} from '../../modules/identity-access/application';
import { IdentityUser } from '../../modules/identity-access/domain';
import { OPERATIONAL_EVENTS, Result } from '../../shared-kernel';
import { REALTIME_READY_EVENT, RealtimeGateway } from './realtime.gateway';

type GatewaySocket = Parameters<RealtimeGateway['handleConnection']>[0];
type NamespaceMiddleware = (
  socket: GatewaySocket,
  next: (error?: Error) => void,
) => void;

const identity: IdentityUser = {
  id: 'user-id',
  authUserId: 'auth-user-id',
  username: 'seller.01',
  active: true,
  role: { id: 'role-id', name: 'VENDEDOR' },
  modules: ['ventas', 'turnos'],
  permissions: ['ventas.read', 'ventas.create', 'turnos.read'],
  seller: {
    id: 'seller-id',
    userId: 'user-id',
    name: 'Seller One',
    active: true,
  },
};

describe('RealtimeGateway', () => {
  let middleware: NamespaceMiddleware;
  let verifier: jest.Mocked<Pick<AccessTokenVerifierService, 'verify'>>;
  let resolver: jest.Mocked<Pick<ResolveRequestIdentityUseCase, 'execute'>>;
  let gateway: RealtimeGateway;

  beforeEach(() => {
    verifier = { verify: jest.fn() };
    resolver = { execute: jest.fn() };
    gateway = new RealtimeGateway(
      {
        realtime: { enabled: true },
      } as unknown as EnvConfigService,
      verifier as unknown as AccessTokenVerifierService,
      resolver as unknown as ResolveRequestIdentityUseCase,
    );
    const namespace = {
      use: jest.fn((registered: NamespaceMiddleware) => {
        middleware = registered;
      }),
    } as unknown as Namespace;

    gateway.afterInit(namespace);
  });

  it('rejects connections without a bearer token', async () => {
    const { socket } = createSocket();
    const error = await runMiddleware(socket);

    expect(error?.message).toBe('Bearer token is required');
    expect((error as Error & { data?: { code: string } }).data?.code).toBe(
      'AUTH_REQUIRED',
    );
  });

  it('authenticates with Supabase and joins authorization rooms', async () => {
    verifier.verify.mockResolvedValue({ sub: 'auth-user-id' });
    resolver.execute.mockResolvedValue(
      Result.success({ claims: { sub: 'auth-user-id' }, user: identity }),
    );
    const { socket, join, emit } = createSocket('valid-token');

    await expect(runMiddleware(socket)).resolves.toBeUndefined();
    await gateway.handleConnection(socket);

    expect(verifier.verify.mock.calls[0][0]).toBe('valid-token');
    expect(join).toHaveBeenCalledWith([
      'user:user-id',
      'role:vendedor',
      'module:ventas',
      'module:turnos',
      'seller:seller-id',
    ]);
    expect(emit).toHaveBeenCalledWith(
      REALTIME_READY_EVENT,
      expect.objectContaining({
        protocolVersion: 1,
        userId: 'user-id',
        sellerId: 'seller-id',
      }),
    );
  });

  it('emits only to the rooms declared by the event audience', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    Object.defineProperty(gateway, 'namespace', {
      value: { to },
    });

    gateway.emit({
      id: 'event-id',
      name: OPERATIONAL_EVENTS.saleCreated,
      aggregateId: 'sale-id',
      occurredAt: '2026-06-30T10:00:00.000Z',
      version: 1,
      audience: {
        modules: ['ventas'],
        sellerIds: ['seller-id'],
      },
      payload: { saleId: 'sale-id' },
    });

    expect(to).toHaveBeenCalledWith(['module:ventas', 'seller:seller-id']);
    expect(emit).toHaveBeenCalledWith(
      OPERATIONAL_EVENTS.saleCreated,
      expect.objectContaining({ id: 'event-id' }),
    );
  });

  function createSocket(token?: string) {
    const join = jest.fn().mockResolvedValue(undefined);
    const emit = jest.fn();
    const disconnect = jest.fn();
    const socket = {
      data: {},
      handshake: {
        auth: token ? { token } : {},
        headers: {},
      },
      join,
      emit,
      disconnect,
    } as unknown as GatewaySocket;

    return { socket, join, emit, disconnect };
  }

  function runMiddleware(socket: GatewaySocket): Promise<Error | undefined> {
    return new Promise((resolve) => middleware(socket, resolve));
  }
});
