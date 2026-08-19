-- Master Data v2 follow-up: drop the orphaned studioflow.LibraryItemStatus enum.
--
-- It backed `Material.catalog_status` in v1. v2 replaced that column with
-- `Sku.status` typed `master_data.SkuStatus` (DRAFT / ACTIVE / DISCONTINUED),
-- leaving this type with zero referencing columns — verified before writing
-- this migration, not assumed.
--
-- The orphan was not harmless. Prisma only emits enums that are reachable from
-- the datamodel into `index-browser.js`, so `LibraryItemStatus` kept its
-- generated TYPE (tsc stayed green) but lost its runtime VALUE in client
-- bundles. Every "use client" component reading LibraryItemStatus.PENDING threw
-- "Cannot read properties of undefined" at module evaluation.
--
-- PENDING / APPROVED / REJECTED now live as a plain const in
-- src/extensions/library/types.ts, which is where a display-only status belongs.
--
-- RESTRICT, not CASCADE: if something does still reference this, fail loudly
-- rather than silently drop that column.

DROP TYPE IF EXISTS "studioflow"."LibraryItemStatus" RESTRICT;
