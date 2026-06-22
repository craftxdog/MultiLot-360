import { DrawsRepository } from '../../domain';
import { CreateDrawConfigurationUseCase } from './create-draw-configuration.use-case';

describe('CreateDrawConfigurationUseCase', () => {
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

  let useCase: CreateDrawConfigurationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.createConfiguration.mockResolvedValue({
      id: 'configuration-id',
      code: 'nacional-11am',
      time: '11:00:00',
      tuesdayOnly: false,
      lockSecondsBefore: 60,
      reopenSecondsAfter: 600,
      active: true,
      createdAt: new Date('2026-06-21T08:00:00.000Z'),
      updatedAt: new Date('2026-06-21T08:00:00.000Z'),
    });
    useCase = new CreateDrawConfigurationUseCase(repository);
  });

  it('normalizes the code before persisting the configuration', async () => {
    const result = await useCase.execute({
      code: ' Nacional-11AM ',
      time: '11:00:00',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.createConfiguration.mock.calls[0][0]).toMatchObject({
      code: 'nacional-11am',
      time: '11:00:00',
    });
  });
});
