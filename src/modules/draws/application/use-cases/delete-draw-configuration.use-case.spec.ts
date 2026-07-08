import { AuthProviderPort } from '../../../identity-access/domain';
import { DrawsRepository } from '../../domain';
import {
  HardDeleteDrawConfigurationUseCase,
  SoftDeleteDrawConfigurationUseCase,
} from './delete-draw-configuration.use-case';

describe('Delete draw configuration use cases', () => {
  const repository: jest.Mocked<DrawsRepository> = {
    createConfiguration: jest.fn(),
    findConfigurationById: jest.fn(),
    updateConfiguration: jest.fn(),
    getConfigurationDeleteImpact: jest.fn(),
    softDeleteConfiguration: jest.fn(),
    hardDeleteConfiguration: jest.fn(),
    listConfigurations: jest.fn(),
    autoGenerateShifts: jest.fn(),
    openShift: jest.fn(),
    blockShift: jest.fn(),
    reopenShift: jest.fn(),
    closeShift: jest.fn(),
    listShifts: jest.fn(),
    listActiveShifts: jest.fn(),
  };

  const authProvider: jest.Mocked<AuthProviderPort> = {
    createUser: jest.fn(),
    deleteUser: jest.fn(),
    signInWithPassword: jest.fn(),
    refreshSession: jest.fn(),
    signOut: jest.fn(),
    generatePasswordRecoveryCode: jest.fn(),
    resetPasswordWithRecoveryCode: jest.fn(),
    adminResetPassword: jest.fn(),
    verifyAccessToken: jest.fn(),
  };

  const impact = {
    configurationId: 'configuration-id',
    code: 'nacional-11am',
    active: false,
    deletedAt: new Date('2026-07-07T08:00:00.000Z'),
    counts: {
      shifts: 2,
      sales: 10,
      saleDetails: 15,
      results: 1,
      prizePayments: 1,
      blockedNumbers: 1,
      numberLimits: 1,
    },
    requiresConfirmation: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.softDeleteConfiguration.mockResolvedValue({
      configurationId: 'configuration-id',
      mode: 'SOFT',
      deleted: true,
      impact,
    });
    repository.hardDeleteConfiguration.mockResolvedValue({
      configurationId: 'configuration-id',
      mode: 'HARD',
      deleted: true,
      impact,
    });
    authProvider.signInWithPassword.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      tokenType: 'bearer',
      authUserId: 'auth-user-id',
    });
  });

  it('soft-deletes a draw configuration without removing its historical data', async () => {
    const useCase = new SoftDeleteDrawConfigurationUseCase(repository);

    const result = await useCase.execute({
      configurationId: 'configuration-id',
      reason: 'Duplicated setup',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.softDeleteConfiguration.mock.calls[0][0]).toEqual({
      configurationId: 'configuration-id',
      reason: 'Duplicated setup',
    });
  });

  it('hard-deletes only after admin password reauthentication and confirmation phrase', async () => {
    const useCase = new HardDeleteDrawConfigurationUseCase(
      repository,
      authProvider,
    );

    const result = await useCase.execute({
      configurationId: 'configuration-id',
      reason: 'Test cleanup',
      adminPassword: 'secure-password',
      actorEmail: 'admin@example.com',
      actorAuthUserId: 'auth-user-id',
      confirmation: 'DELETE_DRAW_CONFIGURATION',
    });

    expect(result.isSuccess).toBe(true);
    expect(authProvider.signInWithPassword.mock.calls[0][0]).toEqual({
      email: 'admin@example.com',
      password: 'secure-password',
    });
    expect(repository.hardDeleteConfiguration.mock.calls[0][0]).toEqual({
      configurationId: 'configuration-id',
      reason: 'Test cleanup',
    });
  });

  it('rejects hard delete when the reauthenticated admin is not the current session', async () => {
    authProvider.signInWithPassword.mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      tokenType: 'bearer',
      authUserId: 'different-auth-user-id',
    });
    const useCase = new HardDeleteDrawConfigurationUseCase(
      repository,
      authProvider,
    );

    const result = await useCase.execute({
      configurationId: 'configuration-id',
      adminPassword: 'secure-password',
      actorEmail: 'admin@example.com',
      actorAuthUserId: 'auth-user-id',
      confirmation: 'DELETE_DRAW_CONFIGURATION',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(403);
    expect(repository.hardDeleteConfiguration.mock.calls).toHaveLength(0);
  });
});
