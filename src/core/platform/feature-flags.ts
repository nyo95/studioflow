/**
 * FEATURE FLAGS — surface-level toggles, not code deletion.
 *
 * ============================================================================
 * WHY THIS FILE EXISTS
 * ============================================================================
 * When the owner asks to "disable X for now", the wrong answer is to delete the
 * component, the action and the route. That loses the tested code, the audit
 * trail wiring, and the reason it existed — and re-enabling becomes an
 * archaeology exercise.
 *
 * These flags hide a surface while the server actions, services and database
 * rows stay exactly where they are. Nothing is dropped, nothing is migrated.
 * Flip a flag back to `true` and the feature returns unchanged.
 *
 * ============================================================================
 * RULES
 * ============================================================================
 * 1. A flag hides UI. It does NOT weaken a permission check. Every server
 *    action keeps its own `assert*Permission` gate — a disabled surface must
 *    never become the only thing standing between a user and a mutation.
 * 2. Keep flags boolean and static. No env lookups, no database reads: this is
 *    imported by both server components and client components, and a flag that
 *    can differ between the two produces hydration mismatches.
 * 3. Every flag carries the date and the reason. Delete the flag (and keep the
 *    feature) once the decision is permanent, or delete both once it is dead.
 */

/**
 * Promotion Queue — the designer→library promotion approval flow.
 *
 * Disabled 31 July 2026 by owner direction, in BOTH surfaces:
 *   - StudioFlow  `/extensions/library`  (the "Queue" tab)
 *   - Master Data `/masterdata/promotions`
 *
 * Reason: the material master is being restructured around a single Materials
 * table. Until Vendor / Offering / SKU settle into their final shape, an
 * approval queue that promotes project drafts into that catalog would be
 * approving rows into a schema that is about to change.
 *
 * NOT deleted, deliberately. Still intact behind this flag:
 *   - `PromotionRequest` model and all its rows
 *   - `getPromotionRequestsAction`, `reviewPromotionRequestAction`,
 *     `createPromotionRequestAction`
 *   - `PromotionQueueTable`, `MasterDataPromotionsClient`
 *   - `LibraryService.reviewPromotionRequest` and its audit logging
 *
 * Re-enable by setting this to `true`. No migration required either way.
 */
export const FEATURE_PROMOTION_QUEUE_ENABLED = false;

/**
 * Vendor / Requests management, AND product create/edit/delete, inside the
 * StudioFlow Library.
 *
 * Disabled 31 July 2026 by owner direction. StudioFlow's Library is now
 * VIEW-ONLY: designers and drafters browse the catalog and physical samples,
 * but supplier identity, material requests, the promotion queue, and now
 * product mutation itself are Master Data's surfaces, reached at
 * `/masterdata/*`.
 *
 * First pass (31 Jul 2026, same day) only hid the `vendors` and `requests`
 * tabs — it missed that the Catalog tab still rendered "Add Product" and
 * per-row Edit/Delete, because those are gated on `access.canCreate` /
 * `canEdit` / `canDelete`, not on a tab. Corrected same day: this flag now
 * also gates those three affordances in `LibraryTabs.tsx`.
 *
 * The underlying actions (`getVendorsAction`, `createVendorAction`,
 * `getAllProductRequestsAction`, `createProductAction`, `updateProductAction`,
 * `deleteProductAction`, …) are untouched and are exactly what
 * `/masterdata/*` calls. Permission checks inside those actions still apply —
 * this flag only hides the button, it does not touch `assert*Permission`.
 */
export const FEATURE_LIBRARY_MANAGEMENT_TABS_ENABLED = false;
