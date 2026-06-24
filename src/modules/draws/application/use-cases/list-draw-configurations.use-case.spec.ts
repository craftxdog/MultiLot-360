import { DrawsRepository } from '../../domain';
import { ListDrawConfigurationsUseCase } from './list-draw-configurations.use-case';

describe('ListDrawConfigurationsUseCase', () => {
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

  let useCase: ListDrawConfigurationsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.listConfigurations.mockResolvedValue({
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
        sortBy: 'time',
        sortDirection: 'asc',
      },
    });
    useCase = new ListDrawConfigurationsUseCase(repository);
  });

  it('delegates filters to the repository', async () => {
    const result = await useCase.execute({
      active: true,
      page: 1,
      limit: 25,
      sortBy: 'time',
      sortDirection: 'asc',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.listConfigurations.mock.calls[0][0]).toEqual({
      active: true,
      page: 1,
      limit: 25,
      sortBy: 'time',
      sortDirection: 'asc',
    });
  });
});
