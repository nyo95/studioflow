-- =============================================================================
-- v_bq_work_rate — definisi ulang setelah WorkPrice jadi satu kolom harga
-- =============================================================================
-- WAJIB dijalankan tepat setelah 20260811120000_workprice_single_price_and_qty.
-- Tanpa ini view-nya rusak: ia masih menyebut `material_price`, `labor_price`,
-- dan `total_price`, yang sudah dibuang migrasi sebelumnya.
--
-- View-nya sudah dilepas di langkah 0 berkas sebelumnya — Postgres menolak
-- `DROP COLUMN` selama ada view yang merujuknya, jadi pelepasannya harus
-- terjadi di transaksi yang sama dengan perubahan tabelnya. Berkas ini hanya
-- memasangnya kembali dengan bentuk yang baru.
--
-- `DROP VIEW IF EXISTS` tetap ditulis supaya berkas ini aman dijalankan ulang.
-- =============================================================================

BEGIN;

DROP VIEW IF EXISTS "master_data"."v_bq_work_rate";

CREATE VIEW "master_data"."v_bq_work_rate" AS
SELECT
  w."id"           AS work_price_id,
  w."code",
  w."name",                              -- jawaban kolom "Items" di Excel

  -- Dua tingkat kategori Excel ("Vendor Category" + "Category") diambil dari
  -- pohon yang sama: daun dan induknya.
  c."name"         AS category_name,     -- "Lighting", "Floor Works"
  parent."name"    AS vendor_category,   -- "MEP", "Sipil", "Furniture"
  c."path"         AS category_path,

  v."id"           AS vendor_id,
  v."name"         AS vendor_name,

  w."spec",
  w."dim_display",
  w."unit",

  -- SATU harga, sesuai Excel. `total_price` sengaja tidak diekspos dengan nama
  -- lamanya: ia dulu berarti "material + upah dijumlahkan", dan sekarang tidak
  -- ada yang dijumlahkan. Nama yang bertahan sementara artinya berubah adalah
  -- cara paling senyap membuat pembacanya salah.
  w."price",
  w."currency",

  w."scope_note",
  w."notes",
  w."valid_from",

  -- Dinyatakan, bukan disimpulkan. Sebelumnya `material_price IS NOT NULL AND
  -- > 0`, yang berarti tarif upah-murni yang kebetulan diketik lengkap dengan
  -- biaya materialnya terbaca sebagai paket supply+install.
  (w."kind" = 'MATERIAL_LABOR') AS has_material,

  -- Excel kolom "Project Reference" — dinormalisasi jadi baris di
  -- WorkPriceProjectRef, dirakit kembali di sini untuk ditampilkan.
  COALESCE((
    SELECT array_agg(r."project_name" ORDER BY r."used_at" DESC NULLS LAST)
    FROM "master_data"."WorkPriceProjectRef" r
    WHERE r."work_price_id" = w."id"
  ), ARRAY[]::text[]) AS project_refs

FROM "master_data"."WorkPrice" w
JOIN "master_data"."Category" c            ON c."id" = w."category_id"
LEFT JOIN "master_data"."Category" parent  ON parent."id" = c."parent_id"
LEFT JOIN "master_data"."Party" v          ON v."id" = w."vendor_party_id"
WHERE w."is_current"
  AND w."is_active"
  AND w."deleted_at" IS NULL;

COMMIT;

-- =============================================================================
-- Verifikasi
-- =============================================================================
--   SELECT * FROM master_data.v_bq_work_rate LIMIT 5;
--   -- harus punya kolom `price` dan `has_material`, TIDAK punya
--   -- material_price / labor_price / total_price
--
--   SELECT has_material, count(*) FROM master_data.v_bq_work_rate
--   GROUP BY has_material;
--   -- angkanya harus sama dengan
--   -- SELECT kind, count(*) FROM master_data."WorkPrice" ... GROUP BY kind
-- =============================================================================
