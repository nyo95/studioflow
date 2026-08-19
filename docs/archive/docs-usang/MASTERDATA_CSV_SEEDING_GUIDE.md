# Acuan Baca Ulang CSV dan Seeding Master Data

Status: **acuan kanonis per 31 Juli 2026**. Dokumen ini menggantikan alur
`VendorOffering`, kategori/subkategori relasional, SKU kosong, dan import
`Sample` dari daftar katalog.

## 0. Terminologi (ditetapkan owner, 31 Juli 2026)

- Untuk **Material**, pihak relasionalnya adalah **Brand** (merek/produsen).
- **Vendor** berarti **penyedia jasa** (tukang, aplikator, kontraktor, workshop)
  dan berada di sisi jasa sebagai `master_data.ServiceVendor`, opsional
  terhubung dari `ServicePrice`.

Ini **membalik** kalimat lama "Vendor adalah supplier relasional; Brand adalah
atribut Material". Yang berubah hanya **nama** pihak relasionalnya. Larangan
intinya TETAP berlaku: jangan pernah mengarang pihak relasional dari sekadar
nama yang muncul di sumber — baris tanpa bukti tetap blocker.

Catatan implementasi: model Prisma-nya memang sudah bernama `Brand`
(`brand_name`, `brand_id`); hanya `@@map("Vendor")` yang menamai tabel fisiknya
Vendor. Tabel itu **sengaja tidak di-rename** karena seluruh FK Material,
MaterialCandidate, VendorContact, VendorLink menunjuk ke sana dan snapshot
project membekukan key `catalog_*`. Di seluruh dokumen ini, kolom staging yang
masih bernama `vendor_key`/`vendor_key_candidate` berarti **Brand**.

## 1. Kontrak data yang dituju

```text
Vendor (supplier relasional)
└── Material
    ├── Brand
    ├── Category tags (1..n, berurutan)
    ├── Product name
    ├── SKU
    ├── warna / motif / finishing / ukuran / link (opsional)
    ├── harga sebelum diskon / setelah diskon / satuan harga
    └── Sample fisik (0..n, hanya bila bendanya benar-benar diterima)
```

Aturan utamanya:

- Satu baris `Material` adalah satu produk yang benar-benar teridentifikasi.
- `SKU` wajib. Tidak ada `Offering` dan tidak ada Material tanpa SKU.
- `Vendor` adalah supplier/account yang dapat memasok Material. `Brand` adalah
  merek produk. Keduanya tidak boleh disamakan hanya karena sumber lama hanya
  mencantumkan salah satunya.
- Kategori dan istilah lama “Product” yang sebenarnya subkategori digabung
  menjadi `category_tags`. Tag pertama adalah kategori utama untuk Schedule;
  tag berikutnya adalah klasifikasi tambahan.
- `product_name` adalah nama produk/seri/model yang nyata, bukan salinan tag
  kategori.
- Harga belum lengkap tidak menghalangi penyimpanan Material, tetapi Material
  tidak boleh menjadi sumber harga BQ sebelum `price_before_discount`,
  `price_after_discount`, dan `price_unit` semuanya terisi.
- Semua Material hasil seed wajib masuk sebagai `PENDING`. Status ini tetap
  dapat dipakai di Library dan Project Schedule; jangan mengubahnya menjadi
  `APPROVED` di importer. Approval dilakukan terpisah oleh Owner, Admin, atau
  Curator setelah review. `REJECTED` tidak boleh dipakai untuk row seed baru.
- “Sample tidak tersedia” berarti Material tidak mempunyai baris Sample aktif.
  Jangan membuat baris Sample palsu dengan status tidak tersedia.

## 2. File lama tidak boleh diimpor langsung

File berikut hanya boleh dibaca sebagai bukti sumber, bukan sebagai payload
langsung:

- `docs/masterdata-import-staging/01_vendors.csv`
- `docs/masterdata-import-staging/02_vendor_contacts.csv`
- `docs/masterdata-import-staging/03_vendor_offerings.csv`
- `docs/masterdata-sample-staging/01_physical_samples.csv`
- paket lama `03_product_catalog.csv` dan `04_physical_samples.csv` di `outputs/`

Alasannya: file-file itu dibangun dengan asumsi lama bahwa Brand adalah Vendor,
baris tanpa SKU masih sah sebagai Offering, serta daftar sample dapat berdiri
tanpa Material. Ketiga asumsi tersebut sudah dibatalkan.

Script `scripts/import-masterdata-list.mjs` dan
`scripts/import-masterdata-samples.mjs` juga tetap dinonaktifkan. Jangan
menghapus guard `throw` lalu menjalankannya.

## 3. Bentuk staging baru

Bangun ulang payload relasional berikut. Gunakan UTF-8, satu header, dan jangan
mengubah nomor telepon menjadi angka. Paket hasil baca ulang workbook saat ini
berada di `docs/masterdata-seed`.

### `01_vendors.csv`

| Kolom | Wajib | Aturan |
|---|---:|---|
| `vendor_key` | ya | Kunci stabil staging; bukan UUID database |
| `vendor_name` | ya | Nama supplier/account yang benar |
| `legal_name` | tidak | Nama PT/CV bila benar-benar tersedia |
| `address` | tidak | Pertahankan teks sumber |
| `notes` | tidak | Catatan kurasi, bukan data karangan |
| `source_sheet` | ya | Nama sheet/CSV asal |
| `source_rows` | ya | Nomor baris sumber, dapat dipisah `;` |
| `source_checksum` | ya | Checksum sumber untuk jejak audit |

Jika sumber hanya menyebut Brand dan tidak membuktikan siapa Vendornya, jadikan
baris tersebut **blocker**. Jangan mengisi `vendor_name = brand`.

### `02_vendor_contacts.csv`

| Kolom | Wajib | Aturan |
|---|---:|---|
| `vendor_key` | ya | Harus cocok dengan `01_vendors.csv` |
| `contact_person` | ya | Nama orang atau label departemen literal dari sumber |
| `contact_role` | tidak | Sales, showroom, dan sebagainya |
| `phone_number` | tidak | Selalu teks; nol di depan dan multi-nomor dipertahankan |
| `email` | tidak | Normalisasi spasi saja |
| `source_sheet` / `source_row` | ya | Provenance |

### `03_vendor_links.csv`

| Kolom | Wajib | Aturan |
|---|---:|---|
| `vendor_key` | ya | Harus cocok dengan `01_vendors.csv` |
| `kind` | ya | `WEBSITE`, `INSTAGRAM`, `CATALOG`, atau enum `VendorLinkKind` lain yang tepat |
| `url` | ya | URL `http`/`https` lengkap |
| `label` | tidak | Label literal seperti Website, Instagram, atau Drive/folder katalog |
| `source_sheet` / `source_rows` | ya | Provenance |
| `source_checksum` | ya | Checksum workbook sumber |

URL yang sama secara semantik pada satu Vendor hanya boleh muncul sekali.
Tracking query umum dan perbedaan trailing slash tidak membuat link baru.
Nama file lokal atau teks tanpa URL masuk review, bukan `VendorLink`.

### `04_materials.csv`

| Kolom | Wajib | Aturan |
|---|---:|---|
| `vendor_key` | ya | Relasi ke Vendor staging |
| `brand` | ya | Merek/Manufacturer pada produknya |
| `category_tags` | ya | Dipisah `|`; tag utama ditulis pertama |
| `product_name` | ya | Nama seri/model/produk yang nyata |
| `sku` | ya | Kode artikel pabrikan; bukan nomor baris atau kode project |
| `color` | tidak | Kosong tetap kosong |
| `motif` | tidak | Kosong tetap kosong |
| `finishing` | tidak | Kosong tetap kosong |
| `dimension_p/l/t/unit` | tidak | Jangan tebak satuan |
| `reference_url` | tidak | URL produk |
| `folder_url` | tidak | Folder dokumen |
| `image_url` | tidak | Media produk |
| `price_before_discount` | tidak | Angka bersih; tanpa `Rp` atau pemisah ribuan |
| `price_after_discount` | tidak | Angka bersih; harus ≤ harga sebelum diskon |
| `price_unit` | tidak | `m2`, `pcs`, `lembar`, dan sebagainya |
| `source_sheet` / `source_row` | ya | Provenance |
| `source_checksum` | ya | Untuk dry-run dan audit |

Transformasi taxonomy lama:

1. Ambil nilai `Category` lama sebagai tag pertama.
2. Jika kolom `Product` lama sebenarnya subkategori/family seperti HPL, SPC,
   Vinyl, Flooring, atau Sanitary, masukkan sebagai tag tambahan.
3. Jangan otomatis menaruh nilai tersebut ke `product_name`.
4. `product_name` harus diambil dari kolom tipe/seri/model yang benar-benar
   mengidentifikasi produk. Jika tidak ada, baris menjadi blocker.
5. Normalisasi tag secara case-insensitive dan buang duplikat, tetapi
   pertahankan ejaan tampilan dan urutan kemunculan pertama.

Kunci deduplikasi database adalah:

```text
vendor + brand + sku
```

SKU yang sama pada Brand atau Vendor berbeda tidak otomatis dianggap produk
yang sama.

### `05_physical_samples.csv` — opsional dan dikerjakan terakhir

File ini hanya dibuat untuk benda yang telah diverifikasi benar-benar ada atau
sedang keluar karena dipinjam/dikirim.

| Kolom | Wajib | Aturan |
|---|---:|---|
| `sample_key` | ya | Kunci staging stabil untuk satu unit fisik; bukan SKU |
| `vendor_key` / `brand` / `sku` | ya | Harus match tepat ke satu Material |
| `rack_number` | ya | Lokasi fisik |
| `box_number` | ya | Container box fisik |
| `quantity` | ya | Bilangan bulat positif |
| `status` | ya | `AVAILABLE`, `BORROWED`, atau `SENT_TO_CLIENT` |
| `current_borrower_name` | kondisional | Wajib untuk borrowed/sent |
| `borrowed_at` / `due_at` | tidak | Tanggal nyata bila tersedia |
| `notes` | tidak | Catatan inventaris |

Jangan buat file/baris ini dari katalog produk, keterangan “belum minta”, atau
kolom sample yang tidak membuktikan keberadaan barang. Baris yang tidak dapat
match tepat ke satu Material harus diblokir, bukan dibuat sebagai Sample lepas.

### Aturan turunan SKU untuk kandidat asal `Sheet1` (dikonfirmasi owner 2026-07-31)

`Sheet1` (sample fisik) tidak punya kolom SKU, tetapi punya `Tipe` (nama seri)
dan `Motif` (varian warna/finishing). Owner mengonfirmasi bahwa untuk sheet ini
identitas pabrikannya adalah:

```text
product_name = Tipe
sku          = Tipe + " " + Motif   (Motif dilewati bila kosong)
```

Contoh: Tipe `Terrain` + Motif `Gravel` = product_name `Terrain`, SKU
`Terrain Gravel`.

Ini BUKAN pengecualian dari larangan "Tipe-as-SKU inference" pada baris
`List` (family/subkategori seperti "Roller Blind", "Bathroom") — larangan itu
tetap berlaku penuh di sana karena kolom `Product`-nya memang bukan identitas
produk. Aturan ini juga bukan tebakan sistem: ini konfirmasi eksplisit dari
pemilik produk berdasarkan pengetahuan langsung cara sample fisik diberi
label, persis jenis konfirmasi yang dikumpulkan `/masterdata/curation`.

Terapkan hanya pada kandidat yang sudah memenuhi syarat lain:

- `source_sheet = Sheet1`.
- Vendor sudah match (`vendor_key_candidate`/`candidate_vendor_id` terisi).
- `brand_candidate` dan `category_tags_candidate` terisi.
- `source_product_or_type` (Tipe) tidak kosong.

Sebelum menyimpan `sku_confirmed`, cek tabrakan kunci `vendor + brand + sku`
turunan terhadap kandidat lain di batch yang sama maupun Material yang sudah
promoted. Tabrakan tetap HARUS diskip untuk disambiguasi manual, kecuali bukti
sumber sudah dikonfirmasi menunjukkan bahwa kedua baris adalah produk fisik
yang sama dan `category_tags_candidate` keduanya juga sama. Untuk pengecualian
yang sudah terbukti tersebut, satu kandidat dipilih secara deterministik sebagai
pemenang, kandidat redundan ditandai `DISMISSED` dengan catatan yang menunjuk
pemenang, dan seluruh `SampleCandidate` yang sebelumnya menunjuk kandidat
redundan dipindahkan ke pemenang. Tidak ada kandidat yang dihapus.

Pada workbook ini terdapat empat pasangan yang memenuhi bukti tersebut:
`Infiniti Reggio Grey`, `Rotterdam Cream`, `Stone White`, dan `Xenith Cream`.
Satu baris memisahkan Tipe/Motif, sedangkan baris lainnya menulis gabungannya
di Tipe. Collision lain, collision dengan kategori berbeda, atau collision
terhadap Material kanonis tetap diblokir.

Baris dengan Vendor belum match ke direktori `List` (mis. varian ejaan
`Roman`/`Niro`/`Artile`) tetap di luar cakupan aturan ini; itu masalah
fuzzy-matching Vendor, bukan masalah SKU.

Alat bantu: `scripts/curate-sheet1-sku-motif.mjs` menerapkan aturan ini dengan
mode `--validate-only` (CSV saja), `--dry-run`, dan `--apply` (backup + audit
log wajib, sama seperti importer utama).

### Antrean kurasi database, bukan data katalog

- `06_material_candidates.csv` menampung row yang belum memenuhi identitas
  Material. Kolom `*_candidate` adalah bukti sumber. Importer menyimpannya ke
  `master_data.MaterialCandidate`, bukan ke `master_data.Material`.
- `07_sample_candidates.csv` menampung benda fisik yang belum match ke Material.
  Importer menyimpannya ke `master_data.SampleCandidate`; relasi ke
  MaterialCandidate hanya saran sumber, bukan relasi Sample kanonis.
- `08_import_review.csv` adalah daftar blocker/warning/info yang wajib dibaca
  sebelum apply.
- `BUILD_SUMMARY.json` merekonsiliasi seluruh count dan checksum.

Kurasi dilakukan melalui `/masterdata/curation`:

1. Buka kandidat dalam mode read-only lalu gunakan `Modify`.
2. MaterialCandidate baru dapat dipromosikan setelah Vendor, Brand, SKU nyata,
   nama produk, dan minimal satu tag kategori terkonfirmasi.
3. Promosi membuat Material kanonis berstatus `PENDING`; kandidat berubah
   menjadi `PROMOTED`.
4. SampleCandidate baru dapat dipromosikan setelah menunjuk satu Material
   kanonis. Sample keluar wajib memiliki nama peminjam/penerima.
5. Kandidat yang bukan data sah ditandai `DISMISSED`, bukan dihapus.

Status `PENDING` pada kandidat berarti **belum menjadi data usable**. Ini
berbeda dari Material `PENDING`, yang sudah kanonis dan tetap usable sesuai
kontrak kurasi.

## 4. Validasi sebelum importer ditulis

Dry-run harus menolak minimal kondisi berikut:

- Vendor kosong atau Vendor hanya disalin dari Brand tanpa bukti.
- Brand, SKU, product name, atau category tags kosong.
- Placeholder seperti `N/A`, `UNKNOWN`, `DRAFT`, `LEGACY-*`, `-`, nomor baris,
  atau kode Schedule project dipakai sebagai SKU/nama.
- Kombinasi `vendor + brand + sku` muncul lebih dari sekali dengan data
  bertentangan.
- Salah satu harga terisi tetapi pasangannya atau satuannya kosong; ini warning
  `BQ_NOT_READY`, bukan alasan mengarang nilai.
- Harga setelah diskon lebih besar dari harga sebelum diskon.
- Sample tidak match tepat ke satu Material.
- Sample berstatus keluar tanpa nama peminjam/penerima.

Laporan dry-run minimal harus berisi:

```text
source rows
vendors create/reuse/block
materials create/reuse/block
materials BQ-ready / BQ-not-ready
samples create/block
material candidates create/reuse
sample candidates create/reuse
audit logs planned
blockers dengan source_sheet + source_row + reason
warnings dengan source_sheet + source_row + reason
```

Importer kanonis tersedia di `scripts/import-masterdata-seed.mjs`:

```powershell
# Tanpa akses database
node scripts/import-masterdata-seed.mjs --validate-only

# Read-only terhadap database lokal
node scripts/import-masterdata-seed.mjs --dry-run `
  --actor-email <email-user-nyata>
```

## 5. Aturan apply

- Backup PostgreSQL harus berada di luar folder project, memiliki SHA-256, dan
  lolos `pg_restore --list`.
- Apply hanya boleh berjalan terhadap database lokal yang dituju secara
  eksplisit.
- Semua write ke `master_data` dan `studioflow.AuditLog` dilakukan dalam satu
  transaksi.
- Importer tidak boleh menghapus, truncate, mengubah, atau menulis ulang data
  project pada schema `studioflow`.
- Setiap create/update Vendor, Material, dan Sample wajib menulis AuditLog
  dengan actor nyata, source file, source row, dan source checksum.
- Setiap create/update/dismiss/promote MaterialCandidate atau SampleCandidate
  juga wajib menulis AuditLog dengan actor nyata.
- Jalankan dry-run lagi setelah apply. Hasil kedua harus `create = 0`; seluruh
  baris yang sah harus menjadi `reuse`.

Contoh apply dengan PostgreSQL client dari container Docker:

```powershell
node scripts/import-masterdata-seed.mjs --apply `
  --actor-email <email-user-nyata> `
  --backup D:\path-di-luar-project\studioflow_before_masterdata_seed.dump `
  --backup-sha256 <SHA256> `
  --pg-restore-container <nama-container-postgres> `
  --ack-review
```

Bila `pg_restore` tersedia langsung di host, ganti opsi container dengan
`--pg-restore <path-executable>`.

## 6. Pemeriksaan setelah seed

Gunakan pemeriksaan berikut setelah importer baru selesai:

```sql
SELECT COUNT(*) FROM master_data."Vendor";
SELECT COUNT(*) FROM master_data."Material";
SELECT COUNT(*) FROM master_data."Sample";

-- Wajib nol
SELECT COUNT(*) FROM master_data."Material"
WHERE BTRIM("catalog_sku") = ''
   OR BTRIM("catalog_brand") = ''
   OR BTRIM("catalog_product_name") = ''
   OR cardinality("catalog_tags") = 0;

-- Coverage harga BQ
SELECT
  COUNT(*) FILTER (
    WHERE "price_before_discount" IS NOT NULL
      AND "price_after_discount" IS NOT NULL
      AND NULLIF(BTRIM("price_unit"), '') IS NOT NULL
  ) AS bq_ready,
  COUNT(*) FILTER (
    WHERE "price_before_discount" IS NULL
       OR "price_after_discount" IS NULL
       OR NULLIF(BTRIM("price_unit"), '') IS NULL
  ) AS bq_not_ready
FROM master_data."Material"
WHERE "deleted_at" IS NULL;

-- Sample selalu terhubung ke Material
SELECT COUNT(*) AS orphan_samples
FROM master_data."Sample" s
LEFT JOIN master_data."Material" m ON m.id = s.material_id
WHERE m.id IS NULL;
```

Terakhir, bandingkan checksum/count utama schema `studioflow` sebelum dan
sesudah seed. Perbedaannya hanya boleh berupa AuditLog baru; project, schedule,
snapshot, dan dokumen operasional harus tetap identik.
