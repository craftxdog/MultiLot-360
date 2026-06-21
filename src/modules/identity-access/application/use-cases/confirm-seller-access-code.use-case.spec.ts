import { AuthProviderPort, SellerOnboardingRepository } from '../../domain';
import { SellerAccessCodeService } from '../services';
import { ConfirmSellerAccessCodeUseCase } from './confirm-seller-access-code.use-case';

describe('ConfirmSellerAccessCodeUseCase', () => {
  const repository: jest.Mocked<SellerOnboardingRepository> = {
    listInvitations: jest.fn(),
    createInvitation: jest.fn(),
    resendAccessCode: jest.fn(),
    findPendingAccessCode: jest.fn(),
    confirmAccessCode: jest.fn(),
  };
  const authProvider: jest.Mocked<AuthProviderPort> = {
    createUser: jest.fn(),
    deleteUser: jest.fn(),
    signInWithPassword: jest.fn(),
    refreshSession: jest.fn(),
    signOut: jest.fn(),
    verifyAccessToken: jest.fn(),
  };
  const accessCodeService = {
    hash: jest.fn(),
  } as unknown as jest.Mocked<SellerAccessCodeService>;
  let useCase: ConfirmSellerAccessCodeUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    accessCodeService.hash.mockReturnValue('hashed-code');
    authProvider.createUser.mockResolvedValue({
      id: 'auth-user-id',
      email: 'seller@example.com',
    });
    useCase = new ConfirmSellerAccessCodeUseCase(
      repository,
      authProvider,
      accessCodeService,
    );
  });

  it('fails when the code is invalid or expired', async () => {
    repository.findPendingAccessCode.mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'seller@example.com',
      accessCode: '123456',
      password: 'Sup3rSecret2026!',
    });

    expect(result.isFailure).toBe(true);
    expect(authProvider.createUser.mock.calls).toHaveLength(0);
  });

  it('creates the auth user and returns confirmed seller access', async () => {
    repository.findPendingAccessCode.mockResolvedValue({
      userId: 'user-id',
      sellerId: 'seller-id',
      email: 'seller@example.com',
      sellerName: 'Seller',
    });
    repository.confirmAccessCode.mockResolvedValue({
      userId: 'user-id',
      sellerId: 'seller-id',
      email: 'seller@example.com',
    });

    const result = await useCase.execute({
      email: 'seller@example.com',
      accessCode: '123456',
      password: 'Sup3rSecret2026!',
    });

    expect(result.isSuccess).toBe(true);
    expect(authProvider.createUser.mock.calls[0][0]).toMatchObject({
      email: 'seller@example.com',
      password: 'Sup3rSecret2026!',
      emailConfirmed: true,
    });
    expect(repository.confirmAccessCode.mock.calls[0][0]).toEqual({
      email: 'seller@example.com',
      accessCodeHash: 'hashed-code',
      authUserId: 'auth-user-id',
    });
  });
});
