import { Injectable } from '@nestjs/common';
import { Prisma, venta_estado } from '@prisma/client';
import {
  addMoney,
  buildOffsetPagination,
  toMoneyNumber,
} from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import {
  BusinessAnalyticsDayKpi,
  BusinessAnalyticsNumberKpi,
  BusinessAnalyticsReport,
  BusinessAnalyticsSellerKpi,
  OperationalOverviewReport,
  SellerOperationalReport,
} from '../../../domain/entities';
import {
  GetBusinessAnalyticsQuery,
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

  async getBusinessAnalytics(
    query: GetBusinessAnalyticsQuery,
  ): Promise<BusinessAnalyticsReport> {
    const sales = await this.findReportSales(query);
    const totals = this.sumSales(sales);
    const sellers = this.buildAnalyticsSellerKpis(sales, totals.netSalesMiles);
    const topNumbers = this.buildAnalyticsNumberKpis(sales);
    const days = this.buildAnalyticsDayKpis(sales);
    const topLimit = query.topLimit;

    return {
      filters: {
        dateFrom: query.dateFrom,
        dateUntil: query.dateUntil,
        sellerId: query.sellerId,
        drawCode: query.drawCode,
        topLimit,
      },
      summary: {
        ...totals,
        averageTicketMiles: this.averageMoney(
          totals.netSalesMiles,
          totals.activeSalesCount,
        ),
        activeSellersCount: sellers.filter((seller) => seller.netSalesMiles > 0)
          .length,
        numbersSoldCount: sales
          .filter((sale) => sale.estado === venta_estado.ACTIVA)
          .reduce((total, sale) => total + sale.venta_detalle.length, 0),
        bestSeller: sellers[0]
          ? {
              sellerId: sellers[0].sellerId,
              sellerName: sellers[0].sellerName,
              netSalesMiles: sellers[0].netSalesMiles,
            }
          : null,
        bestNumber: topNumbers[0]
          ? {
              number: topNumbers[0].number,
              netSalesMiles: topNumbers[0].netSalesMiles,
              ticketsCount: topNumbers[0].ticketsCount,
            }
          : null,
        bestDay: days[0]
          ? {
              date: days[0].date,
              netSalesMiles: days[0].netSalesMiles,
              salesCount: days[0].salesCount,
            }
          : null,
      },
      sellers: sellers.slice(0, topLimit),
      topNumbers: topNumbers.slice(0, topLimit),
      bestDays: days.slice(0, topLimit),
      trend: [...days].sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
      projection: this.buildProjection(query, days),
    };
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
      current.grossSalesMiles = addMoney(
        current.grossSalesMiles,
        saleTotals.grossSalesMiles,
      );
      current.voidedSalesMiles = addMoney(
        current.voidedSalesMiles,
        saleTotals.voidedSalesMiles,
      );
      current.netSalesMiles = addMoney(
        current.netSalesMiles,
        saleTotals.netSalesMiles,
      );
      current.winningPrizeMiles = addMoney(
        current.winningPrizeMiles,
        saleTotals.winningPrizeMiles,
      );
      current.paidPrizesMiles = addMoney(
        current.paidPrizesMiles,
        saleTotals.paidPrizesMiles,
      );
      current.pendingPrizesMiles = addMoney(
        current.pendingPrizesMiles,
        saleTotals.pendingPrizesMiles,
      );
      current.balanceMiles = addMoney(
        current.balanceMiles,
        saleTotals.balanceMiles,
      );

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

  private buildAnalyticsSellerKpis(
    sales: ReportSaleRecord[],
    totalNetSalesMiles: number,
  ): BusinessAnalyticsSellerKpi[] {
    return this.buildSellerReports(sales, {
      dateFrom: '',
      dateUntil: '',
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
      sortBy: 'netSalesMiles',
      sortDirection: 'desc',
    }).map((seller) => {
      const numbersSoldCount = sales
        .filter(
          (sale) =>
            sale.vendedores.id === seller.sellerId &&
            sale.estado === venta_estado.ACTIVA,
        )
        .reduce((total, sale) => total + sale.venta_detalle.length, 0);

      return {
        sellerId: seller.sellerId,
        sellerName: seller.sellerName,
        salesCount: seller.salesCount,
        activeSalesCount: seller.activeSalesCount,
        voidedSalesCount: seller.voidedSalesCount,
        netSalesMiles: seller.netSalesMiles,
        grossSalesMiles: seller.grossSalesMiles,
        paidPrizesMiles: seller.paidPrizesMiles,
        balanceMiles: seller.balanceMiles,
        averageTicketMiles: this.averageMoney(
          seller.netSalesMiles,
          seller.activeSalesCount,
        ),
        numbersSoldCount,
        contributionPercent: this.percent(
          seller.netSalesMiles,
          totalNetSalesMiles,
        ),
      };
    });
  }

  private buildAnalyticsNumberKpis(
    sales: ReportSaleRecord[],
  ): BusinessAnalyticsNumberKpi[] {
    const numbers = new Map<
      string,
      { sellers: Set<string>; ticketsCount: number; netSalesMiles: number }
    >();

    for (const sale of sales) {
      if (sale.estado !== venta_estado.ACTIVA) continue;

      for (const detail of sale.venta_detalle) {
        const current = numbers.get(detail.numero) ?? {
          sellers: new Set<string>(),
          ticketsCount: 0,
          netSalesMiles: 0,
        };

        current.sellers.add(sale.vendedores.id);
        current.ticketsCount += 1;
        current.netSalesMiles = addMoney(
          current.netSalesMiles,
          detail.premio_miles,
        );
        numbers.set(detail.numero, current);
      }
    }

    return [...numbers.entries()]
      .map(([number, value]) => ({
        number,
        ticketsCount: value.ticketsCount,
        sellersCount: value.sellers.size,
        netSalesMiles: value.netSalesMiles,
        averagePrizeMiles: this.averageMoney(
          value.netSalesMiles,
          value.ticketsCount,
        ),
      }))
      .sort(
        (left, right) =>
          right.netSalesMiles - left.netSalesMiles ||
          right.ticketsCount - left.ticketsCount ||
          left.number.localeCompare(right.number),
      );
  }

  private buildAnalyticsDayKpis(
    sales: ReportSaleRecord[],
  ): BusinessAnalyticsDayKpi[] {
    const days = new Map<
      string,
      {
        salesCount: number;
        sellers: Set<string>;
        netSalesMiles: number;
        grossSalesMiles: number;
      }
    >();

    for (const sale of sales) {
      const date = this.toReportDate(sale);
      const current = days.get(date) ?? {
        salesCount: 0,
        sellers: new Set<string>(),
        netSalesMiles: 0,
        grossSalesMiles: 0,
      };
      const saleTotalMiles = toMoneyNumber(sale.total_miles);

      current.salesCount += 1;
      current.sellers.add(sale.vendedores.id);
      current.grossSalesMiles = addMoney(
        current.grossSalesMiles,
        saleTotalMiles,
      );

      if (sale.estado === venta_estado.ACTIVA) {
        current.netSalesMiles = addMoney(current.netSalesMiles, saleTotalMiles);
      }

      days.set(date, current);
    }

    return [...days.entries()]
      .map(([date, value]) => ({
        date,
        salesCount: value.salesCount,
        sellersCount: value.sellers.size,
        netSalesMiles: value.netSalesMiles,
        grossSalesMiles: value.grossSalesMiles,
        averageTicketMiles: this.averageMoney(
          value.netSalesMiles,
          value.salesCount,
        ),
      }))
      .sort(
        (left, right) =>
          right.netSalesMiles - left.netSalesMiles ||
          right.salesCount - left.salesCount ||
          left.date.localeCompare(right.date),
      );
  }

  private buildProjection(
    query: GetBusinessAnalyticsQuery,
    days: BusinessAnalyticsDayKpi[],
  ): BusinessAnalyticsReport['projection'] {
    const periodDays = Math.max(
      this.daysBetweenInclusive(query.dateFrom, query.dateUntil),
      1,
    );
    const netSalesMiles = days.reduce(
      (total, day) => addMoney(total, day.netSalesMiles),
      0,
    );
    const averageDailyNetSalesMiles = this.averageMoney(
      netSalesMiles,
      periodDays,
    );

    return {
      periodDays,
      averageDailyNetSalesMiles,
      projectedNext7DaysNetSalesMiles: addMoney(averageDailyNetSalesMiles * 7),
      projectedNext30DaysNetSalesMiles: addMoney(
        averageDailyNetSalesMiles * 30,
      ),
    };
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
      const paidPrizesMiles = toMoneyNumber(
        sale.pagos_premios?.monto_pagado_miles,
      );
      const winningPrizeMiles = this.getWinningPrizeMiles(sale);
      const saleTotalMiles = toMoneyNumber(sale.total_miles);

      totals.grossSalesMiles = addMoney(totals.grossSalesMiles, saleTotalMiles);
      totals.winningPrizeMiles = addMoney(
        totals.winningPrizeMiles,
        winningPrizeMiles,
      );
      totals.paidPrizesMiles = addMoney(
        totals.paidPrizesMiles,
        paidPrizesMiles,
      );

      if (sale.estado === venta_estado.ACTIVA) {
        totals.activeSalesCount += 1;
        totals.netSalesMiles = addMoney(totals.netSalesMiles, saleTotalMiles);
      }

      if (sale.estado === venta_estado.ANULADA) {
        totals.voidedSalesCount += 1;
        totals.voidedSalesMiles = addMoney(
          totals.voidedSalesMiles,
          saleTotalMiles,
        );
      }
    }

    totals.pendingPrizesMiles = Math.max(
      addMoney(totals.winningPrizeMiles, -totals.paidPrizesMiles),
      0,
    );
    totals.balanceMiles = addMoney(
      totals.netSalesMiles,
      -totals.paidPrizesMiles,
    );

    return totals;
  }

  private getWinningPrizeMiles(sale: ReportSaleRecord): number {
    if (sale.estado !== venta_estado.ACTIVA) return 0;

    const winningNumber = sale.turnos?.resultados?.numero_ganador;
    if (!winningNumber) return 0;

    return sale.venta_detalle
      .filter((detail) => detail.numero === winningNumber)
      .reduce((total, detail) => addMoney(total, detail.premio_miles), 0);
  }

  private averageMoney(total: number, count: number): number {
    if (count <= 0) return 0;

    return addMoney(total / count);
  }

  private percent(value: number, total: number): number {
    if (total <= 0) return 0;

    return addMoney((value / total) * 100);
  }

  private toReportDate(sale: ReportSaleRecord): string {
    const date = sale.turnos?.fecha ?? sale.creado_en;

    return date.toISOString().slice(0, 10);
  }

  private daysBetweenInclusive(dateFrom: string, dateUntil: string): number {
    const from = this.toDateOnly(dateFrom).getTime();
    const until = this.toDateOnly(dateUntil).getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    return Math.floor((until - from) / dayMs) + 1;
  }

  private toDateOnly(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }
}
