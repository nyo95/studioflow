# Master Data Import Staging — `List` sheet

**Dibangun:** 30 Juli 2026 · **Sumber:** `docs/RAD - Material + Supplier.xlsx`
**Checksum:** `1AB11BD57893424EA226135F670197B31B96B861BA05C0C4962AF5BC8D0FBCEE` (diverifikasi ulang saat build — lihat `build_masterdata_staging.py`)
**Lingkup paket ini:** HANYA sheet `List` → `master_data.Vendor` / `VendorContact` / `VendorOffering`. `Sheet1` kemudian diproses melalui paket terpisah `docs/masterdata-sample-staging` dan migration `20260730210000_add_unlinked_physical_sample_intake`.

## Status

**Sudah diterapkan ke database lokal pada 30 Juli 2026.** Migration `20260730183500_split_master_data_and_add_vendor_offering` dan importer `scripts/import-masterdata-list.mjs` sudah dijalankan setelah backup di-restore-test. Dry-run setelah apply menghasilkan nol write.

Hasil: 397 total vendor, 401 kontak, 483 offering, dan 1.279 audit log import. `ProductCatalog` tetap 4 dan `PhysicalSample` tetap 0.

## File

1. `01_vendors.csv` — 395 vendor unik. 1 (`EDL`) match existing database, sisanya baru.
2. `02_vendor_contacts.csv` — 401 kontak. 310 di antaranya `contact_person` = label departemen (tidak ada nama orang di sumber, sesuai keputusan pemilik data).
3. `03_vendor_offerings.csv` — 483 offering (1:1 dengan baris List). 460 aktif, 23 diarsipkan (Jess Check merah).
4. `04_import_review.csv` — 0 blocker, 26 warning, 24 info. Wajib dibaca sebelum importer ditulis.
5. `BUILD_SUMMARY.json` — angka ringkas, machine-readable.
6. `build_masterdata_staging.py` — script pembangun, idempotent, read-only terhadap workbook.

## Keputusan yang sudah diterapkan

- **Jess Check enam-state** (bukan boolean): HIJAU=verified (433 baris), MERAH=inactive, MERAH-TUA=unreachable, PEACH=uncertain, PUTIH=unverified, dan tanpa-fill=unverified. Hanya HIJAU dapat `curated_by="Jessica"`.
- **15 baris tanpa Product** tetap jadi Vendor + VendorOffering (karena semuanya punya Category) — bukan vendor-only kosong, dan bukan ProductCatalog.
- **Alias**: hanya `Mozza` muncul di `List` (row 287, data lengkap). `Niro`/`Roman` alias murni di `Sheet1` — dicatat di `MASTER_SSOT.md` §6.4 untuk jalur Sheet1 nanti, tidak relevan di staging ini.
- **`EDL`** match vendor existing → `action=MATCH_EXISTING_FILL_BLANKS_ONLY`. Importer wajib isi field kosong saja, tidak boleh timpa field terisi. Jalankan `scripts/inspect-existing-masterdata.mjs` dulu untuk lihat field mana yang sudah terisi di database sebelum importer jalan.
- **Kolom "Contact" bermakna ganda** (role ATAU nama orang, 364/483 baris murni role tanpa nama). Keputusan pemilik: `contact_person` diisi = kata departemen itu sendiri — bukan karangan, literal dari sumber.
- **Nomor telepon** selalu teks. Multi-nomor dalam satu sel digabung `"; "`, tidak pernah di-parse jadi angka (nol di depan aman).
- **Tidak ada tanggal verifikasi** di sumber → `verified_at` selalu kosong.
- **Tidak ada kolom harga** sama sekali di `List` — tidak relevan untuk staging ini.

## Yang masih terbuka

- 3 baris multi-line Category/Product diflag `MULTI_VALUE_PRODUCT` di review file, tidak dipecah otomatis.
- 21 field vendor dengan nilai bentrok antar baris source diflag `VENDOR_FIELD_CONFLICT` — dipilih nilai paling sering lalu paling awal, tapi nilai lain tidak hilang (ada di `source_rows`).
- `Sheet1` tidak termasuk transaksi importer ini; import sample fisik lanjutannya tercatat di `MASTER_SSOT.md` §6.6.
- Role/login PostgreSQL per subapp dan `GRANT` schema belum diterapkan.
# ARSIP SUMBER — BUKAN PAYLOAD SEED

Baca ulang file ini mengikuti `docs/MASTERDATA_CSV_SEEDING_GUIDE.md`; jangan
menjalankan importer lama.
