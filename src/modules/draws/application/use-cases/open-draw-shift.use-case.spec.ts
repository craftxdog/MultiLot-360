import { DrawsRepository } from '../../domain';
import { OpenDrawShiftUseCase } from './open-draw-shift.use-case';

describe('OpenDrawShiftUseCase', () => {
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

  let useCase: OpenDrawShiftUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.openShift.mockResolvedValue({
      id: 'shift-id',
      date: '2026-06-21',
      status: 'ABIERTO',
      createdAt: new Date('2026-06-21T08:00:00.000Z'),
      updatedAt: new Date('2026-06-21T08:00:00.000Z'),
      configuration: {
        id: 'configuration-id',
        code: 'nacional-11am',
        time: '11:00:00',
        tuesdayOnly: false,
        lockSecondsBefore: 60,
        reopenSecondsAfter: 600,
        active: true,
        createdAt: new Date('2026-06-21T08:00:00.000Z'),
        updatedAt: new Date('2026-06-21T08:00:00.000Z'),
      },
    });
    useCase = new OpenDrawShiftUseCase(repository);
  });

  it('opens a draw shift for a configuration and date', async () => {
    const result = await useCase.execute({
      configurationId: 'configuration-id',
      date: '2026-06-21',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.openShift.mock.calls[0][0]).toEqual({
      configurationId: 'configuration-id',
      date: '2026-06-21',
    });
  });
});
