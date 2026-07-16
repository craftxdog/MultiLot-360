-- Store only the SHA-256 digest of the opaque invitation link token.
-- Existing access-code invitations remain valid through the manual flow.
ALTER TABLE "codigos_acceso_vendedor"
ADD COLUMN "enlace_token_hash" CHAR(64);

CREATE UNIQUE INDEX "uq_codigos_acceso_vendedor_enlace_token_hash"
ON "codigos_acceso_vendedor"("enlace_token_hash");
