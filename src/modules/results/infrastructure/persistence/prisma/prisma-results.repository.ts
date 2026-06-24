import { Injectable } from '@nestjs/common';
import { Prisma, turno_estado, venta_estado } from '@prisma/client';
import { buildOffsetPagination, getOffsetSkip } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import { DrawResult, ResultWinnerSummary, WinningSale } from '../../../domain';
import {
  CreateResultInput,
  ListResultsQuery,
  ListWinningSalesQuery,
  ResultsRepository,
} from '../../../domain/ports';

const resultInclude = {
  usuarios: {
    select: {
      id: true,
      username: true,
      nombre: true,
    },
  },
  turnos: {
    include: {
      sorteos_config: true,
    },
  },
} satisfies Prisma.resultadosInclude;

const winningSaleInclude = {
  vendedores: {
    select: {
      id: true,
      nombre: true,
    },
  },
  turnos: {
    include: {
      sorteos_config: true,
    },
  },
  venta_detalle: {
    orderBy: {
      creado_en: 'asc',
    },
  },
  pagos_premios: true,
} satisfies Prisma.ventasInclude;

type ResultRecord = Prisma.resultadosGetPayload<{
  include: typeof resultInclude;
}>;

type WinningSaleRecord = Prisma.ventasGetPayload<{
  include: typeof winningSaleInclude;
}>;

@Injectable()
export class PrismaResultsRepository implements ResultsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateResultInput): Promise<DrawResult> {
    try {
      const shift = await this.prisma.turnos.findUnique({
        where: {
          id: input.shiftId,
        },
        select: {
          estado: true,
        },
      });

      if (!shift) {
        throw new Error('Draw shift not found');
      }

      if (shift.estado !== turno_estado.CERRADO) {
        throw new Error('Draw shift must be closed before registering result');
      }

      const result = await this.prisma.resultados.create({
        data: {
          turno_id: input.shiftId,
          numero_ganador: this.normalizeNumber(input.winningNumber),
          creado_por: input.createdByUserId,
        },
        include: resultInclude,
      });

      return this.mapResult(result);
    } catch (error) {
      throw this.toResultsError(error);
    }
  }

  async findById(resultId: string): Promise<DrawResult | null> {
    const result = await this.prisma.resultados.findUnique({
      where: {
        id: resultId,
      },
      include: resultInclude,
    });

    return result ? this.mapResult(result) : null;
  }

  async list(query: ListResultsQuery): Promise<PaginatedResult<DrawResult>> {
    const where = this.toWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.resultados.findMany({
        where,
        include: resultInclude,
        orderBy: this.toResultsOrderBy(query),
        skip: getOffsetSkip(query),
        take: query.limit,
      }),
      this.prisma.resultados.count({ where }),
    ]);

    return buildOffsetPagination(
      await Promise.all(items.map((item) => this.mapResult(item))),
      total,
      query,
    );
  }

  async listWinningSales(
    query: ListWinningSalesQuery,
  ): Promise<PaginatedResult<WinningSale> | null> {
    const result = await this.prisma.resultados.findUnique({
      where: {
        id: query.resultId,
      },
      select: {
        id: true,
        turno_id: true,
        numero_ganador: true,
      },
    });

    if (!result) {
      return null;
    }

    const where = this.toWinningSalesWhere(query, result);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ventas.findMany({
        where,
        include: winningSaleInclude,
        orderBy: this.toWinningSalesOrderBy(query),
        skip: getOffsetSkip(query),
        take: query.limit,
      }),
      this.prisma.ventas.count({ where }),
    ]);

    return buildOffsetPagination(
      items.map((item) => this.mapWinningSale(item, result.numero_ganador)),
      total,
      query,
    );
  }

  private toWhere(query: ListResultsQuery): Prisma.resultadosWhereInput {
    const shiftWhere: Prisma.TurnosScalarRelationFilter | undefined =
      query.date || query.drawCode
        ? {
            is: {
              ...(query.date && { fecha: this.toDateOnly(query.date) }),
              ...(query.drawCode && {
                sorteos_config: {
                  codigo: query.drawCode,
                },
              }),
            },
          }
        : undefined;

    return {
      ...(query.shiftId && { turno_id: query.shiftId }),
      ...(query.winningNumber && {
        numero_ganador: this.normalizeNumber(query.winningNumber),
      }),
      ...(query.createdByUserId && { creado_por: query.createdByUserId }),
      ...(shiftWhere && { turnos: shiftWhere }),
    };
  }

  private toWinningSalesWhere(
    query: ListWinningSalesQuery,
    result: Pick<ResultRecord, 'turno_id' | 'numero_ganador'>,
  ): Prisma.ventasWhereInput {
    return {
      turno_id: result.turno_id,
      estado: venta_estado.ACTIVA,
      ...(query.sellerId && { vendedor_id: query.sellerId }),
      ...(query.paid === true && {
        pagos_premios: {
          isNot: null,
        },
      }),
      ...(query.paid === false && {
        pagos_premios: {
          is: null,
        },
      }),
      venta_detalle: {
        some: {
          numero: result.numero_ganador,
        },
      },
    };
  }

  private toResultsOrderBy(
    query: ListResultsQuery,
  ): Prisma.resultadosOrderByWithRelationInput[] {
    const direction = query.sortDirection;

    switch (query.sortBy) {
      case 'winningNumber':
        return [
          { numero_ganador: direction },
          { creado_en: 'desc' },
          { id: 'asc' },
        ];
      case 'date':
        return [
          { turnos: { fecha: direction } },
          { creado_en: 'desc' },
          { id: 'asc' },
        ];
      case 'drawCode':
        return [
          { turnos: { sorteos_config: { codigo: direction } } },
          { creado_en: 'desc' },
          { id: 'asc' },
        ];
      case 'createdAt':
      default:
        return [{ creado_en: direction }, { id: 'asc' }];
    }
  }

  private toWinningSalesOrderBy(
    query: ListWinningSalesQuery,
  ): Prisma.ventasOrderByWithRelationInput[] {
    const direction = query.sortDirection;

    switch (query.sortBy) {
      case 'sellerName':
        return [
          { vendedores: { nombre: direction } },
          { creado_en: 'desc' },
          { id: 'asc' },
        ];
      case 'totalMiles':
        return [
          { total_miles: direction },
          { creado_en: 'desc' },
          { id: 'asc' },
        ];
      case 'createdAt':
      default:
        return [{ creado_en: direction }, { id: 'asc' }];
    }
  }

  private async mapResult(result: ResultRecord): Promise<DrawResult> {
    return {
      id: result.id,
      shift: {
        id: result.turnos.id,
        date: this.formatDateOnly(result.turnos.fecha),
        status: result.turnos.estado,
        configuration: {
          id: result.turnos.sorteos_config.id,
          code: result.turnos.sorteos_config.codigo,
          time: this.formatTime(result.turnos.sorteos_config.hora),
        },
      },
      winningNumber: result.numero_ganador,
      createdBy: result.usuarios
        ? {
            id: result.usuarios.id,
            username: result.usuarios.username,
            name: result.usuarios.nombre,
          }
        : null,
      createdAt: result.creado_en,
      winnerSummary: await this.buildWinnerSummary(result),
    };
  }

  private mapWinningSale(
    sale: WinningSaleRecord,
    winningNumber: string,
  ): WinningSale {
    const winningDetails = sale.venta_detalle
      .filter((detail) => detail.numero === winningNumber)
      .map((detail) => ({
        id: detail.id,
        number: detail.numero,
        prizeMiles: detail.premio_miles,
        createdAt: detail.creado_en,
      }));
    const winningPrizeMiles = winningDetails.reduce(
      (total, detail) => total + detail.prizeMiles,
      0,
    );

    return {
      saleId: sale.id,
      seller: {
        id: sale.vendedores.id,
        name: sale.vendedores.nombre,
      },
      shift: sale.turnos
        ? {
            id: sale.turnos.id,
            date: this.formatDateOnly(sale.turnos.fecha),
            status: sale.turnos.estado,
            configuration: {
              id: sale.turnos.sorteos_config.id,
              code: sale.turnos.sorteos_config.codigo,
              time: this.formatTime(sale.turnos.sorteos_config.hora),
            },
          }
        : null,
      saleStatus: sale.estado,
      saleTotalMiles: sale.total_miles,
      saleCreatedAt: sale.creado_en,
      winningPrizeMiles,
      winningDetails,
      paid: Boolean(sale.pagos_premios),
      payment: sale.pagos_premios
        ? {
            paidAmountMiles: sale.pagos_premios.monto_pagado_miles,
            paidByUserId: sale.pagos_premios.pagado_por,
            paidAt: sale.pagos_premios.pagado_en,
          }
        : null,
    };
  }

  private async buildWinnerSummary(
    result: Pick<ResultRecord, 'id' | 'turno_id' | 'numero_ganador'>,
  ): Promise<ResultWinnerSummary> {
    const winningSaleWhere: Prisma.ventasWhereInput = {
      turno_id: result.turno_id,
      estado: venta_estado.ACTIVA,
      venta_detalle: {
        some: {
          numero: result.numero_ganador,
        },
      },
    };
    const winningDetailWhere: Prisma.venta_detalleWhereInput = {
      numero: result.numero_ganador,
      ventas: {
        turno_id: result.turno_id,
        estado: venta_estado.ACTIVA,
      },
    };
    const [
      winningSalesCount,
      winningDetailTotals,
      paidSalesCount,
      paidPrizeTotals,
    ] = await this.prisma.$transaction([
      this.prisma.ventas.count({ where: winningSaleWhere }),
      this.prisma.venta_detalle.aggregate({
        where: winningDetailWhere,
        _sum: {
          premio_miles: true,
        },
      }),
      this.prisma.pagos_premios.count({
        where: {
          resultado_id: result.id,
        },
      }),
      this.prisma.pagos_premios.aggregate({
        where: {
          resultado_id: result.id,
        },
        _sum: {
          monto_pagado_miles: true,
        },
      }),
    ]);
    const totalPrizeMiles = winningDetailTotals._sum.premio_miles ?? 0;
    const paidPrizeMiles = paidPrizeTotals._sum.monto_pagado_miles ?? 0;

    return {
      winningSalesCount,
      totalPrizeMiles,
      paidSalesCount,
      paidPrizeMiles,
      pendingSalesCount: Math.max(winningSalesCount - paidSalesCount, 0),
      pendingPrizeMiles: Math.max(totalPrizeMiles - paidPrizeMiles, 0),
    };
  }

  private normalizeNumber(number: string): string {
    return number.replace(/\D/g, '').padStart(2, '0');
  }

  private toDateOnly(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private formatTime(time: Date): string {
    return time.toISOString().slice(11, 19);
  }

  private toResultsError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new Error('Result already exists for this draw shift');
      }

      if (error.code === 'P2003') {
        return new Error('Result references an invalid record');
      }
    }

    return error instanceof Error
      ? error
      : new Error('Could not persist result');
  }
}
