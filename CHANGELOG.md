# StudioFlow Development Log (Changelog)

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
