import { Injectable } from '@nestjs/common';
import { Prisma, venta_estado } from '@prisma/client';
import { buildOffsetPagination, getOffsetSkip } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import { PrizePayment } from '../../../domain/entities';
import {
  ListPrizePaymentsQuery,
  PayPrizeInput,
  PrizePaymentsRepository,
} from '../../../domain/ports';

const prizePaymentInclude = {
  usuarios: {
    select: {
      id: true,
      username: true,
      nombre: true,
    },
  },
  resultados: {
    include: {
      turnos: {
        include: {
          sorteos_config: true,
        },
      },
    },
  },
  ventas: {
    include: {
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
    },
  },
} satisfies Prisma.pagos_premiosInclude;

type PrizePaymentRecord = Prisma.pagos_premiosGetPayload<{
  include: typeof prizePaymentInclude;
}>;

@Injectable()
export class PrismaPrizePaymentsRepository implements PrizePaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async pay(input: PayPrizeInput): Promise<PrizePayment> {
    try {
      const result = await this.prisma.resultados.findUnique({
        where: {
          id: input.resultId,
        },
        select: {
          id: true,
          turno_id: true,
          numero_ganador: true,
        },
      });

      if (!result) {
        throw new Error('Result not found');
      }

      const sale = await this.prisma.ventas.findUnique({
        where: {
          id: input.saleId,
        },
        include: {
          venta_detalle: true,
          pagos_premios: true,
        },
      });

      if (!sale) {
        throw new Error('Sale not found');
      }

      if (sale.pagos_premios) {
        throw new Error('Prize payment already exists for this sale');
      }

      if (sale.estado !== venta_estado.ACTIVA) {
        throw new Error('Only active winning sales can be paid');
      }

      if (sale.turno_id !== result.turno_id) {
        throw new Error('Sale does not match the result draw shift');
      }

      const winningAmountMiles = sale.venta_detalle
        .filter((detail) => detail.numero === result.numero_ganador)
        .reduce((total, detail) => total + detail.premio_miles, 0);

      if (winningAmountMiles <= 0) {
        throw new Error('Sale is not a winner for this result');
      }

      const payment = await this.prisma.pagos_premios.create({
        data: {
          venta_id: input.saleId,
          resultado_id: input.resultId,
          monto_pagado_miles: winningAmountMiles,
          pagado_por: input.paidByUserId,
        },
        include: prizePaymentInclude,
      });

      return this.mapPayment(payment);
    } catch (error) {
      throw this.toPrizePaymentError(error);
    }
  }

  async findBySaleId(saleId: string): Promise<PrizePayment | null> {
    const payment = await this.prisma.pagos_premios.findUnique({
      where: {
        venta_id: saleId,
      },
      include: prizePaymentInclude,
    });

    return payment ? this.mapPayment(payment) : null;
  }

  async list(
    query: ListPrizePaymentsQuery,
  ): Promise<PaginatedResult<PrizePayment>> {
    const where = this.toWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.pagos_premios.findMany({
        where,
        include: prizePaymentInclude,
        orderBy: this.toOrderBy(query),
        skip: getOffsetSkip(query),
        take: query.limit,
      }),
      this.prisma.pagos_premios.count({ where }),
    ]);

    return buildOffsetPagination(
      items.map((item) => this.mapPayment(item)),
      total,
      query,
    );
  }

  private toWhere(
    query: ListPrizePaymentsQuery,
  ): Prisma.pagos_premiosWhereInput {
    return {
      ...(query.resultId && { resultado_id: query.resultId }),
      ...(query.saleId && { venta_id: query.saleId }),
      ...(query.paidByUserId && { pagado_por: query.paidByUserId }),
      ...this.toPaidAtWhere(query),
      ...((query.sellerId || query.date || query.drawCode) && {
        ventas: {
          ...(query.sellerId && { vendedor_id: query.sellerId }),
          ...((query.date || query.drawCode) && {
            turnos: {
              ...(query.date && { fecha: this.toDateOnly(query.date) }),
              ...(query.drawCode && {
                sorteos_config: {
                  codigo: query.drawCode,
                },
              }),
            },
          }),
        },
      }),
    };
  }

  private toPaidAtWhere(
    query: ListPrizePaymentsQuery,
  ): Pick<Prisma.pagos_premiosWhereInput, 'pagado_en'> {
    if (!query.paidFrom && !query.paidUntil) return {};

    return {
      pagado_en: {
        ...(query.paidFrom && { gte: this.toDateTimeStart(query.paidFrom) }),
        ...(query.paidUntil && { lt: this.toNextDateStart(query.paidUntil) }),
      },
    };
  }

  private toOrderBy(
    query: ListPrizePaymentsQuery,
  ): Prisma.pagos_premiosOrderByWithRelationInput[] {
    const direction = query.sortDirection;

    switch (query.sortBy) {
      case 'paidAmountMiles':
        return [
          { monto_pagado_miles: direction },
          { pagado_en: 'desc' },
          { venta_id: 'asc' },
        ];
      case 'sellerName':
        return [
          { ventas: { vendedores: { nombre: direction } } },
          { pagado_en: 'desc' },
          { venta_id: 'asc' },
        ];
      case 'drawCode':
        return [
          {
            resultados: {
              turnos: { sorteos_config: { codigo: direction } },
            },
          },
          { pagado_en: 'desc' },
          { venta_id: 'asc' },
        ];
      case 'paidAt':
      default:
        return [{ pagado_en: direction }, { venta_id: 'asc' }];
    }
  }

  private mapPayment(payment: PrizePaymentRecord): PrizePayment {
    return {
      saleId: payment.venta_id,
      result: {
        id: payment.resultado_id,
        winningNumber: payment.resultados.numero_ganador,
        shift: {
          id: payment.resultados.turnos.id,
          date: this.formatDateOnly(payment.resultados.turnos.fecha),
          status: payment.resultados.turnos.estado,
          configuration: {
            id: payment.resultados.turnos.sorteos_config.id,
            code: payment.resultados.turnos.sorteos_config.codigo,
            time: this.formatTime(
              payment.resultados.turnos.sorteos_config.hora,
            ),
          },
        },
      },
      sale: {
        id: payment.ventas.id,
        status: payment.ventas.estado,
        totalMiles: payment.ventas.total_miles,
        createdAt: payment.ventas.creado_en,
        seller: {
          id: payment.ventas.vendedores.id,
          name: payment.ventas.vendedores.nombre,
        },
        shift: payment.ventas.turnos
          ? {
              id: payment.ventas.turnos.id,
              date: this.formatDateOnly(payment.ventas.turnos.fecha),
              status: payment.ventas.turnos.estado,
              configuration: {
                id: payment.ventas.turnos.sorteos_config.id,
                code: payment.ventas.turnos.sorteos_config.codigo,
                time: this.formatTime(
                  payment.ventas.turnos.sorteos_config.hora,
                ),
              },
            }
          : null,
      },
      paidAmountMiles: payment.monto_pagado_miles,
      paidBy: payment.usuarios
        ? {
            id: payment.usuarios.id,
            username: payment.usuarios.username,
            name: payment.usuarios.nombre,
          }
        : null,
      paidAt: payment.pagado_en,
    };
  }

  private toDateOnly(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private toDateTimeStart(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private toNextDateStart(date: string): Date {
    const value = this.toDateTimeStart(date);
    value.setUTCDate(value.getUTCDate() + 1);
    return value;
  }

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private formatTime(time: Date): string {
    return time.toISOString().slice(11, 19);
  }

  private toPrizePaymentError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new Error('Prize payment already exists for this sale');
      }

      if (error.code === 'P2003') {
        return new Error('Prize payment references an invalid record');
      }
    }

    return error instanceof Error
      ? error
      : new Error('Could not persist prize payment');
  }
}
