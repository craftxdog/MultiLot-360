import { AuthProviderPort, SellerOnboardingRepository } from '../../domain';
import { DeleteSellerUseCase } from './delete-seller.use-case';

const target = {
  sellerId: 'seller-id',
  userId: 'seller-user-id',
  username: 'seller@example.com',
  sellerName: 'Seller Demo',
  authUserId: 'auth-user-id',
};

const deletionResult = {
  ...target,
  mode: 'soft' as const,
  authUserDeleted: false,
  deletedAt: new Date('2026-07-06T00:00:00.000Z'),
};

const createRepository = (): jest.Mocked<SellerOnboardingRepository> =>
  ({
    findDeletionTarget: jest.fn(),
    softDeleteSeller: jest.fn(),
    hardDeleteSeller: jest.fn(),
  }) as unknown as jest.Mocked<SellerOnboardingRepository>;

const createAuthProvider = (): jest.Mocked<AuthProviderPort> =>
  ({
    deleteUser: jest.fn(),
  }) as unknown as jest.Mocked<AuthProviderPort>;

describe('DeleteSellerUseCase', () => {
  let repository: jest.Mocked<SellerOnboardingRepository>;
  let authProvider: jest.Mocked<AuthProviderPort>;
  let useCase: DeleteSellerUseCase;

  beforeEach(() => {
    repository = createRepository();
    authProvider = createAuthProvider();
    useCase = new DeleteSellerUseCase(repository, authProvider);
  });

  it('soft-deletes a seller without deleting Supabase Auth', async () => {
    repository.findDeletionTarget.mockResolvedValue(target);
    repository.softDeleteSeller.mockResolvedValue(deletionResult);

    const result = await useCase.execute({
      sellerId: target.sellerId,
      adminUserId: 'admin-user-id',
      reason: 'Baja administrativa',
    });

    expect(result.isSuccess).toBe(true);
    expect(authProvider.deleteUser.mock.calls).toHaveLength(0);
    expect(repository.softDeleteSeller.mock.calls[0][0]).toEqual({
      sellerId: target.sellerId,
      adminUserId: 'admin-user-id',
      reason: 'Baja administrativa',
    });
  });

  it('hard-deletes only tenant data and preserves the global Auth identity', async () => {
    repository.findDeletionTarget.mockResolvedValue(target);
    repository.hardDeleteSeller.mockResolvedValue({
      ...deletionResult,
      mode: 'hard',
      authUserDeleted: false,
    });

    const result = await useCase.execute({
      sellerId: target.sellerId,
      adminUserId: 'admin-user-id',
      hardDelete: true,
    });

    expect(result.isSuccess).toBe(true);
    expect(authProvider.deleteUser.mock.calls).toHaveLength(0);
    expect(repository.hardDeleteSeller.mock.calls[0][0]).toEqual({
      sellerId: target.sellerId,
      adminUserId: 'admin-user-id',
      reason: undefined,
      authUserDeleted: false,
    });
  });

  it('rejects self deletion', async () => {
    repository.findDeletionTarget.mockResolvedValue(target);

    const result = await useCase.execute({
      sellerId: target.sellerId,
      adminUserId: target.userId,
      hardDelete: true,
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(400);
    expect(authProvider.deleteUser.mock.calls).toHaveLength(0);
    expect(repository.hardDeleteSeller.mock.calls).toHaveLength(0);
  });

  it('returns 404 when the seller does not exist', async () => {
    repository.findDeletionTarget.mockResolvedValue(null);

    const result = await useCase.execute({
      sellerId: 'missing-seller-id',
      adminUserId: 'admin-user-id',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(404);
  });
});
