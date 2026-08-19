-- Mirrors ensureDbSchemaPreflight() in src/core/platform/db.ts.
-- Every row this returns is something the preflight would report as missing.

WITH required_tables(schema_name, table_name) AS (VALUES
  ('studioflow','ProjectProductRequest'),('studioflow','AuditLog'),
  ('studioflow','TemporaryAttachment'),('studioflow','Project'),
  ('studioflow','ProjectMomDocument'),('studioflow','ProjectMomItem'),
  ('studioflow','ProjectMomPoint'),('studioflow','ProjectMomImage'),
  ('master_data','Party'),('master_data','PartyContact'),('master_data','PartyLink'),
  ('master_data','Brand'),('master_data','BrandLink'),('master_data','BrandCategory'),
  ('master_data','Category'),('master_data','Sku'),('master_data','SkuPrice'),
  ('master_data','SkuCategory'),('master_data','SkuMedia'),('master_data','WorkPrice'),
  ('master_data','Sample'),('master_data','SampleMovement')
),
required_columns(schema_name, table_name, column_name) AS (VALUES
  ('studioflow','AuditLog','project_id'),('studioflow','AuditLog','phase_id'),
  ('studioflow','AuditLog','reverted_at'),
  ('studioflow','Project','project_code'),
  ('studioflow','Activity','due_at'),
  ('studioflow','ProjectChecklist','parent_id'),('studioflow','ProjectChecklist','sort_order'),
  ('studioflow','ProjectChecklist','priority'),('studioflow','ProjectChecklist','due_at'),
  ('studioflow','ProjectChecklist','assigned_to_id'),('studioflow','ProjectChecklist','template_id'),
  ('studioflow','ProjectChecklist','created_at'),
  ('studioflow','ProjectProductRequest','brand_name_snapshot'),
  ('studioflow','ProjectProductRequest','sku_name_snapshot'),
  ('master_data','Sku','brand_id'),('master_data','Sku','code'),('master_data','Sku','name'),
  ('master_data','Sku','slug'),('master_data','Sku','kind'),('master_data','Sku','status'),
  ('master_data','Sku','spec'),('master_data','Sku','base_unit'),
  ('master_data','SkuPrice','sku_id'),('master_data','SkuPrice','price_list'),
  ('master_data','SkuPrice','price_net'),('master_data','SkuPrice','unit'),
  ('master_data','SkuPrice','is_current'),('master_data','SkuPrice','valid_from'),
  ('master_data','Sample','sku_id'),('master_data','Sample','rack_number'),
  ('master_data','Sample','box_number'),('master_data','Sample','status'),
  ('master_data','Party','name'),('master_data','Party','slug'),
  ('master_data','Party','legal_name'),('master_data','Party','type'),
  ('master_data','Brand','name'),('master_data','Brand','slug'),
  ('master_data','Brand','owner_party_id'),
  ('master_data','WorkPrice','code'),('master_data','WorkPrice','name'),
  ('master_data','WorkPrice','category_id'),('master_data','WorkPrice','unit'),
  ('master_data','WorkPrice','material_price'),('master_data','WorkPrice','labor_price'),
  ('master_data','WorkPrice','total_price')
)
SELECT 'MISSING TABLE' AS problem, rt.schema_name, rt.table_name, '' AS column_name
FROM required_tables rt
LEFT JOIN information_schema.tables t
  ON t.table_schema = rt.schema_name AND t.table_name = rt.table_name
WHERE t.table_name IS NULL
UNION ALL
SELECT 'MISSING COLUMN', rc.schema_name, rc.table_name, rc.column_name
FROM required_columns rc
LEFT JOIN information_schema.columns c
  ON c.table_schema = rc.schema_name AND c.table_name = rc.table_name
 AND c.column_name = rc.column_name
WHERE c.column_name IS NULL;
