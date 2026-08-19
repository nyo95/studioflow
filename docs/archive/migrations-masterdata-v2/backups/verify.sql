BEGIN;

-- setup
INSERT INTO master_data."Party" (id, name, slug, legal_name) VALUES
  ('t-party-owner', 'Test Owner', 'test-owner', 'PT Test Owner'),
  ('t-party-sup',   'Test Supplier', 'test-supplier', NULL);

INSERT INTO master_data."Brand" (id, name, slug, owner_party_id) VALUES
  ('t-brand-1', 'Test Brand', 'test-brand', 't-party-owner');

INSERT INTO master_data."Category" (id, name, slug, kind) VALUES
  ('t-cat-1', 'Test Cat A', 'test-cat-a', 'PRODUCT'),
  ('t-cat-2', 'Test Cat B', 'test-cat-b', 'PRODUCT');

INSERT INTO master_data."Sku" (id, name, slug, brand_id, base_unit) VALUES
  ('t-sku-1', 'Test Sku', 'test-sku', 't-brand-1', 'pcs');

-- Test 1: dua harga is_current untuk (sku, supplier) yang sama -> harus DITOLAK
INSERT INTO master_data."SkuPrice" (id, sku_id, supplier_party_id, price_net, unit, is_current)
VALUES ('t-price-1', 't-sku-1', 't-party-sup', 100000, 'pcs', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO master_data."SkuPrice" (id, sku_id, supplier_party_id, price_net, unit, is_current)
    VALUES ('t-price-2', 't-sku-1', 't-party-sup', 150000, 'pcs', true);
    RAISE EXCEPTION 'TEST 1 GAGAL: duplikat is_current tidak ditolak';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 1 LULUS: duplikat is_current ditolak';
  END;
END $$;

-- Test 2: dua is_primary category untuk sku yang sama -> harus DITOLAK
INSERT INTO master_data."SkuCategory" (id, sku_id, category_id, is_primary)
VALUES ('t-skucat-1', 't-sku-1', 't-cat-1', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO master_data."SkuCategory" (id, sku_id, category_id, is_primary)
    VALUES ('t-skucat-2', 't-sku-1', 't-cat-2', true);
    RAISE EXCEPTION 'TEST 2 GAGAL: duplikat is_primary tidak ditolak';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 2 LULUS: duplikat is_primary ditolak';
  END;
END $$;

-- Test 3: total_price generated, berubah otomatis
INSERT INTO master_data."WorkPrice" (id, code, name, category_id, unit, material_price, labor_price)
VALUES ('t-work-1', 'TEST-001', 'Test Work', 't-cat-1', 'm2', 100000, 50000);

DO $$
DECLARE tp numeric;
BEGIN
  SELECT total_price INTO tp FROM master_data."WorkPrice" WHERE id = 't-work-1';
  IF tp <> 150000 THEN
    RAISE EXCEPTION 'TEST 3a GAGAL: total_price awal salah (%)', tp;
  END IF;

  UPDATE master_data."WorkPrice" SET material_price = 200000 WHERE id = 't-work-1';
  SELECT total_price INTO tp FROM master_data."WorkPrice" WHERE id = 't-work-1';
  IF tp <> 250000 THEN
    RAISE EXCEPTION 'TEST 3b GAGAL: total_price tidak ikut berubah (%)', tp;
  END IF;
  RAISE NOTICE 'TEST 3 LULUS: total_price generated dan konsisten';
END $$;

-- Test 5: v_library_brand harus tepat 9 kolom
DO $$
DECLARE col_count int;
BEGIN
  SELECT count(*) INTO col_count FROM information_schema.columns
  WHERE table_schema = 'master_data' AND table_name = 'v_library_brand';
  IF col_count <> 9 THEN
    RAISE EXCEPTION 'TEST 5 GAGAL: v_library_brand punya % kolom, bukan 9', col_count;
  END IF;
  RAISE NOTICE 'TEST 5 LULUS: v_library_brand tepat 9 kolom';
END $$;

-- Test 6: link kind di v_library_brand tidak memuat PRICE_LIST/MARKETPLACE/WHATSAPP
INSERT INTO master_data."BrandLink" (id, brand_id, kind, url) VALUES
  ('t-link-1', 't-brand-1', 'WEBSITE', 'https://example.com'),
  ('t-link-2', 't-brand-1', 'WHATSAPP', 'https://wa.me/000');

DO $$
DECLARE bad_kinds int;
BEGIN
  SELECT count(*) INTO bad_kinds
  FROM master_data."v_library_brand" vb,
       jsonb_array_elements(vb.links) elem
  WHERE vb.brand_id = 't-brand-1'
    AND elem->>'kind' IN ('PRICE_LIST','MARKETPLACE','WHATSAPP');
  IF bad_kinds <> 0 THEN
    RAISE EXCEPTION 'TEST 6 GAGAL: link kind terlarang muncul di v_library_brand (%)', bad_kinds;
  END IF;
  RAISE NOTICE 'TEST 6 LULUS: WHATSAPP tidak lolos ke v_library_brand';
END $$;

ROLLBACK;
