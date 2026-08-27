# Arsip — StudioFlow

**Dibuat 2026-08-10** saat seluruh isi `CHANGELOG.md` dan `roadmap.md`
diverifikasi ulang terhadap repo.

Isi folder ini **bukan acuan keadaan sekarang.** Ia disimpan untuk satu guna:
menjawab *"kenapa dulu diputuskan begitu"*. Kalau ada pertanyaan tentang keadaan
hari ini, jawabannya ada di `CHANGELOG.md`, `roadmap.md`, atau kodenya sendiri —
bukan di sini.

**Yang membuat sebagian besar isi folder ini usang sekaligus:** migrasi
`20260810180000_masterdata_v2_rebaseline` menjalankan
`DROP SCHEMA master_data CASCADE`. Setiap dokumen, skrip, dan entri changelog
yang menyebut `Company`, `Vendor`, `MaterialCatalog`, `MaterialCandidate`,
`SampleCandidate`, `MaterialPrice`, `ServicePrice`, `MaterialLaborPrice`, atau
kolom `catalog_*` / `vendor_id` merujuk tabel yang **tidak ada lagi**.

---

## Isi

### `bq-2026-08/` — dokumen BQ pra-konsolidasi (dipindah 2026-08-27)

PRD, plan, dan handoff BQ yang menggambarkan mesin sebelum BQ berpindah ke mode
koefisien murni. Empat di antaranya mengutip **AT-01**, gerbang angka yang
ternyata tidak pernah ada di kode. Lihat `bq-2026-08/README.md`.
Yang berlaku sekarang: `PRD-BQ.md`, `designbq.md`, `HANDOFF-BQ-R3.md` di root.



### Changelog

| Berkas | Cakupan |
|---|---|
| `CHANGELOG-2026-07-24_2026-08-06-masterdata-v1.md` | 44 entri — seluruh pembangunan Master Data v1 |
| `CHANGELOG-2026-04-16_2026-07-23-rilis-v1-v3.md` | 48 rilis bernomor v1.3.0 → v3.8.1 |

Ringkasan kanoniknya ada di `CHANGELOG.md` §Arsip — dibaca dulu sebelum membuka
berkas di atas.

### `roadmap-selesai-2026-08-10.md`

Item roadmap yang terverifikasi selesai atau usang pada 2026-08-10, beserta
**bukti verifikasinya**. Yang paling penting dicatat di sana: §M2, §A1–A5, dan
§C-SISA-1 masih tertulis *"belum diterapkan"* di roadmap padahal migrasinya sudah
jalan. Itu jenis kesalahan yang membuat orang mengerjakan ulang pekerjaan yang
sudah selesai.

### `migrations-masterdata-v2/`

Empat berkas SQL rombakan v2 + `README.md` + `backups/`. **Sudah dijalankan
2026-08-10**, dan isinya sudah disalin **verbatim** ke
`prisma/migrations/20260810180000_masterdata_v2_rebaseline/migration.sql`.

Diarsipkan karena duplikat, bukan karena tidak berguna. Yang **tetap berharga**
di dalamnya:

- `backups/backup-master_data-v1-20260810170136.dump` — satu-satunya salinan isi
  `master_data` v1. Kalau ada yang bertanya "dulu isinya apa", ini jawabannya.
- `backups/verify.sql` dan `backups/preflight-check.sql` — kueri verifikasi
  invariant yang masih relevan kalau schema v2 dicurigai melenceng.
- `README.md` — urutan eksekusi dan alasannya. **Perhatian:** berkas itu masih
  menulis *"Status: SIAP, belum dijalankan"*. Itu salah sejak 2026-08-10 17:01;
  dibiarkan apa adanya karena mengedit arsip berarti mengarang riwayat.

### `schema.masterdata-v2.prisma`

Draft schema v2. Sudah menjadi `prisma/schema.prisma` yang aktif — diarsipkan
sebagai duplikat.

### `prisma-migrations-v1-praRebaseline/`

Berkas migrasi Prisma sebelum rebaseline 5 Agustus. Dulu `prisma/migrations_archive/`.

### `docs-usang/`

Dokumen yang **nol** rujukan dari kode dan sudah tertimbun penggantinya:

| Berkas | Digantikan / kenapa mati |
|---|---|
| `CHANGELOG-CODEX.md` | Changelog paralel agen lain; berhenti 2026-08-03 |
| `PLAN-ROADMAP-MASTERDATA-LIBRARY.md` | Ia sendiri menyatakan menggantikan tiga plan lain; kini digantikan `docs/PLAN-MASTERDATA-V2.md` + `roadmap.md` §M |
| `PLAN-catalog-library-sync.md` | Dinyatakan digantikan oleh berkas di atas |
| `LIBRARY-REWORK-FINDINGS.md` | Temuan Library v1 |
| `MASTERDATA_HANDOFF.md`, `CODEX_PROMPT_MASTERDATA.md` | Handoff & prompt untuk pekerjaan v1 |
| `MASTERDATA_CSV_SEEDING_GUIDE.md` | Jalur seeding v1; owner memutuskan **tanpa seeding** |
| `MATERIAL_SSOT_RUNBOOK.md`, `ANALISA-MASTER-DATA-SKEMA.md` | Runbook & analisis schema v1 |
| `SKEMA-MASTER-DATA.xlsx` | Peta schema v1. `roadmap.md` sendiri sudah menandainya *"akan usang"* |
| `MasterData_Skema_Contoh.xlsx`, `MasterData_Schema_Reference.xlsx` | Referensi schema v1 |
| `STUDIOFLOW_UX_AUDIT.md` | Digantikan `AUDIT-UX-2026-08-10.md` |
| `audit.md` | Audit 15 Juni; temuannya sudah masuk `PLAN-AUDIT-ROADMAP-2026Q3.md` |
| `SKETCHUP_AGENT_HANDOFF.md` | Handoff 17 Juni |
| `studioflow_ssot_engineering.md` | SSOT v1.2 (15 Juni), digantikan `MASTER_SSOT.md` |
| `schema.prisma.intended` | Schema "yang dimaksud" 15 Juni; dua rebaseline lalu |
| `lint-errors.json` | Keluaran lint 15 Juni, 118 KB |

### `scripts-usang/`

Skrip yang **tidak bisa jalan lagi** karena memanggil delegate Prisma atau kolom
yang sudah di-`DROP`. Diverifikasi satu per satu, bukan diduga:

| Skrip | Yang membuatnya mati |
|---|---|
| `count-masterdata.mjs` | Kepalanya sendiri menulis *"schema master_data v1"* |
| `reset-masterdata.mjs` | Mendaftar 18 tabel v1 termasuk `Company`, `ServiceVendor`, `MaterialCandidate` |
| `move-brand-legal-name-to-company.mjs` | `Company` tidak ada — §A5 gugur bersamanya |
| `backfill-sku-categories.mjs` | Membaca kolom `catalog_tags` yang sudah hilang |
| `seed-brand-categories.mjs`, `curate-sheet1-sku-motif.mjs` | `prisma.materialCandidate` |
| `import-masterdata-{seed,list,samples}.mjs` | `prisma.vendor`, `prisma.sampleCandidate`, `prisma.sampleMovementLog` |
| `inspect-existing-masterdata.mjs`, `migrate-offerings-to-materials.mjs` | `prisma.vendor` |
| `backfill-catalog-{links,snapshots}.mjs`, `cleanup-echoed-snapshots.mjs` | One-off yang sudah dijalankan; menulis kolom `catalog_*` |
| `parse_errors.js` | Membaca `lint_report_fixed.json` yang tidak ada di repo |
| `setParallel.{js,sql}`, `checkParallel.sql` | `require('@prisma/client')` — client repo ini di `src/generated/prisma` |
| `verify_prep.js` | Verifikasi one-off dari era pooling Supabase |

### `src-mati/`

Berkas sumber **nol importer**, dipindahkan dari `src/`. Ini menutup §T1 dan §T4
roadmap, yang sebelumnya tertahan menunggu konfirmasi:

| Berkas | Digantikan oleh |
|---|---|
| `MasterDataSkusClient.tsx` | Route `/masterdata/skus` dihapus 2026-08-06 (T1) |
| `delete-button.tsx` | `RowActions` di `project-list-client.tsx` |
| `activity-list-today.tsx` | `TodayView` |
| `today-task-item.tsx` | `TaskRow` di `today-view.tsx` — importernya hanya `activity-list-today.tsx`, jadi keduanya mati sebagai pasangan |
| `dashboard.ts` | `src/types/task-feed.ts` |

Berkas-berkas ini dikeluarkan dari `tsconfig.json` dan `eslint.config.mjs`
(`exclude`/`globalIgnores` untuk `docs/archive`). Sengaja **tidak** dirapikan —
impornya rusak dan tipenya implisit, dan memperbaikinya berarti merawat kode yang
tidak dipakai. Kalau salah satunya ternyata masih dibutuhkan, kembalikan ke
`src/` lalu perbaiki di sana.

### `masterdata-v1-data/`

CSV sumber dan staging import Master Data v1 (`masterdata-seed/`,
`masterdata-import-staging/`, `masterdata-sample-staging/`).

**Tidak dibuang, dan ini alasannya:** `BUILD_SUMMARY.json` mencatat 392 brand,
399 kontak, 1010 link, 756 kandidat material, 287 kandidat sampel — semuanya
hilang saat `DROP SCHEMA`. CSV-nya adalah **satu-satunya** sumber pemulihan kalau
keputusan "mulai dari nol, tanpa seeding" berubah. Yang **tidak** ada di CSV, dan
memang tidak bisa dipulihkan dari mana pun: pengelompokan brand → badan usaha
(keputusan manusia lewat Backfill), seluruh harga yang diketik sejak 5 Agustus,
dan keputusan kurasi (`review_status`, `*_confirmed`, `decision_notes`).

---

## Yang **tidak** diarsipkan meski usang — dan kenapa

**Diperbarui 2026-08-18.** Tiga dokumen menggambarkan keadaan v1 tapi **tetap di
root**, karena komentar di kode menunjuk namanya. Memindahkannya membuat puluhan
komentar menunjuk berkas yang tidak ada — lebih buruk daripada berkas usang yang
bisa ditemukan. **Ketiganya sekarang diberi banner ⚠️ DOKUMEN USANG di
barisnya yang paling atas**, sehingga tidak bisa dibaca sebagai keadaan sekarang
tanpa sengaja.

| Berkas | Berkas `src/` yang merujuk | Catatan |
|---|---|---|
| `PLAN-AUDIT-ROADMAP-2026Q3.md` | 14 | Verifikasi ulang isinya dilacak sebagai **T3** di `roadmap.md` |
| `PLAN-LIBRARY-BRAND-FIRST.md` | 8 | §6.14 reuse pool masih dikutip `schedule-service.ts` |
| `UPSTREAM-BQ-MATERIAL-SOURCE.md` | 2 | Menggambarkan sumber material v1 |

`MASTER_SSOT.md` **sudah tidak** di daftar ini — lihat bagian berikutnya.

---

## Perapihan 2026-08-18

Alasan lengkapnya di `changelog.md` #24. Yang masuk arsip pada hari itu:

### `MASTER_SSOT-v1-2026-08-18.md`

Isi asli `MASTER_SSOT.md` (947 baris). Pemeriksaan menemukan isinya
**seluruhnya v1**: nol sebutan `Party`, `SkuPrice`, atau `WorkPrice`, sementara
`ProductCatalog.catalog_brand`, `Vendor.brand_name`, dan antrean promosi masih
ditulis sebagai keadaan sekarang.

Ia diarsipkan alih-alih dibiarkan karena **namanya sendiri menyuruh orang
mempercayainya** — dan `AGENTS.md` aturan 1, 2, dan 4 dulu memerintahkan setiap
agent memvalidasi pekerjaannya terhadap berkas ini. Sumber kebenaran yang salah
lebih berbahaya daripada dokumen usang yang jelas bertanggal lama.

Di root tersisa `MASTER_SSOT.md` berisi **penunjuk arah saja** (51 baris),
supaya lima komentar `src/` yang mengutip "§5.7", "§6.2", "§6.12", dan
"§8 Issue 7" tetap mendarat di sesuatu yang menjelaskan. Nomor-nomor bagian itu
hanya berlaku untuk versi arsip.

**Penggantinya:** `AGENTS.md` §🧱 Master Data Contract (v2) + `prisma/schema.prisma`.

### `roadmap-2026-08-18-sebelum-perapihan.md`

`roadmap.md` verbatim sebelum dipangkas dari **2.268 → 546 baris**. Tidak ada
item yang dibuang tanpa jejak: seluruh riwayat, analisis arsitektur, catatan
keputusan, dan item selesai ada di sini.

Yang dipangkas dari versi aktif bukan isinya, melainkan **rasionya** — roadmap
yang 90% berisi centang membuat yang belum dikerjakan mustahil ditemukan, dan
bagian "SELESAI" lama-lama dibaca sebagai rencana.

Tiga item **dicabut** karena premisnya sudah tidak ada (keadaan sekarang lebih
benar daripada yang diminta roadmap) — daftarnya di `roadmap.md` §DICABUT.

### `PLAN-APP-SPLIT.md` · `AUDIT-UX-2026-08-10.md` · `REVIEWUIUX.md`

Nol rujukan dari `src/`. Isinya yang masih berlaku sudah diserap ke `roadmap.md`:
`PLAN-APP-SPLIT.md` §R5 → item A6 dan B1; `AUDIT-UX-2026-08-10.md` → item D2, D3,
D5; `REVIEWUIUX.md` → item UI-CON-2/3/4.
