# Physical Sample Import Staging — `Sheet1`

**Sumber:** `docs/RAD - Material + Supplier.xlsx`  
**Sheet:** `Sheet1`  
**Checksum SHA-256:** `1AB11BD57893424EA226135F670197B31B96B861BA05C0C4962AF5BC8D0FBCEE`

## Keputusan pemetaan

- Satu baris workbook adalah satu benda sample fisik. Baris dengan identitas
  material yang sama **tidak digabung**, karena bisa berada sebagai unit fisik
  yang berbeda.
- `Lokasi` → `catalog_rack_number`; `Container box` →
  `catalog_box_number`.
- `Nama` kosong → `AVAILABLE`; `Nama` terisi → `BORROWED` dan nilainya
  disimpan persis sebagai `current_borrower_name`.
- `Keterangan` disimpan persis sebagai catatan. Nama proyek seperti
  `Sociolla garut` tidak ditebak atau dinormalisasi.
- `Jenis`, `Brand`, `Tipe`, dan `Motif` disimpan sebagai identitas sumber pada
  `PhysicalSample`. Semua row masuk dengan `product_id = NULL`.
- Tidak dibuat SKU, warna, image, vendor, atau movement log palsu.

## Rekonsiliasi

- 287 sample: 270 available dan 17 borrowed.
- 25 nomor sumber kosong, 9 brand kosong, 1 tipe kosong, dan 144 motif kosong.
- 14 kelompok identitas berulang dipertahankan sebagai unit sample terpisah.
- Semua 287 baris mempunyai `Jenis`, lokasi rak, dan nomor box.
- Tidak ada blocker. Kekosongan di atas adalah fakta sumber, bukan kesalahan yang
  diperbaiki dengan tebakan.

## Berkas

- `01_physical_samples.csv` — payload yang sudah direkonsiliasi baris demi baris
  dengan workbook.
- `BUILD_SUMMARY.json` — angka kontrol dan checksum sumber.
- `scripts/import-masterdata-samples.mjs` — dry-run/apply yang hanya menerima
  database lokal, backup terverifikasi, review acknowledgement, dan actor User
  nyata.
# ARSIP SUMBER — BUKAN PAYLOAD SEED

Sample sekarang hanya boleh dibuat untuk benda fisik yang telah diterima dan
match tepat ke satu Material. Ikuti `docs/MASTERDATA_CSV_SEEDING_GUIDE.md`.
