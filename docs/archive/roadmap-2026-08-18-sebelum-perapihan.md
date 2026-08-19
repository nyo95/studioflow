# StudioFlow — Roadmap

**Terakhir diverifikasi terhadap repo: 2026-08-18 (audit 30 temuan; 3 blocker + 2 rider SELESAI, lihat changelog #22).**

Berisi **pekerjaan yang belum selesai**, dan hanya itu. Setiap status di bawah
ini diperiksa ke kode, `schema.prisma`, dan `prisma/migrations/` pada tanggal di
atas — bukan diwarisi dari versi roadmap sebelumnya.

Yang sudah selesai ada di `CHANGELOG.md` (siklus berjalan) dan
`docs/archive/` (sebelumnya). Item roadmap yang terverifikasi selesai atau gugur
dipindahkan ke `docs/archive/roadmap-selesai-2026-08-10.md` **beserta buktinya** —
dibaca dulu sebelum mengerjakan sesuatu yang terasa familiar.

# ═══ AUDIT MASTER DATA 2026-08-18 — 30 temuan, 5 selesai, 25 terbuka ═══

**Status: gelombang 1 SELESAI (changelog #22), gelombang 2–5 belum dimulai.**

Sudah dikerjakan 2026-08-18: **B1** (drift `SampleStatus`), **B4** (harga kerja
nol), **B2** (crash P2002 soft-delete), plus dua rider yang tidak bisa dipisahkan
dari ketiganya: **H2** (`sampleState` menghitung sample hilang) dan **B6
sebagian** (aksi vendor `pricing-actions.ts` kini memakai `tx`; transaksi
bersarang di `quick-entry-actions.ts` MASIH terbuka).
Butir yang sudah selesai ditandai `[x]` di bawah dan sengaja tidak dihapus —
supaya terlihat apa yang sudah diperiksa terhadap kode, bukan diwarisi.
Laporan lengkap dengan berkas + nomor baris + bukti: `AUDIT-MASTERDATA-2026-08-18.md`.
Ringkasan temuan: `changelog.md` §[Audit] 2026-08-18 (#21).

Audit ini read-only atas permintaan owner ("whole check dulu"). Tidak ada satu
baris kode pun yang diubah. Butir di bawah menunggu keputusan owner sebelum
dieksekusi — **jangan mulai dari tengah daftar**, urutan gelombangnya sengaja:
gelombang 1 menghentikan data rusak masuk, gelombang 2 menghentikan crash,
sisanya baru konsistensi dan tampilan.

## Gelombang 1 — hentikan kerusakan data (perkiraan 1–2 hari)

- [x] ~~**B1 · `SampleStatus` drift**~~ — SELESAI #22. — tambahkan `SENT_TO_CLIENT` ke
      `prisma/schema.prisma:816-823`, `npx prisma generate` (di mesin Windows
      owner — lihat catatan Prisma di bawah). Lalu perbaiki
      `sample-actions.ts:82` `toLegacySampleStatus` supaya `LOST` dan
      `DISCARDED` tidak lagi dibaca "Dipinjam", dan `getSampleSummaryAction:190`
      berhenti menghitung sample hilang sebagai dipinjam.
      **Jangan tunda:** migrasi berikutnya bisa gagal karena Postgres tidak bisa
      `DROP VALUE` dari enum.
- [x] ~~**B4 · Harga kerja bisa jadi 0**~~ — SELESAI #22 (`checkWorkPrice`, 14 test). — tambahkan `.refine()` pada
      `WorkPriceFields.price` (`pricing-actions.ts:75`), dan pakai ulang
      `resolvePrice()` + `assertPriceSane()` dari `sku-price-rules.ts` di
      keempat penulisan (`:508, :551, :875, :912`). Pola yang benar sudah ada di
      `SkuPrice` — ini menyalinnya, bukan mendesain baru.
- [x] ~~**H2 · `sampleState` berbohong**~~ — SELESAI #22. — `material-view-service.ts:160-172`:
      hanya hitung sample hidup (`AVAILABLE`, `BORROWED`, `SENT_TO_CLIENT`),
      dan `sampleCount` jangan menjumlahkan `quantity` sample `LOST`/`DISCARDED`.
      Sejalan dengan kontrak §5.

## Gelombang 2 — hentikan crash (2–3 hari)

- [x] ~~**B2 · Soft-delete vs unique**~~ — SELESAI #22 (migrasi `20260818120000`). — migrasi baru: ganti `Party_name_key`,
      `Party_slug_key`, `Brand_name_key`, `Brand_slug_key` menjadi partial index
      `WHERE deleted_at IS NULL` (konsisten dengan `Sku_brand_code_uniq` yang
      sudah begitu). Lalu samakan cek konflik create/update di
      `party-actions.ts:166 & 229` dan `pricing-actions.ts:370 & 404`.
- [ ] **B3 · Slug tanpa cek unik** — satu helper `ensureUniqueSlug(tx, model, base)`
      dengan sufiks `-2`/`-3` dan fallback id pendek saat `slugify` menghasilkan
      string kosong. Pasang di 7 jalur tulis.
- [ ] **B5 · Lima jalur SKU** — satu `createSkuCore(tx, input, actor)` yang
      menjamin: slug dari `name`, `base_unit` tidak kosong, kategori primer
      selalu ditetapkan, `recordAudit` selalu dipanggil. Dipakai oleh kelima
      pemanggil (`library-service:1072 & 1625`, `quick-entry:345`,
      `sample-request-actions:411`, `excel-service:403`).
- [ ] **M6 · Error mentah bocor** — `action-wrapper.ts:93-95`: petakan P2002 dan
      kerabatnya ke pesan yang bisa ditindaklanjuti; jangan kembalikan
      `error.message` apa adanya.

## Gelombang 3 — konsistensi backend (3–5 hari)

- [ ] **B6 · Transaksi bersarang (SEBAGIAN selesai #22)** — aksi vendor di `pricing-actions.ts` sudah memakai `tx`. YANG TERSISA: buang `db.$transaction` di
      `quick-entry-actions.ts:97, 167, 239, 330` (sudah di dalam transaksi
      `createAction`); ganti `db` → `tx` di `pricing-actions.ts:369-470`.
- [ ] **B7 · Pohon kategori** — perbaiki lookup di
      `category-tree-service.ts:100` supaya menemukan kategori root yang akan
      diberi induk (cabang `needsParent` saat ini dead code); turunkan `path`
      ke seluruh keturunan saat berubah; **backfill** kategori duplikat yang
      sudah terlanjur dibuat.
- [x] ~~**H1 · Kolom Update**~~ — SELESAI. `getProductsLastChangeAction`
      (`masterdata-actions.ts:100-140`) sudah mengarah ke `MasterDataAudit`,
      bukan `studioflow.AuditLog`. Pertahankan pembacaan `entity_type` lama untuk
      riwayat sebelum rebaseline.
- [ ] **H3 · Penjaga hapus Party** — satukan `deleteCompanyAction` dan
      `deleteServiceVendorAction` menjadi satu jalur yang memeriksa **semua**
      referensi: brand, `WorkPrice`, `SkuPrice.supplier_party_id`, `BrandSupplier`.
- [x] ~~**H4 · Picker Vendor**~~ — SELESAI. Filter role di
      `getServiceVendorsAction:355` sudah mengikuti pola
      `getSupplierOptionsAction` tepat di bawahnya.
- [ ] **H7 · `WorkPrice` hard delete** — jadikan soft-delete (`deleted_at`),
      selaraskan dengan `deleteMaterialPriceAction`; `WorkPriceProjectRef`
      berhenti ikut terhapus.
- [ ] **H8 · Filter `kind`/`deleted_at`** pada update & delete work price.
- [x] ~~**H9 · Kategori lintas kind**~~ — SELESAI. `kind: "PRODUCT"` sudah
      ada pada lookup `quick-entry-actions.ts:408`.
- [ ] **H5 · Permission** — tegakkan `MASTERDATA_PRICE_MANAGE` di semua mutasi
      harga (kini 0 pemakaian); cabut `MASTERDATA_OFFERING_MANAGE` dari enum.
      **Keputusan owner diperlukan:** apakah pemisahan "kelola supplier" vs
      "kelola harga" memang diinginkan, atau enum-nya yang disederhanakan?
- [x] ~~**H6 · Audit yang hilang**~~ — SELESAI. `recordAudit` untuk
      `PartyContact` CRUD (`party-actions.ts`), create SKU di
      `sample-request-actions:435`, sudah terpasang.

## Gelombang 4 — UI/UX & skala (3–5 hari)

- [x] ~~**M2 · Guard pintu keluar (WAJIB per AGENTS.md)**~~ — SELESAI.
      `useUnsavedChangesGuard` + `<UnsavedChangesPrompt>` terpasang di
      `SampleLibraryClient` (2 dialog), `SampleRequestDialog`,
      `SupplierDetailClient` contacts, dan `SupplierJasaTab` (dialog + buang
      tombol Modify "Ubah").
- [ ] **M1 · IA nav** — masukkan `/masterdata/prices` ke `MASTERDATA_SECTIONS`;
      ganti label "Prices" (yang menuju `/materials`) menjadi "Material".
      Putuskan nasib `/masterdata/settings` — masuk nav atau memang internal.
      **Keputusan owner diperlukan** untuk penamaannya.
- [ ] **M3 · Halaman harga load-everything** — paginasi + pencarian server-side
      di `/masterdata/prices`; batasi `getSampleSkuOptionsAction` (kini
      mengembalikan seluruh tabel SKU). Cabut `getCompaniesAction` +
      `getVendorsAction` dari `/masterdata/materials` yang tabelnya sudah
      dipaginasi rapi.
- [ ] **M4** `getPartyBrandsAction` — ganti pemuatan semua SKU dengan satu `groupBy`.
- [ ] **M7** Filter `kind` + dedup pada facet kategori (`material-view-service:280`).
- [ ] **M8** Batas ukuran upload Excel yang benar-benar berlaku di App Router;
      bungkus impor dalam transaksi supaya tidak ada katalog setengah jadi.
- [ ] **M9** `generateWorkPriceCode` — pakai sequence Postgres atau
      advisory lock; perbaiki urutan leksikal di atas 9999.
- [ ] **M5** Satu bahasa per permukaan. **Keputusan owner:** Indonesia
      seluruhnya, atau Inggris untuk label struktural?
- [x] ~~**M10**~~ — SELESAI. Buang state `material_price`/`labor_price`/`total_price`
      dari preflight check `db.ts`, perbaiki type `_count` di `pricing.ts`,
      hapus kolom "Paket M+U" dari tabel Supplier (selalu 0).

## Gelombang 5 — dokumen acuan (1 hari, paling murah)

- [x] ~~**D1 · `AGENTS.md` kontrak Master Data**~~ — SELESAI #22, ditulis ulang jadi 10 bagian terhadap v2. — tulis ulang terhadap
      v2. Yang disebut kontrak sekarang (`Material`, `catalog_brand`,
      `MaterialCandidate`, `SampleCandidate`, `/masterdata/curation`,
      `ServiceVendor`, harga sebelum/sesudah diskon, status `PENDING`/`REJECTED`)
      **tidak satu pun masih ada**. Ini berkas yang setiap agent diperintahkan
      patuhi lebih dulu — biaya perbaikannya paling kecil, dampaknya paling
      besar untuk sesi berikutnya.
- [x] ~~**D2**~~ — SELESAI. `/masterdata/prices/page.tsx:4-7` dan
      `PricingClient.tsx:8-9` sudah diperbaiki — rujukan `material_price` diganti
      menjadi `kind = MATERIAL_LABOR` / `LABOR_ONLY`.
- [ ] **D3** `material-view-service.ts:166` — hapus klaim `SENT_TO_CLIENT` tidak ada.
- [ ] **D4** `CHANGELOG-CODEX.md` — buat berkasnya, atau cabut kewajibannya dari
      `AGENTS.md`. **Keputusan owner diperlukan.**

## ⏳ Catatan Prisma (berlaku untuk B1 dan B2)

Sama seperti item Prisma 2026-08-14 dan 2026-08-18 di bawah: agent tidak bisa
menjalankan `prisma generate` / `prisma migrate dev` dari sesi cloud —
environment-nya Linux, proyek ini Windows dengan binary engine khusus Windows di
`node_modules`. B1 dan B2 keduanya butuh langkah ini dijalankan owner di
mesinnya sendiri setelah schema diubah.

---

# ═══ FEEDBACK OWNER 2026-08-18 — 5 poin Master Data ═══

**Status: kode SELESAI seluruhnya (changelog #20), TAPI satu langkah
operasional wajib masih menunggu owner sebelum semuanya benar-benar aktif.**
Lihat "⏳ Menunggu owner" tepat di bawah — jangan lewati sebelum menganggap
item 2 dan 5 selesai di mesin sendiri.

## ⏳ Menunggu owner — satu langkah, wajib

Sama seperti item Prisma 2026-08-14 di bawah: agent tidak bisa menjalankan
`prisma generate` / `prisma migrate dev` dari sesi cloud ini — environment-nya
Linux, proyek ini Windows dengan binary Prisma engine khusus Windows di
`node_modules`, dan menjalankannya dari Linux akan menulis binary yang salah ke
`src/generated/prisma` dan merusak dev server. Jalankan di mesin sendiri:

```bash
npx prisma generate
npx prisma migrate dev   # menerapkan 20260818090000_add_brand_tags
```

lalu restart dev server (hapus folder `.next` juga kalau overlay masih
menunjukkan "(stale)" setelahnya).

**Sampai langkah ini dijalankan:**
- Item 2 (error konsol Decimal) **tetap muncul** — kodenya sudah benar
  (`serializeDecimalFields` generik di `extensions/library/types.ts`), tapi
  `src/generated/prisma` yang basi (terakhir digenerate 2026-08-12, dua hari
  sebelum `price_list` dihapus dari schema 2026-08-14) masih mengembalikan
  `price_list` sebagai `Decimal` mentah lewat `SKU_FULL_INCLUDE`'s `include`.
- Item 5 (Hashtag brand) **akan gagal disimpan** — `Brand.tags` belum ada di
  database sampai migrasi `20260818090000_add_brand_tags` diterapkan.
- Item 1, 3, 4 **sudah aktif tanpa langkah tambahan** — tidak menyentuh schema.

## Lima temuan, dengan penomoran aslinya

1. **Tabel SKU brand cuma menampilkan satu supplier** — ✅ selesai.
   `getBrandSkusAction` sekarang mengambil SEMUA harga berlaku per SKU
   (sebelumnya `take: 1`, cuma yang termurah), `BrandDetailClient` menampilkan
   "Nama +N" dengan tooltip daftar lengkap. **Disengaja tidak diubah:** kartu
   "Suppliers" & tab Suppliers brand tetap dari relasi `BrandSupplier` yang
   eksplisit (tombol "Assign Supplier") — harga baru untuk supplier baru TIDAK
   otomatis membuat relasi itu. Kalau owner mau perilaku itu berubah (harga →
   auto-assign supplier ke brand), itu keputusan produk terpisah, belum
   dikerjakan di sini.
2. **Error konsol Decimal (4 varian)** — ✅ kode sudah benar sejak 2026-08-14,
   akar masalahnya operasional (lihat "⏳ Menunggu owner" di atas).
3. **Tombol mata tidak konsisten Brand vs Supplier** — ✅ selesai. Kolom
   Actions di `SupplierClient.tsx` (halaman Suppliers & Vendors) sekarang
   selalu tampil dengan tombol Eye, sama seperti tabel Brand.
4. **Hapus harga di Pricing table tidak langsung update** — ✅ selesai, dua
   penyebab: badge jumlah tab dulunya statis dari prop server (bukan dari
   state tab yang sudah di-update saat hapus) — sekarang reaktif lewat
   `onCountChange`; dan ketiga tab dulunya di-mount kondisional (unmount saat
   pindah tab membuang state hasil hapus) — sekarang selalu ter-mount,
   disembunyikan lewat CSS `hidden`.
5. **+Brand: Category jadi checklist, Hashtag baru** — ✅ kode selesai, TAPI
   Hashtag butuh migrasi (lihat "⏳ Menunggu owner"). Category sekarang
   checklist (`CreatableChecklist`, komponen baru) dari
   `brand-catalog-categories.json` + kategori yang sudah dipakai, tetap bisa
   menambah opsi baru. Hashtag field baru terpisah, pakai `CreatableTagInput`
   yang sudah ada, suggestions dari pool tag katalog (`metadata.tags`).

Detail lengkap tiap poin (kutipan owner, akar masalah, file yang diubah) ada di
`changelog.md` #20.

---

# ═══ FEEDBACK OWNER 2026-08-14 — 10 poin Master Data ═══

**Status: ✅ SELESAI seluruhnya (changelog #16).** Dicatat di sini bukan sebagai
pekerjaan tersisa, melainkan karena tiga keputusan di dalamnya mengubah arah
item roadmap lain — dan satu langkah operasional masih menunggu owner.

## ⏳ Menunggu owner — satu langkah, wajib

Poin 8 menghapus kolom database. Agent tidak bisa menjalankan `prisma generate`
dari sandbox (EPERM saat menimpa `src/generated/prisma/`), jadi berikut harus
dijalankan di mesin owner **sebelum** aplikasi dinyalakan:

```bash
npx prisma migrate deploy   # 20260814100000_skuprice_single_price
npx prisma generate         # client lama masih mengenal price_list
npm run build
```

Sampai `prisma generate` dijalankan, tipe Prisma di repo masih memuat
`price_list` — tidak ada kode yang membacanya lagi, jadi `tsc` tetap bersih,
tetapi client dan database baru benar-benar sinkron setelah langkah ini.

## Keputusan yang mengubah arah item lain

| Keputusan | Item yang terdampak |
|---|---|
| **Satu harga** (`price_list` dihapus) | **P1 gugur** — lihat di bawah. `bq_ready` ikut diperbaiki, sehingga statistik "price incomplete" di halaman Material berhenti berbohong. |
| **Dialog Brand pakai `Dialog`, bukan `Sheet`** | Menjawab poin 10. `Sheet` **tetap** dipakai `SkuDetailDrawer` — di sana konteks di belakang panel masih relevan. Jangan konversikan yang itu tanpa alasan baru. |
| **`CreatableTagInput` lahir** | Kandidat pengganti untuk field tag lain yang masih string koma — lihat antrean di bawah. |

## Susulan 2026-08-14 sore — dua jalan ke SKU brand disatukan

Owner bertanya: *"lihat SKU sama dengan menekan 'AICA' - SKUs?"* Ternyata ya,
dan kedua jalan itu punya kemampuan berbeda yang tidak terbaca dari labelnya —
tombol bernama "Lihat SKU" justru yang bisa MENYUNTING, sementara tab SKUs
read-only. Sekarang satu jalur: klik baris brand → detail → tab SKUs, dan tab
itu membuka `MasterDataProductDialog` yang bisa menyunting. Detail di
changelog #17.

**Sisa pekerjaan manual (kecil, tapi nyata):**

- `src/subapps/master-data/components/SkuDetailDrawer.tsx` **tidak dipakai
  siapa pun lagi** — hapus. Agent tidak bisa menghapus berkas dari sandbox
  (`Operation not permitted` pada mount). Tidak ada yang mengimpornya, jadi
  penghapusannya aman tanpa perubahan lain.
- Setelah berkas itu hilang, primitif `Sheet` tidak punya pemakai sama sekali.
  **Jangan ikut dihapus.** Panel geser-dari-samping adalah pola yang sah untuk
  konten yang mendampingi konten di belakangnya; yang salah adalah memakainya
  untuk form yang menuntut perhatian penuh. Biarkan menunggu pemakai yang tepat.

## Susulan 2026-08-14 malam — View-First Protocol dicabut

Owner: *"tidak perlu double gini, saat diklik lgsg aja ada inline edit (ga usa
di pencet 'modify' lagi)"*. Protokol yang tertulis WAJIB di `AGENTS.md` dan
`MASTER_SSOT.md` §2.2 diganti **Edit-First Protocol + exit guard**. Detail di
changelog #18.

**Aturan baru yang mengikat pekerjaan berikutnya:**

- Dialog untuk data yang sudah ada terbuka langsung siap disunting. Jangan
  menambahkan tombol "Modify" baru. Kalau menemukan sisa yang terlewat, hapus.
- Setiap dialog yang bisa disunting **WAJIB** memakai `useUnsavedChangesGuard` +
  `<UnsavedChangesPrompt>` dari `src/hooks/use-unsaved-changes-guard.tsx`, dan
  **WAJIB** memanggil `guard.markPristine(next)` di tempat form dibangun. Dialog
  edit-first tanpa guard bukan versi yang lebih sederhana — ia versi yang belum
  selesai.
- Tutup setelah save lewat `guard.closeAfterSave()`, bukan `onOpenChange(false)`.
- Satu tombol tutup saja. `DialogContent` sudah merender X-nya sendiri.

**Yang belum diperiksa terhadap aturan baru:** dialog di luar Master Data dan
`project-identity-strip` belum ditelusuri satu per satu. Yang sudah dipastikan
BUKAN gatekeeper: `CatalogBoard` (inline edit per-field) dan `today-inline-add`
(tombol yang mekar jadi input). Sisanya perlu disisir kalau ada laporan dialog
yang masih meminta dua langkah.

## Susulan 2026-08-14 (4) — editor link, kolom Aksi, kategori sebagai hashtag

Empat temoan owner pada tampilan; semua selesai, detail di changelog #19.
Yang perlu diketahui pekerjaan berikutnya:

- **Pola kolom Aksi sekarang baku:** tiga tombol ikon mata / pensil / tong
  sampah, rata kanan, seperti tabel Supplier. Baris tabel TIDAK lagi bisa
  diklik untuk navigasi. Ikuti pola ini pada tabel baru.
- **Kategori ditampilkan sebagai frasa miring dipisah koma**, bukan chip, di
  semua tempat (tabel Brands, tab Overview, mode baca `CreatableTagInput`).
  Chip dicadangkan untuk hal yang benar-benar bisa diklik.
- **Ikon logo merek tidak tersedia.** lucide-react v1 menghapus `Instagram`,
  `Facebook`, `Youtube`, `Linkedin` — mengimpornya error kompilasi. Pakai ikon
  generik + `title`/`aria-label`, jangan menggambar ulang logonya di repo.

**Sisa pekerjaan yang lahir dari sini:**

- **Kode "expanded SKU rows" di `MasterDataMaterialsClient` sudah mati total.**
  `expandedBrandId`, `expandedSkus`, `expandedTruncated`, `expandedLoading`,
  `toggleBrandExpand`, dan blok JSX-nya tidak punya pemicu sejak kolom chevron
  dihapus — dan `toggleBrandExpand` sendiri sudah lama muncul sebagai peringatan
  eslint "assigned but never used", jadi ia mati sebelum perubahan itu.
  Membuangnya berarti ikut memeriksa apakah `getSkusForBrandAction` masih
  dipakai tempat lain; kerjakan sebagai pembersihan tersendiri, bukan disisipkan
  ke perubahan tampilan.
- **Kanonikalisasi kategori baru berlaku untuk data BARU.** Kategori lama yang
  sudah terlanjur punya dua ejaan berbeda pada baris `Category` yang
  berbeda-beda (kalau ada — perlu diperiksa dulu, `categorySlug` seharusnya
  sudah mencegahnya) tidak disentuh apa pun di sini. Skrip audit sebelum skrip
  perbaikan.

## Antrean lanjutan yang lahir dari feedback ini

Belum dikerjakan; tidak diminta owner; dicatat supaya tidak hilang.

- **`categoryText` di `MasterDataProductDialog` masih string koma.** Field tag
  SKU adalah kembaran persis dari field Category brand yang baru saja diganti
  (poin 9), dan masih memakai pola lama. Memindahkannya ke `CreatableTagInput`
  memberi autocomplete yang sama dan menutup satu lagi pintu masuk duplikat
  "HPL" / "hpl". Kecil, tapi menyentuh dialog yang baru ditulis ulang, jadi
  tidak digabungkan ke perubahan ini.
- **Tabel master satuan (unit).** `collectUnits()` menyarankan satuan dari baris
  yang sudah tampil di halaman Pricing — cukup, dan sengaja: daftar satuan
  sebuah studio pendek dan berekor panjang. Kalau nanti satuan perlu punya
  aturan sendiri (konversi, satuan baku per kategori), barulah ia pantas jadi
  tabel. Sekarang belum.
- **Nasib data diskon lama.** Poin 8 menerima hilangnya selisih diskon. Kalau
  suatu saat "berapa diskon yang pernah kita dapat dari supplier X" jadi
  pertanyaan nyata, jawabannya BUKAN mengembalikan `price_list` — melainkan
  mencatat diskon sebagai peristiwa negosiasi tersendiri. Ditulis di sini
  supaya tidak dijawab dengan menambah kolom kedua lagi.

---

# ═══ ANTREAN BERIKUTNYA — Rombakan Master Data (PRD 2026-08-12) ═══

**Permintaan owner 2026-08-12:** *"pelajari reworks utk masterdata → tujuan kamu
buat implementation plan saja dulu."*

**Status 2026-08-12: ✅ keputusan owner B-Q1…B-Q7 diterima, Fase 0 (a+b) selesai.
Eksekusi boleh mulai kecuali Fase 1.4 — lihat P5, P6, P7.**

Rencana lengkapnya ada di **`docs/PLAN-MASTERDATA-REWORK-2026-08-12.md`**
(memenuhi PRD §24 A–G). Yang di bawah ini hanya ringkasan supaya roadmap tetap
bisa dibaca sendirian.

## P0 — Tiga premis PRD yang sudah kedaluwarsa

PRD ditulis sebelum pekerjaan 2026-08-11. Yang disebutnya sebagai masalah
terbuka, dua di antaranya sudah tertutup:

- **Drift `WorkPrice`** → sudah beres (`20260811120000`, `20260811120100`).
  Turun jadi verifikasi 15 menit, bukan Fase 1 prioritas 1.
- **`extensions/library` rusak** → sebagian usang. 13 berkasnya ada,
  `library-service.ts` tidak menyentuh model `studioflow`. Yang tersisa adalah
  delegasi yang disengaja dari `material-view-service.ts`.
- **`MasterDataAudit` tidak ditulis** → **masih benar, dan ini gap terparah.**
  Nol `prisma.masterDataAudit.create` di seluruh `src/`. PRD §15 menyebut ini
  syarat "production-safe", jadi ia yang mengambil slot prioritas teratas.

## P1 — Temuan baru yang tidak ada di PRD maupun roadmap

**~~🔺 Arah List Price / Net Price terbalik.~~ → ✅ GUGUR 2026-08-14.**

Temuan aslinya: Excel Sheet2 baris 11–12 menulis *"List Price (mandatory)"*,
*"Net Price (optional)"*, sementara schema justru sebaliknya (`price_list
Decimal?` opsional, `price_net Decimal` wajib) — sehingga staf yang baru tahu
harga katalog tidak bisa menyimpan barisnya. Menunggu keputusan owner **B-Q4**.

Owner menjawab lebih jauh dari yang ditanyakan: bukan membalik arah, melainkan
**menghapus salah satu kolomnya** (feedback 2026-08-14 poin 8 — *"perubahan
skema harga jadi 1 best price aja"*). Dengan satu kolom harga, pertanyaan "mana
yang wajib" tidak punya isi lagi. Lihat migrasi
`20260814100000_skuprice_single_price` dan changelog #16.

Efek samping yang ikut tertutup: `bq_ready` di `v_bq_material_rate` dulu
menuntut `price_list` terisi, sehingga hampir selalu FALSE — itulah sumber angka
"172 dari 172 price incomplete" di halaman Material. Definisinya sekarang: ada
harga, dan ada satuan.

## P2 — Yang sudah beres dan TIDAK perlu dikerjakan lagi

Diperiksa ke kode 2026-08-12, supaya tidak ada yang mengerjakannya dua kali:

- `MasterDataBrandDialog.tsx` — **nol** field SKU/harga/dimensi. PRD §5.3 sudah
  terpenuhi.
- `PartyRoleKind` (6 nilai) menampung kelima `Company Categories` Excel.
  Baris **"Must verify"** di Anti-Regression Matrix PRD §18 → **terverifikasi,
  tidak perlu perubahan schema.**
- `WorkPrice.kind` sudah dinyatakan, bukan disimpulkan (E8).
- `valid_from` sudah dilepas dari form (`PricingClient.tsx:727`), sesuai Sheet2.
- Empat larangan PRD §22 (`PartyCategory`, `BrandSupplier.sku_id`,
  `WorkPrice→Sku`, `is_complete`) — schema bersih dari keempatnya.

## P3 — Gap nyata, berurut menurut ketergantungan

1. **`MasterDataAudit` tidak pernah ditulis** — Fase 1.2.
2. **`quickCreateSkuAction` tidak ada.** Yang ada hanya party/brand/work-vendor
   (`quick-entry-actions.ts:99,169,236`). **Ini prasyarat mutlak** sebelum
   tombol "Add Material" dihapus dari Materials — kalau urutannya dibalik, SKU
   tidak bisa dibuat dengan cara apa pun. **Urutan PRD §19 salah di titik ini
   dan sengaja saya balik.**
3. **`PartyContact.brand_id` ada di schema, tidak pernah muncul di UI.**
   `PartyDialog.tsx` hanya menulis `contact_person`/`contact_role`. Pertanyaan
   PRD §4 — *"siapa sales TACO kita di Supplier A?"* — belum bisa dijawab tanpa
   catatan bebas, padahal kolomnya sudah tersedia.
4. **Halaman Supplier memaksa tab Material vs Services yang eksklusif**
   (`SupplierClient.tsx:637`) — bentrok langsung dengan PRD §3.1.
5. **Halaman Materials masih grain-SKU** dengan grid kartu brand sebagai
   landing (hasil R1), bukan tabel grain-Brand yang bisa di-search/sort/filter.
6. **Excel baru 2 dari ~15 sheet**, tanpa deteksi konflik. Fase terberat —
   perlakukan sebagai proyek tersendiri, bukan satu langkah.
7. `WorkPrice.code` masih wajib+unik padahal Sheet2 menulis *"BQ code - remove"*.
8. Unit masih input teks bebas; Sheet2 minta dropdown.

## P3b — ✅ Batch eksekusi #1 disetujui owner 2026-08-12

Owner menyetujui temuan Fase 0.b dan urutan revisi, lalu membuka **Fase 1.0,
1.2, 1.3, dan bagian Fase 2 yang tidak terblokir**.

Rencana eksekusinya — dengan berkas, baris, kasus uji, dan definition of done
per langkah — ada di **`docs/implementation_plan.md`**. Ringkasnya:

- **1.0** satu `slugify` bersama (surgical, 7 lokasi, hanya 4 yang berubah
  perilaku) + regression test + **laporan divergensi slug: lapor, jangan tulis
  ulang**
- **1.2** `MasterDataAudit` di ~35 titik tulis nyata, **termasuk jalur
  `LibraryService`** yang jadi CRUD Brand/SKU sebenarnya. Mencatat operasi dan
  record yang terdampak, bukan "action dipanggil". Diff di `library-service.ts`
  wajib aditif.
- **1.3** `WorkPrice.code` dibangkitkan otomatis, hilang dari UI, kode lama tidak
  disentuh
- **2.1–2.5** Materials grain-Brand, SKU read-only, kelengkapan turunan.
  **2.6 (hapus "Add Material") TIDAK termasuk** — menunggu 4.1 teruji.

Guardrail tambahan owner: konsolidasi slugify harus minimal, `slugifyTag` dan
pasangannya tidak boleh diubah terpisah, `LibraryService` tidak boleh
di-refactor umum, dan redesign ini bukan alasan memperbaiki Library yang tak
berkaitan. Sebelum migrasi yang mengubah data: **berhenti, laporkan dampaknya
lebih dulu.**

## P3c — 🔍 Audit balik Batch #1 (2026-08-12) — 6 klaim DoD tidak terbukti

Batch #1 dilaporkan agen sebagai selesai dengan **semua** DoD Fase 2.1–2.4
tercentang. Diperiksa ulang terhadap kode pada 2026-08-12. `npx tsc --noEmit`
dan 79 test memang bersih — keduanya benar. Tapi enam klaim DoD tidak
bertahan saat kodenya dibaca, dua di antaranya cacat fungsional nyata.

Semuanya sudah **diperbaiki** di siklus ini — rinciannya di `CHANGELOG.md`
entri 2026-08-12 (#5). Dicatat di sini karena polanya, bukan daftarnya:

| # | Klaim | Kenyataan |
|---|-------|-----------|
| 1 | "search works" | `search` ikut jadi syarat keluar dari brand landing → kotak "Search across all brands" justru melempar user ke tabel SKU; cabang search di `getBrandView` **dead code** |
| 2 | "sort works" | Tidak ada kontrol sort di brand landing; `sort: sku_count` hanya mengurutkan 50 baris yang sudah dipaginasi |
| 3 | "SQL-aggregated" | Query totals `findMany` **tanpa `take`** atas seluruh tabel Brand tiap render — anti-pattern yang header file itu sendiri klaim sudah dihapus |
| 4 | completeness §5.1 | `supplierCount` menghitung `BrandSupplier` yang `Party`-nya soft-deleted → `isComplete` inflasi |
| 5 | lazy fetch | `getSkusForBrand` tanpa `take`, include object graph penuh per SKU |
| 6 | pagination | Hardcode `50`, bukan `pageSize`; benar hanya karena `BRAND_PAGE_SIZE` kebetulan 50 |

**Pelajaran yang perlu jadi aturan, bukan sekadar catatan:**

- **`tsc` bersih + test hijau ≠ DoD terpenuhi.** 79 test itu isinya slug,
  sku-price, dan category-tree. Nol di antaranya menyentuh Fase 2.1–2.4.
  Melaporkan "79 tests pass" sebagai bukti batch ini adalah bukti yang tidak
  menguji apa pun yang diklaim.
- **Aturan yang ditulis dua kali akan menyimpang.** Cacat #1 lahir karena
  `isBrandLanding` ditulis di `page.tsx` *dan* `MasterDataMaterialsClient.tsx`.
  Sekarang satu fungsi murni di
  `src/subapps/master-data/lib/brand-view-rules.ts`, dengan test.
- **Kalau kode tidak bisa diuji, itu temuan — bukan alasan.**
  `scripts/run-tests.mjs` tidak bisa menjangkau apa pun yang mengimpor Prisma
  atau `server-only`. Konsekuensinya bukan "fase ini tidak bisa dites",
  melainkan **keputusannya harus diangkat ke modul murni**.

### Sisa terbuka dari audit ini

- [ ] `getBrandView` dan `getSkusForBrand` masih tanpa test — keduanya menyentuh
      Prisma. Butuh test integrasi berbasis DB, yang belum ada infrastrukturnya
      di repo ini (lihat P7: DB tak terjangkau dari sandbox).
- [ ] `next build` **belum pernah diverifikasi** di siklus ini. SIGBUS di
      sandbox (binary SWC native lewat mounted FS) — bukan cacat kode, tapi
      artinya build production hanya terbukti kalau owner menjalankannya di
      mesin lokal. **Jalankan `npm run build` sebelum deploy.**
- [ ] `SampleLibraryClient.tsx:90` — `initialSummary` diterima lalu tidak
      dipakai. Prop mati atau fitur setengah jadi; belum ditelusuri.

## P4 — Fase eksekusi

`docs/PLAN-MASTERDATA-REWORK-2026-08-12.md` §G, dengan berkas per langkah.
Ringkas: **F0** bukti (selesai, sisa audit slugifikasi+RBAC) → **F1** audit
trail + dua koreksi schema terblokir → **F2** Materials grain-Brand → **F3**
Party multi-peran + kontak per merek → **F4** Price hub + quick entry SKU →
**F5** Excel seluruh schema → **F6** regresi & 15 alur UX PRD §17.

Bobot: F5 sendirian bisa setengah dari total. F1 satu-satunya yang menyentuh
data yang sudah ada — **backup sebelum migrasi.**

## P5 — Keputusan owner ✅ TERKUNCI 2026-08-12

Ketujuhnya dijawab. Rinciannya di `docs/PLAN-MASTERDATA-REWORK-2026-08-12.md` §F.

| | Keputusan | Dampak rencana |
|---|---|---|
| **B-Q1** | `PartyRoleKind` **dipertahankan** sebagai satu daftar gabungan | nol perubahan schema |
| **B-Q2** | `WorkPrice.code` disimpan tapi **dibangkitkan otomatis**, disembunyikan dari staf | **tanpa migrasi** — turun kelas B → C |
| **B-Q3** | **slug DITOLAK sebagai fallback identitas.** ID kosong + slug sudah ada → **tolak sebagai duplikat**, jangan diam-diam jadi UPDATE | membalik perilaku `excel-service.ts:365,503` |
| **B-Q4** | List Price **wajib**, Net Price opsional — final. **Dilarang** mengarang `price_list` dari `price_net` | kemungkinan besar **tanpa migrasi** juga: kalau ada baris lama NULL, kolom DB tetap nullable dan kewajiban ditegakkan di form |
| **B-Q5** | Hapus "Add Material" — **ya**, tapi baru setelah `quickCreateSkuAction` berfungsi penuh & teruji | mengunci 4.1 sebelum 2.6 |
| **B-Q6** | `Sample` create+update via import; **`SampleMovement` READ-ONLY**, suntingan ditolak & dilaporkan | Fase 5.3b |
| **B-Q7** | periksa DB sendiri kalau lingkungan mengizinkan | **tidak mengizinkan** — lihat P7 |

**Efek bersihnya: Fase 1 jadi jauh lebih ringan dari perkiraan.** Kedua koreksi
schema yang tadinya kelas B turun jadi kelas C. Larangan mengarang `price_list`
itulah yang menghemat migrasinya, bukan mempersulitnya.

## P6 — Fase 0.b selesai: tiga temuan, dua mengubah rencana

**H.1 — Slugifikasi: 7 implementasi, 2 perilaku.** *(dikoreksi dari 6 —
`categorySlug` di `category-tree-rules.ts:17` terlewat karena namanya bukan
`slugify`.)* Tiga melakukan NFKD (`category-tree-rules.ts:17`,
`quick-entry-actions.ts:55`, `LibraryService.slugifyTag:70`) dan **ketiganya
identik secara perilaku**; empat lainnya tidak. `"PT Café Créme"` →
`pt-cafe-creme` lewat quick entry, `pt-caf-cr-me` lewat form Party.
**`quickCreateSkuAction` akan jadi pembuat `Sku.slug` kedua**, jadi konsolidasi
slugify **naik jadi langkah 1.0** — paling awal, bukan utang teknis.

Koreksinya menguntungkan: implementasi kanonik **sudah ada dan sudah diuji**
(`categorySlug`, murni dan bebas I/O), dan konsolidasi hanya mengubah perilaku
di **4 tempat** — jadi entitas yang slug-nya berisiko bergeser cuma `Party`,
`Sku`, `Brand`. Catatan: acuan "byte-identical" di `library-service.ts:66`
menunjuk `scripts/seed-brand-categories.mjs` yang **sudah pindah** ke
`docs/archive/scripts-usang/`; alamatnya diperbaiki, skrip arsipnya tidak
disentuh.

**H.2 — RBAC: tidak ada jalur tulis tanpa gerbang.** Subapp master-data 45/45
bergerbang. `library-actions.ts` 18 dari 26; kedelapan sisanya **semuanya
pembacaan** dan tetap di balik `requireSession()`. Satu-satunya penulisan yang
tampak menganga (`createProjectProductRequestAction`) ternyata bergerbang lewat
keanggotaan proyek. **Bukan lubang** — turun jadi langkah 1.6 (konsistensi
`MASTERDATA_VIEW`).

**H.3 — ⚠️ Lingkup Fase 2 & 3 lebih besar dari perkiraan.** CRUD `Brand` dan
`Sku` **tidak tinggal di `src/subapps/master-data/`** — keduanya di
`LibraryService` (`library-service.ts:406,495,568,883,1298` untuk Brand;
`:969,1130,1293,1312,1512` untuk Sku), 1.603 baris. Jadi `extensions/library`
bukan sekadar "tidak rusak", ia **jalur tulis utama Master Data**. Fase 2, 3,
dan 4.1 semuanya akan menyentuh berkas di luar subapp.

## P7 — B-Q7: DB tidak terjangkau dari sandbox → skrip inspeksi

`DATABASE_URL` menunjuk `localhost:5432`, Postgres `docker-compose` di PC owner.
Shell agent VM Linux terisolasi. Lima rute diuji (`localhost`,
`host.docker.internal`, `172.17.0.1`, `10.0.2.2`, `192.168.65.254`) — semuanya
refused/unreachable. Dua dump di `backups/` bertanggal 2026-07-30, pra-rebaseline
v2, tidak sah jadi bukti keadaan sekarang.

Gantinya: **`scripts/inspect-masterdata-state.mjs`** — hanya baca, nol perintah
tulis. Melaporkan status migrasi + apakah `20260811120100` applied + bukti fisik
kolom `material_price`/`labor_price` sudah hilang + jumlah baris 18 tabel +
`SkuPrice.price_list IS NULL` (dampak B-Q4) + ruang tabrakan `WorkPrice.code` +
grup slug duplikat (dampak B-Q3).

```bash
docker compose up -d db
node scripts/inspect-masterdata-state.mjs
```

**Sampai keluarannya ditempel ke §I.1, Fase 1.4 tidak boleh dieksekusi.**
Sisanya — 1.0, 1.1, 1.2, 1.3, 1.5, 1.6, seluruh Fase 2 — boleh jalan.

## P8 — Protokol pra-migrasi (aturan eksekusi owner)

Sebelum migrasi schema apa pun: (1) periksa baris terdampak; (2) laporkan dampak
backfill; (3) **jangan mengarang nilai historis**; (4) ambil/verifikasi backup;
(5) cek ulang anti-regression matrix. Delapan larangan tetap: `PartyCategory`
untuk kategori material, `BrandSupplier.sku_id`, `WorkPrice→Sku`, BOM,
penghapusan otomatis Excel, merge konflik otomatis, `is_complete`, **identitas
berbasis slug**.

---

# ═══ UX REDESIGN — Master Data (2026-08-12, spec final §A–AO) ═══

**Status:** Plan selesai. Rincian berkas, dependency, dan definition of done per phase ada di
`docs/PLAN-MASTERDATA-UX-2026-08-12.md`. Keputusan terbuka D1–D6 perlu konfirmasi owner sebelum eksekusi phase yang terpengaruh.

## Keputusan D1–D6 — ✅ SEMUA TERJAWAB & DIIMPLEMENTASI 2026-08-12

| | Keputusan | Status |
|---|---|---|
| **D1** | Route brand detail → `/masterdata/materials/[brandId]` | ✅ Done |
| **D2** | Harga di Brand Detail → preview 10 + "View all →" link | ✅ Done |
| **D3** | Route supplier detail → `/masterdata/suppliers/[partyId]` | ✅ Done |
| **D4** | Archive brand dengan SKU aktif → warning tapi boleh lanjut | ✅ Done |
| **D5** | Import preview → inline results card (halaman preview deferred) | ✅ Done (partial) |
| **D6** | ServiceVendor dan material supplier → halaman detail yang sama | ✅ Done |

## UI-Phase 1 — Nav restructure ✅ SELESAI 2026-08-12
`MasterDataNavOuter.tsx` — Materials/Suppliers/Prices/Samples + divider + Data Tools.

## UI-Phase 2 — Materials/Brands page cleanup ✅ SELESAI 2026-08-12
`MasterDataMaterialsClient.tsx` — judul "Brands", klik row→detail, CTA "Tambah Material", Data Tools link.

## UI-Phase 3 — Brand Detail page ✅ SELESAI 2026-08-12
`BrandDetailClient.tsx` + route `/masterdata/materials/[brandId]/page.tsx` — 4 tab: Overview/SKUs/Suppliers/Prices. Assign/unassign supplier modal.

## UI-Phase 4 — SKU Detail drawer ✅ SELESAI 2026-08-12
`SkuDetailDrawer.tsx` — right-side panel, read-only identity + Suppliers & Prices, link "View all prices".

## UI-Phase 5 — quickCreateSkuAction ✅ SELESAI 2026-08-12
`quick-entry-actions.ts` — `quickCreateSkuAction` mengikuti pola exact quickCreateBrandAction/quickCreatePartyAction.

## UI-Phase 6 — Price page redesign ✅ SELESAI 2026-08-12
`PricingClient.tsx` — rename tab labels ("Material + Service", "Work / Service"), "Save New Price" + helper text archiving.

## UI-Phase 7 — Suppliers page unification ✅ SELESAI 2026-08-12
`SupplierClient.tsx` unified Party table + `SupplierDetailClient.tsx` (4 tab) + Contact CRUD via `party-actions.ts`.

## UI-Phase 8 — RelationshipAssigner refactor ⏸ DITUNDA
Opsional. Logika inline di Phase 3 & 7. Defer ke sprint berikutnya.

## UI-Phase 9 — Import/Export enhancement ⚠️ SELESAI SEBAGIAN 2026-08-12
`MasterDataSettingsClient.tsx` — inline results card (✓ Dibuat / ↻ Diperbarui / ✗ Error) dengan collapsible error detail.

**Yang belum dikerjakan dari Phase 9:**
- Import preview page `/masterdata/settings/import` dengan breakdown CREATE/UPDATE/CONFLICT/INVALID/UNCHANGED per baris
- Conflict resolution modal
- Full workbook export (multi-sheet: Brand, Supplier, Contact, WorkPrice)

---

# ═══ SSOT UIUX REVISION — Master Data (2026-08-12) ═══

**Dokumen acuan:** `MASTERDATA_UIUX_REVISION.md` (disetujui owner 2026-08-12).
**Status:** ✅ Fase utama selesai. Lihat open items di bawah.

## Yang sudah selesai

| # | Item | Keterangan |
|---|---|---|
| ✅ | `MasterDataBrandDialog.tsx` ditulis ulang | Scope: Product Brand, Company, Category chips, BrandLinksEditor. Semua field SKU/harga/dimensi/supplier dihapus. |
| ✅ | `MasterDataProductDialog.tsx` ditulis ulang | 3 section: Spesifikasi Visual, Dimensi Fisik (DimensionGroup inline), Initial Sourcing. `image_url` dihapus. Net Price only. |
| ✅ | `syncSeedBrandCategories` di LibraryService | Mengelola `BrandCategory (source=SEED)` secara aman tanpa menyentuh `DERIVED_FROM_SKU`. |
| ✅ | CTA context-sensitive di MaterialsClient | Brand Landing → "Tambah Brand", SKU View → "Tambah Material". |
| ✅ | `companies` prop + `getCompaniesAction` di page.tsx | Company picker di BrandDialog sekarang pre-populated. |
| ✅ | `tsc --noEmit` bersih | Tidak ada type error. |

## Open items

| # | Item | Prioritas | Keterangan |
|---|---|---|---|
| ⬜ | `SkuDetailDrawer.tsx` — audit `image_url` | Tinggi | Perlu cek apakah drawer SKU masih menampilkan/mengedit `catalog_image_url`. Jika ya, hapus konsisten dengan ProductDialog. |
| ⬜ | `BrandDetailClient.tsx` — CategoryInput | Medium | Brand detail view belum menampilkan `seed_categories` chips. Perlu evaluasi apakah readonly display sudah cukup dari data yang ada. |
| ⬜ | `MasterDataAudit` — jalur tulis Brand & SKU | Medium | Belum ada `prisma.masterDataAudit.create` di `syncSeedBrandCategories` dan metode create/update. Ini P3 poin 1 (gap terparah). |
| ⬜ | Pricing page — Tab Material + Labour (`WorkPrice`) | Medium | PRD §D.2: wajib definisi material dasar di dalam harga bundling. Belum diimplementasikan. |
| ⬜ | `next build` verifikasi lokal | Pra-deploy | Belum terbukti dari sandbox (SIGBUS). Owner harus jalankan `npm run build` sebelum deploy ke produksi. |

---

# ═══ UI KONSISTENSI — Master Data Pages (2026-08-12) ═══

**Status: 🔍 ANALISA SELESAI — menunggu keputusan owner untuk UI-CON-5 sebelum eksekusi.**

Temuan lengkap di `CHANGELOG.md` entri 2026-08-12 (#6). Ringkasan item yang perlu dikerjakan:

## ~~UI-CON-1~~ — ✅ SELESAI 2026-08-12 (SSOT Refactor)

CTA di `MasterDataMaterialsClient.tsx` sekarang context-sensitive:
- Brand Landing View → **"Tambah Brand"** (membuka `MasterDataBrandDialog`)
- SKU View → **"Tambah Material"** (membuka `MasterDataProductDialog`)

Konsisten dengan Bahasa Indonesia dan SSOT UIUX revision.

## UI-CON-2 — Pindahkan tombol CTA Services tab ke page header (Cacat)

`+ Tambah Vendor` saat ini ada di dalam baris search (di kanan search input). Semua halaman lain menaruh CTA di kanan atas halaman (`PageHeader` area). Ini tidak konsisten dan tidak terduga secara navigasi.

**Fix:** pindahkan `+ Tambah Vendor` ke slot kanan `PageHeader`, sejajar dengan tombol-tombol di tab Material.
**Berkas:** `SupplierClient.tsx` — sekitar baris tab Services.
**Effort:** XS.

## UI-CON-3 — Standarisasi bahasa header kolom tabel (Cacat)

Header kolom tabel Services: `BIDANG/TRADE`, `LABOUR PRICES`, `PAKET M+U` — campur. Pilih satu bahasa per kolom, konsisten dengan kolom tabel Material yang sudah lebih banyak pakai EN.

**Fix:** tentukan satu gaya. Rekomendasi: EN untuk semua kolom header (sudah mayoritas), karena kolom header biasanya pendek dan teknikal.
**Berkas:** `SupplierClient.tsx`.
**Effort:** XS.

## UI-CON-4 — Standarisasi tampilan stats summary (Preferensi)

Materials pakai stats strip terpisah (`StatChip` grid). Supplier pakai inline subtitle `"2 perusahaan · 1 brand · 2 vendor jasa"`. Salah satu harus konsisten.

**Rekomendasi:** pertahankan pola Supplier (inline subtitle) — lebih ringan dan tidak makan tempat. Evaluasi apakah Materials perlu strip penuh atau bisa inline juga.
**Effort:** S.

## ~~UI-CON-5~~ — ✅ SELESAI 2026-08-12

Pindah ke `/masterdata/settings` (subapp sendiri, bukan StudioFlow settings). Rincian di `CHANGELOG.md` (#7).

**Urutan eksekusi yang disarankan:** UI-CON-2 → UI-CON-1 → UI-CON-3 → keputusan UI-CON-5 → UI-CON-4. Semuanya independen dari Fase Master Data rework (P3/P4) — boleh dikerjakan paralel.

---

# ═══ ~~ANTREAN BERIKUTNYA~~ — SELESAI 2026-08-11 ═══

Tiga permintaan owner 2026-08-11 malam. Ketiganya **selesai dieksekusi
2026-08-11**. Rincian di `CHANGELOG.md` entri 2026-08-11 (R1, R2, R3).

---

## ~~R1 — Tab / drill-down SKU per brand~~ — ✅ SELESAI 2026-08-11

**Permintaan owner:** *"harusnya bisa bs di filter aja, jangan semua SKU nya
muncul semua. harus ada tab khusus utk munculin SKU by brand / semacamnya."*

**Ini mengoreksi keputusan sore ini.** Sore tadi owner memilih opsi B (batas +
hitungan baris) dan tab ditolak dengan alasan "dropdown All brands sudah
melakukannya". Owner sekarang menyatakan itu **tidak cukup** — dan itu informasi
baru yang mengalahkan analisis saya, bukan pengulangan pertanyaan yang sama.
Alasannya masuk akal: dropdown itu **filter opsional**, keadaan bawaannya tetap
"semua SKU dari semua brand". Yang diminta owner adalah keadaan bawaan yang
**sudah tersaring**, bukan kontrol untuk menyaring.

Jadi ini bukan soal komponen mana yang dipakai, melainkan soal **apa yang tampil
kalau user belum memilih apa-apa**.

### Yang sudah ada dan bisa dipakai

- Paginasi + hitungan baris sudah jalan (`MATERIAL_PAGE_SIZE = 50`).
- Filter `vendorId` sudah SQL-side di `getAllProducts`.
- `getBrandCategoryCoverageAction` sudah mengembalikan cakupan kategori per brand
  — kandidat sumber angka "TACO · 200 SKU" tanpa query baru.
- Bilah tab sudah ditulis **dua kali**: `PricingClient.tsx:1134` dan
  `SupplierClient.tsx:637`. **Salinan ketiga harus ditolak** — ekstrak dulu jadi
  utility bersama, persis seperti `CreatableSearch` (771 → 272 baris).

### Yang perlu diputuskan owner sebelum dikerjakan

Istilah *"tab"* di sini ambigu, dan ketiga tafsirannya berbeda pekerjaan:

1. **Landing brand-dulu (drill-down).** Halaman utama = daftar brand + jumlah
   SKU. Klik → daftar SKU brand itu. Tidak ada layar yang pernah menampilkan
   semua SKU sekaligus. Paling dekat dengan kalimat owner.
2. **Bilah tab brand di atas tabel.** Satu tab per brand, tab pertama aktif
   secara bawaan (bukan "All"). Masalahnya tetap: 20+ brand = bilah menggulir.
3. **Wajib pilih brand.** Tabel kosong dengan ajakan "pilih brand dulu" sampai
   sebuah brand dipilih. Paling sedikit kode, tapi layar kosong saat pertama
   dibuka terasa seperti error.

**Catatan jujur:** #1 adalah opsi C yang saya tolak sore ini dengan alasan
"menambah satu klik kalau sudah tahu kode SKU". Keberatan itu hilang kalau kotak
search tetap ada di layar brand dan mencari **lintas brand** — jadi jalur "sudah
tahu SKU-nya" tetap satu langkah, dan jalur "lihat-lihat" jadi tersaring.

**Status: menunggu owner memilih 1 / 2 / 3.**

---

## ~~R2 — Menyambungkan skema Prisma ke StudioFlow (extension library)~~ — ✅ SELESAI 2026-08-11 (M4 step 2)

**Permintaan owner:** *"nanti skema prisma di koneksi jg ke studioflow (extension
library)."*

### ⚠️ Ini membalik keputusan arsitektur yang sudah didokumentasikan

`docs/PLAN-MASTERDATA-V2.md` §F.5 **sengaja** melepas lima foreign key antara
tabel StudioFlow dan `master_data`. Keadaan sekarang di `schema.prisma`:

| Tabel | Kolom | Keadaan |
|---|---|---|
| `ProjectScheduleOption` | `sku_id String?` | kolom polos + `data_snapshot` (baris 1128–1133) |
| `ProjectProductRequest` | `brand_id`, `sku_id` | kolom polos + `brand_name_snapshot`, `sku_name_snapshot` (baris 839–855) |

Alasannya dicatat terang-terangan di §F.5, dan alasannya kuat:

> *"`data_snapshot` sudah membekukan seluruh isi produk pada saat dipilih. Id yang
> menggantung berarti 'produknya sudah tidak ada di katalog' — dan tampilannya
> tetap utuh dari snapshot. Schedule proyek yang sudah berjalan memang **harus**
> menampilkan apa yang dipilih dulu, bukan apa yang ada sekarang."*

Artinya: **memasang kembali FK akan merusak sifat yang sedang melindungi proyek
lama.** Kalau SKU dihapus atau harganya berubah, schedule proyek yang sudah
berjalan tidak boleh ikut berubah.

### Tapi permintaan owner mungkin bukan itu

Ada tiga hal berbeda yang bisa dimaksud, dan hanya satu yang berbenturan:

1. **"Library harus baca master data langsung."** — **Sudah begitu.**
   `LibraryService.getAllProducts` membaca `tx.sku` yang memang tabel
   `master_data.Sku`. Tidak ada pekerjaan.
2. **"Material baru di Master Data harus otomatis muncul di library StudioFlow."**
   — Juga sudah, lewat jalur yang sama. Kalau kenyataannya tidak muncul, itu
   **bug yang perlu direproduksi**, bukan perubahan skema.
3. **"Pasang kembali relasi Prisma (FK) antara tabel proyek dan Sku."** — **Ini
   yang berbenturan dengan §F.5.**

### Yang perlu diputuskan owner

**Pertanyaan sebenarnya bukan "sambungkan atau tidak", melainkan: kalau sebuah SKU
diubah harganya hari ini, apakah schedule proyek yang memilih SKU itu bulan lalu
ikut berubah?**

- **Tidak ikut berubah** → keadaan sekarang sudah benar, tidak ada pekerjaan
  skema. Yang mungkin kurang adalah UI-nya, bukan relasinya.
- **Ikut berubah** → itu perubahan arah SSOT yang serius, dan §F.5 perlu ditulis
  ulang beserta alasannya, bukan sekadar FK dipasang lagi.

**Status: menunggu jawaban owner atas pertanyaan di atas. Jangan sentuh skema
sebelum itu.**

---

## ~~R3 — Import dari Excel & export ke Excel~~ — ✅ SELESAI 2026-08-11

**Permintaan owner:** *"dari master data di buat aturan yg bisa import from excel
dan export to excel (utk backup, dan edit dari luar aplikasi - pastiin skemanya
mirip dan easy to use)."*

### Yang sudah ada dan harus dipakai ulang

- **`exceljs@^4.4.0` sudah jadi dependency** (`package.json:31`). Tidak perlu
  library baru.
- **Pipeline CSV Schedule sudah lengkap** dan polanya tinggal ditiru:

  | File | Baris | Isinya |
  |---|---|---|
  | `src/lib/schedule/csv-types.ts` | 81 | skema **zod** per baris |
  | `src/lib/schedule/csv-parse.ts` | 177 | parsing + normalisasi header |
  | `src/lib/schedule/csv-import.ts` | 262 | pencocokan & penulisan |
  | `src/lib/schedule/csv-export.ts` | 48 | penulisan keluar |

  Bentuk yang benar sudah terbukti di sini: **zod per baris**, bukan `as`.
- `src/app/api/projects/[id]/sketchup/sheet-export/route.ts` — contoh route
  export yang sudah jalan.

### Empat hal yang harus diputuskan sebelum menulis kode

**a. "Skemanya mirip" — mirip dengan yang mana?**
Ada dua kandidat dan keduanya sah:
- `docs/design database masterdata.xlsx` — workbook yang owner pakai merancang.
- Bentuk tabel yang tampil di layar sekarang.

Keduanya **tidak identik**. Kalau salah pilih, hasil export tidak bisa
dibuka-edit-impor-balik oleh orang yang terbiasa dengan workbook aslinya.

**b. Round-trip atau sekali jalan?**
"Backup + edit dari luar aplikasi" menyiratkan **round-trip**: export → edit di
Excel → import balik. Itu jauh lebih berat daripada export saja, karena setiap
baris harus bisa dicocokkan kembali ke barisnya. Butuh kolom identitas yang
stabil (`id` atau `code`) yang **tidak boleh diedit user** — dan cara memberi tahu
user kolom mana yang haram disentuh.

**c. Import artinya apa: tambah, perbarui, atau ganti seluruhnya?**
Tiga perilaku yang sangat berbeda:
- **Tambah saja** — baris yang sudah ada dilewati. Paling aman.
- **Upsert** — cocokkan lewat `code`, perbarui yang cocok, tambahkan yang baru.
  Paling berguna untuk "edit dari luar".
- **Ganti** — apa pun yang tidak ada di file, dihapus. **Berbahaya**; satu file
  yang salah bisa mengosongkan katalog.

**d. Bagaimana baris yang gagal divalidasi dilaporkan?**
Impor 500 baris dengan 3 baris rusak tidak boleh gagal diam-diam **maupun**
menolak semuanya. Pola yang benar: laporkan per baris dengan nomor barisnya, tulis
yang lolos, dan kembalikan daftar yang ditolak beserta alasannya.

### Cakupan: sheet mana saja?

Master Data punya beberapa entitas. Perlu ditegaskan mana yang ikut:
Sku/Material · Brand · Party (supplier) · SkuPrice · WorkPrice · Sample.
Saran: **mulai dari Sku + SkuPrice saja** (itu yang paling sering diedit massal),
sisanya menyusul setelah bentuknya terbukti.

**Status: menunggu jawaban owner untuk a–d dan cakupan sheet.**

---

# ═══ SUDAH SELESAI ═══

## ✅ SELESAI — Skala halaman Prices (diputuskan & dikerjakan 2026-08-11)

Owner memilih **opsi B** (batas + hitungan baris) untuk bentuk UI, dan **kedua
perbaikan backend** dikerjakan sekaligus. Rinciannya di `CHANGELOG.md`.

Temuan terpenting saat implementasi: **`LibraryService.getAllProducts` sudah
melakukan semuanya** — `where`, `orderBy`, `skip`/`take`, dan `count` paralel,
dengan `include` yang identik (`SKU_FULL_INCLUDE` == `MATERIAL_VIEW_INCLUDE`).
Dan `LibraryService.getProductById` juga sudah ada. Jadi `getMaterialView` bukan
sekadar lambat — ia **menulis ulang utility yang sudah dimiliki StudioFlow, dengan
lebih buruk**. Polanya sama persis dengan `CreatableSearch` sesi lalu.

Hasilnya: `getMaterialView` sekarang mendelegasikan, bukan menemukan ulang.

**Sisa pekerjaan yang lahir dari perubahan ini:**

- **Search tidak lagi mencakup warna / motif / finishing.** Ketiganya tinggal di
  dalam kolom JSON `Sku.spec`, dan pencarian *case-insensitive partial match*
  lintas JSON path tidak bisa diekspresikan Prisma secara portabel. Search SQL
  sekarang mencakup nama produk, nama brand, kode SKU, dan nama kategori.
  **Untuk mengembalikannya:** promosikan ketiga field itu jadi kolom nyata di
  `Sku` (butuh migrasi), lalu tambahkan ke blok `where.OR` di
  `getAllProducts`. Selama katalog masih ratusan baris, dampaknya kecil —
  dropdown kategori dan brand menutupi sebagian besar kebutuhannya.
- **`sort: "category"` dihapus dari dropdown.** "Kategori pertama dari sekian
  kategori sebuah SKU" tidak punya padanan `ORDER BY` tanpa kolom denormalisasi.
  **Untuk mengembalikannya:** tambahkan `primary_category_name` di `Sku` yang
  di-maintain saat tulis, lalu `orderBy` ke kolom itu. URL lama `?sort=category`
  jatuh ke `brand`, tidak error.
- **`pageSize` masih hardcoded 50** (`MATERIAL_PAGE_SIZE`). Kalau owner mau
  memilih 25/50/100, tinggal jadikan dropdown yang menulis ke searchParam.

---

## 🔴 TERBUKA — (arsip analisis) Skala halaman Prices — tiga plafon

**Pertanyaan owner:** *"kalau TACO punya 200 SKU masa muncul semua? apa perlu
dibuat tab baru yg lebih spesifik search SKU by brand?"*

Jawaban singkat: **ya, semuanya muncul.** Tapi setelah ditelusuri, "terlalu banyak
baris" hanyalah gejala yang paling terlihat dari **tiga plafon terpisah** yang
pecah pada skala berbeda. Menambah tab hanya menyentuh satu, dan itu pun sebagian.

### Tiga plafon, ditemukan di kode

| # | Plafon | Di mana | Pecah sekitar |
|---|--------|---------|---------------|
| 1 | **Render** — daftar rata tanpa batas | `MasterDataMaterialsClient.tsx:315` `rows.map()` — tanpa paginasi, tanpa virtualisasi | ~50 baris (tidak terbaca manusia) |
| 2 | **Payload** — tiap baris mengirim objek Prisma penuh | `MaterialRow.material` = `Sku` + brand (+`scoped_contacts`, `links`, `owner`) + `samples` + `media` + `prices` + `categories` | ~200–500 SKU (RSC stream membengkak) |
| 3 | **Query** — muat semua lalu filter di JS | `material-view-service.ts:138` `findMany` **tanpa `take`/`skip`**; semua filter & sort dijalankan di JavaScript setelahnya | ~2.000+ SKU (memori & waktu server) |

**Plafon 2 adalah yang paling mengejutkan.** `row.material` dipakai di **satu
tempat saja** — `MasterDataMaterialsClient.tsx:423`, untuk mengisi dialog edit
saat baris diklik. Jadi setiap baris mengirim seluruh objek relasionalnya ke
browser *untuk berjaga-jaga kalau-kalau diklik*. Dengan 200 SKU TACO, 199 di
antaranya terkirim sia-sia.

> Catatan: JSON round-trip yang ditambahkan hari ini (fix Decimal) **tidak**
> menyebabkan plafon ini — objeknya memang sudah dikirim sejak awal. Fix itu hanya
> membuat biayanya kelihatan.

### Arsitektur yang sudah benar (jangan dibongkar)

Filter **sudah** hidup di URL dan diproses server-side: `page.tsx` membaca
`searchParams` → `MaterialFilters` → `getMaterialView()`. Jadi pondasinya sudah
tepat — yang salah hanya bahwa `getMaterialView` mengabaikan filter itu di level
SQL dan baru memakainya setelah semua baris ada di memori. **Memindahkan filter
ke dalam query Prisma tidak butuh perubahan UI sama sekali.**

### Empat bentuk UI yang dipertimbangkan

**A. Tab per brand** *(usulan owner)*
Tab cocok untuk himpunan **kecil dan tetap** — Pricing punya 3, Supplier punya 5.
Brand sifatnya terbuka: 20–50 brand berarti bilah tab yang ikut menggulir, dan itu
lebih buruk daripada dropdown. Selain itu **dropdown "All brands" yang sekarang
sudah melakukan persis pekerjaan ini** (`MasterDataMaterialsClient.tsx:232`), jadi
tab brand akan menduplikasi kontrol yang sudah ada.

**B. Batas + hitungan, pencarian jadi kontrol utama** ← *paling murah, paling tepat sasaran*
Kotak search sudah mencari SKU, nama produk, warna, motif, finishing, dan kategori.
Yang kurang hanya: (1) batas baris default (mis. 50) supaya halaman tidak merender
800 baris, dan (2) umpan balik jumlah — *"menampilkan 50 dari 847"* — supaya orang
tahu ada sisa. Tidak ada UI baru, hanya batas dan satu baris teks.

**C. Drill-down brand-dulu (master–detail)**
Halaman utama = daftar brand + jumlah SKU-nya (TACO 200, Aica 80…), klik untuk
masuk. Cocok dengan cara orang berpikir *("saya butuh HPL TACO")*, tapi menambah
satu klik untuk kasus sebaliknya — sudah tahu kode SKU dan tinggal mencari.

**D. Baris berkelompok (brand sebagai header seksi yang bisa dilipat)**
Satu halaman, brand jadi header lengket, terlipat secara default menampilkan
jumlah. Bisa dipindai seperti C tanpa navigasi seperti C.

### Rekomendasi

**Kerjakan plafon 2 & 3 lebih dulu — keduanya wajib apa pun bentuk UI yang dipilih:**

1. **Buang `material` dari payload baris.** Ganti dengan `getSkuDetailAction(id)`
   yang dipanggil saat dialog dibuka. Ini menghapus 90%+ payload dan menghilangkan
   sumber masalah `Decimal` sepenuhnya (JSON round-trip jadi tidak perlu lagi).
2. **Pindahkan filter/sort/limit ke query Prisma.** `where`, `orderBy`, `take`,
   `skip` — filter-nya sudah ada di URL, tinggal diteruskan ke SQL alih-alih ke
   `Array.filter`.

**Untuk bentuk UI: opsi B.** Dropdown brand + search yang sudah ada sebenarnya
sudah menjawab pekerjaan *"cari SKU TACO"*. Yang benar-benar rusak hanyalah tidak
adanya batas. B memperbaiki itu dengan pekerjaan paling sedikit, dan tidak menutup
pintu ke C atau D nanti.

**Kalau owner tetap memilih tab (opsi A):** bilah tab sudah ditulis **dua kali** —
`PricingClient.tsx:1134` dan `SupplierClient.tsx:637`. Salinan ketiga harus
ditolak. Ekstrak dulu jadi utility bersama, sejalan dengan arah sesi sebelumnya
(`CreatableSearch`: 771 baris → 272).

**Status: SELESAI.** Owner memilih opsi B + kedua butir backend. Lihat bagian
"✅ SELESAI — Skala halaman Prices" di atas. Analisis ini disimpan apa adanya
sebagai catatan alasan, bukan sebagai pekerjaan tertunda.

---

## Yang berubah pada 2026-08-11 — Hotfix Decimal + nav trimming

- ✅ **Decimal crash** — `MaterialRow.material` mengandung `Decimal` Prisma mentah
  (`dim_length/dim_width/dim_height` di Sku; `price_list/price_net` di SkuPrice).
  Next.js crash saat serialisasi ke Client Component. Fix: JSON round-trip di
  `material-view-service.ts`.
- ✅ **Nav dipangkas ke 3 item** — Overview dan Pricing dihapus dari nav.
  "Materials" diganti label "Prices". `/masterdata` redirect ke `/masterdata/materials`.

## Yang berubah pada 2026-08-11 malam #3 (rombakan Master Data ke utility bersama)

Rinciannya di `CHANGELOG.md`. Ringkasnya: **771 baris duplikasi picker jadi 272**,
dan quick entry — yang Sheet2 minta di *semua* halaman — akhirnya ada di semua
halaman karena sekarang cuma ditulis satu kali.

**Yang sudah SELESAI dari daftar "masih di-roadmap" sesi sebelumnya:**

- ✅ **Quick entry** — dialog mini muncul dari form Pricing saat vendor belum ada.
- ✅ **Searchable edit** — semua picker searchable, quick entry inline saat kosong.
- ✅ **Add Brand** — quick create brand dari form Harga Material.
- ✅ **Add Vendor** — quick create vendor dari kolom Vendor di kedua tab WorkPrice.
- ✅ **D5** (dua tabel gepeng) untuk Master Data.

**Yang masih terbuka di halaman Supplier:**

- **Pemisahan Add Vendor material vs jasa.** Sheet2 kolom D19 minta pilihan
  "jual material / jual jasa" saat menambah vendor. Sekarang quick entry vendor
  selalu menulis `SERVICE_VENDOR`, dan quick entry supplier selalu `SUPPLIER` —
  benar untuk layar yang memanggilnya, tapi belum ada satu tempat untuk memilih.
  Bentuk lengkapnya ada di `PartyDialog` (checkbox 6 kategori); yang belum ada
  adalah versi ringkasnya di dalam quick entry.
- **Tab per kategori di halaman Supplier.** Sheet2 baris 39–43 membagi lima
  kategori (Supplier, Subcon, Vendor, Retail Store, Manufacture). Sekarang ada
  dropdown filter kategori, belum tab. Filter sudah menjawab kebutuhannya —
  tab adalah pilihan bentuk, jadi ini menunggu keputusan owner, bukan pekerjaan
  yang tertunda.

**Utang yang lahir dari rombakan ini:**

- `useQuickEntry` menyimpan baris baru di state lokal sampai navigasi berikutnya.
  Kalau dua tab dibuka bersamaan, tab kedua belum melihatnya sampai refresh.
  Diterima: alternatifnya `router.refresh()` yang membuang form setengah jadi.
- Halaman StudioFlow lain (`create-project-dialog`, `project-identity-strip`,
  `template-manager`) ikut berubah tampilannya karena `CreatableSearch` sekarang
  memakai token. **Perlu dilihat mata owner** — perubahannya ke arah konsisten,
  tapi tetap perubahan yang tidak diminta ketiga halaman itu.

---

## Yang berubah pada 2026-08-11 malam #2 (Sheet2 UI alignment)

Owner membaca ulang Sheet2 dari `design database masterdata.xlsx` dan menemukan
form UI belum mengikuti desain halaman di sana.

**Yang dikerjakan (semua di `PricingClient.tsx`, `tsc` 0 error):**

- **Material Prices form**: hapus field "Valid from" — di-set otomatis saat entry.
- **WorkPrice tabs (Material+Upah & Upah)**: hapus kolom + field "BQ code" — BQ app yang assign.
- **WorkPrice form**: Category dipecah jadi dua field (Group dropdown dari `WORK_LEVEL1` + Subcategory text).
- **WorkPrice form**: Specification jadi list dinamis — mulai 1 field, tombol "+ Add spec" untuk menambah kedua.
- **Harga Upah**: Dimensions field diberi note "record if relevant, leave blank if not applicable."

**Yang belum dijawab / perlu saran (tanda `*` di Sheet2):**

- Apakah Dimensions perlu di tab Upah? → sudah ada dengan note, owner bisa hapus field nanti.
- Unit dropdown — apakah perlu autocomplete dari list unit yang sudah ada?
- Qty default=1 — apakah perlu auto-fill?
- Project Reference — saat ini picker dari studioflow.Project; sudah sesuai Sheet2.

**Yang masih di-roadmap (Supplier page):**

Supplier page: Sheet2 menyebut "simplifikasi modal agar userfriendly dan saling
relational dengan searchableedit / popup modal". Detail:
- **Quick entry**: dialog box mini muncul langsung dari form Pricing saat vendor belum ada
- **Searchable edit**: saat data tidak lengkap, munculkan quick entry inline
- **Add Brand**: spesifik untuk material only (bukan jasa)
- **Add Vendor**: bisa dipilih material atau jasa, terhubung ke kolom Vendor di Pricing tabs

---

## Yang berubah pada 2026-08-11 malam (regresi + §E dikerjakan)

Empat regresi diperbaiki, tujuh item §E dikerjakan setelah owner menjawab.
Rinciannya di `CHANGELOG.md`; keputusannya di
`docs/PENYIMPANGAN-DARI-EXCEL.md` §E.1.

**Dua di antara empat regresi itu milik saya sendiri dari sesi yang sama**, dan
keduanya lolos `tsc`, 57 uji, dan eslint:

- Brand dibuat opsional di form tapi **tidak** di server — `resolveVendor("")`
  tetap melempar. Perubahan setengah jadi yang tampak selesai karena separuh
  yang terlihat memang selesai.
- Tiap simpan material menulis baris harga **duplikat**, karena dialog selalu
  mengirim keempat field harga termasuk yang tidak berubah. Penjaganya sudah ada
  di halaman Harga; dialog material tidak memakainya.

**Dan satu yang menyembunyikan dirinya di balik Excel:** pemilih supplier
menyaring `role: SUPPLIER`, padahal contoh Excel sendiri (Ace Hardware, Informa)
berkategori **Retail**. Penyaring itu menyembunyikan dua baris yang ditulis
workbook-nya sendiri sebagai contoh.

**Dua migrasi menunggu dijalankan owner** — lihat §A8.

## Yang berubah pada 2026-08-11 sore (recheck terhadap Excel)

Excel acuan (`docs/design database masterdata.xlsx`) baru ada di repo hari ini.
Seluruh pemeriksaan sebelumnya bersandar pada catatan **tentang** Excel, bukan
pada Excel-nya. Sheet1 dibaca langsung dan dibandingkan kolom per kolom.

**Schema cocok — nol penyimpangan baru.** Yang tidak menyusul adalah CRUD-nya:
tujuh kolom yang Excel minta dan schema sudah sediakan tidak bisa diisi dari
layar mana pun. Daftarnya di `docs/PENYIMPANGAN-DARI-EXCEL.md` §E, diangkat
sebagai **pertanyaan** sesuai §Arah Strategis poin 4.

**Satu di antaranya bukan pertanyaan melainkan cacat, dan cacat itu milik saya
sendiri dari pagi ini:** `PartyRole` tidak pernah ditulis jalur mana pun kecuali
form vendor jasa. Pemilih supplier yang saya tambahkan menyaring `role:
SUPPLIER`, jadi ia **selalu kosong** — tanpa error, tanpa warning, hanya daftar
kosong yang terbaca sebagai "belum ada supplier". Sudah diperbaiki: kategori
Party (kolom K Excel) kini punya CRUD.

Saya menulis pola ini di catatan pagi dan mengulanginya sore harinya:
**menambahkan pembaca untuk kolom yang tidak punya penulis.** `tsc`, 57 uji, dan
eslint semuanya hijau di atasnya. Yang menemukannya adalah membaca Excel lagi.

## Yang berubah pada 2026-08-11 (CRUD Master Data + §M3)

**§M3 selesai.** Bahasa UI Master Data diseragamkan ke Inggris dan delapan
komponen di-rename ke kosakata v2 (`Party`, `Brand`, `WorkPrice`).

**CRUD Master Data disesuaikan ke schema.** Yang ditemukan, dan pelajarannya
lebih berguna daripada daftar perbaikannya: **schema v2 sudah benar sejak 10
Agustus; yang tidak ikut pindah adalah CRUD di atasnya.** Ia masih berpikir satu
harga per material, tanpa supplier, brand wajib — sementara tabelnya dirancang
untuk kebalikannya. Tidak ada error. Semuanya jalan, dan menyimpan hal yang salah
dengan tenang.

Lima jalur tulis `SkuPrice` dijadikan satu
(`services/sku-price-service.ts`), supplier diaktifkan, `price_net ?? 0`
dihapus, brand jadi opsional sesuai Q7, dan penyimpanan material kembali jadi
satu transaksi. Rincian lengkap beserta alasannya di `CHANGELOG.md`.

**Satu pola yang layak dibawa ke pekerjaan berikutnya:** fitur yang tidak pernah
dipakai menyembunyikan bug yang menunggunya. `supplier_party_id` tidak pernah
diisi, jadi tidak ada yang pernah menabrak `SkuPrice_current_uniq` — dan dua
jalur tulis yang saling bertentangan bisa hidup berdampingan berbulan-bulan.
Kolom yang ada di schema tapi nol jalur tulisnya bukan "belum dipakai", ia
**belum diuji**.

## Yang berubah pada pemeriksaan 2026-08-10

Roadmap versi sebelumnya menyatakan §M2, §A1, dan §C-SISA-1 *"belum
diterapkan"*. **Ketiganya sudah.** `prisma/migrations/` memuat 17 migrasi
termasuk `20260810180000_masterdata_v2_rebaseline`, dan backup pra-drop
bertanggal 2026-08-10 17:01 ada di `docs/archive/migrations-masterdata-v2/backups/`.

Kesalahan itu mahal ke satu arah tertentu: ia menyuruh orang menjalankan ulang
sesuatu yang isinya `DROP SCHEMA master_data CASCADE`. Karena itu tiap status di
bawah sekarang menyebut **berkas atau baris yang membuktikannya**, bukan sekadar
kata "selesai".

**Batas pemeriksaan ini, dinyatakan terang-terangan:** `DATABASE_URL` menunjuk
`localhost:5432` di mesin owner dan tidak terjangkau dari lingkungan pemeriksaan.
Semua pernyataan di sini tentang **kode dan berkas migrasi**, bukan tentang isi
Postgres. Hal-hal yang hanya bisa dijawab database ditandai **butuh DB**.

Dokumen pendamping:

| Dokumen | Isi |
|---|---|
| `CHANGELOG.md` | Riwayat siklus berjalan (2026-08-10 →) |
| `docs/archive/README.md` | **Indeks arsip** — apa yang dipindahkan dan kenapa |
| `docs/archive/roadmap-selesai-2026-08-10.md` | Item roadmap yang selesai/gugur + buktinya |
| `AUDIT-UX-2026-08-10.md` | Audit UX seluruh halaman — 12 temuan berprioritas |
| `PLAN-APP-SPLIT.md` | Rencana besar R1–R6 pemisahan app |
| `docs/PLAN-MASTERDATA-V2.md` | Rancangan Master Data v2 + kontrak SSOT untuk Library & BQ |
| `docs/TANYA-SEBELUM-EKSEKUSI.md` | 23 pertanyaan blocker §M — sudah dijawab |
| `docs/PENYIMPANGAN-DARI-EXCEL.md` | 25 penyimpangan rancangan v2 dari Excel |
| `MASTER_SSOT.md` | Sumber kebenaran arsitektur — **isinya masih v1, lihat §T5** |

---

## Arah Strategis

Empat keputusan yang berlaku dan menjadi acuan prioritas:

1. **Master Data dirombak greenfield.** ✅ Schemanya sudah dirombak
   (`20260810180000_masterdata_v2_rebaseline`). Yang tersisa adalah lapisan di
   atasnya — §M3, §M4.
2. **StudioFlow diputus dari Library/Master Data.** Keduanya harus bisa berdiri
   sendiri. FK-nya sudah lepas; coupling tipe dan query belum — §M4.
3. **Fokus: perbaikan StudioFlow.** Master Data ditangguhkan sementara
   rombakannya diselesaikan.
4. **Penyimpangan dari `design database masterdata.xlsx` harus ditanyakan dulu**
   *(owner)*. Excel itu acuan bentuk Master Data v2. Setiap kali rancangan
   menyimpang darinya, penyimpangannya diangkat sebagai pertanyaan, bukan
   diputuskan sendiri.

---

## Peta halaman task

Tiga permukaan, tiga pertanyaan berbeda. Kalau ada yang menggabungkan dua di
antaranya lagi, judulnya akan berbohong seperti "Today's View" dulu.

| Halaman | Pertanyaan | Pengelompokan | Sumber |
|---|---|---|---|
| `/` — **Tasks** | Apa yang ada di tiap proyek saya? | Per proyek | `Activity` + `ProjectChecklist` |
| `/upcoming` — **Upcoming** | Apa yang jatuh tempo kapan? | Per tanggal | sama |
| `/projects/[id]` + fase | Apa syarat proyek/fase ini? | Per fase | `ProjectChecklist` |

Keduanya yang pertama membaca **satu** query, `getTaskFeed` di
`lib/services/task-feed-query.ts`. Mengambil dua kali akan membiarkan keduanya
menyimpang — satu layar menampilkan task yang layar lain sudah saring, tanpa ada
yang mengatakan mana yang benar.

**Lingkupnya sama untuk keduanya:** proyek yang dipegang user (designer atau
drafter), kecuali yang COMPLETED. Tidak ada toggle studio-wide — `/projects`
sudah memberi pandangan menyeluruh bagi yang membutuhkannya.

**Siapa yang boleh memegang kursi PIC** ditentukan di `core/rbac/project-pic.ts`:

| Kursi | Peran yang boleh |
|---|---|
| DIC (Designer) | `DIC`, `ADMIN`, `DEVELOPER` |
| DRIC (Drafter) | `DRIC` |

`ADMIN` dan `DEVELOPER` dikembalikan ke kursi Designer 2026-08-10 atas permintaan
owner. `STAFF` **tetap di luar** keduanya — ia tidak pernah peran designer, ia
ikut terbawa daftar lama yang terlalu longgar, dan justru itu yang membuat akun
STAFF muncul sebagai kandidat drafter.

Yang hilang karena pelonggaran ini, dan tidak terlihat di layar: **kursinya tidak
lagi membuktikan perannya.** `isAdminLevel` sudah meloloskan ADMIN dan DEVELOPER
dari tiap gerbang per-proyek, jadi proyek yang DIC-nya seorang ADMIN tidak bisa
dibaca sebagai "seorang DIC menyetujui ini" — hanya sebagai "seseorang yang
berhak memegang kursinya". Apa pun yang kelak bergantung pada kursi sebagai bukti
peran harus memeriksa perannya sendiri.

Dua hal di modul itu terlihat seperti kode berlebih tapi bukan — keduanya
mencegah perubahan data yang senyap:

1. **Pemegang kursi sekarang selalu ikut di daftar**, sekalipun perannya tidak
   lagi memenuhi syarat. Pemilihnya `<select>` tak terkendali: kalau pemegangnya
   hilang dari opsi, browser menampilkan opsi pertama dan menyimpan tanpa
   menyentuh field itu akan memindahkan proyek.
2. **Server memakai aturan "memenuhi syarat ATAU tidak berubah"**, bukan sekadar
   "memenuhi syarat". Sejak pelonggaran 2026-08-10 yang tersisa dijaga aturan ini
   adalah proyek ber-PIC `STAFF` — satu-satunya peran yang tidak pernah masuk
   daftar mana pun.

---

## Peta schema

Tiga schema di satu instance PostgreSQL. **Diverifikasi 2026-08-10 terhadap
`prisma/schema.prisma`.**

| Schema | Isi | Status |
|---|---|---|
| `studioflow` | Project, Phase, Revision, File, Schedule, MOM, SketchUp, Checklist | Aktif, 33 model |
| `master_data` | **v2** — Party, Brand, Category, Sku, SkuPrice, WorkPrice, Sample | Aktif, 18 model + 10 enum |
| `bq` | Tabel milik app **BQ** | **Kosong — belum ada model** |

Tiga view kontrak sudah ada di `master_data`, dibuat oleh migrasi rebaseline
(baris 838, 906, 964 dari `migration.sql`):

| View | Konsumen | Isi |
|---|---|---|
| `v_library_brand` | StudioFlow Library | 9 kolom, persis Table 1 A–G |
| `v_bq_material_rate` | BQ | Satu baris per penawaran berlaku (SKU × supplier) |
| `v_bq_work_rate` | BQ | Table 3 + Table 4 jadi satu |

**Yang belum: hak aksesnya.** Blok `GRANT`/`REVOKE` masih dikomentari di
`migration.sql:1029–1044`. Selama itu begitu, view-nya **ada tapi tidak
mengikat** — StudioFlow masih bisa membaca tabel mentah. Lihat §M4 langkah 4.

**Tentang `bq`.** BQ app terpisah yang mengonsumsi harga dari `master_data` lewat
dua view di atas. Schema `bq` sudah dideklarasikan di `datasource` tetapi masih
nol model — konsumennya belum dibangun. Karena itu istilah "siap BQ" di halaman
Materials berarti *harga sudah cukup lengkap untuk dipakai app BQ*, bukan bahwa
ada tabel BQ yang membacanya hari ini.

---

## M. Rombakan Master Data v2

Rancangan lengkap beserta alasan tiap keputusan ada di
**`docs/PLAN-MASTERDATA-V2.md`**. Sumber rancangan:
`design database masterdata.xlsx` (Table 1–4) + audit 18 model v1.

**§M1, §M2, dan §M5 selesai** — diarsipkan beserta buktinya di
`docs/archive/roadmap-selesai-2026-08-10.md`. Yang tersisa: M3, M4, M6, M7, M8.

### Tujuh keputusan yang membentuknya

Dipertahankan di sini karena tiap keputusan di bawah masih menentukan bentuk M3
dan M4:

| # | Keputusan | Menutup |
|---|---|---|
| 1 | Harga dipisah dari produk — `Sku` / `SkuPrice` | Tidak ada riwayat harga, tidak bisa banding antar toko |
| 2 | Satu `Party` + `PartyRole` menggantikan Company / ServiceVendor / supplier teks bebas | Supplier tidak pernah jadi entitas |
| 3 | Satu pohon `Category` self-referencing menggantikan 6 kolom kategori teks bebas | `"MEP"` di dua tabel adalah dua string yang kebetulan sama |
| 4 | Table 3 + Table 4 Excel → satu `WorkPrice` | Dua tabel berkolom identik memaksa `UNION` selamanya |
| 5 | `Decimal` menggantikan `Float` di 10 kolom uang | Galat pembulatan di dokumen komersial |
| 6 | `Sku.brand_id` nullable | Material generik memaksa brand sampah bernama `-` |
| 7 | Nol FK ke schema `studioflow` | §Arah Strategis poin 2 |

Dua koreksi yang menempel padanya dan mudah dilanggar tanpa sadar:

- **`Sku.code` nullable, identitas kanonik di `slug`.** Kode artikel pabrikan
  adalah fakta tentang barang, bukan kunci basis data. Keunikan `code` di mana ia
  terisi dijaga partial index.
- **`Sku.qty` disimpan tapi TIDAK DIPAKAI.** Larangannya ditulis di
  `COMMENT ON COLUMN`, bukan hanya di dokumen, supaya terbaca di `\d+` dan tiap
  tool introspeksi: tidak masuk perhitungan, tidak diekspos ke view mana pun,
  hanya kolom catatan di form. Menebak arti sebuah kolom lalu memakainya dalam
  hitungan adalah cara paling senyap merusak angka.

### Aturan SSOT yang sedang ditegakkan

> Hanya app Master Data yang **menulis** ke schema `master_data`. StudioFlow dan
> BQ **membaca**, lewat view. Kalau StudioFlow perlu sesuatu masuk — SKU baru
> dari barang yang datang — ia **mengajukan** lewat `ProjectProductRequest`,
> tidak menulis.

Keadaan nyata per 2026-08-11, dihitung ulang dari kode:

| Coupling | Jumlah | Di mana |
|---|---|---|
| Tulis ke `master_data` dari luar app Master Data | **29** | seluruhnya `extensions/library/services/library-service.ts` |
| Baca langsung ke tabel (bukan view) | **31 + 1** | `library-service.ts` (31), `settings-service.ts:278` (`tx.category.findMany`) |
| Tipe dikompilasi dari skema Master Data | **2** | `extensions/library/types.ts` (`SampleGetPayload`, `SkuGetPayload`) |
| Baca dari Schedule / SketchUp | **1** | `sketchup-actions.ts:3317` (`tx.sku.findFirst`) |

Angka ini **lebih baik dari yang tercatat sebelumnya** (48 baca / 21 tulis) —
tapi bukan karena sudah dibereskan: rombakan v2 menghapus jalur tulisnya bersama
modelnya. Yang tersisa terkonsentrasi di satu berkas, dan itu kabar baik untuk
M4.

**Harga adalah pengecualian yang sudah dirapikan** (2026-08-11): seluruh tulis
`SkuPrice` — dari mana pun — melewati
`subapps/master-data/services/sku-price-service.ts`. Kalau nanti ada
`tx.skuPrice.create` baru di luar berkas itu, itu jalur kelima yang dulu bikin
kacau, lahir kembali.

### Lingkup Library — keputusan owner

Library StudioFlow hanya mengambil **Table 1 kolom A–G**: Company, Brand, Product
Brand, Category, dan tiga kolom Link (Google Drive, Website, Socmed). Layarnya:
cari kategori/tag → **card brand** → sortir/filter. **Tiap card hanya memunculkan
link.**

Karena itu view tingkat SKU tidak dibuat. Library tidak melihat produk, harga,
kontak, maupun sampel. Dua akibatnya:

1. **Harga di Library gugur sendiri** — tidak ada baris produk di layar untuk
   menempelkannya.
2. **`PRICE_LIST` dan `MARKETPLACE` keluar dari allowlist link.** Keduanya masuk
   justru sebagai akibat (1). Table 1 hanya mencantumkan Drive, Website, Socmed.

Satu klausa `IN` di dalam `v_library_brand` yang menentukan tujuh `kind` link
mana yang tampil — dan itulah **satu-satunya tempat** aturan visibilitas hidup
sekarang, menggantikan array TS `ALLOWED_LINK_KINDS`. Menambah `kind` di sana
berarti menyimpang dari Table 1.

View, bukan sekadar DTO TypeScript, karena aturan visibilitas berbentuk array TS
hanya menjaga jalur query yang memakainya — dan ada puluhan jalur lain yang tidak
tahu array itu ada. View memindahkan *closed-world* dari "harus diingat" jadi
default.

**Schedule dan SketchUp juga tidak boleh membaca `Sku`** — keputusan owner:
*"tidak boleh, nanti kita buat database library khusus utk studioflow (apabila
perlu) atau hanya copy snapshot project lain."* Gantinya §M7 dan §M8.

### ~~M3. Tulis ulang service layer + UI Master Data~~ — **SELESAI 2026-08-11**

Service layer sudah berbicara v2 sejak rombakan; bahasa UI dan kosakata komponen
diselesaikan 2026-08-11. Rincian di `CHANGELOG.md` entri hari itu.

Tiga hal dari §M3 yang **tetap berlaku sebagai aturan**, bukan sebagai pekerjaan:

1. **`catalog_tags` bukan kolom.** Namanya masih muncul ~93 kali di `src/` dan
   itu bukan sisa yang belum dibereskan — `types.ts` menghitungnya dari
   `sku.categories.map(...)`. Dipertahankan supaya call site Schedule dan
   SketchUp tidak ikut berubah. Jangan "dirapikan" tanpa membaca §A2 di arsip.

2. **UI Master Data berbahasa Inggris**, seperti seluruh StudioFlow (§D4).
   Istilah domain tetap apa adanya. Komentar kode dan dokumentasi tetap
   Indonesia.

3. **Kosakata komponen mengikuti schema.** `Party`, `Brand`, `Sku`, `WorkPrice` —
   bukan `Company`, `Vendor`, `ServiceVendor`. Kalau ada komponen baru bernama
   menurut model yang sudah tidak ada, itu aturan yang sedang dilanggar.

### M4. Tegakkan batas SSOT — SEBAGIAN

**Butuh migrasi:** ya, untuk langkah 4.

Empat langkah, dan urutannya penting: batasnya dibangun **sebelum** konsumennya
dipindahkan, supaya tidak ada jendela di mana keduanya berjalan bersamaan.

1. ~~**Buat tiga view**~~ — ✅ **SELESAI.** Ketiganya ada di
   `20260810180000_masterdata_v2_rebaseline/migration.sql` baris 838, 906, 964.
   `v_schedule_item` batal — Schedule tidak boleh baca Master Data.

2. ~~**Ganti `Prisma.SkuGetPayload<>` dengan DTO tulis tangan.**~~ ✅ **SELESAI
   2026-08-11.**
   File baru: `src/extensions/library/contracts/sku-dto.ts` — `SkuDto` dan
   `SampleRowDto` menggantikan kedua `Prisma.GetPayload<>`. Enum diimpor dari
   `@/generated/prisma`; `Decimal` dan `JsonValue` dari
   `@prisma/client/runtime/client` (bukan schema generated).
   `SkuWithRelations = SkuDto`, `LibrarySampleRow = SampleRowDto`.
   `tsc --noEmit` bersih. Rincian di CHANGELOG entri 2026-08-11 (R2).

3. **Pindahkan operasi tulis.** ❌ Belum, tapi lingkupnya menyusut jauh:
   **29 operasi tulis, semuanya di `library-service.ts`.** Yang milik app Master
   Data pindah ke `subapps/master-data/`; yang dari StudioFlow jadi pengajuan
   lewat `ProjectProductRequest`.

   Dua pembaca liar yang ikut di langkah ini:
   - `settings-service.ts:278` — `tx.category.findMany`. Q14 sudah memutuskan
     kategori schedule **berhenti** dipetakan ke kategori produk. Keduanya memang
     bukan hal yang sama: `PT-01` adalah *posisi di gambar*, `HPL` adalah *jenis
     barang*; selama ini dipaksa satu karena namanya sering kebetulan sama.
   - `sketchup-actions.ts:3317` — `tx.sku.findFirst`. Harus lewat `v_library_brand`
     atau hilang sama sekali sesuai keputusan owner.

4. **`REVOKE SELECT ON ALL TABLES`, `GRANT` hanya pada view.** ❌ Belum —
   blok itu masih dikomentari di `migration.sql:1029–1044`.
   **Prasyaratnya belum ada: role Postgres terpisah per app.** Kalau StudioFlow,
   Master Data, dan BQ memakai satu user yang sama, langkah ini tidak bisa jalan
   apa adanya — dan itu **temuan tersendiri**, bukan alasan melewatinya.

   Langkah terakhir dan tidak boleh dilewati: tanpanya ketiga langkah di atas
   hanya kesepakatan, dan kesepakatan tidak bertahan melewati orang yang tidak
   membaca roadmap ini.

### M6. Verifikasi — BELUM (butuh DB)

**Butuh migrasi:** tidak.

Yang **sudah** hijau tanpa DB, diverifikasi ulang 2026-08-11:
`prisma validate` · `npx tsc --noEmit` **0 error** · `npm test` **63 lulus**.

Sembilan uji yang belum bisa dijalankan. Semuanya menguji hal yang `prisma validate`
dan `tsc` **tidak bisa lihat sama sekali** — karena itu tidak satu pun boleh
ditandai lulus berdasarkan build yang hijau:

| # | Uji | Harus |
|---|---|---|
| 1 | Sisipkan dua baris `is_current` untuk pasangan (sku, supplier) sama | **ditolak** |
| 2 | Sisipkan dua `is_primary` untuk satu SKU | **ditolak** |
| 3 | Ubah `material_price` | `total_price` ikut berubah tanpa disentuh |
| 4 | Sambung sebagai `studioflow_app`, `SELECT * FROM master_data."Sku"` | **ditolak** |
| 5 | `SELECT` pada `v_library_brand` | **tepat 9 kolom**, tanpa produk/harga/kontak/sampel; `links` tanpa `PRICE_LIST`/`MARKETPLACE`/`WHATSAPP` |
| 6 | `grep 'SkuGetPayload' src/extensions/` | **nol hasil** |
| 7 | Dua supplier untuk satu SKU, lalu edit salah satunya | penawaran supplier lain **tetap berlaku** |
| 8 | Isi hanya harga list, simpan | `price_net` = harga list, **bukan 0** |
| 9 | Ubah nominal harga yang sudah ada | baris lama `is_current: false` + `valid_to` terisi |

Uji 6 **sudah bisa dijalankan sekarang, dan gagal** — dua hasil di
`extensions/library/types.ts`. Itu ukuran M4 langkah 2.

Uji 7–9 **baru, dari perbaikan CRUD 2026-08-11.** Ketiganya menguji perilaku yang
sekarang benar di kode tetapi belum pernah dijalankan terhadap Postgres. Uji 7
yang paling menentukan: ia satu-satunya bukti bahwa multi-supplier benar-benar
bekerja, dan ia persis skenario yang dulu diam-diam mempensiunkan penawaran toko
lain.

Sisi murni dari aturan harga sudah tertutup uji otomatis —
`services/sku-price.test.ts`, 7 kasus, jalan di `npm test`.

Uji 4 butuh role `studioflow_app`. Kalau rolenya belum ada, **catat sebagai belum
diuji** — jangan ditandai lulus. Ini justru uji yang paling menentukan: kalau ia
lolos, seluruh M4 hanya dokumentasi.

Kueri untuk uji 1–3 sudah ditulis di
`docs/archive/migrations-masterdata-v2/backups/verify.sql`.

### M7. Library milik StudioFlow sendiri — BELUM DIPUTUSKAN

**Bergantung:** M4. **Butuh migrasi:** ya, kalau dikerjakan.

> *"tidak boleh, nanti kita buat database library khusus utk studioflow (apabila
> perlu) atau hanya copy snapshot project lain."*

Dua jalur pengganti, dan yang kedua **sudah ada di kode**:

**(a) Library milik StudioFlow** — tabel di schema `studioflow`, isinya produk
yang dipakai proyek, tidak dibagi dengan Master Data. *"Apabila perlu"* — jadi
belum diputuskan dibangun. **Jangan dirancang sebelum (b) terbukti kurang.**

**(b) Salin snapshot dari proyek lain** — lihat M8.

Urutan yang benar: perbaiki (b) dulu, lihat apakah cukup. Kalau cukup, (a) tidak
perlu dibangun sama sekali — dan itu penghematan yang besar.

### ~~M8 / R-SCHED-REUSE~~ — ✅ SELESAI 2026-08-12 (Fase 1 + 2)

**Tiga sebab reuse pool kosong — semua selesai:**

- ~~**R-SCHED-REUSE-1**: `spec_*` tidak pernah terisi~~ — ✅ `schedule-option-writer.ts` sekarang satu-satunya jalur tulis snapshot. 17 titik dimigrasikan. ESLint guard aktif.
- ~~**R-SCHED-REUSE-2**: Kategori tidak masuk search key~~ — ✅ Urutan key baru: `[kategori, brand, product, color, finishing]`.
- ~~**R-SCHED-REUSE-3**: Placeholder bocor ke pool~~ — ✅ `isPlaceholderVal` filter: brand+product keduanya placeholder → `spec_search_key = null`.
- ~~**R-SCHED-REUSE-4**: Guard UI pool kosong~~ — ✅ Hint sekunder di CatalogBoard saat 0 hasil + query ≥ 2 karakter.
- **R-SCHED-REUSE-5**: `take: 500` GROUP BY di memori — ❌ **TETAP TERBUKA.** Butuh DB hidup untuk verifikasi. Masalah kinerja, bukan kebenaran. Kerjakan setelah backfill dijalankan dan data real tersedia.

**Tindakan owner yang masih diperlukan:**
```bash
# Setelah Fase 1 ter-deploy ke produksi:
node scripts/backfill-schedule-spec-fields.mjs          # dry-run
node scripts/backfill-schedule-spec-fields.mjs --apply  # tulis ke DB produksi
```

---

## Aktif

### A4b. Rekonsiliasi `BrandCategory` yang basi

**Bergantung:** —. **Butuh migrasi:** tidak — kolom `source` sudah ada.

Prasyaratnya sudah terpenuhi: `BrandCategory.source` bertipe `CategorySource`
(`SEED` / `DERIVED_FROM_SKU`) ada di `schema.prisma:435`. Itu yang dulu jadi
blocker §A4.

Yang belum ada: kode yang **memakainya**. `upsertBrandCategories` masih hanya
menambah. Akibat yang diterima sekarang — kalau tag terakhir suatu kategori
dilepas dari seluruh SKU sebuah brand, brand itu masih muncul di pencarian
kategori tersebut.

**Aturan yang harus dipegang saat mengerjakannya:** rekonsiliasi hanya boleh
menyentuh baris `DERIVED_FROM_SKU`. Baris `SEED` adalah keputusan kurasi manusia
— menghapusnya karena tidak ada SKU yang memakainya adalah persis kesalahan yang
kolom `source` dibuat untuk mencegah.

### ~~A8. Tujuh kolom Excel yang CRUD-nya belum ada~~ — **SELESAI 2026-08-11**

Ketujuhnya ditanyakan lebih dulu ke owner dan dikerjakan setelah dijawab.
Rinciannya di `docs/PENYIMPANGAN-DARI-EXCEL.md` §E.1 dan `CHANGELOG.md`.

**Dua migrasi menunggu dijalankan owner:**

```bash
npx prisma migrate deploy   # 20260811120000 + 20260811120100
node scripts/backfill-party-roles.mjs          # dry-run
node scripts/backfill-party-roles.mjs --apply
```

Migrasi pertama **destruktif sebagian** — `material_price` dan `labor_price`
dibuang setelah dijumlahkan ke `price`. Perintah backup-nya ada di kepala
berkasnya. Migrasi kedua memasang kembali `v_bq_work_rate`, yang di-DROP di
transaksi pertama; **jangan jalankan yang satu saja.**

**Satu tafsir yang masih bisa terbukti salah, dan pintu keluarnya:** E3
mengasumsikan dua kolom kategori Excel adalah induk→anak. Excel menulis
urutannya terbalik antar tabel dan contoh pertama Table 2 mengisi keduanya
"HPL". Kalau ternyata keduanya dua sumbu berbeda, **X10 juga keliru** dan
pohonnya harus dibongkar — bukan hanya form-nya.

### A7. Layar riwayat harga

**Baru 2026-08-11.** **Bergantung:** —. **Butuh migrasi:** tidak.

Sejak perbaikan CRUD, `SkuPrice` benar-benar menyimpan riwayat: mengubah nominal
menutup baris lama dan menulis yang baru, dan "hapus" hanya menutup penawaran.
Datanya utuh.

**Yang belum ada: layar yang menunjukkannya.** Tab Harga menyaring
`is_current: true`, jadi seluruh riwayat itu tidak terlihat dari mana pun.

Dicatat sebagai pekerjaan tersendiri supaya tidak dianggap sudah ada hanya karena
datanya ada — itu jenis asumsi yang membuat orang percaya mereka bisa menjawab
"bulan lalu kita kutip berapa?" padahal belum bisa.

Bentuk paling murah yang menutupnya: satu panel di dialog harga yang menampilkan
baris `is_current: false` untuk (SKU, supplier) yang sama, urut `valid_from`
menurun. Tidak butuh model baru, tidak butuh migrasi.

### ~~R-SCHED-TPL~~ — ✅ SELESAI 2026-08-12 (Fase 3 + 4)

Item template dengan spesifikasi penuh (bukan sekadar kategori kosong).

| Item | Status |
|---|---|
| ~~R-SCHED-TPL-1~~ — Toast `applyDefaultTemplate` bedakan 3 kondisi | ✅ `noDefaultsConfigured`, sudah sesuai, ada yang ditambah |
| ~~R-SCHED-TPL-2a~~ — Schema `ScheduleTemplateItem` + migrasi SQL | ✅ `prisma/migrations/20260812140000_schedule_template_item/` |
| ~~R-SCHED-TPL-2b~~ — Service mode `"template"` + `applyDefaultTemplateEntries` v2 | ✅ Idempotensi per `template_item_id`; perilaku lama (`is_default_entry`) dipertahankan |
| ~~R-SCHED-TPL-2c~~ — Tombol "Set as default item" + daftar di TemplateManager | ✅ Toolbar kartu CatalogBoard + section di Settings → Project Engine |
| ~~R-SCHED-TPL-2d~~ — Guard server: auto-link tidak merampas slot template | ✅ `return null + console.warn` di `autoLinkSyncedMaterial` & `autoLinkSyncedFixture` |
| **R-SCHED-TPL-2e** — Plugin SketchUp: kirim `reserved_codes`, adopsi slot template | ❌ **OUT OF SCOPE** — dikerjakan setelah plugin di-update. Guard Fase 4 adalah perlindungan sementara. |

**Tindakan owner yang masih diperlukan:**
- Jalankan migrasi: `prisma/migrations/20260812140000_schedule_template_item/migration.sql`
- Gunakan tombol "Set as default item" di CatalogBoard untuk mengisi item template
- Setelah item terkonfigurasi: tekan "Apply default template" di proyek baru

---

### A6. Paket schedule — template berisi produk terpilih

**Konteks:** `PLAN-APP-SPLIT.md` §R5. **Butuh migrasi:** ya.
**Diverifikasi 2026-08-10:** `ScheduleBundle` **belum ada** di `schema.prisma`.

#### Yang sudah ada, dan batasnya

`ScheduleTemplate` + `applyDefaultTemplateEntries` sudah jalan otomatis di tiap
proyek baru dan lewat aksi "Apply template". Tetapi template itu **hanya mengisi
kerangka baris**: satu entry `reserve` kosong per kategori ber-`is_default_entry`.
Pilihan produknya mulai dari nol.

Schedule punya dua lapis:

| Model | Peran |
|---|---|
| `ProjectScheduleEntry` | Baris — kategori, prefix, kode (`PT-01`), qty, unit, lokasi |
| `ProjectScheduleOption` | Pilihan produk di dalam baris — `sku_id`, brand, `data_snapshot` |

`ScheduleTemplate` berhenti di lapis pertama. Yang diinginkan: paket yang membawa
lapis kedua juga — mis. *"Apartemen Studio 2BR"* dengan `PT-01` sudah terisi cat
tertentu dan `FL-01` sudah terisi keramik tertentu.

#### Rancangan

```prisma
model ScheduleBundle {
  id          String                @id @default(uuid())
  name        String                @unique   // "Apartemen Studio 2BR"
  description String?
  section     ProductType           @default(material)
  is_active   Boolean               @default(true)
  entries     ScheduleBundleEntry[]
}

model ScheduleBundleEntry {
  id                String  @id @default(uuid())
  bundle_id         String
  schedule_category String            // "PT", "FL"
  sort_order        Int     @default(0)
  schedule_qty      Float?
  schedule_unit     String?
  schedule_location String?
  sku_id            String?           // null = baris sengaja dikosongkan
}
```

#### Keputusan rancangan yang perlu dipegang

**`sku_id` adalah rujukan hidup, bukan snapshot.** Paket adalah *resep*, bukan
*catatan* — ia harus ikut berkembang saat katalog berubah. Pembekuan tetap
terjadi pada saat paket **diterapkan**, bukan saat disimpan: itu semantik
`data_snapshot` yang sudah berlaku, dan menirunya membuat schedule hasil paket
tidak bisa dibedakan dari yang dipilih manual.

Konsekuensinya jinak: kalau SKU dihapus, baris itu diterapkan sebagai `reserve`
kosong — paket tidak rusak, hanya berkurang.

⚠️ **Berubah karena §M5:** `onDelete: SetNull` **tidak bisa dipakai** — FK lintas
schema sudah dilepas seluruhnya dan tidak boleh dipasang lagi (§Arah Strategis
poin 2). `sku_id` jadi id menggantung tanpa penjaga. Perilaku "diterapkan sebagai
reserve kosong" karena itu harus ditangani **di jalur penerapan**, bukan
diandalkan dari database.

**Penerapan menumpang jalur yang sudah ada.** `addEntryToSchedule` sudah menerima
`mode: "catalog"` beserta `catalogItemId` — resolusi prefix, urutan, dan
normalisasi kode ikut gratis. Penerapan harus **additive dan idempoten**: baris
untuk kategori yang sudah ada di proyek dilewati, bukan diduplikasi.

**Validasi wajib ditiru di sisi paket.** `addEntryToSchedule` menolak SKU yang
tipenya tidak sama dengan `section`, atau yang kategorinya tidak memuat kategori
baris. Kalau validasi ini hanya dijalankan saat penerapan, paket yang tersimpan
bisa gagal diterapkan sebagian tanpa peringatan — validasi harus ikut jalan saat
paket **disimpan**.

⚠️ **Ketergantungan pada A2/A3 sudah gugur** — keduanya selesai. Validasi
kategori sekarang membaca `SkuCategory` lewat DTO turunan, bukan kolom
`catalog_tags`. A6 bisa dikerjakan kapan saja.

**Bergantung pada M4 langkah 3**, dan ini yang baru: paket yang menyimpan
`sku_id` adalah StudioFlow membaca Master Data. Kalau M4 melarangnya, A6 harus
membaca `v_library_brand` atau menunggu §M7(a).

#### Alternatif yang tidak diambil

"Salin schedule dari proyek lain" — `mode: "reuse"` sudah menyalin snapshot antar
proyek. Tidak dipilih karena mengikat paket pada satu proyek nyata: begitu proyek
sumber berubah atau diarsipkan, asal-usul paket jadi kabur. Paket bernama yang
berdiri sendiri lebih jelas dirawat.

---

## C. Todo ala Todoist Pro

**Terkirim:** subtask (satu tingkat) · prioritas P1–P4 · due date · label ·
assignee · komentar per task · empat filter bawaan · quick-add · halaman lintas
proyek. Migrasinya (`20260810120000_checklist_tasks`,
`20260810140000_activity_due_date`) sudah ada di `prisma/migrations/`.

Sisa di bawah.

### C-SISA-2. Verifikasi yang belum bisa dijalankan

**Butuh migrasi:** tidak.

Yang **sudah** hijau, diverifikasi ulang 2026-08-11: `prisma validate` ·
`npx tsc --noEmit` **0 error** · `npm test` **63 lulus**.

Yang **belum**:

- **`next build`** — gagal di lingkungan pemeriksaan pada tahap `next/font`
  (`fonts.googleapis.com` tidak terjangkau tanpa jaringan). **Kegagalan
  lingkungan, bukan kode.** Perlu dijalankan sekali di mesin normal — ini
  satu-satunya hal yang belum pernah membuktikan aplikasi menyala.
- **Hasil backfill migrasi `checklist_tasks`** — **butuh DB.** Langkah
  `template_id` sengaja membiarkan `NULL` saat pencocokan label ambigu, supaya
  kesalahannya terlihat sebagai baris ganda alih-alih tertebak diam-diam.
  Baris-baris itu perlu diperiksa dan dirapikan manual:
  ```sql
  SELECT count(*) FROM studioflow."ProjectChecklist"
  WHERE template_id IS NULL AND parent_id IS NULL;
  ```
- **Uji integrasi jalur tulis** — butuh PostgreSQL. §Uji manual di bawah
  menutupinya secara manual.

### C-SISA-3. Drag-and-drop pengurutan

**Butuh migrasi:** tidak. `@dnd-kit` sudah ada di dependensi **dan sudah dipakai**
di `CatalogCodeManager.tsx` dan `MaterialCodeManager.tsx` — polanya tinggal
ditiru.

Aksi `reorderTasks` **sudah jalan** (`actions/checklist-actions.ts:186`) dan
`sort_order` sudah dihormati di semua pembaca — yang belum ada hanya cara
menyeretnya di layar. `task-list.tsx:11` sudah mencatat ini sebagai sengaja
ditunda.

Penomoran ulang memakai langkah tetap (`CHECKLIST_SORT_STEP = 10`) untuk seluruh
kelompok saudara, bukan indeks pecahan. Indeks pecahan akhirnya kehabisan
presisi float; daftar sependek ini tidak akan pernah membuat biaya tulis
penomoran ulang terasa.

### C-SISA-5. Filter tersimpan

**Butuh migrasi:** ya, kalau dikerjakan. Ditunda sesuai keputusan owner.

Penambahannya murni aditif — satu model
`ChecklistFilterView { owner_id, name, query_json }`, tanpa membongkar apa pun.

Bentuknya harus **`query_json` terstruktur**, bukan DSL teks ala
`today & p1 @urgent`. DSL menuntut parser, parser menuntut penanganan error, dan
keduanya proyek tersendiri. DSL bisa ditambahkan di atas `query_json` kelak
sebagai cara input alternatif; sebaliknya tidak bisa.

### C-SISA-6. Recurring / task berulang

**Butuh migrasi:** ya, kalau dikerjakan.

Tidak diambil untuk v1 dan itu tepat: butuh parser jadwal, mesin penjadwalan, dan
keputusan soal apa yang terjadi kalau satu kemunculan terlewat. Sebesar seluruh
bagian C digabung.

### C-SISA-7. Notifikasi assignee

**Butuh migrasi:** ya, kalau dikerjakan.

Menugaskan task sekarang tidak memberi tahu siapa pun. StudioFlow belum punya
mekanisme notifikasi sama sekali — membangunnya bukan pekerjaan kecil dan tidak
boleh menumpang di bawah C.

### Batas Today's View yang perlu diawasi

`applyChecklistFilter` menyaring **di memori**, dan itu tepat untuk beberapa puluh
baris yang sudah dipegang klien. Ia salah untuk basis data penuh. Dua hal yang
bisa membuatnya tidak wajar lagi:

1. **Admin memakai "All projects" di studio yang sudah besar.** Ia menarik tiap
   proyek aktif beserta seluruh task fase aktifnya dalam satu query.
2. **Baris checklist hasil template menumpuk** — tiap proyek menghasilkan satu set
   per fase aktif.

Kalau salah satunya terasa berat, tuasnya adalah **memindahkan filter ke SQL dan
memberi paginasi per proyek** — bukan menyembunyikan baris template, dan bukan
mengembalikan syarat "harus punya fase aktif". Syarat itu justru yang membuat
proyek kosong menghilang, dan menghilangnya proyek adalah cacat yang sudah
diperbaiki sekali.

### Aturan yang harus dipegang saat menyentuh task

Tujuh hal yang gampang dirusak tanpa sadar, karena semuanya terlihat seperti
detail sampai ada yang mengubahnya:

**0. Item checklist hanya lahir dari template.**

Item checklist adalah **requirement**: didefinisikan sekali oleh admin di
`ChecklistTemplate` (Studio settings), digenerate ke tiap proyek oleh
`executeSyncProjectChecklists`, dan dihitung gerbang approval. **Tidak ada jalur
lain yang boleh membuatnya** — tidak ada `createTask`, dan `CreateSubtaskSchema`
mewajibkan `parentId` sehingga item akar ditolak sebelum service disentuh.

Kalau ada yang memasang kotak "tambah task" di kartu checklist lagi, itulah
aturan yang sedang dilanggar: fase yang sama akan menuntut hal berbeda di proyek
berbeda, dan templatenya berhenti menggambarkan apa yang ia klaim.

**Subtask boleh dibuat**, dan itu hal yang berbeda: ia memecah requirement yang
sudah ada, tidak menambah kewajiban, dan memang tidak dihitung gerbang approval.

**Yang tetap boleh diedit per-proyek:** prioritas, due date, assignee, label,
komentar. Template menyatakan *apa*; proyek menyatakan *kapan* dan *siapa*.

**1. `template_id` menentukan arti sebuah baris.**
`template_id != null` berarti baris bisa digenerate ulang; `null` berarti baris
hasil detach atau subtask, dan hilang selamanya kalau dihapus. Tiga hal bergantung
pada pembedaan ini — dedup sync, konfirmasi hapus proyek, dan penolakan hapus di
UI. Jangan pernah membuat baris ber-`template_id` di luar jalur sync.

**2. Dedup sync memakai `(template_id, phase_id)`, bukan label.**
Label sempat dipakai sebagai identitas dan itu cacat: task user berlabel sama akan
menelan baris template, dan mengganti nama label template menghasilkan duplikat.
Jangan dikembalikan.

**3. Gerbang approval menghitung task akar saja.**
`assertNoPendingTasks`, badge navigasi, dan bilah progres semuanya menyaring
`parent_id: null`. Ketiganya harus tetap sepakat — kalau salah satu berubah, bilah
progres bisa penuh sementara approval tetap tertahan.

**4. Urutan berasal dari satu tempat.**
`CHECKLIST_TASK_ORDER_BY` di `lib/services/checklist-task.ts`. Sebelum ini
pembacanya mengurut sendiri-sendiri dan tak satu pun benar. Tambahkan pembaca baru
lewat modul itu, jangan menulis `orderBy` sendiri.

**5. Cascade centang berlaku dua arah, dan tidak naik.**
Mencentang induk mencentang subtask; melepas centang induk melepas subtasknya.
Hanya turun-saat-centang akan membuat pekerjaan yang belum selesai terbaca selesai
setelah induknya dicentang lalu dilepas. Subtask **tidak** menggulung ke atas —
itu akan memuaskan gerbang approval lewat keputusan yang tak pernah diambil
siapa pun.

**6. `undefined` ≠ `null` di `executeUpdateTask`.**
Dihilangkan berarti "biarkan", `null` berarti "kosongkan". Karena itu tiap kolom
opsional diperiksa dengan `in`, bukan dengan truthiness. Menggantinya dengan
truthiness membuat due date dan assignee mustahil dikosongkan.

---

## D. Temuan audit UX

Rincian lengkap beserta bukti kode ada di **`AUDIT-UX-2026-08-10.md`**. Di sini
hanya yang **cacat** — temuan yang sifatnya preferensi (nomor 8–12 di laporan)
sengaja tidak diangkat supaya tidak terbaca sebagai pekerjaan wajib.

**D1 dan D4 selesai**, diarsipkan. Sisa: D2, D3, D5 — semuanya tanpa migrasi.

### D2. Aksi merusak memakai `confirm()` bawaan browser

**Laporan:** temuan 4. **Ongkos:** 14 tempat di 10 berkas *(diverifikasi
2026-08-10 — angkanya tidak berubah)*.

`AlertDialog` sudah ada dan sudah dipakai untuk hapus proyek. Alasan ini cacat
dan bukan sekadar selera: browser modern menawarkan **"jangan tampilkan lagi"**
setelah beberapa dialog berturut-turut, dan sekali dicentang penghapusan berjalan
tanpa konfirmasi apa pun tanpa app tahu.

Berkasnya: `activity-manager.tsx`, `cd-list-table.tsx`, `project-tasks-card.tsx`,
`studio-settings-panel.tsx`, `project-chat-sidebar.tsx`, `mom-document-list.tsx`,
`mom-editor.tsx`, `CatalogBoard.tsx`, `CatalogCodeManager.tsx`,
`RenderBoardPanel.tsx`.

`CatalogBoard.tsx` memanggil `confirm()` **dua kali berurutan** untuk satu aksi
karena satu kotak tidak muat memuat peringatannya. Untuk yang seperti itu pakai
ketik-untuk-konfirmasi, bukan dialog kedua.

### D3. Kegagalan yang tidak mengatakan apa-apa

**Laporan:** temuan 5. **Ongkos:** tiga berkas terparah *(diverifikasi
2026-08-10)*.

| Berkas | `catch` | `toast` |
|---|---|---|
| `activity-manager.tsx` | 5 | **0** |
| `project-tasks-card.tsx` | 4 | **0** |
| `cd-list-table.tsx` | 4 | **0** |

Nol `toast` di seluruh berkas, jadi setiap kegagalan di sana tidak terlihat.
Polanya sudah benar di mayoritas tempat lain — ketiga ini yang tertinggal.

**Aturannya:** `catch` di jalur yang dipicu klik wajib `toast.error`; yang dipicu
polling **harus** tetap senyap. Dua `LiveProvider` sudah benar apa adanya —
jangan ikut diubah.

### D5. Tabel gepeng di layar sempit

**Laporan:** temuan 7. **Ongkos:** satu baris per berkas.
**Diverifikasi 2026-08-10:** 13 berkas memakai `TableCard`, hanya **4** yang
memberi `minWidth`.

`TableCard` sudah punya `overflow-x-auto`, tapi itu hanya bekerja kalau tabelnya
punya `minWidth`. Tanpa itu lebar kolom persen diselesaikan terhadap kontainer,
jadi kolom menyusut alih-alih memicu scroll. Sisanya perlu
`layout="fixed" minWidth="…"`.

**Bagian Master Data SELESAI 2026-08-11:** `MasterDataMaterialsClient.tsx` dan
`SupplierClient.tsx` — dua-duanya `<TableCard>` polos, kini `layout="fixed"`
dengan `minWidth` dan lebar kolom eksplisit. Sisa temuan D5 ada di luar Master
Data dan belum dikerjakan.

(Berkas ke-11 di laporan asli, `MasterDataSkusClient.tsx`, sudah dipindahkan ke
`docs/archive/src-mati/` — ia mati.)

---

## Belum dirinci

### B1. Struktur foldering deliverable per fase

**Konteks:** `PLAN-APP-SPLIT.md` §R5.

Keadaan sekarang: hierarkinya `Project → Phase → Revision → File`. `File` datar di
bawah `Revision` — punya `file_name` dan `file_type`, **tanpa kolom folder atau
path**. `PrefixDictionary` memetakan `schedule_category` → `prefix` per `section`,
jadi kemungkinan besar prefix itu yang dimaksud sebagai penamaan/pengelompokan
deliverable.

Perlu diputuskan: folder buatan user, atau struktur yang ditentukan sistem dari
fase + prefix. Jawabannya menentukan apakah butuh migrasi.

---

## Utang teknis

**T1 dan T4 selesai** — lima berkas mati dipindahkan ke `docs/archive/src-mati/`
pada 2026-08-10, **dua lagi** (`PartyClient`, `MasterDataBrandsClient`) pada
2026-08-11. `tsc` dan `npm test` tetap hijau sesudahnya.

Dua yang terakhir layak dicatat caranya: keduanya tidak ditemukan oleh pencarian
berkas mati, melainkan oleh **rename**. Memindahkan sebuah berkas memaksa
memeriksa siapa yang mengimpornya, dan jawabannya ternyata tidak ada. Kalau ada
pembersihan berkas mati berikutnya, rename lebih dulu adalah cara yang murah
untuk menemukannya.

### T2. Kolom kategori di tabel harga — sudah tertutup v2

`MaterialPrice.category` dan `ServicePrice.category` sudah tidak ada — kedua model
itu ikut hilang bersama v1. Kegunaannya (sectioning BQ) tetap terpisah dari
klasifikasi produk, dan v2 memberi masing-masing pohon sendiri lewat
`CategoryKind` (`PRODUCT` vs `WORK`).

Dicatat di sini supaya tidak ada yang "merapikan" keduanya jadi satu pohon:
mereka memang bukan hal yang sama, dan sekarang keduanya entitas ber-FK alih-alih
string yang kebetulan sama. Lihat `docs/PLAN-MASTERDATA-V2.md` §B.3.

**Tidak ada pekerjaan tersisa di sini** — dipertahankan sebagai peringatan, bukan
sebagai todo.

### T3. Warisan dari `PLAN-AUDIT-ROADMAP-2026Q3.md`

Belum diverifikasi ulang:

- Issue 1 — auth bypass `/activity` (tercatat sudah dimitigasi, **perlu verifikasi
  ulang**)
- Issue 5 — validasi prefix kode CD
- Issue 6 — `switchActiveOption` dead code
- Migrasi gate `LIBRARY_*` → nama permission yang jujur setelah `MASTERDATA_*`
  hilang

**Catatan tentang §1.2 A3 dokumen itu.** Ia mencatat tabrakan badge di tabel
proyek sudah diperbaiki. **Belum** — perbaikannya memasang `max-w-full` pada
badge, padahal kelas dasar `Badge` berisi `shrink-0`, dan `max-w-full` tidak bisa
menyusutkan kotak yang tidak boleh menyusut. Baru benar-benar diperbaiki
2026-08-10.

Item lain di dokumen itu yang bertanda "sudah diperbaiki" layak diperiksa ulang
dengan kecurigaan yang sama — itulah seluruh isi T3.

### T6. Sebelas error eslint yang sudah lama ada

**Baru terlihat 2026-08-11**, setelah `src/generated/prisma_old_bak/**`
dikeluarkan dari eslint. Cadangan itu menyumbang 849 dari 870 error, yang
membuat sisanya mustahil ditemukan.

| Berkas | Error |
|---|---|
| `extensions/schedule/lib/display-utils.ts` | 4 × `no-explicit-any` |
| `components/template-manager.tsx` | 2 × `no-explicit-any` |
| `components/today-inline-add.tsx` | 1 × `set-state-in-effect`, 1 × `no-explicit-any` |
| `components/today-quick-add-modal.tsx` | 1 × `set-state-in-effect` |
| `ui_engine/components/ProjectLiveProvider.tsx` | 2 × `no-explicit-any` |

Dua `react-hooks/set-state-in-effect` yang paling layak diperiksa lebih dulu —
`no-explicit-any` adalah utang tipe, sedangkan setState sinkron di dalam effect
adalah render berantai yang bisa terlihat sebagai kedipan di layar.

**Yang lebih penting daripada kesebelasnya:** selama angkanya 870, "lint hijau"
berhenti jadi sesuatu yang bisa diperiksa siapa pun. Menjaga angka ini di nol
lebih berharga daripada memperbaiki kesebelas error itu sendiri.

### T5. Empat dokumen usang yang masih dirujuk komentar kode

**Baru, dari pemeriksaan 2026-08-10.**

Empat dokumen menggambarkan keadaan v1 tapi tidak bisa diarsipkan, karena
komentar di `src/` menunjuk namanya. Memindahkannya membuat 56 komentar menunjuk
berkas yang tidak ada — lebih buruk daripada dokumen usang yang bisa ditemukan.

| Dokumen | Rujukan dari `src/` | Yang perlu dilakukan |
|---|---|---|
| `PLAN-AUDIT-ROADMAP-2026Q3.md` | 24 | Bersihkan rujukan, lalu arsipkan |
| `PLAN-LIBRARY-BRAND-FIRST.md` | 17 | Idem — §6.14 reuse pool masih dikutip `schedule-service.ts` |
| `UPSTREAM-BQ-MATERIAL-SOURCE.md` | 13 | Menggambarkan sumber material v1; idem |
| `MASTER_SSOT.md` | 2 | **Tulis ulang, jangan arsipkan** — ia SSOT arsitektur, dan isinya masih memetakan schema v1 |

`MASTER_SSOT.md` yang paling mendesak dari keempatnya: ia satu-satunya yang
diklaim sebagai *sumber kebenaran*, dan sumber kebenaran yang salah lebih
berbahaya daripada dokumen usang yang jelas-jelas bertanggal lama.

Satu rujukan basi yang lebih kecil sudah diperbaiki bersamaan dengan pengarsipan
ini: komentar `schema.prisma:918` yang masih menyebut *"roadmap A1–A3"* padahal
ketiganya selesai.

---

## Perkakas

Diverifikasi 2026-08-10. Skrip yang memanggil delegate atau kolom yang sudah
di-`DROP` dipindahkan ke `docs/archive/scripts-usang/` — lihat indeks arsip untuk
daftarnya dan alasan tiap skrip mati.

| Skrip | Guna |
|---|---|
| `scripts/run-tests.mjs` | `npm test` — jalankan `*.test.ts` lewat runner bawaan Node |
| `scripts/seed.js` | Seed user & data dasar `studioflow` |
| `scripts/check-user.mjs` | Periksa satu akun |
| `scripts/verify-access-matrix.mjs` | Verifikasi matriks hak akses RBAC |
| `scripts/diagnose-sketchup-codes.mjs` | Diagnostik read-only jembatan kode SketchUp ↔ Schedule |
| `scripts/resolve-import-actor.mjs` | Laporan read-only aktor import |
| `scripts/sync-ip.mjs` | Sinkronkan IP LAN untuk akses dev |

**Belum ada penggantinya, dan itu lubang nyata:** tidak ada lagi skrip untuk
mengosongkan `master_data` v2 untuk uji dari nol (`reset-masterdata.mjs` menarget
tabel v1). Kalau §M3 butuh uji berulang dari keadaan kosong, skrip itu perlu
ditulis ulang terhadap 18 tabel v2.

**`npm test`** mentranspilasi `*.test.ts` ke `tmp/test-out`, menambal kembali
ekstensi `.js` dan alias `@/` pada impor hasil emit, lalu menjalankan
`node --test`. Tidak ada framework test yang ditambahkan — dua celah itu memang
satu-satunya yang menghalangi `node --test` membaca TypeScript repo ini langsung.
Ketikan tipe **tidak** diperiksa di sini; `npm run typecheck` sudah menutup
seluruh `src/`.

Konsekuensi yang disengaja: berkas test hanya boleh mengimpor modul yang tidak
menyentuh Prisma atau `server-only` saat runtime. Impor bertipe (`import type`)
aman karena hilang saat transpile. Batasan itu justru gunanya — ia menjaga kode
yang diuji tetap bebas I/O.

### Uji manual — task

Yang perlu dilihat sendiri, karena tidak tertutup uji otomatis:

1. Fase → **Tambah task**, Enter → muncul **di bawah**, bukan di atas
2. Titik tiga → **Tambah subtask** → centang **induknya** → subtask ikut tercentang
3. Lepas centang induk → subtask **ikut lepas** (cascade dua arah)
4. Bilah progres dan badge navigasi hanya menghitung **task akar**
5. Beri P1 + due date kemarin → tab **Terlambat** dan **P1** muncul dengan angka
6. Centang task terlambat itu → hilang dari tab **Terlambat**, badge tanggal jadi netral
7. Titik tiga pada baris hasil template → hanya ada **Lepas dari template**, tanpa Hapus
8. Lepas dari template → **Hapus** muncul → hapus → **tidak kembali** setelah reload
9. Muat ulang halaman → urutan **tidak berubah** (ini yang dulu rusak)

Langkah 9 adalah yang paling mudah terlewat: cacat lamanya hanya terlihat sesudah
polling pertama mendarat, karena saat itulah urutan versi server menggantikan
urutan render awal.

### Uji manual — Master Data v2

Ditulis 2026-08-11 setelah §M3 selesai. **Butuh mesin yang punya database.**
Skenario lama dibuang seluruhnya — ia menyebut `+ Perusahaan`, `MaterialPrice`,
dan `catalog_tags`, dan tidak satu pun masih ada.

**Material dan harga**

1. Materials → **Add Material**, isi identitas + harga, pilih Supplier → simpan
   sekali. Harga muncul di tab Pricing **tanpa** langkah kedua
2. Tambah harga kedua untuk SKU yang sama dari **supplier berbeda** → keduanya
   tampil, dan kartu material menampilkan yang **termurah**
3. Edit harga supplier pertama → **penawaran supplier kedua tetap berlaku**.
   Ini uji terpenting di daftar ini: kegagalannya adalah cacat yang paling lama
   tersembunyi
4. Isi **hanya** List price, kosongkan Net price → tersimpan sebagai net = list,
   **bukan 0**, dan barisnya terhitung BQ-ready
5. Isi Net price lebih besar dari List price → **ditolak** dengan pesan bahwa
   kedua field tertukar
6. Ubah **hanya** catatan sebuah harga → baris yang sama diubah, tidak ada baris
   riwayat baru
7. **Remove** sebuah harga → hilang dari daftar, tapi barisnya masih ada di
   database dengan `is_current: false` dan `valid_to` terisi

**Barang tanpa brand (Q7)**

8. Add Material tanpa memilih brand, mis. "plywood 9mm" → **tersimpan**
9. Simpan lagi dengan nama yang sama, tetap tanpa brand → **ditolak** oleh
   `Sku_slug_nobrand_uniq`

**Supplier dan kategori Party**

10. Jalankan `node scripts/backfill-party-roles.mjs` (dry-run) → baca
    laporannya → `--apply`
11. Supplier → buka sebuah Party → centang **Supplier** (atau **Retail store**)
    → simpan
12. Buka halaman Pricing → pemilih Supplier → **nama itu harus muncul**.
    Sebelum 2026-08-11 daftar ini kosong selamanya, apa pun isinya
13. Party berkategori **Retail** juga harus muncul — contoh Excel sendiri
    (Ace Hardware) berkategori Retail, bukan Supplier
14. Party **tanpa** kategori sama sekali tidak muncul; kalau id-nya dipaksa
    lewat, server menolaknya dengan pesan yang menyuruh membuka halaman Supplier
15. Kosongkan supplier → tersimpan sebagai *Manufacturer list price*
16. Buka lagi Party yang tadi → centangnya **masih ada** setelah reload

**Kolom Excel yang baru bisa diisi (§A8)**

17. Form harga kerja → isi **Vendor category** = "MEP" dan **Category** =
    "Lighting" → simpan. Buka lagi: keduanya kembali di kotaknya masing-masing
18. Buat baris kedua dengan Vendor category "MEP" dan Category lain → keduanya
    harus berbagi induk yang sama, bukan membuat "MEP" kedua
19. Isi Specification 1/2, Dimensions, Qty → tersimpan dan kembali saat dibuka
20. Tambahkan dua Project reference → keduanya tampil sebagai chip, bisa dihapus
21. Form Brand → **Sold by** centang sebuah Party → simpan → masih tercentang
22. Halaman Supplier → penyaring kategori → memilih "Retail store" hanya
    menyisakan brand yang pemiliknya berkategori itu

**Setelah dua migrasi WorkPrice**

23. Tab Material + Labour → satu kotak harga, bukan dua. Kolom Total hilang
24. `SELECT kind, count(*) FROM master_data."WorkPrice" GROUP BY kind;` →
    pembagiannya masuk akal terhadap yang Anda ingat
25. `SELECT * FROM master_data.v_bq_work_rate LIMIT 1;` → punya `price` dan
    `has_material`, tanpa `material_price`/`labor_price`/`total_price`

Langkah 3, 4, dan 12 yang paling mudah dilewati, dan ketiganya persis cacat yang
baru diperbaiki. Menjalankan sisanya tanpa ketiganya tidak membuktikan apa-apa.

Langkah 18 juga layak dijalankan sendiri: ia satu-satunya yang membuktikan pohon
kategori benar-benar terbentuk, bukan sekadar dua kotak yang isinya tersimpan.

---

## Gelombang 5 — Master Data UI/UX Fixes (2026-08-18)

Temuan dari screenshot pic1 (brand detail), pic2 (brands table),
pic3 (supplier/jasa tab). Semua item ini UI/logika aplikasi — tidak
menyentuh schema atau migrasi.

### PR1 · Material Prices — CreatableSearch di Add Material Price (P1)

**Kondisi saat ini:**
- Brand field sudah pakai `CreatableSearch` langsung (PricingClient.tsx:771)
- Supplier field pakai `PartyPicker` — wrapper tipis di atas `CreatableSearch`
  (PartyPicker.tsx:53). Jadi secara teknis sudah pakai `CreatableSearch`.

**Yang perlu diubah:**

1. **Brand field** — sudah benar. `CreatableSearch` dengan `allowClear`,
   `createLabel`, `onCreate` → `brandEntry.create`. Tidak perlu ubahan.

2. **Supplier field** — ganti `PartyPicker` dengan `CreatableSearch` langsung
   untuk konsistensi. `PartyPicker` hanya wrap `CreatableSearch` dengan
   mapping `subText: c.legal_name`. Kalau pakai `CreatableSearch` langsung:
   - `options` → map `suppliers` ke `{ id, name, subText }` (subText = legal_name
     atau role)
   - `allowClear` + `clearLabel="— Manufacturer list price —"`
   - `onCreate` → `supplierEntry.create` (quick create Party dengan role SUPPLIER)
   - `onSelect` → set `form.supplier_party_id`

3. **SKU field** — saat ini SKU list difilter by `form.brand_id` (line 546-548).
   Kalau brand kosong (generic stock), SKU list kosong. **Pertimbangan:**
   - SKU field bisa juga pakai `CreatableSearch` (bukan select biasa) supaya
     user bisa search by SKU code atau product name
   - Atau pertahankan select kalau list SKU sudah kecil

4. **Unit field** — sudah pakai input biasa dengan suggestions. Bisa upgrade ke
   `CreatableSearch` kalau ingin konsisten, tapi tidak wajib.

**File yang berubah:**
- `src/subapps/master-data/components/PricingClient.tsx` — ganti PartyPicker
  import jadi CreatableSearch, refactor Supplier field

**Tidak berubah:**
- Schema, migration, action/server logic
- Brand field (sudah benar)
- Guard unsaved changes (sudah terpasang)

**Estimasi:** 30 menit — refactor kecil, hanya mengganti wrapper dengan
component yang di-wrap.

- [ ] **BR1 · Inline edit regresi (P0)** — Kolom-kolom tertentu di tabel
      Brands (Category, Hashtag, Brand Name) harusnya bisa di-inline edit
      langsung di tabel, bukan harus buka detail dulu. Kembalikan fitur
      inline edit yang sudah ada sebelumnya. Pertahankan guard
      `useUnsavedChangesGuard` yang sudah terpasang.
      **File:** `BrandListClient.tsx` atau tabel component

- [ ] **BR2 · Search Brands diperluas (P2)** — Search di tabel Brands
      saat ini hanya mencari by brand name. Perluas agar mencakup:
      nama brand, kategori, hashtag, nama supplier terkait, dan SKU code.
      Ikut pattern yang sama dengan Library (`filter` client-side).
      **File:** `src/subapps/master-data/components/BrandListClient.tsx`

- [ ] **BR3 · Category hilang setelah Add Brand berturut-turut (P0)** —
      Setelah add brand pertama dengan kategori tertentu, ketika buka
      Add Brand lagi, kategori yang baru ditambahkan hilang/reset.
      State form tidak persist antara create sessions.
      **File:** `MasterDataBrandDialog.tsx` atau `BrandListClient.tsx`

- [ ] **BR4 · Detail page → Modal popup (P1)** — Refactor brand detail
      dari full page (`/masterdata/materials/[id]`) menjadi modal:
      - Klik SKU row → popup list SKUs (bukan tab baru)
      - Klik Supplier → popup assign supplier (modal dengan picker)
      - Kolom "Lengkap" → hapus, ganti row berwarna kuning jika data
        belum lengkap
      **File:** `BrandDetailClient.tsx`, parent di `BrandListClient.tsx`

- [ ] **BR5 · Tambah kolom Katalog & Links di tabel Brands (P2)** —
      Tambah kolom "Katalog" dan/atau "Links" di tabel Brands. Tampilkan
      link ke katalog PDF/URL dan BrandLink[] (Facebook, marketplace).
      Klik bisa buka popup/modal untuk edit links.
      **File:** `BrandListClient.tsx`

- [ ] **BR6 · Actions jadi titik 3 (⋯) hover (P1)** — Ganti ikon
      actions (pencil, eye, trash) yang selalu tampil dengan tombol "⋯"
      (kebab menu) yang hanya muncul saat row di-hover. Berlaku untuk
      **kedua tabel**: Brands DAN Suppliers (Materials tab + Jasa tab).
      **File:** `BrandListClient.tsx`, `SupplierClient.tsx`

- [ ] **BR7 · Terapkan BR4 ke Supplier/Vendors (P2)** — Pola yang sama
      dengan BR4 diterapkan ke Supplier:
      - Detail supplier → modal popup (bukan full page navigasi)
      - Klik SKU assignment → popup
      - "Lengkap" → row coloring kuning
      - Actions → titik 3 hover
      **File:** `SupplierDetailClient.tsx`, `SupplierClient.tsx`

- [ ] **BR8 · Tombol "Add SKU" di Supplier Jasa tab (P1)** — Supplier
      Jasa tab tidak punya cara untuk menambah SKU dari konteks supplier.
      Tambah tombol/action "Add SKU" yang reuse pattern quick-entry
      atau buka `MasterDataProductDialog` dari konteks supplier.
      **File:** `SupplierClient.tsx` (Jasa tab), `MasterDataProductDialog.tsx`
