import { PaginatedResult } from '../../../../shared-kernel';
import { PrizePayment } from '../../domain/entities';
import { PrizePaymentsRepository } from '../../domain/ports';
import { GetPrizePaymentUseCase } from './get-prize-payment.use-case';
import { ListPrizePaymentsUseCase } from './list-prize-payments.use-case';
import { PayPrizeUseCase } from './pay-prize.use-case';

const createPrizePayment = (
  overrides: Partial<PrizePayment> = {},
): PrizePayment => ({
  saleId: 'sale-id',
  result: {
    id: 'result-id',
    winningNumber: '20',
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
  },
  sale: {
    id: 'sale-id',
    status: 'ACTIVA',
    totalMiles: 81,
    createdAt: new Date('2026-06-22T10:00:00.000Z'),
    seller: {
      id: 'seller-id',
      name: 'Carlos Lopez',
    },
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
  },
  paidAmountMiles: 10,
  paidBy: {
    id: 'admin-id',
    username: 'admin',
    name: 'Admin Principal',
  },
  paidAt: new Date('2026-06-22T12:00:00.000Z'),
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
    sortBy: 'paidAt',
    sortDirection: 'desc',
  },
});

const createRepository = (): jest.Mocked<PrizePaymentsRepository> => ({
  pay: jest.fn(),
  findBySaleId: jest.fn(),
  list: jest.fn(),
});

describe('Prize payment use cases', () => {
  let repository: jest.Mocked<PrizePaymentsRepository>;

  beforeEach(() => {
    repository = createRepository();
  });

  it('pays a winning sale prize', async () => {
    repository.pay.mockResolvedValue(createPrizePayment());
    const useCase = new PayPrizeUseCase(repository);

    const result = await useCase.execute({
      resultId: 'result-id',
      saleId: 'sale-id',
      paidByUserId: 'admin-id',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.pay.mock.calls[0][0]).toEqual({
      resultId: 'result-id',
      saleId: 'sale-id',
      paidByUserId: 'admin-id',
    });
  });

  it('returns conflict when prize payment already exists', async () => {
    repository.pay.mockRejectedValue(
      new Error('Prize payment already exists for this sale'),
    );
    const useCase = new PayPrizeUseCase(repository);

    const result = await useCase.execute({
      resultId: 'result-id',
      saleId: 'sale-id',
      paidByUserId: 'admin-id',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(409);
  });

  it('gets a prize payment by sale id', async () => {
    repository.findBySaleId.mockResolvedValue(createPrizePayment());
    const useCase = new GetPrizePaymentUseCase(repository);

    const result = await useCase.execute({ saleId: 'sale-id' });

    expect(result.isSuccess).toBe(true);
  });

  it('returns not found when payment does not exist', async () => {
    repository.findBySaleId.mockResolvedValue(null);
    const useCase = new GetPrizePaymentUseCase(repository);

    const result = await useCase.execute({ saleId: 'missing-sale' });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(404);
  });

  it('lists prize payments with pagination', async () => {
    repository.list.mockResolvedValue(
      createPaginatedResult([createPrizePayment()]),
    );
    const useCase = new ListPrizePaymentsUseCase(repository);

    const result = await useCase.execute({
      page: 1,
      limit: 25,
      sortBy: 'paidAt',
      sortDirection: 'desc',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.list.mock.calls[0][0]).toMatchObject({
      page: 1,
      limit: 25,
    });
  });
});
