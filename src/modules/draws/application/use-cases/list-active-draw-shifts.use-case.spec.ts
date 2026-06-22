import { DrawsRepository } from '../../domain';
import { ListActiveDrawShiftsUseCase } from './list-active-draw-shifts.use-case';

describe('ListActiveDrawShiftsUseCase', () => {
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

  let useCase: ListActiveDrawShiftsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.listActiveShifts.mockResolvedValue({
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
    useCase = new ListActiveDrawShiftsUseCase(repository);
  });

  it('delegates date filters to the repository', async () => {
    const result = await useCase.execute({
      date: '2026-06-21',
      page: 1,
      limit: 25,
      sortBy: 'date',
      sortDirection: 'desc',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.listActiveShifts.mock.calls[0][0]).toEqual({
      date: '2026-06-21',
      page: 1,
      limit: 25,
      sortBy: 'date',
      sortDirection: 'desc',
    });
  });
});
