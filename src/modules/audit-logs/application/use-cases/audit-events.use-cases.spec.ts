import { PaginatedResult } from '../../../../shared-kernel';
import { AuditEvent } from '../../domain/entities';
import { AuditEventsRepository } from '../../domain/ports';
import { GetAuditEventUseCase } from './get-audit-event.use-case';
import { ListAuditEventsUseCase } from './list-audit-events.use-case';
import { RecordAuditEventUseCase } from './record-audit-event.use-case';

const createAuditEvent = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  id: '1',
  userId: 'user-id',
  event: 'http.request.completed',
  payload: {
    method: 'POST',
    path: '/api/v1/sales',
  },
  actor: {
    id: 'user-id',
    username: 'admin',
    name: 'Admin Principal',
  },
  createdAt: new Date('2026-06-22T12:00:00.000Z'),
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

const createRepository = (): jest.Mocked<AuditEventsRepository> => ({
  record: jest.fn(),
  findById: jest.fn(),
  list: jest.fn(),
});

describe('Audit event use cases', () => {
  let repository: jest.Mocked<AuditEventsRepository>;

  beforeEach(() => {
    repository = createRepository();
  });

  it('records an audit event', async () => {
    repository.record.mockResolvedValue(createAuditEvent());
    const useCase = new RecordAuditEventUseCase(repository);

    const result = await useCase.execute({
      userId: 'user-id',
      event: ' http.request.completed ',
      payload: { method: 'POST' },
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.record.mock.calls[0][0]).toEqual({
      userId: 'user-id',
      event: 'http.request.completed',
      payload: { method: 'POST' },
    });
  });

  it('rejects an empty audit event name', async () => {
    const useCase = new RecordAuditEventUseCase(repository);

    const result = await useCase.execute({
      event: '   ',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(400);
    expect(repository.record.mock.calls).toHaveLength(0);
  });

  it('gets an audit event by id', async () => {
    repository.findById.mockResolvedValue(createAuditEvent());
    const useCase = new GetAuditEventUseCase(repository);

    const result = await useCase.execute({ eventId: '1' });

    expect(result.isSuccess).toBe(true);
  });

  it('returns not found when an audit event does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    const useCase = new GetAuditEventUseCase(repository);

    const result = await useCase.execute({ eventId: '404' });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.statusCode).toBe(404);
  });

  it('lists audit events with pagination', async () => {
    repository.list.mockResolvedValue(
      createPaginatedResult([createAuditEvent()]),
    );
    const useCase = new ListAuditEventsUseCase(repository);

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
});
