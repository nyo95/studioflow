# Library Rework — Findings (study pass)

> **Status 30 Juli 2026 — rework sudah dikerjakan.** Dokumen ini tetap sebagai
> catatan temuan; lihat `CHANGELOG.md` bagian *Product Library Rework* untuk apa
> yang berubah. Ringkas status per temuan:
>
> | Temuan | Status |
> |---|---|
> | 3.1 hapus sample destruktif | **selesai** — `updateProduct` jadi upsert-by-id; array kosong tidak lagi menghapus; `PhysicalSample.deleted_at` ditambahkan supaya riwayat pinjam selamat; penghapusan hanya lewat `deletePhysicalSampleAction` dan ditolak kalau sample sedang keluar |
> | 3.2 fixture tak bisa disimpan | **selesai** — `productSection` dihidrasi dari `catalog_type`; `catalog_type` hanya dikirim saat CREATE; section tampil read-only saat EDIT |
> | 3.3 tab Samples bukan inventory | **selesai** — `getPhysicalSamplesAction` + `SampleInventoryTable` baru |
> | 3.4 tab Requests kosong untuk STAFF | **selesai** — gate pindah ke `LIBRARY_PROCESS_REQUEST`; tab digerakkan `getMyLibraryAccessAction` |
> | 3.5 tombol Modify pasti gagal | **selesai** — UI dan server sama-sama permission-based |
> | 3.6 fetch ganda | **selesai** — izin diresolusi lebih dulu; data referensi dipisah dari query baris; hanya tab aktif yang di-fetch |
> | 3.7 filter di bawah kapasitas | **selesai** — brand/section/category/status/tag/sort diekspos; filter hanya muncul di tab yang terpengaruh |
> | 3.8 search lambat | **belum** — masih `contains` OR 8 kolom tanpa index trigram/FTS. `getProductMetadata` sudah difilter `deleted_at` |
> | 3.9 kode mati | **selesai** — `facade.ts`, `ProductTable`, `ProjectProductRequestModal`, `StudioCard`, `PhysicalInventoryTable` dihapus (~850 LOC) |
> | 3.10 hitungan header & pagination | **selesai** — pakai total sebenarnya; pager di-window |
> | 3b.1 RBAC STAFF terbalik | **selesai** — STAFF pemilik Library di `matrix.ts` |
> | 3b.2 kolom Update | **selesai** — `ProductCatalog.updated_at` nullable |
> | 3b.3 color+image wajib untuk APPROVED | **belum — perlu keputusanmu.** Baris ala sheet masih tak bisa APPROVED tanpa mengarang color dan mengunggah gambar |
> | 3b.4 kategori per brand | **selesai** — `getBrandCategoryCoverageAction`; picker mengelompokkan kategori milik brand lebih dulu, kategori baru tetap boleh |
> | 3b.5 model mental tabel | **selesai** — `ProductTableView` sesuai kolom sheet, jadi tampilan default; kartu tinggal satu toggle |
>
> Verifikasi: `npx tsc --noEmit` seluruh proyek **0 error**; `npx eslint` pada
> library + route + rbac **0 error, 0 warning**. Wajib `npx prisma generate`
> lebih dulu karena ada dua kolom baru.

Baseline studi: `src/extensions/library/*` (4,874 LOC) +
`src/app/(dashboard)/extensions/library/page.tsx` (212 LOC).

Hard constraint carried over from `PLAN-catalog-library-sync.md`: **non-destructive
to Product Schedule / Catalog.** Additive migrations only, no bulk overwrite, no
rewrite of stored snapshots.

---

## 1. Peta modul

| Layer | File | LOC | Peran |
|---|---|---|---|
| Route | `app/(dashboard)/extensions/library/page.tsx` | 212 | Client page. Fetch 7 action paralel, hold semua state filter/pagination. |
| Shell | `components/LibraryTabs.tsx` | 383 | 5 tab (Catalog / Samples / Vendors / Requests / Queue) + sidebar filter + modal host. |
| Grid | `components/catalog/ProductGrid.tsx` + `ProductCard.tsx` | 105 + 141 | Kartu image-first, pagination numerik. |
| Form | `components/LibraryFormModal.tsx` | 957 | Satu modal untuk PRODUCT **dan** VENDOR, CREATE **dan** EDIT, view-first. |
| Tabel | `VendorTable` / `PhysicalInventoryTable` / `ProductRequestTable` / `PromotionQueueTable` | 187 / 243 / 330 / 248 | Tab non-catalog. |
| Actions | `actions/library-actions.ts` | 350 | 20 server action, RBAC via `assertAdmin` / `assertAdminOrStaff`. |
| Service | `services/library-service.ts` | 1,113 | Vendor + Product + Sample + ProjectProductRequest + PromotionRequest — 5 domain dalam 1 class. |
| Types | `types.ts` | 172 | Input types + 3 skema Zod validasi. |

Data model: `ProductCatalog` (SSOT global) → `PhysicalSample` → `SampleMovementLog`;
`Vendor` → `VendorContact`; `ProjectProductRequest`; `PromotionRequest`.

---

## 2. Kontrak yang TIDAK boleh berubah

Konsumer di luar folder library — ini permukaan yang mengikat:

| Pemakai | Yang dipakai |
|---|---|
| `schedule/actions/schedule-actions.ts:145` | `LibraryService.getProductById(tx, id)` |
| `schedule/actions/schedule-actions.ts:436` | `LibraryService.getSuggestions(tx)` |
| `schedule/services/schedule-service.ts:8` | import `LibraryService` |
| `sketchup/actions/sketchup-actions.ts:1834` | `LibraryService.getAllProducts(tx, {...})` |
| `sketchup/actions/sketchup-actions.ts:3265` | `LibraryService.createProduct(input, userId, tx)` |
| `sketchup/actions/sketchup-actions.ts:18` | type `ProductCatalogInput` |
| `components/ui/universal-image-uploader.tsx` | `lib/upload-client.ts → uploadLibraryImage` |
| `sketchup/components/CatalogBoard.tsx`, `RenderBoardPanel.tsx` | `uploadLibraryImage` |
| `lib/revalidation-tags.ts:17` | path `/extensions/library` |

→ **5 method service + 1 type + 1 upload helper.** Selama tujuh ini stabil,
seluruh isi folder library bisa dibongkar tanpa menyentuh Schedule/Catalog/SketchUp.

Catatan: `ProductCatalogInput` dipakai `saveCatalogItemToLibraryAction` di
sketchup — menambah field opsional aman, mengubah/menghapus field tidak.

---

## 3. Bug & risiko yang ditemukan

### 3.1 KRITIS — edit produk menghapus physical sample (destruktif)

`LibraryFormModal` hanya membaca `physical_samples[0]` (line 172) dan selalu
mengirim array 1 elemen (line 193-197). `LibraryService.updateProduct` line 573:

```ts
const sampleOps = data.physical_samples ? { deleteMany: {}, create: [...] } : undefined;
```

Akibatnya, setiap kali produk disimpan dari modal:

- Produk dengan 2+ sample → sample ke-2 dan seterusnya **terhapus permanen**.
- `SampleMovementLog` ikut hilang (`onDelete: Cascade` di schema line 263) →
  riwayat pinjam/kembali lenyap.
- `catalog_status` sample (BORROWED / SENT_TO_CLIENT) dan `current_borrower_name`
  tidak dibawa form → sample yang sedang dipinjam di-recreate jadi `AVAILABLE`,
  nama peminjam hilang.
- Kasus terburuk: kalau rack **dan** box dikosongkan, modal mengirim `[]`
  (line 282-284) yang tetap truthy → `deleteMany: {}` + `create: []` →
  **semua sample produk itu terhapus**.

Ini pelanggaran langsung aturan non-destruktif. Perlu diperbaiki lepas dari
keputusan rework apa pun.

### 3.2 KRITIS — produk fixture tidak bisa diedit

`productSection` di-init `ProductType.material` (line 122) dan **tidak pernah
dihidrasi dari `initialData`** — grep hanya menemukan `setProductSection` di
line 224 (branch reset) dan 444 (onChange user). Tapi submit selalu mengirim
`catalog_type: productSection` (line 277), dan `updateProduct` line 568 melempar:

```
Product TYPE is immutable after creation. (IMMUTABILITY_VIOLATION)
```

→ Buka produk fixture → Modify → Commit → **selalu gagal.** Efek samping kedua:
dropdown Category di mode edit selalu menampilkan `materialsCategories`,
jadi kategori fixture tampak hilang.

### 3.3 Tab Samples bukan inventory

`page.tsx` memberi `PhysicalInventoryTable` list `products` yang sama dengan tab
Catalog — sudah terpaginasi 24 dan terfilter status. `PhysicalInventoryTable`
lalu me-map **semua** produk (line 66-77), bukan hanya yang punya sample, dan
hanya membaca `physical_samples[0]`.

Jadi tab Samples = "24 produk halaman aktif Catalog, kolom rack/box diisi `-`".
Bukan daftar inventory. Filter `Physical Only` di sidebar tidak otomatis aktif
di tab ini.

### 3.4 Tab Requests kosong permanen untuk STAFF

`LibraryTabs` menampilkan tab Requests bila `canManageCatalog` (ADMIN/OWNER/**STAFF**),
tapi `getAllProductRequestsAction` memanggil `assertAdmin` (actions line 278) —
sama untuk `getPromotionRequestsAction` (line 43). `page.tsx` menelan error
lewat `if (requestsRes.success)`. STAFF melihat tab yang selalu kosong tanpa pesan.

### 3.5 STAFF diberi tombol Modify yang pasti gagal

Modal: `canEdit = isAdmin || isStaff` (line 104). Service: `assertEditable`
melempar `CATALOG_LOCKED` untuk item APPROVED kecuali ADMIN/OWNER (line 60).
STAFF mengisi form penuh → error toast di akhir. RBAC harus diketahui di UI,
bukan di submit.

### 3.6 Fetch ganda + refetch tak perlu

`role` di-init `"STAFF"` (page line 68) dan masuk dependency `fetchProducts`
(line 154) → produk di-fetch 2x tiap mount: sekali dengan asumsi STAFF, sekali
setelah `getMyRoleAction` selesai. `activeTab` juga jadi dependency → pindah ke
tab Vendors/Requests memicu query produk yang tidak dipakai.

`handleRefreshAll` menjalankan 7 action + `router.refresh()` sekaligus setelah
setiap create/update/delete.

### 3.7 Filter jauh di bawah kapasitas service

Service `getAllProducts` sudah menerima `vendorId`, `type`, `status`,
`hasPhysicalOnly`, `category`, `search`, `page`, `pageSize`. UI hanya
mengekspos search + 1 kategori + physical-only. Tidak ada facet brand, section
(material/fixture), status, atau tags — padahal `catalog_tags` sudah ada di schema.

Sidebar filter juga tetap terlihat di tab Vendors/Requests/Queue tempat ia
tidak berpengaruh.

### 3.8 Search berpotensi lambat

8 `contains … mode: insensitive` di-OR (service line 337-348). Index yang ada
hanya `vendor_id`, `catalog_category`, `catalog_brand` (schema line 231-233) —
tidak dipakai oleh `contains`. Ini sequential scan penuh per keystroke
(debounce 400ms). Perlu trigram/FTS index kalau katalog tumbuh.

`getProductMetadata` (line 437) juga `distinct` tanpa filter `deleted_at` →
nilai dari produk terhapus masih muncul di dropdown.

### 3.9 Kode mati

Tidak direferensikan dari mana pun:

| File | LOC |
|---|---|
| `facade.ts` — `LibraryFacade` tidak pernah di-import | 39 |
| `components/ProductTable.tsx` | 233 |
| `components/ProjectProductRequestModal.tsx` | 312 |
| `components/StudioCard.tsx` | 34 |
| **total** | **618** |

Ironisnya `MASTER_SSOT.md:67` menetapkan facade sebagai satu-satunya jalur
antar-extension, tapi Schedule dan SketchUp meng-import `LibraryService`
langsung. Jadi: aturan ada, facade ada, keduanya tidak tersambung.

Di dalam `LibraryFormModal` juga ada konstanta/import mati: `CONTACT_ROLES`,
`FINISHING_PRESETS`, `Palette`, `Type`, `Check`, `ChevronRight`, `ChevronDown`,
`ChevronUp`, `ImageIcon`, `Users`, dan prop `categories`. Line 745 pakai `<img>`
mentah, bukan `next/image`.

### 3.10 Lain-lain

- Header menampilkan `products.length` ("Active Items") = jumlah halaman, bukan
  `totalProducts`.
- Pagination merender **semua** nomor halaman (`ProductGrid` line 62) — 500 produk
  = 21 tombol.
- `updateProduct` memanggil `executeUpsertScheduleCategoryConfig` setiap kali
  status dikirim `APPROVED`, walau tidak berubah (line 635).
- `mergeVendors` (line 664) `updateMany` `catalog_brand` — mengubah data Library
  massal. Sengaja, dan snapshot proyek tidak disentuh (line 672), tapi ini satu-
  satunya bulk write yang perlu diingat saat rework.
- `LibraryService` mengurus 5 domain dalam 1 class 1,113 baris.

---

## 3b. Klarifikasi user — RBAC & bentuk data nyata

> "admin itu administrative disini saya tulis **staff**, bukan administrator
> (bahasa web developer)" — jadi pemilik/kurator Library adalah role `STAFF`.
> "struktur database yg dipakai khusus di studioflow itu yg di tab
> (material / supplier list)" — dengan catatan: **kategori bisa macam-macam per
> brand** (Taco = HPL, bisa juga SPC).

### 3b.1 RBAC terbalik dari kenyataan organisasi

`src/core/rbac/matrix.ts:14-19` — STAFF hanya punya:

```ts
STAFF: [PROJECT_VIEW_AUDIT, PLUGIN_SCHEDULE_VIEW, LIBRARY_VIEW, LIBRARY_EXPORT_LIST]
```

STAFF **tidak** punya `LIBRARY_CREATE_ITEM`, `LIBRARY_EDIT_ITEM`,
`LIBRARY_DELETE_ITEM`, `LIBRARY_MANAGE_VENDORS`, `LIBRARY_MANAGE_BRANDS`,
`LIBRARY_MANAGE_SAMPLES`, `LIBRARY_PROCESS_REQUEST`, `LIBRARY_MARK_RECEIVED`.
Padahal STAFF-lah yang memelihara daftar material/supplier.

Ada **tiga gate yang saling bertentangan** di jalur yang sama:

| # | Lokasi | Putusan untuk STAFF |
|---|---|---|
| 1 | `matrix.ts:14` | view + export saja |
| 2 | `library-actions.ts` `assertAdminOrStaff` | boleh create/update product & vendor |
| 3 | `library-service.ts:60` `assertEditable` | **ditolak** untuk item APPROVED |
| 3 | `library-actions.ts:211` | status STAFF dipaksa jadi `PENDING` |
| 3 | `library-actions.ts:310` `RBAC.assert("plugin.library.manage")` | **ditolak** — STAFF tak punya satu pun izin penyusunnya |

Efek nyata: kurator daftar diperlakukan sebagai kontributor tak terpercaya —
setiap entri masuk sebagai PENDING menunggu approval ADMIN, tidak bisa menyentuh
baris yang sudah APPROVED, dan tidak bisa memproses permintaan sample.
Ini deadlock, bukan sekadar UX mismatch.

Gerbang PENDING → Queue → APPROVED tetap masuk akal untuk **DIC/DRIC** yang
mempromosikan draft proyek (`LIBRARY_REQUEST_MATERIAL` — matrix line 37, 46).
Tidak masuk akal untuk STAFF yang memang pemilik daftarnya.

**Pembagian yang konsisten dengan organisasi:**

| Role | Library |
|---|---|
| STAFF (administrative) | pemilik penuh: create/edit/delete product & vendor, kelola sample, proses request, langsung APPROVED |
| DIC / DRIC (designer) | view + request material; promosi draft proyek → Queue |
| ADMIN / OWNER | superset + override + merge vendor |

Perbaikannya aditif di `matrix.ts` (tambah permission ke array STAFF) +
melonggarkan `assertEditable` & status-forcing untuk STAFF. Tidak ada migrasi,
tidak ada data yang ditulis ulang.

### 3b.2 Pemetaan kolom sheet → schema

| Kolom sheet | Field sekarang | Status |
|---|---|---|
| No | — (indeks baris) | tak perlu disimpan |
| Brand | `Vendor.brand_name` | ada |
| Category | `ProductCatalog.catalog_category` | ada |
| Product | `catalog_product_name` / `catalog_sku` | ada |
| Product Link | `catalog_reference_url` | ada (dari #32) |
| Drive Folder | `catalog_folder_url` | ada |
| Website | `Vendor.website_url` | ada |
| IG | `Vendor.instagram_url` | ada |
| Sales | `VendorContact.contact_person` (role Sales) | ada |
| Contact | `VendorContact.phone_number` | ada |
| Company | `Vendor.company_name` / `company_pt` | ada |
| **Update** | **tidak ada** | `ProductCatalog` cuma punya `created_at` (schema line 223) |

11 dari 12 kolom sudah punya rumah. Normalisasi vendor sudah benar — Website /
IG / Sales / Contact / Company di sheet berulang per baris, di schema sudah
dipisah ke `Vendor` + `VendorContact`.

Yang kurang: `ProductCatalog.updated_at`. Perlu **satu migrasi aditif**:

```prisma
updated_at DateTime? @updatedAt   // nullable — baris lama NULL, bukan tanggal palsu
```

Nullable, bukan `@default(now())` — kalau di-default, semua baris lama distempel
tanggal migrasi dan itu data bohong. `Vendor` juga sama sekali tidak punya
`created_at`/`updated_at`; tambahkan kalau kolom Update dimaksudkan per-brand juga.

### 3b.3 BLOKER — bentuk data nyata tidak bisa masuk sebagai APPROVED

Sheet mereka **tidak punya kolom color maupun image**. Tapi:

- `ProductCatalog.catalog_color` = `String` **non-nullable** (schema line 213).
- `CatalogApprovalValidationSchema` (types.ts) mewajibkan untuk APPROVED:
  `catalog_image_url.min(1)`, `vendor_id.min(1)`, `catalog_color.min(1)`.
- `LibraryFormModal:259` memblokir submit di klien:
  `"Color is mandatory for library inclusion"`.

Artinya satu baris ala sheet (Brand + Category + Product + link) **tidak akan
pernah bisa jadi APPROVED** tanpa mengarang color dan mengunggah gambar.
`createProduct` memang jatuh ke `"N/A"` untuk color (service line 505), tapi
guard di modal menghentikannya lebih dulu, dan syarat image tetap keras.

Keputusan yang perlu diambil: apakah `catalog_color` + `catalog_image_url` benar
wajib untuk **supplier list** (identitas produk yang bisa dipesan), atau hanya
wajib untuk **material palette** (kartu visual yang dipakai designer di schedule)?
Kalau dua-duanya hidup dalam satu tabel, syarat ketat itu harus per-konteks,
bukan per-tabel.

### 3b.4 Kategori per brand — data sudah benar, UI belum

`catalog_category` adalah `String` bebas di `ProductCatalog`, tanpa constraint
per-vendor. Jadi Taco punya baris HPL **dan** SPC sudah valid sekarang — tidak
perlu perubahan schema.

Yang belum ada:

- Dropdown Category di form diisi dari `PrefixDictionary` (semua kategori,
  dipecah material/fixture) — **tidak diurutkan/disaring menurut brand terpilih**.
  Tambah produk Taco → harus menyusuri seluruh kategori, padahal "Taco: HPL, SPC"
  bisa disodorkan lebih dulu. Ini sugesti, bukan constraint — kategori baru harus
  tetap boleh.
- Tidak ada tampilan cakupan brand → kategori. `VendorTable` tidak menunjukkan
  brand ini mengisi kategori apa saja.
- Filter tidak bisa dua tingkat (Brand → Category).

### 3b.5 Model mental: tabel, bukan grid kartu

Sheet itu tabel datar per-baris. Tab Catalog sekarang grid kartu image-first
(`ProductGrid` 3-4 kolom, `aspect-square`, 24/halaman) — bagus untuk designer
memilih material, buruk untuk STAFF memelihara ratusan baris supplier.

`components/ProductTable.tsx` (233 LOC, mati) sebetulnya sudah tabel, tapi
kolomnya Image / Product Info / Vendor / Category / Status / Actions — belum
sesuai sheet (tidak ada Product Link, Drive Folder, Website, IG, Sales, Contact,
Company, Update).

Implikasi rework: satu data, **dua tampilan** — mode tabel (kerja STAFF, padat,
sesuai kolom sheet, inline edit) dan mode kartu (pilih material, visual).

---

## 3c. Batas BQ (info pengguna, 30 Juli 2026)

BQ akan jadi **subapp terpisah**, bukan merge: login bersama, database material
bersama, database proyek terpisah, dan **harga material + harga vendor milik BQ
saja** (permintaan klien). Detail lengkap + revisi rencana migrasi ada di
`UPSTREAM-BQ-MATERIAL-SOURCE.md` §0.

Dampak ke rework Library:

- **Scope terkunci rapi.** Library StudioFlow = identitas + spec + media +
  vendor/kontak. Tanpa harga — konsisten dengan sheet *material / supplier list*
  yang juga tidak punya kolom harga. Tidak ada field harga yang perlu ditambahkan.
- **`catalog_price` jangan disentuh.** Ia mengalir jauh ke luar Library
  (`ScheduleSnapshot.catalog_price` → `unit_cost` SketchUp, ~10 titik di
  `sketchup-actions.ts`). Deprecation-nya urusan tahap S6, bukan rework ini.
- **Aman dikerjakan sekarang, apa pun arah BQ:** perbaikan RBAC STAFF (§3b.1),
  bug hapus `PhysicalSample` (§3.1), bug produk fixture (§3.2), tab Samples
  (§3.3), vendor & kontak, sample & request, tampilan tabel/kartu field spec.
- **Sebaiknya ditunda:** apa pun yang mengasumsikan `ProductCatalog` tetap
  pemegang identitas produk — termasuk menambah kolom identitas baru. Kalau
  identitas nanti pindah ke `Material` milik BQ, kerja itu terbuang.
- **Pengecualian yang tetap layak:** `updated_at` (§3b.2). Kolom Update di sheet
  adalah kebutuhan sekarang, nullable, aditif, dan tidak bergantung arah BQ.

---

## 4. Zona aman vs zona bahaya

**Aman dibongkar bebas** (tidak ada konsumen luar):

- seluruh `components/**`
- `page.tsx`
- `actions/library-actions.ts` — kecuali kalau `facade.ts` mau diaktifkan
- `facade.ts`, `ProductTable`, `ProjectProductRequestModal`, `StudioCard` (mati)

**Harus dijaga signature-nya:**

- `LibraryService.getProductById`, `getSuggestions`, `getAllProducts`,
  `createProduct`
- type `ProductCatalogInput`
- `lib/upload-client.ts → uploadLibraryImage`

**Jangan disentuh tanpa alasan kuat:**

- `PhysicalSample` / `SampleMovementLog` — riwayat, cascade delete
- `reviewPromotionRequest` — menulis `ProjectScheduleOption.product_catalog_id`,
  satu-satunya jalur Library → Schedule
- `ProductCatalog` schema — hanya `ADD COLUMN` nullable

---

## 5. Urutan yang disarankan

Perbaikan bug dulu (kecil, terisolasi, menghentikan kehilangan data), baru
rework struktur:

1. **Fix 3.1** — hidrasi semua sample + status + borrower di modal; ubah
   `updateProduct` dari delete-and-replace jadi upsert-by-id, dan abaikan
   `physical_samples` kalau array kosong. *Non-destruktif, tanpa migrasi.*
2. **Fix 3.2** — `setProductSection(productInitial.catalog_type)` saat hidrasi;
   berhenti mengirim `catalog_type` di mode EDIT.
3. **Fix 3.4 + 3.5** — samakan RBAC UI dengan RBAC server.
4. **Fix 3.3** — beri tab Samples query-nya sendiri (`hasPhysicalOnly: true`,
   flatten semua sample), bukan pinjam list Catalog.
5. Baru setelah itu: rework shell/grid/form/filter — bebas, karena tidak ada
   konsumen luar.
6. Hapus 618 LOC kode mati (atau aktifkan facade sebagai jalur resmi, pilih satu).

Verifikasi tiap langkah: `npx tsc --noEmit` + `npx eslint <file berubah>`, plus
cek regresi: push SketchUp masih mempertahankan snapshot; Add-from-Library masih
jalan; sample movement log utuh.
