import { SalesMatrix, SalesMatrixRepository } from '../../domain';
import { GetSalesMatrixUseCase } from './get-sales-matrix.use-case';

const matrix: SalesMatrix = {
  filters: { date: '2026-07-01', status: 'ACTIVA' },
  rows: [],
  summary: {
    totalMiles: 1.9,
    salesCount: 2,
    itemsCount: 2,
    soldNumbersCount: 2,
  },
  realtime: {
    namespace: '/realtime',
    events: ['sales.created', 'sales.voided'],
    strategy: 'REFETCH',
  },
  generatedAt: new Date('2026-07-01T12:00:00.000Z'),
};

describe('GetSalesMatrixUseCase', () => {
  it('returns the complete administrative matrix snapshot', async () => {
    const repository: jest.Mocked<SalesMatrixRepository> = {
      get: jest.fn().mockResolvedValue(matrix),
    };
    const useCase = new GetSalesMatrixUseCase(repository);

    const result = await useCase.execute({
      date: '2026-07-01',
      drawCode: '11',
      status: 'ACTIVA',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.get.mock.calls[0][0]).toEqual({
      date: '2026-07-01',
      drawCode: '11',
      status: 'ACTIVA',
    });
  });

  it('maps persistence failures into an application error', async () => {
    const repository: jest.Mocked<SalesMatrixRepository> = {
      get: jest.fn().mockRejectedValue(new Error('Database unavailable')),
    };
    const useCase = new GetSalesMatrixUseCase(repository);

    const result = await useCase.execute({
      date: '2026-07-01',
      status: 'ACTIVA',
    });

    expect(result.isFailure).toBe(true);
    expect(result).toMatchObject({
      isFailure: true,
      error: { message: 'Database unavailable' },
    });
  });
});
