-- Migration: drop BqDetailMode (O3, 2026-08-19)
-- Semua object sekarang selalu DETAIL. Kolom detail_mode dan turunannya
-- dihapus dari BqSettings, BqObject, dan BqLibraryObject.

-- BqSettings: drop default_detail_mode
ALTER TABLE bq."BqSettings" DROP COLUMN IF EXISTS "default_detail_mode";

-- BqObject: drop detail_mode + audit columns
ALTER TABLE bq."BqObject" DROP COLUMN IF EXISTS "detail_mode";
ALTER TABLE bq."BqObject" DROP COLUMN IF EXISTS "detail_mode_set_by_name";
ALTER TABLE bq."BqObject" DROP COLUMN IF EXISTS "detail_mode_set_at";

-- BqLibraryObject: drop detail_mode
ALTER TABLE bq."BqLibraryObject" DROP COLUMN IF EXISTS "detail_mode";

-- Drop enum (only after all columns using it are gone)
DROP TYPE IF EXISTS bq."BqDetailMode";
