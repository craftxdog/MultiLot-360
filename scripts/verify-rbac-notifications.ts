import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '.env', quiet: true });
config({ path: '.env.development', override: true, quiet: true });

const url =
  process.env.PRISMA_DATABASE_URL ??
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL;
if (!url) throw new Error('Database URL is missing');

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  }),
});

async function main(): Promise<void> {
  const seller = await prisma.roles.findFirst({
    where: { nombre: { equals: 'vendedor', mode: 'insensitive' } },
    include: {
      permisos_por_rol: {
        include: { modulos: true },
        orderBy: { modulos: { codigo: 'asc' } },
      },
    },
  });
  const notificationModule = await prisma.modulos.findUnique({
    where: { codigo: 'NOTIFICACIONES' },
  });
  const parameter = await prisma.parametros.findUnique({
    where: { clave: 'notifications.sales_milestone' },
  });
  const notificationCount = await prisma.notificaciones.count();
  const accessAudit = await prisma.auditoria_eventos.findFirst({
    where: {
      evento: 'http.request.completed',
      payload: {
        path: ['path'],
        string_contains: '/parameters/access/',
      },
    },
    select: { id: true },
  });

  console.log(
    JSON.stringify({
      notificationTable: true,
      notificationCount,
      notificationModule: notificationModule?.codigo,
      milestoneParameter: Boolean(parameter),
      accessMutationAudited: Boolean(accessAudit),
      sellerPermissions: seller?.permisos_por_rol
        .filter((permission) =>
          [
            'TURNOS',
            'NUMEROS_BLOQUEADOS',
            'LIMITES_NUMERO',
            'RESULTADOS',
            'NOTIFICACIONES',
          ].includes(permission.modulos.codigo),
        )
        .map((permission) => ({
          module: permission.modulos.codigo,
          read: permission.puede_leer,
          create: permission.puede_crear,
          update: permission.puede_actualizar,
          delete: permission.puede_borrar,
        })),
    }),
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
