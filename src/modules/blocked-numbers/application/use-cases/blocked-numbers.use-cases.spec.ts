import { PaginatedResult } from '../../../../shared-kernel';
import { BlockedNumber } from '../../domain/entities';
import { BlockedNumbersRepository } from '../../domain/ports';
import { CreateBlockedNumbersUseCase } from './create-blocked-numbers.use-case';
import { DeleteBlockedNumberUseCase } from './delete-blocked-number.use-case';
import { GetBlockedNumberUseCase } from './get-blocked-number.use-case';
import { ListBlockedNumbersUseCase } from './list-blocked-numbers.use-case';

const createBlockedNumber = (
  overrides: Partial<BlockedNumber> = {},
): BlockedNumber => ({
  id: 'block-id',
  scope: 'DATE',
  number: '02',
  date: '2026-06-22',
  shift: null,
  reason: 'QA',
  createdBy: {
    id: 'user-id',
    username: 'admin',
    name: 'Admin',
  },
  createdAt: new Date('2026-06-22T08:00:00.000Z'),
  ...overrides,
});

const createRepository = (): jest.Mocked<BlockedNumbersRepository> => ({
  createMany: jest.fn(),
  findById: jest.fn(),
  list: jest.fn(),
  delete: jest.fn(),
});

describe('Blocked numbers use cases', () => {
  let repository: jest.Mocked<BlockedNumbersRepository>;

  beforeEach(() => {
    repository = createRepository();
  });

  it('creates unique normalized date-scoped blocked numbers', async () => {
    repository.createMany.mockResolvedValue([
      createBlockedNumber({ number: '02' }),
      createBlockedNumber({ id: 'block-id-2', number: '15' }),
    ]);
    const useCase = new CreateBlockedNumbersUseCase(repository);

    const result = await useCase.execute({
      numbers: ['2', '02', '15'],
      date: '2026-06-22',
      reason: 'Decision operativa',
      createdByUserId: 'user-id',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.createMany.mock.calls[0][0]).toEqual({
      numbers: ['02', '15'],
      date: '2026-06-22',
      reason: 'Decision operativa',
      createdByUserId: 'user-id',
    });
  });

  it('rejects create commands without an explicit scope', async () => {
    const useCase = new CreateBlockedNumbersUseCase(repository);

    const result = await useCase.execute({
      numbers: ['02'],
    });

    expect(result.isFailure).toBe(true);
    expect(repository.createMany.mock.calls).toHaveLength(0);
  });

  it('rejects create commands with date and shift scopes at once', async () => {
    const useCase = new CreateBlockedNumbersUseCase(repository);

    const result = await useCase.execute({
      numbers: ['02'],
      date: '2026-06-22',
      shiftId: 'shift-id',
    });

    expect(result.isFailure).toBe(true);
    expect(repository.createMany.mock.calls).toHaveLength(0);
  });

  it('lists blocked numbers with pagination filters', async () => {
    const page: PaginatedResult<BlockedNumber> = {
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
    repository.list.mockResolvedValue(page);
    const useCase = new ListBlockedNumbersUseCase(repository);

    const query = {
      scope: 'DATE' as const,
      date: '2026-06-22',
      page: 1,
      limit: 25,
      sortBy: 'createdAt',
      sortDirection: 'desc' as const,
    };
    const result = await useCase.execute(query);

    expect(result.isSuccess).toBe(true);
    expect(repository.list.mock.calls[0][0]).toEqual(query);
  });

  it('returns one blocked number', async () => {
    repository.findById.mockResolvedValue(createBlockedNumber());
    const useCase = new GetBlockedNumberUseCase(repository);

    const result = await useCase.execute({ blockId: 'block-id' });

    expect(result.isSuccess).toBe(true);
    expect(repository.findById.mock.calls[0][0]).toBe('block-id');
  });

  it('fails when a blocked number does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    const useCase = new GetBlockedNumberUseCase(repository);

    const result = await useCase.execute({ blockId: 'missing-id' });

    expect(result.isFailure).toBe(true);
  });

  it('deletes one blocked number', async () => {
    repository.delete.mockResolvedValue(createBlockedNumber());
    const useCase = new DeleteBlockedNumberUseCase(repository);

    const result = await useCase.execute({ blockId: 'block-id' });

    expect(result.isSuccess).toBe(true);
    expect(repository.delete.mock.calls[0][0]).toBe('block-id');
  });
});
