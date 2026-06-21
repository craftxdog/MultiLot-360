CREATE TYPE "codigo_acceso_estado" AS ENUM (
  'PENDIENTE',
  'USADO',
  'EXPIRADO',
  'REVOCADO'
);

CREATE TABLE "codigos_acceso_vendedor" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" UUID NOT NULL,
  "vendedor_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "codigo_hash" TEXT NOT NULL,
  "estado" "codigo_acceso_estado" NOT NULL DEFAULT 'PENDIENTE',
  "expira_en" TIMESTAMPTZ(6) NOT NULL,
  "usado_en" TIMESTAMPTZ(6),
  "creado_por" UUID,
  "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "codigos_acceso_vendedor_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "codigos_acceso_vendedor_vendedor_id_fkey"
    FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "codigos_acceso_vendedor_creado_por_fkey"
    FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX "ix_codigos_acceso_vendedor_creado_por"
  ON "codigos_acceso_vendedor" ("creado_por");

CREATE INDEX "ix_codigos_acceso_vendedor_email_estado"
  ON "codigos_acceso_vendedor" ("email", "estado");

CREATE INDEX "ix_codigos_acceso_vendedor_usuario_estado"
  ON "codigos_acceso_vendedor" ("usuario_id", "estado");

CREATE INDEX "ix_codigos_acceso_vendedor_vendedor_estado"
  ON "codigos_acceso_vendedor" ("vendedor_id", "estado");
