import { createClient as createSupabaseClient } from '@supabase/supabase-js';
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
  const fixtures = await prisma.usuarios.findMany({
    where: {
      OR: [
        { username: { startsWith: 'codex.rt' } },
        {
          codigos_acceso_usuario: {
            some: { email: { startsWith: 'codex.realtime.' } },
          },
        },
      ],
    },
    include: { vendedores: true },
  });

  for (const fixture of fixtures) {
    await prisma.$transaction(async (tx) => {
      for (const seller of fixture.vendedores) {
        await tx.limites_numero.deleteMany({
          where: { vendedor_id: seller.id },
        });
      }
      await tx.auditoria_eventos.deleteMany({
        where: { usuario_id: fixture.id },
      });
      await tx.usuarios.delete({ where: { id: fixture.id } });
    });

    if (fixture.auth_user_id) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase admin configuration is required');
      }
      const { error } = await createSupabaseClient(
        supabaseUrl,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } },
      ).auth.admin.deleteUser(fixture.auth_user_id);
      if (error) throw new Error(error.message);
    }
  }

  console.log(`Removed ${fixtures.length} realtime smoke fixture(s).`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
