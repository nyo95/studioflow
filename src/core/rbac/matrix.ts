import { Role } from "@/generated/prisma";
import { PERMISSION } from "./constants";

/**
 * Static mapping of Roles to Permissions.
 */
export const ROLE_PERMISSIONS: Record<Role, PERMISSION[]> = {
  // ADMIN = studio boss. Admin-level access to the whole web app. The ONLY
  // difference from DEVELOPER is the SketchUp plugin surface (API keys, merge
  // queue, plugin page, synced-code swaps), which is hard-gated to
  // role === "DEVELOPER" at each call site and therefore never granted through
  // this matrix. (ADMIN absorbed the former OWNER role.)
  ADMIN: Object.values(PERMISSION),
  // DEVELOPER = technical superuser. Same full matrix as ADMIN; the extra
  // SketchUp plugin surface is granted by the hard role === "DEVELOPER" checks
  // outside this matrix, not here.
  DEVELOPER: Object.values(PERMISSION),
  // STAFF maintains vendors, materials, prices and samples (absorbed the former
  // CURATOR role's maintenance duties). Direct Material intake lands in
  // PENDING, while an edit preserves the row's current status. STAFF
  // deliberately does NOT hold either curation-approval permission —
  // Material/promotion approval is admin-level (ADMIN, DEVELOPER) only.
  STAFF: [
    PERMISSION.PROJECT_VIEW_AUDIT,
    PERMISSION.PLUGIN_SCHEDULE_VIEW,
    PERMISSION.LIBRARY_VIEW,
    PERMISSION.LIBRARY_EXPORT_LIST,
    PERMISSION.LIBRARY_CREATE_ITEM,
    PERMISSION.LIBRARY_EDIT_ITEM,
    PERMISSION.LIBRARY_DELETE_ITEM,
    PERMISSION.LIBRARY_MANAGE_VENDORS,
    PERMISSION.LIBRARY_MANAGE_BRANDS,
    PERMISSION.LIBRARY_MANAGE_SAMPLES,
    PERMISSION.LIBRARY_PROCESS_REQUEST,
    PERMISSION.LIBRARY_MARK_RECEIVED,
    // Master Data maintenance, excluding curation approval.
    PERMISSION.MASTERDATA_VIEW,
    PERMISSION.MASTERDATA_VENDOR_MANAGE,
    PERMISSION.MASTERDATA_SKU_MANAGE,
    PERMISSION.MASTERDATA_PRICE_VIEW,
    // Deliberately WITHOUT any BQ_* permission: after P1 (2026-08-19), costing
    // fields live directly on Sku. STAFF manages them through /masterdata with
    // MASTERDATA_SKU_MANAGE — no need to enter /bq at all.
  ],
  DIC: [
    PERMISSION.PROJECT_EDIT_METADATA,
    PERMISSION.PROJECT_SYNC_CHECKLIST,
    PERMISSION.PROJECT_EXPORT_PDF,
    PERMISSION.PHASE_ACTIVATE,
    PERMISSION.PHASE_SUBMIT_REVIEW,
    PERMISSION.PHASE_APPROVE_INTERNAL,
    PERMISSION.PHASE_REOPEN,
    PERMISSION.PHASE_OVERRIDE,
    PERMISSION.PHASE_MUTATE_CONTENT,
    PERMISSION.PHASE_UPLOAD_FILE,
    PERMISSION.PHASE_DELETE_FILE,
    PERMISSION.PLUGIN_SCHEDULE_ADD,
    PERMISSION.PLUGIN_SCHEDULE_EDIT,
    PERMISSION.PLUGIN_SCHEDULE_DELETE,
    PERMISSION.PLUGIN_SCHEDULE_VIEW,
    PERMISSION.LIBRARY_VIEW,
    PERMISSION.LIBRARY_REQUEST_MATERIAL,
  ],
  DRIC: [
    PERMISSION.PHASE_MUTATE_CONTENT,
    PERMISSION.PHASE_UPLOAD_FILE,
    PERMISSION.PLUGIN_SCHEDULE_ADD,
    PERMISSION.PLUGIN_SCHEDULE_EDIT,
    PERMISSION.PLUGIN_SCHEDULE_VIEW,
    PERMISSION.LIBRARY_VIEW,
    PERMISSION.LIBRARY_REQUEST_MATERIAL,
  ],
  // ESTIMATOR = BQ subapp only. Still the narrowest role in the system.
  //
  // Widened 2026-08-19 when BQ was built inside StudioFlow rather than as a
  // separate app: the granular BQ_* permissions now exist here (see
  // constants.ts for why), so an estimator has to actually hold them.
  //
  //   BQ_ACCESS             -> may enter the /bq surface.
  //   MASTERDATA_PRICE_VIEW -> may READ vendor/SKU pricing as data, because BQ
  //                            is the price consumer (30 Jul 2026 decision).
  //   BQ_PROJECT_MANAGE     -> owns the BQ project list.
  //   BQ_BREAKDOWN_EDIT     -> builds the BQ breakdown.
  //
  // Deliberately NOT granted BQ_SETTINGS_MANAGE. PRD §5.1: the estimator
  // changes no master data and no price, and conversion is part of defining a
  // price — it decides whether Rp285.000 means per sheet or per sqm.
  //
  // Deliberately NOT granted MASTERDATA_VIEW: that permission gates the
  // /masterdata UI, which belongs to STAFF. An estimator reads pricing through
  // BQ's own surface, never through the Master Data admin screens.
  //
  // Deliberately NOT granted any PROJECT_*, PHASE_* or LIBRARY_* permission.
  // An estimator has no StudioFlow project authority at all.
  ESTIMATOR: [
    PERMISSION.BQ_ACCESS,
    PERMISSION.MASTERDATA_PRICE_VIEW,
    PERMISSION.BQ_PROJECT_MANAGE,
    PERMISSION.BQ_BREAKDOWN_EDIT,
  ],
};
