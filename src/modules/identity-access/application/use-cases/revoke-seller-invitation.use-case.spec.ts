import { SellerOnboardingRepository } from '../../domain';
import { RevokeSellerInvitationUseCase } from './revoke-seller-invitation.use-case';

describe('RevokeSellerInvitationUseCase', () => {
  const repository: jest.Mocked<SellerOnboardingRepository> = {
    listInvitations: jest.fn(),
    createInvitation: jest.fn(),
    resendAccessCode: jest.fn(),
    revokeInvitation: jest.fn(),
    findPendingAccessCode: jest.fn(),
    confirmAccessCode: jest.fn(),
  };

  let useCase: RevokeSellerInvitationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.revokeInvitation.mockResolvedValue({
      id: 'invitation-id',
      userId: 'user-id',
      sellerId: 'seller-id',
      email: 'seller@example.com',
      sellerName: 'Seller',
      status: 'REVOCADO',
    });
    useCase = new RevokeSellerInvitationUseCase(repository);
  });

  it('revokes a pending seller invitation', async () => {
    const result = await useCase.execute({
      invitationId: 'invitation-id',
      adminUserId: 'admin-id',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.revokeInvitation.mock.calls[0][0]).toEqual({
      invitationId: 'invitation-id',
      adminUserId: 'admin-id',
    });
  });

  it('fails when the invitation cannot be revoked', async () => {
    repository.revokeInvitation.mockResolvedValue(null);

    const result = await useCase.execute({
      invitationId: 'missing-id',
    });

    expect(result.isFailure).toBe(true);
  });
});
