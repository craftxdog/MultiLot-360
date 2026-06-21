import { AuthProviderPort } from '../../domain';
import { AccessTokenVerifierService } from './access-token-verifier.service';

describe('AccessTokenVerifierService', () => {
  const authProvider: jest.Mocked<AuthProviderPort> = {
    createUser: jest.fn(),
    deleteUser: jest.fn(),
    signInWithPassword: jest.fn(),
    refreshSession: jest.fn(),
    signOut: jest.fn(),
    verifyAccessToken: jest.fn(),
  };

  let service: AccessTokenVerifierService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccessTokenVerifierService(authProvider);
  });

  it('returns the verified token payload', async () => {
    authProvider.verifyAccessToken.mockResolvedValue({
      sub: 'auth-user-id',
      email: 'admin@example.com',
      role: 'authenticated',
    });

    await expect(service.verify('access-token')).resolves.toMatchObject({
      sub: 'auth-user-id',
      email: 'admin@example.com',
    });
  });

  it('normalizes provider verification failures', async () => {
    authProvider.verifyAccessToken.mockRejectedValue(new Error('jwt expired'));

    await expect(service.verify('bad-token')).rejects.toThrow(
      'Invalid or expired token',
    );
  });
});
