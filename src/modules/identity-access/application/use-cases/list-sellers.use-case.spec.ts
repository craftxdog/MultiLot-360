import { SellerOnboardingRepository } from '../../domain';
import { ListSellersUseCase } from './list-sellers.use-case';

describe('ListSellersUseCase', () => {
  it('delegates filters and returns paginated sellers', async () => {
    const listSellers = jest.fn().mockResolvedValue({
      items: [
        {
          id: 'seller-id',
          userId: 'user-id',
          username: 'seller@example.com',
          userName: 'Seller',
          roleId: 'role-id',
          roleName: 'vendedor',
          name: 'Seller',
          documentId: '001',
          phone: null,
          address: null,
          active: true,
          userActive: true,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          updatedAt: new Date('2026-07-01T00:00:00.000Z'),
        },
      ],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
    const repository = {
      listSellers,
    } as unknown as jest.Mocked<SellerOnboardingRepository>;
    const useCase = new ListSellersUseCase(repository);
    const query = {
      search: 'sell',
      active: true,
      page: 1,
      limit: 25,
      sortBy: 'name',
      sortDirection: 'asc' as const,
    };

    const result = await useCase.execute(query);

    expect(result.isSuccess).toBe(true);
    expect(listSellers).toHaveBeenCalledWith(query);
    if (result.isFailure) throw result.error;
    expect(result.value.items).toHaveLength(1);
  });
});
