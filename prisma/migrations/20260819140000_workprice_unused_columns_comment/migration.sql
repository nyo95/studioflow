-- =============================================================================
-- WorkPrice.valid_from / valid_to / is_current — dokumentasi "TIDAK DIPAKAI"
-- =============================================================================
-- Menutup temuan SK1 audit skema 2026-08-19 (`AUDIT-SKEMA-MASTERDATA-2026-08-19.md`).
--
-- Owner memutuskan: `WorkPrice` SENGAJA satu-baris-per-code, tidak butuh
-- riwayat harga multi-baris seperti `SkuPrice`. Ketiga kolom ini tetap ada
-- (tidak dihapus — bukan destruktif, dan menghapusnya butuh keputusan
-- terpisah kalau owner berubah pikiran nanti), tapi tidak pernah ditulis
-- ulang sesudah `create` di jalur tulis manapun
-- (`updateServicePriceAction`/`updateMaterialLaborPriceAction` di
-- `pricing-actions.ts` mengedit baris di tempat).
--
-- Pola sama persis dengan `SkuPrice.qty`/`WorkPrice.qty`
-- (03_invariants.sql §5, migrasi `20260810180000`): COMMENT ON COLUMN supaya
-- pembaca berikutnya (manusia ATAU agent) langsung melihatnya lewat `\d+`
-- atau tool introspeksi apa pun, bukan cuma lewat komentar `schema.prisma`
-- yang mudah dilewatkan.
--
-- TIDAK DESTRUKTIF. Tidak ada kolom, baris, atau data yang diubah — murni
-- metadata.
-- =============================================================================

BEGIN;

COMMENT ON COLUMN "master_data"."WorkPrice"."valid_from" IS 'TIDAK DIPAKAI sebagai riwayat multi-baris (keputusan owner 2026-08-19, audit skema SK1). WorkPrice.code @unique GLOBAL mencegah pola supersede ala SkuPrice secara struktural. Jalur tulis (pricing-actions.ts) mengedit baris di tempat; kolom ini tidak pernah ditulis ulang sesudah create.';

COMMENT ON COLUMN "master_data"."WorkPrice"."valid_to" IS 'TIDAK DIPAKAI sebagai riwayat multi-baris — lihat COMMENT pada valid_from di kolom yang sama.';

COMMENT ON COLUMN "master_data"."WorkPrice"."is_current" IS 'TIDAK DIPAKAI sebagai riwayat multi-baris — lihat COMMENT pada valid_from di kolom yang sama. Beda dengan SkuPrice.is_current (itu DIPAKAI, dijaga index SkuPrice_current_uniq).';

COMMIT;
