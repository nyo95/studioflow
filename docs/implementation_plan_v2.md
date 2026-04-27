# Implementation Plan v2 — Sample Request Visibility
**Dokumen ini dibuat oleh Main Lead. DILARANG interpretasi bebas. Ikuti instruksi tepat kata per kata.**

---

## Status Pekerjaan Sebelumnya (Sudah Selesai — JANGAN Diulang)

Pekerjaan yang sudah diselesaikan oleh Main Lead dan TIDAK perlu disentuh lagi:

| File | Perubahan Yang Sudah Ada |
| :--- | :--- |
| `src/components/nav-outer.tsx` | Rail sidebar sudah fixed: `top-16 bottom-9 w-[78px]` |
| `src/app/(dashboard)/layout.tsx` | Footer sudah: `px-6 py-2.5 lg:pl-[78px] lg:pr-6` |
| `src/components/top-header.tsx` | Header sudah: `lg:pl-[78px] lg:pr-6` |
| `src/ui_engine/layout/shells/project-layout-shell.tsx` | Inner sidebar sudah hardcode `width: "256px"` |
| `src/extensions/schedule/components/ScheduleSearchBar.tsx` | Format hasil pencarian sudah `[SKU] — [Nama]` |
| `src/extensions/schedule/components/GradualInputForm.tsx` | Step Review sudah `[SKU] — [Nama]` |
| `src/extensions/schedule/components/table/VisualRow.tsx` | `DialogTitle` dan `DialogDescription` sudah ditambahkan untuk aksesibilitas |

---

## Tugas Yang Harus Dikerjakan

### TASK 1 — Refaktorisasi `ScheduleRow.tsx` (Table View)

**File:** `src/extensions/schedule/components/table/ScheduleRow.tsx`
**Lokasi persis:** Baris 353–420 (seksi `{/* Actions */}`)

**Masalah saat ini:** Badge status muncul di BAWAH tombol (layout vertikal `flex-col`) dengan font `text-[8px]` yang terlalu kecil dan tidak mudah dibaca.

**Yang harus dilakukan:**

1. **Ganti layout dari `flex-col` menjadi `flex-row items-center gap-2`**.
2. **Ganti `text-[8px]`** pada `<span>` status menjadi **`text-[10px]`**.
3. **Jangan ubah logika** `latestRequest`, `hasActiveRequest`, warna, atau teks status — sudah benar. Hanya perbaiki layout-nya saja.

**Target sebelum:**
```tsx
<div className="flex flex-col items-center gap-1">
  <button ... >
    <Package ... />
  </button>
  {latestRequest && (
    <span className={cn(
      "text-[8px] font-black uppercase ...",   // <-- TERLALU KECIL
      ...
    )}>
      ...
    </span>
  )}
</div>
```

**Target sesudah:**
```tsx
<div className="flex flex-row items-center gap-2">
  <button ... >
    <Package ... />
  </button>
  {latestRequest && (
    <span className={cn(
      "text-[10px] font-black uppercase ...",  // <-- DIPERBESAR
      ...
    )}>
      ...
    </span>
  )}
</div>
```

> **CATATAN:** Jangan mengubah baris lain di dalam file ini. Hanya dua perubahan: `flex-col` → `flex-row`, `text-[8px]` → `text-[10px]`.

---

### TASK 2 — Tambahkan Status Indicator ke `VisualRow.tsx` (Visual/Board View)

**File:** `src/extensions/schedule/components/table/VisualRow.tsx`
**Lokasi persis:** Baris 358–375 (seksi `{/* Actions Menu */}` → bagian Sample Request)

**Masalah saat ini:** Tombol Package di Visual View **tidak memiliki status awareness sama sekali** — tampilannya selalu sama, tidak peduli apakah sample sudah diminta atau diterima.

**Kode yang ada saat ini (baris 361–375):**
```tsx
{activeOption?.product_catalog_id && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      setSampleModalOpen(true);
    }}
    title="Request sample"
    className={cn(
      "h-8 w-8 flex items-center justify-center transition-all bg-slate-50 text-slate-900 hover:bg-slate-100 shadow-sm",
      UI_ENGINE_RADIUS_CONTROL
    )}
  >
    <Package size={14} strokeWidth={2.5} />
  </button>
)}
```

**Yang harus dilakukan — ganti seluruh block di atas dengan kode berikut:**

```tsx
{activeOption?.product_catalog_id && (() => {
  const latestRequest = activeOption?.product_catalog?.product_requests?.[0];
  const hasActiveRequest = latestRequest && latestRequest.status !== "CANCELLED";

  return (
    <div className="flex flex-row items-center gap-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSampleModalOpen(true);
        }}
        title="Request sample"
        className={cn(
          "h-8 w-8 flex items-center justify-center transition-all shadow-sm",
          UI_ENGINE_RADIUS_CONTROL,
          hasActiveRequest
            ? latestRequest.status === "RECEIVED"
              ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              : "bg-amber-50 text-amber-600 hover:bg-amber-100"
            : "bg-slate-50 text-slate-900 hover:bg-slate-100"
        )}
      >
        <Package size={14} strokeWidth={2.5} />
      </button>
      {latestRequest && (
        <span className={cn(
          "text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 whitespace-nowrap",
          UI_ENGINE_RADIUS_CONTROL,
          latestRequest.status === "RECEIVED"
            ? "bg-emerald-50 text-emerald-600"
            : latestRequest.status === "CANCELLED" || latestRequest.status === "UNAVAILABLE"
            ? "bg-rose-50 text-rose-500"
            : "bg-amber-50 text-amber-600"
        )}>
          {latestRequest.status === "RECEIVED" ? "✓ Diterima"
           : latestRequest.status === "ORDERED" ? "Dipesan"
           : latestRequest.status === "SHIPPED" ? "Dikirim"
           : latestRequest.status === "UNAVAILABLE" ? "N/A"
           : "Diminta"}
        </span>
      )}
    </div>
  );
})()}
```

> **CATATAN:** Import yang dibutuhkan sudah ada (`Package`, `cn`, `UI_ENGINE_RADIUS_CONTROL`). Tidak perlu menambah import baru.

---

## Spesifikasi Visual (Token Referensi — Strict, Jangan Ubah)

| Kondisi | Background Tombol | Warna Icon | Warna Label | Label Text |
| :--- | :--- | :--- | :--- | :--- |
| Tidak ada request | `bg-slate-50` | `text-slate-900` | (tidak ada) | — |
| Request aktif (ORDERED/SHIPPED/PENDING) | `bg-amber-50` | `text-amber-600` | `text-amber-600` | `"Diminta"` / `"Dipesan"` / `"Dikirim"` |
| Sample diterima (RECEIVED) | `bg-emerald-50` | `text-emerald-600` | `text-emerald-600` | `"✓ Diterima"` |
| Cancelled / Unavailable | `bg-slate-50` (tombol tidak aktif) | (default) | `text-rose-500` | `"N/A"` |

---

## Verifikasi Wajib Setelah Eksekusi

Jalankan perintah ini terlebih dahulu:
```bash
npx tsc --noEmit
```
Pastikan **exit code 0** (tidak ada error TypeScript).

Kemudian verifikasi secara visual:

1. **Test Case 1 (No Request):** Buka Project Schedule → lihat item yang punya `product_catalog_id` tapi belum pernah di-request → Tombol Package harus **abu-abu standar** (`bg-slate-50`), tidak ada label.
2. **Test Case 2 (Requested):** Klik tombol Package pada item yang sudah di-request → Modal terbuka. Setelah menutup modal, **refresh halaman** → Tombol harus **amber** dan ada label (misal "Diminta").
3. **Test Case 3 (Received):** Admin ubah status request ke RECEIVED di Library → Buka kembali Project Schedule → Tombol harus **emerald** dan label "✓ Diterima".
4. **Consistency Check:** Pastikan **Table View** dan **Visual View (Board)** menunjukkan status yang identik untuk item yang sama.

---

## Catatan Keras (Anti-Halusinasi)

- **DILARANG** membuat komponen baru.
- **DILARANG** menambahkan import icon baru dari `lucide-react`. Gunakan `Package` yang sudah ada.
- **DILARANG** mengubah logika data atau action (submit request, delete, dll).
- **DILARANG** mengubah warna atau nilai token dari tabel di atas.
- Jika menemukan kode yang **tidak sesuai** dengan lokasi baris yang disebutkan, **BERHENTI dan hubungi Main Lead**. Jangan menebak-nebak.
