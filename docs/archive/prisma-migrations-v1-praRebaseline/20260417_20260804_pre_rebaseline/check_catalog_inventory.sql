SELECT 
  p.id as product_id, 
  p.catalog_sku, 
  s.id as sample_id, 
  s.catalog_rack_number, 
  s.catalog_box_number 
FROM "ProductCatalog" p
JOIN "PhysicalSample" s ON p.id = s.product_id
WHERE s.catalog_rack_number IS NOT NULL OR s.catalog_box_number IS NOT NULL;
