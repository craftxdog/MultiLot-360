import {
  IntegrationEventInput,
  IntegrationEventPublisher,
  OPERATIONAL_EVENTS,
  PaginatedResult,
} from '../../../../shared-kernel';
import { CashCut, CashCutSummary } from '../../domain/entities';
import { CashCutsRepository } from '../../domain/ports';
import { CreateCashCutUseCase } from './create-cash-cut.use-case';
import { GetCashCutSummaryUseCase } from './get-cash-cut-summary.use-case';
import { GetCashCutUseCase } from './get-cash-cut.use-case';
import { ListCashCutsUseCase } from './list-cash-cuts.use-case';

const createCashCut = (overrides: Partial<CashCut> = {}): CashCut => ({
  id: 'cut-id',
  startDate: '2026-06-22',
  endDate: '2026-06-22',
  description: 'Daily close',
  visibleToSellers: true,
  createdBy: {
    id: 'admin-id',
    username: 'admin',
    name: 'Admin Principal',
  },
  createdAt: new Date('2026-06-22T23:00:00.000Z'),
  ...overrides,
});

const createSummary = (
  overrides: Partial<CashCutSummary> = {},
): CashCutSummary => ({
  cut: createCashCut(),
  totals: {
    activeSalesCount: 2,
    voidedSalesCount: 1,
    grossSalesMiles: 150,
    voidedSalesMiles: 50,
    netSalesMiles: 100,
    paidPrizesMiles: 30,
    balanceMiles: 70,
  },
  sellers: [
    {
      sellerId: 'seller-id',
      sellerName: 'Carlos Lopez',
      activeSalesCount: 2,
      voidedSalesCount: 1,
      grossSalesMiles: 150,
      voidedSalesMiles: 50,
      netSalesMiles: 100,
      paidPrizesMiles: 30,
      balanceMiles: 70,
    },
  ],
  ...overrides,
});

const createPaginatedResult = <T>(items: T[]): PaginatedResult<T> => ({
  items,
  pagination: {
    strategy: 'offset',
    page: 1,
    limit: 25,
    count: items.length,
    total: items.length,
    totalPages: items.length ? 1 : 0,
    hasNextPage: false,
    hasPreviousPage: false,
    sortBy: 'createdAt',
    sortDirection: 'desc',
  },
});

const createRepository = (): jest.Mocked<CashCutsRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  list: jest.fn(),
  getSummary: jest.fn(),
});

const createEventPublisher = () => {
  const events: IntegrationEventInput[] = [];
  const publisher: IntegrationEventPublisher = {
    publish: (event) => events.push(event),
  };
  return { events, publisher };
};

describe('Cash cut use cases', () => {
  let repository: jest.Mocked<CashCutsRepository>;

  beforeEach(() => {
    repository = createRepository();
  });

  it('creates a cash cut', async () => {
    const { events, publisher } = createEventPublisher();
    repository.create.mockResolvedValue(createCashCut());
    const useCase = new CreateCashCutUseCase(repository, publisher);

    const result = await useCase.execute({
      startDate: '2026-06-22',
      endDate: '2026-06-22',
      description: 'Daily close',
      createdByUserId: 'admin-id',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.create.mock.calls[0][0]).toMatchObject({
      startDate: '2026-06-22',
      endDate: '2026-06-22',
      createdByUserId: 'admin-id',
    });
    expect(events[0]).toMatchObject({
      name: OPERATIONAL_EVENTS.cashCutCreated,
      aggregateId: 'cut-id',
      audience: { roles: ['VENDEDOR'] },
    });
  });

  it('rejects an invalid date range', async () => {
    const useCase = new CreateCashCutUseCase(repository);

    const result = await useCase.execute({
      startDate: '2026-06-23',
      endDate: '2026-06-22',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(400);
    expect(repository.create.mock.calls).toHaveLength(0);
  });

  it('gets a cash cut by id', async () => {
    repository.findById.mockResolvedValue(createCashCut());
    const useCase = new GetCashCutUseCase(repository);

    const result = await useCase.execute({ cutId: 'cut-id' });

    expect(result.isSuccess).toBe(true);
  });

  it('returns not found when a cash cut does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    const useCase = new GetCashCutUseCase(repository);

    const result = await useCase.execute({ cutId: 'missing-cut' });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(404);
  });

  it('lists cash cuts with pagination', async () => {
    repository.list.mockResolvedValue(createPaginatedResult([createCashCut()]));
    const useCase = new ListCashCutsUseCase(repository);

    const result = await useCase.execute({
      page: 1,
      limit: 25,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.list.mock.calls[0][0]).toMatchObject({
      page: 1,
      limit: 25,
    });
  });

  it('gets a cash cut summary', async () => {
    repository.getSummary.mockResolvedValue(createSummary());
    const useCase = new GetCashCutSummaryUseCase(repository);

    const result = await useCase.execute({ cutId: 'cut-id' });

    expect(result.isSuccess).toBe(true);
  });

  it('returns not found when a cash cut summary does not exist', async () => {
    repository.getSummary.mockResolvedValue(null);
    const useCase = new GetCashCutSummaryUseCase(repository);

    const result = await useCase.execute({ cutId: 'missing-cut' });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(404);
  });
});
