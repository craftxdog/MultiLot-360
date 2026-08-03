import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildOffsetPagination, getOffsetSkip } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import { SystemParameter } from '../../../domain/entities';
import {
  ListSystemParametersQuery,
  SystemParametersRepository,
  UpsertSystemParameterInput,
} from '../../../domain/ports';

type SystemParameterRecord = Prisma.parametrosGetPayload<object>;

@Injectable()
export class PrismaSystemParametersRepository implements SystemParametersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByKey(key: string): Promise<SystemParameter | null> {
    const parameter = await this.prisma.parametros.findFirst({
      where: {
        clave: key,
      },
    });

    return parameter ? this.mapParameter(parameter) : null;
  }

  async list(
    query: ListSystemParametersQuery,
  ): Promise<PaginatedResult<SystemParameter>> {
    const where = this.toWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.parametros.findMany({
        where,
        orderBy: this.toOrderBy(query),
        skip: getOffsetSkip(query),
        take: query.limit,
      }),
      this.prisma.parametros.count({ where }),
    ]);

    return buildOffsetPagination(
      items.map((item) => this.mapParameter(item)),
      total,
      query,
    );
  }

  async upsert(input: UpsertSystemParameterInput): Promise<SystemParameter> {
    const current = await this.prisma.parametros.findFirst({
      where: { clave: input.key },
      select: { tenant_id: true, clave: true },
    });
    const parameter = current
      ? await this.prisma.parametros.update({
          where: {
            tenant_id_clave: {
              tenant_id: current.tenant_id,
              clave: current.clave,
            },
          },
          data: { valor: input.value, actualizado_en: new Date() },
        })
      : await this.prisma.parametros.create({
          data: { clave: input.key, valor: input.value },
        });

    return this.mapParameter(parameter);
  }

  private toWhere(
    query: ListSystemParametersQuery,
  ): Prisma.parametrosWhereInput {
    return {
      ...(query.key && {
        clave: {
          contains: query.key,
          mode: 'insensitive',
        },
      }),
    };
  }

  private toOrderBy(
    query: ListSystemParametersQuery,
  ): Prisma.parametrosOrderByWithRelationInput[] {
    const direction = query.sortDirection;

    switch (query.sortBy) {
      case 'updatedAt':
        return [{ actualizado_en: direction }, { clave: 'asc' }];
      case 'key':
      default:
        return [{ clave: direction }];
    }
  }

  private mapParameter(parameter: SystemParameterRecord): SystemParameter {
    return {
      key: parameter.clave,
      value: parameter.valor,
      updatedAt: parameter.actualizado_en,
    };
  }
}
