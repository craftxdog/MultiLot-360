import { PaginatedResult } from '../../../../shared-kernel';
import { Sale } from '../../domain/entities';
import { SalesRepository } from '../../domain/ports';
import { CreateSaleUseCase } from './create-sale.use-case';
import { GetSaleUseCase } from './get-sale.use-case';
import { ListSalesUseCase } from './list-sales.use-case';
import { VoidSaleUseCase } from './void-sale.use-case';

const createSale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 'sale-id',
  seller: {
    id: 'seller-id',
    name: 'Carlos Lopez',
  },
  shift: {
    id: 'shift-id',
    date: '2026-06-22',
    status: 'ABIERTO',
    configuration: {
      id: 'configuration-id',
      code: 'nacional-11am',
      time: '11:00:00',
    },
  },
  status: 'ACTIVA',
  totalMiles: 40,
  details: [
    {
      id: 'detail-id',
      number: '02',
      prizeMiles: 40,
      createdAt: new Date('2026-06-22T08:00:00.000Z'),
    },
  ],
  createdAt: new Date('2026-06-22T08:00:00.000Z'),
  voidedByUserId: null,
  voidedAt: null,
  voidReason: null,
  ...overrides,
});

const createRepository = (): jest.Mocked<SalesRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  list: jest.fn(),
  void: jest.fn(),
});

describe('Sales use cases', () => {
  let repository: jest.Mocked<SalesRepository>;

  beforeEach(() => {
    repository = createRepository();
  });

  it('creates a seller sale and aggregates duplicated numbers', async () => {
    repository.create.mockResolvedValue(createSale());
    const useCase = new CreateSaleUseCase(repository);

    const result = await useCase.execute({
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
      shiftId: 'shift-id',
      items: [
        { number: '2', prizeMiles: 20 },
        { number: '02', prizeMiles: 20 },
        { number: '15', prizeMiles: 10 },
      ],
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.create.mock.calls[0][0]).toEqual({
      sellerId: 'seller-id',
      shiftId: 'shift-id',
      items: [
        { number: '02', prizeMiles: 40 },
        { number: '15', prizeMiles: 10 },
      ],
    });
  });

  it('prevents a seller from creating sales for another seller', async () => {
    const useCase = new CreateSaleUseCase(repository);

    const result = await useCase.execute({
      requestedSellerId: 'other-seller-id',
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
      shiftId: 'shift-id',
      items: [{ number: '02', prizeMiles: 20 }],
    });

    expect(result.isFailure).toBe(true);
    expect(repository.create.mock.calls).toHaveLength(0);
  });

  it('allows an admin to create a sale for a selected seller', async () => {
    repository.create.mockResolvedValue(createSale());
    const useCase = new CreateSaleUseCase(repository);

    const result = await useCase.execute({
      requestedSellerId: 'seller-id',
      actorRoleName: 'ADMIN',
      shiftId: 'shift-id',
      items: [{ number: '02', prizeMiles: 20 }],
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.create.mock.calls[0][0].sellerId).toBe('seller-id');
  });

  it('forces non-admin list queries to the current seller', async () => {
    const paginatedResult: PaginatedResult<Sale> = {
      items: [],
      pagination: {
        strategy: 'offset',
        page: 1,
        limit: 25,
        count: 0,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        sortBy: 'createdAt',
        sortDirection: 'desc',
      },
    };
    repository.list.mockResolvedValue(paginatedResult);
    const useCase = new ListSalesUseCase(repository);

    const result = await useCase.execute({
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
      page: 1,
      limit: 25,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.list.mock.calls[0][0]).toMatchObject({
      sellerId: 'seller-id',
    });
  });

  it('prevents a seller from reading another seller sale', async () => {
    repository.findById.mockResolvedValue(
      createSale({
        seller: {
          id: 'other-seller-id',
          name: 'Other Seller',
        },
      }),
    );
    const useCase = new GetSaleUseCase(repository);

    const result = await useCase.execute({
      saleId: 'sale-id',
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
    });

    expect(result.isFailure).toBe(true);
  });

  it('voids an active sale', async () => {
    repository.findById.mockResolvedValue(createSale());
    repository.void.mockResolvedValue(
      createSale({
        status: 'ANULADA',
        voidedByUserId: 'user-id',
        voidReason: 'Cliente solicito anulacion',
      }),
    );
    const useCase = new VoidSaleUseCase(repository);

    const result = await useCase.execute({
      saleId: 'sale-id',
      voidedByUserId: 'user-id',
      reason: 'Cliente solicito anulacion',
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.void.mock.calls[0][0]).toEqual({
      saleId: 'sale-id',
      voidedByUserId: 'user-id',
      reason: 'Cliente solicito anulacion',
    });
  });

  it('does not void an already voided sale', async () => {
    repository.findById.mockResolvedValue(createSale({ status: 'ANULADA' }));
    const useCase = new VoidSaleUseCase(repository);

    const result = await useCase.execute({
      saleId: 'sale-id',
      voidedByUserId: 'user-id',
      reason: 'Duplicada',
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
    });

    expect(result.isFailure).toBe(true);
    expect(repository.void.mock.calls).toHaveLength(0);
  });
});
