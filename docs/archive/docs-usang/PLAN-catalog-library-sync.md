# Implementation Plan — Catalog / Library / Sync improvements

Orchestrator spec. Four work items. **Hard rule for every item: non-destructive
and no regression to in-progress data.** That means:

**Implementation status (July 24, 2026): #30, #32, #31, and #29 completed.**

- Only **additive** migrations (`ADD COLUMN` / new table / new enum value). Never
  `DROP` or `ALTER` an existing column, never a data-backfill that overwrites.
- No bulk data scripts that delete/overwrite rows.
- Preserve the existing write-path guards (blank material/fixture must never wipe
  an entry snapshot — see `autoLinkSyncedMaterial` / `autoLinkSyncedFixture`,
  `materialHasCatalogContent` / `fixtureHasContent`). A partial or legacy plugin
  payload is additive-only; only an explicitly attested `full_snapshot` may prune
  transient SketchUp staging, and it can never delete the linked Product Schedule
  snapshot.
- Every item verified with `npx tsc --noEmit` + `npx eslint <changed files>`
  before it's considered done.
- Back-compat: new field keys / mappings must not break stored snapshots or
  stored `catalog_fields` lists.

Recommended order: **#30 → #32 → #31 → #29** (verify foundation, then simplest
additive, then push-filter, then the biggest new path).

---

## #30 — Audit: three-way sync consistency (API staging ↔ Product Schedule ↔ plugin)

**Status:** Completed. The audit found and closed the coded-unused-material gap,
unsafe API-key bridge deletion, unverifiable acknowledgement, and an implicit
full-snapshot assumption. A live retest then exposed cloned material UUIDs:
28 request codes collapsed to 26 staging rows. Plugin v1.1.9 repairs duplicate
UUIDs before sending; the API rejects any remaining duplicate identities before
writes and acknowledges persisted rows only. `full_snapshot: true` is sent only
after complete scan/UUID validation; older or partial clients cannot prune.
The successful 28-row retest then exposed a display-state handoff gap: manual
schedule-only `catalog_fields` remained in the snapshot but were not copied to
the new staging row, so cards temporarily showed the Type/Brand default. The
handoff now hydrates empty staging fields/checklists from the snapshot, and the
first linked edit merges rather than rebuilding sparse data.

**Type:** verification only. No code change unless a defect is found; any fix must
be non-destructive.

**Why now:** many recent changes touched the sync path (prune "delete-unless-
reserved", blank-content guard, two-hop swap, code retarget). Confirm they compose
correctly before layering new data paths on top.

**Files in scope (read):**
- `src/app/api/sketchup/sync/route.ts` (POST push: upsert, rename reconciliation, prune, auto-link)
- `src/app/api/sketchup/merge/confirm/route.ts`
- `src/extensions/sketchup/actions/sketchup-actions.ts` — `autoLinkSyncedMaterial`, `autoLinkSyncedFixture`, `buildMaterialSnapshot`, `buildFFESnapshot`, `swapCatalogItemsAction`, `normalizeSketchupMaterialCodesAction`, `queueSketchupMaterialMergeAction`, `revokeApiKeyAction`
- Ruby: `core/api_client.rb`, `core/sync_dialog.rb`, `core/material_ops.rb`

**Scenarios to trace + expected result (assert each):**

1. **Rename in SketchUp** (same UUID, new code) → push. Expect: staging code
   updated; linked entry retargeted to new code (if slot free); no duplicate; no
   blanking. Confirm occupied-slot path only `console.warn`s, never corrupts.
2. **Delete in SketchUp** (unreserved) → attested full-snapshot push. Expect:
   staging row may be pruned,
   but its linked Product Schedule entry survives as a schedule-only catalog
   snapshot; RESERVED material survives; **empty payload → nothing pruned**
   (anti-wipe guard). Product Catalog deletion requires an explicit StudioFlow
   user action.
   A valid registered material that remains in the SketchUp material collection
   with zero geometry usage is still included in the plugin payload with its
   persistent UUID; `unused` is not authorization to omit a coded catalog item.
3. **Delete + recreate same code** (new UUID) → push. Expect: rename
   reconciliation carries old row's StudioFlow edits + link onto the new UUID,
   deletes the old row; no duplicate card; ambiguous multi-match only warns.
4. **Revoke → relink → push (blank materials).** Expect: entry catalog data
   PRESERVED (blank material must not overwrite). This is the regression that bit
   us — assert `materialHasCatalogContent`/`fixtureHasContent` gates hold.
5. **Web-initiated code change** (merge/normalize/swap) → queue → pull (GET
   returns `merge_actions`) → apply in plugin (Undo-wrapped) → `/merge/confirm`
   marks executed → next push. Expect: staging + schedule converge to new code;
   model only changed after explicit confirm.
6. **Swap two synced materials.** Expect: entries swap immediately; SketchUp
   rename queued as two-hop chain; after apply+push, all three converge; a push
   BEFORE apply leaves model untouched (only warns).
7. **Catalog content edit in web** (brand/type/color/finish/notes/photo) → verify
   it mirrors into the linked entry snapshot AND is never pushed into the SketchUp
   model (SSOT: model changes only via confirmed merge/rename).

**Deliverable:** a short findings note — PASS per scenario, or a defect with a
proposed non-destructive fix. Do NOT change behavior speculatively.

---

## #32 — Add card field "URL" (→ `catalog_reference_url`)

**Status:** Implemented with nullable additive migration
`20260724143000_add_sketchup_material_reference_url`.

**Goal:** a per-card URL field (product/reference link). Additive. Already flows
to Library (`saveCatalogItemToLibraryAction` sends `catalog_reference_url`).

**Migration (additive, non-destructive):**
- `SketchupMaterial`: add `reference_url String?` (nullable). New migration file,
  `ADD COLUMN` only. FFE needs NO migration (stores everything in `metadata` JSON).

**`src/extensions/sketchup/actions/sketchup-actions.ts`:**
- `CATALOG_FIELD_KEYS`: append `"url"`.
- `migrateLegacyFieldKeys`: unaffected (new key passes the
  `CATALOG_FIELD_KEYS.includes` filter). No legacy mapping needed.
- `CatalogItem` type: add `url: string | null`.
- `CatalogItemPatchSchema`: add `url: z.string().trim().max(4000).nullable().optional()`.
- `getProjectCatalogDocument`, all three item branches:
  - material: `url: realStr(mat.reference_url) || (snapshot ? realStr(snapshot.catalog_reference_url) : null)`
  - fixture: `url: realStr(meta?.reference_url) || (snapshot ? realStr(snapshot.catalog_reference_url) : null)`
  - schedule (manual): `url: realStr(snapshot.catalog_reference_url)`
- `FFEMetaSchema`: add `reference_url: z.string().optional().nullable()`.
- `updateSketchupMaterialAction`: write `reference_url` to staging (`data.url !== undefined ? data.url : undefined`).
- `updateSketchupFFEAction`: map explicitly `if (data.url !== undefined) metadata.reference_url = data.url`.
- `updateManualCatalogItemAction`: set `catalog_reference_url: data.url !== undefined ? data.url : current.catalog_reference_url` in the parsed snapshot.
- **Durability (critical, mirrors color/size):** `buildMaterialSnapshot` must read
  and emit `catalog_reference_url` from the material's new `reference_url` column,
  and `buildFFESnapshot` from `meta.reference_url`. Otherwise the next edit/sync
  (which rebuilds the snapshot from staging) blanks the URL — same class of bug as
  the echo issue. Add `reference_url` to the builder input types + set
  `catalog_reference_url` (top-level) in the returned snapshot.

**`src/extensions/sketchup/components/CatalogBoard.tsx`:**
- `FIELD_DEFS`: add `{ key: "url", label: "URL" }` (after `location`).
- `DEFAULT_FIELDS`: `url: false`.
- `fieldValue`: `if (field === "url") return item.url || ""`.
- `optimisticPatch`: `if (field === "url") return { url: value as string | null }`.
- `patchKeyFor`: `url` maps to `url` (only `location` differs).
- Polish: render URL as a clickable, truncated anchor when present
  (`target="_blank" rel="noreferrer"`) in the non-edit view.

**Non-destructive guarantees:** new nullable column; new opt-in field (default
off) so existing `catalog_fields` lists are unchanged; snapshot already has
`catalog_reference_url`, no rewrite of old data.

**Verify:** `tsc` + `eslint`; trace: add URL on a synced material → push again →
URL persists (proves builder durability); fields-only toggle → no DRAFT flip / no
auto-create (URL edit is a real data patch; `catalog_fields` toggle stays excluded).

---

## #31 — Filter "relative reference" values on Library push

**Status:** Implemented. A token is treated as project-relative only when it
resolves to an actual schedule entry in the current project, preventing false
positives such as a normal `RAL-9010` color code.

**Goal:** values that are project-relative instructions (e.g. `"Stainless Look -
Match to MSC-1"`, `"as MSC-1"`) must NOT populate the Library product's
color/finishing/motif — even though they legitimately show on the project card.
Location is already excluded (not sent, no column). This ONLY changes what
`saveCatalogItemToLibraryAction` copies; project data is untouched.

**Decision applied:** filter only when a code token resolves to an entry in the
current project. `"Stainless Look"` and an unrelated `RAL-9010` value still go
to Library; `"... Match to MSC-1"` does not when `MSC-1` exists in the project.

**`src/extensions/sketchup/actions/sketchup-actions.ts`:**
```ts
// Match code-shaped tokens, then confirm each token against this project's
// real schedule codes. This avoids treating a normal RAL-9010 value as a
// project reference unless RAL-9010 is actually an entry in the project.
const PROJECT_CODE_TOKEN = /\b[A-Za-z]{1,4}-\d+\b/g;
function isProjectRelativeRef(
  value: string | null | undefined,
  projectCodes: ReadonlySet<string>
): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  const tokens = v.match(PROJECT_CODE_TOKEN) ?? [];
  return tokens.some((token) => projectCodes.has(normalizeCatalogCode(token)));
}
```
In `saveCatalogItemToLibraryAction`, gate the three spec fields when building `input`:
```ts
const rawColor = realStr(snap.specs.catalog_color);
const rawFinishing = realStr(snap.specs.catalog_finishing);
const rawMotif = realStr(snap.specs.catalog_motif);
catalog_color: (rawColor && !isProjectRelativeRef(rawColor, projectCodes)) ? rawColor : "N/A",
catalog_finishing: (rawFinishing && !isProjectRelativeRef(rawFinishing, projectCodes)) ? rawFinishing : undefined,
catalog_motif: (rawMotif && !isProjectRelativeRef(rawMotif, projectCodes)) ? rawMotif : undefined,
```
(`catalog_color` keeps the `"N/A"` fallback — ProductCatalog requires color.)

**Non-destructive:** no schema change, no writes to project data; existing Library
items unchanged; only future pushes filtered. Card/schedule still show the relative
value verbatim (only the Library copy is scrubbed).

**Verify:** `tsc` + `eslint`; trace: push SPR-3 (`"... Match to MSC-1"` / `"as
MSC-1"`) → Library color/finishing come out clean, name+brand still push; push a
normal `"Soft Pink"` → unchanged.

---

## #29 — "Add item" from Library (instead of manual only)

**Status:** Implemented through the existing `ScheduleService` catalog mode,
with membership RBAC, search, section filtering, and transactional duplicate
rollback.

**Goal:** in the Add-item dialog, add a "From Library" mode: pick an existing
`ProductCatalog` product → create a new schedule entry linked to it
(`product_catalog_id` set + snapshot from the product). Reverse of Save-to-Library;
ports the deleted `ScheduleProductPickerModal` concept.

**Reuse (already exists — do NOT re-implement):**
- `ScheduleService.addEntryToSchedule(tx, projectId, category, "catalog", catalogItemId, …)`
  already resolves a catalog item and builds the snapshot from the library product
  (`resolveCatalogItemForMode` + `buildScheduleSnapshot(..., "library")`). The new
  action is a thin, RBAC-gated wrapper.
- Library product listing: `LibraryService.getProducts` / existing library read
  actions (`src/extensions/library/actions/library-actions.ts`). Reuse for the
  picker (search by code/name/brand/category, filter by section).

**New server action** in `sketchup-actions.ts` (or a small new file):
```ts
export async function addCatalogItemFromLibraryAction(projectId, productCatalogId) {
  // requireCatalogEditor(projectId, PERMISSION.PLUGIN_SCHEDULE_ADD)  // membership-gated
  // load ProductCatalog (exists, not deleted); derive section + category
  // tx: ScheduleService.addEntryToSchedule(tx, projectId, product.catalog_category,
  //     "catalog", productCatalogId, undefined, section, userId)
  // revalidateCatalog(projectId); return { success, entryId }
}
```
- Section: `product.catalog_type` → material/fixture.
- Category: `product.catalog_category` (normalized); `addEntryToSchedule` resolves/
  creates the PrefixDictionary + normalized code (same as manual add).
- Created option gets `product_catalog_id` set (shows as "in Library", stays linked).

**`src/extensions/sketchup/components/CatalogBoard.tsx` (Add-item dialog):**
- Add a mode switch: "New manual" vs "From Library" (keep manual flow untouched).
- "From Library": searchable product list (code · name · brand, thumbnail) via a
  library list action; on pick → `addCatalogItemFromLibraryAction(projectId, id)` →
  toast + `router.refresh()`.

**RBAC:** same as manual add — `requireCatalogEditor` + `PLUGIN_SCHEDULE_ADD`,
membership required; view-only users don't see it.

**Non-destructive:** creates NEW entries only; never edits/deletes existing; no
schema change (uses existing `product_catalog_id`). Confirm `addEntryToSchedule`
"catalog" mode's `checkDuplicateProduct` surfaces a friendly "already in this
schedule" message rather than throwing raw.

**Verify:** `tsc` + `eslint`; trace: pick a library product → new coded entry in the
right category with product data + `product_catalog_id`; pick same product twice →
duplicate guard message, no crash; manual add still works.

---

## Cross-cutting verification (after all four)

1. Full `npx tsc --noEmit` clean.
2. `npx eslint` clean on every changed file (pre-existing warnings in untouched
   files acceptable; no NEW errors).
3. `npx prisma migrate deploy` applies only additive migrations (URL column) — no
   destructive SQL.
4. Regression spot-checks: field show/hide still doesn't auto-create entries;
   revoke+relink still preserves data (guard intact); print/export still renders;
   render-board tab unaffected.
5. Recommend (belt-and-suspenders): `pg_dump` before migrations, even though
   nothing here deletes data.
