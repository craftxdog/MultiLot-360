import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PrismaSalesRepository } from './prisma-sales.repository';

const createSaleRecord = () => ({
  id: 'sale-id',
  vendedor_id: 'admin-seller-id',
  turno_id: null,
  creado_en: new Date('2026-08-03T18:00:00.000Z'),
  total_miles: new Prisma.Decimal(20),
  estado: 'ACTIVA' as const,
  anulada_por: null,
  anulada_en: null,
  motivo_anulacion: null,
  tenant_id: 'tenant-id',
  anulada_por_membresia_id: null,
  vendedores: { id: 'admin-seller-id', nombre: 'Admin Principal' },
  turnos: null,
  venta_detalle: [],
});

const createPrismaMock = () => ({
  membresias_tenant: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
  },
  vendedores: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    upsert: jest.fn<Promise<unknown>, [unknown]>(),
  },
  turnos: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
  },
  ventas: {
    create: jest.fn<Promise<unknown>, [unknown]>(),
  },
});

describe('PrismaSalesRepository admin attribution', () => {
  it('creates one operational seller profile for the active admin membership', async () => {
    const prisma = createPrismaMock();
    prisma.membresias_tenant.findFirst.mockResolvedValue({
      id: 'membership-id',
      tenant_id: 'tenant-id',
      perfil_id: 'admin-user-id',
      username: 'admin',
      roles: { nombre: 'ADMIN' },
      usuarios: { nombre: ' Admin Principal ' },
    });
    prisma.vendedores.upsert.mockResolvedValue({ id: 'admin-seller-id' });
    prisma.vendedores.findUnique.mockResolvedValue({ activo: true });
    prisma.turnos.findUnique.mockResolvedValue({ estado: 'ABIERTO' });
    prisma.ventas.create.mockResolvedValue(createSaleRecord());
    const repository = new PrismaSalesRepository(
      prisma as unknown as PrismaService,
    );

    const result = await repository.create({
      attribution: {
        kind: 'ADMIN_SELF',
        userId: 'admin-user-id',
        membershipId: 'membership-id',
      },
      shiftId: 'shift-id',
      items: [{ number: '02', prizeMiles: 20 }],
    });

    const membershipQuery: unknown =
      prisma.membresias_tenant.findFirst.mock.calls[0]?.[0];
    const sellerUpsert: unknown = prisma.vendedores.upsert.mock.calls[0]?.[0];
    const saleCreate: unknown = prisma.ventas.create.mock.calls[0]?.[0];

    expect(membershipQuery).toMatchObject({
      where: {
        id: 'membership-id',
        perfil_id: 'admin-user-id',
        estado: 'ACTIVO',
      },
    });
    expect(sellerUpsert).toMatchObject({
      where: {
        tenant_id_membresia_id: {
          tenant_id: 'tenant-id',
          membresia_id: 'membership-id',
        },
      },
      create: {
        usuario_id: 'admin-user-id',
        nombre: 'Admin Principal',
        cedula: 'ADMIN-membership-id',
      },
    });
    expect(saleCreate).toMatchObject({
      data: { vendedor_id: 'admin-seller-id' },
    });
    expect(result.seller).toEqual({
      id: 'admin-seller-id',
      name: 'Admin Principal',
    });
  });

  it('rejects self-attribution when the membership is not an admin', async () => {
    const prisma = createPrismaMock();
    prisma.membresias_tenant.findFirst.mockResolvedValue({
      id: 'membership-id',
      tenant_id: 'tenant-id',
      perfil_id: 'user-id',
      username: 'seller',
      roles: { nombre: 'VENDEDOR' },
      usuarios: { nombre: 'Vendedor' },
    });
    const repository = new PrismaSalesRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repository.create({
        attribution: {
          kind: 'ADMIN_SELF',
          userId: 'user-id',
          membershipId: 'membership-id',
        },
        shiftId: 'shift-id',
        items: [{ number: '02', prizeMiles: 20 }],
      }),
    ).rejects.toThrow('Active admin tenant membership not found');
    expect(prisma.vendedores.upsert).not.toHaveBeenCalled();
    expect(prisma.ventas.create).not.toHaveBeenCalled();
  });
});
