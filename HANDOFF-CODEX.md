# Handoff ke Codex — StudioFlow (siklus 2026-08-19)

**Ditulis 2026-08-19 oleh Claude, atas permintaan owner.** Menggantikan
`HANDOFF-CODEX.md` versi 2026-08-18 sebagai dokumen aktif — versi itu sudah
menutup siklusnya sendiri (build produksi #44) dan dipindah verbatim ke
[`docs/archive/HANDOFF-CODEX-2026-08-18.md`](docs/archive/HANDOFF-CODEX-2026-08-18.md).
Baca berkas ini lebih dulu, sebelum `roadmap.md`.

Urutan dokumen yang mengikat tidak berubah: `prisma/schema.prisma` →
`AGENTS.md` → `CHANGELOG.md` → `roadmap.md` → berkas ini. Kalau dua dokumen
bertentangan, **kode yang berjalan menang** — perbaiki dokumennya, jangan
diam-diam ubah kodenya supaya cocok.

---

## 0a. Graphify — knowledge graph codebase (tersedia sejak 2026-08-19)

`graphify-out/graph.json` sudah ada dan siap dipakai. Sebelum menjawab
pertanyaan arsitektur atau mencari relasi antar file, jalankan (sintaks CLI
mentah, dari `graphify --help` — bukan sintaks slash-command in-assistant):

```bash
graphify query "<pertanyaan>" --budget 2000   # BFS, output di-cap token (default 2000)
graphify path "ModulA" "ModulB"               # jalur terpendek antara dua konsep
graphify explain "NamaNode"                   # penjelasan plain-language satu node
graphify affected "X"                         # reverse: siapa saja yang kepengaruh kalau X berubah
graphify god-nodes --top 10                   # hub arsitektur paling terhubung
```

(Koreksi 2026-08-19: `graphify query` sempat salah dihapus dari versi
sebelumnya berkas ini karena tidak kelihatan di scroll pertama `--help` —
sudah dicek ulang penuh, perintah ini valid dan ada `--budget` buat kontrol
biaya token per query.)

Rebuild otomatis terjadi setiap `git commit` (post-commit hook sudah terpasang
di `.git/hooks/`). Untuk rebuild manual karena ada file baru tanpa commit:

```bash
graphify update .          # re-extract + update graph, tanpa LLM
graphify cluster-only .    # rerun clustering + regenerate GRAPH_REPORT.md
```

**Codex belum terintegrasi otomatis** — `graphify install` yang dijalankan
2026-08-19 hanya memasang untuk Claude Code. Jalankan sekali di terminal lokal
untuk menulis section graphify ke `AGENTS.md` khusus Codex:

```bash
graphify codex install
```

---

## 0. Peta 3 app — dipakai untuk mengorganisir seluruh berkas ini

Owner minta pekerjaan dirapikan per app, bukan per nomor roadmap acak. Tiga
app di repo ini (dan lokasinya):

| App | Root kode | Skema Prisma |
|---|---|---|
| **1. Main app (StudioFlow)** | `src/app/**` (di luar `/masterdata`), `src/actions/`, `src/components/`, `src/core/`, `src/extensions/**` (task, checklist, schedule, sketchup, mom, live-collaboration, **library**), `src/ui_engine/` | schema `studioflow` |
| **2. Master Data** | `src/subapps/master-data/**`, `src/app/masterdata/**`, `src/app/api/masterdata/**` | schema `master_data` |
| **3. BQ** | `src/subapps/bq/**` | schema belum ada |

`src/subapps/bq/` hari ini **hanya berisi lima `.gitkeep`** — belum ada kode,
belum ada model Prisma, belum ada satu pun item roadmap. **Tidak ada tugas BQ
di handoff ini.** Ini dicatat semata supaya strukturnya sudah dikenal saat
owner mulai membangunnya sesudah batch ini.

`src/extensions/library/` (Brand-First Library, halaman `/library`) secara
kode ada di bawah Main App, tapi **membaca data Master Data lewat kontrak
read-only** (§2 di bawah) — bukan berarti dia bagian dari app Master Data.

---

## 1. Keadaan repo — baca sebelum menyentuh git

**55 berkas berstatus uncommitted** (`git status --short`, per 2026-08-19) —
pekerjaan #35–#44 plus berkas dokumen yang Claude sentuh (`.gitignore`,
`CHANGELOG.md`, `roadmap.md`, `HANDOFF-CODEX.md`, arsip). Commit terakhir
`d53d712` (#34); HEAD 18 commit di depan `origin/main`.

**Repo ini sengaja belum terhubung ke GitHub** (keputusan owner) — bukan lupa
push, bukan blocker. Semua koordinasi Claude↔Codex jalan murni lewat
filesystem lokal (`AGENTS.md`, `HANDOFF-CODEX.md`, `roadmap.md`,
`CHANGELOG.md`, `graphify-out/`) — nol ketergantungan ke remote/CI apa pun.
`git commit` **tetap penting** meski tanpa remote: itu yang men-trigger hook
`post-commit` Graphify (§0a) dan jadi titik aman rollback lokal. Commit dengan
berkas yang Anda sentuh saja per task — jangan biarkan berkas baru menumpuk
untracked.

Commit dengan berkas yang Anda sentuh saja per task — jangan biarkan berkas
baru menumpuk untracked (persis penyebab masalah di atas dulu terjadi).

---

## 2. Kontrak yang tidak boleh dilanggar tanpa izin eksplisit owner

### 2.1 · Batas Master Data ↔ StudioFlow (`AGENTS.md` §8)

> `master_data` **tidak boleh bergantung** pada `studioflow`: tidak ada FK,
> tidak ada join di view. Membaca daftar proyek untuk dropdown boleh — yang
> disimpan adalah snapshot id + nama.

Arahnya **boleh terbalik**: StudioFlow (termasuk Library) boleh membaca
Master Data, tapi lewat permukaan yang sudah discope, bukan join bebas. Untuk
Library, permukaannya adalah `master_data.v_library_brand`
(`prisma/migrations/20260810180000_masterdata_v2_rebaseline/migration.sql`)
plus query langsung ke tabel `master_data` dari
`src/extensions/library/services/brand-library-service.ts` (Prisma tidak bisa
`select` dari view tanpa model — servicenya sengaja query tabel dasar, tetap
di dalam scope view yang sama: nama/slug, categories, link ber-allowlist,
ketersediaan sample fisik. **Tidak ada harga, tidak ada kontak, tidak ada
identitas supplier** — itu keputusan owner 1 Agu 2026, bukan lubang yang perlu
ditutup).

**Kalau task apa pun di handoff ini kelihatannya butuh FK baru dari
`master_data` ke `studioflow` (atau sebaliknya) untuk "menyambungkan" data —
itu tanda Anda salah jalan. Berhenti, tulis temuannya, tanya owner.**

### 2.2 · Jangan ubah skema Master Data tanpa izin

Aturan owner yang masih berlaku penuh (dari `roadmap.md`): **jangan mengubah
skema Master Data; kalau memang perlu, tanya dulu.** Task C-SISA-5 di bawah
ini **satu-satunya** perubahan skema yang sudah disetujui di batch ini, dan
itu pun di sisi StudioFlow (`checklist`), bukan Master Data.

### 2.3 · Keputusan yang sudah dibayar mahal — jangan dimundurkan

Tabel penuh (alasan tiap baris) ada di
[`docs/archive/HANDOFF-CODEX-2026-08-18.md`](docs/archive/HANDOFF-CODEX-2026-08-18.md)
§3/§4. Ringkasannya, yang **paling relevan untuk batch ini**:

| Aturan | Kenapa relevan di sini |
|---|---|
| `BrandCategory` punya kolom `source`: `SEED` (dipilih manual di form Brand) vs `DERIVED_FROM_SKU` (otomatis dari tag SKU). `upsertBrandCategories` boleh menghapus baris `DERIVED_FROM_SKU` basi. **Jangan pernah** ikut menghapus baris `source: SEED`. | Task LA-1 (Brand↔Library) menyentuh persis tabel ini. |
| `Party.name` / `Brand.name` / `Brand.slug` **bukan** `@unique` — keunikan dijaga index parsial. `findUnique({ where: { name } })` **tidak sah**, pakai `findFirst` + `deleted_at: null`. | Berlaku di semua task Master Data batch ini. |
| Setiap lookup `Category` **wajib** memfilter `kind` (`PRODUCT` vs `WORK` — "Finishing" ada di keduanya). | Relevan untuk BR2 (search diperluas ke kategori) dan LA-1. |
| Setiap tulis ke `master_data` lewat `recordAudit(tx, …)` **tepat satu kali**. | Berlaku untuk BR2/BR4/BR5/BR7 kalau ada mutasi baru. |
| `createAction` sudah membuka transaksi sebagai `tx` — pakai itu, jangan `prisma` global atau `$transaction` bersarang. | Berlaku semua task yang menulis. |
| Dilarang `window.location.reload()` — pakai `router.refresh()`. Dilarang nilai visual hardcoded — cek `ui_engine/design-system.config.ts` / `styles/designTokens.css` dulu. Teks yang dibaca pengguna: **Bahasa Inggris**. | Berlaku semua task UI. |

---

## 3. Batch dikerjakan sekarang

**Status 2026-08-19:** LA-1, C-SISA-5, seluruh MASTER DATA (termasuk §3a dan
§3b BR9–BR12), C-SISA-3, dan T3 di bawah ini semuanya `SELESAI`. Tidak ada
batch implementasi aktif yang bebas keputusan owner.

**SK1–SK5 (audit skema 2026-08-19) — DIKLAIM CLAUDE, JANGAN DISENTUH CODEX.**
Owner sudah putuskan kelima item di `roadmap.md` § "MASTER DATA — Audit skema
2026-08-19" langsung ke Claude, bukan lewat handoff ini — termasuk perubahan
`prisma/schema.prisma` dan dua migrasi baru
(`20260819140000_workprice_unused_columns_comment`,
`20260819150000_category_kind_slug_live_uniq`). Codex TIDAK PERLU dan TIDAK
BOLEH mengerjakan ulang SK1–SK5 — kalau roadmap masih menunjukkannya belum
`[x]` saat Codex membaca ini, itu berarti Claude belum selesai menulis
laporannya kembali ke `roadmap.md`/`changelog.md`, BUKAN slot kosong yang
bebas diambil. Cek `changelog.md` entri "Eksekusi SK1–SK5..." (kalau sudah
ada) untuk status sebenarnya sebelum menganggap ini terbuka.

**Urutan prioritas (batch lama, sudah tuntas):** LA-1 (bug aktif, dilaporkan
owner) → C-SISA-5 → sisanya bebas urutan per app, satu item selesai penuh
(kode + `roadmap.md` dicentang + entri `CHANGELOG.md`) sebelum pindah ke item
berikutnya.

### LINTAS APP

#### LA-1 · Brand↔Library rusak setelah split Category/Hashtag (#37) — **investigasi dulu, jangan asumsi**

**Laporan owner:** koneksi Brand (Master Data) ↔ Library (StudioFlow,
`/library`) rusak setelah perubahan skema Hashtag + pemisahan Category pada
#37 (`CHANGELOG.md`, 2026-08-19, "BR1 inline edit tabel Brands").

**Owner TIDAK memberi gejala persis (pesan error, halaman mana, langkah
reproduksi).** Jangan menebak dan langsung menambal — ikuti urutan ini:

1. **Reproduksi dulu.** Buka `/library`, coba `BrandLibraryExplorer` (cari
   brand by kategori/nama), lalu `/masterdata/materials` → edit Category/
   Hashtag sebuah Brand inline (fitur BR1 dari #37) → cek lagi `/library`.
   Catat persis apa yang salah (data hilang, error runtime, TypeScript gagal
   build, kategori dobel, dll).
2. **Bandingkan terhadap kontrak §2.1 di atas** — service
   `brand-library-service.ts` query `brand.categories` (relasi `BrandCategory`)
   tanpa memfilter `source`, jadi otomatis mencampur baris `SEED` (dari form
   Brand) dan `DERIVED_FROM_SKU` (otomatis dari SKU). Ini **kandidat kuat**
   penyebabnya kalau gejalanya "kategori yang tidak relevan muncul di
   pencarian Library" — tapi **verifikasi dulu**, jangan diasumsikan benar.
3. **Cek `v_library_brand`**
   (`prisma/migrations/20260810180000_masterdata_v2_rebaseline/migration.sql`,
   baris ~838) — view ini sudah didesain untuk banyak-kategori sejak awal
   (`array_agg` dari `BrandCategory`), jadi kemungkinan besar **bukan** akar
   masalahnya, tapi cek tetap untuk memastikan skema kolom yang dipakai masih
   sinkron dengan `model Brand`/`model BrandCategory` saat ini
   (`prisma/schema.prisma` baris ~350).
4. **`npm run typecheck` + `npm run build` sudah lulus di #44** (sesudah #37
   di-merge secara kronologis) — jadi ini kemungkinan besar **bukan** error
   compile-time, melainkan bug data/runtime/UX. Verifikasi ini juga, jangan
   diasumsikan.
5. Baru setelah akar masalah dikonfirmasi (sebutkan file:baris buktinya) —
   **perbaiki di dalam kontrak §2.1** (tidak ada FK baru ke `studioflow`,
   tidak menghapus baris `BrandCategory` bersumber `SEED`).

**Berkas yang relevan (titik awal, bukan daftar lengkap):**
`src/extensions/library/services/brand-library-service.ts`,
`src/extensions/library/components/BrandLibraryExplorer.tsx`,
`src/extensions/library/services/library-service.ts` (fungsi
`upsertBrandCategories` / `syncSeedBrandCategories`, sekitar baris 140–230),
`prisma/schema.prisma` (`model Brand`, `model BrandCategory`).

**Kalau ternyata butuh info tambahan dari owner** (mis. screenshot gejala,
brand mana yang dicoba) — tulis pertanyaannya di `roadmap.md`/`changelog.md`
sebagai item ⏳, jangan tebak.

---

### MASTER DATA

Sembilan item, semuanya **P1/P2 di roadmap** (bukan P0 — P0 sudah beres:
BR1/BR3/BR6/BR8/H5/§10/M5 semua `SELESAI`). Tidak ada satu pun yang menyentuh
skema.

| Item | Spek | Berkas |
|---|---|---|
| **BR2 · Search Brands diperluas (P2) — SELESAI #48** | Search paginated mencocokkan Brand/owner, Category `PRODUCT`, Hashtag substring, supplier hidup, dan SKU hidup; hasil tetap satu row per Brand. | `material-view-service.ts`, `MasterDataMaterialsClient.tsx` |
| **BR4 · Detail brand → modal (P1) — SELESAI #47** | Angka SKU/Supplier dan menu View kini membuka tab terkait dalam dialog tanpa navigasi halaman. Kolom Complete diganti warna kuning semantik untuk baris belum lengkap; route lama dipertahankan sebagai deep-link. BR7 dapat meniru pola ini. | `BrandDetailClient.tsx`, `MasterDataMaterialsClient.tsx` |
| **BR5 · Kolom Katalog & Links (P2) — SELESAI #49** | Seluruh `BrandLink` tampil di tabel dan tombol edit membuka editor repeatable dengan unsaved guard; mutasi link diaudit per row. | `MasterDataMaterialsClient.tsx`, `brand-links-editor.tsx`, `library-service.ts` |
| **BR7 · Pola BR4 diterapkan ke Supplier (P2) — SELESAI #50** | Detail Party dibuka pada modal, SKU Brand-assignment punya popup paginated, Party tanpa Role ditandai kuning, dan menu ⋯ BR6 dipertahankan. Count Brands kini membaca `BrandSupplier`, sama dengan detail. | `SupplierDetailClient.tsx`, `SupplierClient.tsx`, `party-actions.ts` |
| **§20 · Tab Prices di Supplier detail — SELESAI #53** | Stub diganti tabel read-only harga berlaku khusus Party, dengan search SKU/Brand/item, pagination, unit/currency/tanggal, dan link manajemen penuh. Server melakukan scope `supplier_party_id`; tab disembunyikan bila role tidak punya `MASTERDATA_PRICE_VIEW`. | `SupplierDetailClient.tsx`, `SupplierClient.tsx`, route Suppliers, `pricing-actions.ts` |
| **M3/§8 · Halaman harga memuat semuanya — SELESAI #52** | Data aktif saat dicek hanya 1 row, tetapi action tetap dibatasi 50 row per halaman. Search server-side mencakup Brand, supplier/legal name, nama/kode SKU; total global dan total hasil dipisah agar badge tab tidak berubah saat search. Saran unit memakai query distinct terpisah. | `pricing-actions.ts`, `PricingClient.tsx`, route Prices, `types/pricing.ts`, token tabel |
| **UI-CON-2 · CTA tab Services — SELESAI #51 (verifikasi)** | `+ Tambah Vendor` ternyata hanya ada di `SupplierJasaTab` mati yang dihapus #40. CTA hidup `Add supplier / vendor` sudah berada di `PageHeader`; tidak ada tab/CTA kedua untuk dipindah. | `SupplierClient.tsx`, riwayat Git |
| **UI-CON-4 · Stats summary konsisten — SELESAI #54** | Pola inline subtitle dipakai pada kedua direktori sesuai rekomendasi. Strip `StatChip` Materials dihapus; subtitle Brand/SKU dan Supplier memuat total global yang relevan. | `MasterDataMaterialsClient.tsx`, `SupplierClient.tsx` |
| **Test `getBrandView`/`getSkusForBrand` — SELESAI #59 (Opsi A)** | PostgreSQL `db-test` disposable memakai tmpfs/port loopback terpisah, seluruh migrasi nyata, URL fail-closed, dan cleanup container walau gagal. Empat test DB menutup search/count/sort/pagination serta relasi/truncation SKU. `npm test` tetap murni; `npm run test:all` menambah suite DB. | `docker-compose.yml`, `scripts/run-integration-tests.mjs`, `tests/integration/`, `docs/INTEGRATION-TESTING.md` |

**Bukan tugas Codex (informasi saja):** §19 sudah selesai dari sisi kode (tiga
blok mati dihapus #40); yang tersisa cuma penghapusan folder `_to_delete/`
oleh **owner** sendiri (sudah dicatat begitu di handoff lama). Jangan
disentuh.

#### 3a. Urutan eksekusi & regression guard — 6 item UI/UX (disiapkan Claude, 2026-08-19)

Disiapkan atas permintaan owner untuk memastikan enam item UI/UX Master Data
(BR2, BR4, BR5, BR7, UI-CON-2, UI-CON-4 — bukan §20/M3/§8, dua itu fitur/perf
bukan UI/UX) bisa dieksekusi **tanpa regresi** terhadap fitur yang sudah
`SELESAI` di berkas yang sama. §20 dan M3/§8 tidak termasuk grouping ini,
kerjakan sesuai urutan bebas seperti biasa.

**Kenapa dikelompokkan per berkas, bukan per prioritas P1/P2 murni:**
`MasterDataMaterialsClient.tsx` dan `SupplierClient.tsx` masing-masing sudah
jadi rumah dari banyak fitur `SELESAI` (BR1, BR3, BR6, BR8, UI-CON-3, D5, dan
untuk Supplier juga H5/§10). Mengerjakan item yang berbeda-beda di berkas yang
sama secara acak/paralel menaikkan risiko satu edit menimpa/merusak edit lain
tanpa disadari sebelum `git commit`.

**Kelompok A — `MasterDataMaterialsClient.tsx` (+ `BrandDetailClient.tsx` untuk BR4):**
1. **BR4 (P1)** dulu — prioritas tertinggi, dan BR7 meniru polanya (lihat
   tabel di atas).
2. **BR2, BR5 (P2)** — aditif dan independen dari BR4, aman dikerjakan sesudahnya.

**Kelompok B — `SupplierClient.tsx` / `SupplierDetailClient.tsx`:**
3. **BR7** — sesudah BR4 selesai (butuh polanya).
4. **UI-CON-2** — independen, aman kapan saja di kelompok ini.

**Terakhir, lintas kedua berkas:**
5. **UI-CON-4** — kerjakan paling akhir dari keenamnya. Pola belum diputuskan
   final (rekomendasi lama roadmap: ikuti Supplier/inline subtitle), dan
   berpotensi bentrok dengan perubahan struktur dari BR4/BR7/BR5 di berkas
   yang sama kalau dikerjakan lebih dulu.

**Regression checklist — jalankan sesudah *setiap* item di atas, sebelum
mencentang `roadmap.md` dan sebelum pindah ke item berikutnya:**
- `npm run typecheck && npm run build` lulus (standar yang sama dipakai di
  #44 dan LA-1 poin 4).
- Verifikasi manual fitur `SELESAI` yang hidup di berkas yang sama masih utuh:
  jalur Edit full details BR11, ringkasan Category/Hashtag, kebab
  menu BR6, popup+riwayat SKU BR8, header Inggris UI-CON-3, `minWidth` token
  D5 — untuk Supplier tambahkan H5 (permission harga tidak terpisah) dan §10
  (edit tidak menurunkan status).
- Tidak ada perubahan skema Prisma — kontrak §2.2, keenam item ini memang
  sudah dikonfirmasi non-skema di tabel atas, jaga agar tetap begitu.
- BR4 bersinggungan domain (Brand) dengan **LA-1** yang masih dalam
  investigasi (lihat §3 LINTAS APP) — bukan berbagi berkas, tapi kalau
  tampilan kategori/link brand di modal BR4 ternyata mewarisi bug sumber data
  yang sama (campur `SEED`/`DERIVED_FROM_SKU` tanpa filter), jangan ditambal
  di BR4; catat sebagai temuan LA-1, bukan dikerjakan dua kali di dua tempat.
  Prioritas urutan §3 (LA-1 duluan) tetap berlaku sebelum mulai BR4.

**Temuan terpisah, di luar cakupan enam item ini:** working tree repo saat
ini punya **~10 commit senilai kerja tersimpan tapi belum di-`git commit`**
(HEAD masih di `d53d712` #34, tanggal 2026-08-18; kerja #35–#44 — TV1/TV2,
BR3, BR6, BR8, H5/§10, M5, D2/D3/D5, PR1/M4/M8, guard Excel — semuanya
utuh di working tree tapi belum ada commit baru). Ini bukan kelalaian Codex
(commit lokal memang keputusan owner/Codex, bukan otomatis), tapi
**disarankan checkpoint commit sebelum mulai batch enam item UI/UX di atas**
— supaya kerja #35–#44 yang sudah selesai punya titik aman rollback terpisah
dari WIP batch baru, dan hook `post-commit` Graphify (lihat §0a) sempat
rebuild graph sebelum tumpukan perubahan bertambah besar lagi.

#### 3b. Batch baru — perbaikan UI/UX dari verifikasi visual owner (disiapkan Claude, 2026-08-19)

Owner mengecek langsung hasil batch BR2–UI-CON-4 (§3a di atas, semuanya
`SELESAI`) lewat screenshot dan menemukan empat hal baru. Detail lengkap ada
di `roadmap.md` § *"MASTER DATA — UI/UX ditemukan owner dari verifikasi visual
(2026-08-19)"* (BR9–BR12). Seluruhnya selesai pada #60–#63.

**Urutan dikerjakan:** BR9 dan BR10 independen, bisa dikerjakan duluan/paralel
konsep (tidak berbagi berkas dengan BR11/BR12). BR11 sebelum BR12 — BR12 butuh
inline edit sudah hilang dari `MasterDataMaterialsClient.tsx` supaya audit
konsistensinya terhadap `SupplierClient.tsx` valid.

| Item | Spek ringkas | Berkas |
|---|---|---|
| **BR9 · SELESAI #60** | `SkuDetailDrawer` memakai size dialog `xl`; browser membuktikan lebar 980px dan kedua tabel tidak lagi terpotong. | `SkuDetailDrawer.tsx` |
| **BR10 · SELESAI #61** | SKU Directory mempunyai menu Actions dan soft-delete berizin dengan konfirmasi aplikasi, audit transaksional, serta retensi seluruh `SkuPrice`. | `SkuDirectoryClient.tsx`, `masterdata-actions.ts`, `sku-delete-service.ts` |
| **BR11 · SELESAI #62** | Inline edit Brand dihapus; edit hanya lewat Edit full details. Category/Hashtag diringkas `X and N others` dengan tooltip lengkap. | `MasterDataMaterialsClient.tsx` |
| **BR12 · SELESAI #63** | Nama/count/kebab, tipografi, alignment Actions, dan warna incomplete Brands/Suppliers telah diaudit dan diselaraskan. | `MasterDataMaterialsClient.tsx`, `SupplierClient.tsx` |

---

### MAIN APP (StudioFlow)

#### C-SISA-5 · Filter tersimpan 🔒 — **SELESAI #46; migrasi diterapkan #59**

Model baru, **murni aditif**, tidak menyentuh tabel lain:

```prisma
model ChecklistFilterView {
  owner_id   String
  name       String
  query_json Json
  // + id/timestamps standar sesuai konvensi model StudioFlow lain
}
```

**Wajib** `query_json` terstruktur (mis. `{ status: "OPEN", priority: "P1",
assignee: "me", due: "today" }`) — **bukan** DSL teks bebas ala
`today & p1 @urgent`. Ini keputusan roadmap yang eksplisit, bukan pilihan
Codex: *"DSL menuntut parser, parser menuntut penanganan error, dan keduanya
proyek tersendiri. DSL bisa ditambahkan di atas `query_json` kelak;
sebaliknya tidak bisa."* Jangan bangun parser DSL di task ini.

Migrasi baru untuk model ini **boleh** dibuat (ini bukan skema Master Data).
Larangan agent menerapkannya sendiri tetap benar sebagai aturan default; pada
2026-08-19 owner secara eksplisit mewakilkan penerapannya, sehingga gerbang itu
dibuka untuk operasi #59.

UI: tidak ada spek tampilan dari roadmap — ikuti pola komponen checklist yang
sudah ada (`components/task-list.tsx`, `today-view.tsx`) untuk konsistensi
visual, dan **usulkan** penempatannya (mis. dropdown "Saved filters" di atas
task list) sebelum membangun kalau ragu.

**Hasil #46:** kontrol ditempatkan di baris filter Tasks. CRUD di-scope ke
`owner_id`, nama yang sama meng-update filter personal, dan `query_json`
menyimpan predicate terstruktur. Migrasi
`20260819130000_add_checklist_filter_view` dibuat pada #46. **Hasil operasi
#59:** diterapkan ke PostgreSQL lokal `studioflow` di `localhost:5432`; status
Prisma sesudahnya menyatakan seluruh 28 migrasi up to date. Tidak ada target
production/remote yang disentuh karena URL terkonfigurasi menunjuk lokal.

#### C-SISA-3 · Drag-and-drop pengurutan task

`@dnd-kit` sudah jadi dependensi dan sudah dipakai di
`src/extensions/sketchup/components/CatalogCodeManager.tsx` — tiru polanya.
`reorderTasks` sudah jalan (`src/actions/checklist-actions.ts:186`) dan
`sort_order` sudah dihormati semua pembaca. **Yang belum ada hanya interaksi
seret di layar** — tidak ada perubahan action/schema yang dibutuhkan.

**Hasil #55:** SELESAI. `TaskList` sekarang memakai drag handle pointer/keyboard
untuk root dan subtask. Drop lintas parent/phase ditolak, filter selain All
menonaktifkan reorder agar payload selalu satu kelompok sibling lengkap, dan
state optimistik rollback saat action gagal. Tidak ada perubahan schema/action.

#### T3 · Verifikasi ulang `PLAN-AUDIT-ROADMAP-2026Q3.md` (verifikasi saja, bukan implementasi)

Belum diverifikasi ulang terhadap kode saat ini: Issue 1 (auth bypass
`/activity`, tercatat sudah dimitigasi — **konfirmasi**, jangan percaya
catatan lama), Issue 5 (validasi prefix kode CD), Issue 6
(`switchActiveOption` dead code — cek masih ada/tidak), migrasi gate
`LIBRARY_*` ke nama permission yang jujur. Dokumen itu **pernah salah**
menandai sesuatu "selesai" padahal belum (badge `max-w-full`) — periksa
kelimanya dengan kecurigaan yang sama, laporkan temuan per item (benar/salah/
sudah usang), **jangan langsung implementasi perbaikan** untuk yang ternyata
masih terbuka — itu keputusan terpisah, tulis sebagai item roadmap baru kalau
perlu.

**Hasil #56:** SELESAI sebagai verifikasi. Dua klaim lama sudah usang:
`/activity` kini dilindungi fail-closed auth + layout defense-in-depth, dan
`normalizeDrawingCode()` sudah menerima prefix CD pada create/update. Tiga
temuan masih membutuhkan keputusan/pekerjaan terpisah dan sudah dipindahkan ke
`roadmap.md`: T8 (`switchActiveOption` masih tanpa caller), T9 (gate Sample dan
Request milik Master Data masih memakai namespace `LIBRARY_*`), dan T10 (badge
`READY_FOR` masih `max-w-full` di atas base `shrink-0`). Tidak ada perbaikan
kode yang diselundupkan ke task verifikasi ini.

**Regression cleanup #58:** audit akhir full lint menemukan satu pelanggaran
import UI pada shared `DeleteConfirmDialog` (berkas ini belum punya caller).
Import sudah melewati `@/ui_engine`; copy Cancel dan variant destructive ikut
diselaraskan. Tidak ada perubahan workflow atau schema.

---

### BQ

**Tidak ada tugas — dan `src/subapps/bq/` TIDAK LAGI kosong.**

Diperbarui 2026-08-19 (#64). Owner menugaskan BQ langsung ke Claude
(*"ini kerjaan kamu bukan codex"*), dan Claude sudah mengimplementasikannya
penuh: schema `bq` (8 model + migrasi `20260819160000_bq_fixture_breakdown`),
mesin hitung + 23 test, service, 20 server action, dan UI `/bq` lengkap.

**Jangan menyentuh apa pun di `src/subapps/bq/`, `src/app/bq/`, atau schema
`bq` tanpa handoff baru.** Kalau ada item yang tampak "belum selesai" di sana,
cek `roadmap.md` §BQ lebih dulu — sebagian besar sisanya diblokir keputusan
owner (`⏳ owner`), bukan menunggu dikerjakan.

Kontraknya `AGENTS.md` §🧾 BQ Contract. Tiga hal yang paling mudah dilanggar
tanpa sadar, kalau suatu saat memang perlu menyentuhnya:

1. Jangan menjumlahkan biaya di luar `src/subapps/bq/lib/calc.ts`.
2. Jangan menambahkan kolom waste/konversi ke `BqServiceLine` — ketiadaannya
   ADALAH penegakan AT-07.
3. Jangan membuat tombol "refresh semua harga" — refresh sengaja satu baris
   per panggilan.

---

## 4. HELD — jangan dikerjakan di batch ini

Ditahan atas permintaan owner (2026-08-19) atau karena statusnya sendiri
sudah menandai "belum bisa dikerjakan". Semua tetap tercatat di `roadmap.md`
dengan status aslinya — **jangan hapus dari roadmap, jangan kerjakan diam-diam
"sekalian"**:

| Item | Kenapa ditahan |
|---|---|
| **C-SISA-6 · Recurring task** 🔒 | Butuh parser jadwal + scheduling engine — sebesar seluruh bagian C digabung. Di luar batch ini. |
| **C-SISA-7 · Notifikasi assignee** 🔒 | StudioFlow belum punya mekanisme notifikasi sama sekali — proyek tersendiri. |
| **A6 · Schedule bundle** 🔒 | `ScheduleBundle` belum ada di skema. Di luar batch ini. |
| **R-SCHED-TPL-2e · Plugin SketchUp** | Sudah ditandai **out of scope sampai plugin SketchUp di-update** di handoff lama — bukan sesuatu yang bisa dikerjakan dari sisi app sekarang. Owner konfirmasi 2026-08-19: tetap di-hold. |
| **B1 · Struktur folder deliverable per fase** ⏳ | Ditunda sengaja oleh owner (keputusan 2026-08-18) sampai dua gerbang terpenuhi: Master Data selesai + StudioFlow inti bebas regresi. **Jangan dikerjakan, jangan dicabut dari roadmap.** |

**T7 (Graphify code graph)** bukan tugas Codex sama sekali — itu tooling
sesi Claude, dipegang Claude sendiri (lihat `roadmap.md` §Utang teknis).

---

## 5. Aturan kerja — anti-halusinasi & fokus

Ini permintaan eksplisit owner untuk batch ini. Pelanggaran paling umum yang
mau dicegah:

1. **Cek kode dulu, baru klaim.** Sebelum menulis "X belum ada" / "X sudah
   selesai" / "X rusak" di mana pun (kode, changelog, roadmap, laporan ke
   owner) — buktikan dengan `grep`/baca berkasnya, sebutkan file:baris.
   Dokumen (termasuk handoff ini) **bisa usang**; kode yang jalan yang benar.
   Contoh nyata dari sesi ini: klaim "belum ada koneksi Brand↔Library" ternyata
   salah — koneksinya ada (`v_library_brand` + `brand-library-service.ts`),
   yang benar adalah "rusak setelah #37" (lihat LA-1). Kalau tadi langsung
   dieksekusi tanpa cek, hasilnya kode duplikat yang menabrak yang sudah ada.
2. **Satu item, selesai penuh, baru pindah.** "Selesai" = kode + `roadmap.md`
   item itu dicentang `[x]` dengan catatan singkat + entri `CHANGELOG.md` pada
   task yang sama (format §6). Jangan menumpuk banyak item setengah jadi.
3. **Cakupan HANYA yang tercantum di §3.** Item roadmap lain yang tidak
   disebut di sini — termasuk yang di §4 — **tidak dikerjakan**, walau
   kelihatan kecil atau "sekalian saja". Kalau menemukan bug/celah di luar
   cakupan saat bekerja, **catat sebagai temuan baru di roadmap.md** (jangan
   diperbaiki di task yang sama), kecuali itu regresi langsung dari perubahan
   Anda sendiri.
4. **Jangan mengarang skema.** Perubahan `schema.prisma` di batch ini
   **terbatas persis** pada `ChecklistFilterView` (C-SISA-5) dengan bentuk
   yang sudah ditentukan di §3 — tiga kolom itu, bukan lebih. Semua perubahan
   skema lain (termasuk Master Data, termasuk "menambah kolom kecil saja")
   berhenti dan tanya owner dulu, sesuai §2.2.
5. **Jangan asumsikan gejala bug yang tidak dilaporkan detail** (LA-1) —
   reproduksi dulu, tulis apa yang direproduksi, baru diagnosis, baru fix.
   "Kemungkinan besar begini" boleh jadi hipotesis awal, **tidak boleh** jadi
   dasar patch tanpa verifikasi.
6. **Kalau kode dan dokumen (roadmap/handoff ini/AGENTS.md) berbeda** — kode
   yang berjalan menang, tapi **laporkan selisihnya secara eksplisit** di
   changelog (dokumen mana yang usang, apa yang sebenarnya benar). Jangan
   diam-diam menyesuaikan salah satunya tanpa mencatat kenapa.
7. **Kontrak §2 tidak bisa dilonggarkan oleh Codex sendiri.** Kalau sebuah
   task tampak butuh melanggar §2.1 (FK Master Data↔StudioFlow) atau §2.2
   (skema Master Data) untuk "beres lebih cepat" — itu sinyal salah desain,
   bukan alasan untuk melanggar. Berhenti, tulis alternatifnya, tanya owner.
8. **Ambigu atau berisiko → tulis usulan, jangan eksekusi sendiri.** Sama
   seperti aturan Claude di `AGENTS.md` §🧑‍⚖️ Pembagian Peran: kalau spek di
   §3 tidak cukup jelas untuk sebuah keputusan konkret (mis. Test infra
   `getBrandView`), tulis usulannya sebagai opsi + rekomendasi, tandai ⏳ di
   roadmap, lanjut ke item lain. Jangan menebak keinginan owner untuk
   keputusan yang berdampak luas.

---

## 6. Format pelaporan (per item, wajib)

Sama seperti aturan mengikat di `AGENTS.md` §👑 AI Main Lead Governance,
aturan 8 — setiap item yang selesai butuh entri `CHANGELOG.md` di task yang
sama, minimal berisi:

**Hasil akhir** · **Area/berkas berubah** · **Verifikasi yang benar-benar
dijalankan** (bukan "seharusnya lulus" — jalankan `npm run typecheck`/test
yang relevan dan tulis hasilnya) · **Risiko** · **Pekerjaan yang masih
terbuka**.

Perubahan UI dicatat juga di `CHANGELOG.md` §UI Changes. Kalau sebuah item
mengubah arsitektur/workflow/kontrak inti — `AGENTS.md` **wajib** diperbarui
di task yang sama (jarang terjadi di batch ini, tapi berlaku kalau LA-1
ternyata butuh perubahan kontrak §8 — dan itu perlu izin owner dulu, bukan
sekadar update dokumen).

---

## 7. Peran Claude setelah handoff ini

Tidak berubah dari siklus lalu. Codex memegang eksekusi coding. Claude
bertindak sebagai **product specialist dan reviewer**: mereview hasil coding
terhadap kontrak §2, menjaga `changelog.md`/`roadmap.md`/`AGENTS.md`, dan
menyiapkan spesifikasi. Claude akan **mengecek hasil batch ini dan menjalankan
ulang Graphify** (`graphify-out/`, lihat `roadmap.md` §Utang teknis T7)
setelah ada perubahan kode berarti — bukan menulis kode produksi sendiri,
kecuali salah satu dari tiga keadaan di `AGENTS.md` §🧑‍⚖️ Pembagian Peran
berlaku.
