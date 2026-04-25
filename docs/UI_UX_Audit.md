# UI/UX Audit – RadSaaS‑2

## 1. Executive Summary
- **Overall usability:** The core workflow (schedule‑snapshot → promotion → shared catalog) is conceptually solid, but the current UI violates several key usability and governance rules, making it **not yet user‑friendly** for an architect.
- **Key pain points:**
  1. Snapshot modal opens in *edit mode* by default, breaking the **View‑First** policy.
  2. Required fields are not visually marked; colour (a mandatory field) is not enforced before promotion.
  3. Literal `[RESERVED]` placeholder appears in the UI, causing confusion.
  4. `CreatableSearch` can auto‑create items on blur, leading to accidental catalog entries.
  5. No image preview, no clear indication of whether a suggestion is from the shared catalog or a private snapshot.
  6. Missing breadcrumbs, ambiguous terminology, and lack of explicit “Undo”/review step for promotion.

**Conclusion:** The UI is functional but **fails to be user‑friendly** for the target persona (architects) and does not fully respect the documented policies (View‑First, Zero‑Hardcode, audit‑logging). The audit below details each issue, its impact, and concrete remediation steps.

---

## 2. Detailed Findings
| # | Category | Description | Impact (UX / Business) | Recommendation |
|---|----------|-------------|------------------------|----------------|
| **U‑01** | Edit‑Mode Policy | Modal `ScheduleSpecEditorModal` forces `isEditMode=true` on open. | Users start editing unintentionally; violates **View‑First**. | Open modal in read‑only, add explicit **Edit** button. Use `ReadOnlyGuard` HOC. |
| **U‑02** | Required‑Field Visibility | No asterisks or inline validation for brand, SKU, colour, image. | Users may miss mandatory data; get only toast warnings after save. | Add `*` markers, red borders, inline error messages, and disable Save until required fields are valid. |
| **U‑03** | Colour Enforcement | `isReadyForPromotion` does **not** check `catalog_color`. | Promotion can succeed without colour → audit violation. | Extend readiness check to require colour and surface a disabled button with tooltip. |
| **U‑04** | Placeholder Confusion | Literal `[RESERVED]` appears in the input field. | Users must understand a special token; UI looks like an error. | Replace with an empty‑state placeholder and a tooltip explaining the reserved status. |
| **U‑05** | CreatableSearch Auto‑Create | Component creates a new catalog entry on blur. | Accidental creation of catalog items, breaking data integrity. | Disable auto‑create; require explicit **Add new** button. |
| **U‑06** | Image Upload UX | No preview after upload, only a loader. | Architects cannot verify the correct image before saving. | Show thumbnail preview with **Replace / Remove** actions. |
| **U‑07** | Suggestion Context | Search dropdown mixes shared catalog items and private snapshot items without visual distinction. | Users may select the wrong source, leading to duplicate entries. | Add badge/tag (`Shared` vs `Project`) next to each suggestion. |
| **U‑08** | Navigation Context | Modal lacks breadcrumb / header indicating where the user is in the hierarchy. | Disorientation, especially in large projects. | Add a breadcrumb (`Project > Schedule > Option #X`) in `DialogHeader`. |
| **U‑09** | Promotion Confirmation | Immediate promotion with no “review” option; no undo. | High‑risk irreversible action; architects hesitate. | Introduce a **Promotion Request** modal with “Promote now” (admin) and “Submit for review” (staff) options. |
| **U‑10** | Terminology Drift | UI still uses `FF&E`, `Architectural` while SSOT mandates `Material / Fixture`. | Confusing cross‑team communication; inconsistency with docs. | Global search‑replace to canonical terms and update i18n strings. |
| **U‑11** | Hard‑coded Tailwind | Several components contain raw Tailwind utilities (`p-5`, `rounded-xl`). | Violates **Zero Hard‑code Policy**; makes design system updates painful. | Refactor to use design‑system tokens (`spacing.large`, `radius.xl`). |
| **U‑12** | Lack of Automated Tests | No test files for UI components, especially the modal. | Future regressions can slip unnoticed. | Add Jest + React‑Testing‑Library tests covering validation, edit‑mode toggle, promotion gating. |

---

## 3. Gap Prioritisation
| Priority | Gap(s) | Reason |
|----------|--------|--------|
| **High** | U‑01, U‑02, U‑03, U‑05 | Directly impact data integrity, audit compliance, and user confidence. |
| **Medium** | U‑04, U‑06, U‑07, U‑08, U‑09 | Improve clarity, reduce friction, and add safety nets. |
| **Low** | U‑10, U‑11, U‑12 | Important for long‑term maintainability and consistency but do not block core usage. |

---

## 4. Recommended Action Plan (Sprint‑Ready)

**Phase 5 – Strategic Recommendations**
- **Implement `unstable_cache` for Library Service** – introduce a short‑lived in‑memory cache layer to reduce repeated DB reads when browsing the catalog. Ensure cache keys incorporate project‑id to avoid cross‑project leakage.
- **Enforce RBAC checks in `library-actions.ts`** – make every library‑related action (create, update, delete, promote) verify the caller’s role via `can(user, <action>)`. Return a 403 response if unauthorized.
- **Research Bulk‑Upload implementation** – evaluate `xlsx` + `papaparse` pipelines for mass‑importing FF&E items. Produce a PoC that validates schema, deduplicates by SKU, and logs each row to the audit log.
- **Add Automated Snapshot Verification tool** – a CLI utility (`scripts/verify-snapshot.ts`) that scans all schedule snapshots, checks required fields (SKU, colour, image) and reports missing data. Integrate it into the CI workflow (`npm run verify:snapshots`).

*These items are grouped under Phase 5 because they are strategic, non‑UI‑critical but essential for scalability and data integrity.*

1. **Implement Read‑Only Default** (`U‑01`).
2. **Mark Required Fields** and **extend promotion readiness** (`U‑02`, `U‑03`).
3. **Fix CreatableSearch** auto‑create (`U‑05`).
4. **Replace `[RESERVED]` placeholder** (`U‑04`).
5. **Add image preview** (`U‑06`).
6. **Show source badge in suggestions** (`U‑07`).
7. **Add breadcrumb header** (`U‑08`).
8. **Create Promotion Request modal** (`U‑09`).
9. **Terminology cleanup** (`U‑10`).
10. **Refactor hard‑coded Tailwind** (`U‑11`).
11. **Write UI tests** (`U‑12`).

1. **Implement Read‑Only Default** (`U‑01`).
2. **Mark Required Fields** and **extend promotion readiness** (`U‑02`, `U‑03`).
3. **Fix CreatableSearch** auto‑create (`U‑05`).
4. **Replace `[RESERVED]` placeholder** (`U‑04`).
5. **Add image preview** (`U‑06`).
6. **Show source badge in suggestions** (`U‑07`).
7. **Add breadcrumb header** (`U‑08`).
8. **Create Promotion Request modal** (`U‑09`).
9. **Terminology cleanup** (`U‑10`).
10. **Refactor hard‑coded Tailwind** (`U‑11`).
11. **Write UI tests** (`U‑12`).

Each item should be tracked in the repository’s `TODO.md` (see the separate agent guide). After completing the High‑priority items, re‑run the **Pre‑flight checklist** (lint → build → test) and close the audit findings.

---

## 5. Acceptance Criteria
- **All high‑priority gaps are resolved.** The modal opens read‑only, required fields are clearly indicated, colour is required before promotion, and no auto‑creation occurs on blur.
- **No hard‑coded Tailwind values** remain in the edited components.
- **All new UI changes are covered by unit tests** that assert the disabled state of promotion, the presence of the Edit button, and the correct rendering of source badges.
- **CI pipeline passes** lint, build, and test stages with **0 warnings** for the affected files.
- **Documentation (AGENTS.md, MASTER_SSOT.md, PLAN.md)** is updated to reflect the UI changes.

---

*Prepared for the “low‑cost” coding agent – follow the `AGENT_GUIDE.md` strict rules when implementing the above.*