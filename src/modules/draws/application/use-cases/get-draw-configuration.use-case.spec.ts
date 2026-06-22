import { DrawsRepository } from '../../domain';
import { GetDrawConfigurationUseCase } from './get-draw-configuration.use-case';

describe('GetDrawConfigurationUseCase', () => {
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

  let useCase: GetDrawConfigurationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findConfigurationById.mockResolvedValue({
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
    useCase = new GetDrawConfigurationUseCase(repository);
  });

  it('returns an existing draw configuration', async () => {
    const result = await useCase.execute({
      configurationId: 'configuration-id',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.findConfigurationById.mock.calls[0][0]).toBe(
      'configuration-id',
    );
  });

  it('fails when the configuration does not exist', async () => {
    repository.findConfigurationById.mockResolvedValue(null);

    const result = await useCase.execute({ configurationId: 'missing-id' });

    expect(result.isFailure).toBe(true);
  });
});
