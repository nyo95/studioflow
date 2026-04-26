# StudioFlow — Final Implementation Plan v2.1
**Dibuat**: 2026-04-27 | **Status**: Ready for Junior Dev Execution  
**Schema Status**: ✅ `ProjectProductRequest` sudah punya `schedule_entry_id` + `schedule_option_id` — **NO MIGRATION NEEDED**

---

## ⚠️ GUARDRAIL DIRECTIVES (WAJIB BACA)

1. **DILARANG** `window.location.reload()` → gunakan callback `onRefreshAll()` atau `router.refresh()`
2. **DILARANG** hardcode CSS (`rounded-xl`, `p-5`) → wajib pakai token `UI_ENGINE_*` dari `@/ui_engine`
3. **WAJIB** baca file target dulu sebelum edit
4. **WAJIB** `npm run dev` setelah setiap task, pastikan tidak ada TypeScript error
5. **WAJIB** catat perubahan material di `CHANGELOG.md`
6. Urutan eksekusi: **BUG-03 → BUG-05 → BUG-01 → BUG-02 → BUG-07 → BUG-04 → BUG-08 → BUG-06**

---

## BATCH 1 — Critical Bugs

### BUG-01 · Library Page Tidak Auto-Refresh

**Root Cause**: `library/page.tsx` adalah Client Component dengan state lokal. `router.refresh()` di `LibraryTabs.handleSuccess` hanya me-refresh Server Component tree, tidak me-re-trigger `useEffect` yang sudah selesai.

**Files**: `src/app/(dashboard)/extensions/library/page.tsx` · `src/extensions/library/components/LibraryTabs.tsx`

#### Step 1.1 — Tambah prop `onRefreshAll` ke LibraryTabs

Di `LibraryTabs.tsx`, interface `LibraryTabsProps` (sekitar L26), tambahkan:
```typescript
onRefreshAll?: () => void;
```
Di function signature (L67), tambahkan `onRefreshAll,`

#### Step 1.2 — Ganti `handleSuccess` dan `retryTab` di LibraryTabs

```typescript
// GANTI (L108-112):
const retryTab = () => { onRefreshAll?.(); };
const handleSuccess = () => { onRefreshAll?.(); };
```

#### Step 1.3 — Buat `refreshAll` di library/page.tsx

Tambahkan setelah `fetchProducts` useCallback (sekitar L149):
```typescript
const refreshAll = React.useCallback(async () => {
  fetchProducts(); // Re-fetch products
  try {
    const [requestsRes, promoRes] = await Promise.all([
      getAllProductRequestsAction(undefined),
      getPromotionRequestsAction(undefined),
    ]);
    if (requestsRes.success) setRequests(requestsRes.data);
    if (promoRes.success) {
      setPromotionRequests(normalizePromotionRequests(
        promoRes.data as unknown as PromotionRequestSummary[]
      ));
    }
  } catch { toast.error("Failed to refresh library data"); }
}, [fetchProducts, normalizePromotionRequests]);
```

#### Step 1.4 — Pass ke LibraryTabs di library/page.tsx

Di JSX `<LibraryTabs ... />` tambahkan: `onRefreshAll={refreshAll}`

**✅ AC**: Add product → langsung muncul. Queue approve → status langsung berubah. Tidak perlu reload halaman.

---

### BUG-02 · Terminologi "Material Library" → "Product Library"

**File**: `src/app/(dashboard)/extensions/library/page.tsx` L165

```tsx
// SEBELUM:
title="Material Library"
description="Manage products, vendors, and inventory samples."

// SESUDAH:
title="Product Library"
description="Manage materials, fixtures, vendors, and inventory samples."
```

Lalu grep seluruh `src/` untuk string "Material Library" dan ganti jika ditemukan di file lain.

**✅ AC**: Header halaman menampilkan "Product Library". Tidak ada sisa teks "Material Library" di src/.

---

### BUG-03 · Security Gap — Add Alternative Cross-Category

**Root Cause**: `addScheduleOptionAction` tidak validasi bahwa `catalogItemId` cocok kategori/section dengan entry target. User bisa inject produk dari kategori lain.

**File**: `src/extensions/schedule/actions/schedule-actions.ts`

#### Step 3.1 — Tambah validasi di `addScheduleOptionAction` (L192)

Setelah fetch `entry` (L194-197), tambahkan SEBELUM memanggil `ScheduleService.addOptionToEntry`:

```typescript
// Tambahkan blok ini:
if (input.mode === "catalog" && input.catalogItemId) {
  const catalogItem = await tx.productCatalog.findUnique({
    where: { id: input.catalogItemId },
    select: { catalog_category: true, catalog_type: true },
  });
  if (!catalogItem) {
    throw new ActionError("Product not found in catalog", "NOT_FOUND");
  }
  if (catalogItem.catalog_type !== entry.section) {
    throw new ActionError(
      `Type mismatch: entry is "${entry.section}" but product is "${catalogItem.catalog_type}"`,
      "VALIDATION_FAILED"
    );
  }
  const entryCategory = entry.schedule_category.trim().toUpperCase();
  const itemCategory = catalogItem.catalog_category.trim().toUpperCase();
  if (entryCategory !== itemCategory) {
    throw new ActionError(
      `Category mismatch: entry is "${entry.schedule_category}" but product is in "${catalogItem.catalog_category}"`,
      "VALIDATION_FAILED"
    );
  }
}
```

> **Catatan**: Field di schema adalah `catalog_type` (bukan `product_type`). Pastikan di-select dengan nama yang benar.

**✅ AC**: Add alternative dengan produk beda kategori → error toast. Produk kategori sama → berhasil.

---

### BUG-05 · `swapEntries` Missing Validation + normalizeCodes

**File**: `src/extensions/schedule/services/schedule-service.ts` (sekitar L1142)

Temukan method `swapEntries`. Tambahkan validasi di awal method, setelah fetch kedua entry:

```typescript
// Tambahkan setelah const [entryA, entryB] = ...
if (entryA.project_id !== projectId || entryB.project_id !== projectId) {
  throw new Error("Entries do not belong to the specified project");
}
if (entryA.schedule_category !== entryB.schedule_category) {
  throw new Error("Cannot swap entries from different categories");
}
if (entryA.section !== entryB.section) {
  throw new Error("Cannot swap entries from different sections");
}
```

Tambahkan di AKHIR method (sebelum `return`):
```typescript
await this.normalizeCodes(tx, projectId, entryA.section, entryA.schedule_category);
```

**✅ AC**: Swap cross-category/cross-project → error. Swap valid → codes ter-normalisasi.

---

## BATCH 2 — Feature & UX

### BUG-04 · Sample Request Button — Visibility Fix

**Root Cause**: Tombol Package di `ScheduleRow.tsx` tersembunyi di dalam `opacity-0 group-hover:opacity-100` — tidak terlihat oleh user.

**File**: `src/extensions/schedule/components/table/ScheduleRow.tsx` (L360-388)

Pindahkan tombol sample request KELUAR dari div hover group:

```tsx
{/* Actions */}
<td className="px-5 py-2 text-right">
  <div className="flex items-center justify-end gap-1">

    {/* ✅ Sample button: SELALU VISIBLE */}
    <button
      onClick={(e) => { e.stopPropagation(); setSampleModalOpen(true); }}
      title="Request sample"
      className={cn(
        "p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors",
        UI_ENGINE_RADIUS_CONTROL
      )}
    >
      <Package size={13} />
    </button>

    {/* Edit & Delete: hover-only */}
    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
      <button onClick={() => onEdit?.(entry)} title="Edit specification"
        className={cn("p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors", UI_ENGINE_RADIUS_CONTROL)}>
        <Edit3 size={13} />
      </button>
      <button onClick={handleDelete} title="Delete"
        className={cn("p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors", UI_ENGINE_RADIUS_CONTROL)}>
        <Trash2 size={13} />
      </button>
    </div>
  </div>
</td>
```

Lakukan hal yang sama di `src/extensions/schedule/components/table/VisualRow.tsx` (L405 area).

**✅ AC**: Tombol Package terlihat di setiap row tanpa hover. Klik → modal terbuka. Submit → request masuk ke Library → Requests tab.

---

### BUG-07 · `reviewPromotionRequest` Return Type Mismatch

**File**: `src/extensions/library/services/library-service.ts` (sekitar L1200-1260)

Temukan blok di `reviewPromotionRequest` yang melakukan `if (existingDup) { return existingDup; }`.

**Ganti logika ini**:
```typescript
// SEBELUM (SALAH):
if (existingDup) {
  return existingDup; // Wrong: returns ProductCatalog
}
const newCatalog = await tx.productCatalog.create({ ... });

// SESUDAH (BENAR):
const catalogToLink = existingDup ?? await tx.productCatalog.create({ ... });
// Lanjutkan update promotionRequest:
return tx.promotionRequest.update({
  where: { id },
  data: {
    status: "APPROVED",
    // ... link ke catalogToLink.id
  }
});
```

**✅ AC**: Promote produk dengan SKU duplikat → tidak error, request menjadi APPROVED. Return type selalu PromotionRequest.

---

### BUG-08 · Color Selector sebagai Alternatif Upload Image

**Business Logic Analysis**: ✅ VALID  
Strategi `color:#RRGGBB` URI prefix adalah pendekatan yang tepat karena:
- Zero schema change (field `catalog_image_url` tetap `String?`)
- Zod schema di `schedule-snapshot.ts` mengexpect string untuk URL → kompatibel
- Snapshot-First architecture tidak terpengaruh — color string tersimpan di `data_snapshot` seperti URL biasa

**Files**:
1. `src/components/ui/visual-asset.tsx` ← **BUAT BARU**
2. `src/components/ui/optimized-uploader.tsx` ← **EDIT**
3. `src/extensions/schedule/components/table/ScheduleRow.tsx` ← **EDIT** (thumbnail)
4. `src/extensions/schedule/components/table/VisualRow.tsx` ← **EDIT** (thumbnail)
5. `src/extensions/schedule/components/ScheduleSpecEditorModal.tsx` ← **EDIT** (hero)

#### Step 8.1 — Buat `src/components/ui/visual-asset.tsx`

```tsx
"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

interface VisualAssetProps {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}

/**
 * VisualAsset — Renders either a real <img> or a solid color block.
 * If src starts with "color:", strips prefix and renders a colored div.
 * Otherwise renders a standard <img>.
 */
export function VisualAsset({ src, alt, className, fallbackClassName }: VisualAssetProps) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-slate-50 text-slate-200", fallbackClassName, className)}>
        <Package className="h-5 w-5" />
      </div>
    );
  }

  if (src.startsWith("color:")) {
    const hex = src.replace("color:", "").trim();
    return (
      <div
        className={cn("w-full h-full", className)}
        style={{ backgroundColor: hex }}
        title={alt || hex}
        aria-label={alt || `Color: ${hex}`}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt || ""}
      className={cn("w-full h-full object-cover", className)}
    />
  );
}

/** Utility: check if a value is a color: URI */
export function isColorUri(value?: string | null): boolean {
  return !!value?.startsWith("color:");
}

/** Utility: extract hex from color: URI */
export function extractColorHex(value: string): string {
  return value.replace("color:", "").trim();
}
```

#### Step 8.2 — Edit `OptimizedUploader` untuk tambah Color Picker mode

Di `src/components/ui/optimized-uploader.tsx`, tambahkan state dan UI untuk toggle antara "Upload" dan "Color":

**Tambahkan state** setelah state yang ada (sekitar L29):
```typescript
const [mode, setMode] = React.useState<"upload" | "color">("upload");
const [colorHex, setColorHex] = React.useState("#64748b");
```

**Tambahkan prop baru** ke interface `OptimizedUploaderProps`:
```typescript
onColorSelect?: (colorUri: string) => void;
```

**Preset colors** (array konstanta, letakkan di atas component):
```typescript
const PRESET_COLORS = [
  "#1e293b", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#f8fafc",
  "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0284c7", "#7c3aed",
  "#be185d", "#0f766e", "#a16207", "#854d0e",
];
```

**Tambahkan di area JSX** — saat `!value`, tampilkan toggle mode dan color picker:

Setelah `<label>` upload (sekitar L128), tambahkan section mode toggle dan color picker di bawah empty state. Structurnya:
```tsx
{/* Mode Toggle */}
<div className="absolute top-3 right-3 flex gap-1 z-10">
  <button
    type="button"
    onClick={(e) => { e.preventDefault(); setMode("upload"); }}
    className={cn("px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-colors", UI_ENGINE_RADIUS_CONTROL,
      mode === "upload" ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:text-slate-900"
    )}
  >
    Image
  </button>
  <button
    type="button"
    onClick={(e) => { e.preventDefault(); setMode("color"); }}
    className={cn("px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-colors", UI_ENGINE_RADIUS_CONTROL,
      mode === "color" ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:text-slate-900"
    )}
  >
    Color
  </button>
</div>

{mode === "color" && (
  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-4 bg-white">
    {/* Color preview */}
    <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg" style={{ backgroundColor: colorHex }} />
    {/* Preset grid */}
    <div className="grid grid-cols-8 gap-1.5">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setColorHex(c)}
          className={cn("h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
            colorHex === c ? "border-slate-900 scale-110" : "border-transparent"
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
    {/* Hex input */}
    <input
      type="text"
      value={colorHex}
      onChange={(e) => setColorHex(e.target.value)}
      className={cn("w-32 h-9 text-center text-xs font-mono font-bold border border-slate-200 bg-slate-50", UI_ENGINE_RADIUS_CONTROL)}
      placeholder="#000000"
    />
    {/* Apply button */}
    <button
      type="button"
      onClick={() => onColorSelect?.(`color:${colorHex}`)}
      className={cn("h-10 px-6 bg-slate-950 text-white font-black text-[10px] uppercase tracking-widest", UI_ENGINE_RADIUS_CONTROL)}
    >
      Apply Color
    </button>
  </div>
)}
```

Jika `value` adalah `color:` URI, render colored div (bukan `<img>`):
```tsx
// Ganti blok value rendering (L106-126):
{value ? (
  <>
    {value.startsWith("color:") ? (
      <div className="w-full h-full" style={{ backgroundColor: value.replace("color:", "") }} />
    ) : (
      <img src={value} alt="Preview" className="w-full h-full object-cover ..." />
    )}
    {/* Glassmorphism overlay tetap sama */}
  </>
) : ( ... )}
```

#### Step 8.3 — Gunakan `VisualAsset` di ScheduleRow thumbnail

Di `ScheduleRow.tsx`, ganti `<img>` di thumbnail (L208-213):
```tsx
// SEBELUM:
<img src={snapshot.catalog_image_url} alt={...} className="w-full h-full object-cover ..." />

// SESUDAH:
import { VisualAsset } from "@/components/ui/visual-asset";
<VisualAsset src={snapshot?.catalog_image_url} alt={snapshot?.catalog_product_name || ""} className="transition-transform duration-300 group-hover/img:scale-110" />
```

Lakukan hal sama di `VisualRow.tsx` untuk thumbnail-nya.

#### Step 8.4 — Gunakan `VisualAsset` di ScheduleSpecEditorModal hero image (view mode)

Di `ScheduleSpecEditorModal.tsx`, di blok view mode hero image (sekitar L246-269), ganti `<img>`:
```tsx
import { VisualAsset } from "@/components/ui/visual-asset";

// Ganti <img src={form.catalog_image_url} ...> dengan:
<VisualAsset
  src={form.catalog_image_url}
  alt={form.catalog_product_name}
  className="w-full h-full transition-transform duration-1000 group-hover:scale-110"
/>
```

#### Step 8.5 — Wire `onColorSelect` di ScheduleSpecEditorModal edit mode

Di `ScheduleSpecEditorModal.tsx`, di `<OptimizedUploader>` (L226-238), tambahkan prop:
```tsx
<OptimizedUploader
  value={form.catalog_image_url}
  onUpload={async (file) => { ... }} // existing
  onClear={() => setForm(prev => ({ ...prev, catalog_image_url: "" }))}
  onColorSelect={(colorUri) => setForm(prev => ({ ...prev, catalog_image_url: colorUri }))}
  aspect={1}
  className="w-full h-full"
/>
```

**✅ AC**:
- [ ] Di ScheduleSpecEditorModal edit mode, ada toggle "Image" / "Color" di uploader
- [ ] Pilih color → preview berubah jadi warna solid
- [ ] Save snapshot → `catalog_image_url` tersimpan sebagai `color:#RRGGBB`
- [ ] Di ScheduleRow/VisualRow, thumbnail menampilkan warna solid (bukan broken image)
- [ ] Di view mode modal, hero area menampilkan warna solid

---

### BUG-06 · Double Audit Logging (Low Priority)

**File**: `src/extensions/schedule/actions/schedule-actions.ts`

**VERIFIKASI DULU** sebelum hapus: buka `schedule-service.ts` dan pastikan method berikut memang sudah ada `insertAuditLog` di dalamnya:
- `addOptionToEntry` → cek L625-630 (sudah ada ✅)
- `approveOption` → cek sekitar L710
- `updateOptionSnapshot` → cek sekitar L740
- `deleteEntry` → cek L763-768 (sudah ada ✅)

Jika service SUDAH memanggil audit, hapus `insertAuditLog` di action layer untuk method yang sama. Jika service BELUM ada, jangan hapus dari action.

**✅ AC**: Setiap mutasi schedule menghasilkan tepat 1 audit log entry.

---

## FINAL CHECKLIST

```
□ BUG-03 (Security Gap)         → addScheduleOptionAction validation
□ BUG-05 (Swap Validation)      → swapEntries guard + normalizeCodes
□ BUG-01 (Auto Refresh)         → refreshAll callback chain
□ BUG-02 (Terminology)          → "Material Library" → "Product Library"
□ BUG-07 (Return Type)          → reviewPromotionRequest fix
□ BUG-04 (Sample Visibility)    → Package button always visible
□ BUG-08 (Color Selector)       → VisualAsset + OptimizedUploader mode
□ BUG-06 (Double Audit)         → Remove duplicate insertAuditLog
```

**Before PR**:
- [ ] `npm run build` → 0 TypeScript errors
- [ ] `npm run dev` → test semua flow manual
- [ ] `CHANGELOG.md` updated
- [ ] Tidak ada `window.location.reload()` baru
- [ ] Tidak ada hardcoded CSS baru

---

## File Reference Map

| Bug | File Utama | Jenis Perubahan |
|-----|-----------|----------------|
| BUG-01 | `library/page.tsx`, `LibraryTabs.tsx` | Add callback prop + refreshAll fn |
| BUG-02 | `library/page.tsx` | Text change |
| BUG-03 | `schedule-actions.ts` | Add validation block |
| BUG-04 | `ScheduleRow.tsx`, `VisualRow.tsx` | Move button out of hover group |
| BUG-05 | `schedule-service.ts` | Add guard + normalizeCodes |
| BUG-06 | `schedule-actions.ts` | Remove duplicate audit calls |
| BUG-07 | `library-service.ts` | Fix early return logic |
| BUG-08 | `visual-asset.tsx` (NEW), `optimized-uploader.tsx`, `ScheduleRow.tsx`, `VisualRow.tsx`, `ScheduleSpecEditorModal.tsx` | New component + dual-mode uploader |
