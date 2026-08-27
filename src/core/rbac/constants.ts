/**
 * Granular Permissions for the StudioFlow system.
 * Centralized here to ensure a single source of truth for access control.
 */
export enum PERMISSION {
  // Project Permissions (8)
  PROJECT_CREATE = "PROJECT_CREATE",
  PROJECT_DELETE = "PROJECT_DELETE",
  PROJECT_EDIT_METADATA = "PROJECT_EDIT_METADATA",
  PROJECT_EDIT_PRIORITY = "PROJECT_EDIT_PRIORITY",
  PROJECT_VIEW_AUDIT = "PROJECT_VIEW_AUDIT",
  PROJECT_SYNC_CHECKLIST = "PROJECT_SYNC_CHECKLIST",
  PROJECT_FORCE_SYNC = "PROJECT_FORCE_SYNC",
  PROJECT_EXPORT_PDF = "PROJECT_EXPORT_PDF",

  // Phase Permissions (12)
  PHASE_ACTIVATE = "PHASE_ACTIVATE",
  PHASE_SUBMIT_REVIEW = "PHASE_SUBMIT_REVIEW",
  PHASE_APPROVE_INTERNAL = "PHASE_APPROVE_INTERNAL",
  PHASE_APPROVE_CLIENT = "PHASE_APPROVE_CLIENT",
  PHASE_REJECT = "PHASE_REJECT",
  PHASE_REOPEN = "PHASE_REOPEN",
  PHASE_OVERRIDE = "PHASE_OVERRIDE",
  PHASE_MUTATE_CONTENT = "PHASE_MUTATE_CONTENT",
  PHASE_UPLOAD_FILE = "PHASE_UPLOAD_FILE",
  PHASE_DELETE_FILE = "PHASE_DELETE_FILE",
  PHASE_MANAGE_CD = "PHASE_MANAGE_CD",
  PHASE_MANAGE_TIMELINE = "PHASE_MANAGE_TIMELINE",

  // Scheduled Fixtures (Plugin) (7)
  PLUGIN_SCHEDULE_ADD = "PLUGIN_SCHEDULE_ADD",
  PLUGIN_SCHEDULE_EDIT = "PLUGIN_SCHEDULE_EDIT",
  PLUGIN_SCHEDULE_DELETE = "PLUGIN_SCHEDULE_DELETE",
  PLUGIN_SCHEDULE_APPROVE = "PLUGIN_SCHEDULE_APPROVE",
  PLUGIN_SCHEDULE_EXPORT = "PLUGIN_SCHEDULE_EXPORT",
  PLUGIN_SCHEDULE_ASSIGN = "PLUGIN_SCHEDULE_ASSIGN",
  PLUGIN_SCHEDULE_VIEW = "PLUGIN_SCHEDULE_VIEW",

  // Library Permissions (12)
  LIBRARY_VIEW = "LIBRARY_VIEW",
  LIBRARY_CREATE_ITEM = "LIBRARY_CREATE_ITEM",
  LIBRARY_EDIT_ITEM = "LIBRARY_EDIT_ITEM",
  LIBRARY_DELETE_ITEM = "LIBRARY_DELETE_ITEM",
  LIBRARY_MANAGE_VENDORS = "LIBRARY_MANAGE_VENDORS",
  LIBRARY_MANAGE_BRANDS = "LIBRARY_MANAGE_BRANDS",
  LIBRARY_MANAGE_SAMPLES = "LIBRARY_MANAGE_SAMPLES",
  LIBRARY_REQUEST_MATERIAL = "LIBRARY_REQUEST_MATERIAL",
  LIBRARY_PROCESS_REQUEST = "LIBRARY_PROCESS_REQUEST",
  LIBRARY_MARK_RECEIVED = "LIBRARY_MARK_RECEIVED",
  LIBRARY_EXPORT_LIST = "LIBRARY_EXPORT_LIST",
  LIBRARY_ADMIN_OVERRIDE = "LIBRARY_ADMIN_OVERRIDE",

  // Master Data subapp (6)
  //
  // Master Data OWNS supplier identity, SKU identity and pricing. Decided
  // 30 Jul 2026, overriding UPSTREAM-BQ-MATERIAL-SOURCE.md §0.1 which had
  // assigned pricing to BQ: Master Data is now the owner and BQ is a consumer.
  //
  // PRICE IS NOT A DESIGNER CONCERN. Never grant MASTERDATA_PRICE_VIEW to
  // DIC/DRIC. See the known-leak note in MASTER_SSOT.md §5.7 about the
  // pre-existing ProductCatalog.catalog_price surface in schedule-service.
  MASTERDATA_VIEW = "MASTERDATA_VIEW",
  MASTERDATA_VENDOR_MANAGE = "MASTERDATA_VENDOR_MANAGE",
  MASTERDATA_SKU_MANAGE = "MASTERDATA_SKU_MANAGE",
  MASTERDATA_PRICE_VIEW = "MASTERDATA_PRICE_VIEW",
  MASTERDATA_MATERIAL_APPROVE = "MASTERDATA_MATERIAL_APPROVE",
  MASTERDATA_PROMOTION_APPROVE = "MASTERDATA_PROMOTION_APPROVE",

  // BQ subapp (5)
  //
  // REVISED 2026-08-19. This block used to hold exactly one permission, with
  // the note "do not add granular BQ permissions here". That note was correct
  // under the assumption it cited — UPSTREAM-BQ-MATERIAL-SOURCE.md §0.2, where
  // BQ was a SEPARATE application that enforced its own permissions and
  // StudioFlow only gated the door.
  //
  // The owner reversed that on 2026-08-19: BQ is built INSIDE StudioFlow at
  // /bq. There is no other process left to enforce BQ_* in, so the granular
  // permissions belong here after all. Keeping the single-permission shape
  // would not have made BQ safer — it would have meant every BQ action was
  // gated by "may enter the page", which is not a permission model.
  //
  // The split follows PRD_Fixture_Breakdown.md §5.1, which separates the
  // estimator (builds breakdowns, touches no master) from the material admin
  // (owns conversion, waste, purchasing assumptions):
  //
  //   BQ_ACCESS           -> may enter the /bq surface.
  //   BQ_PROJECT_MANAGE   -> create / rename / archive BQ projects.
  //   BQ_BREAKDOWN_EDIT   -> objects, sub-objects, and L3 lines.
  //   BQ_SETTINGS_MANAGE  -> BqMaterialProfile, category waste defaults, office
  //                          defaults. Deliberately NOT granted to ESTIMATOR
  //                          (PRD §5.1: an estimator changes no master data,
  //                          and conversion is part of defining a price).
  //
  // Purchase Summary has no permission of its own: it is a different reading of
  // the same breakdown the holder can already open, so a separate gate would
  // only be a checkbox that never differs from BQ_ACCESS.
  BQ_ACCESS = "BQ_ACCESS",
  BQ_PROJECT_MANAGE = "BQ_PROJECT_MANAGE",
  BQ_BREAKDOWN_EDIT = "BQ_BREAKDOWN_EDIT",
  BQ_SETTINGS_MANAGE = "BQ_SETTINGS_MANAGE",

  // System Permissions
  SYSTEM_CONFIG_EDIT = "SYSTEM_CONFIG_EDIT",
}
