# StudioFlow — Junior Developer Implementation Plan
> **Versi:** 3.0 — Anti-Hallucination Edition  
> **Dibuat oleh:** Antigravity (AI Lead)  
> **Tanggal:** 2026-04-28  
> **Status Dasar:** Semua referensi file dan baris telah diverifikasi terhadap kode aktif.

---

## ⚠️ Aturan Wajib Sebelum Mulai

1. **Baca dulu setiap file target** sebelum melakukan perubahan. Jangan pernah menebak isi file.
2. **Jangan ubah apa pun selain yang tercantum** di bawah. Architectural drift adalah pelanggaran serius.
3. **Jalankan `npx tsc --noEmit`** setelah setiap task selesai. Tidak ada task yang dianggap selesai jika ada type error baru.
4. **Catat setiap perubahan di `CHANGELOG.md`** bagian `## [UNRELEASED]` dengan format: `- [BACKEND/UI/DOCS] Deskripsi singkat`.
5. **Jangan pernah** menggunakan nilai hardcoded untuk styling (radius, padding, warna). Selalu gunakan token dari `src/ui_engine/`.
6. **Jangan** menggunakan `window.location.reload()`. Gunakan `router.refresh()` dari `next/navigation`.

---

## Ringkasan Status Gap (Terverifikasi)

| # | Gap | File Terdampak | Status |
|---|-----|----------------|--------|
| T1 | Dead code: `fetchVendors` tidak digunakan di ScheduleProductPickerModal | `ScheduleProductPickerModal.tsx` | 🔴 Open |
| T2 | Dup check manual di `checkDuplicateProduct` — baris 234 menggunakan `as any` | `schedule-service.ts` L234 | 🔴 Open |
| T3 | `reviewPromotionRequest` tidak meng-update `reviewed_by_id` / `reviewed_at` saat APPROVED | `library-service.ts` L1077-1083 | 🔴 Open |
| T4 | `ScheduleProductPickerModal` — mode "manual" mengisi `catalog_sku` dan `catalog_product_name` dengan nilai yang sama | `ScheduleProductPickerModal.tsx` L175-176 | 🟡 Minor |
| T5 | Update `MASTER_SSOT.md` dan `CHANGELOG.md` | `MASTER_SSOT.md`, `CHANGELOG.md` | 🔴 Open |

---

## Task T1 — Hapus Dead Code `fetchVendors` di ScheduleProductPickerModal

**File:** `src/extensions/schedule/components/ScheduleProductPickerModal.tsx`

### Latar Belakang
Fungsi `fetchVendors` dan state `vendors` di-fetch tapi tidak pernah digunakan oleh UI. Ini membuang satu API call ekstra setiap kali modal dibuka.

### Yang Perlu Dihapus
Buka file, lalu:
1. **Hapus baris 92** — state `vendors`:
   ```ts
   // HAPUS INI:
   const [vendors, setVendors] = React.useState<LibraryVendor[]>([]);
   ```

2. **Hapus baris 102–109** — seluruh fungsi `fetchVendors`:
   ```ts
   // HAPUS INI (seluruh blok):
   const fetchVendors = React.useCallback(async () => {
     try {
       const res = unwrapActionResult<LibraryVendor[]>(await LibraryFacade.getVendors(undefined));
       setVendors(res);
     } catch (e) {
       console.error("Failed to fetch vendors", e);
     }
   }, []);
   ```

3. **Hapus baris 129** — panggilan `fetchVendors()` di dalam `useEffect`:
   ```ts
   // SEBELUM:
   if (isOpen) {
     fetchVendors();
     fetchProducts();
   }

   // SESUDAH:
   if (isOpen) {
     fetchProducts();
   }
   ```

4. **Hapus import** `LibraryVendor` dari baris 44–45 jika tidak digunakan di tempat lain dalam file tersebut.  
   Setelah hapus, cek: apakah `LibraryVendor` masih direferensikan? Jika tidak, hapus dari import.

### Verifikasi
- `npx tsc --noEmit` tidak ada error baru.
- Buka modal di browser → tidak ada panggilan API ke `/api/...vendors` di Network tab.

---

## Task T2 — Hapus `as any` di `checkDuplicateProduct`

**File:** `src/extensions/schedule/services/schedule-service.ts`  
**Baris target:** sekitar L221–246 (fungsi `checkDuplicateProduct`, blok `mode === "manual"`)

### Latar Belakang
Baris 234 menggunakan `const s = opt.data_snapshot as any;` yang melewati type safety. Harus diganti dengan tipe yang tepat menggunakan `ScheduleSnapshot`.

### Yang Perlu Diubah

**SEBELUM** (L228–244):
```ts
const existingOptions = await tx.projectScheduleOption.findMany({
  where: { entry: { project_id: projectId } },
  select: { data_snapshot: true }
});

const isDuplicate = existingOptions.some(opt => {
  const s = opt.data_snapshot as any;
  if (!s) return false;
  const optSku = s.specs?.catalog_sku || s.catalog_sku;
  const optBrand = s.catalog_brand;
  return optSku?.toLowerCase() === sku.toLowerCase() &&
         optBrand?.toLowerCase() === brand.toLowerCase();
});
```

**SESUDAH:**
```ts
const existingOptions = await tx.projectScheduleOption.findMany({
  where: { entry: { project_id: projectId } },
  select: { data_snapshot: true }
});

const isDuplicate = existingOptions.some(opt => {
  // Safe cast: data_snapshot structure is guaranteed by ScheduleSnapshotSchema at write time
  const s = opt.data_snapshot as ScheduleSnapshot | null;
  if (!s) return false;
  const optSku = s.specs?.catalog_sku;
  const optBrand = s.catalog_brand;
  return typeof optSku === "string" && typeof optBrand === "string" &&
         optSku.trim().toLowerCase() === sku.toLowerCase() &&
         optBrand.trim().toLowerCase() === brand.toLowerCase();
});
```

### Catatan Penting
- `ScheduleSnapshot` sudah di-import di baris 9 file ini. Tidak perlu import baru.
- Perubahan ini menghilangkan fallback `s.catalog_sku` (tanpa `specs`). Ini **benar** karena semua snapshot ditulis melalui `ScheduleSnapshotSchema.parse()` yang menjamin struktur dengan `specs.catalog_sku`.

### Verifikasi
- `npx tsc --noEmit` tidak ada error baru.
- Tidak ada `as any` yang tersisa di fungsi `checkDuplicateProduct`.

---

## Task T3 — Fix: `reviewed_by_id` dan `reviewed_at` Tidak Di-set Saat APPROVED

**File:** `src/extensions/library/services/library-service.ts`  
**Baris target:** sekitar L1077–1083 (blok `status === "APPROVED"` di `reviewPromotionRequest`)

### Latar Belakang
Ketika status di-set ke `APPROVED`, field `reviewed_by_id` dan `reviewed_at` tidak di-update. Ini membuat audit trail tidak lengkap.  
Untuk perbandingan: blok `REJECTED` (L1085–1092) **sudah benar** meng-update kedua field tersebut.

### Yang Perlu Diubah

**SEBELUM** (L1077–1083):
```ts
// Update Promotion Request with link
await tx.promotionRequest.update({
  where: { id: requestId },
  data: {
    status: "APPROVED",
    notes: notes ? this.normalizeOptional(notes) : undefined,
  }
});
```

**SESUDAH:**
```ts
// Update Promotion Request with link (mirror pattern from REJECTED block)
await tx.promotionRequest.update({
  where: { id: requestId },
  data: {
    status: "APPROVED",
    reviewed_by_id: userId,
    reviewed_at: new Date(),
    notes: notes ? this.normalizeOptional(notes) : undefined,
  }
});
```

### Verifikasi
- `npx tsc --noEmit` tidak ada error.
- Buat promotion request sebagai ADMIN → review → cek database: kolom `reviewed_by_id` dan `reviewed_at` terisi.

---

## Task T4 — (Minor) Pisahkan SKU dan Product Name di Manual Entry ScheduleProductPickerModal

**File:** `src/extensions/schedule/components/ScheduleProductPickerModal.tsx`  
**Baris target:** sekitar L174–176 (blok `createCatalogName`, di dalam `handleSubmit`)

### Latar Belakang
Saat mode manual melalui `handleSubmit` (bukan `GradualInputForm`), `catalog_sku` dan `catalog_product_name` diisi dengan nilai yang sama (`createCatalogName`). Secara bisnis, SKU dan nama produk adalah dua hal yang berbeda.

> **Catatan:** Jalur utama (melalui `GradualInputForm` di `onConfirm`) sudah benar karena menggunakan `data.customData.catalog_sku` dan `data.customData.catalog_product_name` secara terpisah. Task ini hanya untuk membersihkan jalur fallback `handleSubmit`.

### Yang Perlu Diubah

**SEBELUM** (L173–180):
```ts
payload = {
  ...
  mode: "manual",
  catalogCreateData: {
    catalog_sku: createCatalogName,       // ← sama dengan product_name
    catalog_product_name: createCatalogName,
    catalog_brand: createBrand.trim() || "Custom",
    catalog_reference_url: createReferenceUrl.trim() || null,
  },
};
```

**SESUDAH:**
```ts
payload = {
  ...
  mode: "manual",
  catalogCreateData: {
    catalog_sku: "",                      // SKU kosong untuk manual entry tanpa SKU
    catalog_product_name: createCatalogName,
    catalog_brand: createBrand.trim() || "Custom",
    catalog_reference_url: createReferenceUrl.trim() || null,
  },
};
```

> **Kenapa SKU kosong?** Karena `addScheduleEntryAction` dan service-nya menggunakan fallback `snapshot.specs?.catalog_sku || "Generic"` saat SKU tidak diisi. Ini sudah sesuai dengan policy: manual entries boleh tidak punya SKU.

### Verifikasi
- Test: Buat manual entry via modal → cek `data_snapshot.specs.catalog_sku` di database. Harus kosong atau `"Generic"`, bukan sama dengan nama produk.

---

## Task T5 — Update Dokumentasi

### 5A — `MASTER_SSOT.md`

Buka `MASTER_SSOT.md`. Cari section yang membahas **Library Search** atau **Schedule Extension**. Tambahkan atau update poin-poin berikut:

```markdown
### Schedule — Library Search Rules
- Semua komponen yang query ke library untuk keperluan schedule insertion WAJIB mengirimkan `status: "APPROVED"` sebagai filter.
  - Komponen terdampak: `ScheduleSearchBar.tsx`, `ScheduleProductPickerModal.tsx` (via `GradualInputForm`).
- Duplicate protection aktif di level service (`checkDuplicateProduct`):
  - Mode `catalog`: cek `project_id + product_catalog_id`.
  - Mode `manual`: cek composite `catalog_sku + catalog_brand` (case-insensitive).
  - Mode `reserve`: tidak dicek (slot kosong diperbolehkan).
- `create_catalog` mode telah dihapus. Mode yang valid: `"catalog"`, `"manual"`, `"reserve"`.
```

### 5B — `CHANGELOG.md`

Tambahkan di bagian `## [UNRELEASED]` (atau buat section baru dengan tanggal hari ini):

```markdown
## [UNRELEASED] — 2026-04-28

### Backend Changes
- [schedule-service.ts] Implementasi `checkDuplicateProduct`: guard duplikat produk di level project, berlaku untuk mode catalog (by product_catalog_id) dan manual (by SKU+Brand composite, case-insensitive).
- [library-service.ts] Fix `reviewPromotionRequest`: field `reviewed_by_id` dan `reviewed_at` kini di-update saat status APPROVED, menyamakan behavior dengan blok REJECTED.
- [library-actions.ts] Admin auto-approve: promotion request yang dibuat oleh ADMIN langsung di-approve dalam satu transaksi.
- [schedule-actions.ts] Validasi `catalog_status === "APPROVED"` ditegakkan di `addScheduleEntryWithProductAction` dan `addScheduleOptionAction`.

### UI Changes
- [ScheduleSearchBar.tsx] Filter `status: "APPROVED"` diterapkan pada semua panggilan `LibraryFacade.searchProducts`.
- [ScheduleProductPickerModal.tsx] Hapus dead code `fetchVendors` dan state `vendors` yang tidak digunakan.
- [ScheduleProductPickerModal.tsx] Pisahkan `catalog_sku` dan `catalog_product_name` pada manual entry payload.
```

---

## Urutan Eksekusi yang Direkomendasikan

```
T1 → T2 → T3 → T4 → T5
```

Setiap task berdiri sendiri dan tidak saling bergantung. Namun urutan ini disarankan untuk memulai dari yang paling "aman" (dead code removal) ke yang paling sensitif (service logic).

---

## Checklist Final

Sebelum membuat Pull Request / commit final:

- [ ] `npx tsc --noEmit` → **0 errors**
- [ ] T1: Tidak ada `fetchVendors` atau state `vendors` di `ScheduleProductPickerModal.tsx`
- [ ] T2: Tidak ada `as any` di `checkDuplicateProduct`
- [ ] T3: `reviewed_by_id` dan `reviewed_at` ter-set saat `APPROVED`
- [ ] T4: `catalog_sku` tidak sama dengan `catalog_product_name` pada manual entry
- [ ] T5: `MASTER_SSOT.md` dan `CHANGELOG.md` ter-update
- [ ] Tidak ada perubahan layout atau styling yang tidak diminta

---

*Dokumen ini hanya mencakup gap yang terverifikasi dari kode aktif. Jika ditemukan gap baru saat eksekusi, hubungi Lead Agent sebelum melanjutkan.*
