import { PaginatedResult } from '../../../../shared-kernel';
import {
  BusinessAnalyticsReport,
  OperationalOverviewReport,
  SellerOperationalReport,
} from '../../domain/entities';
import { ReportsRepository } from '../../domain/ports';
import { GetBusinessAnalyticsUseCase } from './get-business-analytics.use-case';
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

const createAnalytics = (
  overrides: Partial<BusinessAnalyticsReport> = {},
): BusinessAnalyticsReport => ({
  filters: {
    dateFrom: '2026-06-22',
    dateUntil: '2026-06-22',
    topLimit: 10,
  },
  summary: {
    ...createOverview(),
    averageTicketMiles: 100,
    activeSellersCount: 1,
    numbersSoldCount: 2,
    bestSeller: {
      sellerId: 'seller-id',
      sellerName: 'Carlos Lopez',
      netSalesMiles: 100,
    },
    bestNumber: {
      number: '45',
      netSalesMiles: 100,
      ticketsCount: 2,
    },
    bestDay: {
      date: '2026-06-22',
      netSalesMiles: 100,
      salesCount: 1,
    },
  },
  sellers: [],
  topNumbers: [],
  bestDays: [],
  trend: [],
  projection: {
    periodDays: 1,
    averageDailyNetSalesMiles: 100,
    projectedNext7DaysNetSalesMiles: 700,
    projectedNext30DaysNetSalesMiles: 3000,
  },
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
  getBusinessAnalytics: jest.fn(),
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
      actorRoleName: 'ADMIN',
    });

    expect(result.isSuccess).toBe(true);
  });

  it('gets business analytics', async () => {
    repository.getBusinessAnalytics.mockResolvedValue(createAnalytics());
    const useCase = new GetBusinessAnalyticsUseCase(repository);

    const result = await useCase.execute({
      dateFrom: '2026-06-22',
      dateUntil: '2026-06-22',
      topLimit: 10,
      actorRoleName: 'ADMIN',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.getBusinessAnalytics.mock.calls[0][0]).toEqual({
      dateFrom: '2026-06-22',
      dateUntil: '2026-06-22',
      topLimit: 10,
    });
  });

  it('rejects invalid analytics date ranges', async () => {
    const useCase = new GetBusinessAnalyticsUseCase(repository);

    const result = await useCase.execute({
      dateFrom: '2026-06-23',
      dateUntil: '2026-06-22',
      topLimit: 10,
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(400);
    expect(repository.getBusinessAnalytics.mock.calls).toHaveLength(0);
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
      actorRoleName: 'ADMIN',
      page: 1,
      limit: 25,
      sortBy: 'sellerName',
      sortDirection: 'asc',
    });

    expect(result.isSuccess).toBe(true);
  });

  it('forces seller analytics to the authenticated seller', async () => {
    repository.getBusinessAnalytics.mockResolvedValue(createAnalytics());
    const useCase = new GetBusinessAnalyticsUseCase(repository);

    const result = await useCase.execute({
      dateFrom: '2026-06-22',
      dateUntil: '2026-06-22',
      sellerId: 'other-seller-id',
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
      topLimit: 10,
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.getBusinessAnalytics.mock.calls[0][0]).toMatchObject({
      sellerId: 'seller-id',
    });
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
