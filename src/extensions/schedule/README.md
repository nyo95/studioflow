# Product Schedule Extension (Pillar 2)

## Overview
The Schedule Extension (Pillar 2) is a "Smart Spreadsheet" for managing interior design specifications. It serves as the primary bridge between design intent (Project) and procurement sources (Library).

## 1. Core Terminology

### **ProjectScheduleEntry (Entry)**
A single row in the schedule representing a specific requirement (e.g., Paint, Floor Tile, or Faucet).
- **Code**: Sequential identifier (e.g., `PT-01`) managed by `ScheduleService`.
- **Metadata**: Project-specific data like `schedule_location`, `qty`, and `unit`.

### **ProjectScheduleOption (Option)**
Candidate products associated with an Entry. Each Entry can have multiple Options (Option A, B, C...) for comparison or client review.
- **is_final**: Marks the approved option for procurement.
- **status**: `DRAFT`, `APPROVED`, or `NOT_USED`.

### **ScheduleOptionSnapshot (Snapshot)**
An immutable JSON blob capturing the product specifications. 
- **Namespaced Fields**: All fields strictly use namespaced prefixes (`catalog_` for library fields, `schedule_` for project context).
- **Product Identity**: Standard display logic: `[catalog_sku] - [catalog_product_name] ex. [catalog_brand]`.
- **Match-to Pattern**: `[catalog_sku] - color [match to] [relative_sku]`.
- **Why?**: Ensures project data remains stable even if the global library is updated or items are deleted.

---

## 2. Pillar 2 Resilience & SSOT

StudioFlow follows a strict **Snapshot-First** architecture to ensure data integrity:

1.  **Library as Master**: The `ProductCatalog` is the master source of truth (SSOT).
2.  **Project as Snapshot**: Once a product is added to a project, it is frozen in a `data_snapshot`.
3.  **Decoupling**: Editing a product in the global library does **NOT** retroactively change existing project schedules.
4.  **Local by Default**: New items added manually to a project are local to that project.
5.  **Explicit Promotion**: To move a manual project item into the global library, it must be explicitly "Promoted" (Promote to Library action).

---

## 3. General Workflows

### **Adding Products**
- **From Library**: Search and pick from the `ProductCatalog`. A snapshot is created automatically.
- **Hybrid Quick Draft**: Triggered from the search bar when a product is not found in the library. Mandates Category, Brand, and Classification (Stage 1 Draft).
- **Manual Creation (Legacy)**: Input data manually via the picker modal.

### **Alternative Options**
- Use "Add Alternative" to create a new `ProjectScheduleOption` for an existing `ProjectScheduleEntry`.
- This allows comparing different brands or colors for the same code (e.g., PT-01 can have Option A from Brand X and Option B from Brand Y).

### **Approval Process**
- Marking an option as "Final" (Approval) sets its status to `APPROVED` and automatically marks all other options in that row as `NOT_USED`.

### **Coding & Normalization**
- Codes are deterministic: `[Prefix]-[Seq]` (e.g., `FL-01`).
- The `ScheduleService.normalizeCodes` method re-indexes all entries in a category whenever items are added, deleted, or reordered to maintain sequential integrity.

---

## 4. Technical Reference

### **Primary Service**
`src/lib/services/schedule-service.ts`: Contains all business logic for snapshots, normalization, and promotion.

### **UI Components**
- `ProjectScheduleMain.tsx`: Root spreadsheet view with Dnd-Kit integration.
- `VisualTable.tsx` & `VisualRow.tsx`: Individual row component handling options and status.
- `ScheduleSpecEditorModal.tsx`: Direct editor for the `data_snapshot`.

---

## 5. API & Integration Standards

### **SketchUp Plugin Integration**
The system exposes a specialized API surface for SketchUp plugin connectivity:
- **Snapshot Origin**: Imports are tagged as `source_origin: "sketchup_plugin"`.
- **Field Correlation**: The plugin must map SketchUp material attributes to `catalog_sku` and `catalog_metadata`.
- **Endpoint Specification**: Refer to `src/api/README.md` for the technical specification.

### **Terminology & Namespacing Rules**
- **Prefix Consistency**: Never use raw fields like `name` or `brand`. Always use `catalog_product_name` or `catalog_brand`.
- **Master SSOT Alignment**: All modifications to the scheduler must validate against `MASTER_SSOT.md`.

---

> [!NOTE]
> **Audit Requirement**: Every mutation (approval, edit, delete, promote) MUST call `insertAuditLog` to maintain a forensic trail of schedule changes.
