import {
  AuthAccountRepository,
  AuthProviderPort,
  IdentityUser,
} from '../../../domain';
import { LoginUseCase } from './login.use-case';

const identityUser: IdentityUser = {
  id: 'user-id',
  authUserId: 'auth-user-id',
  username: 'admin@example.com',
  name: 'Admin',
  active: true,
  role: {
    id: 'role-id',
    name: 'admin',
  },
  modules: ['vendedores'],
  permissions: ['vendedores.create'],
};

describe('LoginUseCase', () => {
  const authProvider: jest.Mocked<AuthProviderPort> = {
    createUser: jest.fn(),
    deleteUser: jest.fn(),
    signInWithPassword: jest.fn(),
    refreshSession: jest.fn(),
    signOut: jest.fn(),
    verifyAccessToken: jest.fn(),
  };
  const authAccountRepository: jest.Mocked<AuthAccountRepository> = {
    createInternalUser: jest.fn(),
    findByAuthUserId: jest.fn(),
  };
  let useCase: LoginUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    authProvider.signInWithPassword.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      tokenType: 'bearer',
      authUserId: 'auth-user-id',
    });
    authAccountRepository.findByAuthUserId.mockResolvedValue(identityUser);
    useCase = new LoginUseCase(authProvider, authAccountRepository);
  });

  it('returns a session for an active internal user', async () => {
    const result = await useCase.execute({
      email: 'ADMIN@example.com',
      password: 'Sup3rSecret2026!',
    });

    expect(result.isSuccess).toBe(true);
    expect(authProvider.signInWithPassword.mock.calls[0][0]).toEqual({
      email: 'admin@example.com',
      password: 'Sup3rSecret2026!',
    });
  });

  it('fails when the Supabase user is not linked internally', async () => {
    authAccountRepository.findByAuthUserId.mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'admin@example.com',
      password: 'Sup3rSecret2026!',
    });

    expect(result.isFailure).toBe(true);
  });
});
