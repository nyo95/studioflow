# Analisa — Product Schedule: Default Template, Reuse Pool, Library↔Brand

**Tanggal:** 2026-08-12 · **Jenis:** ANALISA (tidak ada perubahan kode)
**Pemicu:** 4 pertanyaan owner atas layar Catalog Board (2026-506 Sociolla SG Funan) dan Extensions → Library.

Semua klaim di bawah diperiksa ke kode pada tanggal di atas. Nomor baris ikut disertakan
supaya bisa diverifikasi ulang, bukan dipercaya.

---

## 1. "Apply default template" — placeholder atau bukan? Settingnya di mana?

**Bukan placeholder. Fungsional penuh.**

Rantainya:

| Lapis | Lokasi |
|-------|--------|
| Tombol | `src/extensions/sketchup/components/CatalogBoard.tsx:555` |
| Action | `applyDefaultScheduleTemplateAction` — `sketchup-actions.ts:1929` |
| Service | `ScheduleService.applyDefaultTemplateEntries` — `schedule-service.ts:388` |
| Sumber data | tabel `studioflow.ScheduleTemplate`, filter `is_active = true AND is_default_entry = true` |

**Tempat settingnya:** `Settings → Studio → panel "Project Engine"`
(`src/app/(dashboard)/settings/studio/page.tsx` → `studio-settings-panel.tsx:602` →
`TemplateManager mode="project-engine"`). Di situ tiap kategori schedule per section
(material/fixture) punya toggle *default entry* → `handleToggleDefaultEntry`
(`template-manager.tsx:247`) → `setScheduleTemplateDefaultEntry` →
`settings-service.ts:253` menulis `is_default_entry`.

Perilaku: additive + idempotent. Kategori yang sudah punya baris di proyek dilewati
(`schedule-service.ts:403-408`), yang belum dibuatkan **entry kosong mode `reserve`**.
Juga dipanggil otomatis saat proyek baru dibuat (`project-service.ts:234`), jadi tombol
ini sebenarnya hanya untuk proyek lama atau kategori yang baru di-flag setelahnya.

**Kenapa terasa seperti placeholder:** kalau belum ada satu pun kategori yang di-toggle
sebagai default, `defaults.length === 0` → return `{ createdCategories: [] }` →
toast *"Already up to date — no default categories missing."* Layar tidak berubah sama
sekali. Secara teknis benar, secara UX tidak bisa dibedakan dari tombol mati.

**Rekomendasi (kecil):** kalau `defaults.length === 0`, kembalikan sinyal berbeda
(`noDefaultsConfigured: true`) dan tampilkan toast yang mengarahkan ke Settings →
Project Engine, bukan "already up to date". Atau disable tombolnya kalau tidak ada
default terdaftar.

### 1b. Klarifikasi owner (2026-08-12): yang diminta adalah default **item**, bukan default **kategori**

> *"misal saya pakai ACR-1 (dengan tipe yang sudah ditentukan) di semua proyek saya
> (settingan default) — itu yang diambil dan disetting."*

Yang ada sekarang ≠ yang dimaksud. Bedanya di isi baris yang dibuat:

| | Sekarang | Yang diminta |
|---|---|---|
| Yang disimpan | nama kategori saja | kategori **+ spesifikasi produknya** |
| Hasil di proyek baru | baris kosong `[RESERVED]` / brand `PENDING` (`schedule-service.ts:711-717`) | kartu ACR-1 sudah terisi: type "Clear Acrylic", brand, warna, finishing, gambar |
| Jumlah per kategori | maksimum 1 | bisa banyak (ACR-1, ACR-2, …) |
| Yang masih harus diketik designer | semuanya | tidak ada |

**Halangan struktural.** `ScheduleTemplate` (`schema.prisma:1177-1191`) hanya punya
`schedule_category`, `section`, `is_active`, `is_default_entry` — **tidak ada tempat
untuk menyimpan spesifikasi produk**, dan `@@unique([section, schedule_category])`
membuat satu kategori mustahil punya dua item default. Jadi ini bukan bug yang bisa
ditambal; perlu tabel baru.

### Rancangan yang diusulkan — `ScheduleTemplateItem`

Tabel baru di schema `studioflow`, satu baris = satu kartu default:

```prisma
model ScheduleTemplateItem {
  id                String      @id @default(uuid())
  section           ProductType
  schedule_category String              // "ACRYLIC"
  sort_order        Int                 // urutan → ACR-1, ACR-2, …
  /// Snapshot beku, format sama persis dengan ProjectScheduleOption.data_snapshot.
  /// Disalin apa adanya saat apply — mekanisme identik dengan mode "reuse".
  data_snapshot     Json
  sku_id            String?             // ikut kalau sumbernya item Library
  is_active         Boolean     @default(true)
  created_at        DateTime    @default(now())
  updated_at        DateTime    @updatedAt

  @@index([section, schedule_category, sort_order])
  @@schema("studioflow")
}
```

Apply-nya memakai jalur yang **sudah ada dan sudah teruji**: `addEntryToSchedule`
mode `reuse` sudah bisa menyalin snapshot beku ke entry baru
(`schedule-service.ts:735-746`). Tinggal tambah mode `template` yang sumbernya
`ScheduleTemplateItem.data_snapshot`, bukan option proyek lain. Tidak ada mekanika baru.

**Cara mengisinya — jangan bikin form baru.** Cara termurah dan paling kecil salahnya:
tombol **"Set as default item"** di menu ⋯ kartu Catalog Board. Kartu ACR-1 di Funan
sudah punya snapshot lengkap; tombol itu hanya menyalinnya ke `ScheduleTemplateItem`.
Settings → Project Engine cukup dipakai untuk melihat daftar, mengurutkan, dan
menghapus — bukan untuk mengetik ulang spesifikasi.

### Keputusan yang perlu owner tentukan sebelum dikerjakan

1. **Kode ACR-1 tidak bisa dijanjikan.** Kode di-normalisasi ulang per proyek
   (`normalizeCodes`, dipanggil `schedule-service.ts:790`); kalau sync SketchUp
   menambah item ACR lain, nomornya bergeser. Yang bisa dijamin template adalah
   **urutan** (`sort_order`) — item default selalu di posisi pertama kategorinya,
   jadi praktis jadi ACR-1 selama tidak disisipi manual. Setuju?
2. **Edit template → proyek lama ikut berubah?** Rekomendasi: **tidak**. Salin-saat-apply,
   sama seperti reuse. Snapshot proyek yang sudah jalan tidak boleh berubah karena
   setting kantor diubah — ini prinsip yang sama yang mendasari M5.
3. **Status saat mendarat:** `APPROVED` + `is_final` (spesifikasi sudah pasti, langsung
   masuk BQ/laporan) atau `DRAFT` (designer konfirmasi dulu)? Ini menentukan apakah
   item default ikut terhitung di dokumen sebelum ada yang melihatnya.
4. **Idempotensi harus diganti.** Logika sekarang melewati kategori yang **sudah punya
   baris apa pun** (`schedule-service.ts:403-408`). Dengan item-level itu salah — kalau
   sebuah kategori sudah terisi dari SketchUp, item default tidak akan pernah masuk.
   Kunci dedup harus per item (`template_item_id` dicatat di entry, atau cocokkan
   `spec_search_key`) — dan itu bergantung pada **R-SCHED-REUSE-1/2** beres duluan.
5. **Nasib `is_default_entry` yang lama.** Tetap berguna untuk "kategori ini selalu ada
   tapi kosong". Saran: pertahankan sebagai kasus khusus — template dengan nol item.

### 1c. Keputusan owner (2026-08-12) & konsekuensinya di kode

| # | Keputusan owner | Konsekuensi teknis |
|---|-----------------|--------------------|
| 1 | **Template = reserved. SketchUp yang kalah** — plugin menyesuaikan diri ke slot reserved. | Sebagian aturannya **sudah ada**, tapi di sisi yang salah. Lihat di bawah. |
| 2 | **Tidak propagasi.** Semua product catalog hanya snapshot. | Sesuai rekomendasi: salin-saat-apply. Tidak perlu mekanisme sinkronisasi balik. Konsisten dengan M5. |
| 3 | **StudioFlow (+ product library-nya) tidak berhubungan dengan BQ maupun Master Data.** Master Data hanya nyambung ke `extensions/library`. | Terkonfirmasi di kode — dengan **satu pengecualian** yang perlu dicatat, lihat di bawah. |
| 4 | Plugin SketchUp diperbaiki **belakangan**, setelah template manager rampung. | Urutan kerja: schedule dulu, kontrak plugin menyusul. Konsekuensinya ada window di mana sync masih membuat entry sendiri — perlu guard sementara. |
| 5 | Ikut rekomendasi teknis. | R-SCHED-REUSE-1 & -2 dikerjakan lebih dulu; kunci dedup item bergantung padanya. |

#### Tentang #1 — aturannya sudah ada, tapi di sisi plugin, bukan sisi schedule

Yang sudah benar hari ini:

- `planPrefixNormalization` (`sketchup-actions.ts:236-284`): material ber-`is_reserved`
  **mempertahankan nomornya persis**, material lain dinomori ulang melompati nomor itu.
  Persis prinsip "reserved menang".
- Auto-link sync (`sketchup-actions.ts:2083-2090`) sudah menyatakan *"Schedule values win;
  the model only fills gaps"* — kalau kode material cocok dengan entry yang sudah ada,
  spesifikasi schedule **tidak** ditimpa; hanya qty/unit/location yang diisi kalau kosong.

Yang belum ada — dan ini yang bikin template kalah:

1. **Slot reserved tidak punya identitas di sisi schedule.** `is_reserved` hidup di
   `SketchupMaterial` (`schema.prisma:1422`), bukan di `ProjectScheduleEntry`. Artinya
   sebuah slot hanya bisa "reserved" kalau materialnya **sudah ada di model SketchUp** —
   `setSketchupMaterialReserved` bahkan menolak material tanpa kode valid
   (`sketchup-actions.ts:501-503`). Slot dari template belum punya material sama sekali,
   jadi secara struktur mustahil ditandai reserved hari ini.
   → Perlu kolom di `ProjectScheduleEntry`: `template_item_id String?` (+ index),
   yang sekaligus jadi penanda reserved dan kunci idempotensi untuk keputusan #4 di §1b.
2. **Pencocokan sync terlalu sempit.** Auto-link hanya mencari entry dengan
   `schedule_prefix` + `schedule_increment` yang **sama persis**
   (`sketchup-actions.ts:2069-2073`). Kalau designer menamai materialnya `ACR-5` sementara
   template memesan `ACR-1`, tidak ada yang cocok → sync membuat entry baru → template kalah.
   → Aturan baru: cocokkan **per kategori**, adopsi slot template yang belum diklaim
   dengan `sort_order` terkecil, lalu **antrekan rename di plugin** supaya kode model
   ikut ke schedule. Antreannya sudah ada: `SketchupMergeAction` dua-hop
   (`tempChangesToRows`) memang dibuat untuk rename tanpa tabrakan kode.
3. **Kode reserved tidak pernah dikirim ke plugin.** `reserved_codes` saat ini hanya
   masuk payload audit log (`sketchup-actions.ts:586`), bukan kontrak yang dibaca plugin.
   → Saat template rampung, endpoint sync harus mengirim daftar kode yang dipesan
   template supaya plugin menomori model melompatinya sejak awal, bukan diperbaiki
   setelah tabrakan.
4. **Guard sementara (karena #4 owner: plugin belakangan).** Sebelum kontrak plugin
   diperbarui, minimal cegah sync mencuri nomor milik template: kalau
   `prefix+increment` yang mau dipakai sync sudah dipegang entry `template_item_id != null`
   yang belum diklaim, sync jangan bikin entry baru di nomor itu — dorong ke nomor bebas
   berikutnya. Satu perubahan kecil di `sketchup-actions.ts:2069-2130`, tanpa menyentuh plugin.

#### Tentang #3 — terkonfirmasi, dengan satu pengecualian

Diperiksa: `schema.prisma` mendaftarkan schema `bq` di datasource (baris 8) tapi
**nol model** memakai `@@schema("bq")`. Tidak ada satu pun query dari schedule ke BQ.
Sejak M5 FK schedule ke `master_data` juga sudah dilepas (`schema.prisma:1138-1142`).
Jadi model mental owner cocok dengan kode.

Pengecualiannya satu, dan arahnya keluar bukan masuk: **"Save to Library"**
(`saveCatalogItemToLibraryAction`, `sketchup-actions.ts:~3306-3345`) menulis
`Sku` baru ke `master_data` dari kartu schedule, lalu menyimpan `sku_id`-nya di option.
Itu aksi manual dan disengaja — kartu didorong ke Library — bukan kopling otomatis.
Perlu diingat saat template dibuat: **jangan** ikut mendorong item template ke Master Data.
Template hidup sepenuhnya di `studioflow`.

#### Tentang status saat mendarat (pertanyaan §1b no. 3, sekarang tanpa konteks BQ)

Karena tidak ada hilir BQ, yang benar-benar terpengaruh hanya di dalam StudioFlow:
`is_final` menentukan option mana yang dipakai Render Board
(`render-board-actions.ts:94`), CSV export (`csv-export.ts:26`), dan tampilan kartu
(`sketchup-actions.ts:775`). **Rekomendasi: `is_final: true`, `status: APPROVED`** —
item template adalah spesifikasi yang sudah diputuskan kantor, jadi seharusnya langsung
tampil utuh di board dan export. Ini juga konsisten dengan aturan sync yang sudah ada
(`isComplete ? APPROVED : DRAFT`), karena item template selalu lengkap.
Item template tidak akan tersapu `cleanupEmptyCatalogItems` karena isinya tidak kosong.

---

## 2. "Add item → From a past project" tidak keluar hasil — root cause

**Ini bug nyata, bukan data kosong.** Ketik `acr` memang tidak akan pernah keluar apa-apa
untuk item Funan, walaupun ACR-1/2/3 ada di layar.

### Alur pencariannya

`CatalogBoard.tsx:518` → `searchReusableCatalogItemsAction` (`sketchup-actions.ts:1841`)
→ `ScheduleService.searchReusableSpecs` (`schedule-service.ts:1556`), yang query-nya:

```ts
where: { spec_search_key: { not: null, contains: trimmed }, entry: { section } }
```

Jadi seluruh fitur bergantung **hanya** pada kolom `ProjectScheduleOption.spec_search_key`.

### Kolom itu hampir selalu NULL

`spec_search_key` cuma ditulis oleh `deriveScheduleSpecFields()` (`schedule-service.ts:217`),
dan fungsi itu dipanggil di **4 tempat, semuanya di `schedule-service.ts`** (baris 781, 895,
964, 1529).

Sementara itu penulisan `ProjectScheduleOption` terjadi di banyak tempat lain — dan
**tidak satu pun** memanggilnya:

| File | Titik tulis | Derive spec? |
|------|-------------|--------------|
| `sketchup-actions.ts` | 1218, 1223, 1355, 1360, 1426, 1658, **1785**, 2125, 2197, 2547, 3101, 3333, 3734 | ❌ tidak ada |
| `lib/schedule/csv-import.ts` | 92, 106, 118, 229 | ❌ tidak ada |

`grep deriveScheduleSpecFields src/extensions/sketchup/ src/lib/schedule/` → nol hasil.

### Efeknya pada item ACR Funan

Dua skenario, dua-duanya berakhir sama:

1. **Item ditambah manual** (`addManualCatalogItemAction:1715`). `addEntryToSchedule` mode
   `reserve` membuat snapshot placeholder `catalog_brand: "Custom"`,
   `catalog_product_name: "Manual Item"` → `spec_search_key = "custom::manual item"`.
   Lalu baris 1785 menimpa `data_snapshot` dengan draft — **tanpa** menulis ulang spec.
   Setelah itu user mengetik "Clear Acrylic" lewat `updateManualCatalogItemAction` /
   `updateSketchupMaterialAction` — juga tanpa re-derive. Kunci tetap `"custom::manual item"`.
2. **Item dari sync SketchUp** (1218/1223/2125/2197) — option dibuat langsung dengan
   `data_snapshot` saja → `spec_search_key = NULL` → tersaring keluar oleh `not: null`.

Kesimpulan: `"acr"` tidak cocok dengan `"custom::manual item"` maupun `NULL`. Reuse pool
praktis **kosong untuk seluruh office**, bukan hanya Funan. Satu-satunya item yang bisa
muncul adalah yang dibuat lewat jalur library/`addOptionToEntry` murni — jalur yang
justru sudah dihapus 2026-08-04 (lihat komentar `sketchup-actions.ts:1806-1812`).

Tidak ada migrasi backfill: `spec_search_key` masuk lewat rebaseline
(`20260805100000_rebaseline_current_schema`) sebagai kolom biasa, tanpa `UPDATE ... SET`.
Komentar di `schema.prisma:1148-1155` sendiri sudah menandai risikonya —
*"correctness depends on the write path keeping these two in sync"* — dan write path-nya
memang tidak sinkron.

### Perbaikan yang diusulkan

1. **Sentralisasi tulis.** Bikin satu helper `writeScheduleOption(tx, ...)` yang selalu
   menulis `data_snapshot` + `...deriveScheduleSpecFields(snapshot)` bersamaan, lalu
   ganti 17 titik tulis di atas memakainya. Tanpa ini, bug yang sama akan kembali
   setiap kali ada jalur tulis baru.
2. **Backfill.** Script sekali jalan: baca `data_snapshot` tiap `ProjectScheduleOption`,
   hitung ulang spec fields, update. Jalankan setelah #1 supaya tidak bocor lagi.
3. **Lebarkan search key.** `[brand, product, color, finishing]` tidak memuat
   `schedule_category`. Designer mengetik "acr"/"acrylic" — itu nama kategori, bukan nama
   produk. Tambahkan `schedule_category` ke `searchKeyParts`.
4. **Guard UI.** Saat pool kosong, teks *"No matching items from past projects"* tidak
   membedakan "tidak ketemu" dari "fitur belum punya data". Tambahkan hint kalau total
   pool = 0.
5. **(Nanti)** `searchReusableSpecs` menarik 500 baris lalu group di JS — komentar di
   baris 1600 sudah mencatat ini harus jadi `GROUP BY` SQL begitu ada akses DB nyata.

---

## 3. Perlu database khusus StudioFlow untuk product schedule?

**Tidak perlu database baru.** Skema sekarang sudah tepat; yang kurang adalah
*pengisian*-nya (poin 2), bukan tempat penyimpanannya.

Kondisi hari ini:

- Satu Postgres, tiga schema: `studioflow`, `master_data`, `bq` (`schema.prisma:6-9`).
- Product schedule sudah punya tabelnya sendiri di schema `studioflow`:
  `ProjectScheduleEntry`, `ProjectScheduleOption`, `ScheduleTemplate`, `PrefixDictionary`.
- Sejak **M5 (2026-08-10)** FK ke `master_data.Sku/Brand` sengaja dilepas; `data_snapshot`
  membekukan isi produk (`schema.prisma:1138-1142`). Ini keputusan yang benar — spesifikasi
  proyek yang sudah dikirim ke klien tidak boleh berubah karena master data diedit.
- "Memori material kantor" yang owner maksud sudah punya bentuknya: kolom `spec_*` +
  `@@index([spec_search_key])`, `@@index([spec_brand_id])` (`schema.prisma:1156-1173`).

Jadi arsitekturnya: **snapshot = arsip immutable, `spec_*` = index turunan yang boleh
dihitung ulang kapan saja.** Yang dibutuhkan hanya (a) menulisnya konsisten, (b) backfill,
dan nanti (c) view/materialized view untuk agregasi kalau volumenya sudah besar.
Menambah DB terpisah justru memecah transaksi yang sekarang atomik dan menghilangkan
jaminan konsistensi snapshot↔index dalam satu `tx`.

---

## 4. Extensions → Library: sudah konek ke "Brand" di Master Data?

**Sudah, langsung ke tabel `master_data`.** `BrandLibraryService`
(`src/extensions/library/services/brand-library-service.ts`) query ke `Brand`,
`BrandCategory`, `Category`, `Sku`, `SkuCategory`, `BrandLink`, `Sample`.

Bukti dari screenshot itu sendiri: cari "Finishing" → keluar brand **TACO** dengan chip
`kategori: Finishing` dan `tag: Finishing`. Dua chip itu berasal dari dua sumber bukti
berbeda di kode — `Category`/`BrandCategory` untuk "kategori", `Sku.categories` untuk
"tag" (baris 154-183). Kalau tidak terkoneksi, tidak akan ada hasil sama sekali.

Yang perlu dicatat:

- **"No catalogue yet"** = brand itu tidak punya `BrandLink` ber-`kind` CATALOG / DRIVE /
  PRICE_LIST (baris 205-209). Ini **kekosongan data**, bukan koneksi putus. Karena scope
  Library dikunci ke "cari brand → buka katalognya", brand tanpa link jadi dead end.
  Isi `BrandLink` di Master Data supaya fitur ini ada gunanya.
- **Surface-nya sengaja sempit:** nama/slug, kategori, link allowlist, ketersediaan sample.
  Tanpa harga, tanpa kontak, tanpa identitas supplier (baris 17-22). Ini scope lock owner
  1 Agu 2026, bukan fitur yang belum jadi.
- **Catatan performa:** `searchBrands` menarik **seluruh** `Category` + **seluruh** `Sku`
  (dengan join kategori) ke memori setiap kali diketik, lalu filter di JS (baris 126-142).
  Aman di ratusan baris, tidak aman di puluhan ribu. Kandidat pindah ke query SQL
  (`ILIKE` + `pg_trgm`) saat volume Sku naik.
- **Hubungan dengan poin 2:** Library dan reuse pool adalah dua pencarian berbeda yang
  gampang tertukar. Library = "brand mana yang jual X" (sumber: master_data). Reuse pool =
  "material apa yang pernah kantor pakai" (sumber: studioflow snapshot). Reuse pool tidak
  akan pernah menampilkan hasil dari Library, dan sebaliknya — ini disengaja.

---

## Ringkasan prioritas

| # | Temuan | Tingkat | Aksi |
|---|--------|---------|------|
| 2 | `spec_search_key` tidak pernah ditulis di 17 jalur tulis → reuse pool mati total | 🔴 Bug | Sentralisasi write + backfill + tambah kategori ke key |
| 1 | Tombol default template tak bisa dibedakan dari tombol mati saat belum ada default | 🟡 UX | Bedakan pesan "belum dikonfigurasi" vs "sudah up to date" |
| 4 | `BrandLink` kosong → "No catalogue yet" jadi dead end | 🟡 Data | Isi link katalog di Master Data |
| 4 | `searchBrands` full-table scan ke memori | 🟢 Nanti | Pindah ke SQL saat volume naik |
| 3 | DB khusus | ⚪ Tidak perlu | Skema sudah benar; masalahnya di write path |
