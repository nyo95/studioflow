# StudioFlow Development Log (Changelog)

## [v2.6.0] — 2026-04-28 (Architectural Stabilization Finalized)

### Backend Changes
- **Guard Robustness**: Improved `checkDuplicateProduct` with type-safe `ScheduleSnapshot` casting and case-insensitive normalization for manual entry checks.
- **Promotion Audit Trails**: Fixed `reviewPromotionRequest` to correctly capture `reviewed_by_id` and `reviewed_at` when approving requests, ensuring parity with rejection logic.
- **Action Validation**: Hardened `addScheduleEntryWithProductAction` and `addScheduleOptionAction` with strict `catalog_status === "APPROVED"` assertions.

### UI Changes
- **Search Ergonomics**: Consolidated `status: "APPROVED"` filter across all schedule-insertion search points.
- **Payload Cleanup**: Refactored `ScheduleProductPickerModal` to remove unused `fetchVendors` state and established explicit `catalog_sku` vs `catalog_product_name` separation for manual entries.
- **Dead Code Cleanup**: Purged unused `LibraryVendor` imports and state hooks from scheduler components.

### Documentation
- **SSOT v2.3.0**: Formalized Section 5.2 (Search & Selection Rules) and 5.3 (Duplicate Protection Rules) in `MASTER_SSOT.md`.
- **Completion Status**: Successfully executed 100% of the audit-identified stabilization tasks from `implementation_plan_v2.md` and the junior-dev gap analysis.

## [v2.5.2] — 2026-04-28 (Schedule Protection Hardening)

### Security & Hardening
- **Schedule Duplicate Protection**: Implemented strict duplicate product guards in `ScheduleService` to prevent redundant entries within a project.
    - Blocks adding the same catalog item (`catalog` mode).
    - Blocks adding items with identical SKU + Brand combination (`manual` mode).
- **Architectural Cleanup**: Fully removed the deprecated `create_catalog` mode from validation schemas and action handlers, enforcing a strict distinction between catalog selection and manual drafting.
- **Admin Auto-Approve**: Implemented automatic approval for `PromotionRequest` when initiated by an `ADMIN`, streamlining library population.
- **Search Filtering**: Restricted schedule product searches to `APPROVED` items only in `ScheduleSearchBar` and `ScheduleProductPickerModal`.
- **Dead Code Removal**: Deleted the legacy `ensureProductInLibrary` sync method from `LibraryService`.

### Documentation
- **SSOT Update**: Updated `MASTER_SSOT.md` to v2.2.9 reflecting the new duplicate protection rules and search restrictions.

## [v2.5.1] — 2026-04-27 (Phase 3 Completion - Security & Hardening)

### Security & Hardening
- **RBAC Hardening (Catalog)**: Restricted library `ProductCatalog` management to `ADMIN` role only. `STAFF` is now restricted to creating `PENDING` items via `LibraryFormModal` and cannot directly update/delete `APPROVED` global entries.
- **Schedule Domain Validation**: Refactored `ScheduleService.swapEntries` and `swapScheduleEntriesAction` with strict domain validation, blocking cross-project and cross-category swaps at the service level.
- **Vendor Management**: Restricted `Vendor` deletion and merging to `ADMIN` only.
- **Promotion Integrity**: Fixed data loss in the library promotion workflow by correctly mapping `catalog_tags` and `catalog_metadata` from project snapshots during approval.
- **Promotion Deduplication**: Verified robust SKU+Brand deduplication logic in `reviewPromotionRequest` to prevent redundant catalog entries.

### Fixed
- **Audit Consistency**: Ensured all library and schedule mutations (swaps, merges, promotions) call centralized service methods with mandatory audit logging.

### Status
- **Phase 3 Completion**: All 13 stabilization tasks from `implementation_plan_v2.md` are now COMPLETE.
- **Type Safety**: ✅ 100% compliance (`npx tsc --noEmit` exit code 0).

## [v2.5.0] — 2026-04-27 (Audit-Driven Implementation Phase 3)

### Documentation
- **Comprehensive Audit-Driven Implementation Plan**: Created `docs/implementation_plan_v2.md` (v2.1) consolidating audit findings into 13 actionable junior-agent tasks.
- **MASTER_SSOT.md Section 12**: Added "Implementation Status & Critical Audit Fixes" documenting audit context, finding-to-task mapping, roadmap, and execution rules.
- **Audit Reference**: Complete 3-stage audit (`audit.md`) identified 25 findings (7 critical, 18 high/medium) spanning:
  - Architecture & schema alignment (7 findings)
  - Backend workflow integrity (16 findings)  
  - UX operational friction (25 findings total across 3 stages)

### Status
- **Build**: ✅ Passing (v2.4.0+)
- **Type Safety**: ✅ 100% compliance (`npx tsc --noEmit` exit code 0)
- **Blockers**: 13 tasks queued for Phase 3 execution by Junior Agent
- **Target Completion**: All critical blocker fixes by Phase 3 completion

### Deferred to Phase 4
- UX/IA consolidation (#16-25): Modal simplification, design system authority, search ergonomics, library IA restructuring

---

## [v2.4.0] — 2026-04-27 (versi 1.9.0 Beta)

### Production Validation
- **System Stability Verified**: Successfully ran `npx tsc --noEmit` with zero errors, confirming type safety across 100% of the codebase.
- **Production Build Passed**: Executed Next.js optimized production build (`npm run build`) without any static generation or hydration errors.
- **Linting & Code Quality**: Resolved residual ESLint warnings (`prefer-const`, synchronous state in effect) to ensure production-grade cleanliness.
- **Full Application Readiness**: Architecture (View-First, Zero Hardcode) is verified, backend snapshot logic is hardened, and UI inconsistency has been fully patched. The application is now ready for daily usage in the firm.

## [v2.4.3.3] — 2026-04-27 (versi 1.9.3.3)

### Fixed
- **Library Catalog**: Fixed "Remove Item" action not functioning due to missing prop drilling in `LibraryTabs`. Added confirmation dialog for safer deletion.
- **Approval Workflow**: Added an explicit 'Approve' button (CheckCircle icon) directly in Table and Visual rows to fix user confusion between saving snapshots and formal approval.
- **Sample Status Accuracy**: Fixed data fetching logic to include `product_requests` linked directly to schedule options, ensuring status indicators work for custom/manual items.

### UI Changes
- **Studio Controls**: Refactored sidebar navigation into horizontal tabs with manual arrow controls (`ChevronLeft`/`ChevronRight`) for optimized screen real estate.
- **Selection Contrast**: Refined `VisualRow` selection styling from high-contrast dark slate (`bg-slate-900`) to a softer indigo palette (`bg-indigo-50/50`) for better visual comfort.
- **Terminology**: Translated sample status badges from Indonesian ("Diterima", "Dipesan") to English ("Received", "Ordered", etc.) for consistency.

## [v2.4.3.1] — 2026-04-27 (versi 1.9.3.1)

### Fixed
- **Sample Request Accessibility**: Fixed a UI bug where the "Request Sample" button was hidden for items not yet promoted to the Global Library. Users can now request samples for "Custom" project items directly from the Table and Visual views.

## [v2.4.3] — 2026-04-27 (versi 1.9.3)

### Fixed
- **Parallel Phase Activation**: Resolved a data-level inconsistency where `allow_parallel` flags were missing in existing project phases. Enforced SSOT §4.1 via `PhasePolicy.canActivate` to allow concurrent activation of LAYOUT, DESIGN_3D, and CD phases.

### UI Changes
- **Sample Request Visibility (Refinement)**:
    - **ScheduleRow (Table View)**: Refactored the sample request status layout from vertical (`flex-col`) to horizontal (`flex-row`).
    - **VisualRow (Visual/Board View)**: Implemented status-aware indicators for the sample request button, providing visual feedback (colors and labels) based on the current request state (Requested, Ordered, Shipped, Received, Unavailable).
    - **Typography Standard**: Increased status label font size from `8px` to `10px` for better legibility.

## [v2.4.2] — 2026-04-27 (versi 1.9.2 Beta)

### UI Changes
- **TopHeader Layout Fix**:
    - Changed `TopHeader` to `fixed` position at the top of the viewport.
    - Standardized header padding to `px-6`, removing the redundant `78px` offset to align the logo more proportionally with the sidebar.
    - Decoupled header margins from the global design system spacing variables to ensure a stable, fixed layout.
    - Adjusted `DashboardLayout` container with `pt-16` to prevent content overlap with the new fixed header.

## [v2.4.1] — 2026-04-27 (versi 1.9.1 Beta)

### Fixed
- **Cross-Category Drag Deviation (BUG-09)**: Architecturally blocked the ability to drag and drop or swap schedule entries into a different category (e.g., preventing PL-1 from being dragged into the Paint category to become PT-1). This includes explicit UI guardrails (`toast.error`) in `ProjectScheduleMain.tsx` and `ScheduleBoard.tsx`, and backend validation throwing `ActionError` in `schedule-actions.ts` and `schedule-service.ts`.

## [v2.4.0] — 2026-04-27 (versi 1.9.0 Beta)

### UI Changes
- **Zero Hardcode Compliance**: 
    - Replaced hardcoded `font-lora` and `font-inter` with semantic design system tokens (`font-serif` and `font-sans`) across the codebase.
    - Replaced hardcoded "Premium Vibe" colors (`bg-blue-600`, `bg-blue-50`) with semantic accent colors (`bg-slate-900`, `bg-slate-50`) to comply with the Zero Hardcode policy.
- **Animation Encapsulation**: Moved `animate-in fade-in duration-700` into `DashboardPageShell` and removed redundancies from individual pages.

### Changed
- **Library Workflow**: Catalog tab now enforces `APPROVED` item visibility for all roles, resolving UX redundancy where Admin/Staff saw `PENDING` items mixed with production data.

## [v2.3.0] — 2026-04-27 (versi 1.9.4)

### UI Changes
- **Color Selector (BUG-08)**: 
    - Introduced `VisualAsset` component to handle both image URLs and solid color swatches via `color:` prefixing.
    - Updated `OptimizedUploader` with a dual-mode toggle ("Image" vs "Color") for premium asset harvesting.
    - Standardized asset rendering across `ScheduleRow`, `VisualRow`, and `ScheduleSpecEditorModal` hero sections.
- **Sample Request Visibility (BUG-04)**: Moved the "Request Sample" button out of the hover-only group in schedule rows, ensuring it is always visible and accessible for linked products.
- **Terminology Update (BUG-02)**: Renamed "Material Library" to "Product Library" across the application to reflect the broader inclusion of fixtures and samples.

### Fixed
- **Library Auto-Refresh (BUG-01)**: Implemented a robust `refreshAll` callback chain in `LibraryPage`, ensuring that product additions, metadata updates, and promotion reviews trigger immediate UI synchronization without page reloads.
- **Security Hardening (BUG-03 & BUG-05)**:
    - Added category and section validation to `ScheduleService.addOptionToEntry` and `addEntryToSchedule` to prevent cross-category product injection.
    - Enforced project-local and category-specific guards in `swapEntries`, ensuring data integrity during schedule reordering.
- **Promotion Return Type (BUG-07)**: Fixed a return type mismatch in `reviewPromotionRequestAction` that previously caused runtime errors when linking to existing duplicate catalog items.
- **Double Audit Logging (BUG-06)**: Optimized `schedule-actions.ts` by removing redundant `insertAuditLog` calls, deferring all mutation logging to the service layer for a single source of truth.
- **Syntactic Integrity**: Restored `schedule-actions.ts` and `PromotionQueueTable.tsx` after temporary corruption, ensuring production-ready code stability.

### Added
- **Deterministic Code Normalization**: integrated `normalizeCodes` into `swapEntries` to maintain sequential integrity of schedule codes after reordering.

## [v2.2.4] — 2026-04-26 (versi 1.9.3)

### UI Changes
- **Layout Alignment Fix (Miring)**: Removed redundant horizontal padding (`px-[1.5rem]`) from `DashboardPageShell` to perfectly align page content with the `TopHeader` padded container.
- **Container De-nesting**: 
    - Removed redundant background/padding wrappers from `VisualTable` and `ProjectChecklistOverview` to achieve a flatter, cleaner UI as requested.
    - Simplified `ProjectChecklistOverview` by removing internal `Card` and `Heading` elements that duplicated parent sidebar section context.
- **Premium Image Uploader**: Redesigned `UniversalImageUploader` with solid borders, subtle background tints, and refined hover states, replacing generic dashed-border styles.
- **Table Layout Hardening**: 
    - Enforced `table-fixed` layout in `ScheduleTable` and removed `overflow-x-auto` to eliminate unintended horizontal scrolling and ensure consistent column widths (Locked Table Layout).
    - Fixed a UI regression in `TableCardHead` where the `div` wrapper caused `text-[10px]` styling to cascade incorrectly, restoring the correct 10px uppercase metadata typography.
    - Tokenized the interactive column resizer handle using the `UI_ENGINE_INTERACTIVE_RESIZER` design token.
- **Modal Flow Optimization**: Updated `GradualInputForm` to dynamically exclude the "Classification" (TYPE) step when the product section (Material/Fixture) is already known, reducing redundant user input.

### Fixed
- **Table Body Typography Regression**: Restored `text-sm` to the underlying `<table />` container in `TableCard` to fix an issue where the body font size defaulted to `text-base` after stripping the Shadcn container.
- **Resizer Hydration Error**: Fixed a React hydration mismatch in `useTableResizer` by enforcing the default column widths on initial client render and syncing with `localStorage` via a `useEffect`.
- **Schedule Prefix Overwriting**: Resolved a logic defect in `schedule-service.ts` where custom category prefixes in the `PrefixDictionary` were being overwritten by generic two-letter defaults during entry creation.
- **Dynamic Step Counter**: Fixed the step progress indicator in the gradual input form to correctly reflect the total number of active steps after dynamic filtering.

### Added
- **Dynamic Product Type Context**: Improved the `Add Alternative` flow to automatically pass section context, bypassing redundant classification questions.


## [v2.2.3] — 2026-04-26 (versi 1.8)

### UI Changes
- **Phase Detail Hierarchy Flattening**: Removed the redundant `SectionCard` wrapper around the main content area in `PhaseDetailPage` to reduce visual clutter and excess padding.
- **Visual Row Contrast Polish**: Updated the selected row state in `VisualRow` to use a high-contrast dark background (`bg-slate-900`) for improved legibility of the white text overlay.
- **Optimized Uploader Premium Restyling**: Restyled `OptimizedUploader` using design tokens, fixing hardcoded radii and standardizing the gradient/shadow visual profile.
- **Table Card Scroll Fix**: Wrapped `TableCard` children in an `overflow-x-auto` container to restore proper horizontal scrolling.

### Added
- **Standardized UI Placeholder Component**: Introduced `ImagePlaceholder` in `UI_ENGINE`. This component restores the clean, stacked "NO IMAGE" visual design from v1.6 while being fully compliant with the new design system tokens.
- **Visual Identity Alignment (Lora Serif)**: Enforced the use of `font-serif` (Lora) for all product headings in the schedule table (Visual and Standard views), aligning the application with the premium StudioFlow branding rules.

### Changed
- **Visual Row UX Refinement**: 
    - Increased product image preview size from `w-14` (56px) to `w-20` (80px) to match the v1.6 "stable UI" aesthetics and improve specification visibility.
    - Updated metadata styling (Brand/Category) to be bold, uppercase, and tracked-out (`tracking-widest`) for improved readability.
    - Adjusted vertical spacing in table rows to eliminate "messiness" and restore layout balance.
- **Global Consistency**: Standardized image placeholders across `ScheduleRow`, `VisualRow`, and `LibraryFormModal` using the new canonical component.

### Technical Debt
- **Zero Hardcode Compliance**: Replaced remaining hardcoded visual overrides in schedule row components with `UI_ENGINE` tokens.

## [v2.2.2] — 2026-04-26

### Fixed
- **U-02 & U-04 UI Consistency**: Added required field asterisks to Identity and Vendor fields in `ScheduleSpecEditorModal`. Updated placeholder logic to reflect reserved states.
- **U-07 Source Context**: Added `[Shared]` indicator badge in `GradualInputForm` search suggestions to clearly differentiate global library results.
- **U-08 Navigation Hierarchy**: Added "Project Schedule > Specification" breadcrumb context to the `ScheduleSpecEditorModal` header.

### Removed
- `docs/UI_UX_Audit.md` — 100% of gaps resolved. Deferred un-architectural items and deleted the document. SSOT bumped to v2.2.2.

## [v2.2.1] — 2026-04-26

### Fixed
- **U-03 Bug Fix**: `isReadyForPromotion` in `ScheduleSpecEditorModal` now correctly
  requires Stage 1 completeness (`catalog_color`) before enabling Library promotion.
  Previously, items could be promoted without a color specification, violating SSOT §5.2.

### Changed
- **Layout Standardization**: Page animation classes moved from inner wrappers to
  `DashboardPageShell` across Product Catalog, Library, and Phase Detail pages for
  consistent page transitions.

### Removed
- `docs/audit-report.md`, `docs/PLAN.md`, `docs/PLAN2.md` — content reconciled into
  MASTER_SSOT.md and AGENTS.md; documents were stale and created confusion.

### [2.2.0] - 2026-04-25 (versi 1.7)
### System Integrity, Architecture Consolidation & UX Hardening
- **Four-Layer Architecture Migration**:
    - Successfully migrated core platform, RBAC, and domain-shared logic into `src/core`.
    - Encapsulated extension-specific services and actions within their respective `src/extensions` directories.
    - Deleted legacy `src/lib/db.ts`, `src/lib/rbac.ts`, and redundant service files to eliminate architectural debt.
- **Nomenclature & Database Realignment**:
    - Completed global namespacing (`catalog_`, `schedule_`) across Prisma schema, TypeScript interfaces, and UI components.
    - Executed `nomenclature_prefix_alignment` migration to synchronize the PostgreSQL database with the namespaced schema.
    - Renamed all remaining legacy fields in `ProductCatalog` and `PhysicalSample` to strictly use the `catalog_` prefix.
- **UX Safety & View-First Protocol**:
    - Implemented a global "Read-Only by Default" (View-First) model for the Master Product Catalog with an explicit "Modify" gatekeeper.
    - Exempted the Project Schedule from the View-First protocol to prioritize rapid drafting and project-local flexibility.
    - Standardized font hierarchy: Lora (serif) for titles/headings and Inter (sans) for functional UI elements.
- **Build Hardening & Audit Resilience**:
    - Achieved 100% production build success and type-safety verification.
    - Enforced mandatory `insertAuditLog` for every mutation in `LibraryService` and `ScheduleService` to maintain Pillar 2 compliance.
    - Standardized all visual properties (radii, typography, borders) using `UI_ENGINE` semantic tokens, eliminating hardcoded values.
- **Schedule UX Enhancements**:
    - Project Schedule entries now open directly in Edit Mode for a faster user experience.
    - Implemented "Soft Validation" for project snapshots (Color field changed from mandatory block to warning toast).
    - Enhanced `CreatableSearch` with multi-field filtering and improved product mapping in `GradualInputForm`.
- **Governance & Documentation**:
    - Updated `MASTER_SSOT.md` to v2.2.0 reflecting the new architecture and nomenclature standards.
    - Formalized AI "Main Lead" governance and semantic assessment protocols in `AGENTS.md`.
    - Completed a comprehensive three-stage system audit (`audit.md`) covering SSOT drift, backend workflows, and frontend ergonomics.

## [1.16.0] - 2026-04-24 (versi 1.6)
### Added
- **Visual Hierarchy Refactor (Schedule Table)**:
    - Prioritized **Technical Specifications** (Color, Pattern, Finish) for "Generic" items where primary identity (SKU/Name) is missing.
    - Implemented capitalized labels (`Color:`, `Pattern:`, `Finish:`) for professional consistency.
    - Added hyphen separator (`[SKU] - [Name]`) for clearer product identity.
- **Alternative Options UI Redesign**:
    - Consolidated option switcher and "Add Alternative" button into a single, cohesive premium control bar.
    - Improved counter format (`Option X / Y`) using tabular numbers for layout stability.
- **Global Catalog Search Optimization**:
    - Implemented **Category Override** in Source Search: Searching the master library now ignores category filters to maximize recall.
    - Enhanced `CreatableSearch` with multi-field filtering (SKU, Name, and Brand).

### Changed
- **Search visibility**: Improved `GradualInputForm` product mapping to include Name in the searchable dropdown label.

## [1.14.0] - 2026-04-24
### Added
- **Pillar 2 Resilience Refactor**:
    - **Multi-Project Scalability**: Migrated `ProjectScheduleEntry` uniqueness to be scoped by `project_id`, enabling identical schedule codes across different projects.
    - **Immutable Snapshot Contract**: Formalized strict namespaced snapshots (`snapshot_*`, `catalog_*`) and removed all legacy reader/writer aliases.
    - **Smart Deletion**: Implemented deterministic sibling promotion when deleting "Final" options to prevent broken schedule entries.
    - **Stage-Based Gatekeeping**: Enforced server-side validation for Stage 1 (Color mandatory) and Stage 2 (Identity + Media mandatory for promotion).
- **Security Hardening**: 
    - Enforced **ADMIN-only edit policy** for `APPROVED` catalog items. `STAFF` is restricted to editing `PENDING` items only. Removed all implied "Change Request" workflow placeholders.
    - Modified `ProjectProductRequest` to be strictly project-local; removed legacy auto-harvesting logic that created global catalog entries from custom requests.
- **Integration Deferral**: Formally marked all external integrations (CSV Export/Import, SketchUp Plugin) as **Deferred** in documentation. Code implementations remain in the codebase but are explicitly disabled (`FEATURE_DISABLED`) to prioritize core stability.

### Fixed
- **Catalog Linkage**: Refactored `add-from-existing` flow to establish immediate `product_catalog_id` linkage, eliminating the "reserve-then-patch" anti-pattern.
- **Field Mapping**: Corrected field mapping errors where `catalog_motif` was being overwritten by `catalog_product_name` during promotion.
- **Bulk Delete Payload**: Fixed a frontend bug in `ProjectScheduleMain.tsx` where the wrong key was passed during group deletion.

### Changed
- **Auto-Sync Removal**: Disabled auto-propagation of catalog updates to project snapshots to ensure historical integrity (Pillar 2 SSOT).

## [1.13.0] - 2026-04-23
### Added
- **Consolidated Library Management**: Integrated `Approval Queue` and `Sample Logistics` (Product Requests) directly into the `Material Library` extension.
- **RBAC Enforcement**: Enhanced `LibraryTabs` to show `Queue` exclusively to `ADMIN` and `Requests` to both `ADMIN` and `STAFF`.

### Removed
- **Legacy Admin Dashboard**: Purged the redundant `/admin` route and UI.
- **Navigation Cleanup**: Removed the "Admin" sidebar entry to streamline the workspace.

## [1.12.0] - 2026-04-23
### Added
- **Hybrid Quick Draft (UX Unification)**:
    - Replaced legacy multi-step inline creation with a high-performance **QuickDraftDialog** triggered from the search bar.
    - Unified the "Local Project Entry" flow with strict **Stage 1 (Draft)** compliance.
    - Mandated Brand/Vendor selection and Classification (Color/Pattern/Finishing) for all new entries.
- **Documentation Cleanup**: Deleted redundant legacy docs (`Extension_rule.md`, `Extension_byBK.md`) and synchronized terminology with the global `ProductCatalog` schema.

### Fixed
- **Runtime Stabilization**: Resolved a critical `ReferenceError: categories is not defined` in `ScheduleSearchBar.tsx` by removing incomplete/dead code and cleaning up unused imports.

### Changed
- **Terminology Standardization**: Synchronized all references to `GlobalLibrary` and `MaterialCatalog` to the canonical `ProductCatalog` persistence symbol in `MASTER_SSOT.md`.
- **README Alignment**: Updated extension-level documentation to reflect the new creation patterns.

## [1.11.0] - 2026-04-23
### Added
- **View-First UI Protocol**: Implemented a global "Read-Only by Default" pattern for all detail modals.
- **Role-Based Access Control (RBAC)**:
    - **Project Schedule**: Strictly restricted editing and library promotion to `ADMIN`, `DIC`, and `DRIC` roles.
    - **Quick Draft Dialog:** A centralized modal for rapid drafting that satisfies Stage 1 (Draft) requirements in a single step.
    - **Global Search Override:** Searching the Master Library via the selection modal overrides current category filters to ensure all library assets are discoverable regardless of their primary classification.
    - **Product Catalog**: Unified all catalog interactions into a single `LibraryFormModal` with editing restricted to `ADMIN` and `STAFF`.
- **Strict Promotion Gatekeeping**: 
    - Implemented a mandatory **Stage 1 (Color)** check for project snapshot updates.
    - Implemented a mandatory **Stage 2 (Identity + Image)** check for global library promotion.
- **UX Modernization**: Removed redundant "+ ADD PRODUCT" buttons from category headers in favor of the new inline search bar and command menu pattern.

### Changed
- **Modal Unification**: Deprecated and removed the standalone `ProductDetailModal`, unifying its functionality into the `LibraryFormModal`.
- **SSOT v1.8.0**: Updated `MASTER_SSOT.md` with explicit role permissions and View-First UI protocols.
- **Agent Rules**: Updated `AGENTS.md` to enforce the new architectural and UX standards.

### Fixed
- **Radius Hierarchy**: Corrected mismatched radii across schedule and library components using UI engine tokens.

## [1.5.1] - 2026-04-22
### Added
- **Design System Enforcement (Zero Hardcode Policy)**: Updated `AGENTS.md` with a mandatory rule banning hardcoded visual values (radii, spacing) in favor of UI engine tokens (`DESIGN_SYSTEM_CONFIG`, `var(--radius-premium)`).

### Fixed
- **Schedule Code Rendering**: Corrected the `schedule_code` display in the Table View by injecting the computed prefix-increment string directly from the service layer.
- **Zod Validation Regression**: Resolved "Invalid input: expected string, received undefined" in the schedule picker by fixing field namespacing (`schedule_category`) and providing fallbacks for mandatory catalog fields.
- **Visual Parity**: Replaced hardcoded `rounded-xl` with `var(--radius-premium)` across schedule card components.

## [1.10.0] - 2026-04-22
### Added
- **Phased Material Input UX (Pillar 2)**: Implemented a progressive disclosure flow for schedule entries.
    - **Stage 1**: "Initials-First" rapid drafting (Color + Brand + Image).
    - **Stage 2**: "Data Elevation" for catalog readiness (SKU + Name).
- **Promotion Guardrails**: The "Request to Catalog" action is now restricted until Primary data and Brand are finalized.
- **Visual Clarity Refactor**: Simplified UI headings and labels across Library and Schedule extensions.

### Changed
- **SSOT v1.7.5**: Updated `MASTER_SSOT.md` to prioritize Secondary/Initials in the initial drafting phase.


## [1.9.1] - 2026-04-22
### Fixed
- **Build Stabilization**: Resolved critical syntax errors in `LibraryService` and `library-actions.ts`.
- **Type Hardening**: Completed the migration from legacy `ScheduleSection` enum to canonical `ProductType` across 15+ files.
- **Database Synchronization**: Synchronized drifted database schema using `npx prisma db push` and restored the seeding workflow.
- **Login Recovery**: Re-seeded the database with admin and staff credentials.

## [1.9.0] - 2026-04-19
### Phase 3: Global Terminology Refactor & API Foundation
- **Data Migration**: Programmatically renamed legacy keys in JSON columns (`data_snapshot`, `manual_data`) using a direct PG script to ensure data integrity across the version transition.
- **Namespace Hardening**: Enforced `snapshot_` and `catalog_` prefixes across Zod schemas, TypeScript interfaces, and `ScheduleService` logic.
- **UI Legitimacy**: Removed `any` type casts in `ScheduleSpecEditorModal` and `ScheduleEntryRow`, achieving full type safety across the selection workflow.
- **API Spec**: Formalized SketchUp integration endpoints in `src/api/README.md`, specifically documenting the schedule retrieval contract for external renderers.
- **Build Stability**: Verified the namespaced architecture with a zero-error build via `npx tsc --noEmit`.


## [1.8.0] - 2026-04-19
### Added
- **Global Architectural Namespace Refactor (SSOT Alignment)**: Completed the namespacing mandate (`schedule_`, `catalog_`, `core_`) across all layers.
- **Architectural Manifest v1.5**: Hardened naming conventions for Zod Schemas and Payload structures to ensure 100% consistency with the Prisma schema.

### Changed
- **Zod Schema Hardening**: Renamed generic fields (`category`, `sort_order`, `project_type`) to namespaced variants in all validation schemas.
- **Service Layer Cleanup**: Updated `ScheduleService` and `SettingsService` for absolute consistency with namespaced fields.
- **UI Payload Alignment**: Updated `ProjectScheduleMain` and `TemplateManager` to use correctly prefixed keys in transit.
- **Prisma Schema Synchronization**: Renamed `ScheduleTemplate.category` to `schedule_category` for domain-wide consistency.

### Removed
- **Technical Debt Purge**: Deleted legacy `tsc_errors.log` and various `.bak` files.


## [1.7.0] - 2026-04-19
### Added
- **Stage 2 UI Engine Core**: Introduced a stronger settings-backed shell foundation for page containers, section cards, table cards, dialog sizing, and shared surface shadows.
- **Settings-Driven CSS Variables**: Expanded the `uiSettings` bridge to apply container width, dialog sizing, surface shadow, and sidebar rail variables globally.

### Changed
- **Global Shell Surfaces**: Reworked `TopHeader`, `NavOuter`, `SettingsShell`, `DashboardPageShell`, and `PageHeader` toward one centralized StudioFlow layout language.
- **Route Family Alignment**: Standardized the Activity, Project Activity, Library, and Material & Fixtures entry pages around the shared shell and card primitives.
- **Modal System Baseline**: Normalized `Dialog` and `AlertDialog` styling around a shared radius, border, spacing, overlay, and size contract.

## [1.6.0] - 2026-04-19
### Added
- **Canonical Terminology Matrix**: Locked mappings between persistence symbols and canonical names in `MASTER_SSOT.md`.
- **Contract Normalization**: Standardized `ScheduleService` and `UpdateScheduleEntrySchema` to use canonical keys (`schedule_qty`, `schedule_unit`, etc.) in transit.

### Changed
- **Backend Consolidation (Stage 1)**: Initiated backend hardening plan. Prioritizing contract stability over immediate DB schema changes.
- **Audit Integrity**: Verified `insertAuditLog` coverage across all `ScheduleService` and `LibraryService` mutation paths.

### Removed
- **Obsolete Documentation**: Deleted `audit_results.md` after finalizing the Stage 1 system audit. Note: `PROJECT_STATUS.md` was restructured and restored as an active operational status document.

## [1.5.0] - 2026-04-18
### Added
- **catalog_brand Resilience**: Added `catalog_brand` directly to the `MaterialCatalog` model to decouple product identity from volatile vendor relationships.
- **Namespaced Terminology**: Implemented comprehensive namespacing across the entire stack (`catalog_`, `schedule_`).

### Changed
- **Unified Refresh Protocol**: Replaced all `window.location.reload()` calls with `router.refresh()` for a smoother SPA experience.
- **Payload Normalization**: Standardized API responses from `ScheduleService` to use namespaced fields.
- **SSOT Alignment**: Synchronized `MASTER_SSOT.md` and extension READMEs with the new terminology architecture.

### Fixed
- **Database Reset Recovery**: Re-seeded the development database following migration resets to restore user access and sample data.
- **TypeScript Solidification**: Resolved all terminology-related type regressions in `ProjectScheduleMain` and `ScheduleCategorySection`.

## [1.4.0] - 2026-04-17
### Added
- **AI Main Lead Governance**: Formalized the AI Assistant as the "Main Lead" for architectural integrity and documentation custodian.
- **Reserved Entry Notification**: Added a notification banner in the schedule categories to summarize hidden reserved items.
- **Schedule README**: Comprehensive documentation at `src/extensions/schedule/README.md`.

### Changed
- **Schedule Selection Logic**: Implemented anchor-based range selection (Shift-Click) and Ctrl-Click multi-select in `ProjectScheduleMain.tsx`.
- **Interaction Model**: Standardized on Select-on-Click and Edit-on-Double-Click for schedule entries.
- **Table Visibility**: `[RESERVED]` labels are now suppressed from the table view, though the rows remain visible to maintain code sequentiality. A notification indicator replaces the hard text.
- **Editor UX**: Reserved items in the `ScheduleSpecEditorModal` now show a placeholder and notification instead of hard-coded `[RESERVED]` text.
- **Library Sync**: Implemented `getScheduleSuggestionsAction` and `CreatableSearch` in the Editor Modal to sync Brand and Product Information with the Global Library.
- **Product Information Logic**: Standardized display and entry format to `[SKU] - [Name]` with automatic substitution of `motif_or_color` when primary identifiers are missing.

### Fixed
- Selection overlap bugs where product info clicks blocked row selection.
- Double-click/Single-click event conflicts in `ScheduleEntryRow.tsx`.

---

## [1.3.0] - 2026-04-16
### Added
- **Pillar 2 Resilience**: Snapshot-First architecture for Material & Fixtures Schedule.
- **Audit System**: `insertAuditLog` integration for all schedule mutations.
- **Master SSOT**: Initial version of the Single Source of Truth document.
