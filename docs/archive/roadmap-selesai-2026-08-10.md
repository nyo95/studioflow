# Arsip Roadmap — item selesai / usang per 2026-08-10

Dipindahkan dari `roadmap.md` setelah seluruh klaimnya **diperiksa ulang terhadap
repo**, bukan dipercaya apa adanya.

**Temuan utama pemeriksaan ini, dan alasan berkas ini ada:** roadmap masih
menulis *"belum diterapkan"* untuk §M2, §A1, dan §C-SISA-1 — padahal ketiga set
migrasinya **sudah jalan**. Buktinya ada di `prisma/migrations/`:
`20260810180000_masterdata_v2_rebaseline` dan
`backups/backup-master_data-v1-20260810170136.dump` (17:01 hari itu).

Roadmap yang mengatakan sesuatu belum dikerjakan padahal sudah adalah kesalahan
yang mahal ke satu arah tertentu: ia menyuruh orang mengerjakan ulang, dan dalam
kasus §M2 pekerjaan itu berisi `DROP SCHEMA master_data CASCADE`.

Alat verifikasi yang dipakai: `ls prisma/migrations/`, `grep` ke `schema.prisma`
dan `src/`, `npx tsc --noEmit` (0 error), `npm test` (50 lulus).
**Tidak** diverifikasi: keadaan database nyata — `DATABASE_URL` menunjuk
`localhost:5432` di mesin owner, tidak terjangkau dari lingkungan pemeriksaan.
Semua pernyataan di bawah adalah tentang **kode dan berkas migrasi**, bukan
tentang isi Postgres.

---

## §M1. Konfirmasi 23 pertanyaan terbuka — SELESAI

Sudah bertanda ✅ di roadmap sejak 2026-08-10. Seluruh 23 pertanyaan di
`docs/TANYA-SEBELUM-EKSEKUSI.md` dijawab; empat keputusan yang paling mengubah
bentuk (drop tanpa seeding · Schedule tidak boleh baca Master Data · pemisahan
`Sku`/`SkuPrice` · kategori sebagai pohon) sudah masuk rancangan v2.

**Verifikasi:** `docs/TANYA-SEBELUM-EKSEKUSI.md` dan
`docs/PENYIMPANGAN-DARI-EXCEL.md` ada dan terisi. Keduanya **tetap di
`docs/`** — masih dirujuk 7 komentar di `src/`.

---

## §M2. Migrasi Master Data v2 — SUDAH DIJALANKAN

Roadmap menulis *"✅ SQL SIAP, tinggal dijalankan"*. **Sudah dijalankan.**

| Bukti | Isi |
|---|---|
| `prisma/migrations/20260810180000_masterdata_v2_rebaseline/migration.sql` | 1060 baris — gabungan verbatim `01`–`04`, ditandai applied lewat `prisma migrate resolve --applied` |
| `docs/archive/migrations-masterdata-v2/backups/backup-master_data-v1-20260810170136.dump` | Backup pra-drop, 2026-08-10 17:01 |
| `prisma/schema.prisma` | 18 model `master_data` v2 (`Party`, `PartyRole`, `Sku`, `SkuPrice`, `WorkPrice`, `Sample`, …) + 10 enum |
| Nol model v1 | `grep '^model Company\|^model Vendor\|^model MaterialCatalog\|^model MaterialCandidate\|^model MaterialPrice\|^model ServicePrice'` → kosong |
| Tiga view kontrak | `CREATE VIEW master_data.v_library_brand` (baris 838), `v_bq_material_rate` (906), `v_bq_work_rate` (964) |

**Yang belum, dan sengaja:** blok `GRANT`/`REVOKE` di baris 1029–1044 masih
**dikomentari**. Itu bukan kelalaian migrasi — ia butuh role Postgres terpisah
per app yang belum ada. Konsekuensinya dipindahkan ke `roadmap.md` §M4 langkah 4,
bukan dianggap selesai bersama §M2.

---

## §M5. Lepas lima FK lintas schema — SELESAI (diserap M2)

`01_drop_master_data_v1.sql` melepas kelimanya secara eksplisit sebelum
`DROP SCHEMA`, dan berkas itu sudah ikut dijalankan sebagai bagian rebaseline.

Roadmap sudah menandainya diserap; diarsipkan karena tidak ada lagi yang bisa
dikerjakan di sana.

**Konsekuensi yang tercatat dan masih berlaku:** `onDelete: SetNull` hilang, jadi
`ProjectScheduleOption.sku_id` bisa menggantung. Itu aman karena `data_snapshot`
sudah membekukan isi produk pada saat dipilih — schedule proyek berjalan memang
harus menampilkan apa yang dipilih dulu, bukan apa yang ada sekarang.

Sisanya (`ProjectProductRequest` butuh snapshot) **sudah tertutup** oleh
`20260810190000_add_product_request_snapshots`: kolom `brand_name_snapshot` dan
`sku_name_snapshot` ada di `schema.prisma` dan migrasinya diterapkan.

---

## §A1. Aktifkan SkuCategory — SELESAI

| Klaim roadmap | Keadaan nyata |
|---|---|
| "kode siap, migrasi siap, belum diterapkan" | `prisma/migrations/20260806120000_add_sku_category/` **ada di riwayat resmi** |
| — | `model SkuCategory` ada di `schema.prisma:447`, lengkap dengan `is_primary`, `@@unique([sku_id, category_id])` |

Model ini juga lahir ulang sebagai bagian schema v2, jadi ia ada dua kali
alasannya. `scripts/backfill-sku-categories.mjs` diarsipkan — ia membaca kolom
`catalog_tags` yang sudah tidak ada.

---

## §A2. Alihkan pembacaan kategori dari `catalog_tags` ke `SkuCategory` — SELESAI

`catalog_tags` **bukan kolom database lagi**. Satu-satunya kemunculannya di
`schema.prisma` adalah komentar basi di baris 918 yang masih menyebut
*"roadmap A1–A3"* — itu diperbaiki bersamaan dengan pengarsipan ini.

Nama `catalog_tags` masih muncul 93 kali di `src/`, dan itu **bukan sisa yang
belum dibereskan**: ia sekarang field DTO turunan, bukan kolom. Buktinya
`src/extensions/library/types.ts:163`:

```ts
catalog_tags: sku.categories.map((c) => c.category.name),
```

Artinya pembacaannya **sudah** lewat `SkuCategory` — persis yang diminta A2.
Namanya dipertahankan supaya call site di Schedule dan SketchUp tidak ikut
berubah.

---

## §A3. Hapus kolom `catalog_tags` — SELESAI

Terjadi sebagai efek samping `DROP SCHEMA master_data CASCADE`. Kekhawatiran
roadmap (*"menghapusnya lebih awal mematikan pencarian Library"*) tidak terwujud
karena A2 sudah lebih dulu berpindah ke `sku.categories`.

---

## §A4. Pembersihan `BrandCategory` basi — SELESAI

Roadmap meminta *"cara membedakan asal baris lebih dulu — misalnya kolom
`source` (`SEED` / `DERIVED_FROM_SKU`)"*.

Kolom itu **ada** di `schema.prisma:435`:

```prisma
source CategorySource @default(DERIVED_FROM_SKU)
```

Enum `CategorySource` dideklarasikan di baris 744. Prasyaratnya terpenuhi.

**Yang belum, dan bukan lagi pekerjaan A4:** rekonsiliasi yang *memakai* kolom
itu — menghapus baris `DERIVED_FROM_SKU` yang tag SKU-nya sudah dilepas, tanpa
menyentuh baris `SEED`. Itu dipindahkan ke `roadmap.md` sebagai §A4b, karena ia
pekerjaan tersendiri dan tidak lagi menunggu migrasi.

---

## §A5. Backfill Perusahaan (P3) — GUGUR

Seluruh isinya bergantung pada model `Company`, yang tidak ada lagi. Badan usaha
sekarang hidup di `Party` — satu entitas dengan dua nama (dagang + hukum), sesuai
keputusan X6.

Perkakasnya (`scripts/move-brand-legal-name-to-company.mjs`) diarsipkan.

**Yang hilang bersamanya, dan layak diingat:** pengelompokan brand → badan usaha
adalah keputusan manusia, dan keputusan itu **tidak ada di CSV mana pun**. Kalau
Master Data v2 kelak diisi ulang dari `docs/archive/masterdata-v1-data/`,
pengelompokan itu harus dikerjakan lagi dari nol.

---

## §C-SISA-1. Terapkan migrasi task — SELESAI

| Migrasi | Status |
|---|---|
| `20260810120000_checklist_tasks` | ada di `prisma/migrations/` |
| `20260810140000_activity_due_date` | ada di `prisma/migrations/` |
| `20260806120000_add_sku_category` (A1) | ada di `prisma/migrations/` |

Ketiganya ada di riwayat resmi Prisma. Yang **tidak bisa diverifikasi dari sini**:
apakah dua langkah backfill di dalam `checklist_tasks` (`template_id` lewat label,
`sort_order` = `ROW_NUMBER() × 10`) menghasilkan baris `template_id IS NULL` yang
perlu dirapikan manual. Itu butuh DB, dan dipindahkan ke `roadmap.md` §C-SISA-2
sebagai pemeriksaan, bukan sebagai penerapan.

---

## §C-SISA-4. Halaman `/todo` lintas proyek — SELESAI

Sudah bertanda selesai di roadmap. Terjawab oleh Today's View: semua proyek yang
dipegang, dengan atau tanpa task, kecuali COMPLETED; toggle My / All untuk admin.

**Batas yang tetap perlu diawasi dipertahankan di `roadmap.md`**, tidak ikut
diarsipkan — `applyChecklistFilter` menyaring di memori, dan tuas yang benar
kalau itu terasa berat adalah memindahkan filter ke SQL + paginasi per proyek,
bukan menyembunyikan baris template.

---

## §D1. Jaring pengaman — SELESAI

`error.tsx` dan `not-found.tsx` di `(dashboard)` dan `projects/[id]`,
`loading.tsx` untuk `/projects`, `/projects/[id]`, `phases/[phaseId]`.
`projects/[id]/layout.tsx` memanggil `notFound()` alih-alih merender shell
berjudul "Project Not Found".

---

## §D4. Bahasa UI ke Inggris — SELESAI UNTUK STUDIOFLOW

Judul, deskripsi, tab, empty state, label menu, placeholder, toast, dan dialog di
seluruh StudioFlow seragam Inggris; format tanggal `id-ID` → `en-GB`;
`activity-copy.ts` ditulis ulang beserta test-nya.

**Master Data belum**, dan itu memang rencananya — ia dilewati supaya
penerjemahannya terjadi sekali saat rombakan, bukan dua kali. Diverifikasi masih
berbahasa Indonesia di 10 komponen (`CompanyClient.tsx`, `HargaClient.tsx`,
`MasterDataMaterialsClient.tsx`, dan seterusnya). Karena itu **§D4 tidak
sepenuhnya diarsipkan** — sisa Master Data-nya dipindahkan ke `roadmap.md` §M3,
tempat pekerjaannya sebenarnya berada.

---

## §T1 dan §T4. Berkas mati — SELESAI (dipindahkan)

Kelima berkas diverifikasi nol importer dengan `grep` pada specifier impor yang
sebenarnya (`from "@/..."`), bukan pada nama berkas — perbedaan yang penting,
karena `grep dashboard` menghasilkan 25 hasil palsu dari route group
`(dashboard)`.

| Berkas | Importer |
|---|---|
| `src/subapps/master-data/components/MasterDataSkusClient.tsx` | 0 |
| `src/components/delete-button.tsx` | 0 |
| `src/components/activity-list-today.tsx` | 0 |
| `src/components/today-task-item.tsx` | 1 — hanya `activity-list-today.tsx`, yang juga mati |
| `src/types/dashboard.ts` | 0 |

Dipindahkan ke `docs/archive/src-mati/`. `npx tsc --noEmit` **0 error** dan
`npm test` **50 lulus** sesudahnya — yang membuktikan tidak ada yang
mengimpornya.

---

## §Riwayat dan §Uji dari data kosong — USANG

**§Riwayat** meringkas pekerjaan Master Data 2026-08-06 (perombakan UI Supplier,
16 cacat C1–C16, perkakas backfill P3). Seluruhnya di schema v1. Ringkasannya
sudah ada di `CHANGELOG.md` §Arsip.

**§Uji dari data kosong** memberi 5 langkah uji manual yang menyebut
`+ Perusahaan`, `MaterialPrice`, `catalog_tags`, dan
`reset-masterdata.mjs --apply`. Tidak satu pun masih ada. Skenario uji baru untuk
UI v2 harus ditulis dari nol setelah §M3 — dicatat di `roadmap.md` §M6.
