# PLAN — Pemisahan Dua Aplikasi (StudioFlow ⟂ Contractor App)

> ## ⛔ DIBATALKAN — 31 Juli 2026
>
> **Digantikan oleh [`PLAN-LIBRARY-BRAND-FIRST.md`](./PLAN-LIBRARY-BRAND-FIRST.md).**
>
> Owner membatalkan pemisahan repo/database: satu repo, satu database, tiga schema
> seperti sekarang. Pemisahan aplikasi bersifat **logis** (permission + irisan data),
> bukan infrastruktur. Nama aplikasi biaya ditetapkan **CostFlow**.
>
> Dokumen ini disimpan hanya sebagai catatan: inventaris titik-titik coupling di §2–§4
> masih akurat dan berguna, dan roadmap StudioFlow di §5 tetap berlaku. **Jangan
> jalankan urutan eksekusi §4** — hampir semua langkah destruktifnya sudah tidak
> berlaku (`app-access.ts`, matriks app-access, `multiSchema`, role
> STAFF/CURATOR/ESTIMATOR semuanya tetap hidup).

**Status:** DIBATALKAN. Tidak ada kode/migrasi yang dieksekusi.
**Tanggal:** 31 Juli 2026
**Keputusan owner yang memicu dokumen ini:** monorepo satu-aplikasi-tiga-subapp dibatalkan. Dua aplikasi independen, dua database, redundansi diterima. Repo ini menjadi **StudioFlow saja**.

Dokumen ini **menggantikan** MASTER_SSOT.md §6.2 (App Access Matrix), §6.3 (topologi satu instance tiga schema) dan §6.4 (model placement lintas schema) **sebagai target arsitektur**. §6.5–§6.13 tetap berlaku sebagai catatan sejarah dan sebagai **spesifikasi domain yang dipanen** oleh aplikasi kedua — jangan dihapus, dipindahkan.

---

## 0. Ringkasan keputusan

| # | Keputusan | Nilai |
|---|---|---|
| 1 | Dua aplikasi independen | StudioFlow (desain) + Contractor App (kontraktor) |
| 2 | Database | **Dua database terpisah**, dua dokumen SSOT terpisah |
| 3 | Redundansi data material | **Diterima.** Masing-masing punya tabel material sendiri |
| 4 | Material di StudioFlow | **Library sendiri**, fokus desain, **tanpa harga** |
| 5 | Sample fisik (rak/box/pinjam) | Milik **Contractor App** |
| 6 | Sinkronisasi | **Tidak ada.** Kalau perlu, export/import CSV manual |
| 7 | Repo | Repo ini = StudioFlow. Kode masterdata/BQ diarsipkan ke branch/tag lalu dipanen ke repo baru |

---

## 1. Nama aplikasi kedua

Yang dibawa aplikasi kedua: identitas supplier, harga material (before/after discount + unit), harga jasa, sample fisik & gudang, curation queue, dan estimasi/BQ. Intinya **uang dan barang**, bukan desain.

| Usulan | Kenapa | Catatan |
|---|---|---|
| **BuildFlow** ← rekomendasi | Sepasang rapi dengan StudioFlow, satu keluarga produk. Cakupan luas: masterdata + BQ + procurement | Domain/nama umum, kemungkinan bentrok di luar |
| **RabFlow** | RAB = bahasa kantor sehari-hari. Langsung jelas ini alat estimasi | Terasa sempit kalau nanti tumbuh ke procurement/gudang |
| **CostFlow** | Paling jujur soal isinya: biaya | Mengecilkan masterdata jadi pelengkap |
| `BQ-masterdata` (nama kerja sekarang) | Deskriptif | Bukan nama produk — dua konsep digabung dengan tanda hubung |

**Rekomendasi: BuildFlow.** Sisa dokumen ini memakai nama itu; ganti global kalau owner pilih yang lain. Nama internal kode: `buildflow`.

---

## 2. Batas domain — siapa punya apa

### 2.1 StudioFlow — alat bantu desain + project management kantor

Pertanyaan yang dijawab StudioFlow: *"proyek ini di fase mana, apa yang nunggu saya, dan material apa yang saya pilih untuk ruangan ini."*

Miliknya:

- Identitas & login (User, Role) — **login sendiri, tidak dibagi**
- Client, Project, Phase, Revision, Activity, File, AuditLog
- Timeline, Checklist, ScheduleTemplate, TimelineTemplate, PrefixDictionary
- Project Schedule (Entry + Option + `data_snapshot` yang di-freeze)
- MOM (dokumen, item, point, image)
- CD List, Comment, TemporaryAttachment
- SketchUp bridge (SketchupProject/Material/FFE/MergeAction), RenderBoard + Annotation
- **Design Library** (baru — lihat §3.2): Brand + Material, fokus spesifikasi visual
- ProjectProductRequest, PromotionRequest (desainer minta material masuk library)

### 2.2 BuildFlow — masterdata supplier + estimasi kontraktor

Pertanyaan yang dijawabnya: *"material ini dari supplier mana, berapa harganya per unit, sample-nya ada di rak mana, dan berapa total RAB proyek ini."*

Miliknya:

- Vendor (relasi supplier) + BrandContact + BrandLink
- Material dengan **harga**: `price_before_discount`, `price_after_discount`, `price_unit`, `price_updated_at`
- ServiceVendor + ServicePrice (harga jasa)
- Sample + SampleMovementLog — inventaris fisik, rak, container box, jejak pinjam
- MaterialCandidate + SampleCandidate — curation queue (756 + 287 baris dari workbook)
- Kontrak canonical `Vendor → Material → Sample` dari MASTER_SSOT §6.12–§6.13 **dibawa utuh**
- Estimasi/BQ: quantity, markup, breakdown per proyek
- Role: STAFF, CURATOR, ESTIMATOR + admin

### 2.3 Yang sengaja diduplikasi

| Konsep | StudioFlow | BuildFlow |
|---|---|---|
| Brand/merek | Field wajib di Material, resolve-or-create | Atribut Material, di bawah Vendor |
| Material/SKU | Ya — spesifikasi desain, **tanpa harga** | Ya — identitas komersial, **dengan harga** |
| Kategori | Tag array (`catalog_tags`) | Tag array, konvensi sama |
| Vendor/supplier | **Tidak ada tabel Vendor.** Cukup teks brand | Tabel Vendor penuh + kontak + link |
| Sample fisik | **Tidak ada** (lihat Risiko R1) | Ya, lengkap |
| Harga | **Tidak ada** | Ya, satu-satunya pemilik |
| User & login | Sendiri | Sendiri |
| AuditLog | Sendiri | Sendiri |

**Kunci manusia yang disepakati bersama: `catalog_sku`** (kode artikel pabrikan) + nama brand. Tidak ada FK, tidak ada UUID bersama — tapi kalau nanti perlu join CSV, dua kolom itu cukup. Ini satu-satunya "kontrak" yang perlu dijaga konsisten di dua aplikasi.

---

## 3. Database

### 3.1 Topologi

Sekarang: satu instance PostgreSQL, tiga schema (`studioflow`, `master_data`, `bq`), Prisma multiSchema, satu login runtime.

Target: **dua database**.

| | StudioFlow | BuildFlow |
|---|---|---|
| Database | `studioflow` | `buildflow` |
| Schema | `public` saja — `multiSchema` **dilepas** | `public` saja |
| Prisma schema | `prisma/schema.prisma` di repo ini | file sendiri di repo baru |
| Migrasi | riwayat sendiri | **riwayat baru dari nol** |
| Backup | disiplin sendiri | disiplin sendiri |

Instance PostgreSQL fisik boleh sama dulu (dua database dalam satu server) — yang penting **dua login, dua connection string, nol cross-database FK**. Itu sudah menutup celah "runtime masih satu login" yang dicatat MASTER_SSOT §6.3.

`multiSchema` dilepas karena alasannya hilang: satu-satunya sebab schema terpisah dipilih adalah supaya FK lintas domain tetap valid. Kalau tidak ada FK lintas domain lagi, schema tambahan cuma biaya.

### 3.2 Design Library StudioFlow — turunan `Sku`, bukan tabel baru

Jangan tulis model material dari nol. Ambil `Sku` yang ada, karena nama kolom `catalog_*`-nya **sudah beku sebagai key JSON** di `ProjectScheduleOption.data_snapshot` untuk semua proyek yang sudah ada, dan tersebar di 39 file `src/` (SSOT §6.11 mencatat 1.644 kemunculan di 34 file per 31 Juli; angkanya hanya bertambah). Menulis model baru berarti menulis mapper baru.

`model Material` StudioFlow (rename dari `Sku`, pindah ke schema default):

**Dipertahankan** — `catalog_brand`, `catalog_sku`, `catalog_product_name`, `catalog_pattern`, `catalog_motif`, `catalog_color`, `catalog_finishing`, `catalog_dimension_*`, `catalog_tags`, `catalog_metadata`, `catalog_type`, `catalog_status`, `catalog_image_*`, `catalog_reference_url`, `catalog_folder_url`, `deleted_at`.

**Dibuang** — keempat kolom harga (`catalog_price`, `catalog_vendor_price`, `catalog_price_unit`, `catalog_price_updated_at`), relasi `samples`, `promoted_from_candidate`, `candidate_samples`, `source_offering_id`.

**Berubah** — `brand_id` → `Brand` versi StudioFlow yang ringan (nama + legal_name opsional + link/kontak opsional; **bukan** Vendor relasional). Unique key jadi `(brand_id, catalog_sku)`.

Ini sekaligus **menutup kebocoran harga** yang dicatat §6.3 sebagai "known pre-existing leak": DIC/DRIC bisa lihat harga lewat snapshot schedule. Setelah split, harga tidak pernah ada di database StudioFlow, jadi bukan lagi masalah RBAC — masalahnya hilang secara struktural. Itu keuntungan nyata dari split ini, bukan efek samping.

### 3.3 Data yang ada sekarang

| Data | Jumlah | Ke mana |
|---|---|---|
| Material canonical (PENDING) | 172 | **BuildFlow.** Re-seed dari CSV workbook |
| MaterialCandidate | 580 PENDING / 4 DISMISSED / 172 PROMOTED | **BuildFlow** |
| SampleCandidate | 287 | **BuildFlow** |
| Sample canonical | 0 | BuildFlow (kosong, tidak masalah) |
| Brand/Vendor | ikut seed | **BuildFlow** |
| ServiceVendor / ServicePrice | ikut seed | **BuildFlow** |
| Project, Phase, Schedule, snapshot, MOM, AuditLog | live | **Tetap di StudioFlow, tidak disentuh** |

**Design Library StudioFlow mulai dari kosong.** Konsisten dengan keputusan "tidak ada sync": kalau nanti mau diisi, jalankan satu kali export CSV kolom-desain dari BuildFlow lalu import — atau desainer isi sendiri sambil kerja. Jangan bikin migrasi yang mencoba membelah 172 baris ke dua database sekaligus; itu menghidupkan lagi coupling yang sedang dibunuh.

Sumber kebenaran seed tetap `docs/MASTERDATA_CSV_SEEDING_GUIDE.md` — **file ini pindah ke repo BuildFlow**, bukan dikopi.

---

## 4. Urutan eksekusi

Prinsip: **panen sebelum hapus.** Kode masterdata yang sudah jalan (~4.000 baris termasuk curation queue yang baru selesai kemarin) adalah aset. Jangan dihapus dari repo ini sebelum ada salinannya di tempat lain.

### Langkah 0 — Amankan
1. Backup database penuh + SHA-256, restore-test. Ikuti disiplin yang sudah dipakai di §6.12–6.13.
2. Tag repo: `git tag pre-split-monorepo` + push. Ini titik balik kalau ada yang salah.
3. Branch arsip: `archive/masterdata-bq` dari HEAD sekarang. **Jangan pernah dihapus.** Ini sumber panen BuildFlow.

### Langkah 1 — Panen ke repo BuildFlow (repo baru, tidak menyentuh repo ini)
4. `git clone` repo ini → repo `buildflow`, lalu buang sisi StudioFlow-nya. Riwayat commit ikut, jadi jejak keputusan masterdata tidak hilang.
5. Yang dibawa: `src/subapps/master-data/**`, `src/app/masterdata/**`, `src/app/bq/**`, model `master_data` dari schema, `docs/MASTERDATA_CSV_SEEDING_GUIDE.md`, `docs/MATERIAL_SSOT_RUNBOOK.md`, `scripts/` yang relevan, plus `ui_engine` + `components` sebagai basis UI.
6. Yang dipanen dari `src/extensions/library/`: bagian vendor/material/sample/promotion dari `library-service.ts` (1.590 baris) dan `library-actions.ts` (480 baris) — dipecah, tidak dipindah utuh. Bagian yang melayani Schedule dan SketchUp **tinggal di StudioFlow**.
7. Ekstrak MASTER_SSOT.md §6.3–§6.13 → `BUILDFLOW_SSOT.md` di repo baru. Bagian ini sudah ditulis sangat rinci; kehilangannya mahal.
8. Prisma schema baru, migrasi `init` dari nol, DB `buildflow`, seed ulang dari CSV.
9. Auth sendiri (User + Role: ADMIN, OWNER, STAFF, CURATOR, ESTIMATOR).

### Langkah 2 — Bersihkan StudioFlow (repo ini)
10. Hapus route: `src/app/masterdata/**`, `src/app/bq/**`.
11. Hapus `src/subapps/**` seluruhnya. Konsep "subapp" mati bersama split ini.
12. RBAC dikempiskan: `src/core/rbac/app-access.ts` (`APP`, `APP_ACCESS`, `LANDING_ROUTE`, `resolveAppForPath`, flag `LEGACY_LIBRARY_ACCESS_FOR_STAFF`) tidak punya alasan hidup lagi — satu aplikasi tidak butuh matriks app-access. `scripts/verify-access-matrix.mjs` ikut, atau disederhanakan jadi verifikasi permission saja. **Pertahankan** `LEAST_PRIVILEGE_ROLE` dan fail-closed default di `auth.config.ts`/`proxy.ts` — itu perbaikan keamanan nyata, bukan bagian dari split.
13. `enum Role` diringkas jadi `ADMIN`, `OWNER`, `DIC`, `DRIC`. Semua permission `MASTERDATA_*` dan `BQ_*` dihapus dari `matrix.ts`.
14. Migrasi StudioFlow (satu migrasi, ditulis tangan, `ALTER TABLE … SET SCHEMA` — bukan drop/recreate, sesuai preseden §6.11):
    - `Sku` → `Material` di schema `public`, empat kolom harga di-drop
    - `Brand` disederhanakan, pindah ke `public`
    - `Sample`, `SampleMovementLog`, `MaterialCandidate`, `SampleCandidate`, `ServiceVendor`, `ServicePrice` di-drop dari database StudioFlow
    - FK `ProjectScheduleOption.sku_id` dan `ProjectProductRequest.sku_id` dipasang ulang ke `public.Material` (dua-duanya `String?` + `SetNull`, jadi aman)
    - `ProjectProductRequest.linked_sample_id` di-drop
    - `multiSchema` dilepas dari `prisma/schema.prisma` (63 anotasi `@@schema` dihapus)
15. `library-service.ts` dipangkas: buang vendor CRUD, sample inventory, curation. Sisakan material CRUD + jembatan Schedule/SketchUp. Ini pemangkasan terbesar dan paling berisiko — kerjakan setelah langkah 14 hijau, jangan barengan.
16. `LibraryTabs.tsx` kehilangan tab Vendor & Sample. `SampleInventoryTable.tsx`, `VendorTable.tsx` dihapus.
17. `schedule-service.ts`: 6 tempat yang baca `catalog_price` dibersihkan. Snapshot lama tetap menyimpan angka harga di JSON-nya — **itu benar dan dibiarkan**, snapshot memang immutable. Yang berubah: snapshot baru tidak lagi punya field harga.
18. Verifikasi: `prisma migrate diff` zero-drift, `tsc` bersih, `next build` lolos, buka satu proyek lama dan pastikan schedule + snapshot lama masih render.

### Langkah 3 — Dokumentasi
19. `MASTER_SSOT.md` (81 KB) dipecah:
    - `STUDIOFLOW_SSOT.md` — §1–§5, §6.1, §7–§9, tanpa jejak subapp
    - `BUILDFLOW_SSOT.md` — §6.3–§6.13, pindah ke repo BuildFlow
    - `docs/history/MONOREPO_ERA.md` — §6.2 dan keputusan tiga-schema, disimpan sebagai sejarah supaya agent berikutnya tidak menghidupkan ulang
20. `AGENTS.md` dirapikan: hapus aturan subapp, tambahkan **"repo ini hanya StudioFlow; masterdata/harga/sample bukan urusannya — kalau butuh, itu tanda batas domain dilanggar."**
21. Bersihkan file transisi yang sudah selesai umurnya: `CODEX_PROMPT_MASTERDATA.md`, `MASTERDATA_HANDOFF.md`, `UPSTREAM-BQ-MATERIAL-SOURCE.md`, `LIBRARY-REWORK-FINDINGS.md`, `PLAN-catalog-library-sync.md` → pindah ke repo BuildFlow atau `docs/history/`. Jangan dihapus mentah; isinya keputusan, bukan sampah.
22. `package.json`: `"name": "radsaas-2"` → `"studioflow"`.

---

## 5. Roadmap StudioFlow

Setelah split, StudioFlow punya satu pekerjaan: **alat bantu desain + project management terpusat sesuai workflow kantor.** Pipeline tetap MOODBOARD → LAYOUT → DESIGN_3D → CD → SUPERVISION → COMPLETED; CD milik DRIC, sisanya DIC.

Urutan di bawah gabungan `STUDIOFLOW_DESIGNER_VISION.md` (Fase A–D) dan `roadmap.txt` (template berulang, foldering).

### R0 — Split & stabilisasi
§4 di atas. Tidak ada fitur baru sampai build hijau dan proyek lama masih render benar.

### R1 — Rumah untuk desainer *(friksi harian terbesar)*
- Landing khusus DIC/DRIC: **nunggu saya / nunggu klien / nunggu drafter**, lintas proyek, pakai `pic_designer_id` yang sudah ada
- `(dashboard)/page.tsx` berhenti me-redirect non-ADMIN — hari ini desainer tidak punya home
- Phase strip horizontal di halaman proyek: 6 stop, fase aktif, pill "dengan klien/dengan drafter", satu next-action utama

### R2 — Pipeline yang terasa manusiawi
- Label status bahasa manusia: yang dilihat desainer cuma *dikerjakan / direview / disetujui / selesai*; 7 state internal disembunyikan di balik aksi bernama
- Loop review kelas satu: kirim internal → kirim klien → approve, disambung ke model `Revision` yang sudah ada
- Locking yang menjelaskan diri + override `allow_parallel` yang kelihatan

### R3 — Handoff CD & tampilan per role
- Kartu handoff di DESIGN_3D → CD: "desain disetujui → diserahkan ke [drafter]"
- View CD desainer jadi read-mostly; DRIC dapat workspace CD fokus
- Satu data, dua lensa

### R4 — Kurasi, bukan entri data *(inti kreatif)*
- Pemilihan material visual, image-first, library-first. Snapshot-freeze tetap
- Reuse dari library jadi pintu depan yang jelas
- Material SketchUp hasil sync masuk ke alur pilih-material desainer, berhenti jadi pulau ADMIN

### R5 — Template berulang & struktur folder *(`roadmap.txt`)*
- Template proyek/schedule yang bisa dipakai ulang — `ScheduleTemplate`, `TimelineTemplate`, `ChecklistTemplate` sudah ada, belum jadi produk
- Struktur foldering deliverable per fase, disambung ke `File` + `PrefixDictionary`
- Ini yang mengubah StudioFlow dari alat satu-proyek jadi sistem kantor

### R6 — Supervisi = realita lapangan
- MOM + foto sebagai tulang punggung fase SUPERVISION
- Issue tracking per kunjungan

### Utang teknis yang ikut jalan
- Issue 1 (§8, auth bypass `/activity`) tercatat sudah dimitigasi — `/activity` + `/activity-center` masuk `isDashboardRoute`, dan default `?? "STAFF"` sudah diganti `LEAST_PRIVILEGE_ROLE`. **Verifikasi ulang setelah langkah 12**, karena langkah itu menyentuh file yang sama
- Issue 5: validasi prefix kode CD
- Issue 6: `switchActiveOption` dead code
- Migrasi gate `LIBRARY_*` → nama permission yang jujur setelah `MASTERDATA_*` hilang

---

## 6. Risiko & yang perlu diputuskan

**R1 — Sample fisik pindah ke BuildFlow, tapi yang meminjam adalah desainer.** Ini konsekuensi paling tajam dari keputusan §0 no.5. Setelah split, desainer tidak bisa lihat "sample Niro Granite ada di rak mana" dari StudioFlow. Tiga pilihan:
  1. *(paling murah)* Peminjaman sample jadi proses di luar aplikasi / lewat BuildFlow langsung oleh STAFF. StudioFlow tidak tahu-menahu.
  2. StudioFlow simpan satu boolean `has_physical_sample` di Material-nya, diisi manual saat entri. Tidak akurat, tapi cukup untuk "perlu diminta atau tidak".
  3. Sample fisik ikut StudioFlow (membalik keputusan), BuildFlow cuma tahu stok gudang proyek.
  → **Perlu keputusan owner sebelum langkah 14.**

**R2 — Material diketik dua kali.** Ini harga yang sudah disetujui dari "redundan boleh". Yang perlu dijaga: `catalog_sku` + nama brand konsisten di dua aplikasi, supaya join CSV masih mungkin. Kalau beban entri ganda ternyata berat di lapangan, jawabannya export CSV satu arah — **bukan** menyambung ulang database.

**R3 — Alur promosi material kehilangan penyetuju.** `ProjectProductRequest` + `PromotionRequest` mengandalkan STAFF/CURATOR yang menyetujui. Kedua role itu pindah ke BuildFlow. Di StudioFlow, siapa yang menyetujui material masuk library? Usul: OWNER/ADMIN, atau hidupkan `CURATOR` sebagai role StudioFlow dengan arti berbeda (kurator library desain, bukan kurator supplier). **Perlu keputusan.**

**R4 — Dua database, dua disiplin backup.** Kerapian yang sekarang dipakai (backup + SHA-256 + restore test + dry-run + audit per baris) harus digandakan, bukan dibagi dua. Repo baru mewarisi aturan itu di `AGENTS.md`-nya sejak commit pertama.

**R5 — Estimator kehilangan konteks proyek.** ESTIMATOR pindah ke BuildFlow dan tidak lagi bisa membuka proyek StudioFlow. BQ butuh schedule hasil desain sebagai input. Dengan "tidak ada sync", jembatannya export CSV/PDF schedule dari StudioFlow → import manual ke BuildFlow. **Ini alur kerja kantor yang nyata dan perlu dicek** apakah bisa diterima, atau apakah export satu arah StudioFlow → BuildFlow perlu naik jadi prioritas R2.

**R6 — Kerja masterdata dua hari terakhir baru selesai.** Curation queue (§6.13) selesai 31 Juli, jam-jam terakhir. Memindahkannya ke repo baru sebelum sempat dipakai berarti bug-nya belum ketemu. Mitigasi: langkah 1 memakai `git clone` penuh dengan riwayat, bukan copy-paste file — supaya konteks keputusannya ikut pindah.

---

## 7. Yang eksplisit *tidak* dilakukan

- Tidak menyentuh Project, Phase, Schedule, snapshot, MOM, atau AuditLog StudioFlow. Split ini soal batas domain, bukan data operasional.
- Tidak mengganti nama kolom `catalog_*`. Alasan §6.11 masih berlaku: 1.644 kemunculan, dan nama itu key JSON di snapshot yang beku.
- Tidak menghapus `VendorOffering`-style tabel apa pun lagi — sudah selesai, jangan diulang.
- Tidak membangun sync, message queue, atau shared package di antara dua aplikasi. Kalau muncul kebutuhan itu, batas domainnya salah dan yang perlu dibahas ulang adalah batasnya.
- Tidak memindahkan snapshot lama yang masih memuat angka harga. Immutable artinya immutable.
