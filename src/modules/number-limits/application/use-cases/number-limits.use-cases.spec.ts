import {
  IntegrationEventPublisher,
  IntegrationEventInput,
  OPERATIONAL_EVENTS,
  PaginatedResult,
} from '../../../../shared-kernel';
import { NumberLimit } from '../../domain/entities';
import { NumberLimitsRepository } from '../../domain/ports';
import { CreateNumberLimitsUseCase } from './create-number-limits.use-case';
import { ExpireNumberLimitUseCase } from './expire-number-limit.use-case';
import { GetNumberLimitUseCase } from './get-number-limit.use-case';
import { ListNumberLimitsUseCase } from './list-number-limits.use-case';
import { UpdateNumberLimitUseCase } from './update-number-limit.use-case';

const createNumberLimit = (
  overrides: Partial<NumberLimit> = {},
): NumberLimit => ({
  id: 'limit-id',
  sellerScope: 'GLOBAL',
  drawScope: 'DEFAULT',
  seller: null,
  drawConfiguration: null,
  number: '02',
  limitMiles: 100,
  validFrom: '2026-06-22',
  validUntil: null,
  createdAt: new Date('2026-06-22T08:00:00.000Z'),
  ...overrides,
});

const createRepository = (): jest.Mocked<NumberLimitsRepository> => ({
  createMany: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  expire: jest.fn(),
  list: jest.fn(),
});

const createEventPublisher = () => {
  const events: IntegrationEventInput[] = [];
  const publisher: IntegrationEventPublisher = {
    publish: (event) => events.push(event),
  };
  return { events, publisher };
};

describe('Number limits use cases', () => {
  let repository: jest.Mocked<NumberLimitsRepository>;

  beforeEach(() => {
    repository = createRepository();
  });

  it('creates unique normalized number limits', async () => {
    const { events, publisher } = createEventPublisher();
    repository.createMany.mockResolvedValue([
      createNumberLimit({ number: '02' }),
      createNumberLimit({ id: 'limit-id-2', number: '15' }),
    ]);
    const useCase = new CreateNumberLimitsUseCase(repository, publisher);

    const result = await useCase.execute({
      numbers: ['2', '02', '15'],
      limitMiles: 100,
      validFrom: '2026-06-22',
      sellerId: 'seller-id',
      drawCode: 'nacional-11am',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.createMany.mock.calls[0][0]).toEqual({
      numbers: ['02', '15'],
      limitMiles: 100,
      validFrom: '2026-06-22',
      sellerId: 'seller-id',
      drawCode: 'nacional-11am',
    });
    expect(events[0]).toMatchObject({
      name: OPERATIONAL_EVENTS.numberLimitsCreated,
      aggregateId: 'limit-id',
      payload: {
        limitIds: ['limit-id', 'limit-id-2'],
        numbers: ['02', '15'],
      },
    });
  });

  it('rejects invalid create date ranges before persisting', async () => {
    const useCase = new CreateNumberLimitsUseCase(repository);

    const result = await useCase.execute({
      numbers: ['02'],
      limitMiles: 100,
      validFrom: '2026-06-30',
      validUntil: '2026-06-22',
    });

    expect(result.isFailure).toBe(true);
    expect(repository.createMany.mock.calls).toHaveLength(0);
  });

  it('lists limits with pagination filters', async () => {
    const paginatedResult: PaginatedResult<NumberLimit> = {
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
    const useCase = new ListNumberLimitsUseCase(repository);

    const query = {
      active: true,
      drawScope: 'DRAW' as const,
      page: 1,
      limit: 25,
      sortBy: 'createdAt',
      sortDirection: 'desc' as const,
    };
    const result = await useCase.execute(query);

    expect(result.isSuccess).toBe(true);
    expect(repository.list.mock.calls[0][0]).toEqual(query);
  });

  it('returns one existing limit', async () => {
    repository.findById.mockResolvedValue(createNumberLimit());
    const useCase = new GetNumberLimitUseCase(repository);

    const result = await useCase.execute({ limitId: 'limit-id' });

    expect(result.isSuccess).toBe(true);
    expect(repository.findById.mock.calls[0][0]).toBe('limit-id');
  });

  it('fails when the requested limit does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    const useCase = new GetNumberLimitUseCase(repository);

    const result = await useCase.execute({ limitId: 'missing-id' });

    expect(result.isFailure).toBe(true);
  });

  it('updates one limit', async () => {
    const { events, publisher } = createEventPublisher();
    repository.update.mockResolvedValue(createNumberLimit({ limitMiles: 75 }));
    const useCase = new UpdateNumberLimitUseCase(repository, publisher);

    const result = await useCase.execute({
      limitId: 'limit-id',
      limitMiles: 75,
      validFrom: '2026-06-22',
      validUntil: '2026-06-30',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.update.mock.calls[0][0]).toEqual({
      limitId: 'limit-id',
      limitMiles: 75,
      validFrom: '2026-06-22',
      validUntil: '2026-06-30',
    });
    expect(events[0]).toMatchObject({
      name: OPERATIONAL_EVENTS.numberLimitUpdated,
      aggregateId: 'limit-id',
    });
  });

  it('rejects invalid update date ranges before persisting', async () => {
    const useCase = new UpdateNumberLimitUseCase(repository);

    const result = await useCase.execute({
      limitId: 'limit-id',
      validFrom: '2026-06-30',
      validUntil: '2026-06-22',
    });

    expect(result.isFailure).toBe(true);
    expect(repository.update.mock.calls).toHaveLength(0);
  });

  it('expires one limit without deleting it', async () => {
    const { events, publisher } = createEventPublisher();
    repository.expire.mockResolvedValue(
      createNumberLimit({ validUntil: '2026-06-22' }),
    );
    const useCase = new ExpireNumberLimitUseCase(repository, publisher);

    const result = await useCase.execute({
      limitId: 'limit-id',
      expiresOn: '2026-06-22',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.expire.mock.calls[0][0]).toEqual({
      limitId: 'limit-id',
      expiresOn: '2026-06-22',
    });
    expect(events[0]).toMatchObject({
      name: OPERATIONAL_EVENTS.numberLimitExpired,
      aggregateId: 'limit-id',
    });
  });
});
