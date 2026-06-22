import { DrawsRepository } from '../../domain';
import { CloseDrawShiftUseCase } from './close-draw-shift.use-case';

describe('CloseDrawShiftUseCase', () => {
  const repository: jest.Mocked<DrawsRepository> = {
    createConfiguration: jest.fn(),
    listConfigurations: jest.fn(),
    openShift: jest.fn(),
    closeShift: jest.fn(),
    listShifts: jest.fn(),
  };

  let useCase: CloseDrawShiftUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.closeShift.mockResolvedValue({
      id: 'shift-id',
      date: '2026-06-21',
      status: 'CERRADO',
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
    useCase = new CloseDrawShiftUseCase(repository);
  });

  it('closes an existing draw shift', async () => {
    const result = await useCase.execute({ shiftId: 'shift-id' });

    expect(result.isSuccess).toBe(true);
    expect(repository.closeShift.mock.calls[0][0]).toBe('shift-id');
  });

  it('fails when the shift does not exist', async () => {
    repository.closeShift.mockResolvedValue(null);

    const result = await useCase.execute({ shiftId: 'missing-id' });

    expect(result.isFailure).toBe(true);
  });
});
