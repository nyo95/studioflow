# Migrasi Master Data v2 — siap dijalankan

**Status:** SIAP, belum dijalankan. Butuh mesin yang punya database.
**Dasar:** `docs/PLAN-MASTERDATA-V2.md` · keputusan owner 2026-08-10

Folder ini **sengaja bukan** `prisma/migrations/`. Selama `schema.prisma` masih
memuat 18 model `master_data` v1, menaruh migrasi ini di sana akan membuat
`prisma migrate` melihat drift dan menawarkan reset. Pemindahannya jadi migrasi
Prisma resmi ada di §Setelah.

---

## Prasyarat

1. **Backup dulu**, sekalipun keputusannya "drop aja".
   ```bash
   pg_dump -n master_data -Fc studioflow > backup-master_data-v1.dump
   ```
   Bukan untuk dipulihkan — untuk bisa menjawab "dulu isinya apa" kalau ada yang
   bertanya bulan depan. Ongkosnya satu perintah.

2. **Tidak ada yang memakai app** saat langkah 01–02 jalan. `DROP SCHEMA`
   membatalkan setiap query yang sedang menyentuhnya.

3. **Role terpisah per app** untuk langkah 04 bagian `GRANT`. Kalau sekarang
   StudioFlow, Master Data, dan BQ memakai satu user Postgres yang sama, bagian
   itu tidak bisa dijalankan apa adanya — dan itu **temuan tersendiri**, bukan
   alasan melewatinya. View-nya tetap dibuat; penegakannya menyusul.

---

## Urutan

Jalankan berurutan. Tiap berkas satu transaksi; berhenti di berkas yang gagal.

```bash
DB="postgresql://postgres:password@localhost:5432/studioflow"

psql "$DB" -v ON_ERROR_STOP=1 -f prisma/migrations-masterdata-v2/01_drop_master_data_v1.sql
psql "$DB" -v ON_ERROR_STOP=1 -f prisma/migrations-masterdata-v2/02_create_master_data_v2.sql
psql "$DB" -v ON_ERROR_STOP=1 -f prisma/migrations-masterdata-v2/03_invariants.sql
psql "$DB" -v ON_ERROR_STOP=1 -f prisma/migrations-masterdata-v2/04_views_and_grants.sql
```

`-v ON_ERROR_STOP=1` tidak boleh dilepas: tanpanya `psql` melanjutkan setelah
error dan menghasilkan schema setengah jadi yang terlihat berhasil.

| Berkas | Isi | Kalau dilewati |
|---|---|---|
| `01_drop_master_data_v1.sql` | Lepas 5 FK dari `studioflow` secara eksplisit, lalu `DROP SCHEMA master_data CASCADE` | — |
| `02_create_master_data_v2.sql` | 18 tabel + 10 enum + index. **Dihasilkan `prisma migrate diff`**, jangan diedit tangan | — |
| `03_invariants.sql` | Partial index, generated column, GIN, pg_trgm, COMMENT | ⚠️ **Empat aturan rancangan tidak ditegakkan apa pun, dan `prisma validate` tetap hijau** |
| `04_views_and_grants.sql` | 3 view kontrak + `GRANT`/`REVOKE` (dikomentari) | Konsumen membaca tabel langsung; SSOT-nya kembali jadi kesepakatan |

**Langkah 3 yang paling mudah terlewat** — ia tidak menghasilkan apa pun yang
terlihat, dan semua tool bilang sukses tanpanya.

---

## Yang hilang, dan itu disengaja

Keputusan owner 2026-08-10: *"DROP AJA — data kita mulai dari 0, gausa di
seeding."*

392 Brand · 399 kontak · 1010 link · 756 MaterialCandidate · 287 SampleCandidate
· seluruh Company hasil backfill · semua harga yang diketik sejak 5 Agustus.

Sumber pemulihannya tetap ada di repo (`docs/masterdata-seed/*.csv`,
`docs/RAD - Material + Supplier.xlsx`) kalau keputusannya berubah — tapi jalur
seeding **tidak dijalankan**, dan `05_seed.sql` sengaja tidak ada.

`ProjectScheduleOption.sku_id`, `spec_brand_id`, dan tiga kolom serupa di
`ProjectProductRequest` **tetap ada sebagai kolom**; hanya FK-nya yang lepas.
Isinya akan menunjuk baris yang tidak ada lagi — dan itu tidak apa-apa, karena
`data_snapshot` sudah membekukan isi produknya saat dipilih.

---

## Verifikasi

Enam uji. Nomor 4 yang paling penting: kalau ia **lolos**, langkah 04 tidak jalan
dan seluruh kontrak SSOT hanya dokumentasi.

```sql
-- 1. Dua harga "berlaku" untuk pasangan (sku, supplier) yang sama → DITOLAK
-- 2. Dua kategori is_primary untuk satu SKU → DITOLAK
-- 3. UPDATE material_price → total_price ikut berubah tanpa disentuh
-- 4. Sebagai studioflow_app: SELECT * FROM master_data."Sku" → DITOLAK
-- 5. SELECT * FROM master_data.v_library_brand → tepat 9 kolom, tanpa satu pun
--    kolom produk/harga/kontak/sampel
-- 6. Kind di kolom `links` tidak memuat PRICE_LIST, MARKETPLACE, WHATSAPP
```

Uji 1–3 bisa dijalankan siapa saja. Uji 4 butuh role `studioflow_app` (lihat
Prasyarat 3); kalau rolenya belum ada, **catat sebagai belum diuji** — jangan
ditandai lulus.

---

## Setelah migrasi berhasil

Barulah `schema.prisma` disentuh, dan urutannya penting:

1. Ganti 18 model `master_data` v1 di `prisma/schema.prisma` dengan isi
   `schema.masterdata-v2.prisma` (tanpa blok `generator`/`datasource`-nya)
2. Ubah 5 relasi lintas schema jadi kolom `String?` polos, dan tambahkan
   `brand_name_snapshot` + `sku_name_snapshot` di `ProjectProductRequest` —
   ia belum punya snapshot, tidak seperti `ProjectScheduleOption`
3. `npx prisma migrate resolve --applied <nama-migrasi-baseline>` supaya riwayat
   migrasi cocok dengan keadaan database, **tanpa** menjalankan ulang SQL-nya
4. `npx prisma generate`
5. `npx prisma migrate status` → harus bersih

Langkah 3 yang biasanya salah: menjalankan `migrate dev` di sini akan mencoba
membuat ulang tabel yang sudah ada.

**Setelah itu app tidak akan kompilasi** — `library-service.ts` (48 pembacaan,
20 penulisan), `extensions/library/types.ts`, dan `settings-service.ts` semuanya
menyebut nama kolom v1. Itu §M3 dan §M4 di roadmap, bukan bagian migrasi ini.
