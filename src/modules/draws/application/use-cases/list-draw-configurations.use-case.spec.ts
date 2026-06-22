import { DrawsRepository } from '../../domain';
import { ListDrawConfigurationsUseCase } from './list-draw-configurations.use-case';

describe('ListDrawConfigurationsUseCase', () => {
  const repository: jest.Mocked<DrawsRepository> = {
    createConfiguration: jest.fn(),
    listConfigurations: jest.fn(),
    openShift: jest.fn(),
    closeShift: jest.fn(),
    listShifts: jest.fn(),
  };

  let useCase: ListDrawConfigurationsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.listConfigurations.mockResolvedValue([]);
    useCase = new ListDrawConfigurationsUseCase(repository);
  });

  it('delegates filters to the repository', async () => {
    const result = await useCase.execute({ active: true });

    expect(result.isSuccess).toBe(true);
    expect(repository.listConfigurations.mock.calls[0][0]).toEqual({
      active: true,
    });
  });
});
