# StudioFlow Development Log (Changelog)

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
