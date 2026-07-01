import {
  IntegrationEventPublisher,
  IntegrationEventInput,
  OPERATIONAL_EVENTS,
  PaginatedResult,
} from '../../../../shared-kernel';
import { Sale } from '../../domain/entities';
import { SalesRepository } from '../../domain/ports';
import { CreateSaleUseCase } from './create-sale.use-case';
import { GetSaleUseCase } from './get-sale.use-case';
import { GetSalesVoidPolicyUseCase } from './get-sales-void-policy.use-case';
import { ListSalesUseCase } from './list-sales.use-case';
import { UpdateSalesVoidPolicyUseCase } from './update-sales-void-policy.use-case';
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
  getVoidPolicy: jest.fn(),
  list: jest.fn(),
  updateVoidPolicy: jest.fn(),
  void: jest.fn(),
});

const createEventPublisher = () => {
  const events: IntegrationEventInput[] = [];
  const publisher: IntegrationEventPublisher = {
    publish: (event) => events.push(event),
  };
  return { events, publisher };
};

describe('Sales use cases', () => {
  let repository: jest.Mocked<SalesRepository>;

  beforeEach(() => {
    repository = createRepository();
    repository.getVoidPolicy.mockResolvedValue({ windowMinutes: 10 });
  });

  it('creates a seller sale and aggregates duplicated numbers', async () => {
    const { events, publisher } = createEventPublisher();
    repository.create.mockResolvedValue(createSale());
    const useCase = new CreateSaleUseCase(repository, publisher);

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
    expect(events[0]).toMatchObject({
      name: OPERATIONAL_EVENTS.saleCreated,
      aggregateId: 'sale-id',
      audience: { sellerIds: ['seller-id'] },
      payload: {
        saleId: 'sale-id',
        sellerId: 'seller-id',
        numbers: ['02'],
      },
    });
  });

  it('creates a seller sale with several different numbers in the same ticket', async () => {
    repository.create.mockResolvedValue(
      createSale({
        totalMiles: 81,
        details: [
          {
            id: 'detail-20',
            number: '20',
            prizeMiles: 10,
            createdAt: new Date('2026-06-22T08:00:00.000Z'),
          },
          {
            id: 'detail-30',
            number: '30',
            prizeMiles: 40,
            createdAt: new Date('2026-06-22T08:00:00.000Z'),
          },
          {
            id: 'detail-50',
            number: '50',
            prizeMiles: 1,
            createdAt: new Date('2026-06-22T08:00:00.000Z'),
          },
          {
            id: 'detail-00',
            number: '00',
            prizeMiles: 30,
            createdAt: new Date('2026-06-22T08:00:00.000Z'),
          },
        ],
      }),
    );
    const useCase = new CreateSaleUseCase(repository);

    const result = await useCase.execute({
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
      shiftId: 'shift-id',
      items: [
        { number: '20', prizeMiles: 10 },
        { number: '30', prizeMiles: 40 },
        { number: '50', prizeMiles: 1 },
        { number: '00', prizeMiles: 30 },
      ],
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.create.mock.calls[0][0]).toEqual({
      sellerId: 'seller-id',
      shiftId: 'shift-id',
      items: [
        { number: '20', prizeMiles: 10 },
        { number: '30', prizeMiles: 40 },
        { number: '50', prizeMiles: 1 },
        { number: '00', prizeMiles: 30 },
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
    const { events, publisher } = createEventPublisher();
    repository.findById.mockResolvedValue(
      createSale({
        createdAt: new Date('2026-06-22T08:00:00.000Z'),
      }),
    );
    repository.void.mockResolvedValue(
      createSale({
        status: 'ANULADA',
        voidedByUserId: 'user-id',
        voidReason: 'Cliente solicito anulacion',
      }),
    );
    const useCase = new VoidSaleUseCase(repository, publisher);

    const result = await useCase.execute({
      saleId: 'sale-id',
      voidedByUserId: 'user-id',
      reason: 'Cliente solicito anulacion',
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
      now: new Date('2026-06-22T08:05:00.000Z'),
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.getVoidPolicy.mock.calls).toHaveLength(1);
    expect(repository.void.mock.calls[0][0]).toEqual({
      saleId: 'sale-id',
      voidedByUserId: 'user-id',
      reason: 'Cliente solicito anulacion',
    });
    expect(events[0]).toMatchObject({
      name: OPERATIONAL_EVENTS.saleVoided,
      aggregateId: 'sale-id',
      audience: { sellerIds: ['seller-id'] },
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

  it('does not void a sale when the draw shift is no longer open', async () => {
    repository.findById.mockResolvedValue(
      createSale({
        shift: {
          id: 'shift-id',
          date: '2026-06-22',
          status: 'CERRADO',
          configuration: {
            id: 'configuration-id',
            code: 'nacional-11am',
            time: '11:00:00',
          },
        },
      }),
    );
    const useCase = new VoidSaleUseCase(repository);

    const result = await useCase.execute({
      saleId: 'sale-id',
      voidedByUserId: 'user-id',
      reason: 'Fuera de sorteo',
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
      now: new Date('2026-06-22T08:05:00.000Z'),
    });

    expect(result.isFailure).toBe(true);
    expect(repository.void.mock.calls).toHaveLength(0);
  });

  it('does not void a sale after the configured window expires', async () => {
    repository.findById.mockResolvedValue(
      createSale({
        createdAt: new Date('2026-06-22T08:00:00.000Z'),
      }),
    );
    const useCase = new VoidSaleUseCase(repository);

    const result = await useCase.execute({
      saleId: 'sale-id',
      voidedByUserId: 'user-id',
      reason: 'Fuera de tiempo',
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
      now: new Date('2026-06-22T08:11:00.000Z'),
    });

    expect(result.isFailure).toBe(true);
    expect(repository.void.mock.calls).toHaveLength(0);
  });

  it('gets the sales void policy', async () => {
    const useCase = new GetSalesVoidPolicyUseCase(repository);

    const result = await useCase.execute();

    expect(result.isSuccess).toBe(true);
    expect(repository.getVoidPolicy.mock.calls).toHaveLength(1);
  });

  it('updates the sales void policy', async () => {
    const { events, publisher } = createEventPublisher();
    repository.updateVoidPolicy.mockResolvedValue({ windowMinutes: 15 });
    const useCase = new UpdateSalesVoidPolicyUseCase(repository, publisher);

    const result = await useCase.execute({ windowMinutes: 15 });

    expect(result.isSuccess).toBe(true);
    expect(repository.updateVoidPolicy.mock.calls[0][0]).toEqual({
      windowMinutes: 15,
    });
    expect(events[0]).toMatchObject({
      name: OPERATIONAL_EVENTS.salesVoidPolicyUpdated,
      aggregateId: 'sales.void_window_minutes',
    });
  });

  it('rejects invalid sales void policy values', async () => {
    const useCase = new UpdateSalesVoidPolicyUseCase(repository);

    const result = await useCase.execute({ windowMinutes: 0 });

    expect(result.isFailure).toBe(true);
    expect(repository.updateVoidPolicy.mock.calls).toHaveLength(0);
  });
});
