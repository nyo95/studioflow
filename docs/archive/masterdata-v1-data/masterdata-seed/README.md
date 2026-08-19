# Master Data Seed — Reviewed Staging

Status: **payload Vendor dan antrean kandidat sudah diterapkan ke database lokal
pada 31 Juli 2026. Setelah kurasi eksplisit, 172 kandidat Sheet1 sudah menjadi
Material kanonis `PENDING`; Sample kanonis tetap menunggu kurasi**.

Sumber:

- Workbook: `docs/RAD - Material + Supplier.xlsx`
- SHA-256:
  `1AB11BD57893424EA226135F670197B31B96B861BA05C0C4962AF5BC8D0FBCEE`
- Kontrak: `docs/MASTERDATA_CSV_SEEDING_GUIDE.md`
- Importer: `scripts/import-masterdata-seed.mjs`

## Hasil pembacaan

Payload yang aman:

| Entity | Rows | Keterangan |
|---|---:|---|
| Vendor | 392 | Mempunyai bukti supplier/account dari legal entity, kontak, telepon, alamat, website, atau Instagram |
| VendorContact | 399 | Nomor telepon tetap teks; nol awal dan multi-nomor dipertahankan |
| VendorLink | 1.010 | Website, Instagram, serta link katalog/folder; URL semantik dideduplikasi |
| Material | 0 | Diblokir karena workbook tidak mempunyai kolom SKU eksplisit |
| Sample | 0 | Diblokir sampai match tepat ke Material dengan Vendor + Brand + SKU |
| MaterialCandidate | 756 | Masuk antrean kurasi; belum usable sebagai Material |
| SampleCandidate | 287 | Masuk antrean kurasi; belum usable sebagai Sample |

Antrean review:

- 756 kandidat Material:
  - 483 dari direktori `List`;
  - 273 identitas unik yang muncul pada sample fisik `Sheet1`.
- 287 kandidat Sample fisik.
- 1.046 blocker, 51 warning, dan 1 informasi.

Semua data hasil sumber tetap perlu dikurasi ulang. Kandidat awal disimpan di
tabel review terpisah; tidak ada Material atau Sample yang dibuat oleh importer
seed. Promosi Material yang terjadi kemudian adalah operasi kurasi eksplisit,
bukan efek otomatis importer.

Tiga baris `List` tidak menjadi Vendor karena tidak mempunyai bukti
supplier/account selain nama pada kolom ambigu `Brand/Company`:

- row 420 — `UNV`
- row 483 — `Arwana Ceramics`
- row 484 — `Roca`

## Mengapa payload awal Material dan Sample kosong

`List` adalah direktori supplier/product-family. Kolom `Product` umumnya adalah
family atau subkategori, bukan nama item spesifik. `Sheet1` membuktikan bahwa
287 benda sample pernah ada secara fisik, tetapi hanya menyediakan
`Jenis + Brand + Tipe + Motif`; tidak ada SKU pabrikan dan tidak ada relasi
Vendor yang sudah dikonfirmasi.

Importer seed ini sengaja tidak:

- membuat `LEGACY-*`, nomor row, atau `Tipe` sebagai SKU;
- menyamakan Brand dan Vendor tanpa bukti;
- membuat Sample tanpa Material;
- menganggap catatan proyek sebagai `SENT_TO_CLIENT`;
- memasukkan sheet `Delete`.

## Kurasi Sheet1 yang sudah diterapkan

Owner kemudian mengonfirmasi bahwa khusus `Sheet1`,
`product_name = Tipe` dan `sku = Tipe + Motif`. Operasi kurasi terpisah melalui
`scripts/curate-sheet1-sku-motif.mjs` menghasilkan:

- 172 Material kanonis, seluruhnya `PENDING`;
- 172 MaterialCandidate `PROMOTED`;
- 4 MaterialCandidate duplikat `DISMISSED` secara non-destruktif;
- 580 MaterialCandidate tetap `PENDING`;
- 287 SampleCandidate tetap tersedia dan 0 Sample kanonis.

Dari 287 SampleCandidate tersebut, 184 source suggestion sudah menunjuk
MaterialCandidate yang `PROMOTED` dan 103 masih menunjuk kandidat `PENDING`.
Seluruh `confirmed_material_id` tetap kosong agar pemilihan Material fisik
dilakukan eksplisit saat kurasi Sample.

Empat pasangan duplikat Infiniti (`Reggio Grey`, `Rotterdam Cream`,
`Stone White`, dan `Xenith Cream`) telah terbukti sebagai produk fisik yang
sama dengan Tipe/Motif ditulis berbeda. Link SampleCandidate dari loser
dipindahkan ke winner; tidak ada link yang tersisa pada kandidat `DISMISSED`.

Backup sebelum operasi:
`D:\Misc\ProjectsHUB\studioflow-backups\backup_before_sheet1_sku_curation_20260731_174005.dump`
(SHA-256
`F33C7ADDAA2CB8E7E6E1DA802025A2AD7B337A8FB09436EFFE5717D4017B055F`).
Backup lolos `pg_restore --list` dan restore-test database terisolasi.

## File

Urutan payload:

1. `01_vendors.csv`
2. `02_vendor_contacts.csv`
3. `03_vendor_links.csv`
4. `04_materials.csv`
5. `05_physical_samples.csv`

Review:

6. `06_material_candidates.csv`
7. `07_sample_candidates.csv`
8. `08_import_review.csv`
9. `BUILD_SUMMARY.json`

## Cara melanjutkan kurasi

1. Buka `/masterdata/curation`, pilih kandidat, lalu gunakan `Modify`.
2. MaterialCandidate baru dapat dipromosikan bila Vendor, Brand, category tags,
   product name, dan SKU nyata sudah lengkap.
3. Material hasil promosi selalu `PENDING`. Pending dan Approved dapat
   dipakai; Rejected berarti takedown dari pilihan baru.
4. SampleCandidate baru dapat dipromosikan setelah Material induknya tersedia
   dan dipilih secara tepat.
5. Status Sample keluar wajib memiliki nama peminjam/penerima. Kandidat yang
   bukan data sah ditandai `DISMISSED`, bukan dihapus.

Workbook review berformat ada di:

`outputs/019fb6c2-e3c1-7972-bde7-64e5e5e13cda/masterdata-seed-v2/masterdata-seed-review.xlsx`

## Validasi dan import

Validasi file tanpa akses database:

```powershell
node scripts/import-masterdata-seed.mjs --validate-only
```

Dry-run database lokal:

```powershell
node scripts/import-masterdata-seed.mjs --dry-run `
  --actor-email <email-user-nyata>
```

Apply memerlukan backup custom-format di luar project, SHA-256, verifikasi
`pg_restore --list`, actor nyata, dan acknowledgement:

```powershell
node scripts/import-masterdata-seed.mjs --apply `
  --actor-email <email-user-nyata> `
  --backup D:\path-di-luar-project\studioflow_before_masterdata_seed.dump `
  --backup-sha256 <SHA256> `
  --pg-restore-container <nama-container-postgres> `
  --ack-review
```

Gunakan `--pg-restore <path-executable>` sebagai pengganti
`--pg-restore-container` bila PostgreSQL client tersedia langsung di host.

Importer hanya menerima database `localhost`/`127.0.0.1`, menjalankan seluruh
write dalam satu transaksi, menulis AuditLog, dan memverifikasi jumlah Project,
Project Schedule Entry, serta Project Schedule Option tidak berubah.

Apply lokal yang sudah dilakukan:

- actor: `Raychie` (`OWNER`);
- hasil: 392 Vendor, 399 VendorContact, 1.010 VendorLink, 756
  MaterialCandidate, 287 SampleCandidate, 0 Material, dan 0 Sample;
- backup sebelum migration/seed kandidat:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_curation_queue_20260731_162105.dump`;
- backup SHA-256:
  `33A067D60B6095B8A770E74FDC691517E078FEFA3663017E708B22F7CA1BD86D`;
- dry-run sesudah apply: 0 create/enrich, seluruh payload menjadi reuse.

Kurasi Sheet1 yang sudah dilakukan setelah seed:

- actor: `berkah.rad@gmail.com` (`ADMIN`);
- hasil: 172 confirm+promote, 4 duplicate dismiss, 0 skip;
- MaterialCandidate akhir: 580 `PENDING`, 4 `DISMISSED`, 172 `PROMOTED`;
- Material/Sample akhir: 172/0;
- post-apply dry-run: 0 eligible dan 0 write.
