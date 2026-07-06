import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildOffsetPagination, getOffsetSkip } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import {
  MarkAllNotificationsReadResult,
  Notification,
  NotificationUnreadCount,
} from '../../../domain/entities';
import {
  ListNotificationsQuery,
  NotificationsRepository,
} from '../../../domain/ports';

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListNotificationsQuery,
  ): Promise<PaginatedResult<Notification>> {
    const where: Prisma.notificacionesWhereInput = {
      usuario_id: query.userId,
      ...(query.type && { tipo: query.type }),
      ...(query.unread !== undefined && {
        leida_en: query.unread ? null : { not: null },
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificaciones.findMany({
        where,
        orderBy: this.orderBy(query),
        skip: getOffsetSkip(query),
        take: query.limit,
      }),
      this.prisma.notificaciones.count({ where }),
    ]);

    return buildOffsetPagination(
      items.map((item) => this.map(item)),
      total,
      query,
    );
  }

  async unreadCount(userId: string): Promise<NotificationUnreadCount> {
    return {
      unread: await this.prisma.notificaciones.count({
        where: { usuario_id: userId, leida_en: null },
      }),
    };
  }

  async markRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification | null> {
    await this.prisma.notificaciones.updateMany({
      where: { id: notificationId, usuario_id: userId },
      data: { leida_en: new Date() },
    });
    const notification = await this.prisma.notificaciones.findFirst({
      where: { id: notificationId, usuario_id: userId },
    });
    return notification ? this.map(notification) : null;
  }

  async markAllRead(userId: string): Promise<MarkAllNotificationsReadResult> {
    const readAt = new Date();
    const result = await this.prisma.notificaciones.updateMany({
      where: { usuario_id: userId, leida_en: null },
      data: { leida_en: readAt },
    });
    return { updatedCount: result.count, readAt };
  }

  private orderBy(
    query: ListNotificationsQuery,
  ): Prisma.notificacionesOrderByWithRelationInput {
    if (query.sortBy === 'type' || query.sortBy === 'tipo') {
      return { tipo: query.sortDirection };
    }
    if (query.sortBy === 'readAt' || query.sortBy === 'leida_en') {
      return { leida_en: query.sortDirection };
    }
    return { creado_en: query.sortDirection };
  }

  private map(record: {
    id: string;
    usuario_id: string;
    tipo: string;
    titulo: string;
    mensaje: string;
    datos: Prisma.JsonValue | null;
    leida_en: Date | null;
    creado_en: Date;
  }): Notification {
    return {
      id: record.id,
      userId: record.usuario_id,
      type: record.tipo,
      title: record.titulo,
      message: record.mensaje,
      data:
        record.datos &&
        typeof record.datos === 'object' &&
        !Array.isArray(record.datos)
          ? record.datos
          : null,
      readAt: record.leida_en,
      createdAt: record.creado_en,
    };
  }
}
