import { DrawsRepository } from '../../domain';
import { UpdateDrawConfigurationUseCase } from './update-draw-configuration.use-case';

describe('UpdateDrawConfigurationUseCase', () => {
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

  let useCase: UpdateDrawConfigurationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.updateConfiguration.mockResolvedValue({
      id: 'configuration-id',
      code: 'nacional-12pm',
      time: '12:00:00',
      tuesdayOnly: false,
      lockSecondsBefore: 60,
      reopenSecondsAfter: 600,
      active: true,
      createdAt: new Date('2026-06-21T08:00:00.000Z'),
      updatedAt: new Date('2026-06-21T09:00:00.000Z'),
    });
    useCase = new UpdateDrawConfigurationUseCase(repository);
  });

  it('normalizes the code before updating the configuration', async () => {
    const result = await useCase.execute({
      configurationId: 'configuration-id',
      code: ' Nacional-12PM ',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.updateConfiguration.mock.calls[0][0]).toMatchObject({
      configurationId: 'configuration-id',
      code: 'nacional-12pm',
    });
  });

  it('fails when the configuration does not exist', async () => {
    repository.updateConfiguration.mockResolvedValue(null);

    const result = await useCase.execute({
      configurationId: 'missing-id',
      code: 'nacional-12pm',
    });

    expect(result.isFailure).toBe(true);
  });
});
