import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

type ModuleSeed = {
  code: string;
  description: string;
};

loadEnv({ path: '.env' });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const envFile = `.env.${nodeEnv}`;

if (existsSync(envFile)) {
  loadEnv({ override: true, path: envFile });
}

const datasourceUrl =
  process.env.PRISMA_DATABASE_URL ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error(
    'PRISMA_DATABASE_URL, DIRECT_URL or DATABASE_URL must be defined.',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: datasourceUrl,
    ssl: { rejectUnauthorized: false },
  }),
});

const ADMIN_ROLE_NAME = process.env.AUTH_ADMIN_ROLE_NAME ?? 'admin';

const MODULES: ModuleSeed[] = [
  { code: 'USUARIOS', description: 'Gestion de usuarios' },
  { code: 'ROLES', description: 'Gestion de roles y permisos' },
  { code: 'VENDEDORES', description: 'Gestion de vendedores' },
  { code: 'SORTEOS', description: 'Configuracion de sorteos' },
  { code: 'TURNOS', description: 'Gestion de turnos de sorteo' },
  { code: 'VENTAS', description: 'Gestion de ventas' },
  { code: 'RESULTADOS', description: 'Gestion de resultados' },
  { code: 'PAGOS_PREMIOS', description: 'Gestion de pagos de premios' },
  { code: 'NUMEROS_BLOQUEADOS', description: 'Gestion de numeros bloqueados' },
  { code: 'LIMITES_VENDEDOR', description: 'Gestion de limites por vendedor' },
  { code: 'CORTES', description: 'Gestion de cortes' },
  { code: 'PARAMETROS', description: 'Gestion de parametros del sistema' },
  { code: 'AUDITORIA', description: 'Consulta de auditoria' },
];

async function main() {
  const adminRole = await prisma.roles.findFirst({
    where: {
      nombre: {
        equals: ADMIN_ROLE_NAME,
        mode: 'insensitive',
      },
    },
  });

  if (!adminRole) {
    throw new Error(`Role "${ADMIN_ROLE_NAME}" does not exist.`);
  }

  for (const moduleSeed of MODULES) {
    const module = await prisma.modulos.upsert({
      where: {
        codigo: moduleSeed.code,
      },
      create: {
        codigo: moduleSeed.code,
        descripcion: moduleSeed.description,
      },
      update: {
        descripcion: moduleSeed.description,
      },
    });

    await prisma.permisos_por_rol.upsert({
      where: {
        rol_id_modulo_id: {
          rol_id: adminRole.id,
          modulo_id: module.id,
        },
      },
      create: {
        rol_id: adminRole.id,
        modulo_id: module.id,
        puede_leer: true,
        puede_crear: true,
        puede_actualizar: true,
        puede_borrar: true,
      },
      update: {
        puede_leer: true,
        puede_crear: true,
        puede_actualizar: true,
        puede_borrar: true,
      },
    });
  }

  console.log(
    `RBAC seed completed for role "${adminRole.nombre}" with ${MODULES.length} modules.`,
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
