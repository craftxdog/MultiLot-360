import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildOffsetPagination, getOffsetSkip } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import { Sale } from '../../../domain/entities';
import {
  CreateSaleInput,
  ListSalesQuery,
  SalesRepository,
  VoidSaleInput,
} from '../../../domain/ports';

const saleInclude = {
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
} satisfies Prisma.ventasInclude;

type SaleRecord = Prisma.ventasGetPayload<{
  include: typeof saleInclude;
}>;

@Injectable()
export class PrismaSalesRepository implements SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSaleInput): Promise<Sale> {
    try {
      await this.assertSellerCanSell(input.sellerId);
      await this.assertShiftCanReceiveSales(input.shiftId);

      const sale = await this.prisma.ventas.create({
        data: {
          vendedor_id: input.sellerId,
          turno_id: input.shiftId,
          total_miles: this.sumTotalMiles(input.items),
          venta_detalle: {
            create: input.items.map((item) => ({
              numero: this.normalizeNumber(item.number),
              premio_miles: item.prizeMiles,
            })),
          },
        },
        include: saleInclude,
      });

      return this.mapSale(sale);
    } catch (error) {
      throw this.toSalesError(error);
    }
  }

  async findById(saleId: string): Promise<Sale | null> {
    const sale = await this.prisma.ventas.findUnique({
      where: {
        id: saleId,
      },
      include: saleInclude,
    });

    return sale ? this.mapSale(sale) : null;
  }

  async list(query: ListSalesQuery): Promise<PaginatedResult<Sale>> {
    const where = this.toWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ventas.findMany({
        where,
        include: saleInclude,
        orderBy: this.toOrderBy(query),
        skip: getOffsetSkip(query),
        take: query.limit,
      }),
      this.prisma.ventas.count({ where }),
    ]);

    return buildOffsetPagination(
      items.map((item) => this.mapSale(item)),
      total,
      query,
    );
  }

  async void(input: VoidSaleInput): Promise<Sale | null> {
    try {
      const sale = await this.prisma.ventas.update({
        where: {
          id: input.saleId,
        },
        data: {
          estado: 'ANULADA',
          anulada_por: input.voidedByUserId,
          anulada_en: new Date(),
          motivo_anulacion: input.reason,
        },
        include: saleInclude,
      });

      return this.mapSale(sale);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }

      throw this.toSalesError(error);
    }
  }

  private async assertSellerCanSell(sellerId: string): Promise<void> {
    const seller = await this.prisma.vendedores.findUnique({
      where: {
        id: sellerId,
      },
      select: {
        activo: true,
      },
    });

    if (!seller) {
      throw new Error('Seller not found');
    }

    if (!seller.activo) {
      throw new Error('Seller is inactive');
    }
  }

  private async assertShiftCanReceiveSales(shiftId: string): Promise<void> {
    const shift = await this.prisma.turnos.findUnique({
      where: {
        id: shiftId,
      },
      select: {
        estado: true,
      },
    });

    if (!shift) {
      throw new Error('Draw shift not found');
    }

    if (shift.estado !== 'ABIERTO') {
      throw new Error('Draw shift is closed for sales');
    }
  }

  private toWhere(query: ListSalesQuery): Prisma.ventasWhereInput {
    const shiftWhere: Prisma.TurnosNullableScalarRelationFilter | undefined =
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
      ...(query.sellerId && { vendedor_id: query.sellerId }),
      ...(query.shiftId && { turno_id: query.shiftId }),
      ...(query.status && { estado: query.status }),
      ...(shiftWhere && { turnos: shiftWhere }),
      ...(query.number && {
        venta_detalle: {
          some: {
            numero: this.normalizeNumber(query.number),
          },
        },
      }),
    };
  }

  private toOrderBy(
    query: ListSalesQuery,
  ): Prisma.ventasOrderByWithRelationInput[] {
    const direction = query.sortDirection;

    switch (query.sortBy) {
      case 'totalMiles':
        return [
          { total_miles: direction },
          { creado_en: 'desc' },
          { id: 'asc' },
        ];
      case 'status':
        return [{ estado: direction }, { creado_en: 'desc' }, { id: 'asc' }];
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
      case 'sellerName':
        return [
          { vendedores: { nombre: direction } },
          { creado_en: 'desc' },
          { id: 'asc' },
        ];
      case 'createdAt':
      default:
        return [{ creado_en: direction }, { id: 'asc' }];
    }
  }

  private mapSale(sale: SaleRecord): Sale {
    return {
      id: sale.id,
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
      status: sale.estado,
      totalMiles: sale.total_miles,
      details: sale.venta_detalle.map((detail) => ({
        id: detail.id,
        number: detail.numero,
        prizeMiles: detail.premio_miles,
        createdAt: detail.creado_en,
      })),
      createdAt: sale.creado_en,
      voidedByUserId: sale.anulada_por,
      voidedAt: sale.anulada_en,
      voidReason: sale.motivo_anulacion,
    };
  }

  private sumTotalMiles(items: CreateSaleInput['items']): number {
    return items.reduce((total, item) => total + item.prizeMiles, 0);
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

  private isNotFoundError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }

  private toSalesError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return new Error('Sale references an invalid record');
      }

      if (error.code === 'P2025') {
        return new Error('Sale not found');
      }
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('bloqueado') || message.includes('blocked')) {
        return new Error('Number is blocked for this draw shift');
      }

      if (message.includes('limite') || message.includes('limit')) {
        return new Error('Number limit reached for this draw shift');
      }

      return error;
    }

    return new Error('Could not persist sale');
  }
}
