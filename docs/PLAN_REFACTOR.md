# Implementation Plan: Final Global Legitimacy Audit Remediation

## Summary
Close the remaining global gaps between core app behavior, extension behavior, SSOT, and documentation so the application is architecturally consistent, not just type-safe. This work should focus on four areas: snapshot contract strictness, library business workflow legitimacy, disabled integration surfaces, and core app type/contract cleanup.

## Key Changes

### 1. Snapshot Contract Re-Hardening
- Tighten `ScheduleSnapshotSchema` back to a controlled canonical contract instead of broad `z.string()` acceptance for `snapshot_source_origin`.
- Standardize allowed snapshot origins to the actual supported set and align all snapshot writers to that set.
- Remove any remaining contract drift between:
  - `src/lib/services/schedule-service.ts`
  - `src/lib/validations/schedule-snapshot.ts`
  - `MASTER_SSOT.md`
  - `src/api/README.md`
  - `src/extensions/schedule/README.md`
- Keep the canonical shape decision-complete:
  - Root: `snapshot_*`, `catalog_*`, `product_catalog_id`, `catalog_type`, `schedule_category`
  - Nested: `specs.catalog_*`
- Do not leave “temporary compatibility” readers unless they are explicitly documented as migration fallback.

### 2. Library Workflow Legitimacy
- Resolve the business contradiction around approved catalog items being read-only:
  - Either implement a real “change request” path for approved products, or
  - Relax the lock and document the intended edit policy in SSOT.
- Make this decision explicit in code, SSOT, and UI copy so users are not told to use a workflow that does not exist.
- Remove or redesign product-request auto-harvesting so it no longer silently creates `PENDING` catalog entries from project requests if SSOT says auto-harvesting is disabled.
- If harvested drafts are still required, reclassify them explicitly in SSOT as a sanctioned queue workflow rather than hidden auto-promotion.

### 3. Integration Surface Completion
- Decide whether schedule CSV export and SketchUp import are supported now or not.
- If supported:
  - implement the disabled `FEATURE_DISABLED` paths in schedule CSV export and SketchUp import,
  - verify payload mapping uses the canonical snapshot contract,
  - ensure docs describe only the real supported behavior.
- If not supported:
  - downgrade or remove the current integration promises from docs and README files,
  - mark these features as intentionally unavailable in SSOT/changelog instead of leaving “temporarily disabled” dead ends.

### 4. Core App and Cross-Extension Contract Cleanup
- Remove remaining unsafe type escapes in core app paths, especially dashboard/task aggregation feeding `TodayView`.
- Replace `as any` contract bypasses with real shared types between:
  - dashboard pages,
  - core project/task aggregators,
  - Today View components.
- Audit cross-extension interactions for hidden drift:
  - Schedule -> Library promotion
  - Schedule -> Product Request / sample request
  - Library queue -> Catalog approval
  - Project requests -> Library data creation
- Ensure each cross-extension flow has one explicit ownership, permission, and data-contract path, with no parallel “legacy shortcut” flow left behind.

## Public Interfaces / Behavior Changes
- Snapshot origin values become strict again and must match one documented canonical set.
- Approved catalog edit policy becomes explicit and enforced consistently in backend and UI.
- Project product request flow either stops auto-creating catalog items or formally becomes a documented queue-ingestion workflow.
- CSV export / SketchUp import are either fully enabled and documented, or explicitly removed from supported capability claims.
- Dashboard-to-TodayView data shape becomes typed without `any` fallback.

## Test Plan
- Snapshot validation rejects unsupported `snapshot_source_origin` values.
- All snapshot writers generate the same canonical shape and pass `ScheduleSnapshotSchema`.
- Approved catalog item mutation follows the chosen policy:
  - blocked with real replacement workflow, or
  - allowed with documented audit behavior.
- Project product request no longer silently violates SSOT auto-harvesting rules.
- If integrations remain supported:
  - CSV export returns canonical schedule data,
  - SketchUp import parses and stores canonical snapshot metadata.
- Dashboard home loads `TodayView` without `any` casts and with stable typed task data.
- Run:
  - `npx tsc --noEmit`
  - targeted lint on touched files
  - one manual cross-extension regression pass covering schedule edit, promotion, library queue review, and project request flow

## Assumptions and Defaults
- Default recommendation: keep snapshot origins strict and documented rather than permissive.
- Default recommendation: do not silently auto-harvest project requests into catalog unless SSOT is explicitly updated to allow it.
- Default recommendation: if a replacement “change request” workflow for approved catalog items does not exist yet, treat that as a must-fix product gap rather than leaving the current lock message as-is.
- Default recommendation: unsupported integrations should be documented as unsupported until implemented, not left as “temporary” indefinitely.
