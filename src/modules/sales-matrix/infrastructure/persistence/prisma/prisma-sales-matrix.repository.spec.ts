import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PrismaSalesMatrixRepository } from './prisma-sales-matrix.repository';

describe('PrismaSalesMatrixRepository', () => {
  it('builds a stable 10x10 matrix and decimal summary from one snapshot', async () => {
    const records = Array.from({ length: 100 }, (_, index) => ({
      number: String(index).padStart(2, '0'),
      amount_miles: new Prisma.Decimal(
        index === 23 ? 1.4 : index === 45 ? 0.5 : 0,
      ),
      sales_count: BigInt(index === 23 || index === 45 ? 1 : 0),
      items_count: BigInt(index === 23 || index === 45 ? 1 : 0),
      total_sales_count: 2n,
    }));
    const queryRaw = jest.fn().mockResolvedValue(records);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const repository = new PrismaSalesMatrixRepository(prisma);

    const matrix = await repository.get({
      date: '2026-07-01',
      status: 'ACTIVA',
    });

    expect(matrix.rows).toHaveLength(10);
    expect(matrix.rows.every((row) => row.cells.length === 10)).toBe(true);
    expect(matrix.rows[2].cells[3]).toMatchObject({
      number: '23',
      amountMiles: 1.4,
      sold: true,
    });
    expect(matrix.rows[4].cells[5]).toMatchObject({
      number: '45',
      amountMiles: 0.5,
      sold: true,
    });
    expect(matrix.summary).toEqual({
      totalMiles: 1.9,
      salesCount: 2,
      itemsCount: 2,
      soldNumbersCount: 2,
    });
    expect(queryRaw.mock.calls).toHaveLength(1);
  });
});
