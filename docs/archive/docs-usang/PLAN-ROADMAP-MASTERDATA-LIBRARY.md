# Roadmap — Master Data SSOT + Library Patches

**Menggantikan:** `PLAN-AUDIT-ROADMAP-2026Q3.md`, `PLAN-LIBRARY-BRAND-FIRST.md`, `PLAN-catalog-library-sync.md`
**Terakhir diperbarui:** 2026-08-06
**Status:** dokumen hidup — diperbarui setelah setiap milestone selesai

---

## 0. Konteks — apa yang sedang kita bangun dan kenapa

### Latar belakang

Ini adalah sistem operasional untuk sebuah perusahaan interior design. Perusahaan ini menjalankan banyak proyek secara paralel — setiap proyek punya timeline, deliverable, dan daftar material yang berbeda-beda. Ada dua jenis pengguna utama: **desainer** yang mengerjakan proyek, dan **staff operasional** yang mengelola hubungan dengan supplier dan mengurus pengadaan material.

Sebelum sistem ini ada, tiga hal dikelola secara terpisah dan manual:
1. **Timeline dan material per project** — di spreadsheet atau tools ad-hoc
2. **Database supplier dan harga** — di file Excel yang tidak selalu up-to-date
3. **BQ (Bill of Quantities)** — dihitung ulang dari awal tiap proyek, sering pakai harga yang sudah basi

Akibatnya: desainer tidak tahu apakah material yang mereka pilih sudah pernah dipakai sebelumnya. Staff tidak punya satu tempat untuk merekam harga hasil negosiasi. BQ butuh waktu lama karena harus cari harga dari berbagai sumber.

### Solusi yang sedang dibangun

Tiga lapisan yang saling terhubung:

```
StudioFlow (desainer)
  ↕ request material, lihat catalog, akses project
Master Data (staff)
  ↕ kelola supplier, catat harga, terima sample fisik
BQ (kalkulasi)
  ← membaca harga dari Master Data
  ← membaca schedule/material dari StudioFlow
```

**StudioFlow** adalah ruang kerja desainer. Di sini mereka mengelola timeline project, membuat schedule, dan paling penting: request material ke vendor. Ketika desainer menemukan material yang menarik di Library, mereka bisa langsung mengajukan request sample — bukan hanya "tandai untuk nanti", tapi masuk ke antrean kerja staff.

**Master Data** adalah otak operasional. Ini bukan sekedar database pasif — ini adalah tempat kerja staff yang aktif: merespons request desainer, menghubungi vendor, merekam harga yang didapat, menerima sample fisik ke rak kantor, dan memelihara database supplier yang akurat. Setiap harga yang didapat dari proses ini langsung masuk ke pricing table — tidak perlu diinput ulang di tempat lain.

**BQ** adalah output kalkulasi. Karena harga sudah terpusat di Master Data, BQ tinggal membaca — tidak perlu cari harga dari berbagai tempat. Ini memungkinkan BQ yang akurat dan bisa diperbarui kapanpun harga berubah.

### Alur inti yang sudah dibangun

```
Desainer (StudioFlow)                   Staff (Master Data)
─────────────────────                   ──────────────────────────────
1. Pilih brand/material dari Library
2. Buat request sample
   → ProjectProductRequest (REQUESTED)  → Muncul di Overview sebagai antrian

                                        3. Buka request, hubungi vendor
                                           Catat: tanggal, harga kutipan, catatan
                                           → Status: IN_PROGRESS
                                           → Harga kutipan otomatis masuk MaterialPrice

                                        4. Sample tiba di kantor
                                           Input: SKU, rak, box, qty
                                           → Status: RECEIVED
                                           → Sku di-upsert di katalog
                                           → Sample tercatat di perpustakaan fisik

5. Lihat status request di-update
   Tahu siapa yang handle, kapan,
   berapa harga yang didapat
```

Loop ini adalah inti dari apa yang sedang kita bangun. Sebelumnya, langkah 3 dan 4 terjadi di luar sistem — via WhatsApp, email, atau catatan terpisah. Sekarang semuanya tercatat, terlacak, dan terhubung.

### Kenapa arsitektur SSOT (Single Source of Truth) penting

Masalah klasik yang ingin dihindari: **duplikasi data yang drift**. Kalau StudioFlow punya daftar supplier sendiri dan Master Data punya daftar supplier sendiri, dalam waktu 6 bulan keduanya tidak sinkron. Desainer melihat satu nama brand, staff merekam nama yang sedikit berbeda, BQ pakai harga dari source yang berbeda lagi.

Solusinya: satu hierarki tunggal di `master_data.*`:
- **Company** (entitas hukum: PT, CV, distributor)
  - **Brand** (lini produk: TACO, Cerarl, Grassi)
    - **Sku** (produk spesifik: kode + nama + spesifikasi)
      - **MaterialPrice** (harga dari brand ini, berlaku sejak kapan)
      - **Sample** (potong fisik di rak nomor berapa, box berapa)

StudioFlow dan BQ tidak menyimpan salinan — mereka join ke tabel `master_data.*` ini. Kalau data berubah di Master Data (harga naik, brand berganti nama), semua yang membaca otomatis lihat yang terbaru.

### Fase saat ini dan selanjutnya

**Fase ini (Master Data solid):** Semua CRUD di Master Data harus berfungsi dengan benar, user-friendly, dan tidak ada cacat logika. Ini adalah fondasi — kalau fondasi ini goyah, semua yang di atasnya akan bermasalah.

**Fase berikutnya (integrasi relasional StudioFlow):** Library explorer di StudioFlow mulai memanfaatkan Company grouping dari Master Data. ProductRequestTable menampilkan info vendor follow-up. Alur receive di StudioFlow punya side effect yang sama dengan receive di Master Data.

**Fase akhir (BQ):** BQ membaca `MaterialPrice`, `ServicePrice`, `MaterialLaborPrice` dari Master Data secara langsung. Schedule dari StudioFlow di-mapping ke item harga. BQ bisa di-generate otomatis.

---

## 1. Prinsip arsitektur

| Prinsip | Implementasinya |
|---|---|
| **Master Data adalah SSOT** | `master_data.*` adalah sumber kebenaran untuk identitas supplier (Company → Brand → Sku) dan harga (MaterialPrice, ServicePrice, MaterialLaborPrice). StudioFlow dan BQ **membaca** dari sana, tidak menduplikasi. |
| **StudioFlow adalah konsumen, bukan toko** | `studioflow.*` menyimpan data project-specific (snapshot schedule, product request, deliverable). Bukan katalog produk global. |
| **BQ adalah kalkulasi, bukan identitas** | BQ membaca harga dari `master_data`, membaca schedule dari `studioflow`, lalu menghitung. Tidak menyimpan identitas sendiri. |
| **Tabel BQ = text/number only** | `MaterialPrice`, `ServicePrice`, `MaterialLaborPrice` tidak menyimpan media. Gambar, link, catalog PDF hanya di sisi StudioFlow (Brand/Sku). |
| **Additive migration only** | Tidak ada rename tabel yang punya FK. `master_data.Vendor` tetap `Vendor` (mapped ke `Brand`). `studioflow.ProductCatalog` tetap (mapped ke `Sku`). |

---

## 2. Status selesai (R1–R8)

| Item | Keterangan | Commit/Status |
|---|---|---|
| R1 | Recurring schedule template per project | ✅ `809a08b` |
| R2 | Add item from another project's snapshot | ✅ `5d80f8d` |
| R3 | Secure deliverable storage (private dir + auth stream) | ✅ `d3a0683` |
| R4 | Projects page responsive + overlap fix | ✅ `c2afa74` |
| R5 | Rename "Cari Material" → "Search Library" + UI polish | ✅ `90b7342` |
| R6 | `ui_engine` consolidation + lint enforcement | ✅ `c2afa74` |
| R7 | Master Data: Company tier (Company → Brand → Sku) | ✅ schema + UI selesai |
| R8 | Master Data: Pricing CRUD (MaterialPrice, ServicePrice, MaterialLaborPrice, ServiceVendor) | ✅ schema + migration + UI selesai |

**Tambahan R8 (belum dicatat sebelumnya, sudah dikerjakan):**
- Kolom `category` di `MaterialPrice`, `vendor_category` + `specifications JSON` di semua tabel harga
- Master Data nav sidebar: sama dengan StudioFlow chrome (TopHeader + vertical sidebar)
- Material list: hapus kolom Sample Fisik dan Kurasi (tidak relevan dengan scope BQ/StudioFlow)

---

## 2. Pending migrations (harus dijalankan lokal)

```bash
npx prisma migrate dev --name add_company_tier
npx prisma migrate dev --name add_pricing_schemas
npx prisma migrate dev --name add_pricing_fields
npx prisma migrate dev --name request_vendor_followup
npx prisma generate
```

Setelah `generate`, hapus bridge cast berikut (semuanya sudah diberi komentar):
- `db = prisma as any` di `pricing-actions.ts` dan `company-actions.ts`
- `requestDb(tx)` di `sample-request-actions.ts`
- 4 accessor `vendor*` di `ProductRequestTable.tsx`

File SQL untuk semua migration di atas sudah ada di `prisma/migrations/`.

---

## 3. R9 — Master Data: Nav + Overview ✅ SELESAI

### 3.1 Nav: Merger Brand + Perusahaan → Supplier

**Masalah:** dua nav item terpisah (Brand, Perusahaan) untuk entitas yang memang satu hierarki (Company → Brand). Redundan secara konsep dan memakan slot sidebar.

**Solusi:**
- Satu nav item `Supplier` menggantikan `Perusahaan` dan `Brand`
- Route: `/masterdata/suppliers` dengan dua tab: **Brand** | **Perusahaan**
- Halaman Brand dan Perusahaan yang lama di-redirect ke tab yang sesuai
- `MasterDataNavOuter` → 4 item: Overview · Materials · Supplier · Harga

**File yang perlu diubah:**
- `src/subapps/master-data/components/MasterDataNavOuter.tsx` — hapus Building2 (Perusahaan) dan Tag (Brand), tambah satu item `Users2` (Supplier)
- `src/subapps/master-data/components/MasterDataNav.tsx` — update `MASTERDATA_SECTIONS`
- `src/app/masterdata/suppliers/page.tsx` — buat halaman baru dengan tab state
- `src/app/masterdata/companies/page.tsx` → redirect ke `/masterdata/suppliers?tab=perusahaan`
- `src/app/masterdata/vendors/page.tsx` → redirect ke `/masterdata/suppliers?tab=brand`

### 3.2 Overview: Notification Panel — Sample Request

**Masalah:** Overview sekarang hanya menampilkan angka aggregate. Tidak ada action item. Padahal ada request aktif dari desainer StudioFlow yang menunggu ditindaklanjuti staff.

**Alur yang diusulkan:**
```
Desainer (StudioFlow)          Staff (Master Data)
─────────────────────          ──────────────────
Request sample material    →   Muncul di Overview sebagai notifikasi
  [ProjectProductRequest         Status: REQUESTED
   status: REQUESTED]
                           ←   Staff buka dialog
                               Isi: kontak vendor, tgl, harga kutipan, notes
                               Status berubah: IN_PROGRESS
                               (opsional: auto-create MaterialPrice)
Sample datang              →   Staff terima di dialog
                               Input: SKU, rak, box, qty
                               Status: RECEIVED
                               Sku di-upsert di master_data
                               Sample fisik tercatat
```

**Schema tambahan (`studioflow.ProjectProductRequest`):**

```sql
ALTER TABLE studioflow."ProjectProductRequest"
  ADD COLUMN IF NOT EXISTS "vendor_contacted_by"   TEXT,
  ADD COLUMN IF NOT EXISTS "vendor_contacted_at"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "vendor_quoted_price"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "vendor_notes"          TEXT;
```

**Rekomendasi untuk `vendor_quoted_price`:** saat staff menyimpan harga kutipan vendor, otomatis buat/update baris `master_data.MaterialPrice` dengan:
- `brand_id` = `request.brand_id`
- `sku_id` = `request.sku_id` (kalau sudah ada)
- `item_description` = `request.custom_product_name` atau `sku.catalog_product_name`
- `price_after_discount` = `vendor_quoted_price`
- `updated_by_name` = nama staff yang mengisi

Dengan begitu harga yang diperoleh dari proses request sample langsung masuk ke master data pricing — tidak perlu input ulang di halaman Harga.

**UI yang perlu dibangun:**
- `src/app/masterdata/page.tsx` — ganti stat aggregate dengan notification feed
- `src/subapps/master-data/components/SampleRequestPanel.tsx` — list request aktif (REQUESTED + IN_PROGRESS) per brand/material
- `src/subapps/master-data/components/SampleRequestDialog.tsx` — dialog staff: view detail request + form vendor communication + form receive

**Data yang ditampilkan per notifikasi:**
- Material / nama produk (dari `custom_product_name` atau `sku.catalog_product_name`)
- Brand
- Project (nama project + siapa desainer yang minta)
- Tanggal request
- Status badge (REQUESTED / IN_PROGRESS)
- Siapa staff yang terakhir update + kapan (dari `vendor_contacted_by` + `vendor_contacted_at`)

**Effort:** M — migration kecil, UI lebih dari setengah pekerjaan.

---

## 4. R10 — StudioFlow Library: Patch ke Master Data sebagai SSOT

Ini adalah patch wajib karena Library saat ini **menduplikasi sebagian** fungsi Master Data, dan duplikasi itu akan drift.

### 4.1 BrandLibraryExplorer: Tampilkan hierarki Company

**Masalah saat ini:** `BrandLibraryExplorer` menampilkan `Brand` langsung tanpa Company tier. Setelah R7, data sudah punya `company_id` FK, tapi UI belum memanfaatkannya.

**Yang perlu diubah:**
- `LibraryVendor` type sudah punya `company?: { id, name, legal_name }` — bagus, tidak perlu ubah type
- UI `BrandLibraryExplorer`: tampilkan company name di atas brand name (grouping visual)
- Filter tambahan: filter by Company (bukan hanya by Brand)
- Brand card: tampilkan "Group: BDA Group" sebagai sub-label kalau `company` ada

**File:** `src/extensions/library/components/BrandLibraryExplorer.tsx`

### 4.2 ProductRequestTable: Tampilkan vendor communication status

**Masalah saat ini:** `ProductRequestTable` di StudioFlow hanya menampilkan status (REQUESTED/IN_PROGRESS/RECEIVED/UNAVAILABLE) tanpa detail siapa yang sudah kontak vendor dan kapan.

**Yang perlu diubah:**
- Tampilkan `vendor_contacted_by` + `vendor_contacted_at` kalau ada (badge "Sudah dihubungi oleh [nama] [tanggal]")
- Tampilkan `vendor_quoted_price` kalau ada (harga kutipan dari vendor)
- Ini read-only di sisi StudioFlow — write tetap di Master Data

**File:** `src/extensions/library/components/ProductRequestTable.tsx`

### 4.3 receiveProjectProductRequest: Link ke MaterialPrice

**Masalah saat ini:** `LibraryService.receiveProjectProductRequest` meng-upsert `Sku` dan membuat `Sample`, tapi tidak menyentuh `MaterialPrice`. Harga harus diinput ulang secara terpisah di Master Data.

**Yang perlu diubah:**
- Setelah Sku di-upsert, cek apakah request punya `vendor_quoted_price`
- Kalau ya, upsert `master_data.MaterialPrice` (brand_id + sku_id sebagai lookup key)
- Ini menyelesaikan loop: request → kontak vendor → terima sample → harga masuk master data

**File:** `src/extensions/library/services/library-service.ts` → method `receiveProjectProductRequest`

**Migration yang diperlukan:** `vendor_quoted_price` harus sudah ada di `ProjectProductRequest` (dari R9 di atas).

### 4.4 LibraryService.getAllVendors: Sertakan Company

**Masalah saat ini:** `getAllVendors` mengembalikan `Brand[]` tanpa Company relation. `LibraryVendor` type sudah punya `company?` field tapi query belum `include`-nya.

**Yang perlu diubah:**
```typescript
// library-service.ts getAllVendors()
include: {
  company: { select: { id: true, name: true, legal_name: true } },
  contacts: true,
  links: true,
  // ...
}
```

**File:** `src/extensions/library/services/library-service.ts` → method `getAllVendors`

### 4.5 getAllProductRequests: Expose field baru

**Masalah saat ini:** `getAllProductRequests` select-nya hardcoded dan tidak akan otomatis mengambil `vendor_contacted_by`, `vendor_contacted_at`, `vendor_quoted_price`, `vendor_notes` setelah migration R9.

**Yang perlu diubah:**
- Update select/include di `getAllProductRequests` dan `getProjectProductRequests`
- Update `ProjectProductRequestWithDetails` type di `types.ts`
- Update `ProductRequestTable` props

**File:** `src/extensions/library/services/library-service.ts`, `src/extensions/library/types.ts`

---

## 5. R11 — Cleanup sisa route yang tidak dipakai

Route-route ini masih ada di filesystem tapi sudah tidak relevan setelah R8 dan R9:

| Route | Status | Action |
|---|---|---|
| `/masterdata/curation` | Dihapus dari nav tapi route masih ada | Biarkan — redirect kalau diakses |
| `/masterdata/samples` | Sample fisik sudah masuk flow R9 | Biarkan untuk sementara |
| `/masterdata/promotions` | Sudah tidak relevan | Biarkan |
| `/masterdata/skus` | Sudah tidak relevan | Biarkan |

Tidak perlu dihapus sekarang — tidak mengganggu, tidak di-index oleh nav.

---

## 6. Urutan eksekusi

```
SELESAI
───────
[x] R9.1 — Nav merge Brand + Perusahaan → Supplier (tab)
[x] R9.2 — Schema: 5 field vendor follow-up di ProjectProductRequest + index status
[x] R9.3 — Server actions: getOpen/getClosed/recordVendorFollowUp/receiveSample/
           markUnavailable/reopen
[x] R9.4 — Overview: SampleRequestPanel + SampleRequestDialog
[x] R9.5 — Auto-upsert MaterialPrice dari harga kutipan vendor
[x] R10.2 — ProductRequestTable: tampilkan vendor follow-up (read-only)
[x] R10.5 — getAllProductRequests + getProjectProductRequests: include brand
            (sebelumnya request brand-first tidak menampilkan brand sama sekali)

SETELAH MIGRATION LOKAL DIJALANKAN
──────────────────────────────────
[ ] Hapus semua bridge cast (lihat §2)
[ ] R10.1 — BrandLibraryExplorer: Company grouping + filter by Company
[ ] R10.3 — receiveProjectProductRequest (StudioFlow): link ke MaterialPrice,
            supaya dua entry point punya side effect yang sama
[ ] R10.4 — getAllVendors: sudah include Company ✓ (diverifikasi, tidak perlu diubah)

BERIKUTNYA
──────────
[ ] R11 — BQ: baca MaterialPrice / ServicePrice / MaterialLaborPrice
```

## 7. Keputusan yang perlu dikonfirmasi

| # | Pertanyaan | Default jika tidak dikonfirmasi |
|---|---|---|
| D1 | Overview notification: apakah semua request dari semua project, atau hanya yang active (tidak archived)? | Semua project tidak archived |
| D2 | Auto-create MaterialPrice dari vendor_quoted_price: apakah ini juga jalan saat staff update (bukan hanya saat receive)? | Ya — upsert setiap kali vendor_quoted_price diisi/diubah |
| D3 | Saat sample RECEIVED, apakah form receive (SKU, rak, box) muncul di dialog Master Data atau tetap di StudioFlow? | Di Master Data dialog (satu flow) |
| D4 | UNAVAILABLE: apakah status ini bisa di-set dari Master Data juga, atau hanya dari StudioFlow? | Dari keduanya |

---

## 8. File yang disentuh per item

### R9.1 (nav merge)
- `src/subapps/master-data/components/MasterDataNavOuter.tsx`
- `src/subapps/master-data/components/MasterDataNav.tsx`
- `src/app/masterdata/suppliers/page.tsx` ← baru
- `src/app/masterdata/companies/page.tsx` ← jadi redirect
- `src/app/masterdata/vendors/page.tsx` ← jadi redirect

### R9.2–R9.4 (schema + overview)
- `prisma/schema.prisma` ← 4 field baru di ProjectProductRequest
- `prisma/migrations/20260805210000_project_request_vendor_fields/migration.sql` ← baru
- `src/app/masterdata/page.tsx` ← rewrite jadi notification feed
- `src/subapps/master-data/components/SampleRequestPanel.tsx` ← baru
- `src/subapps/master-data/components/SampleRequestDialog.tsx` ← baru
- `src/subapps/master-data/actions/sample-request-actions.ts` ← baru

### R10 (library patches)
- `src/extensions/library/services/library-service.ts`
- `src/extensions/library/types.ts`
- `src/extensions/library/components/BrandLibraryExplorer.tsx`
- `src/extensions/library/components/ProductRequestTable.tsx`
- `src/extensions/library/actions/library-actions.ts` ← update types
