import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildOffsetPagination, getOffsetSkip } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import { AuditEvent, AuditEventPayload } from '../../../domain/entities';
import {
  AuditEventsRepository,
  ListAuditEventsQuery,
  RecordAuditEventInput,
} from '../../../domain/ports';

const auditEventInclude = {
  usuarios: {
    select: {
      id: true,
      username: true,
      nombre: true,
    },
  },
} satisfies Prisma.auditoria_eventosInclude;

type AuditEventRecord = Prisma.auditoria_eventosGetPayload<{
  include: typeof auditEventInclude;
}>;

@Injectable()
export class PrismaAuditEventsRepository implements AuditEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput): Promise<AuditEvent> {
    try {
      const event = await this.prisma.auditoria_eventos.create({
        data: {
          usuario_id: input.userId,
          evento: input.event,
          payload: this.toPrismaJson(input.payload),
        },
        include: auditEventInclude,
      });

      return this.mapEvent(event);
    } catch (error) {
      throw this.toAuditEventError(error);
    }
  }

  async findById(eventId: string): Promise<AuditEvent | null> {
    const id = this.toBigIntId(eventId);
    if (id === null) return null;

    const event = await this.prisma.auditoria_eventos.findUnique({
      where: {
        id,
      },
      include: auditEventInclude,
    });

    return event ? this.mapEvent(event) : null;
  }

  async list(
    query: ListAuditEventsQuery,
  ): Promise<PaginatedResult<AuditEvent>> {
    const where = this.toWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditoria_eventos.findMany({
        where,
        include: auditEventInclude,
        orderBy: this.toOrderBy(query),
        skip: getOffsetSkip(query),
        take: query.limit,
      }),
      this.prisma.auditoria_eventos.count({ where }),
    ]);

    return buildOffsetPagination(
      items.map((item) => this.mapEvent(item)),
      total,
      query,
    );
  }

  private toWhere(
    query: ListAuditEventsQuery,
  ): Prisma.auditoria_eventosWhereInput {
    return {
      ...(query.userId && { usuario_id: query.userId }),
      ...(query.event && {
        evento: {
          contains: query.event,
          mode: 'insensitive',
        },
      }),
      ...this.toCreatedAtWhere(query),
    };
  }

  private toCreatedAtWhere(
    query: ListAuditEventsQuery,
  ): Pick<Prisma.auditoria_eventosWhereInput, 'creado_en'> {
    if (!query.createdFrom && !query.createdUntil) return {};

    return {
      creado_en: {
        ...(query.createdFrom && {
          gte: this.toDateTimeStart(query.createdFrom),
        }),
        ...(query.createdUntil && {
          lt: this.toNextDateStart(query.createdUntil),
        }),
      },
    };
  }

  private toOrderBy(
    query: ListAuditEventsQuery,
  ): Prisma.auditoria_eventosOrderByWithRelationInput[] {
    const direction = query.sortDirection;

    switch (query.sortBy) {
      case 'event':
        return [{ evento: direction }, { creado_en: 'desc' }, { id: 'desc' }];
      case 'id':
        return [{ id: direction }];
      case 'createdAt':
      default:
        return [{ creado_en: direction }, { id: 'desc' }];
    }
  }

  private mapEvent(event: AuditEventRecord): AuditEvent {
    return {
      id: event.id.toString(),
      userId: event.usuario_id,
      event: event.evento,
      payload: this.mapPayload(event.payload),
      actor: event.usuarios
        ? {
            id: event.usuarios.id,
            username: event.usuarios.username,
            name: event.usuarios.nombre,
          }
        : null,
      createdAt: event.creado_en,
    };
  }

  private mapPayload(value: Prisma.JsonValue): AuditEventPayload {
    return value;
  }

  private toPrismaJson(
    value: AuditEventPayload | undefined,
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.JsonNull;

    return value as Prisma.InputJsonValue;
  }

  private toBigIntId(value: string): bigint | null {
    if (!/^\d+$/.test(value)) return null;

    return BigInt(value);
  }

  private toDateTimeStart(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private toNextDateStart(date: string): Date {
    const nextDate = this.toDateTimeStart(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    return nextDate;
  }

  private toAuditEventError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return new Error('Audit event references an invalid user');
      }
    }

    return error instanceof Error
      ? error
      : new Error('Could not persist audit event');
  }
}
