# 🔍 PILLAR 2 DATA & LOGIC AUDIT REPORT
## Terminology & UI-to-Data Mapping Comparison

**Date:** April 16, 2026  
**Target:** Material & Fixtures Schedule (Pillar 2) + MaterialCatalog Library  
**Single Source of Truth (SSOT):** Prisma Schema + TypeScript Interfaces

---

## EXECUTIVE SUMMARY

This audit compares terminology and data mappings between:
1. **Global Material Library** (`/extensions/library`) - The SSOT for materials
2. **Project Schedule** (`/extensions/schedule`) - Project-specific material selection

**Critical Finding:** The Schedule UI has **inverted terminology** where "Category" column reads from `sub_category` first, creating confusion between the two modules.

---

## 1. COMPARATIVE TERMINOLOGY MAPPING

### 1.1 Main Identifier Field

| Context | UI Label | Actual Data Variable | Source |
|---------|----------|---------------------|--------|
| **Library (MaterialTable)** | "Product Info" | `product_type` | MaterialCatalog.product_type |
| **Schedule (EntryRow)** | "SKU / Type" | `name` → `specs.product_type` | snapshot.name |

**🔴 GAP IDENTIFIED:** The Schedule labels this "SKU / Type" which is misleading. There's no SKU field - it displays `name` (Material Name) with fallback to `product_type` from specs.

---

### 1.2 Brand/Vendor Field

| Context | UI Label | Actual Data Variable | Source |
|---------|----------|---------------------|--------|
| **Library (MaterialTable)** | "Vendor" | `vendor.brand_name` | MaterialCatalog → Vendor |
| **Schedule (EntryRow)** | "Brand" | `snapshot.brand` | snapshot.brand |

**Status:** ✅ Terminology consistent (maps to Vendor/Brand name)

---

### 1.3 Category Field - **CRITICAL GAP**

| Context | UI Label | Actual Data Variable | Source |
|---------|----------|---------------------|--------|
| **Library (MaterialTable)** | "Category" | `category` (line 120) | MaterialCatalog.category |
| **Library (MaterialTable)** | Sub-category (if exists) | `sub_category` (line 121) | MaterialCatalog.sub_category |
| **Schedule (EntryRow)** | "Category" (line 295) | `sub_category` → `category` (line 157) | snapshot.sub_category FIRST! |

**🔴 CRITICAL INVERSION DETECTED:**

```typescript
// ScheduleEntryRow.tsx:157
const materialType = snapshot?.sub_category || snapshot?.category || entry.category;
```

This logic reads `sub_category` **PRIMARY** and falls back to `category`. This is **backwards** from standard domain logic where:
- `category` = Main classification (e.g., "FLOORING", "WALL")
- `sub_category` = Secondary detail (e.g., "Ceramic Tile", "Marble")

---

### 1.4 Variant/Style Fields

| Context | UI Label | Actual Data Variable | Source |
|---------|----------|---------------------|--------|
| **Library (MaterialTable)** | Shown in Product Info row | `motif_or_color` + `finishing` | MaterialCatalog |
| **Schedule (EntryRow)** | Rendered in SKU/Type column OR derived | `specs.motif_or_color`, `specs.color`, `specs.finishing` | snapshot.specs |

**Status:** ✅ Data flows correctly, but display location differs

---

## 2. SCHEDULE TABLE COLUMN ANALYSIS

### Current Column Headers (ProjectScheduleMain.tsx:293-299)

| # | UI Header | Width | Actual Variable Read | Issue |
|---|------------|-------|---------------------|-------|
| 1 | Code | w-[96px] | entry.code | ✅ Correct |
| 2 | Image | w-[80px] | snapshot.image_url | ✅ Correct |
| 3 | Category | w-[160px] | **snapshot.sub_category FIRST** | 🔴 **Wrong priority** |
| 4 | Brand | w-[128px] | snapshot.brand | ✅ Correct |
| 5 | SKU / Type | min-w-[200px] | snapshot.name OR specs.product_type | ⚠️ Misleading label |
| 6 | Location | w-[128px] | entry.location | ✅ Correct |
| 7 | Actions | w-[64px] | - | ✅ Correct |

---

## 3. SPEC EDITOR MODAL vs SCHEDULE TABLE

### Spec Editor Fields (ScheduleSpecEditorModal.tsx)

| Form Field | Saved To | UI Column Shows |
|-----------|----------|----------------|
| Material Name | `snapshot.name` | ✅ Column 5 |
| Brand | `snapshot.brand` | ✅ Column 4 |
| Initials Type | `snapshot.initials_type` | ❌ **NOT SHOWN in table** |
| Product Type | `snapshot.specs.product_type` | ✅ Fallback in Column 5 |
| Motif / Pattern | `snapshot.specs.motif_or_color` | ⚠️ Part of derived display |
| Color | `snapshot.specs.color` | ⚠️ Part of derived display |
| Finishing | `snapshot.specs.finishing` | ⚠️ Part of derived display |
| Dimensions | `snapshot.specs.dimensions` | ❌ NOT SHOWN |

### Gap: Missing Columns
The main schedule table does NOT display:
1. **Initials Type** - editable in spec modal, not visible in table
2. **Dimensions** - editable in spec modal, not visible in table

---

## 4. LIBRARY FORM vs SCHEDULE PICKER COMPARISON

### Library Form (LibraryFormModal.tsx:558-564)

| Field Label | Variable | Maps To |
|-------------|----------|---------|
| Type / SKU * | `product_type` | MaterialCatalog.product_type |
| Category | `category` | MaterialCatalog.category |
| Sub Category | `sub_category` | MaterialCatalog.sub_category |

### Schedule Picker (ScheduleMaterialPickerModal.tsx)

| Action | Creates |
|--------|---------|
| Select from Catalog | Links to existing MaterialCatalog |
| "Create New" (omnibox) | Creates NEW MaterialCatalog in Library (PENDING) |

**⚠️ INCONSISTENCY:** When creating via Schedule Picker:
- User types "Material Name" → saved as `product_type`
- User types "Brand" → saved as `vendor.brand_name` (auto-creates vendor if needed)
- **Category is INHERITED from current context, NOT prompted**

---

## 5. GAPS SUMMARY TABLE

| # | Gap Description | Severity | Location |
|---|-----------------|----------|----------|
| 1 | "Category" column reads `sub_category` first | 🔴 CRITICAL | ScheduleEntryRow.tsx:157 |
| 2 | "SKU / Type" label is misleading (no SKU field) | 🟡 MEDIUM | ProjectScheduleMain.tsx:297 |
| 3 | Initials Type editable but not visible in table | 🟡 MEDIUM | Missing column |
| 4 | Dimensions editable but not visible in table | 🟡 MEDIUM | Missing column |
| 5 | Category not prompted during "new material" creation | 🟡 MEDIUM | ScheduleMaterialPickerModal.tsx |
| 6 | Library "Product Info" vs Schedule "SKU/Type" inconsistency | 🟡 MEDIUM | Cross-module |

---

## 6. RECOMMENDED CORRECTIONS

### Priority 1: Fix Category Priority
```typescript
// CURRENT (WRONG):
const materialType = snapshot?.sub_category || snapshot?.category || entry.category;

// SHOULD BE:
const materialType = snapshot?.category || snapshot?.sub_category || entry.category;
```

### Priority 2: Clarify "SKU / Type" Label
- Option A: Rename to "Material Name / Product Type"
- Option B: Rename to "Item Description"
- Current: Misleading - implies SKU exists

### Priority 3: Add Missing Columns
- Consider adding "Initials Type" or "Variant" column
- Consider adding "Dimensions" column or tooltip

---

## 7. FILE REFERENCE MAP

| File | Lines | Purpose |
|------|-------|---------|
| `prisma/schema.prisma` | 192-224 | MaterialCatalog model (SSOT) |
| `src/extensions/schedule/types.ts` | 4-33 | ScheduleOptionSnapshot type |
| `src/extensions/schedule/components/ScheduleEntryRow.tsx` | 157, 320, 325, 339 | Table rendering logic |
| `src/extensions/schedule/components/ProjectScheduleMain.tsx` | 293-299 | Table header definitions |
| `src/extensions/schedule/components/ScheduleSpecEditorModal.tsx` | 47-93, 138-246 | Edit modal form |
| `src/extensions/library/components/MaterialTable.tsx` | 69-75, 105-123 | Library table (SSOT display) |
| `src/extensions/library/components/LibraryFormModal.tsx` | 558-566 | Library create form |

---

## 8. SSOT VERIFICATION

| Concept | SSOT Definition | Schedule Display |
|---------|-----------------|------------------|
| Material Name | `MaterialCatalog.product_type` | `snapshot.name` or `snapshot.specs.product_type` |
| Category | `MaterialCatalog.category` | Displayed as fallback (secondary!) |
| Sub Category | `MaterialCatalog.sub_category` | Displayed as primary (wrong!) |
| Brand | `Vendor.brand_name` | `snapshot.brand` ✅ |
| Variant | `motif_or_color` + `finishing` | Derived in initialsType |

---

*End of Audit Report*
*Generated: April 16, 2026*