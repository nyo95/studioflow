# Final Execution Plan: Post-Refactor Hardening, Core Isolation, and Full Re-Audit

## Summary
Current state is not release-ready. The refactor introduced partial progress, but there are still hard blockers: build is red, lint is red, Schedule-Catalog isolation is incomplete, `View-First` is still over-applied in docs, and several audit findings remain either open or only partially addressed.

Execution target:
- finish the refactor to a release baseline;
- harden `coreapp` into an isolated layer;
- close remaining audit findings with real code changes;
- align `AGENTS.md`, `MASTER_SSOT.md`, `CHANGELOG.md`, and `audit.md`;
- re-run the audit until the remaining risk is minimal and explicitly documented.

Major decisions already locked:
- `View-First` becomes **narrow scope** only: `Product Catalog`, `Vendor`, and `Admin critical config`.
- `Schedule / project snapshot` becomes **editable by default**, with explicit confirmation only for destructive/high-risk actions.
- Admin `Design System` panel is allowed a **full redesign now**, not just a patch.

## Implementation Changes
### 1. Release gate recovery first
- Fix all syntax/import regressions introduced by the refactor before any deeper cleanup.
- Resolve the current build blockers:
  - broken import structure in `LibraryFormModal`;
  - missing `@/ui_engine/tokens/layout`;
  - invalid typography token imports;
  - any client-side import path that now drags server/db code into the browser bundle.
- Resolve lint errors that are real blockers:
  - `no-explicit-any`;
  - parser errors;
  - invalid JSX text;
  - empty interface/type violations;
  - any new boundary-breaking imports.
- Treat warnings as second pass unless they are hiding broken behavior or stale refactor leftovers.

### 2. Core isolation hardening
- Finalize the four-layer boundary in code, not only in docs:
  - `core/platform`
  - `core/rbac`
  - `core/domain-shared`
  - `extensions/*`
- Move reusable policy logic fully out of mixed files:
  - project naming
  - phase lifecycle policy
  - shared access/membership rules
  - schedule snapshot contract
  - schedule code normalization contract
- Reduce `src/lib/permissions.ts` into a thin compatibility shell or remove mixed concerns entirely if safe.
- Ensure extension code cannot directly depend on private internals of other extensions or mixed core files.

### 3. Schedule-Catalog boundary completion
- Finish the Catalog facade and make it the only cross-extension entrypoint for Schedule.
- Remove remaining direct Schedule dependencies on:
  - `@/extensions/library/actions/library-actions`
  - `@/extensions/library/types`
  - `@/extensions/library/lib/upload-client`
  - any other private library module
- Enforce ownership split:
  - Catalog owns `ProductCatalog`, vendor, request queue, promotion review.
  - Schedule owns `ProjectScheduleEntry`, `ProjectScheduleOption`, snapshot editing, local draft flow.
  - Cross-domain actions go through facade/orchestrator only.

### 4. Audit finding closure
- Re-check and close every finding in `audit.md`, starting from Critical and High.
- Confirm with code and verification, not by assumption, at minimum:
  - build blocker fixed;
  - vendor merge path uses official audited service;
  - promotion approval deduplicates and respects existing linkage;
  - STAFF cannot publish directly to `APPROVED`;
  - Schedule can only consume approved catalog items;
  - request status update has role + ownership enforcement;
  - project delete preserves forensic audit trail;
  - project naming is canonical and concurrency-safe enough for the chosen implementation;
  - phase submit/approve blockers handle project-level and deferred activities correctly;
  - schedule swap enforces same-scope invariants and audit logging;
  - physical sample SSOT/schema drift is resolved;
  - telemetry/debug fetch is removed;
  - terminology drift is corrected.

### 5. UX and workflow correction
- Update docs and implementation so `View-First` is no longer global.
- Redesign Schedule editing flow to be lightweight:
  - existing schedule snapshot opens editable by default;
  - readiness/promotion remains secondary;
  - destructive/high-risk actions remain gated.
- Keep Catalog/Vendor/Admin critical config read-only by default.
- Redesign `Design System` admin panel into a token-driven panel that only exposes controls that genuinely drive UI behavior.
- Refactor `CreatableSearch` so search/select/create are explicit and blur does not auto-create.
- Normalize terminology across app and docs:
  - canonical project naming
  - product/material/fixture language
  - remove misleading `Architectural` / `FF&E` / `Material Library` usage where it conflicts with final SSOT.

### 6. Documentation and audit synchronization
- Update `AGENTS.md` to keep the stronger governance rules and align the narrowed `View-First` scope.
- Update `MASTER_SSOT.md` to reflect:
  - narrowed `View-First`;
  - final core boundary rules;
  - final Schedule-Catalog interaction contract;
  - corrected physical sample model;
  - any approved workflow changes made during execution.
- Update `CHANGELOG.md` with each material hardening batch actually completed.
- Convert `audit.md` from static findings into closure tracking:
  - mark each finding as closed / partially closed / superseded;
  - record proof path for each closure.

## Test Plan
- Build:
  - `npm run build` passes.
- Lint:
  - `npm run lint` passes.
- Type safety:
  - no unresolved type/import regressions in refactored areas.
- Boundary checks:
  - no direct Schedule imports from Library private internals remain;
  - no client component imports server/db-bound modules through the new facades.
- Core workflow checks:
  - create project naming is canonical;
  - rename/update project preserves naming rules;
  - delete project preserves audit history;
  - submit/approve/reopen phase obeys business blockers.
- Catalog workflow checks:
  - STAFF create/edit stays in allowed status boundary;
  - approval queue is respected;
  - merge vendor writes audit and preserves `catalog_brand`.
- Schedule workflow checks:
  - only approved catalog items can enter schedule;
  - editable-by-default schedule modal works as intended;
  - promotion from snapshot uses the approved facade path;
  - request/sample flows still work through official contracts.
- UX checks:
  - Catalog/Vendor/Admin config open read-only first;
  - Schedule opens editable first;
  - `CreatableSearch` does not auto-create on outside click;
  - terminology is consistent on page titles, tabs, placeholders, and settings copy.

## Assumptions and defaults
- The current dirty worktree is intentional; unrelated user changes must not be reverted.
- `package-lock.json` remains untouched unless a dependency change is strictly required by the implementation.
- Major workflow/doc/UI changes are allowed only where already approved:
  - narrowed `View-First`
  - full redesign of admin `Design System`
- Any additional major behavior change beyond those approved must be confirmed before implementation.
