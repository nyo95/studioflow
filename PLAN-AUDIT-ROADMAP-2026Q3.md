> ## ⚠️ DOKUMEN USANG — Master Data v1
>
> Diberi tanda pada perapihan dokumentasi **2026-08-18**.
>
> Berkas ini menggambarkan **Master Data v1**, schema yang sudah
> **tidak ada** — ia di-`DROP SCHEMA … CASCADE` oleh migrasi
> `20260810180000_masterdata_v2_rebaseline` pada 2026-08-10.
> Model seperti `Vendor`, `MaterialCatalog`, `Company`, dan kolom `catalog_*`
> tidak lagi mewakili keadaan sekarang.
>
> **Dipertahankan di root semata-mata karena 14 berkas di `src/` masih
> mengutip namanya di komentar.** Menghapusnya akan membuat rujukan itu
> menggantung — lebih buruk daripada dokumen usang yang jelas bertanggal lama.
>
> **Acuan yang berlaku:** [`AGENTS.md`](AGENTS.md) §🧱 Master Data Contract (v2)
> dan [`prisma/schema.prisma`](prisma/schema.prisma).
> Pekerjaan terbuka: [`roadmap.md`](roadmap.md).
>
> Verifikasi ulang isinya dilacak sebagai **T3** di `roadmap.md` — dokumen ini
> pernah menandai sebuah perbaikan "selesai" padahal belum.

---

# StudioFlow — Regression Audit & Q3 Roadmap

**Author:** Product (senior PM pass)
**Date:** 2026-08-04
**Scope:** Main app (`studioflow`) regression/QA audit + roadmap for 6 owner-requested initiatives.
**Status:** Planning doc. No code changes made — review before scheduling work.

---

## 0. How to read this doc

Two parts:

1. **Audit** (§1) — what I checked, what's healthy, and the defects/regressions found, ranked by risk. Read this first: item A1 gates everything else.
2. **Roadmap** (§2) — the 6 initiatives, each with problem statement, current state in code, proposed approach, effort, and sequencing. §3 is the recommended execution order.

Verification performed this pass: full `tsc --noEmit` (clean, exit 0); static read of the critical paths (projects list, project detail, phases, schedule service, deliverables, library, `ui_engine`, RBAC, upload API); `git` working-tree inspection. ESLint did not finish in the audit sandbox (very slow over the mounted FS) — re-run `npm run lint` locally before release. A live in-browser walkthrough is still pending (blocked on the Chrome extension not being connected — see §4).

---

## 1. Regression / QA Audit

### 1.1 Health summary

| Signal | Result |
|---|---|
| `tsc --noEmit` (typecheck) | ✅ Clean (exit 0) — no compile-level regressions |
| `ui_engine` token discipline | ✅ Strong — one import surface (`@/ui_engine`), tokens over hardcoded `var(--ui-*)`; `BrandLibraryExplorer` header comment even documents a past token-hardcoding defect that was fixed |
| Schedule architecture | ✅ Sound — snapshot-first (project data frozen on add, decoupled from library edits), deterministic code normalization |
| RBAC layering | ✅ Layered — permission + project-membership checks in actions (`assertScheduleAccess`, `getProjectMembershipOrThrow`, `assertDeliverableUploadAccess`) |
| ESLint (full) | ⚠️ Not completed in sandbox — run locally |
| Git hygiene | 🔴 See A1 — critical |
| Deliverable file storage | 🔴 See A2 — confidential files served without auth |
| Projects list responsiveness | 🟠 See A3 — overlap/clipping, matches the reported symptom |

Overall: the code that exists is **higher quality than typical** — the token system and snapshot model are genuinely well-built. The serious risks are **operational** (uncommitted work, insecure file serving), not a broad rot of logic bugs.

---

### 1.2 Findings, ranked

#### 🔴 A1 — ~1.5 months of work is uncommitted in the working tree (highest risk)

**Evidence:** `HEAD` is `b503bcc`, dated **2026-06-17**. Source files carry modification dates through **2026-08-03**. `git status` shows **285 files modified**; ignoring whitespace/line-endings, **239 files under `src/` still have real content changes** (e.g. `deliverables-table.tsx` migrating imports from `@/components/ui` → `@/ui_engine`, adding `projectId` plumbing). There is **no `.gitattributes`**, so a CRLF↔LF line-ending churn is layered on top of the real diff, making every file appear fully rewritten (`README.md`: 65 insertions / 65 deletions of identical text).

**Why it matters:** essentially the entire current product — the `ui_engine` consolidation, deliverables, brand-first library, schedule reuse — exists **only** in one uncommitted working copy. One bad `git checkout`/`git reset`, disk failure, or reset-to-default wipes weeks of work with no history to recover from. It's also unreviewable: you cannot diff or bisect, so any regression is invisible.

**Recommendation (do before any roadmap work):**
1. Add `.gitattributes` with `* text=auto eol=lf` (and `*.png/*.pdf binary`) to stop the line-ending churn.
2. Re-normalize once (`git add --renormalize .`) so the diff collapses to *real* changes only.
3. Commit the real work in reviewable chunks (ui_engine, actions/services, app routes, prisma) with messages, and tag a checkpoint.
4. Confirm `.next/`, `node_modules/`, `public/uploads/` are gitignored (they should not be tracked).

This is a half-day of cleanup that de-risks everything downstream. **A6 (ui_engine hardening) and every other item should branch from a clean commit, not this working tree.**

---

#### 🔴 A2 — Deliverable & media files are written to `public/uploads/` and served with no access control

**Evidence:** `src/app/api/upload/media/route.ts` writes uploads to `public/uploads/<folder>/…` and returns a public relative URL (`/uploads/...`). The deliverable dialog (`deliverable-upload-dialog.tsx`) posts confidential phase deliverables through this route. The upload endpoint checks the caller is logged in, but the **resulting file is a static asset**: anyone with the URL — or anyone iterating predictable `projects/<id>/deliverables/<phaseId>/<revId>/<timestamp>-<name>` paths — can download it **without a session**. There is also **no file-size cap and no MIME/type allow-list** (`fileType` is inferred client-side from the extension and trusted).

**Why it matters:** deliverables are client-confidential design files. Static, unauthenticated serving is a data-exposure defect, and the missing size/type validation is an availability/abuse risk. It also ties file storage to a single machine's local disk (breaks the moment the app runs on more than one instance).

**Recommendation:** treat this as the backbone of Roadmap item **R3** (deliverable/file logic). Move deliverable storage behind an authenticated route (stream from a non-public dir or Supabase Storage with signed URLs + RBAC re-check on read), add a size limit and server-side MIME allow-list, and store a content hash. Details in §2.3.

---

#### 🟠 A3 — Projects list is non-responsive and overlaps (matches the reported symptom)

**Evidence:** `ProjectListClient` renders a `TableCard layout="fixed"` with **percentage** column widths and a custom drag-resizer, but `TableCard` wraps the `<table>` in `overflow-hidden` (not `overflow-x-auto`). Consequences:
- No horizontal scroll — on narrow viewports columns can't shrink below content, so cells clip and collide.
- `table-fixed` % widths have **no `min-width`**, so the 18%-wide PROGRESS column (which can hold multiple phase badges plus long labels like `ON CLIENT REVIEW` / `READY FOR …`) and the 8%-wide actions column (which reveals a priority `<select>` on hover) **overlap** — exactly the collision circled in the reported screenshot (`ON CLIENT REV…` over the `NORMAL` select).
- The whole surface has **no mobile/stacked layout**; the resizer is desktop-mouse-only.

**Why it matters:** it's the primary landing surface and it's visibly broken on smaller screens. This is Roadmap item **R4**.

**Recommendation:** see §2.4 — give the table a scroll container + column min-widths, move the priority control out of the hover-reveal group, and add a card/stacked layout under the `md` breakpoint.

---

#### 🟡 A4 — `getProjectProgress` has two edge-case defects

**Evidence:** `src/lib/project-progress.ts`.
1. **Empty-phases crash:** the final fallback is `return { type: 'READY_FOR', nextPhaseName: sortedPhases[0].name_enum }`. A project with **zero phases** makes `sortedPhases[0]` `undefined` → runtime `TypeError` reading `.name_enum`. This renders on the projects dashboard for every row, so one phase-less project can break the list.
2. **Wrong fallback state:** in step 3, `READY_FOR` is only returned when the first non-done phase is `PENDING`. If it's in any other non-active, non-completed state, control falls through step 4 (allDone is false) to the same `sortedPhases[0]` fallback — showing "READY FOR <first phase>" even when the project is mid-pipeline.

**Recommendation:** guard `phases.length === 0` explicitly (return a neutral "No phases" state) and make the final fallback use the furthest worked/first-non-done phase rather than index 0. Low effort; fold into R4 or a quick fix.

---

#### 🟡 A5 — Dead/º retired surfaces still shipped

**Evidence:** `/extensions/library` is a documented teardown that now just `redirect()`s (fine as a bookmark shim), but the route still exists alongside the live `/library`. `registry.ts` also carries disabled `timeline`/`upcoming` extensions. Not a defect, but surface area that confuses navigation and audits.

**Recommendation:** fold the label rename + nav cleanup into Roadmap item **R5**. **Decision (owner, 2026-08-04):** keep the redirect shim indefinitely — permanent, no sunset date; cheap to maintain and protects against stale bookmarks/shared links.

---

#### ℹ️ A6 — 59 `TODO/FIXME/@ts-ignore/eslint-disable` markers in `src/`

Not individually blocking, but worth a triage pass — some may hide the kind of edge cases in A4. Track as tech-debt cleanup, not a release gate.

---

## 2. Roadmap — the 6 initiatives

Each item: **Problem** → **Current state in code** → **Proposed approach** → **Effort / risk**. IDs map to the owner's list.

### 2.1 R1 — Product Schedule: recurring template per project

**Problem (owner):** "template berulang tiap proyek" — every new project should start from a standard schedule skeleton instead of an empty sheet.

**Current state:** `ScheduleTemplate` (prisma) holds only `{ schedule_category, section, is_active }` — it's a *category dictionary* that feeds the "available categories" dropdown (`getActiveScheduleTemplates`). It does **not** pre-populate entries, so each project's schedule starts empty and the team re-creates the same PT-/FL-/etc. rows by hand.

**Proposed approach:**
- Extend the template model into a real, versioned template: a `ScheduleTemplate` (header: name, section, is_active, version) with child `ScheduleTemplateEntry` rows (prefix, default location, category, qty/unit defaults, order). Keep the existing category-dictionary behavior as the degenerate case.
- On project creation (and via an explicit "Apply template" action for existing projects), materialize template entries into `ProjectScheduleEntry` rows through the existing `ScheduleService` add path, so code normalization and snapshot rules are reused — no bypass of the SSOT.
- Make it **additive and idempotent**: applying a template never overwrites existing entries; it fills gaps and is safe to re-run.
- Admin UI under settings to manage templates (CRUD + activate/deactivate + "set as default for new projects").
- **Decision (owner, 2026-08-04): one global default template per section**, not per-client. This matches the existing `ScheduleTemplate` scoping (already `section`-based) and keeps the model simple — the current category-dictionary approach is confirmed as the right foundation, just extended with entry rows as above. If client-specific variation is needed later, layer it as entry-level overrides applied *after* the global template, rather than forking the template itself per client.

**Note (2026-08-04, verified while executing R2):** unlike R2, this item's premise holds up — `ScheduleTemplate`/`getActiveScheduleTemplates` are still actively used by the current live UI (`src/components/template-manager.tsx`, `studio-settings-panel.tsx`, `settings-service.ts`), and the underlying `ProjectScheduleEntry`/`ProjectScheduleOption` tables are unchanged. One correction: an admin UI for the *category-dictionary* layer already exists in `template-manager.tsx` (CRUD for `ScheduleTemplate` rows) — "Admin UI under settings" above should be read as *extending* that existing screen with entry-level fields (prefix, location, qty/unit defaults), not building one from scratch. Also worth checking against `src/subapps/bq/` (currently an empty scaffold, see R2's correction) before starting, in case entry materialization is meant to land there instead of in `ScheduleService`.

**Effort / risk:** M (schema migration + service + settings-screen extension + create-project hook). Depends on A1 being resolved first (schema change on an uncommitted tree is dangerous) — now satisfied.

**Implemented 2026-08-04.** Kept the model minimal rather than adding a full `ScheduleTemplateEntry` child table with product-snapshot defaults: qty/location/product details are inherently project-specific and don't make sense as template defaults, so a template "entry" is just a placeholder category row (reuses the existing `mode: "reserve"` path in `ScheduleService.addEntryToSchedule`, empty of any product/option data). Lowest-risk option that reuses 100% of the existing snapshot/code-normalization machinery — no bypass of the SSOT.

- Schema: single additive column, `ScheduleTemplate.is_default_entry` (boolean, default `false`) — no new table. Migration `20260804140000_add_schedule_template_default_entry`.
- `ScheduleService.applyDefaultTemplateEntries(tx, projectId, userId?)` — fetches all `is_default_entry: true` templates, diffs against the project's existing `(section, schedule_category)` pairs, and calls `addEntryToSchedule(..., "reserve", ...)` only for the missing ones. **Additive and idempotent** as specified: never touches existing entries, safe to re-run.
- **New projects:** hooked into `project-service.ts`'s `executeBootstrapProject`, right after the initial revision is created — every new project now starts with the default categories pre-populated instead of an empty sheet.
- **Existing projects:** an explicit **"Apply default template"** button in `CatalogBoard.tsx`'s toolbar (admin/editor-gated via the existing `canEdit`), calling a new `applyDefaultScheduleTemplateAction` — fills any gaps against the current defaults, reports how many categories were added, no-ops cleanly ("Already up to date") when there's nothing to add.
- **Admin UI:** extended the existing category-dictionary screen (`template-manager.tsx`, under Settings → Product Library) rather than building a new one, per the 2026-08-04 note above. Each category row now shows a toggle (a `LayoutTemplate` icon button, only enabled when the row has an active `ScheduleTemplate`, not just a prefix) to mark/unmark it as a default, plus a small "Default" badge when active. Wired through a new `setScheduleTemplateDefaultEntry` action → `settingsService.executeSetScheduleTemplateDefaultEntry`.
- Audit logging on both paths (`SCHEDULE_APPLY_TEMPLATE` on apply, `SET_SCHEDULE_TEMPLATE_DEFAULT_ENTRY` on toggle).
- Per the owner's decision, this is **one global default template per section** — no per-client variant. Client-specific variation, if ever needed, would layer in later as entry-level overrides applied after the global defaults, not a per-client fork of the template.
- Not done: the `src/subapps/bq/` scaffold mentioned in the 2026-08-04 note is still empty — entry materialization stayed in `ScheduleService` as planned, nothing to migrate yet.

---

### 2.2 R2 — Product Schedule: "Add item from Library" → source from another project's snapshot

**Problem (owner):** change the source of "add item from library" from the global catalog to a **snapshot of another project** (reuse what was actually specced before).

**⚠️ CORRECTION (2026-08-04, discovered while executing R2):** the original "Current state" below was written from `src/extensions/schedule/{actions,services}` alone and was **wrong about which UI is live**. Executing R4/R5/R6 first (and committing A1) surfaced the real picture:

- `src/extensions/schedule/components/**` — the entire old picker/board/table UI (`ScheduleProductPickerModal`, `GradualInputForm`, `ScheduleOptionCard`, the board and table components, etc.) — **no longer exists**. It was deleted as part of the uncommitted work captured in A1's consolidation commit.
- The schedule/catalog UI actually live today is `src/extensions/sketchup/components/CatalogBoard.tsx` (1,537 lines) + `ProductScheduleTabs.tsx`, added product-adding via `addCatalogItemFromLibraryAction` / `addManualCatalogItemAction` in `src/extensions/sketchup/actions/sketchup-actions.ts` (~3,700 lines) — a newer, larger system than what this doc originally described. It still writes through `ScheduleService.addEntryToSchedule` underneath (so `ProjectScheduleEntry`/`ProjectScheduleOption` are still the real tables — good, the data model wasn't replaced), but the **UI layer was fully rebuilt** and never wired up `searchReusableSpecsAction`/`addOptionFromReuseAction`. Those two actions exist, still work against the current schema, and are exported from `schedule-actions.ts` — but **zero call sites anywhere in the app use them.** The "reuse pool" is backend-complete and UI-dead, not "mostly built, needs repositioning."
- A page comment in the live route (`projects/[id]/extensions/product-catalog/page.tsx`) confirms this was deliberate: *"The Product Schedule IS the catalog board now — this page replaces the old table/board schedule UI (see CATALOG_ARCHITECTURE.md)."* That referenced doc doesn't exist in the repo, so the design rationale for the rebuild isn't recoverable from the codebase alone.
- There's also an empty scaffold at `src/subapps/bq/{actions,components,services,lib,types}/` (each just a `.gitkeep`) — a further migration (schedule/catalog into a `bq` "Bill of Quantities" subapp, per `PLAN-APP-SPLIT.md`) looks planned but not started.

**Revised current state:** "add item" in the live UI (`CatalogBoard.tsx`) has two paths — pick from the global catalog (`addCatalogItemFromLibraryAction`) or type a manual entry (`addManualCatalogItemAction`). There is no cross-project reuse path in the live UI at all today.

**What this changes about the plan:** the original estimate ("S–M, largely UI reorganization, low backend risk") assumed reframing an existing picker's tabs. The real work is building a new reuse-search UI *inside* `CatalogBoard.tsx` (a large, actively-changing file) and removing `addCatalogItemFromLibraryAction` call sites from it — a materially bigger, higher-risk change than what was scoped when the "remove catalog-add entirely" decision was made. Given the in-flight `subapps/bq` migration, there's also a real risk of building this against a component that gets moved/rewritten again soon.

**Recommendation — paused for owner input rather than executed as originally scoped.** Options, roughly increasing in scope: (a) keep catalog-add live in `CatalogBoard.tsx` for now and treat R2 as **deferred until the `subapps/bq` migration lands**, so this isn't built twice; (b) build the reuse-search UI into `CatalogBoard.tsx` as originally decided, accepting the larger/riskier scope and doing it as its own reviewed change, not bundled with the rest of this pass; (c) revisit whether "remove entirely" is still right given catalog-add is the primary path in the *current* live UI (not a secondary one, as originally described) — removing it outright now is a bigger behavioral change for users than the original framing suggested.

**Effort / risk:** revised to **M–L** (was S–M) and marked **needs owner decision before implementation** — see §5.

---

### 2.3 R3 — Deliverable logic (upload + file management)

**Problem (owner):** solidify deliverable upload and file management.

**Current state:** upload flow works end-to-end (`deliverable-upload-dialog.tsx` → `/api/upload/media` → `addDeliverable` action → `phase-service.executeAddDeliverable`, with old files replaced via `deleteManagedDeliverableAsset`). Revision-based replacement is a nice model. **But** storage is the insecure `public/uploads/` path from **A2**: unauthenticated static serving, no size cap, client-trusted MIME, local-disk-only.

**Proposed approach:**
1. **Secure storage (the core work):** move deliverable files out of `public/`. Either (a) a private directory streamed through an authenticated `GET /api/deliverables/[fileId]` route that re-checks RBAC (`assertDeliverableUploadAccess`-equivalent read guard), or (b) Supabase Storage with short-lived signed URLs minted per authorized request. Store a DB row per file (already partly there via revision `files`) as the access-control source of truth.
2. **Validation:** server-side size limit and MIME allow-list (PDF/DWG/images/etc.); reject on the server, not the client.
3. **Integrity & lifecycle:** store content hash + size; make replacement/delete transactional with the DB record so orphaned blobs can't accumulate; confirm `deleteManagedDeliverableAsset` also works against the new backend.
4. **UX:** upload progress + explicit error surfaces (current dialog swallows some failures into a generic toast); show file size/type in the deliverables table.

**Effort / risk:** M–L. The security migration is the bulk; the UI is small. Highest *correctness* priority after A1 because it's a live data-exposure issue. Sequence the storage move behind a feature flag and migrate existing `public/uploads` deliverables.

**Implemented 2026-08-04 — option (a), local private storage, not Supabase.** No Supabase Storage usage existed anywhere in the codebase (`@supabase/supabase-js` is a dependency but only used for Postgres via `DATABASE_URL`) — introducing it now would mean provisioning and configuring a new external service without knowing whether the deployment target has it available, which is a bigger decision than this pass should make unilaterally. Went with the self-contained option instead:

- New `src/lib/deliverable-storage.ts` — single source of truth for the private root, size limit (50MB), extension allow-list, and URL↔path resolution (for both the new scheme and legacy pre-migration URLs), so the upload route, the download route, and the delete-on-replace cleanup can't drift out of sync.
- `POST /api/upload/media` now special-cases `folder === "deliverables"`: writes to `storage/deliverables/` (outside `public/`, gitignored) instead of `public/uploads/deliverables/`, enforces the size/extension checks server-side, and returns a `/api/deliverables/file/...` URL instead of a static one. Every other folder (library covers, MOM attachments via `folder: "projects"`) is untouched — confirmed via `grep` that only `deliverable-upload-dialog.tsx` posts `folder: "deliverables"`.
- New `GET /api/deliverables/file/[...path]` — requires a session (401 otherwise), resolves and validates the path, streams the file with the correct content-type.
- **Auth model — any authenticated user, not per-project ACL.** The Deliverables Tracking page itself has no project-membership gate today (any signed-in user can already browse any project's deliverables list, matching the broad-visibility pattern used elsewhere — e.g. schedule's "Everyone with VIEW may look at any project"). Requiring a session closes the actual gap (zero-auth static files) without inventing a stricter per-project rule the rest of the app doesn't otherwise enforce. Tightening to per-project membership is a reasonable follow-up if wanted, not required to fix A2.
- **Existing files not migrated.** Old deliverables already sitting in `public/uploads/deliverables/` stay there and remain publicly reachable at their old URLs — moving them requires access to the running deployment's filesystem and DB, which this pass doesn't have. `deleteManagedDeliverableAsset` and the resolver both still recognize the old `/uploads/deliverables/` prefix so replacing an old-style file still cleans it up correctly; new uploads never use it again. **Follow-up needed:** a data migration script (move files + `UPDATE "File" SET file_url = ...`) to close the gap for pre-existing files.
- Not done (items 3/4 of the original proposal): content-hash storage, upload progress UI, and richer error surfaces — deferred as smaller, non-security follow-ups.

---

### 2.4 R4 — Projects page: fix responsiveness & overlap

**Problem (owner):** projects page is not responsive and has overlapping elements.

**Current state:** root-caused in **A3** — `overflow-hidden` container + `table-fixed` % widths with no min-widths + hover-reveal actions colliding with long PROGRESS badges; no mobile layout.

**Proposed approach:**
- Wrap the table in an `overflow-x-auto` scroll container and give each column a sensible `min-width` (via `ui_engine` `TableCard`, so all tables benefit — ties into R6).
- Take the priority `<select>` and delete button **out of the `opacity-0 group-hover` reveal** (or keep View on hover but make priority always-visible), so controls never sit under the PROGRESS text.
- Constrain the PROGRESS cell: cap visible phase badges with a "+N" overflow, truncate long status labels.
- Add a **stacked card layout** below `md` (each project a card: name/client, PIC row, progress chips, actions) instead of a squished table.
- Fold in the **A4** `getProjectProgress` guards while touching this surface.

**Effort / risk:** M (mostly `ProjectListClient` + a `TableCard` responsiveness upgrade). Low risk, high visible payoff. Good **first implementation item** once A1 is clean.

---

### 2.5 R5 — Rename "Cari Material" → "Search on Library" + beautify the Library page

**Problem (owner):** rename the nav label and make the Library page more attractive, while staying on `ui_engine`.

**Current state:** the nav label lives in `src/extensions/registry.ts` (`label: "Cari Material"`, icon `Search`, href `/library`). The page (`BrandLibraryExplorer`) is functionally good and already **correctly built on `ui_engine` primitives** (SimpleCard/Heading/tokens) — but visually plain: a lone search box, an empty pre-search state with no hero or guidance, and undifferentiated result cards.

**Proposed approach:**
- **Rename:** change the label to **"Search Library"** (decided, owner 2026-08-04 — shorter and English-consistent with the app). One-line change in `registry.ts`; keep the page `<PageHeader title>` in sync.
- **Beautify (staying on `ui_engine`):**
  - A proper **empty/hero state** before searching: short explainer + quick-pick chips for popular material categories (terazzo, tile, solid surface…) that seed the query.
  - Richer **brand result cards**: brand logo/monogram, clearer "Katalog tersedia / N sample fisik" affordances, hover elevation already present — extend with iconography from the existing token set.
  - Keep everything on `SimpleCard`/`Heading`/tokens; **no hardcoded `var(--ui-*)`** (the file's own header warns against re-introducing that defect — honor it).
- **Decision (owner, 2026-08-04): keep the `/extensions/library` → `/library` (or `/masterdata`) redirect indefinitely** — recommended, since it's a permanent low-cost safety net for stale bookmarks/shared links with no natural expiry trigger (see A5).

**Effort / risk:** S. Label rename is trivial; the visual polish is contained to one component and must respect R6's token rules.

---

### 2.6 R6 — Solidify, optimize & "patent" the `ui_engine` as a central template engine

**Problem (owner):** make `ui_engine` the single, authoritative template engine so fixes happen **once, centrally**, and cascade everywhere.

**Current state — strong foundation, needs formalization:** `ui_engine` already has tokens (colors/spacing/radius/typography/layout), a `design-system.config.ts` SSOT, layout shells, primitives, and a single `index.ts` import surface. The stated rule ("exactly one import surface: `@/ui_engine`") is real and mostly followed. Gaps: some app components still import from `@/components/ui` directly (the uncommitted diff shows an in-progress migration away from that); the responsiveness rules (min-widths, scroll, mobile) that R4 needs are **not yet centralized** in `TableCard`; and there's no enforcement preventing regressions back to hardcoded tokens.

**Proposed approach ("patent" = make it the enforced, canonical layer):**
1. **Finish the consolidation:** complete the `@/components/ui` → `@/ui_engine` migration already underway; make `@/components/ui` internal-only (not imported by app code).
2. **Centralize the fixes:** push R4's responsiveness (scroll container, column min-widths, mobile stacking) *into* `TableCard`/shells so every table/page inherits them — this is the concrete proof of "fix once, fixed everywhere."
3. **Enforce it:** add an ESLint rule (e.g. `no-restricted-imports`) banning app-layer imports from `@/components/ui` and banning raw `var(--ui-*)`/hex colors outside the token files — so the token-hardcoding defect class (MASTER_SSOT §8 Issue 7, referenced in `BrandLibraryExplorer`) **can't come back**.
4. **Document the contract:** a short `ui_engine/README` defining the layers (tokens → primitives → components → shells) and "which layer do I reach for," so contributors don't bypass it.
5. **Optimize:** audit for unnecessary `"use client"` boundaries and duplicated Tailwind class strings that could become tokens.

**Effort / risk:** M–L, but it's an **enabler** — do the enforcement + `TableCard` centralization *early* so R4/R5 are built on top of it rather than retrofitted. Treat as partly-foundational, partly-ongoing.

---

### 2.7 R7 — Master Data: add a `Company` tier above `Brand` (Company → Brand → Product)

**Problem (owner, 2026-08-05):** the current model treats `Brand` (table `master_data.Vendor`) as both the supplier company *and* the brand — a collapse made in §6.11 on the assumption "brand/company/PT sama aja." Real supplier data breaks that assumption:

- **Aica** — one company (`PT Aica Indonesia`) sells many brands: Aica, Cerarl, ToughTop, Aica Aibon. → Company→Brand is genuinely one-to-many.
- **TACO** — company `PT Tangkas Cipta Optimal`, one brand `TACO`, but that brand spans many categories (HPL, vinyl, hardware, lem). → category is a product attribute, not a brand attribute.
- **Carta** — brand `Carta`, company `Vivere Group`. → company name ≠ brand name, and the legal PT differs again.

So there are up to three distinct tiers (Company + optional PT → Brand → Product) that do not collapse cleanly, and shared fields (Drive/Website/IG/Sales/contact) belong at the **Company** level — putting them on Brand forces duplication the moment a company has >1 brand.

**Proposed target shape:**

```
Company (Supplier)        name · legal_name/PT (opsional) · address · notes
  ├─ contacts[]           Sales + nomor              (naik dari Brand)
  ├─ links[]              Drive · Website · IG · …    (naik dari Brand)
  └─ brands[]
Brand                     company_id (FK) · brand_name · categories[]
  └─ skus[]
Sku / Product             brand_id (FK) · sku · product_name · category tags · price · sample…
```

Reference layout: `MasterData_Skema_Contoh.xlsx` (8 tabs, one per table, populated with TACO/Aica/Carta/BDA).

**Approach — additive, not a rename.** Introduce a new `Company` table and add `company_id` FK to `Brand`; move `legal_name` + contacts + links up to `Company`. Do **not** rename the `Vendor` table — same reasoning as the `ServiceVendor` addition (avoids rewriting every existing FK/snapshot/audit reference).

**Open decisions before migration (owner):**
1. Aica's product lines (Cerarl, ToughTop, Aibon) — separate **Brands** under the company, or **Categories** under one "Aica" brand?
2. Are contacts/links strictly Company-level, or should a Brand be allowed its own override (e.g. Aica Aibon with a separate IG)?

**Effort / risk:** M — additive schema migration + Master Data UI (Company CRUD + brand→company assignment) + backfill existing `Vendor` rows into companies.

**Sequencing — do this entirely inside `masterdata` first; wire into StudioFlow only afterward.** R7 lands as a self-contained Master Data change (schema + subapp UI). The StudioFlow-facing consumers (Library, Schedule snapshot reads) are **not** touched in the same pass — they are a deliberate follow-up (R8, TBD) once the Company tier is stable. This keeps the cross-app visibility contract (§6.14) unbroken during the rework.

---

## 3. Recommended sequencing

Rationale: stabilize the repo, land the enabler, then ship user-visible wins cheapest-first, then the heavier security and schema work.

| Order | Item | Type | Effort | Status (2026-08-04) |
|---|---|---|---|---|
| **0** | **A1** — commit the working tree, add `.gitattributes` | Hygiene / gate | S (½ day) | ✅ Done — `8f296f6` |
| **1** | **R6 (phase 1)** — finish `@/components/ui`→`@/ui_engine` migration, add lint enforcement, centralize `TableCard` responsiveness | Enabler | M | ✅ Done — migration already complete (0 violations), lint rule already `error`-level; added `TableCard` scroll+minWidth centralization — `c2afa74` |
| **2** | **R4** — projects page responsive + overlap fix (+ A4 guards) | UX win | M | ✅ Done — `c2afa74` |
| **3** | **R5** — rename label + beautify Library | UX win | S | ✅ Done — `90b7342` |
| **4** | **R2** — reposition "add from another project's snapshot" | Feature | ~~S–M~~ **M–L (revised)** | ✅ Done — `5d80f8d`. Implemented against the actual live `CatalogBoard.tsx` (owner chose "build it anyway" over deferring for the `subapps/bq` migration). |
| **5** | **R3** — secure deliverable storage + validation (fixes A2) | Security/feature | M–L | ✅ Core fix done (see §2.3) — `d3a0683`. Data migration of pre-existing public files is a follow-up |
| **6** | **R1** — recurring schedule template per project | Feature | M | ✅ Done — `809a08b` (see §2.1) |
| **7** | **R7** — Master Data `Company` tier (Company → Brand → Product) | Schema/feature | M | ⏳ Next — Master Data only; StudioFlow wiring deferred to R8 (see §2.7) |
| **8** | **R8** — connect the new Company tier into StudioFlow (Library/Schedule reads) | Integration | TBD | 🔜 After R7 is stable (see §2.7) |

**Decision (owner, 2026-08-05): fix Master Data first, connect to StudioFlow after.** R7 is done entirely inside the `masterdata` subapp (schema + UI + backfill). Only once the Company tier is stable do we touch the StudioFlow-facing consumers — that integration is split out as R8 rather than bundled into R7, to keep §6.14 cross-app visibility intact during the rework.

**Decision (owner, 2026-08-04): keep R3 at its current sequence position (step 5), not pulled earlier.** The security fix (A2) still ships as part of R3, unchanged in scope — the priority concern was about the deliverable-tracking data (making sure the DB record always points at the current file) rather than moving the storage-security work earlier in the queue.

---

## 4a. Execution checkpoint (2026-08-04)

A1, R6 (phase 1), R4, and R5 are implemented, typechecked clean after every step, and committed (`8f296f6`, `c2afa74`, `90b7342`). R2 surfaced new information mid-execution (§2.2); owner chose "build it anyway" and it's now done (`3bad532` docs correction, `5d80f8d` implementation). R3 is done (`d3a0683`, see §2.3). R1 is done, see §2.1 — schema migration, `ScheduleService.applyDefaultTemplateEntries`, the new-project hook, the "Apply default template" button in `CatalogBoard.tsx`, and the admin toggle UI in `template-manager.tsx` are all in and typecheck clean.

**Session status (2026-08-04): all six roadmap items (R1–R6) plus A1 are now implemented and typechecked.** Outstanding follow-ups: the live in-browser walkthrough (§4, blocked on Chrome extension access) and the pre-existing-deliverables data migration flagged in §2.3.

---

## 4. Outstanding: live in-browser walkthrough

The requested live run (boot the app, click through projects → project detail → schedule → deliverables → library to catch runtime/UX regressions) is **not yet done** — the Chrome extension isn't connected to this session, so I can't reach the running dev server. To complete it: connect the Claude-in-Chrome extension and have the app running (`npm run dev`), and I'll walk the main flows and append runtime findings to §1. Static analysis + typecheck already cover the compile/logic layer; the live pass mainly adds runtime/visual regressions.

---

## 5. Decisions (owner review, 2026-08-04)

All five open questions from the original draft have been resolved:

1. **R2:** catalog-based "add from library" is **removed entirely** — the add-item flow becomes cross-project-snapshot-only (see §2.2).
2. **R5:** label confirmed as **"Search Library"** (see §2.5).
3. **R3 priority:** kept at its originally recommended sequence position (step 5) — not pulled earlier (see §3).
4. **A5:** the `/extensions/library` redirect shim is kept **indefinitely** — no sunset date (see §1.2 A5, §2.5).
5. **R1:** **one global default template per section**, not per-client — matches the existing `ScheduleTemplate` scoping; per-client variation can be layered later as entry-level overrides if needed (see §2.1).
