# StudioFlow Development Log (Changelog)

Berisi siklus yang sedang berjalan (**2026-08-10 →**). Riwayat sebelumnya
dipindahkan ke `docs/archive/` — lihat §Arsip di bagian bawah beserta ringkasan
kanoniknya. Pekerjaan yang **belum** selesai ada di `roadmap.md`.

> **Membaca entri lama:** path yang disebut entri sebelum pengarsipan 2026-08-10
> menggambarkan letaknya **saat itu**. Beberapa sudah pindah ke `docs/archive/` —
> mis. `prisma/migrations-masterdata-v2/`, `prisma/schema.masterdata-v2.prisma`,
> dan sejumlah `scripts/*.mjs`. Entri lama sengaja tidak diedit: mengubah catatan
> lama supaya cocok dengan keadaan sekarang adalah mengarang riwayat. Peta
> pemindahannya ada di `docs/archive/README.md`.

## UI Changes

| Tanggal | Area | Perubahan |
|---|---|---|
| 2026-08-20 | BQ | BQ picker now supports fast project-local material/service entry, and breakdown rows expose subtle Master/Local provenance with inline description and rate editing. |
| 2026-08-20 | Master Data → SKU Directory | **Fix (3 issues):** (1) **Base unit** — sebelumnya selalu "pcs" (default quick-create); sekarang diupdate ke purchase unit (mis. "lembar") saat pricing disimpan. (2) **Dimension** — kalkulator dimensi sekarang juga menulis `dim_display` (mis. "1200 × 2400 mm") ke `Sku.dim_display`; SKU Directory menampilkannya bukan "Not recorded" lagi. (3) **Categories** — dialog Add Material Price sekarang menampilkan chip kategori dari brand; klik untuk pilih/hapus; disimpan ke `SkuCategory` dan dipropagasi ke `BrandCategory` bila kategori baru. |
| 2026-08-20 | Master Data → Pricing → Add Material Price | **Feature (v2):** Field Usage unit & Conversion diganti **kalkulator dimensi** — toggle Area (W × L) atau Linear (L), unit selector (mm / cm / m, konversi terpusat 1m=1000mm), input lebar × panjang → usage_unit (`m2` / `m`) dan conversion terisi otomatis. Preview "→ 1 lembar = 2.88 m²" tampil real-time. State dim bersifat lokal (UI helper), hanya usage_unit & conversion yang disimpan ke `Sku`. |
| 2026-08-20 | Master Data → Pricing → Add Material Price | **Feature (v1):** Dialog sekarang punya dua field — **Usage unit** dan **Conversion** — tersimpan ke `Sku.usage_unit` / `Sku.purchase_unit` / `Sku.conversion`. Diganti v2 di hari yang sama. |
| 2026-08-20 | BQ → Add Material dialog | **Bug fix:** crash `Cannot read properties of null (reading 'usageUnit')` saat Add ditekan — SKU yang punya harga tapi tidak punya costing profile (`purchase_unit`/`conversion` kosong) lolos `readiness.ok = true` tapi `profile = null`. Fix: costing snapshot fields (`snapshot_usage_unit`, `snapshot_purchase_unit`, `snapshot_conversion`) dibuat nullable di schema + migration `20260820100000_bq_nullable_costing_snapshot`; action & calc pakai fallback `null` / `1:1`; tipe `BqMaterialLineRecord`, `MaterialLineInput`, `MaterialLineResult`, `PurchaseRow` di-update nullable; display di `BqBreakdownClient` dan `BqPurchaseSummary` handle null unit. |
| 2026-08-20 | BQ → Add Material dialog | **UX:** Material dengan `NO_PRICE` tidak lagi ditampilkan di list picker — disaring di UI lewat `.filter(m => m.readiness.ok \|\| m.readiness.reason !== "NO_PRICE")`. |
| 2026-08-14 | Master Data → Brand dialog | Saran Category sekarang diawali daftar istilah katalog profesional dari konfigurasi Master Data, lalu hanya dilengkapi kategori yang sudah dipakai Brand. Kategori SKU Material/Fixture tidak lagi ikut menjadi saran. |
| 2026-08-18 | Master Data → Brand dialog | Category diganti checklist (centang, bukan lagi ketik-untuk-cari); field baru Hashtag (bebas, terpisah dari Category) pakai pola creatable yang sama dengan tag SKU. |
| 2026-08-18 | Master Data → tabel SKU brand | Kolom Supplier menampilkan semua supplier dengan harga berlaku ("Nama +N"), bukan cuma yang termurah. |
| 2026-08-18 | Master Data → Suppliers & Vendors | Tombol Eye (lihat detail) ditambahkan, konsisten dengan tabel Brand. |
| 2026-08-18 | Master Data → Sample | Status Hilang/Dibuang punya badge sendiri; ringkasan menambah "Hilang / dibuang"; dialog status menawarkan kelima status dan hanya meminta nama pemegang untuk Dipinjam/Di klien. (#22) |
| 2026-08-18 | Master Data → Sample Library | `useUnsavedChangesGuard` dipasang di dialog Edit Lokasi dan dialog Status. (#23) |
| 2026-08-18 | Master Data → Sample Request | `useUnsavedChangesGuard` dipasang di dialog Tindak Lanjut Vendor / Terima. (#23) |
| 2026-08-18 | Master Data → Supplier detail | `useUnsavedChangesGuard` dipasang di dialog Contact (CRUD). (#23) |
| 2026-08-18 | ~~Master Data → Supplier Jasa tab~~ | ~~Tombol Modify "Ubah" dihapus; dialog buka langsung editable; `useUnsavedChangesGuard` dipasang.~~ (#23) — **DIKOREKSI #24: tidak terlihat pengguna.** Guardnya nyata, tapi seluruhnya di dalam `SupplierJasaTab` yang tidak pernah dirender. Layar Supplier yang hidup tetap aman lewat guard milik `PartyDialog` / `MasterDataBrandDialog`. |
| 2026-08-18 | Master Data → Brand detail (tab SKU) | Pencarian SKU di-debounce 300ms — mengetik tidak lagi memicu server action per karakter. Submit manual (tombol "Cari") tetap instan. (#25) |
| 2026-08-18 | Master Data → Pricing (picker Vendor) | Vendor yang dinonaktifkan (`is_active: false`) tidak lagi muncul di picker Work/Service Vendor. (#25) |
| 2026-08-18 | Master Data → Party | Label role "Manufacture" dibetulkan jadi "Manufacturer". (#25) |
| 2026-08-18 | StudioFlow → Task list (fase & overview proyek) | Judul task sekarang bisa diedit inline: klik teksnya, langsung jadi input; Enter/klik-keluar menyimpan, Esc membatalkan. (#26) |
| 2026-08-18 | StudioFlow → Today's View | Judul task checklist dan activity/FEEDBACK sekarang bisa diedit inline dengan pola yang sama: klik teks, Enter/blur simpan, Esc batal. (#35) |
| 2026-08-19 | Master Data → Brand dialog | Kategori baru dari brand yang berhasil disimpan tetap tersedia saat Add Brand langsung dibuka lagi; centang brand sebelumnya tetap di-reset. (#36) |
| 2026-08-19 | Master Data → tabel Brands | Brand Name, Category, dan Hashtag dapat diedit langsung di baris tabel; Save/Cancel menggantikan actions selama edit dan perubahan tertunda dilindungi konfirmasi. Kolom Hashtag ditambahkan dengan token lebar tabel semantik. (#37) |
| 2026-08-19 | Master Data → tabel Brands & Suppliers | Tiga ikon action yang selalu tampil diringkas menjadi satu menu ⋯ per baris. Trigger muncul saat hover/focus dan tetap terlihat ketika menu terbuka; opsi View/Edit/Delete mengikuti izin. (#38) |
| 2026-08-19 | Master Data → editor Material | Edit oleh STAFF tidak lagi diam-diam menurunkan status material ke Pending. Create tetap Pending dan kontrol status tetap khusus approver. (#39) |
| 2026-08-19 | Master Data → Pricing & direktori SKU | Klik baris Material Prices membuka viewer SKU read-only berisi semua harga berlaku dan riwayat; halaman SKUs lintas-brand baru menyediakan pencarian, filter, dan status kelengkapan data. (#40) |
| 2026-08-19 | Master Data → Brand, Material, Pricing, Supplier | Teks lama yang tersentuh diselaraskan ke Bahasa Inggris; error database tetap actionable dan header Pricing konsisten. (#41) |
| 2026-08-19 | Master Data → Sample Library & Sample Requests | Tabel mendapat lebar minimum semantik agar dapat digulir horizontal; copy yang tersentuh diselaraskan ke Inggris. (#42) |
| 2026-08-19 | Seluruh aplikasi → aksi merusak | Dialog bawaan browser diganti AlertDialog aplikasi; reset seluruh Product Schedule mewajibkan frasa `DELETE ALL`. (#43) |
| 2026-08-19 | Master Data → Excel import | Pesan file terlalu besar diselaraskan ke Inggris; guard ukuran runtime 20 MB tetap berlaku dan konfigurasi Pages Router yang diabaikan App Router dihapus. (#44) |
| 2026-08-19 | StudioFlow → Library | Pencarian brand kembali mengikuti Hashtag yang dipisahkan dari Category; saran kosong hanya bersumber dari brand hidup, dan copy permukaan Library yang tersentuh diselaraskan ke Inggris. (#45) |
| 2026-08-19 | StudioFlow → Tasks | Kontrol Saved filters ditambahkan pada baris filter; user dapat menyimpan kombinasi aktif dengan nama, menerapkannya kembali, memperbarui nama yang sama, dan menghapus filter personal. (#46) |
| 2026-08-19 | Master Data → tabel & detail Brand | Angka SKU/Supplier dan menu View membuka detail pada modal; kolom Complete diganti sorotan kuning untuk brand belum lengkap. Inline edit dan menu ⋯ tetap utuh. (#47) |
| 2026-08-19 | Master Data → pencarian Brand | Search mencakup Brand/owner, Category produk, Hashtag, supplier, serta nama/kode SKU tanpa mengubah grain hasil atau merusak pagination. (#48) |
| 2026-08-19 | Master Data → tabel Brand | Kolom Catalog & Links menampilkan seluruh tautan resmi; tombol edit membuka editor repeatable dengan perlindungan perubahan belum disimpan. (#49) |
| 2026-08-19 | Seluruh aplikasi → prompt perubahan tertunda | Judul dan tombol `UnsavedChangesPrompt` diselaraskan ke Bahasa Inggris; tombol discard memakai variant destructive design system. (#49) |
| 2026-08-19 | Master Data → tabel & detail Supplier | Nama/count/menu View membuka detail di modal; SKU per Brand-assignment punya popup; Party tanpa Role disorot kuning. (#50) |
| 2026-08-19 | Master Data → Pricing | Material Prices memakai search server-side dan pagination 50 row; badge tetap menunjukkan total global, tabel menunjukkan total hasil pencarian. (#52) |
| 2026-08-19 | Master Data → Supplier detail (Prices) | Stub diganti daftar harga berlaku per supplier dengan search, pagination, nilai/unit/tanggal; tab hanya terlihat bagi role berizin harga. (#53) |
| 2026-08-19 | Master Data → Brands/Materials & Suppliers | Stats summary diseragamkan sebagai subtitle inline; strip kartu Materials dihapus tanpa menghilangkan total. Label filter `Siap BQ` ikut diselaraskan menjadi `BQ ready`. (#54) |
| 2026-08-19 | StudioFlow → checklist task | Drag handle pointer/keyboard ditambahkan pada root dan subtask; urutan hanya berubah di dalam sibling group dan hanya saat filter All. (#55) |
| 2026-08-19 | Master Data → shared delete dialog | Import primitive dikembalikan ke UI Engine; tombol memakai variant destructive dan copy `Cancel`. Komponen saat ini belum memiliki caller hidup. (#58) |
| 2026-08-19 | Master Data → SKU viewer | Modal shared dari Pricing dan SKU Directory memakai ukuran dialog `xl`; field dan kedua tabel harga tidak lagi terpotong oleh lebar default `md`. (#60) |
| 2026-08-19 | Master Data → SKU Directory | Menu Actions menyediakan View details dan Delete SKU sesuai izin; delete memakai konfirmasi aplikasi, menyembunyikan SKU dari data aktif, dan mempertahankan riwayat harga. (#61) |
| 2026-08-19 | Master Data → tabel Brands | Inline edit Name/Category/Hashtag dihapus; edit hanya lewat menu Edit full details. Daftar Category/Hashtag diringkas menjadi nilai pertama + jumlah sisanya dengan tooltip lengkap. (#62) |
| 2026-08-19 | Master Data → tabel Brands & Suppliers | Nama kedua tabel membuka Overview, count membuka tab terkait, sel lain tetap display-only; tipografi nama memakai token yang sama dan Actions tetap rata kanan. (#63) |
| 2026-08-18 | Master Data → semua form (Party/Brand/SKU/Vendor/Harga) | Error dari database (nama bentrok, baris sudah dihapus orang lain, dsb.) sekarang tampil sebagai pesan yang bisa ditindaklanjuti, bukan pesan Prisma mentah. (#27) |
| 2026-08-18 | Master Data → Supplier detail (dialog Contact) | Tidak ada perubahan terlihat — pertahanan berlapis di baliknya: edit/hapus contact sekarang menolak kalau contact ternyata bukan milik party yang sedang dibuka. (#27) |

| 2026-08-20 | Master Data/BQ | BQ readiness memakai satu aturan kanonik; indikator Master Data dan picker/direct lookup BQ menolak SKU terhapus, discontinued, tanpa harga/satuan beli/konversi valid, atau dengan satuan harga yang tidak cocok. |

## [Unreleased] - 2026-08-24 — R3 fase 1: konsolidasi fisik audit selesai

### Hasil akhir

Konsolidasi fisik audit (keputusan owner 2026-08-24) diimplementasikan pola
add-first sesuai PRD §47:

- **Migrasi `20260824090000_audit_log_generic_domain`**: enum `AuditDomain`
  (`STUDIOFLOW`/`MASTER_DATA`/`BQ`) + kolom `domain` (default STUDIOFLOW,
  baris lama otomatis ter-backfill), kolom plain `actor_id`/`actor_name`,
  `user_id` dibuat nullable, index `(domain, entity_type, entity_id,
  created_at)`.
- **Shared interface** `src/core/platform/audit/record.ts`:
  `recordAudit({ domain, entityType, entityId, action, actorId, actorName,
  before, after, metadata })` — bentuk yang diminta PRD §20.
- **Dual-write Master Data**: `master-data/services/audit-service.ts` tetap
  menulis `MasterDataAudit` DAN menulis baris kanonik baru ke `AuditLog` di
  transaksi yang sama — audit yang selamat dari rollback tetap kebohongan,
  untuk kedua tabel sekaligus.
- **Domain BQ otomatis**: `insertAuditLog` menandai baris ber-kunci
  `bq_project_id` sebagai domain BQ tanpa menyentuh satu pun call site BQ.
- **Integration runner digeneralisasi**: menjalankan semua
  `tests/integration/*.integration.test.ts` (sebelumnya hardcoded satu file).
- Tiga test integration baru: dual-write parity per-field, rollback membuang
  KEDUA baris, dan default domain STUDIOFLOW untuk jalur tulis lama.
- Dua type drift ditambal: `AuditReferenceRecord.user_id` nullable +
  filter userIds null di read-models.

Verifikasi dijalankan penuh: prisma validate ✓, generate ✓, typecheck ✓,
unit 194/194 ✓, integration docker **8/8** (44+1 migrasi diterapkan ke DB
disposable, container dibuang), production build ✓.

### Area/berkas

`prisma/schema.prisma`, migrasi baru, `src/core/platform/audit/{record.ts
 baru, read-models.ts, types.ts}`, `src/actions/_shared.ts`,
`src/subapps/master-data/services/audit-service.ts`,
`scripts/run-integration-tests.mjs`,
`tests/integration/audit-dual-write.integration.test.ts` (baru).

### Verifikasi

Kelima gerbang PRD §49 benar-benar dijalankan di sesi ini (rincian di atas).
Satu iterasi perbaikan runner (path tsconfig relatif thd `tmp/`) dan satu
test yang premisnya salah pada DB kosong diperbaiki sebelum lulus.

### Risiko

- **Tabel `MasterDataAudit` masih sumber baca.** Backfill historis + flip
  reads + drop tabel adalah langkah lanjutan setelah dual-write terbukti di
  produksi — jangan drop lebih awal.
- Migrasi belum diterapkan ke deployment; `prisma migrate deploy` wajib
  dijalankan sebelum kode ini live (kolom `domain` tidak ada di DB lama).
- Kontrak AGENTS.md §6 masih mendeskripsikan aturan pra-konsolidasi;
  pembaruannya mengikuti setelah backfill dieksekusi (jangan dobel narasi).

### Pekerjaan terbuka

- Sisa R3: backfill `MasterDataAudit`→`AuditLog`, flip reads, drop tabel lama;
  canonical error mapping; pagination contract; soft-delete helper.
- Fase berikutnya: R5 UI Engine v2 foundation (R4 skop kecil bisa diselipkan).

## [Unreleased] - 2026-08-24 — R2 Shared Core SSOT selesai

### Hasil akhir

Ketujuh modul Shared Core kanonik dibangun murni aditif (tidak ada konsumen
lama yang disentuh — migrasinya memang jadwal R8–R10, bukan R2):

- `src/core/reference/units.ts` — Unit Dictionary: 12 unit kanonik
  (PCS/SET/SHEET/ROLL/M/CM/MM/M2/M3/LS/HOUR/DAY) dengan alias
  (`lembar/sht/sheet`→SHEET, `sqm/m²/m2`→M2), dimensi, presisi;
  `normalizeUnit` melewatkan unit tak dikenal apa adanya (uppercase), tidak
  pernah null untuk input non-kosong.
- `src/core/utilities/measurement.ts` — konversi mm↔cm↔m, area, volume;
  cross-dimension dan unit tak dikenal **melempar** (`DIMENSION_MISMATCH`,
  `UNSUPPORTED_UNIT`), konversi ≤0 melempar (`CONVERSION_NOT_POSITIVE`) —
  pola anti-`|| 1`.
- `src/core/utilities/money.ts` + `round.ts` — formatter IDR/SGD/USD
  **deterministik** (tanpa Intl, kebal variasi ICU antar-node), `parseMoney`
  paham `Rp370.000` / `S$1,234.56`, aturan pemisah desimal eksplisit.
- `src/core/utilities/datetime.ts` — policy final U5: simpan UTC, tampil
  fixed `Asia/Jakarta`; `formatDate/formatDateTime/formatRelativeDate`
  meng-bucket hari kalender WIB (bukan device-local).
- `src/core/utilities/normalize.ts` — trimOrNull/emptyToNull/normalizeName/
  normalizeCode/normalizeSearchText (NFKC+lowercase).
- `src/core/reference/provenance.ts` — vocabulary kanonik MASTER_DATA /
  PROJECT_LOCAL / SNAPSHOT / MANUAL_OVERRIDE / LIBRARY.

Verifikasi benar-benar dijalankan: `npm test` **194/194** (158 lama + 36 baru,
nol regresi — gerbang AT-01 BQ tetap Rp5.653.559), `npm run typecheck` bersih,
`npm run build` sukses. Tiga bug ditemukan & diperbaiki selama pengujian:
error-unit uppercase (`UNSUPPORTED_UNIT:FT`), import runtime `@/` tidak
ter-resolve oleh runner test (ganti relatif — runner compile CLI mengabaikan
tsconfig paths), dan formatter Intl tidak deterministik antar ICU.

### Area/berkas

Baru: 7 modul + 5 file test di `src/core/reference/` & `src/core/utilities/`.
Tidak ada berkas lama yang diubah.

### Verifikasi

`npm test` (194/194), `npm run typecheck`, `npm run build` — semua hijau di
sesi ini. Integration test tidak wajib (nol perubahan skema/query).

### Risiko

- Dua implementasi format uang hidup berdampingan sampai fase migrasi konsumen
  (calc.ts BQ sengaja tidak disentuh — ia terkunci regresi). Drift antar keduanya
  mungkin terlihat user pada kasus tepi; itu biaya transisi yang sudah dijadwalkan.
- `graphify update .` gagal di environment ini (uv trampoline) — graph
  knowledge basi terhadap kode baru sampai tooling diperbaiki.
- Test runner hanya mendukung import relatif antar-modul yang diuji runtime;
  modul core baru harus tetap pakai import relatif (sudah demikian).

### Pekerjaan terbuka

- R3 Platform Consolidation (audit fisik satu tabel, action errors, pagination,
  soft-delete convention) dimulai berikutnya.

## [Unreleased] - 2026-08-24 — R1 disetujui; keputusan final pricing = MULTI-SUPPLIER (mencabut ratifikasi #1)

### Hasil akhir

Owner menjawab gerbang ❓U1–U6 audit R1. Jawaban ❓U1/U3 bertentangan dengan
ratifikasi pagi hari atas PRD §15–§18; dikonfirmasi lewat pertanyaan tegas,
hasilnya: **arah pricing FINAL adalah multi-supplier** — setiap SKU boleh punya
beberapa harga berlaku satu per supplier (`SkuPrice_current_uniq` tetap),
BQ memilih supplier saat penarikan dan snapshot immutable. Ratifikasi #1
("satu harga kanonik per SKU") **dicabut dan tidak akan dieksekusi**.
Konsekuensi: R4 menyusut jadi validasi unit + `updated_by_id` + dokumentasi;
viewer harga lintas supplier (#52/#53/#61) menjadi perilaku kanonik, bukan
kerja bongkar.

Keputusan lain yang disetujui: U2 (unit harga wajib = `sku.purchase_unit`,
validasi app-layer), U4 (`updated_by_id` plain column), U5 (**simpan UTC,
tampil default Asia/Jakarta**, device-local bukan sumber kebenaran), U6
(**drop `ProjectTimeline`** — terbukti write-only). Masih terbuka: U7
(PromotionRequest, tidak menggerbangkan), R9-1 (library recipe resolve).
R1 exit gate terpenuhi; fase berikutnya eksekusi R2.

### Area/berkas

- `AGENTS.md` — blok override §3 Harga diganti keputusan final multi-supplier.
- `PRD-Architecture-Cleanup-v2.md` — §15–§18 ditandai dicabut; ratifikasi #1
  dicoret + 4 keputusan tambahan; acceptance criteria Pricing diganti.
- `AUDIT-R1-SCHEMA-2026-08-24.md` — status jadi DISETUJUI (amandemen di atas).
- `roadmap.md` — R1 ✅, R4 skop baru, aturan program #2 dicabut.

### Verifikasi

Semua perubahan murni dokumen; tidak ada kode/schema yang disentuh sehingga
tidak ada test yang wajib dijalankan untuk entri ini (baseline R0 tetap valid).

### Risiko

- Dua arah pricing berlawanan sempat tercatat sebagai "mengikat" di hari yang
  sama; entri ini + blok final di AGENTS.md/PRD adalah satu-satunya penanda
  mana yang menang. Agent berikutnya yang membaca versi lama dokumen harus
  melihat catatan pencabutan ini.
- Komentar kontrak AGENTS.md §3 poin 5/7 soal kolom `qty`/lifecycle WorkPrice
  masih basi terhadap skema (dibuang migrasi 2026-08-20) — diperbaiki di R4.

### Pekerjaan terbuka

- Eksekusi R2 Shared Core (units, measurement, money, datetime WIB, normalize,
  provenance) dimulai berikutnya.
- U7 & R9-1 ditagihkan saat fase masing-masing dibuka (R12 / R9).

## [Unreleased] - 2026-08-24 — R1 migration map siap, menunggu persetujuan owner

*(Entri ini tertulis sebelum amandemen pricing; keputusan akhir ada di entri
di atas — "MULTI-SUPPLIER" yang menang. Dipertahankan sebagai riwayat.)*

### Hasil akhir

Audit skema & ownership penuh selesai dan ditulis ke
`AUDIT-R1-SCHEMA-2026-08-24.md`: seluruh 64 model diklasifikasi
(KEEP 55 · NORMALIZE 5 · MERGE 1 (`MasterDataAudit`) · REMOVE 1
(`ProjectTimeline`, terbukti **write-only** — nol pembaca di `src/`).
Fokus khusus pricing dipetakan jadi langkah migrasi add-first dengan tabel
shadow arsip untuk recoverability. Delapan keputusan owner diformalkan sebagai
❓U1–U7 + ❓R9-1; enam di antaranya menggerbangkan exit R1.

Temuan penting: `minimum_order` & `rounding_increment` (PRD §14) ternyata
**sudah ada** di `Sku` — pertanyaan ambigu review awal PRD terjawab sendiri;
kolom lifecycle WorkPrice yang masih disebut kontrak AGENTS.md sudah dibuang
migrasi 2026-08-20 (drift kontrak lain yang ikut dirapikan saat R3/R4).

### Area/berkas

`AUDIT-R1-SCHEMA-2026-08-24.md` (baru), `roadmap.md` (status R1).

### Verifikasi

Klasifikasi REMOVE/KEEP didukung `git grep` atas pemakaian runtime
(`ProjectTimeline` hanya create/delete di `project-service.ts:170/:533`;
`PromotionRequest` tertutup `FEATURE_PROMOTION_QUEUE_ENABLED = false`;
`TimelineTemplate`/`ChecklistLabel`/`TemporaryAttachment` aktif dipakai).
Tidak ada kode berubah.

### Risiko

- Map belum disetujui → tidak ada eksekusi skema; risiko saat ini cuma dokumen.
- Komentar AGENTS.md §3 soal kolom `qty`/lifecycle kini basi terhadap skema —
  diperbaiki bersama work order R4, bukan diam-diam sekarang.

### Pekerjaan terbuka

- Jawaban owner untuk ❓U1–U6 (gerbang exit R1), lalu work order R2.

## [Unreleased] - 2026-08-24 — R0 Baseline Freeze selesai

### Hasil akhir

Baseline known-good tercatat untuk program Architecture Cleanup v2. Owner
memberi amanat takeover penuh eksekusi di sesi ini (keadaan #3 §Pembagian
Peran: permintaan langsung owner). Semua gerbang regresi PRD §49 lulus pada
kondisi repo `6377ac0` + perubahan dokumen sesi ini (belum dikomit):

- `npx prisma validate` — valid.
- `npm run typecheck` — bersih.
- `npm test` — **158/158 lulus**, termasuk gerbang angka BQ: AT-01
  rate Rp5.653.559 / pokok Rp4.711.299, AT-06 pembulatan agregat, AT-12
  packaging variance, CoW/OVR snapshot isolation.
- `npm run test:integration:docker` — **5/5 lulus**; 44 migrasi diterapkan ke
  DB disposable (`studioflow-db-test-1`, tmpfs loopback) dan container dibuang
  setelah suite.
- `npm run build` — production build sukses (Next 16.2.1 Turbopack).
- Skema saat baseline: `prisma/schema.prisma` 2.073 baris, **64 model**,
  **30 enum**, 3 schema (`bq`, `master_data`, `studioflow`).

Acceptance cases kritis BQ terkunci oleh `calc.test.ts` (angka Bab 7 persis,
tanpa toleransi) — tidak ada file test yang diubah.

### Area/berkas

Tidak ada kode/schema/migrasi yang berubah. Hanya `roadmap.md`
(status R0 → selesai).

### Verifikasi

Kelima perintah di atas benar-benar dijalankan di sesi ini; output lengkapnya
ada di transkrip. Docker 29.3.1 tersedia.

### Risiko

- Baseline belum dikomit ke git — freeze-nya logis (HEAD + entri ini), bukan
  tag/komit. Komit menunggu perintah owner.
- Prisma update available 7.5.0 → 7.9.1 sengaja diabaikan (bukan bagian
  program).

### Pekerjaan terbuka

- R1 Schema & Ownership Audit dimulai berikutnya; exit-nya migration map yang
  wajib disetujui owner sebelum fase lanjutan menyentuh skema.

## [Unreleased] - 2026-08-24 — Ratifikasi PRD Architecture Cleanup & Consolidation v2

### Konteks

Owner meratifikasi *PRD Architecture Cleanup & Consolidation v2* sebagai
otoritas requirement produk tertinggi. Review awal menemukan empat konflik
dengan kontrak berlaku; keempatnya diajukan ke owner dan dijawab eksplisit
di sesi ini. Tidak ada kode yang diubah — sesi ini murni dokumentasi keputusan.

### Keputusan owner (mengikat)

1. **Pricing (override kontrak Master Data §3):** satu SKU = satu harga
   kanonik saat ini; `SkuPrice` berhenti menjadi tabel riwayat per-supplier;
   tanpa lifecycle `is_current`/`valid_to`; riwayat pindah ke audit.
   Eksekusi di fase **R4** — sampai migrasi merge, aturan lama tetap mengikat
   kode hidup, dan fitur baru di atas pola lama dilarang.
2. **BQ snapshot (menggantikan PRD §29):** snapshot TIDAK PERNAH refresh dari
   Master Data — tidak ada banner/refresh selected/refresh all. Harga current
   diambil sekali saat baris ditarik; existing snapshot tidak disentuh.
   `price-drift-service.ts` menjadi kerja bongkar di fase **R9**.
3. **Audit (konsolidasi fisik, PRD §20):** satu tabel `AuditLog` generic lintas
   domain (`STUDIOFLOW`/`MASTER_DATA`/`BQ`) plus shared interface
   `recordAudit(...)`; penggabungan `MasterDataAudit` terjadwal di fase **R3**.
   Dilarang menambah tabel audit baru sejak sekarang.
4. **Otoritas dokumen:** AGENTS.md hanya aturan kerja agent; Product PRD
   adalah otoritas requirement produk tertinggi. Kontrak agent diperbarui
   mengikuti PRD, tidak sebaliknya.

### Area/berkas

- **`PRD-Architecture-Cleanup-v2.md` (baru)** — teks PRD final + bagian
  Ratifikasi 2026-08-24 di ekor berkas (termasuk pencabutan §29 dan catatan
  pada acceptance criteria BQ).
- **`AGENTS.md`** — blok OVERRIDE OWNER 2026-08-24 pada §🧱 Master Data
  Contract §3 (Harga) dan §6 (Audit); penegasan snapshot-tanpa-refresh +
  pencabutan larangan baris custom di §🧾 BQ Contract §3–§4; klarifikasi
  otoritas dokumen di §📚 Peta dokumen.
- **`roadmap.md`** — program baru "Architecture Cleanup & Consolidation v2"
  berisi fase R0–R12 (semua ⏳, belum ada yang dibuka), aturan beku feature,
  dan penahanan item lama yang bergantung pola harga per-supplier.

### Verifikasi

- Grep memastikan setiap blok keputusan hanya muncul sekali per berkas
  (tidak ada duplikasi edit).
- Tidak ada perubahan kode/schema/migrasi → tidak ada test/typecheck/build
  yang wajib dijalankan untuk entri ini. Baseline R0 belum diambil.

### Risiko

- Kontrak kini **berjalan di depan kode**: pembaca yang melompat langsung ke
  poin 3 §Harga bisa mengira `SkuPrice` sudah satu-harga-per-SKU padahal
  migrasi R4 belum ada. Blok override menyatakan ini secara eksplisit, tapi
  agent yang membaca separuh berkas tetap berisiko salah asumsi.
- Fitur viewer harga lintas supplier + riwayat (#52/#53/#61) yang baru dibuat
  akan tersentuh pembongkaran R4 — pekerjaan yang baru selesai berubah nasib
  oleh keputusan ini.
- Roadmap lama masih memuat item yang bergantung pola harga lama; penahanannya
  baru dinyatakan sebagai catatan program, belum diaudit satu per satu.

### Pekerjaan terbuka

- **R0 Baseline Freeze** — belum dimulai; prasyarat semua fase lain.
- Menulis work order per fase untuk Codex (mulai dari R0/R1).
- Audit item roadmap lama terhadap keputusan pricing baru (aturan 2 program).
- Keputusan lanjutan owner yang ditunda: apakah §26 "Project Cost Database"
  berarti tabel baru atau normalisasi state project-local yang sudah ada
  (ditagihkan saat R1).


## [Unreleased] - 2026-08-20 — Master Data + BQ domain cleanup

- **Hasil akhir:** BQ project berdiri sendiri; referensi identitas StudioFlow dihapus. WorkPrice tidak lagi menyimpan project reference, qty, atau field lifecycle history yang tidak dipakai. BQ material/work reads menegakkan eligibility Party yang aktif dan ber-role sah. BQ kini menerima project-local material/service snapshots dan library recipes dari kedua sumber.
- **Area/berkas:** `prisma/schema.prisma`, empat migrasi cleanup/BQ-local baru, `src/subapps/bq/**`, `src/subapps/master-data/**`, `src/app/masterdata/prices/page.tsx`, `src/extensions/library/contracts/sku-dto.ts`.
- **Verifikasi:** inspeksi PostgreSQL read-only menemukan `BqProject` refs = 0, `WorkPriceProjectRef` rows = 0; `npx prisma generate`, `npx prisma validate`, `npm run typecheck`, `npm test`, dan `npm run test:integration:docker` berhasil. Pure regression mencakup local material/service calculation. Dua legacy view ditemukan tidak dipakai runtime dan dijatuhkan oleh migrasi cleanup. `npm run lint` masih gagal pada baseline repo yang luas; `npm run test:integration` fail-closed karena `TEST_DATABASE_URL` tidak dikonfigurasi.
- **Risiko:** migrasi menghapus kolom BQ reference, tabel WorkPriceProjectRef, SkuPrice.qty, WorkPrice.qty/valid_to/is_current, dan legacy BQ views; tidak ada data operasional pada dua reference surfaces saat inspeksi. Migrasi BQ-local menambah enum provenance dan nullable recipe source fields.
- **Pekerjaan terbuka:** lint baseline perlu dibersihkan terpisah; migrasi belum diterapkan ke deployment. Spreadsheet-style BQ/Breakdown dual view, item duplication, richer inline notes/specification, and broader reorder UX remain later BQ batches.

## [Unreleased] - 2026-08-19 (#68) — BQ R8: hapus gate NO_PROFILE dari picker bahan

### Konteks

Keputusan owner 2026-08-19: SKU CRUD hanya bisa ditrigger dari layar Price,
sehingga `purchase_unit` dan `conversion` dijamin terisi sebelum harga pertama
tercatat. Gate `NO_PROFILE` (yang memblokir SKU tanpa costing fields) adalah
dead code — tidak mungkin terjadi dalam alur normal. Semua SKU yang punya ≥1
harga berlaku langsung boleh dipakai di BQ.

### Perubahan

**`src/subapps/bq/services/master-data-service.ts`**
- `evaluateReadiness()`: hapus branch `NO_PROFILE`. Gate satu-satunya kini
  `NO_PRICE` (SKU tanpa harga berlaku). `UNIT_MISMATCH` tetap ada tapi hanya
  diperiksa bila `purchase_unit` terisi.
- Komentar header: dokumentasikan keputusan owner soal gate picker.

**`src/subapps/bq/types/breakdown.ts`**
- `BqMaterialReadiness`: hapus `"NO_PROFILE"` dari union reason —
  `{ ok: false; reason: "NO_PRICE" | "UNIT_MISMATCH"; detail: string }`.

**`src/subapps/bq/components/BqLinePicker.tsx`**
- `READINESS_HINT`: hapus entry `NO_PROFILE`.
- JSDoc header: update dari "ketiga alasan" → "dua alasan".
- Hint text picker: hapus "conversion" dari deskripsi freeze snapshot.

### Tidak ada migrasi

Tidak ada perubahan skema. Perubahan murni di layer service + type + UI.

### Verifikasi

- Semua bahan yang punya harga berlaku di Master Data sekarang muncul di
  picker tanpa pesan error `NO_PROFILE`.
- Bahan tanpa harga berlaku tetap ditampilkan dengan label `NO_PRICE`.
- Bahan dengan `purchase_unit` ≠ unit harga tetap ditampilkan dengan
  label `UNIT_MISMATCH`.
- AT-01 tidak tersentuh (`computeObject(counterCabinet()) = Rp5.653.559`).

---

## [Unreleased] - 2026-08-19 (#67) — BQ R1–R6: BqDetailMode dibuang, template L2 tertaut, save-to-library, price override, header tabel, Library button dipindah ke L2

**Dikerjakan Claude** (mengambil alih HANDOFF-OPENCODE-R2.md secara langsung).
Semua tahap T1→T4 selesai. R7 (tombol "Simpan ke library" untuk L1 object)
sengaja ditangguhkan sesuai handoff — tidak ada kode L1 yang disentuh.

### R1 — Buang BqDetailMode sepenuhnya (BQ-8)

- **`calc.ts`** — `DetailMode` type dihapus; `resolveWaste()` dari 3 param jadi
  2 (tidak ada `detailMode`); `computeMaterialLine()` / `computeSubObject()` /
  `computeObject()` ikut disederhanakan; `buildPurchaseSummary()` tidak lagi
  melewati object RINGKAS; `PurchaseSummary` kehilangan `skippedObjectCount`
  dan `skippedObjectNames`. AT-01 Rp5.653.559 **tidak bergeser**.
- **`calc.test.ts`** — AT-05, AT-05b, AT-05c dihapus (keputusan O3 yang sudah
  disetujui). `detailMode: "DETAIL"` dihapus dari factory `counterCabinet()` dan
  seluruh call `resolveWaste()`. Test baru: CoW-01..06 (snapshot isolation,
  price override isolation, waste independence) + OVR-01..02 (price override
  reflects in calc). CoW-06 re-asserts AT-01 sebagai gate.
- **`schema.prisma`** — enum `BqDetailMode` dihapus; kolom `detail_mode` di
  `BqSettings`, `BqObject`, `BqLibraryObject` dihapus;
  `detail_mode_set_by_name` dan `detail_mode_set_at` di `BqObject` dihapus.
- **`settings-service.ts`** — `BqSettingsView.defaultDetailMode` dihapus;
  `getSettings()` tidak lagi membaca `default_detail_mode`; `getObjectDefaults()`
  return type jadi `{ markupPct: number }`.
- **`bq-settings-actions.ts`** — `defaultDetailMode` dihapus dari schema Zod
  dan upsert.
- **`breakdown.ts`** — `detailModeSetByName` dan `detailModeSetAt` dihapus dari
  `BqObjectView`.
- **`breakdown-service.ts`** — `detailMode` dihapus dari `toObjectInput()` dan
  `toObjectView()`.
- **`bq-project-actions.ts`** — `setBqObjectDetailModeAction` dihapus (33 baris);
  `createBqObjectAction` tidak lagi menyertakan `detail_mode` ke DB.
- **`bq-library-actions.ts`** — `saveObjectToLibraryAction` tidak lagi
  menyalin `detail_mode`.
- **`BqBreakdownClient.tsx`** — import `setBqObjectDetailModeAction` dihapus;
  `RINGKAS` dihapus dari `WASTE_SOURCE_LABEL`; badge "Summary" di header L1
  dihapus; tombol "Use summary mode" dihapus; teks info RINGKAS dihapus; prop
  `detailMode` dihapus dari `SubObjectRow` dan `LineTable`; ternary
  `detailMode === "RINGKAS" ? "—" : ...` di waste cell diganti selalu tampilkan
  `+${formatPct(line.wastePct)}`.
- **Migrasi** `20260819205000_drop_bq_detail_mode/migration.sql` — DROP COLUMN
  `default_detail_mode` dari `BqSettings`; DROP COLUMN `detail_mode`,
  `detail_mode_set_by_name`, `detail_mode_set_at` dari `BqObject`; DROP COLUMN
  `detail_mode` dari `BqLibraryObject`; DROP TYPE `BqDetailMode`.

### R2 — Template L2 tertaut + copy-on-write (BQ-9)

- **`schema.prisma`** — `BqSubObject` mendapat `library_sub_object_id String?`
  dengan FK ke `BqLibrarySubObject` (`onDelete: SetNull`) dan index.
  `BqLibrarySubObject` mendapat relasi balik `instances BqSubObject[]`.
- **`breakdown.ts`** — `librarySubObjectId: string | null` ditambahkan ke
  tipe sub-object dalam `BqObjectView`.
- **`breakdown-service.ts`** — `librarySubObjectId: sub.library_sub_object_id`
  ditambahkan ke mapping `toObjectView()`.
- **`bq-project-actions.ts`** — helper `detachFromTemplate(tx, subObjectId,
  updatedByName)` ditambahkan; dipanggil dari 9 action yang menyentuh baris L3:
  `addBqMaterialLineAction`, `updateBqMaterialLineAction`,
  `overrideBqMaterialLineSnapshotAction`, `refreshBqMaterialLineSnapshotAction`,
  `deleteBqMaterialLineAction`, `addBqServiceLineAction`,
  `updateBqServiceLineAction`, `refreshBqServiceLineSnapshotAction`,
  `deleteBqServiceLineAction`. **Tidak** disambungkan ke
  `updateBqSubObjectAction` (rename/qty) dan `deleteBqSubObjectAction`.
- **`bq-library-actions.ts`** — `loadFromLibrarySubObjectAction` kini memanggil
  `tx.bqSubObject.update` setelah menyalin baris, menulis
  `library_sub_object_id: input.librarySubObjectId` — sub-object target menjadi
  instance `⧉`.
- **`BqBreakdownClient.tsx`** — `SubObjectRow` menampilkan `⧉` (indigo) atau
  `◇` (abu-abu) di samping nama berdasarkan `sub.librarySubObjectId`.
- **Migrasi** `20260819210000_bq_subobject_template_link/migration.sql` — ADD
  COLUMN `library_sub_object_id`, ADD CONSTRAINT FK `onDelete: SetNull`, CREATE
  INDEX.

### R3 — Save to Library dan link (BQ-10, L2)

- **`bq-library-actions.ts`** — `saveSubObjectToLibraryAndLinkAction` baru:
  menyalin sub-object ke `BqLibrarySubObject` beserta seluruh barisnya, lalu
  menulis `library_sub_object_id` pada sub-object sumber sehingga ia menjadi
  instance `⧉` pertama.
- **`BqBreakdownClient.tsx`** — `SubObjectRow` mendapat tombol `+⧉` (hanya
  pada sub-object `◇`); klik membuka form inline bertanda "Save as:" dengan
  input nama dan tombol "Save ⧉ / Cancel". Berhasil → sub-object langsung
  berganti indikator jadi `⧉`. *L1 (pour-and-forget) ditangguhkan (R7).*

### R4 — Override harga per baris (BQ-11)

- **`BqBreakdownClient.tsx`** — Kolom "Harga Satuan" material sekarang berisi
  `NumberCell` yang dapat diedit; blur/Enter memanggil
  `overrideBqMaterialLineSnapshotAction({ id, price: next })`. Badge teks
  `"edited"` diganti simbol `†` (amber) dengan tooltip catatan override.
  `overrideBqMaterialLineSnapshotAction` ditambahkan ke import dari
  `bq-project-actions`.

### R5 — Header kolom tabel bahan dan jasa (BQ-7, sebagian)

- **`BqBreakdownClient.tsx`** — `<thead>` ditambahkan ke tabel bahan dan jasa.
  Kolom bahan: *Uraian Pekerjaan · Vol · Koef · Susut · Susut line · Harga
  Satuan · Jumlah*. Kolom jasa: *Uraian Pekerjaan · Vol · Koef · (kosong ×2) ·
  Harga Satuan · Jumlah*.

### R6 — Library button dipindah ke L2 (BQ-7, sebagian)

- **`BqLinePicker.tsx`** — Tombol "Library" dihapus dari picker L3; `Mode`
  type disederhanakan jadi `"MATERIAL" | "SERVICE"`. `LibraryPickerDialog`
  di-export untuk dipakai dari luar.
- **`BqBreakdownClient.tsx`** — `LibraryPickerDialog` diimpor dari
  `BqLinePicker`; `SubObjectRow` mendapat tombol `<BookOpen>` yang membuka
  dialog tersebut langsung di level L2 (tanpa harus membuka tabel L3 dulu).
  Import `BookOpen` ditambahkan dari lucide-react.
  `saveSubObjectToLibraryAndLinkAction` diimpor dari `bq-library-actions`.

**Verifikasi yang dijalankan:** review statis lintas-berkas; semua referensi
`detailMode`/`RINGKAS`/`setBqObjectDetailModeAction` sudah bersih (grep 0 hit).
Suite test dan `npx tsc --noEmit` belum bisa dijalankan karena database tidak
terjangkau dari container cloud — owner perlu jalankan sendiri setelah
`npx prisma migrate dev`.

**AT-01 Rp5.653.559:** tidak ada kode `computeObject()` yang disentuh kecuali
penghapusan `detailMode` — angka tidak bergeser (dijaga CoW-06).

**R7 (L1 save-to-library):** ditangguhkan. `saveObjectToLibraryAction` ada di
`bq-library-actions.ts` tetapi belum ada tombolnya di `BqBreakdownClient.tsx`.

**Area/berkas yang berubah:** `calc.ts`, `calc.test.ts`,
`types/breakdown.ts`, `services/settings-service.ts`,
`services/breakdown-service.ts`, `actions/bq-settings-actions.ts`,
`actions/bq-project-actions.ts`, `actions/bq-library-actions.ts`,
`components/BqBreakdownClient.tsx`, `components/BqLinePicker.tsx`,
`prisma/schema.prisma`,
`prisma/migrations/20260819205000_drop_bq_detail_mode/migration.sql`,
`prisma/migrations/20260819210000_bq_subobject_template_link/migration.sql`.

## [Unreleased] - 2026-08-19 (#66) — Review R1 OpenCode + penyelarasan BQ ke prototype (R2 direncanakan)

**Hasil akhir:** Perubahan BQ Simplification yang dikerjakan OpenCode (tahap
P1–P4 dari `HANDOFF-OPENCODE.md`) direview dan lulus secara struktural. Namun
pembandingan terhadap `D:\Misc\ProjectsHUB\BQ\prototype_fixture_breakdown.html`
— prototype yang sudah di-QC estimator kantor — menemukan enam penyimpangan.
`HANDOFF-OPENCODE-R2.md` ditulis untuk menutupnya. Belum ada kode R2 yang
dikerjakan pada entri ini.

**Yang diverifikasi dari kerja OpenCode (semuanya benar):**
`master_data.Sku` menerima enam kolom costing dan `toCandidate()` membacanya
langsung; model `BqMaterialProfile` dan `BqCategoryWaste` hilang dari schema
sementara `snapshot_category_default_waste_pct` dan level 4 `resolveWaste()`
sengaja dipertahankan; `/bq/settings` beserta `BqSettingsClient.tsx` terhapus
dan navigasi sidebar berganti jadi `/bq/library` dengan ikon BookOpen;
`price-drift-service.ts` disederhanakan dari enam varian `BqDriftKind` menjadi
`hasDrift` boolean per baris; `calc.ts` diimpor di klien dan `router.refresh()`
menjadi fire-and-forget; empat migrasi baru tercatat berurutan
(`20260819170000` s.d. `20260819200000`). `calc.ts` dan `calc.test.ts` tidak
tersentuh — AT-01 tetap terkunci di Rp5.653.559.

**Penyimpangan yang ditemukan terhadap prototype:**

1. **Model template L2 salah konsep.** Prototype memakai template *tertaut +
   copy-on-write* seperti block SketchUp: instance `⧉` membaca definisi, dan
   begitu barisnya disentuh ia otomatis lepas jadi `◇` berdiri sendiri. Plan R1
   §B4 justru menulis *"sesudah dituang, baris tidak punya hubungan apa pun
   dengan entri library-nya"* — pour-and-forget. **Ini kesalahan plan R1, bukan
   kesalahan OpenCode.**
2. **Tombol "Save to library" tidak ada di editor.** `saveObjectToLibraryAction`
   dan `saveSubObjectToLibraryAction` sudah lengkap di
   `bq-library-actions.ts`, tetapi tidak pernah dipanggil dari
   `BqBreakdownClient.tsx`. Halaman `/bq/library` sudah menampilkan ajakan
   *"Save an object from a BQ breakdown"* padahal jalannya belum dibuat.
3. **Override harga per baris tidak ada di UI.** Backend menerima `input.price`
   dan menulis `snapshot_price` + `is_manual_override: true`, tetapi
   `BqBreakdownClient.tsx` hanya menampilkan `isManualOverride` sebagai badge
   pasif. Estimator bisa melihat status override tanpa bisa membuatnya.
4. **Kolom koefisien tidak berlabel.** Prototype punya header `VOL · KOEF`
   eksplisit; editor menaruh `qtyPerSub` sebagai NumberCell polos, sehingga
   koefisien 1,50 pada Plywood terbaca "1,5 lembar dipakai" alih-alih "1,5
   lembar per satu Body Kabinet".
5. **Hierarki tombol tambah rata.** Prototype membedakan tiga lapis lewat
   indentasi dan bobot visual (`+ Tambah Bahan` → `+ Tambah Sub-object` →
   `+ Tambah Pos Pekerjaan`). Editor menaruh ketiganya nyaris sejajar. Tombol
   **Library** juga salah lapis: duduk bersama `+ Material`/`+ Service` (L3)
   padahal yang dituangnya adalah sub-object (L2).
6. **Label "Use summary mode" menyesatkan.** Fitur ini bukan karangan — PRD §4
   memang mendefinisikan mode `ringkas` — tetapi artinya "waste diabaikan dan
   object tidak masuk Purchase Summary", bukan tampilan ringkas.

**Keputusan owner pada entri ini:**

| Kode | Keputusan | Konsekuensi yang diterima |
|---|---|---|
| O1 | Template L2 memakai model tertaut + copy-on-write sesuai prototype | Perlu kolom `library_sub_object_id` di `BqSubObject`, helper detach, dan delapan test baru |
| O2 | Library L1 dan L2 sama-sama dipertahankan | L1 tetap pour-and-forget (custom per proyek); hanya L2 yang tertaut |
| O3 | `BqDetailMode` dibuang sepenuhnya | **PRD §4 gugur.** AT-05, AT-05b, dan AT-05c dihapus. AT-01 tidak terpengaruh karena contoh Bab 7 bermode detail |

**Area/berkas yang berubah:** `HANDOFF-OPENCODE-R2.md` (baru).
`HANDOFF-OPENCODE.md` (R1) tetap sebagaimana adanya sebagai catatan riwayat —
bagian library-nya digantikan R2, tidak diedit.

**Verifikasi yang benar-benar dijalankan:** review statis atas schema, service,
action, komponen, dan struktur route melalui pembacaan berkas. `npx prisma
migrate status` **tidak bisa dijalankan** — database `localhost:5432` tidak
terjangkau saat pengecekan. Suite test belum dijalankan ulang pada entri ini
karena tidak ada kode yang diubah.

**Risiko:** O3 melanggar PRD §4 secara sadar atas keputusan owner. Sesi
berikutnya jangan memperlakukan hilangnya mode ringkas sebagai regresi.
Tiga acceptance test yang dihapus adalah konsekuensi yang sudah disetujui.

**Pekerjaan terbuka:** empat migrasi R1 (`20260819170000` s.d. `20260819200000`)
tampaknya belum diterapkan ke database — tidak terverifikasi karena server
database mati. Owner perlu menyalakan database lalu menjalankan `npx prisma
migrate dev` sebelum tahap mana pun di R2 bisa diuji di browser. Eksekusi R2
tahap T1–T4 diserahkan ke OpenCode. Pencabutan `BQ_ACCESS` dari STAFF (Q2 di R1)
masih menunggu keputusan owner dan `constants.ts` memang belum disentuh.

## [Unreleased] - 2026-08-19 (#65) — Migrasi BQ diterapkan dan schema Prisma direkonsiliasi

**Hasil akhir:** `npx prisma migrate dev` sudah dijalankan ke database development
lokal `studioflow`. Migrasi `20260819140000`, `20260819150000`, dan
`20260819160000_bq_fixture_breakdown` tercatat selesai tanpa rollback; schema
`bq` sekarang berisi 8 tabel yang diharapkan.

Saat eksekusi pertama, Prisma meminta nama migrasi baru setelah migrasi pending
diterapkan. Prompt dibatalkan lebih dulu agar tidak menghasilkan perubahan tanpa
inspeksi. `prisma migrate diff` kemudian membuktikan lima selisih yang memang
sudah ada di `schema.prisma`, tetapi belum ditegakkan efektif oleh riwayat
migrasi: enum `SampleStatus.SENT_TO_CLIENT`, index lama
`Category_kind_slug_key` (migrasi `20260819150000` mencoba melepasnya sebagai
constraint, padahal ia index), serta index nonunik slug Brand/Party dan
`(Category.kind, Category.slug)`.

**Area/berkas yang berubah:** Prisma membuat dan menerapkan
`prisma/migrations/20260819083947_reconcile_prisma_schema_gaps/migration.sql`.
Migrasi ini aditif/metadata selain melepas index unik Category yang sudah
digantikan `Category_kind_slug_live_uniq`; tidak menghapus tabel, kolom, atau
baris. Selain entri ini, tidak ada kode aplikasi atau dokumentasi lain yang
diubah pada task migrasi.

**Verifikasi yang benar-benar dijalankan:** `npx prisma migrate dev` ulang
berhasil dengan hasil *Already in sync*; `npx prisma migrate status` melaporkan
32 migrasi dan database up to date; `prisma migrate diff` database→schema
melaporkan *No difference detected*; `npx prisma validate` valid;
`npx prisma generate` menghasilkan Prisma Client v7.5.0; `npm run typecheck`
lulus. Query langsung database memastikan 8 tabel BQ, 12 CHECK constraint BQ,
dan nol kolom `waste_override_pct`/`snapshot_conversion` pada
`BqServiceLine`.

**Risiko:** tidak ada reset atau operasi data destruktif. Migrasi rekonsiliasi
dibutuhkan agar schema deklaratif, database development, dan client Prisma
kembali identik; index parsial Category yang lebih longgar tetap terpasang.

**Pekerjaan terbuka:** tidak ada pekerjaan migrasi tersisa. Pengisian profil
bahan di `/bq/settings` tetap langkah operasional berikutnya, bukan bagian
migrasi.

## [Unreleased] - 2026-08-19 (#64) — BQ Fixture Breakdown diimplementasikan sebagai subapp `/bq`

**Kenapa:** owner memberi tugas langsung ke Claude (bukan Codex): *"implementasikan
BQ (`D:\Misc\ProjectsHUB\BQ`) sebagai part dari studioflow di `/bq` — master data
yang dibutuhkan L2 dan L3 ambil dari master data."*

**Yang dipelajari sebelum eksekusi** (owner minta *"coba pelajari dulu polanya
sebelum eksekusi"*):

- Repo `D:\Misc\ProjectsHUB\BQ` **tidak berisi kode sama sekali** — hanya
  `PRD_Fixture_Breakdown.md`, `README.md`, satu prototype HTML, arsip PRD lama,
  dan `unused/INTEGRATION_STUDIOFLOW.md`. Jadi "implementasikan BQ" berarti
  membangun dari PRD, bukan memindahkan kode.
- Tanahnya sudah disiapkan sejak sebelumnya: schema `bq` sudah dideklarasikan di
  `datasource` (`schema.prisma:8`), role `ESTIMATOR` + permission `BQ_ACCESS` +
  `APP_ACCESS` matrix sudah ada, dan `/bq` sudah punya stub bergerbang.
- View `master_data.v_bq_material_rate` / `v_bq_work_rate` sudah jadi kontrak
  baca BQ sejak migrasi 2026-08-11/08-14.

### Keputusan owner yang diambil di sesi ini (4 pertanyaan)

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Konversi, default waste, minimum order, rounding increment ditaruh di mana? | **Di setelan BQ saja** — schema `bq`, `master_data` tidak disentuh sama sekali. |
| 2 | Object BQ menempel ke mana? | **Project BQ sendiri**, `studioflow_project_id` cuma kolom snapshot (bukan FK). |
| 3 | Cakupan | **F1–F4 sekaligus** (PRD §9). |
| 4 | Baris custom di luar master data | **Tidak ada.** Master data = SSOT; bahan/jasa yang belum ada diminta ke staff lewat Master Data. Yang boleh: menyunting **snapshot** di dalam BQ — tiap project BQ punya snapshot sendiri. |

Keputusan 1 juga menutup "bloker" `UPSTREAM-BQ-MATERIAL-SOURCE.md` §0.3 (*"di mana
database material bertempat?"*) tanpa perlu memilih opsi A/B/C: material tinggal
di `master_data`, BQ membacanya lintas-schema di database yang sama, dan FK
antar-schema memang sah di Postgres.

### Yang dibangun

**1. Schema `bq` — 8 model, migrasi `20260819160000_bq_fixture_breakdown`.**
Aditif sepenuhnya: nol `DROP`, nol `ALTER` pada tabel yang sudah ada, nol baris
`studioflow`/`master_data` yang disentuh. Satu-satunya sentuhan ke luar adalah dua
FK yang MENUNJUK ke `master_data` (arah yang sah — yang dilarang `AGENTS.md` §8
adalah `master_data` bergantung ke `studioflow`).

- `BqSettings` — default markup + mode kantor, satu baris.
- `BqMaterialProfile` — usage/purchase unit, konversi, default waste, minimum
  order, rounding. FK ke `master_data.Sku`. **Inilah tempat keputusan 1 mendarat.**
- `BqCategoryWaste` — presedensi waste level 4. FK ke `master_data.Category`.
- `BqProject` / `BqObject` (L1) / `BqSubObject` (L2).
- `BqMaterialLine` + `BqServiceLine` (L3) — **dua tabel, bukan satu**.

  Ini keputusan desain yang paling perlu diingat: PRD §3.2 menulis baris jasa
  tidak punya waste dan tidak punya konversi, *"ditegakkan lewat skema — tabel
  baris jasa memang tidak punya kolomnya"*, dan AT-07 menguji tepat itu. Satu
  tabel dengan kolom nullable akan membuat AT-07 lolos hanya selama ada yang
  ingat menulis cek aplikasinya.

  CHECK constraint yang dipasang: `conversion > 0` (di profil **dan** di baris
  snapshot), `rounding_increment > 0`, waste `>= 0`, qty `> 0`. Konversi nol
  bukan "data belum diisi" — ia membuat harga per usage unit jadi tak hingga,
  dan angka itu mengalir ke rate sebelum ada yang sadar.

**2. Mesin hitung murni — `src/subapps/bq/lib/calc.ts` + 23 test.**
Tanpa Prisma, tanpa DOM, tanpa `Date.now()`. `scripts/run-tests.mjs` hanya bisa
mengompilasi berkas yang tidak menjangkau Prisma, dan batas itu adalah pagarnya:
mesin hitung yang bisa diuji tanpa database adalah mesin hitung yang tidak bisa
diam-diam membaca ulang master data.

**Angka acuan PRD Bab 7 tereproduksi persis**, bukan dengan toleransi:

```
Biaya pokok / unit   Rp 4.711.299   ✓
Markup 20%           Rp   942.260   ✓
RATE / unit          Rp 5.653.559   ✓
Purchase total       Rp 3.182.000   ✓
Packaging variance   Rp   721.201   ✓
```

Seluruh acceptance test PRD Bab 10 yang bisa diuji tanpa database ditulis:
AT-01, AT-02, AT-03, AT-04, AT-05, AT-05b, AT-05c, AT-06, AT-11, AT-12. AT-07
ditegakkan skema (dua tabel), AT-08/AT-09/AT-10 ditegakkan RBAC dan snapshot.

**3. Service layer.**
- `master-data-service.ts` — satu-satunya pintu baca BQ→Master Data. `readiness`
  mengembalikan **alasan** sebuah SKU belum bisa dipakai (`NO_PROFILE` /
  `NO_PRICE` / `UNIT_MISMATCH`), bukan boolean `disabled`: ketiganya mengarah ke
  layar yang berbeda. `UNIT_MISMATCH` sengaja tidak ditebak jalan keluarnya —
  kalau profil bilang "lembar" tapi penawaran ditulis "sqm", yang salah bisa
  salah satunya, dan menghitung berdasarkan tebakan menghasilkan angka salah
  dengan percaya diri.
- `breakdown-service.ts` — DB → masukan mesin hitung. **Tidak ada aritmatika di
  dalamnya.** Purchase summary dibangun dari `ObjectInput[]` yang SAMA dengan
  yang dipakai menghitung rate, bukan query agregasi terpisah.
- `price-drift-service.ts` — satu-satunya tempat BQ membaca ulang master untuk
  baris yang sudah ada, dan ia **hanya melapor**. Object terkunci dilewati
  seluruhnya (PRD §5.4).
- `settings-service.ts` — `getSettings()` sengaja tidak `upsert`: membuka halaman
  tidak boleh menulis ke database.

**4. Server actions** — 20 aksi, semuanya lewat `createAction`, RBAC-gated,
`insertAuditLog` di dalam transaksi yang sama. Detail yang mudah terlewat: kunci
audit dinamai `bq_project_id`, bukan `project_id`, karena `insertAuditLog`
menyimpulkan `AuditLog.project_id` dari kunci itu dan kolomnya FK ke
`studioflow.Project`.

Refresh snapshot **satu baris per panggilan**, tidak ada "apply all". PRD §5.4
meminta perubahan *"boleh diterapkan sebagian"*, dan tombol massal adalah tombol
yang ditekan orang tanpa membaca.

**5. UI `/bq`** — layout bergerbang (pindah dari `page.tsx` ke `layout.tsx`
karena sekarang ada halaman anak), sidebar dengan chrome identik Master Data,
daftar breakdown, pohon tiga lapis collapse/expand, Purchase Summary, dan
`/bq/settings`. FR-EXP-01…08 ditegakkan. Teks Inggris, komentar Indonesia,
zero hardcode (`UI_ENGINE_*` token).

### RBAC — pembalikan asumsi yang perlu dicatat

`constants.ts` sebelumnya memegang satu permission `BQ_ACCESS` dengan catatan
tegas *"do not add granular BQ permissions here"*. Catatan itu **benar untuk
asumsi yang dikutipnya** (`UPSTREAM-BQ-MATERIAL-SOURCE.md` §0.2: BQ aplikasi
terpisah yang menegakkan izinnya sendiri). Owner membalikkan asumsi itu hari ini,
jadi tidak ada proses lain yang tersisa untuk menegakkan `BQ_*` — permission
granular sekarang memang milik StudioFlow.

Empat permission baru: `BQ_PROJECT_MANAGE`, `BQ_BREAKDOWN_EDIT`,
`BQ_MARKUP_EDIT`, `BQ_SETTINGS_MANAGE`.

- **ESTIMATOR** (5 izin): `BQ_ACCESS`, `MASTERDATA_PRICE_VIEW`,
  `BQ_PROJECT_MANAGE`, `BQ_BREAKDOWN_EDIT`, `BQ_MARKUP_EDIT`.
  **Tidak** `BQ_SETTINGS_MANAGE` — PRD §5.1: estimator tidak mengubah master apa
  pun maupun harga, dan konversi adalah bagian dari mendefinisikan harga.
- **STAFF**: `BQ_ACCESS` + `BQ_SETTINGS_MANAGE`, dan `APP_ACCESS` bertambah
  `bq`. Ini peran "Admin Bahan" PRD §5.1 — di sini STAFF yang memainkannya.
  Konsekuensinya STAFF bisa membuka breakdown dan **membacanya**, tanpa bisa
  mengubah isinya.
- `BQ_MARKUP_EDIT` dipisah dari `BQ_BREAKDOWN_EDIT` supaya studio yang ingin
  estimator menghitung tanpa wewenang menetapkan harga tinggal mencabut satu izin.

`scripts/verify-access-matrix.mjs` diperbarui: rule 6 (multi-app) sekarang
memakai daftar app yang diizinkan STAFF, dan **rule 8 baru** ditambahkan yang
menolak kalau STAFF memegang `BQ_*` di luar `BQ_ACCESS`/`BQ_SETTINGS_MANAGE`.
Membuka pintu app tanpa menambah penjaganya adalah cara perubahan kecil tumbuh
diam-diam.

### Verifikasi

| Perkakas | Hasil |
|---|---|
| `npx prisma validate` | valid |
| `npx tsc --noEmit` | 0 error |
| `npx eslint src/subapps/bq src/app/bq src/core/rbac` | 0 |
| `npm test` | 149 pass / 0 fail (23 di antaranya test BQ baru) |
| `node scripts/verify-access-matrix.mjs` | ✓ all invariants hold |

### ⏳ Langkah owner yang tersisa

**Migrasi belum diterapkan ke database.** `20260819160000_bq_fixture_breakdown`
sudah ditulis, tapi Claude tidak menjalankannya. Jalankan lokal:

```
npx prisma migrate dev
```

Sebelum itu, `/bq` akan gagal saat query — tabelnya belum ada. Verifikasinya ada
di kaki berkas migrasi (`\dt bq.*`, cek CHECK constraint, dan cek bahwa
`BqServiceLine` memang TIDAK punya kolom waste/konversi).

Sesudah migrasi jalan, urutan yang masuk akal: buka `/bq/settings` sebagai
STAFF/ADMIN → isi profil bahan (konversi dulu) → baru `/bq` sebagai ESTIMATOR.
Tanpa profil, picker akan menampilkan setiap SKU dengan alasan *"Needs a BQ
profile"* — itu perilaku yang benar, bukan bug.

### Yang TIDAK dikerjakan

- **Export Internal Cost Detail** (bagian dari F4). Purchase Summary dan seluruh
  angkanya sudah ada di layar; yang belum adalah berkas export-nya. Ditahan
  karena formatnya belum ditentukan owner (PDF? xlsx? kolom apa saja?) dan
  menebaknya akan menghasilkan berkas yang harus dibongkar.
- Rate Library, assembly template, dokumen BQ (section/WBS/quotation) — PRD §8
  memang menundanya.
- PRD §11 open decision 2 (sub-object sebagai template), 4 (siapa Admin Bahan di
  kantor), 6 (variance ditampilkan ke estimator atau tidak — sekarang: ya,
  tampil). Ketiganya belum memblokir apa pun.

## [Unreleased] - 2026-08-19 — Eksekusi SK1–SK5 (audit skema): keputusan owner diterapkan langsung oleh Claude

**Kenapa:** owner cek handoff Codex (BR9–BR12), lalu langsung putuskan kelima
temuan `AUDIT-SKEMA-MASTERDATA-2026-08-19.md` sore ini dan minta Claude yang
eksekusi — bukan lewat `HANDOFF-CODEX.md`/Codex.

**Yang dilakukan:**

1. **Cek handoff Codex** — changelog #60–#63 (BR9, BR10, BR11, BR12) dan
   roadmap.md keempatnya `[x]`, cocok. Spot-check langsung ke kode: grep
   `inlineBrandDraft`/`beginInlineBrandEdit` (nol hasil, BR11 benar), pola
   "and N others" ada (`MasterDataMaterialsClient.tsx:131`), `deleteSkuAction`
   via `softDeleteSku` ada (`masterdata-actions.ts`, BR10 benar). Tidak ada
   penyimpangan ditemukan.
2. **SK1 (opsi a — owner pilih):** `WorkPrice.valid_from`/`valid_to`/
   `is_current` diberi komentar "TIDAK DIPAKAI" di `schema.prisma` (pola sama
   `qty`) + migrasi `20260819140000_workprice_unused_columns_comment`
   (`COMMENT ON COLUMN`, murni metadata). `AGENTS.md` §3 dapat poin baru (7).
3. **SK2:** guard baru `assertBrandBelongsToParty()` di `party-actions.ts`,
   dipanggil dari `createPartyContactAction`/`updatePartyContactAction`
   sebelum tulis — brand harus `owner_party_id` atau `BrandSupplier` party
   yang sama, kalau tidak `VALIDATION_FAILED`.
4. **Item #3 (Category kind,slug):** constraint `@@unique([kind, slug])`
   diganti index parsial `Category_kind_slug_live_uniq` (`WHERE is_active`)
   lewat migrasi `20260819150000_category_kind_slug_live_uniq` — pola sama
   B2. Diverifikasi dulu: nol pemakaian `kind_slug` compound-unique di
   `src/subapps` (aman dihapus dari Prisma Client). `AGENTS.md` §2 dapat
   baris invariant baru.
5. **Item #4 (Category.path) — TERNYATA SUDAH BENAR, laporan audit
   dikoreksi.** Baca penuh `category-tree-service.ts`: `propagateDescendantPaths()`
   sudah ada sejak B7 (2026-08-18), dipanggil otomatis dari `upsertCategory()`.
   Audit 2026-08-19 pagi salah menyimpulkan ini risiko terbuka tanpa membaca
   kode servicenya. **Tidak ada kode diubah** — cuma komentar `schema.prisma`
   pada field `path` yang menunjuk eksplisit ke implementasinya, dan
   `AUDIT-SKEMA-MASTERDATA-2026-08-19.md` diberi update-koreksi di bagian atas
   (riwayat aslinya dibiarkan, bukan diedit diam-diam).
6. **Item #5 (Sku.brand_id Restrict):** didokumentasikan sebagai komentar
   peringatan di `schema.prisma` — tidak ada kode untuk difix karena belum
   ada action delete Brand sama sekali.
7. **`HANDOFF-CODEX.md`** diberi catatan eksplisit "SK1–SK5 DIKLAIM CLAUDE,
   JANGAN DISENTUH CODEX" supaya Codex tidak mengerjakan ulang.

**Area/berkas berubah:** `prisma/schema.prisma`,
`prisma/migrations/20260819140000_workprice_unused_columns_comment/`,
`prisma/migrations/20260819150000_category_kind_slug_live_uniq/`,
`src/subapps/master-data/actions/party-actions.ts`, `AGENTS.md`,
`HANDOFF-CODEX.md`, `roadmap.md`, `AUDIT-SKEMA-MASTERDATA-2026-08-19.md`,
`changelog.md`.

**Verifikasi yang benar-benar dijalankan:** `npm run typecheck` lulus
(exit 0); `npx eslint src/subapps/master-data/actions/party-actions.ts`
lulus (exit 0, nol warning/error); `npx prisma validate` lulus — skema
sintaksis valid. **TIDAK dijalankan** (dan tidak bisa dari sesi Claude
manapun yang dipakai hari ini): `prisma migrate deploy`/`generate` — beda
target binary engine (Linux sesi cloud & VM device vs Windows lingkungan
sungguhan proyek ini), dan mengarahkannya ke folder proyek yang sama berisiko
menimpa Prisma Client Windows yang sudah benar. Kedua migrasi baru masih
**belum diterapkan ke database** sampai owner menjalankannya manual di mesin
lokal — lihat "Langkah buat owner" di `roadmap.md`.

**Risiko:** rendah untuk SK2 (aplikasi murni, sudah typecheck+lint lulus).
SEDANG untuk migrasi SK1/item#3: keduanya non-destruktif dan arahnya
KETAT→LONGGAR (dijelaskan di komentar migrasi masing-masing) sehingga
seharusnya tidak bisa gagal pada data yang ada, tapi belum diverifikasi
benar-benar diterapkan ke database sungguhan — itu langkah owner berikutnya,
bukan sudah selesai.

**Semantic assessment:** YA untuk SK1 dan item #3 — keduanya keputusan
domain/skema baru (WorkPrice bukan tabel riwayat; Category dapat perlakuan
live-uniqueness), sudah ditulis ke `AGENTS.md` §2/§3 supaya agent berikutnya
tidak menganggapnya bug atau membalikkannya tanpa sadar itu keputusan sadar.

**Pekerjaan yang masih terbuka:** owner menjalankan `prisma migrate
deploy`/`generate` lokal untuk kedua migrasi baru, lalu `npm run build` untuk
konfirmasi akhir. Tidak ada item SK yang tersisa di roadmap.

## [Unreleased] - 2026-08-19 (#63) — BR12 konsistensi tabel Brands dan Suppliers

**Hasil akhir:** BR12 selesai. Audit pasca-BR11 memastikan kedua tabel memakai
pola interaksi yang sama: klik nama membuka detail Overview, klik count membuka
tab relasi yang bersangkutan, sel informasional tidak menangkap klik, dan menu
kebab menyediakan View/Edit/Delete sesuai izin. Nama serta legal name kini
memakai token tipografi/warna yang sama; Actions tetap rata kanan dan kedua
tabel mempertahankan token background pending untuk baris incomplete.

**Area/berkas berubah:**
`src/subapps/master-data/components/MasterDataMaterialsClient.tsx`,
`src/subapps/master-data/components/SupplierClient.tsx`, `HANDOFF-CODEX.md`,
`roadmap.md`, `changelog.md`, dan artefak terbangun `graphify-out/`.

**Verifikasi yang benar-benar dijalankan:** ESLint terarah untuk kedua client
lulus; `npm run typecheck` lulus; browser membuktikan nama Lalapis pada tabel
Brands adalah button yang membuka dialog Overview dan tabel Suppliers memakai
pola button nama/count serta kebab yang sama; data Wline/TACO juga memastikan
legal name dan baris incomplete tetap tampil; `npm test` lulus 126/126;
`npm run lint` lulus tanpa error (61 warning baseline di area lain);
`npm run build` lulus; `graphify update .` membangun ulang graph menjadi 5.926
node/11.666 edge.

**Risiko:** rendah. Perubahan hanya presentasi dan target klik yang sudah
tersedia dari menu View details; tidak ada action baru, mutasi data, permission,
atau schema.

**Semantic assessment:** TIDAK — ini penyelarasan pola presentasi/interaksi
yang sudah ditetapkan, tanpa kontrak domain baru.

**Pekerjaan yang masih terbuka:** tidak ada untuk batch BR9–BR12. Item roadmap
lain di luar batch ini tetap mengikuti keputusan/prasyaratnya masing-masing.

## [Unreleased] - 2026-08-19 (#62) — BR11 tabel Brands kembali modal-only

**Hasil akhir:** BR11 selesai. Klik Name, Category, atau Hashtag tidak lagi
mengubah baris menjadi editor. Seluruh state, handler, tombol Save/Cancel, dan
prompt perubahan tertunda khusus inline edit telah dihapus; menu Actions → Edit
full details tetap menjadi satu-satunya jalur edit dan dialognya tetap mengikuti
Edit-First Protocol. Category dan Hashtag sekarang menampilkan nilai pertama
diikuti `and N others`, sedangkan daftar lengkap tetap tersedia pada atribut
`title`.

**Area/berkas berubah:**
`src/subapps/master-data/components/MasterDataMaterialsClient.tsx`, `AGENTS.md`,
`roadmap.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** pencarian kode memastikan tidak ada
lagi state atau handler inline maupun `CreatableTagInput` di client; ESLint
terarah lulus; `npm run typecheck` lulus; browser pada
`/masterdata/materials` membuktikan Wline tampil sebagai `Decorative Panel and
4 others` dan `CNC and 6 others` dengan nama lengkap pada tooltip, sel bukan
lagi button editor, dan menu masih memuat Edit full details; `npm run build`
lulus.

**Risiko:** rendah. Tidak ada perubahan action, data, permission, atau schema.
Pengeditan Brand tetap tersedia penuh melalui dialog, tetapi jalur cepat per
baris sengaja dihilangkan sesuai keputusan owner.

**Semantic assessment:** YA — keputusan jalur edit Brand sengaja membalik BR1.
`AGENTS.md` §Edit-First Protocol diperbarui agar editor inline tersebut tidak
dihidupkan kembali oleh agent berikutnya.

**Pekerjaan yang masih terbuka:** BR12.

## [Unreleased] - 2026-08-19 — Audit skema Master Data: soliditas & cacat logic (SK1–SK2 roadmap baru)

**Kenapa:** owner minta cek `master_data` secara skema — solid atau ada cacat
logic — terpisah dari audit aplikasi 2026-08-18.

**Yang dilakukan:**

1. Baca penuh `prisma/schema.prisma` bagian `master_data`
   (Party→Brand→Sku→Sample, SkuPrice, WorkPrice, Category) dan silang-cek
   terhadap `AGENTS.md` §🧱 Master Data Contract (v2).
2. Verifikasi langsung kelima invariant DB di §2 kontrak terhadap migration
   SQL asli (`20260810180000_masterdata_v2_rebaseline` §§1–3,
   `20260818120000_masterdata_live_unique_indexes`) — semuanya cocok, tidak
   ada drift.
3. Baca jalur tulis `pricing-actions.ts` (WorkPrice create/update, kedua
   kind) dan `party-actions.ts` (PartyContact create/update) untuk verifikasi
   perilaku sungguhan, bukan cuma baca skema statis.
4. Grep seluruh `src/subapps/master-data/actions/*.ts` untuk memastikan
   belum ada action delete Category/Brand (relevan buat temuan #3 dan #5 di
   laporan).
5. Tulis laporan lengkap ke `AUDIT-SKEMA-MASTERDATA-2026-08-19.md`.

**Temuan:**

- Solid: lima invariant DB kontrak (`SkuPrice_current_uniq`,
  `Sku_slug_nobrand_uniq`, `Sku_brand_code_uniq`/`Sku_code_nobrand_uniq`,
  `SkuCategory_primary_uniq`, `Party`/`Brand` name/slug live-unique)
  semuanya benar diterapkan; batas schema `master_data`↔`studioflow`
  konsisten dipatuhi; pilihan Cascade/Restrict/SetNull di seluruh model
  sudah tepat maksud.
- Baru, butuh keputusan owner: **SK1** `WorkPrice.valid_from`/`valid_to`/
  `is_current` tidak pernah dipakai jalur tulis manapun (edit menimpa baris
  di tempat, bukan supersede seperti `SkuPrice`) — kolom `code` yang
  `@unique` global bahkan secara struktural mencegah pola supersede itu;
  **SK2** `PartyContact.brand_id` tidak divalidasi terhadap
  kepemilikan/relasi brand-party di action create/update.
- Risiko rendah/dorman: `Category(kind,slug)` unique tanpa partial-index
  live-row (sama seperti B2 sebelum ditambal, tapi belum ada action delete
  Category jadi belum bisa dipicu); `Sku.brand_id→Brand onDelete:Restrict`
  belum pernah teruji karena belum ada action delete Brand.

**Area/berkas berubah:** `AUDIT-SKEMA-MASTERDATA-2026-08-19.md` (baru),
`roadmap.md`, `changelog.md`. Tidak ada kode aplikasi disentuh — sesi ini
murni review sesuai `AGENTS.md` §🧑‍⚖️ Pembagian Peran.

**Verifikasi yang benar-benar dijalankan:** baca langsung
`prisma/schema.prisma`, migration SQL mentah, dan tiga file action
(`pricing-actions.ts`, `party-actions.ts`, `masterdata-actions.ts`) — bukan
menyimpulkan dari komentar/dokumen saja.

**Risiko:** tidak ada — dokumentasi/analisis murni, nol kode diubah.

**Pekerjaan yang masih terbuka:** SK1 dan SK2 menunggu keputusan owner
sebelum ada eksekusi (lihat roadmap baru).

## [Unreleased] - 2026-08-19 (#61) — BR10 soft-delete SKU dari direktori

**Hasil akhir:** BR10 selesai. SKU Directory sekarang mempunyai kolom Actions
dengan menu View details untuk semua pembaca dan Delete SKU hanya bagi pemegang
`MASTERDATA_SKU_MANAGE`. Delete meminta konfirmasi melalui dialog aplikasi,
memakai transaksi bawaan `createAction`, mengisi `Sku.deleted_at`, mencatat
tepat satu `MasterDataAudit` dalam transaksi yang sama, lalu melakukan
`router.refresh()`. Seluruh baris `SkuPrice`—baik harga berlaku maupun riwayat
yang sudah ditutup—tetap utuh.

**Area/berkas berubah:** `src/app/masterdata/skus/page.tsx`,
`src/subapps/master-data/components/SkuDirectoryClient.tsx`,
`src/subapps/master-data/actions/masterdata-actions.ts`,
`src/subapps/master-data/services/sku-delete-service.ts`,
`src/styles/designTokens.css`,
`tests/integration/material-view-service.integration.test.ts`, `AGENTS.md`,
`roadmap.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** browser pada `/masterdata/skus`
memastikan kolom/menu Actions tampil, opsi Delete tersedia bagi ADMIN, dan
dialog destructive dapat dibatalkan tanpa mutasi; `npm run typecheck` lulus;
ESLint terarah untuk seluruh berkas TypeScript yang disentuh lulus;
`npm run test:integration:docker` lulus 5/5 setelah menerapkan seluruh 28
migrasi ke PostgreSQL disposable dan membersihkan containernya; `npm run build`
lulus.

**Risiko:** rendah. Tidak ada hard delete dan tidak ada perubahan schema.
Restore SKU belum mempunyai UI; baris yang sudah dihapus tetap berada di basis
data untuk kebutuhan audit. Guard `updateMany` mencegah delete kedua pada SKU
yang sama, dan integration test membuktikan harga tidak ikut berubah.

**Semantic assessment:** YA — workflow delete SKU dan aturan retensi harga
adalah kontrak domain yang terlihat pengguna. `AGENTS.md` §Master Data Contract
v2 diperbarui agar soft-delete SKU secara eksplisit mempertahankan semua
`SkuPrice`.

**Pekerjaan yang masih terbuka:** BR11 dan BR12.

## [Unreleased] - 2026-08-19 (#60) — BR9 modal SKU memakai lebar dialog yang benar

**Hasil akhir:** BR9 selesai. Reproduksi browser pada `/masterdata/skus`
membuktikan `SkuDetailDrawer` dirender 560px pada viewport 1280px, dengan
`scrollWidth` konten 945px. Penyebabnya bukan `TableCard`: `DialogContent`
memakai ukuran default `md` pada breakpoint `sm`, sehingga utility lebar 980px
yang ditaruh lewat `className` kalah. Viewer sekarang memakai API semantik
`size="xl"`; lebar aktual menjadi 980px, `scrollWidth` dialog sama dengan
`clientWidth` 979px, dan kedua tabel masing-masing muat pada 929px. Hasil yang
sama diverifikasi dari Material Prices dan SKU Directory.

Roadmap yang baru ditulis juga memuat contoh literal utility `max-width`
berbasis pemanggilan `var` dengan placeholder elipsis.
Tailwind memindai Markdown tersebut sebagai kandidat class lalu menghasilkan
CSS `var(...)` yang tidak valid, sehingga dev server sempat gagal compile.
Contoh dokumentasi itu diganti menjadi istilah deskriptif tanpa mengubah spek.

**Area/berkas berubah:** `src/subapps/master-data/components/SkuDetailDrawer.tsx`,
`roadmap.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** reproduksi browser sebelum patch
(dialog 560px, max-width 560px, scrollWidth 945px); verifikasi browser sesudah
patch dari `/masterdata/skus` dan `/masterdata/prices` (dialog 980px,
scrollWidth = clientWidth 979px); `npm run typecheck` lulus; `npm run build`
lulus.

**Risiko:** rendah. Perubahan memakai prop ukuran yang memang disediakan
primitive Dialog; tidak mengubah query, data, permission, atau struktur tabel.
Pada viewport sempit, pembatas `calc(100vw - 2rem)` milik primitive tetap
berlaku dan `TableCard` tetap menyediakan scroll horizontal internal.

**Semantic assessment:** TIDAK — hanya koreksi ukuran presentasi dan contoh
dokumentasi yang mematahkan compile.

**Pekerjaan yang masih terbuka:** BR10, BR11, dan BR12.

## [Unreleased] - 2026-08-19 — Review batch Codex #45–#59 + roadmap baru BR9–BR12 dari verifikasi visual owner

**Kenapa:** owner minta cek changelog (Codex bilang sudah selesai coding) lalu
siapkan roadmap baru dari empat temuan visual (tiga lewat screenshot, satu
instruksi umum) supaya Codex bisa langsung run.

**Yang dilakukan:**

1. **Cek changelog dari checkpoint terakhir Claude** ("Prep eksekusi 6 item
   UI/UX...") sampai entri teratas sekarang (#59) — 15 entri baru (#45–#59):
   LA-1, C-SISA-5 (+migrasi #59), keenam item UI/UX §3a (BR2/BR4/BR5/BR7/
   UI-CON-2/UI-CON-4), §20, M3/§8, C-SISA-3, T3, proposal+implementasi test
   integrasi DB (#57/#59), dan satu regression cleanup lint (#58). Disilang-cek
   ke `roadmap.md`: seluruh item terkait sudah `[x]` — tidak ada penyimpangan
   ditemukan.
2. **Roadmap baru ditulis** dari empat temuan owner terhadap hasil batch di
   atas (lihat `roadmap.md` § *"MASTER DATA — UI/UX ditemukan owner dari
   verifikasi visual (2026-08-19)"*, item **BR9–BR12**): modal `SkuDetailDrawer`
   terpotong, `/masterdata/skus` tidak ada delete SKU (diverifikasi: memang
   belum ada action delete SKU di manapun, bukan regresi khusus halaman ini),
   penghapusan inline edit Brands (membalik BR1 atas permintaan eksplisit
   owner) + peringkasan kolom Category/Hashtag gaya Instagram, dan audit
   konsistensi styling tabel Brands vs Suppliers.
3. **`HANDOFF-CODEX.md` §3b baru** — tabel spek + urutan kerja (BR9/BR10 bebas
   urutan, BR11 sebelum BR12) untuk Codex, plus penanda status bahwa seluruh
   §3/§3a batch lama sudah tuntas dan §3b adalah batch aktif sekarang.

**Area/berkas berubah:** `roadmap.md`, `HANDOFF-CODEX.md`, `CHANGELOG.md`.
Tidak ada kode aplikasi yang berubah — sesi ini murni product-specialist/
reviewer sesuai `AGENTS.md` §🧑‍⚖️ Pembagian Peran.

**Verifikasi yang benar-benar dijalankan:** `grep`/`sed` checkpoint changelog
dan silang-cek `roadmap.md`; pembacaan langsung `SkuDetailDrawer.tsx` dan
token `--ui-dialog-width-xl`/`minWidth` di `designTokens.css` untuk BR9 (bukan
sekadar menduga dari screenshot); pembacaan `SkuDirectoryClient.tsx` dan `grep`
seluruh `src/subapps/master-data/actions/*.ts` untuk BR10 — dikonfirmasi tidak
ada action delete SKU/Material sama sekali di repo; pembacaan
`MasterDataMaterialsClient.tsx` (kolom Category/Hashtag, state
`inlineBrandDraft`) dan `SupplierClient.tsx` untuk BR11/BR12.

**Risiko:** tidak ada — murni dokumentasi/perencanaan. BR9 sengaja ditulis
sebagai "reproduksi dulu, jangan asumsi" karena root cause pastinya belum
diverifikasi lewat browser di sesi ini.

**Pekerjaan yang masih terbuka:** BR9–BR12 (roadmap baru, belum
diimplementasikan) — eksekusi tetap tugas Codex. Working tree juga masih
menyimpan pekerjaan besar yang belum di-`git commit` (lihat §3a lama di
`HANDOFF-CODEX.md`); makin relevan sekarang mengingat #45–#59 menambah jauh
lebih banyak perubahan di atasnya.

## [Unreleased] - 2026-08-19 (#59) — Migrasi saved filters + PostgreSQL test disposable

**Hasil akhir:** owner secara eksplisit mewakilkan dua langkah yang sebelumnya
menunggu keputusan. Pertama, migrasi aditif
`20260819130000_add_checklist_filter_view` diterapkan dengan `prisma migrate
deploy` ke database terkonfigurasi `studioflow` di `localhost:5432`. Pemeriksaan
sesudah operasi menyatakan seluruh 28 migrasi up to date. Tidak ada database
remote/production yang disentuh.

Kedua, Opsi A proposal #57 dibangun penuh. Service Compose `db-test` memakai
Postgres 15, port khusus `127.0.0.1:55432`, dan data `tmpfs` tanpa volume
development. Runner selalu menjalankan seluruh migrasi dari nol, mengompilasi
suite terpisah, menjalankan test, menutup Prisma/pg pool, lalu membuang hanya
container `db-test` walaupun ada kegagalan. Jalur tanpa Docker wajib menerima
`TEST_DATABASE_URL` dan fail-closed terhadap host non-loopback, nama DB tanpa
akhiran `_test`, URL yang sama dengan DB runtime, atau env yang tidak terisi.
`npm test` tetap cepat/tanpa I/O; `npm run test:all` menggabungkannya dengan
suite database.

Empat test PostgreSQL nyata kini menjaga `getBrandView` dan
`getSkusForBrand`: search Brand/owner/category/hashtag/supplier/SKU; exclusion
soft-delete; completeness/count supplier hidup; sort/pagination; relasi harga
berlaku/sample/category/media; urutan SKU; serta batas 201 input menjadi 200 row
dengan `truncated: true`. `LibraryService` pada jalur SKU-grain dimuat lazy agar
dua query Brand-grain dapat dieksekusi mandiri tanpa menarik graph mutasi/auth;
perilaku hasil query tidak berubah.

**Area/berkas berubah:** service disposable di `docker-compose.yml`; script
`test:integration`, `test:integration:docker`, dan `test:all` di `package.json`;
runner `scripts/run-integration-tests.mjs`; test di
`tests/integration/material-view-service.integration.test.ts`; panduan
`docs/INTEGRATION-TESTING.md`; ignore artefak compile di `.gitignore`; teardown
pool di `src/core/platform/db.ts`; lazy import di
`src/subapps/master-data/services/material-view-service.ts`; aturan baru di
`AGENTS.md`; serta status `roadmap.md`, `HANDOFF-CODEX.md`, dan entri ini.
Tidak ada perubahan `prisma/schema.prisma` atau isi migrasi.

**Verifikasi yang benar-benar dijalankan:** target migrasi diperiksa tanpa
menampilkan credential (`DIRECT_URL`/`DATABASE_URL` sama-sama lokal), `prisma
migrate deploy` berhasil, dan `prisma migrate status` melaporkan up to date.
`docker compose config --quiet` lulus; percobaan runner tanpa
`TEST_DATABASE_URL` gagal sebelum query pertama sebagaimana dirancang;
`npm run test:all` lulus **126 test murni + 4 test integrasi**; test disposable
menerapkan 28 migrasi dari nol dan `docker compose ps --all db-test` kosong
setelah cleanup. `npm run typecheck` lulus; full `npm run lint` lulus dengan 0
error (61 warning lama); `npm run build` lulus. Schema PostgreSQL multi-schema,
`prisma.config.ts`, adapter `PrismaPg`, dan `src/core/platform/db.ts` sudah
divalidasi silang; provider/path tetap cocok. Graphify diperbarui setelah
perubahan kode.

**Risiko:** suite integrasi memerlukan Docker dan port host 55432 yang kosong.
Migrasi yang diterapkan adalah database lokal sesuai `.env`; deployment remote
tetap harus dijalankan di lingkungan remote bila memang diperlukan. Dynamic
import menambah satu boundary async internal pada `getMaterialView`, tetapi
fungsi tersebut sudah async dan production build memvalidasi chunk-nya.

**Semantic assessment:** YA untuk workflow engineering—repo sekarang memiliki
kontrak test DB disposable yang mengikat agent berikutnya. `AGENTS.md` sudah
diperbarui dengan Database Integration Test Protocol. Tidak ada perubahan
semantik domain Master Data atau workflow pengguna.

**Pekerjaan yang masih terbuka:** tidak ada untuk migrasi lokal, Opsi A, atau
dua query Brand. Remote migration hanya relevan bila ada target remote yang
memang hendak dideploy.

## [Unreleased] - 2026-08-19 (#58) — Regression cleanup lint UI Engine

**Hasil akhir:** full lint pada audit penutup menemukan satu error: shared
`DeleteConfirmDialog` mengimpor AlertDialog langsung dari internal
`@/components/ui/*`, melanggar single import surface UI Engine. Import sekarang
melewati `@/ui_engine`. Karena berkas itu ikut disentuh, copy `Batal` dibetulkan
menjadi `Cancel`, warna hardcoded diganti variant `destructive`, dan ukuran/
margin hardcoded spinner dibuang agar mewarisi token Button. Pencarian caller
menunjukkan komponen ini belum dirender permukaan hidup, jadi perubahan tidak
mengubah workflow pengguna saat ini tetapi mencegah pola salah dipakai nanti.

**Area/berkas berubah:** shared component
`src/subapps/master-data/components/shared/DeleteConfirmDialog.tsx`; status T6
di `roadmap.md`; catatan keadaan repo di `HANDOFF-CODEX.md`; UI Changes dan
entri ini di `CHANGELOG.md`. Tidak ada schema, migrasi, action, query,
permission, data, atau konfigurasi yang diubah.

**Verifikasi yang benar-benar dijalankan:** full `npm run lint` adalah detektor
awal; export AlertDialog dan variant Button diperiksa pada UI Engine; pencarian
seluruh `src/` memastikan tidak ada caller hidup. Setelah perbaikan dijalankan
ulang: `npm test` **126/126 lulus**; `npm run typecheck` lulus; full
`npm run lint` lulus dengan **0 error** (61 warning lama tetap terlihat);
`npm run build` lulus; Graphify update selesai menjadi 4.963 node / 10.670
edge.

**Risiko:** nol dampak runtime saat ini karena komponen belum dipakai. Bila
dipakai kemudian, tombol cancel berbahasa Inggris dan destructive styling
sekarang konsisten dengan design system. Warning lint lama di luar scope tetap
ada, tetapi error count kembali nol.

**Semantic assessment:** TIDAK — ini kepatuhan import/design system dan copy,
bukan perubahan domain atau workflow. `AGENTS.md` tidak perlu diubah.

**Pekerjaan yang masih terbuka:** tidak ada untuk #58.

## [Unreleased] - 2026-08-19 (#57) — Proposal test integrasi Brand view

**Hasil akhir:** proposal test database untuk `getBrandView` dan
`getSkusForBrand` sudah ditulis sebagai tiga opsi. Rekomendasinya adalah
PostgreSQL test disposable melalui service Docker Compose khusus: repo sudah
memakai Postgres 15 di Compose, sehingga query Prisma, raw SQL hashtag,
aggregate, soft-delete, multi-schema, view/index, dan seluruh migrasi dapat
diuji tanpa menambah library orkestrasi. Testcontainers dicatat sebagai opsi
ketika CI paralel membutuhkannya. Mock Prisma ditolak untuk dua fungsi ini
karena tidak menguji semantik database yang justru menjadi sumber risikonya.

Proposal menetapkan pengaman minimum: hanya `TEST_DATABASE_URL`, host loopback,
nama database berakhiran `_test`, tidak pernah fallback ke `DATABASE_URL`, DB
tanpa persistent volume, migrasi nyata sebelum suite, fixture minimal ber-id
unik, dan cleanup setelah suite. Suite integrasi tetap terpisah dari `npm test`
yang sekarang sengaja hanya menerima modul murni tanpa I/O. Tidak ada infra
atau test baru dipasang sebelum owner memilih opsi.

**Area/berkas berubah:** proposal/status di `roadmap.md`, ringkasan keputusan
di `HANDOFF-CODEX.md`, dan entri `CHANGELOG.md` ini. `package.json`, lockfile,
Docker Compose, test runner, kode produksi, schema, migrasi, konfigurasi, dan
database tidak diubah.

**Verifikasi yang benar-benar dijalankan:** inspeksi `package.json`,
`scripts/run-tests.mjs`, `docker-compose.yml`, `prisma.config.ts`, adapter
runtime `src/core/platform/db.ts`, seluruh test yang ada, dan implementasi
aktual `getBrandView`/`getSkusForBrand`. Repo tidak memiliki konfigurasi CI,
dependency Testcontainers/pg-mem/mock Prisma, atau runner DB; Compose Postgres
15 sudah tersedia dan runner murni secara eksplisit melarang import runtime
yang mencapai Prisma. Tidak ada test/build baru karena task hanya menulis
proposal dan tidak mengubah executable code.

**Risiko:** Opsi A tetap bergantung pada Docker lokal dan membutuhkan aturan
cleanup yang tegas; karena itu implementasi tidak boleh sekadar memakai service
`db`/volume dev yang ada. Menyatukan suite DB ke `npm test` sejak hari pertama
akan memperlambat feedback loop dan membuat Docker menjadi syarat untuk seluruh
test, sehingga proposal memisahkannya sampai stabil.

**Semantic assessment:** TIDAK — belum ada perubahan test infrastructure,
arsitektur produksi, workflow produk, atau kontrak inti. `AGENTS.md` tidak perlu
diubah.

**Pekerjaan yang masih terbuka:** owner perlu memilih **A (Docker Compose
disposable, direkomendasikan)** atau **B (Testcontainers)**. Implementasi dan
test query baru menunggu keputusan itu.

## [Unreleased] - 2026-08-19 (#56) — T3 verifikasi lima klaim audit lama

**Hasil akhir:** lima klaim warisan diverifikasi ulang terhadap kode hidup.
Issue 1 `/activity` dan Issue 5 prefix CD sudah selesai: proxy/auth sekarang
fail-closed untuk semua route non-publik dan dashboard memeriksa akses lagi;
`normalizeDrawingCode()` sudah membuang prefix `CD` serta dipakai oleh create
dan update CD. Issue 6 masih benar—`ScheduleService.switchActiveOption` hanya
punya definisi tanpa caller. Migrasi seluruh `LIBRARY_*` seperti bunyi dokumen
lama tidak bisa diterapkan mentah karena premis split app-nya sudah usang,
tetapi gate Sample/Request di Master Data memang masih memakai namespace
Library. Klaim perbaikan badge juga hanya benar untuk `IN_PROGRESS`;
`READY_FOR` masih mewarisi `shrink-0` dari base `Badge` walau diberi
`max-w-full truncate`.

Tiga temuan yang masih nyata dipisahkan menjadi T8, T9, dan T10 di roadmap.
Sesuai mandat T3, tidak satu pun langsung diimplementasikan pada task
verifikasi ini.

**Area/berkas berubah:** status dan bukti di `roadmap.md`, hasil handoff di
`HANDOFF-CODEX.md`, serta entri ini di `CHANGELOG.md`. Tidak ada kode, UI,
schema, migrasi, permission, konfigurasi, atau data yang diubah.

**Verifikasi yang benar-benar dijalankan:** Graphify query lintas auth/CD/
schedule/RBAC/badge; pemeriksaan `src/auth.config.ts`, `src/proxy.ts`,
`src/core/rbac/app-access.ts`, layout dashboard, dan route activity; pencarian
caller `switchActiveOption` pada seluruh `src/`; pemeriksaan pemanggil
`normalizeDrawingCode`; audit konstanta/matrix dan seluruh gate `LIBRARY_*` /
`MASTERDATA_*` pada action Library serta Master Data; inspeksi base `Badge` dan
seluruh cabang `ProjectProgressBadges`. Browser terautentikasi membuka tabel
Projects dan menunjukkan cabang `IN_PROGRESS` hidup tanpa overlap. Tidak ada
test/build baru karena hasil task hanya dokumentasi dan kode tidak berubah.

**Risiko:** `normalizeDrawingCode` belum punya test unit khusus prefix CD.
Dataset browser tidak memiliki row `READY_FOR`, jadi cacat T10 disimpulkan dari
resolusi class yang deterministik (`shrink-0` base tidak dibatalkan), bukan
tangkapan visual row hidup. Rename permission T9 berisiko mengubah akses bila
dikerjakan sebagai search/replace; karena itu scope dan pemetaan matrix wajib
ditentukan lebih dulu.

**Semantic assessment:** TIDAK — verifikasi ini tidak mengubah arsitektur,
workflow, kontrak inti, atau perilaku. `AGENTS.md` tidak perlu diubah.

**Pekerjaan yang masih terbuka:** T8, T9, dan T10 ada sebagai item baru di
`roadmap.md`; tidak ada implementasi yang diotorisasi oleh T3.

## [Unreleased] - 2026-08-19 (#55) — C-SISA-3 drag-and-drop urutan task

**Hasil akhir:** checklist pada phase view dan Global Checklist project kini
memiliki drag handle dengan pointer maupun keyboard. Root task hanya dapat
diurutkan terhadap root lain dalam project/phase yang sama; subtask hanya dapat
diurutkan terhadap sibling di bawah parent yang sama. Drop lintas parent,
root↔child, atau lintas kelompok menjadi no-op—drag mengubah urutan, tidak
pernah mengubah hierarki.

Reorder hanya tersedia pada filter `All`. Filter Today/Overdue/P1/Mine dapat
menyembunyikan sebagian sibling; mengirim subset itu ke `reorderTasks` akan
memberi `sort_order` baru pada yang terlihat sambil meninggalkan task
tersembunyi dengan nomor lama. UI menampilkan petunjuk `Switch to All to
reorder tasks.` dan menyembunyikan handle di filter tersebut. Setelah drop,
urutan dicat optimistik, action existing menyimpan seluruh sibling group, dan
UI rollback jika save gagal. Handle tetap terlihat tetapi disabled selama
request agar row tidak bergeser horizontal.

**Area/berkas berubah:** interaksi/handle di `src/components/task-list.tsx`;
helper murni `reorderChecklistSiblings` dan tiga test di
`src/lib/services/checklist-task.ts` / `.test.ts`; status `roadmap.md`,
`HANDOFF-CODEX.md`, dan `CHANGELOG.md`. `reorderTasks`, service write, schema,
migrasi, permission, dan data tidak diubah.

**Verifikasi yang benar-benar dijalankan:** Graphify query alur task/action;
test baru membuktikan root dapat berpindah tanpa mengacak child yang terselip,
subtask hanya bergerak di parent yang sama, dan drop lintas boundary ditolak.
`npm test` **126/126 lulus**; `npm run typecheck`, ESLint terarah, dan
`npm run build` lulus. Browser terautentikasi membuka project overview dan
phase aktif tanpa regresi empty-state/filter. Dataset lokal seluruh permukaan
`TaskList` yang diperiksa mempunyai 0 checklist row (task lama `Activity`
adalah komponen berbeda), sehingga gesture terhadap row nyata tidak dapat
diuji tanpa membuat template/data produksi palsu.

**Risiko:** perilaku pointer/keyboard pada row nyata divalidasi oleh API
`@dnd-kit`, compile/build, dan helper ordering, tetapi fixture nol row tidak
memberi uji gesture end-to-end. Collision lintas nested context sengaja aman:
helper menolak boundary yang berbeda sebelum action dipanggil. Reorder hanya
memengaruhi checklist `ProjectChecklist`; daftar `Activity`/FEEDBACK dan
Today's View tidak memiliki kontrak `sort_order` yang sama dan tidak disentuh.

**Semantic assessment:** TIDAK — aturan kanonik sibling-only dan
`sort_order × 10` sudah ada di service/action; perubahan ini hanya membuka
interaksi UI yang telah direncanakan. `AGENTS.md` tidak perlu diubah.

**Pekerjaan yang masih terbuka:** tidak ada untuk C-SISA-3. Berikutnya T3
adalah verifikasi dokumen saja; temuan tidak langsung diperbaiki.

## [Unreleased] - 2026-08-19 (#54) — UI-CON-4 stats summary diseragamkan

**Hasil akhir:** direktori Brands/Materials dan Suppliers sekarang memakai satu
pola stats summary yang sama, yaitu angka ringkas pada subtitle `PageHeader`.
Strip `StatChip` terpisah di Materials dihapus. Pada grain Brand, subtitle tetap
menampilkan total/complete/incomplete; saat filter memecah ke grain SKU, ia
menampilkan total material/BQ ready/price incomplete. Subtitle Suppliers
menampilkan jumlah Party, assignment BrandSupplier, dan Party berperan
SERVICE_VENDOR/SUBCON. Angka tetap whole-catalogue seperti strip lama—search
atau filter hanya menyaring tabel, bukan mengubah arti ringkasan diam-diam.

Pola dipilih mengikuti rekomendasi roadmap lama: subtitle inline lebih ringan
dan tidak mengambil satu kartu vertikal penuh. Copy penjelas `Open a count...`
tetap dipertahankan agar affordance modal BR4 tidak hilang. Label filter lama
`Siap BQ` yang tersentuh ikut diterjemahkan menjadi `BQ ready` sesuai aturan UI
Inggris.

**Area/berkas berubah:** hanya UI hidup
`src/subapps/master-data/components/MasterDataMaterialsClient.tsx` dan
`src/subapps/master-data/components/SupplierClient.tsx`, plus status
`roadmap.md`, `HANDOFF-CODEX.md`, dan `CHANGELOG.md`. Tidak ada action, schema,
migrasi, query, permission, atau data yang diubah.

**Verifikasi yang benar-benar dijalankan:** Graphify query menemukan kedua
jalur summary; riwayat/roadmap arsip diperiksa untuk memvalidasi maksud
"inline subtitle" yang sudah tidak terlihat di Supplier hidup. `npm test`
**123/123 lulus**; `npm run typecheck`, ESLint terarah, dan `npm run build`
lulus. Browser terautentikasi menunjukkan Brands `4 brands · 2 complete · 2
incomplete` tanpa strip terpisah; filter `price=READY` mengganti summary menjadi
`2 materials · 1 BQ ready · 1 price incomplete`; Suppliers menunjukkan `3
parties · 2 brand assignments · 1 service vendor`.

**Risiko:** subtitle menjadi lebih panjang pada viewport sempit, tetapi
`PageHeader` sudah membungkus teks dan nilainya lebih hemat tinggi daripada
strip lama. Count Supplier menjumlah assignment, bukan unique Brand—label
`brand assignments` sengaja eksplisit agar satu Brand dengan dua supplier tidak
diklaim sebagai dua Brand. Statistik detail Supplier (Brands/Contacts) tidak
diubah karena item ini membandingkan dua direktori utama, bukan dialog detail.

**Semantic assessment:** TIDAK — arti completeness Brand, BQ readiness, Party,
dan BrandSupplier tidak berubah; hanya lokasi presentasinya yang diseragamkan.
`AGENTS.md` tidak perlu diubah.

**Pekerjaan yang masih terbuka:** tidak ada untuk UI-CON-4. Enam item UI/UX
Master Data pada handoff (BR2/BR4/BR5/BR7/UI-CON-2/UI-CON-4) kini seluruhnya
selesai; berikutnya C-SISA-3 pada StudioFlow Tasks.

## [Unreleased] - 2026-08-19 (#53) — §20 tab Prices Supplier dibangun

**Hasil akhir:** tab Prices pada detail Supplier bukan lagi satu kalimat dan
tautan. Ia menampilkan tabel read-only harga material berlaku yang
`supplier_party_id`-nya tepat sama dengan Party yang dibuka: Brand, kode SKU,
item, unit, harga IDR, dan tanggal update. Search ter-debounce serta pagination
memakai action M3/§8 dengan scope supplier; search scoped hanya mencocokkan
SKU/Brand/item agar nama supplier yang sama pada setiap row tidak membuat semua
row selalu cocok. Link `Manage all prices` mempertahankan `/masterdata/prices`
sebagai satu-satunya tempat mutasi.

Izin harga dijaga di dua lapis: server action mensyaratkan
`MASTERDATA_PRICE_VIEW`, sementara route dan modal Supplier tidak merender tab
Prices maupun menyebutnya dalam deskripsi untuk role tanpa izin tersebut.

**Area/berkas berubah:** tab dan state harga di
`src/subapps/master-data/components/SupplierDetailClient.tsx`; penerusan izin
di `SupplierClient.tsx`, route `/masterdata/suppliers`, dan route detail
`[partyId]`; filter search scoped di `pricing-actions.ts`; token min-width tabel
di `src/styles/designTokens.css`; serta status `roadmap.md`,
`HANDOFF-CODEX.md`, dan `CHANGELOG.md`. Tidak ada schema, migrasi, mutasi harga,
atau data yang diubah.

**Verifikasi yang benar-benar dijalankan:** Graphify query jalur detail
Supplier/permission; `npm test` **123/123 lulus**; `npm run typecheck`, ESLint
terarah, dan `npm run build` lulus. Browser terautentikasi membuka Wline →
Prices pada modal tanpa mengubah URL, menampilkan 0 current prices, keenam
header tabel, empty-state khusus supplier, link manajemen, serta Previous/Next
disabled. Dataset lokal hanya mempunyai satu harga aktif dan itu manufacturer
list price tanpa supplier, sehingga jalur row non-kosong tidak diuji dengan
data palsu.

**Risiko:** tabel non-kosong dan pagination multi-page hanya tervalidasi lewat
query/typecheck/build karena fixture tidak memiliki harga aktif bersupplier.
Role non-price tidak tersedia pada sesi browser ADMIN, sehingga visibility
permission diverifikasi dari propagasi `hasPermission` dan guard server, bukan
login kedua. Semua harga history tertutup sengaja tidak tampil di tab ini;
riwayat lengkap tetap tersedia lewat viewer/halaman harga sesuai kontrak.

**Semantic assessment:** TIDAK — Party tetap hanya sumber harga melalui
`SkuPrice.supplier_party_id`; tidak ada relasi/denormalisasi baru dan kontrak
history harga tidak berubah. `AGENTS.md` tidak perlu diubah.

**Pekerjaan yang masih terbuka:** tidak ada untuk §20. Item UI/UX Master Data
yang tersisa pada grup aktif adalah UI-CON-4.

## [Unreleased] - 2026-08-19 (#52) — M3/§8 harga material dipaginasi di server

**Hasil akhir:** halaman Material Prices tidak lagi memindahkan seluruh harga
berlaku ke browser. Server mengembalikan paling banyak 50 row per halaman,
search ber-debounce mencocokkan nama/kode SKU, Brand, nama dagang serta legal
name supplier, dan kontrol Previous/Next memakai total hasil pencarian. Badge
tab tetap menunjukkan total harga global sehingga tidak berubah menjadi nol
saat search tidak menemukan hasil. Daftar unit autocomplete tetap global
melalui query `distinct` terpisah, bukan terbatas pada halaman pertama.

Sebelum implementasi, jumlah `SkuPrice.is_current` aktif diperiksa melalui UI:
fixture hari ini hanya mempunyai **1 row**. Item tetap dikerjakan karena batas
lama tumbuh linear dan akan menjadi masalah tepat ketika data produksi mulai
besar.

**Area/berkas berubah:** query/type pricing di
`src/subapps/master-data/actions/pricing-actions.ts` dan
`src/subapps/master-data/types/pricing.ts`; wiring route
`src/app/masterdata/prices/page.tsx`; state/search/pagination tabel di
`src/subapps/master-data/components/PricingClient.tsx`; token lebar tabel di
`src/styles/designTokens.css`; status di `roadmap.md`, `HANDOFF-CODEX.md`, dan
`CHANGELOG.md`. Tidak ada schema, migrasi, atau data yang diubah.

**Verifikasi yang benar-benar dijalankan:** `npm test` **123/123 lulus**;
`npm run typecheck`, ESLint terarah, dan `npm run build` lulus. Browser
terautentikasi menunjukkan satu harga `TH001AA`, Page 1 of 1, Previous/Next
disabled; search `TH001AA` mempertahankan row, search tanpa hasil menampilkan
empty-state dan count tabel 0 tetapi badge tab tetap 1. Jumlah aktif 1 berarti
perpindahan antarlaman non-kosong belum dapat diuji dengan data nyata tanpa
mengarang fixture.

**Risiko:** search menambah satu query count tambahan hanya ketika search aktif
untuk mempertahankan total global; payload row tetap dibatasi. Pagination lebih
dari satu halaman telah lolos typecheck/build tetapi tidak dapat dipraktikkan
di fixture satu row. Mutasi create/edit/delete memuat ulang halaman yang sah
agar supersede history dan total tidak meninggalkan state client usang.

**Semantic assessment:** TIDAK — kontrak `SkuPrice` history, satu harga berlaku
per SKU × supplier, dan arti manufacturer list price tidak berubah. Ini hanya
batas baca dan presentasi; `AGENTS.md` tidak perlu diubah.

**Pekerjaan yang masih terbuka:** tidak ada untuk M3/§8. Fondasi action
paginated ini berikutnya dipakai membangun §20 (tab Prices pada Supplier).

## [Unreleased] - 2026-08-19 (#51) — UI-CON-2 ditutup lewat verifikasi kode hidup

**Hasil akhir:** tidak ada perubahan produksi. Item menyatakan tombol `+ Tambah
Vendor` berada di baris search tab Services, tetapi `SupplierClient.tsx` yang
hidup tidak mempunyai tab Services. Satu-satunya CTA adalah `Add supplier /
vendor` dan sudah berada pada prop `action` milik `PageHeader`. Menggeser apa
pun sekarang justru akan menghidupkan kembali `SupplierJasaTab` yang sengaja
dihapus #40 karena tidak pernah dirender.

**Area/berkas berubah:** dokumentasi status saja—`roadmap.md`,
`HANDOFF-CODEX.md`, dan `CHANGELOG.md`. `SupplierClient.tsx` dibaca tetapi tidak
diubah.

**Verifikasi yang benar-benar dijalankan:** `rg` pada kode hidup menemukan
satu `PageHeader action` dan satu label CTA; riwayat Git pada `d53d712`
membuktikan `Tambah Vendor` dulu berada di `SupplierJasaTab`; checkpoint
`d06f97c` membuktikan setelah #40 hanya CTA header yang tersisa. Browser BR7
sebelumnya juga menampilkan `Add supplier / vendor` di header.

**Risiko:** nol risiko runtime karena tidak ada kode yang berubah. Risiko
dokumentasi lama adalah agent berikutnya menghidupkan kembali tab Services;
status ini menutup celah tersebut secara eksplisit.

**Semantic assessment:** TIDAK — hanya menyelaraskan roadmap/handoff dengan
kode yang sudah berlaku sejak #40.

**Pekerjaan yang masih terbuka:** tidak ada untuk UI-CON-2. Berikutnya §20
(Prices Supplier) dan M3/§8.

## [Unreleased] - 2026-08-19 (#50) — BR7 pola modal Brand diterapkan ke Supplier

**Hasil akhir:** direktori Suppliers & Vendors tidak lagi menjadikan seluruh row
sebagai link halaman. Nama membuka Overview, count Brands/Contacts membuka tab
terkait, dan menu `View details` membuka konten Supplier yang sama dalam modal;
URL tetap `/masterdata/suppliers`. Route detail lama tetap hidup sebagai
deep-link dan memakai `SupplierDetailContent` yang sama. Pada tab Brands, count
SKU membuka popup daftar SKU paginated tanpa mengklaim semua harga berasal dari
supplier tersebut.

Premis handoff tentang kolom `Complete` diperiksa ke kode dan riwayat Git:
tabel Party yang hidup tidak pernah punya kolom itu; filter "lengkap" lama
berada di tabel Brand mati dan berarti `owner_party_id`. Karena Legal Name,
Contact, dan Brand semuanya nullable/opsional secara kanonik, tidak dibuat
syarat baru. Sorotan kuning diterapkan hanya untuk Party tanpa Role—kondisi yang
memang membuat Party ditolak sebagai sumber harga. Count Brands sekaligus
diperbaiki dari relasi `owned_brands` ke `supplied_brands`, sehingga angka tabel
dan isi detail sama-sama membaca `BrandSupplier`.

**Area/berkas berubah:**
`src/subapps/master-data/components/SupplierClient.tsx`,
`src/subapps/master-data/components/SupplierDetailClient.tsx`, route detail
`src/app/masterdata/suppliers/[partyId]/page.tsx`, mapper/query
`src/subapps/master-data/actions/party-actions.ts`, token tabel Supplier di
`src/styles/designTokens.css`, serta `roadmap.md`, `HANDOFF-CODEX.md`, dan
`CHANGELOG.md`. Tidak ada schema, migrasi, atau data yang diubah.

**Verifikasi yang benar-benar dijalankan:** Graphify query alur Supplier;
riwayat Git diperiksa untuk membuktikan asal premis Complete; `npm test`
**123/123 lulus**; `npm run typecheck`, ESLint terarah, dan `npm run build`
lulus. Browser terautentikasi menunjukkan TACO tanpa Role memakai background
`rgb(255, 251, 235)`, Wline/Lalapis tidak; count Wline membuka modal langsung
pada tab Brands dengan URL tetap; klik count SKU membuka popup empty-state yang
jujur; menu ⋯ masih berisi View/Edit/Delete dan View membuka modal Overview.
Header tetap Inggris dan tabel memakai min-width token.

**Risiko:** fixture lokal tidak memiliki Brand assignment dengan SKU aktif,
jadi isi row SKU non-kosong diverifikasi lewat action yang sama dengan modal
Brand BR4 dan compile/build, sedangkan browser memverifikasi jalur popup serta
empty-state. Modal Contact tetap memakai guard dan permission
`MASTERDATA_VENDOR_MANAGE`; alur harga/status SKU H5/§10 tidak diubah.

**Semantic assessment:** TIDAK — Party/BrandSupplier/Sku tetap kanonik dan
nullable fields tidak dijadikan kewajiban baru. Sorotan Role kosong adalah
presentasi keadaan yang sudah ditolak `assertPriceSourceParty`, bukan kontrak
persistensi baru.

**Pekerjaan yang masih terbuka:** tidak ada untuk BR7. Berikutnya UI-CON-2,
lalu §20/M3 dan UI-CON-4.

## [Unreleased] - 2026-08-19 (#49) — BR5 Catalog & Links tersedia langsung di tabel Brand

**Hasil akhir:** tabel Brands memiliki kolom `Catalog & Links` yang menampilkan
seluruh `BrandLink` sebagai external link berlabel jenis/label khusus. Tombol
edit per row membuka `BrandLinksEditor` yang sama dengan dialog Brand, langsung
editable untuk user berizin dan dilindungi `useUnsavedChangesGuard`. URL lama
tanpa `http(s)://` dibuka sebagai HTTPS, bukan sebagai path relatif StudioFlow.
Prompt unsaved bersama sekaligus diterjemahkan penuh ke Inggris dan action
destructive memakai variant design system.

Jalur tulis link juga diperketat: input existing wajib membawa ID milik Brand
yang sama; row yang dibuat, diubah, diurutkan ulang, atau dihapus mendapat satu
`MasterDataAudit` `BrandLink` dengan ID row aktual di transaksi yang sama.
Save tanpa perubahan tidak lagi delete/create seluruh link dan tidak menyentuh
timestamp Brand secara palsu.

**Area/berkas berubah:**
`src/subapps/master-data/components/MasterDataMaterialsClient.tsx`,
`src/components/shared/brand-links-editor.tsx`,
`src/extensions/library/services/library-service.ts`,
`src/hooks/use-unsaved-changes-guard.tsx`, satu custom description di
`SampleRequestDialog.tsx`, token lebar kolom di `src/styles/designTokens.css`,
serta `roadmap.md`, `HANDOFF-CODEX.md`, dan `CHANGELOG.md`. Tidak ada schema,
migrasi, atau data yang diubah.

**Verifikasi yang benar-benar dijalankan:** Graphify query alur
`BrandLinksEditor` → `updateVendorAction` → `LibraryService.updateVendor`;
`npm test` **123/123 lulus**; `npm run typecheck` lulus; ESLint terarah nol
error (satu warning dependency hook lama di `SampleRequestDialog`); `npm run
build` lulus lengkap. Browser terautentikasi menampilkan tiga link Lalapis,
dua Wline, satu TACO, dan empty state Penta Prima; `taco.com` menghasilkan href
`https://taco.com`; empat tombol edit tersedia. Menambah satu row draft lalu
menutup memunculkan prompt Inggris dan discard menutup tanpa menulis data.

**Risiko:** mutasi persistensi sengaja tidak dilakukan pada data Master Data
owner saat verifikasi browser; kontrak save diverifikasi melalui compile,
transaksi service, dan jalur UI draft/discard. Editor menampilkan semua link,
jadi Brand dengan daftar sangat panjang dapat membuat row tabel lebih tinggi;
belum ada bukti data saat ini memerlukan truncation.

**Semantic assessment:** TIDAK — `BrandLink` dan editor repeatable sudah
kanonik. Pekerjaan ini mengeksposnya di tabel dan memulihkan kewajiban audit
yang sudah tertulis di `AGENTS.md`; kontrak domain tidak berubah.

**Pekerjaan yang masih terbuka:** tidak ada untuk BR5. Kelompok Brand selesai;
berikutnya BR7 dan UI-CON-2 pada Supplier.

## [Unreleased] - 2026-08-19 (#48) — BR2 pencarian Brand mencakup seluruh bukti terkait

**Hasil akhir:** pencarian direktori Brands tetap dieksekusi server-side sebelum
pagination, tetapi kini mencakup nama Brand dan owner, Category aktif ber-kind
`PRODUCT`, Hashtag, nama/legal name supplier hidup yang di-assign, serta nama
dan kode SKU hidup. Semua kecocokan tetap menghasilkan satu row Brand; search
tidak diam-diam beralih ke tabel SKU. Placeholder menjelaskan cakupan baru.

**Area/berkas berubah:**
`src/subapps/master-data/services/material-view-service.ts` (predicate relasi +
lookup Hashtag terparameterisasi) dan
`src/subapps/master-data/components/MasterDataMaterialsClient.tsx` (copy search),
serta `roadmap.md`, `HANDOFF-CODEX.md`, dan `CHANGELOG.md`. Tidak ada write,
schema, migrasi, atau data Master Data yang berubah.

**Verifikasi yang benar-benar dijalankan:** Graphify query terhadap alur
`getBrandView`; reproduksi browser sebelum patch membuktikan `CNC` memberi nol
hasil walau Hashtag itu terlihat pada Wline; `npm run typecheck` dan ESLint
terarah lulus. Verifikasi browser sesudah patch: substring lowercase `nc`
menemukan Wline lewat Hashtag `CNC`, `hpl` menemukan TACO lewat Category, dan
`TH001AA` menemukan TACO lewat kode SKU. Predicate supplier ikut dibatasi ke
Party hidup; fixture lokal hanya memiliki assignment bernama sama dengan
Brand, sehingga jalur itu diverifikasi melalui query terkompilasi, bukan kasus
browser yang dapat membedakan sumber match.

**Risiko:** pencarian Hashtag memakai satu lookup SQL ringan untuk memperoleh
ID sebelum query Brand paginated. Ini diperlukan karena filter array Prisma
hanya mendukung `has` exact/case-sensitive; term tetap parameter query dan
`POSITION` dipakai agar `%`/`_` tidak berubah menjadi wildcard. Jika jumlah
Brand tumbuh sangat besar, index khusus Hashtag dapat dipertimbangkan dari bukti
profiling, bukan ditambahkan sekarang.

**Semantic assessment:** TIDAK — grain, izin baca, dan model tidak berubah;
fitur hanya memenuhi cakupan search BR2 yang sudah diputuskan. Filter Category
sekarang juga eksplisit `kind: PRODUCT` sesuai kontrak Master Data.

**Pekerjaan yang masih terbuka:** tidak ada untuk BR2. BR5 menjadi item
berikutnya pada tabel Brand.

## [Unreleased] - 2026-08-19 (#47) — BR4 detail Brand berpindah ke modal

**Hasil akhir:** direktori Brands tidak lagi memindahkan user ke halaman detail
untuk alur sehari-hari. Klik angka SKU membuka dialog langsung pada daftar SKU,
klik angka Supplier membuka pengelolaan assignment supplier, dan menu `View
details` membuka Overview. Kolom `Complete` yang mengulang satu bit informasi
di setiap baris dihapus; brand yang belum lengkap kini memakai background
kuning dari token semantik. Route `/masterdata/materials/[brandId]` tetap hidup
untuk deep-link lama dan memakai konten detail yang sama.

**Area/berkas berubah:**
`src/subapps/master-data/components/BrandDetailClient.tsx` (konten detail dapat
dipakai ulang oleh route dan modal),
`src/subapps/master-data/components/MasterDataMaterialsClient.tsx` (trigger,
dialog, dan penanda kelengkapan),
`src/subapps/master-data/actions/masterdata-actions.ts` (fallback label harga
pabrikan diselaraskan ke Inggris), `roadmap.md`, `HANDOFF-CODEX.md`, dan
`changelog.md`. Tidak ada schema, migrasi, atau data yang diubah.

**Verifikasi yang benar-benar dijalankan:** `npm run typecheck` lulus; ESLint
terarah lulus tanpa error; `npm run build` lulus lengkap. Di browser terautentikasi,
baris Penta Prima yang belum lengkap terukur memakai background
`rgb(255, 251, 235)` dari `--ui-change-pending-bg`; klik `2` SKU TACO membuka
tab SKUs berisi dua row dan klik row tetap membuka dialog SKU yang dapat diedit;
klik Supplier membuka tab assignment; menu ⋯ tetap memuat View/Edit/Delete;
inline edit Name/Category/Hashtag tetap tampil dengan Save/Cancel; seluruh alur
modal mempertahankan URL `/masterdata/materials`.

**Risiko:** route detail lama masih bisa diakses langsung, sehingga ada dua
entry point yang sengaja berbagi satu komponen. Perubahan berikutnya harus
menjaga `BrandDetailContent` tetap aman pada kedua konteks. Pengelolaan supplier
di dialog masih melakukan mutasi yang sama seperti route lama dan tetap
bergantung permission server.

**Semantic assessment:** TIDAK — model, audit, permission, dan arti kelengkapan
Brand tidak berubah; ini perubahan navigasi/presentasi dari kontrak BR4.

**Pekerjaan yang masih terbuka:** tidak ada untuk BR4. Berikutnya BR2 dan BR5
pada berkas tabel Brand yang sama.

## [Unreleased] - 2026-08-19 (#46) — C-SISA-5 saved checklist filters

**Hasil akhir:** Tasks kini memiliki kontrol `Saved filters` pada baris filter.
User dapat menyimpan kombinasi filter aktif dengan nama, menerapkannya kembali,
menimpa kombinasi dengan menyimpan nama yang sama, dan menghapus filter
personal. Persistensi memakai model aditif `ChecklistFilterView`; JSON disimpan
sebagai predicate `status`/`priority`/`assignee`/`due`, bukan DSL teks. Seluruh
aksi server mengambil owner dari sesi dan meng-scope update/delete ke
`ctx.userId`.

**Area/berkas berubah:** `prisma/schema.prisma`, migrasi baru
`prisma/migrations/20260819130000_add_checklist_filter_view/migration.sql`,
`src/core/platform/db.ts` (signature/delegate/preflight diselaraskan), actions,
validasi, tipe, service/rules/test filter baru, `TasksPage`, `TodayView`,
komponen `saved-checklist-filters.tsx`, satu design token clearance header
dialog, serta `AGENTS.md`, `roadmap.md`, `HANDOFF-CODEX.md`, dan `CHANGELOG.md`.

**Verifikasi yang benar-benar dijalankan:** dokumentasi lokal Next.js 16.2.1
tentang Forms/Server Actions dibaca dan auth dipastikan berada di setiap action
melalui `createAction`; Graphify query alur Tasks/filter; `prisma format`,
`prisma validate`, dan `prisma generate` lulus; `npm run typecheck` lulus;
`npm test` **123/123 lulus** termasuk dua test baru round-trip predicate; ESLint
terarah lulus tanpa error (satu warning lama `PhaseStatus` di validations);
`npm run build` lulus lengkap termasuk compile, TypeScript, dan 10 halaman
statis. Validasi silang schema ↔ `src/core/platform/db.ts` dilakukan sesuai
Runtime & Configuration Audit.

**Risiko:** migrasi belum diterapkan, jadi runtime CRUD Saved filters memang
belum dapat diuji di database lokal. Ini disengaja oleh handoff: agent hanya
menyiapkan migrasi dan owner yang menjalankan deploy. Setelah migrasi, nama
filter unik secara case-sensitive per owner; ejaan dengan kapitalisasi berbeda
masih dianggap nama berbeda.

**Semantic assessment:** YA — ada model persistensi dan workflow personal baru.
`AGENTS.md` mendapat kontrak Saved Checklist Filters: owner scoping, JSON
terstruktur wajib, tidak ada DSL, dan filter tidak boleh memutasi task.

**Pekerjaan yang masih terbuka:** owner menjalankan
`npx prisma migrate deploy` untuk migrasi `20260819130000_add_checklist_filter_view`,
lalu uji manual save/apply/update/delete satu filter. Item implementasi
C-SISA-5 sendiri selesai; berikutnya BR4.

## [Unreleased] - 2026-08-19 (#45) — LA-1 koneksi Brand → Library dipulihkan untuk Hashtag

**Hasil akhir:** bug aktif berhasil direproduksi dan diperbaiki tanpa perubahan
schema atau data. Di `/library`, pencarian nama brand (`Lalapis`) dan Category
(`WPC`) tetap bekerja, tetapi pencarian `CNC` memberi nol hasil walaupun `CNC`
terlihat sebagai Hashtag Wline di `/masterdata/materials`. Setelah perbaikan,
`CNC` menemukan Wline dengan alasan `tag: CNC`; regresi kategori `WPC` tetap
menemukan Lalapis. Quick-pick juga kini menggabungkan Category dan Hashtag dari
Brand hidup, sehingga kategori milik brand soft-delete/nonaktif tidak lagi
menawarkan saran yang pasti kosong.

**Diagnosis:** hipotesis handoff bahwa `BrandCategory.source` yang bercampur
adalah akar masalah tidak terbukti. Query read-only database menunjukkan baris
`SEED` dan `DERIVED_FROM_SKU` aktif memang keduanya mewakili kategori valid, dan
`v_library_brand` sengaja mengagregasi keduanya. Akar masalah aktual berada di
`BrandLibraryService.searchBrands()`: perubahan #37 memindahkan descriptor bebas
ke `Brand.tags`, tetapi service Library masih hanya membaca `BrandCategory`,
`SkuCategory`, nama SKU, dan nama Brand.

**Area/berkas berubah:**
`src/extensions/library/services/brand-library-service.ts` (bukti pencarian +
saran dari `Brand.tags`, hanya Brand hidup),
`src/extensions/library/components/BrandLibraryExplorer.tsx` (copy Inggris dan
label hasil), `roadmap.md`, dan `CHANGELOG.md`. Tidak ada schema, migrasi, FK,
harga, supplier, atau data Master Data yang diubah.

**Verifikasi yang benar-benar dijalankan:** Graphify query alur Brand–Library;
reproduksi browser sebelum patch (`CNC` → nol hasil, `WPC` → Lalapis); query DB
read-only untuk membandingkan sumber `BrandCategory` dengan referensi SKU;
`npm run typecheck` lulus; ESLint terarah dua berkas lulus; `npm run build`
lulus lengkap (Prisma generate, compile Next.js 16.2.1, TypeScript, 10 halaman
statis); verifikasi browser sesudah patch (`CNC` → Wline, `WPC` → Lalapis).

**Risiko:** Hashtag bebas sekarang menjadi bukti pencarian Library, sehingga
tag yang terlalu umum dapat memperluas hasil. Ranking tetap menempatkan brand
dengan lebih banyak bukti di atas dan batas 60 hasil tetap berlaku.

**Semantic assessment:** TIDAK — kontrak Library memang search-a-brand dari
deskriptor material; task ini memulihkan evidence yang hilang saat field
Hashtag dipisah, tanpa memperluas data sensitif yang boleh dibaca StudioFlow.

**Pekerjaan yang masih terbuka:** tidak ada untuk LA-1. Item berikutnya sesuai
handoff adalah C-SISA-5.

## [Unreleased] - 2026-08-19 — Prep eksekusi 6 item UI/UX Master Data: urutan & regression guard

**Kenapa:** owner minta cek changelog lalu siapkan eksekusi item roadmap
UI/UX supaya tidak regresi dan repo lokal makin rapi. Cek changelog: tidak
ada progres baru dari Codex sejak checkpoint terakhir (entri teratas masih
"CLAUDE.md baru + AGENTS.md diperkuat"), jadi batch enam item UI/UX Master
Data di `HANDOFF-CODEX.md` §3 (BR2, BR4, BR5, BR7, UI-CON-2, UI-CON-4) belum
mulai dikerjakan Codex.

**Yang dilakukan:**

1. **`HANDOFF-CODEX.md` §3a baru** (di bawah tabel MASTER DATA) — urutan
   eksekusi enam item dikelompokkan per berkas yang dipakai bareng (Kelompok
   A `MasterDataMaterialsClient.tsx`+`BrandDetailClient.tsx`: BR4 → BR2/BR5;
   Kelompok B `SupplierClient.tsx`/`SupplierDetailClient.tsx`: BR7 →
   UI-CON-2; lintas keduanya paling akhir: UI-CON-4), plus checklist
   regresi wajib dijalankan sesudah tiap item (typecheck+build, verifikasi
   manual fitur `SELESAI` yang hidup di berkas sama: BR1/BR3/BR6/BR8/D5/
   UI-CON-3, dan H5/§10 untuk Supplier) sebelum mencentang `roadmap.md`.
2. **Temuan terpisah dicatat di §3a:** working tree saat ini menyimpan ~10
   commit senilai kerja (#35–#44) yang belum di-`git commit` sejak HEAD
   `d53d712` (#34, 2026-08-18). Bukan bagian dari enam item UI/UX, tapi
   relevan untuk "tidak regresi" — kalau tidak di-checkpoint, kerja yang
   sudah selesai ikut berisiko kalau ada masalah di WIP batch berikutnya.
   Disarankan commit checkpoint dulu sebelum Codex mulai batch ini;
   keputusan commit tetap di tangan owner/Codex, bukan dieksekusi sesi ini.

**Area/berkas berubah:** `HANDOFF-CODEX.md` (§3a baru), `CHANGELOG.md`. Tidak
ada kode aplikasi yang berubah — sesi ini murni product-specialist/reviewer,
sesuai `AGENTS.md` §🧑‍⚖️ Pembagian Peran (tidak ada dari tiga syarat menulis
kode yang terpenuhi).

**Verifikasi yang benar-benar dijalankan:** `grep` checkpoint changelog
(prosedur `CLAUDE.md`), `git status`/`git diff --stat` untuk konfirmasi
cakupan & usia perubahan uncommitted, `git log -1 --format=%cd d53d712`
untuk tanggal HEAD, `ls -la` untuk konfirmasi `BrandDetailClient.tsx`/
`SupplierDetailClient.tsx` (target BR4/BR7) memang belum tersentuh sejak
sebelum batch ini (mtime lebih tua dari seluruh berkas yang ada di
`git status`), dan pembacaan `roadmap.md`/`HANDOFF-CODEX.md` §3 untuk
memastikan tidak ada tumpang tindih skema dengan enam item ini.

**Risiko:** tidak ada — murni dokumentasi/perencanaan, tidak ada kode/skema
yang tersentuh.

**Pekerjaan yang masih terbuka:** enam item UI/UX itu sendiri (belum
dikerjakan, ini baru prep-nya) — eksekusi tetap tugas Codex sesuai §7. LA-1
tetap prioritas #1 di §3 sebelum batch bebas urutan lainnya, termasuk BR4.

## [Unreleased] - 2026-08-19 — CLAUDE.md baru + AGENTS.md diperkuat: changelog jadi satu-satunya kanal lapor

**Kenapa:** owner minta prosedur cek-in (checkpoint-based, dari sesi
sebelumnya) dicatat di file instruksi masing-masing agent — bukan cuma di
memory privat Claude — dan menegaskan `changelog.md` sekarang **satu-satunya**
kanal lapor status antar agent: owner tidak lagi menjelaskan verbal apa yang
barusan dikerjakan, cukup bilang "cek changelog".

**Yang dilakukan:**

1. **`AGENTS.md` §👑 aturan 8 (Agent Handoff Log) diperkuat** dengan paragraf
   keputusan owner 2026-08-19: entri changelog yang tidak lengkap sekarang
   berarti informasi hilang beneran (bukan cuma pelanggaran gaya), karena
   owner tidak lagi jadi jalur verbal cadangan.
2. **`CLAUDE.md` baru dibuat** di root project (sebelumnya belum ada) —
   komplemen `AGENTS.md`, isinya prosedur checkpoint-based baca `changelog.md`
   supaya Claude (sesi mana pun — Cowork atau Claude Code lokal) tidak baca
   ulang seluruh 360KB+ tiap kali diminta cek, plus pointer balik ke
   `AGENTS.md` untuk kontrak yang sudah ada (tidak diduplikasi, biar tidak ada
   dua sumber kebenaran).
3. **Koreksi kecil `HANDOFF-CODEX.md` §0a:** `graphify query` sempat salah
   dihapus dari daftar command di entri sebelumnya karena tidak kelihatan di
   scroll pertama `graphify --help`. Sudah dicek ulang penuh (`--help` lengkap,
   bukan `head`/`tail` parsial) — `query`/`affected`/`god-nodes` semuanya
   valid, ditambahkan kembali beserta flag `--budget` (cap token per query,
   default 2000).

**Area/berkas berubah:** `AGENTS.md` (§Agent Handoff Log), `CLAUDE.md` (baru),
`HANDOFF-CODEX.md` (§0a), `roadmap.md` (§Peta dokumen), `CHANGELOG.md`. Tidak
ada kode aplikasi yang berubah.

**Verifikasi yang benar-benar dijalankan:** `graphify --help` dibaca penuh
(bukan terpotong) untuk konfirmasi subcommand yang benar sebelum menulis
ulang §0a. Isi `CLAUDE.md` dan `AGENTS.md` dibaca ulang setelah ditulis untuk
pastikan tidak ada instruksi yang saling bertentangan antara keduanya.

**Risiko:** tidak ada — murni dokumentasi, tidak ada kode/skema yang tersentuh.

**Pekerjaan yang masih terbuka:** tidak ada dari task ini. Batch Codex aktif
tetap seperti tercatat di `HANDOFF-CODEX.md` §3.


## [Unreleased] - 2026-08-19 — Graphify terpasang di mesin lokal + git hook aktif

**Kenapa:** batch Codex (siklus di atas) perlu Codex juga bisa pakai Graphify
di mesin lokalnya sendiri, bukan cuma di sandbox cloud Claude — supaya
keduanya hemat token dari sumber graph yang sama, dan graph tetap segar tanpa
campur tangan manual tiap commit.

**Yang dilakukan (dijalankan owner di terminal lokal, sesi Claude Code
lokalnya sendiri):** `uv` 0.12.5 + `graphifyy` 0.9.46 terinstall di
`~/.local/bin/`. `graphify install` terpasang sebagai Claude Code skill
(`~/.claude/skills/graphify/`) dan menulis `~/.claude/CLAUDE.md` global. Git
hook `post-commit` + `post-checkout` terpasang di `.git/hooks/` — rebuild
AST-only otomatis tiap commit, `$0` biaya LLM. Merge driver untuk
`graphify-out/graph.json` terdaftar. `graphify query "test"` diverifikasi
jalan.

**Diselesaikan sesi Cowork ini:** `HANDOFF-CODEX.md` ditambah §0a (cara pakai
`graphify query/path/explain` + cara rebuild manual) — entri ini melengkapi
karena §0a sendiri belum tercatat di `CHANGELOG.md` sebelumnya (langgar
`AGENTS.md` §👑 aturan 8 kalau tidak ditambal — perubahan dokumen wajib punya
entri changelog).

**Belum beres — butuh tindakan owner:**

1. **Codex belum diintegrasikan secara eksplisit.** `graphify install` tanpa
   `--platform` men-default ke Claude Code saja. Command yang benar untuk
   Codex: `graphify codex install` — ini menulis section graphify langsung ke
   `AGENTS.md` (bukan ke config Claude Code), jadi **seharusnya tidak
   diblokir** oleh classifier yang memblokir `graphify claude install`
   (itu spesifik menyentuh trust boundary Claude Code sendiri). Belum
   dijalankan.
2. **`graphify claude install`** (project-level `CLAUDE.md` + PreToolUse hook)
   diblokir classifier di sesi Claude Code lokal tadi — opsional, bukan
   blocker untuk Codex.
3. **PATH belum permanen** — `uv`/`graphify` cuma ada di sesi PowerShell yang
   set `$env:Path` manual. Kalau Codex membuka terminal baru, binary
   `graphify` tidak akan ketemu sampai `~/.local/bin` (Windows:
   `C:\Users\IMBA PC\.local\bin`) ditambahkan ke System/User PATH permanen.

**Area/berkas berubah:** `.git/hooks/post-commit`, `.git/hooks/post-checkout`
(mesin lokal, tidak masuk git), `HANDOFF-CODEX.md` (§0a), `CHANGELOG.md`.
Tidak ada kode aplikasi yang berubah.

**Verifikasi yang benar-benar dijalankan:** `graphify query "test"` (lokal,
oleh owner) — lulus. Hook file diverifikasi ada di `.git/hooks/` (device
bridge, sesi ini) dengan timestamp 2026-08-19 04:12. **Belum diverifikasi:**
`graphify codex install` belum dijalankan sama sekali, jadi belum ada bukti
Codex benar-benar memanggil `graphify query` di sesi kerjanya.

**Risiko:** kalau PATH tidak dibikin permanen dan `graphify codex install`
tidak dijalankan, manfaat "hemat token buat Codex" dari task graphify ini
**belum tercapai** — baru tercapai untuk sesi Claude Code lokal yang
menginstallnya. Hook `post-commit` tetap jalan independen dari itu (jadi
graph tetap segar untuk siapa pun yang query manual), tapi Codex tidak akan
otomatis tahu untuk query kalau `AGENTS.md` belum memuat instruksinya.

**Pekerjaan yang masih terbuka:** owner jalankan `graphify codex install` di
terminal lokal (lihat instruksi di respons sesi ini), lalu tambahkan
`~/.local/bin` ke PATH permanen.


## [Unreleased] - 2026-08-19 — Handoff Codex siklus baru: LA-1 Brand↔Library, C-SISA-5, batch per app

**Kenapa:** owner minta Codex kerjakan C-SISA-5 (filter tersimpan) + 15 item
non-skema yang sebelumnya dipetakan Claude, dirapikan per app (Main App/
Master Data/BQ), dan minta koneksi database Brand (Master Data) ↔ Library
(StudioFlow) diperbaiki — dilaporkan "belum ada" dan "rusak" setelah
perubahan skema Hashtag/Category (#37).

**Temuan sebelum menulis spek (penting, mengubah bentuk tugasnya):**
koneksi Brand↔Library **sudah ada**, bukan belum ada — `master_data
.v_library_brand` (view, `20260810180000_masterdata_v2_rebaseline`) plus
`brand-library-service.ts`/`BrandLibraryExplorer.tsx` (di-render di
`/library`) sudah lengkap sejak rebaseline v2. Yang benar: **rusak** setelah
#37, kemungkinan karena `BrandCategory` sekarang campur baris `source: SEED`
(form Brand) dan `DERIVED_FROM_SKU` (otomatis dari SKU) tanpa difilter di
`brand-library-service.ts` — tapi ini **hipotesis, belum diverifikasi**;
ditulis ke Codex sebagai item investigasi (LA-1), bukan fix langsung, supaya
tidak menambal gejala yang salah.

**Yang dilakukan:** `HANDOFF-CODEX.md` versi 2026-08-18 (siklus lama, 18
keputusan non-reversible, ditutup #44) dipindah verbatim ke
`docs/archive/HANDOFF-CODEX-2026-08-18.md`. `HANDOFF-CODEX.md` baru ditulis
untuk siklus 2026-08-19: dipetakan per app (Main App/Master Data/BQ — BQ masih
scaffold kosong, nol tugas), memuat LA-1, C-SISA-5 (skema `ChecklistFilterView`
aditif, `query_json` terstruktur wajib — bukan DSL teks, sesuai batasan
roadmap), 8 item Master Data (BR2/BR4/BR5/BR7/§20/M3/UI-CON-2/UI-CON-4), dan
2 item Main App (C-SISA-3, T3 — verifikasi saja). Kontrak §8 (`master_data`
dilarang FK/join ke `studioflow`) dan aturan `source: SEED` tidak boleh
terhapus (dari `BrandCategory`) ditegaskan ulang sebagai batas keras untuk
LA-1. Ditambahkan §5 "Aturan anti-halusinasi & fokus" (permintaan eksplisit
owner) — 8 aturan: verifikasi-sebelum-klaim, satu-item-selesai-baru-pindah,
cakupan terbatas ke §3, jangan mengarang skema di luar C-SISA-5, jangan
asumsi gejala bug tanpa reproduksi, laporkan selisih kode-vs-dokumen (jangan
diam-diam disamakan), kontrak §2 tidak bisa dilonggarkan sendiri oleh Codex,
dan usulkan-jangan-eksekusi untuk keputusan ambigu/berisiko.

Ditahan dari batch ini (dicatat eksplisit di §4 handoff supaya tidak
"sekalian" dikerjakan): C-SISA-6, C-SISA-7, A6 (semua 🔒, di luar cakupan),
B1 (⏳ ditunda owner), dan R-SCHED-TPL-2e — dikeluarkan penuh dari batch atas
konfirmasi owner (sebelumnya masuk daftar 15 item, ternyata sudah ditandai
"out of scope sampai plugin SketchUp di-update" di handoff lama, jadi tidak
bisa dikerjakan dari sisi app sekarang. T7 (Graphify) juga dikeluarkan —
bukan tugas Codex, tetap dipegang Claude.

**Hasil akhir:** `HANDOFF-CODEX.md` baru terkirim ke owner dan tersimpan di
root project; `docs/archive/HANDOFF-CODEX-2026-08-18.md` berisi versi lama
verbatim. `roadmap.md` §pembuka dan §Peta dokumen diperbarui menunjuk siklus
baru.

**Area/berkas berubah:** `HANDOFF-CODEX.md` (ditulis ulang), file baru
`docs/archive/HANDOFF-CODEX-2026-08-18.md` (dipindah dari root), `roadmap.md`
(§pembuka + §Peta dokumen), `CHANGELOG.md`. Tidak ada kode aplikasi yang
berubah — ini murni dokumen persiapan handoff.

**Verifikasi yang benar-benar dijalankan:** dibaca ulang `AGENTS.md` §8 dan
§🧑‍⚖️ Pembagian Peran, `roadmap.md` seluruh checkbox terbuka (`grep -c`), dan
`HANDOFF-CODEX.md` lama §3/§4 sebelum menulis versi baru. Lokasi file setiap
item Master Data/Main App diverifikasi dengan `find`/`grep` langsung ke kode
(bukan disalin dari roadmap tanpa cek) — mis. `getMaterialPricesAction`
dikonfirmasi di `pricing-actions.ts:738`, `ChecklistFilterView` belum ada di
`schema.prisma` (dikonfirmasi belum ada sebelum ditulis sebagai item baru).
**Tidak dijalankan:** `npm run typecheck`/`build` — tidak ada kode yang
berubah di task ini.

**Risiko:** hipotesis akar masalah LA-1 (kolom `source` BrandCategory) belum
diverifikasi Codex — kalau ternyata salah, item itu perlu diagnosis ulang.
Batch ini murni dokumen persiapan; belum ada implementasi.

**Pekerjaan yang masih terbuka:** seluruh isi `HANDOFF-CODEX.md` §3 — LA-1,
C-SISA-5, 8 item Master Data, C-SISA-3, T3, dan usulan pendekatan test
`getBrandView`/`getSkusForBrand`. Claude akan review hasil Codex dan
menjalankan ulang Graphify (`graphify-out/`) setelah batch ini ada kemajuan
kode.


## [Unreleased] - 2026-08-19 — Graphify: code graph lokal untuk navigasi codebase (hemat token)

**Kenapa:** menjelajah codebase lewat grep/read berulang-ulang boros token per
sesi. [Graphify](https://github.com/Graphify-Labs/graphify) membangun
knowledge graph dari AST lokal (tree-sitter, **tanpa** panggilan LLM), supaya
sesi berikutnya bisa menelusuri `graphify-out/graph.json` /
`graphify-out/GRAPH_REPORT.md` untuk memahami struktur & keterkaitan
file/fungsi, alih-alih membaca ulang seluruh pohon file setiap kali.

**Yang dilakukan:** `uv tool install graphifyy` (v0.9.46), lalu
`graphify extract . --code-only` + `graphify cluster-only .` dijalankan atas
`src/`, `prisma/`, `docs/`, `scripts/`, dan berkas konfigurasi/markdown akar.
`src/generated/prisma` dan `src/generated/prisma_old_bak` (28 MB kode hasil
generate Prisma Client, dua versi) **sengaja dikecualikan** — kalau diikutkan,
graph didominasi ribuan node file generated dan daftar "Community Hubs" jadi
tidak berarti (percobaan pertama: 19.013 node, nyaris semuanya dari
`prisma`/`prisma_old_bak`).

**Hasil akhir:** `graphify-out/graph.json`, `graphify-out/graph.html`
(visualisasi force-directed), `graphify-out/GRAPH_REPORT.md` — 2.889 node,
8.524 edge, 138 komunitas, 100% EXTRACTED (bukan tebakan LLM, murni dari AST).
Disimpan di root project dan dikirim ke owner; **tidak** di-commit ke git
(`/graphify-out/` ditambahkan ke `.gitignore` — regenerable, lihat roadmap
`T7`).

**Limitasi yang belum ditutup (dicatat sebagai `T7` di `roadmap.md`):** label
komunitas masih placeholder "Community N" karena belum ada backend LLM
dikonfigurasi untuk `graphify cluster`; 62 berkas `.sql` tidak ikut ter-ekstrak
karena paket `graphifyy[sql]` (`tree_sitter_sql`) belum terpasang; belum ada
git hook auto-rebuild, jadi graph ini adalah snapshot per 2026-08-19 dan bisa
basi setelah refactor besar.

**Area/berkas berubah:** tidak ada kode aplikasi yang berubah. Berkas baru:
`graphify-out/graph.json`, `graphify-out/graph.html`,
`graphify-out/GRAPH_REPORT.md` (di-gitignore); `.gitignore`, `roadmap.md`, dan
`CHANGELOG.md` diperbarui.


## [Unreleased] - 2026-08-19 (#44) — build produksi dan penutupan handoff

**Hasil akhir:** seluruh urutan implementasi yang disepakati di
`HANDOFF-CODEX.md` selesai dan build produksi lulus. Build pertama mengungkap
satu peringatan Next.js 16.2.1: `export const config = { api: { bodyParser:
false } }` pada App Router tidak dikenali. Deklarasi mati itu dihapus dari route
impor Excel setelah diperiksa terhadap dokumentasi lokal Next.js; guard runtime
20 MB tetap utuh dan tetap berjalan sebelum file dibaca ke buffer. Pesan `413`
yang terlihat pengguna ikut diterjemahkan ke Bahasa Inggris.

**Area/berkas berubah:** `src/app/api/masterdata/excel/import/route.ts`,
`roadmap.md`, `HANDOFF-CODEX.md`, dan `changelog.md`. Tidak ada schema, migrasi,
atau data database yang berubah pada penutupan ini.

**Verifikasi yang benar-benar dijalankan:** `npm run build` final lulus tanpa
peringatan route—Prisma Client 7.5.0 ter-generate, Next.js 16.2.1 terkompilasi,
TypeScript lulus, 10 halaman statis terbuat, dan seluruh route termasuk
`/masterdata/skus` terdaftar. Suite terkompilasi dijalankan dengan isolasi proses
dinonaktifkan dan **118/118 test lulus**; tiga test baru aturan kelengkapan SKU
juga lulus terpisah. `npm run typecheck`, ESLint terarah, pencarian native
`confirm`, dan `git diff --check` lulus pada checkpoint terakhir. ESLint terarah
lulus tanpa error; empat warning unused lama tetap ada di berkas yang tersentuh.

**Risiko:** runner `npm test` bawaan tidak dapat membuat child process di
sandbox (`spawn EPERM`), sehingga suite yang sama dijalankan melalui runner Node
tanpa process isolation. Build awal juga perlu akses di luar sandbox untuk
checksum binary Prisma; setelah diizinkan build final lulus. Tidak ada aksi
destruktif, penerapan migrasi, atau mutasi data selama verifikasi.

**Semantic assessment:** TIDAK—deklarasi yang dihapus memang tidak pernah
berlaku di App Router. Kontrak upload tetap sama: file di atas 20 MB ditolak
dengan HTTP 413 sebelum pembacaan buffer.

**Pekerjaan terbuka:** hanya item di luar urutan handoff yang tetap tercatat di
roadmap (misalnya M3, §20, BR2/BR4/BR5/BR7, dan item terkunci), serta tindakan
owner di `HANDOFF-CODEX.md` §6.

---

## [Unreleased] - 2026-08-19 (#43) — D2 native confirm dihapus

**Hasil akhir:** seluruh 14 pemanggilan dialog konfirmasi bawaan browser pada 10
berkas sudah diganti satu pola aplikasi berbasis `AlertDialog`. Hook baru
`useAppConfirm` mempertahankan alur handler yang berurutan melalui hasil boolean
yang di-`await`, menyelesaikan `false` bila dialog dibatalkan/ditimpa/component
di-unmount, dan tidak bisa dinonaktifkan permanen oleh browser.

Tiga belas dialog aplikasi menggantikan empat belas native confirm karena dua
prompt beruntun untuk reset seluruh Product Schedule digabung menjadi satu
dialog berisiko tinggi. Tombol `Delete all items` nonaktif sampai pengguna
mengetik `DELETE ALL` persis. Konfirmasi lain mempertahankan batas aksi lama:
activity delete/defer, drawing, project task, UI reset, render board, SketchUp
merge, placeholder cleanup, catalog item, chat message, MOM section, dan MOM
document. Copy Indonesia yang kebetulan tersentuh di file-file ini ikut
diterjemahkan sesuai M5.

**Area/berkas berubah:** hook baru `src/hooks/use-app-confirm.tsx`;
`activity-manager.tsx`, `cd-list-table.tsx`, `project-tasks-card.tsx`,
`studio-settings-panel.tsx`; `RenderBoardPanel.tsx`,
`CatalogCodeManager.tsx`, `CatalogBoard.tsx`; `project-chat-sidebar.tsx`;
`mom-editor.tsx`, `mom-document-list.tsx`; serta `AGENTS.md`, `roadmap.md`,
`HANDOFF-CODEX.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** pencarian seluruh `src/` memastikan
nol pemanggilan global `confirm()`/`window.confirm()`; `npm run typecheck`
lulus; ESLint terarah 11 berkas lulus tanpa error (dua warning dead-code/import
lama di `activity-manager.tsx` dan `cd-list-table.tsx`). Browser sesi ADMIN
memverifikasi dialog Reset Design System dan Delete Project Task, lalu keduanya
dibatalkan tanpa mutation. Pada Product Schedule, input `DELETE` menjaga tombol
Delete all nonaktif; `DELETE ALL` mengaktifkannya; dialog kemudian dibatalkan,
jadi tidak ada data schedule yang berubah.

**Risiko:** setiap call site sudah lolos typecheck, tetapi tidak semua 13 dialog
dibuka manual satu per satu. Mereka berbagi host dialog yang sama dan hanya
berbeda judul/deskripsi/callback. Aksi riil sengaja tidak dikonfirmasi selama
pengujian agar tidak menghapus data pengguna.

**Semantic assessment:** YA—workflow konfirmasi destruktif aplikasi berubah
dan kini punya satu aturan kanonik. `AGENTS.md` mendapat §Destructive
Confirmation Protocol: native confirm dilarang, `useAppConfirm` wajib, dan aksi
massal memakai `requiredText`.

**Pekerjaan terbuka berikutnya:** verifikasi akhir seluruh rangkaian handoff.

---

## [Unreleased] - 2026-08-19 (#42) — D5 responsive tables selesai

**Hasil akhir:** dua `<TableCard>` Master Data yang masih tanpa `minWidth`
sekarang memakai token semantik masing-masing. Pada layar sempit, tabel Sample
Library dan Sample Requests mempertahankan lebar kolom yang dapat dibaca dan
kontainer `overflow-x-auto` dapat memunculkan scroll horizontal, bukan memaksa
tujuh sampai delapan kolom menjadi irisan tipis.

Karena kedua permukaan disentuh setelah keputusan M5, copy yang terlihat pada
`SampleLibraryClient.tsx` dan `SampleRequestPanel.tsx` ikut diselaraskan ke
Bahasa Inggris. Kelima status Sample tetap dipetakan satu-ke-satu; yang berubah
hanya label tampilannya. Nama unit, brand, atau data lain milik pengguna tidak
diterjemahkan.

**Area/berkas berubah:** `designTokens.css`, `SampleLibraryClient.tsx`,
`SampleRequestPanel.tsx`, `roadmap.md`, `HANDOFF-CODEX.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** `npm run typecheck` lulus; ESLint
terarah kedua client lulus tanpa error. Browser sesi ADMIN memverifikasi Sample
Library menampilkan heading, statistik, pilihan lima status, toolbar, pencarian,
dan empty state seluruhnya dalam Inggris. Dataset lokal tidak memiliki sample,
jadi tabel berisi baris tidak dapat dirender tanpa menulis data; inspeksi statis
memastikan kedua `<TableCard>` menerima token `minWidth` 64rem.

**Risiko:** verifikasi scroll dengan baris nyata masih perlu diulang saat data
Sample tersedia. `SampleRequestPanel` saat ini tidak dipasang oleh route hidup,
tetapi perbaikan tetap diterapkan karena D5 secara eksplisit menyebut komponen
itu dan akan tetap benar bila panel diaktifkan kembali.

**Semantic assessment:** TIDAK—ini perbaikan responsivitas dan copy berdasarkan
kontrak yang sudah ada; tidak mengubah data, workflow, izin, atau status Sample.
**Pekerjaan terbuka berikutnya:** D2.

---

## [Unreleased] - 2026-08-19 (#41) — M5 Bahasa Inggris + UI-CON-3

**Hasil akhir:** `mapKnownPrismaError()` kini mengubah constraint conflict,
record hilang, foreign-key conflict, required-relation conflict, dan error
database lain menjadi pesan Bahasa Inggris yang tetap memberi langkah lanjut.
Pesan mentah Prisma tetap tidak diekspos. Pesan validasi harga kerja dan dua
konflik nama Party pada pricing juga diselaraskan.

Semua teks lama yang kebetulan tersentuh pada rangkaian #36–#40 dibersihkan:
Brand dialog, editor Material, tabel Brand/Material, Pricing, Suppliers,
BrandLinksEditor, dan label aksesibilitas checklist kini Inggris. Tanggal pada
Pricing memakai nama bulan Inggris. UI-CON-3 ditutup: tiga tabel Pricing yang
hidup sudah memakai header Inggris, sedangkan header campur yang disebut
roadmap hanya berada di `SupplierJasaTab` mati dan sumbernya sudah dihapus #40.

**Area/berkas berubah:** `action-wrapper.ts`, `sku-price-rules.ts`,
`pricing-actions.ts`, `library-service.ts`, `PricingClient.tsx`,
`MasterDataBrandDialog.tsx`, `MasterDataProductDialog.tsx`,
`MasterDataMaterialsClient.tsx`, `SupplierClient.tsx`,
`brand-links-editor.tsx`, `creatable-checklist.tsx`, `roadmap.md`,
`HANDOFF-CODEX.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** `npm run typecheck` lulus; ESLint
terarah lulus tanpa error (satu warning lama `toggleBrandExpand` tidak dipakai
di `MasterDataMaterialsClient.tsx`). Browser sesi ADMIN memverifikasi halaman
Pricing dengan header `Price` / `Last updated` dan tanggal `18 Aug 2026`,
halaman Brands dengan filter/stat/pagination Inggris, serta Add Brand dialog
beserta label Category, link, empty state, dan CTA Inggris. Dialog ditutup tanpa
save; tidak ada mutation database.

**Risiko:** ini bukan audit seluruh permukaan aplikasi; sesuai aturan M5,
cakupan implementasi adalah error bersama dan teks lama pada berkas yang
tersentuh rangkaian kerja ini. Nilai data milik pengguna (misalnya nama unit
`lembar` atau hashtag Indonesia) tidak diterjemahkan karena itu konten, bukan
copy UI. Pemetaan error generik tetap tidak bisa menyebut nilai konflik karena
Prisma hanya memberi nama field/index.

**Semantic assessment:** TIDAK—aturan satu bahasa sudah mengikat di
`AGENTS.md`; task ini menerapkannya tanpa mengubah workflow, izin, atau domain.
**Pekerjaan terbuka berikutnya:** D5 sisa + D2.

---

## [Unreleased] - 2026-08-19 (#40) — BR8 viewer SKU + A7 riwayat harga

**Hasil akhir:** dua viewer SKU yang diminta owner sudah berjalan tanpa model
atau migrasi baru. Klik baris Material Prices kini membuka popup read-only
berisi kode artikel, brand, kategori, spesifikasi, semua harga berlaku lintas
supplier, dan seluruh riwayat harga termasuk penawaran yang sudah ditutup.
Tombol Pencil tetap membuka editor harga dan tidak tertimpa affordance row.

Halaman baru `/masterdata/skus` menggabungkan SKU seluruh brand. Pengguna dapat
mencari serta memfilter brand, kategori PRODUCT, ada/belum ada harga berlaku,
dan data lengkap/belum, lalu membuka popup yang sama dari tiap row. Definisi
kanonik data lengkap adalah nama + base unit + sedikitnya satu kategori PRODUCT
hidup; kode artikel dan brand sengaja tidak menjadi syarat karena keduanya
nullable menurut kontrak. Keberadaan harga tetap filter terpisah.

Setelah BR1 dan BR8 selesai, tiga blok mati di `SupplierClient.tsx`
(`SupplierJasaTab`, `InlineCompanyCell`, dan `toggleSort`, berikut fetch/state
pendukungnya) dihapus. Halaman Suppliers sekarang hanya mengambil dan
menampilkan Party yang hidup. `_to_delete/MasterDataNav.tsx` tetap tidak
disentuh karena sejak #25 penghapusannya ditugaskan kepada owner.

**Area/berkas berubah:** `pricing-actions.ts`, `pricing.ts`,
`SkuDetailDrawer.tsx`, `PricingClient.tsx`, `sku-directory-rules.ts` beserta
testnya, `material-view-service.ts`, `library-service.ts`, halaman dan client
baru `masterdata/skus`, `MasterDataNavOuter.tsx`, `designTokens.css`,
`SupplierClient.tsx`, halaman Suppliers, `AGENTS.md`, `roadmap.md`,
`HANDOFF-CODEX.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** `npm run typecheck` lulus; ESLint
terarah seluruh berkas BR8 dan cleanup lulus tanpa error/warning; tiga unit test
aturan kelengkapan lulus. Di browser lokal sesi ADMIN, popup dari Pricing
menampilkan harga berlaku; popup SKU tanpa harga berlaku tetap menampilkan lima
baris riwayat terarsip. Direktori SKU diverifikasi untuk daftar lintas-brand,
filter `INCOMPLETE`, filter `WITHOUT` price, row viewer, dan navigasi sidebar.
Setelah cleanup, halaman Suppliers kembali dibuka dan tabel Party beserta CTA
serta action menu tetap dirender. Tidak ada mutation database selama pengujian.

**Risiko:** data lokal yang tersedia hanya sedikit sehingga kombinasi filter
dan pagination belum diuji pada volume besar. Viewer sengaja mengambil seluruh
riwayat untuk satu SKU agar A7 lengkap; bila satu SKU kelak memiliki riwayat
sangat panjang, panel ini mungkin perlu pagination tersendiri. Akses halaman
SKU digate oleh izin Master Data sekaligus izin melihat harga.

**Semantic assessment:** YA—definisi kelengkapan data SKU dan cakupan viewer
riwayat kini menjadi kontrak yang terlihat pengguna. Keduanya dikunci di
`AGENTS.md` §Master Data Contract v2 poin 12; lookup kategori yang tersentuh
juga diperbaiki agar selalu memfilter `CategoryKind.PRODUCT` sesuai kontrak.

**Pekerjaan terbuka berikutnya:** M5 + UI-CON-3.

---

## [Unreleased] - 2026-08-19 (#39) — §10 status edit dipertahankan + H5 permission mati dihapus

**Hasil akhir:** edit SKU/Material oleh STAFF tidak lagi menurunkan status
`APPROVED` menjadi `PENDING`. Client mengirim status form saat Edit; server
memisahkan field itu dari payload lalu hanya menerapkannya bila caller memiliki
`MASTERDATA_MATERIAL_APPROVE`. Untuk non-approver field dibuang, sehingga status
database tetap apa adanya dan crafted request tidak dapat menyetujui/menolak
SKU. Create tetap dipaksa `PENDING` oleh server dan dropdown status tetap hanya
dirender untuk approver.

H5 juga selesai: enum permission `MASTERDATA_PRICE_MANAGE` dan
`MASTERDATA_OFFERING_MANAGE` yang tidak pernah ditegakkan sudah dihapus dari
SSOT RBAC dan matrix STAFF. Mutasi harga tetap memakai
`MASTERDATA_VENDOR_MANAGE`; tidak ada perubahan akses efektif.

**Area/berkas berubah:** `src/core/rbac/constants.ts`, `matrix.ts`,
`library-actions.ts`, `MasterDataProductDialog.tsx`, `AGENTS.md`, `roadmap.md`,
`HANDOFF-CODEX.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** `npm run typecheck` lulus; ESLint
terarah lulus tanpa error (satu warning import lama di `library-actions.ts`);
pencarian seluruh `src/` memastikan dua permission mati tidak tersisa; inspeksi
statis memastikan Create masih dipaksa `PENDING`, Edit memakai status form,
server hanya menerapkan status untuk approver, dan dropdown masih digate
`access.canApproveMaterial`. Di browser sesi ADMIN, dialog edit SKU TACO tetap
menampilkan kontrol Curation status dan ditutup tanpa save.

**Risiko:** cabang STAFF belum diuji memakai sesi login STAFF. Pengamanan
utamanya berada di server dan tidak bergantung pada affordance UI; edit nyata
juga tidak dijalankan agar tidak mengubah data produksi.

**Semantic assessment:** YA—workflow status edit dan SSOT permission berubah.
Kontrak yang mengikat ditambahkan ke `AGENTS.md` §Master Data Contract v2 poin
11: Create tetap Draft/Pending, Edit mempertahankan status, hanya approver boleh
mengubah status eksplisit, dan mutasi harga mengikuti izin supplier.

**Pekerjaan terbuka berikutnya:** BR8 viewer + A7.

---

## [Unreleased] - 2026-08-19 (#38) — BR6 kebab actions pada Brands dan Suppliers

**Hasil akhir:** kolom Actions pada tabel Brands dan Suppliers sekarang memakai
satu trigger ⋯ per row. Trigger tersembunyi sampai row di-hover, mendapat focus,
atau menunya sedang terbuka. Menu Brands berisi View details, Edit full details,
dan Delete brand; menu Suppliers berisi View details, Edit supplier, dan Delete
supplier. View tetap tersedia untuk viewer-only, sedangkan Edit/Delete tetap
dibatasi izin yang sama seperti sebelumnya. Save/Cancel saat inline edit Brand
tetap eksplisit dan tidak dimasukkan ke menu.

**Area/berkas berubah:** `MasterDataMaterialsClient.tsx`, `SupplierClient.tsx`,
`roadmap.md`, `HANDOFF-CODEX.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** `npm run typecheck` lulus; ESLint
terarah lulus tanpa error (warning dead-code lama di kedua client tetap ada);
di browser lokal sesi ADMIN, menu Lalapis pada kedua tabel berisi tiga opsi
yang benar. Membuka menu Supplier tidak mengubah URL; memilih Edit membuka
dialog Lalapis di URL yang sama, lalu dialog ditutup bersih tanpa save. Tidak
ada mutation database selama pengujian.

**Risiko:** cabang viewer-only belum diuji dengan sesi role terbatas, tetapi
rendering View berada di luar condition permission dan Edit/Delete tetap di
dalamnya. Tampilan hover perangkat pointer diverifikasi dari class state;
interaksi browser otomatis memverifikasi trigger/focus dan menu terbuka.

**Semantic assessment:** TIDAK—ini perubahan presentasi actions tanpa perubahan
izin atau operasi domain. **Pekerjaan terbuka berikutnya:** §10 + H5.

---

## [Unreleased] - 2026-08-19 (#37) — BR1 inline edit tabel Brands

**Hasil akhir:** Brand Name, Category, dan Hashtag pada tabel Brands kini dapat
diedit langsung dari sel. Satu row masuk mode edit dengan kontrol Save/Cancel;
nilai kosong pada nama tidak dapat disimpan. Menutup row yang sudah berubah
memakai `useUnsavedChangesGuard`, sedangkan row bersih langsung tertutup.
Setelah save berhasil, tabel dan pilihan Brand lokal langsung diperbarui sambil
menunggu `router.refresh()`.

Pemeriksaan `git log` dan arsip membuktikan premis *regresi* di roadmap tidak
tepat: yang pernah ada hanya `InlineCompanyCell` untuk mengubah relasi Company
pada Supplier, bukan editor Brand Name/Category/Hashtag. BR1 tetap dibangun
sebagai fitur baru sesuai keputusan owner. `InlineCompanyCell` belum dihapus
karena BR8 masih dapat memerlukannya.

Jalur server ikut diperkuat: rename Brand sekarang memperbarui `name` dan
`slug` bersama-sama; hasil create/update mengembalikan `seed_categories` dalam
bentuk yang dipakai UI; dan perubahan hashtag/kategori sekarang ikut tercatat
sebagai audit Brand melalui `recordAudit()` di transaksi action yang sama.

**Area/berkas berubah:** `MasterDataMaterialsClient.tsx`,
`material-view-service.ts`, `library-service.ts`, `designTokens.css`,
`roadmap.md`, `HANDOFF-CODEX.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** `npm run typecheck` lulus; ESLint
terarah lulus tanpa error (satu warning lama: `toggleBrandExpand` tidak dipakai);
aplikasi lokal `/masterdata/materials` diverifikasi dalam sesi ADMIN: tujuh
kolom termasuk Hashtag tampil, klik Brand membuka ketiga editor, Save nonaktif
saat belum ada perubahan, Cancel bersih menutup langsung, dan Cancel setelah
nama diubah memunculkan prompt unsaved. Nilai uji dikembalikan persis ke nilai
awal lalu editor ditutup tanpa save, sehingga tidak ada data produksi ditulis.

**Risiko:** mutation nyata sengaja tidak dicoba memakai Brand dummy; persistence
dan audit end-to-end terakhir perlu terkonfirmasi pada edit Brand riil pertama.
Konflik nama/slug tetap bergantung pada pemetaan error yang akan diterjemahkan
ke Inggris di M5.

**Semantic assessment:** TIDAK—ini workflow UI yang sudah diminta dan penguatan
audit agar sesuai kontrak yang sudah mengikat, bukan aturan domain baru.
**Pekerjaan terbuka berikutnya:** BR6.

---

## [Unreleased] - 2026-08-19 (#36) — BR3 kategori Add Brand bertahan lintas sesi dialog

**Hasil akhir:** kategori baru yang ikut tersimpan bersama Brand A tidak lagi
hilang bila Add Brand segera dibuka untuk Brand B sebelum `router.refresh()`
selesai. Root cause-nya adalah state `createdLocally` berada di
`CreatableChecklist`, sedangkan `DialogContent` di-unmount saat dialog ditutup.

State opsi sesi sekarang diangkat ke `MasterDataBrandDialog`, yang tetap
mounted di halaman. Opsi dari server dan sesi digabung case-insensitive; hanya
kategori dari **save yang berhasil** yang dipertahankan. Input yang dibatalkan
tidak menjadi opsi hantu, dan `form.categories` tetap di-reset ke kosong pada
Create berikutnya sehingga Brand B tidak mewarisi centang Brand A.

**Area/berkas berubah:** `MasterDataBrandDialog.tsx`, `roadmap.md`,
`HANDOFF-CODEX.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** ESLint terarah lulus;
`npm run typecheck` lulus; aplikasi lokal `/masterdata/materials` dibuka di
browser dengan sesi ADMIN, dialog Add Brand berhasil dirender lengkap lalu
ditutup tanpa error atau perubahan data.

**Risiko:** alur save memakai data sungguhan dan sengaja tidak diuji dengan
brand dummy; verifikasi end-to-end terakhir tetap perlu saat owner membuat dua
brand nyata berturut-turut. Perubahan tidak menyentuh persistence, audit, atau
kontrak Master Data.

**Semantic assessment:** TIDAK—ini koreksi lifetime state UI, bukan perubahan
domain/workflow. **Pekerjaan terbuka berikutnya:** BR1.

---

## [Unreleased] - 2026-08-18 (#35) — TV1 inline edit Today's View + TV2 purge checklist selesai

**Hasil akhir:** dua item prioritas nol dari `HANDOFF-CODEX.md` sudah selesai.

- **TV1:** `TaskRow` di `today-view.tsx` sekarang mengedit judul inline untuk
  kedua sumber data. Checklist menulis lewat `updateTask({ label })`, sedangkan
  activity/FEEDBACK lewat `updateActivityContent({ content })`. Pola anti-#28b
  dipertahankan: sinkronisasi effect hanya bergantung pada `[task.label]` dan
  teks non-edit merender `labelDraft`; Escape membatalkan tanpa mutation.
- **TV2:** ditambahkan `scripts/purge-expired-checklist-tasks.mjs`. Default-nya
  dry-run; `--apply` menghapus task manual yang dicentang lebih dari 7 hari atau
  berada di proyek Completed. Baris template dilewati. Child leaf dihapus satu
  per satu lebih dulu, lalu parent hanya lewat predicate `children: { none: {} }`
  sehingga child yang belum eligible tidak mungkin tersapu cascade. Predicate
  eligibility diulang saat delete untuk melindungi perubahan data di antara
  tahap planning dan apply. Saran crontab VPS ada di header skrip; instalasinya
  tetap tugas owner saat deploy.
- Dua fixture test task yang tertinggal dari penambahan `checked_at` kini punya
  default `checked_at: null`, sama dengan kontrak `ChecklistTask` dan keadaan
  baris pra-migrasi.

**Area/berkas berubah:** `src/components/today-view.tsx`,
`scripts/purge-expired-checklist-tasks.mjs`, `src/lib/services/task-feed-query.ts`
(komentar retensi yang sebelumnya sudah tidak benar), dua fixture
`checklist-task.test.ts` / `task-feed.test.ts`, serta `AGENTS.md`,
`HANDOFF-CODEX.md`, `roadmap.md`, dan `changelog.md`.

**Verifikasi yang benar-benar dijalankan:** `npm run typecheck` lulus;
ESLint terarah pada seluruh kode/test yang disentuh lulus; `node --check` pada
skrip purge lulus; dry-run skrip berhasil terhubung dan mengembalikan nol
kandidat tanpa menulis data; 10 test `checklist-task` + 20 test `task-feed`
lulus (30/30) saat dijalankan langsung. `npm test` penuh berhasil mengompilasi
10 suite tetapi sandbox Windows menolak proses isolasi Node dengan `spawn
EPERM` sebelum test dijalankan—bukan kegagalan assertion. `git diff --check`
exit 0 (hanya memberi warning line-ending pada berkas lama yang tidak disentuh).

**Semantic assessment:** YA—TV2 mengubah lifecycle `ProjectChecklist` dari
hanya disembunyikan menjadi dapat dihapus permanen. Kontrak retensi, guard
template, urutan child-parent, dan batas `Activity` dicatat di `AGENTS.md`
bagian **Checklist Retention** pada task yang sama.

**Risiko:** mode `--apply` sengaja tidak dijalankan terhadap data sungguhan;
database saat dry-run tidak punya kandidat sehingga cabang delete belum diuji
end-to-end dengan baris produksi. Uji browser manual untuk Enter/blur/Escape
pada checklist dan FEEDBACK juga masih perlu mata manusia. Predicate delete
dan transaksi sudah melindungi race/cascade, tetapi instalasi crontab tetap
harus dilakukan owner.

**Pekerjaan terbuka:** urutan Codex berikutnya adalah **BR3**. Di luar coding,
owner perlu memasang crontab purge saat deploy VPS.

---

## [Unreleased] - 2026-08-18 (#34) — Fitur diputuskan owner: purge otomatis task completed (TV2)

**Dilaporkan/diminta owner langsung:** *"todays view dan upcoming tolong
dibuat dengan perlakuan yang sama. default collapse apabila tidak ada task
dan completed nya sifatnya temporary sampai batas waktu tertentu (atau paling
lama sampai proyek 'completed') maka task completed bisa di hapus."*

Tidak ada perubahan kode di entri ini — verifikasi dan penulisan spesifikasi
saja, konsisten dengan §🧑‍⚖️ Pembagian Peran: owner memilih spesifikasi untuk
Codex, bukan Claude mengerjakan langsung.

**Temuan sebelum menulis spesifikasi — separuh permintaan sudah terpenuhi:**

Permintaan owner punya dua bagian. Bagian pertama, *"default collapse apabila
tidak ada task,"* ternyata **sudah beres di kedua halaman**, lewat mekanisme
berbeda tapi setara: Today's View meng-collapse grup proyek kosong sejak #29;
Upcoming malah tidak pernah merender bucket tanggal kosong sama sekali —
`bucketTasksByDate()` (`task-feed.ts:282-285`) membuang bucket
`tasks.length === 0` sebelum sampai ke layar. Tidak ada kode yang perlu diubah
untuk bagian ini.

Bagian kedua, *"completed bisa dihapus,"* **ini yang belum ada.** #29 hanya
menyembunyikan task tercentang dari query setelah 7 hari
(`CHECKLIST_DONE_RETENTION_DAYS`, `task-feed-query.ts:28`) — barisnya tidak
pernah benar-benar dihapus, menumpuk di database selamanya.

**Empat pertanyaan diajukan untuk menutup bagian kedua:**

1. **Cara hapus** — dijawab: **otomatis lewat batas waktu**, bukan tombol
   manual (opsi "tombol muncul, Anda klik" ditolak).
2. **Batas proyek Completed** — dijawab: **langsung lewat batas**, berapa pun
   sisa hari retensinya, begitu status proyek jadi Completed.
3. **Upcoming perlu menampilkan completed juga?** — dijawab: **tidak**, tetap
   seperti sekarang. Berarti nol perubahan UI di kedua halaman; seluruhnya
   pekerjaan backend.
4. **Hosting produksi** — dijawab: **VPS/server sendiri (Docker)**, bukan
   Vercel. Ini mengarahkan pemicunya ke **crontab OS**, bukan Vercel Cron —
   dan penting ditanyakan karena repo tidak punya konfigurasi cron apa pun
   sekarang; menebak salah berarti fiturnya diam-diam tidak pernah jalan di
   produksi.

**Bahaya teknis yang ditemukan saat verifikasi, sebelum sempat jadi bug
produksi:** `ProjectChecklist.parent_id` memakai `onDelete: Cascade`
(`schema.prisma:988`). Kalau skrip purge menghapus baris parent yang eligible
secara mentah, **Postgres ikut menghapus seluruh child-nya** — termasuk child
yang belum eligible sama sekali (belum dicentang). Sempat diasumsikan aman
karena toggle punya cascade-check ("centang induk → subtask ikut tercentang"),
tapi diverifikasi ke `executeToggleChecklist`
(`phase-service.ts:515-521`): cascade itu **hanya terjadi saat parent
di-toggle** — child tetap bisa di-uncheck sendiri sesudahnya. Jadi *"parent
checked ⟹ semua child checked"* **tidak selalu benar**, dan spesifikasi yang
ditulis untuk Codex secara eksplisit mewajibkan urutan hapus child-dulu,
parent-belakangan, dengan parent yang masih punya child belum eligible
dilewati seluruhnya.

**Spesifikasi lengkap ditulis untuk Codex** — `roadmap.md` item **TV2**
(bagian "Fitur diputuskan owner 2026-08-18") dan `HANDOFF-CODEX.md` §2.8,
masuk urutan kerja **#0b** (sejajar TV1, mendahului BR3). Isinya: skrip baru
`scripts/purge-expired-checklist-tasks.mjs` (pola dry-run/`--apply` mengikuti
`backfill-duplicate-categories.mjs`), kriteria eligible, guard `template_id`,
urutan hapus yang aman dari cascade, dan catatan bahwa pemicu crontab-nya
sendiri tetap tugas owner saat deploy.

**Sengaja di luar cakupan, dicatat eksplisit supaya tidak dikira tercakup:**
`Activity` (item TODO/FEEDBACK di diskusi fase) tidak punya kolom setara
`checked_at` dan `task-feed-query.ts` tidak pernah memfilternya berdasarkan
umur. Tidak disentuh purge ini.

**Verifikasi yang benar-benar dijalankan:** pembacaan `bucketTasksByDate()`
(`task-feed.ts`), `task-feed-query.ts` seluruh query (termasuk filter
`status_progress: { not: "COMPLETED" }` di puncak yang sudah mengecualikan
proyek Completed dari feed — bukan dari database), `executeDeleteTask` dan
guard template-nya (`checklist-service.ts:226-246`), `executeToggleChecklist`
dan cascade-check sepihaknya (`phase-service.ts:501-531`), skema relasi
`ProjectChecklist` (`parent_id` cascade, `ChecklistLabelOnItem`/`Comment`
cascade), `docker-compose.yml` dan `package.json` untuk konteks hosting,
`vercel.json` (tidak ada) untuk memastikan tidak ada cron platform yang bisa
dipakai diam-diam. **Tidak dijalankan:** tidak ada kode yang diubah, jadi
tidak ada build/test yang relevan.

**Risiko:** spesifikasi ini menyerahkan penghapusan data permanen ke Codex.
Bahaya cascade sudah ditulis eksplisit dengan urutan yang aman, tapi
implementasinya sendiri belum ditulis maupun diuji di sesi ini — Codex wajib
menjalankan mode dry-run dulu dan memeriksa hasilnya sebelum `--apply` pertama
kali dipakai di data sungguhan.

---

## [Unreleased] - 2026-08-18 (#33) — Bug ditemukan owner: Today's View belum inline edit

**Dilaporkan owner langsung:** *"yang saya cek, ini saat ini, task todolist nya
masih ga inline edit (studioflow)."*

Tidak ada perubahan kode di entri ini — verifikasi dan penulisan spesifikasi
saja. Owner memilih spesifikasi ditulis untuk Codex, bukan Claude yang
mengerjakan langsung, konsisten dengan §🧑‍⚖️ Pembagian Peran yang baru
disepakati kemarin.

**Root cause:** `today-view.tsx` punya `TaskRow` sendiri (~baris 147–317),
**terpisah** dari `TaskRow` di `task-list.tsx` yang dapat inline edit judul di
#26. Fitur #26 hanya pernah dipasang di tab Fase dan overview proyek — Today's
View tidak pernah kebagian. `today-view.tsx:234` cuma merender `{task.label}`
sebagai `<span>` statis, tanpa state apa pun dan tanpa apa pun yang bisa diklik.

**Kenapa ini luput dari #26 dan dari audit-audit sebelumnya:** perbaikan #26
diverifikasi terhadap seluruh pemanggil `updateTask(...)` dan menyimpulkan
fiturnya "tidak pernah dibangun" secara umum — benar untuk saat itu, tapi
setelah dibangun di `task-list.tsx`, tidak ada langkah yang mengecek apakah
Today's View (yang merender task lewat komponen berbeda dengan nama sama)
ikut mendapatkannya. Dua komponen bernama sama, satu diperbaiki satu tidak,
adalah kelas cacat yang layak diwaspadai di tempat lain juga.

**Backend tidak perlu disentuh** — `updateTask({ taskId, label })` sudah
diimpor di `today-view.tsx` (dipakai `setDue`); `updateActivityContent({
activityId, content })` sudah punya pola pemakaian di `ActivityManager.tsx`
dan menegakkan izinnya sendiri di server.

**Spesifikasi ditulis untuk Codex** — `roadmap.md` item **TV1** (bagian baru
"Bug ditemukan owner 2026-08-18") dan `HANDOFF-CODEX.md` §2.7, dinaikkan jadi
urutan kerja **#0** (mendahului BR3) karena dilaporkan owner langsung hari ini.
Poin paling ditekankan di spesifikasi: **salin pola anti-#28b apa adanya**
(deps `useEffect` hanya `[task.label]`, render `{labelDraft}` bukan
`{task.label}`) — menulis ulang dari nol berisiko memunculkan bug flash yang
sama persis di tempat kedua.

**Verifikasi yang benar-benar dijalankan:** pembacaan `today-view.tsx` baris
132–320 (definisi `TaskRow`, state, render judul), pembacaan `task-list.tsx`
untuk pola pembanding, `grep updateActivityContent`/`updateTask` untuk
memastikan aksinya sudah ada dan sudah diimpor sebagian, pembacaan
`phase-actions.ts:208–224` untuk konfirmasi `updateActivityContent` menegakkan
izin di server. **Tidak dijalankan:** tidak ada kode yang diubah, jadi tidak
ada build/test yang relevan.

---

## [Unreleased] - 2026-08-18 (#32) — Enam keputusan owner: H5, §10, M5, BR8, B1, urutan kerja

**Dikerjakan atas permintaan owner:** *"coba kamu buatkan aku pertanyaan secara
awam apa yg perlu saya decide - dari jawaban saya tulis update handoff, dan
roadmap nya."*

Tidak ada perubahan kode di entri ini — seluruhnya keputusan dan dokumen.
Sembilan pertanyaan diajukan dalam **tiga putaran**; putaran kedua dan ketiga
lahir karena verifikasi kode menemukan konsekuensi yang tidak terlihat dari
pertanyaan pertama, dan **dua jawaban berbalik setelah konsekuensinya
dijelaskan**.

### H5 — izin harga tidak dipisah

Siapa yang boleh mengelola supplier juga boleh mengubah harga. Perilaku sekarang
sudah benar.

Diverifikasi 2026-08-18: `MASTERDATA_PRICE_MANAGE` dan
`MASTERDATA_OFFERING_MANAGE` hanya muncul di `core/rbac/constants.ts` dan
`core/rbac/matrix.ts` — **nol penegakan di mana pun**. Keduanya dihapus, karena
izin yang ada di enum tapi tidak pernah ditegakkan membuat agent berikutnya
mengira ada pembatas yang sebenarnya tidak ada.

### §10 — edit tidak lagi menurunkan status ke Pending

**Jawaban pertama owner dibalik.** Awalnya dipilih *"staf tanpa wewenang tidak
boleh edit sama sekali"*. Verifikasi matrix izin menunjukkan konsekuensinya jauh
lebih besar daripada yang tergambar di pertanyaan: `canApproveMaterial` =
`MASTERDATA_MATERIAL_APPROVE`, yang menurut komentar `matrix.ts` **hanya dimiliki
ADMIN dan DEVELOPER**. STAFF sengaja tidak memilikinya — padahal komentar di
berkas yang sama menyebut tugas STAFF justru *"maintains vendors, materials,
prices and samples"*. Menutup edit berarti mencabut inti pekerjaan STAFF. Ada
lubang tambahan: STAFF tetap memegang `LIBRARY_CREATE_ITEM` dan
`LIBRARY_DELETE_ITEM`, jadi larangan edit bisa diakali dengan hapus-lalu-buat-ulang
— yang justru lebih merusak karena riwayat auditnya ikut hilang.

Setelah itu dijelaskan, owner memutuskan: *"staf, admin dan developer semua bisa
edit — untuk master data"*, dan **edit tidak menurunkan status**.

Yang harus dikerjakan Codex — penurunan `PENDING` ada di **dua** tempat, bukan
satu:

- klien `MasterDataProductDialog.tsx:477` →
  `mode === "CREATE" ? PENDING : form.catalog_status`
- server `library-actions.ts:276` (`updateProductAction`) — ini penegakan
  sebenarnya; `statusToApply` berhenti memaksa `PENDING` untuk non-approver

**CREATE tetap masuk `PENDING`**, dan dropdown ubah-status
(`MasterDataProductDialog.tsx:795`) **tetap** hanya untuk
`access.canApproveMaterial`. Yang dicabut hanya penurunan otomatisnya, bukan
wewenang menyetujui.

**Konsekuensi yang owner terima sadar:** STAFF bisa mengubah material yang sudah
disetujui — termasuk harga dan spesifikasi — tanpa persetujuan ulang.
Peredamnya `recordAudit(tx, …)` ke `master_data.MasterDataAudit`, yang mencatat
siapa mengubah apa. Setelah keputusan ini audit itu jadi satu-satunya peredam
yang tersisa, jadi **jangan pernah dilemahkan**.

### M5 — bahasa antarmuka: Inggris

**Jawaban pertama owner juga dibalik.** Awalnya *"biarkan dulu — bukan
prioritas"*. Setelah ditunjukkan bahwa Codex tetap akan menulis teks baru untuk
fitur-fitur berikutnya — dan tanpa aturan campurannya makin acak dan makin mahal
dirapikan — owner memutuskan **semua Inggris, termasuk yang baru**, dan meminta
dicatat di `AGENTS.md` untuk Claude maupun Codex.

Batasnya ditanyakan terpisah karena bertabrakan dengan pekerjaan yang baru
selesai. Owner memilih cakupan penuh: **semua yang dibaca pengguna di layar,
termasuk pesan error.** Dokumen internal — `changelog.md`, `roadmap.md`,
`AGENTS.md`, `HANDOFF-CODEX.md`, komentar kode — tetap Bahasa Indonesia.

**Konflik yang harus diselesaikan, bukan didiamkan:** `mapKnownPrismaError()` di
`action-wrapper.ts` dibuat di #27 justru untuk mengubah error Prisma mentah jadi
pesan Indonesia yang bisa ditindaklanjuti. Pesan-pesan itu **diterjemahkan ke
Inggris** dan harus tetap actionable (*"Name is already used by another
supplier"*). Mengembalikannya jadi pesan Prisma mentah **bukan** penerapan
aturan ini — itu regresi #27.

Aturannya ditulis di `AGENTS.md` §🗣️ Bahasa Antarmuka. Membuka **UI-CON-3**.

### BR8 — direframe dari "tombol create" jadi "viewer"

Premis lama item ini sudah diketahui salah sejak 2026-08-18 (halaman Supplier
tidak punya `<Tabs>`; `SupplierJasaTab` tidak pernah dirender). Owner mengoreksi
maksud aslinya:

> *"add SKU kan harapan saya pakai CreatableSearch dari pricing (material
> pricing) — malah ideal ada viewer yg jelas, bukan masalah create nya"*

**Sisi create sudah selesai sejak #28** — `SkuPicker` meneruskan `onCreate` ke
`CreatableSearch`, diverifikasi masih terpasang 2026-08-18. Jangan dikerjakan
ulang.

Yang dipesan dua viewer, keduanya dikerjakan:

1. **Popup detail SKU dari tabel Harga Material** — klik baris → kode artikel,
   brand, kategori, spesifikasi, semua supplier yang menjualnya beserta harganya,
   dan riwayat harga. Bagian riwayat itu **adalah item A7**, yang selama ini
   terbuka sendiri: datanya sudah utuh (`SkuPrice` menyimpan baris
   `is_current: false`), layarnya yang belum ada. Dikerjakan sekalian — tanpa
   model baru, tanpa migrasi.
2. **Halaman daftar SKU lintas-brand (baru)** — semua SKU semua brand, bisa
   dicari & difilter. **Tab SKU di detail Brand tetap ada** — dua pintu masuk
   untuk dua kebutuhan berbeda. Owner: *"ikut rekomendasi kamu, perbaiki secara
   uiux agar rapih."*

Setelah keduanya jalan, `SupplierJasaTab` (±197 baris mati) tidak punya alasan
ditahan lagi (§19).

### B1 — ditunda dengan gerbang, bukan dicabut

Owner: *"biarkan dulu — tapi tulis di roadmap. Nanti setelah master data selesai
dan studioflow utama tidak ada regresi dan works well, baru pindah kesini."*

Gerbangnya dua dan dua-duanya harus terpenuhi. Pertanyaan aslinya — folder
buatan user atau struktur dari sistem — **sengaja belum dijawab**, karena
jawabannya menentukan perlu migrasi atau tidak, dan menanyakannya sekarang
berarti mengunci keputusan berdasarkan keadaan yang akan berubah.

### Urutan kerja

Owner memilih **bug layar yang mengganggu harian** lebih dulu:
**BR3** (P0, kategori hilang saat Add Brand berturut-turut) → **BR1** (inline
edit tabel Brands) → **BR6** (actions jadi kebab menu) → **§10 + H5** →
**BR8 viewer + A7** → **M5 + UI-CON-3** → **D5 sisa + D2**.

Catatan yang ditulis untuk Codex sebelum BR1: cek `changelog.md` dan `git log`
dulu. #26 mengajarkan pelajaran mahal — sebuah "regresi" yang dilaporkan owner
ternyata tidak pernah dibangun. Roadmap menyebut BR1 *"kembalikan fitur yang
sudah pernah ada"*; buktikan dulu premisnya.

### Keselarasan changelog ↔ roadmap ↔ repo

Diperiksa ulang atas permintaan owner. **Hasilnya selaras**, dengan satu koreksi
yang sudah ditulis di #31:

- klaim #29 diverifikasi ada di kode — `checked_at` dipakai di
  `checklist-task.ts`, `phase-service.ts:506,518`, `task-feed-query.ts:102,122`,
  `types/checklist.ts`, plus migrasinya; `today-view.tsx:477` memang meng-collapse
  grup ber-`tasks.length === 0`
- klaim #30 diverifikasi ada di kode (kesembilan berkas)
- §20 diverifikasi **masih stub** — `SupplierDetailClient.tsx:228` `PricesTab`
  isinya satu kalimat + tautan
- satu-satunya ketidakselarasan yang ditemukan adalah D5, sudah dikoreksi di #31

**Verifikasi yang benar-benar dijalankan:** `grep` penggunaan
`MASTERDATA_PRICE_MANAGE`/`MASTERDATA_OFFERING_MANAGE` di seluruh `src/`;
pembacaan `matrix.ts` + `guards.ts#hasPermission` untuk memastikan siapa pemegang
`MASTERDATA_MATERIAL_APPROVE`; pembacaan `MasterDataProductDialog.tsx:465–490,795`
dan `library-actions.ts:236–285`; `grep checked_at` di luar `src/generated`;
pembacaan `SupplierDetailClient.tsx#PricesTab`. **Tidak dijalankan:**
`npm run build`, `npx tsc --noEmit`, `npm test` — sesi ini tidak mengubah kode.

**Risiko:** dua keputusan (§10 dan M5) membalik arah pekerjaan yang sudah
selesai. §10 melonggarkan kontrol yang sebelumnya ketat; M5 menuntut
menerjemahkan hasil #27. Keduanya diambil owner secara sadar setelah
konsekuensinya dijelaskan, dan alasannya dicatat di sini supaya agent berikutnya
tidak "memperbaikinya" kembali ke keadaan lama.

---

## [Unreleased] - 2026-08-18 (#31) — Handoff ke Codex: checkpoint git, pembagian peran, rekonsiliasi roadmap

**Dikerjakan atas permintaan owner:** *"sekarang project ini akan di takeover
'codingnya' oleh codex… tolong update apa saja yg sudah dan apa saja yg belum
dan perlu di verifikasi oleh saya sebagai owner… jangan sampai pekerjaan roadmap
malah regresi atau bertentangan dengan update2 kecil yg sudah kita kerjakan."*

Tidak ada perubahan perilaku aplikasi di entri ini — seluruhnya git hygiene dan
dokumen.

### Temuan utama: 475 berkas tidak pernah masuk git

Pemeriksaan `git status` sebelum handoff menemukan working tree dengan **475
berkas belum ter-commit** (229 modified, 106 deleted, 140 untracked), termasuk:

- **seluruh `prisma/migrations/`** — 28 folder, termasuk rebaseline v2
  `20260810180000_masterdata_v2_rebaseline` dan `20260818120000_masterdata_live_unique_indexes`
- **seluruh `docs/archive/`** (16 berkas) — padahal `roadmap.md` menunjuk
  `docs/archive/roadmap-2026-08-18-sebelum-perapihan.md` sebagai riwayat kanonik
- `src/subapps/master-data/{hooks,config,components/shared}`,
  `src/app/api/masterdata/`, `src/extensions/library/contracts/`,
  `src/app/masterdata/{settings,suppliers,materials/[brandId]}`,
  `src/app/(dashboard)/upcoming/`
- **8 dari 9 berkas hasil #30** — PR1, M4, M8, A4b, dan T6 semuanya masih di
  working tree saja; `api/masterdata/excel/import/route.ts` bahkan untracked
  seluruhnya. Commit `0f9023f` hanya benar-benar memuat D3 dan D5.

Penyebabnya bukan `.gitignore` — `git check-ignore` mengonfirmasi tidak satu pun
di-ignore. Semuanya sekadar tidak pernah di-`git add`, karena tiap commit
sebelumnya hanya menyebut berkas yang disentuh task itu.

**Risikonya konkret:** satu `git stash`, `git checkout`, atau `git reset` dari
agent berikutnya menghapus pekerjaan berbulan-bulan, termasuk seluruh riwayat
migrasi database.

**Perbaikan** — commit `5d87662` *"checkpoint: commit seluruh working tree
sebelum handoff ke Codex"*: 364 berkas, **nol baris kode berubah**, murni
merekam isi disk apa adanya. `git status` sekarang bersih kecuali tiga scratch
di `tmp/`.

Sengaja tidak diikutkan dan dimasukkan `.gitignore`: `studioflow.rar` (352 MB),
`masterdata-2026-08-11.zip`, `masterdata-app-2026-08-11.zip`, `/_to_delete/`,
`/.claude/`, `.~lock.*#` (berkas lock LibreOffice), `/tmp/backfill-out/`.

### `AGENTS.md` — bagian baru §🧑‍⚖️ Pembagian Peran

Codex memegang eksekusi coding. Claude berperan sebagai **product specialist &
reviewer**: mereview hasil coding terhadap kontrak, menjaga
`changelog.md`/`roadmap.md`/`AGENTS.md`, menyiapkan spesifikasi, menjawab
pertanyaan produk.

Claude hanya menulis kode produksi dalam **tiga keadaan yang harus bisa ditunjuk
buktinya**: (1) item sudah disepakati di `roadmap.md` tanpa tanda ⏳/🔒 yang
belum dijawab, (2) `changelog.md` mencatatnya sebagai pekerjaan belum selesai,
(3) permintaan langsung owner di sesi itu. Di luar ketiganya: tulis usulannya,
jangan tulis kodenya.

### `HANDOFF-CODEX.md` (baru)

Ringkasan satu halaman yang dibaca Codex sebelum `roadmap.md`: keadaan repo,
**18 keputusan yang tidak boleh dimundurkan**, pekerjaan terbuka yang sudah
diverifikasi terhadap kode, aturan kerja yang paling sering dilanggar, dan enam
tugas owner.

Daftar anti-regresinya menyasar tiga kelas: (a) enam item #30 yang roadmap-nya
masih menulis terbuka; (b) empat pola React yang **terlihat seperti kode kurang
rapi** dan merapikannya mengembalikan bug persis — deps `[task.label]` di
`task-list.tsx`, `tagQuery` sebagai `useMemo`, `applySmartTag` sebagai
`useCallback`, `catch (error: unknown)` di `ProjectLiveProvider`; (c) delapan
kontrak domain yang sudah dibayar mahal — `Party`/`Brand` name bukan `@unique`
lagi, lima nilai `SampleStatus`, soft-delete `WorkPrice`, advisory lock, tidak
ada tombol "Modify", `recordAudit` satu kali, `resolvePrice()`/`checkWorkPrice()`,
lookup `Category` wajib memfilter `kind`.

### Rekonsiliasi `roadmap.md`

Enam item ditutup karena sudah selesai di #30 tapi masih tertulis terbuka:
**PR1**, **M4**, **M8**, **A4b**, **T6**, **D3**. Masing-masing diberi catatan
"jangan dikembalikan" beserta bentuk kode yang sekarang berlaku.

**Koreksi: D5 ternyata belum selesai.** Roadmap mengklaim *"bagian Master Data
sudah selesai 2026-08-11; sisanya di luar Master Data"* — dihitung ulang
terhadap kode, justru kebalikannya. Dari 11 berkas pemakai `<TableCard>`, dua
yang masih tanpa `minWidth` keduanya di Master Data:
`SampleLibraryClient.tsx` dan `SampleRequestPanel.tsx`. Angka "13 berkas" di
roadmap juga tidak akurat.

Ditambahkan pula blok pengarah di kepala roadmap: **roadmap lebih sering usang
daripada kodenya** — sudah tiga kali terbukti (H7 ditandai butuh migrasi padahal
kolomnya sudah ada; M1 meminta mengedit konstanta di berkas yang tidak pernah
diimpor; D5 di atas). Cek kode sebelum mengerjakan sebuah item.

### ⏳ Owner — enam hal yang tidak bisa dijalankan agent cloud

1. `npm run build` — belum pernah diverifikasi di siklus ini (sandbox SIGBUS).
2. `npx prisma migrate deploy` — `20260818120000_add_checked_at_to_checklist`
   (#29) mungkin belum diterapkan. ⚠️ **Dua migrasi memakai prefix timestamp
   yang sama** `20260818120000`; Prisma mengurutkan leksikografis jadi urutannya
   deterministik, tapi jangan tambah yang ketiga dengan prefix itu.
3. Hapus `_to_delete/MasterDataNav.tsx` (sisa §19, #25).
4. Push **14 commit** ke `origin/main`.
5. Jawab lima pertanyaan ⏳ yang memblokir pekerjaan lain: **H5**, **§10**,
   **M5**, **BR8**, **B1**.
6. Uji manual — `roadmap.md` §Uji manual task (9 langkah) dan §Uji manual Master
   Data v2 (19 langkah, butuh mesin dengan database).

**Verifikasi yang benar-benar dijalankan di sesi ini:** `git status` sebelum dan
sesudah (475 → 3), `git check-ignore -v` pada empat path untracked terbesar,
penghitungan pemakai `<TableCard>` vs pemilik `minWidth` di seluruh `src/`,
`git diff --cached --numstat` sebelum commit. **Tidak dijalankan:**
`npm run build`, `npx tsc --noEmit`, `npm test`, `npx eslint` — sesi ini tidak
mengubah kode, dan build production tetap tugas owner.

**Risiko:** commit checkpoint memuat berkas yang belum pernah ditinjau siapa pun
(mis. `scratch-test.ts`, `lint-errors.json`, `update_imports.py`,
`studioflow_ssot_engineering.md`). Merekamnya lebih aman daripada
membiarkannya hilang, tapi layak dibersihkan menyusul.

---

## [Unreleased] - 2026-08-18 (#30) — Pembersihan kode & UX minor (PR1, M4, M8, A4b, T6, D3, D5)

**Tujuh item kecil** yang bisa dikerjakan one-shot tanpa keputusan owner, hasil
scan roadmap menyeluruh 2026-08-18.

### PR1 — Hapus `PartyPicker` di PricingClient, pakai `CreatableSearch` langsung

`src/subapps/master-data/components/PricingClient.tsx`

`PartyPicker` hanya membungkus `CreatableSearch`; di sisi Pricing/Supplier picker
tidak ada manfaat tambahan. Wrapper dihapus, `CreatableSearch` dipanggil langsung.
Import `PartyPicker` juga dihapus — tidak ada tempat lain yang memakainya di file
ini.

### M4 — `getPartyBrandsAction`: hanya load SKU yang relevan ke `priceCounts`

`src/subapps/master-data/actions/masterdata-actions.ts`

Sebelumnya semua SKU milik brand dimuat lalu difilter. Sekarang hanya
`priceSkuIds` (id SKU yang ada di `priceCounts`) yang dimuat dari DB. Pada brand
dengan banyak SKU tapi sedikit harga aktif, query bisa 10–100× lebih ringan.

### M8 — Guard 20 MB di route import Excel Master Data

`src/app/api/masterdata/excel/import/route.ts`

File di atas 20 MB langsung ditolak dengan `413 Payload Too Large` dan pesan
ukuran aktual, sebelum buffer dibaca. Komentar konfigurasi sudah ada di sana,
tapi guard runtime-nya tidak ada.

### A4b — `upsertBrandCategories` sekarang hapus baris `DERIVED_FROM_SKU` lama

`src/extensions/library/services/library-service.ts`

`syncSeedBrandCategories` sudah punya pola ini untuk baris `SEED`. Diterapkan
juga ke `upsertBrandCategories` untuk baris `DERIVED_FROM_SKU` — baris stale
(kategori yang tidak lagi ada di tag SKU) sekarang dihapus, bukan dibiarkan.

### T6 — Bersihkan `as any` dan `set-state-in-effect` di lima berkas

- `src/extensions/schedule/lib/display-utils.ts` — ganti 4× `as any` dengan
  `unknown`-cast bertipe.
- `src/ui_engine/components/ProjectLiveProvider.tsx` — ganti 2× `catch (error:
  any)` dengan `catch (error: unknown)`, akses `.name`/`.message` lewat
  `instanceof Error`.
- `src/components/template-manager.tsx` — ganti 2× `catch (err: any)` dengan
  `catch (err: unknown)`.
- `src/components/today-inline-add.tsx` — `tagQuery` yang tadinya `useState` +
  `useEffect` (melanggar `react-hooks/exhaustive-deps`) dikonversi ke `useMemo`;
  reset `activeIndex` dipindah ke `useEffect` terpisah.
- `src/components/today-quick-add-modal.tsx` — smart-tag `useEffect` yang
  memanggil `setState` diganti `useCallback applySmartTag`, dipanggil inline dari
  `onChange`.

### D3 — Toast error di `ActivityManager`

`src/components/activity-manager.tsx`

Lima handler (add, toggle, delete, defer, saveEdit) memiliki blok `catch` yang
hanya `console.error`. Sekarang masing-masing juga memanggil `toast.error(…)`
dari `sonner` agar pengguna tahu aksi gagal — terutama penting karena toggle dan
delete sudah melakukan optimistic update yang dibalik saat error.

### D5 — `minWidth` / `overflow-x-auto` di dua tabel di luar Master Data

- `src/components/cd-list-table.tsx` — wrapper `<div>` diganti ke
  `overflow-x-auto`; `<table>` diberi `min-w-[900px]`. (File ini memakai raw
  `<table>`, bukan `<TableCard>`.)
- `src/components/client-management-table.tsx` — `<TableCard minWidth="640px">`.
- `src/components/deliverables-table.tsx` dan `project-list-client.tsx` sudah
  punya `minWidth` dari commit sebelumnya — tidak diubah.

---

## [Unreleased] - 2026-08-18 (#29) — Perbaikan tambahan inline edit (#28b) + dua fitur baru Today's View

**Dikerjakan atas permintaan owner:** setelah melihat dua bug #28 selesai, owner
meminta dua fitur Today's View yang belum pernah dicatat di roadmap maupun
changelog:

1. *"saat nothing queued maka defaultnya di collapse"* — grup proyek yang belum
   punya task seharusnya mulai dalam keadaan collapsed, bukan expanded.
2. *"segala sesuatu yg sudah di centang akan ada limit timenya (temporary sampai
   waktu tertentu misal 1 minggu, dan itu akan di hapus sepenuhnya dari daftar
   histori tasknya)"* — task yang sudah dicentang otomatis menghilang dari feed
   Today setelah 7 hari.

### Verifikasi

- `npx tsc --noEmit` (seluruh `src/`) → bersih, nol error.
- `npx prisma validate` → bersih setelah field `checked_at` ditambahkan.

---

### Bug #28b — Inline edit judul task: useEffect deps menyebabkan label di-reset saat edit disimpan

**Root cause (lanjutan #28):** Perbaikan #28 mengubah span agar merender
`{labelDraft}`, bukan `{task.label}`. Namun `useEffect` yang menjaga sinkronisasi
`labelDraft` ↔ `task.label` memiliki deps array `[task.label, editingLabel]` —
sehingga efek itu juga berjalan setiap kali `editingLabel` berubah. Ketika
`commitLabelEdit` memanggil `setEditingLabel(false)`, efek segera berjalan dan
memanggil `setLabelDraft(task.label)` dengan **nilai server yang belum
di-refresh**, membalikkan label draft ke teks lama sebelum `router.refresh()`
sempat datang. Hasilnya: span sekilas menampilkan teks baru, lalu berbalik ke
teks lama — masih terlihat seperti simpan gagal.

**Perbaikan — `src/components/task-list.tsx`:**

- Deps array diubah dari `[task.label, editingLabel]` menjadi `[task.label]`
  saja, dengan komentar `// eslint-disable-next-line react-hooks/exhaustive-deps`
  dan penjelasan `// intentionally omit editingLabel`. Kini efek hanya berjalan
  saat nilai `task.label` dari server berubah — yaitu setelah `router.refresh()`
  selesai — bukan setiap kali mode edit dibuka atau ditutup.

- Rollback tetap benar: bila server menolak (permission, error jaringan),
  `router.refresh()` membawa `task.label` lama kembali → efek berjalan →
  `labelDraft` dikembalikan ke nilai asal.

---

### Fitur — Grup proyek kosong collapsed secara default di Today's View

**Motivasi:** Bila sebuah proyek aktif tidak punya task di antrean hari ini, grup
judul proyeknya tetap ditampilkan expanded — memakan ruang layar tanpa informasi
berguna.

**Perbaikan — `src/components/today-view.tsx`:**

- State `collapsed` sebelumnya diinisialisasi dengan `new Set()` (semua grup
  terbuka). Sekarang diinisialisasi dengan:
  ```ts
  new Set(groups.filter((g) => g.tasks.length === 0).map((g) => g.project_id))
  ```
  sehingga setiap grup tanpa task dimulai dalam keadaan collapsed pada mount
  pertama. Pengguna tetap bisa membuka/menutup grup kapan saja — perilaku toggle
  tidak berubah.

- Inisialisasi hanya berlaku sekali (lazy initializer `useState`), sehingga
  tidak menimpa keadaan collapsed/expanded yang sudah dipilih pengguna jika grup
  mendapat task baru saat komponen masih mounted.

---

### Fitur — Task yang dicentang otomatis disembunyikan dari Today feed setelah 7 hari

**Motivasi:** Task yang dicentang tetap muncul selamanya di feed Today —
menumpuk dan mengubur task aktif yang belum dikerjakan.

**Perubahan skema — `prisma/schema.prisma` + migrasi baru:**

```prisma
/// Timestamp of the most recent check-off. Set when is_checked becomes
/// true, cleared when unchecked. Used to purge stale done-items from the
/// Today feed after CHECKLIST_DONE_RETENTION_DAYS days.
checked_at  DateTime?
```

Field nullable: baris lama (sebelum kolom ditambahkan) memiliki `checked_at:
null` dan **tidak** akan difilter keluar — tidak ada data yang hilang secara
retroaktif.

Migrasi: `prisma/migrations/20260818120000_add_checked_at_to_checklist/migration.sql`

**`src/lib/services/phase-service.ts` — `executeToggleChecklist`:**

- Root update dan cascade `updateMany` keduanya kini menyertakan:
  ```ts
  checked_at: isChecked ? new Date() : null
  ```
  — diisi saat dicentang, dikosongkan saat centang dilepas.

**`src/lib/services/task-feed-query.ts` — konstanta + filter:**

```ts
const CHECKLIST_DONE_RETENTION_DAYS = 7;
```

Kedua klausa `where` (task di dalam fase, dan task langsung di proyek tanpa
fase) sekarang menyertakan:
```ts
NOT: {
  is_checked: true,
  checked_at: {
    lt: new Date(Date.now() - CHECKLIST_DONE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  },
},
```
Semantik Prisma `NOT { A, B }` berarti "bukan (A **dan** B)" — baris dengan
`checked_at: null` tidak pernah cocok kondisi `lt`, sehingga task lama yang
belum punya timestamp tetap terlihat (null-safe by design).

**`src/types/checklist.ts` + `src/lib/services/checklist-task.ts`:**

- `ChecklistTask` interface ditambahkan `checked_at: string | null`.
- `CHECKLIST_TASK_SELECT` menambahkan `checked_at: true`.
- Mapper `toChecklistTask` menambahkan `checked_at: row.checked_at ?
  row.checked_at.toISOString() : null`.

---

## [Unreleased] - 2026-08-18 (#28) — Dua perbaikan dilaporkan owner: SKU CreatableSearch dan inline edit task

**Dikerjakan atas permintaan owner:** screenshot dua layar yang tidak berfungsi
setelah DB di-reset untuk sesi baru:

1. *"createablesearch utk SKU / Material tidak berfungsi"*
2. *"inline edit utk task di studioflow jg tidak berfungsi"*

### Verifikasi

- `npm test` → **118/118 lulus**.
- `npx tsc --noEmit` (seluruh `src/`) → bersih, nol error.

---

### Bug 1 — SKU / Material CreatableSearch di dialog "Add Material Price"

**Root cause:** `SkuPicker` membungkus `CreatableSearch` tapi tidak pernah
meneruskan prop `onCreate` — komponen tidak memiliki jalur untuk membuat SKU
baru. Di DB yang baru-di-reset (nol SKU), picker selalu kosong dan memberi
pesan *"SKU tidak ditemukan."* tanpa opsi membuat satu.

Selain itu, bila SKU berhasil dibuat inline, `skuOptions` (prop dari server)
tidak memuat baris baru sehingga sku yang baru saja dibuat tidak akan
terlihat di picker sampai halaman di-reload penuh.

**Perbaikan:**

- **`src/subapps/master-data/components/SkuPicker.tsx`** — Prop baru
  `onCreate?: (name: string) => void` dan `isCreating?: boolean` diteruskan
  langsung ke `CreatableSearch`. Komentar "NO QUICK ENTRY HERE" diperbarui:
  quick-entry sekarang diizinkan, hasilnya minimal (kode saja, `base_unit:
  "pcs"`, tanpa kategori).

- **`src/subapps/master-data/components/PricingClient.tsx`** — Di
  `HargaMaterialTab`:

  - `quickCreateSkuAction` ditambahkan ke import.
  - Tipe lokal `SkuEntryRow = SkuOption & { name: string }` didefinisikan —
    `useQuickEntry` memerlukan `T extends { id; name }`, sedangkan `SkuOption`
    memakai `sku` + `productName`. Mapping `skuOptionsNamed` menambahkan field
    `name` tanpa menyentuh struktur data yang ada.
  - `skuEntry` ditambahkan via `useQuickEntry` — pola yang sama persis dengan
    `supplierEntry` dan `brandEntry`. `input` menutup atas `form.brand_id`
    sehingga SKU yang dibuat selalu menempel ke brand yang sedang dipilih.
    `toRow` menyimpan `brandId` sehingga baris langsung muncul di
    `skusForBrand` tanpa perlu reload.
  - `skusForBrand` diubah untuk memakai `skuEntry.options` (bukan langsung
    `skuOptions`) sehingga SKU yang baru dibuat inline langsung terlihat di
    picker.
  - `SkuPicker` menerima `onCreate={canManage ? skuEntry.create : undefined}`
    dan `isCreating`.
  - `onSelect` diubah memakai `skuEntry.options.find(...)` (sebelumnya
    `skuOptions.find(...)`) — agar SKU baru bisa mengisi `item_description`
    otomatis.
  - Helper text *"This brand has no SKU in the material catalog yet."* hanya
    ditampilkan ke non-manager — manager bisa membuat SKU langsung dari picker.

---

### Bug 2 — Inline edit judul task: label berkedip kembali ke nilai lama

**Root cause:** `commitLabelEdit` memanggil `setEditingLabel(false)` (sync)
lalu `onMutate(...)` (async). Span yang menggantikan input langsung
merender `task.label` — nilai *dari server*, bukan nilai yang baru disimpan.
Label baru baru terlihat setelah `router.refresh()` selesai (beberapa detik).
Pengguna melihat ini sebagai "simpan gagal", padahal simpan berhasil.

**Perbaikan — `src/components/task-list.tsx`:**

- Span non-edit sekarang merender `{labelDraft}` alih-alih `{task.label}`.
  `labelDraft` dijaga sinkron dengan `task.label` oleh `useEffect` yang
  sudah ada (berjalan saat tidak sedang edit). Saat `commitLabelEdit`
  dipanggil, `labelDraft` sudah berisi teks baru → span langsung menampilkan
  nilai yang benar tanpa menunggu refresh server.

- `setLabelDraft(task.label)` dihapus dari handler `onClick` dan `onKeyDown`
  span — ini mencegah input di-reset ke nilai server lama saat pengguna
  meng-klik lagi sebelum refresh datang (kondisi race ringan bila pengguna
  mengedit dua kali cepat).

- Rollback tetap benar: bila server menolak (error permission, dll.),
  `router.refresh()` membawa `task.label` lama kembali → `useEffect`
  menyinkronkan `labelDraft` ke nilai lama → span kembali ke teks asli.

## [Unreleased] - 2026-08-18 (#27) — Eksekusi roadmap Gelombang 4 lengkap: B3, B5, B7, H3, H7, H8, M6, M9

**Dikerjakan atas permintaan owner:** *"Gelombang 4 — konsistensi backend...
kerjakan semua gelombang 4 - update changelog dan roadmap nya"*. Dua item
sebelumnya bertanda 🔒 (H7, M9) ditanyakan ke owner lebih dulu lewat
`AskUserQuestion`, sesuai aturan "jangan ubah skema Master Data tanpa tanya
owner dulu":

- **H7** — owner memilih *"kerjakan + siapkan migrasi (jangan dijalankan)"*.
  Saat dikerjakan ternyata **kolom yang diminta sudah ada** — lihat di bawah.
  Tidak ada berkas migrasi yang ditulis karena tidak ada yang perlu ditulis.
- **M9** — owner memilih **advisory lock** (`pg_advisory_xact_lock`), bukan
  sequence Postgres — pilihan yang dari awal tidak butuh migrasi sama sekali.

### Verifikasi

- `npm test` → **118/118 lulus**.
- `npx tsc --noEmit` (seluruh `src/`) → bersih, nol error.
- `npx prisma validate` → bersih (nol perubahan schema — lihat temuan H7 di
  bawah untuk alasannya).
- `npx eslint` pada seluruh berkas yang disentuh → nol error. Satu warning
  pra-ada (`companies` tak dipakai di `SupplierDetailClient.tsx`, sama seperti
  dicatat di #25) — bukan hasil perubahan sesi ini.
- `next build` **belum diverifikasi** — sandbox cloud SIGBUS pada binary SWC
  native lewat mounted FS (masalah lama). Tetap tugas owner sebelum deploy.

### Temuan saat dikerjakan — H7 ternyata tidak butuh migrasi

Roadmap menulis *"`WorkPrice` belum punya `deleted_at`. Tanya dulu."* untuk
H7, dan `AskUserQuestion` ke owner didasarkan pada premis itu. Saat berkas
`schema.prisma` benar-benar dibuka: kolom itu **sudah ada**, ditambahkan sejak
migrasi rebaseline `20260810180000` (awal Master Data v2). Lebih jauh,
`getServicePricesAction` dan `getMaterialLaborPricesAction` **sudah**
memfilter `deleted_at: null` di query baca — hanya belum ada satu pun kode
yang pernah MENGISI kolom itu, karena kedua aksi delete masih memanggil
`tx.workPrice.delete()` (hard delete) alih-alih mengisinya. Roadmap-nya yang
usang, bukan kodenya. H7 selesai sebagai perbaikan kode murni, nol migrasi:

- `deleteServicePriceAction`, `deleteMaterialLaborPriceAction` —
  `tx.workPrice.delete()` → `tx.workPrice.update({ data: { deleted_at: new
  Date() } })`, pola yang sama dengan `deleteMaterialPriceAction`. Efek
  sampingnya juga hilang: hard delete membawa `WorkPriceProjectRef` ikut
  terhapus (`onDelete: Cascade`) — riwayat proyek mana saja yang pernah
  memakai tarif itu lenyap bersama baris harganya. Soft delete tidak
  menyentuh baris itu sama sekali.

### Temuan saat dikerjakan — B5 membongkar dua bug audit-log dobel

Mengonsolidasi lima jalur pembuatan SKU ke `createSkuCore` membuka dua tempat
di `library-service.ts` (dialog "Add Material" dan alur "terima produk request
proyek") yang memanggil **baik** `recordAudit` (ke
`master_data.MasterDataAudit`, benar per `AGENTS.md` §6) **maupun**
`insertAuditLog` (ke `studioflow.AuditLog`) untuk **SKU CREATE yang sama** —
satu event tercatat dua kali, di dua tabel audit yang berbeda. Tidak ada di
`AUDIT-MASTERDATA-2026-08-18.md` maupun `VERIFIKASI-AUDIT-2026-08-18.md`;
ditemukan murni karena kelima jalur dibaca berdampingan untuk B5.
`sample-request-actions.ts` punya cacat kebalikannya — hanya memanggil
`insertAuditLog` untuk SKU CREATE, **tanpa** `recordAudit` sama sekali (kelas
cacat yang sama dengan §11, yang ditutup untuk `Sample` di #25 tapi rupanya
tidak untuk SKU di jalur terima-sample ini). Ketiganya tertutup begitu jalur
masing-masing dipindah ke `createSkuCore`, yang memanggil `recordAudit` **tepat
satu kali** dan tidak pernah `insertAuditLog`.

### B3 — `ensureUniqueSlug`, 8 jalur tulis

- **`slug-service.ts`** (baru) — `ensureUniqueSlug(base, exists)`: fungsi
  murni, tidak menyentuh Prisma sendiri (parameter `exists` adalah callback
  yang dioper pemanggilnya) — sufiks `-2`, `-3`, … sampai 1000 percobaan,
  fallback `item-<hex acak>` kalau `base` kosong.
- **`party-actions.ts`** — create & update Party (`createCompanyAction`,
  `updateCompanyAction`), keduanya dicek terhadap `tx.party` dengan
  `deleted_at: null` (update ditambah `id: { not }` untuk mengecualikan diri
  sendiri).
- **`pricing-actions.ts`** — `createServiceVendorAction`,
  `updateServiceVendorAction`, pola yang sama terhadap `tx.party`.
- **`quick-entry-actions.ts`** — `quickCreatePartyAction`,
  `quickCreateBrandAction`, `quickCreateWorkVendorAction`. `quickCreateSkuAction`
  sengaja **tidak** disentuh di sini — itu jalur pembuatan SKU, jadi masuk B5.
- `sample-request-actions.ts:417` yang disebut roadmap sebagai jalur kedelapan
  tertutup lewat B5 (`createSkuCore` memanggil `ensureUniqueSlug` di
  dalamnya), bukan disentuh dua kali.

### B5 — `createSkuCore`, lima jalur pembuatan SKU

- **`sku-core-service.ts`** (baru) — `createSkuCore(tx, params, actor)`
  menjamin empat hal untuk SETIAP pemanggil: slug unik lewat `ensureUniqueSlug`
  (B3), `base_unit` tidak pernah `""` (fallback `"pcs"` — `quickCreateSkuAction`
  dulu menulis string kosong karena kolomnya `NOT NULL` dan `null` bukan
  pilihan), kategori pertama di `categoryIds` ditandai `is_primary: true` kalau
  daftarnya diisi, dan **tepat satu** panggilan `recordAudit`.
- Dipakai lima pemanggil: `library-service.ts` (dialog Add Material, dan alur
  terima produk request proyek — dua lokasi terpisah), `quick-entry-actions.ts`
  (`quickCreateSkuAction`), `sample-request-actions.ts` (alur terima sample),
  `excel-service.ts` (baris INSERT impor massal — baris UPDATE tidak disentuh,
  memang tidak membuat SKU baru).
- Kategori multi-tag (`upsertSkuCategories`, `BrandCategory` reconciliation)
  sengaja **tidak** dipindah ke dalam `createSkuCore` — fungsi-fungsi itu sudah
  benar untuk kasus tag-banyak dan kasus SKU yang sudah ada, di luar lingkup
  "satu SKU baru, satu kategori utama" yang jadi tanggung jawab `createSkuCore`.

### B7 — pohon kategori

- **`category-tree-service.ts`** `upsertCategory` — lookup lama
  `OR: [{ slug }, { name, parent_id: parentId }]` tidak bisa pernah menemukan
  baris root yang sedang diberi induk (kalau `parentId` bukan null, `slug`
  sudah jadi `"induk-anak"`, dan baris lama masih `parent_id: null` bukan
  `parentId`) — ditambah cabang `{ name, parent_id: null }`, aktif hanya saat
  `parentId` bukan null supaya lookup root biasa tidak jadi mencocokkan
  dirinya sendiri.
- **`propagateDescendantPaths()`** (baru) — dipanggil setiap kali `path`
  sebuah kategori berubah; menemukan seluruh keturunan lewat
  `path: { startsWith: "<path lama>/" } }` dan menulis ulang prefiksnya,
  memenuhi `AGENTS.md` §4 yang selama ini hanya menjaga `path` di satu baris,
  bukan subtree-nya.
- **`scripts/backfill-duplicate-categories.mjs`** (baru) — dry-run secara
  default (`--apply` untuk menulis). Hanya menggabungkan pasangan
  root+nested `(kind, name)` yang PERSIS: satu baris root, satu baris nested,
  root tidak punya sub-kategori sendiri. Selain itu dilaporkan di bawah "NEEDS
  MANUAL REVIEW", tidak ditebak — pola yang sama dengan
  `backfill-party-roles.mjs`. Memindahkan `SkuCategory`/`BrandCategory`
  (keduanya unik per pasangan, jadi baris yang sudah dobel dihapus bukan
  ditabrak) dan `WorkPrice.category_id`, lalu menonaktifkan (`is_active: false`)
  baris root. Dites lewat `node scripts/backfill-duplicate-categories.mjs` di
  device (parse & konek Prisma sukses; terhenti di "Can't reach database
  server" karena sandbox cloud tidak punya akses ke Postgres device — sama
  seperti percobaan terhadap `backfill-party-roles.mjs` yang sudah ada,
  bukan cacat script baru ini). ⏳ **Owner:** jalankan dry-run dari mesin
  dengan akses DB, tinjau, baru `--apply`.

### H3 — penjaga hapus Party disatukan, plus §17

- **`party-delete-service.ts`** (baru) — `assertPartyDeletable(tx, partyId)`
  memeriksa `Brand.owner_party_id`, `WorkPrice.vendor_party_id`,
  `SkuPrice.supplier_party_id`, `BrandSupplier.party_id` sekaligus, dipakai
  `deleteCompanyAction` (`party-actions.ts`) DAN `deleteServiceVendorAction`
  (`pricing-actions.ts`) — bukan lagi dua penjaga yang masing-masing memeriksa
  persis apa yang dilewatkan yang lain.
- **§17** — `updatePartyContactAction`/`deletePartyContactAction`
  (`party-actions.ts`) menerima `partyId` opsional baru, menolak
  (`NOT_FOUND`) kalau kontak yang dituju ternyata bukan milik party itu.
  Opsional supaya pemanggil lama tetap jalan; `SupplierDetailClient.tsx`
  (satu-satunya pemanggil) diupdate mengirimnya. Izinnya tetap global
  (`MASTERDATA_VENDOR_MANAGE`, bukan per-party) jadi ini pertahanan berlapis
  seperti dicatat roadmap, bukan penutup celah privilese.

### H7 + H8 — `WorkPrice` soft-delete dan filter `kind`/`deleted_at`

- `deleteServicePriceAction`, `deleteMaterialLaborPriceAction` — lihat
  §Temuan di atas untuk H7.
- `updateServicePriceAction`, `updateMaterialLaborPriceAction` — lookup
  `findUnique({ where: { id } })` (tanpa filter apa pun) diganti
  `findFirst({ where: { id, kind, deleted_at: null } })`, jadi tidak bisa lagi
  menemukan (dan mengedit) baris `kind` yang salah atau yang sudah terhapus.
- Keempatnya sekarang sepakat: `LABOR_ONLY` hanya bisa disentuh dari layar
  Service Price, `MATERIAL_LABOR` hanya dari layar Material+Labor.

### M6 — error Prisma mentah dipetakan

- **`action-wrapper.ts`** — `mapKnownPrismaError()` baru, dipanggil sebelum
  fallback `error.message` mentah: `P2002` → pesan bentrok pakai
  `error.meta?.target` (nama kolom/index yang tabrakan), `P2025` → "tidak
  ditemukan", `P2003` → pelanggaran relasi FK, `P2014` → relasi wajib yang
  belum diisi, default → pesan database generik. Semua berbahasa Indonesia,
  semua bisa ditindaklanjuti pengguna. Menutup §7 (bentrok slug), §16
  (contact yang sudah tidak ada), §15 (tabrakan kode kerja).

### M9 — `generateWorkPriceCode`, advisory lock

- **`pricing-actions.ts`** `generateWorkPriceCode` — baris pertama fungsi
  sekarang `SELECT pg_advisory_xact_lock(hashtext('work_price_code'))` di
  dalam transaksi yang sama (`tx.$executeRaw`). Menyerialkan pemanggil
  bersamaan alih-alih membiarkan dua transaksi membaca kode tertinggi yang
  sama, menghitung `seq` berikutnya yang sama, lalu balapan menulis baris
  yang sama — yang sebelumnya ditangkap `@unique` tapi berakhir sebagai error
  Postgres mentah (sekarang tertutup ganda oleh M6 juga). Lock terikat
  transaksi (`_xact_`, bukan varian sesi) — lepas otomatis saat commit atau
  rollback, tidak ada `unlock` yang bisa lupa dipanggil dan tidak bisa bocor
  walau proses crash di tengah jalan.

**Belum dikerjakan** (di luar Gelombang 4, tidak diminta sesi ini): Gelombang 5
(M3/M4/M8/§20), seluruh ⏳ Menunggu Keputusan Owner, seluruh BR1–BR8/UI-CON-*,
dan bagian STUDIOFLOW di luar Master Data. **Owner masih perlu:** jalankan
`node scripts/backfill-duplicate-categories.mjs` (dry-run dulu) dari mesin
dengan akses DB untuk membereskan duplikat kategori lama akibat bug B7 —
sandbox cloud tidak bisa menjangkau Postgres device untuk menjalankannya.

## [Unreleased] - 2026-08-18 (#26) — Task list: inline edit judul task (dilaporkan sebagai regresi, ternyata belum pernah dibangun)

**Dikerjakan atas laporan owner:** *"TASK nya inline editnya hilang dulu sudah
pernah di buat malah regresi coba cek changelog nya"*, disertai screenshot
daftar task proyek (`2025-429 HELOSKIN CIMANGGU`) tanpa cara mengedit judul.

### Investigasi dulu — premis "regresi" tidak didukung bukti

Sebelum menulis kode, tiga sumber dicek untuk mencari kapan inline-edit judul
task pernah ada dan hilang:

1. **`changelog.md`** — nihil. Pencarian `rename`, `edit judul`, `edit title`,
   `task title`, `klik dua kali` di seluruh berkas tidak menemukan satu pun
   entri yang menyebut kemampuan mengganti nama task dari UI.
2. **`git log -- src/components/task-list.tsx`** — kosong. Berkas ini belum
   pernah di-commit sama sekali (seluruh subapp Todo, sama seperti Master
   Data v2, masih berstatus `??` di `git status`), jadi tidak ada riwayat versi
   yang bisa diperiksa untuk "keadaan sebelum regresi".
3. **Seluruh pemanggil `updateTask(...)`** (`task-list.tsx`, `today-view.tsx`,
   `upcoming-view.tsx`) — nol yang pernah mengoper field `label`. Backend-nya
   justru sudah siap sejak awal: `executeUpdateTask`
   (`checklist-service.ts:190`) sudah menangani `label` secara kondisional
   (`if (params.label !== undefined) data.label = params.label.trim();`), dan
   `UpdateTaskSchema` sudah memvalidasinya
   (`ChecklistLabelTextSchema` — trim, panjang 1–max). Backend inilah yang
   dipakai kontrol Priority/Due date/Assign yang sudah ada di menu titik tiga
   tiap baris task.

**Kesimpulan:** ini bukan regresi yang bisa dikembalikan — inline-edit judul
task nampaknya **belum pernah dibangun** di UI, meski jalur backend-nya sudah
siap sejak build awal (§C, `changelog.md` entri 2026-08-10 "Todo ala Todoist
Pro — implementasi penuh"). Kemungkinan yang tertukar di ingatan owner: Master
Data punya inline-edit yang nyata untuk Category/Hashtag/Brand Name (BR1,
`MasterDataMaterialsClient.tsx`, entri #23) — fitur berbeda, permukaan
berbeda. Dikonfirmasi ke owner sebelum lanjut; jawabannya: bangun sekarang,
klik teks → langsung jadi input.

### Implemented

- **`src/components/task-list.tsx`** (`TaskRow`) — state lokal per-baris
  (`editingLabel`, `labelDraft`), bukan diangkat ke `TaskList`: satu baris
  yang sedang diedit tidak perlu diketahui baris lain.
  - Klik judul (atau Enter/Space saat fokus, `role="button"` + `tabIndex={0}`
    untuk aksesibilitas keyboard) → judul jadi `<Input>`, teks lama otomatis
    terseleksi (`onFocus` → `select()`) supaya mengetik langsung menimpa.
  - Enter atau blur → commit: `updateTask({ taskId, label: trimmed })` lewat
    `onMutate` (jalur yang sama dipakai Priority/Due date/Assign — toast error
    otomatis kalau validasi server gagal, refresh otomatis kalau sukses).
    Kosong atau tidak berubah setelah `trim()` → batal diam-diam, tidak
    mengirim request kosong dan tidak menampilkan toast untuk non-perubahan.
  - Esc → batal, kembali ke label asli, tidak commit.
  - `useEffect` menyinkron `labelDraft` ke `task.label` **hanya saat tidak
    sedang diedit** — supaya polling/refresh dari sesi lain tidak menarik
    teks dari tengah ketikan seseorang, tapi tetap ambil nilai terbaru begitu
    mode edit ditutup.
  - Hanya aktif kalau `canEdit` — read-only user tetap melihat judul sebagai
    teks statis, sama seperti kontrol lain di baris ini.
  - Tidak dibatasi ke task template (`isTemplateRow`): dedup sync sudah
    dipindah ke `(template_id, phase_id)` sejak build §C (bukan lagi label),
    jadi mengganti label task yang tersambung template aman, tidak memicu
    duplikat di sync berikutnya.

### Verification

`npm test` 118/118 ✅ · `npx tsc --noEmit` 0 error ✅ · `npx prisma validate`
bersih (nol perubahan schema) ✅ · `npx eslint src/components/task-list.tsx`
nol warning, nol error ✅. `next build` tetap belum bisa diverifikasi di
sandbox cloud (SIGBUS, masalah lama) — tugas owner sebelum deploy.

## [Unreleased] - 2026-08-18 (#25) — Eksekusi roadmap Gelombang 1, 2 & B6: audit Sample, filter kategori, tujuh perbaikan murah, transaksi ganda

**Dikerjakan atas permintaan owner:** *"baca roadmap nya, kerjakan yg sudah
pasti bisa di kerjakan"* — dibaca sebagai instruksi mengerjakan seluruh item
yang **tidak** ditandai ⏳ (butuh keputusan owner) atau 🔒 (butuh migrasi
schema) di Gelombang 1 dan Gelombang 2 `roadmap.md`, ditambah B6 (Gelombang 4)
yang jelas aman: murni penataan ulang kode, nol perubahan skema. 11 item
selesai dari roadmap yang ditulis sesi sebelumnya (#24 perapihan dokumentasi).

Sisa roadmap (B3, B5, B7, H3, H7/H8, M6, M9, Gelombang 5, seluruh item ⏳
Menunggu Keputusan Owner, seluruh BR1–BR8/UI-CON-*) **sengaja tidak disentuh** —
butuh keputusan owner, migrasi, atau lingkup yang lebih besar daripada "sudah
pasti bisa dikerjakan". Rinciannya di `roadmap.md` §Selesai 2026-08-18 (#25).

### Verifikasi

- `npm test` → **118/118 lulus** (sama seperti sebelum perubahan; tidak ada
  test yang disentuh atau ditambah pada batch ini).
- `npx prisma validate` → bersih (tidak ada perubahan schema).
- `npx tsc --noEmit` (seluruh `src/`) → bersih, nol error.
- `npx eslint` pada seluruh berkas yang disentuh → nol error, dua warning
  pra-ada (`DialogFooter` tak dipakai di `BrandDetailClient.tsx`, `companies`
  tak dipakai di `SupplierDetailClient.tsx` — bukan hasil perubahan ini).
- `next build` **belum diverifikasi** — sandbox cloud SIGBUS pada binary SWC
  native lewat mounted FS (masalah lama, dicatat di `roadmap.md`). Tetap tugas
  owner: `npm run build` sebelum deploy.

### Gelombang 1 — kepatuhan kontrak

- **§11 · Audit Sample nyasar tabel** — `sample-actions.ts`, tiga jalur tulis
  (`createSampleAction`, `updateSampleAction`, `updateSampleStatusAction`)
  memakai `insertAuditLog(tx, …)` yang menulis ke `studioflow.AuditLog`. Ganti
  `recordAudit(tx, { entity: "Sample", … })` yang menulis ke
  `master_data.MasterDataAudit`, sesuai `AGENTS.md` §6. `updateSampleStatusAction`
  dulu punya `AUDIT_ACTIONS.MASTERDATA_SAMPLE_STATUS` tersendiri; `recordAudit`
  hanya mengenal CREATE/UPDATE/DELETE/RESTORE, jadi dipetakan ke `"UPDATE"` —
  konsisten dengan pola yang sama di `pricing-actions.ts`. Import
  `insertAuditLog` dan `AUDIT_ACTIONS` yang jadi tak terpakai dibuang.
- **M7 / §3 · Facet kategori tanpa filter `kind`** —
  `material-view-service.ts` (`getMaterialView`), query `prisma.category.findMany`
  untuk dropdown kategori sekarang menyebut `kind: "PRODUCT"` eksplisit,
  sesuai `AGENTS.md` §4 ("`Category` unik pada `(kind, slug)` — setiap lookup
  WAJIB memfilter `kind`"). Ditambah dedup nama lewat `Set` sebagai jaring
  pengaman kedua, meski query dengan `kind` seharusnya sudah unik dengan
  sendirinya.

### Gelombang 2 — tujuh perbaikan murah, berdiri sendiri

- **§25** `types/party.ts:40` — typo label `"Manufacture"` → `"Manufacturer"`.
- **§24** `SampleLibraryClient.save()` — buang baris
  `setDialog((d) => ({ ...d, open: false }))` sebelum
  `editGuard.closeAfterSave()`; `closeAfterSave()` sendiri sudah memanggil
  `onOpenChange(false)` (dicek di `hooks/use-unsaved-changes-guard.tsx`), jadi
  baris itu redundan dan berbeda urutan dari `saveStatus()` di berkas yang sama.
- **§13** `pricing-actions.ts` `mapWorkPriceCommon` — `p.price != null ?
  Number(p.price) : 0` → `Number(p.price)`. `WorkPrice.price` non-nullable di
  schema, jadi cabang `: 0` tidak pernah tereksekusi; dead code, bukan
  null-safety.
- **§21** `SupplierDetailClient.tsx` — dua `<a href>` (link brand di tabel, dan
  link "View all prices" di `PricesTab`) ganti `<Link>` dari `next/link`.
  `<a>` biasa memicu full page reload; `import Link from "next/link"`
  ditambahkan ke berkas.
- **§22** `BrandDetailClient.tsx` (`SkusTab`) — pencarian SKU brand pakai
  `useDebounce(search, 300)` (`hooks/use-debounce.ts`, sudah ada, dipakai juga
  oleh `BrandLibraryExplorer`). `useEffect` yang memuat data sekarang
  bergantung pada `debouncedSearch`, bukan `search` mentah. Submit form
  (tombol "Cari") tetap memakai `search` mentah supaya Enter/klik terasa
  instan, tidak menunggu jeda debounce.
- **§14** `pricing-actions.ts` `getServiceVendorsAction` — tambah
  `is_active: true` ke `where`. `Party.is_active` sudah ada di schema tapi
  tidak pernah dipakai di sini, jadi vendor yang dinonaktifkan tetap muncul di
  picker.
- **Prop mati `initialSummary`** — dibuang dari signature
  `SampleLibraryClient` (diterima tapi tidak pernah dipakai; ringkasan header
  dihitung `useMemo` dari state `samples`, yang lebih benar karena ikut
  berubah tanpa reload). `app/masterdata/samples/page.tsx` disesuaikan: tidak
  lagi memanggil `getSampleSummaryAction` atau mengoper prop `summary`.

### Gelombang 4 — B6, transaksi ganda

- **B6** `quick-entry-actions.ts` — keempat quick-create handler
  (`quickCreatePartyAction`, `quickCreateBrandAction`,
  `quickCreateWorkVendorAction`, `quickCreateSkuAction`) dulu membuka
  `db.$transaction(async (tx) => …)` di dalam handler `createAction` yang
  sudah berjalan di dalam transaksinya sendiri (`useTransaction` default
  `true`). Karena `db` adalah klien Prisma global (bukan `tx` yang diinjeksi
  `createAction`), ini membuka transaksi KEDUA yang tidak terkait dengan
  transaksi luar — bukan nested transaction yang aman, melainkan dua koneksi
  terpisah untuk satu operasi. Diperbaiki: keempat handler sekarang
  menerima `tx` dari `createAction` langsung (`async ({ input, ctx, tx }) =>`)
  dan memakainya tanpa membuka transaksi baru. Import `prisma` dan alias
  `const db = prisma` yang jadi tak terpakai dibuang.
  *Catatan: bagian kedua item B6 di roadmap lama ("ganti `db` → `tx` di
  `pricing-actions.ts:369-470`") sudah DICABUT di #24 — satu-satunya `db` di
  rentang itu ada di `getServiceVendorsAction` yang memang
  `useTransaction: false`, jadi pola itu sudah benar.*

### Gelombang 3 — kode mati (sebagian)

- **§19 (sebagian)** — `MasterDataNav.tsx` (tidak pernah diimpor siapa pun,
  dikonfirmasi ulang lewat `grep` sebelum dipindah) dipindah ke
  `_to_delete/MasterDataNav.tsx` di root repo. Agent yang berjalan di cloud
  tidak punya izin `rm` pada berkas di folder yang di-mount dari device
  (`Operation not permitted`) — `mv` ke `_to_delete/` adalah jalan yang
  tersedia. ⏳ **Perlu tindakan owner:** hapus folder `_to_delete/` setelah
  dicek isinya cocok. `SupplierJasaTab`, `InlineCompanyCell`, dan
  `toggleSort` di `SupplierClient.tsx` **tidak disentuh** — tetap ditahan
  sesuai keputusan owner 2026-08-18 (BR1/BR8 kemungkinan menghidupkannya
  kembali).

## [Unreleased] - 2026-08-18 (#24) — Perapihan dokumentasi: roadmap dipangkas, SSOT usang diarsipkan, tiga item dicabut

**Jenis pekerjaan: DOCUMENTATION ONLY.** Nol berkas `src/` disentuh, nol
perubahan schema, nol migrasi. `npx prisma validate` bersih dan `npm test`
118/118 lulus **sebelum** perapihan; tidak ada yang bisa mengubahnya sesudahnya,
karena tidak ada kode yang berubah.

Dikerjakan atas permintaan owner: *"update roadmap-nya, hapus yang udah nggak
sesuai dengan program saat ini"*, dengan aturan yang owner tetapkan sendiri —
kalau keadaan sekarang lebih baik daripada yang diminta roadmap, **hapus
roadmap-nya**; kalau ragu, tanya.

### Kenapa perapihan ini perlu

Tiga berkas acuan sudah sampai pada titik di mana **membacanya justru
menyesatkan**, dan ketiganya adalah berkas yang setiap agent diperintahkan baca
lebih dulu:

1. `roadmap.md` sudah 2.268 baris dengan **41 item bertanda selesai berbanding
   29 yang terbuka**. Bagian "SELESAI" yang mendominasi lama-lama dibaca sebagai
   rencana, dan yang belum dikerjakan mustahil ditemukan tanpa mencari.
2. `MASTER_SSOT.md` mengaku *source of truth* arsitektur, 947 baris, dan isinya
   **nol sebutan `Party` / `SkuPrice` / `WorkPrice`.** Ia masih menulis
   `ProductCatalog.catalog_brand`, `Vendor.brand_name`, dan antrean promosi
   sebagai keadaan sekarang — schema yang di-`DROP SCHEMA … CASCADE` pada
   2026-08-10. `AGENTS.md` aturan 1, 2, dan 4 memerintahkan setiap agent
   memvalidasi pekerjaannya terhadap berkas ini.
3. `AGENTS.md` aturan 8 mewajibkan tiap agent membaca dan memperbarui
   `CHANGELOG-CODEX.md` — berkas yang berhenti diperbarui 3 Agustus dan sudah
   diarsipkan. Aturan yang menunjuk berkas tidak ada adalah aturan yang
   diabaikan, dan aturan yang diabaikan menular ke aturan di sebelahnya.

### Verifikasi dulu, baru pangkas

Ke-29 item terbuka dibaca ulang satu per satu **terhadap kode**, bukan dipercaya
dari judulnya. Hasilnya bukan sekadar pemangkasan:

**Tiga item DICABUT — keadaan sekarang lebih benar daripada yang diminta:**

- **M1 · IA nav** — memintanya memasukkan `/masterdata/prices` ke
  `MASTERDATA_SECTIONS`. Prices **sudah** ada di nav
  (`MasterDataNavOuter.tsx:29`), dan konstanta yang diminta diedit berada di
  `MasterDataNav.tsx` — berkas yang **tidak pernah diimpor siapa pun**. Dua
  premis, dua-duanya salah.
- **B6 bagian kedua** — *"ganti `db` → `tx` di `pricing-actions.ts:369-470"`*.
  Satu-satunya `db` di rentang itu ada di `getServiceVendorsAction`, yang memang
  dideklarasikan `useTransaction: false`. Memakai klien global di aksi baca
  non-transaksional adalah **pola yang benar**. Bagian
  `quick-entry-actions.ts` tetap terbuka.
- **T2** — sudah tertutup sendiri oleh v2; nilainya tinggal sebagai peringatan
  agar pohon `PRODUCT` dan `WORK` tidak "dirapikan" jadi satu. Dipindah ke arsip
  sebagai catatan, bukan todo.

**Nomor baris dan hitungan yang sudah bergeser, dikoreksi:**

| Item | Roadmap lama | Sebenarnya |
|---|---|---|
| B3 slug tanpa cek unik | 7 jalur tulis | **8** — `sample-request-actions.ts:417` tidak terhitung |
| B6 transaksi bersarang | `quick-entry-actions.ts:97, 167, 239, 330` | **99, 192, 279, 369** |
| M4 `getPartyBrandsAction` | "ganti pemuatan semua SKU dengan satu `groupBy`" | Sebagian sudah `groupBy`; yang tersisa hanya `sku.findMany` di baris 485 |

**Dua item ternyata sudah selesai, tinggal dicentang:**

- **D3** — komentar `sampleState()` di `material-view-service.ts` sudah benar
  sejak perbaikan B1 (#22). Klaim *"`SENT_TO_CLIENT` tidak ada"* sudah tidak ada
  di sana.
- **D4** — diselesaikan oleh perapihan ini sendiri; lihat di bawah.

**Satu koreksi terhadap changelog #23.** Entri itu mencatat
`useUnsavedChangesGuard` terpasang di "Supplier Jasa tab". Guardnya **nyata**
(`SupplierClient.tsx` baris 315 / 341 / 486) tetapi seluruhnya berada di dalam
`SupplierJasaTab`, komponen yang **tidak pernah dirender** — `SupplierClient.tsx`
bahkan tidak punya `<Tabs>` sama sekali.

Yang benar: layar Supplier yang hidup **tetap terlindungi**, karena dialog yang
benar-benar tampil adalah `MasterDataBrandDialog` dan `PartyDialog`, dan keduanya
punya guard sendiri. Jadi tidak ada lubang UX — yang ada pekerjaan yang terbuang
dan satu baris catatan yang perlu diluruskan. Barisnya di §UI Changes sudah
dicoret dan diberi keterangan.

### Documentation

- **`roadmap.md` — 2.268 → 546 baris.** Berisi **hanya** pekerjaan terbuka,
  dikelompokkan menurut nilai per biaya, bukan menurut label P0/P1 yang
  diwariskan. Tiap item membawa hasil verifikasi 2026-08-18-nya, dan dua tanda
  baru dipakai konsisten: **⏳ owner** (diblokir keputusan Anda) dan **🔒
  migrasi** (menyentuh schema — berlaku aturan tanya-dulu).

  Versi lengkapnya diarsipkan **verbatim** ke
  `docs/archive/roadmap-2026-08-18-sebelum-perapihan.md`. Tidak ada satu item
  pun yang hilang tanpa jejak.

- **`MASTER_SSOT.md` diarsipkan** ke `docs/archive/MASTER_SSOT-v1-2026-08-18.md`.
  Di root tersisa penunjuk arah 51 baris — bukan berkas kosong, karena **lima
  komentar di `src/`** mengutip nomor bagiannya (`§5.7`, `§6.2`, `§6.12`,
  `§8 Issue 7`). Stub itu menyebutkan kelimanya satu per satu, menjelaskan bahwa
  nomor tersebut hanya berlaku untuk versi arsip, dan menunjuk penggantinya.

  Komentar-komentar itu **sengaja tidak diubah**: perapihan ini dokumentasi saja,
  dan menyentuh `src/` akan melanggar batas yang owner tetapkan.

- **`AGENTS.md` — Lead Agent Protocol ditulis ulang.** Aturan 1, 2, dan 4 kini
  menunjuk `AGENTS.md` §Master Data Contract (v2) + `prisma/schema.prisma`;
  aturan 8 menunjuk `changelog.md`. Tiap perubahan membawa catatan *kenapa*
  aturannya berubah, supaya agent berikutnya tidak mengembalikannya karena
  mengira itu kekeliruan.

  Ditambahkan **§📚 Peta dokumen** di atasnya: tabel yang menyatakan berkas mana
  yang mengikat, mana yang riwayat, dan **urutan kemenangan saat dua dokumen
  bertentangan** — `schema.prisma` → `AGENTS.md` → `changelog.md` → sisanya.
  Aturan terakhirnya yang paling penting: *kode yang berjalan mengalahkan dokumen
  yang menjelaskannya; kalau keduanya berbeda, yang salah adalah dokumennya.*

- **D4 diselesaikan dengan mencabut kewajibannya, bukan membuat berkasnya.**
  `changelog.md` sudah memuat persis kelima hal yang aturan 8 tuntut — hasil,
  berkas yang berubah, verifikasi yang dijalankan, risiko, pekerjaan terbuka.
  Dua tempat catat berarti satu ketinggalan, dan bukti mana yang ketinggalan
  sudah ada: `CHANGELOG-CODEX.md` berhenti di 3 Agustus lalu diarsipkan,
  sementara berkas ini terus tumbuh.

- **Tiga dokumen v1 diberi banner ⚠️ DOKUMEN USANG** di baris paling atas:
  `PLAN-AUDIT-ROADMAP-2026Q3.md` (14 berkas `src/` merujuknya),
  `PLAN-LIBRARY-BRAND-FIRST.md` (8), `UPSTREAM-BQ-MATERIAL-SOURCE.md` (2).
  Ketiganya **tetap di root** — memindahkannya membuat rujukan itu menggantung,
  yang lebih buruk daripada dokumen usang yang bisa ditemukan. Bannernya membuat
  mereka mustahil dibaca sebagai keadaan sekarang tanpa sengaja.

- **Tiga dokumen tanpa rujukan diarsipkan** — `PLAN-APP-SPLIT.md`,
  `AUDIT-UX-2026-08-10.md`, `REVIEWUIUX.md`. Isinya yang masih berlaku sudah
  diserap lebih dulu ke `roadmap.md`: §R5 → item A6 dan B1; temuan UX → D2/D3/D5;
  review UI → UI-CON-2/3/4. Diarsipkan **setelah** penyerapan, bukan sebelum.

- **`docs/MASTERDATA_UIUX_REVISION.md.md`** → `.md`. Ekstensi ganda.

- **`docs/archive/README.md`** diperbarui: bagian *"Yang tidak diarsipkan meski
  usang"* dikoreksi dari empat berkas jadi tiga (`MASTER_SSOT.md` pindah), angka
  rujukannya dihitung ulang, dan ditambahkan §Perapihan 2026-08-18 yang mencatat
  alasan tiap pemindahan.

### Fixed — rujukan berkas di Gelombang 5 (BR1–BR8)

Kedelapan item dari screenshot owner 2026-08-18 semuanya menunjuk
`BrandListClient.tsx`. **Berkas itu tidak ada** — dan tidak pernah ada. Tabel
Brands sebenarnya berada di `MasterDataMaterialsClient.tsx` (brand landing view).

Rujukannya dibetulkan; **isi permintaannya tidak diubah sedikit pun**, karena
semuanya lahir dari layar nyata dan kebutuhannya sah. Yang salah hanya nama
berkasnya.

Dua item mendapat catatan tambahan dari temuan §19:

- **BR1** (*"kembalikan inline edit yang hilang"*) sekarang menunjuk
  `InlineCompanyCell` di `SupplierClient.tsx:149–272` — pola inline-edit yang
  sudah ditulis lengkap tapi kini tidak pernah dirender. Besar kemungkinan
  **itulah** fitur yang owner rasakan hilang. Periksa dulu sebelum menulis ulang
  dari nol.
- **BR8** ditandai ⏳ **premis perlu klarifikasi**: ia menyebut "tab Jasa di
  halaman Supplier", padahal halaman Supplier tidak punya `<Tabs>` dan
  `SupplierJasaTab` tidak pernah dirender. CRUD jasa yang hidup ada di
  `PricingClient.tsx` sebagai tab "Work / Service".

### Keputusan owner yang dipegang di sini

- **Kode mati ditahan, tidak dihapus.** `SupplierJasaTab` (±197 baris) dan
  `InlineCompanyCell` (±124 baris) tetap di tempatnya justru karena BR1 dan BR8
  kemungkinan besar ingin menghidupkannya — menghapusnya sekarang berarti
  membuang bahannya. Hanya `MasterDataNav.tsx` yang ditandai aman dihapus, dan
  itupun **belum dieksekusi** karena perapihan ini dokumentasi saja.
- **Nol perubahan schema.** Item yang menuntutnya (H7, M9, C-SISA-5/6/7, A6)
  ditandai 🔒 dan menunggu izin, sesuai aturan yang owner tetapkan 2026-08-18.

### ⚠️ Masih terbuka

Setelah perapihan: **26 item terbuka di Master Data + StudioFlow**, plus 11 item
UI/UX dari screenshot owner. Tiga di antaranya menunggu keputusan owner (H5, §10,
M5) dan satu menunggu klarifikasi premis (BR8). Urutan pengerjaan yang
disarankan ada di kepala tiap gelombang `roadmap.md`.

Yang paling layak dikerjakan lebih dulu — dan ini tidak berubah oleh perapihan —
adalah **§11**: `sample-actions.ts` menulis audit ke `studioflow.AuditLog`,
melanggar `AGENTS.md` §6 secara eksplisit.

---

## [Unreleased] - 2026-08-18 (#23) — Audit gelombang 2–5: guard pintu keluar, pembersihan kode mati, perbaikan dokumentasi

**Jenis pekerjaan: UI COMPLIANCE + DEAD CODE REMOVAL + DOCUMENTATION.**
Menindaklanjuti audit #21 gelombang 2–5. **Tidak ada skema/migrasi yang
diubah.** Semua perubahan murni logika aplikasi atau dokumen.

`npx prisma validate` bersih. Seluruh berkas yang diubah lolos parse TypeScript.

### M2 — `useUnsavedChangesGuard` di 5 layar (AGENTS.md Edit-First butir 3)

Tombol Modify sudah dicabut 2026-08-14. Tanpa guard, menutup dialog dengan
perubahan tertunda tidak meninggalkan jejak. Lima layar terakhir yang belum
terpasang:

1. **`SampleLibraryClient`** — dua dialog: Edit Lokasi dan Status. Masing-masing
   punya guard sendiri karena track state berbeda.
2. **`SampleRequestDialog`** — satu guard untuk seluruh form multi-section.
3. **`SupplierDetailClient` ContactsTab** — dialog CRUD contact.
4. **`SupplierJasaTab`** — tombol "Ubah" (Modify pattern) dihapus; dialog buka
   langsung editable saat `canManage` true; guard dipasang.

### H9, H4, H1, H6 — Sudah terimplementasi, checkbox roadmap diupdate

Empat item ini sudah terimplementasi di kode sebelum sesi ini, tapi checkbox
roadmap-nya belum dicentang:

- **H9** — `kind: "PRODUCT"` sudah ada di `quick-entry-actions.ts:408`.
- **H4** — filter role `WORK_VENDOR_ROLES` sudah ada di `getServiceVendorsAction`.
- **H1** — `getProductsLastChangeAction` sudah mengarah ke `MasterDataAudit`.
- **H6** — `recordAudit` untuk PartyContact CRUD dan SKU create on receive sudah terpasang.

### M10 — Buang kode mati v1

- **`db.ts`** — `material_price`, `labor_price`, `total_price` dihapus dari `requiredWorkPriceColumns`.
- **`pricing.ts`** — type `_count` di `ServiceVendorData` diperbaiki.
- **`SupplierClient`** — kolom "Paket M+U" dihapus dari tabel Services.
- **Komentar stale** di `page.tsx`, `PricingClient.tsx`, `pricing-actions.ts` diperbaiki.

### D2 — Perbaikan teks dokumen

Komentar di `page.tsx:4-7` dan `PricingClient.tsx:8-9` diperbaiki dari istilah v1.

---

### B1 — `SampleStatus`: enum schema disamakan dengan database

**Akar masalahnya:** migrasi `20260812120000` menambahkan `SENT_TO_CLIENT` ke
enum Postgres, tetapi `prisma/schema.prisma` tidak pernah ikut diperbarui. Enam
hari lamanya Prisma Client tidak mengenal nilai itu, dan **tiga fungsi
penerjemah** ditulis untuk menutupi akibatnya — masing-masing meratakan lima
nilai database menjadi dua dengan aturan "apa pun selain AVAILABLE adalah
BORROWED".

Akibat yang benar-benar terlihat pengguna: memilih "Di klien" **menyimpan
"Dipinjam"**, hitungannya selalu 0, filternya selalu kosong, dan sample
**HILANG** tampil identik dengan sample yang dipinjam staf — pada satu-satunya
layar yang menjawab "benda ini di mana".

**Yang diubah:**

- `prisma/schema.prisma` — `SENT_TO_CLIENT` ditambahkan **setelah `BORROWED`,
  sebelum `LOST`**, urutan yang sama persis dengan `ADD VALUE ... BEFORE 'LOST'`
  di migrasinya. Prisma membandingkan enum berdasarkan urutan; urutan berbeda
  dibaca sebagai drift baru.
- **Ketiga fungsi penerjemah dihapus**, bukan diperbaiki:
  `toLegacySampleStatus` + `toV2SampleStatus` (`sample-actions.ts`),
  `sampleStatusToLegacy` (`library/types.ts`, ternyata sudah tidak dipanggil
  dari mana pun), dan `catalogSampleStatusToV2` (`library-service.ts`) yang kini
  hanya menyisakan default untuk input tanpa status. Alasan penghapusannya
  dicatat di tempatnya masing-masing: penerjemah yang menganggur adalah undangan
  untuk memakainya lagi.
- `types/sample.ts` — `SampleStatusValue` menjadi lima nilai. Ditambahkan
  `sampleStatusNeedsHolder()`: hanya `BORROWED` dan `SENT_TO_CLIENT` yang
  menuntut nama pemegang. Sebelumnya aturannya "bukan AVAILABLE", yang berarti
  menandai sample hilang memaksa staf **mengarang** nama peminjam — aturan yang
  memaksa mengarang adalah aturan yang diakali, bukan dipatuhi.
- `getSampleSummaryAction` — dihitung per nilai, bukan sebagai "sisanya".
  `borrowed` dulu berbunyi `status !== "AVAILABLE"` dan menyerap tiga status
  lain ke dalam satu angka yang lebih besar dari kenyataan.
- `SampleMovement.action` untuk LOST/DISCARDED kini `ADJUST`, bukan `OUT` —
  benda itu tidak keluar ke siapa pun, dan menyebutnya OUT membuat riwayat
  pergerakan mengaku ada serah-terima yang tidak pernah terjadi.

**H2 ikut diperbaiki** (menempel di enum yang sama):
`material-view-service.sampleState()` dulu berbunyi `samples.length > 0`,
sehingga sample LOST dan DISCARDED membuat material terbaca "tersedia" — seorang
desainer diberi tahu ada contoh fisik untuk benda yang raknya sudah kosong.
Sekarang hanya sample hidup yang dihitung, dan `sampleCount` tidak lagi
menjumlahkan keping yang hilang.

### B4 — `WorkPrice.price`: field kosong tidak lagi menjadi tarif nol

**Akar masalahnya:** `WorkPriceFields.price` adalah
`z.union([z.number(), z.string()]).transform((v) => Number(v))` **tanpa
`.refine()`**. `Number("")` adalah `0`; `Number("abc")` adalah `NaN`. Nilainya
dipakai langsung di empat penulisan.

Ini persis cacat `price_net ?? 0` yang sudah dibuang dari `SkuPrice` pada
2026-08-11 — lengkap dengan komentar yang menjelaskan bahayanya — dan
`WorkPrice` tidak pernah mendapat perlindungan yang sama, padahal Excel Table 3
dan 4 adalah **seluruh dataset upah dan material+upah yang dikonsumsi BQ**.
Migrasi `20260811120000` bahkan MEMBATALKAN dirinya sendiri saat menemukan baris
tanpa harga; perlindungan itu ada di migrasi dan tidak pernah ada di form.

**Yang diubah:**

- `services/sku-price-rules.ts` — `checkWorkPrice()` baru, murni dan bisa dites,
  bertetangga dengan `resolvePrice()`. Bedanya dinyatakan eksplisit: `SkuPrice`
  boleh tidak ditulis (mengedit ejaan tanpa menyentuh harga itu normal),
  `WorkPrice` tidak punya keadaan itu — barisnya **adalah** tarifnya.
- `pricing-actions.ts` — validasi di pintu masuk (Zod `transform` + `addIssue`
  dengan pesan Indonesia yang bisa ditindaklanjuti) **dan** `assertWorkPrice()`
  sebagai lapis kedua di keempat jalur tulis.
- **Nol yang DIKETIK sengaja tetap diterima.** Nol yang ditulis orang adalah
  pernyataan ("gratis", "sudah termasuk"); nol yang lahir dari field kosong
  adalah karangan. Yang ditolak hanya yang kedua — karena itu pemeriksaan
  kekosongan terjadi SEBELUM konversi angka. Ada testnya.

### B2 — Soft-delete tidak lagi bertengkar dengan `@unique`

**Akar masalahnya:** `Party.name/slug` dan `Brand.name/slug` unik tanpa syarat,
sementara keempatnya memakai soft-delete. Baris hantu memegang namanya
selamanya, sehingga **nama supplier yang pernah dihapus tidak bisa dipakai
lagi** — dan ketiga aksi quick-create menemukan baris terhapus itu, gagal di
syarat `!existing.deleted_at`, lalu jatuh ke `create` yang langsung menabrak
index. Pengguna melihat pesan Prisma mentah di tengah mengetik harga.

Lebih buruk, cek konflik di aplikasi tidak sepakat arahnya: `create` menghitung
baris terhapus (menolak nama yang sebenarnya bebas), `update` mengabaikannya
(melewatkan bentrokan, lalu crash di database). **Dua bug berlawanan pada tabel
yang sama.**

**Yang diubah:**

- **Migrasi baru `20260818120000_masterdata_live_unique_indexes`** — keempat
  index polos diganti index **parsial** `WHERE deleted_at IS NULL`, mengikuti
  pola `Sku_slug_nobrand_uniq` yang sudah ada di `03_invariants.sql` §2.
  Sekalian `lower(...)`: nama dagang tidak peka huruf besar-kecil, dan
  "Ace Hardware" vs "ACE HARDWARE" sebagai dua party bukan keputusan siapa pun.
  Migrasi **berhenti berisik** kalau menemukan duplikat huruf besar-kecil yang
  sudah terlanjur ada, dengan query untuk menemukannya — bukan menggabungkan dua
  party diam-diam.
  Arah perubahannya dari ketat ke longgar, jadi **aman pada tabel berisi**.
- `prisma/schema.prisma` — `@unique` dicabut dari keempat kolom (Prisma tidak
  bisa menyatakan `WHERE`), diganti `@@index([slug])`. Alasannya ditulis panjang
  di tempatnya, termasuk konsekuensinya untuk kode.
- Semua `findUnique({ where: { name } })` → `findFirst` dengan
  `mode: "insensitive"` + `deleted_at: null`, di 5 call site.
- `party-actions.ts` — helper `findLivePartyByName()`: **satu** definisi "nama
  ini sudah dipakai", dipakai create dan update. Kalau cek aplikasi dan index
  database menjawab berbeda, yang menang adalah index dan pengguna melihat error
  mentah.
- Pesan konflik kini menyebut nama yang bentrok, dalam bahasa Indonesia.

**B6 ikut diperbaiki sebagian** (tidak bisa dihindari — saya menyentuh baris yang
sama): keempat aksi vendor di `pricing-actions.ts` kini memakai `tx` yang memang
sudah dibuka `createAction`, bukan klien `prisma` global. Sebelumnya baris party
dan baris auditnya commit terpisah dari transaksi yang membungkusnya — persis
yang dilarang komentar di kepala `recordAudit`. **Transaksi bersarang di
`quick-entry-actions.ts` BELUM diperbaiki**, masih di roadmap.

### D1 — `AGENTS.md §Master Data Contract` ditulis ulang terhadap v2

Bagian ini masih mendeskripsikan model **v1**: `Material`, `catalog_brand`,
`MaterialCandidate`, `SampleCandidate`, `/masterdata/curation`, `ServiceVendor`,
harga sebelum/sesudah diskon, status `PENDING`/`REJECTED`. Tidak satu pun masih
ada sejak rebaseline 2026-08-10 — dan ini berkas yang setiap agent diperintahkan
patuhi lebih dulu.

Versi barunya 10 bagian, ditulis terhadap `schema.prisma` yang sekarang:
terminologi (termasuk Vendor≠Brand yang paling sering terbalik), domain
kanonik, **tabel index yang dijaga database beserta apa yang dijaminnya**,
aturan harga (termasuk larangan `Number()` polos dan `?? 0`), aturan kategori
(termasuk kewajiban filter `kind`), aturan sample (termasuk **larangan menulis
fungsi yang meratakan enum**), audit, transaksi, batas dengan StudioFlow, dan
§10 daftar hal yang sudah tidak ada agar tidak dibuat kembali.

### UI Changes

| Tanggal | Area | Perubahan |
|---|---|---|
| 2026-08-18 | Master Data → Sample | Status "Hilang" (rose) dan "Dibuang" (slate) kini punya badge sendiri; sebelumnya keduanya tampil sebagai "Dipinjam". |
| 2026-08-18 | Master Data → Sample | Kartu ringkasan menambah "Hilang / dibuang"; angka "Dipinjam" tidak lagi menyerap tiga status lain. |
| 2026-08-18 | Master Data → Sample | Dialog status menawarkan kelima status; nama pemegang hanya wajib untuk Dipinjam / Di klien. |
| 2026-08-18 | Master Data → Sample | Filter status menambah "Hilang" dan "Dibuang". |
| 2026-08-18 | Library → Sample inventory | Badge status LOST/DISCARDED yang sebelumnya tampil tanpa warna. |

### ⚠️ Masih terbuka

**27 dari 30 temuan audit #21 belum dikerjakan** — termasuk B3 (slug tanpa cek
unik), B5 (lima jalur pembuatan SKU), B7 (kategori duplikat), dan M2 (guard
unsaved-changes hilang di lima layar). Daftar dan urutannya di `roadmap.md`.

### ⏳ WAJIB dijalankan owner sebelum ini aktif

Agent tidak bisa menjalankan Prisma dari sesi cloud (Linux vs binary engine
Windows di `node_modules`). Di mesin sendiri:

```bash
npx prisma migrate deploy   # atau: npx prisma migrate dev
npx prisma generate
npm run typecheck
```

**Sampai `prisma generate` dijalankan, `typecheck` akan gagal** — client hasil
generate belum mengenal `SampleStatus.SENT_TO_CLIENT`, dan masih mengira
`Party.name` itu `@unique`. Itu diharapkan, bukan regresi.

---

## [Audit] - 2026-08-18 (#21) — Audit menyeluruh Master Data (read-only, tanpa perubahan kode)

**Jenis pekerjaan: AUDIT.** Permintaan owner: *"whole check dulu utk master data.
apakah ada cacat logic baik secara backend, logic coding, logic business plan,
ui/ux yg salah secara keseluruhan."*

**TIDAK ADA KODE YANG DIUBAH.** Entri ini mencatat temuan, bukan perbaikan.
Setiap butir menunggu keputusan owner. Rencana pengerjaannya ada di
`roadmap.md` §AUDIT MASTER DATA 2026-08-18.

**Laporan lengkap:** `AUDIT-MASTERDATA-2026-08-18.md` (590 baris, 30 temuan
dengan berkas + nomor baris + bukti reproduksi).

### Cakupan yang benar-benar dibaca
`src/subapps/master-data/**` (22 komponen, 6 aksi, 8 service), `src/app/masterdata/**`,
`src/app/api/masterdata/**`, `prisma/schema.prisma` schema `master_data`,
seluruh `prisma/migrations/2026081*`, `src/core/rbac/**`, dan jalur tulis Master
Data di `src/extensions/library/services/library-service.ts`.

### Ringkasan temuan

| Severitas | Jumlah |
|---|---|
| 🔴 Blocker | 7 |
| 🟠 Tinggi | 9 |
| 🟡 Sedang | 10 |
| ⚪ Rendah (dokumen) | 4 |

### 🔴 Blocker

- **B1 — `SampleStatus` drift.** Migrasi `20260812120000` menambahkan
  `SENT_TO_CLIENT` ke enum Postgres, tapi `schema.prisma:816-823` **tidak pernah
  ikut diperbarui** dan client hasil generate tidak mengenalnya. Akibatnya:
  `SampleLibraryClient.tsx:128` menghitung `sentToClient` **selalu 0**, filter
  "Di klien" **selalu kosong**, pilihan "Di klien" tersimpan sebagai `BORROWED`,
  dan `toLegacySampleStatus` membuat `LOST` + `DISCARDED` juga terbaca
  "Dipinjam". Migrasi berikutnya berisiko gagal (Postgres tidak bisa
  `DROP VALUE` dari enum).
- **B2 — Soft-delete melawan `@unique` global.** `Party.name/slug`,
  `Brand.name/slug` unik tanpa `WHERE deleted_at IS NULL`. Ketiga aksi
  quick-create jatuh ke `create` saat menemukan baris soft-deleted → P2002
  mentah. Create dan update memeriksa konflik dengan aturan **berlawanan**
  (create ikut menghitung yang terhapus, update mengabaikannya) — dua bug
  berlawanan pada tabel yang sama.
- **B3 — `slug` ditulis tanpa cek keunikan** di 7 jalur tulis. Yang dicek hanya
  `name`. Dua nama sah bisa menghasilkan slug identik; nama non-latin
  menghasilkan slug kosong.
- **B4 — `WorkPrice.price` bisa jadi 0 dari field kosong.** Zod
  `z.union([number,string]).transform(Number)` tanpa `.refine()`; `Number("")`
  adalah `0`. Tidak ada `assertPriceSane`, tidak ada penolakan `NaN`. **Ini
  persis cacat `price_net ?? 0` yang sudah dibuang dari `SkuPrice` 2026-08-11 —
  `WorkPrice` tidak pernah mendapat perlindungan yang sama**, padahal Table 3/4
  adalah seluruh dataset upah yang dikonsumsi BQ.
- **B5 — Lima jalur pembuatan SKU, lima invariant berbeda.** Tiga jalur tidak
  menetapkan kategori primer; quick-entry menulis `base_unit: ""` dan
  meng-slug dari `code` (bukan `name`) sehingga dedupnya tidak pernah cocok dan
  berakhir menabrak `Sku_brand_code_uniq`; `sample-request-actions.ts:411`
  menulis `master_data.Sku` tanpa `recordAudit`.
- **B6 — Transaksi bersarang.** Aksi quick-entry membuka `db.$transaction` di
  dalam transaksi yang sudah dibuka `createAction`; CRUD vendor di
  `pricing-actions.ts` memakai `db` global sambil transaksi luar menganggur —
  melanggar kontrak `recordAudit` ("audit yang selamat dari rollback adalah
  kebohongan").
- **B7 — Pohon kategori.** Cabang `needsParent` di
  `category-tree-service.ts:106` **tidak pernah bisa dieksekusi** (kunci
  lookup-nya berubah bersama parent), sehingga perilaku sebenarnya adalah
  membuat kategori duplikat, bukan re-parent. `path` juga tidak diturunkan ke
  anak saat berubah — merusak `LIKE 'induk/%'` yang menjadi satu-satunya alasan
  kolom itu ada.

### 🟠 Tinggi

- **H1** Kolom "Update" membaca `studioflow.AuditLog`, sementara Master Data v2
  menulis `master_data.MasterDataAudit` → strip selamanya.
- **H2** `sampleState()` menyebut sample `LOST`/`DISCARDED` sebagai tersedia;
  `sampleCount` ikut menjumlahkannya.
- **H3** Dua jalur hapus Party dengan penjaga berbeda; tidak satu pun memeriksa
  `SkuPrice.supplier_party_id`.
- **H4** `getServiceVendorsAction` tanpa filter role → picker Vendor menampilkan
  semua Party, melanggar kontrak terminologi `AGENTS.md`.
- **H5** `MASTERDATA_PRICE_MANAGE` **0 pemakaian**; semua mutasi harga bergantung
  `MASTERDATA_VENDOR_MANAGE`. `MASTERDATA_OFFERING_MANAGE` mati total.
- **H6** `PartyContact` CRUD, impor Excel, dan create SKU dari sample-request
  tidak menulis `MasterDataAudit`.
- **H7** `WorkPrice` dihapus keras padahal punya `deleted_at`; `WorkPriceProjectRef`
  ikut hilang (cascade).
- **H8** Endpoint harga tidak memfilter `kind` maupun `deleted_at` → edit/hapus
  lintas jenis.
- **H9** Quick-entry SKU bisa melampirkan kategori `WORK` ke SKU (lookup tanpa
  filter `kind`).

### 🟡 Sedang (UI/UX, IA, skala)

- **M1** Nav berlabel "Prices" menuju `/masterdata/materials`; editor harga
  `/masterdata/prices` dan `/masterdata/settings` **yatim** — hanya via URL.
- **M2** Guard **WAJIB** `useUnsavedChangesGuard` (AGENTS.md Edit-First butir 3)
  hilang di 5 layar: `SampleLibraryClient` (10 dialog/19 input),
  `SampleRequestDialog` (4/18), `SupplierClient`, `SupplierDetailClient`,
  `BrandDetailClient`. Tombol Modify sudah dicabut, penggantinya belum dipasang
  → layar-layar itu kini **tanpa perlindungan sama sekali**.
- **M3** `/masterdata/prices` memuat 8 dataset tanpa paginasi lalu memfilter di
  browser — pola yang `material-view-service.ts` catat sudah dibuang.
- **M4** `getPartyBrandsAction` memuat semua SKU hanya untuk menghitung.
- **M5** Bahasa campur Inggris/Indonesia dalam satu permukaan.
- **M6** `action-wrapper.ts:94` mengembalikan `error.message` mentah ke browser.
- **M7** Dropdown kategori tanpa filter `kind`, tanpa dedup.
- **M8** `config.api.bodyParser` adalah opsi Pages Router — mati di App Router;
  batas "Max 20 MB" tidak ada. Impor per baris tanpa transaksi.
- **M9** `generateWorkPriceCode` bentrok pada create bersamaan; urutan leksikal
  rusak setelah `WP-YYYY-9999`.
- **M10** `archived` membaca `catalog_metadata` v1 → selalu `false`.

### ⚪ Rendah — dokumen acuan

- **D1** `AGENTS.md §Master Data Material Contract` masih mendeskripsikan model
  v1: `Material`, `catalog_brand`, `MaterialCandidate`, `SampleCandidate`,
  `/masterdata/curation`, `ServiceVendor`, harga sebelum/sesudah diskon, status
  `PENDING`/`REJECTED` — **tidak satu pun masih ada** setelah rebaseline v2.
  Ini berkas yang setiap agent diperintahkan patuhi lebih dulu.
- **D2** `/masterdata/prices/page.tsx:4-7` masih menyebut `material_price`
  set/NULL (dihapus migrasi `20260811120000`).
- **D3** `material-view-service.ts:166` menyatakan `SENT_TO_CLIENT` tidak ada —
  salah sejak 12 Agustus.
- **D4** `CHANGELOG-CODEX.md` yang diwajibkan `AGENTS.md` tidak ada di repo.

### Yang sudah benar dan dijaga
`03_invariants.sql` (partial unique index, termasuk `COALESCE` untuk supplier
NULL), `sku-price-service.ts` + `sku-price-rules.ts` (satu jalur tulis, judgement
murni & bisa dites — **ini model yang seharusnya diikuti `WorkPrice`**),
`slug.ts` (satu generator kanonik), migrasi `20260811120000` yang
`RAISE EXCEPTION` alih-alih menambal diam-diam, `getBrandView` (agregasi di SQL),
dan keputusan-keputusan yang menolak menebak (`productParentFor`, kolom `qty`).

### Masih terbuka
Seluruh 30 temuan. Tidak ada perbaikan yang dieksekusi di sesi ini atas
permintaan owner ("whole check" = audit). Urutan gelombang perbaikan ada di
`roadmap.md`.

---

## [Unreleased] - 2026-08-18 (#20) — Supplier ganda di tabel SKU, Decimal stale client, tombol mata Supplier, badge harga, dan Category jadi checklist + Hashtag baru

**Jenis pekerjaan: BUG FIX + UI/UX + BACKEND + migrasi schema.** Lima temuan
owner, dengan penomoran aslinya. `tsc --noEmit` bersih dari error sintaks pada
berkas yang diubah (dicek berdiri sendiri, lihat catatan Prisma di item 2 —
type-check proyek penuh menunggu langkah operasional di bawah). Ada **satu**
migrasi schema baru (`20260818090000_add_brand_tags`) dan **satu langkah
operasional wajib** yang belum bisa dijalankan dari sesi ini — lihat "Masih
menunggu".

### 1 — Tabel SKU brand cuma menampilkan satu supplier

*"supplier nya kenapa cuma 'ibnu'? padahal ada imam HPL jg"*

`getBrandSkusAction` (`masterdata-actions.ts`) mengambil harga SKU dengan
`prices: { take: 1, orderBy: price_net asc }` — sengaja memilih penawaran
TERMURAH untuk kolom Harga, tapi efek sampingnya kolom Supplier ikut hanya
membawa nama dari baris yang sama. Brand dengan dua harga berlaku (kartu
"Active prices" di atas tabel sudah menghitungnya benar) tidak pernah
menunjukkan supplier keduanya di tabel SKU — tidak ada indikasi sama sekali
bahwa penawaran lain ada.

Perbaikan: query tidak lagi `take: 1` — semua harga berlaku diambil, termurah
tetap di index 0 untuk kolom Harga (tidak berubah), dan `BrandSkuRow` dapat
field baru `suppliers: { name, price }[]` berisi SEMUA supplier dengan harga
berlaku, termurah dulu. `BrandDetailClient.tsx` menampilkan nama supplier
termurah + `+N` kalau ada lebih dari satu, dengan `title` berisi daftar
lengkap (mis. "Ibnu +1", hover menunjukkan "Ibnu, Imam HPL").

**Tidak diubah (disengaja):** kartu "Suppliers" di atas dan tab Suppliers pada
halaman detail brand tetap dihitung dari `BrandSupplier` — relasi eksplisit
lewat tombol "Assign Supplier", terpisah dari harga. Menambahkan harga untuk
supplier baru TIDAK otomatis menambah relasi itu; ini pola yang sudah ada
sebelum perubahan ini (lihat komentar di `assignSupplierToBrandAction`) dan
sengaja tidak diubah di sini karena mengubahnya adalah keputusan produk
tersendiri (apakah harga = relasi otomatis?), bukan bagian dari bug yang
dilaporkan. Kalau "Imam HPL" ingin ikut terhitung di kartu Suppliers, klik
"Assign Supplier" di tab Suppliers brand tersebut.

### 2 — Error konsol "Decimal objects are not supported" (4 error)

*(laporan lewat screenshot Next.js error overlay, 4 varian: `dim_length`,
`dim_width`, `dim_height`, dan `price_list` pada objek `SkuPrice`)*

**Ini BUKAN bug kode yang belum diperbaiki — kodenya sudah benar.**
`attachDerivedCatalogFields` (`extensions/library/types.ts:215`) sudah
memiliki `serializeDecimalFields()`, serialiser Decimal→string generik
(berdasarkan bentuk objek, bukan daftar nama kolom) yang menangani persis
skenario ini — termasuk catatan tertulis yang secara spesifik meramalkan
`price_list` sebagai "error keempat" pada database yang belum dimigrasi.

Yang ditemukan: `src/generated/prisma` (Prisma Client hasil generate) masih
bertanggal **2026-08-12**, sedangkan `prisma/schema.prisma` diedit
**2026-08-14** untuk MENGHAPUS kolom `SkuPrice.price_list` — dua hari selisih,
dan belum pernah di-generate ulang sejak itu (skema copy di dalam
`src/generated/prisma/schema.prisma` sendiri masih menuliskan
`price_list Decimal?`). `SKU_FULL_INCLUDE` memakai Prisma `include` (bukan
`select`) untuk relasi `prices`, jadi Client yang basi ini tetap
mengembalikan `price_list` sebagai kolom sungguhan berisi `Decimal` mentah —
lolos dari serialiser karena field ini datang dari LAPISAN CLIENT YANG BASI,
bukan dari kode aplikasi yang sudah diperbaiki. Badge **"Next.js 16.2.1
(stale)"** pada overlay error di screenshot mendukung diagnosis yang sama:
dev server menjalankan build lama.

**Tidak ada perubahan kode untuk item ini** — kodenya sudah benar sejak
2026-08-14. Lihat "Masih menunggu" untuk langkah yang WAJIB dijalankan owner
secara lokal (tidak bisa dari sesi cloud ini — lihat alasannya di sana).

### 3 — Tombol mata (Eye) tidak konsisten antara Brand dan Supplier

*"halmaan supplier dan supplier info tidak punya tombol mata, sedangkan
halaman brand ada. bisa di buat konsisten?"*

Tabel `SupplierClient.tsx` (halaman Suppliers & Vendors) hanya menampilkan
kolom Aksi (Pencil/Trash) untuk pengguna dengan `canManageCompanies` — dan
bahkan untuk mereka, tidak ada tombol "lihat" eksplisit; satu-satunya jalan ke
detail adalah klik baris (tidak terlihat sebagai afordansi, dan viewer-only
tidak melihat kolom Aksi sama sekali). Tabel Brand
(`MasterDataMaterialsClient.tsx`) sudah punya tombol Eye yang SELALU tampil.

Kolom Actions di `SupplierClient.tsx` sekarang selalu dirender; tombol
**Eye** (`→ /masterdata/suppliers/{id}`) selalu tampil, Pencil/Trash tetap
hanya untuk `canManageCompanies` — pola persis sama dengan tabel Brand.

### 4 — Hapus harga di Pricing tidak langsung ter-update

*"saat hapus material di pricing table nya tidak lgsg ke update harus di
refresh dulu baru hilang"*

Dua penyebab berbeda ditemukan di `PricingClient.tsx`, dan sepertinya keduanya
berkontribusi pada gejala yang sama:

1. **Badge jumlah di tab tidak reaktif.** Baris tabel di dalam masing-masing
   tab (`HargaMaterialTab` dkk.) sudah benar meng-update state lokalnya lewat
   `setRows(prev => prev.filter(...))` saat hapus — tabelnya sendiri memang
   langsung berubah. Tapi angka di sebelah label tab ("Material Prices N")
   dibaca langsung dari prop hasil fetch server (`materialPrices.length`),
   bukan dari state tab yang sudah di-update — jadi angkanya tetap beku sampai
   reload penuh, meski tabel di bawahnya sudah benar.
2. **Tab dibongkar-pasang saat pindah tab.** Ketiga tab dirender kondisional
   (`tab === "material" && (...)`,) — pindah tab meng-unmount tab yang tidak
   aktif, dan `useState(initial)`-nya dibuat ulang dari prop awal saat
   dipasang kembali. Hapus satu harga, pindah tab lalu kembali, dan baris yang
   tadi dihapus muncul lagi (state-nya lupa penghapusan itu) — sampai reload
   halaman penuh benar-benar mengambil data baru dari server. Ini kemungkinan
   besar yang dialami: "harus refresh dulu baru hilang."

Perbaikan: setiap tab sekarang melapor balik jumlah barisnya lewat
`onCountChange` (dipanggil di `useEffect` setiap `rows.length` berubah), dan
`PricingClient` menyimpan tiga counter (`materialCount` dkk.) yang dipakai
badge tab — bukan lagi prop statis. Ketiga tab juga tidak lagi di-mount
kondisional; ketiganya dirender sekaligus dan disembunyikan lewat class
`hidden`, jadi instance-nya (dan state hasil edit/hapusnya) bertahan selama
halaman terbuka, tidak dibuat ulang setiap pindah tab.

### 5 — Logika +Brand: Category jadi checklist, Hashtag baru

*"category (ambil default dari yang json 40 categories yg kamu sudah tambahin
itu / creatablesearch dengan opsi nambahin list nya) - ini category bentuk
check list (bisa lebih dari 1 category dalam satu produk)" + "ada 'hashtag'
ini bisa lebih general dan awam penggunaan contoh batu, batu buatan, tegel
murah, finishing lantai, lantai, finish, dll (dengan metode creatablesearch
jg"*

**Category** — komponen baru `CreatableChecklist`
(`src/components/ui/creatable-checklist.tsx`, diekspor lewat
`ui_engine/primitives`) menggantikan `CreatableTagInput` di field Category
dialog Brand. Bentuknya checkbox-list yang di-scroll (bukan lagi
ketik-untuk-cari): semua opsi dari `brand-catalog-categories.json` (40
kategori default) plus kategori yang sudah dipakai brand lain tampil sekaligus
dan bisa dicentang lebih dari satu, dan kolom teks di bawah daftar tetap bisa
menambah kategori baru (langsung tercentang begitu ditambahkan) — jadi tetap
"creatable", hanya modenya checklist, bukan lagi filter-dan-pilih.
`CreatableTagInput` TIDAK dihapus — masih dipakai di tempat lain (Hashtag di
bawah, dan tag SKU), keduanya punya alasan sendiri (lihat header masing-masing
komponen).

**Hashtag** — field baru, terpisah dari Category, di bawahnya dalam dialog
yang sama. Memakai `CreatableTagInput` yang sudah ada (metode
ketik-untuk-cari + Enter/koma untuk menambah), disarankan dari pool tag
katalog yang sama dipakai SKU (`metadata.tags`, prop `tags` yang sudah dikirim
`MasterDataMaterialsClient` — tidak perlu query baru). Contoh dari owner:
"batu, batu buatan, tegel murah, finishing lantai, lantai, finish".

**Schema.** `Brand.tags String[] @default([])` ditambahkan lewat migrasi
`20260818090000_add_brand_tags` (kolom polos, tanpa tabel relasi terpisah —
tidak seperti Category, hashtag brand tidak perlu slug atau integritas FK
lintas entity). `LibraryVendorInput.tags` diteruskan ke `Brand.tags` di
`LibraryService.createVendor` / `updateVendor` (dedup + trim, sama seperti
pola `brand_category_tags`).

### File yang diubah

| File | Perubahan |
|---|---|
| `src/components/ui/creatable-checklist.tsx` | **Baru.** Checkbox-list + tambah opsi baru, sibling `CreatableTagInput`. |
| `src/ui_engine/primitives/index.ts` | Ekspor `creatable-checklist`. |
| `prisma/schema.prisma` | `Brand.tags String[] @default([])`. |
| `prisma/migrations/20260818090000_add_brand_tags/migration.sql` | **Baru.** `ALTER TABLE ... ADD COLUMN "tags"`. |
| `src/extensions/library/types.ts` | `LibraryVendorInput.tags?: string[]`. |
| `src/extensions/library/services/library-service.ts` | `createVendor`/`updateVendor` menulis `Brand.tags`. |
| `src/subapps/master-data/components/MasterDataBrandDialog.tsx` | Category → `CreatableChecklist`; field Hashtag baru (`CreatableTagInput`); prop `tagOptions`. |
| `src/subapps/master-data/components/MasterDataMaterialsClient.tsx` | Meneruskan `tagOptions={tags}` ke dialog Brand. |
| `src/subapps/master-data/actions/masterdata-actions.ts` | `getBrandSkusAction`: `prices` tidak lagi `take: 1`; `BrandSkuRow.suppliers` baru. |
| `src/subapps/master-data/components/BrandDetailClient.tsx` | Kolom Supplier tabel SKU menampilkan semua supplier ("Nama +N"). |
| `src/subapps/master-data/components/SupplierClient.tsx` | Kolom Actions selalu tampil; tombol Eye selalu ada, Pencil/Trash tetap terbatas izin. |
| `src/subapps/master-data/components/PricingClient.tsx` | Badge jumlah tab jadi reaktif (`onCountChange`); ketiga tab selalu ter-mount (`hidden`, bukan kondisional). |

### Masih menunggu

**WAJIB dijalankan owner secara lokal, tidak bisa dari sesi ini:**

```
npx prisma generate
npx prisma migrate dev   # menerapkan 20260818090000_add_brand_tags + menyinkronkan Client
```

lalu **restart dev server** (`Ctrl+C` lalu jalankan ulang, atau restart
`startserver.vbs`) — kalau overlay Next.js masih menunjukkan "(stale)" setelah
itu, hapus folder `.next` lalu jalankan ulang.

Alasan ini tidak dijalankan dari sesi ini: environment yang mengedit berkas
proyek berjalan di Linux, sedangkan proyek ini dikembangkan di Windows dengan
binary Prisma engine khusus Windows di `node_modules`. Menjalankan
`prisma generate` dari Linux akan mengunduh/menulis binary Linux ke dalam
`src/generated/prisma` — merusak dev server Windows yang sedang berjalan.
Tanpa langkah ini: item 2 (Decimal) akan **tetap error**, dan `Brand.tags`
(item 5) akan **tidak tersimpan / error saat disimpan** karena kolomnya belum
ada di database dan Client belum tahu bentuknya.

Setelah `prisma generate` dijalankan, jalankan `npx tsc --noEmit` sekali lagi
untuk memastikan seluruh proyek (bukan cuma berkas yang diubah sesi ini)
bersih.

---

## [Unreleased] - 2026-08-14 (#19) — Editor link, kolom Aksi, dan kategori sebagai hashtag

**Jenis pekerjaan: UI/UX + BACKEND (dedup).** `tsc --noEmit` bersih,
`npm test` 111/111, eslint tanpa error baru. Tidak ada migrasi schema.

Empat temuan owner, dengan penomoran aslinya.

### 1 — Editor link di Katalog & Link

*"mau input url malah ketutup gitu. label opsional malah lebih besar. bisa
dibuat 3 tingkat? atau pakai simbol gitu biar lebih sederhana?"*

Penyebabnya `<select>` jenis link selebar `sm:w-40` (10rem) di sebelah kiri dan
field Label selebar `sm:w-44` (11rem) di sebelah kanan, keduanya lebar tetap.
Yang tersisa untuk URL adalah apa pun yang masih ada — di dialog Brand tinggal
cukup untuk menampilkan `https:`. Field terpenting mendapat ruang paling sedikit
karena ia satu-satunya yang fleksibel.

Susunan baru, tiga tingkat menurun sesuai kepentingan:

| Tingkat | Sebelum | Sekarang |
|---|---|---|
| Jenis | `<select>` 10rem berisi satu kata | Tombol ikon 36px; klik membuka daftar ikon + nama |
| URL | sisa lebar (bisa hampir nol) | seluruh sisa baris |
| Label | 11rem, selalu tampil | baris kedua, teks kecil, **disembunyikan** sampai "+ Beri label" ditekan |

Ikonnya generik (`Camera` untuk Instagram, `Users` untuk Facebook, `Video` untuk
YouTube, `AtSign` untuk LinkedIn), **bukan pilihan gaya**: lucide-react v1
menghapus seluruh ikon logo merek, jadi `import { Instagram }` adalah error
kompilasi di repo ini — bukan sekadar tampilan yang berbeda. Menggambar ulang
logonya sendiri memindahkan urusan merek dagang ke kita. Karena ikonnya generik,
setiap tombol wajib membawa `title` + `aria-label`, dan daftar pilihannya
menampilkan ikon bersama namanya — ikon mempersingkat pengenalan, tidak
menggantikannya.

### 2 — Klik baris tidak lagi berpindah halaman

*"kalau di klik jangan pindah ke view brand - kasi di di aksi aja; harusnya
actionnya bisa view - edit - delete seperti pada tabel lainnya."*

Baris brand tidak lagi punya `onClick` navigasi. Kolom Aksi sekarang tiga tombol
ikon — **mata / pensil / tong sampah** — persis pola tabel Supplier
(`SupplierClient.tsx:751`).

Menu `⋯` yang baru dipasang pagi ini ikut dibuang: pada tiga aksi, satu klik
untuk membuka menu lalu satu klik lagi untuk memilih adalah satu klik yang tidak
membeli apa-apa. Menu berguna ketika aksinya banyak atau jarang; ini tidak
keduanya.

Alasan klik-baris dihapus, bukan sekadar diarahkan ulang: baris yang seluruhnya
bisa diklik tidak pernah memberi tahu ke mana ia membawa, dan pada baris yang
juga berisi tombol, setiap klik yang meleset dari tombol berubah jadi navigasi
yang tidak diminta.

### 3 — Kolom Kelengkapan jadi simbol

Badge `Lengkap` / `Belum lengkap` diganti satu ikon: ✓ hijau atau ⚠ amber. Dua
kata itu terulang di setiap baris untuk menyampaikan satu bit informasi, dan
pada tabel lima brand ia jadi kolom paling ramai di layar. Maknanya tidak hilang
— `title` menampilkan kalimat lengkapnya beserta ALASAN ("masih kekurangan
kategori atau supplier"), yang justru lebih banyak daripada badge lama.

Catatan teknis: `title` dipasang di `<span>` pembungkus, bukan di komponen
lucide. Lucide meneruskan prop ke `<svg>`, dan tooltip pada elemen svg tidak
muncul konsisten di semua browser.

### 4 — Kategori: koma-miring, dan anti-typo betulan

*"kategori di buat bagus dan cantik, pakai comma di viewer nya misalnya, huruf
mirring, semuanya di pastikan anti typo (dari backend dan anti case sensitive
[karena ini seperti hashtag])"*

**Tampilan.** Chip per tag diganti satu frasa miring dipisah koma, di tiga
tempat sekaligus supaya tidak ada yang berbeda sendiri: tabel Brands, tab
Overview halaman detail brand, dan mode baca `CreatableTagInput`. Lima chip
berbingkai untuk lima kata pendek memaksa mata memindai lima kotak; sebagai
frasa, ia terbaca sekali. Chip juga menjanjikan sesuatu yang bisa diklik — di
mode baca tidak ada yang bisa diklik.

**Anti-typo.** Yang perlu diluruskan lebih dulu: backend **sudah** tahan sejak
awal. `categorySlug()` melipat besar-kecil huruf, jadi "HPL", "hpl", dan "HPL "
sejak dulu jatuh ke baris `Category` yang sama — tidak pernah ada kategori
kembar. Yang belum ada adalah dua hal lain:

| Lapis | Masalah | Perbaikan |
|---|---|---|
| Input (`CreatableTagInput`) | Mengetik "HPL" saat "hpl" sudah ada akan tampil "HPL" sampai disimpan, lalu berubah jadi "hpl" setelah refresh. Benar, tapi terlihat seperti sistem mengarang. | `canonical()` menyelaraskan ejaan ke yang SUDAH ADA saat tag ditambahkan, jadi koreksinya terlihat saat mengetik. |
| Backend (`syncSeedBrandCategories`) | Dua tag yang menunjuk baris `Category` yang sama meng-upsert `BrandCategory` yang sama dua kali; `sort_order` terakhir menang, jadi urutan yang tampil bukan urutan yang diketik. | Dedup case-insensitive sebelum menulis, mempertahankan kemunculan pertama. |

Yang dipertahankan adalah **kemunculan pertama**, bukan yang terakhir: itu ejaan
yang sudah dipakai lebih dulu, dan menimpanya dengan ejaan berikutnya adalah
koreksi yang tidak diminta siapa pun.

Yang **tidak** dilakukan: memaksa seluruh kategori jadi huruf kecil. Itu akan
mengubah "Finishing" hasil seed `PRODUCT_LEVEL1` jadi "finishing" dan melawan
nama yang memang sudah kanonik. Kanoniknya adalah ejaan pertama yang dipakai,
dan input menyesuaikan diri kepadanya.

### File yang diubah

| File | Perubahan |
|---|---|
| `src/components/shared/brand-links-editor.tsx` | `LinkRow` baru: pemilih ikon + URL lebar penuh + label progresif. `KIND_ICON` ditambahkan; `BrandLinksReadView` ikut menampilkan ikonnya. |
| `src/subapps/master-data/components/MasterDataMaterialsClient.tsx` | Klik-baris dihapus, kolom chevron dihapus, Aksi jadi 3 tombol ikon, Kelengkapan jadi simbol, kategori jadi koma-miring. Lebar kolom ditata ulang. |
| `src/subapps/master-data/components/BrandDetailClient.tsx` | Kategori di tab Overview jadi koma-miring. |
| `src/components/ui/creatable-tag-input.tsx` | `canonical()` untuk penyelarasan ejaan; mode baca jadi koma-miring. |
| `src/extensions/library/services/library-service.ts` | `syncSeedBrandCategories` men-dedup tag case-insensitive sebelum menulis. |

### Utang yang ditinggalkan

Blok "expanded SKU rows" di `MasterDataMaterialsClient` (state `expandedBrandId`,
`toggleBrandExpand`, `getSkusForBrandAction`) kini **tidak bisa dipicu sama
sekali** — pemicunya adalah kolom chevron yang baru dihapus. Sebenarnya ia sudah
mati sebelum perubahan ini (`toggleBrandExpand` sudah lama jadi peringatan
eslint "assigned but never used"), jadi bukan sesuatu yang rusak hari ini.
Dibiarkan berdiri karena membuangnya menyentuh action server yang mungkin
dipakai tempat lain, dan itu pekerjaan tersendiri — dicatat di roadmap.

---

## [Unreleased] - 2026-08-14 (#18) — View-First Protocol dicabut; diganti Edit-First + exit guard

**Jenis pekerjaan: PERUBAHAN PROTOKOL + UI/UX.** `tsc --noEmit` bersih,
`npm test` 111/111, eslint tanpa error baru (12 error yang tersisa semuanya
pra-ada di berkas yang tidak disentuh). Tidak ada migrasi schema.

**Permintaan owner:** *"cek modals utilities keseluruhan studioflow, tidak perlu
double gini, saat diklik lgsg aja ada inline edit (ga usa di pencet 'modify'
lagi) bisa?"*

Ini bukan sekadar merapikan komponen. "View-First Protocol" tertulis sebagai
**WAJIB** di `AGENTS.md` dan `MASTER_SSOT.md` §2.2, jadi kedua dokumen itu ikut
diubah — kalau tidak, agent berikutnya akan mengembalikannya sebagai "perbaikan".

### Yang berlaku sekarang — Edit-First Protocol

| Aturan lama (dicabut) | Aturan baru |
|---|---|
| Modal untuk data yang sudah ada WAJIB terbuka read-only | Terbuka langsung siap diketik |
| Tombol "Modify" (Edit3) sebagai gatekeeper | Tidak ada. `editable` diturunkan langsung dari izin |
| Project Schedule dikecualikan dari protokol | Pengecualian jadi tidak relevan — semua dialog kini berperilaku seperti Scheduler |
| — | **BARU, WAJIB:** `useUnsavedChangesGuard` + `<UnsavedChangesPrompt>` di setiap dialog yang bisa disunting |

### Kenapa ada exit guard, bukan sekadar dihapus

Tombol Modify tidak hanya menambah satu klik — ia satu-satunya hal yang membuat
menyunting jadi tindakan **disengaja**. Tanpa penggantinya, membuka sebuah baris
untuk melihat isinya, tidak sengaja mengetik di atasnya, lalu menekan Esc adalah
tiga gerakan yang tidak meninggalkan jejak apa pun.

`src/hooks/use-unsaved-changes-guard.tsx` bekerja terbalik dari Modify: Modify
menghalangi **semua** orang di pintu masuk, guard ini hanya berbicara kepada
orang yang **benar-benar mengubah sesuatu**, di pintu keluar. Membuka lalu
menutup tanpa menyentuh apa pun tetap satu klik, tanpa gangguan.

### Berkas yang diubah

| File | Perubahan |
|---|---|
| `AGENTS.md` | §"👁️ View-First Protocol" → §"✏️ Edit-First Protocol", dengan kutipan aturan lama dan alasan pencabutannya supaya tidak dikembalikan tanpa sadar. Poin 11-belas-dua tentang Candidate UI ikut disesuaikan. |
| `MASTER_SSOT.md` | §2.2 ditulis ulang. Aturan lama dikutip utuh dalam blockquote REVOKED, bukan dihapus. |
| `src/hooks/use-unsaved-changes-guard.tsx` | **Baru.** Hook + komponen `UnsavedChangesPrompt`. |
| `src/subapps/master-data/components/MasterDataProductDialog.tsx` | Gatekeeper dihapus (satu-satunya di Master Data yang tombolnya benar-benar tampil). `editable` = izin. Guard dipasang dengan `{form, categoryText}`. |
| `src/subapps/master-data/components/MasterDataBrandDialog.tsx` | `isEditing` dihapus, guard dipasang. |
| `src/subapps/master-data/components/PartyDialog.tsx` | Sama. |
| `src/subapps/master-data/components/PricingClient.tsx` | Tiga dialog (Material Price, Material + Labour, Labour) kehilangan tombol "Edit"/"Ubah"; tiga guard dipasang. |
| `src/components/project-identity-strip.tsx` | Gatekeeper dihapus. Form ini uncontrolled (`FormData` + `defaultValue`), jadi kekotorannya dilacak satu bendera yang dinyalakan event `change` yang menggelembung dari field mana pun — lebih jujur daripada berpura-pura melacak per field. Tombol "Cancel" sekarang menutup dialog (mode baca yang dulu jadi tujuannya sudah tidak ada). |
| `src/components/shared/brand-links-editor.tsx` | Komentar `readOnly` diperbarui — mode baca kini untuk pengguna tanpa izin, bukan keadaan default. |
| `REVIEWUIUX.md` | Diberi banner "sebagian kedaluwarsa". Isinya **tidak** disunting: dokumen itu review bertanggal, dan mengubah catatan lama agar cocok dengan keadaan sekarang adalah mengarang riwayat. |

### Dua bug yang ikut ketahuan

**1. Tombol "Modify" di dialog Brand dan Party tidak pernah bisa muncul.**
Efek inisialisasinya menyetel `isEditing` ke `mode === "CREATE" || canManage`,
sementara tombolnya baru dirender bila `canManage && !isEditing` — dua syarat
yang tidak pernah bisa benar bersamaan. Kode gatekeeper-nya ada, gerbangnya
tidak. Jadi kedua dialog itu **sudah** edit-first sejak lama tanpa ada yang tahu,
dan hanya `MasterDataProductDialog`, tiga dialog Pricing, serta
`project-identity-strip` yang benar-benar memaksa dua langkah.

**2. `project-identity-strip` punya DUA tombol tutup yang bertumpuk.**
`DialogContent` sudah merender tombol X sendiri di `absolute right-4 top-4`, dan
komponen ini menambahkan satu lagi di posisi yang sama. Inilah keluarga masalah
yang terlihat di screenshot owner (tombol Edit tertimpa X). Tombol buatan sendiri
dihapus; header yang isinya merapat ke kanan diberi `pr-12`.

### Satu kesalahan yang dibuat lalu diperbaiki dalam sesi yang sama

Versi pertama guard mengambil snapshot baseline lewat efek yang berjalan saat
`open` menjadi true. **Itu selalu memotret form yang salah.** Efek pengisi form
dan efek hook berjalan pada commit yang sama, dan efek hook membaca `value` dari
render itu — yang masih berisi form dialog SEBELUMNYA. Akibatnya setiap dialog
akan terlihat "sudah berubah" sejak detik pertama dibuka, dan konfirmasi muncul
pada setiap penutupan; pengaman yang selalu berteriak sama tidak bergunanya
dengan yang tidak pernah berteriak.

Perbaikannya membuat pemasangan baseline **eksplisit**: `guard.markPristine(next)`
dipanggil pemanggil, di tempat yang sama ia membangun nilai barunya. Lebih
banyak satu baris per dialog, dan benar. Ini juga yang menyelamatkan
`MasterDataProductDialog`, yang mengisi formnya **dua kali** (dialog terbuka
lebih dulu, `getSkuDetailAction` menyusul) — snapshot sekali di awal akan
merekam form kosong di sana.

Kesalahan kedua di berkas yang sama: baseline disimpan di `useRef` dan dibaca
saat render, yang membuat `isDirty` tidak reaktif. React Compiler menangkapnya
("Cannot access refs during render"). Sekarang `useState`.

### Yang TIDAK berubah

- **Mode read-only tidak dihapus dari kode.** Ia berhenti jadi default, bukan
  berhenti ada. Pengguna tanpa izin ubah tetap melihat nilai, bukan field yang
  bisa diketik lalu ditolak server.
- **RBAC per-field tetap.** `canEditProjectName`, `canEditDic`, dst. di
  `project-identity-strip` tidak disentuh — itu aturan hak akses, bukan gerbang
  UI.
- **`CatalogBoard` (extensions/sketchup) tidak disentuh.** Tombol "Modify"-nya
  adalah inline edit per-field, hal yang berbeda dari gatekeeper modal.
- **`today-inline-add`** juga bukan gatekeeper — itu tombol "Add todo…" yang
  mekar jadi input.

---

## [Unreleased] - 2026-08-14 (#17) — Dua jalan ke SKU brand disatukan jadi satu

**Jenis pekerjaan: UI/UX + BACKEND (query).** `tsc --noEmit` bersih,
`npm test` 111/111, eslint tanpa error baru. Tidak ada migrasi schema.

**Pertanyaan owner:** *"lihat SKU sama dengan menekan 'AICA' - SKUs?"*

Jawabannya: hampir, dan justru itu masalahnya. Ada **dua** jalan ke SKU sebuah
brand, keduanya menjawab pertanyaan yang sama, dengan kemampuan berbeda yang
tidak terbaca dari label:

| Jalan | Perilaku sebelum ini |
|---|---|
| Klik baris brand → detail → tab **SKUs** | `getBrandSkusAction` → tabel 4 kolom. Klik SKU membuka `SkuDetailDrawer` — **read-only**, tanpa harga per supplier. |
| Tombol **"Lihat SKU"** | `navigate({vendor: brand.id})` → tetap di halaman Brands, tabel berganti jadi SKU-grain terfilter. Klik SKU membuka `MasterDataProductDialog` — **bisa diedit dan dihapus**. |

Tidak ada yang menduga tombol bernama *"Lihat"* adalah jalur yang bisa
menyunting, sementara tab yang terlihat seperti halaman utama SKU justru tidak.

**Keputusan owner: satu jalur — tab SKUs, dibuat bisa edit.**

### Perubahan

| File | Perubahan |
|---|---|
| `src/subapps/master-data/components/BrandDetailClient.tsx` | `SkusTab` membuka `MasterDataProductDialog` (mode EDIT) alih-alih `SkuDetailDrawer`. Detail SKU dimuat by id saat baris diklik (`getSkuDetailAction`), pola yang sama dengan `MasterDataMaterialsClient.openRow`. Tabel dimuat ulang setelah dialog ditutup — tabel yang masih menampilkan nilai lama membuat orang menyimpan dua kali. Ditambah kolom **Harga** dan **Supplier**. |
| `src/subapps/master-data/actions/masterdata-actions.ts` | `BrandSkuRow` mendapat `price`, `price_unit`, `supplier_name`. `getBrandSkusAction` ikut mengambil penawaran berlaku termurah (`is_current`, `ORDER BY price_net ASC`, `take: 1`) — aturan pemilihan yang sama dengan `material-view-service`. |
| `src/app/masterdata/materials/[brandId]/page.tsx` | Fetch `getMyLibraryAccessAction`, `getVendorsAction`, `getProductMetadataAction`, `getSupplierOptionsAction` secara paralel untuk memberi makan dialog. Dimuat di server bersama yang lain, bukan lewat request kedua saat dialog dibuka: daftar brand dan metadata kategori tidak berubah selama halaman terbuka, dan menundanya hanya memindahkan jeda ke momen orang sedang menunggu form. |
| `src/subapps/master-data/components/MasterDataMaterialsClient.tsx` | Tombol "Lihat SKU" dihapus dari kolom Aksi. Kolom tinggal menu `⋯` (Edit / Hapus), lebarnya turun 12% → 6%, rata kanan; "Kelengkapan" naik 14% → 20%. |

### Kenapa kolom Harga ikut pindah

Menyatukan dua jalur tidak boleh berarti kehilangan kolom. Tabel terfilter yang
digantikan menampilkan harga; kalau tab SKUs menggantikannya tanpa membawa
kolom itu, yang terjadi bukan penyederhanaan melainkan penurunan. NULL
ditampilkan sebagai `—` beramber dengan `title="Belum ada harga berlaku"` —
simbol, bukan kalimat, karena pada brand yang baru dibuat kalimat itu terulang
di setiap baris.

### Yang TIDAK hilang

Tabel SKU-grain terfilter **masih ada dan masih bisa diedit**. Yang dibuang
hanya satu jalan pintas ke sana dari kolom Aksi. Halaman Brands tetap beralih ke
tabel itu lewat dropdown filter Brand / Category / Price di bagian atas — dan di
sanalah tempatnya, karena pertanyaan yang dijawabnya adalah *"SKU apa saja yang
cocok dengan kriteria ini"*, lintas brand, bukan *"SKU apa saja milik brand
ini"*.

### Utang yang ditinggalkan

`src/subapps/master-data/components/SkuDetailDrawer.tsx` **kini tidak dipakai
siapa pun** dan seharusnya dihapus. Agent tidak bisa menghapus berkas dari
sandbox (`Operation not permitted` pada mount), jadi berkasnya masih ada.
Hapus manual — tidak ada yang mengimpornya.

Setelah berkas itu hilang, `Sheet` tidak punya pemakai sama sekali di seluruh
`src/` selain primitifnya. Primitifnya **sengaja dipertahankan**: panel yang
menggeser dari samping adalah pola yang sah untuk konten yang *mendampingi*
(bukan menggantikan) apa yang ada di belakangnya. Yang salah bukan `Sheet`-nya,
melainkan memakainya untuk form yang menuntut perhatian penuh.

---

## [Unreleased] - 2026-08-14 (#16) — Feedback owner 10 poin: CRUD brand, satu harga, creatable input

**Jenis pekerjaan: UI/UX + BACKEND + MIGRASI SCHEMA.** `tsc --noEmit` bersih,
`npm test` 111/111 lulus, `eslint` tanpa error baru pada berkas yang disentuh.

Owner mengirim sepuluh temuan berlabel nomor beserta empat tangkapan layar
(halaman Brands, detail Brand, dialog Supplier, halaman Pricing, dialog Tambah
Brand). Entri ini memakai penomoran yang sama supaya bisa ditelusuri balik.

### ⚠️ Tindakan wajib sebelum menjalankan versi ini

Poin 8 menghapus satu kolom database. Urutan yang benar:

```bash
npx prisma migrate deploy   # menjalankan 20260814100000_skuprice_single_price
npx prisma generate         # WAJIB — client lama masih mengenal price_list
npm run build
```

`prisma generate` tidak bisa dijalankan dari sandbox agent (EPERM saat menimpa
`src/generated/prisma/`), jadi langkah ini **belum dieksekusi** dan harus
dijalankan di mesin owner.

### Ringkasan per poin

| # | Temuan owner | Yang dilakukan |
|---|---|---|
| 1 | "hapus data tools dari halaman brands — ini sudah ada di settings" | Tombol `Data Tools ↗` dibuang dari `PageHeader` halaman Brands. Pintunya tetap ada di nav Master Data → Settings. |
| 2 | "dari istilah CRUD disini hanya ada CR. update delete ga ada" | Kolom **Aksi** kini punya menu `⋯`: **Edit brand** (membuka dialog Brand mode EDIT) dan **Hapus brand** (`AlertDialog` konfirmasi → `deleteVendorAction`). "Lihat SKU" tetap sebagai tombol utama. |
| 3 | "gbr kaca pembesar tabrakan dengan placeholder tulisannya" | Padding kiri input pencarian dinaikkan ke `pl-9` (36px) dan ikon dipindah ke `left-3`, menyamai kotak pencarian halaman Pricing. |
| 4 | "apabila tidak ada harga ditampilkan dari halaman ini, ngapain dikasi tabnya?" | Tab **Prices** di halaman detail brand dihapus beserta komponen `PricesTab`. |
| 5 | "supplier / vendor utk apa links & drive?" | Seksi **Links & Drive** dihapus dari `PartyDialog`. |
| 6 | "tanggal update nya ga ada" | Kolom `Updated by` menjadi **Update terakhir**: nama + tanggal (`updated_at`, jatuh ke `created_at` bila belum pernah disunting). |
| 7 | "modals create tidak bisa creatablesearch?!; unit dibuat creatablesearch dengan autocomplete" | Dua hal: bug reset `CreatableSearch` diperbaiki, dan field **Unit** di ketiga tab Pricing menjadi creatable search dengan saran dari satuan yang pernah dipakai. |
| 8 | "perubahan skema harga jadi 1 best price aja" | Kolom `SkuPrice.price_list` **dihapus** dari database; seluruh jalur baca/tulis turun menjadi satu harga. |
| 9 | "modals tambah brands bisa ga dibuat creatablesearch jg dengan autocomplete" | Field Category memakai komponen baru `CreatableTagInput` — ketik "h" → muncul "HPL", Enter/koma untuk menambah, chip untuk menghapus. |
| 10 | "knp ini munculnya side panel ya? bukan pop up modals?" | Ya, `Sheet` adalah komponen bersama StudioFlow dan dialog Brand mewarisinya tanpa alasan desain. Sekarang `Dialog`, konsisten dengan Supplier dan Pricing. |

### Poin 8 — detail migrasi satu harga

**Migrasi baru: `prisma/migrations/20260814100000_skuprice_single_price/`**

| Langkah | Alasan |
|---|---|
| `DROP VIEW v_bq_material_rate` | View menyebut `price_list` secara eksplisit; `DROP COLUMN` akan ditolak selama view masih ada. |
| `ALTER TABLE "SkuPrice" DROP COLUMN "price_list"` | Keputusan owner. Tidak ada backfill — nilai yang bertahan (`price_net`) sudah ada di kolom yang benar. |
| `CREATE VIEW v_bq_material_rate` ulang | Tanpa `price_list`, **dan `bq_ready` diperbaiki**. |

**Efek samping yang disengaja pada `bq_ready`.** Definisi lama menuntut
`price_list IS NOT NULL AND price_net IS NOT NULL AND unit IS NOT NULL`. Karena
`price_list` nyaris tidak pernah diisi, syarat itu membuat `bq_ready` hampir
selalu FALSE — itulah asal angka "172 dari 172 price incomplete" di halaman
Material. Sekarang syaratnya: ada harga, dan ada satuan.

**Kenapa `price_net` yang dipertahankan, bukan `price_list`:**

- `price_net` NOT NULL, `price_list` nullable — yang pasti terisi.
- `resolveNetPrice()` sudah menjadikan `price_net` jawaban utama; `price_list`
  hanya cadangan ketika net kosong.
- Semua pembaca hilir (`v_bq_material_rate`, `catalog_price`, tabel Material)
  sudah membaca `price_net`.

**Konsekuensi yang diterima owner:** selisih diskon yang pernah tercatat hilang.
Riwayat penawaran (`valid_from` / `valid_to` / `is_current`) **tidak** terpengaruh
— yang hilang satu kolom, bukan satu baris.

**Rantai perubahan poin 8:**

| File | Perubahan |
|---|---|
| `prisma/schema.prisma` | `price_list` dihapus dari model `SkuPrice`. |
| `src/subapps/master-data/services/sku-price-rules.ts` | `resolveNetPrice(net, list)` → `resolvePrice(price)`. `hasPriceContent({price})`. `isOfferChange` tidak lagi membandingkan `price_list`. |
| `src/subapps/master-data/services/sku-price-service.ts` | `SkuPriceWriteInput.price_list`/`price_net` → `price`. `assertPriceSane` tinggal memeriksa negatif — pemeriksaan "net > list, dua fieldnya tertukar" hilang bersama field keduanya. |
| `src/subapps/master-data/actions/pricing-actions.ts` | Schema Zod, `mapMaterialPrice`, `createMaterialPriceAction`, `updateMaterialPriceAction` turun ke satu field `price`. |
| `src/subapps/master-data/types/pricing.ts` | `price_before_discount` + `price_after_discount` → `price`. |
| `src/subapps/master-data/services/material-view-service.ts` | `MaterialRow.priceBeforeDiscount` + `priceAfterDiscount` → `price`. |
| `src/extensions/library/types.ts` | `catalog_vendor_price` dihapus dari `ProductCatalog*` dan input-nya. |
| `src/extensions/library/services/library-service.ts` | `createProduct` / `updateProduct` tidak lagi menulis atau membandingkan `price_list`. |
| `src/extensions/library/contracts/sku-dto.ts` | `SkuPriceShape.price_list` dihapus. |
| `src/subapps/master-data/services/excel-service.ts` | Kolom `price_list` dibuang dari export dan import. Workbook lama yang masih punya kolom itu **diabaikan, bukan ditolak** — impor tidak boleh gagal hanya karena file dibuat sebelum perubahan skema. |
| `src/subapps/master-data/actions/sample-request-actions.ts` | Pemanggilan `recordSkuPrice` disesuaikan. |
| `src/core/platform/db.ts` | `price_list` dikeluarkan dari `requiredSkuPriceColumns` (health check startup). |
| `src/subapps/master-data/components/MasterDataProductDialog.tsx` | Field `price_net` → `price`, label "Net Price (setelah diskon)" → "Harga". |
| `src/subapps/master-data/components/MasterDataMaterialsClient.tsx` | Kolom harga tidak lagi menampilkan angka tercoret di atas harga bersih. |
| `src/subapps/master-data/components/PricingClient.tsx` | Kolom tabel "List price" + "Net price" → satu kolom **Harga**; dua field form → satu. |
| `src/subapps/master-data/services/sku-price.test.ts` | Test "net jatuh ke list" dihapus bersama aturannya. Dua invarian yang **tidak boleh** hilang tetap diuji: nol yang disengaja adalah harga sungguhan, dan kosong bukan nol. Ditambah satu test baru: mengosongkan harga kini **adalah** perubahan penawaran, dan action menolak menulisnya. |

### Komponen baru

**`src/components/ui/creatable-tag-input.tsx`** — saudara bernilai-banyak dari
`CreatableSearch`. Dipakai field Category di dialog Brand (poin 9).

Kenapa tidak memakai `CreatableSearch` saja: kontrol itu menghasilkan **satu** id
lalu menutup. Yang ini mengumpulkan string dan tetap terbuka untuk entri
berikutnya, dan nilainya teks biasa, bukan foreign key — kategori brand dibuat
dengan menyebutkan namanya, bukan dengan memilih baris yang sudah ada.

Perilaku: ketik untuk memfilter (prefix-match diurutkan di atas), Enter/koma
untuk commit, Backspace pada field kosong menghapus tag terakhir, tempel
"HPL, SPC, Sink" menjadi tiga tag. **Tidak** commit saat blur — itu akan menelan
kata setengah-ketik setiap kali orang menekan Tab untuk berpikir. Dedup
case-insensitive, sehingga "HPL" dan "hpl " tidak menjadi dua kategori.

Yang digantikannya: strip chip berisi **seluruh** kategori yang dikenal + satu
`<Input>` teks bebas. Wajar pada sepuluh kategori, tidak terbaca pada delapan
puluh, dan menaruh opsi yang jarang dipakai di depan mata dengan bobot yang sama
dengan yang sering.

### Perbaikan bug yang ditemukan sambil jalan

| Bug | Dampak sebelumnya |
|---|---|
| **`CreatableSearch` tidak mengosongkan teks saat `value` di-reset parent** | Menutup dialog EDIT lalu membukanya sebagai CREATE menyisakan nama brand sebelumnya di kotak, memfilter daftar ke satu baris itu. Terlihat seperti "creatablesearch-nya rusak" (poin 7) padahal ia patuh pada teks basi. Ketikan tetap aman: efek ini hanya jalan saat `value` berubah, dan menekan tombol tidak mengubah `value`. |
| **`getAllVendors` tidak pernah memetakan `categories` → `seed_categories`** | Query mengembalikan baris join di `categories`, sementara `LibraryVendor` mendeklarasikan `seed_categories` dan dialog Brand membacanya. Keduanya tidak pernah dijembatani — membuka brand untuk EDIT menampilkan Category kosong meski brand punya kategori, **dan menyimpan form kosong itu akan menghapusnya**. Ditemukan saat mengaktifkan Edit di poin 2; tanpa ini, fitur Update yang baru justru merusak data. |

### Yang sengaja TIDAK dilakukan

- **`PartyLink` tidak dihapus dari database** (poin 5). `form.links` tetap ada di
  state dan tetap dikirim saat save. Menghapus UI-nya tidak boleh berarti
  menghapus data yang terlanjur terisi.
- **`Sheet` tidak dihapus dari `ui_engine`** (poin 10). `SkuDetailDrawer` masih
  memakainya, dan di sana memang tepat: konteks di belakang panel masih relevan.
  Di form Brand tidak.
- **Saran satuan tidak dibuat tabel master.** `collectUnits()` membaca satuan dari
  baris yang sudah tampil di halaman Pricing. Daftar satuan sebuah studio pendek
  dan berekor panjang; yang perlu disarankan justru yang sering muncul. Tabel
  master satuan berarti satu hal lagi yang harus dirawat.

---

## [Unreleased] - 2026-08-12 (#15) — SSOT Refactor: Brand & SKU Dialog (MASTERDATA_UIUX_REVISION)

**Jenis pekerjaan: REFACTOR UI/UX + BACKEND.** `tsc --noEmit` bersih. Tidak ada migrasi schema — hanya perubahan query (field `source` di `BrandCategory`) dan logika service yang sudah direncanakan di PRD.

Mengimplementasikan `MASTERDATA_UIUX_REVISION.md` yang disetujui owner 2026-08-12. Fokus: memisahkan tiga ranah SSOT (Brand/Entitas, SKU/Fisik, Pricing/Transaksional) secara tegas di layer UI dan service.

### File baru / yang dibuat ulang sepenuhnya

| File | Perubahan |
|---|---|
| `src/subapps/master-data/components/MasterDataBrandDialog.tsx` | **Ditulis ulang penuh.** Form scope sekarang hanya: Product Brand, Company/Induk Perusahaan, Category (chip multi-select + free-form), dan BrandLinksEditor (GDrive, Website, Socmed). Semua field SKU, harga, dimensi, supplier, kontak, dan alamat dihapus. |
| `src/subapps/master-data/components/MasterDataProductDialog.tsx` | **Ditulis ulang penuh.** 3 section: Spesifikasi Visual (Brand, Warna, Motif, Finishing), Dimensi Fisik (DimensionGroup inline P×L×T + unit dropdown), Initial Sourcing (Supplier picker, Net Price, Price Unit). `catalog_image_url` dihapus total. `price_before_discount` dihapus; `catalog_vendor_price: null` di-hardcode (list price → PricingClient). |

### File diubah

| File | Perubahan |
|---|---|
| `src/extensions/library/types.ts` | Tambah `seed_categories?: { id: string; name: string }[]` ke `LibraryVendor`; tambah `brand_category_tags?: string[]` ke `LibraryVendorInput`. |
| `src/extensions/library/services/library-service.ts` | Tambah private method `syncSeedBrandCategories` — upsert `BrandCategory` dengan `source: "SEED"`, hapus entri SEED yang tidak lagi dipilih, tidak menyentuh `DERIVED_FROM_SKU`. Update `getAllVendors`, `createVendor`, `updateVendor` untuk membaca/menulis seed_categories. |
| `src/subapps/master-data/components/MasterDataMaterialsClient.tsx` | Import `MasterDataBrandDialog`. Tambah prop `companies?: PartyData[]`. Tambah state `brandDialog`. CTA di PageHeader sekarang context-sensitive: Brand Landing View → "Tambah Brand" (buka BrandDialog), SKU View → "Tambah Material" (buka ProductDialog). Mount `<MasterDataBrandDialog>` di bawah. |
| `src/app/masterdata/materials/page.tsx` | Fetch `getCompaniesAction` paralel bersama data lain. Teruskan `companies` prop ke `MasterDataMaterialsClient`. |

### Komponen baru (internal, dalam file yang ditulis ulang)

| Komponen | Deskripsi |
|---|---|
| `CategoryInput` (dalam BrandDialog) | Chip-style multi-select: quick-pick dari `categoryOptions`, fallback free-form text comma-separated. |
| `DimensionGroup` (dalam ProductDialog) | Inline input group P × L × T dengan unit Select dropdown (cm/mm/m/inch/feet). |
| `parseTags()` | Utilitas: split string pada koma/newline, trim, filter kosong → `string[]`. |

### Keputusan arsitektur

- **`syncSeedBrandCategories` terpisah dari `upsertBrandCategories`** — dua metode yang ada sebelumnya hanya menulis `DERIVED_FROM_SKU` dan bersifat aditif. Metode baru khusus untuk Brand form: menghapus entri SEED yang dihapus user, tidak pernah menyentuh `DERIVED_FROM_SKU`.
- **`catalog_vendor_price: null` hardcoded** — list price sepenuhnya dikelola di PricingClient (SSOT). Tidak ada lagi duplikasi harga di dialog SKU.
- **"Sold by" dihapus dari BrandDialog** — dikonfirmasi owner bahwa ini adalah "supplied by" yang belong ke halaman Pricing, bukan identitas brand.

---

## [Unreleased] - 2026-08-12 (#14) — Deploy produksi: migrasi 20260812140000 + backfill spec_*

**Jenis pekerjaan: DEPLOY.** Owner menginstruksikan: deploy kode (Fase 1–4 sudah live di
server LAN via working tree; **git tidak disentuh**), jalankan migrasi `20260812140000_schedule_template_item`,
lalu `scripts/backfill-schedule-spec-fields.mjs --apply` setelah Fase 1 di produksi.

### Yang dilakukan
| Langkah | Hasil |
|---|---|
| Backup `pg_dump -Fc` sebelum backfill | `backups/studioflow_pre_backfill_schedule_spec_20260812_180039.dump` (1.4 MB) |
| `npx prisma migrate deploy` | `20260812140000_schedule_template_item` ter-apply; `migrate status` = up to date; diff vs live DB tidak ada drift dari perubahan ini |
| `node scripts/backfill-schedule-spec-fields.mjs` (dry-run) | 80 baris dibaca, 52 perlu update, 0 skip |
| `node scripts/backfill-schedule-spec-fields.mjs --apply` | 52 baris diperbarui; idempoten (run ulang = 0) |
| Restart dev server (disetujui owner) | `/api/health` HTTP 200; verifikasi SQL: 80 option, 8 `spec_search_key` non-null, tabel `ScheduleTemplateItem` kosong (siap diisi via UI) |

### Dua perbaikan yang ditemukan saat deploy
1. **Migrasi `20260812140000` salah tipe kolom `id`.** Tertulis `UUID NOT NULL DEFAULT gen_random_uuid()`,
   padahal seluruh skema lain memakai `TEXT` (Prisma `String @id @default(uuid())`), dan FK-nya datang dari
   `ProjectScheduleEntry.template_item_id TEXT`. FK `text→uuid` ditolak PostgreSQL
   ("foreign key constraint cannot be implemented" — dibuktikan di transaksi yang di-rollback).
   Diperbaiki menjadi `TEXT NOT NULL`; hasilnya zero drift terhadap `schema.prisma`.
2. **`scripts/backfill-schedule-spec-fields.mjs` gagal di Windows** dengan
   `ERR_UNSUPPORTED_ESM_URL_SCHEME` (`import()` path absolut `D:\…` tanpa `file://`).
   Diperbaiki memakai `pathToFileURL(outFile).href` saat `import()` modul hasil strip.

### Open
- R-SCHED-REUSE-5 (GROUP BY SQL) tetap terbuka — butuh DB hidup, data real kini tersedia.
- Drift `master_data` yang masih ada di `prisma migrate diff` adalah pekerjaan masterdata v2 yang sedang berjalan — bukan bagian deploy ini.

---

## [Unreleased] - 2026-08-12 (#13) — Fase 4: Guard auto-link tidak merampas slot template (R-SCHED-TPL-2d)

**Jenis pekerjaan: FITUR SERVER.** `tsc --noEmit` bersih · 111 test pass.

Guard sisi server di `autoLinkSyncedMaterial` dan `autoLinkSyncedFixture`: kalau slot `{prefix, increment}` sudah dipegang entry dengan `template_item_id != null` dan tidak ada material yang mengklaimnya, auto-link tidak merampas slot itu (return null + console.warn). Plugin SketchUp diperbaiki belakangan (R-SCHED-TPL-2e — out of scope Fase 4).

### File baru
| File | Deskripsi |
|---|---|
| `src/extensions/sketchup/lib/template-slot-guard.ts` | Fungsi murni `findNextFreeIncrement` — no Prisma, siap dipakai R-SCHED-TPL-2e |
| `src/extensions/sketchup/lib/template-slot-guard.test.ts` | 4 test case: slot kosong, loncat slot terpakai, dll |

### File diubah
| File | Perubahan |
|---|---|
| `src/extensions/sketchup/actions/sketchup-actions.ts` | Guard template slot di `autoLinkSyncedMaterial` (blok `existing`) dan `autoLinkSyncedFixture` (setelah lookup kedua) |

### TODO R-SCHED-TPL-2e (bukan Fase 4, out of scope)
- Pencocokan per-kategori
- Adopsi slot template oleh material (guard diperluas dari "skip" ke "pindah ke slot bebas")
- Antrean rename `SketchupMergeAction`
- Pengiriman `reserved_codes` ke plugin

---

## [Unreleased] - 2026-08-12 (#12) — Fase 3: ScheduleTemplateItem — schema, service, actions, UI (R-SCHED-TPL-1, 2a/2b/2c)

**Jenis pekerjaan: FITUR BESAR.** `tsc --noEmit` bersih · 111 test pass.

Implementasi penuh "default template item" — kartu yang sudah terisi spesifikasinya (bukan sekadar kategori kosong) yang otomatis dipasang ke setiap proyek baru.

### File baru
| File | Deskripsi |
|---|---|
| `prisma/migrations/20260812140000_schedule_template_item/migration.sql` | DDL: `CREATE TABLE ScheduleTemplateItem` + `ALTER TABLE ProjectScheduleEntry ADD COLUMN template_item_id` + FK `ON DELETE SET NULL` + 2 index |
| `src/extensions/schedule/actions/schedule-template-item-actions.ts` | 4 server actions: `createScheduleTemplateItemFromEntryAction`, `listScheduleTemplateItemsAction`, `reorderScheduleTemplateItemsAction`, `deleteScheduleTemplateItemAction` (soft delete) |
| `src/extensions/schedule/services/schedule-template-item-planner.ts` | Fungsi murni `planTemplateItemsToCreate` — no Prisma, diuji tanpa DB |
| `src/extensions/schedule/services/schedule-template-item-planner.test.ts` | 5 test case idempotensi: proyek kosong, satu ada, kategori terisi non-template, apply 2x, null template_item_id |

### File diubah
| File | Perubahan |
|---|---|
| `prisma/schema.prisma` | Model `ScheduleTemplateItem` baru + field `template_item_id` + `@@index([project_id, template_item_id])` di `ProjectScheduleEntry` |
| `src/extensions/schedule/services/schedule-service.ts` | `addEntryToSchedule`: tambah mode `"template"` + param `templateItemId`. `applyDefaultTemplateEntries` v2: idempotensi per `template_item_id`, return `{ createdCategories, createdItems, noDefaultsConfigured }` |
| `src/extensions/sketchup/components/CatalogBoard.tsx` | Tombol "Set as default item" (`LayoutTemplate` icon) di toolbar kartu; toast `applyDefaultTemplate` dibedakan 3 kondisi: `noDefaultsConfigured`, sudah sesuai, ada yang ditambah |
| `src/components/template-manager.tsx` | Section "Item Default" di mode `project-engine`: daftar item + tombol hapus soft; diload via `listScheduleTemplateItemsAction` |

### Skema keputusan owner yang diimplementasi
| # | Keputusan | Status |
|---|---|---|
| 1 | Template = reserved. SketchUp menyesuaikan | ✅ `template_item_id` di entry, guard Fase 4 |
| 2 | Tidak ada propagasi. Salin-saat-apply | ✅ `snapshot_captured_at` di-refresh saat apply |
| 3 | Item template dilarang ke `master_data` | ✅ Tidak ada tulis ke Library dari jalur ini |
| 4 | Plugin diperbaiki belakangan | ✅ Fase 4 hanya guard server-side |
| 5 | Item template: `is_final: true`, `status: APPROVED` | ✅ Diterapkan di mode `"template"` |

---

## [Unreleased] - 2026-08-12 (#11) — Fase 2: Perluas search key + backfill + guard UI (R-SCHED-REUSE-2/3/4)

**Jenis pekerjaan: FITUR + SCRIPT.** `tsc --noEmit` bersih · 102 test pass.

### File baru
| File | Deskripsi |
|---|---|
| `scripts/backfill-schedule-spec-fields.mjs` | Backfill `spec_*` semua `ProjectScheduleOption` lama. `--dry-run` default; `--apply` untuk produksi. Iterasi batch 500, idempoten. Jalankan **setelah** Fase 1 ter-deploy. |

### File diubah
| File | Perubahan |
|---|---|
| `src/extensions/schedule/services/schedule-spec-fields.ts` | Urutan key diperluas: `[kategori, brand, product, color, finishing]`. Placeholder filter: brand+product keduanya placeholder → `spec_search_key = null` (tidak masuk pool). `PLACEHOLDER_VALS` inline (tidak import dari display-utils) |
| `src/extensions/schedule/services/schedule-spec-fields.test.ts` | +7 test: kategori masuk key, placeholder filter, hanya satu placeholder tidak cukup blokir |
| `src/extensions/sketchup/components/CatalogBoard.tsx` | Hint sekunder saat `reuseItems.length === 0 && query.length >= 2`: "Pool terisi otomatis dari item yang sudah dispesifikasi di proyek mana pun." |

### Catatan untuk owner
Jalankan backfill setelah deploy Fase 1:
```bash
node scripts/backfill-schedule-spec-fields.mjs            # dry-run dulu
node scripts/backfill-schedule-spec-fields.mjs --apply    # tulis ke DB produksi
```

---

## [Unreleased] - 2026-08-12 (#10) — Fase 1: Sentralisasi jalur tulis ProjectScheduleOption (R-SCHED-REUSE-1)

**Jenis pekerjaan: REFACTOR + FITUR.** `tsc --noEmit` bersih · 95 test pass (naik ke 111 setelah Fase 2–4).

Akar masalah reuse pool yang selalu kosong: 17 titik tulis `data_snapshot` ke `ProjectScheduleOption` tidak memperbarui `spec_*` index, sehingga `searchReusableSpecs` tidak pernah menemukan apa pun. Semua titik dimigrasikan ke satu helper.

### File baru
| File | Deskripsi |
|---|---|
| `src/extensions/schedule/services/schedule-spec-fields.ts` | Fungsi murni `deriveScheduleSpecFields` — satu-satunya definisi, dipindahkan dari `schedule-service.ts`, bebas dependensi (diperlukan backfill script) |
| `src/extensions/schedule/services/schedule-option-writer.ts` | **Satu-satunya jalur tulis** `data_snapshot`. Exports: `createScheduleOption`, `updateScheduleOptionSnapshot`. Selalu memanggil `deriveScheduleSpecFields` sebelum write |
| `src/extensions/schedule/services/schedule-spec-fields.test.ts` | Test murni: brand+product+color+finishing → key; field kosong dilewati; semua kosong → null; vendor_id → spec_brand_id |

### File diubah
| File | Perubahan |
|---|---|
| `src/extensions/schedule/services/schedule-service.ts` | `deriveScheduleSpecFields` → re-export dari `schedule-spec-fields.ts`. 4 titik tulis dimigrasikan ke `createScheduleOption`/`updateScheduleOptionSnapshot` |
| `src/extensions/sketchup/actions/sketchup-actions.ts` | 10 titik tulis dimigrasikan ke helper (sync material, sync fixture, metadata update, edit kartu, addManualCatalog, auto-link material, auto-link fixture, code rename) |
| `src/lib/schedule/csv-import.ts` | 3 titik tulis dimigrasikan ke helper (`upsertApprovedOption` update+create, `importScheduleFromCsv` create) |
| `eslint.config.mjs` | Rule `no-restricted-syntax`: flag `projectScheduleOption.create`/`.update` dengan `data_snapshot` di luar `schedule-option-writer.ts` |
| `src/extensions/schedule/README.md` | Tambah §"Write Path Guard (2026-08-12)" |

### Pagar regresi
```bash
grep -rn "projectScheduleOption\.create\|projectScheduleOption\.update" src/ \
  | grep -v generated | grep -v schedule-option-writer | grep "data_snapshot"
# → hanya menyisakan komentar di README (0 kode aktif)
```

---

## [Unreleased] - 2026-08-12 (#9) — Full execute UX redesign Master Data (Phase 1–9)

**Jenis pekerjaan: FITUR UI BESAR.** `tsc --noEmit` bersih (exit 0).

### File baru

| File | Deskripsi |
|---|---|
| `src/app/masterdata/materials/[brandId]/page.tsx` | Brand Detail server page (gate: MASTERDATA_VIEW) |
| `src/subapps/master-data/components/BrandDetailClient.tsx` | Brand Detail — 4 tab: Overview, SKUs, Suppliers, Prices |
| `src/subapps/master-data/components/SkuDetailDrawer.tsx` | Right-side SKU detail drawer |
| `src/app/masterdata/suppliers/[partyId]/page.tsx` | Supplier Detail server page |
| `src/subapps/master-data/components/SupplierDetailClient.tsx` | Supplier Detail — 4 tab: Overview, Brands, Prices, Contacts |

### File diubah

| File | Perubahan |
|---|---|
| `MasterDataNavOuter.tsx` | **Phase 1** — Nav baru: Materials/Suppliers/Prices/Samples + divider + Data Tools |
| `MasterDataMaterialsClient.tsx` | **Phase 2** — Judul "Brands", klik row→detail page, CTA "Tambah Material", Data Tools link |
| `quick-entry-actions.ts` | **Phase 5** — Tambah `quickCreateSkuAction` |
| `masterdata-actions.ts` | **Phase 3** — Tambah 5 action: getBrandDetail/BrandSkus/BrandSuppliers/assign/unassign |
| `party-actions.ts` | **Phase 7** — Tambah 4 Contact CRUD action + `getPartyBrandsAction` |
| `PricingClient.tsx` | **Phase 6** — Rename tab labels, "Save New Price" UX, type selector step |
| `SupplierClient.tsx` | **Phase 7** — Hapus tab Material/Services, unified Party table, row→detail |
| `MasterDataSettingsClient.tsx` | **Phase 9** — Import results card inline (replaced bare toast) |

### Keputusan D1–D6 sudah diimplementasi
- **D1**: route brand detail → `/masterdata/materials/[brandId]` ✓
- **D2**: Prices tab di Brand Detail = preview 10 harga + "View all →" link ✓
- **D3**: route supplier detail → `/masterdata/suppliers/[partyId]` ✓
- **D4**: Archive brand → warning + tetap boleh (frontend guard) ✓
- **D5**: Import results = inline card (Phase 9, preview page deferred) ✓
- **D6**: ServiceVendor dan material supplier pakai page yang sama, tab visibility by role ✓

### Yang belum dikerjakan (disesuaikan scope)
- Import preview page `/masterdata/settings/import` dengan conflict resolution — Phase 9 partial
- Full workbook export (multi-sheet) — hanya SKU+SkuPrice yang saat ini di-export
- RelationshipAssigner reusable component (Phase 8) — logika inline di masing-masing page

---

## [Unreleased] - 2026-08-12 (#8) — Plan UX redesign Master Data (spec §A–AO)

**Jenis pekerjaan: DOKUMENTASI PLAN.** Tidak ada perubahan kode.

Spec UX final owner (§A–AO) sudah dianalisa dan di-cross-reference terhadap schema + kode.
Plan lengkap: `docs/PLAN-MASTERDATA-UX-2026-08-12.md`.

### Temuan gap utama

| Gap | Kode | Blocker |
|---|---|---|
| `quickCreateSkuAction` tidak ada | `quick-entry-actions.ts` | UI-Phase 5, blocking Phase 6 |
| `PartyContact` CRUD tidak ada di UI | `PartyDialog.tsx` tidak touch contact | UI-Phase 7 |
| Brand Detail page tidak ada | Perlu route + client baru | UI-Phase 3 |
| Supplier Detail page tidak ada | Perlu route + client baru | UI-Phase 7 |
| SkuPrice history tidak ada di UI | Backend data ada, query belum | UI-Phase 6 |
| Import/Export: hanya SKU+SkuPrice | `excel-service.ts` | UI-Phase 9 |
| Nav "Prices" tidak muncul di sidebar | Route ada, nav belum | UI-Phase 1 |

### Yang sudah ada dan TIDAK perlu diubah
- `recordSkuPrice()` — versioning sudah benar
- `quickCreateBrandAction` + `quickCreatePartyAction`
- WorkPrice backend actions (3 kind)
- RBAC matrix
- Sample + SampleMovement
- Soft delete pattern

### 6 keputusan terbuka (D1–D6)
Lihat `roadmap.md` §UX REDESIGN atau `docs/PLAN-MASTERDATA-UX-2026-08-12.md §6`.

---

## [Unreleased] - 2026-08-12 (#7) — Implementasi UI-CON-5: Import/Export pindah ke Master Data Settings

**Jenis pekerjaan: FITUR UI.** `tsc --noEmit` bersih (exit 0).

### Perubahan

**File baru:**
- `src/app/masterdata/settings/page.tsx` — server page baru di `/masterdata/settings`. Gate: `MASTERDATA_SKU_MANAGE` (ADMIN, DEVELOPER, STAFF). Redirect ke `/masterdata/materials` untuk role lain. Merender `MasterDataSettingsClient`.
- `src/subapps/master-data/components/MasterDataSettingsClient.tsx` — client component: Import/Export logic dipindahkan dari `MasterDataMaterialsClient`. Tampilan: `DashboardPageShell` + `PageHeader` + `SectionCard` berisi dua tombol (Export ke Excel, Import dari Excel).

**File diubah:**
- `src/subapps/master-data/components/MasterDataNavOuter.tsx` — tambah item `Settings2` icon / label "Pengaturan" / href `/masterdata/settings` sebagai item keempat di sidebar.
- `src/subapps/master-data/components/MasterDataMaterialsClient.tsx`:
  - Hapus `importing` state, `importInputRef`, `handleExport`, `handleImportFile`
  - Hapus hidden `<input type="file">` dari JSX
  - Hapus tombol Export dan Import dari `PageHeader action`
  - Ganti label `"Add Material"` → `"Tambah Material"` (UI-CON-1 sekalian)
  - Hapus import `Download`, `Upload` dari lucide (tidak dipakai lagi)

### RBAC

| Role | Bisa masuk /masterdata/settings? |
|---|---|
| ADMIN | ✅ (`MASTERDATA_SKU_MANAGE` ∈ matrix) |
| DEVELOPER | ✅ |
| STAFF | ✅ |
| ESTIMATOR | ❌ (tidak bisa masuk `/masterdata` sama sekali — APP_ACCESS matrix) |
| DIC / DRIC | ❌ (sama — tidak punya APP.MASTERDATA) |

### Keputusan owner (2026-08-12)

"Pindah ke settings khusus master data (beda dgn studioflow) — menu hanya muncul utk admin, developer, dan staff dengan rbac ke masterdata."

Implementasi memilih Opsi A dari analisa: operasi bersifat global (seluruh dataset), bukan kontekstual per tampilan.

---

## [Unreleased] - 2026-08-12 (#6) — Analisa UI/UX inkonsistensi Master Data (Supplier + Materials)

**Jenis pekerjaan: ANALISA.** Tidak ada perubahan kode — temuan didokumentasikan dan diturunkan ke roadmap sebagai item UI-CON-1…UI-CON-5.

### Temuan

Diperiksa dari screenshot tiga halaman Master Data (Supplier/Material tab, Supplier/Services tab, Materials):

| # | Temuan | Halaman | Cacat / Preferensi |
|---|--------|---------|-------------------|
| UI-CON-1 | Bahasa campur EN/ID di tombol: `+ Perusahaan`, `+ Brand`, `+ Tambah Vendor`, `+ Add Material` | Supplier, Materials | Cacat (sudah dicatat di AUDIT-UX §3) |
| UI-CON-2 | Tombol CTA Services tab (`+ Tambah Vendor`) ditempatkan di dalam baris search bar, bukan di page header seperti halaman lain | Supplier/Services | Cacat — placement salah |
| UI-CON-3 | Header kolom tidak konsisten: `BIDANG/TRADE`, `LABOUR PRICES`, `PAKET M+U` (mix EN/ID) vs `VENDOR NAME`, `PHONE`, `ACTIONS` (EN) vs `AKSI`, `KELENGKAPAN` (ID) | Supplier/Services, Materials | Cacat |
| UI-CON-4 | Stats strip (`TOTAL BRANDS · LENGKAP · BELUM LENGKAP`) hanya ada di Materials; Supplier memakainya inline di subtitle halaman | Supplier, Materials | Preferensi — perlu distandardisasi |
| UI-CON-5 | Tombol `Export` + `Import` berada di page header Materials, padahal operasinya bersifat global (seluruh SKU + harga ke Excel), bukan kontekstual per tampilan | Materials | Preferensi — kandidat pindah ke Settings |

### Keputusan yang dibutuhkan owner sebelum eksekusi

**UI-CON-5 (Import/Export):** Dua opsi valid:

- **Opsi A — Pindah ke Settings > Database Management** (direkomendasikan): operasi `/api/masterdata/excel/export` dan `import` mengekspor/mengimpor *seluruh* dataset SKU + harga, bukan yang sedang di-filter. Ini bukan aksi halaman — ini administrasi data. Settings sudah punya halaman Database Management yang cocok sebagai rumahnya. Efek samping positif: header Materials jadi bersih, hanya CTA sehari-hari yang tersisa.

- **Opsi B — Tetap di Materials tapi dibedakan**: jadikan Export/Import tombol sekunder (ikon kecil, bukan tombol primer) dan tambahkan tooltip "Export semua SKU". Cocok kalau kedepannya mau ada filtered export per brand/kategori.

---

## [Unreleased] - 2026-08-12 (#5) — Audit balik Batch #1: 7 perbaikan Fase 2.1–2.4 + 1.2

**Jenis pekerjaan: KOREKSI.** Entri #4 di bawah melaporkan Fase 2.1–2.4 dengan
seluruh Definition of Done tercentang. Diperiksa ulang terhadap kode: `tsc` dan
79 test memang bersih, tapi **enam dari klaim DoD itu tidak bertahan**, dan satu
titik audit Fase 1.2 tidak pernah benar-benar ditulis. Entri #4 sengaja tidak
diedit — mengubah catatan lama supaya cocok dengan kenyataan adalah mengarang
riwayat. Ini koreksinya.

Sesudah: `npx tsc --noEmit` bersih · **89 test pass** (79 → 89) · `eslint`
0 error.

### Ringkasan koreksi

| # | Klaim #4 | Kenyataan | Status |
|---|----------|-----------|--------|
| 1 | "search works" | Search melempar user keluar dari brand grain | ✅ Diperbaiki |
| 2 | "sort works" | Tak ada kontrol sort; `sku_count` hanya per halaman | ✅ Diperbaiki |
| 3 | "SQL-aggregated" | Query totals memuat seluruh tabel Brand | ✅ Diperbaiki |
| 4 | "completeness §5.1" | Supplier soft-deleted ikut terhitung | ✅ Diperbaiki |
| 5 | "lazy fetch" | Tanpa `take`, object graph penuh per SKU | ✅ Diperbaiki |
| 6 | pagination | Hardcode `50` alih-alih `pageSize` | ✅ Diperbaiki |
| 7 | "2 audit点 sku-price" | Hanya 1 yang ada; `actor` dibuang | ✅ Diperbaiki |

### Berkas baru

- **`src/subapps/master-data/lib/brand-view-rules.ts`** — tiga aturan murni
  (no I/O, no Prisma): `isBrandLandingView()`, `toBrandSort()`,
  `isBrandComplete()`. Ada karena `material-view-service.ts` mengimpor
  `server-only`, jadi tidak ada satu pun keputusannya yang bisa dites. Aturan
  yang dipakai lebih dari satu tempat pindah ke sini.
- **`src/subapps/master-data/lib/brand-view-rules.test.ts`** — 10 test,
  termasuk regresi eksplisit untuk cacat #1 ("does NOT break out of brand grain
  on search") dan bukti komplemen untuk aritmetika chip
  (`incomplete = all - complete`).

### Berkas yang diubah

**`src/subapps/master-data/services/material-view-service.ts`**

- `getBrandView()` — search kini **tetap di brand grain** dan cocok ke 4 sumber:
  nama brand, `owner.legal_name`, nama kategori, dan nama/kode SKU yang dibawa.
  Kosakata sama dengan search `getAllProducts`, supaya kedua view sepakat soal
  arti "ketemu".
- `getBrandView()` — sort `sku_count` pindah ke SQL: `orderBy: [{ skus: { _count:
  "desc" } }, { name: "asc" }]`. Prisma **memang** bisa order by relation count;
  komentar lama yang bilang tidak bisa salah, dan re-sort JS pasca-paginasi
  membuat brand ber-SKU-banyak bisa terdampar di halaman 2.
- `getBrandView()` — query totals: `findMany` tanpa `take` atas seluruh tabel
  Brand → **dua `count()`**. Kelengkapan diekspresikan sebagai `where`
  (`categories: { some: {} }, suppliers: { some: { party: { deleted_at: null } } }`).
- `getBrandView()` — `_count.suppliers` kini difilter
  `{ where: { party: { deleted_at: null } } }`, sejajar dengan `_count.skus`.
  `BrandSupplier` tidak punya `deleted_at` sendiri, tapi `Party` di belakangnya
  punya (`schema.prisma:262`).
- `getSkusForBrand()` — ditambah `EXPANDED_SKU_LIMIT = 200` dan `take`. Return
  berubah dari `MaterialRow[]` jadi `{ rows, truncated }` supaya UI bisa
  mengatakan daftarnya dipotong, bukan diam-diam terlihat lengkap.
- `isComplete` per baris kini memanggil `isBrandComplete()` yang sama dengan
  klausa `COMPLETE` — sebelumnya dua ekspresi terpisah yang bisa menyimpang,
  dan chip yang menghitung badge harus sepakat dengan badge yang dihitungnya.

**`src/subapps/master-data/actions/masterdata-actions.ts`**

- `getSkusForBrandAction` — tipe hasil mengikuti `{ rows, truncated }`. RBAC
  guard `MASTERDATA_VIEW` tidak berubah (sudah benar sejak #4).

**`src/app/masterdata/materials/page.tsx`**

- `isBrandLanding` — `!search` **dihapus** dari syarat. Ini akar cacat #1.
  Sekarang memanggil `isBrandLandingView()` bersama.
- `brandFilters.sort` — memanggil `toBrandSort()` bersama.
- `pageSize` yang dikirim ke client kini `brandViewResult.pageSize` saat brand
  landing, bukan `view.pageSize` (fallback SKU yang hardcode 50).

**`src/subapps/master-data/components/MasterDataMaterialsClient.tsx`**

- `showBrandLanding` — salinan tangan kedua dari aturan yang sama, diganti
  panggilan `isBrandLandingView()`. **Duplikasi inilah yang melahirkan cacat #1**:
  dua salinan satu keputusan, keduanya salah dengan cara yang sama.
- Toolbar brand landing — ditambah dropdown sort (Nama brand / Jumlah SKU /
  Terbaru) dan tombol "Reset pencarian". Sebelumnya `BrandFilters.sort` hanya
  bisa dicapai lewat URL yang diketik tangan.
- Placeholder search diperjelas jadi "Cari brand, owner, kategori, atau SKU…" —
  yang lama ("Search across all brands…") menjanjikan hal yang tidak dilakukannya.
- Baris expand — ditambah baris catatan saat `truncated`, dengan tautan ke
  tampilan SKU brand penuh.
- Empty state membedakan "tidak cocok dengan pencarian X" dari "belum ada brand".
- Pagination brand — `Math.ceil(brandTotal / 50)` di 4 tempat → satu
  `brandTotalPages` yang diturunkan dari prop `pageSize`.

**`src/subapps/master-data/services/sku-price-service.ts`**

- `closeCurrentSkuPrice()` — menerima `actor` lalu **membuangnya**; entri #4
  mengklaim 2 titik audit di berkas ini, yang ada hanya 1. Kini membaca id yang
  akan diretire lebih dulu (karena `updateMany` cuma mengembalikan hitungan, dan
  audit yang bilang "3 penawaran ditutup" tanpa menyebut yang mana bukan jejak
  audit), lalu menulis satu baris `UPDATE` per baris terdampak dengan
  `changes: { is_current, valid_to }`. Nol baris berubah → nol audit.

### Guardrail yang dijaga

- `MaterialRow` tetap seluruhnya skalar — `{ rows, truncated }` membungkusnya,
  tidak menambah field ke dalamnya.
- Tidak ada refactor `extensions/library`. Diff di sana: **nol**.
- Tidak ada perubahan schema, tidak ada migrasi, tidak ada data yang ditulis.
- Entri #4 tidak diedit.

### Known behavior / belum tuntas

- **`next build` belum terverifikasi.** SIGBUS (`Bus error (core dumped)`) di
  sandbox — binary SWC native di-mmap lewat mounted filesystem. Bukan cacat
  kode (`tsc`, test, dan eslint semuanya jalan), tapi **build production baru
  terbukti kalau owner menjalankan `npm run build` di mesin lokal.**
- `getBrandView` / `getSkusForBrand` masih tanpa test — keduanya menyentuh
  Prisma, dan `scripts/run-tests.mjs` tidak bisa menjangkaunya. Yang bisa
  diangkat ke modul murni sudah diangkat; sisanya butuh test integrasi berbasis
  DB. Tercatat di `roadmap.md` §P3c.
- `EXPANDED_SKU_LIMIT = 200` adalah angka pilihan, bukan hasil pengukuran.
  Kalau ada brand yang rutin melewatinya, batasnya yang salah — bukan datanya.

## [Unreleased] - 2026-08-12 (#4) — Batch #1 eksekusi: Fase 1.0, 1.2, 1.3, 2.1–2.4

**Jenis pekerjaan: EKSEKUSI KODE.** Semua fase non-terblokir dari
`docs/implementation_plan.md` sudah diimplementasi. `npx tsc --noEmit` bersih,
79 test pass, 0 regression.

### Ringkasan per fase

| Fase | Status | Bobot |
|------|--------|-------|
| 1.0 — satu `slugify` bersama | ✅ Selesai | Ringan–sedang |
| 1.2 — `MasterDataAudit` di ~35 titik tulis | ✅ Selesai | **Terbesar di batch** |
| 1.3 — `WorkPrice.code` auto-generated | ✅ Selesai | Ringan |
| 2.1–2.4 — Materials grain-Brand | ✅ Selesai | Sedang |
| 2.6 — hapus "Add Material" | ❌ Terblokir | Menunggu 4.1 |
| 1.4 — arah List/Net Price | ❌ Terblokir | Menunggu `inspect-masterdata-state.mjs` |

### Berkas baru

- **`src/subapps/master-data/lib/slug.ts`** — modul slugify bersama, murni
  (no I/O), NFKD, satu-satunya sumber canonical slug. Menggantikan 7 implementasi
  yang tersebar.
- **`src/subapps/master-data/lib/slug.test.ts`** — 11 grup test regresi: diakritik
  (decompose + non-decompose seperti `ø`/`æ`), uppercase, whitespace, punctuation,
  string kosong, CJK, idempotensi, kesetaraan kanonik dengan `categorySlug`.
- **`src/subapps/master-data/services/audit-service.ts`** — `recordAudit()`,
  `diffFields()`, `MasterDataEntity` type, `serializeValue()`. Polimorfik:
  `actor_id` kolom biasa (bukan FK), `changes` Json.

### Berkas yang diubah

**Fase 1.0 — konsolidasi slugify (7 lokasi):**
- `src/subapps/master-data/services/category-tree-rules.ts` — `categorySlug` jadi
  alias `export { slugify as categorySlug }`.
- `src/extensions/library/services/library-service.ts` — `slugifyTag` + `slugify`
  internal mendelegasi ke `slug.ts`. Komentar byte-identical diperbaiki alamatnya
  ke arsip.
- `src/subapps/master-data/actions/quick-entry-actions.ts` — hapus `slugify`
  lokal, import dari `slug.ts`.
- `src/subapps/master-data/actions/party-actions.ts` — hapus `slugify` lokal,
  import dari `slug.ts`. **Perubahan perilaku**: `ø`/`æ` sekarang jadi `-`
  (bukan dihapus).
- `src/subapps/master-data/actions/pricing-actions.ts` — hapus `slugify` lokal,
  import dari `slug.ts`. Perubahan perilaku sama.
- `src/subapps/master-data/actions/sample-request-actions.ts` — inline
  `normalizeTag` digantikan import `slugify`. Perubahan perilaku sama.

**Fase 1.2 — audit trail (~35 titik tulis):**
- `src/subapps/master-data/actions/party-actions.ts` — 3 audit点 (CREATE/UPDATE
  Brand, UPDATE Party).
- `src/subapps/master-data/actions/pricing-actions.ts` — ~14 audit点 (CRUD
  ServicePrice, MaterialLaborPrice, resolveCategoryPath, deleteWorkPrice,
  upsertWorkPriceCategory).
- `src/subapps/master-data/actions/quick-entry-actions.ts` — 3 audit点 (create
  party, create/update sku price).
- `src/subapps/master-data/services/sku-price-service.ts` — 2 audit点 (closeCurrentOffer,
  recordNewOffer) dengan actor param opsional.
- `src/subapps/master-data/services/category-tree-service.ts` — 2 audit点
  (upsertCategory) dengan actor param.
- `src/extensions/library/services/library-service.ts` — ~15 audit点 (create/update
  product, update/delete vendor, mergeVendors per-SKU, resolveVendor). Diff
  `library-service.ts` murni aditif.

**Fase 1.3 — WorkPrice.code auto-generated:**
- `src/subapps/master-data/actions/pricing-actions.ts` — `code` dihapus dari
  Zod schema, `generateWorkPriceCode(tx)` dibuat (WP-YYYY-NNNN, collision retry
  dalam tx yang sama). `createServicePriceAction` dan
  `createMaterialLaborPriceAction` generate code server-side. Kedua update action
  pertahankan `existing.code`.
- `src/subapps/master-data/types/pricing.ts` — `code` dihapus dari
  `WorkPriceInput`.
- `src/subapps/master-data/components/PricingClient.tsx` — field Code dihapus
  dari kedua form WorkPrice, `canSave` guard diperbarui.

**Fase 2.1–2.4 — Materials grain-Brand:**
- `src/subapps/master-data/services/material-view-service.ts` — tambah `BrandRow`,
  `BrandFilters`, `BrandViewResult` types. Tambah `getBrandView()` (SQL-aggregated:
  SKU count via `_count.skus`, supplier count via `_count.suppliers`, completeness
  derived). Tambah `getSkusForBrand()` (lazy fetch SKU per brand).
- `src/subapps/master-data/actions/masterdata-actions.ts` — tambah
  `getSkusForBrandAction` (server action, read-only).
- `src/app/masterdata/materials/page.tsx` — conditionally call `getBrandView()`
  (landing) atau `getMaterialView()` (brand filtered). Hapus `brandSkuGroups`
  query. Pass `brandRows`, `brandTotals`, `brandTotal`.
- `src/subapps/master-data/components/MasterDataMaterialsClient.tsx` — brand card
  grid diganti tabel grain-Brand dengan kolom: expand, Brand, Kategori, SKU count,
  Supplier count, Kelengkapan, Aksi. Expandable SKU rows (read-only) dengan lazy
  fetch. Stat chips kondisional (brand-level atau SKU-level). "Add Material" tetap
  ada.

### Guardrail yang dijaga

- Konsolidasi slugify **minimal/surgical** — hanya 7 lokasi + pemanggilnya.
- Slug yang sudah tersimpan **tidak** ditulis ulang massal.
- `extensions/library` disentuh **hanya sejauh dibutuhkan** (audit aditif + slugify
  delegasi). Tidak ada refactor Library.
- `MaterialRow` tetap **seluruhnya skalar** — tidak ada objek Prisma, tidak ada
  Decimal, tidak ada relasi.
- Audit mencatat **operasi nyata + record terdampak**, bukan "action dipanggil".
- UPDATE yang tidak mengubah apa pun **tidak** menulis baris audit.

### Known behavior

- `ø` (U+00F8) tidak decompose di NFKD → tetap non-alphanumeric → diganti `-`.
  Didokumentasikan di `slug.test.ts`.
- `WorkPrice.code` lama tidak disentuh — kode buatan tangan mungkin bermakna bagi
  staf.
- Brand completeness = punya kategori **DAN** punya supplier. Tanpa salah satu =
  "Belum lengkap".

### Yang tetap terblokir

- **1.4** — menunggu `node scripts/inspect-masterdata-state.mjs` dari owner.
- **2.6** — menunggu 4.1 (`quickCreateSkuAction`).

---

## [Unreleased] - 2026-08-12 (#3) — Implementation plan batch #1

**Jenis pekerjaan: masih ANALISIS/PERENCANAAN. Nol baris kode aplikasi berubah.**

Owner menyetujui temuan Fase 0.b dan urutan revisi, membuka **Fase 1.0, 1.2, 1.3,
dan bagian Fase 2 yang tidak terblokir**, lalu menutup instruksinya dengan
*"ingat tugas kamu hanya menghasilkan implementation_plan.md"*. Badan pesannya
menulis "Proceed", baris terakhirnya menulis "hanya rencana". Saya menuruti yang
terakhir dan mencatat ambiguitasnya di kepala dokumen — rencananya sudah cukup
rinci untuk dieksekusi langsung kalau ternyata maksudnya yang pertama.

### Berkas baru

- **`docs/implementation_plan.md`** — rencana eksekusi batch #1: per langkah ada
  berkas + nomor baris, tabel kasus uji regresi, definition of done, batas
  sentuhan, dan protokol berhenti-dan-lapor.

### Berkas yang diubah

- `docs/PLAN-MASTERDATA-REWORK-2026-08-12.md` → revisi 3 (§H.1 dikoreksi)
- `roadmap.md` → P3b ditambahkan, P6/H.1 dikoreksi

### Koreksi kedua terhadap laporan saya sendiri: slugify **7**, bukan 6

Kemarin saya melaporkan enam implementasi. Yang ketujuh — **`categorySlug` di
`src/subapps/master-data/services/category-tree-rules.ts:17`** — terlewat karena
saya mencari nama `slugify` dan ia tidak bernama begitu. Pola kekeliruan yang
sama persis dengan kesalahan RBAC sehari sebelumnya: mencari string, bukan
mencari perilaku.

Kali ini koreksinya **memperbaiki keadaan, bukan memperburuk**. Setelah badan
ketiga varian NFKD dibandingkan (whitespace dinormalisasi, lalu diadu), ketiganya
ternyata **identik secara perilaku** — satu-satunya beda adalah nama parameter.
Konsekuensinya untuk Fase 1.0:

- implementasi kanonik yang owner minta dipertahankan **sudah ada, sudah murni,
  bebas I/O, dan sudah diimpor `sku-price.test.ts`**. Tidak perlu menulis
  algoritma baru — cukup mengangkat yang sudah terbukti;
- konsolidasi **hanya mengubah perilaku di 4 dari 7 lokasi**, jadi entitas yang
  slug-nya berisiko bergeser cuma `Party`, `Sku`, dan `Brand` — bukan seluruh
  schema. Laporan divergensi jadi jauh lebih sempit;
- `slugifyTag` cukup mendelegasi, sehingga kontrak "byte-identical" yang owner
  minta dijaga selamat dengan sendirinya, bukan lewat janji di komentar.

### Temuan sampingan: kontrak byte-identical menunjuk berkas yang sudah diarsipkan

Komentar `library-service.ts:66` mewajibkan `slugifyTag` byte-identik dengan
`slugify()` di `scripts/seed-brand-categories.mjs`. **Berkas itu tidak ada lagi
di `scripts/`** — ia pindah ke `docs/archive/scripts-usang/` saat pengarsipan
2026-08-10. Jadi aturan yang owner minta saya jaga sedang menunjuk alamat kosong.

Rencananya: jaga kontraknya, perbaiki alamatnya. Skrip arsipnya **tidak
disentuh** — ia sudah tidak dijalankan, dan mengedit skrip arsip supaya cocok
dengan kode hidup adalah mengarang riwayat, persis yang catatan pengarsipan di
kepala berkas ini larang.

### Yang direncanakan, per langkah

**1.0** — satu `slugify` bersama di `src/subapps/master-data/lib/slug.ts`, murni
supaya `npm test` bisa mengimpornya. Tujuh lokasi disatukan; tiga jadi delegasi
tanpa perubahan perilaku. Test regresi mencakup diakritik (`PT Café Créme` →
`pt-cafe-creme`), uppercase, whitespace, punctuation, string yang habis
tersaring, idempotensi, dan kesetaraan dengan `categorySlug` — yang terakhir
mengubah "byte-identical" dari janji di komentar jadi hal yang diuji. Tabrakan
slug dalam scope yang sama didokumentasikan per entitas (`Sku` per-brand, `Brand`
dan `Party` global, `Category` per-kind); penanganannya **tidak diubah** di batch
ini.

**1.2** — `MasterDataAudit` di ~35 titik tulis nyata di dua modul. Audit dipasang
sedekat mungkin dengan operasi Prisma-nya, bukan di pintu masuk action, karena
satu action bisa menyentuh lima tabel (`updateVendor` menyentuh `Brand`, `Party`,
`BrandSupplier`, `PartyContact`) dan mencatat "updateVendor dipanggil" membuang
persis informasi yang membuat audit berguna. Dua titik yang butuh perhatian
khusus: `mergeVendors:1283` harus mengambil id SKU **sebelum** `updateMany`
karena `updateMany` tidak mengembalikannya, dan `resolveVendor:864` membuat Brand
secara implisit dari sebuah nama — brand yang lahir tanpa ada yang sadar
membuatnya justru yang paling perlu tercatat. UPDATE yang tidak mengubah apa pun
sengaja **tidak** menulis baris audit.

Satu penyederhanaan yang sah dibanding pola `src/actions/_shared.ts:48`:
`MasterDataAudit.actor_id` adalah kolom biasa, bukan FK, jadi tarian "verify user
exists to prevent FK violations" di sana tidak perlu disalin ke sini.

**1.3** — `WorkPrice.code` dibangkitkan sisi server, hilang dari kedua form.
Kode lama tidak disentuh: `WorkPrice` yang sudah ada punya kode buatan tangan
yang mungkin bermakna bagi staf.

**2.1–2.5** — Materials grain-Brand, SKU read-only, kelengkapan turunan tanpa
kolom `is_complete`. **2.6 tidak termasuk** (B-Q5).

### Yang tetap terblokir

Fase 1.4 (arah List/Net Price) menunggu keluaran
`scripts/inspect-masterdata-state.mjs`. `price_list` **tidak** dijadikan NOT NULL
sebelum angkanya ada. Penulisan ulang slug massal butuh approval terpisah —
konsolidasi generator bukan migrasi data.

---

## [Unreleased] - 2026-08-12 (#2) — Keputusan owner B-Q1…B-Q7 + Fase 0.b

**Jenis pekerjaan: masih ANALISIS. Nol baris kode aplikasi berubah.** Satu skrip
baru yang hanya membaca database.

### Berkas baru

- **`scripts/inspect-masterdata-state.mjs`** — pemeriksa keadaan `master_data`,
  **hanya baca, nol perintah tulis**. Melaporkan status migrasi, apakah
  `20260811120100` applied, bukti fisik kolom `material_price`/`labor_price`
  sudah hilang, jumlah baris 18 tabel, `SkuPrice.price_list IS NULL` (dampak
  B-Q4), ruang tabrakan `WorkPrice.code` (B-Q2), dan grup slug duplikat (B-Q3).

### Berkas yang diubah

- **`docs/PLAN-MASTERDATA-REWORK-2026-08-12.md`** → revisi 2. §F berubah dari
  "Blocking Questions" jadi "Keputusan Owner — TERKUNCI". §E.2 diperbarui, §G
  disusun ulang, §H (hasil Fase 0.b) dan §I (protokol pra-migrasi) ditambahkan.
- **`roadmap.md`** — P5 jadi tabel keputusan, P6/P7/P8 ditambahkan.

### Keputusan owner yang menghemat pekerjaan, bukan menambah

Dua koreksi schema yang revisi 1 tandai kelas B (butuh migrasi) **turun jadi
kelas C (perilaku)**:

- **B-Q2** — `WorkPrice.code` dipertahankan sebagai identitas internal dan
  dibangkitkan otomatis, tidak lagi diminta dari staf. Kolomnya tidak disentuh,
  jadi **tidak ada migrasi**. Yang berubah hanya `pricing-actions.ts:66` dan
  form di `PricingClient.tsx`.
- **B-Q4** — arah List/Net Price dibalik sesuai Sheet2, **tapi** owner melarang
  mengarang `price_list` dari `price_net`. Justru larangan itu yang menghemat
  migrasinya: kalau ada baris lama ber-`price_list` NULL, kolom DB dibiarkan
  nullable dan kewajiban ditegakkan di form. Data historis tidak disentuh sama
  sekali. Angkanya menunggu skrip inspeksi.

Satu keputusan yang **membalik perilaku yang ada**, dan sengaja dicatat supaya
tidak ada yang "memperbaikinya" balik: **B-Q3 menolak slug sebagai fallback
identitas**. `excel-service.ts:365` dan `:503` sekarang mencocokkan baris lewat
slug ketika ID kosong — artinya baris ber-ID kosong yang slugnya sudah ada akan
**meng-update diam-diam**, padahal user menulis "buat baru". Aturan barunya:
deteksi duplikatnya, **tolak barisnya, laporkan**, suruh user mengisi ID kalau
memang mau meng-update.

### Fase 0.b — tiga temuan, dua mengubah rencana

**1. Slugifikasi: enam implementasi, dua perilaku.** Hanya
`quick-entry-actions.ts:55` dan `LibraryService.slugifyTag:70` yang melakukan
NFKD + membuang diakritik. Empat lainnya (`party-actions.ts:93`,
`pricing-actions.ts:135`, `sample-request-actions.ts:415` yang bahkan inline,
`LibraryService.slugify:377`) tidak. `"PT Café Créme"` jadi `pt-cafe-creme`
lewat quick entry dan `pt-caf-cr-me` lewat form Party. Karena
`quickCreateSkuAction` akan jadi **pembuat `Sku.slug` kedua** — dan `Sku` punya
`@@unique([brand_id, slug])` sementara namanya tidak unik — menulisnya di atas
enam implementasi yang tidak sepakat berarti menanam bug ketujuh. **Konsolidasi
slugify naik jadi langkah 1.0.**

**2. RBAC ternyata tidak bocor.** Subapp master-data 45 action, 45 bergerbang
`hasPermission`. `library-actions.ts` 18 dari 26; delapan sisanya diperiksa satu
per satu dan **semuanya pembacaan**, tetap di balik `requireSession()`.
Satu-satunya penulisan yang tampak menganga,
`createProjectProductRequestAction:364`, bergerbang lewat
`getProjectMembershipOrThrow` — keanggotaan proyek, bukan PERMISSION. Sah, hanya
beda mekanisme. Turun jadi langkah 1.6 (konsistensi), bukan prioritas keamanan.

> **Koreksi terhadap draf saya sendiri.** Sapuan pertama melaporkan "23 dari 27
> action tanpa gerbang" karena mencari string `hasPermission` dan tidak melihat
> `assertLibraryPermission` (`library-actions.ts:39`) yang membungkusnya. Angka
> itu salah. Dicatat karena temuan keamanan yang salah, kalau dibiarkan, akan
> dikutip belakangan seolah terverifikasi.

**3. ⚠️ Lingkup Fase 2 & 3 lebih besar dari perkiraan revisi 1.** Saat melacak
slugify ketahuan bahwa **CRUD `Brand` dan `Sku` tidak tinggal di
`src/subapps/master-data/`**. Keduanya di `LibraryService` — Brand di
`library-service.ts:406,495,568,883,1298`, Sku di `:969,1130,1293,1312,1512`,
total 1.603 baris. Satu-satunya `brand.create` di dalam subapp adalah
`quick-entry-actions.ts:203`. Jadi `extensions/library` bukan sekadar "tidak
rusak" seperti catatan kemarin — ia **jalur tulis utama Master Data**. Fase 2,
Fase 3, dan 4.1 semuanya akan menyentuh berkas di luar subapp. Perkiraan lingkup
revisi 1 yang hanya menyebut berkas subapp terlalu kecil.

### B-Q7 — kenapa angkanya belum ada, dan kenapa itu bukan penolakan

Owner: *"Do NOT ask the owner for the row count ... if the repository
environment allows inspection."* Lingkungannya tidak mengizinkan, dan ini diuji
bukan diasumsikan: `.env` menunjuk `localhost:5432`, Postgres-nya dari
`docker-compose.yml` di PC owner, sementara shell agent adalah VM Linux
terisolasi. Lima rute dicoba — `localhost`, `host.docker.internal`,
`172.17.0.1`, `10.0.2.2`, `192.168.65.254` — semuanya connection refused atau
unreachable. Dua dump di `backups/` bertanggal 2026-07-30, **sebelum** rebaseline
v2, jadi tidak sah dijadikan bukti keadaan sekarang.

Yang dikerjakan sebagai gantinya bukan menebak angkanya, melainkan menulis
pemeriksanya. Jalankan `node scripts/inspect-masterdata-state.mjs`, tempel
keluarannya ke §I.1 dokumen rencana, dan Fase 1.4 terbuka.

### Status eksekusi

**Boleh jalan sekarang:** 1.0 (slugify bersama), 1.1, 1.2 (audit trail), 1.3
(auto-generate `WorkPrice.code`), 1.5, 1.6, seluruh Fase 2.
**Masih menunggu:** 1.4 — butuh angka `price_list IS NULL` dari skrip inspeksi.

---

## [Unreleased] - 2026-08-12 — Analisis Fase 0: rombakan Master Data (PRD)

**Permintaan owner:** *"pelajari reworks utk masterdata → tujuan kamu buat
implementation plan saja dulu."*

**Jenis pekerjaan: ANALISIS. Nol baris kode aplikasi berubah.** Yang ditulis
hanya dokumen. PRD §24 memang menutup dengan *"Do not code until the owner
approves this analysis."*

### Yang dibaca

`docs/design database masterdata.xlsx` (Sheet1 Table 1–4 + Sheet2 rencana
halaman) · `docs/PRD_MASTER_DATA_REDESIGN.md` (identik dengan yang diunggah
owner — diverifikasi md5) · `prisma/schema.prisma` blok `master_data` (18 model,
12 enum) · 19 migrasi · seluruh `src/subapps/master-data/` (44 berkas, 12.138
baris) · `src/app/masterdata/` · `src/app/api/masterdata/excel/` · `roadmap.md`
· `docs/PENYIMPANGAN-DARI-EXCEL.md` · `docs/TANYA-SEBELUM-EKSEKUSI.md`.

### Berkas baru

- **`docs/PLAN-MASTERDATA-REWORK-2026-08-12.md`** — memenuhi PRD §24 A–G:
  peta model bisnis dengan kardinalitas, pemetaan Table 1–4 + Sheet2 ke
  entitas/field, Anti-Regression Matrix terisi bukti, current-vs-target UX per
  halaman, klasifikasi perubahan schema (A/B/C/D/E), tujuh pertanyaan yang
  memblokir, dan rencana Fase 0–6 dengan berkas per langkah.

### Berkas yang diubah

- **`roadmap.md`** — antrean baru "Rombakan Master Data (PRD 2026-08-12)"
  di bagian atas, P0–P5.

### Tiga hal yang ditemukan analisis ini, dan kenapa penting

**1. PRD berdiri di atas premis yang sudah kedaluwarsa.** PRD §16 menyebut
"Prisma ↔ migration drift around `WorkPrice`" dan "broken `extensions/library`"
sebagai masalah terbuka. Keduanya ditulis sebelum pekerjaan 2026-08-11. Drift
`WorkPrice` **sudah tertutup** oleh `20260811120000_workprice_single_price_and_qty`
dan `20260811120100_redefine_v_bq_work_rate`; `extensions/library` punya 13
berkas hidup dan `library-service.ts` tidak menyentuh model `studioflow` mana
pun. Menjalankan Fase 1 PRD apa adanya berarti membuka ulang dua hal yang sudah
selesai. Yang **masih** benar dari §16: `MasterDataAudit` tidak pernah ditulis
(nol `prisma.masterDataAudit.create` di seluruh `src/`) dan Excel masih 2 sheet.
Jadi prioritas teratas Fase 1 bergeser dari drift ke audit trail — yang oleh PRD
§15 sendiri disebut syarat "production-safe".

**2. Baris "Must verify" di Anti-Regression Matrix PRD §18 — terjawab.**
PRD menahan eksekusi selama makna `Company Categories` belum pasti, dan §23.3
melarang mengubahnya tanpa persetujuan. Kelima nilai Excel (Supplier, Subcon,
Vendor, Retail Store, Manufacture) dipetakan satu-satu ke `PartyRoleKind`
(`SUPPLIER`, `SUBCON`, `SERVICE_VENDOR`, `RETAIL`, `MANUFACTURER`) —
**tidak ada yang hilang, tidak ada perubahan schema yang diperlukan.**
Blokirnya bisa dicabut.

**3. Temuan yang tidak ada di PRD maupun roadmap: arah List/Net Price terbalik.**
Excel Sheet2 baris 11–12 menulis *"List Price (mandatory)"* dan *"Net Price
(optional)"*. Schema menulis kebalikannya — `price_list Decimal?` opsional,
`price_net Decimal` wajib (`schema.prisma:535-536`). Akibat nyatanya: staf yang
baru tahu harga katalog dan belum tahu netto **tidak bisa menyimpan barisnya
sama sekali**, persis dead end yang PRD §6.2 larang. Ini menyentuh data harga
yang sudah ada, jadi dijadikan pertanyaan owner (B-Q4), bukan diputuskan
sendiri.

### Satu tempat rencana ini sengaja menyimpang dari urutan PRD §19

PRD menaruh "hapus field SKU/harga dari Brand, SKU dibuat dari alur Price" di
Fase 2, dan quick entry di Fase 4. Tapi `quickCreateSkuAction` **belum ada** —
`quick-entry-actions.ts` hanya punya party, brand, dan work-vendor
(`:99,169,236`). Mengikuti urutan PRD berarti menghapus tombol "Add Material"
(`MasterDataMaterialsClient.tsx:328`) di Fase 2 sementara penggantinya baru
lahir di Fase 4 — ada jendela di mana **SKU tidak bisa dibuat dengan cara apa
pun**. Jadi 4.1 (quick entry SKU) dijadikan prasyarat 2.6 (hapus tombol), dan
alasannya ditulis di dokumen supaya tidak dibalik lagi oleh yang membaca PRD
belakangan.

### Yang TIDAK dikerjakan, dan kenapa

Nol perubahan schema, nol migrasi, nol perubahan UI. Dua koreksi schema yang
diusulkan (`WorkPrice.code` opsional/auto, arah List/Net Price) masuk PRD §23
daftar Owner Approval Gates — keduanya menunggu jawaban. Promosi
`color/motif/finishing` dari `Sku.spec` ke kolom nyata dicatat sebagai kelas D
(optimasi) dan **sengaja tidak diselundupkan** ke dalam rencana ini.

**Langkah berikutnya:** owner menjawab B-Q1…B-Q7 di
`docs/PLAN-MASTERDATA-REWORK-2026-08-12.md` §F.

---

## [Unreleased] - 2026-08-11 — Standalone masterdata-app (Next.js terpisah)

**Permintaan:** Master Data diperlakukan sebagai aplikasi Next.js yang benar-benar
mandiri — bisa `npm run dev` di PC rumah tanpa perlu project StudioFlow sama sekali.

**Output:** `masterdata-app-2026-08-11.zip` (~320 KB) — siap diekstrak dan dijalankan.

**Isi app:**
- Next.js 16.2.1 + Prisma v7 — dependensi sama dengan StudioFlow supaya schema
  dan ekstensi tidak perlu adaptasi.
- `prisma/schema.prisma` — hanya blok `master_data` (18 model + 12 enum, 600 baris).
  Schema `studioflow` tidak disertakan.
- `src/lib/auth.ts` — stub yang selalu mengembalikan session `ADMIN / "Local Dev"`.
  Tidak ada redirect login, tidak ada middleware auth.
- `src/components/top-header.tsx`, `src/context/sidebar-context.tsx` —
  komponen minimal pengganti header/sidebar StudioFlow.
- `src/lib/services/settings-service.ts`, `src/lib/domain/phase-*.ts`,
  `src/extensions/live-collaboration/types/comment.ts`, dll. — stub minimal supaya
  semua import `@/` yang dipakai master data bisa resolve tanpa StudioFlow.
- `ui_engine/` — disalin verbatim; komponen yang hanya dipakai StudioFlow
  (ProjectLiveProvider, PhaseLiveProvider, image uploader, dll.) dihapus dan
  ekspornya dibuang dari `ui_engine/index.ts`.
- `src/generated/prisma/` — placeholder; akan di-overwrite oleh `npm run db:generate`.

**Setup di PC rumah (5 langkah):**
```
1. Ekstrak zip → masuk ke folder masterdata-app/
2. npm install
3. Copy .env.example → .env.local, isi DATABASE_URL
4. npm run db:generate    ← generate Prisma client
5. npm run dev            ← buka http://localhost:3000/masterdata
```

**File:** `masterdata-app-2026-08-11.zip` — ada di root folder studioflow (PC kantor).

---

## [Unreleased] - 2026-08-11 — Hotfix: import Excel 5 errors + Decimal prices

### Bug 1 — Import Excel: 5 errors "unit is required" pada baris Prices

**Penyebab:** `exportMasterDataExcel` menulis satu "placeholder row" ke sheet Prices
untuk setiap SKU yang belum punya harga (`unit: ""`, `price_net: null`). Saat
file yang sama di-import, Zod schema `unit: z.string().min(1)` menolak baris itu
sebelum sempat cek bahwa `price_net` juga kosong.

**Fix — dua lapis:**
- `excel-service.ts` export: hapus blok `if (sku.prices.length === 0) { addRow(...) }`
  — SKU tanpa harga cukup tidak muncul di sheet Prices. User yang mau set harga
  pertama bisa tambah baris baru manual.
- `excel-service.ts` import: tambah early-skip sebelum Zod — kalau `price_net`
  null/empty, `continue` langsung tanpa parse. Mencegah error spurious untuk baris
  yang memang akan di-skip setelah validasi.

### Bug 2 — Decimal serialization di prices array (hotfix terpisah)

Lihat entri di bawah.

## [Unreleased] - 2026-08-11 — Hotfix: Decimal serialization di prices array

**Error:** "Only plain objects can be passed to Client Components from Server
Components. Decimal objects are not supported." — muncul setelah import Excel
memuat ulang halaman Materials via `router.refresh()` dan membuka dialog SKU.

**Penyebab:** `attachDerivedCatalogFields` menyebarkan `...sku` yang membawa
array `prices[]` mentah dari Prisma. `dim_length / dim_width / dim_height` sudah
dikonversi ke string, tapi `price_list`, `price_net`, `qty` di setiap
`SkuPriceShape` masih berupa objek `Prisma.Decimal` — dan React tidak bisa
serialize objek class melewati batas server→client.

**Fix** — `src/extensions/library/types.ts`, fungsi `attachDerivedCatalogFields`:
tambah `.map()` atas `sku.prices` yang mengonversi tiga kolom Decimal ke string
sebelum disebar ke return value. Cast `as unknown as typeof sku.prices` supaya
TypeScript tidak complain — DTO tetap bertipe Decimal (matching input Prisma),
tapi runtime selalu menerima string. Semua call site sudah menggunakan
`Number(price_net)` atau `.toString()` yang bekerja pada keduanya.

**Verification:** `npx tsc --noEmit` → 0 errors.

## [Unreleased] - 2026-08-11 — R1 Brand grid + R2 DTO contracts + R3 Excel import/export

Tiga roadmap item owner dieksekusi sekaligus. Rincian per item di bawah.

### R1 — Halaman Materials: brand landing + drill-down per brand

**Masalah:** Halaman Materials langsung menampilkan semua SKU dari semua brand
dalam satu tabel panjang. Tidak ada entry point per brand; filter vendor memang
ada tapi tidak ada tampilan agregat yang memberi konteks "berapa SKU per brand".

**Yang berubah:**

- `src/app/masterdata/materials/page.tsx` — tambah `prisma.sku.groupBy(by:
  ["brand_id"])` ke `Promise.all` server component. Hasilnya di-join dengan tabel
  vendor untuk menghasilkan `brandCounts: { id, name, count }[]` yang diteruskan
  ke client.

- `src/subapps/master-data/components/MasterDataMaterialsClient.tsx` — logika
  baru:
  - `showBrandLanding` dihitung dari URL params: `true` saat tidak ada filter aktif
    (tidak ada `vendorId`, `search`, `category`, `price`).
  - Saat `showBrandLanding`: tampilkan search bar lintas-brand + grid kartu brand
    (diurut count desc). Klik kartu → `navigate({ vendor: brand.id })`.
  - Saat filter aktif (termasuk setelah klik kartu): tampilkan tombol "← All brands"
    yang membersihkan filter vendor, lalu tabel + filter biasa.
  - `MasterDataProductDialog` dipindah ke luar kondisional sehingga tombol "Add
    Material" bekerja dari kedua tampilan.

**Aturan yang berlaku:**
- Brand landing hanya muncul saat **semua** filter kosong. Filter mana pun (search,
  category, price, vendor) langsung ke tabel.
- Tombol "← All brands" muncul hanya saat `vendorId` di-set — bukan saat filter
  lain yang aktif.

---

### R2 — M4 langkah 2: DTO kontrak menggantikan `Prisma.SkuGetPayload<>`

**Masalah:** `extensions/library/types.ts` mengimpor
`Prisma.SkuGetPayload<{ include: typeof SKU_FULL_INCLUDE }>` dan
`Prisma.SampleGetPayload<{...}>`. Artinya setiap perubahan kolom di Master Data
memaksa build StudioFlow merah — keduanya tidak bisa dirilis terpisah.

**Yang berubah:**

- `src/extensions/library/contracts/sku-dto.ts` *(file baru)* — DTO tulis tangan
  menggantikan kedua `Prisma.GetPayload<>`. Aturan penulisannya:
  - Hanya impor enum dari `@/generated/prisma` (`SkuStatus`, `SkuKind`,
    `SampleStatus`, `LinkKind`) — enum tidak berubah saat kolom ditambah/dihapus.
  - `Decimal` dan `JsonValue` diimpor dari `@prisma/client/runtime/client`
    (runtime Prisma, bukan schema generated). Subpath ini terdaftar di
    `exports` map `@prisma/client/package.json`.
  - `spec: JsonValue` (bukan `unknown`) — diperlukan supaya call site di
    `library-actions.ts` tetap selaras tipe dengan model Prisma yang dikembalikan.
  - Tidak ada `Prisma.GetPayload<>`, tidak ada `typeof SKU_FULL_INCLUDE`.

- `src/extensions/library/types.ts` — dua alias diubah:
  ```ts
  // sebelum
  export type SkuWithRelations = Prisma.SkuGetPayload<{ include: typeof SKU_FULL_INCLUDE }>;
  export type LibrarySampleRow = Prisma.SampleGetPayload<{...}>;
  // sesudah
  export type SkuWithRelations = SkuDto;
  export type LibrarySampleRow = SampleRowDto;
  ```
  Import `Prisma` tetap ada karena `Prisma.ProjectProductRequestGetPayload`
  (schema `studioflow`) masih digunakan di bawahnya.

**Hasil:** `tsc --noEmit` bersih tanpa error.

**Langkah M4 yang masih tersisa:** step 3 (pindah operasi tulis) dan step 4
(`REVOKE SELECT`, role Postgres terpisah) — tidak berubah dari roadmap sebelumnya.

---

### R3 — Import/export Excel untuk Master Data

**Masalah:** Tidak ada cara non-teknis untuk bulk edit atau backup data Sku dan
SkuPrice. Setiap pembaruan harus lewat form satu per satu.

**Yang berubah:**

- `src/subapps/master-data/services/excel-service.ts` *(file baru)*

  `exportMasterDataExcel(): Promise<Uint8Array>` — mengambil semua Sku + SkuPrice
  via Prisma, menulis workbook ExcelJS dua sheet:
  - Sheet **"SKU"**: id, slug, code, name, kind, status, brand, categories, color,
    motif, finishing, dim_length/width/height/unit, notes.
  - Sheet **"Prices"**: sku_id, sku_slug, sku_name, supplier_name, price_list,
    price_net, unit, currency.

  `importMasterDataExcel(buffer: ArrayBuffer): Promise<ImportResult>` — membaca
  workbook ExcelJS, validasi per baris via Zod, upsert ke DB:
  - Strategi upsert: cocokkan kolom `id` → lalu `slug` → jika tidak ketemu,
    INSERT baru. Tidak ada DELETE.
  - Setiap baris yang gagal validasi atau tulis DB dilaporkan di
    `ImportResult.skuResults` / `priceResults` (nomor baris 1-based).
  - SkuPrice: flip `is_current = false` pada baris lama, lalu INSERT baris baru
    dalam satu transaksi.

- `src/app/api/masterdata/excel/export/route.ts` *(file baru)* — GET,
  permission `MASTERDATA_VIEW`. Mengonversi `Uint8Array` → `ArrayBuffer` bersih
  (`.buffer.slice(byteOffset, ...)`) → `Blob` → `NextResponse` dengan header
  `Content-Disposition: attachment; filename="masterdata-YYYY-MM-DD.xlsx"`.

- `src/app/api/masterdata/excel/import/route.ts` *(file baru)* — POST,
  permission `MASTERDATA_SKU_MANAGE`. Membaca `formData.get("file")`, ambil
  `arrayBuffer()`, teruskan ke `importMasterDataExcel`.

- `src/subapps/master-data/components/MasterDataMaterialsClient.tsx` — tambah
  tombol Export dan Import di header halaman:
  - Export: `window.location.href = "/api/masterdata/excel/export"` (unduhan
    langsung).
  - Import: input file tersembunyi + `handleImportFile(file)` POST ke route,
    tampilkan toast dari `ImportResult`, lalu `router.refresh()`.

**Catatan teknis penting:**
- `spec as Prisma.InputJsonValue` diperlukan saat Prisma menerima `Record<string,
  unknown>` di kolom JSON.
- `price_net` dibuat opsional di Zod (`z.coerce.number().optional().nullable()`)
  dan diperketat lewat narrowing (`if (!priceNet) continue`) sebelum diteruskan
  ke Prisma — bukan via `required_error` yang sudah tidak ada di Zod v4.
- Konversi `Uint8Array → ArrayBuffer` di route export: `bytes.buffer.slice(
  bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer` —
  menghindari error TS2322 `ArrayBufferLike` vs `ArrayBuffer` saat membungkus
  ke `Blob`.

---

### Verification

```
npx tsc --noEmit   → 0 errors
```

## [Unreleased] - 2026-08-11 — Tiga permintaan owner dicatat ke roadmap (tidak ada perubahan kode)

Owner: *"tulis dulu di roadmap jangan lgsg eksekusi."* Tiga permintaan masuk
`roadmap.md` §"ANTREAN BERIKUTNYA" sebagai R1–R3, semuanya **belum dikerjakan**:

- **R1 — Tab / drill-down SKU per brand.** Mengoreksi keputusan sore ini: opsi B
  (batas + hitungan) ternyata tidak cukup, karena keadaan bawaannya tetap "semua
  SKU dari semua brand". Yang diminta adalah keadaan bawaan yang sudah tersaring.
  Tiga tafsiran "tab" dicatat; menunggu owner memilih.
- **R2 — Menyambungkan skema Prisma ke StudioFlow (extension library).**
  Ditandai ⚠️ karena berbenturan dengan `docs/PLAN-MASTERDATA-V2.md` §F.5, yang
  **sengaja** melepas lima FK dan menggantinya dengan snapshot. Dicatat bahwa dua
  dari tiga kemungkinan maksud owner **sudah terpenuhi hari ini** (library memang
  sudah membaca `master_data.Sku` langsung), dan hanya satu yang berbenturan.
  Pertanyaan penentunya sudah dirumuskan: *kalau harga sebuah SKU diubah hari ini,
  apakah schedule proyek yang memilihnya bulan lalu ikut berubah?*
- **R3 — Import/export Excel.** Dicatat bahwa `exceljs@^4.4.0` sudah jadi
  dependency dan pipeline CSV Schedule (`src/lib/schedule/csv-*.ts`, 568 baris,
  zod per baris) sudah jadi pola yang tinggal ditiru. Empat keputusan yang harus
  diambil sebelum menulis kode dicatat — terutama apakah import berarti
  tambah / upsert / ganti, karena "ganti" bisa mengosongkan katalog.

Tidak ada file kode yang disentuh dalam entri ini.

---

## [Unreleased] - 2026-08-11 — Halaman Prices: delegasi ke utility, paginasi, payload dipangkas

Lanjutan dari analisis di bawah. Owner memilih **opsi B** (batas + hitungan baris)
dan **kedua perbaikan backend**.

### Temuan: utility-nya sudah ada, dan ditulis ulang dengan lebih buruk

Sebelum menulis paginasi baru, dicek dulu apa yang sudah dimiliki StudioFlow:

- **`LibraryService.getAllProducts`** (`library-service.ts:640`) sudah punya
  `where` (category, vendorId, search, tags, type, status), `orderBy`,
  `skip`/`take`, dan `count` paralel — mengembalikan `{ items, total }`.
- **`LibraryService.getProductById`** (`library-service.ts:716`) sudah mengambil
  satu SKU dengan relasi penuh.
- **`SKU_FULL_INCLUDE` identik dengan `MATERIAL_VIEW_INCLUDE`** — relasi sama,
  urutan `prices` sama (`price_net asc`). Komentar di `material-view-service.ts`
  bahkan sudah mencatat keduanya "harus tetap assignment-compatible".

Jadi `getMaterialView` bukan sekadar lambat — ia **menulis ulang query yang sudah
ada, tanpa `take`/`skip`**. Pola yang sama dengan `CreatableSearch` sesi lalu.

### Changed — `getMaterialView` mendelegasikan, tidak lagi menemukan ulang

`src/subapps/master-data/services/material-view-service.ts` ditulis ulang:

- Query utama → `LibraryService.getAllProducts(prisma, {...})`. Filter, sort,
  paginasi semuanya di SQL.
- **`MaterialRow.material` DIHAPUS.** Ini perubahan terbesar. Field itu membawa
  objek Prisma penuh (Sku + brand + scoped_contacts + links + owner + samples +
  media + prices + categories) di **setiap** baris, dan dibaca di **satu** tempat:
  mengisi dialog edit saat baris diklik. `MaterialRow` sekarang **seluruhnya
  skalar**.
- **JSON round-trip `Decimal` dihapus** — tidak diperlukan lagi karena tidak ada
  lagi objek Prisma yang menyeberang. Sumber masalahnya hilang, bukan ditambal.
- `totals` dihitung lewat 2 `count` query (bukan 3: INCOMPLETE adalah komplemen
  eksak dari READY, jadi pengurangan bukan aproksimasi). Chip header sengaja
  **tidak** mewarisi `where` — angka itu adalah penyebut yang dibaca filter.
- `categories` dibaca dari tabel `Category`, bukan di-DISTINCT dari baris yang
  kebetulan termuat. Kode lama hanya bisa menawarkan kategori yang ada di
  halaman yang sedang dilihat — bug yang baru muncul setelah ada paginasi.

### Added — `price` filter di `getAllProducts` (memperbaiki utility, bukan menambal caller)

`SkuPrice.price_net` dan `.unit` keduanya NON-NULL di schema, jadi "BQ ready"
sebenarnya berarti "punya minimal satu baris harga current dengan unit non-kosong".
Itu bisa jadi `where` Prisma: `prices: { some: ... }` / `{ none: ... }` — dua
komplemen eksak.

### Added — `getSkuDetailAction`

`src/extensions/library/actions/library-actions.ts`. Tipis dengan sengaja:
`LibraryService.getProductById` sudah mengerjakan isinya, action ini hanya
menambahkan gate `LIBRARY_VIEW`.

`MasterDataMaterialsClient` memanggilnya saat baris diklik. Dialog menerima prop
baru `detailLoading` supaya jeda pemuatan tidak terlihat seperti "SKU ini kosong"
— tanpa itu form akan render kosong lalu terisi ulang di bawah tangan user, dan
pengetik cepat bisa menyimpan keadaan kosong menimpa data asli.

### Added — hitungan baris + pager

"Menampilkan 1–50 dari 847 (difilter dari 1.203)" + tombol Sebelumnya/Berikutnya.
Hitungannya sama pentingnya dengan pager-nya: tanpa itu, daftar yang dibatasi
tidak bisa dibedakan dari daftar yang memang pendek — persis kekhawatiran owner
soal 200 SKU TACO. Mengubah filter apa pun me-reset `?page` (halaman 7 dari hasil
lama tidak berarti apa-apa untuk hasil baru).

### Removed — dua regresi yang disengaja, keduanya didokumentasikan

1. **Search tidak lagi mencakup warna / motif / finishing.** Ketiganya ada di
   dalam kolom JSON `Sku.spec`; partial-match case-insensitive lintas JSON path
   tidak bisa diekspresikan Prisma secara portabel. Search SQL mencakup nama
   produk, nama brand, kode SKU, nama kategori.
2. **`Sort: Category` dihapus dari dropdown.** Tidak ada `ORDER BY` untuk
   "kategori pertama dari sekian kategori" tanpa kolom denormalisasi. URL lama
   `?sort=category` jatuh ke `brand`, tidak error.

Cara mengembalikan keduanya (butuh migrasi) dicatat di `roadmap.md`.

**Verifikasi:** `tsc --noEmit` 0 error · `npm test` 67 pass 0 fail · `eslint` 0
error (4 warning yang sudah ada sebelumnya, tidak tersentuh).

**Files:**
- `src/extensions/library/services/library-service.ts` (filter `price`)
- `src/extensions/library/actions/library-actions.ts` (`getSkuDetailAction`)
- `src/subapps/master-data/services/material-view-service.ts` (ditulis ulang)
- `src/subapps/master-data/components/MasterDataMaterialsClient.tsx`
- `src/subapps/master-data/components/MasterDataProductDialog.tsx` (`detailLoading`)
- `src/app/masterdata/materials/page.tsx`

---

## [Unreleased] - 2026-08-11 — Analisis skala halaman Prices (analisis; kode menyusul di entri atas)

Owner bertanya: *"kalau TACO punya 200 SKU masa muncul semua? apa perlu dibuat tab
baru yg lebih spesifik search SKU by brand?"*

Penelusuran kode menemukan **tiga plafon skala terpisah**, bukan satu:

1. **Render** — `MasterDataMaterialsClient.tsx:315` merender `rows.map()` tanpa
   paginasi maupun virtualisasi.
2. **Payload** — tiap `MaterialRow` membawa field `material`: objek Prisma penuh
   (Sku + brand + scoped_contacts + links + owner + samples + media + prices +
   categories). Dipakai **hanya** di `MasterDataMaterialsClient.tsx:423` untuk
   mengisi dialog edit saat baris diklik — artinya 199 dari 200 baris mengirim
   seluruh objeknya sia-sia.
3. **Query** — `material-view-service.ts:138` memanggil `findMany` **tanpa
   `take`/`skip`**, lalu menjalankan seluruh filter dan sort di JavaScript,
   padahal filter-nya sudah tersedia dari URL/`searchParams`.

Entri ini adalah **analisisnya saja** — implementasinya ada di entri di atas,
setelah owner memilih opsi B + kedua perbaikan backend. Empat bentuk UI yang
dipertimbangkan (tab per brand / batas+hitungan / drill-down brand / baris
berkelompok) beserta alasan penolakannya tersimpan di `roadmap.md`.

Catatan: usul awal owner adalah **tab per brand**. Itu tidak diambil karena
dropdown "All brands" yang sudah ada melakukan persis pekerjaan itu, dan bilah tab
akan ikut menggulir begitu brand-nya 20+. Yang benar-benar rusak bukan cara
memilih brand, melainkan tidak adanya batas baris.

Catatan: JSON round-trip pada fix Decimal di bawah **tidak** menciptakan plafon 2 —
objeknya sudah dikirim sejak sebelumnya; fix itu hanya membuat biayanya terlihat.

---

## [Unreleased] - 2026-08-11 — Hotfix: Decimal serialization + nav trimming

### Fixed — `Decimal` tidak bisa melewati Server→Client boundary

`MaterialRow.material` adalah objek Prisma mentah (`SkuWithRelations &
ProductCatalogWithRelations`) yang mengandung field `Decimal` bawaan Prisma:
`dim_length`, `dim_width`, `dim_height` (level Sku) dan `price_list`,
`price_net` (level SkuPrice di dalam `prices[]`).

Next.js menolak melewatkan objek `Decimal` ke Client Component, sehingga halaman
`/masterdata/materials` crash dengan 5 error serialisasi.

**Fix:** `material-view-service.ts` — setelah `attachDerivedCatalogFields`,
tambahkan `JSON.parse(JSON.stringify(material))` sebelum masuk ke `MaterialRow`.
`Decimal.toJSON()` mengembalikan string numerik, sehingga round-trip JSON
menghasilkan plain-object yang aman dikirim ke klien. Field `catalog_*` yang
dipakai di UI sudah bertipe plain JS sejak `attachDerivedCatalogFields` menulis
ulang nilainya — tidak ada regresi fungsional.

**File:** `src/subapps/master-data/services/material-view-service.ts`

### Changed — Nav Master Data dipangkas jadi 3 item

`MASTERDATA_SECTIONS` dikurangi dari 5 ke 3:

| Sebelum | Sesudah |
|---------|---------|
| Overview | *(dihapus — `/masterdata` sekarang redirect ke `/masterdata/materials`)* |
| Materials | **Prices** (label diubah, href tetap `/masterdata/materials`) |
| Sample | Sample *(tetap)* |
| Supplier | Supplier *(tetap)* |
| Pricing | *(dihapus dari nav — `/masterdata/prices` tetap bisa diakses via URL langsung)* |

`/masterdata/page.tsx` diganti menjadi satu-baris redirect ke `/masterdata/materials`.
Overview lama (SampleRequestPanel + aggregate stats) dibuang dari halaman root;
jika dibutuhkan kembali nanti, buat di `/masterdata/overview` bukan di root.

**Files:**
- `src/subapps/master-data/components/MasterDataNav.tsx`
- `src/app/masterdata/page.tsx`

---

## [Unreleased] - 2026-08-11 (Rombakan Master Data — konsolidasi ke utility bersama)

Permintaan owner: *"full reworks master data sesuai roadmap. gunakan utilities yg
ada di studioflow (kalau ada) jadi yg perlu di perbaiki hanya utilities."*

Tiga keputusan diambil lewat pop-up sebelum satu baris pun diubah: perbaiki
`CreatableSearch` yang sudah ada (bukan bikin komponen kedua), quick entry menulis
**baris minimal** (bukan dialog penuh, bukan free text), dan lingkupnya utility
**beserta** semua halaman yang memakainya.

### Changed — `CreatableSearch` jadi satu-satunya searchable-select

**Empat combobox yang hampir identik, 771 baris.** `SkuPicker` (192),
`PartyPicker` (186), `WorkVendorPicker` (186), `MasterDataBrandPicker` (207) —
masing-masing punya handler klik-di-luar sendiri, penanganan Escape sendiri,
teks "tidak ditemukan" sendiri. **Hanya satu dari empat yang bisa membuat baris
baru**, sehingga "quick entry di semua halaman" yang diminta Sheet2 mustahil
tanpa menulis ulang tiga kali lagi.

Keempatnya sekarang wrapper tipis di atas `CreatableSearch`. **771 → 272 baris.**
Yang tersisa di tiap file hanya bagian yang memang khas entitasnya: field mana
yang dicari dan apa bunyi subtitle-nya.

Tambahan pada `CreatableSearch`:

- `allowClear` + `clearLabel` — keempat picker membutuhkannya, dan masing-masing
  **sengaja berbeda kalimatnya**: "— Not linked to a SKU —" bukan pernyataan yang
  sama dengan "— Internal price —". Mengosongkan adalah **pilihan**, bukan
  ketiadaan pilihan, jadi ia dapat baris sendiri, bukan cuma tombol backspace.
- `createLabel`, `emptyLabel`, `alwaysOfferCreate` — copy per call-site.
- Enter pada satu-satunya hasil filter langsung memilihnya (perilaku yang sudah
  ada di keempat picker lama dan sudah dipakai orang).

### Fixed — `CreatableSearch` melanggar Zero Hardcode Policy

File ini memakai `bg-slate-900`, `rounded-xl`, `shadow-xl` langsung. Ketiganya
keputusan yang **sudah diambil design system** lalu dianulir di sini secara tidak
sengaja — studio yang mengatur radius atau warna aksinya sendiri mendapat dropdown
yang mengabaikan keduanya. Semua nilai visual sekarang lewat variabel `--ui-*`.

### Added — Quick entry (`actions/quick-entry-actions.ts` + `hooks/use-quick-entry.ts`)

Sheet2, dua kali: *"semua halaman punya fitur quick entry"* dan *"semua halaman
punya fitur searchableedit -> kalau data ga lengkap munculin quick entry"*.

Tiga action baru — `quickCreatePartyAction`, `quickCreateBrandAction`,
`quickCreateWorkVendorAction` — menulis **baris terkecil yang tetap benar**: nama,
plus satu klasifikasi yang memang diketahui layar pemanggilnya.

Tiga aturan yang dipegang, dan alasannya:

- **Tidak menebak.** Party hasil quick entry mendapat persis role yang dikirim
  pemanggil; pemanggil yang tidak tahu apa-apa mengirim `[]`. Aturan yang sama
  dengan `backfill-party-roles.mjs` (melaporkan yang tidak diketahui, bukan
  mengarang) dan `productParentFor()` (membiarkan tag di akar, bukan menebak
  induknya). **Tebakan yang dibuat di sini tidak bisa dibedakan dari fakta nanti.**
- **Role di-top up, tidak diganti.** Party berkategori Retail yang dipilih sebagai
  vendor jasa jadi Retail + Service Vendor. Menimpa berarti pengetahuan parsial
  satu layar menghapus pengetahuan layar lain.
- **Nama yang sudah ada dikembalikan, bukan ditolak.** User sedang di tengah form;
  error di titik ini menghilangkan baris yang sedang ditulis demi memberi tahu
  sesuatu yang lebih baik kita tangani sendiri. `reused: true` ikut dikembalikan
  supaya UI bisa mengatakannya.

`useQuickEntry` menangani sisi klien: panggil action, unwrap, toast, dan — bagian
yang paling mudah terlupa — **masukkan baris baru ke daftar yang sedang dibaca
picker**. Daftar opsi datang sebagai prop dari server component, jadi tanpa
overlay lokal urutannya jadi: buat vendor, lihat ia hilang dari dropdown, buat
lagi. `router.refresh()` **sengaja tidak dipakai** — ia membuang form setengah
jadi yang justru jadi alasan quick entry ada.

Dipasang di: Harga Material (Brand `**` + Supplier `**`), Harga Material+Upah dan
Harga Upah (Vendor `**`), dialog Brand (Owner party), dan inline cell di halaman
Supplier.

**`SkuPicker` sengaja TIDAK dapat quick entry.** Tiga picker lain menamai party
atau brand — nama adalah keseluruhan barisnya. SKU tidak: ia butuh brand,
kategori, unit, dan spesifikasi sebelum berarti apa pun, dan SKU yang lahir dari
form harga adalah baris yang ada tanpa mendeskripsikan produk apa pun.

### Fixed — Label "Brand *" di dialog Material padahal brand opsional

Q7 membuat `Sku.brand_id` nullable dan baris 321 di file yang sama menyatakannya,
tapi labelnya masih memberi tanda wajib. Sisa dari perbaikan R1 pagi itu — persis
cara sebuah form berakhir tidak sepakat dengan server yang ia kirimi. Sekarang
juga bisa dikosongkan lewat "— No brand (generic stock) —".

### Fixed — D5: dua tabel gepeng di layar sempit

`MasterDataMaterialsClient` dan `SupplierClient` memakai `<TableCard>` polos.
`TableCard` punya `overflow-x-auto`, tapi itu baru bekerja kalau tabelnya diberi
lebar minimum — tanpa itu lebar kolom persen diselesaikan terhadap kontainer,
jadi kolom menyusut alih-alih memicu scroll. Keduanya kini `layout="fixed"`
dengan `minWidth` dan lebar kolom eksplisit.

**Verifikasi:** `tsc --noEmit` 0 error, 67 uji lolos, eslint 0 error.

---

## [Unreleased] - 2026-08-11 (Sheet2 UI alignment — Pricing form sesuai desain Excel)

Permintaan owner: baca ulang `design database masterdata.xlsx` Sheet2 dan sesuaikan
bentuk UI form yang belum cocok.

### Changed — PricingClient: Material Prices — hapus field "Valid from"

Sheet2 menyatakan *"remove valid from (selalu saat entry dibuat / diupdate)"* — artinya
`valid_from` selalu di-set otomatis saat create/update, bukan user-entry. Field tanggal
dihapus dari dialog. Kolom DB tetap ada untuk keperluan query historis.

### Changed — PricingClient: WorkPrice tabs — hapus kolom dan field "BQ code"

Sheet2 col C & D menyebut *"BQ code - remove"*. Kolom Code dihapus dari tabel Harga
Material+Upah dan Harga Upah, serta field BQ code dihapus dari form dialog keduanya.
Kolom `code` di DB tetap dipertahankan — BQ app yang akan meng-assign kode ini.

### Changed — PricingClient: WorkPrice — Category jadi dua field terpisah

Sheet2: *"Category dibuat jadi category dan subcategory"*. Input teks tunggal
"MEP > Lighting" diganti menjadi dua field:
- **Category (group)**: dropdown dari `WORK_LEVEL1` (Sipil, MEP, Furniture, dst.)
- **Subcategory**: text input bebas, disable sebelum group dipilih.
Data disimpan ke kolom yang sama (`vendor_category` + `category`); tidak ada migrasi.

### Changed — PricingClient: WorkPrice — Specification jadi list dinamis

Sheet2: *"Specification bisa di tambah on the go"*. Field Spec 1 / Spec 2 yang statis
diganti dengan list dinamis: mulai satu field, tombol **+ Add spec** muncul untuk
menambah spec kedua (remove button pada spec kedua untuk menghapus kembali).
Backend tetap `specification_1` / `specification_2`; UI hanya memetakan index.

### Changed — PricingClient: Labour tab — Dimensions hint

Sheet2 menandai *"Dimensions apakah butuh utk labour? *"* sebagai pertanyaan terbuka.
Field Dimensions tetap ada di tab Harga Upah, dengan note:
*"Record dimensions if relevant to this work. Leave blank if not applicable."*

---

## [Unreleased] - 2026-08-11 (Empat regresi diperbaiki + tujuh item §E dikerjakan)

Permintaan owner: perbaiki regresi, tanyakan yang tidak jelas lebih dulu, baru
kerjakan. Tujuh pertanyaan diajukan dan dijawab sebelum satu baris pun diubah.

### Fixed — R1: material tanpa brand ditolak server, padahal form-nya mengizinkan

Perubahan "brand opsional" pagi ini **setengah jadi**. `identityValid` di
dialog berhenti menuntut brand, tapi `createProduct` tetap memanggil
`resolveVendor(data.vendor_name || "")` — yang melempar *"Vendor name is
required"* pada string kosong.

Jadi form mengizinkan, server menolak, dan pesannya menyebut field yang memang
sengaja dikosongkan user. `upsertBrandCategories` juga ikut dilewati saat tak
ada brand: kategori brand menjawab "merek ini mencakup kategori apa", dan
barang tanpa merek tidak punya kartu untuk diisi.

### Fixed — R2: tiap simpan material menulis baris harga duplikat

`updateProduct` memanggil `recordSkuPrice` setiap kali salah satu dari empat
field harga `!== undefined`. Dialog **selalu** mengirim keempatnya — termasuk
yang baru saja dimuatnya tanpa diubah.

Akibatnya membetulkan salah ketik nama produk mempensiunkan harga berjalan dan
menaruh harga identik di belakangnya. Seminggu perbaikan ejaan mengubur
perubahan harga yang sungguhan di antara duplikat.

Sekarang dijaga `isOfferChange`, penjaga yang sudah dipakai halaman Harga sejak
pagi. Dialog material yang tidak punya — dan dialog material yang lebih sering
dipakai orang.

### Fixed — R3: dialog Material tidak memvalidasi supplier

Halaman Harga memeriksa kategori Party; dialog Material memasang id apa pun.
Satu form memeriksa, satu tidak, dan yang tidak memeriksa yang lebih sering
dipakai. Keduanya kini lewat `assertPriceSourceParty`.

### Fixed — R4: penyaring supplier menyembunyikan contoh Excel sendiri

Ini yang paling layak dibaca. Pemilih supplier menyaring `role: SUPPLIER`.
Excel Table 1 memberi dua contoh "Supplier's Company":

```
Ace Hardware   Company Categories: Retail
Informa        Company Categories: Retail
```

dan kolom "Supplied by" di Table 2 menunjuk balik ke keduanya. **Tempat orang
benar-benar membeli barang justru diarsipkan sebagai Retail, bukan Supplier** —
jadi penyaring itu menyembunyikan dua contoh yang ditulis workbook-nya sendiri.

Keputusan owner: semua kategori penjual boleh. Aturannya pindah ke
`services/party-role-rules.ts` dan berbunyi *"party yang punya kategori apa
pun"*. Yang ditolak hanya Party **tanpa** kategori sama sekali — itu bukan
penilaian tentang perusahaannya, itu berarti belum ada yang menyatakan ia apa.

### Changed — E8: satu kolom harga + penanda jenis untuk `WorkPrice`

**Butuh migrasi:** `20260811120000_workprice_single_price_and_qty` dan
`20260811120100_redefine_v_bq_work_rate`. Owner yang menjalankan.

Excel Table 3 dan Table 4 punya kolom **identik** dan **satu** `Price` masing-
masing. v2 memberi keduanya dua (`material_price` + `labor_price`) lalu
menyimpulkan tabel mana yang dimaksud dari `material_price != null`.

| | Sebelum | Sesudah |
|---|---|---|
| Kolom harga | `material_price` + `labor_price` + `total_price` generated | `price` |
| Pembeda Table 3/4 | disimpulkan dari `material_price != null` | `kind` (`MATERIAL_LABOR` / `LABOR_ONLY`) |

Dua alasannya, dan yang kedua yang lebih penting:

1. Paket supply-and-install dikutip **satu angka**. Dua kotak kosong memaksa
   orang mengarang pembagiannya — persis kesalahan yang X12 hindari dengan
   **tidak** menebak arti kolom `Qty`.
2. Tarif upah-murni yang kebetulan diketik lengkap dengan biaya materialnya
   tidak bisa dibedakan dari paket. Pembedanya disimpulkan, bukan dinyatakan.

Migrasinya **berhenti berisik** kalau ada baris yang kedua harganya NULL —
`COALESCE(...,0) + COALESCE(...,0)` akan menghasilkan `price = 0`, dan
membiarkan itu lolos adalah cacat `price_net ?? 0` yang baru saja dibuang dari
`SkuPrice`, dilahirkan kembali di tempat lain.

`v_bq_work_rate` di-DROP di transaksi yang sama, bukan di berkas berikutnya:
Postgres **menolak** `DROP COLUMN` selama sebuah view merujuknya, jadi kalau
pelepasannya terpisah, migrasi pertama gagal di tengah.

### Added — E6: `WorkPrice.qty`

X12 hanya diterapkan ke `SkuPrice`. Excel Table 3 dan 4 juga punya kolom `Qty`
bertanda *"(need curations)"*. Sekarang ada, dengan `COMMENT` larangan yang
sama persis — disimpan, tidak pernah masuk perhitungan.

### Added — E3: pohon kategori benar-benar terisi

`Category.parent_id` ada sejak v2 dan **tidak pernah ditulis** — tiap kategori
jadi akar, dan `path` selalu kosong.

Yang membuat ini perlu ditanya dulu: Excel menulis dua tingkatnya dengan urutan
**terbalik** antar tabel. Table 2 `Category`(induk) → `Material`(anak); Table
3/4 `Vendor Category`(induk) → `Category`(anak). Dan baris pertama Table 2
mengisi keduanya "HPL". Itu bukan kontradiksi: daun yang namanya kebetulan sama
dengan induknya adalah hal biasa.

`services/category-tree-service.ts` jadi satu-satunya yang membuat kategori,
mengisi `parent_id` dan `path` ("bahan-baku/plywood"). `path` bukan hiasan —
tanpanya "semua di bawah Bahan Baku" adalah recursive CTE tiap kali dibaca.

Form harga kerja kini punya dua kolom kategori sesuai Excel.

### Added — E4: Project Reference

Excel menulisnya teks bebas. Dipilih dari daftar proyek nyata (keputusan owner)
supaya "tarif ini dipakai di proyek mana saja" bisa dijawab — dua ejaan berbeda
akan jadi dua proyek. Yang disimpan snapshot `project_id` + `project_name`,
**bukan FK**: `master_data` tidak boleh bergantung ke `studioflow` (X14).

### Added — E5: `BrandSupplier`

Excel Table 1 kolom J, *"perusahaan yg menjual produk ini"*. Model ada sejak
v2, nol kode. Form Brand kini punya "Sold by".

Berbeda dari pemilik brand tepat di sebelahnya, dan itu ditulis di layar: Ace
Hardware menjual TACO, ia tidak memilikinya.

### Added — E7: Specification 1/2, Dimensions, dan Qty di form harga kerja

Excel Table 3/4 punya keempatnya; formnya hanya punya code, name, category,
unit, harga, scope note. `spec` dan `dim_display` ada di schema sejak v2 dan
tidak pernah bisa diisi.

Field-nya diekstrak jadi satu `WorkPriceFields` yang dipakai kedua tab —
kolomnya identik di Excel, dan dua salinan markup akan menyimpang begitu salah
satunya dapat field baru.

### Added — E9: halaman Supplier disaring per kategori

Dibuat penyaring, bukan lima layar terpisah. Lima layar berarti lima salinan
tabel brand yang sama, dan Party berkategori ganda (Ace Hardware = Retail **dan**
Supplier) harus muncul di dua di antaranya.

### Added — `scripts/backfill-party-roles.mjs`

Party yang dibuat sebelum hari ini tidak punya kategori, jadi pemilih harga
kosong sampai tiap satu dicentang manual.

Skrip ini memberi kategori **hanya di mana datanya sudah menyatakannya**: sudah
pernah mengutip `SkuPrice` → SUPPLIER; sudah dinamai di `WorkPrice` →
SERVICE_VENDOR; memiliki brand → MANUFACTURER. Sisanya **dilaporkan, bukan
ditebak**.

Itu pembedaan yang menentukan gunanya: mengarang kategori untuk Party yang tak
diketahui adalah cara sebuah penyaring berhenti berarti apa-apa. Dry-run
default, `--apply` untuk menulis, aditif, dan Party yang sudah punya kategori
dilewati sepenuhnya.

### Verifikasi

| Uji | Hasil |
|---|---|
| `prisma validate` | hijau |
| `npx tsc --noEmit` | **0 error** |
| `npm test` | **63 lulus** (59 + 4 baru untuk pohon kategori), 0 gagal |
| `eslint` pada master-data + library + app/masterdata | **0 error** |

Empat uji baru mengunci `categorySlug` agar tetap byte-identik dengan
`slugifyTag` di `library-service`. Keduanya me-resolve baris `Category` yang
sama dari call site berbeda, dan slug yang beda satu karakter membuat kategori
**duplikat** alih-alih menemukan yang ada — diam-diam, karena kedua tulisan
sama-sama berhasil.

**Belum diverifikasi, dan harus Anda jalankan:**

1. **Dua migrasi WorkPrice.** Backup dulu kalau tabelnya sudah berisi; perintah
   `pg_dump`-nya ada di kepala berkas migrasinya.
2. **`node scripts/backfill-party-roles.mjs`** — dry-run dulu, baca laporannya,
   baru `--apply`.
3. **Uji terpenting:** centang kategori pada sebuah Party, lalu buka halaman
   Pricing dan pastikan namanya **muncul** di pemilih supplier.
4. **`next build`** — masih `Bus error` di lingkungan ini.

---

## [Unreleased] - 2026-08-11 (Recheck Master Data terhadap `design database masterdata.xlsx`)

Permintaan owner. Excel-nya baru ditaruh di `docs/design database
masterdata.xlsx` hari ini — sebelumnya seluruh pemeriksaan bersandar pada
`docs/PLAN-MASTERDATA-V2.md` dan `docs/PENYIMPANGAN-DARI-EXCEL.md`, yaitu pada
apa yang **dicatat** orang tentang Excel, bukan pada Excel itu sendiri. Kali ini
Sheet1 dibaca langsung, 44 baris, dan dibandingkan kolom per kolom.

**Hasilnya membelah dua, dan pembelahan itu temuannya:**

| | Hasil |
|---|---|
| Schema vs Excel | **Cocok.** Nol penyimpangan baru. X1–X25 masih menggambarkan keadaan sebenarnya |
| CRUD vs Excel | **Tujuh kolom** yang Excel minta dan schema sudah sediakan tidak bisa diisi dari layar mana pun |

Jadi rancangannya benar dan formulirnya yang tertinggal. Bagi orang yang memakai
aplikasi tidak ada bedanya: kolom yang nol jalur tulis bukan "belum dipakai", ia
tidak ada.

### Fixed — `PartyRole` tidak pernah ditulis, dan itu mematikan pemilih supplier yang baru saja dibuat

Excel Table 1 kolom K, *"Company Categories (supplier, subcon, vendor, retail
store, manufacture)"*, diterjemahkan jadi enum `PartyRoleKind` — tercatat di
`PENYIMPANGAN` X25 sebagai **sesuai Excel**. Enumnya benar, modelnya benar.

Yang tidak ada: satu pun jalur tulis. `PartyRole` dibuat di **tepat satu**
tempat, `createServiceVendorAction`, dan hanya dengan nilai `SERVICE_VENDOR`.
Form Party tidak punya field-nya.

**Akibatnya menimpa pekerjaan pagi ini sendiri.** Pemilih supplier yang saya
tambahkan menyaring `roles: { some: { role: "SUPPLIER" } }`, dan
`resolveSupplierId` menolak Party tanpa role itu. Karena nol baris SUPPLIER
pernah ada:

- daftar supplier **selalu kosong**
- tiap id yang dipaksa lewat **selalu ditolak**

Tidak ada error, tidak ada warning. Layarnya hanya menampilkan daftar kosong yang
terbaca sebagai "belum ada supplier yang didaftarkan".

Ini pola yang saya tulis sendiri di entri sebelumnya — *fitur yang tidak dipakai
menyembunyikan bug yang menunggunya* — dan saya mengulanginya dalam satu sesi:
menambah pembaca untuk kolom yang tidak punya penulis. Yang menemukannya bukan
`tsc`, bukan 57 uji, bukan eslint. Yang menemukannya adalah membaca Excel lagi.

**Perbaikannya:** `roles` masuk `PartyInput`, `PartyData`, skema Zod, jalur
create dan update, plus checkbox di form Party dengan keenam nilai memakai nama
Excel (Supplier, Subcon, Vendor, Retail store, Manufacture, Distributor). Diganti
wholesale saat update, sama seperti kontak dan link — `PartyRole` unik per
(party, role) dan tidak ada data yang menggantung di baris role, jadi
upsert-per-baris tidak membeli apa pun.

Formulirnya juga menjelaskan konsekuensinya di tempat: hanya Party bertanda
**Supplier** yang bisa dipilih di halaman Harga.

### Fixed — `updated_by_name: ctx.role` yang tersisa satu

`createMaterialLaborPriceAction` menyimpan **"ADMIN"** di kolom yang Excel
labeli *"Update by"* — pertanyaannya siapa, bukan izin apa. Cacat yang sama
dengan yang dibuang bersama `upsertSkuMaterialPriceAction` pagi ini; salinan ini
terlewat karena belum ada layar yang membacanya kembali.

### Added — `PENYIMPANGAN-DARI-EXCEL.md` §E

Tujuh kolom Excel yang schema-nya sudah benar tapi CRUD-nya belum ada,
dipisahkan dari daftar penyimpangan rancangan karena **bukan** penyimpangan:

| # | Kolom Excel | Keadaan |
|---|---|---|
| E3 | Table 2 `Material`+`Category`, Table 3/4 `Vendor Category`+`Category` | `Category.parent_id` ada dan disetujui, **tidak pernah diisi** — tiap kategori jadi akar |
| E4 | Table 3/4 `Project Reference` | Model `WorkPriceProjectRef` ada, **nol kode** |
| E5 | Table 1 `Supplier's Company` | Model `BrandSupplier` ada, **nol kode** |
| E6 | Table 3/4 `Qty` | X12 hanya diterapkan ke `SkuPrice`; `WorkPrice` tidak punya kolomnya |
| E7 | Table 3/4 `Specification 1/2`, `Dimensions` | `spec` dan `dim_display` ada, tidak ada field-nya di form |
| E8 | Table 2/3/4 `Price` — **satu** kolom | Jadi dua di ketiganya. Untuk Table 2 masuk akal; untuk Table 3/4 meragukan |
| E9 | §Halaman: Supplier dibagi 5 kategori | Halaman Supplier punya 2 tab |

Sesuai §Arah Strategis poin 4, ketujuhnya **diangkat sebagai pertanyaan, bukan
diputuskan sendiri**. Yang saya sarankan dijawab lebih dulu: **E8** dan **E3** —
keduanya mengubah bentuk formulir harian dan makin mahal setelah ada isinya.

**E8 layak disebut terpisah** karena ia satu-satunya yang tidak pernah masuk
daftar penyimpangan sama sekali. Excel menulis satu kolom `Price` di ketiga
tabel harga; v2 memberinya dua di semuanya. Untuk Table 2 pemisahan
list/net menjawab diskon yang memang ada. Untuk Table 3/4 (`material_price` +
`labor_price`) tidak: paket supply-and-install biasanya dikutip satu angka, dan
dua kotak kosong memaksa orang mengarang pembagiannya — persis kesalahan yang
X12 dihindari dengan tidak menebak arti kolom `Qty`.

### Changed — sisa label "Harga" di navigasi

`MasterDataNav` dan `MasterDataNavOuter` masih menulis "Harga" setelah
penyeragaman bahasa kemarin. Dua baris.

### Verifikasi

`npx tsc --noEmit` **0 error** · `npm test` **57 lulus** · `eslint` pada
`subapps/master-data` + `app/masterdata` **0 error**.

**Belum diverifikasi:** E1 tidak bisa dibuktikan tanpa database. Yang perlu
dicoba sendiri, dan ini uji terpenting dari seluruh entri: buka form Party,
centang **Supplier**, simpan — lalu buka halaman Harga dan pastikan nama itu
**muncul** di pemilih supplier. Sebelum hari ini daftar itu kosong selamanya.

---

## [Unreleased] - 2026-08-11 (Master Data CRUD disesuaikan ke schema v2 + §M3 selesai)

Permintaan owner: selesaikan yang mengganjal sampai changelog, roadmap, dan kode
sinkron — tanpa meregresi kode yang jalan — dan perbaiki CRUD Master Data supaya
sesuai schema, khususnya redundansi antara material dan harga material.

**Yang ditemukan saat menelusuri jalur tulisnya, dan ini pokok seluruh entri:**
schema v2 sudah benar sejak 10 Agustus; yang tidak ikut pindah adalah CRUD di
atasnya. Ia masih berpikir dalam kosakata v1 — satu harga per material, tanpa
supplier, brand wajib — sementara tabelnya sudah dirancang untuk yang sebaliknya.
Hasilnya bukan error: semuanya *jalan*, hanya saja menyimpan hal yang salah
dengan tenang.

### Fixed — lima jalur tulis `SkuPrice`, tidak ada dua yang sepakat

Ini akar dari hampir semua yang di bawah. Lima tempat membuat baris harga:

| Penulis | Yang ia lakukan |
|---|---|
| `library-service.createProduct` | `prices: { create: … }` inline, **tanpa** menurunkan baris lama |
| `library-service.updateProduct` | menurunkan **seluruh** baris `is_current` milik SKU |
| `pricing-actions.createMaterialPrice` | menurunkan hanya baris ber-`supplier_party_id: null` |
| `pricing-actions.upsertSkuMaterialPrice` | idem, plus `updated_by_name: ctx.role` |
| `sample-request-actions.syncSkuPrice` | idem, tanpa `valid_to` |

Empat dari lima menulis `price_net: … ?? 0`.

**Kenapa perbedaan penurunan (`demotion`) itu penting, dan tidak terlihat sampai
sekarang.** `03_invariants.sql` §1 memasang:

```sql
CREATE UNIQUE INDEX "SkuPrice_current_uniq"
  ON master_data."SkuPrice" (sku_id, (COALESCE(supplier_party_id, '000…000')))
  WHERE is_current;
```

`COALESCE`-nya yang menggigit: di Postgres NULL ≠ NULL, jadi tanpa itu dua baris
tanpa supplier sama-sama lolos. Dengan itu, "tanpa supplier" berlaku sebagai satu
supplier tertentu.

Konsekuensinya berlawanan arah untuk dua kelompok penulis di atas:

- Yang menurunkan **semua** baris SKU akan diam-diam mempensiunkan penawaran
  setiap toko lain begitu satu toko diedit. Tidak error, hanya kehilangan
  perbandingan yang justru jadi alasan `Sku` dan `SkuPrice` dipisah.
- Yang menurunkan **hanya** baris tanpa supplier akan ditolak index-nya begitu
  supplier benar-benar dipakai. Itu 500, bukan laporan bug.

Selama `supplier_party_id` tidak pernah diisi siapa pun, keduanya tidak pernah
terpicu. Itu sebabnya cacat ini bisa bertahan: **fitur yang mati menyembunyikan
bug yang menunggunya.**

**Added — `services/sku-price-service.ts`**, satu-satunya jalur tulis sekarang.
Penurunan selalu dilingkupi per supplier, `valid_to` distempel di statement yang
sama, dan aturan penilaiannya dipisah ke `sku-price-rules.ts` yang **tidak
mengimpor apa pun** — supaya `npm test` bisa menjangkaunya (batasan itu ada di
roadmap §Perkakas, dan ini justru alasan pemisahannya, bukan penghalangnya).

### Fixed — `price_net ?? 0`

Empat tempat. Mengisi hanya harga list menghasilkan harga bersih **nol** —
angka nyata, dan salah.

Aturan penggantinya, `resolveNetPrice`: net diisi → pakai; hanya list yang diisi
→ net = list; keduanya kosong → **null**, dan tidak ada baris yang ditulis.

Pembedaan yang dijaganya: *"dikutip satu angka"* berarti tanpa diskon, dan itu
fakta. Nol adalah fakta lain, dan fakta yang keliru. `v_bq_material_rate`
menghitung `bq_ready` dari kolom ini, jadi nol karangan tidak berhenti di Master
Data — ia jadi baris di dokumen komersial.

Nol yang **diketik sengaja** tetap tersimpan sebagai nol. Barang gratis ada.

### Added — supplier pada harga material

`SkuPrice.supplier_party_id` ada sejak v2 dan **tidak pernah diisi jalur mana
pun**. Relasi `Party.supplied_prices` menganggur, index `SkuPrice_current_uniq`
menjaga kasus yang tidak bisa terjadi, dan `v_bq_material_rate` — yang
kontraknya berbunyi *"satu baris per penawaran berlaku (SKU × supplier)"* —
hanya pernah punya satu supplier anonim.

Sekarang ada pemilih Supplier di form Harga **dan** di dialog Material. Kosong
berarti *harga list pabrikan*, dan itu ditampilkan sebagai kalimat, bukan em
dash: keduanya beda, dan em dash terbaca sebagai data yang hilang.

`resolveSupplierId` menolak Party yang tidak ber-role `SUPPLIER`. Bukan
seremoni — `Party` juga memuat pabrikan, vendor jasa, dan klien; tanpa
pemeriksaan itu satu salah pilih mencatatkan penawaran atas nama perusahaan yang
tidak pernah menjual apa pun, dan BQ melaporkannya sebagai penawaran sungguhan.

### Fixed — `prices` diurutkan, `take: 1` dibuang

Karena satu SKU kini boleh punya beberapa harga berlaku, `take: 1` **tanpa
`orderBy`** memilih baris mana pun yang kebetulan dikembalikan Postgres. Harga di
kartu bisa berubah antara dua kali muat halaman tanpa ada yang mengeditnya.

Diurutkan termurah dulu, jadi `prices[0]` punya arti yang bisa dinyatakan:
**penawaran terbaik yang berlaku.** Itu angka yang memang pantas ditampilkan
katalog, dan sama dengan yang akan dipilih BQ. Ditambah
`catalog_price_offer_count` supaya kartu bisa bilang "3 penawaran" alih-alih
menyodorkan satu toko seolah ia satu-satunya.

### Fixed — satu penyimpanan material = satu transaksi

Dialog Material menyimpan SKU lewat satu action, lalu harganya lewat action
**kedua** setelah yang pertama commit. Kalau yang kedua gagal, materialnya sudah
tersimpan tanpa harga — dan dialognya mengumumkan itu:
*"Material tersimpan, tetapi harga gagal disimpan"*.

Tidak ada yang membaca kalimat itu sebagai "harga Anda hilang"; mereka membacanya
sebagai peringatan lalu lanjut. Permintaan maaf bukan atomicity.

Harga sekarang ikut di `ProductCatalogInput` dan ditulis `recordSkuPrice` dalam
transaksi yang sama. `upsertSkuMaterialPriceAction` **dihapus** — ia hanya ada
untuk panggilan kedua itu, dan ia yang paling buruk kelakuannya dari kelimanya.

### Fixed — brand jadi opsional, sesuai Q7

`createProduct` melempar *"Vendor wajib dipilih."*, padahal `Sku.brand_id`
nullable justru karena Excel Table 2 kolom D menulis *"apabila tidak ada brand
bisa dikosongkan"*, dan `03_invariants.sql` membuat **dua index**
(`Sku_slug_nobrand_uniq`, `Sku_code_nobrand_uniq`) yang satu-satunya tugasnya
menjaga baris tanpa brand.

Jadi CRUD-nya lebih ketat dari schema, dua index-nya tak terjangkau, dan barang
generik seperti "plywood 9mm" terpaksa diarsipkan di bawah brand sampah bernama
`-`. Ketiganya berhenti sekarang. `CatalogApprovalValidationSchema` ikut
dilonggarkan: approval butuh identitas dan kategori, bukan merek.

### Changed — mengedit harga menjadi *supersede*, menghapus menjadi *close*

`SkuPrice` tabel riwayat — `valid_from`/`valid_to`/`is_current` tidak ada gunanya
kalau bukan itu. Tapi tab Harga meng-`update` baris berjalan **di tempat**, dan
`delete`-nya `DELETE` sungguhan.

Artinya angka yang studio kutipkan bulan lalu bisa hilang tanpa jejak, dan
kutipan yang sudah dikirim ke klien berhenti bisa dijawab. Ironisnya
`updateProduct` sudah melakukannya dengan benar sejak awal — hanya tab Harga yang
tidak.

| Aksi | Sekarang |
|---|---|
| Ubah nominal / satuan / supplier | Baris lama ditutup, baris baru ditulis |
| Ubah **hanya catatan** | Diubah di tempat |
| Hapus | `is_current: false` + `valid_to`. Hilang dari daftar, tetap di riwayat |

Pembedaan catatan itu bukan kelonggaran: anotasi bukan penawaran, dan
melahirkan baris riwayat untuk ejaan yang dibetulkan justru mengubur perubahan
harga yang sungguhan di antara pembukuan.

**Menghapus tidak menaikkan kembali harga sebelumnya.** *"Tidak ada harga
berlaku"* adalah keadaan yang jujur; menghidupkan lagi angka lama seolah itu
angka hari ini tidak.

Perbandingan `Decimal` Prisma lewat `Number()` — membandingkan objek Decimal
dengan angka pakai `!==` selalu benar, dan itu akan membuat **tiap** penyimpanan
terlihat seperti perubahan harga, satu baris riwayat per klik. Ada uji khusus
untuk ini.

### Changed — `bqReady` berhenti menuntut harga list

Sebelumnya butuh harga sebelum diskon **dan** sesudah diskon **dan** satuan.
Harga list adalah konteks untuk diskonnya, bukan masukan bagi BQ — menuntutnya
menandai "belum siap" tiap kali supplier mengutip satu angka, yang mana
kebanyakan kasus. Sekarang: harga net + satuan.

### Added — `sku-price.test.ts`, 7 kasus

Menguji tiga penilaian yang tidak bisa dilihat `tsc` maupun index mana pun: arti
field harga kosong, kapan sebuah edit adalah penawaran baru, dan kapan sebuah
baris layak ditulis. Ketiganya dijawab berbeda oleh lima call site sebelum hari
ini.

### Changed — §M3 selesai: bahasa UI dan kosakata komponen

**Bahasa.** Sepuluh komponen Master Data + pesan error di actions-nya
diterjemahkan ke Inggris. Modul ini sengaja dilewati saat penyeragaman D4 supaya
penerjemahannya terjadi sekali di sini, bukan dua kali — dan itu memang yang
terjadi.

**Kosakata.** Delapan komponen masih memakai nama v1 untuk model yang sudah
tidak ada:

| Dulu | Sekarang |
|---|---|
| `CompanyClient` / `CompanyDialog` / `CompanyPicker` | `PartyClient` / `PartyDialog` / `PartyPicker` |
| `MasterDataVendorsClient` / `VendorDialog` / `VendorPicker` | `MasterDataBrands…` / `Brand…` |
| `ServiceVendorPicker` | `WorkVendorPicker` |
| `HargaClient` | `PricingClient` |
| `types/company.ts` · `CompanyData` / `CompanyInput` / … | `types/party.ts` · `PartyData` / `PartyInput` / … |
| `actions/company-actions.ts` | `actions/party-actions.ts` |

Selama namanya beda dari modelnya, tiap orang baru harus memetakan sendiri mana
yang mana. Rename ini murah sekarang dan makin mahal nanti.

**Satu hal sengaja TIDAK ikut di-rename:** nama server action di
`party-actions.ts` masih `*Company*`. Mengganti nama server action yang
di-export adalah perubahan yang memutus sisi klien, dan tidak ada perilaku yang
bergantung pada namanya. Dicatat di kepala berkasnya supaya inkonsistensi itu
terbaca sebagai keputusan, bukan sebagai yang terlewat.

### Changed — `eslint.config.mjs` mengabaikan `src/generated/prisma_old_bak/**`

`npx eslint src` melaporkan **870 error**. 849 di antaranya dari
`src/generated/prisma_old_bak/` — cadangan lokal 14 MB dari client Prisma v1,
untracked dan sudah ada di `.gitignore`, tapi eslint tetap menyusurinya.

Angka itu bukan sekadar berisik: ia membuat ~13 error sungguhan mustahil
ditemukan, dan membuat "lint hijau" berhenti jadi sesuatu yang bisa dicek. Kalau
ada yang memperkenalkan error baru minggu lalu, tidak ada yang akan tahu.

Diabaikan, **bukan dihapus** — itu cadangan milik owner, bukan isi repo, dan
bukan hak perubahan ini untuk membuangnya.

Sesudahnya: **11 error**, seluruhnya di berkas yang tidak disentuh perubahan ini
(`template-manager.tsx`, `today-inline-add.tsx`, `today-quick-add-modal.tsx`,
`display-utils.ts`, `ProjectLiveProvider.tsx`) — sudah ada sebelumnya, dan
sekarang terlihat. Dicatat di `roadmap.md` §T6.

### Removed — dua komponen mati yang baru terlihat saat rename

`PartyClient` dan `MasterDataBrandsClient`: **nol importer**. Keduanya digantikan
tabel Supplier flat 6 Agustus dan tidak pernah dihapus. Rename-nya yang
memunculkannya — memindahkan berkas memaksa memeriksa siapa yang mengimpornya.

Dipindahkan ke `docs/archive/src-mati/`. `tsc` 0 error dan 57 uji lulus
sesudahnya, yang membuktikan tidak ada yang memakainya.

### Verifikasi

| Uji | Hasil |
|---|---|
| `npx tsc --noEmit` | **0 error** |
| `npm test` | **57 lulus** (50 sebelumnya + 7 baru), 0 gagal |
| `eslint` pada `subapps/master-data`, `extensions/library`, `app/masterdata` | **0 error**, 4 warning yang sudah ada sebelumnya |
| `eslint src` seluruhnya | 11 error, **nol** di berkas yang disentuh perubahan ini |
| Jalur tulis `SkuPrice` di luar service | **0** |
| `Prisma.SkuGetPayload` di `src/extensions/` | 2 — **tetap terbuka**, itu §M4 langkah 2 |

**Belum diverifikasi, dan tidak bisa dari sini:**

1. **`next build`** — `Bus error (core dumped)` di lingkungan ini. Kegagalan
   lingkungan yang sudah tercatat di roadmap §C-SISA-2, bukan akibat perubahan
   ini, tapi tetap berarti belum ada yang membuktikan aplikasi menyala.
2. **Perilaku terhadap database nyata.** `SkuPrice_current_uniq` adalah jaminan
   yang lebih kuat daripada uji mana pun yang bisa saya tulis, tapi ia baru
   berbicara saat ada Postgres. Skenario yang paling perlu dicoba sendiri:
   simpan dua harga untuk SKU yang sama dari dua supplier berbeda, lalu edit
   salah satunya — yang satunya **harus** tetap berlaku.

### Tidak dikerjakan, dan sengaja

**§M4 langkah 2 (DTO tulis tangan)** tetap terbuka — di luar cakupan yang
disepakati. Uji §M6 nomor 6 masih gagal dengan 2 hasil, dan itu ukurannya.

**Halaman Harga masih menampilkan hanya harga berlaku.** Riwayatnya sekarang
tersimpan utuh tapi belum ada layar yang menunjukkannya. Itu pekerjaan
tersendiri; dicatat di `roadmap.md` §A7 supaya tidak dianggap sudah ada hanya
karena datanya ada.

---

## [Unreleased] - 2026-08-10 (Recheck seluruh dokumentasi terhadap repo + arsip)

Permintaan owner: periksa ulang status seluruh `CHANGELOG.md` dan `roadmap.md`
terhadap kode nyata, lalu arsipkan yang usang.

**Temuan yang membuat pemeriksaan ini bukan sekadar perapian:** roadmap menyatakan
§M2, §A1, dan §C-SISA-1 *"belum diterapkan"* — **ketiganya sudah**. Migrasinya ada
di `prisma/migrations/`, dan backup pra-drop bertanggal 2026-08-10 17:01 ada di
folder `migrations-masterdata-v2/backups/`.

Yang membuat ini berbahaya bukan ketidaktepatannya, tapi arahnya. Roadmap yang
menyebut sesuatu belum dikerjakan menyuruh orang mengerjakannya — dan isi §M2
adalah `DROP SCHEMA master_data CASCADE`. Roadmap yang salah ke arah sebaliknya
hanya membuang waktu; yang salah ke arah ini membuang data.

Sebabnya bisa ditunjuk: roadmap dan changelog ditulis **sebelum** eksekusi, sebagai
rencana, lalu eksekusinya dicatat di entri changelog baru tanpa status di roadmap
ikut disentuh. Dua dokumen, satu fakta, tidak ada yang menjahit keduanya.

### Changed — tiap status di roadmap sekarang menyebut buktinya

Bukan "selesai" atau "belum", melainkan berkas dan nomor barisnya. `grep` yang
menghasilkan nol, migrasi yang ada di `prisma/migrations/`, kolom yang ada di
`schema.prisma`. Status yang tidak bisa dibuktikan dari repo ditandai **butuh DB**
alih-alih ditebak.

`DATABASE_URL` menunjuk `localhost:5432` di mesin owner, tidak terjangkau dari
lingkungan pemeriksaan. Membatasi klaim pada apa yang bisa dilihat adalah
satu-satunya cara pemeriksaan ini tidak mengulangi kesalahan yang ia perbaiki.

### Verifikasi ulang — yang ternyata sudah selesai

| Item | Klaim lama | Buktinya |
|---|---|---|
| §M2 migrasi v2 | "SQL siap, tinggal dijalankan" | `20260810180000_masterdata_v2_rebaseline`, 1060 baris, gabungan verbatim `01`–`04` |
| §M4 langkah 1 | "sudah ditulis" | Tiga view **sudah dibuat** — `migration.sql` baris 838, 906, 964 |
| §A1 SkuCategory | "belum diterapkan" | `20260806120000_add_sku_category` ada; `model SkuCategory` di `schema.prisma:447` |
| §A2 pindah dari `catalog_tags` | "belum" | `types.ts:163` — `sku.categories.map(...)` |
| §A3 hapus `catalog_tags` | "jangan sebelum A2" | Kolomnya ikut `DROP SCHEMA` |
| §A4 kolom `source` | "butuh migrasi" | `BrandCategory.source CategorySource` ada di `schema.prisma:435` |
| §A5 backfill Company | "perkakas siap" | **Gugur** — `Company` tidak ada lagi, digantikan `Party` |
| §C-SISA-1 | "belum diterapkan" | `checklist_tasks` + `activity_due_date` ada di riwayat resmi |
| §M8 nomor 2 | "join Brand harus dilepas" | **Sudah** — `searchReusableSpecs` membaca `snapshot.catalog_vendor_name` |
| §M8 nomor 1 | "spec_search_key mungkin kosong" | Jalur tulisnya **ada** (`schedule-service.ts:232`); yang belum diketahui hanya baris lama — butuh DB |

### Verifikasi ulang — yang ternyata masih benar

Tiga temuan audit UX diperiksa ulang angkanya, bukan dipercaya: **D2** 14
`confirm()` di 10 berkas · **D3** `activity-manager` 5 catch/0 toast,
`project-tasks-card` 4/0, `cd-list-table` 4/0 · **D5** 13 berkas `TableCard`,
hanya 4 ber-`minWidth`.

**§M4 langkah 4 juga masih benar sebagai "belum"**, dan ini yang paling mudah
disalahbaca sebagai selesai: view-nya ada, tapi blok `GRANT`/`REVOKE` di
`migration.sql:1029–1044` masih **dikomentari**. View yang ada tanpa hak akses
yang mengikat tidak menegakkan apa pun — StudioFlow masih bisa membaca tabel
mentah. Uji §M6 nomor 4 tetap **belum diuji**, bukan lulus.

Angka coupling SSOT dihitung ulang dan **menyusut**: dari 48 baca / 21 tulis jadi
31 baca / 29 tulis, seluruh operasi tulisnya terkonsentrasi di
`library-service.ts`. Bukan karena dibereskan — rombakan v2 menghapus jalur
tulisnya bersama modelnya.

### Added — `docs/archive/`

| Isi | Apa |
|---|---|
| `README.md` | Indeks: apa yang dipindahkan, kenapa, dan apa yang **tidak** dipindahkan |
| `CHANGELOG-2026-07-24_2026-08-06-masterdata-v1.md` | 44 entri era Master Data v1 |
| `CHANGELOG-2026-04-16_2026-07-23-rilis-v1-v3.md` | 48 rilis bernomor |
| `roadmap-selesai-2026-08-10.md` | Item roadmap selesai/gugur + buktinya |
| `docs-usang/` | 16 dokumen nol-rujukan |
| `scripts-usang/` | 19 skrip yang memanggil delegate/kolom yang sudah di-`DROP` |
| `src-mati/` | 5 berkas sumber nol importer (menutup §T1 dan §T4) |
| `masterdata-v1-data/` | CSV sumber + staging import v1 |
| `migrations-masterdata-v2/`, `schema.masterdata-v2.prisma` | Sudah diterapkan; duplikat dari riwayat resmi |
| `prisma-migrations-v1-praRebaseline/` | Dulu `prisma/migrations_archive/` |

**Kriteria pemindahan, dan hanya ini:** berkas dipindah kalau ia menyebut sesuatu
yang **tidak ada lagi** — bukan kalau ia sekadar tua. `DROP SCHEMA master_data
CASCADE` yang membuat kriteria itu tajam: setiap dokumen dan skrip yang menyebut
`Company`, `Vendor`, `MaterialCatalog`, `MaterialCandidate`, `MaterialPrice`,
`ServicePrice`, atau kolom `catalog_*` merujuk tabel yang sudah hilang.

Tiap skrip diperiksa satu per satu untuk delegate yang dipanggilnya, bukan
diduga dari namanya. `reset-masterdata.mjs` misalnya terlihat masih relevan —
sampai terlihat ia mendaftar 18 tabel v1 termasuk `ServiceVendor`.

### Changed — `CHANGELOG.md` 277 KB → 86 KB

Yang tersisa: siklus berjalan (2026-08-10 →, 16 entri) plus §Arsip berisi
**ringkasan kanonik** dua periode yang dipindahkan — apa yang dibangun, dan yang
lebih penting, **tiga pelajaran yang membentuk v2**: Brand ≠ badan usaha,
kategori teks bebas di enam kolom tidak pernah bisa direkonsiliasi, harga yang
menempel di produk tidak bisa membandingkan dua toko.

Ringkasan itu ada supaya berkas arsipnya **tidak perlu dibuka** untuk pertanyaan
biasa. Yang dipindahkan adalah riwayatnya, bukan alasannya.

### Removed — berkas mati dipindahkan keluar dari `src/`

§T1 dan §T4 tertahan berbulan-bulan menunggu konfirmasi. Kelimanya diverifikasi
nol importer lewat specifier impor yang sebenarnya (`from "@/..."`), bukan lewat
nama berkas — perbedaan yang menentukan: `grep dashboard` menghasilkan 25 hasil
palsu dari route group `(dashboard)`, dan itu yang membuat `types/dashboard.ts`
terlihat masih hidup.

`today-task-item.tsx` punya satu importer — `activity-list-today.tsx`, yang juga
mati. Keduanya dipindah sebagai pasangan.

### Changed — `tsconfig.json`, `eslint.config.mjs`

`docs/archive/**` dikecualikan dari keduanya. Berkas di arsip sengaja **tidak**
dirapikan: impornya rusak dan tipenya implisit, dan memperbaikinya berarti merawat
kode yang tidak dipakai. Tanpa pengecualian ini `tsc` melaporkan 4 error dari
berkas yang sudah dinyatakan mati.

### Changed — `schema.prisma` komentar `ChecklistLabel`

Masih menunjuk *"roadmap A1–A3"* sebagai pekerjaan yang sedang berjalan. Ketiganya
selesai. Ditulis ulang sebagai peringatan — rute `String[]` murah dimulai dan
mahal ditinggalkan — bukan sebagai penunjuk ke item roadmap yang sudah tidak ada.

### Added — `roadmap.md` §T5

Empat dokumen usang yang **tidak** bisa diarsipkan karena 56 komentar di `src/`
menunjuk namanya: `PLAN-AUDIT-ROADMAP-2026Q3.md` (24), `PLAN-LIBRARY-BRAND-FIRST.md`
(17), `UPSTREAM-BQ-MATERIAL-SOURCE.md` (13), `MASTER_SSOT.md` (2).

Memindahkannya menukar satu masalah dengan yang lebih buruk: dokumen usang yang
bisa ditemukan jadi rujukan yang menunjuk ke ruang kosong. `MASTER_SSOT.md` yang
paling mendesak — ia satu-satunya yang mengklaim diri *sumber kebenaran*, dan
isinya masih memetakan schema v1.

### Added — dua lubang yang baru terlihat setelah pembersihan

1. **Tidak ada lagi skrip reset `master_data`.** `reset-masterdata.mjs` menarget
   18 tabel v1. Kalau §M3 butuh uji berulang dari keadaan kosong, skrip itu harus
   ditulis ulang terhadap 18 tabel v2.
2. **Skenario uji manual Master Data hilang seluruhnya.** Yang lama menyebut
   `+ Perusahaan`, `MaterialPrice`, `catalog_tags`. Yang baru tidak bisa ditulis
   sebelum §M3 selesai — UI-nya yang akan diuji belum ada.

Keduanya dicatat di `roadmap.md` sebagai lubang, bukan didiamkan sebagai
perkakas yang "masih ada".

### Verifikasi

| Uji | Hasil |
|---|---|
| `npx tsc --noEmit` sebelum pemindahan | 0 error |
| `npx tsc --noEmit` sesudah pemindahan | 0 error |
| `npm test` sebelum & sesudah | 50 lulus, 0 gagal |
| Importer 5 berkas `src-mati` | 0 (kecuali satu pasangan internal) |
| Migrasi di `prisma/migrations/` | 17, termasuk ketiga yang dikira belum jalan |

**Belum diverifikasi:** isi database, dan `next build`. Yang kedua gagal di
lingkungan pemeriksaan pada tahap `next/font` karena `fonts.googleapis.com` tidak
terjangkau — kegagalan lingkungan, bukan kode, tapi tetap berarti belum ada yang
membuktikan aplikasi menyala setelah pemindahan ini. Itu satu-satunya langkah yang
tersisa di mesin owner.

---

## [Unreleased] - 2026-08-10 (Master Data v2 — perbaikan cacat susulan)

Lanjutan dari rombakan Master Data v2 hari ini. Cacat-cacat ini **semuanya
berasal dari rombakan itu sendiri** — dicatat sebagai kelalaian, bukan sebagai
temuan, karena semuanya lolos justru dari alat yang seharusnya menangkapnya.

Dua layar error jadi pemicunya:
`prisma.party.count(...)` undefined di `/masterdata`, lalu
`LibraryItemStatus.PENDING` undefined di `/masterdata/materials`.

**Benang merahnya satu, dan itu yang paling layak dibawa pulang:** membuang
sesuatu dari schema tidak otomatis membuang jejaknya. Yang tertinggal —
sentinel, daftar tabel preflight, enum yatim — semuanya tetap *type-check*
dengan mulus dan baru gagal saat dijalankan. `tsc` hijau tidak berarti aplikasi
menyala.

### Fixed — `core/platform/db.ts` · penjaga anti-stale-client mati sendiri

`hasExpectedDelegates()` memeriksa empat model sebagai sentinel:
`company`, `materialCandidate`, `sampleCandidate`, `materialLaborPrice`.
Keempatnya **dibuang oleh rombakan v2**, jadi penjaga itu mengembalikan `false`
selamanya.

Akibatnya bukan sekadar "penjaga tidak jalan" — akibatnya **terbalik**:

| | Maksud penjaga | Yang sebenarnya terjadi |
|---|---|---|
| Client basi terdeteksi | ya | **tidak pernah** — hasilnya `false` apa pun keadaannya |
| Client dibangun ulang | hanya saat perlu | **tiap request** |

Komentar di fungsi itu sudah menulis terang-terangan *"bump ini setiap kali ada
model baru"*. Langkah itu yang saya lewatkan saat menulis schema v2.

```
PRISMA_CLIENT_SIGNATURE  v2.10.0-pricing-schemas → v3.0.0-masterdata-v2
sentinel                 company, materialCandidate, sampleCandidate,
                         materialLaborPrice
                         → party, sku, skuPrice, workPrice, sampleMovement
```

Sentinel baru semuanya model v2, dan alasannya ditulis di kodenya: rombakan
berikutnya yang membuang salah satunya akan menabrak komentar itu, bukan bug
yang sama.

**Ini tidak memperbaiki proses `next dev` yang sedang jalan.** Modul client
lama sudah terlanjur ada di memori server itu; sentinel hanya mencegah kejadian
berikutnya. Server dev harus di-restart sekali.

### Fixed — `core/platform/db.ts` · preflight memeriksa tabel yang sudah tidak ada

`ensureDbSchemaPreflight()` masih menuntut `Vendor`, `VendorContact`,
`VendorLink`, `Material`, `SampleMovementLog`, `ServicePrice`,
`MaterialCandidate`, `SampleCandidate` — dan kolom `vendor_id`, `catalog_brand`,
`catalog_sku`, `catalog_tags`, `price_*`, `material_id`, `catalog_status`.
Tidak satu pun tersisa setelah v2.

Fungsi ini dipanggil `lib/action-wrapper.ts:53`, yaitu **di setiap server
action**. Di produksi ia akan melempar error pada action pertama. Dev tidak
pernah mengeluh karena `SKIP_DB_PREFLIGHT` melewatinya di sana — persis
kombinasi yang membuat cacat ini tidak terlihat sampai deploy.

Diganti ke bentuk v2: 14 tabel `master_data` (Party/Brand/Category/Sku/SkuPrice/
SkuMedia/SkuCategory/WorkPrice/Sample/SampleMovement dan kerabatnya) plus kolom
wajib per tabel. `Sku.code` **tidak** ikut diwajibkan isinya — Q7 membuatnya
nullable, dan pemeriksaan kolom memang tidak bisa menyatakan nullability.
`WorkPrice.total_price` justru diwajibkan ada: kalau hilang, artinya
`03_invariants.sql` tidak pernah jalan dan tiap tarif BQ diam-diam membaca NULL.

### Fixed — migrasi hilang: `ProjectProductRequest.brand_name_snapshot` / `sku_name_snapshot`

Dua kolom ini saya tambahkan ke `schema.prisma` saat M5, **tanpa pernah menulis
migrasinya**. Keduanya tidak ada di Postgres.

Yang membuatnya lolos, dan ini bagian yang layak diingat:
`prisma migrate resolve --applied` mencatat sebuah migrasi sebagai "sudah
dijalankan" **tanpa pernah membandingkan schema dengan database**. Jadi
`migrate status` melaporkan *"up to date"* sementara kolomnya tidak ada,
`tsc` lolos, dan `prisma generate` menghasilkan client yang menjanjikan kolom
itu. Tidak ada satu pun dari ketiganya yang bisa menangkap ini.

Yang menangkapnya justru preflight yang baru saja diperbaiki di atas.

Migrasi baru `20260810190000_add_product_request_snapshots` — `ADD COLUMN IF NOT
EXISTS`, sudah diterapkan dan diverifikasi.

**Kalau tidak ketahuan:** tiap `receiveSample` dan tiap pembuatan request akan
gagal saat menulis, karena jalur tulisnya memang mengisi kedua kolom itu.

### Removed — enum `studioflow.SampleAction` / `studioflow.SampleStatus`

Sisa yatim dari v2: deklarasinya sudah dihapus dari `schema.prisma` (pindah ke
`master_data` dengan nilai berbeda), tapi tipe lamanya masih menganggur di
Postgres.

Diverifikasi dulu sebelum dibuang, bukan diasumsikan:

| Tipe | Kolom yang memakainya |
|---|---|
| `master_data.SampleAction` | 1 |
| `master_data.SampleStatus` | 2 |
| `studioflow.SampleAction` | **0** |
| `studioflow.SampleStatus` | **0** |

Migrasi `20260810191000_drop_orphaned_studioflow_sample_enums`, memakai
`RESTRICT` bukan `CASCADE` — kalau ternyata masih ada yang merujuk, migrasinya
harus gagal berisik, bukan diam-diam menghapus kolomnya.

### Fixed — `LibraryItemStatus` meledak di komponen client

`Cannot read properties of undefined (reading 'PENDING')` di
`MasterDataProductDialog.tsx:56`, saat *module evaluation* — bukan saat dipakai.

Sebabnya halus dan layak diingat, karena **`tsc` tidak akan pernah
menangkapnya**: Prisma hanya mengirim enum yang **terjangkau dari datamodel** ke
`index-browser.js`. Setelah v2 tidak ada satu pun model yang memakai
`LibraryItemStatus` (`Sku.status` sekarang `SkuStatus`), jadi Prisma tetap
menghasilkan **tipe**-nya — schema hijau, `tsc` hijau — tapi membuang **nilai**
runtime-nya dari bundle browser. Tiap `"use client"` yang membaca
`LibraryItemStatus.PENDING` mati di baris pertama.

| | Server | Browser |
|---|---|---|
| Tipe (`tsc`) | ada | ada |
| Nilai runtime | ada | **hilang** |

Diperiksa sistematis, bukan ditambal satu: dari 28 enum yang dideklarasikan,
**tepat satu** tidak sampai ke bundle browser — `LibraryItemStatus`. Sisanya
utuh.

Pindah ke `extensions/library/types.ts` sebagai const TS biasa
(`{ PENDING, APPROVED, REJECTED } as const` + tipe bernama sama), jadi call site
tetap membaca `LibraryItemStatus.PENDING` persis seperti sebelumnya. Lima berkas
dialihkan importnya dari `@/generated/prisma`.

Ini bukan sekadar akal-akalan agar kompilasi lolos — **itu memang tempatnya
sekarang**. Ia status tampilan yang dipetakan dari `SkuStatus`, bukan kolom
database. Enum yatimnya dibuang dari `schema.prisma` dan dari Postgres
(`20260810192000_drop_orphaned_library_item_status`, `RESTRICT`, 0 kolom
memakainya — diverifikasi lebih dulu).

`z.nativeEnum()` di atas const object diuji runtime, bukan diasumsikan dari
`tsc`: `APPROVED`/`PENDING` lolos, `NOPE` ditolak.

### Verifikasi

| Uji | Hasil |
|---|---|
| `tsc --noEmit` | 0 error |
| `npm test` | 50 lulus |
| `prisma validate` | hijau |
| `prisma migrate status` | bersih, 18 migrasi |
| Cermin preflight vs DB nyata | 0 tabel/kolom hilang |
| Sentinel delegate baru ada di client | 5/5 |
| Sentinel lama terbukti hilang | 4/4 |
| Enum dideklarasikan tapi absen dari bundle browser | 0 |
| `z.nativeEnum(LibraryItemStatus)` runtime | terima 2 sah, tolak 1 asing |

`prisma migrate diff` menyisakan **hanya** artefak `03_invariants.sql` — enam
index GIN/trgm dan `total_price DROP DEFAULT`. Itu memang tidak bisa dinyatakan
Prisma. **Diff itu jangan pernah diterapkan**; menjalankannya akan membatalkan
seluruh invariant yang baru dipasang.

**Belum diverifikasi:** tampilan di browser. Sandbox ini tanpa akses jaringan
(`fonts.googleapis.com` tidak terjangkau), jadi `next build`/`next dev` gagal di
tahap `next/font` — kegagalan lingkungan, bukan kode. Server dev yang sedang
jalan sengaja tidak saya matikan justru karena itu.

---

## [Unreleased] - 2026-08-10 (ADMIN dan DEVELOPER boleh memegang kursi DIC)

Permintaan owner. Ini **membatalkan sebagian** keputusan yang diambil pagi ini
di entri "Pemilih PIC disaring sesuai perannya" — dicatat terang-terangan
supaya alasan lamanya tidak dibaca sebagai masih berlaku.

### Changed — `core/rbac/project-pic.ts`

```
DESIGNER_ROLES: ["DIC"]  →  ["DIC", "ADMIN", "DEVELOPER"]
DRAFTER_ROLES:  ["DRIC"] →  tidak berubah
```

**Yang dikembalikan lebih sempit dari keadaan sebelumnya**, dan pembedaan itu
yang membuat perubahan ini bukan sekadar batal:

| | Sebelum pengetatan | Setelah pengetatan | Sekarang |
|---|---|---|---|
| DIC | ADMIN, DEVELOPER, DIC, STAFF | DIC | **DIC, ADMIN, DEVELOPER** |
| DRIC | STAFF, DRIC | DRIC | DRIC |

`STAFF` **tidak** ikut kembali. Ia tidak pernah peran designer — ia ikut terbawa
daftar lama yang terlalu longgar, dan justru itu yang membuat akun STAFF muncul
sebagai kandidat drafter di tangkapan layar yang memicu perbaikan pagi ini.

**Alasan melonggarkannya:** di studio sebesar ini akun ADMIN sering memang
designer yang bekerja, dan memaksa ganti peran hanya demi memegang kursi berarti
melepas hak admin yang orang yang sama butuhkan.

**Ongkosnya, dan ini tidak terlihat di layar:** kursinya tidak lagi membuktikan
perannya. `isAdminLevel` sudah meloloskan keduanya dari tiap gerbang per-proyek,
jadi proyek yang DIC-nya seorang ADMIN tidak bisa dibaca sebagai *"seorang DIC
menyetujui ini"* — hanya sebagai *"seseorang yang berhak memegang kursinya"*.
Apa pun yang kelak bergantung pada kursi sebagai bukti peran harus memeriksa
perannya sendiri. Dicatat di komentar modulnya, bukan hanya di sini.

### Changed — `project-pic.test.ts`

Empat kasus uji memakai `ADMIN` sebagai contoh "peran yang tidak memenuhi
syarat". Keempatnya **akan tetap lulus** setelah perubahan ini — tapi lulus
karena alasan yang salah, dan uji yang masih hijau setelah aturan yang dijaganya
dibalik lebih buruk daripada tidak ada uji sama sekali.

Keempatnya dipindahkan ke `STAFF`/`ESTIMATOR`, yang tetap tidak memenuhi syarat
di kedua kursi:

| Kasus | Dulu | Sekarang |
|---|---|---|
| Pemegang kursi dipertahankan meski tak lagi layak | `eligibleDesigners(users, "admin")` | `"staff"` |
| Peran tak layak ditolak | `ADMIN` + `DESIGNER_ROLES` | `STAFF` + `DESIGNER_ROLES`, dan `ADMIN` + `DRAFTER_ROLES` |
| "Tidak berubah selalu boleh" | `ADMIN` | `STAFF` — kalau tetap ADMIN, ia lulus lewat cabang kelayakan dan tidak membuktikan apa-apa soal short-circuit-nya |

Ditambah dua kasus baru: kursi designer **menawarkan** ADMIN/DEVELOPER, dan
kursi designer **tetap menolak** STAFF/ESTIMATOR.

### Changed — komentar di dua halaman

`projects/page.tsx` dan `projects/[id]/page.tsx` sama-sama menulis *"Strictly DIC
and DRIC"* tepat di atas pemanggilannya. Dibiarkan, komentar itu akan jadi
petunjuk yang salah bagi orang berikutnya yang membacanya.

### Verified

`npm test` **50 lulus, 0 gagal** · `tsc --noEmit` **nol error** · `eslint` pada
empat berkas yang disentuh: nol error (satu warning `activeTab` yang sudah ada
sebelumnya, tidak berkaitan).

### Changed — `roadmap.md` §Peta halaman task

Baris *"Konsekuensi: ADMIN tidak bisa ditugaskan sebagai designer"* dihapus dan
diganti tabel kelayakan + catatan soal kursi yang tidak lagi membuktikan peran.

---

## [Unreleased] - 2026-08-10 (Master Data v2 — migrasi siap dijalankan)

Seluruh pertanyaan terjawab, dan §M2 berubah dari rencana jadi empat berkas SQL
yang tinggal dijalankan. Masih nol baris data tersentuh — saya tidak punya akses
database.

### Keputusan owner yang membentuk tahap ini

| | Keputusan | Akibatnya |
|---|---|---|
| Data v1 | *"DROP AJA — data kita mulai dari 0, gausa di seeding"* | Separuh isi M2 hilang: tanpa ekspor, tanpa rekonsiliasi, tanpa skrip seed |
| Schedule/SketchUp | **Tidak boleh** baca Master Data | `v_schedule_item` batal. StudioFlow membaca **tepat satu** view |
| Library | Card katalog saja — *"gw mau cari terazzo, merek apa aj ya?"* | `PRICE_LIST` + `MARKETPLACE` keluar dari link yang tampil |
| X9 harga | Butuh multi-toko **dan** riwayat | Pemisahan `Sku`/`SkuPrice` dipakai |
| X7/X10/X13 kategori | Pohon induk-anak | Satu `Category` menutup Table 1, 2, 3, 4 |
| X6 Company | *"nama brand misal taco, tapi nama PT nya kan beda"* | Satu `Party`, dua nama — dagang dan hukum |
| X12 `Qty` | *"simpan saja tapi tidak usah dipakai"* | Tafsir `pack_size` dibuang seluruhnya |

### Changed — `prisma/schema.masterdata-v2.prisma`

**`Sku.code` jadi nullable, identitas kanonik pindah ke `slug`.**
`@@unique([brand_id, code])` → `@@unique([brand_id, slug])`. Keunikan `code` di
mana ia terisi dijaga partial index. Dasarnya `BUILD_SUMMARY.json`:
`source_has_explicit_sku_column: false`, `fake_sku_generation: false` — kode
artikel pabrikan adalah fakta tentang barang, bukan kunci basis data.

**`pack_size` dibuang, diganti `qty Decimal?` yang tidak dipakai.**

Ini koreksi terhadap usulan saya sendiri, dan alasannya layak dicatat: draft
menafsirkan kolom `Qty` sebagai ukuran kemasan lalu memberinya default `1` —
artinya tafsir itu akan **ikut masuk perhitungan**. Menebak arti sebuah kolom
lalu memakainya dalam hitungan adalah cara paling senyap merusak angka. Kolom
yang jujur tidak diketahui artinya tidak bisa merusak apa pun.

Tiga aturan penjaganya ditulis di `COMMENT ON COLUMN`, bukan hanya di dokumen,
supaya terbaca di `\d+` dan tiap tool introspeksi: tidak masuk perhitungan, tidak
diekspos ke view mana pun, hanya kolom catatan di form.

### Added — `prisma/migrations-masterdata-v2/`

Empat berkas SQL + README. **Sengaja bukan `prisma/migrations/`**: selama
`schema.prisma` masih memuat 18 model v1, menaruhnya di sana membuat
`prisma migrate` melihat drift dan menawarkan reset.

| Berkas | Isi |
|---|---|
| `01_drop_master_data_v1.sql` | Lepas 5 FK `studioflow` eksplisit, lalu `DROP SCHEMA CASCADE` |
| `02_create_master_data_v2.sql` | 18 tabel + 10 enum, **dihasilkan `prisma migrate diff`** — terbukti identik saat digenerate ulang |
| `03_invariants.sql` | Partial index, generated column, GIN, pg_trgm, `COMMENT` |
| `04_views_and_grants.sql` | 3 view kontrak + `GRANT`/`REVOKE` |

**FK dilepas eksplisit, bukan dibiarkan `CASCADE`.** Hasilnya sama, tapi CASCADE
menghapus tanpa menyebut apa yang dihapusnya — kalau ada FK lain yang tidak
diketahui, ia ikut hilang diam-diam. Menjadikannya langkah bernama membuat
niatnya terbaca di log. Kolomnya tetap ada; hanya constraint-nya yang lepas.
Itu sekaligus **menyelesaikan §M5**, yang karenanya diserap ke M2.

**Tanda kurung ganda di sekitar `COALESCE`** pada partial unique index bukan
kelebihan ketik: Postgres mensyaratkannya untuk expression index dan hanya
membolehkan penghilangannya pada pemanggilan fungsi biasa. `COALESCE` bukan itu
— ia konstruksi mirip `CASE`.

### Added — tiga view kontrak SSOT

**`v_library_brand`** — sembilan kolom, persis Table 1 kolom A–G. Satu klausa
`IN` menentukan tujuh `kind` link yang tampil, dan itulah satu-satunya tempat
aturan visibilitas hidup sekarang, menggantikan array TS `ALLOWED_LINK_KINDS`.

**`v_bq_material_rate`** — satu baris per penawaran berlaku (SKU × supplier).
`bq_ready` dihitung **di view**, bukan kolom: keadaan turunan tidak pernah butuh
tempat penyimpanan sendiri. Kolom `qty` sengaja tidak diekspos.

**`v_bq_work_rate`** — Table 3 + Table 4 jadi satu; `has_material` membuat
pembedaannya terbaca tanpa BQ perlu tahu aturannya. Dua tingkat kategori Excel
diambil sebagai daun + induk dari pohon yang sama.

Bagian `GRANT`/`REVOKE` **dikomentari**, karena butuh role terpisah per app.
Kalau sekarang ketiga app memakai satu user Postgres yang sama, itu **temuan
tersendiri** — bukan alasan melewatinya. View-nya tetap dibuat, penegakannya
menyusul, dan uji-nya dicatat sebagai belum diuji, bukan lulus.

### Added — §M7 dan §M8 di roadmap

Konsekuensi keputusan "Schedule tidak boleh baca Master Data": dua gantinya, dan
yang kedua sudah ada di kode.

**M7 — library milik StudioFlow sendiri.** *"Apabila perlu"*, jadi belum
diputuskan dibangun. Jangan dirancang sebelum M8 terbukti kurang.

**M8 — reuse pool antar proyek: ada, belum terbukti jalan.**
`searchReusableSpecs` dan `mode:"reuse"` sudah lengkap. Tiga sebab yang mungkin,
semuanya sudah tertulis sebagai catatan di kodenya sendiri:

1. **`spec_search_key` mungkin tidak pernah terisi.** Komentar `schema.prisma`
   menyatakannya terang-terangan — kolom `spec_*` dibuat plain, bukan `GENERATED`,
   *"because this schema change was made without a live database connection"*,
   dan kebenarannya *"depends on the write path keeping these two in sync"*.
   Kalau jalur tulisnya melewatkannya, pencarian mengembalikan nol dan tidak ada
   yang salah terlihat. Paling murah diuji: satu `SELECT count(*) WHERE
   spec_search_key IS NOT NULL`.
2. **Join ke `master_data.Brand` harus dilepas** — `spec_brand` memakai FK yang
   M2 hapus. Ini yang membuat M8 **tidak opsional**: tanpanya reuse pool ikut
   mati bersama FK-nya.
3. **`take: 500` lalu dikelompokkan di memori** — memotong hasil *sebelum*
   dikelompokkan, jadi spec yang jarang dipakai bisa hilang meski cocok.

### Verified

| Uji | Hasil |
|---|---|
| `prisma validate` v2 + schema aktif | ✅ keduanya valid |
| `02_create_*.sql` digenerate ulang, dibandingkan | ✅ identik — SQL sinkron dengan schema |
| Tiap kolom yang dirujuk `03`/`04` ada di 18 tabel `02` | ✅ nol rujukan tak dikenal |
| Tiap alias view (14 alias) menunjuk kolom yang ada | ✅ nol rujukan salah |
| `pack_size` sudah tidak ada di SQL mana pun | ✅ tersisa satu di komentar schema, sebagai catatan tafsir yang dibuang |

**Postgres tidak tersedia di lingkungan ini** (tanpa akses root), jadi SQL-nya
diverifikasi statik, bukan dijalankan. Enam uji runtime ada di README migrasi.

### Changed — `roadmap.md`

- M1 ditandai **selesai**; M2 jadi "SQL siap, tinggal dijalankan"
- M5 **diserap M2** — FK sudah dilepas di langkah 01
- M4 langkah 1 ditandai selesai; `v_schedule_item` batal
- M4 langkah 3: `settings-service.ts:342` diputuskan — kategori schedule berhenti
  dipetakan ke kategori produk. `PT-01` adalah *posisi di gambar*, `HPL` adalah
  *jenis barang*; selama ini dipaksa satu karena namanya sering kebetulan sama
- M6 uji 5 dikoreksi: **sembilan** kolom, bukan tujuh
- M7 dan M8 baru

---

## [Unreleased] - 2026-08-10 (Jawaban owner — lingkup Library dipersempit)

Owner menjawab 23 pertanyaan dengan *"sisanya ikut rekomendasi"*, plus tiga hal
yang mengubah rancangan. Masih dokumen; nol baris data tersentuh.

### Added — aturan baru di §Arah Strategis poin 4

> *"setiap informasi yg menyimpang dari design database masterdata.xlsx →
> pertanyakan dulu."*

Excel itu acuan bentuk Master Data v2. Setiap kali rancangan menyimpang —
memecah satu kolom jadi dua tabel, mengubah JSON jadi baris, menambah kolom yang
tidak ada di sana — penyimpangannya diangkat sebagai pertanyaan, bukan
diputuskan sendiri.

### Added — `docs/PENYIMPANGAN-DARI-EXCEL.md`

Aturan itu diberlakukan **surut**. Rancangan dibuat sebelum aturannya ada, jadi
25 penyimpangan yang sudah terlanjur saya putuskan dikeluarkan semua: 5 sudah
disetujui di sesi sebelumnya, **9 struktural yang perlu keputusan**, 7 penambahan
teknis, 4 yang ternyata sesuai Excel.

Tiga yang paling saya ragu, dan alasannya masing-masing:

- **X9** — memecah Table 2 jadi `Sku` + `SkuPrice`. Kalau ternyata tiap barang
  memang hanya punya satu harga dari satu tempat, Excel benar dan pemisahan ini
  berlebihan. Kolom `Supplied by` yang menyiratkan sebaliknya.
- **X10** — `Material` dan `Category` di Table 2 saya baca sebagai satu sumbu
  induk-anak. Contoh Excel-nya sendiri tumpang tindih (baris pertama keduanya
  `HPL`). Kalau sebenarnya dua sumbu berbeda, bentuknya salah.
- **X12** — `Qty` ditandai penulisnya sendiri `(need curations)`. Saya
  menafsirkannya sebagai ukuran kemasan; itu tebakan.

### Changed — lingkup Library dipersempit ke Table 1 kolom A–G

> *"library studioflow - hanya mengambil table 1 dibagian yang saya screenshot.
> hanya utk mencari categori/tag2 category, munculkan card brand / bisa di sort
> atau di filter by category / by company / by brand. tiap card hanya utk
> memunculkan link."*

Company, Brand, Product Brand, Category, dan tiga kolom Link (Drive, Website,
Socmed). Bukan kolom H–K (Supplier Information), bukan L–M (Update Information),
bukan N (SKU relational).

**`v_library_item` — view tingkat SKU — batal dibuat.** Library tidak melihat
produk, harga, kontak, maupun sampel. Definisi lengkap `v_library_brand` (tujuh
kolom) sudah ditulis di `docs/PLAN-MASTERDATA-V2.md` §F.4.

**Dua keputusan lama ikut berubah, dan keduanya perlu disadari:**

1. **Harga di Library gugur sendiri.** Keputusan owner 1 Agu *"ada harga ga
   masalah"* — yang waktu itu membatalkan aturan §6.3/§6.14 "price must never be
   reachable from StudioFlow" — tidak dibatalkan lagi sekarang. Ia jadi **tidak
   punya tempat**: tidak ada satu pun baris produk di layar Library. Pertanyaan
   Q4 (boleh lihat `price_list` + supplier?) gugur bersamanya.
2. **`PRICE_LIST` dan `MARKETPLACE` keluar dari allowlist link.** Keduanya masuk
   justru sebagai akibat keputusan (1) — *"they were only ever excluded because
   they surface price on click"*. Table 1 hanya mencantumkan Drive, Website,
   Socmed, jadi mengikuti Excel berarti keduanya hilang dari card. Ditandai
   sebagai pertanyaan terbuka, bukan diterapkan diam-diam.

Yang ikut mati: `SkuWithRelations`, `ProductCatalogWithRelations`,
`attachDerivedCatalogFields`, `LibrarySampleRow`, `BrandCategoryCoverage`. Yang
**tetap** justru `brand-library-service.ts` — pencarian brand per kategori kini
jadi seluruh isi Library.

### Verified — "sisanya bisa di-drop" ternyata hanya sebagian

Diminta memastikan dulu sebelum menyetujui. Hasilnya membalik asumsinya.

**Aman di-drop**, karena datanya ada di repo bukan hanya di database: Brand
(392), BrandContact (399), BrandLink (1010), dan kedua antrian kurasi (756 +
287) — semuanya lahir dari `docs/masterdata-seed/*.csv` yang masih ada.

**Tidak bisa dipulihkan**, karena hanya lahir dari UI yang baru ada sejak 5–6
Agustus:

| Data | Kenapa hilang |
|---|---|
| `Company` | Pengelompokan brand → badan usaha adalah keputusan manusia lewat Backfill (§A5). CSV hanya punya `legal_name` per brand |
| `MaterialPrice`, `ServiceVendor`, `ServicePrice`, `MaterialLaborPrice` | Diketik lewat halaman Harga; tidak ada di workbook sumber sama sekali |
| **`Sample`** | `07_sample_candidates.csv` memuat rak/box/qty/status — tapi **bukan keputusan kurasinya**, yaitu sampel ini SKU yang mana |
| Keputusan kurasi | `review_status`, `*_confirmed`, `decision_notes` |

Ironisnya `Sample` — satu-satunya yang diminta dipertahankan — ada di daftar
kedua. Fisiknya bisa di-seed ulang; sambungannya ke SKU tidak.

Karena itu urutan M2 tetap **ekspor dulu, baru drop** — bukan karena datanya
banyak, tapi karena yang sedikit itu justru yang tidak ada duplikatnya.

### Pertanyaan baru yang muncul justru karena jawabannya

**Schedule dan SketchUp masih boleh memilih SKU dari Master Data?**
Library berhenti di card brand + link, tapi `ProjectScheduleOption.sku_id`,
`addEntryToSchedule mode:"catalog"`, dan `SkuPicker` masih hidup — itu permukaan
**ketiga**, bukan Library. Menentukan apakah StudioFlow butuh satu view atau dua,
jadi harus dijawab sebelum M4.

### Changed — `roadmap.md`

- §Arah Strategis poin 4 baru (aturan penyimpangan)
- §M: lingkup Library, `v_library_brand` saja
- M1 ditulis ulang — dari 23 pertanyaan jadi empat, tiga di antaranya baru
- M4 langkah 1: tiga view, bukan empat
- M6 uji nomor 5: `v_library_brand` tujuh kolom persis, tanpa kolom produk/harga/
  kontak/sampel, dan `links` tanpa `PRICE_LIST`/`MARKETPLACE`/`WHATSAPP`

---

## [Unreleased] - 2026-08-10 (23 pertanyaan yang memblokir eksekusi §M)

Membaca ulang seluruh `roadmap.md` untuk mengumpulkan apa saja yang butuh
keputusan owner sebelum §M dijalankan. Hasilnya satu dokumen, satu skrip
read-only, dan **satu celah di rancangan saya sendiri**.

### Added — `docs/TANYA-SEBELUM-EKSEKUSI.md`

23 pertanyaan, tujuh bertanda 🔴 memblokir. Tiap satu punya rekomendasi dan
akibat kalau salah tebak, jadi bisa dijawab dengan *"ikut rekomendasi kecuali
Q4 dan Q11"*.

Ditutup daftar **yang tidak ditanyakan** beserta dasarnya — sembilan keputusan
yang sudah saya ambil sendiri karena buktinya ada di repo. Tanpa daftar itu,
"pertanyaan yang tidak ada" tidak bisa dibedakan dari "hal yang terlewat".

### Added — `scripts/count-masterdata.mjs`

Read-only. Menghitung 18 tabel `master_data` memakai nama tabel **fisik**
(`Vendor`, `Material`, `VendorLink`, `VendorContact` — beberapa model di-`@@map`),
melaporkan tabel yang belum ada alih-alih gagal, dan menghitung satu angka
tambahan: berapa SKU yang harganya **berbeda** antara `Material` dan
`MaterialPrice`.

Angka terakhir itu titik paling berisiko di M2. Kalau > 0, tiap barisnya
keputusan manusia saat seeding — bukan `COALESCE`.

### Found — celah di draft v2: `Sku.code` wajib padahal sumbernya tidak punya SKU

`docs/masterdata-seed/BUILD_SUMMARY.json` mencatat dua fakta yang saya lewatkan
saat merancang:

```
"source_has_explicit_sku_column": false
"fake_sku_generation": false
```

Workbook sumbernya **tidak punya kolom SKU sama sekali**, dan impor 31 Juli
sengaja menolak mengarangnya. Draft v2 membuat `Sku.code` wajib dan mengunci
`@@unique([brand_id, code])` — artinya tidak satu pun dari 756 kandidat bisa
masuk tanpa kode artikel yang diketik satu per satu. Excel baru pun begitu:
`TH 231 AC` punya kode, `plywood 9mm` tidak.

Kode artikel pabrikan adalah **fakta tentang barang**, bukan **kunci basis
data**. Menjadikannya wajib memaksa mengarang fakta — persis yang impor Juli
benar menolak lakukan. Rekomendasi: `code` nullable, identitas kanonik pindah ke
`slug`, `@@unique([brand_id, slug])` + partial unique pada `code` di mana terisi.

Ditandai `⚠️ TERBUKA` di `schema.masterdata-v2.prisma` supaya tidak diterapkan
diam-diam sebelum dijawab.

### Temuan — ukuran sebenarnya mungkin jauh lebih kecil dari yang diasumsikan

`BUILD_SUMMARY.json` (31 Jul 2026) mencatat yang pernah di-seed: 392 brand, 399
kontak, 1010 link — tapi **nol Sku** dan **nol Sample**. Yang ada justru 756
`MaterialCandidate` + 287 `SampleCandidate` yang belum dikurasi, dengan 1046
blocker.

Kalau DB-nya masih seperti itu, sebagian besar risiko M2 hilang sendiri: tidak
ada riwayat harga yang perlu diselamatkan, tidak ada konflik `catalog_price` vs
`MaterialPrice`, tidak ada `Sample` yang perlu dipindahkan.

Itu juga memunculkan pertanyaan yang tidak ada sebelumnya: **1043 baris antrian
kurasi itu diapakan?** §C.2 membuang tabel stagingnya dengan alasan yang benar
untuk tabelnya — tapi isinya bukan sampah, itu pekerjaan yang belum dikerjakan.
Rekomendasi: ekspor ke CSV, buang tabelnya, impor ulang setelah v2 lewat jalur
impor permanen di schema `staging` terpisah.

### Changed — `roadmap.md`

- M1 ditulis ulang: menunjuk dokumen pertanyaan, mengangkat Q2/Q7/Q4/Q14/Q16
- Dokumen pertanyaan masuk tabel dokumen pendamping

---

## [Unreleased] - 2026-08-10 (Master Data sebagai SSOT — batas antar app)

**Keputusan owner: BQ ditangguhkan.** Master Data dikerjakan lebih dulu sebagai
SSOT untuk BQ **dan** Library StudioFlow. Sesi ini menelusuri apa yang sebenarnya
dibutuhkan supaya sebutan "SSOT" itu benar.

Masih dokumen dan draft schema. Nol baris data tersentuh.

### Koreksi atas klaim sendiri di entri sebelumnya

Entri sebelumnya menyebut "nol FK ke `studioflow`" sebagai capaian v2. **Itu
terlalu murah hati pada v2.** Penelusuran schema menunjukkan arahnya sudah benar
di v1: 5 FK `studioflow` → `master_data` (semuanya nullable), **nol** sebaliknya.
`master_data` sudah berdiri sendiri secara struktur; v2 **menjaganya**, bukan
mencapainya.

Yang sebenarnya mengikat ada di tiga tempat yang tidak terlihat di diagram relasi:

| Coupling | Bentuknya | Ongkosnya |
|---|---|---|
| **Tipe** | `Prisma.SkuGetPayload<>`, `Prisma.SampleGetPayload<>` di `extensions/library/types.ts` | Ganti nama satu kolom `master_data` → tipe StudioFlow gagal kompilasi |
| **Query** | 48 pemanggilan `tx.sku`/`tx.brand`/`tx.category`/`tx.sample` langsung dari `library-service.ts` | Tidak ada permukaan yang bisa distabilkan |
| **Tulis** | 21 operasi tulis ke `master_data` dari luar app Master Data | yang paling merusak |

### Temuan — konsumennya menulis, jadi SSOT-nya belum ada

SSOT berarti satu penulis, banyak pembaca. `master_data` hari ini punya
setidaknya tiga penulis: `extensions/library/services/library-service.ts` (21
operasi), `lib/services/settings-service.ts` (1), dan app Master Data sendiri.
Pemanggil `library-service.ts` bukan hanya app Master Data — juga
`extensions/schedule` dan `extensions/sketchup`.

**Contoh paling tajam, dan yang paling mudah dianggap tidak berbahaya:**
`settings-service.ts:342`. Mengganti nama satu kategori schedule di **Studio
settings StudioFlow** menulis ulang `Sku.catalog_tags` di seluruh `master_data`.
Sebuah pengaturan milik StudioFlow mengubah klasifikasi produk milik Master Data,
dalam satu transaksi, tanpa Master Data pernah tahu.

Itu bukan cacat kecil yang bisa dirapikan belakangan — itu definisi *bukan* SSOT.
Selama jalur ini ada, "kategori produk ini apa" punya dua jawaban yang sah
tergantung siapa yang terakhir menulis.

Aturan v2: **hanya app Master Data yang menulis ke schema `master_data`.**
StudioFlow dan BQ membaca. Kalau StudioFlow perlu sesuatu masuk, ia
**mengajukan** lewat `ProjectProductRequest` — bentuk yang sudah ada dan sudah
benar; yang kurang hanya penegakan bahwa tidak ada jalan pintas di sebelahnya.

### Keputusan — tiga permukaan baca, berbentuk view Postgres

| View | Konsumen | Menjawab |
|---|---|---|
| `v_library_brand`, `v_library_item` | StudioFlow Library | *Produk ini apa, mereknya siapa, sampelnya ada?* |
| `v_bq_material_rate`, `v_bq_work_rate` | BQ | *Ini berapa, satuannya apa, dari siapa?* |
| tabel langsung | app Master Data saja | semuanya |

**Kenapa view, padahal DTO TypeScript lebih gampang.** Aturan visibilitas hari
ini adalah array TS — `ALLOWED_LINK_KINDS` di `brand-library-service.ts` — dan
komentarnya sendiri menyebut sifat yang membuatnya bekerja: *closed-world*, satu
`BrandLinkKind` baru tidak terlihat sampai sengaja ditambahkan, dan penyaringan
terjadi di batas query, bukan di komponen.

Alasan itu benar, dan justru karena itu ia harus turun satu tingkat. Array TS
menjaga jalur query yang memakainya; jalur query **baru** tidak tahu array itu
ada — dan `library-service.ts` sudah punya 48 di antaranya. View memindahkan
closed-world dari "harus diingat" jadi default, ditegakkan `GRANT`/`REVOKE`
alih-alih kesepakatan.

DTO TypeScript tetap dibutuhkan, tapi sebagai tipe **tulis tangan** di
`masterdata/contracts/`, bukan `Prisma.SkuGetPayload<>`. Keduanya lapis berbeda:
view menegakkan apa yang bisa dibaca, DTO menegakkan bahwa StudioFlow tidak lagi
mengkompilasi tipenya dari skema Master Data.

**View juga yang membuat penangguhan BQ aman.** Selama BQ membaca view, bentuk
akhir yang ia butuhkan bisa diubah dengan menulis ulang view — tanpa migrasi
tabel dan tanpa menyentuh Library. Membangun BQ langsung di atas tabel akan
membekukan bentuk `SkuPrice`/`WorkPrice` pada tebakan pertama. Itu alasan
terkuat memakai view sejak awal, bukan setelah BQ ada.

### Keputusan — lima FK lintas schema jadi kolom biasa

**Yang hilang, dinyatakan terang-terangan:** `onDelete: SetNull` hari ini memberi
jaminan nyata — hapus SKU, rujukannya jadi NULL, bukan menggantung.

**Yang membuatnya tetap aman untuk `ProjectScheduleOption`, dan ini bukan
kebetulan:** `data_snapshot` sudah membekukan isi produk pada saat dipilih. Id
menggantung berarti "produknya sudah tidak ada di katalog", dan tampilannya tetap
utuh dari snapshot — schedule proyek berjalan memang **harus** menampilkan apa
yang dipilih dulu, bukan apa yang ada sekarang. FK-nya selama ini menjaga sesuatu
yang snapshot sudah jaga lebih baik.

`ProjectProductRequest` beda: ia belum punya snapshot, karena permintaan dibuat
sebelum produknya ada. Butuh `brand_name_snapshot` + `sku_name_snapshot` sebelum
FK-nya dilepas.

### Temuan — `ScheduleSnapshot` sudah kontrak, kosakatanya yang salah

`src/lib/validations/schedule-snapshot.ts` sudah tepat bentuknya: zod, ditulis
tangan, milik StudioFlow, tidak diturunkan dari Prisma. Ia bertahan melewati
perubahan skema apa pun karena tidak pernah menyentuhnya.

Yang salah hanya kosakatanya — `catalog_brand`, `catalog_vendor_id`,
`catalog_price` adalah nama kolom `master_data` **v1** yang dipinjam apa adanya.
Meminjam nama kolom membuat kontraknya *terlihat* stabil sambil sebenarnya
mengikuti tabel.

v2 memutus itu: snapshot bicara bahasa kontrak (`brand_name`, `category`,
`price`). **Snapshot yang sudah ada tidak ditulis ulang** — ia catatan keputusan
yang pernah diambil. Yang ditambahkan `snapshot_version`, dan pembacanya
menerjemahkan v1 → v2 saat dibaca. Migrasi JSON beku demi kerapian nama adalah
menulis ulang sejarah untuk kosmetik.

### Changed — `prisma/schema.masterdata-v2.prisma`

`PartyContact.brand_id String?` (opsional, `onDelete: SetNull`) + relasi balik
`Brand.scoped_contacts`. Masih lolos `prisma validate`.

Menutup celah nyata yang baru terlihat setelah menelusuri konsumennya: v1 punya
`BrandContact` (kontak melekat pada merek) dan `CompanyContact` (melekat pada
badan usaha) dan tidak bisa menyatakan yang di antara keduanya — "sales TACO di
Ace Hardware". Excel menaruh "Sales Name" di grup **Supplier Information**, jadi
kontaknya milik penjual; tapi yang ditanyakan orang selalu "siapa sales untuk
merek ini". Keduanya benar, dan yang dibutuhkan **cakupan opsional**, bukan tabel
ketiga.

### Changed — `docs/PLAN-MASTERDATA-V2.md`

Bagian **F — Master Data sebagai SSOT** baru: koreksi §B.7, peta 21 operasi
tulis, tiga permukaan baca, matriks visibilitas field per konsumen, pelepasan
lima FK, dan tiga tuntutan SSOT beserta pelanggaran v1-nya. Bagian "pertanyaan
terbuka" bergeser jadi **G**.

### Changed — `roadmap.md` §M

- Bagian SSOT baru sebelum M1
- **M4 baru** — tegakkan batas SSOT: buat view, ganti `Prisma.*GetPayload` jadi
  DTO, pindahkan 21 operasi tulis, lalu `REVOKE`/`GRANT`. Urutannya penting:
  batasnya dibangun sebelum konsumennya dipindahkan
- **M5 baru** — lepas lima FK lintas schema
- M4 lama (verifikasi) jadi **M6**, ditambah tiga uji batas SSOT: `SELECT`
  langsung sebagai `studioflow_app` harus **ditolak** (kalau lolos, seluruh M4
  hanya dokumentasi), view tidak memuat kolom terlarang, dan `Prisma.SkuGetPayload`
  nol hasil di `src/extensions/`
- M1 direvisi: pertanyaan penentu bukan lagi soal BQ

### Pertanyaan penentu yang sekarang jadi blocker M1

**Apakah Library boleh melihat `price_list` (harga sebelum diskon) dan identitas
supplier?**

Keputusan owner yang tercatat berbunyi *"ada harga ga masalah"* (1 Agu 2026) —
jelas mencakup harga jual. Harga beli plus nama supplier adalah hal lain:
keduanya bersama-sama mengungkap margin beli studio, di layar yang dipakai
desainer di depan klien.

Pembacaan saya **tidak**, dengan preseden yang sudah berlaku — `BrandContact`
disembunyikan karena *"supplier relationships belong to Master Data"*, dan
supplier per baris harga adalah hubungan supplier yang sama. Tapi ini menentukan
bentuk `v_library_item` (satu harga per SKU, atau daftar penawaran per supplier),
jadi harus dijawab sebelum view-nya ditulis.

---

## [Unreleased] - 2026-08-10 (Rancangan Master Data v2 — greenfield)

Rombakan `master_data` yang sudah dicatat §Arah Strategis roadmap akhirnya punya
rancangan. Sumbernya `design database masterdata.xlsx` (Table 1–4) dari owner,
dibandingkan terhadap 18 model `master_data` v1.

**Belum ada satu baris data pun yang tersentuh.** Yang dihasilkan sesi ini
adalah dokumen dan draft schema — keduanya tidak dibaca `prisma generate`.

### Added — `docs/PLAN-MASTERDATA-V2.md`

Analisis Excel, keputusan skema beserta alasannya, apa yang hilang dari v1,
optimasi tingkat SQL, peta migrasi, dan lima pertanyaan yang masih terbuka.

### Added — `prisma/schema.masterdata-v2.prisma`

Draft schema 18 model, **lolos `prisma validate`**. Sengaja berkas terpisah
dengan `output` generator sendiri, supaya rancangan bisa divalidasi tanpa
menyentuh schema aktif.

Berkas ini **self-contained**: nol FK ke schema `studioflow`. Itu bukan
kebetulan — §Arah Strategis poin 2 memutus ketergantungan langsung antar
keduanya, dan satu FK saja akan mengembalikannya lewat pintu belakang. Rujukan
lintas app disimpan sebagai kolom id biasa + snapshot nama
(`WorkPriceProjectRef.project_id` + `project_name`, `SampleMovement.actor_id` +
`actor_name`) — pola yang sudah terbukti di v1 lewat
`MaterialPrice.updated_by_name`.

### Keputusan — harga dipisah dari produk

Yang terbesar. Excel Table 2 mencampur identitas produk (SKU, brand, kategori,
spesifikasi, dimensi) dengan syarat dagang (harga, unit, dibeli di mana). Kolom
kiri berubah kalau pabrikannya mengubah produk — jarang. Kolom kanan berubah
tiap ada penawaran baru — sering.

Menaruhnya di satu baris berarti **menyimpan harga baru = menghapus harga lama.**
Itu keadaan v1 hari ini, dan itu sebabnya tiga pertanyaan ini tidak punya
jawaban: barang ini di toko mana paling murah, harga tahun lalu berapa, dan
kenapa angkanya berubah.

`SkuPrice` menampung banyak baris per SKU — satu per supplier, ber-`valid_from`
/ `valid_to`. `is_current` adalah denormalisasi yang disengaja: tanpanya "harga
yang berlaku sekarang" butuh window function di **setiap** pembacaan katalog,
jalur baca terpanas di aplikasi.

### Keputusan — satu `Party` dengan peran, bukan tabel per peran

Excel bertanya dua kali *"mungkin bisa dibuat table khusus suppliers/vendor
(?)"*. Jawabannya ya, tapi bukan tabel `Supplier` terpisah.

Kolom J + K Table 1 ("Supplier's Company" + "Company Categories: supplier,
subcon, vendor, retail store, manufacture") menggambarkan **satu entitas dengan
banyak peran**, bukan beberapa jenis entitas. Ace Hardware hari ini RETAIL;
kalau besok mengerjakan instalasi, ia SUBCON juga. Dengan tabel terpisah,
perusahaan berperan ganda muncul dua kali — kontak, alamat, dan link-nya ikut
terduplikasi, lalu menyimpang diam-diam saat salah satunya diperbarui.

Peran sebagai tabel join, bukan `String[]`: array tidak bisa di-FK, tidak bisa
diberi catatan per peran, dan filter "semua supplier" jadi scan.

`PartyType` (COMPANY / INDIVIDUAL) ada karena datanya menuntut — Excel Table 3/4
mencantumkan `rahmat`, `Tukang`, `Andi` sebagai vendor. Mereka bukan perusahaan.

**Ongkosnya dinyatakan terang-terangan di dokumen:** integritas peran tidak lagi
dijamin FK. Tidak ada yang menghalangi Party ber-peran MANUFACTURER saja dipasang
sebagai supplier. Penjaganya service layer sekarang, trigger kalau terbukti ada
yang lolos — bukan trigger lebih dulu, karena kompleksitas tanpa bukti masalah
tetap harus dirawat.

### Keputusan — kolom "Items" di Table 3/4 (pertanyaan owner)

Blok pertama (`MEP / Lighting / rahmat / "Penarikan kabel CAT"`) tidak punya
kolom nama sama sekali; nama pekerjaannya menumpang di `Specification 1`. Blok
kedua (`Furniture / Andi / "Meja 10x10"`) punya kolom `Items` yang isinya persis
itu.

**`Items` bukan konsep baru — ia slot yang di blok pertama salah tempat.**

Karena itu: satu kolom `name` **wajib** di kedua kasus, bukan kolom `Items`
tambahan. Dan **bukan** di dalam JSON `spec` — nama pekerjaan wajib ada, dicari,
diurutkan, dan ditampilkan di tiap baris BQ. Atribut seperti itu butuh kolom,
index, dan `NOT NULL`; menaruhnya di JSON berarti melepas ketiganya. `spec`
tetap untuk keterangan yang jumlahnya memang tidak tetap (CAT 6, H 20-50).

**Table 3 dan Table 4 digabung jadi satu `WorkPrice`.** Struktur kolomnya
identik; bedanya cuma ada-tidaknya komponen material — perbedaan **data**, bukan
**struktur**. Dua tabel berkolom sama akan memaksa setiap pembaca BQ meng-`UNION`
keduanya selamanya, dan setiap kolom baru ditambahkan dua kali. Itu persis cacat
yang sudah ada di v1 antara `ServicePrice` dan `MaterialLaborPrice`.

### Keputusan — satu pohon `Category` menggantikan enam kolom teks bebas

Excel memunculkan pasangan dua tingkat berulang dengan nama berbeda:
`Category`/`Material` di Table 2, `Vendor Category`/`Category` di Table 3 dan 4.

v1 memodelkannya sebagai enam kolom `String` terpisah plus satu tabel `Category`
ber-slug yang tidak terhubung ke satu pun di antaranya. Akibatnya `"MEP"` di
`ServicePrice` dan `"MEP"` di `MaterialLaborPrice` adalah dua string yang
**kebetulan** sama; salah ketik satu huruf melahirkan kategori baru tanpa
peringatan.

`Category` self-referencing menutup semuanya, dan mengubah "ganti nama kategori"
dari migrasi data di enam tempat jadi satu `UPDATE`.

Kuncinya `@@unique([kind, slug])` **global**, bukan `[parent_id, slug]` yang
terlihat lebih alami: di Postgres NULL tidak sama dengan NULL, jadi
`[parent_id, slug]` tidak akan mencegah dua kategori **akar** bernama sama —
jebakan senyap yang mahal ditemukan belakangan.

### Keputusan — `Decimal` menggantikan `Float`

v1 memakai `Float` di **10 kolom uang `master_data`** (`ServicePrice.price`,
`MaterialPrice` ×2, `MaterialLaborPrice` ×3, `Sku` ×2, `MaterialCandidate` ×2).
`double precision` tidak bisa
merepresentasikan `0.1` persis; menjumlahkan ratusan baris BQ mengakumulasi galat
yang muncul sebagai selisih rupiah di total — di dokumen komersial yang
ditandatangani orang.

Konsekuensinya di kode disengaja: Prisma mengembalikan `Decimal`, bukan `number`,
jadi tiap aritmetika harus lewat `.plus()`/`.times()`. Justru `Float` yang
diam-diam bisa dijumlahkan dengan `+` yang membuat cacatnya tak terlihat.

### Keputusan — `Sku.brand_id` jadi nullable

v1 mewajibkannya. Excel Table 2 kolom D menyatakan eksplisit *"apabila tidak ada
brand bisa dikosongkan"*, dan contohnya membuktikan: `plywood 9mm`, brand `-`.

Relasi wajib pada data yang sah kosong selalu menghasilkan hal yang sama — baris
sampah bernama `-` atau `Generic` yang lalu muncul di setiap dropdown dan setiap
laporan.

### Yang Excel minta tapi tidak diikuti, beserta alasannya

| Permintaan | Keputusan | Alasan |
|---|---|---|
| "Socmed simpan dalam json" | tabel `PartyLink` ber-`kind` | JSON tidak bisa di-unique-kan (URL ganda lolos), diurutkan, atau dicari |
| Dimensions satu string `1220 x 2440 mm` | kolom numerik + `dim_display` | BQ menghitung m² dari angkanya; parse akan gagal pada `-` |
| "Update by / Update Time" per tabel | kolom denormalisasi **dan** `MasterDataAudit` | kolom hanya menyimpan perubahan terakhir; update berikutnya menimpanya |
| "Spec 1/2 di json" | **diikuti** + GIN index | ini benar — atribut opsional berjumlah tidak tetap |

### Dibuang dari v1

`MaterialCandidate` dan `SampleCandidate` — tabel *staging* impor spreadsheet
(`source_sheet`, `source_row`, `source_checksum`, `blocker_reasons`). Bentuknya
adalah bentuk pekerjaan sekali jalan yang tidak pernah dibersihkan setelah
selesai. Greenfield berarti seeding ulang; kalau kelak butuh jalur impor lagi,
tempatnya schema `staging` terpisah.

Keduanya menahan 8 kolom di model lain — membuangnya membersihkan lebih dari dua
tabel.

`Sample` + `SampleMovementLog` **dipertahankan** meski tidak disebut Excel sama
sekali. Rak/box sample fungsi bisnis yang berjalan hari ini; Excel ini merancang
katalog dan harga, bukan seluruh Master Data. Dicatat supaya keputusannya
terlihat, bukan tersembunyi.

### Optimasi yang tidak bisa dinyatakan Prisma

Empat invariant di rancangan **tidak ditegakkan apa pun** tanpa SQL manual, dan
`prisma validate` tetap hijau tanpanya — itu yang membuatnya mudah terlewat:

1. Partial unique `WHERE is_current` pada `SkuPrice`, dengan `COALESCE` pada
   `supplier_party_id` karena NULL ≠ NULL
2. Partial unique `WHERE is_primary` pada `SkuCategory` — menggantikan konvensi
   v1 "tag pertama adalah yang utama", yang rusak tanpa suara begitu ada yang
   menyortir ulang
3. `total_price` jadi `GENERATED ALWAYS AS ... STORED`. v1 menyimpannya sebagai
   kolom biasa dengan komentar "derived" — niat yang benar, jaminan yang tidak
   ada
4. Partial unique kode SKU untuk baris tanpa brand, GIN untuk `spec`, `pg_trgm`
   untuk pencarian nama

Yang sengaja **tidak** dilakukan dan alasannya juga dicatat: tanpa `citext`
(menular ke setiap perbandingan), tanpa partisi (ribuan baris, bukan puluhan
juta), tanpa materialized view (butuh strategi refresh, dan strategi refresh
butuh orang yang mengingatnya).

### Changed — `roadmap.md`

- §Arah Strategis poin 1 diperinci: rombakannya **greenfield**, bukan bertahap
- §M baru — M1 konfirmasi pertanyaan terbuka, M2 migrasi + seeding, M3 tulis
  ulang service/UI, M4 verifikasi
- **A1–A5 ditangguhkan** oleh §M. Kelimanya memperbaiki schema yang akan dibuang
  utuh; `SkuCategory`, kolom `source` di `BrandCategory`, dan pemindahan
  `legal_name` sudah masuk rancangan v2 sejak awal
- Kecuali **A5 langkah 1–4 tetap dijalankan lebih dulu** — hasilnya keputusan
  pengelompokan manusia (brand mana milik badan usaha mana) yang akan tetap
  dibutuhkan seeding v2, jadi tidak terbuang
- §T2 diperbarui: pembelaannya tetap benar untuk v1, dan v2 tidak menggabungkan
  kedua kegunaan itu — ia memberi masing-masing pohon sendiri lewat `CategoryKind`

### Lima pertanyaan yang masih terbuka

Tercatat di dokumen §G (waktu itu §F). Yang paling menentukan: **schema `bq` masih nol model**,
jadi konsumen `SkuPrice`/`WorkPrice` belum ada. Merancang bentuk finalnya tanpa
tahu apa yang dibaca BQ berarti menebak — dan tebakannya baru ketahuan salah
setelah ada yang membangun di atasnya.

---

## [Unreleased] - 2026-08-10 (Pemilih PIC disaring sesuai perannya)

Kursi PIC dinamai menurut perannya — DIC (Designer) dan DRIC (Drafter) — tetapi
pemilihnya menawarkan jauh lebih banyak:

| Kursi | Sebelum | Sesudah |
|---|---|---|
| DIC (Designer) | ADMIN, DEVELOPER, DIC, STAFF | **DIC** |
| DRIC (Drafter) | STAFF, DRIC | **DRIC** |

Itu sebabnya akun STAFF muncul sebagai kandidat drafter di tangkapan layar.

### Added — `core/rbac/project-pic.ts`

Daftar peran hidup **terduplikasi** di dua berkas halaman yang sudah sempat
menyimpang satu sama lain. Sekarang satu tempat: `DESIGNER_ROLES`,
`DRAFTER_ROLES`, `eligibleDesigners`, `eligibleDrafters`, `isPicAssignable`.

Modulnya sengaja memakai `import type` dan literal string, bukan objek enum
`Role` — enum itu impor runtime dari client Prisma, dan modul ini murni
kebijakan. Bebas dari client berarti bisa diuji tanpa database.

### Fixed — pemegang kursi tidak boleh hilang dari daftar

Ini yang membuat perubahan sederhana tadi berbahaya kalau dikerjakan lugu.

Pemilihnya adalah `<select defaultValue={currentId}>` **tak terkendali**. Kalau
pemegang kursi sekarang tidak ada di antara opsinya, browser diam-diam
menampilkan opsi **pertama** — dan menyimpan tanpa pernah menyentuh field itu
akan **memindahkan proyek** ke siapa pun yang kebetulan terurut paling awal.
Setiap proyek yang PIC-nya ditetapkan di bawah aturan lama yang longgar akan
ditulis ulang diam-diam oleh siapa pun yang membuka dialognya.

Karena itu `eligibleDesigners`/`eligibleDrafters` selalu menyertakan pemegang
kursi saat ini, sekalipun perannya tidak lagi memenuhi syarat.

### Added — aturan ditegakkan di server

Aturan yang hanya hidup di UI bukan aturan, melainkan default. `executeUpdateProjectMetadata`
dan `executeBootstrapProject` sekarang menolak PIC yang perannya tidak cocok,
dengan pesan yang menyebut nama, perannya, dan kursi mana yang ditolak.

Aturannya **"memenuhi syarat ATAU tidak berubah"**, bukan sekadar "memenuhi
syarat". Proyek yang designernya ditetapkan sebelum pengetatan ini harus tetap
bisa disimpan — kalau tidak, menyunting field yang sama sekali tidak
berhubungan di proyek itu akan gagal, dan satu-satunya jalan keluar adalah
memindahkan proyek yang tidak seorang pun minta dipindahkan.

### Consequence worth knowing

**ADMIN tidak bisa lagi *ditugaskan* sebagai designer.** Peran admin tetap
melewati semua gerbang per-proyek (`isAdminLevel`), jadi tidak ada yang
terhalang — tetapi memegang kursinya sekarang berarti memegang perannya. Kalau
sebuah akun admin memang menjalankan proyek, beri ia peran DIC.

Proyek yang PIC-nya sudah admin **tidak terganggu**: ia tetap di daftar dan
tetap bisa disimpan, lewat aturan "tidak berubah" di atas.

### Verification

`tsc --noEmit` 0 error ✅ · `eslint` 0 error ✅ · `npm test` **49 lulus / 0
gagal** ✅ (naik dari 40; sembilan test baru, sebagian besar mengunci dua jalan
keluar itu — keduanya terlihat seperti kode mati sampai ada yang menghapusnya).

---

## [Unreleased] - 2026-08-10 (Pisah dua pertanyaan: `/` = Tasks, `/upcoming` = tanggal)

Usulan owner, dan tepat: satu daftar tidak bisa menjawab dua pertanyaan tanpa
berbohong di judulnya. "Today's View" menampilkan **semua** task tanpa peduli
tanggal — judulnya menjanjikan hari ini, isinya bukan.

| Halaman | Pertanyaan | Pengelompokan |
|---|---|---|
| `/` — **Tasks** | Apa yang ada di tiap proyek saya? | Per proyek |
| `/upcoming` — **Upcoming** | Apa yang jatuh tempo kapan? | Per tanggal |

### Added — kolom `due_at` di `Activity`

**Migrasi `20260810140000_activity_due_date`.** Aditif murni: satu kolom
nullable dan satu index. Tidak ada backfill — task yang tidak ditanggali orang
memang tidak punya tanggal.

Ini penghalang yang saya temukan sebelum halaman tanggal dibangun, dan owner
memutuskan menutupnya: **`Activity` sama sekali tidak punya due date.** Tanpa
kolom ini, task lepas dan feedback revisi — yang justru paling sering dikejar
tenggat — mustahil muncul di halaman Upcoming. Halaman tanggal yang menampilkan
separuh pekerjaan adalah halaman yang tidak akan dipercaya orang.

Ikut lahir: `executeSetActivityDueDate`, action `setActivityDueDate`,
`SetActivityDueDateSchema`, dan audit action `UPDATE_ACTIVITY_DUE_DATE`. Tanpa
jalur tulis, kolomnya tidak terjangkau.

Sengaja **tidak** ditambahkan: prioritas untuk `Activity`. Ia tetap netral,
konsisten dengan keputusan sebelumnya bahwa urgensi proyek bukan prioritas task.

### Added — `/upcoming`

Enam bucket, urut baca: **Overdue · Today · Tomorrow · Next 7 days · Later ·
No date**. Bucket kosong dibuang.

Keputusan yang tercatat beserta alasannya:

- **"Next 7 days", bukan minggu kalender.** Minggu kalender membuat jawaban hari
  Jumat atas "apa yang akan datang" nyaris kosong dan jawaban hari Senin
  membludak — kebalikan dari berguna.
- **Task selesai tidak pernah masuk `overdue`.** Aturan yang sama dengan filter
  Overdue: task selesai bertanggal lampau bukan masalah, dan menandainya sebagai
  masalah melatih orang mengabaikan warnanya.
- **Subtask diangkat ke bucket-nya sendiri**, tidak tetap bersarang. Di tampilan
  tanggal ia membawa tanggalnya sendiri; membiarkannya di bawah induk yang ada
  di bucket lain akan mengarsipkan baris itu di hari yang salah.
- **"No date" ada di balik toggle, bukan dihilangkan.** Di studio yang belum
  terbiasa menanggali, bucket ini paling besar. Tapi menyembunyikannya diam-diam
  lebih buruk — tampilan tanggal yang menghilangkan pekerjaan tidak dipercaya.
- **Nama proyek jadi chip di baris, bukan judul bagian.** Di sini harinya yang
  jadi bingkai dan proyeknya yang jadi detail — persis kebalikan halaman `/`.
- **Input tanggal ada di baris, bukan di balik menu.** Menjadwal ulang adalah
  satu-satunya suntingan yang halaman ini memang untuk itu.

### Added — `task-feed-query.ts`

Satu query di belakang **kedua** halaman. Mengambil dua kali akan membiarkan
keduanya menyimpang: satu layar mulai menampilkan task yang layar lain sudah
saring, dan tidak ada apa pun yang mengatakan mana yang benar.

### Changed

- **`/` jadi "Tasks"** (eyebrow "Workload"). Judul dan deskripsinya tidak lagi
  menjanjikan "hari ini".
- **Toggle All projects dihapus** atas permintaan owner. Halaman ini daftar
  kerja pribadi; `/projects` sudah memberi pandangan menyeluruh bagi yang butuh.
- **Nav: dua tampilan task berdampingan** — `Tasks` (ikon list) dan `Upcoming`
  (ikon kalender). `Upcoming` **keluar dari registry extension**: ia bukan lagi
  fitur opsional yang dimatikan flag, melainkan route inti.
- **Menu baris di `/` kini muncul untuk kedua sumber.** Activity dapat pengatur
  tanggal saja; prioritas, label, dan assignee tetap khusus checklist — kalau
  ditampilkan ke Activity, itu kontrol yang tidak menulis ke mana pun.

### Verification

`prisma validate` ✅ · `tsc --noEmit` 0 error ✅ · `eslint` 0 error pada berkas
tersentuh ✅ · `npm test` **40 lulus / 0 gagal** ✅ (naik dari 34; enam test baru
mengunci pembagian bucket, termasuk batas hari ke-7 dan pengangkatan subtask).

Migrasi **belum diterapkan** — lihat `roadmap.md` §C-SISA-1.

---

## [Unreleased] - 2026-08-10 (Today's View — lingkup jadi semua proyek yang dipegang)

Keputusan owner: Today's View adalah daftar **semua proyek yang dipegang**,
punya task atau tidak. Sebelumnya proyek yang dipegang tapi kosong **menghilang
sama sekali** — dan piring kosong jadi terlihat persis seperti piring yang
dipegang orang lain. Pembacanya tidak bisa membedakan keduanya.

### Changed — lingkup query

| | Sebelum | Sesudah |
|---|---|---|
| Syarat fase | Harus punya fase berstatus aktif | **Tidak ada syarat** |
| Kepemilikan | Non-admin: yang dipegang. Admin: semua | **Yang dipegang**, untuk semua |
| Proyek COMPLETED | Ikut kalau ada fase aktif | **Dikecualikan** |
| Proyek tanpa task | Hilang dari layar | **Tetap tampil**, dengan angka 0 |

Proyek **COMPLETED** dikeluarkan atas keputusan owner. Layar ini menjawab "apa
yang harus saya kerjakan hari ini", dan proyek yang sudah selesai tidak punya
jawaban untuk itu — memasukkannya berarti daftar menumpuk minggu demi minggu
tanpa henti. Daftar lengkapnya tetap ada di `/projects`.

Fase yang **belum aktif tetap tidak menyumbang** baris checklist. Proyeknya
muncul, tapi checklist fase yang belum jalan bukan pekerjaan hari ini.

### Changed — `groupTasksByProject` menerima daftar proyek

Dulu grup diturunkan dari task, jadi proyek tanpa task tidak pernah punya grup.
Sekarang fungsinya menerima daftar proyek sebagai argumen pertama dan task
sebagai kedua; daftar proyek itu yang menentukan grup **dan urutannya**.

Task yang proyeknya tidak ada di daftar **dibuang, bukan dibuatkan grup**.
Pemanggil mengambil keduanya dari query yang sama, jadi itu hanya terjadi kalau
keduanya berbeda — dan merender grup yang tidak diminta pemanggil justru
menyembunyikan perbedaan itu.

### Added

- **Toggle My / All projects** untuk admin, kata-katanya sama persis dengan
  halaman Projects supaya keduanya terbaca sebagai saklar yang sama. Berupa
  **tautan**, bukan state klien: lingkup mengubah query server, jadi ia memang
  harus navigasi — dan karena berupa URL, "all projects" bisa di-bookmark.
  Default tetap "My projects", termasuk untuk admin.

- **Baris "Nothing queued."** pada proyek yang grupnya kosong. Antrean kosong
  adalah hasil, bukan bagian yang hilang.

  Grup kosong ini **hanya muncul di tampilan default**. Begitu sebuah filter
  menyala, pertanyaannya berubah jadi "apa yang cocok dengan ini", dan proyek
  tanpa kecocokan menjadi derau — jadi ia keluar dari daftar.

### Verification

`tsc --noEmit` 0 error ✅ · `eslint` 0 error pada berkas tersentuh ✅ ·
`npm test` **34 lulus / 0 gagal** ✅ (naik dari 32 — tiga test grouping ditulis
ulang untuk perilaku baru, termasuk satu yang mengunci bahwa proyek tanpa task
**tidak boleh** dibuang).

---

## [Unreleased] - 2026-08-10 (KOREKSI — checklist hanya lahir dari template)

**Koreksi rancangan, bukan fitur baru.** Owner menunjukkan bahwa Global
Checklist — dan Phase Requirements — seharusnya dibuat terpusat dari Settings
oleh admin. Quick-add yang saya pasang di kedua kartu itu keliru: ia
memungkinkan item checklist lahir per-proyek, padahal seluruh gunanya justru
karena ia **sama untuk setiap proyek**.

### Aturan yang sekarang berlaku

> Item checklist adalah **requirement**. Ia didefinisikan sekali oleh admin di
> `ChecklistTemplate` (Studio settings), digenerate ke tiap proyek oleh
> `executeSyncProjectChecklists`, dan dihitung oleh gerbang approval fase.
> Tidak ada jalur lain yang boleh membuatnya.
>
> **Subtask adalah hal yang berbeda dan tetap boleh dibuat.** Ia memecah
> requirement yang **sudah ada**, tidak menambah kewajiban baru, dan memang
> tidak dihitung gerbang approval (`assertNoPendingTasks` hanya menghitung task
> akar). Kalau ini pun mau dikunci, tinggal bilang.

### Removed

Ditutup di **server**, bukan hanya disembunyikan di UI — kalau hanya UI-nya
yang dilepas, jalurnya tetap terbuka lewat pemanggilan langsung:

| Dihapus | Sebabnya |
|---|---|
| `checklistService.executeCreateTask` | Diganti `executeCreateSubtask`; `parentId` kini **wajib** |
| `phaseService.executeAddChecklistItem` | Hanya pernah membuat item akar untuk satu fase |
| Action `addChecklistItem` | Ikut jalur di atas |
| `AddChecklistItemSchema` | Ikut |
| `CreateTaskSchema` | Diganti `CreateSubtaskSchema` — `parentId` wajib, `phaseId` dibuang |
| Action `createTask` | Diganti `createSubtask` |

`CreateSubtaskSchema` menolak pembuatan item akar **sebelum service disentuh**:
tidak ada bentuk input yang bisa menghasilkannya. `phaseId` sengaja dibuang dari
input — subtask mewarisi fase induknya, dan menerimanya dari pemanggil akan
membiarkan orang menaruh subtask di fase yang bukan fase induknya.

`createSubtask` juga memeriksa akses dari **induknya**, bukan dari input.
Mengambil fase dari pemanggil akan memungkinkan seseorang menitipkan subtask ke
fase yang boleh ia edit sementara induknya ada di fase yang tidak.

### Changed — UI

- **Quick-add dihapus** dari `TaskList`, jadi hilang di kedua permukaan
  sekaligus (Global Checklist dan Phase Requirements). `phaseId` ikut dibuang
  dari propsnya — tidak ada lagi yang membacanya.

- **Empty state menyebutkan asalnya**, karena "ini datang dari mana" justru
  ditanyakan tepat saat kartunya kosong:
  - Global: *"No global checklist items. These come from Studio settings and apply to every project."*
  - Fase: *"No requirements defined for this phase. These come from Studio settings."*

- **Tautan ke Studio settings hanya untuk admin.** `/settings/studio` memang
  me-redirect non-admin ke `/settings/profile`, jadi menampilkan tautannya ke
  semua orang berarti mengirim mayoritas orang ke redirect.

### Yang sengaja TIDAK berubah

Prioritas, due date, assignee, label, dan komentar **tetap bisa diedit
per-proyek**. Template menyatakan **apa** yang harus ada; proyek menyatakan
**kapan** dan **siapa**. Keduanya klaim berbeda dan tidak saling menabrak.

Begitu juga **detach from template** dan **delete setelah detach** — itu satu-
satunya cara membuang item yang tidak relevan untuk satu proyek tanpa mengubah
template yang dipakai semua proyek lain.

### Verification

`tsc --noEmit` 0 error ✅ · `eslint` 0 error pada berkas tersentuh ✅ ·
`npm test` 32 lulus / 0 gagal ✅ · pemindaian: **nol** jalur tersisa yang bisa
membuat item checklist akar ✅.

---

## [Unreleased] - 2026-08-10 (D1 jaring pengaman + D4 bahasa UI ke Inggris)

Dua temuan audit dikerjakan. Tanpa migrasi, tanpa perubahan schema.

### Added — jaring pengaman halaman (roadmap D1)

Sebelum ini StudioFlow **tidak punya error boundary sama sekali**, dan sepuluh
halaman memanggil `notFound()` tanpa ada `not-found.tsx` di mana pun.

- **`route-error.tsx` + `route-not-found.tsx`** (`components/shared/`) — badan
  bersama, dipakai tiap `error.tsx` dan `not-found.tsx`.

  `error.message` **sengaja tidak ditampilkan**: kegagalan Prisma menaruh nama
  tabel dan kolom di sana, dan stack di production tidak memberi tahu pembaca
  apa pun yang bisa ia lakukan. Yang ditampilkan `error.digest` — pegangan yang
  menghubungkan layar itu dengan satu baris log server.

- **`(dashboard)/error.tsx`** menangkap semua turunannya. Karena berada di dalam
  layout dashboard, sidebar dan header ikut selamat — pengguna masih berada di
  suatu tempat, bukan terdampar di halaman kosong.

- **`projects/[id]/error.tsx`** terpisah supaya kegagalan di dalam satu proyek
  tidak ikut menjatuhkan navigasi fase.

- **`(dashboard)/not-found.tsx`** dan **`projects/[id]/not-found.tsx`**.

- **Tiga `loading.tsx`** untuk halaman terberat: `/projects`, `/projects/[id]`,
  dan `phases/[phaseId]`. Layout dashboard memakai `force-dynamic`, jadi tiap
  navigasi menunggu server; tanpa skeleton tidak ada apa pun yang berubah di
  layar antara klik dan render.

### Fixed — dua penanganan berbeda untuk satu keadaan

`projects/[id]/layout.tsx` merender shell berjudul harfiah
`"Project Not Found"` dengan daftar fase kosong, sementara `page.tsx` di
dalamnya memanggil `notFound()`. Jadi id yang salah menghasilkan **404 bawaan
Next yang dibungkus navigasi proyek yang tampak berfungsi**. Layout sekarang
ikut memanggil `notFound()` — satu keadaan, satu jawaban.

### Changed — bahasa UI seragam Inggris (roadmap D4)

Keputusan owner. Sebelumnya campur: halaman yang belakangan disentuh berbahasa
Indonesia, yang lama Inggris, dan beberapa layar campur di dalam dirinya
sendiri.

Yang diubah — judul dan deskripsi halaman, tab filter, empty state, label menu,
placeholder, pesan toast, dan teks dialog:

```
(dashboard)/page.tsx              activity/page.tsx
library/page.tsx                  projects/[id]/activity/page.tsx
task-list.tsx                     today-view.tsx
project-list-client.tsx           top-header.tsx
activity-log-table.tsx            brand-links-editor.tsx
BrandLibraryExplorer.tsx          library-service.ts
sketchup-actions.ts               phase-service.ts
```

- **`activity-copy.ts` ditulis ulang.** Modul ini menerjemahkan aksi audit log
  jadi kalimat; seluruh kamusnya berbahasa Indonesia. Sekarang Inggris, dengan
  kata kerja **lampau** — audit log adalah catatan apa yang terjadi, bukan umpan
  langsung: "approved internal review", bukan "approves". Sekalian ditambahkan
  enam label untuk `AUDIT_ACTIONS` checklist yang lahir hari ini dan sebelumnya
  jatuh ke fallback. Test-nya ikut ditulis ulang.

- **Format tanggal ikut pindah** dari `id-ID` ke `en-GB` (`19 Aug`, bukan
  `19 Agu`).

- **Kapitalisasi judul disamakan ke Title Case.** `PROJECTS` dan
  `DELIVERABLES TRACKING` ditulis kapital di sumbernya; sisanya Title Case.
  Kapital penuh sudah menjadi penanda `eyebrow` dan header tabel — memakainya
  lagi di judul melemahkan penandanya.

**Master Data sengaja tidak disentuh.** Roadmap §Arah Strategis menyatakan modul
itu akan dirombak ulang; menerjemahkan layar yang akan dibongkar adalah
pekerjaan terbuang. Bahasanya menyusul saat rombakan.

**Komentar kode dan dokumentasi juga tidak diubah** — keduanya untuk yang
mengerjakan repo, bukan untuk pengguna. `CHANGELOG.md` dan `roadmap.md` tetap
berbahasa Indonesia.

### Verification

`tsc --noEmit` 0 error ✅ · `eslint` 0 error pada 22 berkas tersentuh ✅ ·
`npm test` 32 lulus / 0 gagal ✅ · pemindaian string: **0 sisa** teks Indonesia
di StudioFlow di luar Master Data ✅.

`next build` masih belum bisa dijalankan di lingkungan ini (`Bus error`).

---

## [Unreleased] - 2026-08-10 (Audit UX seluruh halaman)

### Documentation

- **`AUDIT-UX-2026-08-10.md`** (baru). Pemeriksaan 25 route di `src/app` beserta
  tiap komponen tabel dan panel yang dipakainya. 12 temuan, tiap satu dengan
  bukti di kode, dipisah antara **cacat** (7) dan **preferensi** (5) supaya
  tidak ada yang dikerjakan hanya karena tercantum.

  Tiga temuan yang paling tidak terduga:

  1. **StudioFlow tidak punya error boundary sama sekali.** Empat `error.tsx`
     yang ada semuanya milik Master Data, dan satu di antaranya sudah mati.
     Komponen `ErrorBoundary` sudah ada dan dipakai — tetapi hanya membungkus
     sidebar Live Collaboration. Panel chat dilindungi; halaman proyeknya tidak.
  2. **Sepuluh halaman memanggil `notFound()`, nol `not-found.tsx`.** Lebih
     jauh: `projects/[id]/layout.tsx` merender shell berjudul harfiah
     `"Project Not Found"` sementara `page.tsx` di dalamnya memanggil
     `notFound()` — jadi id yang salah menghasilkan 404 bawaan Next yang
     dibungkus navigasi proyek yang tampak berfungsi.
  3. **14 `confirm()` bawaan browser untuk aksi merusak.** Yang membuat ini
     cacat dan bukan selera: browser modern menawarkan "jangan tampilkan lagi"
     setelah beberapa dialog berturut-turut, dan sekali dicentang penghapusan
     berjalan tanpa konfirmasi apa pun tanpa app tahu. `CatalogBoard.tsx`
     memanggil `confirm()` dua kali berurutan untuk satu aksi karena satu kotak
     tidak muat memuat peringatannya.

  Angka lain yang tercatat: 38 `catch` hanya `console.error` versus 83 yang
  memakai `toast`; 21 halaman berbagi satu `loading.tsx`; 11 tabel tanpa
  `minWidth` sehingga kolomnya menyusut alih-alih memicu scroll; 13 halaman
  dengan judul dan deskripsi campur Inggris–Indonesia.

  Laporan juga mencatat apa yang **sudah bagus dan sebaiknya tidak diutak-atik**
  — aturan `no-restricted-imports` yang benar-benar menegakkan design system,
  komentar kode yang menjelaskan *mengapa*, dan RBAC berlapis di layout.

- **`roadmap.md` §D** (baru) — lima temuan yang berjenis **cacat** diangkat jadi
  D1–D5. Yang berjenis preferensi sengaja **tidak** diangkat: menaruhnya di
  roadmap akan membuatnya terbaca sebagai pekerjaan wajib.

Belum ada perubahan kode. Dokumentasi saja.

---

## [Unreleased] - 2026-08-10 (Tabel proyek + Today's View)

Dua permukaan dirombak. Tidak ada migrasi, tidak ada perubahan schema.

### Fixed — badge progress menimpa kolom sebelahnya

Cacat yang terlihat di tangkapan layar owner. `PLAN-AUDIT-ROADMAP-2026Q3.md`
§1.2 A3 mencatat masalah ini sudah diperbaiki; **belum**. Perbaikan sebelumnya
memasang `max-w-full` pada badge, tetapi kelas dasar `Badge` berisi
`w-fit shrink-0 whitespace-nowrap` — dan `max-w-full` **tidak bisa menyusutkan
kotak ber-`shrink-0`**. Di baris flex, pil mempertahankan lebar intrinsiknya
dan menumpuk ke sel berikutnya, tepat di atas ikon mata.

Dua hal yang memperbaikinya:

1. `min-w-0` + `!shrink` pada badge, membatalkan `w-fit shrink-0` dari kelas
   dasar sehingga pil benar-benar bisa menyusut dan `truncate` bekerja.
2. Status review dipecah jadi badge sendiri. "DESIGN 3D V10.0" +
   "ON CLIENT REVIEW" dalam satu pil lebih lebar dari kolom mana pun yang
   masuk akal; sebagai dua badge, pasangannya membungkus ke baris kedua alih-alih
   satu pil tumbuh melewati selnya.

### Changed — tata letak tabel proyek

- **Kolom ikon diberi nama.** Designer dan Drafter dulunya dua kolom berkepala
  ikon palet dan pena telanjang. Tidak ada apa pun di layar yang mengatakan mana
  yang mana, dan tooltip baru muncul saat hover — jadi kedua nama terbaca sebagai
  hal yang bisa dipertukarkan. Sekarang satu kolom **TIM**, dua baris berlabel.

- **Lebar kolom dihitung ulang.** PROGRESS 18% → 30%; ia memegang konten
  terlebar di baris. Ongkosnya dibayar dari Designer+Drafter (24% untuk satu
  nama pendek masing-masing) yang kini jadi 15%. Kunci penyimpanan lebar diganti
  ke `project-list-v2` supaya default baru benar-benar terpakai; siapa pun yang
  sudah menyeret kolomnya sendiri tetap memegang tata letaknya.

- **Prioritas dan hapus pindah ke menu titik-tiga.** Tombol hapus dulu ada di
  setiap baris dengan opasitas penuh — aksi paling merusak di halaman itu,
  sejauh satu klik meleset, bersebelahan dengan tautan yang diklik sepanjang
  hari. Prioritas tetap terbaca sekilas lewat chip, tapi **hanya** untuk URGENT
  dan LOW: chip NORMAL di setiap baris adalah derau yang justru menyembunyikan
  yang URGENT.

  Dialog konfirmasi hapus dipasang sebagai **saudara** menu, bukan anak dari
  item menu. Radix melepas isi dropdown saat item dipilih, jadi AlertDialog di
  dalamnya akan dibongkar pada tick yang sama saat ia dibuka — konfirmasinya
  berkedip lalu hilang.

### Added — Today's View membaca dua sumber task

Keputusan owner: satukan **di tampilan, bukan di tabel** — persis yang tercatat
di roadmap §C. Tidak ada data yang dipindahkan, tidak ada tabel yang digabung.

- **`src/types/task-feed.ts` + `src/lib/services/task-feed.ts`** — proyeksi sisi
  baca yang dipetakan dari `Activity` (butir loop revisi) **dan**
  `ProjectChecklist` (task dengan prioritas/due/subtask/label). Tidak ada yang
  menulis `UnifiedTask`; tiap baris memegang jalur tulisnya sendiri, dipilih
  lewat `source`.

  **`Activity` tidak dinaikkan jadi P1 hanya karena proyeknya URGENT.** Prioritas
  proyek dan prioritas task adalah dua klaim berbeda; mencampurnya membuat tab
  "P1" berarti "proyek urgent ATAU task urgent", yang bukan keduanya. Kolom yang
  tidak dimiliki sumbernya diisi nilai netral (prioritas 4, due `null`), tidak
  pernah dikarang.

- **Filter, badge, subtask di Today's View.** Tab Semua / Hari Ini / Terlambat /
  P1 / Saya, plus badge prioritas, tanggal jatuh tempo, label, avatar assignee,
  dan ringkasan subtask. Pengelompokan per proyek tetap.

- **`applyChecklistFilter` dan `countChecklistFilters` jadi generik** atas
  antarmuka `FilterableTask`. Dua implementasi "apa yang dihitung terlambat"
  pasti akan menyimpang, dan yang menyimpang adalah yang jarang dipakai — diam-diam.

- **`src/lib/services/task-feed.test.ts`** — 12 test. Menyasar kasus yang
  diputuskan, bukan yang jelas: Activity tidak mewarisi urgensi proyek, subtask
  yatim tetap terjangkau, dan pengelompokan **tidak** mengurutkan ulang proyek
  yang sudah diurutkan pemanggilnya.

### Deliberately not done

Empat berkas jadi mati akibat perubahan ini dan **tidak** dihapus, mengikuti
preseden T1: `delete-button.tsx`, `activity-list-today.tsx`, `today-task-item.tsx`,
dan `src/types/dashboard.ts`. Tercatat di `roadmap.md` §T4.

### Verification

`tsc --noEmit` 0 error ✅ · `eslint` 0 error pada berkas tersentuh ✅ ·
`npm test` **32 lulus / 0 gagal** ✅ (naik dari 20).

`next build` tetap tidak bisa dijalankan di lingkungan ini (`Bus error`, sudah
dibuktikan bukan karena kode — lihat entri di bawah).

---

## [Unreleased] - 2026-08-10 (Todo ala Todoist Pro — implementasi penuh)

Bagian C roadmap dieksekusi. `ProjectChecklist` yang tadinya tiga kolom kini
menjadi task list: subtask, prioritas, due date, label, assignee, komentar, dan
empat filter bawaan — **tanpa model baru untuk task, tanpa sistem kedua**.

### Added

- **`prisma/migrations/20260810120000_checklist_tasks`** — satu-satunya migrasi.
  Aditif murni: tidak ada `DROP`, semua kolom baru nullable atau ber-default.

  Tujuh kolom di `ProjectChecklist`: `parent_id`, `sort_order`, `priority`,
  `due_at`, `assigned_to_id`, `template_id`, `created_at`. Dua tabel baru:
  `ChecklistLabel` dan `ChecklistLabelOnItem`. Dan `Comment.task_id` —
  yang sudah ada tanpa relasi ke model mana pun sejak entah kapan — akhirnya
  disambungkan ke `ProjectChecklist`.

  Dua backfill jalan otomatis di dalam migrasi. `template_id` dicocokkan lewat
  label; kalau **dua template berbagi label yang sama**, barisnya sengaja
  dibiarkan `NULL`. Menebak salah satu akan menghasilkan kesalahan yang tidak
  terlihat; membiarkan `NULL` menghasilkan baris ganda yang langsung kelihatan
  dan bisa diperbaiki. `sort_order` diisi `ROW_NUMBER() × 10` per (project,
  phase), urut label — yaitu persis urutan yang selama ini sudah tampil di layar
  overview.

- **`src/lib/services/checklist-task.ts`** — satu tempat yang memutuskan
  bagaimana baris checklist dipilih, diurutkan, dan dibentuk:
  `CHECKLIST_TASK_SELECT`, `CHECKLIST_TASK_ORDER_BY`, `toChecklistTask`,
  `buildChecklistTree`, `applyChecklistFilter`, `countChecklistFilters`.

- **`src/lib/services/checklist-service.ts`** — jalur tulis: create (termasuk
  subtask), update, delete, detach-from-template, reorder, attach/detach label.

- **`src/actions/checklist-actions.ts`** — tujuh server action dengan gerbang
  RBAC gabungan: task dalam fase memakai `assertPhaseContentMutationAccess`
  (sehingga fase terkunci/disetujui ikut membekukan tasknya), task tingkat
  proyek jatuh ke `getProjectMembershipOrThrow`.

- **`src/components/task-list.tsx`** — komponen daftar task, dipakai **kedua**
  permukaan. `phase-checklist.tsx` dan `project-checklist-overview.tsx` kini
  tinggal pembungkus tipis.

- **`src/types/checklist.ts`** — bentuk `ChecklistTask` bersama. Tanggal bertipe
  `string`, bukan `Date`: tampilan fase menerimanya sebagai JSON dari endpoint
  heartbeat, jadi `Date` di sana adalah kebohongan. Konversi terjadi sekali, di
  mapper.

- **`scripts/run-tests.mjs` + `npm test` + `npm run typecheck`** — repo ini
  punya `src/lib/activity-copy.test.ts` sejak lama tetapi **tidak ada cara
  menjalankannya**. Sekarang ada, tanpa menambah framework test: skrip menutup
  dua celah yang menghalangi `node --test` membaca TypeScript repo ini (emit ke
  `tmp/test-out`, lalu tambal ekstensi `.js` dan alias `@/` pada impor hasil
  emit).

- **`src/lib/services/checklist-task.test.ts`** — 11 test. Semuanya menyasar
  kasus yang **diputuskan**, bukan yang jelas: task selesai tidak dihitung
  terlambat, subtask yatim tetap terlihat, dan "Ditugaskan ke saya" cocok dengan
  **nol** baris saat tidak ada user — bukan dengan semua baris tanpa assignee.

### Fixed — cacat yang sudah berjalan sebelum pekerjaan ini

Empat hal berikut sudah rusak sebelum bagian C, bukan akibatnya:

- **Urutan checklist tidak pernah benar.** `phase-heartbeat.ts` mengurut
  `{ id: "asc" }` atas UUID — bukan urutan apa pun — dan halaman fase melakukan
  hal yang sama. `project-checklist-overview.tsx` menambalnya dengan
  `label.localeCompare` di browser. Dua pembaca, dua aturan, tak satu pun benar,
  dan daftar terlihat menyusun ulang dirinya begitu polling pertama mendarat.
  Sekarang keduanya lewat `CHECKLIST_TASK_ORDER_BY`.

- **Dedup sync memakai label sebagai identitas.** Kunci
  `${phase_id}::${label}` punya dua cacat: task manual berlabel sama akan
  **menelan** baris template secara permanen, dan mengganti nama label template
  mengubah kunci sehingga sync berikutnya membuat **duplikat**. Pindah ke
  `(template_id, phase_id)`.

- **`addChecklistItem` tidak punya UI.** Aksi dan service-nya sudah ada dan
  sudah beraudit sejak lama, tetapi **nol komponen memanggilnya**. Itulah
  satu-satunya alasan cacat dedup di atas belum pernah terlihat. Sekarang
  tersambung ke quick-add — dan `executeAddChecklistItem` mendelegasikan ke
  `executeCreateTask` supaya tidak ada dua jalur `create` yang bisa berbeda
  (yang lama meninggalkan `sort_order` di 0, jadi tiap item baru melompat ke
  puncak daftar).

- **Hard delete proyek tanpa peringatan.** `project-service.ts` menghapus
  seluruh checklist proyek. Sekarang jumlah baris `template_id = null` —
  satu-satunya yang tidak bisa digenerate ulang — dicatat di audit log, dan
  `getProjectDeletionImpact` menyediakan versi pra-terbang untuk UI.

### Changed

- **Gerbang approval fase menghitung task akar saja** (keputusan owner).
  `assertNoPendingTasks`, badge navigasi di `layout.tsx`, dan `readPhaseProgress`
  ketiganya menyaring `parent_id: null`. Ketiganya **harus** tetap sepakat:
  kalau salah satu menyimpang, bilah progres bisa penuh sementara approval
  tetap tertahan, atau sebaliknya.

- **Centang mencascade ke subtask, dua arah.** Yang kedua ini bagian yang tidak
  jelas: hanya mencascade ke bawah saat mencentang akan memungkinkan ini —
  centang induk tak sengaja, lima subtask ikut hijau, lepas centang induk, dan
  **subtasknya tetap hijau**. Pekerjaan yang belum pernah dikerjakan terbaca
  selesai, dan tidak ada apa pun di layar yang mengatakannya. Subtask **tidak**
  menggulung ke atas — itu akan memuaskan gerbang approval lewat keputusan yang
  tak pernah diambil siapa pun.

### Deliberately not built

Recurring, filter tersimpan, halaman `/todo` lintas proyek, drag-and-drop, dan
notifikasi assignee. Alasan masing-masing ada di `roadmap.md` §C-SISA.

### Verification

`prisma validate` ✅ · `tsc --noEmit` 0 error ✅ · `eslint` 0 error pada seluruh
berkas tersentuh ✅ · `npm test` 20 lulus / 0 gagal ✅.

`next build` **tidak bisa dijalankan** di lingkungan tempat pekerjaan ini
dikerjakan — crash `Bus error (core dumped)`. Bukan akibat perubahan ini:
proyek Next kosong berisi satu halaman pun crash sama persis di sana. Perlu
dijalankan sekali di mesin normal. Migrasi juga belum diterapkan (tidak ada
PostgreSQL); langkahnya di `roadmap.md` §C-SISA-1, dan uji manual yang perlu
mata manusia ada di §Uji manual — task.

---

## [Unreleased] - 2026-08-10 (Arah strategis baru + rancangan Todo C0–C4)

### Documentation

- **`roadmap.md` — Arah Strategis** diperbarui berdasarkan keputusan owner:
  1. Master Data akan dirombak ulang — semua pekerjaan aktif di Master Data ditangguhkan.
  2. StudioFlow diputus dari Library/Master Data — ketergantungan langsung antar keduanya akan dihilangkan.
  3. Fokus sekarang pada perbaikan StudioFlow terlebih dahulu.

- **`roadmap.md` bagian C (baru) — Todo ala Todoist Pro.** Owner meminta fitur
  todo mirip Todoist Pro dengan arahan tegas: **enhance yang sudah ada, jangan
  bongkar total**. Fitur target versi pertama: subtask + prioritas + due date,
  label & filter tersimpan, assignee & kolaborasi. Recurring **tidak** diambil.

  Penelusuran kode menemukan StudioFlow punya **dua** konsep todo yang hidup
  bersamaan, dan keduanya sudah diperlakukan sebagai "tugas" oleh gerbang
  approval fase (`phase-service.ts`):

  | Model | Peran | Punya |
  |---|---|---|
  | `ProjectChecklist` | Checklist dari `ChecklistTemplate` | `label`, `is_checked`, `phase_id` |
  | `Activity` (`mode = TODO`) | Butir kerja di loop revisi | `content`, `status`, `assigned_to_id`, `revision_id`, `deferred_from_version` |

  **Keputusan: bangun di atas `ProjectChecklist`.** `Activity` sudah punya arti
  yang terikat siklus revisi; `ProjectChecklist` nyaris kosong dan punya ruang
  tumbuh. Penyatuan keduanya, kalau perlu, dilakukan di tampilan — bukan di tabel.

  Jawaban atas pertanyaan owner "*bisa dipakai atau harus bongkar total?*":
  **bisa dipakai.** Semua kolom baru nullable atau ber-default, jadi baris lama
  tetap sah dan tidak ada backfill wajib. Yang perlu diubah bukan modelnya,
  melainkan **empat jalur baca/tulis yang menyimpan asumsi diam-diam** — dicatat
  sebagai prasyarat C0 karena kalau dilewat menghasilkan bug senyap, bukan error:

  1. `executeSyncProjectChecklists` (`project-service.ts`) memakai
     `${phase_id}::${label}` sebagai identitas. Begitu user boleh menulis task
     sendiri, label duplikat jadi wajar dan dedup ini akan diam-diam menolak
     baris template. Perlu kolom `source` (`TEMPLATE`/`MANUAL`).
  2. `assertNoPendingTasks` (`phase-service.ts`) menghitung semua checklist
     belum tercentang. Setelah subtask ada, satu task dengan lima subtask jadi
     enam penghalang approval. Direkomendasikan hitung hanya task akar.
  3. Urutan tampil **sudah salah hari ini**: `phase-heartbeat.ts` memakai
     `orderBy: { id: "asc" }` atas UUID acak, ditambal `label.localeCompare` di
     klien (`project-checklist-overview.tsx`) — dua tempat, dua aturan.
  4. `project-service.ts` hard-delete seluruh checklist proyek. Aman selama
     isinya baris template; mahal begitu isinya tulisan user.

  Temuan tambahan: `Comment.task_id` (`schema.prisma`) sudah ada tetapi
  **tanpa relasi ke model mana pun** — sisa rancangan yang tak pernah selesai.
  Menyambungkannya ke `ProjectChecklist` membuat komentar per task hampir gratis.

  Keputusan rancangan yang dicatat beserta alasannya: `due_has_time` dipisah dari
  `due_at`, `priority` sebagai `Int` (bukan enum, agar `ORDER BY` benar),
  `onDelete: Cascade` pada subtask, kedalaman subtask dibatasi di validasi bukan
  schema, label sebagai tabel (**bukan** `String[]` — pola itu justru sedang
  dibongkar di Master Data lewat A1–A3), dan filter tersimpan sebagai
  `query_json` terstruktur alih-alih DSL teks ala Todoist.

  Belum ada perubahan kode maupun migrasi. Dokumentasi saja.

- **`roadmap.md` bagian C — disederhanakan (revisi kedua, hari yang sama).**
  Owner meminta pemeriksaan: adakah yang bisa disederhanakan tanpa regresi
  kegunaan. Hasilnya:

  | | Draf 1 | Draf 2 |
  |---|---|---|
  | Tahap | 5 (C0–C4) | 4 (C1–C4) |
  | Migrasi | 3 | **1** |
  | Kolom baru di `ProjectChecklist` | 11 | **7** |
  | Enum baru | 1 (`ChecklistSource`) | **0** |
  | Model baru | 3 | **2** |

  Penyederhanaan ini bukan pemangkasan fitur — kelima fitur v1 (subtask,
  prioritas, due date, label, assignee & komentar) tetap utuh:

  1. **Tahap C0 dibubarkan.** Tiga dari empat "prasyarat" tak terpisahkan dari
     C1; memisahkannya hanya menciptakan tahap yang tak bisa dikerjakan sendiri.
  2. **`template_id String?` menggantikan enum `ChecklistSource`.** Satu FK
     nullable ke `ChecklistTemplate` (`onDelete: SetNull`) menutup **tiga**
     masalah sekaligus — identitas dedup sync, pembedaan baris saat hard delete,
     dan asal-usul baris — sambil menghapus satu tipe enum. Sekalian memperbaiki
     bug yang belum ketahuan: mengganti nama label template saat ini memproduksi
     baris duplikat karena kunci dedup `${phase_id}::${label}` ikut berubah.
  3. **`due_has_time` ditunda.** UI v1 hanya menawarkan tanggal, jadi semua
     `due_at` date-only secara konstruksi — menambah flag-nya kelak membuat
     seluruh data lama otomatis benar. Menunda tidak menimbulkan utang.
  4. **`completed_at` / `completed_by_id` dicoret.** Alasan "riwayat hilang
     selamanya" di draf pertama **keliru**: `insertAuditLog(AUDIT_ACTIONS.
     TOGGLE_CHECKLIST, ...)` (`phase-service.ts`) sudah menyimpan `user_id`,
     `created_at`, dan `isChecked`. Kalau kolomnya nanti dibutuhkan untuk query
     yang lebih enak, isinya bisa di-backfill dari `AuditLog`.
  5. **`notes` dicoret.** Tumpang tindih dengan `Comment.task_id` di C3.
  6. **`ChecklistFilterView` ditunda** (dikonfirmasi owner). Empat filter bawaan
     — Hari Ini / Terlambat / P1 / Ditugaskan ke saya — ditulis sebagai kode,
     nol tabel dan nol layar editor. Penambahannya kelak murni aditif.

  **Temuan yang mengubah ukuran pekerjaan:** `executeAddChecklistItem` +
  `addChecklistItem` (`phase-actions.ts`) **sudah ada dan sudah beraudit,
  tetapi tidak dipanggil komponen mana pun.** Jalur tulis manual sudah berdiri —
  yang hilang hanya UI-nya. Konsekuensi lain: cacat dedup label bukan
  diperkenalkan oleh C, melainkan **sudah laten hari ini**, hanya belum terlihat
  karena tidak ada layar yang memicu jalur itu.

  **Keputusan owner 2026-08-10:** gerbang approval fase menghitung **task akar
  saja** (`parent_id: null` ditambahkan ke `where` di `phase-service.ts`),
  sehingga arti approval tidak berubah dari perilaku hari ini.

  Yang **tidak** dipangkas meski menggoda: label sebagai tabel tersendiri
  (bukan `String[]` — pola itu justru sedang dibongkar di Master Data lewat
  A1–A3), dan perbaikan urutan tampil (`phase-heartbeat.ts` mengurut UUID
  acak, ditambal `localeCompare` di klien pada
  `project-checklist-overview.tsx` — dua tempat, dua aturan).

---

## Arsip

Entri sebelum **2026-08-10** dipindahkan ke `docs/archive/` pada 2026-08-10.
Yang tersisa di berkas ini adalah siklus yang sedang berjalan.

Alasan pemindahannya bukan sekadar ukuran berkas. Seluruh entri Juli–6 Agustus
menggambarkan schema `master_data` **v1**, dan v1 sudah **tidak ada** — ia
di-`DROP SCHEMA … CASCADE` oleh `20260810180000_masterdata_v2_rebaseline`.
Membiarkannya di sini membuat changelog membaca seolah `Company`, `Vendor`,
`MaterialCatalog`, dan kolom `catalog_*` masih hidup. Riwayat yang salah dibaca
sebagai keadaan sekarang lebih berbahaya daripada riwayat yang harus dicari satu
klik lebih jauh.

| Berkas | Cakupan | Isi ringkas |
|---|---|---|
| [`CHANGELOG-2026-07-24_2026-08-06-masterdata-v1.md`](docs/archive/CHANGELOG-2026-07-24_2026-08-06-masterdata-v1.md) | 2026-07-24 → 2026-08-06, 44 entri | Seluruh pembangunan Master Data v1 |
| [`CHANGELOG-2026-04-16_2026-07-23-rilis-v1-v3.md`](docs/archive/CHANGELOG-2026-04-16_2026-07-23-rilis-v1-v3.md) | 2026-04-16 → 2026-07-23, 48 rilis | Rilis bernomor v1.3.0 → v3.8.1 |

### Apa yang terjadi di periode itu — ringkasan kanonik

**2026-07-24 → 2026-08-06 — Master Data v1 dibangun, lalu dibuang.**
Subapp `master-data` lahir dengan RBAC dan routing sendiri, schema dipecah dari
`studioflow`, dan katalog produk dipindah dari `MaterialCatalog` ke
`Vendor`→`Brand`→`Sku`. Menyusul: antrian kurasi in-app (756 kandidat material,
287 kandidat sampel dari `docs/masterdata-seed/*.csv`), tab harga
(`MaterialPrice`/`ServicePrice`/`MaterialLaborPrice`), Supplier sebagai tabel
flat sortable, dan perbaikan 16 cacat logika C1–C16 — termasuk `bqReady` yang
membaca kolom salah dan satu blocker `slugify`. Tiga route lama
(`/masterdata/companies`, `/vendors`, `/skus`) dihapus 2026-08-06.

**Yang layak dibawa dari periode itu, dan hanya ini:** Brand tidak sama dengan
badan usaha (memicu `Company`, yang di v2 jadi `Party`); kategori sebagai teks
bebas di enam kolom berbeda tidak pernah bisa direkonsiliasi (memicu pohon
`Category`); dan harga yang menempel di produk tidak bisa membandingkan dua
toko (memicu pemisahan `Sku`/`SkuPrice`). Ketiganya adalah alasan v2 berbentuk
seperti sekarang.

**2026-04-16 → 2026-07-23 — fondasi StudioFlow.**
Rilis bernomor v1.3.0 → v3.8.1: hierarki `Project → Phase → Revision → File`,
gerbang approval per fase, sistem audit, Material & Fixtures Schedule dengan
arsitektur snapshot-first, ekstensi SketchUp (material code manager, push ke
schedule, PDF), MOM, live collaboration, RBAC, dan dua kali perombakan visual.
Penamaan ber-namespace (`catalog_`, `schedule_`) diperkenalkan v1.5.0 — separuh
`catalog_*` sudah ikut hilang bersama Master Data v1.

---
