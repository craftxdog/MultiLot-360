import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildOffsetPagination, getOffsetSkip } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import { NumberLimit } from '../../../domain/entities';
import {
  CreateNumberLimitsInput,
  ExpireNumberLimitInput,
  ListNumberLimitsQuery,
  NumberLimitsRepository,
  UpdateNumberLimitInput,
} from '../../../domain/ports';

const numberLimitInclude = {
  vendedores: {
    select: {
      id: true,
      nombre: true,
    },
  },
  sorteos_config: true,
} satisfies Prisma.limites_numeroInclude;

type NumberLimitRecord = Prisma.limites_numeroGetPayload<{
  include: typeof numberLimitInclude;
}>;

@Injectable()
export class PrismaNumberLimitsRepository implements NumberLimitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(input: CreateNumberLimitsInput): Promise<NumberLimit[]> {
    try {
      const configId = await this.resolveDrawConfigurationId(
        input.drawConfigurationId,
        input.drawCode,
      );

      const records = await this.prisma.$transaction(
        input.numbers.map((number) =>
          this.prisma.limites_numero.create({
            data: {
              vendedor_id: input.sellerId ?? null,
              config_id: configId,
              numero: this.normalizeNumber(number),
              limite_miles: input.limitMiles,
              vigente_desde: this.toDateOnly(input.validFrom),
              vigente_hasta: input.validUntil
                ? this.toDateOnly(input.validUntil)
                : null,
            },
            include: numberLimitInclude,
          }),
        ),
      );

      return records.map((record) => this.mapLimit(record));
    } catch (error) {
      throw this.toNumberLimitsError(error);
    }
  }

  async findById(limitId: string): Promise<NumberLimit | null> {
    const limit = await this.prisma.limites_numero.findUnique({
      where: {
        id: limitId,
      },
      include: numberLimitInclude,
    });

    return limit ? this.mapLimit(limit) : null;
  }

  async update(input: UpdateNumberLimitInput): Promise<NumberLimit | null> {
    try {
      const configId = await this.resolveOptionalDrawConfigurationId(input);
      const limit = await this.prisma.limites_numero.update({
        where: {
          id: input.limitId,
        },
        data: {
          ...(input.sellerId !== undefined && {
            vendedor_id: input.sellerId,
          }),
          ...(configId !== undefined && {
            config_id: configId,
          }),
          ...(input.number !== undefined && {
            numero: this.normalizeNumber(input.number),
          }),
          ...(input.limitMiles !== undefined && {
            limite_miles: input.limitMiles,
          }),
          ...(input.validFrom !== undefined && {
            vigente_desde: this.toDateOnly(input.validFrom),
          }),
          ...(input.validUntil !== undefined && {
            vigente_hasta: input.validUntil
              ? this.toDateOnly(input.validUntil)
              : null,
          }),
        },
        include: numberLimitInclude,
      });

      return this.mapLimit(limit);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }

      throw this.toNumberLimitsError(error);
    }
  }

  async expire(input: ExpireNumberLimitInput): Promise<NumberLimit | null> {
    try {
      const limit = await this.prisma.limites_numero.update({
        where: {
          id: input.limitId,
        },
        data: {
          vigente_hasta: this.toDateOnly(input.expiresOn),
        },
        include: numberLimitInclude,
      });

      return this.mapLimit(limit);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }

      throw this.toNumberLimitsError(error);
    }
  }

  async list(
    query: ListNumberLimitsQuery,
  ): Promise<PaginatedResult<NumberLimit>> {
    const where = this.toWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.limites_numero.findMany({
        where,
        include: numberLimitInclude,
        orderBy: this.toOrderBy(query),
        skip: getOffsetSkip(query),
        take: query.limit,
      }),
      this.prisma.limites_numero.count({ where }),
    ]);

    return buildOffsetPagination(
      items.map((item) => this.mapLimit(item)),
      total,
      query,
    );
  }

  private toWhere(
    query: ListNumberLimitsQuery,
  ): Prisma.limites_numeroWhereInput {
    const validOn = this.toDateOnly(query.validOn ?? this.today());

    return {
      ...(query.sellerId && { vendedor_id: query.sellerId }),
      ...(query.drawConfigurationId && {
        config_id: query.drawConfigurationId,
      }),
      ...(query.drawCode && {
        sorteos_config: {
          codigo: query.drawCode,
        },
      }),
      ...(query.number && { numero: this.normalizeNumber(query.number) }),
      ...(query.sellerScope === 'GLOBAL' && { vendedor_id: null }),
      ...(query.sellerScope === 'SELLER' && {
        vendedor_id: {
          not: null,
        },
      }),
      ...(query.drawScope === 'DEFAULT' && { config_id: null }),
      ...(query.drawScope === 'DRAW' && {
        config_id: {
          not: null,
        },
      }),
      ...(query.active === true && {
        vigente_desde: {
          lte: validOn,
        },
        OR: [
          {
            vigente_hasta: null,
          },
          {
            vigente_hasta: {
              gte: validOn,
            },
          },
        ],
      }),
      ...(query.active === false && {
        OR: [
          {
            vigente_desde: {
              gt: validOn,
            },
          },
          {
            vigente_hasta: {
              lt: validOn,
            },
          },
        ],
      }),
    };
  }

  private toOrderBy(
    query: ListNumberLimitsQuery,
  ): Prisma.limites_numeroOrderByWithRelationInput[] {
    const direction = query.sortDirection;

    switch (query.sortBy) {
      case 'number':
        return [{ numero: direction }, { creado_en: 'desc' }, { id: 'asc' }];
      case 'limitMiles':
        return [{ limite_miles: direction }, { numero: 'asc' }, { id: 'asc' }];
      case 'validFrom':
        return [{ vigente_desde: direction }, { numero: 'asc' }, { id: 'asc' }];
      case 'validUntil':
        return [{ vigente_hasta: direction }, { numero: 'asc' }, { id: 'asc' }];
      case 'drawCode':
        return [
          { sorteos_config: { codigo: direction } },
          { numero: 'asc' },
          { id: 'asc' },
        ];
      case 'createdAt':
      default:
        return [{ creado_en: direction }, { id: 'asc' }];
    }
  }

  private async resolveOptionalDrawConfigurationId(
    input: UpdateNumberLimitInput,
  ): Promise<string | null | undefined> {
    const hasDrawConfigurationId = input.drawConfigurationId !== undefined;
    const hasDrawCode = input.drawCode !== undefined;

    if (!hasDrawConfigurationId && !hasDrawCode) {
      return undefined;
    }

    if (input.drawConfigurationId === null || input.drawCode === null) {
      return null;
    }

    return this.resolveDrawConfigurationId(
      input.drawConfigurationId ?? undefined,
      input.drawCode ?? undefined,
    );
  }

  private async resolveDrawConfigurationId(
    drawConfigurationId?: string,
    drawCode?: string,
  ): Promise<string | null> {
    if (drawConfigurationId && drawCode) {
      throw new Error('Use drawConfigurationId or drawCode, not both');
    }

    if (drawConfigurationId) {
      return drawConfigurationId;
    }

    if (!drawCode) {
      return null;
    }

    const configuration = await this.prisma.sorteos_config.findUnique({
      where: {
        codigo: drawCode,
      },
      select: {
        id: true,
      },
    });

    if (!configuration) {
      throw new Error(`Draw configuration "${drawCode}" does not exist`);
    }

    return configuration.id;
  }

  private mapLimit(limit: NumberLimitRecord): NumberLimit {
    return {
      id: limit.id,
      sellerScope: limit.vendedor_id ? 'SELLER' : 'GLOBAL',
      drawScope: limit.config_id ? 'DRAW' : 'DEFAULT',
      seller: limit.vendedores
        ? {
            id: limit.vendedores.id,
            name: limit.vendedores.nombre,
          }
        : null,
      drawConfiguration: limit.sorteos_config
        ? {
            id: limit.sorteos_config.id,
            code: limit.sorteos_config.codigo,
            time: this.formatTime(limit.sorteos_config.hora),
          }
        : null,
      number: limit.numero,
      limitMiles: limit.limite_miles,
      validFrom: this.formatDateOnly(limit.vigente_desde),
      validUntil: limit.vigente_hasta
        ? this.formatDateOnly(limit.vigente_hasta)
        : null,
      createdAt: limit.creado_en,
    };
  }

  private normalizeNumber(number: string): string {
    return number.replace(/\D/g, '').padStart(2, '0');
  }

  private toDateOnly(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
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

  private toNumberLimitsError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return new Error('Number limit references an invalid record');
      }

      if (error.code === 'P2002') {
        return new Error('Number limit already exists for the selected scope');
      }
    }

    if (error instanceof Error && error.message.includes('conflicting key')) {
      return new Error(
        'Number limit overlaps another limit for the same scope',
      );
    }

    return error instanceof Error
      ? error
      : new Error('Could not persist number limit');
  }
}
