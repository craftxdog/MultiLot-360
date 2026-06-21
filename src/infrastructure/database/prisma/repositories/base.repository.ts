import { PrismaService } from '../prisma.service';
import { ModelName, PrismaDelegate } from './types';

export abstract class BaseRepository<T> {
  protected readonly model: PrismaDelegate<T>;

  protected constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelName: ModelName,
  ) {
    this.model = (prisma as unknown as Record<string, PrismaDelegate<T>>)[
      modelName
    ];

    if (!this.model) {
      throw new Error(`Model "${modelName}" not found in Prisma client`);
    }
  }

  protected mergeWhere<TWhere>(
    baseWhere?: TWhere,
    extraWhere?: Record<string, unknown>,
  ): TWhere {
    return {
      ...((baseWhere ?? {}) as Record<string, unknown>),
      ...(extraWhere ?? {}),
    } as TWhere;
  }

  protected buildOrderBy<TOrderBy>(
    sortBy: string,
    sortDirection: 'asc' | 'desc',
  ): TOrderBy {
    return { [sortBy]: sortDirection } as TOrderBy;
  }
}
