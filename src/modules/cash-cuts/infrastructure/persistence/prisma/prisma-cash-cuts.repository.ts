import { Injectable } from '@nestjs/common';
import { Prisma, venta_estado } from '@prisma/client';
import { buildOffsetPagination, getOffsetSkip } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import {
  CashCut,
  CashCutSellerSummary,
  CashCutSummary,
} from '../../../domain/entities';
import {
  CashCutsRepository,
  CreateCashCutInput,
  ListCashCutsQuery,
} from '../../../domain/ports';

const cashCutInclude = {
  usuarios: {
    select: {
      id: true,
      username: true,
      nombre: true,
    },
  },
} satisfies Prisma.cortesInclude;

const cashCutSaleInclude = {
  vendedores: {
    select: {
      id: true,
      nombre: true,
    },
  },
  pagos_premios: true,
} satisfies Prisma.ventasInclude;

type CashCutRecord = Prisma.cortesGetPayload<{
  include: typeof cashCutInclude;
}>;

type CashCutSaleRecord = Prisma.ventasGetPayload<{
  include: typeof cashCutSaleInclude;
}>;

@Injectable()
export class PrismaCashCutsRepository implements CashCutsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCashCutInput): Promise<CashCut> {
    try {
      const cut = await this.prisma.cortes.create({
        data: {
          fecha_inicio: this.toDateOnly(input.startDate),
          fecha_fin: this.toDateOnly(input.endDate),
          descripcion: input.description,
          visible_a_vendedores: input.visibleToSellers ?? true,
          creado_por: input.createdByUserId,
        },
        include: cashCutInclude,
      });

      return this.mapCut(cut);
    } catch (error) {
      throw this.toCashCutError(error);
    }
  }

  async findById(cutId: string): Promise<CashCut | null> {
    const cut = await this.prisma.cortes.findUnique({
      where: {
        id: cutId,
      },
      include: cashCutInclude,
    });

    return cut ? this.mapCut(cut) : null;
  }

  async list(query: ListCashCutsQuery): Promise<PaginatedResult<CashCut>> {
    const where = this.toWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cortes.findMany({
        where,
        include: cashCutInclude,
        orderBy: this.toOrderBy(query),
        skip: getOffsetSkip(query),
        take: query.limit,
      }),
      this.prisma.cortes.count({ where }),
    ]);

    return buildOffsetPagination(
      items.map((item) => this.mapCut(item)),
      total,
      query,
    );
  }

  async getSummary(cutId: string): Promise<CashCutSummary | null> {
    const cut = await this.prisma.cortes.findUnique({
      where: {
        id: cutId,
      },
      include: cashCutInclude,
    });

    if (!cut) return null;

    const sales = await this.prisma.ventas.findMany({
      where: {
        turnos: {
          is: {
            fecha: {
              gte: cut.fecha_inicio,
              lte: cut.fecha_fin,
            },
          },
        },
      },
      include: cashCutSaleInclude,
    });

    const sellers = this.buildSellerSummaries(sales);
    const totals = this.sumSummaries(sellers);

    return {
      cut: this.mapCut(cut),
      totals,
      sellers,
    };
  }

  private toWhere(query: ListCashCutsQuery): Prisma.cortesWhereInput {
    return {
      ...(query.startDate && {
        fecha_inicio: { gte: this.toDateOnly(query.startDate) },
      }),
      ...(query.endDate && {
        fecha_fin: { lte: this.toDateOnly(query.endDate) },
      }),
      ...(query.visibleToSellers !== undefined && {
        visible_a_vendedores: query.visibleToSellers,
      }),
      ...(query.createdByUserId && { creado_por: query.createdByUserId }),
    };
  }

  private toOrderBy(
    query: ListCashCutsQuery,
  ): Prisma.cortesOrderByWithRelationInput[] {
    const direction = query.sortDirection;

    switch (query.sortBy) {
      case 'startDate':
        return [
          { fecha_inicio: direction },
          { creado_en: 'desc' },
          { id: 'asc' },
        ];
      case 'endDate':
        return [{ fecha_fin: direction }, { creado_en: 'desc' }, { id: 'asc' }];
      case 'createdAt':
      default:
        return [{ creado_en: direction }, { id: 'asc' }];
    }
  }

  private buildSellerSummaries(
    sales: CashCutSaleRecord[],
  ): CashCutSellerSummary[] {
    const sellers = new Map<string, CashCutSellerSummary>();

    for (const sale of sales) {
      const summary = sellers.get(sale.vendedores.id) ?? {
        sellerId: sale.vendedores.id,
        sellerName: sale.vendedores.nombre,
        activeSalesCount: 0,
        voidedSalesCount: 0,
        grossSalesMiles: 0,
        voidedSalesMiles: 0,
        netSalesMiles: 0,
        paidPrizesMiles: 0,
        balanceMiles: 0,
      };

      summary.grossSalesMiles += sale.total_miles;

      if (sale.estado === venta_estado.ACTIVA) {
        summary.activeSalesCount += 1;
        summary.netSalesMiles += sale.total_miles;
      }

      if (sale.estado === venta_estado.ANULADA) {
        summary.voidedSalesCount += 1;
        summary.voidedSalesMiles += sale.total_miles;
      }

      summary.paidPrizesMiles += sale.pagos_premios?.monto_pagado_miles ?? 0;
      summary.balanceMiles = summary.netSalesMiles - summary.paidPrizesMiles;

      sellers.set(sale.vendedores.id, summary);
    }

    return [...sellers.values()].sort((left, right) =>
      left.sellerName.localeCompare(right.sellerName),
    );
  }

  private sumSummaries(
    sellers: CashCutSellerSummary[],
  ): CashCutSummary['totals'] {
    return sellers.reduce<CashCutSummary['totals']>(
      (totals, seller) => ({
        activeSalesCount: totals.activeSalesCount + seller.activeSalesCount,
        voidedSalesCount: totals.voidedSalesCount + seller.voidedSalesCount,
        grossSalesMiles: totals.grossSalesMiles + seller.grossSalesMiles,
        voidedSalesMiles: totals.voidedSalesMiles + seller.voidedSalesMiles,
        netSalesMiles: totals.netSalesMiles + seller.netSalesMiles,
        paidPrizesMiles: totals.paidPrizesMiles + seller.paidPrizesMiles,
        balanceMiles: totals.balanceMiles + seller.balanceMiles,
      }),
      {
        activeSalesCount: 0,
        voidedSalesCount: 0,
        grossSalesMiles: 0,
        voidedSalesMiles: 0,
        netSalesMiles: 0,
        paidPrizesMiles: 0,
        balanceMiles: 0,
      },
    );
  }

  private mapCut(cut: CashCutRecord): CashCut {
    return {
      id: cut.id,
      startDate: this.formatDateOnly(cut.fecha_inicio),
      endDate: this.formatDateOnly(cut.fecha_fin),
      description: cut.descripcion,
      visibleToSellers: cut.visible_a_vendedores,
      createdBy: cut.usuarios
        ? {
            id: cut.usuarios.id,
            username: cut.usuarios.username,
            name: cut.usuarios.nombre,
          }
        : null,
      createdAt: cut.creado_en,
    };
  }

  private toDateOnly(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toCashCutError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return new Error('Cash cut references an invalid user');
      }
    }

    return error instanceof Error
      ? error
      : new Error('Could not persist cash cut');
  }
}
