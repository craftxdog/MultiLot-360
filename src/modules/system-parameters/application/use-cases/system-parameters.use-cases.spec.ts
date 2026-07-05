import {
  IntegrationEventInput,
  IntegrationEventPublisher,
  OPERATIONAL_EVENTS,
  PaginatedResult,
} from '../../../../shared-kernel';
import { SystemParameter } from '../../domain/entities';
import { SystemParametersRepository } from '../../domain/ports';
import { GetSystemParameterUseCase } from './get-system-parameter.use-case';
import { ListSystemParametersUseCase } from './list-system-parameters.use-case';
import { UpsertSystemParameterUseCase } from './upsert-system-parameter.use-case';

const createParameter = (
  overrides: Partial<SystemParameter> = {},
): SystemParameter => ({
  key: 'sales.void_window_minutes',
  value: '10',
  updatedAt: new Date('2026-06-22T12:00:00.000Z'),
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
    sortBy: 'key',
    sortDirection: 'asc',
  },
});

const createRepository = (): jest.Mocked<SystemParametersRepository> => ({
  findByKey: jest.fn(),
  list: jest.fn(),
  upsert: jest.fn(),
});

const createEventPublisher = () => {
  const events: IntegrationEventInput[] = [];
  const publisher: IntegrationEventPublisher = {
    publish: (event) => events.push(event),
  };
  return { events, publisher };
};

describe('System parameter use cases', () => {
  let repository: jest.Mocked<SystemParametersRepository>;

  beforeEach(() => {
    repository = createRepository();
  });

  it('gets a system parameter by key', async () => {
    repository.findByKey.mockResolvedValue(createParameter());
    const useCase = new GetSystemParameterUseCase(repository);

    const result = await useCase.execute({
      key: 'sales.void_window_minutes',
    });

    expect(result.isSuccess).toBe(true);
  });

  it('returns not found when the system parameter does not exist', async () => {
    repository.findByKey.mockResolvedValue(null);
    const useCase = new GetSystemParameterUseCase(repository);

    const result = await useCase.execute({
      key: 'sales.missing',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(404);
  });

  it('rejects invalid system parameter keys', async () => {
    const useCase = new GetSystemParameterUseCase(repository);

    const result = await useCase.execute({
      key: ' bad key ',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(400);
    expect(repository.findByKey.mock.calls).toHaveLength(0);
  });

  it('lists system parameters with pagination', async () => {
    repository.list.mockResolvedValue(
      createPaginatedResult([createParameter()]),
    );
    const useCase = new ListSystemParametersUseCase(repository);

    const result = await useCase.execute({
      page: 1,
      limit: 25,
      sortBy: 'key',
      sortDirection: 'asc',
    });

    expect(result.isSuccess).toBe(true);
  });

  it('upserts a system parameter', async () => {
    const { events, publisher } = createEventPublisher();
    repository.upsert.mockResolvedValue(createParameter());
    const useCase = new UpsertSystemParameterUseCase(repository, publisher);

    const result = await useCase.execute({
      key: ' sales.void_window_minutes ',
      value: '15',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.upsert.mock.calls[0][0]).toEqual({
      key: 'sales.void_window_minutes',
      value: '15',
    });
    expect(events[0]).toMatchObject({
      name: OPERATIONAL_EVENTS.systemParameterUpdated,
      aggregateId: 'sales.void_window_minutes',
      payload: { key: 'sales.void_window_minutes' },
    });
  });
});
