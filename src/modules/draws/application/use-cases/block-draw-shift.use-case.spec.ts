import { DrawsRepository } from '../../domain';
import { BlockDrawShiftUseCase } from './block-draw-shift.use-case';

describe('BlockDrawShiftUseCase', () => {
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

  let useCase: BlockDrawShiftUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.blockShift.mockResolvedValue({
      id: 'shift-id',
      date: '2026-06-21',
      status: 'BLOQUEO',
      createdAt: new Date('2026-06-21T08:00:00.000Z'),
      updatedAt: new Date('2026-06-21T09:00:00.000Z'),
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
    useCase = new BlockDrawShiftUseCase(repository);
  });

  it('blocks an existing draw shift', async () => {
    const result = await useCase.execute({ shiftId: 'shift-id' });

    expect(result.isSuccess).toBe(true);
    expect(repository.blockShift.mock.calls[0][0]).toBe('shift-id');
  });
});
