-- =============================================================================
-- 04 — Kontrak SSOT: view + hak akses
-- =============================================================================
-- Master Data adalah SSOT untuk StudioFlow (sekarang) dan BQ (nanti).
-- SSOT berarti SATU PENULIS, BANYAK PEMBACA — dan pembacanya membaca lewat
-- permukaan yang bisa distabilkan, bukan langsung ke tabel.
--
-- Keputusan owner 2026-08-10:
--   - StudioFlow membaca TEPAT SATU view: v_library_brand.
--     Card brand + link, untuk menjawab "gw mau cari terazzo, merek apa aja ya?"
--   - Schedule dan SketchUp TIDAK BOLEH memilih SKU dari Master Data.
--   - Hanya app Master Data yang menulis.
--
-- Jalankan SESUDAH `03_invariants.sql`.
-- =============================================================================

BEGIN;

-- =============================================================================
-- v_library_brand — Table 1 kolom A–G, tidak lebih
-- =============================================================================
-- Lingkupnya PERSIS bagian Excel yang di-screenshot owner:
--   A Company · B Brand · C Product Brand · D Category · E–G Link
--
-- Yang TIDAK ada di sini, dan itu inti keputusannya:
--   Sku, SkuPrice, WorkPrice, PartyContact, Sample — satu pun tidak.
--
-- Card hanya memunculkan link; katalog produknya dibuka di Drive atau website
-- milik brand itu sendiri.

CREATE VIEW "master_data"."v_library_brand" AS
SELECT
  b."id"          AS brand_id,
  b."name"        AS brand_name,          -- Table 1 kolom C "Product Brand"
  b."slug"        AS brand_slug,

  p."id"          AS company_id,
  p."name"        AS company_name,        -- Table 1 kolom B "Brand"
  p."legal_name"  AS company_legal_name,  -- Table 1 kolom A "Company"

  -- Table 1 kolom D. Array supaya filter kategori jadi satu query, bukan join
  -- yang menggandakan baris brand.
  COALESCE((
    SELECT array_agg(c."name" ORDER BY bc."sort_order", c."name")
    FROM "master_data"."BrandCategory" bc
    JOIN "master_data"."Category" c ON c."id" = bc."category_id"
    WHERE bc."brand_id" = b."id" AND c."is_active"
  ), ARRAY[]::text[]) AS categories,

  COALESCE((
    SELECT array_agg(c."slug" ORDER BY bc."sort_order", c."slug")
    FROM "master_data"."BrandCategory" bc
    JOIN "master_data"."Category" c ON c."id" = bc."category_id"
    WHERE bc."brand_id" = b."id" AND c."is_active"
  ), ARRAY[]::text[]) AS category_slugs,

  -- Table 1 kolom E–G. HANYA kind yang ada di Excel: Google Drive, Website,
  -- Socmed.
  --
  -- PRICE_LIST dan MARKETPLACE sengaja TIDAK di sini, meski keduanya ada di
  -- `ALLOWED_LINK_KINDS` hari ini. Keduanya masuk allowlist justru sebagai
  -- akibat keputusan 1 Agu "ada harga ga masalah" — dan lingkup Library yang
  -- baru tidak menampilkan produk sama sekali, jadi tidak ada harga untuk
  -- diizinkan. WHATSAPP juga tidak: kanal kontak, bukan katalog.
  --
  -- `archive_url` didahulukan supaya link brand yang mati tidak mematikan card.
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'kind',  l."kind",
        'url',   COALESCE(l."archive_url", l."url"),
        'label', l."label"
      ) ORDER BY l."sort_order", l."kind"
    )
    FROM "master_data"."BrandLink" l
    WHERE l."brand_id" = b."id"
      AND l."kind" IN ('DRIVE', 'WEBSITE', 'INSTAGRAM', 'FACEBOOK',
                       'TIKTOK', 'YOUTUBE', 'LINKEDIN')
  ), '[]'::jsonb) AS links

FROM "master_data"."Brand" b
LEFT JOIN "master_data"."Party" p ON p."id" = b."owner_party_id"
WHERE b."deleted_at" IS NULL
  AND b."is_active";

COMMENT ON VIEW "master_data"."v_library_brand" IS 'Kontrak baca StudioFlow Library. Lingkup: design database masterdata.xlsx Table 1 kolom A-G. JANGAN tambahkan kolom produk, harga, kontak, atau sampel ke sini - itu penyimpangan dari Table 1 dan harus diputuskan owner dulu.';

-- =============================================================================
-- v_bq_material_rate — harga material untuk BQ
-- =============================================================================
-- BQ belum dibangun. View ini ada SEKARANG justru supaya bentuk akhirnya bisa
-- diubah nanti dengan menulis ulang view — tanpa migrasi tabel dan tanpa
-- menyentuh Library. Membangun BQ langsung di atas tabel akan membekukan bentuk
-- SkuPrice pada tebakan pertama.
--
-- Satu baris per PENAWARAN yang berlaku (SKU × supplier), bukan per SKU: BQ
-- memang perlu membandingkan.

CREATE VIEW "master_data"."v_bq_material_rate" AS
SELECT
  sp."id"          AS price_id,
  s."id"           AS sku_id,
  s."code"         AS sku_code,
  s."name"         AS sku_name,
  b."name"         AS brand_name,

  -- Kategori utama + jalurnya, untuk sectioning dokumen BQ.
  pc."name"        AS category_name,
  pc."path"        AS category_path,

  s."spec",
  s."dim_display",
  s."dim_length", s."dim_width", s."dim_height", s."dim_unit",

  sp."unit",
  sp."price_list",
  sp."price_net",
  sp."currency",

  sup."id"         AS supplier_id,
  sup."name"       AS supplier_name,

  sp."valid_from",
  sp."notes",

  -- "Siap BQ" (roadmap §Peta schema): harga sebelum diskon + setelah diskon +
  -- satuan terisi. Dihitung di view, BUKAN kolom — keadaan turunan tidak
  -- pernah butuh tempat penyimpanan sendiri.
  (sp."price_list" IS NOT NULL
   AND sp."price_net" IS NOT NULL
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

-- Catatan sengaja: kolom `qty` di SkuPrice TIDAK diekspos. Artinya belum
-- ditetapkan (Q12), dan angka tanpa arti yang masuk BQ adalah cara paling
-- senyap merusak dokumen komersial.

COMMENT ON VIEW "master_data"."v_bq_material_rate" IS 'Kontrak baca BQ untuk harga material. Satu baris per penawaran yang berlaku (SKU x supplier). Kolom qty sengaja tidak diekspos - artinya belum ditetapkan.';

-- =============================================================================
-- v_bq_work_rate — Table 3 + Table 4, satu view
-- =============================================================================
-- Table 3 (material + upah) dan Table 4 (upah murni) dibedakan DATA, bukan
-- struktur: `material_price` NULL berarti upah murni. `has_material` membuat
-- pembedaan itu terbaca tanpa BQ perlu tahu aturannya.

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
  w."material_price",
  w."labor_price",
  w."total_price",
  w."currency",
  w."scope_note",
  w."notes",
  w."valid_from",

  (w."material_price" IS NOT NULL AND w."material_price" > 0) AS has_material,

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

COMMENT ON VIEW "master_data"."v_bq_work_rate" IS 'Kontrak baca BQ untuk tarif pekerjaan. Table 3 + Table 4 xlsx digabung; has_material membedakan keduanya. TIDAK boleh diekspos ke StudioFlow.';

COMMIT;

-- =============================================================================
-- HAK AKSES — jalankan setelah role aplikasinya ada
-- =============================================================================
-- Bagian ini yang mengubah kontrak dari KESEPAKATAN jadi ATURAN. Tanpanya,
-- ketiga view di atas hanya saran yang bisa dilewati query berikutnya.
--
-- Butuh role terpisah per app. Kalau sekarang semua app memakai satu user
-- Postgres yang sama, langkah ini TIDAK BISA dijalankan apa adanya — dan itu
-- temuan tersendiri, bukan alasan melewatinya. Lihat README §Prasyarat.
--
-- Diberi komentar supaya tidak ikut jalan sebelum rolenya disiapkan.

-- CREATE ROLE studioflow_app LOGIN PASSWORD '...';
-- CREATE ROLE bq_app         LOGIN PASSWORD '...';
-- CREATE ROLE masterdata_app LOGIN PASSWORD '...';

-- -- Master Data: satu-satunya penulis.
-- GRANT USAGE ON SCHEMA "master_data" TO masterdata_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE
--   ON ALL TABLES IN SCHEMA "master_data" TO masterdata_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA "master_data"
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO masterdata_app;

-- -- StudioFlow: satu view, baca saja.
-- REVOKE ALL ON ALL TABLES IN SCHEMA "master_data" FROM studioflow_app;
-- GRANT USAGE  ON SCHEMA "master_data"                     TO studioflow_app;
-- GRANT SELECT ON "master_data"."v_library_brand"          TO studioflow_app;

-- -- BQ: dua view, baca saja.
-- REVOKE ALL ON ALL TABLES IN SCHEMA "master_data" FROM bq_app;
-- GRANT USAGE  ON SCHEMA "master_data"                     TO bq_app;
-- GRANT SELECT ON "master_data"."v_bq_material_rate"       TO bq_app;
-- GRANT SELECT ON "master_data"."v_bq_work_rate"           TO bq_app;

-- =============================================================================
-- Uji yang membuktikan batasnya benar-benar ada
-- =============================================================================
-- Dijalankan SEBAGAI studioflow_app. Nomor 1 yang paling penting: kalau ia
-- LOLOS, seluruh berkas ini hanya dokumentasi.
--
--   1. SELECT * FROM master_data."Sku" LIMIT 1;        -- harus DITOLAK
--   2. SELECT * FROM master_data."SkuPrice" LIMIT 1;   -- harus DITOLAK
--   3. SELECT * FROM master_data.v_library_brand LIMIT 1;  -- harus BOLEH
--   4. Kolom hasil (3) harus TEPAT SEMBILAN: brand_id, brand_name, brand_slug,
--      company_id, company_name, company_legal_name, categories,
--      category_slugs, links — tanpa satu pun kolom produk/harga/kontak/sampel
--   5. SELECT jsonb_array_elements(links)->>'kind' FROM master_data.v_library_brand
--      → tidak boleh memuat PRICE_LIST, MARKETPLACE, WHATSAPP, CATALOG, OTHER
