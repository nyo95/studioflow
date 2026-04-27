# StudioFlow (radsaas-2) - Master Single Source of Truth (SSOT)

> **Document Version:** 2.2.5 (v1.9.3 - Parallel Phase Activation & Sample Visibility)
> **Last Updated:** April 27, 2026 (v1.9.3 - Parallel Phase Activation & Sample Visibility)
> **Purpose:** Unified canonical documentation for StudioFlow codebase, including Pillar 1 (Studio Management) and Pillar 2 (Scheduler & Library).

---

## 1. PRODUCT IDENTITY & AESTHETIC

### Product Name
**StudioFlow**

### High-End Minimalist Philosophy
The application follows a strict high-end minimalist design philosophy:
- **Cleanliness:** Ample whitespace, subtle borders (border-subtle/slate-200), no visual clutter.
- **Typography-First:** Font choices drive hierarchy; Lora (serif) for headings (including product names in tables), Inter (sans-serif) for UI components.
- **Subtle Interactions:** Hover states use color shifts or subtle background changes, not complex animations.
- **Purposeful Color:** Minimal color usage—primarily slate neutrals with red accents for urgent/priority items.

### View-First Protocol (UX Refactor v1.5)
The application enforces a "View-First" interaction model for data integrity:
- **Default State:** All forms/modals for existing data MUST open in a Read-Only state by default.
- **Modify Toggle:** Privileged users are presented with a "Modify" (Edit Symbol) button to explicitly unlock field mutations.
- **Domain Exception (Project Schedule):** Project Schedule entries are EXEMPTED from View-First protocol—they open directly in Edit Mode by default since data is project-local and does not affect Master Catalog safety.
- **Visual Hierarchy Priority (Generic Items):** For items where primary identifiers (SKU, Name) are missing or marked as "Generic", the UI must automatically promote technical specifications (Color, Pattern, Finish) to the primary display line to ensure physical recognizability.
- **Safety:** This prevents accidental data changes in the Master Catalog while providing a flexible interface for project-level specification.

### UI Engine Rules

#### Typography System (`src/ui_engine/design-system.config.ts`)
| Element | Font Family | Size | Weight | Tracking |
|---------|-------------|------|--------|----------|
| H1 | font-serif (Lora) | text-4xl | font-bold | tracking-tight |
| H2 | font-serif (Lora) | text-3xl | font-bold | tracking-tight |
| H3 | font-serif (Lora) | text-2xl | font-bold | tracking-tight |
| H4 | font-sans (Inter) | text-lg | font-semibold | tracking-tight |
| Body | font-sans (Inter) | text-sm | font-normal | tracking-normal |
| UI Meta | font-sans (Inter) | text-[10px] | font-bold | tracking-[0.18em] uppercase |

#### Standard Components (`src/ui_engine/components/`)
| Component | Description | Design Standards |
|-----------|-------------|------------------|
| TopHeader | Persistent global navigation bar. | **Fixed Position** (`fixed top-0`), Height: `h-16` (64px), Padding: `px-6`. Decoupled from design system spacing for layout stability. |
| ImagePlaceholder | Standard empty state for images. | Stacked "NO IMAGE" text, font-black 8px, tracking-widest, slate-50 bg. |

#### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| Canvas | slate-50 (#f8fafc) | Main background |
| Card | bg-white | Card backgrounds |
| Borders | border-subtle (#e2e8f0) | Standard UI borders |
| Accent | bg-slate-900 | Primary actions |
| Urgent / Red | red-100, red-600 | Priority/Error states |

---

## 2. TECH STACK & INFRASTRUCTURE

### Core Stack
- **Framework:** Next.js 15+ (App Router)
- **Language:** TypeScript (Strict)
- **ORM:** Prisma (Generated client at `src/generated/prisma`)
- **Database:** PostgreSQL (Docker for Development, Supabase for Production)
- **Auth:** NextAuth.js v5 (Auth.js)
- **UI Architecture:** Custom UI Engine (Tailwind-based primitives)

---

## 3. DATABASE SCHEMA & CANONICAL MODELS

### 3.1 Core Entities

#### Activity (TODO System - Patch 1.1)
Activities serve as the primary task management unit.
- **project_id:** Root owner (required).
- **phase_id:** Optional tag to associate task with a specific phase.
- **revision_id:** Optional link to a specific design revision (mandatory for client FEEDBACK).
- **mode:** `TODO` (internal) or `FEEDBACK` (external/client-facing).
- **status:** `OPEN` or `COMPLETED`.

#### AuditLog (Resilience System)
Tracks every mutation in the system for accountability.
- **action:** Descriptive action name.
- **project_id / phase_id:** Optional context fields for filtering.
- **details:** JSON snapshot of the change.
- **Persistence Policy:** Audit logs are preserved indefinitely for forensic trails. Deleting a Project or Phase will NOT delete its associated AuditLog entries; instead, the relation is set to null to maintain historical accountability.

#### ProductCatalog (Library SSOT)
The global reusable material and fixture database.
- **Namespaced Fields:** All fields strictly use the `catalog_` prefix (e.g., `catalog_sku`, `catalog_product_name`, `catalog_category`, `catalog_brand`).
- **Product Identity:** Canonical display format: `[catalog_sku] - [catalog_product_name] ex. [catalog_brand]`.
- **Match-to Pattern:** Supports visual matching using `[catalog_sku] - color [match to] [relative_sku]`.
- **Status:** `PENDING`, `APPROVED`, `REJECTED`.
- **Resilience:** `catalog_brand` is stored directly on the material to ensure product identity persists even if vendor relationships change.
- **Deleted_at:** Soft-delete timestamp (no hard deletes allowed).
- **Physical Samples:** Tracks physical sample location via the `PhysicalSample` model strictly using the `catalog_` prefix (`catalog_rack_number`, `catalog_box_number`, `catalog_notes`, `catalog_status`), decoupled from root catalog fields.

#### Project (Identity & Naming)
- **Canonical Naming Format:** `[YYYY]-[NNN] [Project Name]` (e.g., `2025-429 Heloskin Cimanggu`).
- **Structure:**
    - `[YYYY]`: 4-digit year of creation.
    - `[NNN]`: 3-digit sequential index for the year.
    - `[Space]`: A single space separator.
    - `[Project Name]`: The readable title.
- **Enforcement:** Service layer automatically generates this prefix if auto-naming is enabled. Manual entries must adhere to this format.

### 3.2 Scheduler Entities (Pillar 2)

#### ProjectScheduleEntry
Represents a single row in the project's specification sheet.
- **Scope & Uniqueness:** Uniqueness is scoped to `[project_id, section, schedule_prefix, schedule_increment]`. This allows identical codes (e.g., PT-01) across different projects while maintaining absolute uniqueness within a project's domain.
- **Namespaced Classification:** Uses `schedule_category` (e.g., PAINT, SANITARY) and `section` (type: `ProductType`: `material` (Materials), `fixture` (Fixtures)).
- **Code:** Deterministic code generated as `[Prefix]-[Index]`.
- **Qty / Unit / schedule_location:** Project-specific metadata fields.

#### ProjectScheduleOption
Candidate options associated with a schedule entry.
- **data_snapshot:** Immutable JSON copy of the material specs at selection time.
- **is_final:** Marks the approved option for the row.
- **status:** `DRAFT`, `APPROVED`, `NOT_USED`.

---

## 4. CORE WORKFLOWS

### 4.1 Phase Lifecycle
Phases follow a strict sequence (MOODBOARD → LAYOUT → DESIGN_3D → CD → SUPERVISION), but support concurrent activation where permitted.
- **Activation:** By default, Phase N can only activate if Phase N-1 is `READY_FOR_NEXT` or `COMPLETED`.
- **Parallel Activation:** Phases explicitly flagged with `allow_parallel: true` (e.g., LAYOUT, DESIGN_3D, CD) bypass the sequential dependency check and can be activated while the previous phase is still `IN_PROGRESS`. This is enforced at the `PhaseService` layer via `PhasePolicy.canActivate`.
- **Data Integrity:** The `allow_parallel` flag is a mandatory boolean in the Phase model; existing projects must be patched to ensure correct behavioral alignment with this SSOT.
- **Locking:** Phase is locked automatically upon client approval.

### 4.2 Global Activity Workflow (Patch 1.1)
- **Agile Creation:** Tasks can be added to a project at any time, with or without a phase tag.
- **Contextual Blocker:** Phase submission for review is blocked only by `OPEN` tasks tagged to that specific phase or its active revision.
- **Today View:** Aggregates all `OPEN` tasks assigned to the user across all active projects.

---

## 5. PILLAR 2: SCHEDULER & LIBRARY ARCHITECTURE

### 5.1 Snapshot-First Interaction
Approving a material option creates a frozen `data_snapshot`.
- **Immutable History:** Future edits to the `MaterialCatalog` will NOT update existing project snapshots.
- **Independence:** Designers can edit snapshot fields (e.g., custom finishing for a specific project) without polluting the global library.

> [!TIP]
> **Detailed Documentation**: For a deep dive into naming conventions, snapshotting workflows, and technical details of the Schedule extension, refer to [src/extensions/schedule/README.md](file:///d:/Misc/ProjectsHUB/radsaas-2/src/extensions/schedule/README.md).

### 5.2 Explicit Promotion Pattern
- **Local by Default:** New materials added to the scheduler are local to the project.
- **Hybrid Quick Draft (UX Refactor v1.6):** 
    - **Trigger:** Initiated via the Global Search Bar when no matching library product is found.
    - **Quick Draft Dialog:** A centralized modal for rapid drafting that satisfies Stage 1 (Draft) requirements in a single step.
    - **Global Search Override:** Searching the Master Library via the selection modal overrides current category filters to ensure all library assets are discoverable regardless of their primary classification.
- **Phased Input Flow (UX Refactor v1.5):** 
    1. **Stage 1 (Draft):** Prioritize "Classification" (Color, Pattern, or Finishing) and Mandatory Brand/Vendor. This creates a local project snapshot.
    2. **Stage 2 (Elevation):** Primary data (SKU + Name) and Images. Completing this stage elevates the snapshot to "Library Ready".
- **Strict Gatekeeping:** 
    - **Update Snapshot:** Requires Stage 1 completeness (Mandatory: `catalog_color`).
    - **Promote to Library:** Requires full Stage 2 completeness (Mandatory: `catalog_sku`, `catalog_product_name`, `catalog_brand`, `catalog_image_url`).
    - **Promotion Readiness Check (v2.2.1):** `isReadyForPromotion` MUST include Stage 1 completeness (`catalog_color` via `isSecondaryComplete`) as a prerequisite — not just Stage 2 fields. Sequence: Stage 1 (color) → Stage 2 (SKU/Name + Brand + Image) → Promotion Eligible.
- **Ownership Validation:** All mutations (Edit/Delete/Promote) strictly validate that the target belongs to the active project.
- **Manual Promotion:** Users must explicitly click "Save to Library" (Manual Elevation). Auto-harvesting is disabled for project snapshots to ensure library quality. Project-level custom requests do NOT create library entries.

### 5.3 Deterministic Coding
- Codes are managed via `ScheduleService.normalizeCodes`.
- Format: `[Prefix]-[Seq]` (e.g., `PT-01`).
- Prefix is looked up from `PrefixDictionary` based on `(section, category)`.
- **Reserved State**: Entries created as placeholders use the `[RESERVED]` token internally. These entries **STAY VISIBLE** to maintain sequentiality, but the literal text is suppressed in the UI and replaced with "Action Required" notifications until formally specified.

---

## 6. INTEGRATION PATTERNS (DEFERRED)

> [!IMPORTANT]
> **Status: Temporarily Unsupported**. All external integrations (CSV, SketchUp) are currently deferred while the core snapshot-first architecture is stabilized. Integration endpoints exist in the codebase but are explicitly disabled (`FEATURE_DISABLED`).

### 6.1 Google Sheets (CSV Roundtrip)
- **Export:** (Deferred) Web scheduler exports section-specific CSV for external editing.
- **Import:** (Deferred) Manual CSV upload matches existing rows by `project_id + section + schedule_code`.
- **Validation:** Importers must map to valid categories; unknown categories are rejected.

### 6.2 SketchUp Plugin
- **One-Way Import:** (Deferred) Web scheduler accepts CSV exports from the SketchUp `material_scheduler` plugin.
- **Source Origin:** Imported rows are tagged as `sketchup_plugin` in the snapshot metadata.

---

## 7. SYSTEM RESILIENCE & AUDIT

### 7.1 Data Retention & Soft Delete Policy
- **Vendor & ProductCatalog:** No hard deletes allowed to prevent orphaned records in historical project schedules.
- **Project & Phase Deletion:** While projects can be hard-deleted, their associated **AuditLog** records MUST be preserved (SetNull) to maintain a complete forensic history of the studio's operations.
- **Manual Purge:** Manual purging of audit logs during project deletion is strictly FORBIDDEN.

### 7.2 Database Preflight (`src/lib/db.ts`)
The system enforces strict schema validation on startup via `ensureDbSchemaPreflight`. This blocks execution if critical tables or columns (like `AuditLog` fields) are missing.

### 7.3 Audit Integrity
Every mutation (Create/Update/Delete/Approve) MUST call `insertAuditLog`.

---

## 8. SECURITY & PERMISSIONS

| Role | Description | Access Rights |
|------|-------------|---------------|
| **ADMIN** | Full system and settings control. | Edit Schedule, **Full Library Access (including APPROVED items)**, Manage Queue. |
| **DIC** | Designer In Charge: Project Lead. | Edit Schedule (Project Level), Read-only Library. |
| **DRIC** | Drafter In Charge: Production Lead. | Edit Schedule (Project Level), Read-only Library. |
| **STAFF** | General Designer / Studio Staff. | Read-only Schedule, Edit Library (Catalog Level - **PENDING only**). |

---

## 9. TERMINOLOGY MATRIX (STAGE 1)

This matrix defines the canonical mapping between concepts, labels, and persistence symbols.

| Concept | Canonical Name | UI Label | Persistence Symbol (Prisma) | Banned Legacy Terms |
|---------|----------------|----------|------------------------------|---------------------|
| Library | ProductCatalog | Library (Queue) | `ProductCatalog` | `GlobalLibrary`, `CommonLibrary`, `MaterialCatalog` |
| Schedule| ProjectScheduleEntry | Schedule | `ProjectScheduleEntry` | `ProjectSchedule`, `ScheduleSheet` |
| Brand   | Brand          | Brand    | `Vendor.brand_name` | - |
| SKU     | SKU            | SKU      | `catalog_sku` | - |
| Product | Catalog Item   | Product  | `ProductCatalog.catalog_product_name` | - |
| Code    | Sequence Code  | Code     | `${schedule_prefix}-${schedule_increment}` | `ProjectScheduleEntry.code` |
| Category| Schedule Group | Category | `ProjectScheduleEntry.schedule_category` | `category` (scheduler domain) |
| Order   | Display Order  | Sort     | `ProjectScheduleEntry.schedule_sort_order` | `sort_order` |
| Pending | Queue          | Queue    | `LibraryItemStatus.PENDING` | `Under Review` |
| Materials| Material Section| Materials| `ProductType.material` | `Architectural` |
| Fixtures | Fixture Section | Fixtures | `ProductType.fixture` | `FF&E` |

## 10. BANNED LEGACY VARIANTS

The following terms and fields are BANNED in new code and must be phased out from active contracts:
- **`GlobalLibrary` / `CommonLibrary` / `MaterialCatalog`**: Use `ProductCatalog`.
- **`ProjectSchedule`**: Use namespaced `ProjectScheduleEntry`.
- **`code` / `category` / `sort_order`**: (In models) Use `schedule_code`, `schedule_category`, `schedule_sort_order`.
- **`project_type`**: Use `core_project_type`.
- **`source_kind` / `source_origin` / `source_external_id`**: (In snapshots) Use `snapshot_source_kind`, `snapshot_source_origin` (values: `library`, `manual`, `gsheets_import`, `sketchup_plugin`), `snapshot_source_external_id`.
- **`captured_at`**: (In snapshots) Use `snapshot_captured_at`.
- **`initials_type` / `has_sample`**: (In snapshots) Use `catalog_initials_type`, `catalog_has_sample`.
- **`specs.catalog_product_name`**: (In snapshots) Use `specs.catalog_motif` to avoid confusion with root name.
- **`window.location.reload()`**: Use `router.refresh()` from `next/navigation`.
- **Legacy JSON Keys**: All JSON snapshots must use strict `snapshot_` and `catalog_` mapping.

---

*This document is the single source of truth for StudioFlow development. All code changes must align with these directives.*

---

## 11. GOVERNANCE & ARCHITECTURE

### 11.1 Documentation Synchronization Policy
- **Trigger**: Task completion + Semantical Change assessment.
- **Action**: Mandatory update to `MASTER_SSOT.md` for architectural/contractual changes; `CHANGELOG.md` for material progress and hardening.
- **Source of Truth**: The codebase is considered the "Leading Truth" only after explicit user verification of undocumented drifts.

### 11.2 Four-Layer Architecture Boundary
The system is divided into four strictly isolated layers:
1. **core/platform**: Low-level infrastructure (Auth, DB initialization, Audit engine, Configuration, Session management).
2. **core/rbac**: Identity governance (Role-Permission matrix, Access guards, Project membership policies).
3. **core/domain-shared**: Cross-cutting business logic (Project Naming, Phase lifecycle helpers, Code normalization, Snapshot contracts).
4. **extensions/***: Feature modules (Schedule, Product Catalog, etc.).

### 11.3 Public Internal API & Facade Rule
- **Isolation**: Extensions MUST NOT import internal helpers, actions, or private types from other extensions.
- **Dependency**: Cross-extension communication must happen via a **Public Facade** or **Application Service** defined at the module boundary.
- **Centralization**: Any utility used by more than one extension must be promoted to `core/domain-shared`.

