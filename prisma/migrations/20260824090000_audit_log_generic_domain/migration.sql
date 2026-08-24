-- R3 Platform Consolidation — audit fisik satu tabel generic lintas domain.
-- Keputusan owner 2026-08-24 (PRD Architecture Cleanup v2 §20).
-- Add-first: kolom baru dengan default; data MasterDataAudit menyusul lewat
-- dual-write + backfill terpisah sebelum tabel lama di-drop.

CREATE TYPE "studioflow"."AuditDomain" AS ENUM ('STUDIOFLOW', 'MASTER_DATA', 'BQ');

ALTER TABLE "studioflow"."AuditLog"
  ADD COLUMN "domain" "studioflow"."AuditDomain" NOT NULL DEFAULT 'STUDIOFLOW',
  ADD COLUMN "actor_id" TEXT,
  ADD COLUMN "actor_name" TEXT;

ALTER TABLE "studioflow"."AuditLog" ALTER COLUMN "user_id" DROP NOT NULL;

CREATE INDEX "AuditLog_domain_entity_type_entity_id_created_at_idx"
  ON "studioflow"."AuditLog"("domain", "entity_type", "entity_id", "created_at");
