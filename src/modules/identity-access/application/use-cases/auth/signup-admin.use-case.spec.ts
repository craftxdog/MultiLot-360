import { EnvConfigService } from '../../../../../config/env-config.service';
import {
  AuthAccountRepository,
  AuthProviderPort,
  IdentityUser,
} from '../../../domain';
import { SignupAdminUseCase } from './signup-admin.use-case';

const identityUser: IdentityUser = {
  id: 'user-id',
  authUserId: 'auth-user-id',
  username: 'admin',
  name: 'Admin',
  active: true,
  role: {
    id: 'role-id',
    name: 'admin',
  },
  modules: ['usuarios'],
  permissions: ['usuarios.create'],
};

describe('SignupAdminUseCase', () => {
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
  const envConfig = {
    auth: {
      signupEnabled: true,
      adminRoleName: 'admin',
    },
  } as EnvConfigService;
  let useCase: SignupAdminUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    authProvider.createUser.mockResolvedValue({
      id: 'auth-user-id',
      email: 'admin@example.com',
    });
    authProvider.signInWithPassword.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      tokenType: 'bearer',
      authUserId: 'auth-user-id',
    });
    authAccountRepository.createInternalUser.mockResolvedValue(identityUser);
    useCase = new SignupAdminUseCase(
      authProvider,
      authAccountRepository,
      envConfig,
    );
  });

  it('creates a Supabase user and an internal admin user', async () => {
    const result = await useCase.execute({
      email: 'ADMIN@example.com',
      username: 'ADMIN',
      password: 'Sup3rSecret2026!',
      name: 'Admin',
    });

    expect(result.isSuccess).toBe(true);
    expect(authProvider.createUser.mock.calls[0][0]).toMatchObject({
      email: 'admin@example.com',
      emailConfirmed: true,
    });
    expect(authAccountRepository.createInternalUser.mock.calls[0][0]).toEqual({
      authUserId: 'auth-user-id',
      email: 'admin@example.com',
      username: 'admin',
      name: 'Admin',
      roleName: 'admin',
    });
  });

  it('cleans the Supabase user when internal creation fails', async () => {
    authAccountRepository.createInternalUser.mockRejectedValue(
      new Error('role missing'),
    );

    const result = await useCase.execute({
      email: 'admin@example.com',
      username: 'admin',
      password: 'Sup3rSecret2026!',
      name: 'Admin',
    });

    expect(result.isFailure).toBe(true);
    expect(authProvider.deleteUser.mock.calls[0][0]).toBe('auth-user-id');
  });
});
