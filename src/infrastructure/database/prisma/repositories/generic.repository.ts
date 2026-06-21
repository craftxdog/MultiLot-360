import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { IBulkRepository, IRepository, ITransactional } from './interfaces';
import { WriteRepository } from './write.repository';
import {
  BatchResult,
  DefaultTypeMap,
  ModelName,
  RepositoryTypeMap,
} from './types';

export class GenericRepository<
  T extends { id: string },
  M extends RepositoryTypeMap = DefaultTypeMap,
>
  extends WriteRepository<T, M>
  implements IBulkRepository<M>, ITransactional, IRepository<T, M>
{
  constructor(prisma: PrismaService, modelName: ModelName) {
    super(prisma, modelName);
  }

  async createMany(
    data: M['CreateInput'][],
    skipDuplicates = true,
  ): Promise<BatchResult> {
    return this.model.createMany({ data, skipDuplicates });
  }

  async updateMany(
    where: M['WhereInput'],
    data: M['UpdateInput'],
  ): Promise<BatchResult> {
    return this.model.updateMany({ where, data });
  }

  async deleteMany(where: M['WhereInput']): Promise<BatchResult> {
    return this.model.deleteMany({ where });
  }

  async transaction<R>(
    fn: (tx: Prisma.TransactionClient) => Promise<R>,
  ): Promise<R> {
    return this.prisma.$transaction(fn);
  }
}
