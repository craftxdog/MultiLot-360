import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildOffsetPagination, getOffsetSkip } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import { BlockedNumber } from '../../../domain/entities';
import {
  BlockedNumbersRepository,
  CreateBlockedNumbersInput,
  ListBlockedNumbersQuery,
} from '../../../domain/ports';

const blockedNumberInclude = {
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
} satisfies Prisma.numeros_bloqueadosInclude;

type BlockedNumberRecord = Prisma.numeros_bloqueadosGetPayload<{
  include: typeof blockedNumberInclude;
}>;

@Injectable()
export class PrismaBlockedNumbersRepository implements BlockedNumbersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(input: CreateBlockedNumbersInput): Promise<BlockedNumber[]> {
    try {
      const records = await this.prisma.$transaction(
        input.numbers.map((number) =>
          this.prisma.numeros_bloqueados.create({
            data: {
              numero: this.normalizeNumber(number),
              turno_id: input.shiftId ?? null,
              fecha: input.date ? this.toDateOnly(input.date) : null,
              motivo: input.reason,
              creado_por: input.createdByUserId,
            },
            include: blockedNumberInclude,
          }),
        ),
      );

      return records.map((record) => this.mapBlockedNumber(record));
    } catch (error) {
      throw this.toBlockedNumbersError(error);
    }
  }

  async findById(blockId: string): Promise<BlockedNumber | null> {
    const block = await this.prisma.numeros_bloqueados.findUnique({
      where: {
        id: blockId,
      },
      include: blockedNumberInclude,
    });

    return block ? this.mapBlockedNumber(block) : null;
  }

  async list(
    query: ListBlockedNumbersQuery,
  ): Promise<PaginatedResult<BlockedNumber>> {
    const where = this.toWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.numeros_bloqueados.findMany({
        where,
        include: blockedNumberInclude,
        orderBy: this.toOrderBy(query),
        skip: getOffsetSkip(query),
        take: query.limit,
      }),
      this.prisma.numeros_bloqueados.count({ where }),
    ]);

    return buildOffsetPagination(
      items.map((item) => this.mapBlockedNumber(item)),
      total,
      query,
    );
  }

  async delete(blockId: string): Promise<BlockedNumber | null> {
    try {
      const block = await this.prisma.numeros_bloqueados.delete({
        where: {
          id: blockId,
        },
        include: blockedNumberInclude,
      });

      return this.mapBlockedNumber(block);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }

      throw this.toBlockedNumbersError(error);
    }
  }

  private toWhere(
    query: ListBlockedNumbersQuery,
  ): Prisma.numeros_bloqueadosWhereInput {
    const shiftWhere: Prisma.TurnosNullableScalarRelationFilter | undefined =
      query.drawCode
        ? {
            is: {
              sorteos_config: {
                codigo: query.drawCode,
              },
            },
          }
        : undefined;

    return {
      ...(query.number && { numero: this.normalizeNumber(query.number) }),
      ...(query.shiftId && { turno_id: query.shiftId }),
      ...(query.date && { fecha: this.toDateOnly(query.date) }),
      ...(query.createdByUserId && { creado_por: query.createdByUserId }),
      ...(query.scope === 'DATE' && { turno_id: null }),
      ...(query.scope === 'SHIFT' && {
        turno_id: {
          not: null,
        },
      }),
      ...(shiftWhere && { turnos: shiftWhere }),
    };
  }

  private toOrderBy(
    query: ListBlockedNumbersQuery,
  ): Prisma.numeros_bloqueadosOrderByWithRelationInput[] {
    const direction = query.sortDirection;

    switch (query.sortBy) {
      case 'number':
        return [{ numero: direction }, { creado_en: 'desc' }, { id: 'asc' }];
      case 'date':
        return [{ fecha: direction }, { creado_en: 'desc' }, { id: 'asc' }];
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

  private mapBlockedNumber(block: BlockedNumberRecord): BlockedNumber {
    return {
      id: block.id,
      scope: block.turno_id ? 'SHIFT' : 'DATE',
      number: block.numero,
      date: block.fecha ? this.formatDateOnly(block.fecha) : null,
      shift: block.turnos
        ? {
            id: block.turnos.id,
            date: this.formatDateOnly(block.turnos.fecha),
            status: block.turnos.estado,
            configuration: {
              id: block.turnos.sorteos_config.id,
              code: block.turnos.sorteos_config.codigo,
              time: this.formatTime(block.turnos.sorteos_config.hora),
            },
          }
        : null,
      reason: block.motivo,
      createdBy: block.usuarios
        ? {
            id: block.usuarios.id,
            username: block.usuarios.username,
            name: block.usuarios.nombre,
          }
        : null,
      createdAt: block.creado_en,
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

  private isNotFoundError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }

  private toBlockedNumbersError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new Error('Number is already blocked for the selected scope');
      }

      if (error.code === 'P2003') {
        return new Error('Blocked number references an invalid record');
      }
    }

    return error instanceof Error
      ? error
      : new Error('Could not persist blocked number');
  }
}
