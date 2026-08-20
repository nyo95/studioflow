-- BQ: buat snapshot costing nullable — SKU tanpa costing profile tetap bisa di-add.
-- profile = null → conversion 1:1, usage_unit = purchase_unit (ditangani di calc.ts).

ALTER TABLE "bq"."BqMaterialLine" ALTER COLUMN "snapshot_usage_unit" DROP NOT NULL;
ALTER TABLE "bq"."BqMaterialLine" ALTER COLUMN "snapshot_purchase_unit" DROP NOT NULL;
ALTER TABLE "bq"."BqMaterialLine" ALTER COLUMN "snapshot_conversion" DROP NOT NULL;
