# Next.js & Prisma Agent Rules (RADSAAS_2)

## 🧑‍⚖️ Pembagian Peran — Codex menulis kode, Claude mereview (berlaku 2026-08-18)

> **Keputusan owner 2026-08-18:** mulai sekarang **eksekusi coding proyek ini
> dipegang Codex.** Aturan di bawah mengikat setiap sesi Claude dan wajib dibaca
> sebelum menyentuh berkas apa pun. Ringkasan keadaan repo + daftar keputusan
> yang tidak boleh dimundurkan ada di **`HANDOFF-CODEX.md`**.
>
> **Catatan owner 2026-08-24:** requirement produk hidup di
> **`PRD-Architecture-Cleanup-v2.md`**. Jika ada bagian product/business di
> `AGENTS.md` yang masih tertinggal dan bertentangan dengan PRD, **PRD yang
> menang**. `AGENTS.md` memegang aturan kerja agent; cleanup isi legacy di
> dalamnya berlangsung bertahap.

### Claude — peran utama: product specialist & reviewer

Default sebuah sesi Claude adalah **tidak menulis kode produksi.** Yang
dikerjakan Claude:

1. **Mereview hasil coding Codex** terhadap §🧱 Master Data Contract (v2),
   `prisma/schema.prisma`, dan `changelog.md`. Temuan menyebut berkas + baris,
   bukan kesan umum.
2. **Menjaga dokumen** — `changelog.md`, `roadmap.md`, `AGENTS.md`,
   `HANDOFF-CODEX.md` — termasuk membetulkan klaim dokumen yang ternyata tidak
   sesuai kode (lihat aturan 5 §AI Main Lead Governance).
3. **Menyiapkan spesifikasi** untuk Codex: masalahnya apa, berkas mana, kontrak
   mana yang mengikat, dan cara memverifikasi hasilnya.
4. **Menjawab pertanyaan produk** — kenapa sebuah aturan ada, apa dampak sebuah
   perubahan, mana yang regresi dan mana yang memang keputusan.

### Kapan Claude BOLEH menulis kode

Hanya tiga keadaan, dan masing-masing harus bisa **ditunjuk buktinya**:

| # | Keadaan | Buktinya |
|---|---|---|
| 1 | Item **sudah disepakati** di `roadmap.md` | ada barisnya, dan tidak bertanda ⏳ owner / 🔒 migrasi yang belum dijawab |
| 2 | Pekerjaan **belum selesai** menurut `changelog.md` | entri terakhir menyebutnya sebagai pekerjaan terbuka atau setengah jadi |
| 3 | **Permintaan langsung owner** di sesi itu | owner memintanya dengan kata-katanya sendiri |

Di luar ketiganya: **tulis usulannya, jangan tulis kodenya.** *"Sekalian saja
saya perbaiki"* bukan salah satu dari tiga, dan justru cara paling umum sebuah
keputusan yang sudah dibayar mahal ikut termundurkan.

### Batas yang tidak berubah

- Tanda 🔒 (skema/migrasi) dan ⏳ (keputusan owner) tetap berlaku penuh. Peran
  reviewer **tidak** memberi wewenang tambahan — ia mengurangi.
- Kalau review menemukan cacat, hasilnya **temuan + usulan perbaikan**, bukan
  commit — kecuali salah satu dari tiga keadaan di atas berlaku.
- Aturan 8 (Agent Handoff Log) tetap mengikat Claude: sesi yang mengubah
  dokumen tetap wajib menulis entri `changelog.md`.
- Sebelum menyimpulkan sebuah item roadmap masih terbuka, **cek kodenya.**
  Roadmap berkali-kali terbukti lebih usang daripada kode yang dijelaskannya.

## ⚠️ Critical Environment Warning
This project uses specific Next.js APIs and Prisma configurations that may differ from your base training data. 
- ALWAYS check `node_modules/next/dist/docs/` for recent API changes.
- HEED all deprecation notices immediately.

## 🛡️ Runtime & Configuration Audit
"Setiap kali melakukan perubahan pada konfigurasi sistem (Prisma, Next Config, Tailwind), kamu WAJIB melakukan validasi silang antara file konfigurasi (`schema.prisma`) dengan file implementasi (`src/lib/db.ts`) untuk memastikan tidak ada mismatch pada provider atau pathing."

## 🧪 Database Integration Test Protocol (keputusan owner 2026-08-19)

1. `npm test` tetap suite murni tanpa I/O dan tidak boleh dibuat bergantung pada
   Docker.
2. Query yang bergantung pada perilaku PostgreSQL/Prisma (raw SQL, aggregate,
   filter relasi, multi-schema, index, atau migrasi) diuji lewat
   `npm run test:integration:docker`. Mock Prisma tidak menjadi bukti untuk
   semantik-semantic tersebut.
3. Service Compose `db-test` adalah database **disposable** di loopback, memakai
   `tmpfs`, port berbeda dari DB development, dan dibuang setelah suite—termasuk
   saat suite gagal. DILARANG mengganti targetnya menjadi service `db` atau
   volume `postgres_data` development.
4. Jalur manual `npm run test:integration` wajib memakai `TEST_DATABASE_URL`.
   Runner harus tetap fail-closed: hanya host loopback, nama DB berakhiran
   `_test`, tidak pernah fallback ke `DATABASE_URL`, dan menolak URL yang sama
   dengan `DATABASE_URL`/`DIRECT_URL` yang diwarisi proses.
5. Seluruh migrasi diterapkan ke database disposable sebelum test. Fixture
   memakai identitas unik, membersihkan dirinya, dan pool PostgreSQL ditutup
   eksplisit agar proses tidak menunggu idle timeout.

## 🔄 UI Refresh Protocol
"DILARANG menggunakan `window.location.reload()`. Gunakan `router.refresh()` dari `next/navigation` untuk melakukan revalidasi data tanpa memuat ulang seluruh halaman."

## 🧨 Destructive Confirmation Protocol

1. **DILARANG memakai `confirm()` / `window.confirm()`.** Browser dapat
   menawarkan untuk menonaktifkan dialog berulang, sehingga aksi berikutnya
   berjalan tanpa konfirmasi yang diketahui aplikasi.
2. Gunakan `useAppConfirm` dari `src/hooks/use-app-confirm.tsx`, tunggu hasil
   boolean-nya sebelum memulai mutasi, dan render `dialog` yang dikembalikan
   hook di component yang sama.
3. Aksi dengan dampak massal atau sulit dipulihkan wajib memakai
   `requiredText`, bukan dua dialog beruntun. Frasa harus spesifik terhadap
   cakupan aksinya (contoh: `DELETE ALL`).

## 🔍 Deep Context Scan Protocol
"Gunakan fitur @Codebase atau Indexing di IDE ini untuk membaca seluruh keterkaitan file sebelum men-generate kode baru. Jangan hanya mengandalkan file yang sedang terbuka atau linting standar."

## 🎨 Visual Identity (Studioflow)
"Gunakan font Lora (serif) untuk heading/judul dan Inter (sans-serif) untuk UI fungsional. Gunakan design tokens (`font-serif`, `font-sans`, `border-subtle`). Pastikan desain tetap bersih dengan border halus (slate-200) dan background slate-50."


## 🗣️ Bahasa Antarmuka (keputusan owner 2026-08-18)

**Semua teks yang dibaca pengguna di layar ditulis dalam Bahasa Inggris** —
tombol, label, judul kolom, menu, placeholder, tooltip, empty state, **termasuk
pesan error**. Berlaku untuk Claude maupun Codex, dan berlaku untuk teks baru
maupun teks lama yang kebetulan disentuh.

Yang **tetap Bahasa Indonesia**: `changelog.md`, `roadmap.md`, `AGENTS.md`,
`HANDOFF-CODEX.md`, dan komentar kode. Itu dokumen internal untuk owner dan
agent, bukan permukaan produk.

Konsekuensi yang harus **dikerjakan**, bukan didiamkan: `mapKnownPrismaError()`
di `action-wrapper.ts` (dibuat #27) memetakan error Prisma ke pesan berbahasa
Indonesia. Pesan-pesan itu wajib diterjemahkan ke Inggris — dan tetap harus bisa
ditindaklanjuti (*"Name is already used by another supplier"*), **bukan** kembali
ke pesan Prisma mentah. Mengembalikannya jadi mentah adalah regresi #27, bukan
penerapan aturan ini.

Menutup item roadmap **M5**. **UI-CON-3** (header kolom tabel Services yang
campur) ikut terbuka untuk dikerjakan.

## 🚫 UI/UX Preservation Protocol
"DILARANG KERAS mengubah struktur tata letak (layout) yang sudah ada—seperti mengganti sidebar menjadi tab horizontal—tanpa permintaan eksplisit dari pengguna. Jangan menambahkan elemen estetika 'Premium' (shadow berlebih, animasi kompleks, font dekoratif baru) jika tidak diminta. Pertahankan fungsionalitas di atas hiasan visual."

## 🏷️ Project Naming Protocol
"Format nama proyek WAJIB menggunakan: `[Tahun]-[Nomor] [Nama Proyek]`. Contoh: `2025-429 Heloskin Cimanggu`. Pastikan ada spasi (bukan dash) antara nomor urut dan nama proyek."

## ✏️ Edit-First Protocol (menggantikan View-First, 2026-08-14)

> **DICABUT:** aturan lama berbunyi *"Setiap modal/form untuk data yang sudah ada WAJIB dibuka dalam mode read-only secara default. Gunakan tombol 'Modify' (icon Edit3) sebagai gatekeeper."* Owner mencabutnya 2026-08-14: *"tidak perlu double gini, saat diklik lgsg aja ada inline edit (ga usa di pencet 'modify' lagi)"*. Jangan mengembalikannya. Kalau menemukan tombol "Modify" yang tersisa di suatu dialog, itu sisa yang belum dibersihkan — hapus.

Aturan yang berlaku sekarang:

1. **Terbuka langsung bisa disunting.** Modal/form untuk data yang sudah ada membuka fieldnya dalam keadaan siap diketik. Tidak ada langkah "Modify".
2. **Yang menentukan hanyalah izin.** `editable` diturunkan langsung dari hak akses (`canManage`, `access.canEdit`, dst.), bukan dari state UI. Pengguna tanpa izin tetap melihat mode baca — mode read-only TIDAK dihapus dari kode, ia hanya berhenti menjadi default.
3. **WAJIB: pengaman di pintu keluar.** Setiap dialog yang bisa disunting HARUS memakai `useUnsavedChangesGuard` + `<UnsavedChangesPrompt>` dari `src/hooks/use-unsaved-changes-guard.tsx`. Menutup dengan perubahan tertunda memunculkan konfirmasi; menutup tanpa perubahan langsung tertutup tanpa gangguan. Ini bukan hiasan — ia satu-satunya pengganti perlindungan yang dulu diberikan tombol Modify.
4. **Setelah save, tutup lewat `guard.closeAfterSave()`,** bukan `onOpenChange(false)`. Pada saat itu form memang berbeda dari snapshot, dan bertanya "yakin buang perubahan?" tepat setelah menyimpannya adalah pertanyaan yang salah.
5. **Satu tombol tutup saja.** `DialogContent` sudah merender tombol X di `absolute right-4 top-4`. Jangan menambah tombol tutup sendiri, dan beri `pr-12` pada header yang isinya merapat ke kanan.
6. **Tabel Brands bukan editor inline.** Nama, Category, dan Hashtag di landing
   table hanya presentasi; satu-satunya jalur edit adalah **Edit full details**
   pada menu Actions, yang membuka dialog langsung editable sesuai aturan di
   atas. Jangan menghidupkan kembali input atau save/cancel per baris.

## 🧹 Checklist Retention (keputusan owner 2026-08-18)

1. `ProjectChecklist` manual yang sudah dicentang disimpan selama **7 hari**,
   lalu eligible untuk dihapus permanen. Begitu proyek berstatus `COMPLETED`,
   batas retensi dianggap langsung lewat walaupun `checked_at` masih baru atau
   `null`.
2. Penghapusan dijalankan oleh
   `scripts/purge-expired-checklist-tasks.mjs --apply` melalui crontab VPS.
   Tanpa `--apply` skrip WAJIB dry-run dan tidak boleh menulis data.
3. Baris `template_id !== null` **tidak pernah** dihapus purge otomatis.
4. Karena `parent_id` memakai `onDelete: Cascade`, child eligible WAJIB dihapus
   lebih dulu. Parent hanya boleh dihapus setelah database memastikan tidak ada
   child tersisa; satu child yang belum eligible atau berasal dari template
   menunda seluruh parent.
5. Retensi ini hanya untuk `ProjectChecklist`. `Activity` (`TODO`/`FEEDBACK`)
   tidak punya `checked_at` dan tidak ikut purge tanpa keputusan + migrasi baru.

## 🔖 Saved Checklist Filters (keputusan owner 2026-08-19)

1. Filter personal disimpan di `studioflow.ChecklistFilterView`, selalu di-scope
   oleh `owner_id`; user tidak boleh membaca, menimpa, atau menghapus filter user
   lain.
2. `query_json` wajib berupa objek terstruktur dengan predicate `status`,
   `priority`, `assignee`, dan `due`. DILARANG menyimpan atau mengeksekusi DSL
   teks bebas.
3. Nama unik per owner. Menyimpan nama yang sama memperbarui predicate filter
   milik owner tersebut, bukan membuat duplikat.
4. Model ini hanya preferensi tampilan Tasks. Ia tidak mengubah task, assignee,
   due date, priority, atau data proyek apa pun.

## 📐 Design System Enforcement (Zero Hardcode Policy)
"DILARANG KERAS menggunakan nilai hardcoded untuk visual properties (misalnya `rounded-xl`, `p-5`, `shadow-md`, `text-2xl`). Kamu WAJIB melakukan hal berikut:
1. **Cross-Check Tokens**: Selalu periksa `src/ui_engine/design-system.config.ts` dan `src/styles/designTokens.css` sebelum menulis kode UI.
2. **Use Semantic Tokens**: Gunakan variabel CSS (misal `rounded-[var(--radius-premium)]`) atau config object (`DESIGN_SYSTEM_CONFIG.spacing.radius`).
3. **Consistency over Speed**: Jangan menebak-nebak nilai. Jika token tidak ditemukan, tanyakan atau gunakan nilai yang paling mendekati dari konfigurasi yang ada."


## 🧱 Pillar 2 Resilience Protocol
1. **Explicit Promotion**: Material catalog data bersifat 'Master'. Project data harus di-snapshot (PRD 2 rules). Data dari project TIDAK BOLEH auto-sync ke Library tanpa validasi eksplisit.
2. **Gatekeeping**: 
   - **Stage 1 (Mandatory Color)**: Diperlukan untuk update snapshot lokal.
   - **Stage 2 (Identity + Media)**: SKU, Product Name, Brand, dan Image WAJIB lengkap sebelum tombol 'Promote to Library' diaktifkan.
3. **Audit Mandatory**: Setiap mutasi pada Library atau Scheduler Category WAJIB mencatat `insertAuditLog`.
3. **No Legacy Models**: DILARANG mengekspos atau menggunakan model `GlobalLibrary` dan `ProjectSchedule`. Gunakan `ProductCatalog` dan `ProjectScheduleEntry`.
4. **Deterministic Coding**: Semua kode scheduler harus dikelola melalui `ScheduleService.normalizeCodes` untuk memastikan integritas prefix.
5. **Terminology Architecture**: WAJIB menggunakan namespaced prefix (`catalog_`, `schedule_`). Format identitas produk: `[catalog_sku] - [catalog_product_name] ex. [catalog_brand]`.
6. **Documentation First**: "Apabila mengedit `src/extensions/schedule/`, kamu WAJIB membaca [src/extensions/schedule/README.md](file:///d:/Misc/ProjectsHUB/radsaas-2/src/extensions/schedule/README.md) terlebih dahulu untuk memahami workflow snapshotting dan terminologi Pillar 2."
7. **Zod Schema Namespacing**: Setiap Zod Schema yang merefleksikan model Prisma WAJIB menggunakan nama field yang identik dengan schema (mis. `schedule_category`, bukan `category`). DILARANG melakukan mapping di level Action jika field tersebut bersifat inti.

## 🧱 Master Data Contract (v2)

> **DITULIS ULANG 2026-08-18.** Versi sebelumnya masih mendeskripsikan Master
> Data **v1** — `Material`, `catalog_brand`, `MaterialCandidate`,
> `SampleCandidate`, `/masterdata/curation`, `ServiceVendor`, harga
> sebelum/sesudah diskon, status `PENDING`/`REJECTED`. **Tidak satu pun masih
> ada** setelah rebaseline `20260810180000_masterdata_v2_rebaseline`. Aturan yang
> menyebut model yang tidak ada bukan hanya tidak berguna — ia membuat agent
> berikutnya mencari-cari model itu, lalu membuatnya kembali. Riwayat lengkapnya
> ada di `docs/archive/`; jangan hidupkan kembali dari sana tanpa perintah owner.

### 0. TERMINOLOGI — baca ini sebelum aturan di bawah

- **Party** — satu badan usaha atau perorangan. `name` nama dagang, `legal_name`
  badan hukum. Satu tabel untuk semuanya; PERANNYA dinyatakan `PartyRole`
  (`MANUFACTURER`, `DISTRIBUTOR`, `SUPPLIER`, `RETAIL`, `SUBCON`,
  `SERVICE_VENDOR`), bisa lebih dari satu. **Tidak ada tabel Company, Vendor,
  atau ServiceVendor yang terpisah.**
- **Brand** — merek/pabrikan sebuah material. Relasional. Boleh punya `owner`
  (sebuah Party), boleh tidak — Excel mengizinkan merek tanpa perusahaan di
  belakangnya (X6).
- **Vendor** — **penyedia JASA** (tukang, aplikator, workshop). Ia adalah Party
  ber-`SERVICE_VENDOR` atau `SUBCON`, dan muncul sebagai
  `WorkPrice.vendor_party_id`. **Vendor BUKAN merek.** Membalik dua istilah ini
  adalah kesalahan yang paling sering terjadi di basis kode ini.
- **Supplier** — pihak yang MENJUAL barang, muncul sebagai
  `SkuPrice.supplier_party_id`. Perannya tidak harus `SUPPLIER`: contoh Excel
  sendiri (Ace Hardware, Informa) berperan `RETAIL`. Daftar peran yang sah ada
  di `services/party-role-rules.ts#PRICE_SOURCE_ROLES` — pakai itu, jangan
  menulis filter peran sendiri.
- **Sku** — satu jenis barang. `code` adalah kode artikel pabrikan
  (**nullable** — Q7: kode artikel adalah fakta tentang barang, bukan kunci
  basis data). `brand_id` juga nullable: barang generik ("plywood 9mm") sah
  tanpa merek.
- **Sample** — satu benda fisik di rak. Menunjuk tepat satu `Sku`.

### 1. Domain kanonik

`Party → Brand → Sku → Sample`, dengan harga menggantung di samping:
`SkuPrice` (harga barang) dan `WorkPrice` (harga jasa/paket).

**Tidak ada denormalisasi nama.** v1 menyimpan `Material.catalog_brand` sebagai
salinan nama Brand; v2 tidak — nama dibaca lewat relasi. Yang membekukan nama
hanyalah snapshot proyek (`ProjectScheduleOption`, `ProjectProductRequest`), dan
itu memang tugasnya.

### 2. Keunikan yang dijaga DATABASE, bukan aplikasi

Beberapa jaminan tidak bisa dinyatakan `@unique` di `schema.prisma` dan ditulis
sebagai index parsial di migrasi. **Jangan menghapus atau melonggarkannya, dan
jangan menambahkan cek aplikasi yang menjawab berbeda dari index-nya** — kalau
keduanya tidak sepakat, yang menang adalah index, dan pengguna melihat error
mentah.

| Index | Menjamin | Ditulis di |
|---|---|---|
| `SkuPrice_pair_uniq` | Tepat satu baris harga per (SKU × supplier). `COALESCE` tetap wajib — di Postgres NULL ≠ NULL, jadi tanpanya dua harga pabrikan tanpa supplier sama-sama lolos | `20260824170000` |
| `Sku_slug_nobrand_uniq` | Barang tanpa merek tidak berduplikat nama | §2 |
| `Sku_brand_code_uniq` / `Sku_code_nobrand_uniq` | Kode artikel unik per merek, **di mana ia terisi** | §2 |
| `SkuCategory_primary_uniq` | Paling banyak satu kategori primer per SKU | §3 |
| `Party_name_live_uniq` / `Party_slug_live_uniq` / `Brand_name_live_uniq` / `Brand_slug_live_uniq` | Nama & slug unik **hanya di antara baris hidup**, case-insensitive | `20260818120000` |
| `Category_kind_slug_live_uniq` | `(kind, slug)` unik **hanya di antara baris `is_active`** (Category tidak punya `deleted_at`, jadi "hidup" = `is_active`, bukan soft-delete) | `20260819150000` |

Empat pertama ditambahkan 2026-08-18. Keempat tabel itu memakai soft-delete,
dan `@unique` tanpa syarat berarti baris yang sudah dihapus memegang namanya
selamanya. **Konsekuensi untuk kode: `Party.name`, `Party.slug`,
`Brand.name`, `Brand.slug` tidak lagi `@unique` di Prisma.
`findUnique({ where: { name } })` tidak sah — pakai
`findFirst({ where: { name: { equals, mode: "insensitive" }, deleted_at: null } })`.**

Baris `Category` ditambahkan 2026-08-19 (audit skema, item 3) sebagai
pencegahan — Category belum punya action delete/nonaktifkan apa pun hari
ini, jadi belum ada bug aktif, tapi tanpa index ini fitur "nonaktifkan
kategori" nanti akan mengunci slug selamanya seperti yang dulu terjadi pada
Party/Brand sebelum B2. **Konsekuensi untuk kode:** `Category.kind_slug`
tidak lagi compound-unique di Prisma Client (diganti `@@index`);
`findUnique({ where: { kind_slug: { kind, slug } } })` tidak sah — dicek
tidak ada pemakaiannya di `src/subapps` sebelum perubahan ini, tapi kalau
menulis lookup baru pakai `findFirst({ where: { kind, slug, is_active: true } })`.

### 3. Harga

> **✅ KEPUTUSAN FINAL OWNER 2026-08-24 (sesi takeover, menjawab ❓U1/U3):**
> arah pricing adalah **MULTI-SUPPLIER** — setiap SKU boleh punya beberapa
> harga berlaku, satu per supplier (`SkuPrice_pair_uniq` per SKU × supplier
> tetap berlaku). Ini mencabut ratifikasi pagi hari atas PRD §15–§18 ("satu
> harga kanonik per SKU"); bagian itu tidak dieksekusi dan tidak akan
> dieksekusi. Kontrak poin 3 di bawah mengikat penuh: `SkuPrice` menyimpan
> current state per pasangan, sedangkan riwayat perubahannya hidup di audit
> generic.
> Sisa pekerjaan pricing yang disetujui owner dari audit R1:
> (a) validasi app-layer `unit` harga wajib = `sku.purchase_unit` saat tulis;
> (b) tambah kolom `updated_by_id` (plain column); (c) perbaikan komentar/
> dokumentasi. BQ tetap memilih supplier-price saat penarikan dan membekunya
> sebagai snapshot immutable.

1. **Satu harga, bukan sepasang.** `SkuPrice.price_net` dan `WorkPrice.price`
   masing-masing satu kolom. Pasangan sebelum/sesudah diskon dihapus 2026-08-14,
   dan `material_price`/`labor_price` dihapus 2026-08-11 — yang dicatat studio
   adalah harga yang benar-benar dipakai.
2. **Kosong bukan nol.** Ini aturan terpenting di bagian ini. `Number("")`
   adalah `0`, dan tarif nol tidak berhenti di Master Data: `v_bq_material_rate`
   dan `v_bq_work_rate` membacanya, lalu ia menjadi satu baris di dokumen
   komersial. Semua jalur tulis WAJIB lewat `services/sku-price-rules.ts` —
   `resolvePrice()` untuk `SkuPrice` (kosong = jangan tulis baris),
   `checkWorkPrice()` untuk `WorkPrice` (kosong = tolak). **DILARANG menulis
   `Number(input.price)` polos, dan DILARANG `?? 0`.**
3. **`SkuPrice` adalah tabel current-state per pasangan.** Tepat satu baris
   disimpan untuk setiap `(sku_id, supplier_party_id)`; mengedit penawaran
   memperbarui baris pasangan itu di tempat lewat `recordSkuPrice()`, bukan
   menutup baris lama lalu menulis supersede row baru. Riwayat perubahan harga
   hidup di `studioflow.AuditLog` melalui `recordAudit()`, bukan di lifecycle
   columns pada tabel harga.
4. **`WorkPrice.kind` dinyatakan, bukan disimpulkan.** `MATERIAL_LABOR` (Excel
   Table 3) vs `LABOR_ONLY` (Table 4). Jangan menyimpulkannya dari kolom mana
   yang terisi — itu justru cacat yang migrasi `20260811120000` buang.
5. **Kolom `qty` SUDAH DIHAPUS** dari `SkuPrice` dan `WorkPrice` (migrasi
   `20260820202000`; sebelumnya disimpan tanpa arti karena Excel punya
   kolomnya — keputusan owner Q12/X12). **Jangan menghidupkannya kembali, dan
   jangan menambahkan kolom kuantitas apa pun ke tabel harga.** `price`
   selalu berarti harga per satu unit.
6. BQ boleh memakai harga material hanya bila harga DAN satuan keduanya ada.
7. **Satuan harga wajib = `sku.purchase_unit` saat tulis** (keputusan owner
   U2, R4 2026-08-24). Divalidasi app-layer di `recordSkuPrice()` lewat
   `checkPriceUnit()` — perbandingannya identik dengan readiness BQ
   (`bq-readiness.ts`), jadi baris yang lolos tulis tidak mungkin ditolak
   readiness. Satuan kosong mewarisi `purchase_unit`, bukan default `"pcs"`
   polos. Jalur yang sengaja mengubah satuan (dialog Pricing) memperbarui
   `Sku.purchase_unit` lebih dulu di transaksi yang sama. Impor Excel tunduk
   pada aturan yang sama.
8. **`SkuPrice.updated_by_id` adalah plain column** (keputusan owner U4, R4,
   migrasi `20260824120000`) — tanpa FK lintas schema, pola
   `SampleMovement.actor_id`. Diisi dari actor pada setiap tulis lewat
   `recordSkuPrice()`.
9. **`WorkPrice` BUKAN tabel riwayat — beda dengan `SkuPrice` di poin 3.**
   Keputusan owner 2026-08-19 (audit skema, SK1): `WorkPrice` sengaja
   satu-baris-per-`code`. Kolom lifecycle-nya (`qty`/`valid_to`/`is_current`)
   **sudah DIHAPUS** oleh migrasi `20260820202000` — bukan sekadar "ada di
   kolom tapi tidak dipakai"; `valid_from` tinggal metadata pembuatan baris.
   `updateServicePriceAction`/`updateMaterialLaborPriceAction` mengedit baris
   di tempat, dan `code` `@unique` global secara struktural mencegah pola
   supersede ala `SkuPrice`.
   Riwayat perubahan harga jasa hanya ada di `studioflow.AuditLog`.
   **Jangan** membangun `recordWorkPrice()`/`closeCurrentWorkPrice()` tanpa
   keputusan owner baru — itu perubahan arah, bukan bug yang perlu ditambal.
10. **Soft-delete SKU tidak menghapus data harga.** Menghapus sebuah SKU hanya
   mengisi `Sku.deleted_at`; seluruh `SkuPrice` yang tersimpan untuk SKU itu
   dipertahankan apa adanya untuk audit dan provenance. Pembaca aktif
   mengecualikan SKU melalui `Sku.deleted_at`, bukan dengan menghapus baris
   harga.

### 4. Kategori

Satu pohon dua tingkat di tabel `Category`, dibedakan `CategoryKind`
(`PRODUCT` untuk barang, `WORK` untuk jasa). Tingkat 1 menjawab "PERANNYA apa di
pekerjaan" (Finishing, Hardware, MEP); tingkat 2 menjawab "BARANGNYA apa" (HPL,
Engsel, Lampu).

- Kategori dibuat saat pertama dipakai lewat `resolveCategoryPath()`, **tidak
  di-seed**. Itu satu-satunya fungsi yang boleh membuat baris `Category`.
- **Setiap lookup kategori WAJIB memfilter `kind`.** `Category` unik pada
  `(kind, slug)`, jadi "Finishing" ada dua kali — sekali `PRODUCT`, sekali
  `WORK`. Lookup tanpa `kind` bisa melampirkan kategori tarif kerja ke sebuah
  material.
- `Category.path` ("bahan-baku/plywood") adalah denormalisasi untuk
  `LIKE 'bahan-baku/%'`. Kalau `path` sebuah kategori berubah, **path seluruh
  keturunannya harus ikut** — kalau tidak, subtree query diam-diam melewatkan
  mereka.
- Jangan menghidupkan kembali tabel Category/Product terpisah dari v1.

### 5. Sample

1. Sample berarti benda fisik dan menunjuk **tepat satu** Sku. "Tidak tersedia"
   diturunkan dari nol sample **hidup**, tidak pernah dari baris Sample dummy.
2. `SampleStatus` punya **lima** nilai: `AVAILABLE`, `BORROWED`,
   `SENT_TO_CLIENT`, `LOST`, `DISCARDED`. **DILARANG menulis fungsi yang
   memetakannya menjadi lebih sedikit.** Sampai 2026-08-18 ada tiga fungsi
   semacam itu (`toLegacySampleStatus`, `toV2SampleStatus`,
   `catalogSampleStatusToV2`), semuanya kompensasi untuk enum `schema.prisma`
   yang tertinggal dari database — dan akibatnya sample HILANG tampil sebagai
   "Dipinjam" pada satu-satunya layar yang menjawab "benda ini di mana".
3. `LOST` dan `DISCARDED` adalah keadaan AKHIR: tidak di rak, tidak dipegang
   siapa pun. Keduanya **tidak** menuntut nama peminjam, dan **tidak** dihitung
   sebagai sample hidup.
4. Kalau menambah nilai ke enum: ubah `prisma/schema.prisma` **dan** tulis
   migrasi `ALTER TYPE`-nya dalam commit yang sama. Menulis salah satunya saja
   menghasilkan drift yang tidak terlihat sampai berbulan kemudian, dan Postgres
   tidak bisa `DROP VALUE` untuk memperbaikinya.

### 6. Audit

> **✅ KEPUTUSAN OWNER 2026-08-24 (PRD Architecture Cleanup v2 §20) SUDAH
> DIEKSEKUSI:** audit kini **terkonsolidasi secara fisik** ke satu tabel
> generic `studioflow.AuditLog` lintas domain (`STUDIOFLOW`, `MASTER_DATA`,
> `BQ`) plus satu shared interface `recordAudit({ domain, entityType, entityId,
> action, actorId, before, after, metadata })`. Tabel audit legacy Master Data
> sudah dibackfill lalu dihapus oleh migrasi R3. Jangan menambah tabel audit
> baru mana pun.

Setiap tulis ke tabel `master_data` WAJIB lewat `recordAudit(tx, …)` ke
`studioflow.AuditLog`, **di dalam transaksi yang sama** dengan tulisan yang
dicatatnya. Audit yang selamat dari rollback adalah kebohongan.

### 7. Transaksi

`createAction` sudah membuka transaksi (`useTransaction` default `true`) dan
menyerahkannya sebagai `tx`. **Pakai `tx`.** Jangan memakai klien `prisma`
global di dalam handler, dan jangan membuka `prisma.$transaction` bersarang di
dalamnya — keduanya berjalan di koneksi lain, commit terlepas dari transaksi
yang membungkusnya, dan bisa menunggu lock yang dipegang transaksi itu sendiri.

### 8. Batas dengan StudioFlow

`master_data` **tidak boleh bergantung** pada `studioflow`: tidak ada FK, tidak
ada join di view. `WorkPriceProjectRef.project_id` dan `SampleMovement.actor_id`
sengaja kolom biasa. Membaca daftar proyek untuk mengisi dropdown boleh — yang
disimpan adalah snapshot id + nama.

Pemeliharaan destruktif Master Data **tidak pernah** memberi wewenang mengubah
baris proyek, jadwal, snapshot, dokumen, atau operasional StudioFlow.

### 9. Bukti yang belum lengkap

Data sumber yang belum lengkap **tidak boleh** masuk ke Sku/Sample kanonik lewat
SKU karangan atau relasi tebakan. v1 punya `MaterialCandidate`/`SampleCandidate`
untuk ini; **v2 belum punya penggantinya** — jadi untuk sekarang: jangan
memasukkannya sama sekali, dan jangan mengarang. Kalau kurasi dibutuhkan lagi,
itu keputusan owner, bukan improvisasi agent.

CSV staging master-data lama adalah **bukti saja**, bukan sumber impor.

### 10. Yang sudah TIDAK ADA — jangan dibuat kembali

`Material` · `MaterialCandidate` · `SampleCandidate` · `Offering` ·
`ServiceVendor` · `ServicePrice` · `MaterialLaborPrice` · `MaterialPrice` ·
`Company` · `GlobalLibrary` · `ProjectSchedule` · `/masterdata/curation` ·
`catalog_brand` sebagai kolom · `price_list`/`price_net` sebagai pasangan ·
`material_price`/`labor_price`/`total_price` · status Material
`PENDING`/`REJECTED` (yang ada `SkuStatus`: `DRAFT`/`ACTIVE`/`DISCONTINUED`).

### 11. Status SKU dan izin harga

1. Intake SKU baru selalu masuk `SkuStatus.DRAFT` (ditampilkan UI sebagai
   `PENDING`), termasuk bila dibuat oleh approver. Approval tetap mutasi
   terpisah dan diaudit.
2. **Edit mempertahankan status yang ada.** STAFF, ADMIN, dan DEVELOPER dapat
   mengubah isi Master Data sesuai permission edit; edit oleh non-approver
   tidak boleh otomatis menurunkan SKU aktif kembali ke Draft.
3. Hanya pemegang `MASTERDATA_MATERIAL_APPROVE` yang boleh mengirim perubahan
   status eksplisit. Server wajib membuang field status dari request
   non-approver—menyembunyikan dropdown di UI saja bukan pengamanan.
4. Izin mengubah harga **tidak dipisah** dari izin mengelola supplier. Semua
   mutasi pricing memakai `MASTERDATA_VENDOR_MANAGE`; permission
   `MASTERDATA_PRICE_MANAGE` dan `MASTERDATA_OFFERING_MANAGE` tidak ada.

### 12. Kelengkapan direktori dan viewer SKU

1. Status **data lengkap** pada direktori SKU berarti `name` terisi,
   `base_unit` terisi, dan SKU mempunyai sedikitnya satu kategori `PRODUCT`
   yang hidup. Definisi ini dipakai bersama oleh query server dan presentasi
   UI; jangan membuat versi client yang menjawab berbeda.
2. `Sku.code` dan `Sku.brand_id` **bukan syarat kelengkapan** karena keduanya
   nullable secara kanonik. Keberadaan harga juga bukan syarat kelengkapan;
   ia filter terpisah berdasarkan sedikitnya satu baris `SkuPrice`.
3. Viewer SKU menampilkan seluruh harga supplier yang tersimpan lintas
   supplier. Bila riwayat perubahan harga ditampilkan, sumbernya adalah audit
   read-only; menampilkannya tidak boleh menulis atau menghidupkan kembali
   penawaran lama.

## 🧾 BQ Contract (`/bq`)

**Kontrak lengkapnya ada di `PRD-BQ.md`.** Baca itu sebelum menyentuh
`src/subapps/bq/`, `src/app/bq/`, atau schema `bq`. Jangan re-derive dari
`D:\Misc\ProjectsHUB\BQ\PRD_Fixture_Breakdown.md` maupun dari
`docs/archive/bq-2026-08/` — semuanya sudah gugur (daftarnya di PRD §8).

> **Seksi ini sengaja diringkas 2026-08-27.** Isi lamanya menjelaskan mesin yang
> sudah dibongkar tiga siklus lalu: waste berlapis, konversi otomatis, purchase
> summary, mode detail/ringkas, dan `price-drift-service.ts` yang sudah dihapus.
> Membiarkannya berarti dua dokumen saling bertentangan, dan yang dibaca agen
> berikutnya selalu yang salah.

Lima hal yang tidak boleh dilanggar tanpa keputusan owner baru:

1. **Hirarki empat lapis.** Aturannya dua kalimat:
   `Section → Sub Section DAN Works`, `Sub Section → Works saja`.
   `L0 Section` / `L1 Sub Section` (pengelompok, `BqSection`, **maks 2 lapis**,
   L1 opsional) → **`L2 Works`** (`BqObject`, satu-satunya lapis berharga:
   Qty × Harga Satuan) → `L3 Sub-Works` (koefisien × harga).
   `BqSubObject` tidak punya slot — jangan bangun fitur baru di atasnya.

2. **Seluruh aritmatika di `lib/calc.ts`, dan modul itu murni.** Tidak ada
   `reduce` atas harga di komponen, service, atau action. Satu-satunya
   pengecualian yang disengaja: `lib/section-rollup.ts`, fungsi murni dengan
   testnya sendiri. Subtotal pengelompok **wajib post-order** — loop datar
   membuat `SUBTOTAL B` jadi nol.

3. **Snapshot tidak pernah refresh.** Bukan "refresh all", bukan "refresh
   selected", tidak ada banner. Harga diambil sekali saat baris ditarik dari
   Master Data. Satu-satunya perubahan setelah itu adalah suntingan manual
   bertanda `is_manual_override`.

4. **Master Data SSOT.** Tidak ada berkas di `src/subapps/bq/` yang menulis ke
   tabel `master_data`. Baris `PROJECT_LOCAL` boleh dibuat dari picker BQ.
   Harga yang hilang tidak pernah jadi `?? 0`.

5. **Batas ditegakkan di jalur tulis, tidak pernah di jalur baca.** Data yang
   terlanjur cacat — terlalu dalam, yatim, berputar — tetap ditampilkan. Yang
   tidak tampil tidak bisa diperbaiki pengguna.

⚠️ **Jangan mengutip "AT-01 = Rp5.653.559".** Angka itu tidak ada di kode mana
pun; gerbangnya gugur bersama PRD Bab 7. Lihat PRD v2 §11 dan roadmap BQ-37.

Arah rasa & aturan UI: **`designbq.md`** — tetap berlaku penuh.


## 📚 Peta dokumen — mana yang mengikat, mana yang riwayat

Diperbarui pada perapihan 2026-08-18. Baca urutan ini, jangan yang lain:

| Berkas | Statusnya |
|---|---|
| **`AGENTS.md`** (berkas ini) | **Mengikat.** Kontrak domain + aturan kerja. Dibaca pertama. |
| **`HANDOFF-CODEX.md`** | **Mengikat.** Keadaan repo per 2026-08-18 + daftar keputusan yang tidak boleh dimundurkan + pekerjaan yang benar-benar terbuka. Dibaca kedua, sebelum `roadmap.md`. |
| **`PRD-BQ.md`** | **Mengikat untuk BQ.** PRD produk kanonik `/bq`. Menggantikan seluruh dokumen BQ lama — yang usang ada di `docs/archive/bq-2026-08/`. |
| **`HANDOFF-BQ-R3.md`** | Urutan kerja BQ untuk agent coding, beserta hasil auditnya. |
| **`designbq.md`** | **Mengikat untuk BQ.** Arah rasa & aturan UI. Tidak digantikan PRD v2. |
| **`prisma/schema.prisma`** | **Mengikat.** Bentuk data yang berlaku, beranotasi panjang. Satu-satunya yang tidak bisa basi. |
| **`changelog.md`** | **Mengikat untuk ditulis.** Riwayat perubahan + alasannya, sekaligus log handoff antar-agent (aturan 8). |
| **`roadmap.md`** | Pekerjaan yang masih terbuka. |
| `AUDIT-MASTERDATA-2026-08-18.md` · `VERIFIKASI-AUDIT-2026-08-18.md` | Laporan audit dan verifikasinya. Rujukan, bukan perintah. |
| `PLAN-AUDIT-ROADMAP-2026Q3.md` · `PLAN-LIBRARY-BRAND-FIRST.md` | ⚠️ **Menggambarkan Master Data v1 yang sudah tidak ada.** Dipertahankan hanya karena komentar kode merujuknya. Jangan dipakai sebagai acuan keadaan sekarang. |
| `docs/archive/bq-2026-08/**` | ⚠️ **Dokumen BQ pra-konsolidasi.** Empat di antaranya mengutip AT-01, gerbang yang tidak pernah ada di kode. Jangan diikuti — lihat README di dalamnya. |
| `D:\Misc\ProjectsHUB\BQ\PRD_Fixture_Breakdown.md` | ⚠️ **Gugur seluruhnya untuk BQ.** Digantikan `PRD-BQ.md`. Jangan re-derive kontrak dari sini. |
| `MASTER_SSOT.md` | ⚠️ **Diarsipkan 2026-08-18.** Yang tersisa di root hanya penunjuk arah; isi v1-nya di `docs/archive/`. |
| `docs/archive/**` | Semua yang sudah tidak berlaku. Disimpan, bukan dibuang. |

**Kalau dua dokumen bertentangan, urutan kemenangannya:**
`schema.prisma` → `AGENTS.md` → `changelog.md` → sisanya.
Kode yang berjalan mengalahkan dokumen yang menjelaskannya; kalau keduanya
berbeda, yang salah adalah dokumennya — perbaiki dokumennya, jangan diam-diam
mengubah kodenya supaya cocok.

> **⚠️ KLARIFIKASI OWNER 2026-08-24:** AGENTS.md hanya mengatur **bagaimana
> AI/agent bekerja** — ia bukan source of truth requirement produk. Untuk
> requirement produk, otoritas tertinggi adalah **Product PRD**; saat ini PRD
> yang berlaku adalah *PRD Architecture Cleanup & Consolidation v2*
> (`PRD-Architecture-Cleanup-v2.md`) untuk arsitektur, dan **`PRD-BQ.md`**
> untuk domain BQ. Konflik antara kontrak agent di sini dan
> PRD produk diselesaikan dengan memperbarui kontrak agar mengikuti PRD, bukan
> sebaliknya — dan setiap pembaruan seperti itu wajib dicatat di changelog.

## 👑 AI Main Lead Governance (Lead Agent Protocol)

As the **Main Lead**, the AI Assistant is the designated custodian of the
project's architectural integrity and documentation.

1. **SSOT Enforcement**: Setiap perubahan kode divalidasi terhadap **`AGENTS.md`
   §🧱 Master Data Contract (v2)** dan **`prisma/schema.prisma`**. *(Sampai
   2026-08-18 aturan ini menunjuk `MASTER_SSOT.md`; berkas itu ternyata masih
   menggambarkan schema v1 yang di-DROP 2026-08-10, sehingga "validasi terhadap
   SSOT" berarti memvalidasi terhadap sesuatu yang tidak ada.)*
2. **Rule Custodian**: AI bertanggung jawab memperbarui `AGENTS.md` agar
   mencerminkan evolusi arsitektur. Kontrak domain hidup di berkas ini, bukan di
   dokumen terpisah — satu tempat, supaya tidak ada dua kebenaran.
3. **Tracking & Materiality**: Setiap perubahan material (logika bisnis, schema
   persistensi, atau kontrak yang terlihat pengguna) WAJIB dicatat di
   `changelog.md`.
4. **Semantic Assessment Protocol**: Setelah tiap task, agent WAJIB menilai
   apakah ada "Semantical Change" (arsitektur, workflow, kontrak inti, atau
   aturan kanonik). Kalau YA, **`AGENTS.md` WAJIB diperbarui saat itu juga**,
   di task yang sama.
5. **Confirm-First Protocol**: Kalau ditemukan selisih antara kontrak dan kode
   yang tampaknya hasil keputusan user yang pernah disetujui tapi tidak
   terdokumentasi, agent WAJIB meminta konfirmasi eksplisit sebelum
   memperlakukannya sebagai penyimpangan.
6. **Deviation Blocking**: Kalau sebuah permintaan bertentangan dengan aturan
   kontrak, AI harus menahan implementasinya, menyatakan konfliknya, dan
   meminta override eksplisit dari user.
7. **UI Changelog Protocol**: WAJIB mencatat setiap perubahan UI (warna, radius,
   spacing, skeleton) di `changelog.md` bagian `## UI Changes`, untuk mencegah
   regresi saat pergantian agent.
8. **Agent Handoff Log**: Setiap agent WAJIB membaca **entri terbaru
   `changelog.md`** sebelum bekerja, dan menambahkan entri baru pada task yang
   sama setelah mengubah kode, schema, migrasi, konfigurasi, UI, data,
   dokumentasi acuan, atau melakukan operasi database.

   Isi minimal tiap entri: **hasil akhir · area/berkas yang berubah ·
   verifikasi yang benar-benar dijalankan · risiko · pekerjaan yang masih
   terbuka.**

   *Sampai 2026-08-18 aturan ini menuntut berkas terpisah `CHANGELOG-CODEX.md`.
   Berkas itu berhenti diperbarui pada 3 Agustus lalu diarsipkan, sementara
   `changelog.md` justru berkembang memuat persis kelima hal di atas. Dua tempat
   catat berarti satu ketinggalan — dan bukti mana yang ketinggalan sudah ada.
   Salinan lamanya di `docs/archive/docs-usang/CHANGELOG-CODEX.md`.*

   **Keputusan owner 2026-08-19:** `changelog.md` sekarang **satu-satunya**
   kanal lapor status — owner tidak lagi menjelaskan verbal apa yang barusan
   dikerjakan agent mana pun; dia cuma bilang "cek changelog" dan yang baca
   entrinya untuk mengambil keputusan berikutnya. Konsekuensinya: entri yang
   **tidak lengkap** (hasil akhir/berkas berubah/verifikasi/risiko/pekerjaan
   terbuka hilang salah satu) bukan cuma pelanggaran gaya dokumentasi — itu
   informasi yang **hilang beneran** dari satu-satunya tempat ia bisa didapat.
   Sebelum bilang "selesai" ke owner, pastikan entrinya sudah ditulis lengkap
   di `changelog.md` — bukan sesudahnya.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
