import { Injectable } from '@nestjs/common';
import { Prisma, venta_estado } from '@prisma/client';
import { buildOffsetPagination } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import {
  OperationalOverviewReport,
  SellerOperationalReport,
} from '../../../domain/entities';
import {
  GetOperationalOverviewQuery,
  ListSellerOperationalReportsQuery,
  ReportsRepository,
} from '../../../domain/ports';

const reportSaleInclude = {
  vendedores: {
    select: {
      id: true,
      nombre: true,
    },
  },
  turnos: {
    include: {
      sorteos_config: true,
      resultados: true,
    },
  },
  venta_detalle: true,
  pagos_premios: true,
} satisfies Prisma.ventasInclude;

type ReportSaleRecord = Prisma.ventasGetPayload<{
  include: typeof reportSaleInclude;
}>;

@Injectable()
export class PrismaReportsRepository implements ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOperationalOverview(
    query: GetOperationalOverviewQuery,
  ): Promise<OperationalOverviewReport> {
    const sales = await this.findReportSales(query);
    const totals = this.sumSales(sales);

    return {
      filters: {
        dateFrom: query.dateFrom,
        dateUntil: query.dateUntil,
        sellerId: query.sellerId,
        drawCode: query.drawCode,
      },
      ...totals,
    };
  }

  async listSellerOperationalReports(
    query: ListSellerOperationalReportsQuery,
  ): Promise<PaginatedResult<SellerOperationalReport>> {
    const sales = await this.findReportSales(query);
    const items = this.buildSellerReports(sales, query);
    const start = (query.page - 1) * query.limit;
    const pagedItems = items.slice(start, start + query.limit);

    return buildOffsetPagination(pagedItems, items.length, query);
  }

  private async findReportSales(
    query: GetOperationalOverviewQuery,
  ): Promise<ReportSaleRecord[]> {
    return this.prisma.ventas.findMany({
      where: {
        ...(query.sellerId && { vendedor_id: query.sellerId }),
        turnos: {
          is: {
            fecha: {
              gte: this.toDateOnly(query.dateFrom),
              lte: this.toDateOnly(query.dateUntil),
            },
            ...(query.drawCode && {
              sorteos_config: {
                codigo: query.drawCode,
              },
            }),
          },
        },
      },
      include: reportSaleInclude,
    });
  }

  private buildSellerReports(
    sales: ReportSaleRecord[],
    query: ListSellerOperationalReportsQuery,
  ): SellerOperationalReport[] {
    const reports = new Map<string, SellerOperationalReport>();

    for (const sale of sales) {
      const current = reports.get(sale.vendedores.id) ?? {
        sellerId: sale.vendedores.id,
        sellerName: sale.vendedores.nombre,
        salesCount: 0,
        activeSalesCount: 0,
        voidedSalesCount: 0,
        grossSalesMiles: 0,
        voidedSalesMiles: 0,
        netSalesMiles: 0,
        winningPrizeMiles: 0,
        paidPrizesMiles: 0,
        pendingPrizesMiles: 0,
        balanceMiles: 0,
      };
      const saleTotals = this.sumSales([sale]);

      current.salesCount += saleTotals.salesCount;
      current.activeSalesCount += saleTotals.activeSalesCount;
      current.voidedSalesCount += saleTotals.voidedSalesCount;
      current.grossSalesMiles += saleTotals.grossSalesMiles;
      current.voidedSalesMiles += saleTotals.voidedSalesMiles;
      current.netSalesMiles += saleTotals.netSalesMiles;
      current.winningPrizeMiles += saleTotals.winningPrizeMiles;
      current.paidPrizesMiles += saleTotals.paidPrizesMiles;
      current.pendingPrizesMiles += saleTotals.pendingPrizesMiles;
      current.balanceMiles += saleTotals.balanceMiles;

      reports.set(sale.vendedores.id, current);
    }

    return this.sortSellerReports([...reports.values()], query);
  }

  private sortSellerReports(
    reports: SellerOperationalReport[],
    query: ListSellerOperationalReportsQuery,
  ): SellerOperationalReport[] {
    const direction = query.sortDirection === 'asc' ? 1 : -1;

    return reports.sort((left, right) => {
      switch (query.sortBy) {
        case 'netSalesMiles':
        case 'paidPrizesMiles':
        case 'balanceMiles':
          return (left[query.sortBy] - right[query.sortBy]) * direction;
        case 'sellerName':
        default:
          return left.sellerName.localeCompare(right.sellerName) * direction;
      }
    });
  }

  private sumSales(
    sales: ReportSaleRecord[],
  ): Omit<OperationalOverviewReport, 'filters'> {
    const totals = {
      salesCount: sales.length,
      activeSalesCount: 0,
      voidedSalesCount: 0,
      grossSalesMiles: 0,
      voidedSalesMiles: 0,
      netSalesMiles: 0,
      winningPrizeMiles: 0,
      paidPrizesMiles: 0,
      pendingPrizesMiles: 0,
      balanceMiles: 0,
    };

    for (const sale of sales) {
      const paidPrizesMiles = sale.pagos_premios?.monto_pagado_miles ?? 0;
      const winningPrizeMiles = this.getWinningPrizeMiles(sale);

      totals.grossSalesMiles += sale.total_miles;
      totals.winningPrizeMiles += winningPrizeMiles;
      totals.paidPrizesMiles += paidPrizesMiles;

      if (sale.estado === venta_estado.ACTIVA) {
        totals.activeSalesCount += 1;
        totals.netSalesMiles += sale.total_miles;
      }

      if (sale.estado === venta_estado.ANULADA) {
        totals.voidedSalesCount += 1;
        totals.voidedSalesMiles += sale.total_miles;
      }
    }

    totals.pendingPrizesMiles = Math.max(
      totals.winningPrizeMiles - totals.paidPrizesMiles,
      0,
    );
    totals.balanceMiles = totals.netSalesMiles - totals.paidPrizesMiles;

    return totals;
  }

  private getWinningPrizeMiles(sale: ReportSaleRecord): number {
    if (sale.estado !== venta_estado.ACTIVA) return 0;

    const winningNumber = sale.turnos?.resultados?.numero_ganador;
    if (!winningNumber) return 0;

    return sale.venta_detalle
      .filter((detail) => detail.numero === winningNumber)
      .reduce((total, detail) => total + detail.premio_miles, 0);
  }

  private toDateOnly(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }
}
