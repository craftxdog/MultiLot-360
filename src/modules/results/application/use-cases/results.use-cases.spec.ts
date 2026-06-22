import { PaginatedResult } from '../../../../shared-kernel';
import { DrawResult, WinningSale } from '../../domain/entities';
import { ResultsRepository } from '../../domain/ports';
import { CreateResultUseCase } from './create-result.use-case';
import { GetResultUseCase } from './get-result.use-case';
import { ListResultsUseCase } from './list-results.use-case';
import { ListWinningSalesUseCase } from './list-winning-sales.use-case';

const createResult = (overrides: Partial<DrawResult> = {}): DrawResult => ({
  id: 'result-id',
  shift: {
    id: 'shift-id',
    date: '2026-06-22',
    status: 'CERRADO',
    configuration: {
      id: 'configuration-id',
      code: '11',
      time: '11:00:00',
    },
  },
  winningNumber: '20',
  createdBy: {
    id: 'admin-id',
    username: 'admin',
    name: 'Admin Principal',
  },
  createdAt: new Date('2026-06-22T12:00:00.000Z'),
  winnerSummary: {
    winningSalesCount: 1,
    totalPrizeMiles: 10,
    paidSalesCount: 0,
    paidPrizeMiles: 0,
    pendingSalesCount: 1,
    pendingPrizeMiles: 10,
  },
  ...overrides,
});

const createWinningSale = (
  overrides: Partial<WinningSale> = {},
): WinningSale => ({
  saleId: 'sale-id',
  seller: {
    id: 'seller-id',
    name: 'Carlos Lopez',
  },
  shift: createResult().shift,
  saleStatus: 'ACTIVA',
  saleTotalMiles: 81,
  saleCreatedAt: new Date('2026-06-22T11:30:00.000Z'),
  winningPrizeMiles: 10,
  winningDetails: [
    {
      id: 'detail-id',
      number: '20',
      prizeMiles: 10,
      createdAt: new Date('2026-06-22T11:30:00.000Z'),
    },
  ],
  paid: false,
  payment: null,
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

const createRepository = (): jest.Mocked<ResultsRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  list: jest.fn(),
  listWinningSales: jest.fn(),
});

describe('Results use cases', () => {
  let repository: jest.Mocked<ResultsRepository>;

  beforeEach(() => {
    repository = createRepository();
  });

  it('creates a result with a normalized winning number', async () => {
    repository.create.mockResolvedValue(createResult());
    const useCase = new CreateResultUseCase(repository);

    const result = await useCase.execute({
      shiftId: 'shift-id',
      winningNumber: '2',
      createdByUserId: 'admin-id',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.create.mock.calls[0][0]).toEqual({
      shiftId: 'shift-id',
      winningNumber: '02',
      createdByUserId: 'admin-id',
    });
  });

  it('returns a conflict when the result already exists', async () => {
    repository.create.mockRejectedValue(
      new Error('Result already exists for this draw shift'),
    );
    const useCase = new CreateResultUseCase(repository);

    const result = await useCase.execute({
      shiftId: 'shift-id',
      winningNumber: '20',
      createdByUserId: 'admin-id',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(409);
  });

  it('gets a result by id', async () => {
    repository.findById.mockResolvedValue(createResult());
    const useCase = new GetResultUseCase(repository);

    const result = await useCase.execute({ resultId: 'result-id' });

    expect(result.isSuccess).toBe(true);
  });

  it('returns not found when result does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    const useCase = new GetResultUseCase(repository);

    const result = await useCase.execute({ resultId: 'missing-result' });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(404);
  });

  it('lists results with pagination', async () => {
    repository.list.mockResolvedValue(createPaginatedResult([createResult()]));
    const useCase = new ListResultsUseCase(repository);

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

  it('lists winning sales for a result', async () => {
    repository.listWinningSales.mockResolvedValue(
      createPaginatedResult([createWinningSale()]),
    );
    const useCase = new ListWinningSalesUseCase(repository);

    const result = await useCase.execute({
      resultId: 'result-id',
      page: 1,
      limit: 25,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.listWinningSales.mock.calls[0][0]).toMatchObject({
      resultId: 'result-id',
    });
  });

  it('returns not found when listing winners for a missing result', async () => {
    repository.listWinningSales.mockResolvedValue(null);
    const useCase = new ListWinningSalesUseCase(repository);

    const result = await useCase.execute({
      resultId: 'missing-result',
      page: 1,
      limit: 25,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(404);
  });
});
