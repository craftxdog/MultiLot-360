import { PaginatedResult } from '../../../../shared-kernel';
import {
  OperationalOverviewReport,
  SellerOperationalReport,
} from '../../domain/entities';
import { ReportsRepository } from '../../domain/ports';
import { GetOperationalOverviewUseCase } from './get-operational-overview.use-case';
import { ListSellerOperationalReportsUseCase } from './list-seller-operational-reports.use-case';

const createOverview = (
  overrides: Partial<OperationalOverviewReport> = {},
): OperationalOverviewReport => ({
  filters: {
    dateFrom: '2026-06-22',
    dateUntil: '2026-06-22',
  },
  salesCount: 2,
  activeSalesCount: 1,
  voidedSalesCount: 1,
  grossSalesMiles: 150,
  voidedSalesMiles: 50,
  netSalesMiles: 100,
  winningPrizeMiles: 30,
  paidPrizesMiles: 10,
  pendingPrizesMiles: 20,
  balanceMiles: 90,
  ...overrides,
});

const createSellerReport = (
  overrides: Partial<SellerOperationalReport> = {},
): SellerOperationalReport => ({
  sellerId: 'seller-id',
  sellerName: 'Carlos Lopez',
  salesCount: 2,
  activeSalesCount: 1,
  voidedSalesCount: 1,
  grossSalesMiles: 150,
  voidedSalesMiles: 50,
  netSalesMiles: 100,
  winningPrizeMiles: 30,
  paidPrizesMiles: 10,
  pendingPrizesMiles: 20,
  balanceMiles: 90,
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
    sortBy: 'sellerName',
    sortDirection: 'asc',
  },
});

const createRepository = (): jest.Mocked<ReportsRepository> => ({
  getOperationalOverview: jest.fn(),
  listSellerOperationalReports: jest.fn(),
});

describe('Reports use cases', () => {
  let repository: jest.Mocked<ReportsRepository>;

  beforeEach(() => {
    repository = createRepository();
  });

  it('gets an operational overview', async () => {
    repository.getOperationalOverview.mockResolvedValue(createOverview());
    const useCase = new GetOperationalOverviewUseCase(repository);

    const result = await useCase.execute({
      dateFrom: '2026-06-22',
      dateUntil: '2026-06-22',
    });

    expect(result.isSuccess).toBe(true);
  });

  it('rejects invalid overview date ranges', async () => {
    const useCase = new GetOperationalOverviewUseCase(repository);

    const result = await useCase.execute({
      dateFrom: '2026-06-23',
      dateUntil: '2026-06-22',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(400);
    expect(repository.getOperationalOverview.mock.calls).toHaveLength(0);
  });

  it('lists seller operational reports', async () => {
    repository.listSellerOperationalReports.mockResolvedValue(
      createPaginatedResult([createSellerReport()]),
    );
    const useCase = new ListSellerOperationalReportsUseCase(repository);

    const result = await useCase.execute({
      dateFrom: '2026-06-22',
      dateUntil: '2026-06-22',
      page: 1,
      limit: 25,
      sortBy: 'sellerName',
      sortDirection: 'asc',
    });

    expect(result.isSuccess).toBe(true);
  });

  it('rejects invalid seller report date ranges', async () => {
    const useCase = new ListSellerOperationalReportsUseCase(repository);

    const result = await useCase.execute({
      dateFrom: '2026-06-23',
      dateUntil: '2026-06-22',
      page: 1,
      limit: 25,
      sortBy: 'sellerName',
      sortDirection: 'asc',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(400);
    expect(repository.listSellerOperationalReports.mock.calls).toHaveLength(0);
  });
});
