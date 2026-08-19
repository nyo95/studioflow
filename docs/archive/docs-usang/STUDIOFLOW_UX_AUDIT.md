# StudioFlow — Audit & Overhaul Plan

Assessment of why StudioFlow feels *functional but not production-grade* for an architect/designer's daily sidekick, where the Product Scheduler and the SketchUp plugin collide, why the UI feels glitchy, and a prioritized plan to fix it. Every point below is grounded in the current codebase, not generic advice.

---

## 1. The core collision: two parallel code systems (highest priority)

This is the "nabrak" you felt. The same physical material has **two independent code numbers** that are never guaranteed to agree:

- **SketchUp side** — `SketchupMaterial.code` (e.g. `PT-5`). Owned by the plugin and the StudioFlow Code Manager (normalize / merge / reserve), applied through a queue on sync.
- **Schedule side** — `ProjectScheduleEntry.schedule_prefix` + `schedule_increment` (e.g. `PT-03`). Auto-assigned by `ScheduleService.normalizeCodes`, completely independent of the SketchUp number.

When you push a SketchUp material into the schedule (`pushMaterialAsNewEntryAction`), its number is written as a temporary `9999` and then **re-normalized by the schedule**. So `PT-5` in SketchUp can land as `PT-03` in the schedule. The only link between them is a nullable `linked_entry_id` + manual mapping in the queue. The result: the code an architect sees in SketchUp is not the code they see in the schedule, and there is no single source of truth.

**Mitigation — pick one code authority.**
- Decide who owns the canonical code. Recommended: the **schedule** is canonical (it's the deliverable), and the SketchUp code becomes a reference that reconciles *to* the schedule. The merge-action queue already pushes schedule→plugin, so this direction is half-built.
- On push, either carry the SketchUp increment through instead of re-normalizing, or immediately show the reconciled code in the mapping queue so the user sees "`PT-5` (SketchUp) → `PT-03` (schedule)" explicitly, with a one-click "keep SketchUp numbering" option.
- Add a visible reconciliation state in the mapping UI instead of silent divergence.

Secondary but related: `PrefixDictionary` is seeded in two places with different rules — the schedule side vs `sketchup-actions.ts`, which force-uppercases and falls back to the raw prefix as the category name (that's why categories showed as `CT` instead of `Ceramic Tile`; we patched the *display*, but the stored data is still inconsistent). Seed it once from the plugin's canonical registry (`types.json`), stop uppercasing, and dedupe.

---

## 2. Design-system fragmentation (why it feels glitchy)

Design tokens live in **three** competing places:
- `src/app/globals.css` — 107 CSS custom properties
- `src/styles/designTokens.css` — 31 more (overlapping `--ui-*` names)
- `src/ui_engine/tokens/*.ts` — 212 lines of TS token constants

On top of that, raw Tailwind `slate-*` colors are used in **109 component files**, while `var(--ui-*)` is used in only **40**. There is no single source of truth for color, spacing, or radius, so surfaces drift subtly from screen to screen — that's the "glitchy" feeling even though individual screens look nice.

**Mitigation.** Establish one token layer: CSS variables as the source of truth, `ui_engine/tokens` re-exporting them (no separate values), delete `designTokens.css` after merging its vars into `globals.css`, and add an ESLint rule banning raw `slate-*`/hex in app code. Migrate incrementally, screen by screen.

---

## 3. Hydration & resilience gaps (why navigation feels rough)

- **Two hydration guards** exist (`HydrationGuard`, 27 lines, and `EnhancedHydrationGuard`, 237 lines) plus `suppressHydrationWarning`. Hydration mismatches are being patched reactively rather than fixed at the root (the dnd-kit `aria-describedby` mismatch we just fixed with `useId` is one example). Two guards doing the same job is itself a smell.
- **Route resilience is thin**: `0` `error.tsx` boundaries, only `1` `loading.tsx`, `0` custom `not-found.tsx` across the whole app. Any server-action/DB hiccup drops the user on a raw Next.js error screen, and most navigations show no skeleton — so the app feels like it "stalls."

**Mitigation.** Fix hydration at the source (stable ids, render time/locale/random client-only or pass a server snapshot), then delete the redundant guard. Add `error.tsx` + `loading.tsx` to each major route group (`projects`, `projects/[id]/*`, `settings`, `sketchup`), reuse the existing `PageSkeleton`, and add a global `not-found.tsx`.

---

## 4. Interaction smoothness

- **Crude blocking dialogs**: `window.confirm` / `window.alert` in 7 places (bulk delete, purge, merge). They're unstyled, jarring, and block the thread. Replace with the app's own `Dialog`/`AlertDialog`.
- **Full refetch after every edit**: many actions call `router.refresh()` after a single field change instead of updating local state, so edits feel laggy. The schedule already does optimistic `setSheet` for reordering — extend that pattern to all inline edits.
- **Heavy-handed locking**: the Code Manager locks *all* code edits whenever *any* change is pending sync. Make it per-group, or allow stacking changes into the queue.
- **Information overload**: the SketchUp page stacks API key + merge queue + Code Manager + mapping queue + 3 export buttons on one long scroll. Split into clear steps (Sync status → Map → Codes → Export) with progressive disclosure.

---

## 5. Prioritized roadmap — what to actually do

**P0 — correctness & trust (do first)**
1. Reconcile the two code systems: choose a single code authority and make the mapping queue show/resolve divergence explicitly.
2. Fix `PrefixDictionary` seeding (one canonical source, no uppercasing, dedupe).
3. Add `error.tsx` boundaries so failures degrade gracefully instead of white-screening.

**P1 — smoothness**
4. Token consolidation pass (one source of truth; lint rule against raw colors).
5. Replace all `window.confirm/alert` with the styled Dialog component.
6. Add `loading.tsx` skeletons to every major route group.
7. Fix hydration roots, then remove the redundant hydration guard.

**P2 — polish**
8. Optimistic updates for all inline edits (drop the per-edit `router.refresh()`).
9. Restructure the SketchUp integration page into stepped tabs.
10. Per-group locking in the Code Manager; consistent empty states everywhere.

---

### Suggested sequencing
Ship P0 as one focused release (it's about *trust* — codes matching across tools is the thing an architect will lose confidence over fastest). Then treat P1 as a "smoothness sprint" that can be done screen-by-screen without a big-bang rewrite. P2 is ongoing polish. None of this requires re-architecting the app — it's consolidation and reconciliation, not a rewrite.
