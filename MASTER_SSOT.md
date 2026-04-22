# StudioFlow (radsaas-2) - Master Single Source of Truth (SSOT)

> **Document Version:** 1.7.2
> **Last Updated:** April 2026 (Build Stabilization & Type Hardening)
> **Purpose:** Unified canonical documentation for StudioFlow codebase, including Pillar 1 (Studio Management) and Pillar 2 (Scheduler & Library).

---

## 1. PRODUCT IDENTITY & AESTHETIC

### Product Name
**StudioFlow**

### High-End Minimalist Philosophy
The application follows a strict high-end minimalist design philosophy:
- **Cleanliness:** Ample whitespace, subtle borders (border-subtle/slate-200), no visual clutter.
- **Typography-First:** Font choices drive hierarchy; Lora (serif) for headings, Inter (sans-serif) for UI components.
- **Subtle Interactions:** Hover states use color shifts or subtle background changes, not complex animations.
- **Purposeful Color:** Minimal color usage—primarily slate neutrals with red accents for urgent/priority items.

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

#### MaterialCatalog (Library SSOT)
The global reusable material and fixture database.
- **Namespaced Fields:** All fields strictly use the `catalog_` prefix (e.g., `catalog_sku`, `catalog_product_name`, `catalog_category`, `catalog_brand`).
- **Product Identity:** Canonical display format: `[catalog_sku] - [catalog_product_name] ex. [catalog_brand]`.
- **Match-to Pattern:** Supports visual matching using `[catalog_sku] - color [match to] [relative_sku]`.
- **Status:** `PENDING`, `APPROVED`, `REJECTED`.
- **Resilience:** `catalog_brand` is stored directly on the material to ensure product identity persists even if vendor relationships change.
- **Deleted_at:** Soft-delete timestamp (no hard deletes allowed).
- **Physical Samples:** Tracks physical sample location (`catalog_rak_location`, `catalog_box_number`).

### 3.2 Scheduler Entities (Pillar 2)

#### ProjectScheduleEntry
Represents a single row in the project's specification sheet.
- **Namespaced Classification:** Uses schedule_category (e.g., PAINT, SANITARY) and section (type: ProductType: material, fixture).
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
- **Parallel Activation:** Phases explicitly flagged with `allow_parallel: true` (e.g., LAYOUT, DESIGN_3D, CD) bypass the sequential dependency check and can be activated while the previous phase is still `IN_PROGRESS`.
- **Review:** Internal review → Client review.
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
- **Phased Input Flow (UX Refactor v1.5):** 
    1. **Stage 1 (Draft):** Prioritize "Secondary / Initials" (Mandatory: Color) and Brand/Vendor. This creates a local project snapshot.
    2. **Stage 2 (Elevation):** Primary data (SKU + Name) and Images can be added later to complete the specification.
- **Manual Promotion:** Users must explicitly click "Save to Library" to submit an item for global inclusion. This is ONLY permitted once Stage 2 (Primary + Brand) is complete.
- **Auto-Harvesting:** (Approved Decision) Items can be auto-harvested to the library as `PENDING` status for admin review.

### 5.3 Deterministic Coding
- Codes are managed via `ScheduleService.normalizeCodes`.
- Format: `[Prefix]-[Seq]` (e.g., `PT-01`).
- Prefix is looked up from `PrefixDictionary` based on `(section, category)`.
- **Reserved State**: Entries created as placeholders use the `[RESERVED]` token internally. These entries **STAY VISIBLE** to maintain sequentiality, but the literal text is suppressed in the UI and replaced with "Action Required" notifications until formally specified.

---

## 6. INTEGRATION PATTERNS

### 6.1 Google Sheets (CSV Roundtrip)
- **Export:** Web scheduler exports section-specific CSV for external editing.
- **Import:** Manual CSV upload matches existing rows by `project_id + section + schedule_code`.
- **Validation:** Importers must map to valid categories; unknown categories are rejected.

### 6.2 SketchUp Plugin
- **One-Way Import:** Web scheduler accepts CSV exports from the SketchUp `material_scheduler` plugin.
- **Source Origin:** Imported rows are tagged as `sketchup_plugin` in the snapshot metadata.

---

## 7. SYSTEM RESILIENCE & AUDIT

### 7.1 Soft Delete Policy
No hard deletes for `Vendor` or `MaterialCatalog` to prevent orphaned records in historical project schedules.

### 7.2 Database Preflight (`src/lib/db.ts`)
The system enforces strict schema validation on startup via `ensureDbSchemaPreflight`. This blocks execution if critical tables or columns (like `AuditLog` fields) are missing.

### 7.3 Audit Integrity
Every mutation (Create/Update/Delete/Approve) MUST call `insertAuditLog`.

---

## 8. SECURITY & PERMISSIONS

| Role | Description |
|------|-------------|
| **ADMIN** | Full system and settings control. |
| **DIC** | Designer In Charge: Manages all project phases except CD. |
| **DRIC** | Drafter In Charge: Primarily manages the CD phase. |
| **STAFF** | Read-only access to projects. |

---

## 9. TERMINOLOGY MATRIX (STAGE 1)

This matrix defines the canonical mapping between concepts, labels, and persistence symbols.

| Concept | Canonical Name | UI Label | Persistence Symbol (Prisma) | Banned Legacy Terms |
|---------|----------------|----------|------------------------------|---------------------|
| Library | ProductCatalog | Library (Queue) | `ProductCatalog` | `GlobalLibrary`, `CommonLibrary`, `MaterialCatalog` |
| Schedule| ProjectScheduleEntry | Schedule | `ProjectScheduleEntry` | `ProjectSchedule`, `ScheduleSheet` |
| Brand   | Brand          | Brand    | `Vendor.brand_name` | - |
| SKU     | SKU            | SKU      | `catalog_sku` | - |
| Product | Catalog Item   | Product  | `MaterialCatalog.catalog_product_name` | - |
| Code    | Sequence Code  | Code     | `ProjectScheduleEntry.schedule_code` | `ProjectScheduleEntry.code` |
| Category| Schedule Group | Category | `ProjectScheduleEntry.schedule_category` | `category` (scheduler domain) |
| Order   | Display Order  | Sort     | `ProjectScheduleEntry.schedule_sort_order` | `sort_order` |
| Pending | Queue          | Queue    | `LibraryItemStatus.PENDING` | `Under Review` |

## 10. BANNED LEGACY VARIANTS

The following terms and fields are BANNED in new code and must be phased out from active contracts:
- **`GlobalLibrary` / `CommonLibrary`**: Use `MaterialCatalog`.
- **`ProjectSchedule`**: Use namespaced `ProjectScheduleEntry`.
- **`code` / `category` / `sort_order`**: (In models) Use `schedule_code`, `schedule_category`, `schedule_sort_order`.
- **`project_type`**: Use `core_project_type`.
- **`source_kind` / `source_origin` / `source_external_id`**: (In snapshots) Use `snapshot_source_kind`, `snapshot_source_origin`, `snapshot_source_external_id`.
- **`captured_at`**: (In snapshots) Use `snapshot_captured_at`.
- **`initials_type` / `has_sample`**: (In snapshots) Use `catalog_initials_type`, `catalog_has_sample`.
- **`specs.catalog_product_name`**: (In snapshots) Use `specs.catalog_motif` to avoid confusion with root name.
- **`window.location.reload()`**: Use `router.refresh()` from `next/navigation`.
- **Legacy JSON Keys**: All JSON snapshots must use strict `snapshot_` and `catalog_` mapping.

---

*This document is the single source of truth for StudioFlow development. All code changes must align with these directives.*
