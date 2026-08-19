# StudioFlow — Codex Handoff Log

Terakhir diperbarui: **3 Agustus 2026**

Dokumen ini adalah titik masuk handoff antar-agent. Baca file ini lebih dahulu
sebelum melanjutkan pekerjaan. Untuk riwayat produk yang lengkap tetap baca
`CHANGELOG.md`; untuk kontrak kanonis baca `MASTER_SSOT.md`.

## Aturan pemeliharaan

- Setiap agent yang mengubah kode, schema, migration, konfigurasi, UI, data,
  dokumentasi acuan, atau melakukan operasi database wajib memperbarui file ini
  pada task yang sama.
- Catat hasil akhirnya, file/area yang berubah, migrasi atau operasi data,
  verifikasi yang benar-benar dijalankan, risiko, dan pekerjaan yang masih
  terbuka.
- Letakkan pembaruan terbaru di bagian paling atas `Riwayat handoff`.
- Jangan menghapus konteks aktif yang masih diperlukan oleh agent berikutnya.
- Perubahan material tetap wajib dicatat juga di `CHANGELOG.md`. Perubahan
  kontrak/arsitektur kanonis tetap wajib diselaraskan ke `MASTER_SSOT.md` dan
  `AGENTS.md`.
- Jangan menulis klaim verifikasi yang belum benar-benar dijalankan.

## Kondisi aktif yang wajib diketahui

### Kontrak Master Data

- **TERMINOLOGI DIUBAH 31 Juli 2026 oleh owner — baca ini dulu.** Untuk
  **Material**, pihak relasionalnya adalah **Brand** (merek/produsen).
  **Vendor** berarti **penyedia jasa**, kini ada sebagai
  `master_data.ServiceVendor` dan opsional terhubung dari `ServicePrice`.
  Ini membalik kalimat lama "Vendor adalah supplier relasional; Brand adalah
  atribut Material yang tidak boleh ditebak sebagai Vendor". Yang berubah hanya
  NAMA pihak relasionalnya; larangan mengarang pihak relasional dari sekadar
  nama di sumber TETAP berlaku penuh.
- Rantai kanonis: `Brand -> Material -> Sample`.
- `Material.catalog_brand` adalah salinan denormalisasi nama Brand relasional
  (dipertahankan karena dibekukan snapshot + jadi unique key
  `vendor_id + catalog_brand + catalog_sku`). Sekarang DITURUNKAN saat simpan,
  bukan diketik user.
- Tabel fisik `master_data.Vendor` sengaja TIDAK di-rename; model Prisma-nya
  memang sudah bernama `Brand`. Pakai nama Prisma di kode dan "Brand" di UI.
- Material wajib memiliki Brand relasional, SKU, nama produk, dan minimal satu
  category tag berurutan. ServiceVendor tidak menjadi bagian identitas
  Material.
- Kategori dan subkategori/Product lama sudah digabung menjadi
  `catalog_tags`; tag pertama menjadi kategori utama Schedule.
- Istilah dan konsep `Offering` sudah dihapus. Baris sumber tanpa SKU nyata
  adalah blocker seed, bukan Material.
- Warna, motif, finishing, dimensi, gambar, dan link bersifat opsional.
- Harga sebelum diskon, harga setelah diskon, dan satuan harga harus lengkap
  agar Material boleh menjadi sumber harga BQ.
- Setiap Material baru selalu `PENDING`, tetapi `PENDING` tetap dapat dipakai di
  Library dan Project Schedule. Hanya `REJECTED` yang tidak boleh dipakai untuk
  pilihan baru. `REJECTED` berarti takedown non-destruktif; snapshot project
  yang sudah ada tidak dihapus atau ditulis ulang.
- Hanya `ADMIN`, `OWNER`, dan `CURATOR` yang boleh approve/reject Material atau
  promotion request. `STAFF` dapat merawat Master Data, tetapi editnya
  mengembalikan Material ke `PENDING`.
- Sample hanya berarti benda fisik yang benar-benar diterima dan wajib terhubung
  ke satu Material.
- “Tidak tersedia/belum diminta” diturunkan dari tidak adanya Sample aktif,
  bukan disimpan sebagai baris Sample palsu.
- Status Sample aktif: `AVAILABLE`, `BORROWED`, dan `SENT_TO_CLIENT`.

### Implementasi yang sudah selesai

- `prisma/schema.prisma` sudah dipetakan ke tabel PostgreSQL kanonis
  `master_data.Vendor`, `master_data.Material`, dan Sample berbasis
  `material_id`.
- Nama internal Prisma `Brand`/`Sku` masih dipertahankan sementara sebagai
  compatibility bridge; jangan menganggapnya sebagai kontrak domain baru.
- Model taxonomy Category/Product lama sudah dihapus. §6.14 kemudian
  memperkenalkan kembali `Category` sebagai indeks pencarian Brand-first yang
  direkonstruksi dari evidence tags, dengan relasi `BrandCategory`; ini bukan
  pemulihan subcategory/Product master lama.
- Migration
  `prisma/migrations/20260731210000_material_vendor_sample_contract/migration.sql`
  sudah dibuat dan diterapkan.
- Migration mempunyai emptiness guard untuk entitas Master Data lama.
  Operasi destruktifnya hanya diizinkan pada Master Data yang kosong.
- Migration Brand-first Library
  `20260801010000_add_brand_first_library` sudah diterapkan secara additive:
  `Category`, `BrandCategory`, `MaterialPrice`, link archive, snapshot spec,
  dan Brand pada ProjectProductRequest tersedia tanpa menghapus data lama.
- `/library` adalah permukaan pencarian Category → Brand baru. Seed awal
  menghasilkan 418 Category dan 1.054 BrandCategory dari evidence kandidat;
  100 kandidat tanpa Brand relasional tetap menjadi blocker kurasi.
- Foreign key StudioFlow disambungkan ulang ke Material tanpa menghapus,
  truncate, atau menulis ulang row operasional StudioFlow.
- `/masterdata/materials` adalah satu-satunya permukaan CRUD Material.
- `/masterdata/skus` mengarah ke `/masterdata/materials`.
- Form data lama dibuka read-only dan baru dapat diedit melalui `Modify`.
- UI Material sudah memisahkan Vendor dan Brand, memakai category tags,
  menampilkan dua harga + satuan/BQ readiness, dan menurunkan keadaan Sample
  fisik.
- Picker Vendor pada form Material sudah searchable, menutup saat kehilangan
  fokus, menghapus pilihan lama saat query berubah, dan dapat membuka dialog
  Vendor untuk membuat supplier baru tanpa menutup form Material.
- Role `CURATOR` dan permission `MASTERDATA_MATERIAL_APPROVE` sudah tersedia.
  Approval tidak lagi diturunkan dari permission edit umum.
- UI Vendor menggunakan istilah Vendor. Halaman Sample Fisik hanya menampilkan
  inventory fisik yang terhubung ke Material.
- Library, Schedule, promotion, dan SketchUp sudah disesuaikan agar Brand tidak
  pernah ditebak sebagai Vendor.
- Snapshot project tetap immutable dan mempertahankan nama properti JSON
  `catalog_*`. Snapshot baru membawa Vendor id/nama secara eksplisit.
- Database preflight sudah memeriksa tabel/kolom kanonis dengan signature
  `studioflow-prisma-v2.8.0-curation-queue`.
- Acuan seed kanonis tersedia di
  `docs/MASTERDATA_CSV_SEEDING_GUIDE.md`.
- Paket hasil baca ulang workbook tersedia di `docs/masterdata-seed`:
  392 Vendor, 399 VendorContact, dan 1.010 VendorLink sudah diterapkan ke
  database lokal; payload Material dan Sample dibuat nol karena sumber tidak memiliki
  SKU eksplisit dan relasi Vendor–Brand belum terkonfirmasi saat seed awal.
  Seluruh 756 kandidat Material dan 287 kandidat Sample masuk tabel antrean
  kurasi, bukan dibuat langsung sebagai data kanonis.
- Kurasi owner-confirmed khusus `Sheet1` kemudian mempromosikan 172 kandidat
  menjadi Material kanonis `PENDING` dan menandai 4 duplikat sebagai
  `DISMISSED`; 580 kandidat Material masih `PENDING`. Sample kanonis tetap nol
  dan seluruh 287 SampleCandidate menunggu promosi inventaris terpisah.
- `/masterdata/curation` adalah working surface antrean tersebut. Dialog dibuka
  read-only, `Modify` membuka edit, `DISMISSED` mengabaikan bukti, dan promosi
  eksplisit baru membuat Material/Sample setelah semua gate terpenuhi.
- Candidate `PENDING` tidak usable. Ini berbeda dari Material kanonis
  `PENDING`, yang tetap usable sesuai kontrak.
- Importer pengganti tersedia di `scripts/import-masterdata-seed.mjs` dengan
  mode `--validate-only`, `--dry-run`, dan guarded `--apply`, termasuk
  verifikasi backup memakai `pg_restore` host atau container Docker. Jangan
  memakai importer lama.
- Importer CSV lama tetap sengaja dinonaktifkan. Jangan melepas guard atau
  menjalankannya kembali.
- Tujuan setelah login diturunkan dari `LANDING_ROUTE` di
  `src/core/rbac/app-access.ts`, bukan dari path hardcode. `STAFF` dan
  `CURATOR` mendarat di `/masterdata`, `ESTIMATOR` di `/bq`, sisanya di `/`.
  Jangan mengembalikan `router.push("/")` di `src/components/login-form.tsx`.
- Matcher proxy memproses `/login`, sehingga user yang sudah terautentikasi
  dipantulkan ke landing route-nya. `api` tetap dikecualikan.

### Kondisi database terakhir

Lapisan Vendor sudah di-seed dan 172 kandidat Sheet1 sudah dipromosikan menjadi
Material kanonis `PENDING`. Sample kanonis tetap kosong sampai inventaris
fisiknya dipromosikan terpisah:

| Tabel | Jumlah row |
|---|---:|
| `master_data.Vendor` | 392 |
| `master_data.VendorContact` | 399 |
| `master_data.VendorLink` | 1.010 |
| `master_data.MaterialCandidate` | 756 |
| `MaterialCandidate` berstatus `PENDING` | 580 |
| `MaterialCandidate` berstatus `DISMISSED` | 4 |
| `MaterialCandidate` berstatus `PROMOTED` | 172 |
| `master_data.SampleCandidate` | 287 |
| `master_data.Material` | 172 |
| `master_data.Sample` | 0 |
| `master_data.SampleMovementLog` | 0 |
| `master_data.Category` | 418 |
| `master_data.BrandCategory` | 1.054 |
| `master_data.MaterialPrice` | 0 |
| `master_data.ServiceVendor` | 0 |
| `master_data.ServicePrice` | 0 |

Data StudioFlow tetap ada:

| Tabel | Jumlah row |
|---|---:|
| `studioflow.Project` | 11 |
| `studioflow.ProjectScheduleEntry` | 79 |
| `studioflow.ProjectScheduleOption` | 79 |
| `studioflow.ProjectProductRequest` | 0 |
| `studioflow.AuditLog` | 8.106 |

Backup penuh sebelum migration + seed Brand-first Library:

- Path:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_brand_first_library_20260801_002644.dump`
- Ukuran: `761.368 bytes`
- SHA-256:
  `37D32B0A47AF8FCB58EC529044C9E7CB173A8537A5FC0B586862BB864E6B7C04`
- `pg_restore --list` lulus. Restore terisolasi juga lulus dan mereproduksi
  baseline AuditLog/Material/MaterialCandidate/SampleCandidate
  `6.634/172/756/287` serta Project/Schedule `11/79/79`; database verifikasi
  sudah dihapus.

Backup penuh sebelum kurasi Sheet1 SKU=Tipe+Motif:

- Path:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_sheet1_sku_curation_20260731_174005.dump`
- Ukuran: `709.372 bytes`
- SHA-256:
  `F33C7ADDAA2CB8E7E6E1DA802025A2AD7B337A8FB09436EFFE5717D4017B055F`
- Sudah lolos hash check dan `pg_restore --list` melalui container
  `studioflow-db-1`, kemudian berhasil direstore ke database verifikasi
  terisolasi. Restore mereproduksi baseline Material/MaterialCandidate/
  SampleCandidate 0/756/287 dan Project/Schedule 11/79/79.

Backup penuh sebelum migration dan seed antrean kurasi:

- Path:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_curation_queue_20260731_162105.dump`
- Ukuran: `529.903 bytes`
- SHA-256:
  `33A067D60B6095B8A770E74FDC691517E078FEFA3663017E708B22F7CA1BD86D`
- Sudah lolos `pg_restore --list` dan dipakai untuk restore-test terisolasi.

Backup penuh sebelum seed Vendor:

- Path:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_masterdata_seed_20260731_155335.dump`
- Ukuran: `409.094 bytes`
- SHA-256:
  `3AAB2B68CED502FEE960BFD03C6EDFF1BE01A161237F004821DD888BD8D43AE9`
- Sudah lolos `pg_restore --list` melalui container `studioflow-db-1`.

Backup sebelum kontrak Material/Vendor:

- Path:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_material_vendor_contract_20260731_141402.dump`
- Ukuran: `414.850 bytes`
- SHA-256:
  `CE2F95D05D2DCB911DF2033A3E4757A830A43A9E6BA9F89106059FC3E0B3F7B3`

Backup sebelum penambahan role Curator:

- Path:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_curator_role_20260731_145029.dump`
- Ukuran: `408.553 bytes`
- SHA-256:
  `92D5E8406CC11D74059BD57B4850986FE70E827D2AADA4E7716884079AE5A715`

Backup tersebut sudah direstore ke database verifikasi terisolasi sebelum
migration diterapkan ke database utama. Hash normalized data-only dump schema
StudioFlow sebelum dan sesudah migration identik:
`3A3EAC97E5395B2B814DD7C7E69F304B45EF0EF7A32708AF8B1BDB9D84125ECD`.

### Verifikasi terakhir

Sudah lulus:

- Prisma validate dan generate.
- Prisma migrate deploy dan migrate status.
- Prisma migrate diff: tidak ada schema drift.
- Production database preflight.
- TypeScript `tsc --noEmit`.
- Production Next.js build.
- ESLint pada file yang disentuh: nol error; masih ada beberapa warning lama
  yang tidak terkait.
- Access matrix verification.
- Migration `20260731223000_add_curator_role` sudah diterapkan dan migration
  diff tetap nol.
- Production Next.js build setelah perubahan Vendor/kurasi.
- Importer seed: `node --check` dan targeted ESLint lulus.
- Pre-apply dry-run, transactional apply, dan post-apply dry-run lulus. Dry-run
  kedua menghasilkan 0 create/enrich dan 392/399/1.010 reuse.
- Pemeriksaan independen: 0 orphan contact, 0 orphan link, 0 duplicate
  normalized Vendor name, dan 0 duplicate Vendor URL.
- Migration `20260731234000_add_masterdata_curation_queue` sudah diuji pada
  restored database, diterapkan ke database utama, dan menghasilkan zero schema
  drift.
- Candidate apply serta dry-run idempotensi lulus: 756 MaterialCandidate dan
  287 SampleCandidate reuse pada run kedua, tanpa create/enrich.
- Pemeriksaan kandidat sebelum kurasi: 0 orphan relation dan 0 duplicate key;
  656 mempunyai suggested Vendor dan 287 SampleCandidate mempunyai suggested
  MaterialCandidate.
- TypeScript, targeted ESLint, dan production Next.js build setelah halaman
  `/masterdata/curation` lulus.
- Kurasi Sheet1 SKU=Tipe+Motif: `node --check`, targeted ESLint,
  `--validate-only`, dan database `--dry-run` lulus dengan 176 eligible,
  172 winner, 4 exact duplicate loser untuk auto-merge, 0 unresolved collision,
  dan 97 Vendor-unmatched.
- Transactional apply sebagai `berkah.rad@gmail.com` menghasilkan
  `dismissed=4 confirmed=172 promoted=172 skipped=0`. AuditLog bertambah tepat
  520 row: 172 update, 172 promote, 172 `CATALOG_CREATE`, dan 4 dismiss.
- Verifikasi pasca-apply: 172 Material semuanya `PENDING`; 0 missing SKU,
  product name, tags, atau Vendor valid; 0 promoted candidate tanpa Material;
  0 SampleCandidate menunjuk candidate `DISMISSED`; Project/Schedule tetap
  11/79/79. Dry-run kedua menghasilkan 0 eligible dan 0 write.
- Migration `20260801000000_add_service_vendor` dan
  `20260801010000_add_brand_first_library` sudah diterapkan. Prisma Client
  berhasil di-generate; `migrate status` up to date dan schema diff nol.
- Seed Brand×Category: dry-run memproses 756 kandidat, menemukan 100 blocker
  tanpa Brand relasional, merencanakan 418 Category + 1.054 BrandCategory, dan
  mencatat 260 peringatan nama kategori mirip tanpa menggabungkannya. Apply
  membuat tepat 1.472 row + AuditLog; post-apply dry-run idempoten dengan nol
  create dan nol orphan relation.
- `npx tsc --noEmit`, targeted ESLint, dan production `npm run build` lulus
  setelah Prisma Client baru terpasang.
- Visual QA terautentikasi `/library` lulus: pencarian `terazzo` menghasilkan
  `Granite - Stones - Terazzo - Marbles` (1 brand) dan `Terazzo` (2 brand).
  Kategori `Terazzo` membuka Dphaus + Lava Solid Surface. Tombol katalog Dphaus
  mengubah link Drive menjadi URL `/preview` yang valid dan Google viewer
  benar-benar menampilkan `Catalogue DP Haus .pdf`, halaman 1 dari 34.

Dev server terakhir sudah direstart dan mendengarkan port `3000` (Next listener
PID `40080`). Tab hasil QA dibiarkan terbuka pada preview katalog Dphaus.
Terdapat satu peringatan dev non-blocking dari Radix: `DialogContent` katalog
belum memiliki `DialogTitle`/description yang terbaca aksesibilitas. Preview
tetap berfungsi. `scripts/resolve-import-actor.mjs` juga mengonfirmasi akun
ADMIN `berkah.rad@gmail.com` masih memakai password seed yang pernah
di-commit; rotasi kredensial tetap wajib dan bukan bagian operasi seed ini.

### Pekerjaan berikutnya

- **Checkpoint sebelum §7 sudah lulus.** Jangan mulai teardown §7 tanpa
  keputusan owner/Claude sesudah membaca hasil visual di atas. Bila dilanjutkan,
  bawa peringatan aksesibilitas dialog sebagai pekerjaan UI terpisah; jangan
  mencampurnya dengan migrasi/destruksi schema.

- Kurasi 580 MaterialCandidate yang masih `PENDING` melalui
  `/masterdata/curation`: 97 kandidat Sheet1 lebih dahulu membutuhkan
  pencocokan Vendor; kandidat `List` tetap membutuhkan SKU nyata dan relasi
  yang valid. Jangan menjalankan ulang aturan Sheet1 ke sumber lain.
- Kurasi 287 SampleCandidate: 184 sudah mempunyai source suggestion menuju
  kandidat Material yang dipromosikan dan 103 masih menunjuk kandidat
  `PENDING`; seluruh `confirmed_material_id` masih kosong. Konfirmasi Material
  induk secara eksplisit sebelum promosi menjadi inventaris fisik.
- Kurasi ulang 392 Vendor, 399 contact, dan 1.010 link yang sudah di-seed dari
  sumber workbook; seed awal tidak berarti data tersebut sudah approved.
- Selesaikan fuzzy-match nama Vendor untuk brand `Roman`/`Niro` — varian ejaan
  (`Niro granit` / `Niro granite` / `Niro Granite`, `Roman` / `Roman granit`)
  membuat 97 dari 273 kandidat Sheet1 gagal match ke direktori Vendor `List`
  meski Vendor-nya kemungkinan sudah ada di seed dengan ejaan berbeda.
- Lakukan visual QA terautentikasi untuk halaman Kurasi, Material, Vendor, dan
  Sample. Browser yang tersedia masih berhenti di login.

### Peringatan workspace

Worktree memiliki sangat banyak perubahan dan file untracked milik pengguna
yang sudah ada sebelumnya. Jangan melakukan mass reset, clean, checkout, atau
menganggap semua diff berasal dari pekerjaan Master Data ini. Belum ada staging,
commit, push, atau pull request yang dilakukan.

## Riwayat handoff

### 2026-08-03 — Project Overview jadi dua kolom, teks dekoratif dihapus

- Arahan owner: baris atas penuh untuk info identitas, lalu DUA kolom — kiri
  (lebih lebar) berisi Phases + Project Tasks, kanan berisi Global Checklist +
  Admin. Sederhanakan, hapus teks yang sifatnya estetika dan tidak bermakna,
  fokus ke konten dan placeholder seperlunya.
- Matriks fase dipindah MASUK ke kolom kiri. Sebelumnya ia selebar penuh dan
  kolom kanan baru mulai di bawahnya, sehingga kartu kanan menggantung tanpa
  pasangan sejajar. Sekarang `flex flex-row` dengan `min-w-0 flex-1` di kiri.
- Teks yang dihapus, beserta alasannya:
  - Judul `PHASES` di atas tabel — header kolom pertama sudah berbunyi `PHASE`.
    Label persis di atas label yang sama adalah chrome, bukan informasi. Ini
    membatalkan keputusan "beri judul Phases" dari task sebelumnya.
  - Subjudul `Cross-phase tasks` dan `Admin Diagnostics` — mengulang judul
    kartunya sendiri. Kartu admin diganti nama menjadi `Admin`.
  - Kartu bersarang di `ProjectAdminActions`: wrapper card, ikon tile, judul
    `Admin Actions`, subjudul `Manual project lifecycle management`, dan
    divider — semuanya membungkus SATU tombol, di dalam kartu yang sudah
    berjudul. Satu hal dilabeli tiga kali. Komponen kini merender tombolnya
    saja.
  - Ikon tile hitam dan subjudul `General todo items not associated with any
    phase` di Project Tasks — placeholder input sudah mengatakannya.
  - Header `Deferred Project Tasks` + subjudul `Items moved from phases to
    maintain momentum` → cukup `Deferred`.
  - Empty state Global Checklist: medali ikon + dua baris teks (baris kedua
    menjelaskan asal item dari Project Engine templates) → satu baris. Border
    dan shadow pembungkusnya juga dibuang: kartu di dalam kartu.
  - Empty state Project Tasks: baris kedua `Use the input above to add a new
    task` menarasikan input yang terlihat di layar → satu baris.
  - `DialogDescription` mode view (`Viewing current project identification and
    assignment`) — mendeskripsikan tindakan melihat formulir. Mode view kini
    memakai `sr-only` agar Radix tetap punya deskripsi aksesibilitas. Mode edit
    diganti kalimat yang benar-benar membawa informasi baru: mengganti PIC
    memindahkan seluruh fase yang dipegangnya. Judul dialog `Project Metadata`
    → `Project Information`.
- Import yatim setelah penghapusan sudah dibersihkan (`AlertTriangle`,
  `ArrowRightCircle`, `CheckCircle2`, `Card`, `CardContent`, `Heading`).
- File yang berubah: `src/app/(dashboard)/projects/[id]/page.tsx`,
  `src/components/project-tasks-card.tsx`,
  `src/components/project-admin-actions.tsx`,
  `src/components/project-checklist-overview.tsx`,
  `src/components/project-identity-strip.tsx`.
- Verifikasi yang benar-benar dijalankan: `npx tsc --noEmit` pada salinan
  worktree penuh — **0 error di seluruh proyek**; `npx eslint` pada berkas yang
  diubah — 0 error, satu warning `activeTab` yang sudah ada sebelumnya. Belum
  ada QA visual browser pada perubahan ini.
- Pekerjaan terbuka: QA visual dua kolom di viewport lebar dan sempit; pin
  sidebar (`fixed`) dari entri sebelumnya juga belum diverifikasi visual;
  `window.confirm` di hapus todo masih mentah; akar penyebab `position: sticky`
  tidak bekerja di shell ini masih belum ditemukan.

### 2026-08-03 — Hierarki Project Overview dibangun ulang empat tier, sidebar dipin, grid kanan diperbaiki

- **`ProjectOverviewForm` (833 baris) dipecah dan dihapus.** Menjadi
  `src/components/project-identity-strip.tsx` dan
  `src/components/project-tasks-card.tsx`. Handler dan JSX dipindah verbatim
  lewat skrip ekstraksi baris, bukan diketik ulang, untuk menghindari salah
  transkripsi. Enam warning `no-unused-vars` yang menempel di file lama ikut
  bersih karena state yang tidak terpakai tidak ikut dibawa.
- **Alasan hierarkinya diubah.** Kartu bernama `Overview` duduk DI BAWAH
  matriks fase — ringkasan diletakkan setelah detail yang seharusnya
  diperkenalkannya, dan namanya menggambarkan seluruh halaman, bukan kartu itu.
  Isinya juga tiga hal berbeda dalam satu wadah: identitas proyek (data
  referensi), Project Tasks (pekerjaan nyata), dan progress. Urutan baru:
  - Tier 1 identitas — `ProjectIdentityStrip` tepat di bawah judul, satu baris
    label/value tanpa ikon dan tanpa chrome kartu. Alur edit tidak berubah
    karena sudah berupa modal sejak awal.
  - Tier 2 keadaan — matriks fase, kini berjudul `Phases`.
  - Tier 3 tindakan — `ProjectTasksCard` dan `Global Checklist`.
  - Tier 4 admin — `Project Flow Validation` dipindah ke urutan TERAKHIR kolom
    kanan. Sebelumnya di paling atas, memberi kontrol paling jarang dan paling
    destruktif (`Mark Project as Completed`) slot paling menonjol.
- **Redundansi kelima dihapus.** Subtitle header `"<client> — <area> SQM"` dan
  baris meta `Opening <tanggal>` mengulang tiga field yang sekarang ada di
  identity strip. Header kini hanya membawa nama proyek dan status lifecycle.
- **Gap kosong di kartu Overview diperbaiki.** Setelah Phase Journey dihapus,
  kondisinya masih `{currentProgress && ...}` sehingga wrapper ber-border tetap
  dirender kosong pada setiap proyek berjalan. Diperketat menjadi
  `type !== 'IN_PROGRESS'`. Banner `PROJECT COMPLETED` / `READY FOR <phase>`
  kini dirender di halaman, di atas matriks.
- **Sidebar proyek: `sticky` → `fixed`.** `lg:sticky lg:top-0` tidak menahan;
  panel tetap ikut ter-scroll. Petunjuk pentingnya: `ActionSidebar` juga memakai
  `lg:sticky lg:top-8` dan sama-sama tidak menahan, jadi masalahnya bukan pada
  satu elemen melainkan sticky tidak resolve terhadap scroll container di shell
  ini. Daripada menebak ancestor mana yang merusaknya, panel dipin ke viewport:
  `lg:fixed lg:left-[78px] lg:top-14 lg:bottom-0` plus spacer sibling selebar
  sama untuk menahan kolom pertama flex row. `left-[78px]` = lebar rail
  `NavOuter`, sama dengan `lg:pl-[78px]` pada `main`; kalau lebar rail berubah,
  kedua angka harus berubah bersamaan. Geometrinya identik dengan sebelumnya.
- **Grid kolom kanan berantakan — diperbaiki.** `ActionSidebar` menetapkan
  lebarnya sendiri (`lg:w-[280px] xl:w-[320px] shrink-0`); ia dirancang sebagai
  flex sibling. Dipakai di dalam `lg:grid-cols-3` dengan `lg:col-span-1`, ia
  menjadi item yang lebih sempit dari track 1/3-nya sendiri, sehingga kartunya
  menyisakan ruang mati di kanan dan berhenti sebelum tepi kanvas yang dicapai
  matriks fase. Grid diganti flex row + `min-w-0 flex-1` pada kolom kiri.
- File yang berubah: `src/components/project-identity-strip.tsx` (baru),
  `src/components/project-tasks-card.tsx` (baru),
  `src/components/project-overview-form.tsx` (DIHAPUS),
  `src/app/(dashboard)/projects/[id]/page.tsx`,
  `src/ui_engine/layout/shells/project-layout-shell.tsx`.
- Verifikasi yang benar-benar dijalankan: `npx tsc --noEmit` pada salinan
  worktree penuh — **0 error di seluruh proyek**; `npx eslint` pada berkas yang
  diubah — 0 error, satu warning `activeTab` yang sudah ada sebelumnya. Kedua
  komponen baru nol warning. Belum ada QA visual browser pada perubahan ini.
- Pekerjaan terbuka: QA visual (pin sidebar, perataan kolom kanan terhadap
  matriks, identity strip di viewport sempit). `ProjectTasksCard` masih membawa
  `window.confirm` mentah pada hapus todo — salah satu dari lima yang ditandai
  UX audit; penggantian ke `AlertDialog` sengaja dipisah sebagai perubahan
  tersendiri. Akar penyebab `position: sticky` tidak bekerja di shell ini belum
  ditemukan; `ActionSidebar` masih memakai `lg:sticky lg:top-8` yang efektif
  tidak berfungsi.

### 2026-08-03 — Sidebar proyek bocor diperbaiki, Phase Journey dihapus, kolom Rev diperbaiki

- Ditemukan lewat QA visual owner pada render nyata, bukan mockup.
- **Background sidebar proyek bocor — diperbaiki.** Menutup temuan diagnosis
  dari entri "Arahan UI Project Overview". Penyebabnya persis seperti yang
  didiagnosis: `aside` desktop di
  `src/ui_engine/layout/shells/project-layout-shell.tsx` hanya memakai
  `lg:max-h-[calc(100vh_-_3.5rem)]`, sehingga tidak punya tinggi pasti dan
  `min-h-full` pada `NavInner` resolve ke `auto` alias tinggi kontennya
  sendiri. Panel putih berhenti setelah item menu terakhir dan canvas
  `slate-50` terlihat di bawahnya. `max-h` diganti `h`. `<nav>` di dalam sudah
  `flex-1 overflow-y-auto`, jadi menu yang lebih tinggi dari viewport tetap
  scroll di dalam, bukan meluber.
- **`Phase Journey` + persentase dihapus dari kartu `Overview`.** Ini
  redundansi terakhir yang dikeluhkan owner. Persentasenya adalah `index fase
  aktif terjauh / jumlah fase` — posisi di pipeline, bukan pekerjaan selesai.
  "60% Complete" secara harfiah berarti tiga dari lima baris matriks berbunyi
  `Approved`, dan matriks sudah menyatakannya per fase dengan presisi penuh.
  Ini mengubah arahan sebelumnya yang menyatakan journey + persentase tetap
  milik kartu `Overview`; alasannya dicatat di komentar kode. Kartu `Overview`
  kini benar-benar hanya metadata proyek + project tasks, sesuai eyebrow-nya
  sendiri (`PROJECT METADATA`). Kalau nanti ingin satu angka headline,
  turunkan dari pekerjaan nyata (checklist + activity terbuka lintas fase),
  bukan dari indeks fase — itu baru informasi baru.
- **Kolom `Rev` kosong pada fase yang sudah disetujui — diperbaiki.** Query
  memfilter `revisions: { where: { status_enum: "ACTIVE" } }`, padahal approve
  menandai revision menjadi `COMPLETED`. Akibatnya justru fase yang versinya
  paling penting (Moodboard, Layout 2D pada 2025-405) menampilkan `—`. Filter
  dihapus, diganti `orderBy [major desc, minor desc] take 1`.
  Catatan efek samping yang disengaja: `getProjectProgress()` membaca relasi
  yang sama. Cabang "punya work history"-nya kini melihat revision completed
  juga — sesuai yang selalu diklaim komentarnya sendiri, tetapi ini tetap
  perubahan perilaku pada kasus tepi ketika tidak ada fase aktif sama sekali.
- File yang berubah: `src/ui_engine/layout/shells/project-layout-shell.tsx`,
  `src/components/project-overview-form.tsx`,
  `src/app/(dashboard)/projects/[id]/page.tsx`.
- Verifikasi yang benar-benar dijalankan: `npx tsc --noEmit` pada salinan
  worktree penuh — **0 error di seluruh proyek**; `npx eslint` pada berkas yang
  diubah — 0 error, hanya warning `no-unused-vars` yang sudah ada sebelumnya.
  QA visual perbaikan sidebar dan penghapusan Phase Journey belum dilakukan;
  perlu dicek ulang di browser oleh owner.
- Pekerjaan terbuka: QA visual di viewport desktop tinggi untuk memastikan
  background sidebar benar-benar penuh sampai bawah dan tepi panel matriks
  sejajar dengan grid di bawahnya.

### 2026-08-03 — Phase matrix Project Overview diimplementasikan, redundansi dihapus

- Menutup pekerjaan terbuka dari entri "Arahan UI Project Overview dicatat,
  belum diimplementasikan" di bawah. Panel fase atas sekarang benar-benar
  berupa tabel lima baris dengan header kolom, bukan lagi `<ul>` tanpa header.
- Kolom final: **Phase | Status / Owner | Rev | Time**. Empat kolom, bukan
  lima.
- **Kolom `Flow` dibuang.** Isinya `Frozen`, `Waiting`, dan `PARALLEL`. Dua yang
  pertama tidak membawa informasi baru: `is_locked` diset `true` oleh aksi yang
  sama yang menulis `READY_FOR_NEXT`, jadi `Frozen` hanya mengulang `Approved`;
  `Waiting` seluruhnya dapat diturunkan dari `Not started` + fase sebelumnya
  belum approved. Hanya override paralel yang tersisa, kini sebagai badge di
  kolom Phase. Ikon gembok kecil + `title` pada baris tetap menjelaskan lock;
  penjelasan penuh tetap di halaman fase.
- **Durasi tidak lagi tampil dua kali per baris.** `PhaseReadingLine` dirancang
  sebagai kalimat utuh (`status · owner · durasi · progress`) untuk permukaan
  satu baris; menaruhnya di sel Status sementara ada kolom Time membuat angka
  yang sama tercetak dua kali. `src/ui_engine/components/phase-reading.tsx`
  sekarang juga mengekspor bagian terpisah — `PhaseStatusPill`, `PhaseOwner`,
  `PhaseDuration`, `PhaseToneDot` — untuk layout berkolom. `PhaseReadingLine`
  tetap ada dan dipakai di header halaman fase. Pakai salah satu, jangan
  keduanya dalam satu baris.
- **Versi revisi pindah ke matriks.** Blok per-fase di kartu `Overview`
  (`LAYOUT v6.0 / DESIGN 3D v5.0` + badge Internal Review / Client Review /
  Approved) dihapus dari `src/components/project-overview-form.tsx`. Semua
  faktanya sudah menjadi baris di matriks dan diturunkan dari array `phases`
  yang sama, jadi halaman menyatakan fase aktif dua kali dalam satu viewport.
  Kartu `Overview` kini hanya memiliki pernyataan tingkat proyek yang tidak
  dapat dikatakan matriks: `PROJECT COMPLETED`, `READY FOR <phase>`, serta
  `Phase Journey` + persentase. Ini menyesuaikan arahan sebelumnya: yang tetap
  milik kartu Overview adalah journey dan persentase, bukan enumerasi fase.
- **Perbaikan semantik durasi.** `PhaseReading` mendapat `durationRole`
  (`waiting` | `elapsed`) dan `durationLabel`. Sebelumnya fase yang disetujui
  enam minggu lalu menampilkan `6 weeks` di kolom berjudul Time, yang terbaca
  "sudah menunggu enam minggu" — padahal fase itu tidak menunggu apa pun, ia
  sudah selesai sejak enam minggu lalu. Sekarang berbunyi `6 weeks ago`. Peran
  ditentukan oleh `actor === "NOBODY"`, bukan oleh `tone`, agar fase `PENDING`
  ikut terbaca benar.
- Notasi versi diseragamkan ke `v{major}.{minor}`; header halaman fase
  sebelumnya memakai `R{major}.{minor}`.
- Baris matriks tetap menjadi link ke halaman fase meski sidebar kiri juga
  memuat lima fase yang sama. Ini keputusan owner: dua jalur ke tujuan yang
  sama dinilai wajar untuk tool harian — satu untuk lompat cepat, satu untuk
  lompat sambil membaca keadaan.
- File yang berubah: `src/app/(dashboard)/projects/[id]/page.tsx`,
  `src/app/(dashboard)/projects/[id]/phases/[phaseId]/page.tsx`,
  `src/components/project-overview-form.tsx`,
  `src/lib/domain/phase-presenter.ts`, `src/lib/domain/phase-lock.ts`,
  `src/ui_engine/components/phase-reading.tsx`.
- Tidak ada schema, migration, konfigurasi, atau operasi database yang
  disentuh pada task ini.
- Verifikasi yang benar-benar dijalankan: `npx tsc --noEmit` pada salinan
  worktree penuh dengan Prisma Client hasil generate — **0 error di seluruh
  proyek**; `npx eslint` pada berkas yang diubah — 0 error, hanya warning
  `no-unused-vars` yang sudah ada sebelumnya. Belum ada QA runtime/visual di
  browser pada perubahan ini.
- Pekerjaan terbuka: visual QA Project Overview di viewport desktop tinggi
  (terutama perataan tepi kiri/kanan panel terhadap grid di bawahnya, yang
  belum diverifikasi secara visual); perbaikan tinggi sidebar Product Schedule
  di `project-layout-shell.tsx` + `nav-inner.tsx` masih terbuka dari entri
  sebelumnya; `components/nav-inner.tsx` masih menyimpan salinan sendiri label
  fase yang kini kanonis di `phase-presenter.PHASE_LABEL` — belum disatukan
  karena importnya akan menarik enum Prisma ke bundle client.

### 2026-08-03 — Arahan UI Project Overview dicatat, belum diimplementasikan

- Owner menegaskan struktur layout Project Overview saat ini harus tetap:
  top bar, sidebar, posisi panel fase, grid `Overview` utama, serta kolom
  diagnostik kanan tidak boleh dipindah atau diganti dengan pola navigasi atau
  layout baru.
- Panel fase bagian atas dinilai kurang baik secara UI/UX. Arah revisi yang
  diminta adalah tetap berupa satu tabel/list lima baris yang ringkas dengan
  kolom teratur untuk Phase, Status/Owner, Time, dan Flow; status boleh memakai
  pill semantik yang tenang agar lebih mudah dipindai.
- Batas kiri panel fase wajib sejajar dengan batas kiri kartu `Overview`, dan
  batas kanannya wajib sejajar dengan batas kanan kolom `Project Flow
  Validation`/`Global Checklist`. Panel tidak boleh lebih lebar daripada total
  grid dua kolom di bawahnya.
- Hindari redundansi informasi: panel fase atas hanya menjadi matriks status
  detail per fase. `Project Status & Progress`, `Phase Journey`, dan persentase
  penyelesaian tetap hanya dimiliki kartu `Overview` bawah; jangan menampilkan
  kembali judul overview, progress bar, completion count, atau persentase di
  panel atas.
- Mockup referensi terakhir dibuat dengan ImageGen di
  `C:\Users\IMBA PC\.codex\generated_images\019fc71b-a2ae-7c43-8d48-d1a5854d637a\exec-6b4e7c43-f93c-4b15-b92b-03c2af388608.png`.
- Investigasi terpisah pada Product Schedule menemukan background project
  sidebar berhenti setelah isi navigasi karena wrapper desktop hanya memakai
  `max-height` + `self-start` tanpa tinggi pasti. `NavInner min-h-full` tidak
  dapat mengisi viewport ketika tinggi induknya `auto`; background canvas
  `slate-50` kemudian terlihat di bawah sidebar. Temuan berada di
  `src/ui_engine/layout/shells/project-layout-shell.tsx` dan
  `src/components/nav-inner.tsx`; perbaikan belum diterapkan.
- Task ini hanya menghasilkan diagnosis, arahan UI, dan mockup. Tidak ada kode
  aplikasi, schema, migration, konfigurasi, data database, `CHANGELOG.md`, atau
  `MASTER_SSOT.md` yang diubah. Belum ada lint, typecheck, build, atau runtime
  QA karena belum ada implementasi kode yang perlu diverifikasi.
- Pekerjaan terbuka: implementasikan arahan tersebut dengan token desain yang
  ada, catat implementasinya pada bagian `## UI Changes` di `CHANGELOG.md`,
  perbarui entri handoff ini, lalu jalankan visual QA pada Project Overview dan
  Product Schedule di viewport desktop tinggi.

### 2026-08-03 — Dev server Prisma dipulihkan, migration diterapkan, build dan runtime lulus

- Menghentikan listener Next lama di port 3000 sebelum menyentuh Prisma Client.
- Membuat backup tervalidasi
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_phase_status_timestamp_20260803_171353.dump`
  (949.680 bytes; SHA-256
  `C160E34C7B08EFF75B4B43400022F1ED8A8DBCA1AE072A2076235990AB252996`),
  lalu menerapkan migration
  `20260803120000_add_phase_status_changed_at` ke database lokal
  `localhost:5432/studioflow`.
- Hasil backfill: 55 Phase total, 20 mempunyai `status_changed_at`, 35 tetap
  `NULL` sesuai kontrak unknown. Migration tercatat satu kali, tidak ada nilai
  masa depan, `migrate status` up to date, dan schema diff nol.
- Menyelaraskan `docker-compose.yml` dengan database persisten yang benar-benar
  aktif: service `db`, image PostgreSQL 15, volume
  `studioflow_postgres_data`, dan host port `5432`. Ini sekarang cocok dengan
  `.env`, `prisma.config.ts`, dan runtime `src/core/platform/db.ts`;
  `docker compose config --quiet`, `docker compose ps`, migrate status, dan
  health check lulus tanpa membuat/recreate container atau database kedua.
- Menyelesaikan dua blocker build aktif: `TopHeader` menerima dan menampilkan
  link subapp terfilter role; Deliverables meneruskan `projectId`/`phaseId` ke
  uploader sehingga path media tidak lagi kehilangan konteks.
- Menghapus empat komponen UI Library lama yang tidak mempunyai caller setelah
  `/extensions/library` menjadi redirect: `LibraryTabs`, `LibraryFormModal`,
  `ProductGrid`, dan `ProductCard`. `/library` serta `/masterdata` tetap menjadi
  permukaan aktif; tidak ada data atau route aktif yang dihapus.
- Verifikasi lulus: Prisma validate/generate/status/diff, `npx tsc --noEmit`,
  dan production `npm run build`. Smoke test browser terautentikasi lulus pada
  `/`, `/library`, `/projects`, satu project overview, dan satu phase detail;
  UI menampilkan `with client · 5 weeks` tanpa `PrismaClientValidationError`
  atau `P2022`.
- Full `npm run lint` masih gagal pada utang lama: 15 error dan 71 warning di
  file test/legacy serta hook yang tidak disentuh task ini. Tidak ada aturan
  lint atau TypeScript yang dilemahkan untuk menyembunyikannya.
- Risiko/pekerjaan terbuka: bersihkan lint debt sebagai task terpisah. Worktree
  tetap sangat dirty milik pengguna; tidak ada reset, stage, commit, push, atau
  PR. Dev server direstart lagi setelah seluruh verifikasi agar proses akhir
  memegang Prisma Client yang baru. Listener final PID `20924` aktif di port
  `3000`; `/api/health` dan `/login` sama-sama membalas `200`, dengan stdout di
  `tmp/studioflow-final-20260803_172552.stdout.log` dan stderr kosong di
  `tmp/studioflow-final-20260803_172552.stderr.log`.

### 2026-08-01 — Checkpoint Brand-first Library selesai: backup, migration, seed, dan preview Drive lulus

- Membuat backup penuh custom-format di luar project:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_brand_first_library_20260801_002644.dump`
  (761.368 bytes; SHA-256
  `37D32B0A47AF8FCB58EC529044C9E7CB173A8537A5FC0B586862BB864E6B7C04`).
  Hash, `pg_restore --list`, dan restore database terisolasi semuanya lulus;
  database uji sudah dihapus.
- Sebelum deploy, schema diff menemukan Prisma schema Claude kehilangan dua
  kolom operasional lama `ProjectScheduleOption.created_at`/`updated_at`, padahal
  migration additive mempertahankannya dan reuse search masih membacanya.
  Mapping kedua timestamp dipulihkan; sesudah itu migration diff hanya berisi
  perubahan Brand-first yang dimaksud dan tidak ada `DROP` tak sengaja.
- `npx prisma migrate deploy` menerapkan
  `20260801000000_add_service_vendor` dan
  `20260801010000_add_brand_first_library`. `npx prisma generate`, migrate
  status, dan zero-drift check lulus.
- Dry-run `scripts/seed-brand-categories.mjs` sebagai
  `berkah.rad@gmail.com` membaca 756 MaterialCandidate: 100 blocker tanpa Brand
  relasional dilewati, 418 Category + 1.054 BrandCategory direncanakan, 260
  kemungkinan nama kategori mirip hanya dilaporkan (tidak auto-merge). Apply
  membuat tepat 1.472 row dan audit log; dry-run kedua menghasilkan nol write.
- Pemeriksaan database: Category/BrandCategory `418/1.054`, Material tetap 172,
  MaterialCandidate/SampleCandidate tetap `756/287`, Sample tetap 0,
  Project/Schedule tetap `11/79/79`, AuditLog 8.106, dan nol orphan relation.
- Prisma generate mengekspos dua mismatch integrasi yang diperbaiki minimal:
  editor BrandLink kini mengenali enum `DRIVE`/`PRICE_LIST` dan Google Drive;
  hasil `receiveProjectProductRequest` kini mengembalikan relasi yang diwajibkan
  type. Tidak ada pekerjaan teardown §7.
- Verifikasi kode: targeted ESLint, `npx tsc --noEmit`, dan production
  `npm run build` lulus. Route `/library` muncul di hasil build.
- QA browser terautentikasi lulus: `terazzo` → kategori tepat `Terazzo` →
  brand Dphaus → `Drive/folder katalog`. Google Drive viewer menampilkan
  `Catalogue DP Haus .pdf`, halaman 1 dari 34, dengan page/zoom controls.
- Risiko terbuka: Radix mencatat warning aksesibilitas dialog title/description;
  preview tidak terblokir. Akun ADMIN lokal masih cocok dengan password seed
  yang pernah di-commit dan wajib dirotasi. Worktree tetap sangat dirty; tidak
  ada reset, stage, commit, push, atau §7 yang dilakukan.

### 2026-07-31 — Bug: pencarian Library tidak bisa menemukan category tag

- Gejala: cari `TILE` di Library → "No products found", padahal kolom CATEGORY
  di semua baris jelas berisi `Tile`.
- Sebab: di `LibraryService.getAllProducts`, klausa tag-nya
  `{ catalog_tags: { has: filters.search } }`. `catalog_tags` bertipe
  `String[]`, dan operator array Prisma (`has`, `hasSome`) membandingkan
  elemen dengan kesamaan PERSIS — tidak menerima `mode: "insensitive"` yang
  hanya berlaku untuk filter string skalar. Seluruh klausa lain di `OR` yang
  sama sudah case-insensitive, jadi klausa tag ini satu-satunya yang menuntut
  user menebak kapitalisasi tersimpan.
- Perbaikan: cocokkan teks yang diketik ke daftar tag yang benar-benar ada
  (case-insensitive + substring, jadi `til` tetap menemukan `Tile`), lalu
  kirim ejaan asli yang tersimpan ke `hasSome`. Bila tidak ada yang cocok,
  klausanya dihilangkan, bukan mengirim `hasSome: []`.
- Catatan biaya: perbaikan ini menambah satu query pembacaan `catalog_tags`
  ketika ada kata kunci pencarian. Sekarang murah (172 Material); bila jumlah
  Material tumbuh besar, pertimbangkan tabel tag terpisah atau index GIN +
  raw query.
- **Sengaja TIDAK diubah:** `filters.category` dan `filters.tags` sama-sama
  menulis `where.catalog_tags`, sehingga bila keduanya diisi, filter category
  diam-diam hilang. Keduanya berasal dari dropdown berisi ejaan asli jadi tidak
  kena bug kapitalisasi; mengubah presedensinya adalah perubahan perilaku yang
  layak jadi commit tersendiri.
- Verifikasi: `tsc --noEmit` lulus. **ESLint pada `library-service.ts` TIDAK
  selesai** di sandbox ini (timeout 44 detik berulang pada file besar
  ber-type-aware-lint) — jalankan lokal sebelum merge. Tidak diuji terhadap
  database nyata karena tidak ada rute ke Postgres lokal.

### 2026-07-31 — Terminologi dibalik: Material→Brand, Vendor=penyedia jasa. Migration ServiceVendor SIAP TAPI BELUM DI-APPLY

**Keputusan owner (berkah.rad@gmail.com):** "untuk material lebih tepat disebut
brand; untuk penyedia jasa baru vendor". Ini membalik aturan terminologi yang
baru saja ditegakkan. **Codex: ini bukan regresi, ini keputusan sadar owner.**
Larangan intinya tidak dicabut — mengarang pihak relasional dari sekadar nama
di sumber TETAP blocker; yang berubah hanya namanya.

Alasan pendukung yang diverifikasi ke data, bukan asumsi:
- **172 dari 172** Material hasil promosi: `vendor_name` identik dengan
  `catalog_brand`. Redundansi penuh.
- **0 dari 392** Vendor membawa lebih dari satu brand.
- **100 dari 392** punya `legal_name` berbeda dari namanya (`Acqua Trend` →
  `PT Cipta Sani Lestari`) — artinya baris "Vendor" itu sebenarnya brand +
  perusahaan di baliknya.
- Model Prisma-nya memang sudah bernama `Brand` (`brand_name`, `brand_id`);
  hanya `@@map("Vendor")` yang menamai tabelnya Vendor.

**Yang dikerjakan (UI + schema + dokumen):**
- `MasterDataProductDialog.tsx`: field "Vendor" + "Brand" digabung jadi SATU
  field "Brand *". `catalog_brand` kini diturunkan dari Brand terpilih saat
  simpan (`resolvedBrandName`), tidak diketik ulang. Brand baru yang dibuat
  lewat dialog juga langsung mengisi nama itu. Data lama yang `catalog_brand`-nya
  menyimpang TIDAK disembunyikan — ada peringatan bahwa menyimpan akan
  menyelaraskannya.
- `MasterDataMaterialsClient.tsx`: kolom Vendor+Brand digabung jadi satu kolom
  "Brand" (legal entity tetap tampil di bawahnya; penyimpangan `catalog_brand`
  ditandai). Label filter/sort/deskripsi ikut disesuaikan. Sebelumnya di sesi
  yang sama: kolom SKU+Produk digabung, kolom Spesifikasi disembunyikan dari
  tabel (data tetap ada & tetap dicari/diedit lewat dialog), harga belum lengkap
  jadi simbol `—` bukan kalimat berulang.
- `MasterDataVendorPicker.tsx`: placeholder "Cari brand…", aksi "Tambah brand
  baru". `MasterDataNav.tsx`: label section jadi "Brand" (route tetap
  `/masterdata/vendors`).
- `prisma/schema.prisma`: model baru `ServiceVendor` (name unik, legal_name,
  trade, kontak, soft delete) + kolom NULLABLE `ServicePrice.service_vendor_id`
  dengan relasi `onDelete: SetNull`. NULL berarti tarif internal studio.
  Docblock lama ServicePrice yang bilang "deliberately NOT linked" ditandai
  superseded, tidak dihapus diam-diam.
- Migration additive `prisma/migrations/20260801000000_add_service_vendor/`.
  Tabel `master_data.Vendor` **tidak** di-rename (semua FK Material/
  MaterialCandidate/VendorContact/VendorLink menunjuk ke sana + snapshot
  membekukan key `catalog_*`).
- Kontrak diselaraskan: `AGENTS.md` (§0 terminologi baru),
  `docs/MASTERDATA_CSV_SEEDING_GUIDE.md` (§0 baru), dan bagian "Kondisi aktif"
  file ini. Halaman Harga diperbarui karena teksnya menyatakan hal yang kini
  berlawanan dengan schema.

**Verifikasi yang benar-benar dijalankan:**
- `npx prisma validate` lulus; `prisma format` sudah dijalankan.
- `prisma migrate diff --from-empty --to-schema --script` dibandingkan baris per
  baris dengan migration tulisan tangan: nama kolom, nama index
  (`ServiceVendor_name_key`, `ServiceVendor_is_active_idx`,
  `ServiceVendor_deleted_at_idx`, `ServicePrice_service_vendor_id_idx`), dan
  klausa FK **identik** → diff seharusnya nol saat di-deploy.
- `tsc --noEmit` lulus. ESLint pada 5 file tersentuh: nol error/warning.
- `scripts/verify-access-matrix.mjs` lulus.

**Yang TIDAK bisa dijalankan dari sandbox ini (jangan dianggap sudah selesai):**
- `npx prisma generate` GAGAL: `EPERM unlink src/generated/prisma/client.d.ts`
  pada mount. Jadi Prisma Client **belum** mengenal `serviceVendor`.
- `prisma migrate deploy` / `migrate status` / `migrate diff` terhadap database
  nyata: tidak ada rute jaringan ke Postgres lokal (`127.0.0.1:5432`).
- Production `next build`: bus error di sandbox ini (bukan bug kode).
- Tidak ada satu pun tulisan ke database dari entri ini.

**Langkah Codex berikutnya:**
1. `npx prisma generate` (wajib duluan — client belum punya `serviceVendor`).
2. Backup di luar project + SHA-256 + `pg_restore --list`.
3. `npx prisma migrate deploy`, lalu `migrate status` dan `migrate diff` untuk
   memastikan drift nol.
4. `npx tsc --noEmit` + production build ulang setelah client ter-generate.
5. Baru bangun CRUD Harga Jasa + UI ServiceVendor (sekarang tabelnya ada, tapi
   belum ada permukaan input sama sekali — halaman Harga masih read-only).
6. Sisa pekerjaan lama tidak berubah: promosi 184 SampleCandidate yang sudah
   siap, fuzzy-match Vendor/Brand untuk 97 kandidat Sheet1, kurasi 580
   MaterialCandidate, visual QA terautentikasi.

### 2026-07-31 — Kurasi Sheet1 SKU=Tipe+Motif diterapkan; empat duplikat auto-merge bersih

- Melanjutkan handoff Claude dan memverifikasi ulang
  `scripts/curate-sheet1-sku-motif.mjs`: `node --check`, targeted ESLint, dan
  `--validate-only` lulus. CSV menghasilkan 273 kandidat Sheet1, 176 eligible,
  172 winner, 4 loser exact-duplicate, 0 unresolved collision, dan 97 kandidat
  Vendor-unmatched.
- Membuat backup penuh custom-format di luar project:
  `D:\Misc\ProjectsHUB\studioflow-backups\backup_before_sheet1_sku_curation_20260731_174005.dump`
  (709.372 bytes; SHA-256
  `F33C7ADDAA2CB8E7E6E1DA802025A2AD7B337A8FB09436EFFE5717D4017B055F`);
  hash dan `pg_restore --list` lulus melalui `studioflow-db-1`. Backup juga
  berhasil direstore ke database terisolasi dan mereproduksi baseline
  Material/MaterialCandidate/SampleCandidate 0/756/287 serta Project/Schedule
  11/79/79; database verifikasi kemudian dihapus.
- Dry-run database sebagai `berkah.rad@gmail.com` (`ADMIN`) cocok persis:
  176 eligible, 172 promosi, 4 duplicate loser diserap, 0 collision kategori.
- Apply satu transaksi selesai:
  `dismissed=4 confirmed=172 promoted=172 skipped=0`. Empat loser Infiniti
  (`Reggio Grey`, `Rotterdam Cream`, `Stone White`, `Xenith Cream`) menjadi
  `DISMISSED`; seluruh link SampleCandidate dipindah ke winner, tidak ada row
  kandidat yang dihapus.
- Kondisi sesudah apply: 172 Material kanonis seluruhnya `PENDING`;
  MaterialCandidate = 580 `PENDING` + 4 `DISMISSED` + 172 `PROMOTED`;
  SampleCandidate tetap 287 dan Sample kanonis tetap 0. AuditLog 6.615.
  Project, ProjectScheduleEntry, dan ProjectScheduleOption tetap 11/79/79.
- Pemeriksaan integritas menemukan 0 promoted candidate tanpa Material,
  0 dismissed candidate dengan Material, 0 SampleCandidate yang masih menunjuk
  candidate `DISMISSED`, dan 0 Material hasil promosi dengan SKU/product/tags/
  Vendor invalid. Post-apply dry-run menghasilkan 0 eligible/0 write.
- Kontrak auto-merge non-destruktif diselaraskan ke
  `docs/MASTERDATA_CSV_SEEDING_GUIDE.md`, `MASTER_SSOT.md`, `AGENTS.md`,
  `CHANGELOG.md`, dan kondisi aktif file ini.

### 2026-07-31 — RINGKASAN SESI: Claude (Cowork) take-over dari Codex, tiga hal dikerjakan, satu langkah tersisa untuk Codex

> Status lanjutan: langkah backup, dry-run, apply, dan verifikasi yang disebut
> di bawah sudah diselesaikan oleh entri handoff tepat di atas. Bagian ini
> dipertahankan sebagai riwayat kondisi saat Claude menyerahkan pekerjaan.

Sesi ini dikerjakan oleh Claude (agent Cowork, bukan Codex) sambil Codex
sedang aktif menjalankan seed Master Data di sesi lain. Owner
(berkah.rad@gmail.com) meminta ditangani langsung tanpa dihand-off balik ke
Codex. Ringkasan lengkap urutan pembahasan dan pekerjaan, supaya Codex (atau
agent manapun) tidak perlu membaca ulang seluruh percakapan:

**1. Bug redirect login (sudah selesai, sudah diverifikasi, TIDAK butuh DB).**
Owner melaporkan STAFF/ESTIMATOR yang login malah mendarat di StudioFlow,
bukan `/masterdata`/`/bq`. Root cause: `LANDING_ROUTE` di
`src/core/rbac/app-access.ts` sudah benar sejak awal, tapi
`src/components/login-form.tsx` hardcode `router.push("/")` setelah sign-in,
dan `src/proxy.ts` mengecualikan `login` dari matcher sehingga cabang bounce
di `auth.config.ts -> authorized()` untuk user yang sudah login jadi dead
code. Sudah diperbaiki: login form sekarang push ke `landingRouteFor(role)`
dari session yang baru terbit; proxy matcher sekarang memproses `/login`.
Verifikasi yang benar-benar jalan: `tsc --noEmit` lulus, ESLint kedua file
nol error/warning, `node scripts/verify-access-matrix.mjs` lulus. **Production
`next build` TIDAK dijalankan** — proses itu bus-error di sandbox Cowork ini
(kemungkinan resource limit sandbox, bukan bug kode); jalankan manual sebelum
deploy kalau belum. Tidak ada perubahan schema/migration/data.

**2. Temuan: SKU untuk MaterialCandidate asal `Sheet1` bisa diturunkan dari
Tipe+Motif — dikonfirmasi owner, sudah masuk kontrak kanonis.** Owner
menunjukkan bahwa di workbook, brand seperti Artile menamai produknya
`Tipe + Motif` (mis. "Terrain" + "Gravel" = "Terrain Gravel"), persis seperti
brand lain yang Tipe-nya sudah berupa kode langsung ("GT 602153R"). Ini
BUKAN pelanggaran larangan "Tipe-as-SKU inference" yang berlaku untuk sheet
`List` (di situ `Product` memang cuma family/subkategori) — ini konfirmasi
manusia yang persis dikumpulkan `/masterdata/curation`, hanya untuk sumber
`Sheet1`. Aturan `product_name = Tipe`, `sku = Tipe + " " + Motif` sudah
ditulis ke `docs/MASTERDATA_CSV_SEEDING_GUIDE.md` sebagai bagian resmi
kontrak (bagian baru "Aturan turunan SKU untuk kandidat asal Sheet1").

**3. Skrip kurasi ditulis dan sebagian teruji, TAPI belum pernah menyentuh
database.** `scripts/curate-sheet1-sku-motif.mjs` dibuat untuk menerapkan
aturan di atas ke 273 MaterialCandidate asal `Sheet1` secara massal, meniru
persis field dan AuditLog dari `updateMaterialCandidateAction`/
`promoteMaterialCandidateAction` di
`src/subapps/master-data/actions/curation-actions.ts`. Selama investigasi,
ditemukan 4 kandidat yang derived-SKU-nya bertabrakan (semua brand
`Infiniti`) — dicek satu-satu dan terbukti itu produk fisik yang sama,
dicatat dua kali dengan Tipe/Motif tertukar antar baris sumber. Skrip
menangani ini dengan auto-merge (satu dipromosikan, satunya di-dismiss
non-destruktif + Sample-nya dipindah ke pemenang), bukan sekadar melapor.
`--validate-only` (mode tanpa DB, baca CSV saja) **benar-benar dijalankan**
dan hasilnya: 273 kandidat Sheet1 → 176 eligible → **172 akan
confirm+promote** (termasuk 4 auto-merge) → 97 tidak tersentuh (Vendor belum
match: varian ejaan `Roman`/`Niro`/`Artile`, masalah terpisah dari SKU).
`--dry-run` dicoba dan gagal jelas: sandbox Cowork ini tidak punya rute
jaringan ke Postgres lokal pengguna (`127.0.0.1:5432` connection refused/
timeout) — batasan infrastruktur, sama persis dengan guard yang sudah ada di
`scripts/resolve-import-actor.mjs`. **`--apply` tidak pernah dicoba. Tidak
ada backup baru, tidak ada Material baru, tidak ada AuditLog baru, tidak ada
tulisan ke database sama sekali dari seluruh sesi ini.**

**Langkah Codex selanjutnya (satu-satunya yang tersisa dari sesi ini):**

1. Buat backup baru di luar folder project (ikuti pola backup sebelumnya di
   log ini), verifikasi SHA-256 dan `pg_restore --list`.
2. Jalankan `node scripts/curate-sheet1-sku-motif.mjs --dry-run --actor-email
   berkah.rad@gmail.com` dari lingkungan yang punya akses ke Postgres lokal
   (mesin/terminal Codex, bukan sandbox Cowork), pastikan angkanya masih
   176/172/97 seperti validate-only di atas.
3. Kalau cocok, jalankan `--apply` dengan flag backup + `--ack-review` (lihat
   contoh command di entri berikutnya, tidak berubah).
4. Setelah apply, catat hasil nyata (jumlah confirmed/promoted/dismissed,
   backup, verifikasi) di entri baru — JANGAN tulis klaim sudah applied tanpa
   benar-benar menjalankannya.
5. 97 kandidat dengan Vendor belum match (`Roman`/`Niro`/`Artile` dll.) masih
   perlu fuzzy-matching Vendor terpisah — di luar cakupan aturan SKU ini.
6. Setelah itu lanjutkan pekerjaan lama yang belum selesai: kurasi manual
   sisa MaterialCandidate/SampleCandidate, kurasi ulang Vendor seed, dan
   visual QA halaman Kurasi/Material/Vendor/Sample yang masih terhalang di
   login (di browser Codex, bukan di sandbox Cowork).

### 2026-07-31 — SKU Tipe+Motif diformalkan ke guide + skrip kurasi (kode siap, apply belum jalan — DB tidak terjangkau dari sandbox ini)

- Menindaklanjuti entri "Temuan: SKU dapat diturunkan..." di bawah: owner
  mengonfirmasi langsung aturan `sku = Tipe + Motif`, `product_name = Tipe`
  untuk kandidat asal `Sheet1`. Aturan ini ditulis ke
  `docs/MASTERDATA_CSV_SEEDING_GUIDE.md` (bagian baru "Aturan turunan SKU
  untuk kandidat asal Sheet1") sebagai bagian dari kontrak kanonis, dengan
  penegasan eksplisit bahwa ini TIDAK membatalkan larangan "Tipe-as-SKU
  inference" untuk baris `List` (family/subkategori tetap bukan SKU).
- Menulis `scripts/curate-sheet1-sku-motif.mjs`: mode `--validate-only`
  (CSV saja), `--dry-run`, dan `--apply` (backup + `pg_restore --list` +
  `--ack-review`, sama seperti `scripts/import-masterdata-seed.mjs`). Logika
  confirm+promote meniru persis `updateMaterialCandidateAction` dan
  `promoteMaterialCandidateAction` di
  `src/subapps/master-data/actions/curation-actions.ts`: field yang diisi,
  urutan validasi, dan dua AuditLog (`MASTERDATA_MATERIAL_CANDIDATE_UPDATE`,
  `MASTERDATA_MATERIAL_CANDIDATE_PROMOTE` + `CATALOG_CREATE`) sama persis.
  Skrip mendeteksi tabrakan kunci `vendor+brand+sku` turunan di dalam batch
  maupun terhadap Material yang sudah promoted.
- **Update setelah investigasi lanjutan (masih tanggal sama):** 4 tabrakan
  yang tadinya cuma di-skip untuk review manual ternyata, setelah baris
  sumbernya dicek satu-satu, adalah PRODUK FISIK YANG SAMA — dicatat dua kali
  dengan Tipe/Motif tertukar di dua baris sumber berbeda (contoh: satu baris
  Tipe `Reggio` + Motif `Grey`, baris lain Tipe `Reggio Grey` + Motif kosong;
  pola sama untuk Rotterdam Cream, Stone White, Xenith Cream — semua brand
  `Infiniti`). Skrip diperbarui untuk auto-merge kasus ini, bukan sekadar
  melapor: satu kandidat (pemenang) dipromosikan, kandidat lain di-dismiss
  (`review_status = DISMISSED`, non-destruktif, `decision_notes` menunjuk ke
  pemenang), dan `SampleCandidate` yang menunjuk kandidat yang di-dismiss
  dipindah ke `material_candidate_id` pemenang supaya link Sample-nya tetap
  resolve setelah promosi. Auto-merge HANYA berjalan bila `category_tags`
  kedua kandidat juga sama (pengaman tambahan di luar kunci dedup kanonis
  vendor+brand+sku); bila kategori beda, kandidat tetap PENDING dan dilaporkan
  untuk keputusan manusia.
- **`node --check` lulus.** `--validate-only` benar-benar dijalankan atas
  `docs/masterdata-seed/06_material_candidates.csv` dan menghasilkan: 273
  kandidat Sheet1, 176 eligible, **172 akan confirm+promote** (termasuk 4 yang
  auto-merge dari duplikat), 0 tabrakan kategori tak sepakat, 97 tidak
  tersentuh karena Vendor belum match (`Roman`/`Niro`/`Artile`/dll — masalah
  terpisah).
- **`--dry-run` dicoba dan gagal dengan jelas**: `Can't reach database server
  at 127.0.0.1:5432`. Sandbox agent ini adalah workspace Linux terisolasi yang
  me-mount folder project tetapi TIDAK punya rute jaringan ke Postgres lokal
  milik pengguna (Docker di mesin Windows pengguna, exact sama seperti guard
  yang sudah ada di `scripts/resolve-import-actor.mjs`). Ini bukan soal
  permission — koneksi TCP-nya sendiri ditolak. Akibatnya `--apply` juga tidak
  bisa dijalankan dari sini.
- **Belum ada tulisan ke database sama sekali pada entri ini.** Tidak ada
  backup baru, tidak ada Material baru, tidak ada AuditLog baru dari
  operasi ini.
- Command yang perlu dijalankan pengguna (atau agent lain yang punya akses
  jaringan ke DB) untuk melanjutkan, setelah backup baru dibuat:
  ```powershell
  node scripts/curate-sheet1-sku-motif.mjs --dry-run --actor-email berkah.rad@gmail.com
  # setelah dry-run terlihat benar:
  node scripts/curate-sheet1-sku-motif.mjs --apply `
    --actor-email berkah.rad@gmail.com `
    --backup D:\path-di-luar-project\studioflow_before_sheet1_sku_curation.dump `
    --backup-sha256 <SHA256> `
    --pg-restore-container <nama-container-postgres> `
    --ack-review
  ```
- Actor yang valid untuk `--actor-email`: `berkah.rad@gmail.com` (ADMIN),
  dikonfirmasi masih ada dan capable per catatan di
  `scripts/resolve-import-actor.mjs`.

### 2026-07-31 — Temuan: SKU dapat diturunkan dari Tipe+Motif pada Sheet1 (belum diterapkan, hanya analisis)

- **Ini analisis statis di luar importer, bukan hasil `--validate-only`/
  `--dry-run` yang benar-benar dijalankan.** Tidak ada file staging, script,
  guide, atau database yang diubah pada entri ini.
- Pemilik produk (Raychie/owner) mengonfirmasi bahwa untuk `Sheet1` (287 baris
  sample fisik), `SKU = Tipe + " " + Motif` (bila Motif ada; Tipe saja bila
  Motif kosong) — misalnya Tipe `Terrain` + Motif `Gravel` = `Terrain Gravel`.
  Ini konsisten dengan brand lain di kolom `Tipe` yang sudah berbentuk kode
  langsung (`GT 602153R`, `GNL 01 MP`, `ZH 6497 Gravity`), bukan konsep baru.
- Verifikasi kuantitatif atas `docs/masterdata-seed/06_material_candidates.csv`
  dan workbook sumber:
  - 273 dari 273 MaterialCandidate asal `Sheet1` punya Tipe dan/atau Motif
    non-kosong, sehingga SKU turunan dapat dihitung untuk semuanya.
  - Kunci `vendor + brand + sku` turunan hanya collide pada 4 pasangan, seluruhnya
    di Vendor `Infiniti` yang sama — konsisten dengan dua unit fisik dari
    Material yang sama, bukan tabrakan identitas.
  - 176 dari 273 baris blocker-nya **hanya** `SKU eksplisit tidak tersedia`;
    menerapkan aturan ini akan membuka blocker itu. `product_name_confirmed`
    kosong pada seluruh 176 baris ini, tetapi kolom `Tipe` yang sama
    (`source_product_or_type`) juga memenuhi syarat guide §3 "product_name
    harus diambil dari kolom tipe/seri/model yang benar-benar mengidentifikasi
    produk" — sehingga `product_name = Tipe` dan `sku = Tipe + Motif` dapat
    diisi dari kolom sumber yang sama tanpa mengarang nilai.
  - 97 baris sisanya masih diblokir alasan lain: 88 Vendor tidak match ke
    direktori `List`, 8 di antaranya Brand kosong, 1 juga Tipe/seri kosong.
    Brand pada 97 baris ini didominasi `Roman` (26), `Artile` (25), `Niro`
    (18) — lihat item Vendor fuzzy-match di atas.
  - Tidak ada harga (`price_before_discount`/`price_after_discount`) pada
    176 baris ini; promosi akan menghasilkan Material `BQ_NOT_READY`, bukan
    blocker.
- Rekomendasi, belum dieksekusi: (1) tambahkan aturan ini ke
  `docs/MASTERDATA_CSV_SEEDING_GUIDE.md` §3 sebagai turunan eksplisit untuk
  sumber `Sheet1`, (2) update `scripts/import-masterdata-seed.mjs` untuk
  mengisi `sku_confirmed`/`product_name_confirmed` dari `Tipe`/`Motif` saat
  `source_sheet = Sheet1`, (3) jalankan `--validate-only` lalu `--dry-run`
  sungguhan untuk konfirmasi angka di atas terhadap database aktual sebelum
  promosi massal.
- Peringatan: pola ini divalidasi dari konsistensi internal data (rendahnya
  tabrakan kunci), bukan dari konfirmasi katalog resmi brand. Spot-check ke
  katalog Artile/Wisma Sehati/Venus dianjurkan sebelum menerima sebagai aturan
  final, karena `sku` di kontrak kanonis wajib "kode artikel pabrikan".

### 2026-07-31 — Antrean kurasi kandidat diterapkan

- Menambahkan migration additive
  `20260731234000_add_masterdata_curation_queue` untuk
  `master_data.MaterialCandidate`, `master_data.SampleCandidate`, dan enum
  status `PENDING/DISMISSED/PROMOTED`.
- Menambahkan `/masterdata/curation`, searchable Vendor/Material picker,
  View-First `Modify`, edit/dismiss/reopen, dan promosi ter-audit. Promosi
  Material tetap menghasilkan Material `PENDING`; kandidat sendiri tidak
  usable.
- Menerapkan 756 MaterialCandidate dan 287 SampleCandidate sebagai `PENDING`
  atas nama owner `Raychie`. Material/Sample kanonis tetap nol.
- Backup:
  `backup_before_curation_queue_20260731_162105.dump` (529.903 bytes),
  SHA-256
  `33A067D60B6095B8A770E74FDC691517E078FEFA3663017E708B22F7CA1BD86D`.
- Restore-test, migration deploy/status/diff, apply, idempotency, orphan/duplicate
  checks, Prisma validate/generate, TypeScript, targeted ESLint, dan production
  build lulus. Project/Schedule tetap 11/79/79; AuditLog menjadi 6.039.

### 2026-07-31 — Reviewed Vendor seed diterapkan

- Membuat backup penuh custom-format di luar project:
  `backup_before_masterdata_seed_20260731_155335.dump` (409.094 bytes),
  SHA-256
  `3AAB2B68CED502FEE960BFD03C6EDFF1BE01A161237F004821DD888BD8D43AE9`;
  backup lolos `pg_restore --list`.
- Menerapkan seed sebagai owner `Raychie` dalam satu transaksi: 392 Vendor,
  399 VendorContact, dan 1.010 VendorLink. Material, Sample, dan movement tetap
  nol; seluruh data sumber masih harus dikurasi ulang.
- AuditLog naik dari 4.604 ke 4.996. Project/Schedule tetap 11/79/79.
- Dry-run sesudah apply idempotent: 0 create/enrich dan seluruh payload reuse.
  Relasi yatim dan duplikasi yang diperiksa semuanya nol.
- Menambahkan opsi importer `--pg-restore-container` karena PostgreSQL client
  tidak tersedia di PATH host; guard backup lain tetap berlaku.

### 2026-07-31 — Workbook diubah menjadi reviewed Master Data seed

- Membaca ulang `docs/RAD - Material + Supplier.xlsx` terhadap kontrak kanonis,
  bukan memakai payload legacy.
- Menghasilkan `docs/masterdata-seed`: 392 Vendor, 399 contact, 1.010 link,
  0 Material, dan 0 Sample. Tiga kandidat Vendor tanpa bukti supplier diblokir.
- Menghasilkan 756 kandidat Material dan 287 kandidat Sample; semua row yang
  belum mempunyai SKU nyata atau Material induk tetap berada di review queue.
- Menambahkan importer guarded dengan validation-only, dry-run, dan apply
  transactional. Apply membutuhkan actor nyata, backup di luar project,
  SHA-256, `pg_restore --list`, dan `--ack-review`.
- Validation-only dan dry-run database lokal lulus; dry-run merencanakan
  392/399/1.010 create dan nol Material/Sample dengan nol write.
- Database Master Data tetap kosong. Tidak ada seed apply, perubahan schema,
  migration, atau UI aplikasi.
- Review workbook:
  `outputs/019fb6c2-e3c1-7972-bde7-64e5e5e13cda/masterdata-seed-v2/masterdata-seed-review.xlsx`.

### 2026-07-31 — Landing route setelah login mengikuti role

- Memperbaiki `src/components/login-form.tsx` yang hardcode `router.push("/")`.
  Akibatnya `STAFF` mendarat di StudioFlow (bukan `/masterdata`) karena masih
  memegang akses StudioFlow legacy, dan `ESTIMATOR` sempat menyentuh `/` sebelum
  dipantulkan guard layout ke `/bq`.
- Login form sekarang membaca session yang baru terbit lewat `getSession()` dan
  push ke `landingRouteFor(role)`. Role yang hilang/tidak dikenal jatuh ke
  landing least-privilege, bukan ke `/`.
- Menghapus `login` dari matcher di `src/proxy.ts`. Sebelumnya cabang
  `pathname === "/login"` di `auth.config.ts -> authorized()` adalah dead code,
  sehingga user yang sudah login dan membuka `/login` melihat form login lagi.
- `APP_ACCESS` dan `LANDING_ROUTE` tidak diubah — keduanya sudah benar.
  `LEGACY_LIBRARY_ACCESS_FOR_STAFF` sengaja tetap `true`.
- Tidak ada perubahan schema, migration, permission, atau data database.
- Verifikasi yang benar-benar dijalankan: `tsc --noEmit` lulus, ESLint pada dua
  file tersentuh nol error/warning, `scripts/verify-access-matrix.mjs` lulus.
  Production build TIDAK dijalankan (`next build` bus error di sandbox
  verifikasi) dan belum ada QA login runtime.

### 2026-07-31 — Konfirmasi lifecycle kurasi sementara

- Owner mengonfirmasi lifecycle sementara: `PENDING` dan `APPROVED` sama-sama
  usable; `REJECTED` berarti data ditakedown dari pilihan baru.
- Takedown tidak destruktif terhadap snapshot project yang sudah menyimpan
  Material tersebut.
- Tidak ada perubahan kode, schema, migration, UI, atau data database karena
  implementasi sebelumnya sudah menjalankan kontrak ini.

### 2026-07-31 — Searchable Vendor dan kurasi Pending-usable

- Mengganti pilihan Vendor di form Material menjadi searchable relational
  combobox yang menutup ketika kehilangan fokus.
- Menambahkan aksi “Tambah vendor baru” yang membuka dialog Vendor, mem-prefill
  nama hasil pencarian, memilih Vendor yang baru disimpan, lalu memakai
  `router.refresh()`.
- Menambahkan role `CURATOR` melalui migration additive dan permission approval
  Material yang terpisah. `STAFF` tidak lagi dapat approve/reject.
- Semua direct Material intake dan edit non-kurator berstatus `PENDING`;
  `PENDING` tetap usable di Library/Schedule, sedangkan `REJECTED` diblokir.
- Backup sebelum deploy:
  `backup_before_curator_role_20260731_145029.dump`, SHA-256
  `92D5E8406CC11D74059BD57B4850986FE70E827D2AADA4E7716884079AE5A715`.
- Prisma validate/generate/deploy/status/diff, TypeScript, targeted ESLint,
  access matrix, dan production build lulus. Visual QA terautentikasi masih
  terbuka karena browser berhenti di login.

### 2026-07-31 — Menetapkan log handoff permanen

- Membuat `CHANGELOG-CODEX.md` sebagai titik masuk konteks agent berikutnya.
- Merangkum kontrak Master Data, implementasi, kondisi database, backup,
  verifikasi, pekerjaan terbuka, serta risiko worktree.
- Menambahkan kewajiban pemeliharaan file ini ke `AGENTS.md`.
- Tidak ada perubahan kode aplikasi, UI, schema, migration, atau data database
  pada pembaruan dokumentasi ini.
