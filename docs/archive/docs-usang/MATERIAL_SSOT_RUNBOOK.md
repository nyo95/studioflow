# Runbook — Material SSOT Consolidation

Urutan menjalankan konsolidasi. **Saya tidak bisa menjalankan ini** — database `localhost:5432` hanya terjangkau dari mesin Anda. Jalankan berurutan; berhenti kalau ada langkah yang tidak sesuai harapan.

Referensi: `MASTER_SSOT.md` §6.8 (kenapa merge), §6.10 (apa yang berubah).

---

## 0. Sebelum mulai — kondisi yang diharapkan

```
master_data.Vendor            397
master_data.VendorContact     401
master_data.VendorOffering    483
studioflow.ProductCatalog       5   (akan pindah ke master_data)
studioflow.PhysicalSample     287
```

## 1. Backup, dan buktikan backup-nya terbaca

Jangan lewati. Migration ini memindahkan tabel antar-schema.

```bash
docker run --rm -v "%CD%\backups:/out" postgres:17-alpine pg_dump \
  "postgresql://postgres:PASSWORD@host.docker.internal:5432/studioflow" \
  -Fc -f /out/studioflow_pre_material_ssot_$(date +%Y%m%d_%H%M%S).dump
```

Lalu hitung SHA-256-nya — dipakai di langkah 4:

```powershell
Get-FileHash .\backups\studioflow_pre_material_ssot_*.dump -Algorithm SHA256
```

**Verifikasi backup benar-benar bisa dibaca**, bukan cuma ada filenya:

```bash
docker run --rm -v "%CD%\backups:/out" postgres:17-alpine \
  pg_restore --list /out/studioflow_pre_material_ssot_*.dump | head -20
```

## 2. Terapkan migration struktur

```bash
npx prisma migrate deploy
npx prisma generate
```

Pakai `deploy`, **bukan** `migrate dev` atau `migrate reset` — keduanya bisa memicu hook seed yang sudah difence-off.

**Cek hasilnya sebelum lanjut:**

```sql
-- ProductCatalog harus sudah pindah, isinya tetap 5
SELECT table_schema, COUNT(*) FROM information_schema.tables
WHERE table_name = 'ProductCatalog' GROUP BY table_schema;
SELECT COUNT(*) FROM master_data."ProductCatalog";

-- kolom baru ada, sku/color sudah nullable
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_schema='master_data' AND table_name='ProductCatalog'
  AND column_name IN ('catalog_sku','catalog_color','catalog_vendor_price',
                      'catalog_price_unit','source_offering_id');

-- tabel harga jasa ada dan kosong
SELECT COUNT(*) FROM master_data."ServicePrice";
```

Kalau `ProductCatalog` masih 5 baris dan `is_nullable = YES` untuk sku/color, struktur beres.

## 3. Dry-run migrasi data

```bash
node scripts/migrate-offerings-to-materials.mjs --dry-run \
  --actor-email <email-akun-nyata>
```

**Yang harus Anda baca di output:**

| Field | Harapan |
|---|---|
| `actions.materials.insert` | 483 dikurangi jumlah blocker |
| `actions.materials.reuse` | 0 pada run pertama |
| `actions.auditLogs.insert` | sama persis dengan `materials.insert` |
| `blockers` | daftar kosong, atau baris dengan alasan jelas |

Blocker yang mungkin muncul dan artinya:

- `vendor soft-deleted` — supplier-nya sudah diarsipkan. Menghidupkannya kembali itu keputusan kurasi, bukan efek samping migrasi. Putuskan manual.
- `category_raw kosong` — `catalog_category` `NOT NULL`, tidak bisa diisi tebakan.

Baris yang diblokir **tidak** dimigrasi dan tidak menggagalkan sisanya.

## 4. Apply

```bash
node scripts/migrate-offerings-to-materials.mjs --apply \
  --actor-email <email-akun-nyata> \
  --backup .\backups\studioflow_pre_material_ssot_<stamp>.dump \
  --backup-sha256 <HASH-DARI-LANGKAH-1> \
  --ack-review
```

Satu transaksi. Gagal di tengah = rollback penuh, tidak ada baris separuh jalan.

## 5. Buktikan idempoten

Jalankan dry-run sekali lagi:

```bash
node scripts/migrate-offerings-to-materials.mjs --dry-run --actor-email <email>
```

**Harus** menunjukkan `insert: 0` dan `reuse: 483`. Kalau masih ada insert, `source_offering_id` tidak tersimpan — berhenti dan laporkan.

## 6. Cek akhir

```sql
SELECT COUNT(*) FROM master_data."ProductCatalog";              -- 488
SELECT COUNT(*) FROM master_data."ProductCatalog"
  WHERE source_offering_id IS NOT NULL;                          -- 483
SELECT COUNT(*) FROM master_data."VendorOffering";               -- 483, tidak berubah
SELECT catalog_status, COUNT(*) FROM master_data."ProductCatalog"
  GROUP BY catalog_status;                                       -- 483 PENDING + status lama

-- tidak boleh ada placeholder yang lolos
SELECT COUNT(*) FROM master_data."ProductCatalog"
  WHERE catalog_sku IN ('N/A','-','UNKNOWN') OR catalog_sku LIKE 'LEGACY-%';  -- 0
```

Lalu di aplikasi: buka `/masterdata/materials`. Total harus 488 dengan 5 SKU dan 483 Offering, dan **tidak ada baris ganda** — kalau ada duplikat, filter `source_offering_id` tidak jalan.

---

## Kalau harus dibatalkan

```bash
docker run --rm -v "%CD%\backups:/out" postgres:17-alpine pg_restore \
  --clean --if-exists -d "postgresql://postgres:PASSWORD@host.docker.internal:5432/studioflow" \
  /out/studioflow_pre_material_ssot_<stamp>.dump
```

Restore mengembalikan struktur **dan** data ke kondisi sebelum langkah 2, termasuk `ProductCatalog` kembali ke schema `studioflow`.

---

## Setelah ini beres — yang masih terbuka

1. **287 sample fisik semuanya `product_id = NULL`.** Menghubungkannya ke material perlu pencocokan Brand + Tipe + Motif terhadap SKU yang ada. Belum ada script-nya, dan tidak boleh ditebak otomatis.
2. **`catalog_price_unit` kosong di semua baris.** BQ tidak bisa menghitung tanpa satuan. `/masterdata/prices` menampilkan hitungannya sebagai peringatan.
3. **`ServicePrice` kosong.** Diisi manual — tidak ada sumber tarif jasa di workbook.
4. **Role PostgreSQL per subapp + `GRANT` per schema belum diterapkan.** Isolasi masih di level aplikasi, belum di level database.
5. **`MASTERDATA_*` belum jadi otoritas penegak** (§6.2 poin 8) — masih `LIBRARY_*`.
# ARSIP — JANGAN DIJALANKAN

Kontrak ini telah diganti oleh
`docs/MASTERDATA_CSV_SEEDING_GUIDE.md`. Istilah Offering, Material tanpa SKU,
dan Sample tanpa Material tidak lagi valid.
