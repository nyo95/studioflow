# StudioFlow — Roadmap

**Terakhir dirapikan: 2026-08-18.** Berkas ini hanya memuat pekerjaan yang
**masih terbuka**. Seluruh riwayat, analisis, dan item yang sudah selesai
dipindahkan ke
[`docs/archive/roadmap-2026-08-18-sebelum-perapihan.md`](docs/archive/roadmap-2026-08-18-sebelum-perapihan.md)
— versi lengkap 2.268 baris, verbatim, tidak ada yang dibuang.

Alasan pemisahannya sama dengan alasan changelog diarsipkan pada 2026-08-10:
roadmap yang 90% berisi centang membuat yang belum dikerjakan mustahil
ditemukan, dan bagian "SELESAI" lama-lama dibaca sebagai rencana.

> ## ⚠️ Baca `HANDOFF-CODEX.md` lebih dulu
>
> **Sejak 2026-08-18 eksekusi coding dipegang Codex.** `HANDOFF-CODEX.md`
> versi aktif sekarang adalah **siklus 2026-08-19** (batch: LA-1 Brand↔Library,
> C-SISA-5, plus 8 item Master Data + 3 item Main App non-skema, diorganisir
> per app, dengan aturan anti-halusinasi §5). Versi 2026-08-18 (18 keputusan
> non-reversible, ditutup di #44) dipindah ke
> [`docs/archive/HANDOFF-CODEX-2026-08-18.md`](docs/archive/HANDOFF-CODEX-2026-08-18.md)
> — masih mengikat penuh, dirujuk dari handoff baru §2.3. Berkas ini tetap jadi
> rujukan detail, tapi bukan yang dibaca pertama.
>
> **Roadmap lebih sering usang daripada kodenya.** Sudah tiga kali terbukti:
> H7 ditandai butuh migrasi padahal kolomnya sudah ada; M1 meminta mengedit
> konstanta di berkas yang tidak pernah diimpor siapa pun; D5 mengklaim bagian
> Master Data selesai padahal dua berkas belum. **Cek kodenya sebelum
> mengerjakan sebuah item** — dan kalau keadaan sekarang ternyata lebih benar
> daripada yang diminta roadmap, yang dicabut adalah item roadmap-nya.

## Cara membaca

| Tanda | Arti |
|---|---|
| **⏳ owner** | Diblokir keputusan atau langkah manual Anda. Jangan dikerjakan agent sendiri. |
| **🔒 migrasi** | Menyentuh `prisma/schema.prisma` atau butuh migrasi baru. Berlaku aturan tanya-dulu. |
| **§n** | Nomor temuan `VERIFIKASI-AUDIT-2026-08-18.md` |

**Aturan berlaku (owner, 2026-08-18):** jangan mengubah skema Master Data;
kalau memang perlu, tanya dulu.

## Peta dokumen

| Berkas | Isinya |
|---|---|
| `AGENTS.md` | Kontrak & aturan kerja, berlaku Claude maupun Codex. **Dibaca pertama.** §🧱 Master Data Contract (v2) dan §🧾 BQ Contract adalah kontrak domain yang berlaku; §🧑‍⚖️ Pembagian Peran mengatur siapa menulis kode; §graphify mengatur pemakaian knowledge graph. |
| `CLAUDE.md` | Komplemen `AGENTS.md`, spesifik-Claude: prosedur cek-in hemat token lewat `changelog.md` (checkpoint-based, bukan baca seluruh berkas). Ditulis 2026-08-19. |
| `HANDOFF-CODEX.md` | **Dibaca kedua.** Batch aktif siklus 2026-08-19, per app (Main App/Master Data/BQ), plus aturan anti-halusinasi. Versi 2026-08-18 (18 keputusan non-reversible) di `docs/archive/HANDOFF-CODEX-2026-08-18.md`. |
| `changelog.md` | Riwayat perubahan + alasannya. Sekaligus log handoff antar-agent. |
| `roadmap.md` | Berkas ini — pekerjaan terbuka. |
| `prisma/schema.prisma` | Bentuk data yang berlaku, beranotasi. Satu-satunya yang tidak bisa basi. |
| `AUDIT-MASTERDATA-2026-08-18.md` | Laporan audit 30 temuan (#21). |
| `VERIFIKASI-AUDIT-2026-08-18.md` | Verifikasi 25 temuan gelombang 2 — mana yang benar, mana yang salah baca. |
| `docs/archive/` | Semua yang sudah tidak berlaku. Disimpan, bukan dibuang. |

---

# ═══ PROGRAM: Architecture Cleanup & Consolidation v2 ═══

> **Baru — diratifikasi owner 2026-08-24.** Sumber kebenaran program:
> [`PRD-Architecture-Cleanup-v2.md`](PRD-Architecture-Cleanup-v2.md) (otoritas
> tertinggi requirement produk). Fase-fase di bawah adalah kerangka eksekusi;
> detail tiap fase ditulis sebagai work order terpisah saat fase itu dibuka.
> **Tidak ada fase yang dimulai sebelum R0 selesai** dan baseline
> typecheck/test/build tercatat.

| Fase | Isi | Status |
|---|---|---|
| **R0** | Baseline freeze — capture schema, jalankan typecheck/tests/integration/build, catat acceptance cases BQ | ✅ **selesai 2026-08-24** — typecheck bersih, test 158/158, integration docker 5/5, build sukses, skema 64 model/30 enum pada `6377ac0`; lihat changelog |
| **R1** | Schema & ownership audit → migration map disetujui owner | ✅ **disetujui 2026-08-24 (amandemen pricing = multi-supplier final)** — [`AUDIT-R1-SCHEMA-2026-08-24.md`](AUDIT-R1-SCHEMA-2026-08-24.md); U2/U4/U5/U6 disetujui; R4 menyusut |
| **R2** | Shared Core SSOT — Unit Dictionary, Measurement, Currency/Money, Date/time, Normalization, Provenance | ✅ **selesai 2026-08-24** — `src/core/reference/{units,provenance}.ts`, `src/core/utilities/{measurement,money,datetime,normalize,round}.ts` + 36 test baru (194/194); konsumen lama bermigrasi di R8–R10 sesuai jadwal |
| **R3** | Platform consolidation — audit fisik satu `AuditLog` generic, action errors, pagination, soft-delete | 🔶 **fase 1 selesai 2026-08-24** — migrasi `20260824090000` + shared `recordAudit()` + dual-write Master Data + domain BQ otomatis + integration runner multi-file; sisa: backfill/flip/drop `MasterDataAudit`, error mapping, pagination contract |
| **R4** | Pricing (skop menyusut, keputusan final multi-supplier): validasi `unit` harga = `purchase_unit` saat tulis + kolom `updated_by_id` + perbaikan dokumentasi kontrak; **tanpa konsolidasi data, tanpa perubahan `SkuPrice_current_uniq`** | ✅ **selesai 2026-08-24** — `checkPriceUnit()` di `sku-price-rules.ts` ditegakkan di `recordSkuPrice()` & impor Excel (identik dengan readiness BQ); migrasi `20260824120000_skuprice_updated_by_id`; komentar basi AGENTS.md §3 poin 5/7 dikoreksi; test 198/198 |
| **R5** | UI Engine v2 foundation — theme/tokens/primitives/patterns/layout/templates tanpa knowledge domain | ✅ **selesai 2026-08-24** — layer `theme/`, `patterns/` (state/inline-cell/pagination), `templates/contracts.ts` dibuat; pelanggaran §36 dibersihkan (komponen Phase/Project direlokasi ke `@/components`, token classes ikut); StatusBadge jadi tone-only per §40 dengan mapping di `@/lib/ui/status-tone`; nol perubahan visual |
| **R6** | AppShell migration — Master Data → BQ → StudioFlow | ✅ **selesai 2026-08-24** — `AppShell`/`AppRail` di engine menggantikan chrome yang diduplikasi 3× (markup dipertahankan apa adanya, nol perubahan visual); aturan aktif nav jadi murni `resolveActiveRailHref()` + 7 test parity; konsumen geometri hardcoded (`top-14`/`78px`/`256px`) bermigrasi ke token theme §37; gerbang penuh lulus (unit 205/205, integration 8/8, build ✓) |
| **R7** | Template migration — Directory/Detail/Workspace/Project/Spreadsheet/Settings/Dashboard | ✅ **selesai 2026-08-24** — ketujuh template §42 kini punya consumer hidup representatif tanpa perubahan visual: Dashboard (`/`), Directory (SKU Directory), Detail (Brand detail), Workspace (phase page), Project (project overview), Spreadsheet (BQ breakdown), dan Settings (`SettingsShell` untuk seluruh halaman settings); gerbang penuh lulus (prisma validate, typecheck, unit 205/205, integration 8/8, build ✓) |
| **R8** | Master Data cleanup — integrasi unit kanonik, price simplification, picker & formatter consolidation | ✅ **selesai 2026-08-24** — surface Master Data aktif (`Brands`, `Suppliers & Vendors`, `Pricing`, `Sample Library`, `Settings`) bermigrasi ke template R7; copy Settings diselaraskan ke English; formatter waktu permukaan umum mulai memakai `src/core/utilities/datetime.ts`; consumer `DashboardPageShell` langsung di domain Master Data dihapus |
| **R9** | BQ cleanup — Project Cost Database, lifecycle guard, provenance, ordering; **hapus `price-drift-service.ts`** (snapshot tidak pernah refresh — keputusan owner 2026-08-24); hasil kalkulasi tidak boleh berubah | ✅ **selesai 2026-08-24** — `price-drift-service.ts` dihapus total; refresh snapshot action material/jasa dibuang; `BqProjectView`/`breakdown-service.ts`/`BqBreakdownClient.tsx` tidak lagi membaca atau menampilkan drift/refresh dari Master Data; kalkulasi tetap server-only dan typecheck/build/test gate mempertahankan perilaku |
| **R10** | StudioFlow cleanup — date utils, templates, mapping presentasi phase | ✅ **selesai 2026-08-24** — halaman dashboard/detail yang masih langsung memakai shell lama bermigrasi ke template (`Activity`, `Library`, `Upcoming`, `Projects`, project activity/deliverables/MOM/SketchUp, BQ list/library, page skeleton); timestamp activity/header berpindah ke `formatDateTime()` agar util waktu inti benar-benar dipakai di surface StudioFlow |
| **R11** | Boundary enforcement — lint/import guards, nol pelanggaran | ✅ **selesai 2026-08-24** — ESLint kini menolak import `DashboardPageShell` langsung di luar `src/ui_engine/**`, menahan `src/ui_engine/**` agar tidak mengimpor `@/subapps/*` / `@/extensions/*`, dan menahan `src/core/**` agar tidak tergantung pada domain/UI; audit lint untuk aturan baru bersih (warning repo lama di area lain tetap baseline terpisah) |
| **R12** | Legacy purge — hanya setelah semua consumer termigrasi | ✅ **selesai 2026-08-24** — barrel publik `@/ui_engine` tidak lagi mengekspor `DashboardPageShell`; `src/subapps/bq/services/price-drift-service.ts` dihapus; consumer app-level terakhir dibersihkan sehingga shell dashboard tinggal internal ke layer template |

**Aturan selama program berjalan:**

1. No feature expansion (aturan utama PRD). Item feature di bagian bawah
   roadmap ini hanya dikerjakan kalau tidak menyentuh area fase aktif, atau
   dengan persetujuan owner eksplisit.
2. ~~Item lama pola riwayat-per-supplier tertahan~~ **dicabut 2026-08-24** —
   keputusan final owner: multi-supplier TETAP; viewer harga lintas supplier,
   demosi per supplier, dsb. adalah perilaku kanonik, bukan kerja bongkar.
3. Jangan menambah mekanisme refresh/drift BQ apa pun (lihat kontrak BQ §3,
   penegasan 2026-08-24).
4. Setiap fase wajib lolos gerbang regresi PRD §49 sebelum fase berikutnya
   dibuka.

---

# ═══ MASTER DATA ═══

## Gelombang 1 — kepatuhan kontrak (paling bernilai)

Kedua item selesai 2026-08-18 (#25) — rinciannya di §Selesai 2026-08-18 di
bawah dan di `changelog.md`. Tidak ada item terbuka tersisa di gelombang ini.

## Gelombang 2 — murah, berdiri sendiri, nol risiko regresi

Ketujuh butir selesai 2026-08-18 (#25) — rinciannya di §Selesai 2026-08-18 di
bawah dan di `changelog.md`. Tidak ada item terbuka tersisa di gelombang ini.

## Gelombang 3 — pembersihan kode mati

- [ ] **§19 · ±420 baris tidak pernah dirender di Master Data**

      | Simbol | Berkas | Ukuran | Catatan |
      |---|---|---|---|
      | `MasterDataNav` + `MASTERDATA_SECTIONS` | `components/MasterDataNav.tsx` | seluruh berkas | Nav yang dipakai adalah `MasterDataNavOuter`. **Aman dihapus.** |
      | `SupplierJasaTab` | `components/SupplierClient.tsx` | ±197 baris | **DIHAPUS #40** — BR8 sudah menyediakan viewer yang hidup |
      | `InlineCompanyCell` | `components/SupplierClient.tsx` | ±124 baris | **DIHAPUS #40** — BR1 selesai tanpa bergantung padanya |
      | `toggleSort` | `components/SupplierClient.tsx` | 1 fungsi | **DIHAPUS #40** bersama state/filter Brand yang mati |

      **Keputusan owner 2026-08-18:** hapus `MasterDataNav.tsx` saja.
      `SupplierJasaTab` dan `InlineCompanyCell` **ditahan** karena BR1 dan BR8
      kemungkinan besar ingin menghidupkannya kembali — menghapusnya sekarang
      berarti membuang bahannya.

      **Status 2026-08-18 (#25):** `MasterDataNav.tsx` dipindah ke
      `_to_delete/MasterDataNav.tsx` di root repo — agent cloud tidak bisa
      `rm` berkas di folder yang di-mount. ⏳ **Owner**: hapus foldernya
      (`_to_delete/`) setelah dicek, lalu `git rm` kalau berkasnya pernah
      ter-commit.

      **Koreksi changelog #23:** entri itu mencatat guard `useUnsavedChangesGuard`
      terpasang di "Supplier Jasa tab". Guardnya memang ada
      (`SupplierClient.tsx` baris 315 / 341 / 486) tetapi **seluruhnya di dalam
      `SupplierJasaTab` yang tidak pernah dirender.** Layar Supplier yang hidup
      tetap aman — dialog yang benar-benar tampil adalah `MasterDataBrandDialog`
      dan `PartyDialog`, dan keduanya punya guard sendiri. Jadi tidak ada lubang
      UX; yang ada catatan yang perlu diluruskan.

      **Status 2026-08-19 (#40):** tiga blok mati di `SupplierClient.tsx`
      sudah dihapus setelah BR1 dan BR8 selesai. Item §19 tetap terbuka hanya
      untuk `_to_delete/MasterDataNav.tsx`, yang penghapusannya memang ditahan
      untuk owner sejak #25.

## Gelombang 4 — konsistensi backend (selesai 2026-08-18, #27)

**Seluruh Gelombang 4 selesai.** Rinciannya di §Selesai 2026-08-18 (#27) di
bawah; ringkasan status per item ditinggal di sini supaya konteks "kenapa
item ini ada" tidak hilang.

- **B3 · Slug tanpa cek unik** — selesai. `ensureUniqueSlug(base, exists)` baru
      di `slug-service.ts`, dipakai di seluruh 8 jalur tulis yang terverifikasi
      2026-08-18: `party-actions.ts:227,305` · `pricing-actions.ts:449,495` ·
      `quick-entry-actions.ts` (Party/Brand/WorkVendor) ·
      `sample-request-actions.ts:417` (lewat B5/`createSkuCore`, bukan dobel).

- **B5 · Lima jalur pembuatan SKU** — selesai. `createSkuCore(tx, params, actor)`
      baru di `sku-core-service.ts`, dipakai kelima pemanggil:
      `library-service.ts` (dua lokasi) · `quick-entry-actions.ts` ·
      `sample-request-actions.ts` · `excel-service.ts`. Konsolidasi ini juga
      **menemukan** dua bug audit-log dobel (§6) yang tidak ada di audit asli —
      lihat §Selesai (#27).

- **B6 · Transaksi bersarang** — selesai 2026-08-18 (#25), rinciannya di
      §Selesai 2026-08-18 (#25) di bawah. *Bagian kedua item ini DICABUT* — lihat
      §Dicabut di bawah.

- **B7 · Pohon kategori** — selesai. `category-tree-service.ts`:
      1. lookup `upsertCategory` sekarang menyertakan cabang root yang bisa
         diberi induk, jadi `needsParent` bukan dead code lagi (§18);
      2. `path` diturunkan ke seluruh keturunan lewat `propagateDescendantPaths`
         saat path induknya berubah (§4);
      3. **backfill** — `scripts/backfill-duplicate-categories.mjs` (dry-run
         default, `--apply` untuk menulis). Owner yang menjalankannya (butuh
         akses DB lokal, tidak bisa dari sandbox cloud).

- **H3 · Penjaga hapus Party** — selesai. `assertPartyDeletable(tx, partyId)`
      baru di `party-delete-service.ts`, dipakai `deleteCompanyAction` DAN
      `deleteServiceVendorAction` — memeriksa brand, `WorkPrice`,
      `SkuPrice.supplier_party_id`, `BrandSupplier` sekaligus, bukan lagi
      masing-masing memeriksa sebagian. Sekalian §17: `updatePartyContactAction`
      / `deletePartyContactAction` sekarang menerima `partyId` opsional dan
      menolak kalau tidak cocok dengan `party_id` kontak yang sebenarnya.

- **H7 · `WorkPrice` hard delete** — selesai, **TANPA migrasi**. Temuan saat
      dikerjakan: `WorkPrice.deleted_at` **sudah ada** di `schema.prisma` sejak
      migrasi rebaseline `20260810180000` — tag 🔒 dan catatan "butuh kolom
      baru" di item ini sudah usang saat ditulis. `deleteServicePriceAction`
      dan `deleteMaterialLaborPriceAction` diganti dari `tx.workPrice.delete()`
      ke `tx.workPrice.update({ data: { deleted_at } })`, pola yang sama dengan
      `deleteMaterialPriceAction`.

- **H8 · Filter `kind`/`deleted_at`** — selesai bersamaan H7.
      `updateServicePriceAction`/`deleteServicePriceAction` sekarang
      mensyaratkan `kind: "LABOR_ONLY"`; `updateMaterialLaborPriceAction`/
      `deleteMaterialLaborPriceAction` mensyaratkan `kind: "MATERIAL_LABOR"`;
      keempatnya mensyaratkan `deleted_at: null`.

- **M6 · Error mentah bocor** — selesai. `action-wrapper.ts` memetakan
      `Prisma.PrismaClientKnownRequestError` (P2002/P2025/P2003/P2014) ke pesan
      berbahasa Indonesia yang bisa ditindaklanjuti sebelum jatuh ke
      `error.message` mentah. Menutup §7, §16, §15.

- **M9 / §15 · `generateWorkPriceCode` TOCTOU** — selesai, pakai **advisory
      lock** (keputusan owner 2026-08-18) — `pg_advisory_xact_lock` di dalam
      transaksi yang sama, otomatis lepas saat commit/rollback, nol migrasi.

## Gelombang 5 — skala & UX

- [x] **M3 / §8 · Halaman harga memuat semuanya — SELESAI 2026-08-19
      (#52).** `getMaterialPricesAction` sekarang membatasi 50 baris per
      halaman dan mencari Brand, supplier/legal name, nama serta kode SKU di
      server. Total global tetap dipakai badge tab, sedangkan total hasil
      pencarian mengendalikan pagination. Saran unit dibaca lewat query
      distinct terpisah agar tidak menyusut menjadi unit halaman pertama.

- [x] **M4 · `getPartyBrandsAction`** — **SELESAI 2026-08-18 (#30).** Sekarang
      hanya memuat SKU yang muncul di `priceCounts` (`priceSkuIds`), bukan semua
      SKU brand. Jangan dikembalikan.

- [x] **M8 · Batas ukuran upload Excel** — **SELESAI 2026-08-18 (#30).**
      `api/masterdata/excel/import/route.ts` menolak file > 20 MB dengan `413`
      sebelum buffer dibaca. Deklarasi `export const config` lama yang diabaikan
      App Router sudah dihapus #44; guard ukuran runtime tetap menjadi pengaman
      yang berlaku dan tidak boleh dihapus.

- [x] **§20 · Tab Prices di Supplier detail — SELESAI 2026-08-19 (#53).**
      Tab menampilkan harga material berlaku yang benar-benar berasal dari
      Party tersebut, lengkap dengan search SKU/Brand/item, pagination,
      currency, unit, dan tanggal update. Query memakai fondasi paginated M3
      dengan `supplierId`; tab tidak dirender tanpa `MASTERDATA_PRICE_VIEW`.
      Manajemen penuh tetap berada di `/masterdata/prices`.
      bukan cacat.

## ✅ Keputusan owner 2026-08-18 — tidak lagi menunggu

Ketiganya dijawab owner 2026-08-18. Spesifikasi kerjanya di
`HANDOFF-CODEX.md` §2.

- [x] **H5 · Permission harga — SELESAI #39: tidak dipisah.** Siapa yang boleh
      mengelola supplier juga boleh mengubah harga; perilaku sekarang sudah
      benar. `MASTERDATA_PRICE_MANAGE` dan
      `MASTERDATA_OFFERING_MANAGE` dari `core/rbac/constants.ts` dan
      `core/rbac/matrix.ts` sudah dihapus. Diverifikasi: keduanya tidak dipakai di
      satu tempat pun selain dua berkas itu, jadi penghapusannya nol perubahan
      perilaku. Mutasi harga tetap memakai `MASTERDATA_VENDOR_MANAGE`.

- [x] **§10 · Edit menurunkan status ke PENDING — SELESAI #39: penurunan
      dicabut.** Owner: *"staf, admin dan developer semua bisa edit — untuk
      master data"*, dan edit tidak menurunkan status. Client kini membawa
      status semula pada Edit; server membuang field status dari request
      non-approver sehingga edit mempertahankan nilai database tanpa membuka
      jalan approval terselubung.
      **CREATE tetap masuk `PENDING`** dan dropdown ubah-status tetap hanya untuk
      `access.canApproveMaterial` — yang dicabut hanya penurunan otomatisnya.
      **Konsekuensi yang owner terima sadar:** STAFF bisa mengubah material yang
      sudah disetujui tanpa persetujuan ulang; peredamnya `recordAudit` di
      `MasterDataAudit`, jadi jangan pernah dilemahkan.

- [x] **M5 · Satu bahasa per permukaan — SELESAI #41: Bahasa Inggris.** Semua
      teks yang dibaca pengguna di layar (tombol, label, header kolom, menu,
      placeholder, empty state, **termasuk pesan error**) ditulis Inggris.
      Dokumen internal — `changelog.md`, `roadmap.md`, `AGENTS.md`,
      `HANDOFF-CODEX.md`, komentar kode — tetap Indonesia. Aturannya di
      `AGENTS.md` §🗣️ Bahasa Antarmuka. Pesan `mapKnownPrismaError()` kini
      berbahasa Inggris dan tetap actionable. Teks lama pada layar Brand,
      Material, Pricing, dan Supplier yang tersentuh urutan kerja ini ikut
      diselaraskan; tanggal Pricing memakai nama bulan Inggris.

---

# ═══ MASTER DATA — UI/UX dari screenshot owner (2026-08-18) ═══

**Koreksi rujukan berkas, 2026-08-18:** seluruh item di bawah semula menunjuk
`BrandListClient.tsx`. **Berkas itu tidak ada.** Tabel Brands sebenarnya berada
di `MasterDataMaterialsClient.tsx` (brand landing view). Rujukan sudah
dibetulkan; isi permintaannya tidak diubah — semuanya lahir dari layar nyata.

- [x] **LA-1 · Koneksi Brand → Library setelah split Category/Hashtag —
      SELESAI 2026-08-19 (#45).** Reproduksi membuktikan koneksi nama brand dan
      kategori tetap bekerja (`Lalapis`/`WPC`), tetapi hashtag Brand tidak ikut
      dicari: `CNC` ada pada Wline namun Library memberi nol hasil. Akar masalah
      ada di `BrandLibraryService.searchBrands()` yang belum membaca
      `Brand.tags` setelah split #37, bukan campuran sumber `SEED`/
      `DERIVED_FROM_SKU`. Pencarian dan quick-pick sekarang memasukkan hashtag
      dari Brand hidup; kategori manual maupun turunan tetap dipertahankan.

- [x] **BR1 · Inline edit Brand selesai (#37)** — Kolom Category, Hashtag, dan
      Brand Name di tabel Brands sekarang bisa diedit langsung tanpa membuka
      detail. Riwayat kode sudah diperiksa: berbeda dari premis awal, fitur tiga
      kolom ini belum pernah ada; `InlineCompanyCell` hanya mengedit relasi
      Company pada tabel Supplier. Guard `useUnsavedChangesGuard` tetap
      melindungi perubahan yang belum disimpan.
      **Berkas:** `MasterDataMaterialsClient.tsx`.
      **Catatan:** jalur update Brand kini juga merekam perubahan hashtag dan
      kategori pada `MasterDataAudit` di transaksi yang sama.

- [x] **BR2 · Search Brands diperluas (P2) — SELESAI 2026-08-19 (#48).**
      Pencarian server-side/paginated kini mencocokkan nama Brand/owner,
      Category `PRODUCT`, Hashtag (substring case-insensitive), nama/legal name
      supplier hidup, serta nama/kode SKU hidup. Hasil selalu kembali pada grain
      Brand; pencarian tidak memindahkan tampilan ke tabel SKU.
      **Berkas:** `MasterDataMaterialsClient.tsx`.

- [x] **BR3 · Category hilang setelah Add Brand berturut-turut (P0) — SELESAI #36.** Setelah
      menambah brand pertama dengan kategori tertentu, membuka Add Brand lagi
      membuat kategori yang baru ditambahkan hilang/reset. State form tidak
      persist antar sesi create.
      **Berkas:** `MasterDataBrandDialog.tsx`.

- [x] **BR4 · Detail brand → modal, bukan halaman (P1) — SELESAI 2026-08-19
      (#47).** Angka SKU dan Supplier pada tabel kini membuka tab terkait di
      dialog Brand tanpa meninggalkan direktori; menu View membuka tab Overview.
      Kolom Complete dihapus dan brand belum lengkap ditandai warna kuning
      semantik. Route detail lama tetap hidup sebagai deep-link kompatibel.
      **Berkas:** `BrandDetailClient.tsx`, `MasterDataMaterialsClient.tsx`.

- [x] **BR5 · Kolom Katalog & Links di tabel Brands (P2) — SELESAI
      2026-08-19 (#49).** Seluruh `BrandLink` tampil sebagai external link pada
      tabel; tombol edit membuka editor repeatable yang dipakai dialog Brand,
      dilindungi unsaved-changes guard. URL tanpa scheme dinormalisasi saat
      dibuka, dan create/update/delete `BrandLink` kini diaudit per baris.
      **Berkas:** `MasterDataMaterialsClient.tsx`.

- [x] **BR6 · Actions jadi titik tiga (⋯) saat hover — SELESAI #38** — ikon
      pencil/eye/trash yang selalu tampil sudah diganti satu kebab menu yang
      muncul saat row di-hover/focus. Berlaku untuk **kedua** tabel; viewer
      tetap mendapat View, sedangkan Edit/Delete mengikuti izin.
      **Berkas:** `MasterDataMaterialsClient.tsx`, `SupplierClient.tsx`.

- [x] **BR7 · Terapkan pola BR4 ke Supplier (P2) — SELESAI 2026-08-19
      (#50).** Nama/count/menu View membuka detail Supplier pada modal tanpa
      navigasi; count SKU pada assignment Brand membuka popup SKU paginated.
      Tabel hidup ternyata sudah tidak punya kolom Complete; pengganti warna
      kuning diterapkan pada Party tanpa Role (satu-satunya kekurangan yang
      menghalangi pemakaian sebagai supplier/vendor). Menu ⋯ BR6 tetap utuh.
      **Berkas:** `SupplierDetailClient.tsx`, `SupplierClient.tsx`.

- [x] **BR8 · SELESAI #40 — popup dan direktori SKU lintas-brand.**
      Premis lamanya salah: halaman Supplier tidak punya `<Tabs>` sama sekali dan
      `SupplierJasaTab` tidak pernah dirender. Owner mengoreksi maksudnya:
      *"add SKU kan harapan saya pakai CreatableSearch dari pricing (material
      pricing) — malah ideal ada viewer yg jelas, bukan masalah create nya."*

      **Sisi create sudah selesai sejak #28** (`SkuPicker` meneruskan `onCreate`
      ke `CreatableSearch`). Jangan dikerjakan ulang. Yang dipesan dua viewer:

      1. **Popup detail SKU dari tabel Harga Material** — klik baris → kode
         artikel, brand, kategori, spesifikasi, semua supplier yang menjualnya
         beserta harganya, dan riwayat harga. Bagian riwayat itu **adalah A7** —
         kerjakan sekalian, tanpa model baru dan tanpa migrasi.
      2. **Halaman daftar SKU lintas-brand (baru)** — semua SKU semua brand, bisa
         dicari & difilter (brand, kategori, ada/belum ada harga, lengkap/belum).
         **Tab SKU di detail Brand tetap ada.** Owner: *"ikut rekomendasi kamu,
         perbaiki secara uiux agar rapih. kalau mau buat halaman baru oke jg."*

      Setelah keduanya jalan, `SupplierJasaTab` yang mati sudah tidak punya alasan
      ditahan (§19). Keduanya kini berjalan: popup dapat dibuka dari baris
      Material Prices dan memuat semua harga berlaku serta riwayat; halaman
      `/masterdata/skus` menyediakan pencarian dan filter brand, kategori,
      keberadaan harga, serta kelengkapan data. `SupplierJasaTab` ikut dihapus.

- [x] **PR1 · Supplier field di Add Material Price** — **SELESAI 2026-08-18
      (#30).** `PricingClient.tsx` memakai `CreatableSearch` langsung; import
      `PartyPicker` dihapus dari berkas itu. Jangan dikembalikan.
      *(`PartyPicker.tsx` sendiri tetap ada — masih dipakai pemanggil lain.)*

- [x] **UI-CON-2 · CTA tab Services — SELESAI lewat verifikasi 2026-08-19
      (#51).** Premisnya berasal dari `SupplierJasaTab` yang sudah dihapus #40
      karena tidak pernah dirender. Layar Suppliers yang hidup hanya punya CTA
      `Add supplier / vendor`, dan sejak checkpoint #44 ia sudah berada di kanan
      `PageHeader`. Tidak ada kode UI yang perlu diubah; tab mati tidak dihidupkan.
- [x] **UI-CON-3 · Bahasa header kolom — SELESAI #41.** Header aktif pada
      Pricing seluruhnya Inggris. Sumber header campur (`BIDANG/TRADE`,
      `LABOUR PRICES`) ternyata hanya berada di `SupplierJasaTab` yang tidak
      pernah dirender dan sudah dihapus #40.
- [x] **UI-CON-4 · Stats summary — SELESAI 2026-08-19 (#54).** Kedua
      direktori mengikuti pola inline subtitle yang direkomendasikan. Strip
      `StatChip` Brands/Materials dihapus; total Brand/material + completeness
      atau kesiapan BQ masuk ke subtitle. Subtitle Supplier menampilkan total
      Party, assignment Brand, dan service vendor. Angka tetap global seperti
      strip lama, bukan berubah mengikuti filter halaman.

# ═══ MASTER DATA — UI/UX ditemukan owner dari verifikasi visual (2026-08-19) ═══

Owner mengecek langsung hasil batch BR2–UI-CON-4 di atas lewat screenshot dan
menemukan empat hal baru. Ditulis Claude sebagai roadmap untuk Codex dan
seluruhnya selesai 2026-08-19 pada #60–#63.

- [x] **BR9 · Modal SKU viewer terpotong di layar (P1) — SELESAI 2026-08-19
      (#60).** Dialog read-only
      SKU (`SkuDetailDrawer`, dipakai dari Pricing → klik baris **dan** dari
      `/masterdata/skus`) tampil lebih sempit dari yang seharusnya: grid field
      atas (Brand/Categories/Dimension/Base unit) dan tabel Current supplier
      prices/Price history terpotong di tepi kanan alih-alih terlihat penuh
      atau punya affordance scroll yang jelas. Token
      `--ui-dialog-width-xl: 980px` dan `minWidth` kedua tabel (`42rem`/`56rem`)
      seharusnya muat, jadi lebar dialog yang benar-benar dirender diduga tidak
      mencapai token itu. **Reproduksi dulu di browser** (buka Pricing → klik
      `TH001AA`, dan `/masterdata/skus` → klik satu baris) sebelum menambal —
      jangan asumsikan penyebabnya, ikuti pola anti-halusinasi LA-1 (§3
      LINTAS APP lama). Kandidat awal untuk dicek: apakah utility `max-width`
      berbasis CSS variable pada `DialogContent` benar-benar menang dari default width komponen
      Dialog dasar; apakah scrollbar horizontal per-`TableCard`
      (`w-full overflow-x-auto` di `table-card.tsx`) memang jalan tapi kurang
      terlihat sebagai affordance.
      **Hasil:** reproduksi browser membuktikan dialog hanya 560px karena
      `DialogContent` masih memakai size default `md`; utility 980px pada
      `className` kalah di breakpoint `sm`. Viewer sekarang memakai API
      semantik `size="xl"`: lebar aktual 980px pada viewport 1280px dan kedua
      tabel muat tanpa overflow luar, baik dari Pricing maupun SKU Directory.
      **Berkas:** `src/subapps/master-data/components/SkuDetailDrawer.tsx`,
      kemungkinan komponen dasar Dialog di `ui_engine`/`components/ui/dialog.tsx`.

- [x] **BR10 · SKU Directory tidak bisa delete SKU (P1) — SELESAI 2026-08-19
      (#61).** Halaman
      `/masterdata/skus` (`SkuDirectoryClient.tsx`) murni read-only: baris
      hanya membuka viewer, tidak ada kolom actions/kebab sama sekali.
      Diverifikasi: **tidak ada satu pun server action delete SKU/Material**
      di `src/subapps/master-data/actions/*.ts` — kapabilitas ini memang belum
      pernah dibangun di aplikasi mana pun, bukan regresi khusus halaman ini.
      Tambahkan delete SKU dari halaman ini: kolom actions/kebab menu,
      konfirmasi destructive lewat `useAppConfirm`/`AlertDialog` (pola D2),
      permission mengikuti gate Master Data yang relevan, dan soft delete
      (`deleted_at`) sesuai konvensi Master Data — pastikan `SkuPrice` history
      SKU yang dihapus tidak ikut hilang.
      **Berkas:** `SkuDirectoryClient.tsx`, action baru di
      `src/subapps/master-data/actions/masterdata-actions.ts` (atau file
      actions SKU yang paling sesuai).
      **Hasil:** setiap baris kini punya menu Actions dengan View details dan,
      bagi pemegang `MASTERDATA_SKU_MANAGE`, Delete SKU. Delete memakai dialog
      aplikasi, berjalan sebagai soft-delete transaksional, menulis tepat satu
      audit Master Data, dan mempertahankan seluruh riwayat `SkuPrice`.

- [x] **BR11 · Hapus inline edit tabel Brands, ringkas kolom Category/Hashtag
      (P1) — SELESAI 2026-08-19 (#62).** Permintaan eksplisit owner 2026-08-19: menu kebab sudah punya
      "Edit full details" (BR4/BR6), jadi inline edit klik-sel untuk
      Name/Category/Hashtag (BR1, #37) sekarang **dihapus** — ini sengaja
      membalik keputusan BR1, bukan regresi tak sengaja. Klik sel tidak lagi
      masuk mode edit; satu-satunya jalur edit tetap "Edit full details" di
      menu ⋯. Kolom Category dan Hashtag saat ini merender daftar penuh
      (`brand.categoryTags.join(", ")` / `brand.tags.join(", ")`) sehingga
      melebar — ringkas dengan pola Instagram: 1–2 nilai pertama lalu
      `and N others` (mis. `Decorative Panel and 3 others`); daftar lengkap
      tetap tersedia lewat `title`/tooltip seperti sekarang atau popover kalau
      tooltip dirasa kurang jelas.
      **Berkas:** `MasterDataMaterialsClient.tsx` (state `inlineBrandDraft` /
      `beginInlineBrandEdit` dan render kolom Category/Hashtag).
      **Hasil:** seluruh state/handler/editor sel serta prompt inline dihapus.
      Category dan Hashtag menampilkan nilai pertama + `and N others`; atribut
      `title` tetap memuat daftar lengkap. Edit hanya tersedia lewat menu
      Actions → Edit full details.

- [x] **BR12 · Konsistensi styling & interaksi tabel Brands vs Suppliers (P2)
      — SELESAI 2026-08-19 (#63).** Owner minta kedua tabel "perlakuannya sama". UI-CON-4 sudah
      menyamakan pola stats subtitle; kerjakan **sesudah BR11** lalu audit
      sisanya: gaya/posisi kebab menu, klik nama vs klik sel, alignment kolom
      actions, warna baris incomplete. `SupplierClient.tsx` dipakai sebagai
      acuan karena sudah murni modal/kebab pasca-BR7 tanpa inline edit.
      **Berkas:** `MasterDataMaterialsClient.tsx`, `SupplierClient.tsx`.
      **Hasil:** nama Brand dan Supplier sama-sama membuka detail Overview;
      count membuka tab terkait; sel lain tetap display-only. Tipografi nama
      memakai token yang sama, kebab/action tetap rata kanan, dan row incomplete
      tetap memakai token pending yang sama.

---

# ═══ MASTER DATA — Audit skema 2026-08-19 (SELESAI, dieksekusi Claude) ═══

Dari `AUDIT-SKEMA-MASTERDATA-2026-08-19.md`. Owner memutuskan kelima item
langsung 2026-08-19 sore dan minta Claude yang eksekusi (bukan Codex) — lihat
`HANDOFF-CODEX.md` catatan "SK1–SK5 DIKLAIM CLAUDE". Kelima invariant DB
kontrak lama (`AGENTS.md` §2) tetap diverifikasi solid, nol drift.

- [x] **SK1 · `WorkPrice` — kolom versioning tidak dipakai — SELESAI
      2026-08-19.** Keputusan owner: opsi (a), sengaja satu-baris-per-code,
      tidak butuh riwayat. `valid_from`/`valid_to`/`is_current` diberi
      komentar "TIDAK DIPAKAI" di `schema.prisma` (pola sama seperti `qty`)
      + `COMMENT ON COLUMN` lewat migrasi
      `20260819140000_workprice_unused_columns_comment` (murni metadata,
      nol data/kolom diubah). `AGENTS.md` §3 dapat poin baru (7) yang
      menyatakan `WorkPrice` BUKAN tabel riwayat, kontras eksplisit dengan
      `SkuPrice` di poin 3.
      **Berkas:** `prisma/schema.prisma`, migrasi baru, `AGENTS.md`.

- [x] **SK2 · `PartyContact.brand_id` tidak divalidasi terhadap kepemilikan/
      relasi brand↔party — SELESAI 2026-08-19.** Guard baru
      `assertBrandBelongsToParty()` di `party-actions.ts`, dipanggil dari
      `createPartyContactAction` dan `updatePartyContactAction` sebelum
      tulis apa pun: brand harus `owner_party_id` party ini ATAU tercatat di
      `BrandSupplier` untuk party ini, kalau tidak ditolak
      (`VALIDATION_FAILED`, pesan Inggris sesuai §🗣️ Bahasa Antarmuka).
      Perbaikan aplikasi murni, tidak ada migrasi.
      **Berkas:** `src/subapps/master-data/actions/party-actions.ts`.
      **Verifikasi:** `npm run typecheck` dan `npx eslint` (file ini) lulus.

- [x] **SK3 · `Category(kind,slug)` unique tanpa partial-index live-row —
      SELESAI 2026-08-19.** Pencegahan sebelum ada bug aktif: constraint
      `@@unique([kind, slug])` diganti index parsial
      `Category_kind_slug_live_uniq` (`WHERE is_active`) lewat migrasi
      `20260819150000_category_kind_slug_live_uniq` — pola sama dengan
      Party/Brand live-uniq (B2, `20260818120000`). Category tidak punya
      `deleted_at`, jadi "hidup" di sini berarti `is_active`. Diverifikasi:
      tidak ada pemakaian `kind_slug` compound-unique di `src/subapps`
      sebelum perubahan (jadi aman dihapus dari Prisma Client), dan arah
      migrasinya KETAT→LONGGAR (index lama sudah menjamin nol duplikat di
      seluruh baris, jadi migrasi pasti berhasil tanpa precheck). `AGENTS.md`
      §2 dapat baris invariant ke-6.
      **Berkas:** `prisma/schema.prisma`, migrasi baru, `AGENTS.md`.
      **Verifikasi:** `npx prisma validate` lulus (belum bisa `prisma
      migrate`/`generate` dari sesi manapun yang dipakai — lihat "Langkah
      buat owner" di bawah).

- [x] **SK4 · `Category.path` — dikoreksi, BUKAN celah terbuka — SELESAI
      2026-08-19.** Investigasi `category-tree-service.ts` menemukan audit
      2026-08-19 sebelumnya SALAH: `propagateDescendantPaths()` sudah ada
      sejak **B7 (2026-08-18)** dan dipanggil otomatis dari `upsertCategory()`
      setiap kali `path` sebuah kategori berubah — descendant di-rewrite
      lewat prefix match dalam transaksi yang sama. Karena pohon cuma DUA
      TINGKAT (AGENTS.md §4), fan-out-nya dijamin kecil (anak langsung saja,
      tidak ada cucu), jadi pola per-baris yang dipakai bukan risiko skala.
      **Tidak ada kode yang diubah** — mengubah mekanisme yang sudah benar
      demi "optimasi" tanpa masalah nyata justru menambah risiko regresi.
      Yang diperbaiki murni dokumentasi: `schema.prisma` field `path`
      sekarang menunjuk eksplisit ke `upsertCategory()`/
      `propagateDescendantPaths()` supaya audit berikutnya tidak mengulang
      kesalahan yang sama (percaya `AGENTS.md` §4 tanpa baca kode).
      **Berkas:** `prisma/schema.prisma` (komentar), `AUDIT-SKEMA-MASTERDATA-2026-08-19.md`
      (dikoreksi).

- [x] **SK5 · `Sku.brand_id→Brand onDelete:Restrict` belum pernah teruji —
      SELESAI (didokumentasikan) 2026-08-19.** Tidak ada fitur delete Brand
      hari ini, jadi tidak ada yang bisa "difix" — tindak lanjutnya murni
      komentar peringatan di `schema.prisma` pada `Sku.brand_id`: kalau
      nanti "delete brand" dibangun sebagai soft-delete (pola tabel lain),
      `Restrict` TIDAK akan terpicu, proteksi harus ditulis eksplisit di
      application code (mirip `assertPartyDeletable`).
      **Berkas:** `prisma/schema.prisma` (komentar).

**Langkah buat owner (WAJIB, belum bisa dijalankan dari sesi Claude
manapun):** jalankan `npx prisma migrate deploy` (atau `migrate dev` di
lingkungan pengembangan) di mesin lokal Windows supaya kedua migrasi baru
(`20260819140000`, `20260819150000`) benar-benar diterapkan ke database, lalu
`npx prisma generate` supaya Prisma Client ikut memuat perubahan
`Category(kind,slug)`. Sesi cloud Claude tidak bisa menjalankan ini (binary
engine Linux vs Windows); `npx prisma validate` sudah dikonfirmasi lulus,
tapi itu cuma cek sintaks skema, bukan penerapan ke database.

---

# ═══ STUDIOFLOW (di luar Master Data) ═══

## Selesai 2026-08-18 (#26) — Inline edit judul task

Dilaporkan owner sebagai *"regresi"* (pernah ada, sekarang hilang). Dicek
`changelog.md` + `git log` + seluruh pemanggil `updateTask(...)` dulu sebelum
menulis kode — **tidak ada bukti fitur ini pernah dibangun** di UI (rinciannya
di `changelog.md` #26); backend (`updateTask`, `executeUpdateTask`) sudah
menerima `label` sejak build §C, hanya tidak ada UI yang pernah memanggilnya
dengan label baru. Dikonfirmasi ke owner, lalu dibangun: klik judul task di
`task-list.tsx` (dipakai tab Fase dan overview proyek) → jadi input, Enter/blur
simpan, Esc batal. Tidak ada item roadmap lama yang ditutup oleh ini karena
tidak pernah tercatat sebagai item terbuka.

## Fitur diputuskan owner 2026-08-18 — pembersihan otomatis task completed

- [x] **TV2 · Purge otomatis task checklist yang sudah lama selesai — SELESAI #35.** Owner:
      *"todays view dan upcoming tolong dibuat dengan perlakuan yang sama.
      default collapse apabila tidak ada task dan completed nya sifatnya
      temporary sampai batas waktu tertentu (atau paling lama sampai proyek
      'completed') maka task completed bisa di hapus."*

      **Temuan sebelum menulis spesifikasi ini — separuh permintaan sudah
      terpenuhi tanpa kode baru:**

      1. *"Default collapse apabila tidak ada task"* — **sudah beres di kedua
         halaman, dengan mekanisme yang berbeda tapi setara.** Today's View
         meng-collapse grup proyek kosong sejak #29. Upcoming malah tidak
         pernah merender bucket tanggal yang kosong sama sekali —
         `bucketTasksByDate()` (`task-feed.ts:282-285`) membuang bucket dengan
         `tasks.length === 0` sebelum sampai ke layar. Tidak ada yang perlu
         diubah untuk poin ini.
      2. *"Completed bisa dihapus"* — **sebelum #35 ini belum ada.** Sejak #29,
         task yang sudah dicentang cuma disembunyikan dari query setelah 7
         hari (`CHECKLIST_DONE_RETENTION_DAYS` di `task-feed-query.ts:28`).
         Barisnya tidak pernah benar-benar dihapus — menumpuk di database
         selamanya. Owner memutuskan: **dihapus otomatis**, bukan tombol
         manual.

      **Keputusan owner (tiga pertanyaan terpisah):**
      - Penghapusan **otomatis lewat batas waktu**, bukan tombol yang diklik
        manual.
      - Proyek berstatus **Completed = langsung lewat batas**, berapa pun
        sisa hari retensinya — tidak menunggu genap 7 hari.
      - **Upcoming TETAP tidak pernah menampilkan completed** — tidak perlu
        toggle "Show completed" seperti Today's View. Tidak ada perubahan UI
        di Upcoming untuk item ini.
      - Hosting **self-managed (VPS/Docker)** — pemicunya **crontab OS**,
        bukan Vercel Cron. Repo tidak punya `vercel.json` atau cron apa pun
        sekarang.

      **Yang dikerjakan Codex di #35:**

      1. **Script baru** `scripts/purge-expired-checklist-tasks.mjs` — pola
         dry-run default + `--apply` untuk menulis, **sama persis** dengan
         `scripts/backfill-duplicate-categories.mjs` yang sudah ada.
      2. **Kriteria eligible** untuk dihapus — `ProjectChecklist` di mana
         `is_checked = true` **DAN** (`checked_at` lebih tua dari 7 hari
         **ATAU** `project.status_progress === "COMPLETED"`).
      3. **Skip baris yang `template_id !== null`.** Ini menyalin pengaman
         yang sudah ada di `executeDeleteTask`
         (`checklist-service.ts:235-240`) — item dari template menolak dihapus
         manual sampai di-detach dulu; purge otomatis **jangan pernah**
         melewati pengaman itu diam-diam.
      4. **⚠️ Bahaya cascade-delete yang WAJIB ditangani** — `parent_id` di
         `schema.prisma:988` memakai `onDelete: Cascade`. Kalau purge
         menghapus parent secara mentah, **semua child-nya ikut terhapus**
         walau child itu sendiri belum eligible (belum dicentang, atau baru
         saja dicentang). Toggle cascade (`executeToggleChecklist`,
         `phase-service.ts:515-521`) HANYA terjadi saat parent di-toggle — child
         tetap bisa di-uncheck sendiri sesudahnya, jadi **"parent checked ⟹
         semua child checked" TIDAK selalu benar.** Urutan yang aman:
         hapus dulu child yang eligible satu per satu (child tidak
         py child sendiri — depth dibatasi 1 level), baru hapus parent yang
         eligible **dan sudah tidak punya child tersisa**. Parent yang masih
         punya child belum eligible: **jangan disentuh sama sekali**, biarkan
         seluruh subtree menunggu sampai semuanya eligible bersama.
      5. **Cascade lain sudah aman** — `ChecklistLabelOnItem` dan `Comment`
         memakai `onDelete: Cascade` ke `checklist_id`, jadi label dan komentar
         di baris yang dihapus ikut bersih tanpa kerja tambahan.
      6. **Logging**, bukan `AuditLog`. Skrip maintenance lain di `scripts/`
         (termasuk `backfill-duplicate-categories.mjs`) melapor ke console,
         bukan menulis ke tabel audit — tidak ada aktor manusia di baliknya.
         Ikuti pola yang sama: ringkasan jumlah dihapus, jumlah dilewati
         (template), jumlah subtree ditunda (child belum eligible).
      7. **Pemicunya crontab**, bukan kode aplikasi. Tulis baris crontab yang
         disarankan di header komentar skrip (mis. jalan harian jam sepi
         trafik) — instalasi crontab yang sebenarnya di server tetap tugas
         owner (§6 `HANDOFF-CODEX.md`), bukan sesuatu yang bisa disiapkan dari
         sesi agent cloud.

      **Sengaja di luar cakupan — dicatat supaya tidak dikira tercakup:**
      `Activity` (item TODO/FEEDBACK di diskusi fase) **tidak punya** kolom
      setara `checked_at` sama sekali, dan `task-feed-query.ts` tidak pernah
      memfilternya berdasarkan umur. Baris Activity tidak disentuh purge ini.
      Kalau nanti retensi/hapus-otomatis juga diinginkan untuk Activity, itu
      item terpisah — butuh migrasi (kolom timestamp baru).

      **Tidak perlu diubah:** `task-feed-query.ts` tidak perlu perubahan apa
      pun. Proyek yang sudah Completed sudah dikecualikan total dari feed lewat
      `where: { status_progress: { not: "COMPLETED" } }` di puncak query
      (`task-feed-query.ts:78`) — jadi caranya proyek Completed sudah tidak
      pernah muncul di layar sekarang. Yang belum ada hanyalah **penghapusan
      baris dari database**, dan itu murni pekerjaan skrip di atas.

## Bug ditemukan owner 2026-08-18 — Today's View belum inline edit

- [x] **TV1 · Judul task di Today's View tidak bisa inline edit (P0) — SELESAI #35** —
      dilaporkan owner langsung: *"yang saya cek, ini saat ini, task todolist
      nya masih ga inline edit (studioflow)."*

      **Root cause sebelum #35, diverifikasi terhadap kode 2026-08-18:** `today-view.tsx`
      punya `TaskRow`-nya **sendiri** (baris ~147–317), terpisah dari
      `TaskRow` di `task-list.tsx` yang dapat inline edit di #26. Fitur #26
      hanya pernah dipasang di tab Fase dan overview proyek — Today's View
      memang belum pernah mendapatkannya. Baris 234 hanya merender
      `{task.label}` sebagai `<span>` statis; tidak ada state `editingLabel`,
      tidak ada apa pun yang bisa diklik.

      **Backend sudah siap, nol pekerjaan tambahan di situ:**
      - `updateTask({ taskId, label })` — sudah diimpor di `today-view.tsx`
        (dipakai `setDue`), tinggal dipanggil dengan `label`.
      - `updateActivityContent({ activityId, content })` — **belum** diimpor di
        `today-view.tsx`; sudah dipakai `ActivityManager` untuk pola yang sama.
        Server-nya sendiri sudah menegakkan izin lewat
        `assertPhaseContentMutationAccess` / cek keanggotaan proyek.

      **Yang dikerjakan:**

      1. Tambah `editingLabel`/`labelDraft` state ke `TaskRow` di
         `today-view.tsx`, pola identik `task-list.tsx`: klik `<span>` → jadi
         `<Input autoFocus>`, Enter/blur commit, Escape batal & kembalikan
         `labelDraft` ke `task.label`.
      2. **WAJIB ikuti pola anti-#28b yang sudah terbukti benar** — deps
         `useEffect` sinkronisasi `labelDraft` **hanya** `[task.label]`,
         `editingLabel` sengaja **tidak** dimasukkan; span merender
         `{labelDraft}`, bukan `{task.label}`. Ini persis pola yang didaftar di
         `HANDOFF-CODEX.md` §4 sebagai "gampang dirapikan jadi rusak lagi" —
         menyalin baris demi baris lebih aman daripada menulis ulang dari nol.
      3. Commit-nya bercabang menurut `task.source` (satu-satunya tempat
         `source` penting di file ini, sudah jadi pola untuk toggle & due date):
         - `"checklist"` → `onMutate(() => updateTask({ taskId: task.id, label: trimmed }))`
         - `"activity"` → `onMutate(() => updateActivityContent({ activityId: task.id, content: trimmed }))`,
           import `updateActivityContent` dari `@/actions/phase-actions`.
      4. **Tidak perlu gating izin baru.** Today's View sekarang memang tidak
         menggerbangi mutasi apa pun (toggle, due date, priority, assignee) di
         sisi klien — konsisten dengan pola yang sudah ada; server tetap
         menegakkan lewat `assertPhaseContentMutationAccess`. Menambah
         `canEdit` di sini akan jadi inkonsisten dengan mutasi lain di layar
         yang sama.

      **Verifikasi:** buka Today's View, klik judul sebuah task checklist →
      inline edit, Enter simpan, reload → nilai tetap. Ulangi untuk item
      berlabel FEEDBACK/activity (fase yang sedang ON_REVIEW). Escape harus
      mengembalikan teks asli tanpa memanggil server.

## Todo — sisa yang tidak diambil di v1

Subtask, prioritas, due date, label, assignee, komentar, empat filter bawaan,
quick-add, dan halaman lintas proyek **sudah terkirim**. Yang di bawah sengaja
ditunda, masing-masing dengan alasannya.

- [x] **C-SISA-3 · Drag-and-drop pengurutan — SELESAI 2026-08-19 (#55).**
      `TaskList` memakai pointer + keyboard sensor `@dnd-kit`. Root hanya dapat
      diurutkan di antara root; subtask hanya di dalam parent yang sama. Handle
      tampil hanya pada filter All dan kelompok minimal dua sibling, sehingga
      payload `reorderTasks` selalu berisi seluruh kelompok—task tersembunyi
      oleh filter tidak tertimpa. Urutan optimistik rollback bila save gagal.
- [x] **C-SISA-5 · Filter tersimpan — SELESAI 2026-08-19 (#46).** Model aditif
      `ChecklistFilterView { owner_id, name, query_json }` dan migrasinya sudah
      disiapkan. Tasks punya kontrol Saved filters untuk menyimpan, menerapkan,
      memperbarui berdasarkan nama, dan menghapus filter personal. JSON memakai
      predicate `status`/`priority`/`assignee`/`due`, bukan DSL teks.
      Migrasi `20260819130000_add_checklist_filter_view` **sudah diterapkan
      2026-08-19 (#59)** ke database lokal `studioflow` setelah owner secara
      eksplisit mewakilkan langkah tersebut; `prisma migrate status` menyatakan
      seluruh 28 migrasi up to date.
- [ ] **C-SISA-6 · Recurring** 🔒 — butuh parser jadwal, mesin penjadwalan, dan
      keputusan soal kemunculan yang terlewat. Sebesar seluruh bagian C
      digabung.
- [ ] **C-SISA-7 · Notifikasi assignee** 🔒 — StudioFlow belum punya mekanisme
      notifikasi sama sekali. Bukan pekerjaan kecil dan tidak boleh menumpang
      di bawah C.
- [ ] **Batas Today's View** — `applyChecklistFilter` menyaring **di memori**.
      Tepat untuk beberapa puluh baris yang sudah dipegang klien, salah untuk
      basis data penuh. Awasi saat admin mulai memakai "All projects" di studio
      besar.

## Temuan audit UX yang masih terbuka

Rincian dan buktinya di
[`docs/archive/AUDIT-UX-2026-08-10.md`](docs/archive/AUDIT-UX-2026-08-10.md).
Hanya yang bersifat **cacat** yang diangkat; temuan preferensi sengaja tidak.

- [x] **D2 · Konfirmasi aksi merusak — SELESAI #43.** Empat belas pemanggilan
      dialog bawaan di 10 berkas sudah diganti `useAppConfirm` berbasis
      `AlertDialog`. Aksi reset seluruh Product Schedule yang sebelumnya memakai
      dua dialog berurutan kini meminta frasa `DELETE ALL`; tombol aksi tetap
      nonaktif sampai frasa cocok persis. Pencarian seluruh `src/` memastikan
      tidak ada `confirm()` / `window.confirm()` global yang tersisa.
- [x] **D3 · Kegagalan yang tidak mengatakan apa-apa** — **SELESAI 2026-08-18
      (#30).** Kelima `catch` di `activity-manager.tsx` (add, toggle, delete,
      defer, saveEdit) memanggil `toast.error(...)`. Jangan dihapus saat
      merapikan blok `catch`.

- [x] **D5 · Tabel gepeng di layar sempit — SELESAI #42.** Dua berkas tersisa
      sudah memakai `minWidth` dari token semantik. Diverifikasi ulang terhadap kode
      dengan menghitung pemakai `<TableCard>` dan pemilik prop `minWidth`:

      | Status | Berkas |
      |---|---|
      | ✅ sudah punya `minWidth` | `client-management-table.tsx` (#30) · `deliverables-table.tsx` · `project-list-client.tsx` · `BrandDetailClient.tsx` · `MasterDataMaterialsClient.tsx` · `PricingClient.tsx` · `SupplierClient.tsx` · `SupplierDetailClient.tsx` |
      | ✅ ditangani beda cara (#30) | `cd-list-table.tsx` — memakai raw `<table>`, bukan komponen `<TableCard>`; diperbaiki lewat `overflow-x-auto` + `min-w-[900px]` |
      | ✅ selesai #42 | `subapps/master-data/components/SampleLibraryClient.tsx` · `subapps/master-data/components/SampleRequestPanel.tsx` — token `--ui-sample-*-table-min-width` |

      **Koreksi:** kalimat lama *"bagian Master Data sudah selesai 2026-08-11;
      sisanya di luar Master Data"* **salah** — justru dua berkas yang tersisa
      keduanya ada di Master Data. Angka "13 berkas" juga tidak akurat: yang
      memakai `<TableCard>` ada 11.

## Master Data — pekerjaan lanjutan

- [x] **A4b · Rekonsiliasi `BrandCategory` yang basi** — **SELESAI 2026-08-18
      (#30).** `upsertBrandCategories` mengumpulkan `keptIds` lalu
      `deleteMany({ source: "DERIVED_FROM_SKU", category_id: { notIn: keptIds } })`.
      **Aturan yang tetap mengikat:** rekonsiliasi hanya boleh menyentuh baris
      `DERIVED_FROM_SKU`. Baris `SEED` adalah kurasi manusia — menghapusnya
      karena tidak ada SKU yang memakainya justru kesalahan yang kolom `source`
      dibuat untuk mencegah. Baris `SEED` ditangani terpisah oleh
      `syncSeedBrandCategories`.
- [x] **A7 · Layar riwayat harga — SELESAI #40.** `SkuPrice` benar-benar menyimpan riwayat
      (mengubah nominal menutup baris lama dan menulis yang baru; "hapus" hanya
      menutup penawaran). **Datanya utuh, layarnya belum ada** — tab Harga
      menyaring `is_current: true`; viewer SKU sekarang membaca baris berlaku
      dan baris yang sudah ditutup, urut terbaru lebih dulu. Selesai tanpa model
      baru dan tanpa migrasi.

## Schedule & deliverable

- [ ] **A6 · Paket schedule — template berisi produk terpilih** 🔒 —
      `ScheduleBundle` belum ada di `schema.prisma`. `ScheduleTemplate` yang
      sekarang hanya mengisi **kerangka baris** (satu entry `reserve` kosong per
      kategori); pilihan produknya tetap mulai dari nol.
- [ ] **R-SCHED-TPL-2e · Plugin SketchUp** — kirim `reserved_codes`, adopsi slot
      template. **Out of scope sampai plugin di-update**; guard server Fase 4
      adalah perlindungan sementara.
- [ ] **B1 · Struktur foldering deliverable per fase** ⏳ **DITUNDA dengan
      gerbang (keputusan owner 2026-08-18).** Owner: *"biarkan dulu — tapi tulis
      di roadmap. Nanti setelah Master Data selesai dan StudioFlow utama tidak
      ada regresi dan works well, baru pindah ke sini."*

      **Gerbangnya dua, dua-duanya harus terpenuhi:** (1) Master Data selesai,
      (2) StudioFlow utama bebas regresi dan berjalan baik. Jangan dikerjakan
      sebelum itu, dan jangan pula dicabut — owner menyimpannya dengan sengaja.

      Konteks yang tetap berlaku: `File` datar di bawah `Revision`, tanpa kolom
      folder atau path. `PrefixDictionary` memetakan `schedule_category` →
      `prefix` per `section`, jadi kemungkinan besar prefix itu yang dimaksud
      sebagai pengelompokan. **Pertanyaan "folder buatan user atau struktur dari
      sistem" sengaja BELUM dijawab** — baru ditanyakan saat gerbangnya terbuka,
      karena jawabannya menentukan perlu migrasi atau tidak.

## Utang teknis

- [x] **T3 · Warisan `PLAN-AUDIT-ROADMAP-2026Q3.md` — TERVERIFIKASI
      2026-08-19 (#56).** Lima klaim diperiksa terhadap kode hidup, bukan
      dipercaya dari dokumen lama:

      | Klaim lama | Keadaan aktual | Putusan |
      |---|---|---|
      | Issue 1 — `/activity` dapat dilewati tanpa auth | `proxy.ts` menjalankan callback auth untuk seluruh route non-API; `auth.config.ts` fail-closed untuk semua route non-publik; `/activity` juga tetap tercantum di `APP_ROUTE_PREFIXES`, lalu `(dashboard)/layout.tsx` memeriksa akses lagi. | **Sudah selesai; klaim kerentanan usang.** |
      | Issue 5 — prefix `CD-01` ditolak | `normalizeDrawingCode()` sudah membuang prefix `CD`, dan jalur create/update CD sama-sama memakainya. | **Sudah selesai; belum ada test unit khusus normalizer.** |
      | Issue 6 — `switchActiveOption` dead code | Method masih ada di `ScheduleService`, tetapi pencarian seluruh `src/` hanya menemukan definisinya; tidak ada action/UI/caller. | **Masih benar dan terbuka → T8.** |
      | Gate `LIBRARY_*` belum bernama jujur | Premis asli “setelah `MASTERDATA_*` hilang” sudah usang karena split app tidak dijalankan. Namun `sample-actions.ts` dan `sample-request-actions.ts` milik Master Data masih memakai `LIBRARY_MANAGE_SAMPLES` / `LIBRARY_PROCESS_REQUEST`, sementara gate Master Data lain sudah namespaced. | **Sebagian benar dan terbuka → T9.** |
      | Badge progress selesai dengan `max-w-full` | Badge `IN_PROGRESS` sekarang benar-benar membatalkan `shrink-0` lewat `min-w-0 !shrink`; badge `READY_FOR` masih hanya memakai `max-w-full truncate`, sehingga base `Badge` tetap `shrink-0`. | **Hanya selesai sebagian → T10.** |

      Tidak ada kode yang diubah pada verifikasi ini, sesuai batas T3.
- [ ] **T8 · Putuskan nasib `ScheduleService.switchActiveOption`** — method
      transaksi + audit masih utuh tetapi tidak punya satu pun caller. Pilih
      salah satu secara eksplisit: hapus sebagai dead code, atau buka action/UI
      yang memang membutuhkan pemindahan `active_index`. Jangan menghubungkannya
      secara spekulatif hanya agar method tampak terpakai.
- [ ] **T9 · Namespacing permission Sample/Request Master Data** — petakan
      `LIBRARY_MANAGE_SAMPLES` dan `LIBRARY_PROCESS_REQUEST` yang saat ini
      mengunci mutasi di `src/subapps/master-data/actions/` ke nama
      `MASTERDATA_*` yang jujur, lalu audit matrix, server action, UI gate, dan
      verifier sebagai satu perubahan atomik. `LIBRARY_VIEW` dan permission
      request yang benar-benar melayani StudioFlow Library tidak otomatis ikut
      diganti; grain kewenangannya harus diputuskan dahulu agar rename tidak
      diam-diam mengubah akses.
- [ ] **T10 · Selesaikan kontrak shrink badge `READY_FOR`** —
      `ProjectProgressBadges` sudah aman untuk `IN_PROGRESS`, tetapi jalur
      `READY_FOR` masih mewarisi `w-fit shrink-0 whitespace-nowrap` dari base
      `Badge`; `max-w-full truncate` saja tidak dapat menyusutkan pil. Perbaiki
      dengan pola token/override yang sama dan verifikasi pada viewport sempit,
      bukan hanya class inspection.
- [x] **T6 · Sebelas error eslint lama** — **SELESAI 2026-08-18 (#30).** Kelima
      berkasnya bersih. **Bentuk yang sekarang berlaku — jangan dirapikan balik:**

      | Berkas | Sekarang |
      |---|---|
      | `extensions/schedule/lib/display-utils.ts` | 4× `as any` → `unknown`-cast bertipe (`LegacySnap = Record<string, unknown>`) |
      | `ui_engine/components/ProjectLiveProvider.tsx` | `catch (error: unknown)` + `error instanceof Error && error.name === "AbortError"` |
      | `components/template-manager.tsx` | `catch (err: unknown)` + `err instanceof Error ? err.message : String(err)` |
      | `components/today-inline-add.tsx` | `tagQuery` = `useMemo` dari `value` (bukan `useState`+`useEffect`); reset `activeIndex` di `useEffect([tagQuery])` terpisah |
      | `components/today-quick-add-modal.tsx` | smart-tag lewat `applySmartTag` (`useCallback`) dipanggil dari `onChange`, bukan `useEffect` |

      **Yang lebih penting daripada kesebelasnya:** menjaga angkanya di nol,
      supaya "lint hijau" kembali jadi sesuatu yang bisa diperiksa siapa pun.
      **Regression check 2026-08-19 (#58):** full lint menemukan satu import
      primitive langsung pada `DeleteConfirmDialog`; jalurnya sudah dikembalikan
      ke `@/ui_engine`, copy `Cancel` diselaraskan ke Inggris, dan tombol hapus
      memakai variant semantic `destructive`. Full lint kembali 0 error.
- [x] **Test untuk `getBrandView` dan `getSkusForBrand` — SELESAI 2026-08-19
      (#59), Opsi A.** Keduanya tidak layak diuji dengan mock
      Prisma: `getBrandView` memadukan raw SQL `unnest(tags)`, filter relasi,
      aggregate count, soft-delete, sorting, dan pagination; `getSkusForBrand`
      membaca object graph lintas schema. Mock hanya membuktikan object query
      yang kita tulis, bukan perilaku PostgreSQL yang hendak dijaga. Runner
      `npm test` saat ini juga sengaja menolak import runtime yang mencapai
      Prisma, jadi suite DB harus menjadi jalur terpisah.

      | Opsi | Kelebihan | Biaya/risiko | Putusan usulan |
      |---|---|---|---|
      | **A. Service PostgreSQL test disposable lewat Docker Compose** | Repo sudah punya `docker-compose.yml` Postgres 15; memakai seluruh migrasi nyata termasuk schema `master_data`, raw SQL, view, dan index parsial; tidak menambah library orkestrasi. | Memerlukan Docker; perlu service/URL khusus agar tidak pernah memakai volume DB dev. | **REKOMENDASI.** Paling kecil perubahan infrastrukturnya dan tetap menguji kontrak DB asli. |
      | **B. Testcontainers per test run** | Lifecycle container otomatis dan isolasi per run kuat; cocok bila nanti ada CI paralel. | Menambah dependency + waktu startup dan tetap memerlukan Docker; repo belum punya CI/test runner integrasi. | Pertimbangkan nanti bila suite/CI sudah cukup besar untuk membayar orkestrasi tambahan. |
      | **C. Mock Prisma** | Cepat dan tanpa Docker. | Tidak menguji raw SQL, collation/case-insensitive search, aggregate, relation filter, multi-schema, atau migrasi. | **Ditolak untuk dua query ini.** Test murni `brand-view-rules.test.ts` tetap dipertahankan untuk aturan tanpa I/O. |

      **Bentuk implementasi Opsi A yang diusulkan:** tambah service `db-test`
      tanpa persistent volume dan URL eksplisit `TEST_DATABASE_URL`; runner
      `npm run test:integration` wajib menolak host non-loopback dan nama DB
      yang tidak berakhiran `_test`, menjalankan `prisma migrate deploy` ke DB
      disposable, lalu dynamic-import service setelah env test terpasang.
      `npm test` tetap suite murni cepat; keduanya baru digabung pada
      `test:all` setelah stabil. Fixture dibuat minimal dengan id unik dan
      dibersihkan setelah suite—tidak seed penuh, tidak memakai database dev,
      dan tidak pernah fallback ke `DATABASE_URL`.

      **Cakupan test pertama:** pencarian Brand melalui nama/owner/category/
      hashtag/supplier/SKU; exclusion soft-delete; count completeness dan
      supplier hidup; sort/pagination; lalu `getSkusForBrand` untuk scope Brand,
      exclusion SKU terhapus, urutan code, relasi current price/sample/category,
      dan batas `EXPANDED_SKU_LIMIT`.

      **Hasil #59:** `db-test` Postgres 15 berjalan di tmpfs pada port loopback
      terpisah, menjalankan seluruh 28 migrasi, lalu selalu dibuang. Runner
      menolak URL non-test/non-loopback/fallback ke DB runtime. Empat test DB
      nyata menutup search lintas relasi + soft-delete/count/sort/pagination,
      scalar relations SKU, dan truncation 201→200. `npm run test:all`
      menggabungkan 126 test murni + 4 test integrasi tanpa mengubah `npm test`
      menjadi tergantung Docker.
- [x] **Build produksi — TERVERIFIKASI 2026-08-19 (#44).** `npm run build`
      berhasil: Prisma Client ter-generate, Next.js 16.2.1 terkompilasi,
      typecheck dan static-page generation selesai, termasuk route baru
      `/masterdata/skus`. Peringatan `export const config` pada App Router yang
      muncul di build pertama juga sudah diselesaikan dan build final bersih.
- [ ] **T7 · Graphify code graph belum otomatis diperbarui** —
      `graphify-out/graph.json` + `GRAPH_REPORT.md` + `graph.html` dibuat
      manual 2026-08-19 dari `src/`+`prisma/`+`docs/`+`scripts/` (generated
      Prisma Client `src/generated/**` dikecualikan — lihat `CHANGELOG.md`).
      Belum ada git hook rebuild-otomatis (`graphify install` menyediakannya),
      belum ada backend LLM untuk label komunitas semantik (masih placeholder
      "Community N"), dan paket `graphifyy[sql]` belum dipasang untuk
      ekstraksi 62 berkas `.sql`. **Kalau graph ini mau dipakai rutin untuk
      navigasi codebase (bukan sekali pakai):** pasang git hook, pertimbangkan
      `--backend <provider>` untuk label yang bermakna, dan jalankan ulang
      `graphify extract . --code-only` setelah refactor besar supaya tidak
      basi. Output sengaja **tidak** di-commit (`/graphify-out/` di
      `.gitignore`) karena regenerable dan `graph.json`-nya besar (~4 MB).

---

# ═══ DICABUT — premisnya sudah tidak ada ═══

Diverifikasi 2026-08-18 terhadap kode. Ketiganya dicabut karena **keadaan
sekarang lebih benar daripada yang diminta roadmap**, bukan karena diabaikan.

| Item | Bunyi lamanya | Kenapa dicabut |
|---|---|---|
| **M1 · IA nav** | "masukkan `/masterdata/prices` ke `MASTERDATA_SECTIONS`" | Prices **sudah** ada di nav (`MasterDataNavOuter.tsx:29`). Konstanta yang diminta diedit ada di `MasterDataNav.tsx` — berkas yang tidak pernah diimpor siapa pun (§19). Dua-duanya salah. |
| **B6 bagian kedua** | "ganti `db` → `tx` di `pricing-actions.ts:369-470`" | Satu-satunya `db` di rentang itu ada di `getServiceVendorsAction`, yang memang `useTransaction: false`. Memakai klien global di aksi baca non-transaksional adalah **pola yang benar**, bukan cacat. Bagian `quick-entry-actions.ts` tetap terbuka. |
| **T2 · Kolom kategori tabel harga** | — | Sudah tertutup sendiri oleh v2; dicatat di arsip sebagai peringatan agar `PRODUCT` dan `WORK` tidak "dirapikan" jadi satu pohon. Bukan todo. |

## Selesai pada perapihan ini

| Item | Hasil |
|---|---|
| **D3** (dokumen) | Komentar `sampleState()` di `material-view-service.ts` sudah benar sejak perbaikan B1 — klaim "`SENT_TO_CLIENT` tidak ada" sudah tidak ada di sana. |
| **D4** (dokumen) | `AGENTS.md` aturan 8 tidak lagi menunjuk `CHANGELOG-CODEX.md`; log handoff resmi sekarang `changelog.md`. Alasannya di changelog #24. |
| **T5** (dokumen) | `MASTER_SSOT.md` diarsipkan dan diganti penunjuk arah. Tiga dokumen v1 sisanya diberi banner usang. |

## Selesai 2026-08-18 (#32) — Enam keputusan owner: H5, §10, M5, BR8, B1, urutan kerja

Dikerjakan atas permintaan owner: *"coba kamu buatkan aku pertanyaan secara awam
apa yg perlu saya decide."* Sembilan pertanyaan diajukan dalam tiga putaran —
putaran kedua dan ketiga lahir karena verifikasi kode menemukan konsekuensi yang
tidak terlihat dari pertanyaan pertama.

| Item | Keputusan | Yang dikerjakan Codex |
|---|---|---|
| **H5** | Izin harga **tidak dipisah** — urus supplier = urus harga. | Hapus `MASTERDATA_PRICE_MANAGE` + `MASTERDATA_OFFERING_MANAGE`; keduanya terverifikasi nol penegakan. |
| **§10** | Semua role (STAFF/ADMIN/DEVELOPER) boleh edit Master Data, dan **edit tidak menurunkan status**. | Cabut paksaan `PENDING` di `MasterDataProductDialog.tsx:477` **dan** `library-actions.ts:276`. CREATE tetap `PENDING`; wewenang menyetujui tetap admin-level. |
| **M5** | **Bahasa Inggris** untuk semua teks yang dibaca pengguna, termasuk pesan error. Dokumen internal tetap Indonesia. | Terjemahkan `mapKnownPrismaError()` (#27) ke Inggris — tetap actionable, bukan pesan Prisma mentah. Membuka **UI-CON-3**. |
| **BR8** | **Direframe** — bukan tombol create (sudah selesai #28), tapi **viewer**. | (a) popup detail SKU dari tabel harga, riwayat harga **A7** sekalian; (b) halaman daftar SKU lintas-brand baru, tab SKU di Brand tetap ada. |
| **B1** | **Ditunda dengan gerbang** — baru dikerjakan setelah Master Data selesai DAN StudioFlow utama bebas regresi. | Tidak ada. Pertanyaan folder-user vs folder-sistem sengaja belum dijawab. |
| **Urutan** | Bug layar harian dulu. | BR3 → BR1 → BR6 → §10+H5 → BR8 viewer+A7 → M5+UI-CON-3 → D5 sisa+D2. |

**Dua putaran tambahan itu bukan basa-basi.** Jawaban pertama §10 (*"staf tanpa
wewenang tidak boleh edit sama sekali"*) ternyata berarti hanya ADMIN dan
DEVELOPER yang bisa mengubah data material — padahal komentar di `matrix.ts`
menyebut tugas STAFF justru *"maintains vendors, materials, prices and
samples"*. Setelah konsekuensinya dijelaskan, owner membalik keputusannya. Hal
yang sama terjadi pada M5: jawaban pertama *"biarkan dulu"* berubah jadi
*"semua Inggris"* setelah ditunjukkan bahwa Codex tetap akan menulis teks baru.

**Klaim yang perlu diluruskan:** aturan Inggris **bertabrakan** dengan #27, yang
sengaja mengubah pesan error Prisma dari bahasa mentah jadi Bahasa Indonesia
yang bisa ditindaklanjuti. Owner memilih menerjemahkannya ke Inggris. Yang
**bukan** penerapan aturan ini: mengembalikan pesannya jadi Prisma mentah — itu
regresi #27.

## Selesai 2026-08-18 (#31) — Handoff ke Codex: checkpoint git + rekonsiliasi roadmap

Dikerjakan atas permintaan owner: *"sekarang project ini akan di takeover
'codingnya' oleh codex… tolong update apa saja yg sudah dan apa saja yg belum
dan perlu di verifikasi oleh saya sebagai owner… jangan sampai pekerjaan roadmap
malah regresi."*

| Hal | Temuan / hasil |
|---|---|
| **Checkpoint git** (`5d87662`) | **475 berkas tidak pernah masuk git** — seluruh `prisma/migrations/` (28 folder, termasuk rebaseline v2 `20260810180000`), `src/subapps/master-data/{hooks,config,components/shared}`, `src/app/api/masterdata/`, `src/extensions/library/contracts/`, `docs/archive/`, plus 8 dari 9 berkas hasil #30. Commit sebelumnya hanya menyentuh berkas yang disebut per task. Satu commit checkpoint merekam isi disk apa adanya, **nol baris kode berubah**. Sekarang `git status` bersih. |
| **`.gitignore`** | Ditambah: `*.rar` (ada `studioflow.rar` 352 MB di root), snapshot `.zip`, `/_to_delete/`, `.~lock.*#`, `/tmp/backfill-out/`. |
| **`AGENTS.md`** | Bagian baru §🧑‍⚖️ Pembagian Peran: Codex menulis kode, Claude jadi product specialist & reviewer. Claude hanya menulis kode kalau item (1) disepakati di roadmap, (2) tercatat belum selesai di changelog, atau (3) diminta langsung owner. |
| **`HANDOFF-CODEX.md`** (baru) | Ringkasan satu halaman untuk Codex: keadaan repo, 18 keputusan yang tidak boleh dimundurkan, pekerjaan terbuka terverifikasi, dan 6 tugas owner. |
| **Rekonsiliasi roadmap** | Enam item (PR1, M4, M8, A4b, T6, D3) masih tertulis terbuka padahal selesai di #30 — ditutup. **D5 ternyata belum selesai**: klaim *"bagian Master Data sudah selesai 2026-08-11"* salah, `SampleLibraryClient.tsx` dan `SampleRequestPanel.tsx` masih tanpa `minWidth`. Angka "13 berkas" juga tidak akurat — yang memakai `<TableCard>` ada 11. |

**⏳ Owner — enam hal yang tidak bisa dijalankan agent cloud:**

1. `npm run build` — belum pernah diverifikasi di siklus ini (sandbox SIGBUS).
2. `npx prisma migrate deploy` — `20260818120000_add_checked_at_to_checklist`
   (#29) mungkin belum diterapkan. ⚠️ **Dua migrasi memakai prefix timestamp
   yang sama** `20260818120000`; urutannya tetap deterministik (leksikografis),
   tapi jangan tambah yang ketiga dengan prefix itu.
3. Hapus `_to_delete/MasterDataNav.tsx` (sisa §19).
4. Push **14 commit** ke `origin/main`.
5. Jawab lima pertanyaan ⏳: **H5**, **§10**, **M5**, **BR8**, **B1**.
6. Jalankan uji manual — §Uji manual task (9 langkah) dan §Uji manual Master
   Data v2 (19 langkah, butuh mesin dengan database).

## Selesai 2026-08-18 (#30) — Tujuh item one-shot: PR1, M4, M8, A4b, T6, D3, D5

Dikerjakan atas permintaan owner: *"overall check utk semua roadmap, yg bisa di
kerjakan one shot dengan efisien dan sudah jelas semua apa saja. di kerjakan aja
langsung"* — scan seluruh roadmap, ambil semua yang bisa diselesaikan tanpa
keputusan owner / migrasi skema / scope besar.

| Item | Masalah | Solusi |
|---|---|---|
| **PR1** (efisiensi) | `PartyPicker` di PricingClient hanya membungkus `CreatableSearch` tanpa nilai tambah. | Hapus wrapper; panggil `CreatableSearch` langsung. Import `PartyPicker` dihapus. |
| **M4** (performa) | `getPartyBrandsAction` memuat semua SKU brand, bukan hanya yang punya harga. | Filter ke `priceSkuIds` saja sebelum query Prisma. |
| **M8** (guard) | Route import Excel tidak memvalidasi ukuran file sebelum membaca buffer. | Tambah guard `413` untuk file > 20 MB, dengan pesan ukuran aktual. |
| **A4b** (konsistensi) | `upsertBrandCategories` additive-only — baris `DERIVED_FROM_SKU` lama tidak dihapus. | Tambah `deleteMany` untuk baris stale, konsisten dengan `syncSeedBrandCategories`. |
| **T6** (lint/ts) | Lima berkas: `as any`, `catch (error: any)`, `useEffect` memanggil `setState` langsung. | Ganti `as any` → `unknown`-cast, catch → `unknown` + `instanceof Error`, `tagQuery` → `useMemo`, smart-tag → `useCallback`. |
| **D3** (UX) | Lima handler di `ActivityManager` tidak memberi feedback saat aksi gagal. | Tambah `toast.error(…)` dari `sonner` di setiap `catch`. |
| **D5** (responsive) | `cd-list-table` dan `client-management-table` overflow tersembunyi, tidak bisa scroll horizontal. | `cd-list-table`: `overflow-x-auto` + `min-w-[900px]`. `client-management-table`: `<TableCard minWidth="640px">`. |

## Selesai 2026-08-18 (#29) — Perbaikan tambahan inline edit (#28b) + dua fitur Today's View

Dikerjakan atas permintaan owner setelah bug #28 selesai. Dua fitur baru
belum pernah tercatat di roadmap sebelumnya — langsung diimplementasikan dan
dicatat di sini sebagai selesai.

Verifikasi: `npx tsc --noEmit` bersih, `npx prisma validate` bersih.

| Item | Root cause / Motivasi | Perbaikan |
|---|---|---|
| **Bug #28b · Inline edit: label berbalik ke nilai lama saat save** | `useEffect([task.label, editingLabel])` berjalan saat `editingLabel` menjadi `false`, memanggil `setLabelDraft(task.label)` dengan nilai server lama sebelum `router.refresh()` tiba. | `task-list.tsx` deps diubah ke `[task.label]` saja (`editingLabel` sengaja dihilangkan). Efek hanya berjalan saat nilai server berubah. |
| **Fitur · Grup proyek kosong collapsed secara default di Today's View** | Grup tanpa task di-expand secara default, memakan ruang layar tanpa informasi. | `today-view.tsx` inisialisasi `collapsed` state dengan ID semua grup yang `tasks.length === 0`. Toggle tetap bisa dipakai pengguna. |
| **Fitur · Task dicentang otomatis hilang dari Today feed setelah 7 hari** | Task yang sudah selesai menumpuk di feed selamanya, mengubur task aktif. | Field `checked_at DateTime?` ditambahkan ke `ProjectChecklist` (migrasi baru). `executeToggleChecklist` mengisi/mengosongkan `checked_at`. `getTaskFeed` memfilter baris `is_checked: true AND checked_at < 7 hari lalu`. Baris null-`checked_at` (data lama) tidak terfilter — aman retroaktif. |

## Selesai 2026-08-18 (#28) — Dua bug dilaporkan owner: SKU CreatableSearch dan inline edit task

Dikerjakan atas permintaan owner yang mengirim screenshot dua layar rusak setelah
DB di-reset. DB reset tidak jadi masalah (tidak perlu jalankan skrip backfill).

Verifikasi: `npm test` 118/118 lulus, `npx tsc --noEmit` bersih.

| Bug | Root cause | Perbaikan |
|---|---|---|
| **SKU / Material picker di "Add Material Price" selalu kosong** | `SkuPicker` membungkus `CreatableSearch` tapi tidak pernah meneruskan prop `onCreate` — tidak ada jalur untuk membuat SKU baru. Setelah DB reset (nol SKU), picker selalu kosong. | `SkuPicker.tsx` menerima `onCreate?` + `isCreating?` dan meneruskannya ke `CreatableSearch`. `PricingClient.tsx` `HargaMaterialTab` menambahkan `skuEntry` via `useQuickEntry(quickCreateSkuAction)` — pola yang sama dengan `supplierEntry` dan `brandEntry`. `skusForBrand` diubah memakai `skuEntry.options` agar baris yang baru dibuat langsung muncul. Non-manager tetap hanya bisa mencari. |
| **Inline edit judul task: label berkedip kembali ke nilai lama** | Span menampilkan `task.label` (nilai server). `commitLabelEdit` memanggil `setEditingLabel(false)` (sync) lalu `onMutate` (async). Sebelum `router.refresh()` datang, span sudah menampilkan label lama — terlihat seolah simpan ditolak. | `task-list.tsx` span sekarang merender `{labelDraft}` (bukan `{task.label}`). `labelDraft` dijaga sinkron dengan server oleh `useEffect` yang sudah ada; rollback tetap benar bila server menolak. `setLabelDraft(task.label)` dihapus dari handler onClick/onKeyDown span. |

## Selesai 2026-08-18 (#27) — Gelombang 4 lengkap: B3, B5, B7, H3, H7, H8, M6, M9

Dikerjakan atas permintaan owner: *"kerjakan semua gelombang 4 - update
changelog dan roadmap nya"*. Dua item (H7, M9) sebelumnya ditandai 🔒 —
ditanyakan ke owner dulu lewat `AskUserQuestion` sebelum menyentuh apa pun,
sesuai aturan "JANGAN ubah skema Master Data tanpa tanya owner dulu":

- **H7** — owner memilih "kerjakan + siapkan migrasi (jangan dijalankan)".
  **Hasilnya migrasi tidak jadi ditulis** — lihat temuan di bawah.
- **M9** — owner memilih **advisory lock**, bukan sequence Postgres, supaya
  nol migrasi.

Verifikasi: `npm test` 118/118 lulus, `npx tsc --noEmit` (seluruh `src/`)
bersih, `npx prisma validate` bersih, `npx eslint` pada seluruh berkas yang
disentuh nol error (satu warning pra-ada, `companies` tak dipakai di
`SupplierDetailClient.tsx` — sama seperti dicatat di #25, bukan hasil
perubahan ini). `next build` tetap tidak bisa diverifikasi di sandbox cloud
(SIGBUS, masalah lama).

### Temuan saat dikerjakan — H7 ternyata tidak butuh migrasi

Roadmap menulis "`WorkPrice` belum punya `deleted_at`" untuk H7. Saat
dikerjakan, `schema.prisma` sudah punya kolom itu — ditambahkan migrasi
rebaseline `20260810180000`, dan `getServicePricesAction`/
`getMaterialLaborPricesAction` bahkan **sudah** memfilternya, hanya belum ada
yang pernah mengisinya. Roadmap-nya sendiri yang usang, bukan kodenya. H7 jadi
perbaikan kode murni: dua `tx.workPrice.delete()` diganti pola soft-delete
yang sama dengan `deleteMaterialPriceAction`. **Tidak ada berkas migrasi baru
di sesi ini** — keputusan owner "siapkan migrasi" jadi tidak berlaku karena
premisnya (kolom belum ada) sudah tidak benar saat dicek ulang.

### B5 — dua bug audit-log dobel ditemukan, di luar audit asli

Konsolidasi lima jalur pembuatan SKU ke `createSkuCore` membongkar dua tempat
di `library-service.ts` yang memanggil **baik** `recordAudit` (ke
`master_data.MasterDataAudit`, benar) **maupun** `insertAuditLog` (ke
`studioflow.AuditLog`) untuk SKU CREATE yang sama — pelanggaran `AGENTS.md`
§6, dan bukan satu-satunya: `sample-request-actions.ts` punya cacat
sebaliknya, hanya memanggil `insertAuditLog` tanpa `recordAudit` sama sekali
(kelas cacat yang sama dengan §11, ditutup di #25 untuk `Sample`). Ketiganya
tertutup begitu jalurnya lewat `createSkuCore`, yang memanggil `recordAudit`
tepat satu kali.

| Item | Hasil |
|---|---|
| **M6** | `action-wrapper.ts` — `mapKnownPrismaError()` baru memetakan `Prisma.PrismaClientKnownRequestError` (P2002 → pesan bentrok pakai `error.meta?.target`, P2025 → tidak ditemukan, P2003 → FK, P2014 → relasi wajib, default → pesan DB generik) sebelum jatuh ke `error.message` mentah. |
| **B3** | `slug-service.ts` (baru) — `ensureUniqueSlug(base, exists)`, sufiks `-2`/`-3`/…, fallback `item-<hex>` kalau `base` kosong. Dipakai di `party-actions.ts`, `pricing-actions.ts`, `quick-entry-actions.ts` (Party/Brand/WorkVendor — Sku lewat B5). |
| **B5** | `sku-core-service.ts` (baru) — `createSkuCore(tx, params, actor)` menjamin slug unik (lewat B3), `base_unit` fallback `"pcs"` (dulu `quickCreateSkuAction` menulis `""`), kategori primer `is_primary: index===0` kalau `categoryIds` diisi, dan **tepat satu** `recordAudit`. Dipakai `library-service.ts` (dua lokasi), `quick-entry-actions.ts`, `sample-request-actions.ts`, `excel-service.ts`. |
| **B7** | `category-tree-service.ts` — lookup `upsertCategory` menambah cabang pencarian kategori root bernama sama saat `parentId` bukan null, jadi `needsParent` bisa tereksekusi; `propagateDescendantPaths()` baru menurunkan perubahan `path` ke seluruh keturunan (query `startsWith`, bukan rekursi `parent_id`). `scripts/backfill-duplicate-categories.mjs` (baru, dry-run default) — hanya menggabungkan pasangan root+nested `(kind, name)` yang persis sama dan root-nya tidak punya sub-kategori sendiri; selain itu dilaporkan sebagai "perlu tinjauan manual", tidak ditebak. |
| **H3** | `party-delete-service.ts` (baru) — `assertPartyDeletable(tx, partyId)` memeriksa brand + `WorkPrice` + `SkuPrice.supplier_party_id` + `BrandSupplier` sekaligus, dipakai `deleteCompanyAction` dan `deleteServiceVendorAction`. §17 — `updatePartyContactAction`/`deletePartyContactAction` menerima `partyId` opsional, menolak (`NOT_FOUND`) kalau tidak cocok dengan kontak; `SupplierDetailClient.tsx` diupdate mengirim `partyId`. |
| **H7** | `pricing-actions.ts` — `deleteServicePriceAction`/`deleteMaterialLaborPriceAction`: `tx.workPrice.delete()` → `tx.workPrice.update({ data: { deleted_at: new Date() } })`. **Nol migrasi** — lihat temuan di atas. |
| **H8** | `pricing-actions.ts` — keempat aksi update/delete work price sekarang mencari row lewat `findFirst({ id, kind, deleted_at: null })`, bukan `findUnique({ id })` polos. |
| **M9** | `pricing-actions.ts` `generateWorkPriceCode` — `SELECT pg_advisory_xact_lock(hashtext('work_price_code'))` di awal fungsi, di dalam transaksi yang sama; menyerialkan pemanggil bersamaan alih-alih membiarkan mereka balapan lalu bergantung `@unique` menangkap tabrakannya. |

**Belum dikerjakan** (di luar Gelombang 4): Gelombang 5 (M3/M4/M8/§20), seluruh
⏳ Menunggu Keputusan Owner, seluruh BR1–BR8/UI-CON-*, dan bagian STUDIOFLOW di
luar Master Data. ~~**Owner masih perlu:** jalankan
`node scripts/backfill-duplicate-categories.mjs` (dry-run dulu) dari mesin
dengan akses DB untuk membereskan duplikat kategori lama akibat bug B7.~~ —
**Tidak perlu lagi**: owner mereset DB (#28), duplikat lama sudah bersih.

## Selesai 2026-08-18 (#25) — Gelombang 1, 2, dan B6

Dikerjakan atas permintaan owner: *"baca roadmap nya, kerjakan yg sudah pasti
bisa di kerjakan"* — dibaca sebagai: seluruh item **tanpa** tanda ⏳ (owner) atau
🔒 (migrasi) di Gelombang 1–2, plus B6 yang jelas aman (murni penataan ulang
kode, tidak menyentuh skema). Verifikasi: `npm test` 118/118 lulus,
`npx tsc --noEmit` bersih, `npx prisma validate` bersih, `npx eslint` pada
seluruh berkas yang disentuh nol error (dua warning pra-ada, tidak disentuh).
`next build` tetap belum diverifikasi — sandbox cloud SIGBUS, jadi tetap tugas
owner (lihat §Catatan Prisma di bawah, alasan yang sama).

| Item | Hasil |
|---|---|
| **§11** | `sample-actions.ts` — `insertAuditLog` (tiga jalur: create/update/status) diganti `recordAudit(tx, …)` ke `master_data.MasterDataAudit`. Import `AUDIT_ACTIONS` yang jadi tak terpakai dibuang. |
| **M7 / §3** | `material-view-service.ts` — facet kategori sekarang memfilter `kind: "PRODUCT"`, plus dedup nama lewat `Set` sebagai jaring pengaman. |
| **§25** | `types/party.ts:40` — `"Manufacture"` → `"Manufacturer"`. |
| **§24** | `SampleLibraryClient.save()` — baris `setDialog(…open:false)` sebelum `editGuard.closeAfterSave()` dibuang (`closeAfterSave()` sudah memanggil `onOpenChange(false)` sendiri). |
| **§13** | `pricing-actions.ts` `mapWorkPriceCommon` — `p.price != null ? Number(p.price) : 0` → `Number(p.price)`. |
| **§21** | `SupplierDetailClient.tsx` — dua `<a href>` (tabel Brand + `PricesTab`) diganti `<Link>` dari `next/link`. |
| **§22** | `BrandDetailClient.tsx` — pencarian SKU brand pakai `useDebounce(search, 300)`; submit form tetap memakai nilai mentah. |
| **§14** | `pricing-actions.ts` `getServiceVendorsAction` — tambah `is_active: true` di `where`. |
| **Prop mati `initialSummary`** | Dibuang dari `SampleLibraryClient`; `app/masterdata/samples/page.tsx` berhenti memanggil `getSampleSummaryAction` (jadi tak terpakai lewat halaman ini). |
| **B6** | `quick-entry-actions.ts` — keempat quick-create handler (`Party`, `Brand`, `WorkVendor`, `Sku`) menerima `tx` langsung dari `createAction`, tidak lagi membuka `db.$transaction(...)` kedua. Import `prisma`/`db` yang jadi tak terpakai dibuang. |
| **§19 (sebagian)** | `MasterDataNav.tsx` dipindah ke `_to_delete/MasterDataNav.tsx` — agent cloud tidak bisa `rm` di folder yang di-mount. ⏳ **Owner**: hapus foldernya. `SupplierJasaTab`/`InlineCompanyCell`/`toggleSort` tetap ditahan, belum disentuh. |

**Belum dikerjakan dari sisa roadmap** (butuh scope lebih besar, keputusan
owner, atau migrasi — di luar "sudah pasti bisa dikerjakan"): B3, B5, B7, H3,
H7/H8, M6, M9, Gelombang 5 (M3/M4/M8/§20), seluruh ⏳ Menunggu Keputusan Owner,
seluruh BR1–BR8 dan UI-CON-*, dan bagian STUDIOFLOW di luar Master Data.

---

# ═══ ACUAN ═══

## Arah strategis (keputusan owner 2026-08-10, masih berlaku)

1. Master Data dirombak ulang — v2 sudah berdiri sejak rebaseline 2026-08-10.
2. StudioFlow diputus dari Library/Master Data — ketergantungan langsung antar
   keduanya dihilangkan.
3. Fokus perbaikan StudioFlow lebih dulu.

## Catatan Prisma — berlaku untuk setiap item bertanda 🔒

Agent **tidak bisa** menjalankan `prisma generate` / `prisma migrate dev` dari
sesi cloud: environment-nya Linux, proyek ini Windows dengan binary Prisma
engine khusus Windows di `node_modules`. Menjalankannya dari Linux menulis
binary yang salah ke `src/generated/prisma` dan merusak dev server.

Setiap perubahan schema karena itu selalu berakhir sebagai tugas Anda:

```bash
npx prisma generate
npx prisma migrate deploy     # atau migrate dev saat mengembangkan
npm run typecheck
```

Lalu restart dev server (hapus `.next` juga kalau overlay masih menunjukkan
"(stale)").

## Perkakas — kenapa test hanya menyentuh modul murni

`npm test` memakai test runner bawaan Node lewat `scripts/run-tests.mjs`.
Berkas test hanya boleh mengimpor modul yang **tidak** menyentuh Prisma atau
`server-only` saat runtime; `import type` aman karena hilang saat transpile.

Batasan itu justru gunanya: ia menjaga kode yang diuji tetap bebas I/O. Ketikan
tipe tidak diperiksa di sini — `npm run typecheck` sudah menutup seluruh `src/`.

Itulah sebabnya `sku-price-rules.ts`, `category-tree-rules.ts`,
`party-role-rules.ts`, dan `slug.ts` sengaja dipisahkan dari berkas service-nya.

## Uji manual — task

Yang perlu dilihat sendiri, karena tidak tertutup uji otomatis:

1. Fase → **Tambah task**, Enter → muncul **di bawah**, bukan di atas
2. Titik tiga → **Tambah subtask** → centang **induknya** → subtask ikut tercentang
3. Lepas centang induk → subtask **ikut lepas** (cascade dua arah)
4. Bilah progres dan badge navigasi hanya menghitung **task akar**
5. Beri P1 + due date kemarin → tab **Terlambat** dan **P1** muncul dengan angka
6. Centang task terlambat itu → hilang dari tab **Terlambat**
7. Titik tiga pada baris hasil template → hanya **Lepas dari template**, tanpa Hapus
8. Lepas dari template → **Hapus** muncul → hapus → **tidak kembali** setelah reload
9. Muat ulang halaman → urutan **tidak berubah**

Langkah 9 yang paling mudah terlewat: cacat lamanya baru terlihat sesudah
polling pertama mendarat, karena saat itulah urutan versi server menggantikan
urutan render awal.

## Uji manual — Master Data v2

**Butuh mesin yang punya database.**

**Material dan harga**

1. Materials → **Add Material**, isi identitas + harga, pilih Supplier → simpan
   sekali. Harga muncul di tab Pricing **tanpa** langkah kedua
2. Tambah harga kedua untuk SKU yang sama dari **supplier berbeda** → keduanya
   tampil, kartu material menampilkan yang **termurah**
3. Edit harga supplier pertama → **penawaran supplier kedua tetap berlaku**
4. Isi harga, kosongkan satuan → barisnya **tidak** terhitung BQ-ready
5. Ubah **hanya** catatan sebuah harga → baris yang sama diubah, tidak ada baris
   riwayat baru
6. **Remove** sebuah harga → hilang dari daftar, tapi barisnya masih ada dengan
   `is_current: false` dan `valid_to` terisi

**Barang tanpa brand**

7. Add Material tanpa memilih brand, mis. "plywood 9mm" → **tersimpan**
8. Simpan lagi dengan nama sama, tetap tanpa brand → **ditolak** oleh
   `Sku_slug_nobrand_uniq`

**Supplier dan kategori Party**

9. Supplier → buka sebuah Party → centang **Supplier** (atau **Retail store**)
   → simpan
10. Halaman Pricing → pemilih Supplier → **nama itu harus muncul**
11. Party berkategori **Retail** juga harus muncul
12. Party **tanpa** kategori tidak muncul; kalau id-nya dipaksa lewat, server
    menolaknya
13. Buka lagi Party tadi → centangnya **masih ada** setelah reload

**Nama yang pernah dihapus (setelah migrasi `20260818120000`)**

14. Hapus sebuah Supplier, lalu buat lagi dengan **nama yang sama persis** →
    **tersimpan**, tidak lagi crash P2002
15. Buat Party bernama "ACE HARDWARE" saat "Ace Hardware" masih hidup →
    **ditolak** dengan pesan yang menyebut nama yang bentrok

**Sample (setelah perbaikan `SampleStatus`)**

16. Ubah status sebuah sample jadi **Di klien** → tersimpan sebagai "Di klien",
    bukan "Dipinjam"
17. Tandai sebuah sample **Hilang** → tidak diminta nama pemegang, badge-nya
    sendiri, dan material-nya berhenti terbaca "tersedia" kalau itu sample
    terakhirnya

**Harga kerja**

18. Form harga kerja → kosongkan Harga → **ditolak** dengan pesan bahwa tarif
    wajib diisi
19. Isi Harga = `0` → **diterima** (gratis / sudah termasuk adalah pernyataan
    harga yang sah)

Langkah 3, 10, 14, dan 16 yang paling mudah dilewati, dan keempatnya persis
cacat yang baru diperbaiki. Menjalankan sisanya tanpa keempatnya tidak
membuktikan apa-apa.

---

# ═══ BQ (Fixture Breakdown) ═══

**Dibangun 2026-08-19 (#64).** Permintaan owner langsung ke Claude:
*"implementasikan BQ (`D:\Misc\ProjectsHUB\BQ`) sebagai part dari studioflow di
`/bq` — master data yang dibutuhkan L2 dan L3 ambil dari master data. ini
kerjaan kamu bukan codex."*

Spesifikasinya `D:\Misc\ProjectsHUB\BQ\PRD_Fixture_Breakdown.md`. Repo itu tidak
pernah berisi kode — hanya PRD, prototype HTML, dan arsip. Kontrak domainnya
sekarang ada di `AGENTS.md` §🧾 BQ Contract; **baca itu sebelum menyentuh apa pun
di `src/subapps/bq/`**.

> **`UPSTREAM-BQ-MATERIAL-SOURCE.md` sekarang USANG di bagian modelnya.** Dokumen
> itu menggambarkan BQ sebagai aplikasi terpisah dengan bloker "di mana database
> material bertempat" (§0.3). Owner membalikkannya 2026-08-19: BQ di dalam
> StudioFlow, material tetap di `master_data`, bloker itu gugur. Bagian §2
> ("yang TETAP di StudioFlow") dan §5 masih berlaku.

## Keputusan owner 2026-08-19 — non-reversible tanpa keputusan baru

| # | Keputusan | Konsekuensi yang harus dipatuhi |
|---|---|---|
| BQ-D1 | Konversi, default waste, minimum order, rounding **tinggal di schema `bq`**, bukan di `master_data.Sku` | SKU baru TIDAK otomatis siap dipakai BQ. Layar `/bq/settings` yang menampilkan SKU tanpa profil adalah fitur. **Jangan** memindahkan keempat kolom itu ke `master_data` "supaya praktis". |
| BQ-D2 | Project BQ **berdiri sendiri** dari `studioflow.Project` | `BqProject.studioflow_project_id` kolom biasa berisi snapshot id+nama. **Jangan** menjadikannya FK. |
| BQ-D3 | **Master data = SSOT.** Tidak ada baris L3 karangan | Bahan/jasa yang belum ada diminta ke staff lewat Master Data. Tidak boleh ada aksi yang membuat `Sku`/`WorkPrice` dari dalam `src/subapps/bq/`. |
| BQ-D4 | Estimator boleh menyunting **snapshot** di dalam BQ | Suntingan ditandai `is_manual_override`, hidup di project BQ itu saja, **tidak pernah** merambat balik ke Master Data. Baris ber-override berhenti ikut deteksi drift. |
| BQ-D5 | Permission `BQ_*` granular **milik StudioFlow** | Membalik catatan lama di `constants.ts` (*"do not add granular BQ permissions here"*), yang benar hanya selama BQ aplikasi terpisah. |

## Status build order PRD §9

| Tahap | Isi | Status |
|---|---|---|
| F1 | Master bahan + jasa, tiga peran dengan penolakan di level API | ✅ Master data StudioFlow yang dipakai; profil BQ + RBAC selesai |
| F2 | Struktur L1/L2/L3 + mesin hitung Bab 3 + collapse/expand Bab 6 | ✅ Rp5.653.559 tereproduksi persis, dikunci `calc.test.ts` |
| F3 | ~~Mode detail/ringkas~~, presedensi waste berlapis, snapshot + banner | ⚠️ Waste + snapshot ✅ (AT-03/04). **Mode detail/ringkas dibuang** atas keputusan owner O3 — PRD §4 gugur, AT-05/05b/05c dihapus di BQ-8. |
| F4 | Purchase Summary + packaging variance + export Internal Cost Detail | ⚠️ Sebagian — lihat BQ-1 |

## Terbuka

> **Siklus R2 (2026-08-19, #66→#67).** Editor BQ dibandingkan terhadap
> `D:\Misc\ProjectsHUB\BQ\prototype_fixture_breakdown.html` — prototype yang
> sudah di-QC estimator kantor. Enam penyimpangan ditemukan; rinciannya beserta
> urutan kerja ada di `HANDOFF-OPENCODE-R2.md`. Dikerjakan Claude langsung (#67).
> R7 (tombol "Simpan ke library" L1) sengaja ditangguhkan.

### Menunggu owner

- [ ] **BQ-1 — Export Internal Cost Detail.** ⏳ owner
      Satu-satunya bagian F4 yang belum ada. Seluruh angkanya sudah dihitung dan
      tampil di layar (`BqPurchaseSummary` + `computed` tiap object); yang belum
      ada adalah berkasnya. **Diblokir keputusan format**, bukan teknis: PDF atau
      xlsx? Kolom apa saja? Packaging variance ikut tercetak (PRD §11 open
      decision 6)? Menebaknya menghasilkan berkas yang harus dibongkar.
      *Catatan: pertanyaan "apakah mode detail/ringkas ikut tercetak" gugur
      bersama BQ-8.*

- [ ] **BQ-2 — Terapkan migrasi R1 + R2 ke database.** ⏳ owner · 🔒 migrasi
      Tiga migrasi pertama sudah diterapkan (#65). Enam migrasi belum — empat dari
      R1 (`20260819170000_bq_costing_to_sku` s.d. `20260819200000_bq_library_tables`)
      dan dua dari R2 (#67: `20260819205000_drop_bq_detail_mode` +
      `20260819210000_bq_subobject_template_link`). Nyalakan database lalu
      `npx prisma migrate dev`; tanpa itu tidak ada perubahan R2 yang bisa diuji di
      browser.

- [ ] **BQ-12 — Bahasa UI editor BQ.** ⏳ owner
      Dokumen yang di-QC estimator berbahasa Indonesia (`URAIAN PEKERJAAN`,
      `HARGA SATUAN`, `Tambah Pos Pekerjaan`); editor StudioFlow berbahasa
      Inggris (`Add object`, `Rate / unit`, `Materials`). Estimator kantor
      bekerja dengan istilah Indonesia, dan menyamakan istilah editor dengan
      dokumen keluarannya mengurangi salah baca. Kalau diputuskan ya: pekerjaan
      terpisah, sentuh label saja, jangan dicampur R2.

- [ ] **BQ-13 — Cabut `BQ_ACCESS` dari STAFF?** ⏳ owner
      Setelah costing pindah ke `master_data.Sku` (#66 R1), tidak ada lagi
      pekerjaan STAFF di dalam BQ — profil bahan dikelola di `/masterdata` dengan
      `MASTERDATA_SKU_MANAGE` yang sudah ia punya. Mencabutnya mengembalikan PRD
      §5.1 (*Admin Bahan "tidak bisa mengubah isi project"*). `constants.ts`
      sengaja belum disentuh sampai ada keputusan.

- [ ] **BQ-6 — Object `sort_order` belum bisa diubah dari UI.**
      Kolomnya ada dan dipakai untuk mengurutkan; yang belum ada drag-handle-nya.
      Pola drag sudah ada di repo (`@dnd-kit` dipakai checklist task, #55) jadi
      ini murni pekerjaan UI, bukan skema. Kecil, tidak memblokir apa pun.

### Ditutup pada #67

- [x] **BQ-7 — Hierarki visual tombol tambah + header kolom koefisien. SELESAI #67.**
      Library button dipindah dari `BqLinePicker` (L3) ke `SubObjectRow` (L2) dan
      `LibraryPickerDialog` di-export. `<thead>` dengan kolom *Uraian Pekerjaan /
      Vol · Koef / Susut / Susut line / Harga Satuan / Jumlah* ditambahkan ke tabel
      bahan dan jasa.

- [x] **BQ-8 — Buang `BqDetailMode` sepenuhnya. SELESAI #67.**
      Enum dihapus dari schema; kolom `detail_mode` hilang dari `BqObject`,
      `BqSettings`, `BqLibraryObject`; `resolveWaste()` dikurangi satu parameter;
      `buildPurchaseSummary()` tidak melewati object lagi; tombol "Use summary mode"
      dan badge "Summary" dihapus dari UI; AT-05/AT-05b/AT-05c dihapus dari test
      suite; test baru CoW-01..06 + OVR-01..02 ditambahkan; AT-01 Rp5.653.559 tidak
      bergeser.

- [x] **BQ-9 — Template L2 tertaut + copy-on-write. SELESAI #67.**
      Kolom `library_sub_object_id` + FK + index di `BqSubObject`; helper
      `detachFromTemplate()` dipanggil dari 9 action L3; `loadFromLibrarySubObjectAction`
      menulis `library_sub_object_id` setelah menyalin baris; `SubObjectRow` menampilkan
      `⧉`/`◇`; migrasi `20260819210000_bq_subobject_template_link`.

- [x] **BQ-10 — Tombol "Save to library" di editor — L2 selesai #67; L1 ditangguhkan.**
      `saveSubObjectToLibraryAndLinkAction` baru; `SubObjectRow` mendapat tombol
      `+⧉` dengan form inline nama + "Save ⧉". Sub-object langsung jadi instance
      pertama `⧉`. *L1 (pour-and-forget, tanpa tautan) masih menunggu (R7 deferred).*

- [x] **BQ-11 — Override harga per baris (†). SELESAI #67.**
      Kolom "Harga Satuan" material sekarang `NumberCell` yang memanggil
      `overrideBqMaterialLineSnapshotAction({ id, price })`; badge `"edited"` diganti
      simbol `†` dengan tooltip catatan override; auto-detach melalui helper BQ-9.

### Ditutup pada #66

- [x] **BQ-3 — Isi profil bahan awal.** ~~⏳ owner~~ **Gugur.** `BqMaterialProfile`
      dihapus di R1; konversi, waste default, minimum order, dan rounding
      sekarang kolom di `master_data.Sku`. SKU yang diisi staff di `/masterdata`
      langsung siap dipakai estimator tanpa langkah kedua. Yang tersisa bukan
      pekerjaan roadmap melainkan operasional: mengisi `conversion` tiap SKU —
      dan itu tetap yang paling menentukan, karena salah di situ menggandakan
      rate berkali lipat (PRD §4: Rp5,65jt → Rp12,41jt).

- [x] **BQ-4 — Waste default per kategori.** ~~⏳ owner~~ **Dibuang** (R1 D2).
      Tabel `BqCategoryWaste` nol baris dan PRD §11 no. 5 tak kunjung dijawab
      kantor. Level 4 `resolveWaste()` dan kolom
      `snapshot_category_default_waste_pct` **sengaja dipertahankan** —
      `categoryDefaultWastePct` cukup selalu `null`, sehingga kalau kantor suatu
      hari memutuskan angkanya, sumbernya tinggal disambung tanpa menyentuh mesin
      hitung.

- [x] **BQ-5 — Sub-object sebagai template?** ~~⏳ owner~~ **Dijawab: ya, tertaut.**
      Keputusan owner O1 memilih model prototype (copy-on-write, seperti block
      SketchUp) alih-alih pour-and-forget. Eksekusinya jadi BQ-9.

## Yang sengaja TIDAK dibangun

PRD §8 sudah menundanya dan penundaannya masih berlaku: dokumen BQ (section,
WBS, penomoran), quotation PDF, price mode, komersial (diskon/pembulatan/PPN),
assembly template + formula engine, Rate Library, gambar per item.

Satu yang perlu ditegaskan karena mudah "diperbaiki" oleh agent berikutnya:
**tombol "refresh semua harga" tidak boleh dibuat.** Refresh snapshot sengaja
satu baris per panggilan — PRD §5.4 meminta perubahan boleh diterapkan
sebagian, dan tombol massal adalah tombol yang ditekan orang tanpa membaca.
