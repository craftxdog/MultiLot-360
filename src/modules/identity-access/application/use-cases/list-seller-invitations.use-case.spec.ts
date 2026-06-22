import { SellerOnboardingRepository } from '../../domain';
import { ListSellerInvitationsUseCase } from './list-seller-invitations.use-case';

describe('ListSellerInvitationsUseCase', () => {
  const repository: jest.Mocked<SellerOnboardingRepository> = {
    listInvitations: jest.fn(),
    createInvitation: jest.fn(),
    resendAccessCode: jest.fn(),
    revokeInvitation: jest.fn(),
    findPendingAccessCode: jest.fn(),
    confirmAccessCode: jest.fn(),
  };

  let useCase: ListSellerInvitationsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.listInvitations.mockResolvedValue({
      items: [
        {
          id: 'code-id',
          userId: 'user-id',
          sellerId: 'seller-id',
          email: 'seller@example.com',
          username: 'seller.01',
          sellerName: 'Seller One',
          documentId: '001-010190-0001A',
          status: 'PENDIENTE',
          expiresAt: new Date('2026-06-21T08:15:00.000Z'),
          usedAt: null,
          createdAt: new Date('2026-06-21T08:00:00.000Z'),
          createdBy: null,
        },
      ],
      pagination: {
        strategy: 'offset',
        page: 1,
        limit: 25,
        count: 1,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        sortBy: 'creado_en',
        sortDirection: 'desc',
      },
    });
    useCase = new ListSellerInvitationsUseCase(repository);
  });

  it('returns the paginated invitation read model', async () => {
    const result = await useCase.execute({
      page: 1,
      limit: 25,
      sortBy: 'creado_en',
      sortDirection: 'desc',
      status: 'PENDIENTE',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.listInvitations.mock.calls[0][0]).toMatchObject({
      page: 1,
      limit: 25,
      status: 'PENDIENTE',
    });
  });
});
