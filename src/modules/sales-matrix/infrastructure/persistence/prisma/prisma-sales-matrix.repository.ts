import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addMoney, toMoneyNumber } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import {
  SalesMatrix,
  SalesMatrixCell,
  SalesMatrixFilters,
} from '../../../domain/entities';
import { SalesMatrixRepository } from '../../../domain/ports';

type MatrixRecord = {
  number: string;
  amount_miles: Prisma.Decimal;
  sales_count: bigint;
  items_count: bigint;
  total_sales_count: bigint;
};

@Injectable()
export class PrismaSalesMatrixRepository implements SalesMatrixRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(filters: SalesMatrixFilters): Promise<SalesMatrix> {
    const conditions = this.buildConditions(filters);
    const where = Prisma.join(conditions, ' AND ');
    const records = await this.prisma.$queryRaw<MatrixRecord[]>(Prisma.sql`
      WITH filtered_details AS (
        SELECT
          BTRIM(d.numero)::text AS number,
          d.premio_miles,
          d.venta_id
        FROM public.venta_detalle d
        JOIN public.ventas v ON v.id = d.venta_id
        JOIN public.turnos t ON t.id = v.turno_id
        JOIN public.sorteos_config c ON c.id = t.config_id
        WHERE ${where}
      ), number_totals AS (
        SELECT
          number,
          COALESCE(SUM(premio_miles), 0::numeric) AS amount_miles,
          COUNT(DISTINCT venta_id) AS sales_count,
          COUNT(*) AS items_count
        FROM filtered_details
        GROUP BY number
      ), matrix_summary AS (
        SELECT COUNT(DISTINCT venta_id)::bigint AS total_sales_count
        FROM filtered_details
      )
      SELECT
        LPAD(series.number::text, 2, '0') AS number,
        COALESCE(totals.amount_miles, 0::numeric) AS amount_miles,
        COALESCE(totals.sales_count, 0)::bigint AS sales_count,
        COALESCE(totals.items_count, 0)::bigint AS items_count,
        matrix_summary.total_sales_count
      FROM generate_series(0, 99) AS series(number)
      CROSS JOIN matrix_summary
      LEFT JOIN number_totals totals
        ON totals.number = LPAD(series.number::text, 2, '0')
      ORDER BY series.number
    `);

    const cells = records.map((record) => this.mapCell(record));
    const rows = Array.from({ length: 10 }, (_, row) => ({
      row,
      cells: cells.slice(row * 10, row * 10 + 10),
    }));

    return {
      filters,
      rows,
      summary: {
        totalMiles: addMoney(...cells.map((cell) => cell.amountMiles)),
        salesCount: Number(records[0]?.total_sales_count ?? 0),
        itemsCount: cells.reduce((total, cell) => total + cell.itemsCount, 0),
        soldNumbersCount: cells.filter((cell) => cell.sold).length,
      },
      realtime: {
        namespace: '/realtime',
        events: ['sales.created', 'sales.voided'],
        strategy: 'REFETCH',
      },
      generatedAt: new Date(),
    };
  }

  private buildConditions(filters: SalesMatrixFilters): Prisma.Sql[] {
    return [
      Prisma.sql`t.fecha = ${this.toDateOnly(filters.date)}`,
      ...(filters.shiftId
        ? [Prisma.sql`v.turno_id = ${filters.shiftId}::uuid`]
        : []),
      ...(filters.drawCode ? [Prisma.sql`c.codigo = ${filters.drawCode}`] : []),
      ...(filters.sellerId
        ? [Prisma.sql`v.vendedor_id = ${filters.sellerId}::uuid`]
        : []),
      ...(filters.status !== 'TODAS'
        ? [Prisma.sql`v.estado = ${filters.status}::public.venta_estado`]
        : []),
    ];
  }

  private mapCell(record: MatrixRecord): SalesMatrixCell {
    const amountMiles = toMoneyNumber(record.amount_miles);

    return {
      number: record.number,
      amountMiles,
      salesCount: Number(record.sales_count),
      itemsCount: Number(record.items_count),
      sold: amountMiles > 0,
    };
  }

  private toDateOnly(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }
}
