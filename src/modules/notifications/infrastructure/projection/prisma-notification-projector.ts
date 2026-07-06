import { Injectable } from '@nestjs/common';
import { Prisma, venta_estado } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma';
import {
  IntegrationEventEnvelope,
  OPERATIONAL_EVENTS,
} from '../../../../shared-kernel';
import { Notification } from '../../domain/entities';
import { NotificationProjector } from '../../domain/ports';

type NotificationDraft = {
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  dedupKey: string;
};

type SellerRecipient = {
  sellerId: string;
  userId: string;
  name: string;
};

type SalesMilestoneConfig = {
  enabled: boolean;
  thresholdMiles?: number;
  thresholdSalesCount?: number;
  sellerTitle: string;
  sellerMessage: string;
  adminTitle: string;
  adminMessage: string;
};

const DEFAULT_MILESTONE_CONFIG: SalesMilestoneConfig = {
  enabled: true,
  thresholdMiles: 100,
  sellerTitle: 'Meta de ventas alcanzada',
  sellerMessage:
    '¡Felicidades {{sellerName}}! Has vendido {{totalMiles}} mil en este turno.',
  adminTitle: 'Vendedor alcanzó una meta',
  adminMessage:
    '{{sellerName}} alcanzó {{totalMiles}} mil vendidos en el turno {{shiftId}}.',
};

@Injectable()
export class PrismaNotificationProjector implements NotificationProjector {
  constructor(private readonly prisma: PrismaService) {}

  async project(event: IntegrationEventEnvelope): Promise<Notification[]> {
    const drafts = await this.buildDrafts(event);
    if (drafts.length === 0) return [];

    await this.prisma.notificaciones.createMany({
      data: drafts.map((draft) => ({
        usuario_id: draft.userId,
        tipo: draft.type,
        titulo: draft.title,
        mensaje: draft.message,
        datos: draft.data as Prisma.InputJsonValue,
        dedup_key: draft.dedupKey,
      })),
      skipDuplicates: true,
    });

    const created = await this.prisma.notificaciones.findMany({
      where: { dedup_key: { in: drafts.map((draft) => draft.dedupKey) } },
      orderBy: { creado_en: 'asc' },
    });
    return created.map((notification) => ({
      id: notification.id,
      userId: notification.usuario_id,
      type: notification.tipo,
      title: notification.titulo,
      message: notification.mensaje,
      data: notification.datos as Record<string, unknown> | null,
      readAt: notification.leida_en,
      createdAt: notification.creado_en,
    }));
  }

  private async buildDrafts(
    event: IntegrationEventEnvelope,
  ): Promise<NotificationDraft[]> {
    if (event.name === OPERATIONAL_EVENTS.saleCreated) {
      return this.buildMilestoneDrafts(event);
    }
    if (event.name === OPERATIONAL_EVENTS.resultCreated) {
      return this.buildResultDrafts(event);
    }

    const copy = this.operationalCopy(event);
    if (!copy) return [];
    const recipients = await this.findSellerRecipients(
      event.audience.sellerIds,
    );
    return recipients.map((recipient) =>
      this.draft(event, recipient.userId, copy.title, copy.message),
    );
  }

  private operationalCopy(
    event: IntegrationEventEnvelope,
  ): { title: string; message: string } | null {
    const payload = this.payload(event);
    const copies: Partial<Record<string, { title: string; message: string }>> =
      {
        [OPERATIONAL_EVENTS.drawShiftOpened]: {
          title: 'Turno disponible',
          message: `Se abrió el turno ${this.stringValue(payload.drawCode ?? payload.shiftId)}.`,
        },
        [OPERATIONAL_EVENTS.drawShiftBlocked]: {
          title: 'Turno bloqueado',
          message: 'El turno dejó de aceptar ventas temporalmente.',
        },
        [OPERATIONAL_EVENTS.drawShiftReopened]: {
          title: 'Turno reabierto',
          message: 'El turno volvió a aceptar ventas.',
        },
        [OPERATIONAL_EVENTS.drawShiftClosed]: {
          title: 'Turno cerrado',
          message: 'El turno fue cerrado y ya no acepta ventas.',
        },
        [OPERATIONAL_EVENTS.numberLimitsCreated]: {
          title: 'Límites de números actualizados',
          message: 'Se configuraron nuevos límites que aplican a tus ventas.',
        },
        [OPERATIONAL_EVENTS.numberLimitUpdated]: {
          title: 'Límite de número modificado',
          message: 'Un límite aplicable a las ventas fue actualizado.',
        },
        [OPERATIONAL_EVENTS.numberLimitExpired]: {
          title: 'Límite de número finalizado',
          message: 'Un límite aplicable a las ventas dejó de estar vigente.',
        },
        [OPERATIONAL_EVENTS.blockedNumbersCreated]: {
          title: 'Números bloqueados',
          message: `No se aceptarán ventas para: ${this.joinNumbers(payload.numbers)}.`,
        },
        [OPERATIONAL_EVENTS.blockedNumberDeleted]: {
          title: 'Bloqueo retirado',
          message: `El número ${this.stringValue(payload.number)} volvió a estar disponible.`,
        },
      };
    return copies[event.name] ?? null;
  }

  private async buildResultDrafts(
    event: IntegrationEventEnvelope,
  ): Promise<NotificationDraft[]> {
    const payload = this.payload(event);
    const shiftId = this.stringValue(payload.shiftId);
    const winningNumber = this.stringValue(payload.winningNumber);
    if (!shiftId || !winningNumber) return [];

    const sellers = await this.findSellerRecipients();
    const drafts = sellers.map((recipient) =>
      this.draft(
        event,
        recipient.userId,
        'Resultado disponible',
        `El número ganador del turno es ${winningNumber}.`,
      ),
    );
    const winningDetails = await this.prisma.venta_detalle.findMany({
      where: {
        numero: winningNumber,
        ventas: { turno_id: shiftId, estado: venta_estado.ACTIVA },
      },
      select: {
        venta_id: true,
        premio_miles: true,
        ventas: {
          select: {
            vendedores: {
              select: {
                id: true,
                nombre: true,
                usuarios: { select: { id: true } },
              },
            },
          },
        },
      },
    });
    const winners = new Map<
      string,
      { sellerName: string; tickets: Set<string>; soldMiles: number }
    >();
    for (const detail of winningDetails) {
      const seller = detail.ventas.vendedores;
      const current = winners.get(seller.usuarios.id) ?? {
        sellerName: seller.nombre,
        tickets: new Set<string>(),
        soldMiles: 0,
      };
      current.tickets.add(detail.venta_id);
      current.soldMiles += Number(detail.premio_miles);
      winners.set(seller.usuarios.id, current);
    }
    for (const [userId, winner] of winners) {
      drafts.push({
        userId,
        type: 'results.winner',
        title: '¡Tienes ventas ganadoras!',
        message: `${winner.sellerName}, tienes ${winner.tickets.size} ticket(s) con el número ${winningNumber}.`,
        data: {
          sourceEventId: event.id,
          shiftId,
          winningNumber,
          ticketCount: winner.tickets.size,
          soldMiles: winner.soldMiles,
        },
        dedupKey: `winner:${shiftId}:${winningNumber}:${userId}`,
      });
    }
    return drafts;
  }

  private async buildMilestoneDrafts(
    event: IntegrationEventEnvelope,
  ): Promise<NotificationDraft[]> {
    const payload = this.payload(event);
    const sellerId = this.stringValue(payload.sellerId);
    const shiftId = this.stringValue(payload.shiftId);
    if (!sellerId || !shiftId) return [];

    const config = await this.milestoneConfig();
    if (!config.enabled) return [];

    const [seller, totals] = await this.prisma.$transaction([
      this.prisma.vendedores.findUnique({
        where: { id: sellerId },
        select: {
          nombre: true,
          usuarios: { select: { id: true, activo: true } },
        },
      }),
      this.prisma.ventas.aggregate({
        where: {
          vendedor_id: sellerId,
          turno_id: shiftId,
          estado: venta_estado.ACTIVA,
        },
        _sum: { total_miles: true },
        _count: { id: true },
      }),
    ]);
    if (!seller?.usuarios.activo) return [];

    const totalMiles = Number(totals._sum.total_miles ?? 0);
    const salesCount = totals._count.id;
    const reachesAmount =
      config.thresholdMiles !== undefined &&
      totalMiles >= config.thresholdMiles;
    const reachesCount =
      config.thresholdSalesCount !== undefined &&
      salesCount >= config.thresholdSalesCount;
    if (!reachesAmount && !reachesCount) return [];

    const values = {
      sellerName: seller.nombre,
      sellerId,
      shiftId,
      totalMiles: this.formatNumber(totalMiles),
      salesCount: String(salesCount),
      thresholdMiles: this.formatNumber(config.thresholdMiles ?? 0),
      thresholdSalesCount: String(config.thresholdSalesCount ?? 0),
    };
    const milestoneKey = [
      config.thresholdMiles ?? 'none',
      config.thresholdSalesCount ?? 'none',
    ].join(':');
    const drafts: NotificationDraft[] = [
      {
        userId: seller.usuarios.id,
        type: 'sales.milestone.reached',
        title: this.render(config.sellerTitle, values),
        message: this.render(config.sellerMessage, values),
        data: { ...values, totalMiles, salesCount },
        dedupKey: `milestone:${shiftId}:${sellerId}:${milestoneKey}:seller`,
      },
    ];
    const admins = await this.prisma.usuarios.findMany({
      where: {
        activo: true,
        roles: { nombre: { equals: 'admin', mode: 'insensitive' } },
      },
      select: { id: true },
    });
    for (const admin of admins) {
      drafts.push({
        userId: admin.id,
        type: 'sales.milestone.reached',
        title: this.render(config.adminTitle, values),
        message: this.render(config.adminMessage, values),
        data: { ...values, totalMiles, salesCount },
        dedupKey: `milestone:${shiftId}:${sellerId}:${milestoneKey}:admin:${admin.id}`,
      });
    }
    return drafts;
  }

  private async milestoneConfig(): Promise<SalesMilestoneConfig> {
    const parameter = await this.prisma.parametros.findUnique({
      where: { clave: 'notifications.sales_milestone' },
    });
    if (!parameter) return DEFAULT_MILESTONE_CONFIG;
    try {
      const parsed = JSON.parse(
        parameter.valor,
      ) as Partial<SalesMilestoneConfig>;
      return { ...DEFAULT_MILESTONE_CONFIG, ...parsed };
    } catch {
      return DEFAULT_MILESTONE_CONFIG;
    }
  }

  private async findSellerRecipients(
    sellerIds?: string[],
  ): Promise<SellerRecipient[]> {
    const sellers = await this.prisma.vendedores.findMany({
      where: {
        activo: true,
        usuarios: { activo: true },
        ...(sellerIds?.length && { id: { in: sellerIds } }),
      },
      select: {
        id: true,
        nombre: true,
        usuarios: { select: { id: true } },
      },
    });
    return sellers.map((seller) => ({
      sellerId: seller.id,
      userId: seller.usuarios.id,
      name: seller.nombre,
    }));
  }

  private draft(
    event: IntegrationEventEnvelope,
    userId: string,
    title: string,
    message: string,
  ): NotificationDraft {
    return {
      userId,
      type: event.name,
      title,
      message,
      data: { sourceEventId: event.id, ...this.payload(event) },
      dedupKey: `${event.id}:${userId}:${event.name}`,
    };
  }

  private payload(event: IntegrationEventEnvelope): Record<string, unknown> {
    return event.payload && typeof event.payload === 'object'
      ? (event.payload as Record<string, unknown>)
      : {};
  }

  private joinNumbers(value: unknown): string {
    return Array.isArray(value)
      ? value.map((item) => this.stringValue(item)).join(', ')
      : this.stringValue(value);
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
      ? String(value)
      : '';
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(
      value,
    );
  }

  private render(template: string, values: Record<string, string>): string {
    return template.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => values[key] ?? '',
    );
  }
}
