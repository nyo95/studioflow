-- =============================================================================
-- SkuPrice: dua harga menjadi satu
-- =============================================================================
-- Keputusan owner 2026-08-14 (feedback item 8): "perubahan skema harga jadi
-- 1 best price aja (ga ada harga diskon dan harga net)".
--
-- Sebelum ini `SkuPrice` menyimpan `price_list` (harga sebelum diskon) dan
-- `price_net` (harga setelah diskon). Dalam praktiknya studio tidak pernah
-- menegosiasikan dua angka lalu menyimpan keduanya — yang dicatat adalah harga
-- yang benar-benar berlaku. Kolom kedua hanya menghasilkan dua pertanyaan yang
-- tidak perlu dijawab di setiap entri, dan satu kelas bug: mana yang dipakai BQ.
--
-- YANG DIPERTAHANKAN adalah `price_net`, bukan `price_list`:
--   - `price_net` NOT NULL, `price_list` nullable — data yang pasti ada.
--   - `resolveNetPrice()` sudah menjadikan price_net sebagai jawaban tunggal;
--     price_list hanya cadangan ketika net kosong.
--   - Seluruh pembaca hilir (v_bq_material_rate, catalog_price, tabel Material)
--     sudah membaca price_net.
-- Jadi tidak ada backfill: nilai yang bertahan sudah berada di kolom yang benar.
--
-- KONSEKUENSI YANG DISENGAJA: selisih diskon yang pernah tercatat hilang.
-- Owner memilih ini secara eksplisit di atas opsi "biarkan kolomnya menganggur".
-- Riwayat penawaran (valid_from / valid_to / is_current) TIDAK terpengaruh —
-- yang hilang adalah satu kolom, bukan satu baris.
-- =============================================================================

-- View harus dibuang lebih dulu: ia menyebut price_list secara eksplisit,
-- sehingga DROP COLUMN akan ditolak selama view masih ada.
DROP VIEW IF EXISTS "master_data"."v_bq_material_rate";

ALTER TABLE "master_data"."SkuPrice" DROP COLUMN IF EXISTS "price_list";

COMMENT ON COLUMN "master_data"."SkuPrice"."price_net" IS
  'Harga tunggal yang berlaku untuk (SKU x supplier) ini. Sejak 2026-08-14 tidak ada lagi pasangan list/net - angka ini adalah harga yang dipakai BQ apa adanya.';

-- =============================================================================
-- v_bq_material_rate — dibangun ulang tanpa price_list
-- =============================================================================
-- Perhatikan perubahan pada `bq_ready`. Definisi lama menuntut price_list DAN
-- price_net DAN unit terisi. Karena price_list nyaris tidak pernah diisi, syarat
-- itu membuat bq_ready hampir selalu FALSE — halaman Material menampilkan "172
-- dari 172 price incomplete" padahal harganya ada. Dengan satu kolom harga,
-- syaratnya menjadi apa yang sejak awal dimaksud: ada harga, dan ada satuan.
CREATE VIEW "master_data"."v_bq_material_rate" AS
SELECT
  sp."id"          AS price_id,
  s."id"           AS sku_id,
  s."code"         AS sku_code,
  s."name"         AS sku_name,
  b."name"         AS brand_name,

  pc."name"        AS category_name,
  pc."path"        AS category_path,

  s."spec",
  s."dim_display",
  s."dim_length", s."dim_width", s."dim_height", s."dim_unit",

  sp."unit",
  sp."price_net",
  sp."currency",

  sup."id"         AS supplier_id,
  sup."name"       AS supplier_name,

  sp."valid_from",
  sp."notes",

  (sp."price_net" IS NOT NULL
   AND sp."unit" IS NOT NULL)          AS bq_ready

FROM "master_data"."SkuPrice" sp
JOIN "master_data"."Sku" s        ON s."id" = sp."sku_id"
LEFT JOIN "master_data"."Brand" b ON b."id" = s."brand_id"
LEFT JOIN "master_data"."SkuCategory" sc
       ON sc."sku_id" = s."id" AND sc."is_primary"
LEFT JOIN "master_data"."Category" pc ON pc."id" = sc."category_id"
LEFT JOIN "master_data"."Party" sup   ON sup."id" = sp."supplier_party_id"
WHERE sp."is_current"
  AND s."deleted_at" IS NULL
  AND s."status" <> 'DISCONTINUED';

COMMENT ON VIEW "master_data"."v_bq_material_rate" IS
  'Kontrak baca BQ untuk harga material. Satu baris per penawaran yang berlaku (SKU x supplier). Satu kolom harga sejak 2026-08-14. Kolom qty sengaja tidak diekspos - artinya belum ditetapkan.';
