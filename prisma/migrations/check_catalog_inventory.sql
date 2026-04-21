SELECT id, catalog_rak_location, catalog_box_number FROM "MaterialCatalog" WHERE catalog_rak_location IS NOT NULL OR catalog_box_number IS NOT NULL;
