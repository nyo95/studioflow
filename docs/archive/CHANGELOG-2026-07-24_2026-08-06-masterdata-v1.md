# Arsip Changelog — 2026-07-24 → 2026-08-06 (era Master Data v1)

> **Diarsipkan 2026-08-10.** Dipindahkan dari `CHANGELOG.md`.
>
> Seluruh entri di berkas ini menggambarkan schema `master_data` **v1** —
> `Company`, `Vendor`, `MaterialCatalog`, `MaterialCandidate`, `SampleCandidate`,
> `MaterialPrice`, `ServicePrice`, `MaterialLaborPrice`, dan kolom `catalog_*` /
> `vendor_id`. Semuanya **dihapus utuh** oleh
> `20260810180000_masterdata_v2_rebaseline` (`DROP SCHEMA master_data CASCADE`).
>
> Karena itu isinya **tidak bisa dipakai sebagai acuan keadaan sekarang** —
> tidak ada satu pun tabel, kolom, atau service yang disebut di bawah ini masih
> ada. Ia disimpan untuk satu guna saja: menjawab *"kenapa dulu diputuskan
> begitu"* saat keputusan v2 dipertanyakan.
>
> Ringkasan kanoniknya ada di `CHANGELOG.md` §Arsip.

---

## [Unreleased] - 2026-08-06 (Roadmap — A6 "paket schedule" dirinci)

### Documentation

- **`roadmap.md` A6** (baru, menggantikan B1 yang masih kabur). Owner mengonfirmasi
  bahwa "template berulang" di roadmap lama memang untuk **product schedule**,
  dan yang dimaksud adalah template **berisi produk yang sudah terpilih** —
  bukan sekadar kerangka baris.

  Pemeriksaan kode menegaskan batas yang ada sekarang:
  `ScheduleTemplate` + `applyDefaultTemplateEntries` sudah berjalan otomatis di
  tiap proyek baru (`project-service.ts`), tetapi **hanya membuat entry
  `reserve` kosong** — satu baris blanko per kategori ber-`is_default_entry`.
  Schedule punya dua lapis (`ProjectScheduleEntry` = baris,
  `ProjectScheduleOption` = pilihan produk), dan template berhenti di lapis
  pertama.

  Rancangan A6 dicatat lengkap beserta empat keputusan yang menahannya:

  - **`sku_id` rujukan hidup, bukan snapshot** (`SetNull`). Paket adalah resep,
    bukan catatan. Pembekuan tetap terjadi saat paket **diterapkan** — semantik
    `data_snapshot` yang sudah berlaku — sehingga schedule hasil paket tidak bisa
    dibedakan dari yang dipilih manual. SKU terhapus → baris jadi `reserve`
    kosong, paket tidak rusak.
  - **Menumpang `addEntryToSchedule`** yang sudah menerima `mode: "catalog"` +
    `catalogItemId`; resolusi prefix, urutan, dan normalisasi kode ikut gratis.
    Wajib additive + idempoten seperti `applyDefaultTemplateEntries`.
  - **Validasi ditiru saat paket disimpan**, bukan hanya saat diterapkan.
    `addEntryToSchedule` menolak SKU yang `catalog_type`-nya beda dari `section`
    atau yang `catalog_tags`-nya tidak memuat kategori baris — kalau baru dicek
    saat penerapan, paket tersimpan bisa gagal sebagian tanpa peringatan.
  - **Bergantung A2/A3.** Validasi kategori membaca `Sku.catalog_tags`; begitu
    pembacaan pindah ke `SkuCategory` dan kolomnya dihapus, validasi A6 ikut
    berubah. Kerjakan sesudah A2.

  Alternatif "salin schedule dari proyek lain" dicatat sebagai **tidak diambil**,
  beserta alasannya: `mode: "reuse"` + `sourceOptionId` sudah menyediakan
  sebagian mekanismenya, tetapi mengikat paket pada satu proyek nyata membuat
  asal-usulnya kabur begitu proyek sumber berubah atau diarsipkan.

## [Unreleased] - 2026-08-06 (Roadmap dibersihkan + route lama dihapus)

### Removed

- **`src/app/masterdata/companies/`, `/vendors/`, `/skus/`** dihapus (masing-masing
  `page.tsx` + `error.tsx` + `loading.tsx`).

  Ketiganya stub redirect peninggalan struktur lama. Dua di antaranya sudah
  **rusak sejak Supplier jadi tabel flat**: `/companies` mengarah ke
  `/masterdata/suppliers?tab=perusahaan` dan `/vendors` ke `?tab=brand`, padahal
  tab tersebut tidak ada lagi — tab sekarang `material` | `jasa`, dan
  `SupplierClient` tidak pernah membaca param `tab` dari URL. Bookmark lama
  mendarat di tab default tanpa pemberitahuan.

  Diverifikasi nol referensi di seluruh `src/` sebelum dihapus.

- **`roadmap.txt`** → diganti **`roadmap.md`**.

### Documentation

- **`roadmap.md`** (menggantikan `roadmap.txt`). Isinya hanya pekerjaan yang belum
  selesai; ~30 butir yang sudah rampung diringkas jadi satu bagian riwayat karena
  rinciannya sudah lengkap di berkas ini.

  Yang dibuang karena tidak lagi cocok dengan skema:
  - **§4 "Backfill `company_id` manual, belum ada support-nya"** — salah sejak
    P3-a ada.
  - **§4a "[NOW] CRUD Company di tab Perusahaan"** — sudah selesai, dan "tab
    Perusahaan" sendiri sudah dihapus.
  - **§4c "Brand grouped by Company"** — dikerjakan di §3g lalu **dibatalkan** di
    §3h (flat table). Roadmap menyimpan keduanya seolah dua-duanya berlaku.
  - **"PETA YANG DIUSULKAN → Kategori"** sebagai halaman — tidak ada dan tidak
    pernah dibangun; `Category` sampai sekarang tidak punya UI sendiri.

  Yang diperjelas:
  - **Schema `bq`**: dideklarasikan di `datasource` tetapi **nol model**. BQ adalah
    app terpisah yang mengonsumsi harga dari `master_data`; schema itu tempat
    tabel milik app tersebut, yang belum dibangun. Konsekuensinya dicatat
    eksplisit — **"siap BQ" berarti kelengkapan harga, bukan bahwa ada tabel BQ
    yang membacanya hari ini.**
  - **§1 "template berulang"** → `ScheduleTemplate` / `TimelineTemplate` /
    `ChecklistTemplate` sudah ada dan terpakai. `PLAN-APP-SPLIT.md` §R5 menyebut
    ketiganya *"sudah ada, belum jadi produk"* — lapisan model selesai,
    pengalaman pakai belum. Dicatat apa adanya, bukan ditandai selesai.
  - **§2 "foldering structure"** → konteksnya ditemukan di `PLAN-APP-SPLIT.md` §R5:
    *"struktur foldering deliverable per fase, disambung ke `File` +
    `PrefixDictionary`"*. Keadaan sekarang dicatat: `File` datar di bawah
    `Revision`, tanpa kolom folder/path.
  - **Kolom kategori teks bebas di tabel harga** (`MaterialPrice.category`,
    `ServicePrice.category` + `vendor_category` sejak R8) dicatat sebagai
    **disengaja** — sectioning BQ, bukan klasifikasi produk — supaya tidak ada
    yang "merapikan" tanpa tahu alasannya.

### Verification

- `npx tsc --noEmit` exit 0 setelah artefak `.next/types` basi dibersihkan.
- `npx eslint` pada master-data + library-service: 0 error.

## [Unreleased] - 2026-08-06 (Tooling — reset master data untuk uji coba)

### Tooling

- **`scripts/reset-masterdata.mjs`** (baru). Mengosongkan seluruh schema
  `master_data` supaya alur C10–C16 dan P3 bisa diuji dari nol.

  **HARD DELETE, tidak ada undo.** Dry-run secara default; `--apply` untuk
  menghapus, `--force` untuk melewati pemeriksaan awal.

  Mencakup seluruh 18 model `master_data` termasuk antrean kurasi
  (`MaterialCandidate`, `SampleCandidate`). `User`, `Project`, dan sisa schema
  `studioflow` tidak disentuh.

  **Pemeriksaan awal — alasan keberadaannya.** Lima kolom di schema `studioflow`
  menunjuk ke `master_data`, semuanya `SetNull`:

  ```
  ProjectProductRequest.brand_id / .sku_id / .linked_sample_id
  ProjectScheduleOption.sku_id / .spec_brand_id
  ```

  Jadi menghapus master data tidak diblokir dan tidak menghapus data proyek,
  tetapi **diam-diam mengosongkan tautannya** — dan itu tidak bisa dipulihkan
  dengan re-seed, karena baris baru punya UUID baru. Permintaan produk kehilangan
  jejak material yang diminta; opsi schedule kehilangan SKU-nya (`data_snapshot`
  tetap utuh, relasinya yang putus).

  Skrip karena itu **berhenti dan melapor** kalau menemukan baris proyek
  terdampak, dan hanya lanjut kalau nol — atau kalau `--force` diberikan sadar.

  **Urutan penghapusan** mengikuti arah foreign key, bukan abjad: empat relasi
  memakai `Restrict` (`SkuCategory`/`BrandCategory`→`Category`, `Sku`→`Brand`,
  `Sample`→`Sku`) sehingga menghapus induk lebih dulu akan ditolak database.
  Relasi `Cascade` tetap dihapus eksplisit supaya jumlahnya terlaporkan, bukan
  hilang senyap lewat cascade. Seluruhnya dalam satu transaksi.

  `SkuCategory` ditangani lunak — kalau migrasi C12 belum diterapkan, tabelnya
  belum ada dan skrip melewatinya alih-alih gagal.

### Verification

- Urutan hapus diverifikasi **secara programatik**, bukan dengan mata: parser
  membaca seluruh FK antar-model `master_data` dari `schema.prisma` dan
  memastikan setiap anak pada relasi `Restrict` berada sebelum induknya.
  Hasil: 4 FK wajib-urut diperiksa, 0 masalah; 18 dari 18 model `master_data`
  tercakup dalam urutan hapus (tidak ada yang tertinggal).
- `node --check` pada skrip: sintaks valid.


## [Unreleased] - 2026-08-06 (Master Data — audit regresi C10-C12 + P3-a/P3-b)

Audit atas perubahan C10/C11/C12 yang baru dikirim menemukan **empat cacat baru**
yang diperkenalkan oleh perbaikan itu sendiri. Semuanya diperbaiki di sini
sebelum P3 dikerjakan.

### Bug Fix — regresi dari C10-C12

- **C13 — `slugify` divergen → simpan Material bisa GAGAL TOTAL** (BLOCKER,
  `library-service.ts`). `slugifyTag` yang saya tulis untuk C10 **menghapus**
  karakter non-alfanumerik, sedangkan `slugify()` di
  `scripts/seed-brand-categories.mjs` **mengubahnya menjadi hyphen**:

  | tag | seed | C10 (salah) |
  |---|---|---|
  | `Kayu & Rotan` | `kayu-rotan` | `kayu--rotan` |
  | `ACP (Aluminium)` | `acp-aluminium` | `acp-aluminium` |

  Karena `Category.name` **juga** `@unique`, tag yang sudah pernah di-seed akan
  gagal dibuat ulang dengan slug berbeda — `create` melanggar constraint `name`,
  transaksi abort, dan **penyimpanan Material gagal seluruhnya**, bukan sekadar
  salah menaruh kategori.

  **Fix**: algoritma disamakan persis dengan seed (NFKD → strip diakritik →
  lowercase → runs non-alfanumerik jadi satu hyphen → trim hyphen). Diverifikasi
  identik pada 15 kasus uji termasuk `&`, `/`, `,`, `—`, tanda kurung, diakritik,
  spasi ganda, dan string non-ASCII penuh.

  Ditambah `resolveCategoryRow()` yang mencari lewat **slug MAUPUN name** sebelum
  membuat baris. `Category` punya dua kolom unik, jadi upsert berbasis slug saja
  memang tidak pernah aman.

- **C14 — harga hilang diam-diam** (`MasterDataProductDialog.tsx`).
  `upsertSkuMaterialPriceAction` dipanggil tanpa `unwrapActionResult`, sehingga
  `ActionResult` yang gagal lewat begitu saja: Material tersimpan, harga tidak,
  dan user tetap melihat toast sukses.

  **Fix**: hasil di-unwrap, dan kegagalannya ditangani terpisah dari kegagalan
  penyimpanan Material — pesannya kini "Material tersimpan, tetapi harga gagal
  disimpan: …" supaya user tidak menyimpan ulang seluruh form.

  Sekalian: izin `upsertSkuMaterialPriceAction` diselaraskan dengan
  `create/updateProductAction`. Sebelumnya action harga menuntut
  `MASTERDATA_SKU_MANAGE` sementara penyimpanan Material hanya menuntut
  `LIBRARY_CREATE_ITEM`/`LIBRARY_EDIT_ITEM`. Hari ini ADMIN/DEVELOPER/STAFF
  memegang keduanya sehingga tidak terlihat, tetapi menyandarkan kebenaran pada
  kebetulan matriks peran adalah jebakan untuk perubahan peran berikutnya.

- **C15 — baris harga yatim setelah Material dihapus** (`library-service.ts`).
  Sebelum C11 hal ini tidak masalah: harga tersimpan di kolom inline pada baris
  `Sku` yang sama, jadi ikut terhapus. Setelah C11 harga ada di baris
  `MaterialPrice` tersendiri, dan `deleteProduct` tidak menyentuhnya — tab Harga
  Material menampilkan harga milik Material yang sudah dihapus.

  **Fix**: `deleteProduct` ikut soft-delete `MaterialPrice` yang `sku_id`-nya
  menunjuk SKU tersebut, jumlahnya dicatat di audit log. Harga level brand
  (`sku_id = null`) sengaja tidak disentuh — itu milik brand, bukan milik
  Material yang kebetulan dihapus.

- **C16 — `SkuCategory` tidak pernah direkonsiliasi** (`library-service.ts`).
  `upsertSkuCategories` hanya menambah, jadi tag yang dilepas dari sebuah SKU
  menyisakan baris kategori basi selamanya.

  **Fix**: baris untuk kategori di luar `catalog_tags` terkini dihapus.
  Aman dilakukan di sini — `SkuCategory` tabel baru yang hanya ditulis oleh
  method ini, jadi tidak ada data seed atau kurasi manual yang bisa hilang.

  **`BrandCategory` sengaja TETAP hanya-menambah** dan ini dicatat sebagai batasan
  yang diketahui, bukan kelalaian: tabel itu juga diisi
  `seed-brand-categories.mjs` dari kandidat kurasi, termasuk untuk brand yang
  belum punya SKU. Baris hasil seed tidak bisa dibedakan dari baris turunan SKU,
  jadi merekonsiliasi terhadap tag SKU akan menghapus keputusan manusia.
  Konsekuensi yang diterima: brand bisa tetap muncul di kategori yang tag
  terakhirnya sudah dilepas. Dicatat di roadmap sebagai pekerjaan tersendiri.

- **Regresi C8 nyaris terulang** (`MasterDataProductDialog.tsx`). Prop
  `initialPrice` dibaca di dalam `useEffect` tetapi tidak ada di dependency array
  — persis cacat C8 yang baru diperbaiki. Memasukkan objeknya langsung tidak bisa
  (literal baru tiap render → efek berjalan terus dan menimpa ketikan user).

  **Fix**: dipecah jadi tiga skalar (`before`, `after`, `unit`) yang stabil antar
  render sekaligus tetap reaktif. Terdeteksi `react-hooks/exhaustive-deps`.

### Feature — P3-a: Backfill Perusahaan

- **`previewBrandCompanyBackfillAction` + `applyBrandCompanyBackfillAction`**
  (`company-actions.ts`) dan **`BrandCompanyBackfillDialog.tsx`** (baru).

  392 brand tanpa Company terlalu banyak untuk dikerjakan satu per satu, tetapi
  juga terlalu banyak untuk dieksekusi tanpa dilihat dulu. Alurnya dipisah dua
  langkah: server menyusun rencana pengelompokan, staff memeriksa dan mencentang,
  baru dijalankan.

  - Pengelompokan **case-insensitive**, titik dibuang, spasi dirapatkan. Tanpa
    ini `"PT Tangkas Cipta Optimal"`, `"pt. tangkas cipta optimal"` dan
    `"PT  TANGKAS   CIPTA OPTIMAL"` melahirkan tiga Company terpisah — backfill
    justru meninggalkan duplikat yang lebih sulit dirapikan daripada keadaan awal.
    Diverifikasi: tiga ejaan menyatu jadi satu grup.
  - Normalisasi hanya untuk **pengelompokan**; yang disimpan tetap ejaan asli.
  - Company yang sudah ada dicocokkan lewat `name` **maupun** `legal_name` —
    sebuah PT bisa terdaftar dengan nama dagangnya sementara brand menyimpan nama
    legalnya.
  - Grup yang cocok dengan Company existing **dicentang otomatis** (murni
    penyambungan); grup yang akan **membuat** Company dibiarkan kosong supaya
    dipilih sadar.
  - Grup dibentuk ulang dari data terkini saat apply, tidak dipercaya dari klien —
    preview bisa sudah basi.
  - `Brand.legal_name` **tidak** dikosongkan di sini; itu P3-b.
  - Tombol "Backfill (N)" hanya muncul selama masih ada brand tanpa perusahaan,
    jadi tidak meninggalkan aksi sekali-pakai yang menetap di header.

### Feature — P3-b: Pindahkan badan usaha ke Company

- **`scripts/move-brand-legal-name-to-company.mjs`** (baru). **Dry-run default**,
  `--apply` untuk menulis. Per brand yang punya `company_id` dan `legal_name`:

  1. `Company.legal_name` kosong → diisi, `Brand.legal_name` dikosongkan.
  2. Sama persis (setelah normalisasi) → duplikat, brand dikosongkan.
  3. **Berbeda → KONFLIK, tidak ada yang disentuh**, dilaporkan untuk diputuskan.

  Aturan 3 yang membuat skrip ini aman: menimpa `Company.legal_name` membuang
  badan usaha yang mungkin sudah diverifikasi, dan mengosongkan `Brand.legal_name`
  membuang satu-satunya bukti keduanya pernah berbeda. Perbedaan hampir selalu
  berarti pengelompokan P3-a keliru, bukan datanya yang perlu dirapikan.
  Seluruh penulisan dalam satu transaksi.

### Verification

- `npx tsc --noEmit` exit 0, zero errors.
- `npx eslint src/subapps/master-data/ library-service.ts` — 0 error
  (1 warning pre-existing di `SampleLibraryClient.tsx`, di luar cakupan).
- Paritas `slugify` seed ↔ service diverifikasi pada 15 kasus uji: identik.
- Logika pengelompokan backfill diverifikasi: 3 ejaan berbeda → 1 perusahaan.


## [Unreleased] - 2026-08-06 (Master Data — C10/C11/C12 + SKU picker searchable)

### Feature

- **SKU picker searchable** (`HargaClient.tsx` + `SkuPicker.tsx` baru).
  Field "SKU / Material" di dialog Tambah/Edit Harga Material sebelumnya adalah
  `<select>` biasa. Dengan daftar SKU per brand yang bisa ratusan item, memilih
  lewat dropdown tidak praktis. Diganti ke combobox searchable (pola identik
  `CompanyPicker` / `ServiceVendorPicker`): ketik SKU atau nama produk → filter
  real-time → pilih. Opsi "Tidak terhubung ke SKU" tetap tersedia sebagai clear.

### Improvement

- **C10 — Library buta terhadap kategori Material** (`library-service.ts`).
  `Library` membaca `BrandCategory` untuk category search, sedangkan Materials
  menyimpan kategori di `catalog_tags` String[] tanpa pernah menyentuh
  `BrandCategory`. Brand baru yang punya Material tidak muncul di pencarian
  Library sampai seseorang membuat `BrandCategory` secara manual.

  **Fix**: tambah helper privat `upsertBrandCategories(tx, brandId, tags)` di
  `LibraryService`. Dipanggil di `createProduct` dan `updateProduct` setiap kali
  SKU disimpan. Untuk setiap tag: upsert `Category` (keyed by slug), upsert
  `BrandCategory` (brand_id + category_id, sort_order = index dalam tags[]).
  Tidak ada migrasi diperlukan.

- **C11 — hentikan tulis ke `Sku.catalog_price*`** (`MasterDataProductDialog.tsx`,
  `pricing-actions.ts`).
  Dialog Material sebelumnya mengirim harga dalam payload `createProductAction` /
  `updateProductAction` → `LibraryService` menulis ke kolom inline
  `catalog_price / catalog_vendor_price / catalog_price_unit`. Harga kemudian
  muncul sebagai `SKU_INLINE` (badge "harga lama") di tabel Materials.

  **Fix**:
  - Harga dikeluarkan dari payload utama — `catalog_price*` tidak lagi disentuh
    dari jalur dialog Material.
  - Setelah SKU berhasil disimpan, dialog memanggil action baru
    `upsertSkuMaterialPriceAction` yang upsert baris `MaterialPrice` dengan
    `sku_id` yang tepat.
  - Dialog membaca harga awal dari `initialPrice` prop (diisi dari `MaterialRow`
    lewat `material-view-service`, yang sudah membaca `MaterialPrice`).
  - Akibatnya: setiap Material yang disimpan lewat dialog sekarang punya harga
    di `MaterialPrice` (sumber `MATERIAL_PRICE_SKU`), bukan di kolom inline.

### Schema

- **C12 — `SkuCategory` join table** (`prisma/schema.prisma`,
  `prisma/migrations/20260806120000_add_sku_category/migration.sql`).
  Model `SkuCategory` ditambahkan: join antara `Sku` dan `Category`, pola identik
  `BrandCategory`. Tujuan: menggantikan `Sku.catalog_tags String[]` (free-text
  legacy §6.12) dengan vocabulary terkunci (slug-stable, shared dengan BrandCategory).

  `catalog_tags` TIDAK dihapus — library-service.ts dan schedule-snapshot masih
  membacanya. Peralihan read path dan drop kolom dijadwalkan sebagai P2-c follow-up.

  Write path (`LibraryService.createProduct` + `updateProduct`) sudah memanggil
  helper `upsertSkuCategories` (no-op sampai migrasi diterapkan + `prisma generate`
  dijalankan lokal).

  **Langkah aktivasi C12 di mesin lokal:**
  ```
  npx prisma migrate deploy   # terapkan 20260806120000_add_sku_category
  npx prisma generate         # perbarui generated client
  node scripts/backfill-sku-categories.mjs  # isi SkuCategory dari catalog_tags
  ```

### Verification

- `npx tsc --noEmit` exit 0, zero errors.

---

## [Unreleased] - 2026-08-06 (Master Data — perbaikan cacat logika menyeluruh)

Dokumentasi hasil audit: `docs/SKEMA-MASTER-DATA.xlsx` (6 sheet: Ringkasan, Peta
Model, Relasi, Cacat & Perbaikan, Aturan Kolom, Sisa Pekerjaan).

### Bug Fix

- **C2 — regresi dari perbaikan P0 sebelumnya** (`material-view-service.ts`).
  Perbaikan P0 memindahkan pembacaan harga sepenuhnya ke `MaterialPrice`,
  padahal `MasterDataProductDialog` masih menulis harga ke kolom inline
  `Sku.catalog_vendor_price / catalog_price / catalog_price_unit`. Akibatnya
  harga yang diisi lewat dialog Material menjadi tidak terlihat sama sekali —
  gejalanya sama persis dengan bug yang baru saja diperbaiki, hanya arahnya
  terbalik.

  **Fix**: pembacaan harga menerima ketiga sumber dengan urutan prioritas dan
  syarat kelengkapan:
  1. `MaterialPrice` yang `sku_id`-nya menunjuk SKU ini
  2. `MaterialPrice` level brand (`sku_id = null`)
  3. kolom inline `Sku.catalog_price*` (legacy §6.12)

  Sumber yang lebih spesifik hanya dipakai bila **lengkap** (before, after, dan
  unit terisi). Ini mencegah satu baris harga setengah jadi menutupi harga
  lengkap yang tersimpan di tempat lain. Bila tidak ada yang lengkap, angka
  parsial tetap ditampilkan agar isian staff tidak hilang dari layar.

- **C3 — harga yang menang tidak deterministik** (`material-view-service.ts`).
  `prisma.materialPrice.findMany` dipanggil tanpa `orderBy`. Ketika satu SKU
  atau brand punya lebih dari satu baris harga, baris mana yang menang
  bergantung pada urutan yang dikembalikan database — bisa berubah antar
  request, dan harga lama bisa mengalahkan harga baru.

  **Fix**: `orderBy: [{ valid_from: { sort: "desc", nulls: "last" } }, { created_at: "desc" }]`.
  Harga dengan `valid_from` terbaru selalu menang; `created_at` menjadi pemecah
  seri untuk baris tanpa `valid_from`.

- **C5 — kategori duplikat di dropdown filter** (`material-view-service.ts`).
  Daftar kategori dibangun dengan `new Set(flatMap(categoryTags))` yang
  case-sensitive, sedangkan filternya membandingkan lewat `normalize()`.
  "Sanitary" dan "sanitary" muncul sebagai dua opsi yang menghasilkan baris
  identik — opsi kedua menyesatkan.

  **Fix**: dedupe case-insensitive. Label yang ditampilkan adalah varian yang
  paling sering muncul di data (bukan yang kebetulan terbaca duluan), sehingga
  casing dominan yang menang.

### Schema (komentar saja — tidak ada perubahan struktur)

- **C4 — `Sku.catalog_brand`** (`prisma/schema.prisma`). Komentar lama berbunyi
  "Commercial Brand/Manufacturer, distinct from the Vendor relation", padahal
  seluruh jalur tulis mengisinya dari `brand.brand_name`
  (`MasterDataProductDialog.resolvedBrandName`, `sample-request-actions`,
  `curation-actions`) dan UI menandai perbedaan keduanya sebagai data drift.
  Schema dan kode menyatakan aturan yang berbeda.

  Komentar dikoreksi: `catalog_brand` adalah **salinan denormalisasi** dari
  `Brand.brand_name`, selalu diturunkan pada saat menyimpan, tidak pernah
  diketik user. Alasan kolom ini tidak bisa dihapus ikut dicatat (bagian dari
  unique key `(vendor_id, catalog_brand, catalog_sku)` dan dibekukan sebagai key
  JSON di `ProjectScheduleOption.data_snapshot`).

### UI Changes

- **`MaterialRow.priceSource`** (tipe baru `MaterialPriceSource`):
  `MATERIAL_PRICE_SKU` | `MATERIAL_PRICE_BRAND` | `SKU_INLINE` | `NONE`.
  Selama dua jalur harga masih hidup berdampingan, staff perlu tahu baris mana
  yang masih memakai jalur lama.

- **`PriceSourceBadge`** (`MasterDataMaterialsClient.tsx`): penanda kecil di
  bawah angka harga. Sumber normal (`MATERIAL_PRICE_SKU`) tidak diberi badge —
  hanya yang menyimpang yang ditandai, supaya tabel tidak penuh label:
  - `harga brand` (abu) — berasal dari harga level brand, bukan harga khusus material ini
  - `harga lama` (amber) — masih di kolom legacy, perlu dipindahkan ke tab Harga

- **Indikator drift `catalog_brand`** diperjelas: dari `tersimpan: X` menjadi
  `⚠ perlu diselaraskan: X` dengan tooltip yang menjelaskan penyebab dan cara
  memperbaikinya (buka lalu simpan lewat dialog Material).

- **C8 — izin yang berubah tidak tercermin saat dialog terbuka**
  (`MasterDataVendorDialog.tsx`, `CompanyDialog.tsx`). `React.useEffect` yang
  menentukan `isEditing` membaca `canManage` di dalam badan efek, tetapi
  `canManage` tidak terdaftar di dependency array. Bila izin berubah saat
  dialog sedang terbuka, dialog tetap pada mode lamanya sampai ditutup dan
  dibuka ulang.

  **Fix**: `canManage` ditambahkan ke dependency array pada kedua dialog.
  Terdeteksi lewat `react-hooks/exhaustive-deps`.

- **C9 — pelanggaran lapisan UI Engine** (`MasterDataVendorDialog.tsx`).
  `Sheet` diimpor langsung dari `@/components/ui/sheet`, melanggar
  `no-restricted-imports`: hanya `src/ui_engine/**` yang boleh menjangkau
  `@/components/ui/*`. Aturan ini yang mencegah satu halaman ter-render dengan
  token berbeda dari halaman lain (MASTER_SSOT §8 Issue 7).

  Penyebabnya: `sheet` memang belum terdaftar di
  `src/ui_engine/primitives/index.ts` saat konversi Dialog → Sheet dilakukan.

  **Fix**: `export * from "@/components/ui/sheet"` ditambahkan ke primitives
  index, lalu impor di `MasterDataVendorDialog` diarahkan ke `@/ui_engine`.

### Documentation

- **`docs/SKEMA-MASTER-DATA.xlsx`** (file baru): peta lengkap Master Data —
  10 model dan perannya, tabel relasi beserta perilaku saat induk dihapus
  (Cascade / Restrict / SetNull diberi warna), 12 cacat logika dengan status,
  aturan pakai untuk 9 kolom yang mudah disalahartikan, dan 5 butir sisa
  pekerjaan. Sheet Cacat memakai dropdown status dengan penghitung otomatis.

### Verification

- `npx tsc --noEmit` exit 0, zero errors.
- `npx eslint src/subapps/master-data/` — zero errors (1 warning pre-existing
  di `SampleLibraryClient.tsx`, di luar cakupan perubahan ini).
- Tidak ada migrasi database. Tidak ada perubahan struktur schema — hanya komentar.
- Workbook diverifikasi: 3 formula, 0 error, hasil hitung sesuai (10 model,
  9 cacat selesai, 3 terbuka).



## [Unreleased] - 2026-08-06 (Master Data — P0/P1: bqReady fix + Supplier Jasa tab + Badan usaha kondisional)

### Bug Fix

- **`material-view-service.ts`** (P0-a + P0-b): `bqReady` sebelumnya membaca dari
  `Sku.catalog_price`, `catalog_vendor_price`, `catalog_price_unit` (kolom inline
  legacy §6.12). Tab "Harga Material" menulis ke tabel `MaterialPrice` (§6.14) —
  dua sistem terpisah. Akibatnya: seluruh 172 material menunjukkan "Harga belum
  lengkap" meski harga sudah diisi di tab Harga.

  **Fix**: fetch `MaterialPrice` (parallel dengan query Sku), bangun dua lookup map:
  - `skuPriceMap[sku_id]` — harga SKU-spesifik (prioritas)
  - `brandPriceMap[brand_id]` — fallback brand-level (`sku_id = null`)

  `bqReady` kini benar: `price_before_discount != null && price_after_discount != null && unit != null`
  dari `MaterialPrice`. Kolom `Sku.catalog_price*` tidak diubah, tidak dihapus —
  masih dipakai oleh kode lain (§6.12 path). Tidak ada migrasi database.

  `MaterialRow.priceBeforeDiscount/priceAfterDiscount/priceUnit` sekarang diisi
  dari `MaterialPrice` — kolom harga di `MasterDataMaterialsClient` menampilkan
  harga yang benar tanpa perubahan komponen.

### UI Changes

- **`SupplierClient.tsx`** (P1-a): tambah tab bar "Material | Jasa".
  - Tab **Material** = konten lama (Company + Brand table, filter, sort).
  - Tab **Jasa** = `SupplierJasaTab` — CRUD ServiceVendor (tukang / kontraktor).
    Dipindah dari `HargaClient` Tab 4. State dikelola mandiri di dalam tab.
  - Props baru: `serviceVendors: ServiceVendorData[]`.
  - `TABS` array: count masing-masing tab ditampilkan di tab bar.

- **`suppliers/page.tsx`**: tambah `getServiceVendorsAction` ke `Promise.all`,
  pass `serviceVendors` ke `SupplierClient`.

- **`HargaClient.tsx`** (P1-a): Tab ke-4 "Tukang / Vendor" dihapus.
  - `HargaVendorTab` component dihapus.
  - `type Tab` kembali tiga nilai: `"material" | "material-upah" | "upah"`.
  - Lifted `vendors` state dihapus — `serviceVendors` prop di-pass langsung ke Tab 2 & 3.
  - Deskripsi halaman diperbarui: menyebut "Kelola tukang/vendor di Supplier → tab Jasa".
  - Import `Users`, `createServiceVendorAction`, `deleteServiceVendorAction`,
    `updateServiceVendorAction`, `ServiceVendorInput` dihapus dari file.

- **`MasterDataVendorDialog.tsx`** (P1-b): field "Badan usaha (PT/CV)" kondisional:
  - Jika `company_id` terisi → tampilkan `company.legal_name` read-only, label
    diberi suffix "(dari Perusahaan)". Brand bukan entitas legal tersendiri; field
    input disembunyikan untuk menghindari duplikasi data.
  - Jika `company_id` kosong → tampilkan input `Brand.legal_name` seperti sebelumnya,
    label diberi suffix "(opsional, jika brand belum punya perusahaan)".
  - Tidak ada perubahan schema atau action — murni presentasi layer.

### Verification

- `npx tsc --noEmit` exit 0, zero errors setelah semua perubahan.
- Tidak ada migrasi database, tidak ada action baru.
- `getServiceVendorsAction` sudah ada di `pricing-actions.ts`.



## [Unreleased] - 2026-08-06 (Master Data — UX/UI optimization)

### UI Changes

- **MasterDataVendorDialog** (`isEditing`): STAFF (`canManage=true`) sekarang
  langsung masuk edit mode saat klik baris Brand — tidak perlu klik "Modify"
  ekstra. View-First read-only tetap berlaku untuk role non-manager (desainer,
  owner dari konteks library). Perubahan: satu baris di `useEffect` open.

- **CompanyDialog** (`isEditing`): Sama — STAFF langsung edit mode. Konsisten
  dengan perubahan VendorDialog di atas.

- **CompanyPicker** (file baru `CompanyPicker.tsx`): Searchable combobox untuk
  memilih Company di Brand form. Menggantikan `<select>` HTML native yang tidak
  bisa di-search. Pola identik dengan `MasterDataVendorPicker.tsx` — type-to-
  search by name + legal_name, keyboard Enter select, Escape tutup, clear option
  ("— Tidak ada —") tersedia. Dipakai di `MasterDataVendorDialog`.

- **MasterDataVendorsClient** — 4 perubahan sekaligus:
  1. *Optimistic update*: local `vendors` state + `handleSaved` — setelah save
     dialog atau inline assign, tabel update langsung tanpa tunggu `router.refresh()`.
     Konsisten dengan pola di `CompanyClient.tsx`.
  2. *Compact table 4 kolom*: dari 6 kolom (Brand | Perusahaan | Badan Usaha |
     Link | Kontak | Aksi) menjadi 4 (Brand | Supplier | Link | Kontak | Aksi).
     Kolom "Supplier" menggabungkan Company.name + Brand.legal_name stacked.
  3. *Icon-only links* (`LinkIcons` component): teks URL panjang diganti ikon
     per jenis link (Globe=website, MessageCircle=WhatsApp, ShoppingBag=marketplace,
     BookOpen=katalog, FolderOpen=drive, ExternalLink=fallback). Deduplicated by
     kind, max 4 ikon. Tooltip menampilkan label + URL asli.
  4. *Inline Company picker* (`InlineCompanyCell` component): brand yang belum
     punya Company menampilkan tombol "— assign —" (border dashed) di kolom
     Supplier. Klik → `CompanyPicker` muncul in-place → pilih → `updateVendorAction`
     auto-save → optimistic update. Menghilangkan kebutuhan buka dialog hanya
     untuk assign company (backfill 392 brand).

- **CompanyPicker** (bug fix): icon Search overlap dengan placeholder text karena
  `left-[calc(var(--ui-section-px)/2)]` dan `pl-[calc(var(--ui-section-px)*1.75)]`
  tidak reliable di semua render context. Diganti `left-3` + `pl-9` (fixed Tailwind
  class, konsisten dengan search input lain di project).

- **Sheet** (file baru `src/components/ui/sheet.tsx`): slide-over panel dari kanan
  berbasis Radix Dialog primitives yang sudah ada. API: `Sheet`, `SheetContent`,
  `SheetHeader`, `SheetBody`, `SheetFooter`, `SheetTitle`. Full-height, overflow
  scroll di `SheetBody`, animasi slide-in/out dari kanan.

- **MasterDataVendorDialog** → dikonversi dari `Dialog` ke `Sheet`. Konten panjang
  (contacts[], links[], address, notes) tidak lagi terpotong `max-h-90vh`.
  Header brand name + Modify button di `SheetHeader` (sticky atas), form di
  `SheetBody` (scrollable), tombol Simpan di `SheetFooter` (sticky bawah).

### Verification

- `npx tsc --noEmit` exit 0, zero errors di semua file yang diubah.
- Tidak ada perubahan schema Prisma, migration, atau server action baru.
- `updateVendorAction` yang dipakai `InlineCompanyCell` sudah ada di
  `library-actions.ts` — tidak ada action baru.

## [Analysis] - 2026-08-06 (Master Data — audit skema menyeluruh)

Tidak ada perubahan kode pada entri ini — hanya analisa dan dokumentasi.
Dokumen lengkap: `docs/ANALISA-MASTER-DATA-SKEMA.md`

### Temuan

1. **🔴 Harga material tersimpan di dua tempat** (bug aktif). `Sku.catalog_price`,
   `catalog_vendor_price`, `catalog_price_unit` (inline, legacy §6.12) vs tabel
   `MaterialPrice` (§6.14). `material-view-service.ts` menghitung `bqReady` dari
   kolom inline, sedangkan Tab "Harga Material" menulis ke `MaterialPrice`.
   Inilah penyebab statistik "Harga belum lengkap: 172 dari 172". Perbaikan tidak
   memerlukan migrasi database.

2. **🟠 Tiga sistem kategori paralel**. `Category`+`BrandCategory` (kanonik,
   level brand), `Sku.catalog_tags` (free text, level produk), dan kolom
   `category` free-text di tabel harga. Pembalikan free-tag yang dilakukan §6.14
   hanya diterapkan di level brand; level produk masih rawan drift
   ("Sanitary"/"sanitary").

3. **🟡 `Brand.legal_name` duplikat `Company.legal_name`** setelah R7. Redundansi
   transisi, bukan cacat desain — brand tanpa Company masih membutuhkan kolomnya.

4. **🟡 ServiceVendor terpisah dari halaman Supplier**. Masalah navigasi, bukan
   schema. Merge schema `Company` + `ServiceVendor` ditolak: beda kedalaman
   (3 vs 2 level), beda struktur kontak (tabel terpisah vs kolom flat).

### Peta yang diusulkan

| Halaman | Menjawab | Owner data |
|---------|----------|------------|
| Supplier | Siapa | Company, Brand, ServiceVendor |
| Materials | Apa | Sku, Sample |
| Harga | Berapa | MaterialPrice, MaterialLaborPrice, ServicePrice |
| Kategori | Klasifikasi | Category + join tables |

### Yang dikonfirmasi sudah benar

- `MaterialPrice` / `MaterialLaborPrice` / `ServicePrice` — tiga skema BQ berbeda
- `MaterialPrice.sku_id` nullable — mayoritas price-list tidak punya SKU
- `ServicePrice.service_vendor_id` NULL — berarti "harga internal", bukan data hilang
- `Sku.catalog_brand` vs `Brand.brand_name` — merek komersial vs relasi supplier
- `CompanyContact`/`CompanyLink` terpisah dari level Brand

## [Unreleased] - 2026-08-06 (Master Data — Harga: ServiceVendor tab level atas)

### Problem

`ServiceVendor` (tukang/kontraktor) dipakai oleh Tab 2 "Material+Upah" dan Tab 3
"Harga Upah", tapi manajemennya tersembunyi sebagai sub-tab di dalam Tab 3.
User harus tahu harus ke tab 3 → sub-tab "Daftar Tukang" — tidak discoverable.

### Changes

- **`ServiceVendorPicker.tsx`** (file baru): searchable combobox untuk memilih
  ServiceVendor di form. Pola identik `CompanyPicker` — search by name + trade,
  keyboard Enter/Escape, clear option "— Harga internal —". Menggantikan native
  `<select>` yang tidak bisa di-search.

- **`HargaClient.tsx`** — empat perubahan sekaligus:
  1. *Tab ke-4 "Tukang / Vendor"*: `HargaVendorTab` component dipindah dari
     sub-tab di dalam `HargaUpahTab` ke tab tersendiri di level atas, sejajar
     dengan Harga Material, Material+Upah, dan Harga Upah.
  2. *Shared `vendors` state*: `serviceVendors` state di-lift ke `HargaClient`.
     Tab 2 dan Tab 3 menerima vendor list yang sama via props. Vendor baru yang
     ditambah di Tab 4 langsung tersedia di picker Tab 2 dan Tab 3 tanpa reload.
  3. *`HargaVendorTab`*: menerima `onVendorSaved` callback — memanggil
     `handleVendorSaved` di parent untuk update shared state.
  4. *Sub-tab dihapus dari `HargaUpahTab`*: tidak lagi punya "Daftar Harga" /
     "Daftar Tukang / Vendor" — hanya tabel harga upah + dialog.

### Verification

- `npx tsc --noEmit` exit 0, zero errors.
- Tidak ada perubahan schema, action, atau API — hanya presentasi layer.

## [Unreleased] - 2026-08-06 (Master Data — Supplier flat sortable table)

### UI Changes

- **SupplierClient** rewrite #2 — flat sortable filterable table:
  - Satu flat `TableCard` berisi semua brand (tidak ada grouping / collapse /
    section per company). Konsisten dengan `CompanyClient` dan `MasterDataVendorsClient`.
  - Kolom: **Brand** | **Perusahaan** | **PT / CV** | **Link** | **Kontak** | **Aksi**.
  - **Indikator belum dilengkapi**: dot amber `●` (size-1.5, `bg-amber-400`) tampil
    di sebelah kiri nama brand jika `company_id === null`. Tooltip "Perusahaan belum
    dilengkapi". Menggantikan pendekatan collapse section "Belum ditentukan".
  - **Sort per kolom**: `SortButton` + `ArrowUpDown` icon di header Brand, Perusahaan,
    PT/CV. Toggle asc/desc. State: `sortKey` + `sortDir`.
  - **Filter toolbar** (di atas tabel):
    - Search input (teks — brand_name, legal_name, company.name)
    - Dropdown "Perusahaan": Semua / per company / "Belum ditentukan (N)"
    - Dropdown "Status": Semua / Lengkap / Belum dilengkapi
  - **Inline CompanyPicker** tetap ada di kolom Perusahaan untuk brand unassigned
    (klik "— assign —" → searchable picker → auto-save).
  - **Klik nama perusahaan** di kolom Perusahaan → buka `CompanyDialog` edit,
    jika `canManageCompanies`. Tidak perlu tombol edit terpisah per perusahaan.
  - `BrandRow`, `CompanySection`, `UnassignedSection`, `groupVendors` helper
    dihapus — tidak lagi diperlukan.

### Verification

- `npx tsc --noEmit` exit 0, zero errors.
- Semua action, type, dan import tidak berubah — hanya presentasi layer.

## [Unreleased] - 2026-08-06 (Master Data — Supplier unified view, no tabs)

### UI Changes

- **SupplierClient** — tab Brand | Perusahaan dihapus. Diganti satu halaman:
  - Company tampil sebagai section header (ikon Building2, nama, PT/CV, kontak,
    brand count, edit/hapus company).
  - Brand tampil sebagai rows di bawah company-nya masing-masing.
  - Section "Belum ditentukan" — kolapsibel (default terbuka jika ≤20 brand,
    tertutup jika lebih) — untuk brand yang belum punya company. Di section ini
    kolom "Perusahaan" tampil dengan inline assign picker.
  - Single search bar: mencakup brand_name, legal_name, company.name.
  - Header actions: `+ Perusahaan` (outline) dan `+ Brand` (primary) berdampingan.
  - Optimistic update untuk kedua entitas (vendor + company) dalam satu state.

- **SupplierSharedCells.tsx** (file baru): `LinkIcons` dan `ContactCell` dipindah
  dari `MasterDataVendorsClient` ke file shared — dipakai oleh `SupplierClient`
  dan `MasterDataVendorsClient` tanpa duplikasi.

- **suppliers/page.tsx**: hapus `initialTab` dan `searchParams` yang tidak lagi
  relevan setelah tab dihapus. Komentar di-update.

### Verification

- `npx tsc --noEmit` exit 0, zero new errors.
- Tidak ada schema change. Semua action yang dipakai sudah ada sebelumnya.

## [Analysis] - 2026-08-06 (Master Data — UX/UI optimization review)

### Analisis UX — perspektif STAFF

Audit interaksi tiap komponen Master Data berdasarkan kode aktual. Tidak ada
perubahan kode pada sesi ini — hanya analisis dan dokumentasi roadmap.

**Temuan utama (tanpa regresi database):**

1. `MasterDataVendorDialog` dan `CompanyDialog`: `isEditing` selalu mulai
   `false` untuk mode EDIT, padahal STAFF (`canManage=true`) selalu bisa edit.
   Fix: `setIsEditing(mode === 'CREATE' || canManage)` — satu baris, hemat
   satu klik per interaksi. View-First tetap berlaku untuk desainer.

2. Company picker di Brand form pakai `<select>` HTML native — tidak bisa
   search. Harus diganti Popover+Command (shadcn, sudah ada di project),
   sama pola dengan `MasterDataVendorPicker.tsx`.

3. Backfill 392 Brand → Company butuh inline picker di tabel row (klik cell
   "—" di kolom Perusahaan → searchable dropdown in-place → auto-save via
   `updateVendorAction`). Tanpa ini STAFF harus buka dialog 392×.

4. `MasterDataVendorsClient` tidak punya optimistic update setelah save
   (langsung `router.refresh()`). `CompanyClient` sudah benar (handleSaved
   pattern). Perlu disamakan.

5. Brand table 6 kolom bisa dipadatkan jadi 4: merge "Perusahaan" +
   "Badan Usaha" → satu kolom stacked; Links → icon-only; Kontak → first+N.

6. Brand dialog cocok diganti Sheet (slide-over) karena konten panjang
   sering overflow `max-h-90vh`.

**Keputusan pola interaksi:**
- Dialog: tetap untuk Brand, Company, SKU (multi-field kompleks)
- Sheet: rekomendasi untuk Brand dialog (konten panjang)
- Inline edit: hanya Company assignment di Brand table row (backfill use case)
- Searchable combobox: wajib untuk semua FK picker (Company, Brand, Category)

Prioritas dan file target dicatat di `roadmap.txt` §3.

## [Analysis] - 2026-08-06 (Master Data — Brand vs Company schema review)

### Analisis / Design Decision

- Dikaji ulang hubungan model `Brand` dan `Company` di schema `master_data`
  berkenaan dengan pertanyaan: apakah keduanya redundant, dan apakah bisa
  di-merge secara paging UI.

- **Kesimpulan: tidak redundant.** `Company` adalah legal/trading entity
  (PT/CV/Group) yang memiliki satu atau lebih `Brand`. Contoh: "TACO Group"
  → owns "TACO". Sebelum R7 yang redundant adalah `Brand.company_name` +
  `company_pt` (dua kolom untuk satu fakta yang sama) — R7 (2026-08-05)
  sudah memisahkannya ke model `Company` yang proper.

- **Bisa di-merge secara paging** meski ada dua model, karena keduanya
  berada di schema `master_data` pada satu PostgreSQL instance — JOIN via
  `Brand.company_id` FK valid dan efisien. Bukan "database terpisah" dalam
  arti instance berbeda.

- **Status saat ini:** 392 Brand, 0 Company. Backfill `Brand.company_id`
  harus manual via UI — UI untuk CRUD Company di tab "Perusahaan" belum
  ada kontennya.

- Roadmap tiga fase sudah dicatat di `roadmap.txt` §3:
  (a) CRUD Company di tab Perusahaan,
  (b) assign Company dari Brand form,
  (c) merged grouped view setelah data Company terisi.

## [Unreleased] - 2026-08-03 (Phase waiting-time runtime stabilization)

### Data / schema

- Applied additive migration `20260803120000_add_phase_status_changed_at` to
  the local `studioflow` database after creating and restore-list verifying
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_phase_status_timestamp_20260803_171353.dump`
  (949,680 bytes; SHA-256
  `C160E34C7B08EFF75B4B43400022F1ED8A8DBCA1AE072A2076235990AB252996`).
- `Phase.status_changed_at` is nullable by contract. The migration backfilled
  20 of 55 phases from the latest surviving phase-transition AuditLog row;
  the remaining 35 stay `NULL` and therefore show no invented duration.
- Prisma Client was regenerated only after the stale dev server was stopped.
  Migration status is current and the database-to-schema diff is empty.
- Aligned `docker-compose.yml` with the actual persistent local database:
  service `db`, PostgreSQL 15, volume `studioflow_postgres_data`, and host port
  `5432`. This now matches `.env`, `prisma.config.ts`, and
  `src/core/platform/db.ts`; the obsolete `version` key and unused second
  container definition on port `5433` were removed.

### Fixed

- Completed the `TopHeader` cross-app link contract already passed by the
  dashboard layout, so ADMIN/OWNER can reach Master Data and BQ without a
  TypeScript failure.
- Propagated `projectId` and `phaseId` through `DeliverablesTable` into the
  deliverable uploader. Uploaded files now have the project/phase/revision
  path context required by the shared media endpoint.
- Removed four unreachable per-SKU Library UI files left behind after
  `/extensions/library` was retired. Active `/library` and `/masterdata`
  surfaces are unchanged; the removal only prevents dead legacy contracts
  from failing repository-wide type checking.

### UI Changes

- The StudioFlow top bar now renders the existing role-filtered Master Data and
  BQ links. It uses the existing `Button` primitive and semantic design tokens;
  no layout structure, radius token, color token, shadow, or animation changed.
- Project and phase pages now render the persisted phase reading (status,
  owner, and known duration) without a full-page reload.

### Verification

- `npx prisma validate`, `npx prisma generate`, `npx prisma migrate status`,
  and zero-drift `prisma migrate diff` pass.
- `docker compose config --quiet` passes and `docker compose ps` resolves the
  healthy existing `studioflow-db-1` container as service `db` on `5432`.
- `npx tsc --noEmit` and production `npm run build` pass on Next.js 16.2.1.
- Authenticated browser smoke tests pass for `/`, `/library`, `/projects`, one
  project overview, and one phase detail. The tested phase rendered
  `with client · 5 weeks`; no `PrismaClientValidationError` or `P2022` appeared.
- Full repository ESLint still reports 15 existing errors and 71 warnings in
  unrelated legacy/test areas. This was not hidden with config overrides; it
  remains follow-up cleanup and does not block TypeScript, build, or runtime.

## [Unreleased] - 2026-08-01 (Brand-first Library checkpoint applied)

### Data / schema

- Created and restore-tested a full custom-format backup before deployment:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_brand_first_library_20260801_002644.dump`
  (761,368 bytes; SHA-256
  `37D32B0A47AF8FCB58EC529044C9E7CB173A8537A5FC0B586862BB864E6B7C04`).
  `pg_restore --list` and an isolated restore both passed; the temporary
  database was removed.
- Restored the existing `ProjectScheduleOption.created_at` and `updated_at`
  mappings in `prisma/schema.prisma`. The additive migration retained these
  operational columns and reuse search still orders by `created_at`; omitting
  them from Prisma would have produced two unintended drops on a future diff.
- Applied `20260801000000_add_service_vendor` and
  `20260801010000_add_brand_first_library`, regenerated Prisma Client, and
  confirmed migration status is current with zero schema drift.
- Applied `scripts/seed-brand-categories.mjs` as
  `berkah.rad@gmail.com`: 418 Category and 1,054 BrandCategory rows were
  created from 756 MaterialCandidate evidence rows. One hundred candidates
  without a resolvable relational Brand were intentionally skipped; 260
  possible near-duplicate category names were reported but not auto-merged.
  The post-apply dry-run is idempotent with zero planned writes.
- Post-apply state: Category/BrandCategory `418/1,054`, Material 172,
  MaterialCandidate/SampleCandidate `756/287`, Sample 0,
  Project/ProjectScheduleEntry/ProjectScheduleOption `11/79/79`, AuditLog
  8,106, and zero orphan BrandCategory relations.

### Fixed

- Completed two minimal integration fixes exposed by the regenerated client:
  the Brand link editor now handles `DRIVE` and `PRICE_LIST` enum values and
  classifies Google Drive URLs; `receiveProjectProductRequest` now includes
  the brand, nested SKU brand contacts, samples, project/requester, and
  schedule relations required by its declared return type.

### UI Changes

- Brand link labels now include “Arsip Drive” and “Daftar Harga”. Google Drive
  URLs are classified as `DRIVE`; no layout, spacing, radius, color, or other
  visual token was changed.
- Authenticated QA of `/library` passed: searching `terazzo` returned the exact
  `Terazzo` category with two brands. Dphaus → `Drive/folder katalog` opened a
  real Google Drive PDF preview for `Catalogue DP Haus .pdf`, page 1 of 34,
  with working page and zoom controls.
- Known non-blocking QA warning: Radix reports missing accessible
  title/description metadata on the catalog dialog. The preview itself works;
  accessibility cleanup is deferred and must not be folded into schema
  teardown §7 without explicit scope.

### Verification

- `npx prisma generate`, `npx prisma migrate status`, and zero-drift
  `prisma migrate diff` pass.
- Seed dry-run, guarded apply, independent row/orphan checks, and post-apply
  dry-run pass.
- Targeted ESLint, `npx tsc --noEmit`, and production `npm run build` pass;
  `/library` is present in the production route list.
- Teardown §7 was deliberately not started. The owner/Claude checkpoint is now
  ready for review.

## [Unreleased] - 2026-07-31n (Library search could not find a category tag)

### Fixed
- Searching the Library for a category returned "No products found" even when
  every visible row carried that category. Typing `TILE` matched nothing while
  the CATEGORY column showed `Tile` on every row.
- Cause: in `LibraryService.getAllProducts`, the tag clause was
  `{ catalog_tags: { has: filters.search } }`. `catalog_tags` is a `String[]`,
  and Prisma's array operators (`has`, `hasSome`) compare elements with exact
  equality — they do not accept `mode: "insensitive"`, which only exists on
  scalar string filters. Every other clause in the same `OR` was
  case-insensitive, so the tag clause was the lone exact-match branch and the
  user had to guess the stored casing. It read as "search is broken" rather
  than as a casing rule.
- Fix: resolve the typed text against the tag values that actually exist,
  case-insensitively and by substring (so `til` still finds `Tile`), then pass
  the real stored spellings to `hasSome`. When nothing matches, the clause is
  omitted entirely rather than emitting `hasSome: []`.

### Known, not changed here
- `filters.category` (line ~422) and `filters.tags` (line ~475) both assign
  `where.catalog_tags`, so supplying both silently drops the category filter.
  Left alone deliberately: both values come from dropdowns populated with real
  stored spellings, so neither hits the casing bug, and changing the
  precedence is a behaviour change that deserves its own commit.

### Verification
- `tsc --noEmit` passes.
- ESLint on `library-service.ts` could NOT complete in the verification sandbox
  (repeated 44s timeouts on this one large, type-aware-linted file). Run it
  locally before merging. Smaller touched files linted clean.
- Not exercised against a live database — no network route to local Postgres
  from this environment.

## [Unreleased] - 2026-07-31m (Material→Brand terminology, ServiceVendor, Master Data table cleanup)

### Changed — business contract
- **Terminology reversed by owner decision.** For a Material the relational
  party is a **Brand** (manufacturer). **Vendor** now means a **service
  provider** and exists as `master_data.ServiceVendor`. This supersedes
  "Vendor is relational; Brand is a required Material attribute and MUST NOT be
  inferred as Vendor". The anti-fabrication rule behind that wording is
  unchanged — a relational party still may never be invented from a bare name.
  Evidence: 172/172 promoted Materials had `vendor_name` identical to
  `catalog_brand`; 0/392 vendors carried more than one brand; the Prisma model
  was already named `Brand`.
- `Material.catalog_brand` is now explicitly a denormalised copy of the related
  Brand's name, derived on save rather than typed. It stays because project
  snapshots freeze the key and the unique index is
  `(vendor_id, catalog_brand, catalog_sku)`.
- `ServicePrice` may name the provider that quoted it;
  `service_vendor_id = NULL` means an internal studio rate.

### Data / schema
- Added `ServiceVendor` model and additive migration
  `20260801000000_add_service_vendor`: one new table, one NULLABLE column on
  `ServicePrice`, one `ON DELETE SET NULL` FK, three indexes. The physical
  `master_data.Vendor` table is deliberately NOT renamed — every Material,
  MaterialCandidate, VendorContact and VendorLink FK points at it.
- No existing row is deleted, renamed, or rewritten by this migration.

### UI Changes
- Material dialog: "Vendor" and "Brand" collapsed into one "Brand *" field;
  brand name auto-derived. A previously stored `catalog_brand` that disagrees
  with the related Brand is surfaced, not silently overwritten.
- Materials table: Vendor+Brand merged into one Brand column (legal entity kept
  underneath); SKU+Produk merged into one column; Spesifikasi column hidden
  from the table (data retained, still searchable and editable in the dialog);
  incomplete price renders as `—` with a title instead of a repeated sentence.
- Brand picker copy, Master Data nav label, and the Harga page description
  updated to the new terminology.

### Verification
- `prisma validate` passes; `prisma format` run.
- Hand-written migration compared line-by-line against
  `prisma migrate diff --from-empty --to-schema --script`: column names, index
  names and FK clause are identical, so deploy should report zero drift.
- `tsc --noEmit` passes; ESLint clean on all five touched files;
  `verify-access-matrix.mjs` passes.

### Not done yet
- `prisma generate` could NOT run in the verification sandbox (EPERM on the
  mounted generated-client directory), so Prisma Client does not yet know
  `serviceVendor`. Run it before anything that touches the new model.
- `migrate deploy` / `migrate status` / real-database diff not run — no network
  route to local Postgres. No database writes occurred.
- Production `next build` not run (bus error in the sandbox).
- No CRUD surface exists yet for ServicePrice or ServiceVendor.

## [Unreleased] - 2026-07-31m (Sheet1 SKU=Tipe+Motif curation applied)

### Changed — business contract
- Formalized in `docs/MASTERDATA_CSV_SEEDING_GUIDE.md`: for MaterialCandidate
  rows sourced from workbook `Sheet1` (physical samples), `product_name = Tipe`
  and `sku = Tipe + " " + Motif` (Motif omitted when absent), confirmed
  directly by the owner from firsthand knowledge of how physical samples are
  labelled. This does NOT reopen "Tipe-as-SKU inference" for `List`-sourced
  candidates, where `Product` is still family/subcategory, not identity.

### Added
- `scripts/curate-sheet1-sku-motif.mjs`: `--validate-only` (CSV only),
  `--dry-run`, and `--apply` (backup + `pg_restore --list` + `--ack-review`)
  modes. Confirm+promote logic mirrors
  `updateMaterialCandidateAction`/`promoteMaterialCandidateAction` in
  `src/subapps/master-data/actions/curation-actions.ts` field-for-field,
  including the AuditLog entries per promotion.
- Four exact `Infiniti` duplicate pairs were confirmed as the same physical
  products entered twice with Tipe/Motif split differently: `Reggio Grey`,
  `Rotterdam Cream`, `Stone White`, and `Xenith Cream`. The script auto-merges
  only these evidence-equivalent collisions when category tags also agree: a
  deterministic winner is promoted, the loser becomes `DISMISSED`, and linked
  SampleCandidates are repointed to the winner. Other collisions remain
  blocked.

### Data operation
- Created and restore-list verified a full custom-format backup outside the
  project:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_sheet1_sku_curation_20260731_174005.dump`
  (709,372 bytes; SHA-256
  `F33C7ADDAA2CB8E7E6E1DA802025A2AD7B337A8FB09436EFFE5717D4017B055F`).
  The archive was also restored successfully into an isolated verification
  database and reproduced the 0/756/287 Material/MaterialCandidate/
  SampleCandidate baseline plus unchanged 11/79/79 Project/Schedule counts.
- Applied the curation in one transaction as
  `berkah.rad@gmail.com` (`ADMIN`): 172 candidates confirmed and promoted,
  four duplicate losers dismissed, zero skipped.
- Resulting state: 172 canonical Materials, all `PENDING`; MaterialCandidate
  status is 580 `PENDING`, 4 `DISMISSED`, and 172 `PROMOTED`. Canonical Sample
  remains zero; all 287 SampleCandidates remain available for later physical
  inventory promotion.
- AuditLog increased from 6,095 to 6,615: 172 update, 172 promotion,
  172 `CATALOG_CREATE`, and four duplicate-dismiss records. StudioFlow Project,
  ProjectScheduleEntry, and ProjectScheduleOption remained 11/79/79.

### Verification
- `node --check` and targeted ESLint pass.
- `--validate-only` run against
  `docs/masterdata-seed/06_material_candidates.csv`: 273 Sheet1 candidates,
  176 eligible, 172 winners, four auto-merged losers, zero unresolved
  collisions, and 97 untouched because Vendor is not yet matched.
- Database dry-run matched the validation plan exactly. Apply completed with
  `dismissed=4 confirmed=172 promoted=172 skipped=0`.
- Post-apply checks found zero promoted candidates without Material, zero
  dismissed candidates with Material, zero SampleCandidate links to dismissed
  candidates, and zero promoted Materials with missing SKU, product name,
  category tags, or a valid Vendor.
- A second database dry-run is idempotent: zero eligible and zero writes.

## [Unreleased] - 2026-07-31k (In-App Master Data Curation Queue)

### Changed — business contract

- Incomplete workbook evidence is now persisted in dedicated
  `MaterialCandidate` and `SampleCandidate` review tables. It is visible for
  curation but remains outside canonical Material/Sample, Library, Schedule,
  SketchUp, and BQ until explicitly promoted.
- Candidate `PENDING` means not yet canonical or usable. This is deliberately
  distinct from canonical Material `PENDING`, which remains usable.
- Material promotion requires confirmed Vendor, Brand, real SKU, product name,
  and category tags, then creates a canonical Material as `PENDING`.
- Sample promotion requires an active canonical Material and valid physical
  inventory state. It creates one Sample plus an `AUDITED` provenance movement;
  it never manufactures historical borrow/return events.
- Candidate edit, dismiss, reopen, and promotion operations are permission
  gated and write AuditLog records. Existing Material/Sample maintenance
  permissions remain the authority; no role matrix was widened.

### Data / schema

- Added and deployed additive migration
  `20260731234000_add_masterdata_curation_queue`.
- Seeded 756 MaterialCandidates and 287 SampleCandidates as `PENDING`; 656
  MaterialCandidates retain a relational suggested Vendor and all 287
  SampleCandidates retain their source MaterialCandidate suggestion.
- Canonical Material, Sample, and SampleMovementLog remain at zero. Project,
  ProjectScheduleEntry, and ProjectScheduleOption remain 11/79/79.
- AuditLog increased from 4,996 to 6,039: one provenance entry for each of the
  1,043 inserted candidates.
- Backup before migration/seed:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_curation_queue_20260731_162105.dump`
  (529,903 bytes; SHA-256
  `33A067D60B6095B8A770E74FDC691517E078FEFA3663017E708B22F7CA1BD86D`).

### UI Changes

- Added `/masterdata/curation` and a `Kurasi` navigation item with Material and
  Sample queues, search, status filters, totals, pagination, and source
  blockers.
- Candidate dialogs follow the View-First protocol: existing rows open
  read-only and require `Modify` before editing.
- Vendor and Material confirmation use searchable relational pickers. Material
  candidates retain the existing nested Vendor CRUD flow.
- Added semantic tokens `--ui-dialog-max-height` and
  `--ui-filter-secondary-width`; existing layout, typography, radius, and
  subapp shell remain unchanged.

### Verification

- Full restore-test passed against an isolated database: migration deploy,
  zero-drift diff, 756/287 candidate apply, and idempotent second dry-run.
- Main database migration deploy/status and zero-drift diff pass.
- Post-apply dry-run reports 0 creates/enrichments and 756/287 candidate reuses.
- Independent checks found zero orphan candidate links and zero duplicate
  candidate keys.
- Prisma validate/generate, TypeScript, targeted ESLint, and the production
  Next.js build pass. The build includes `/masterdata/curation`.
- The running dev server returns the expected authenticated redirect for the
  new route. Authenticated visual QA remains pending because the available
  browser session is signed out.

## [Unreleased] - 2026-07-31j (Reviewed Vendor Seed Applied)

### Data operation

- Applied the reviewed Master Data seed to the local `studioflow` database as
  owner `Raychie` in one transaction: 392 Vendors, 399 VendorContacts, and
  1,010 VendorLinks were created.
- Material and Sample remain at zero. The 756 Material candidates and 287
  physical Sample candidates stay outside the payload until Vendor, Brand, real
  SKU, product name, tags, and exact Material linkage are manually curated.
  Imported Vendor data also remains subject to manual re-curation.
- Created a full custom-format PostgreSQL backup outside the project before
  apply:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_masterdata_seed_20260731_155335.dump`
  (409,094 bytes; SHA-256
  `3AAB2B68CED502FEE960BFD03C6EDFF1BE01A161237F004821DD888BD8D43AE9`).
- The importer can now verify a host backup through PostgreSQL tooling inside a
  named Docker container via `--pg-restore-container`. SHA-256 matching,
  external-backup placement, and successful `pg_restore --list` remain
  mandatory.

### Verification

- Pre-apply dry-run passed with 392/399/1,010 creates and zero blockers.
- Apply passed and committed; AuditLog rose from 4,604 to 4,996.
- Post-apply dry-run passed idempotently: 0 creates, 0 enrichments, and
  392/399/1,010 reuses.
- Independent database checks found zero orphan contacts, zero orphan links,
  zero normalized duplicate Vendor names, and zero duplicate Vendor URLs.
- StudioFlow remained unchanged at 11 Projects, 79 ProjectScheduleEntries, and
  79 ProjectScheduleOptions.
- `node --check` and targeted ESLint for the importer pass. No application UI,
  Prisma schema, or migration changed.

## [Unreleased] - 2026-07-31i (Reviewed Master Data Seed Package)

### Added — data pipeline

- Re-read `docs/RAD - Material + Supplier.xlsx` against the canonical
  `Vendor -> Material -> Sample` contract and generated a reviewed seed package
  in `docs/masterdata-seed`.
- Safe payload currently contains 392 Vendors, 399 VendorContacts, and 1,010
  deduplicated VendorLinks. Phone numbers are preserved as text, including
  leading zeroes and multiple numbers in one source cell.
- Material and Sample payloads deliberately remain empty. The workbook has no
  explicit SKU column and does not prove the Vendor–Brand relation needed for
  Material identity. Instead, 756 Material candidates and 287 physical Sample
  candidates were placed in review queues; no row number, `LEGACY-*`, or
  inferred `Tipe` was manufactured as a SKU.
- Added `scripts/import-masterdata-seed.mjs` with validation-only, localhost
  dry-run, and transactional apply modes. Apply requires a real Master Data
  actor, explicit review acknowledgement, a custom-format backup outside the
  project, matching SHA-256, and a successful `pg_restore --list`.
- The importer writes Master Data audit records, creates only linked physical
  Samples, forces seeded Materials to `PENDING`, and verifies Project/Schedule
  counts do not change inside the transaction.

### Documentation

- Expanded `docs/MASTERDATA_CSV_SEEDING_GUIDE.md` with the relational
  VendorLink payload, stable Sample staging key, candidate/review files, and
  canonical importer commands.
- Added `docs/masterdata-seed/README.md` with the source limitations, exact
  counts, review workflow, and guarded apply instructions.
- Generated a formatted review workbook with summary, seed payload, editable
  candidate queues, formula-driven readiness states, and blocker/warning views.

### Verification

- Source workbook SHA-256 verified as
  `1AB11BD57893424EA226135F670197B31B96B861BA05C0C4962AF5BC8D0FBCEE`.
- Seed validation-only passed with zero database access/writes.
- Local database dry-run passed with zero blockers and zero writes. It plans
  392 Vendor, 399 contact, and 1,010 link creates while leaving Material,
  Sample, 11 Projects, 79 Schedule Entries, and 79 Schedule Options unchanged.
- No seed was applied and no application UI, Prisma schema, or migration was
  changed.

## [Unreleased] - 2026-07-31h (Role-Aware Post-Login Landing)

### Fixed — routing
- Sign-in no longer sends every role to StudioFlow. `src/components/login-form.tsx`
  hardcoded `router.push("/")`, so `STAFF` landed on the StudioFlow dashboard
  instead of `/masterdata` (it still holds legacy StudioFlow access, so nothing
  bounced it), and `ESTIMATOR` reached `/` before the dashboard layout guard
  redirected it to `/bq` — a visible flash and a wasted server render. The form
  now reads the freshly issued session and pushes `landingRouteFor(role)` from
  `src/core/rbac/app-access.ts`, the same table the proxy and every subapp layout
  already use. A missing or unrecognised role falls back to the least-privileged
  landing rather than to `/`.
- `src/proxy.ts` no longer excludes `login` from the middleware matcher. That
  exclusion made the `pathname === "/login"` branch of
  `auth.config.ts -> authorized()` unreachable dead code, so an already
  authenticated user opening `/login` was served the sign-in form again instead
  of being bounced to their landing route. `authorized()` returns `true` for
  anonymous visitors on `/login`, so anonymous sign-in is unaffected; `api`
  remains excluded because `/api/auth/*` must not be gated by the gate that
  depends on it.

### Unchanged — deliberately
- `APP_ACCESS` and `LANDING_ROUTE` are untouched: they were already correct
  (`STAFF -> /masterdata`, `ESTIMATOR -> /bq`). Only the client-side destination
  after sign-in was wrong.
- `LEGACY_LIBRARY_ACCESS_FOR_STAFF` stays `true`. Revoking `STAFF`'s StudioFlow
  access would remove its `/extensions/library` working surface before
  `/masterdata` can replace it; that remains a separate, deliberate change.
- No schema, migration, permission, or database change.

### Verification
- `tsc --noEmit` passes.
- ESLint on `src/components/login-form.tsx` and `src/proxy.ts`: zero errors and
  zero warnings.
- `node scripts/verify-access-matrix.mjs` passes; all invariants hold.
- Production Next.js build NOT run for this change: `next build` aborts with a
  bus error in the sandbox used for verification. Run it on the workstation
  before relying on this change.
- No runtime login QA was performed for this change.

## [Unreleased] - 2026-07-31g (Searchable Vendor + Pending-Usable Curation)

### Changed — business contract
- Every directly created Material now starts at `PENDING`, including entries
  created by an approver. `PENDING` remains visible and usable in Library,
  SketchUp selection, and Project Schedule; only `REJECTED` is blocked from new
  Schedule use. `REJECTED` is a non-destructive takedown: existing immutable
  project snapshots remain unchanged.
- Material curation is now distinct from edit authority. `ADMIN`, `OWNER`, and
  the new dedicated `CURATOR` role may approve/reject Material and promotion
  requests. `STAFF` may maintain Master Data, but every non-curator Material
  edit returns the row to `PENDING`.
- BQ readiness remains independent from curation and still requires price before
  discount, price after discount, and price unit.

### Data / schema
- Added and deployed additive migration
  `20260731223000_add_curator_role`; it adds `CURATOR` to
  `studioflow.Role` without changing any existing User, Project, Master Data,
  schedule, snapshot, or audit row.
- Added `MASTERDATA_MATERIAL_APPROVE` and separated promotion approval from
  generic Library create/edit permissions. Production preflight now verifies
  that the deployed Role enum contains `CURATOR`.
- Backup before deploy:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_curator_role_20260731_145029.dump`
  (408,553 bytes; SHA-256
  `92D5E8406CC11D74059BD57B4850986FE70E827D2AADA4E7716884079AE5A715`).
- Counts before and after deploy remain 8 User, 11 Project, 0 Vendor,
  0 Material, and 0 Sample.

### UI Changes
- Material Vendor is now a relational searchable combobox. Typing a different
  query clears the stale selection, outside pointer/focus closes the result
  list, and a single exact result can be selected with Enter.
- “Tambah vendor baru” opens the existing Vendor CRUD dialog over the Material
  form, pre-fills the typed name, selects the newly created Vendor, and refreshes
  server data without `window.location.reload()`.
- New Material shows a fixed `Pending` curation state with clear copy that it
  remains usable. Approval controls appear only in edit mode for users holding
  the explicit curation permission.
- Added the semantic `--ui-combobox-menu-max-height` design token; existing
  layout, typography, radius, and spacing structure remain unchanged.
- User Management now exposes `CURATOR` as an assignable role.

### Verification
- Prisma validate/generate, migration deploy/status, and zero-drift migration
  diff pass.
- `tsc --noEmit`, targeted ESLint with zero warnings/errors, access-matrix
  verification, and production Next.js build pass.
- Dev server restarted successfully on port 3000 and `/login` returns HTTP 200.
- Authenticated visual QA remains pending because the available browser session
  redirects to login; no credentials were inspected or used.

## [Unreleased] - 2026-07-31f (Persistent Agent Handoff Log)

### Documentation
- Added `CHANGELOG-CODEX.md` as the mandatory active handoff entry point for
  subsequent agents, containing the current Master Data contract, implemented
  scope, database state, verified backup, checks already run, open work, and
  dirty-worktree warning.
- Updated `AGENTS.md` so every agent must read the handoff log before working
  and update it in the same task after code, schema, migration, configuration,
  UI, data, reference-documentation, or database-operation changes.
- This documentation-only update does not change application behavior, UI,
  Prisma schema, migration history, or database contents. No `MASTER_SSOT.md`
  update is required because the product contract is unchanged.

## [Unreleased] - 2026-07-31e (Canonical Material/Vendor/Sample Contract)

### Changed — business contract
- Master Data is now canonically `Vendor -> Material -> Sample`. Vendor is the relational supplier; Brand is a required Material field. Prisma keeps internal model names `Brand`/`Sku` only as a compatibility bridge while PostgreSQL maps them to `master_data.Vendor`/`Material`.
- SKU and product name are mandatory Material identities. Offering is removed completely; a source row without a real SKU is a seed blocker.
- Category and the former sub-category/Product taxonomy are stored as ordered `catalog_tags`; the first tag is the primary Schedule category.
- Material pricing has explicit before-discount, after-discount, and unit semantics. BQ readiness requires all three.
- Sample is mandatory-to-Material physical inventory only. No Sample row represents “belum ada/belum diminta”; that state is derived from zero live samples.
- Project schedule snapshots keep their existing `catalog_*` JSON contract. New catalog snapshots include explicit Vendor id/name so Brand is never inferred as Vendor during promotion.

### Data / schema
- Added guarded migration `20260731210000_material_vendor_sample_contract`. It aborts unless every legacy master-data entity table is still empty, rebuilds only the `master_data` entity shape, and reconnects existing nullable StudioFlow foreign keys without dropping/truncating/re-writing StudioFlow rows.
- `master_data.Category` and `master_data.Product` are removed; taxonomy is the Material tag array.
- Legacy unlinked-sample provenance columns are removed. `Sample.material_id` is required with `ON DELETE RESTRICT`.
- Prisma client/preflight signature and canonical table/column checks were updated in sync with `schema.prisma` and `src/core/platform/db.ts`.
- Applied locally after restore-testing `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_material_vendor_contract_20260731_141402.dump` (414,850 bytes; SHA-256 `CE2F95D05D2DCB911DF2033A3E4757A830A43A9E6BA9F89106059FC3E0B3F7B3`).

### Verification
- Isolated restore + `prisma migrate deploy` passed, followed by zero Prisma schema drift.
- Normalized `pg_dump --data-only --schema=studioflow` SHA-256 is identical before and after the local deploy: `3A3EAC97E5395B2B814DD7C7E69F304B45EF0EF7A32708AF8B1BDB9D84125ECD`.
- Operational counts remain 11 Project, 79 ProjectScheduleEntry, 79 ProjectScheduleOption, 0 ProjectProductRequest, and 4,599 AuditLog. Every canonical `master_data` table remains at zero rows.
- Prisma validate/generate, `tsc --noEmit`, production `next build`, touched-file ESLint (zero errors), and access-matrix verification pass.

### Added
- `docs/MASTERDATA_CSV_SEEDING_GUIDE.md`: the canonical CSV re-read, normalization, validation, dry-run, audit, idempotency, and post-seed verification contract.
- Legacy staging READMEs are marked archive-only, and both old import scripts remain hard-disabled with pointers to the new guide.

### UI Changes
- `/masterdata/materials` is now the single Material CRUD surface. It removes Offering, separates Vendor and Brand, shows category tags, two prices plus unit/BQ readiness, and derives the four physical-sample displays: Tersedia, Tidak tersedia, Dipinjam desainer, and Dikirim ke klien.
- Existing Material dialogs remain read-only by default and require `Modify`; create/edit now exposes Vendor, Brand, mandatory category tags/SKU/product, optional specifications/links, and both prices.
- `/masterdata/skus` redirects to `/masterdata/materials` to eliminate the duplicate write path.
- Vendor screens now label the relational entity Vendor instead of “Vendor & Brand”. Sample Fisik shows only Material-linked physical inventory.
- Existing StudioFlow layout, Lora/Inter typography, semantic design tokens, sidebar structure, and `router.refresh()` behavior are preserved.

## [Unreleased] - 2026-07-31d (Master Data Reset Before Seed Rework)

### Data
- **Owner-directed reset:** all rows in the `master_data` schema were removed so the replacement seed can start from a clean database. Tables, enums, constraints, migrations, and the `master_data` schema itself remain intact.
- The only populated master-data table was `Sample`: 287 legacy `Sheet1` rows, including 17 marked `BORROWED`. The owner's explicit reset instruction overrides the normal per-sample soft-delete guard for this one operation. No `Brand`, `BrandContact`, `BrandLink`, `Category`, `Product`, `Sku`, `SampleMovementLog`, or `ServicePrice` rows existed at reset time.
- The reset ran in one serializable transaction. It wrote 287 `MASTER_DATA_RESET_DELETE` audit rows containing the previous Sample payloads and one `MASTER_DATA_RESET` summary under the real OWNER actor `Raychie`.
- Project data was not reset: 11 projects, 79 `ProjectScheduleEntry` rows, and 79 `ProjectScheduleOption` rows remain. Existing schedule snapshots are unchanged and no live `sku_id` link exists.
- Restore-tested backup: `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_legacy_sample_cleanup_20260731_132054.dump` (402,661 bytes; SHA-256 `0BBA3CDCFBABFF2A85E979EECB8B2BB3A550CF03439B433304BBFC49336BFF0F`).

### Verification
- Every base table in `master_data` reports zero rows.
- Prisma migration status remains up to date and `prisma migrate diff` reports zero schema drift.
- AuditLog increased from 4,311 to 4,599 rows: 287 entity snapshots plus one reset summary.

### UI Changes
- No UI source or design-token change. Existing Master Data pages now truthfully render their empty state.

## [Unreleased] - 2026-07-31c (Master Data Entity Rework Applied)

### Changed — business contract
- **Master Data is now six concepts:** `Brand`, `Category`, `Product` (sub-category), `Sku`, `BrandLink`, and `Sample`, with `BrandContact` retained as the brand's 1:N contact detail. This is the schema recorded in `MASTER_SSOT.md` §6.11 and migration `20260731190000_master_data_entity_rework`.
- **Legacy master-data entities were retired:** `Vendor`, `VendorContact`, `VendorOffering`, and `ProductCatalog` were replaced by the normalized entity chain. Existing project schedule snapshots remain the display contract; their live catalog FK was renamed to `sku_id` and cleared because the deleted catalog rows cannot be linked safely by inference.
- **Physical inventory moved without recreation:** `studioflow.PhysicalSample` became `master_data.Sample`, and `SampleMovementLog` moved with it. Sample-to-SKU remains nullable and uses `ON DELETE SET NULL`.

### Data
- Applied to the local `studioflow` PostgreSQL database after a restore-tested custom-format backup. The runtime baseline contained 397 vendors, 401 vendor contacts, 483 offerings, 5 catalog rows, 287 samples, 79 project schedule options, and no sample movement rows.
- Preserved all 287 samples, all 79 project schedule options, and the complete AuditLog byte-for-byte at the JSON payload level, excluding only the planned FK rename/new Sample columns. All 79 schedule rows remain available through their frozen `data_snapshot`; zero live `sku_id` links were fabricated.
- Backup: `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_masterdata_rework_20260731_130250.dump` (493,247 bytes; SHA-256 `FD74A15276C32CEC704504A200B76156FDA27EE184B2DC9C4A82EF753926F847`). Restore to an isolated database passed before the production-local migration was resolved and deployed.

### Fixed
- **Migration retry blocker:** the first deploy attempt had rolled back after `ALTER TABLE … SET SCHEMA` carried `SampleMovementLog_sample_id_fkey` into `master_data`, where the migration then tried to create the same constraint name again. The migration now drops that FK before moving the tables and recreates it against `master_data.Sample`. The corrected migration passed isolated restore/deploy, `prisma migrate status`, and a zero-drift `prisma migrate diff` before being applied to the main local database.
- Regenerated Prisma Client v7.5.0 from `prisma/schema.prisma`.

### UI Changes
- No UI source or design-token change was made during this operational migration continuation.

## [Unreleased] - 2026-07-31b (Material SSOT Consolidation)

Makes Master Data the single source of truth for material identity and pricing, so BQ reads one place. **Schema + code only — the 483-row data move is a separate, reviewed run.** See `docs/MATERIAL_SSOT_RUNBOOK.md`.

### Changed — business contract
- **`catalog_sku` and `catalog_color` are nullable.** The conflict raised at the start of the material/supplier work and deferred three times. It could not be deferred again: 483 supplier-capability rows have neither field, and fabricating them is forbidden. **The APPROVED gate is unchanged** — enforced by `CatalogApprovalValidationSchema`, which still requires colour, image, vendor and one of SKU/name. The `NOT NULL` constraint was never what enforced it.
- **`ProductCatalog` moved to the `master_data` schema.** `ProjectScheduleOption`, `ProjectProductRequest` and `PhysicalSample` keep their FKs as cross-schema references — valid PostgreSQL, and the reason the single-instance topology was chosen. Migration uses `ALTER TABLE … SET SCHEMA`, never Prisma's generated drop/recreate, so all 5 rows and every constraint survive.
- **The `"N/A"` factory is closed.** `createProduct` wrote `data.catalog_sku || "N/A"` and `data.catalog_color || "N/A"` because the columns were `NOT NULL`. Both now store `NULL`. That default was manufacturing the exact placeholder banned by import decision #9, on every product created through the UI.

### Added
- **Pricing on the material row**: `catalog_vendor_price` (vendor cost, distinct from sell price), `catalog_price_unit`, `catalog_price_updated_at`. Inline because the owner asked for prices editable there and `schedule-service.ts` already reads `catalog_price` in six places. **`catalog_price_unit` has no default on purpose** — a rate without a unit cannot be estimated against, and defaulting it would silently corrupt BQ quantities for anything sold per m².
- **`master_data.ServicePrice`** — service/labour rates for BQ (SSOT §6.9). Deliberately not linked to `Vendor`: a service rate is the studio's own cost, not a supplier quote. Ships empty; the workbook has no service rates, so there is nothing to import and nothing to invent.
- **`/masterdata/prices`** — pricing coverage for material (priced / unpriced / **priced-but-no-unit**, called out because BQ will hit it) plus the service rate table.
- **`scripts/migrate-offerings-to-materials.mjs`** — dry-run + apply, localhost-only, verified backup + SHA-256, `--ack-review`, single transaction, idempotent via the new UNIQUE `source_offering_id`. Writes one `AuditLog` per insert with a real actor, which is why the data move is a script and not SQL. Does not delete or modify any `VendorOffering` row (§6.7 keeps them as provenance), does not invent SKU/colour/price, sets nothing `APPROVED`, and does not guess `catalog_type` — offerings carry no material/fixture signal, so rows land on the default and are reported for review rather than keyword-classified. Blocks (rather than fudges) offerings with a missing/soft-deleted vendor or an empty `category_raw`.
- **`docs/MATERIAL_SSOT_RUNBOOK.md`** — ordered runbook with verification SQL at each step, expected counts, an idempotency proof step, and a restore path.

### Fixed
- **Eight latent nullable-SKU assumptions**, surfaced by the schema change across the SketchUp catalog board and bridge, the Library request/sample/catalog tables, and the Master Data product dialog. Every one was a display path assuming a SKU always exists. All fixed with an honest fallback to the product name — no casts, no placeholder strings.

### Notes
- `/masterdata/materials` derives row kind from *whether a SKU exists*, not from which table supplied it, so labels and counts stay correct on both sides of the data move. Un-migrated offerings still appear until the script runs, so the grid is never missing 483 rows mid-migration.
- Verified: `tsc --noEmit` exit 0, `eslint` 0 errors, `verify-access-matrix` passes, migration script passes `node --check`.
- Still open: 287 samples remain unlinked to any material; `catalog_price_unit` empty everywhere; `ServicePrice` empty; per-schema PostgreSQL roles/`GRANT`s not applied; `MASTERDATA_*` still not the enforcing authority (§6.2 point 8).


## [Unreleased] - 2026-07-31 (Materials View, Library View-Only, Queue Disabled)

Scope: UI and navigation. **No migration, no schema change, no data touched.** The 397 vendors / 483 offerings / 287 samples imported on 30 July are untouched.

### Added
- **`/masterdata/materials`** — the combined working table the owner asked for: Brand · Kategori · SKU · Warna · Harga · Sample in one sortable, filterable grid. Backed by `src/subapps/master-data/services/material-view-service.ts`, which joins `master_data.VendorOffering` and `studioflow.ProductCatalog` in memory (488 rows total — one round trip per table, no raw cross-schema SQL). Every row is labelled `SKU` or `Offering`; blank SKU/colour/price cells on offering rows are left blank because that is the true state of the source.
- **`src/core/platform/feature-flags.ts`** — static boolean flags so "disable X for now" hides a surface without deleting tested code. Flags never weaken a permission check; server actions keep their own gates.

### Changed
- **StudioFlow Library is now view-only.** The `Vendors`, `Requests` and `Queue` tabs are hidden behind `FEATURE_LIBRARY_MANAGEMENT_TABS_ENABLED` / `FEATURE_PROMOTION_QUEUE_ENABLED`. Designers browse Catalog and Samples; supplier identity, material requests and the promotion queue are Master Data's surfaces. Panels are flag-gated alongside their triggers, and a stale `?tab=vendors` bookmark now falls back to Catalog instead of rendering a body with no visible tab.
- **Promotion Queue disabled in both surfaces.** `/masterdata/promotions` keeps its route but renders an explanatory notice and runs **no query** when disabled. Nothing dropped: `PromotionRequest` rows, `reviewPromotionRequestAction`, `PromotionQueueTable` and the audit wiring are all intact. Verified there is no promote-to-library control in Product Schedule — `createPromotionRequestAction` has no UI caller.
- **Master Data navigation** — `Materials` added; `Offering` removed per SSOT §6.7 (navigation only, the 483 rows remain as provenance); `Promotion Queue` removed while disabled.
- **Master Data Overview rebuilt** — was a flat 2×2 grid of equal-weight cards. Now three tiers: Materials as a full-width primary panel showing the SKU-vs-offering split, supporting domains (Vendor, Samples) below it, and pricing stated plainly as not-yet-built. Surfaces numbers that were previously invisible: curated offerings, archived offerings, borrowed samples, and samples not yet linked to a SKU.

### Notes
- **Recommendation recorded, not executed** (`MASTER_SSOT.md` §6.8): `VendorOffering` and `ProductCatalog` share **seven** semantic fields and should merge into one `Material` table, with `Vendor` staying separate because it is genuinely 1:N. The merge is blocked on making `catalog_sku` / `catalog_color` nullable — the contract change deferred since the start of this work — and must not be attempted before the Materials view proves the column set.
- **Service pricing ownership decided** (`MASTER_SSOT.md` §6.9): Master Data owns it, BQ consumes, superseding `UPSTREAM-BQ-MATERIAL-SOURCE.md` §0.2 for service rates. No table or page built yet.
- Verified: `tsc --noEmit` exit 0, `eslint` 0 errors on all touched files, `verify-access-matrix` passes.


## [Unreleased] - 2026-07-30 (Physical Sample Master Data)

### Added
- **Dedicated `/masterdata/samples` page**: live office inventory with search, filters for Jenis/container box/status, pagination, and sortable No/Jenis/Brand/Tipe/Motif/Lokasi/Box/Status/Nama columns. Default natural sort is Rak → Container Box → source number.
- **Truthful unlinked-sample intake**: `PhysicalSample.product_id` is now nullable, with exact source identity/provenance fields and a source-row uniqueness key. This reuses the existing inventory table instead of creating a redundant staging table or fake `ProductCatalog` records.
- **Reviewed CSV + importer**: `docs/masterdata-sample-staging/01_physical_samples.csv` and `scripts/import-masterdata-samples.mjs`, checksum-gated, row-by-row reconciled to `Sheet1`, local-only, transactional, idempotent, real-User audited, and backup/review gated.
- **Restore-tested backup**: `backups/studioflow_pre_samples_20260730_185125.dump`, SHA-256 `B19C42695E36CF76153C836071DBD01B7A588384E1BED61B78F8FB283522BBFA`.

### Changed
- `PhysicalSample.product` is optional and uses `onDelete: SetNull`. A database check requires either a linked product or a non-empty source category. The existing StudioFlow Library query continues to show linked, design-grade samples only; the Master Data page shows the complete office register.
- Master Data navigation and overview now expose Sample Fisik and live sample/offering counts. Database preflight validates the eight new provenance columns and the Prisma hot-reload signature was bumped.
- The audit entity constant in the Master Data read-action module is now module-private; exporting a non-function from a `"use server"` file prevented Next.js 16 from collecting `/masterdata/skus` during production build.

### Data
- Imported 287 units from `Sheet1`: 270 available and 17 borrowed. Added 287 audit rows under real OWNER actor `Raychie`.
- `ProductCatalog` stayed at 5, Vendor at 397, and SampleMovementLog at 0. No SKU, colour, image, Vendor or movement history was fabricated.
- Preserved 25 blank source numbers, 9 blank brands, 1 blank type, 144 blank motifs, and all 14 repeated identity groups. These are source facts, not auto-corrected warnings.
- Post-apply dry-run reports 287 reuses and zero writes.

### UI Changes
- `/masterdata/samples` uses the existing Master Data shell, Lora/Inter typography, semantic radius/border/colour variables, route loading/error boundaries, horizontally scrollable dense inventory table, and URL-backed sorting/filtering. No layout replacement, decorative shadow, or full-page reload was added.

### Deliberately Not Changed
- No PostgreSQL per-app role/`GRANT` hardening, no seeded-password rotation, and no speculative cleanup of legacy warnings.
- No automatic sample-to-SKU link. Linking remains a later explicit curation action after real SKU identity is available.
- **Documented only:** Offering is no longer a target Master Data domain; supplier categories will be represented as tags. The existing 483 imported `VendorOffering` rows remain untouched until a destination and reconciliation rule are approved.

## [Unreleased] - 2026-07-30 (Master Data Schema Split & Legacy List Import)

### Added
- **`master_data.VendorOffering`**: normalized supplier/product-family coverage, separate from strict design-grade `ProductCatalog` SKUs. Stores raw category, tags, product-family name, links, Jess six-state curation, active/archive state, source row/checksum, and multiline-review provenance.
- **Transactional importer**: `scripts/import-masterdata-list.mjs` provides checksum-gated `--dry-run` and `--apply`, fill-blanks-only vendor reconciliation, idempotent contact/offering insertion, real-User audit attribution, before/after JSON reports, local-database guard, and mandatory backup hash/review acknowledgement for apply.
- **Restore-tested backup**: `backups/studioflow_pre_masterdata_20260730_181551.dump`, SHA-256 `C9E07C4BDC627B78631677B73DB19BFEF4D08CFA6295FB178D18270B006F2657`. Verified by restoring to a temporary database and reconciling User/Vendor/ProductCatalog/migration counts.

### Changed
- **Physical schema split implemented**: Prisma models/enums now explicitly live in `studioflow` or `master_data`; empty `bq` schema is reserved for the BQ subapp. Migration uses PostgreSQL `SET SCHEMA`, preserving rows, indexes and cross-schema foreign keys. `_prisma_migrations` remains in `public`.
- **Schema-aware runtime checks**: database preflight now checks required tables/columns in their owning schemas and the Prisma hot-reload signature requires the new `vendorOffering` delegate.
- **SystemConfig reads**: login and projects pages now use the schema-aware Prisma delegate instead of unqualified raw SQL tied to `public`.

### Data
- Applied reviewed `List` staging to the local production database: 394 new vendors, 1 existing vendor filled only where blank, 401 contacts, and 483 offerings.
- Offering state reconciles exactly: 433 green/active, 22 red/archived, 1 dark-red/archived, 3 peach/active, 13 white/active, and 11 no-fill/active.
- Added 1,279 audit rows under real OWNER actor `Raychie`. Post-apply dry-run reports zero writes.
- `ProductCatalog` remains 4 rows and `PhysicalSample` remains 0; `Sheet1`, samples, SKUs, pricing, and BQ data were not imported.

### Known Gap
- Schema placement is implemented, but runtime still uses one PostgreSQL login. Per-app database roles and `GRANT`s remain a separate security-hardening step.
- The ADMIN account `berkah.rad@gmail.com` still matches the password value formerly managed by the seed script. It was not used as import actor; credential rotation remains an operator task.

## [Unreleased] - 2026-07-30 (Master Data Subapp Takeoff — RBAC & Routing)

Scope: authorization and routing only. **No table, column or row was altered.** The single migration is an additive enum value. Master Data screens beyond the overview are not built — see `MASTERDATA_HANDOFF.md`.

### Security
- **Unauthenticated access to any unlisted route (critical)**: `authorized()` in `auth.config.ts` tested the path against a hardcoded list of dashboard prefixes and ended with `return true`. That final return ran for unauthenticated requests too, so every path outside the list was publicly reachable — adding `/masterdata` under that design would have shipped an unauthenticated master-data page. The callback is now fail-closed: public routes are an explicit allowlist, everything else requires a session, and route ownership lives in `src/core/rbac/app-access.ts`.
- **Privilege escalation via missing role claim**: `src/auth.ts`, `src/lib/auth.ts` and `(dashboard)/layout.tsx` all defaulted an absent session role to `"STAFF"`. Harmless when STAFF was a low-authority role; a live escalation path once STAFF became the owner of vendors, SKUs and pricing. All three now resolve to `LEAST_PRIVILEGE_ROLE` (`DRIC`), whose every permission is ownership-gated in `guards.ts`.
- **Post-login redirect was hardcoded to `/`**: it would have dropped STAFF and ESTIMATOR onto a StudioFlow page they have no authority for. Now resolved per role through `landingRouteFor()`.

### Added
- **`Role.ESTIMATOR`**: additive enum value (`ALTER TYPE … ADD VALUE IF NOT EXISTS`). No table, column, constraint or row touched; zero rows can already hold the value, so no backfill. Forward-only. Requires PostgreSQL 12+.
- **`src/core/rbac/app-access.ts`**: single source of truth for app access — `APP_ACCESS`, `LANDING_ROUTE`, `resolveAppForPath`, `canEnterApp`, `subappLinksFor`, `LEAST_PRIVILEGE_ROLE`. Typed `Record<Role, …>`, so adding a role is a compile error until it is explicitly granted or denied. Deliberately free of Prisma/node imports because it is pulled into the edge proxy bundle.
- **8 permissions**: `MASTERDATA_VIEW`, `MASTERDATA_VENDOR_MANAGE`, `MASTERDATA_OFFERING_MANAGE`, `MASTERDATA_SKU_MANAGE`, `MASTERDATA_PRICE_VIEW`, `MASTERDATA_PRICE_MANAGE`, `MASTERDATA_PROMOTION_APPROVE`, `BQ_ACCESS`. Granted to STAFF (all master-data) and ESTIMATOR (`BQ_ACCESS` + `MASTERDATA_PRICE_VIEW` only). DIC/DRIC receive none.
- **`/masterdata`**: gated layout + overview page. Read-only; counts existing `Vendor` and `ProductCatalog` rows with `deleted_at: null`.
- **`/bq`**: gated stub so ESTIMATOR's landing route resolves to a real page instead of a 404. BQ remains a separate application; no BQ feature code was added here.
- **`scripts/verify-access-matrix.mjs`**: zero-dependency verifier (this repo has no test runner) asserting 7 invariants — total role coverage, no redirect loops, designers hold no master-data or BQ permission, estimator holds no StudioFlow authority, multi-app access restricted to admin-level plus the documented STAFF transition, and no phantom permissions. Currently passing.

### Changed
- **Business contract — pricing ownership**: `UPSTREAM-BQ-MATERIAL-SOURCE.md` §0.1 assigned material and vendor pricing exclusively to BQ and stated it would never appear in StudioFlow. Overridden by explicit user decision: **Master Data owns pricing, BQ consumes it.** Recorded in `MASTER_SSOT.md` §6.3.
- **`TopHeader`**: accepts an optional `subappLinks` prop. Non-empty only for ADMIN/OWNER, computed server-side — the component performs no role check of its own, since a client-side role test is a hint and not a control.
- **`MASTER_SSOT.md` §6.1**: the static permission table still showed STAFF without library create/edit/delete or request processing, contradicting the RBAC fix already recorded in this changelog. Corrected, and the stale "STAFF Guard" note replaced.

### Notes
- **Not done, deliberately**: no physical schema split. All 37 models remain in the default PostgreSQL schema. The agreed target (one instance, three schemas, per-app roles and `GRANT`s) needs `@@schema` on every model plus `ALTER TABLE … SET SCHEMA`, reviewed separately.
- **Not done, deliberately**: the legacy workbook import. It remains blocked on a verified backup and a real actor `User`, neither reachable from the current environment.
- **Known leak left in place**: `ProductCatalog.catalog_price` is already read by `schedule-service.ts` in six places, so pricing is reachable by DIC/DRIC via schedule snapshots. Pre-existing; removing a field live snapshot code depends on is a separate change. Documented in `MASTER_SSOT.md` §6.3.
- `npx prisma generate` must be run before typechecking (new enum value). Verified: `tsc --noEmit` exits 0; `eslint` reports 0 errors on all touched files (4 warnings, all pre-existing).

### Security — seed script fenced off
- **`scripts/seed.js` upserted the owner's real account and reset its password.** The admin block targets `berkah.rad@gmail.com` — a live `ADMIN` account, not a fixture — with `update: { password: hash("admin123") }`, so every run reset that credential to a value committed in this repository. `prisma.config.ts` registers the file as the `seed` hook, so `prisma migrate reset` and `prisma db seed` would trigger it silently without naming the account. A guard now blocks execution unless `SEED_I_UNDERSTAND_THIS_RESETS_PASSWORDS=true` is set explicitly. The file is kept, not deleted: it still documents the original user/phase fixtures, and the owner confirmed re-seeding is not needed. **Before removing the guard, drop the `update: { password: ... }` clauses** — re-seeding must never be able to overwrite a live credential.
- **`scripts/resolve-import-actor.mjs`** replaces the withdrawn `create-import-actor.mjs`, which was built on the wrong premise that a new actor account had to be created. Read-only: reports the actor id, flags seed-managed accounts, verifies role capability, and `bcrypt.compare`s against the seeded password to detect whether the account is still open. Its only optional write is `--fix-name`. It deliberately does **not** rewrite the hardcoded seed uuid `00000000-0000-4000-8000-000000000001` — changing a `User` primary key would orphan every `AuditLog`, project PIC and comment reference pointing at it.

### Corrections after review
- **`getProductsLastChangeAction` added** (`src/subapps/master-data/actions/masterdata-actions.ts`): the handoff specified an `Update` column sourced from `AuditLog` while also claiming every needed action existed. Contradiction — `getProductsAction` returns only `vendor` and `physical_samples`, no audit data. Rather than widen that action (shared by the Library UI, the schedule bridge and SketchUp), this is a separate bounded read-only lookup, capped at 200 ids, one query rather than N. `AuditLog` has no FK to `ProductCatalog` and existing writers are inconsistent about `entity_type` casing (`"ProductCatalog"` vs `"VENDOR"`), so the verified values are pinned as constants. Returns null for absent rows; fabricating an actor is forbidden.
- **`MASTER_SSOT.md` §4 ERD**: `PhysicalSample ||--o{ ProductCatalog` was drawn backwards. The FK is `PhysicalSample.product_id → ProductCatalog.id`, so one product stocks many samples. The reversed diagram invited exactly the duplicated-ProductCatalog error that import decision #14 forbids. Also added the missing `VendorContact` and `SampleMovementLog` edges.
- **`MASTER_SSOT.md` §4.1**: `User.role` was documented as `[ADMIN, DIC, DRIC, STAFF]`, missing `OWNER` (undocumented since 24 Jul) and `ESTIMATOR`.
- **`MASTER_SSOT.md` §6.2 point 8**: recorded that `MASTERDATA_*` is **not yet the enforcing authority** — all vendor/SKU/promotion writes still gate on `LIBRARY_*` in `library-actions.ts`. Correct today only because STAFF holds both sets. Documented the trap (narrowing `LIBRARY_*` would break every master-data write) and the migration order.
- **Retracted an unsafe claim in `MASTERDATA_HANDOFF.md`**: it stated the ~457 modified files were CRLF artifacts only, generalised from a single sampled file. Measured per file with `git diff --ignore-cr-at-eol --ignore-all-space`: of 249 modified files, **189 are whitespace-only and 60 carry real uncommitted work**, including `core/rbac/guards.ts`, `library-actions.ts`, `core/platform/db.ts`, `LibraryTabs.tsx` and `api/sketchup/sync/route.ts`. The handoff now instructs targeted edits only and forbids `git checkout/restore/stash/clean`.

### UI Changes
- `TopHeader`: subapp links rendered as small uppercase text buttons left of the user avatar, using existing tokens only (`--ui-radius-control`, `--ui-text-tertiary`). No new radius, shadow, animation or font. Hidden below `sm`.
- `/masterdata`: standalone chrome — own header with section tabs, deliberately without project search or phase notifications, which belong to StudioFlow. Lora headings, Inter UI, `--ui-radius-card` panels, `--ui-border-subtle` borders per `AGENTS.md`.
- `/masterdata/vendors`: added the staff-facing vendor table, client-side brand/company search, token-based loading/error states, View-First detail form, contact editor that preserves phone values as text, and styled delete confirmation. Empty source fields remain empty.
- `/masterdata/skus`: added the fixed 12-column office maintenance view, server-backed search/filtering, windowed pagination, audit-backed actor/time display, and View-First SKU form. The table keeps vendor/contact data normalized and adds no action column.
- `/masterdata/promotions`: added the pending promotion review surface with requester/project/time context, optional review notes, quiet empty state, and permission-gated Approve/Reject controls. Approve stays disabled when real SKU/name/brand/color/image data is incomplete.
- All three Master Data sections use Lora headings, Inter functional text, existing semantic colors/radii/borders, `router.refresh()` after mutation, and route-level `loading.tsx` / `error.tsx` boundaries.

---

## [Unreleased] - 2026-07-30 (Product Library Rework)

### Fixed
- **Sample Destruction On Product Save (data loss)**: Saving a product from the Library modal ran `deleteMany` + recreate on `physical_samples` while the form only ever carried `physical_samples[0]`. Any product with two or more samples lost the rest permanently, their `SampleMovementLog` history cascade-deleted with them, and borrow state (`BORROWED` / `SENT_TO_CLIENT`, borrower name) was silently reset to `AVAILABLE`. Clearing both rack and box sent an empty array, which deleted every sample of that product. Sample reconciliation is now upsert-by-id: `undefined` and `[]` both leave samples untouched, rows are matched on id, and borrow fields are written only when supplied. Nothing is deleted through the save path.
- **Fixture Products Could Not Be Saved**: `productSection` was never hydrated from the product being opened, but submit always sent `catalog_type`, so `updateProduct`'s immutability guard rejected every fixture with `IMMUTABILITY_VIOLATION`. The section now hydrates from `catalog_type`, is shown read-only on edit, and `catalog_type` is sent on create only. The Category picker no longer lists material categories for a fixture.
- **Library RBAC Inverted Against The Studio**: In this office "admin" means administrative staff, and role `STAFF` owns the material/supplier list — but `matrix.ts` granted STAFF only `LIBRARY_VIEW` + `LIBRARY_EXPORT_LIST` while three other gates disagreed with each other. The curator could not edit `APPROVED` rows, had every entry forced into a `PENDING` queue only admins could clear, and could not process sample requests. STAFF now holds create/edit/delete, vendor, brand, sample and request permissions; `assertEditable` and the direct-approve check are permission-based instead of role-name-based. Designers (DIC/DRIC) keep view + request only, so no project-side actor can rewrite a global catalog row.
- **Samples Tab Showed Products, Not Inventory**: The tab was handed the paginated Catalog list and flattened `physical_samples[0]` out of it, so it listed the 24 products of the current catalog page with mostly blank rack/box cells, and a product's second sample was unreachable. Samples now have their own query (`getPhysicalSamplesAction`) with search, status and brand filters.
- **Permanently Empty Requests Tab**: The tab was shown when the role was STAFF while its action asserted admin level, and the page swallowed the failure. Tabs and buttons are now driven by `getMyLibraryAccessAction`, which resolves effective rights server-side from the permission matrix, so no affordance is offered for an action the server will refuse.
- **Duplicate Fetch On Mount**: `role` defaulted to `"STAFF"` and fed the product query, so products were fetched twice on every mount — once on the guess, once for real. Rights are resolved first; reference data is split from the row query; only the active tab's rows are fetched.
- **Stale Suggestion Values**: `getProductMetadata` ran `distinct` without a `deleted_at` filter, so sub-category and finishing values from soft-deleted products kept appearing in dropdowns.

### Added
- **Catalog Table View**: A dense, row-oriented view mirroring the office material/supplier sheet column for column — No, Brand, Category, Product, Product Link, Drive Folder, Website, IG, Sales, Contact, Company, Update. Table is the default; the card grid remains one toggle away for visual material selection. Brand-level columns are read off the joined `Vendor`/`VendorContact` rather than duplicated per row.
- **`ProductCatalog.updated_at`**: Nullable additive column backing the sheet's "Update" field. Deliberately nullable rather than `@default(now())`, so rows predating the column stay unknown instead of being stamped with a false last-updated date; the table renders those muted, falling back to `created_at`.
- **Physical Sample Soft Delete**: `PhysicalSample.deleted_at` (additive, indexed). `SampleMovementLog` cascade-deletes with its sample, so removal is now a soft delete and borrow/return history survives. `deletePhysicalSampleAction` is the only sanctioned removal path and refuses a sample that is still out with a borrower or client.
- **Multi-Facet Filtering**: Brand, section, category, status, tag and sort were already supported by the service but never exposed. Filters now appear only on the tabs they affect, with an active-filter count and a clear control.
- **Brand Category Coverage**: A brand is not bound to one category — Taco supplies HPL and SPC alike. `getBrandCategoryCoverageAction` surfaces what each brand actually carries, so the Category picker groups that brand's own categories first and the Vendors tab shows its coverage. Suggestion only; new categories remain allowed and no per-vendor constraint was added.
- **Library Route Boundaries**: `error.tsx` and `loading.tsx` for the Library route group (UX audit P0 #3 / P1 #6 — the app previously had zero error boundaries).

### Changed
- **Styled Confirmations**: The four `window.confirm` calls in the Library were replaced with `AlertDialog`, and the product one now states what survives — schedules keep their frozen snapshot and sample history is retained (UX audit P1 #5).
- **Windowed Pagination**: Both catalog views rendered one button per page. They now window around the current page. The header count reported `products.length` (the current page) instead of the true total.
- **Dead Code Removed**: `facade.ts` (`LibraryFacade` was never imported by anything, despite `MASTER_SSOT.md` §67 naming it the only legal cross-extension entry point — Schedule and SketchUp import `LibraryService` directly), `ProductTable.tsx`, `ProjectProductRequestModal.tsx`, `StudioCard.tsx`, and the superseded `PhysicalInventoryTable.tsx`. Roughly 850 unreferenced lines, plus dead imports and constants inside the modal.
- **Sample-Aware Schedule Snapshot**: `ScheduleService` derives `catalog_has_sample` from the sample list, so its read now filters soft-deleted samples. Only new snapshots are affected; stored snapshots are never rewritten.

### Notes
- Both migrations are additive (`ADD COLUMN` / `CREATE INDEX` only) per `PLAN-catalog-library-sync.md`. No `DROP`, no `ALTER` of an existing column, no backfill.
- `npx prisma generate` must be run before typechecking, since `updated_at` and `PhysicalSample.deleted_at` are new.
- The four `LibraryService` methods consumed by Schedule and SketchUp (`getProductById`, `getSuggestions`, `getAllProducts`, `createProduct`), the `ProductCatalogInput` type, and `uploadLibraryImage` kept their signatures. `getAllProducts` gained optional `tags` and `sort` only.

## [Unreleased] - 2026-07-24

### Added
- **Catalog Reference URL**: Added an opt-in URL field to material, fixture, and schedule-only cards, with clickable safe links and durable snapshot mapping. The only schema change is a nullable `SketchupMaterial.reference_url` column.
- **Add From Library**: Added a searchable “From Library” mode to the existing Add-item dialog. Selecting a product creates a new linked project snapshot through `ScheduleService`; existing entries and Library products are not modified.

### Changed
- **Unified Schedule Code Manager**: Consolidated code reordering, normalization, reservation, and SketchUp duplicate-merge entry points inside Product Schedule. Complete material categories—including schedule-only and linked items—use a sortable browser draft; Apply updates Schedule codes and snapshots atomically, then derives UUID-backed SketchUp rename queues only for linked materials.
- **Bridge-Only SketchUp Integration**: The SketchUp page now focuses on model credentials, synchronized counts, and pending Pull/Sync actions. Its competing Code Manager was removed from the page; existing technical actions remain available for compatibility without becoming a second user workflow.
- **Material List XLSX Field Mapping**: The exported `TYPE` column now follows the Catalog Board Type field, while `INITIALS TYPE` is generated read-only from Color, Pattern/Motif, Texture/Finishing, and Size in that order; empty or duplicate values are omitted without changing stored project data.
- **Non-Destructive SketchUp Reconciliation**: Materials absent from an explicitly attested full plugin snapshot can be removed from transient SketchUp staging, but partial/legacy payloads never prune and linked Product Schedule entries remain retained as schedule-only cards.
- **Safe API-Key Revocation**: Revoking a SketchUp credential now rotates the key in place instead of deleting the `SketchupProject` bridge and its staged data.
- **Project-Relative Library Filtering**: Future Save-to-Library operations exclude color, finishing, and motif instructions that reference an actual code in the current project. Project snapshots and existing Library rows remain untouched.
- **Catalog Handoff Hydration**: When a manually created schedule-only card later arrives from SketchUp, empty material/FF&E staging fields are filled from the existing project snapshot. Existing staging values and the snapshot itself are never overwritten by plugin sync.

### Fixed
- **Premature Swap Persistence**: Choosing a second swap card no longer changes Product Schedule data or leaves a SketchUp action queued. `Cancel edit` discards the complete browser draft without calling the server, while a failed Apply rolls back the whole batch.
- **Legacy Sort-Order Swap Rollback**: Applying a valid reviewed swap no longer fails merely because old `schedule_sort_order` values differ from the visible code sequence. Apply deterministically realigns the internal order from current contiguous codes and verifies the exact reviewed exchange before commit; unsafe gaps or prefix mismatches still roll back without changing data.
- **Split Code Authority**: Linked Catalog cards and the unified manager now display the authoritative `ProjectScheduleEntry` code immediately after Apply. A not-yet-renamed SketchUp staging code is shown only as bridge status until Pull/Sync, preventing the two screens from presenting different “current” codes.
- **Render Board Coordinate Alignment**: Render pins, popovers, live drag previews, leader lines, and persisted image-relative coordinates now share one conversion path, fixing detached duplicate-looking pins without rewriting existing annotations.
- **Render Board Governance**: Read actions now enforce Schedule view permission, and board/annotation mutations write atomic audit logs alongside their persisted changes.
- **Manual Fixture Prefix Safety**: New manual Fixture categories now resolve through `ScheduleService` prefix rules instead of persisting an entire free-text category as the code prefix. Existing schedule entries and prefixes are unchanged.
- **Add-item Result Visibility**: A newly created manual or Library-backed entry now reveals its category and scrolls its card into view after refresh, including when that category was previously hidden locally.
- **SketchUp Sync Acknowledgement**: Sync responses now report counts and codes read back from persisted staging rows instead of echoing the request. Missing persistence or Product Catalog linking returns an actionable incomplete-sync error.
- **Catalog Notes Preservation**: Partial or faulty SketchUp scans can no longer cascade-delete linked Product Schedule snapshots containing manually edited notes and specifications.
- **Plugin Coded-Swatch Sync (v1.1.9)**: The Berkah Studio plugin includes valid coded materials with zero geometry usage, guarantees unique persistent UUIDs before payload construction, repairs UUIDs cloned by duplicated SketchUp swatches, explicitly attests complete snapshots before server-side pruning, and verifies persisted-code acknowledgement.
- **Duplicate Identity Hard Stop**: The sync API rejects duplicate material UUIDs, duplicate material/fixture codes, and missing identities before opening any write transaction, preventing multiple payload rows from silently collapsing into one staging row.
- **Card Field Checklist Continuity**: Per-card `catalog_fields` now transfers during schedule-only → SketchUp linking and mirrors back to the linked snapshot on later checklist changes, including intentional “Use project default”.
- **First Linked Edit Preservation**: The first data edit after linking now merges with the durable snapshot instead of rebuilding it from sparse staging, preserving untouched notes, images, prices, colors, dimensions, URLs, product links, and metadata.

### UI Changes
- **Render Board Print Composition**: Expanded the screen render and dedicated A4 landscape artwork while retaining one annotated render per sheet, equal-pitch code-only callouts, and black 30-degree architectural leaders. Every leader now terminates in one small solid architectural dot—without an arrowhead or selection ring—on screen and print. Editing includes a 3× cursor/drag magnifier, compact pin-link tools docked outside the canvas, and click-away deselection on blank workspace without modifying saved annotations.
- **Catalog Code Manager Consolidation**: Replaced the Catalog Board's pair-oriented swap entry point with the fuller sortable Code Manager UX. It includes category tabs, browser-only reorder and Reserve drafts, red-before/green-after previews, per-group and all-group Apply/Cancel controls, bridge-code status, and a clearly labeled SketchUp-only duplicate merge panel.
- **Material List Export Content**: Populated `INITIALS TYPE` in the existing XLSX layout from the card's physical-specification fields without changing workbook columns, spacing, or styling.
- **Add-item Dialog Hierarchy**: Reworked the Add-item dialog into a token-sized focused modal with compact Source and Item Type controls, clearer draft/Library guidance, canonical Library product identity, visible item status and selection, contextual submit labels, and loading-safe type switches.
- **Global Dialog Width Tokens**: Added root-level semantic dialog width tokens so portaled dialogs retain their intended size outside the dashboard settings wrapper.
- **Render Pin Placement**: Aligned the interactive pin and editor popover with the render image and printed leader overlay at every stored percentage.
- **Catalog Add Modes**: Extended the existing Add-item dialog with “New manual” and “From Library” modes while preserving its material/fixture structure.
- **URL Card Row**: Added an opt-in URL row with a truncated external link and explicit Modify control.
- **API Credential Action Label**: Renamed the SketchUp action from “Revoke Access” to “Rotate API Key” so the non-destructive behavior is explicit.
- **Plugin Version Visibility**: The StudioFlow Sync connection summary now shows the loaded plugin version so restart/reload status can be verified before testing.

