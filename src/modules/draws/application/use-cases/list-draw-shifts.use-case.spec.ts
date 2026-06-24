import { DrawsRepository } from '../../domain';
import { ListDrawShiftsUseCase } from './list-draw-shifts.use-case';

describe('ListDrawShiftsUseCase', () => {
  const repository: jest.Mocked<DrawsRepository> = {
    createConfiguration: jest.fn(),
    findConfigurationById: jest.fn(),
    updateConfiguration: jest.fn(),
    listConfigurations: jest.fn(),
    openShift: jest.fn(),
    blockShift: jest.fn(),
    reopenShift: jest.fn(),
    closeShift: jest.fn(),
    listShifts: jest.fn(),
    listActiveShifts: jest.fn(),
  };

  let useCase: ListDrawShiftsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.listShifts.mockResolvedValue({
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
        sortBy: 'date',
        sortDirection: 'desc',
      },
    });
    useCase = new ListDrawShiftsUseCase(repository);
  });

  it('delegates filters to the repository', async () => {
    const result = await useCase.execute({
      date: '2026-06-21',
      status: 'ABIERTO',
      page: 1,
      limit: 25,
      sortBy: 'date',
      sortDirection: 'desc',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.listShifts.mock.calls[0][0]).toEqual({
      date: '2026-06-21',
      status: 'ABIERTO',
      page: 1,
      limit: 25,
      sortBy: 'date',
      sortDirection: 'desc',
    });
  });
});
