import { PrismaService } from '../../../../infrastructure/database/prisma';
import {
  IntegrationEventEnvelope,
  OPERATIONAL_EVENTS,
} from '../../../../shared-kernel';
import { PrismaNotificationProjector } from './prisma-notification-projector';

describe('PrismaNotificationProjector', () => {
  it('creates personalized seller and admin notifications at a sales milestone', async () => {
    const createdAt = new Date('2026-07-06T00:00:00.000Z');
    type CreateManyInput = {
      data: Array<{
        usuario_id: string;
        titulo: string;
        mensaje: string;
      }>;
      skipDuplicates: boolean;
    };
    const createMany = jest.fn<Promise<{ count: number }>, [CreateManyInput]>();
    createMany.mockResolvedValue({ count: 2 });
    const prisma = {
      parametros: {
        findFirst: jest.fn().mockResolvedValue({
          valor: JSON.stringify({
            enabled: true,
            thresholdMiles: 100,
            sellerTitle: 'Meta para {{sellerName}}',
            sellerMessage: '{{totalMiles}} mil en {{salesCount}} ventas',
            adminTitle: 'Meta administrativa',
            adminMessage: '{{sellerName}} llegó a {{totalMiles}}',
          }),
        }),
      },
      vendedores: {
        findUnique: jest.fn().mockResolvedValue({
          nombre: 'MR ULLOA',
          usuarios: { id: 'seller-user-id', activo: true },
        }),
      },
      ventas: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { total_miles: 125.5 },
          _count: { id: 4 },
        }),
      },
      usuarios: {
        findMany: jest.fn().mockResolvedValue([{ id: 'admin-user-id' }]),
      },
      notificaciones: {
        createMany,
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'seller-notification-id',
            usuario_id: 'seller-user-id',
            tipo: 'sales.milestone.reached',
            titulo: 'Meta para MR ULLOA',
            mensaje: '125.5 mil en 4 ventas',
            datos: {},
            leida_en: null,
            creado_en: createdAt,
          },
          {
            id: 'admin-notification-id',
            usuario_id: 'admin-user-id',
            tipo: 'sales.milestone.reached',
            titulo: 'Meta administrativa',
            mensaje: 'MR ULLOA llegó a 125.5',
            datos: {},
            leida_en: null,
            creado_en: createdAt,
          },
        ]),
      },
      $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    } as unknown as PrismaService;
    const projector = new PrismaNotificationProjector(prisma);
    const event: IntegrationEventEnvelope = {
      id: 'event-id',
      name: OPERATIONAL_EVENTS.saleCreated,
      aggregateId: 'sale-id',
      audience: { sellerIds: ['seller-id'] },
      payload: {
        saleId: 'sale-id',
        sellerId: 'seller-id',
        shiftId: 'shift-id',
      },
      occurredAt: createdAt.toISOString(),
      version: 1,
    };

    const notifications = await projector.project(event);

    expect(notifications).toHaveLength(2);
    const createInput = createMany.mock.calls[0]?.[0];
    if (!createInput) throw new Error('Expected notification persistence');
    expect(createInput.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          usuario_id: 'seller-user-id',
          titulo: 'Meta para MR ULLOA',
          mensaje: '125.5 mil en 4 ventas',
        }),
        expect.objectContaining({
          usuario_id: 'admin-user-id',
          mensaje: 'MR ULLOA llegó a 125.5',
        }),
      ]),
    );
  });
});
