# Master Data v2 — Rancangan Skema

**Status:** RANCANGAN. Belum ada satu baris pun yang diterapkan.
**Dibuat:** 2026-08-10
**Sumber:** `design database masterdata.xlsx` (Table 1–4) + audit `prisma/schema.prisma` v1 (18 model `master_data`)
**Draft schema:** `prisma/schema.masterdata-v2.prisma` — sudah lolos `prisma validate`
**Strategi:** greenfield (drop & rebuild), sesuai keputusan owner 2026-08-10 dan roadmap §Arah Strategis poin 1

Dokumen ini menjawab tiga hal: **apa yang salah di v1**, **tabel mana yang harus
dipecah dan direlasikan**, dan **kenapa** — beserta alternatif yang tidak
diambil, supaya keputusannya tidak perlu diperdebatkan ulang enam bulan lagi.

---

## Ringkasan eksekutif

v1 punya 18 model. v2 juga 18 model. Yang berubah bukan jumlahnya — melainkan
**garis potongnya**. Tujuh keputusan yang membedakan:

| # | Keputusan | Menutup |
|---|---|---|
| 1 | **Harga dipisah dari produk** — `Sku` (identitas) vs `SkuPrice` (syarat dagang) | Tidak ada riwayat harga, tidak bisa banding antar toko |
| 2 | **Satu `Party` + peran** menggantikan Company / ServiceVendor / supplier teks bebas | Supplier tidak pernah jadi entitas; satu perusahaan berperan ganda = baris ganda |
| 3 | **Satu pohon `Category`** menggantikan 6 kolom kategori teks bebas | "MEP" di dua tabel adalah dua string yang kebetulan sama |
| 4 | **Table 3 + Table 4 → satu `WorkPrice`** | Dua tabel berkolom identik memaksa UNION selamanya |
| 5 | **`Decimal` menggantikan `Float`** di 10 kolom uang `master_data` | Galat pembulatan di dokumen komersial |
| 6 | **`Sku.brand_id` jadi nullable** | Material generik memaksa brand sampah bernama `-` |
| 7 | **Nol FK ke schema `studioflow`** | Roadmap §Arah Strategis poin 2 |
| 8 | **Satu penulis, banyak pembaca** — konsumen baca lewat view, tidak menulis | 21 operasi tulis dari luar app Master Data (§F.2) |

**Keputusan owner 2026-08-10: BQ ditangguhkan.** Master Data dikerjakan lebih
dulu sebagai SSOT untuk BQ **dan** Library StudioFlow. §F menjelaskan apa yang
harus dipenuhi supaya sebutan "SSOT" itu benar — dan tiga hal yang hari ini
membuatnya belum benar.

---

## Bagian A — Membaca Excel

### A.1 Kolom A + B di Table 1 bukan dua entitas

| Excel | Isi contoh | Sebenarnya |
|---|---|---|
| A `Company` | `PT BDA Sejahtera` | `Party.legal_name` |
| B `Brand` | `BDA Group` | `Party.name` |
| C `Product Brand` | `Valpra` | `Brand.name` |

Baris kedua mengonfirmasinya: `PT Tangkas Cipta Optimal` / `TACO` / `TACO - HPL`.
Kolom A dan B selalu merujuk badan usaha yang sama — satu nama hukum, satu nama
dagang.

**Karena itu v2 tidak membuat tiga level.** `Party → Brand` cukup. Hierarki
tiga level (Company → Brand → ProductBrand) akan menghasilkan satu level yang
selamanya berisi duplikat nama induknya (`TACO` → `TACO - HPL`), dan setiap
query harus memutuskan level mana yang "brand sebenarnya".

Ini juga berarti **v1 sudah benar di titik ini** dan tidak perlu diubah.

### A.2 Kolom H–K adalah entitas ketiga, bukan atribut

| Excel | Catatan penulis | Artinya |
|---|---|---|
| H `Sales Name` | "nama sales yg jual produk ini" | Kontak dari **penjual**, bukan dari brand |
| I `Contact` | "nomor kontak dari sales" | idem |
| J `Supplier's Company` | "perusahaan yg menjual produk ini" | **Perusahaan lain** — Ace Hardware, Informa |
| K `Company Categories` | "supplier, subcon, vendor, retail store, manufacture" | **Peran** perusahaan itu |

Excel bertanya sendiri: *"mungkin bisa dibuat table khusus suppliers (?)"*.
Jawabannya ya — tapi bukan tabel `Supplier` yang terpisah. Lihat §B.2.

Di v1 informasi ini **tidak ada sama sekali**. Tidak ada kolom, tidak ada tabel.
Pertanyaan "TACO bisa dibeli di mana saja" hari ini tidak bisa dijawab database.

### A.3 Table 2 mencampur dua hal yang berubah dengan kecepatan berbeda

```
identitas produk          syarat dagang
──────────────────        ──────────────────
SKU, Material, Category   Qty, Unit, Price
Brand, Spec 1/2           Supplied by
Dimensions                (kapan berlaku)
```

Kolom kiri berubah kalau pabrikannya mengubah produk — jarang. Kolom kanan
berubah tiap kali ada penawaran baru, tiap kali dibeli di toko berbeda — sering.
Menaruhnya di satu baris berarti **menyimpan harga baru = menghapus harga lama**.

### A.4 Table 2 kolom `Qty` — penulisnya sendiri ragu

Ditandai `(need curations)`. Qty di baris harga tidak pernah berarti "jumlah
yang dibeli" — kalau begitu ia milik transaksi, bukan master data. Yang
dimaksud adalah **ukuran kemasan**: harga 150.000 berlaku untuk 1 lembar.

v2 menamainya `pack_size` dan memberinya default `1`, sehingga arti "per satu
satuan" jadi eksplisit alih-alih tersirat.

### A.5 Table 3 dan Table 4 — kolom "Items"

Ini pertanyaan yang diajukan langsung. Jawabannya:

**Blok pertama** (baris 22–26): `MEP / Lighting / rahmat / "Penarikan kabel CAT" / CAT 6`
— tidak punya kolom nama. Nama pekerjaannya menumpang di `Specification 1`.

**Blok kedua** (baris 28–31): `Furniture / Furniture / Andi / "Meja 10x10"`
— punya kolom `Items` yang isinya persis nama pekerjaan.

> **Kolom `Items` bukan konsep baru. Ia adalah slot yang di blok pertama salah
> tempat.**

Tiga konsekuensi:

1. **Jangan tambahkan kolom `Items` di keduanya.** Tambahkan satu kolom `name`
   yang **wajib**, dan kosongkan `Specification 1` dari peran itu.
2. **Jangan taruh nama pekerjaan di `spec` JSON.** JSON tempat atribut yang
   jumlahnya tidak tetap dan tidak wajib. Nama pekerjaan wajib ada, dicari,
   diurutkan, dan ditampilkan di tiap baris BQ — atribut seperti itu butuh
   kolom, index, dan NOT NULL. Menaruhnya di JSON berarti melepas ketiganya.
3. **Table 3 dan Table 4 bukan dua tabel.** Struktur kolomnya identik; yang
   membedakan cuma ada-tidaknya komponen material:

   | | `material_price` | `labor_price` |
   |---|---|---|
   | Table 4 — upah murni (`Penarikan kabel CAT`) | NULL | terisi |
   | Table 3 — material + upah (`Meja 10x10`) | terisi | terisi |

   Itu perbedaan **data**, bukan **struktur**. Dua tabel berkolom sama akan
   memaksa setiap pembaca BQ meng-`UNION` keduanya selamanya, dan setiap kolom
   baru harus ditambahkan dua kali — persis cacat yang sudah ada di v1 antara
   `ServicePrice` dan `MaterialLaborPrice`.

### A.6 "Project Reference" adalah daftar di dalam satu sel

`"Sociolla SPZ, Sociolla GI, dst"`. Dinormalisasi jadi tabel
`WorkPriceProjectRef`. Detail penting soal FK-nya ada di §B.7.

### A.7 Yang Excel minta tapi sebaiknya tidak diikuti

| Permintaan Excel | Keputusan v2 | Alasan |
|---|---|---|
| "Socmed — simpan dalam json" | Tabel `PartyLink` ber-`kind` | JSON tidak bisa di-unique-kan (URL ganda lolos), tidak bisa diurutkan, tidak bisa dicari. Tabel link sudah ada di v1 dan bekerja. |
| "Dimensions" satu string `1220 x 2440 mm` | Kolom numerik + `dim_display` | BQ menghitung m² dari angka ini. String harus di-parse tiap kali, dan parse akan gagal pada `-`. |
| "Update by / Update Time" per tabel | Kolom denormalisasi **dan** tabel `MasterDataAudit` | Kolom hanya menyimpan perubahan terakhir; update berikutnya menimpanya. Riwayat butuh baris. |
| "Spec 1 / Spec 2 di json" | **Diikuti** — `spec Json?` | Ini benar. Atribut opsional berjumlah tidak tetap. Ditambah GIN index supaya tetap bisa dicari. |

---

## Bagian B — Keputusan skema

### B.1 Harga dipisah dari produk — `Sku` / `SkuPrice`

**Ini keuntungan terbesar dari seluruh rombakan.**

```
Sku (identitas)                 SkuPrice (syarat dagang)
├── code, name, slug            ├── sku_id            ──┐
├── brand_id?                   ├── supplier_party_id   │ satu SKU
├── spec Json                   ├── price_list          │ banyak baris
├── dim_length/width/height     ├── price_net           │
├── base_unit                   ├── unit, pack_size     │
└── categories[]                ├── valid_from/to       │
                                ├── is_current        ──┘
                                └── source_link_id
```

Tiga pertanyaan yang v1 tidak bisa jawab dan v2 bisa:

1. **"Barang ini di toko mana paling murah?"** — banyak baris per SKU, satu per
   supplier.
2. **"Harga tahun lalu berapa?"** — `valid_from` / `valid_to`.
3. **"Kenapa angkanya berubah?"** — `source_link_id` menunjuk dokumen sumber,
   `MasterDataAudit` menyimpan diff-nya.

**`is_current` adalah denormalisasi yang disengaja.** Tanpanya, "harga yang
berlaku sekarang" butuh window function (`ROW_NUMBER() OVER (PARTITION BY
sku_id ORDER BY valid_from DESC)`) di **setiap** pembacaan katalog — jalur baca
terpanas di aplikasi. Ongkosnya: satu invariant yang harus dijaga (tepat satu
baris `is_current` per pasangan sku × supplier), ditegakkan partial unique index
di §D.

**`unit` sengaja diduplikasi** antara `Sku.base_unit` dan `SkuPrice.unit`. Ini
bukan kelalaian: produk bisa dikanonkan per m² sementara toko menjualnya per
lembar. `pack_size` yang menjembatani keduanya.

### B.2 Satu `Party` dengan peran — bukan tabel terpisah per peran

```
Party ──┬── PartyRole   (MANUFACTURER, SUPPLIER, RETAIL, SUBCON, SERVICE_VENDOR, …)
        ├── PartyContact
        ├── PartyLink
        ├── Brand.owner_party_id       (pemilik merek)
        ├── BrandSupplier.party_id     (siapa menjual merek apa)
        ├── SkuPrice.supplier_party_id (dibeli di mana)
        └── WorkPrice.vendor_party_id  (siapa mengerjakan)
```

**Kenapa satu tabel menang.** Ace Hardware hari ini `RETAIL`; kalau besok mereka
mengerjakan instalasi, ia jadi `SUBCON` juga. TACO adalah `MANUFACTURER` yang
juga menjual langsung. Dengan tabel terpisah, perusahaan berperan ganda muncul
dua kali — dan kontak, alamat, serta link-nya ikut terduplikasi, lalu menyimpang
diam-diam saat salah satunya diperbarui. Pertanyaan "berapa perusahaan yang kita
kenal" tidak punya jawaban tunggal.

Peran sebagai **tabel join**, bukan array `String[]` di `Party`: array tidak bisa
di-FK, tidak bisa diberi catatan per peran, dan filter "semua supplier" jadi scan
alih-alih index lookup.

**`PartyType` (COMPANY / INDIVIDUAL) ada karena datanya menuntut.** Excel Table
3/4 mencantumkan `rahmat`, `Tukang`, `Andi` sebagai vendor. Mereka bukan
perusahaan. Memaksa mereka masuk tabel bernama `Company` adalah kebohongan yang
murah dihindari — dan `legal_name` yang selamanya NULL untuk mereka adalah
gejalanya.

**Ongkos yang diterima, dinyatakan terang-terangan.** Integritas peran tidak lagi
dijamin foreign key. Tidak ada yang menghalangi `Party` ber-peran `MANUFACTURER`
saja dipasang di `SkuPrice.supplier_party_id`. Ini konsekuensi nyata dari
memilih satu tabel, bukan detail yang bisa diabaikan.

Penjaganya, berurutan dari yang paling murah:

1. **Service layer** — picker hanya menampilkan Party dengan peran yang sesuai.
   Menutup 95% kasus, tapi tidak menutup jalur tulis lain.
2. **Trigger `BEFORE INSERT OR UPDATE`** yang memeriksa keberadaan baris
   `PartyRole` yang dibutuhkan. Menutup semuanya, ongkosnya satu query per tulis.
3. Tidak melakukan apa-apa dan menerima bahwa datanya bisa salah.

Rekomendasi: **(1) sekarang, (2) kalau terbukti ada yang lolos.** Trigger tanpa
bukti masalah adalah kompleksitas yang harus dirawat tanpa alasan.

### B.3 Satu pohon `Category` — menggantikan enam kolom teks bebas

Excel memunculkan pasangan dua tingkat berulang kali dengan nama berbeda:

| Lokasi | Level 1 | Level 2 |
|---|---|---|
| Table 1 | — | `Category` (brand) |
| Table 2 | `Category` (Bahan Baku) | `Material` (HPL, Plywood) |
| Table 3 | `Vendor Category` (Furniture) | `Category` (Furniture) |
| Table 4 | `Vendor Category` (MEP, Sipil) | `Category` (Lighting, Floor Works) |

v1 memodelkan ini sebagai **enam kolom `String` terpisah** —
`MaterialPrice.category`, `ServicePrice.category`, `ServicePrice.vendor_category`,
`MaterialLaborPrice.category`, `MaterialLaborPrice.vendor_category`,
`Sku.catalog_tags String[]` — plus satu tabel `Category` ber-slug yang tidak
terhubung ke satu pun di antaranya.

Akibatnya: `"MEP"` di `ServicePrice` dan `"MEP"` di `MaterialLaborPrice` adalah
dua string yang **kebetulan** sama. Salah ketik satu huruf melahirkan kategori
baru tanpa peringatan. Mengganti nama kategori adalah migrasi data di enam
tempat.

`Category` self-referencing menutup semuanya, berapa pun dalamnya nanti, dan
mengubah "ganti nama kategori" jadi satu `UPDATE`.

> **Catatan §T2 roadmap masih berlaku sebagian.** T2 mencatat bahwa
> `MaterialPrice.category` sengaja terpisah dari `Category` ber-slug karena
> gunanya beda: *sectioning* BQ, bukan klasifikasi produk. Itu benar sebagai
> pembelaan atas v1. Yang v2 lakukan bukan menggabungkan dua guna yang berbeda,
> tapi **memberi keduanya pohon sendiri** lewat `CategoryKind` — `PRODUCT` untuk
> klasifikasi produk, `WORK` untuk sectioning BQ. Keduanya tetap terpisah, tapi
> keduanya jadi entitas, bukan string.

**Jebakan `@@unique` yang perlu diketahui.** Kunci alaminya terlihat seperti
`[parent_id, slug]`. **Itu tidak bekerja di Postgres**: NULL tidak sama dengan
NULL, jadi dua kategori **akar** bernama sama akan lolos tanpa suara. v2 memakai
`@@unique([kind, slug])` global.

Konsekuensinya harus disadari: `"Lighting"` tidak bisa muncul di bawah dua induk
berbeda tanpa slug yang dibedakan (`lighting-mep`, `lighting-furniture`). Untuk
kosakata studio sebesar ini, itu batasan yang sehat — ia memaksa memutuskan
apakah dua "Lighting" itu benar-benar hal yang sama.

### B.4 `WorkPrice` — Table 3 + Table 4

Lihat §A.5 untuk alasan penggabungannya. Detail tambahan:

**`total_price` sebagai kolom `GENERATED ALWAYS AS ... STORED`.** v1 menyimpan
`total_price` sebagai kolom biasa dengan komentar *"Derived: material_price +
labor_price. Stored so BQ can read one column"* — niat yang benar, jaminan yang
tidak ada. Satu jalur tulis yang lupa menghitung ulang cukup untuk membuatnya
berbohong. Kolom generated memindahkan jaminan itu ke database, di mana tidak
ada jalur tulis yang bisa melewatinya.

**`category_id` wajib, `vendor_party_id` nullable.** Pekerjaan tanpa kategori
tidak bisa di-section di BQ — itu alasan kategorinya ada. Vendor boleh kosong:
kantor menyimpan tarif internalnya sendiri yang bukan milik vendor manapun.

### B.5 `Decimal`, bukan `Float`

v1 memakai `Float` untuk **10 kolom uang di `master_data`** — `ServicePrice.price`,
`MaterialPrice` (2), `MaterialLaborPrice` (3), `Sku` (2), `MaterialCandidate` (2)
— plus `ProjectProductRequest.vendor_quoted_price` di `studioflow`.
Postgres `double precision` tidak bisa
merepresentasikan `0.1` secara persis; menjumlahkan ratusan baris BQ
mengakumulasi galat yang muncul sebagai selisih rupiah di total — di dokumen
komersial yang ditandatangani orang.

v2: `Decimal @db.Decimal(16,2)` untuk uang, `Decimal(12,3)` untuk dimensi dan
`pack_size`. `16,2` menampung sampai 99 triliun rupiah — cukup, dan lebih murah
diperbesar nanti daripada dikecilkan.

Konsekuensi di kode: Prisma mengembalikan `Decimal` (`decimal.js`), bukan
`number`. Setiap aritmetika harus lewat `.plus()` / `.times()`, dan serialisasi
ke client butuh `.toString()`. Itu **fitur**, bukan gangguan — `Float` yang
diam-diam bisa dijumlahkan dengan `+` justru yang membuat cacatnya tak terlihat.

### B.6 `Sku.brand_id` nullable

v1: `brand Brand @relation(..., onDelete: Restrict)` — **wajib**.

Excel Table 2 kolom D menyatakan eksplisit: *"apabila tidak ada brand bisa
dikosongkan"*, dan contohnya membuktikannya — `plywood 9mm`, brand `-`.

Relasi wajib pada data yang sah kosong selalu menghasilkan hal yang sama: baris
sampah bernama `-`, `N/A`, atau `Generic`, yang lalu muncul di setiap dropdown
brand dan setiap laporan.

Ongkosnya: `@@unique([brand_id, code])` **tidak menjaga** SKU tanpa brand (NULL
≠ NULL lagi). Ditutup partial unique index di §D.

### B.7 Nol FK ke `studioflow`

> **Dikoreksi di §F.1.** Arah ketergantungannya sudah benar di v1 — nol FK
> `master_data` → `studioflow`. Yang v2 lakukan adalah **menjaganya**, bukan
> mencapainya. Coupling yang sebenarnya ada di tiga tempat lain.

Roadmap §Arah Strategis poin 2: *"StudioFlow diputus dari Library/Master Data —
keduanya harus bisa berdiri sendiri."*

Karena itu `prisma/schema.masterdata-v2.prisma` **self-contained**: bisa
divalidasi sendirian, tanpa satu pun model `studioflow`. Rujukan lintas app
disimpan sebagai kolom id biasa + snapshot nama:

| Kolom | Bukan FK karena |
|---|---|
| `WorkPriceProjectRef.project_id` + `project_name` | FK akan mengembalikan ketergantungan lewat pintu belakang |
| `SampleMovement.actor_id` + `actor_name` | riwayat harus selamat saat user dihapus — **dan** decoupling |
| `*.updated_by_name` | sama; polanya sudah ada di v1 `MaterialPrice.updated_by_name` dan sudah terbukti |

Snapshot nama bukan duplikasi malas: ia yang membuat rujukan tetap terbaca
setelah entitas seberang hilang. Tanpanya, menghapus satu proyek membuat riwayat
harga vendor kehilangan konteks.

### B.8 `SkuMedia` — lima kolom URL jadi satu tabel

v1 `Sku` punya `catalog_image_url`, `catalog_image_thumbnail_url`,
`catalog_image_original_url`, `catalog_reference_url`, `catalog_folder_url`.

Lima kolom berarti **tepat satu foto per produk**, dan jenis media keenam berarti
migrasi. Satu tabel `SkuMedia` ber-`kind` memberi banyak foto gratis.

### B.9 `SkuCategory.is_primary` menggantikan konvensi urutan

v1: *"Ordered category tags. First tag is the primary Schedule category."*

Konvensi urutan rusak tanpa suara. Siapa pun yang menyortir ulang tag —
alfabetis di UI, `ORDER BY` yang berbeda di satu pembaca — memindahkan kategori
utama tanpa ada yang memutuskannya. Flag eksplisit tidak bisa rusak diam-diam,
dan bisa ditegakkan index.

---

## Bagian C — Apa yang hilang dari v1

| Model v1 | Nasib | Alasan |
|---|---|---|
| `Company` | → `Party` | digabung dengan ServiceVendor |
| `CompanyContact`, `CompanyLink` | → `PartyContact`, `PartyLink` | idem |
| `ServiceVendor` | → `Party` + `PartyRole(SERVICE_VENDOR)` | §B.2 |
| `Brand` | tetap, dibersihkan | hilang `@@map("Vendor")`, `brand_name @map("vendor_name")` |
| `BrandLink`, `BrandContact` | `BrandLink` tetap; `BrandContact` → `PartyContact` | kontak melekat pada badan usaha, bukan merek |
| `Category` | tetap, jadi pohon | §B.3 |
| `BrandCategory` | tetap + kolom `source` | menutup roadmap §A4 |
| `SkuCategory` | tetap + `is_primary` | §B.9 |
| `Sku` | tetap, dibersihkan total | hilang `@@map("Material")` dan 24 prefix `catalog_*` |
| `MaterialPrice` | → `SkuPrice` | §B.1 |
| `ServicePrice` | → `WorkPrice` | §A.5 |
| `MaterialLaborPrice` | → `WorkPrice` | §A.5 |
| `Sample`, `SampleMovementLog` | tetap | §C.1 |
| `MaterialCandidate`, `SampleCandidate` | **dibuang** | §C.2 |
| — | **baru:** `PartyRole`, `BrandSupplier`, `SkuMedia`, `WorkPriceProjectRef`, `MasterDataAudit` | |

### C.1 `Sample` dipertahankan meski tidak ada di Excel

Excel sama sekali tidak menyebut perpustakaan sample fisik (rak, box, peminjam).
Itu **bukan** tanda bahwa ia harus dibuang — Excel ini merancang katalog dan
harga, bukan seluruh Master Data.

Rak/box sample adalah fungsi bisnis yang berjalan hari ini. Dicatat di sini
supaya keputusan mempertahankannya **terlihat**, bukan tersembunyi di dalam
schema. Kalau ternyata fungsi ini memang mau dihentikan, itu keputusan tersendiri
yang perlu diambil sadar.

### C.2 `MaterialCandidate` / `SampleCandidate` dibuang

Keduanya tabel *staging* impor spreadsheet: `source_sheet`, `source_row`,
`source_checksum`, `review_status`, `blocker_reasons`, `promoted_material_id`.
Bentuknya adalah bentuk pekerjaan sekali jalan yang tidak pernah dibersihkan
setelah selesai.

Greenfield berarti seeding ulang dari awal. Kalau kelak butuh jalur impor lagi,
tempatnya schema `staging` terpisah — bukan `master_data`, yang isinya harus
data final saja.

**Keduanya menahan 8 kolom di model lain** (`candidate_vendor_id`,
`confirmed_vendor_id`, `promoted_material_id`, `promoted_sample_id`, dan
pasangan relasinya). Membuangnya membersihkan lebih dari dua tabel.

---

## Bagian D — Optimasi yang tidak bisa dinyatakan Prisma

Prisma tidak bisa mendeklarasikan partial index, expression index, generated
column, atau GIN. Semuanya masuk migrasi SQL. **Tanpa bagian ini, empat
invariant di §B tidak ditegakkan apa pun.**

```sql
-- 1. Tepat satu harga berlaku per (SKU × supplier).
--    COALESCE wajib: supplier_party_id nullable, dan NULL ≠ NULL di Postgres,
--    jadi index polos akan meloloskan dua baris is_current bersupplier kosong.
CREATE UNIQUE INDEX skuprice_current_uniq
  ON master_data."SkuPrice" (sku_id, COALESCE(supplier_party_id, '00000000-0000-0000-0000-000000000000'))
  WHERE is_current;

-- 2. Kode SKU unik untuk material tanpa brand.
--    @@unique([brand_id, code]) tidak menjaga baris ber-brand_id NULL.
CREATE UNIQUE INDEX sku_code_nobrand_uniq
  ON master_data."Sku" (lower(code))
  WHERE brand_id IS NULL AND deleted_at IS NULL;

-- 3. Tepat satu kategori utama per SKU.
CREATE UNIQUE INDEX skucategory_primary_uniq
  ON master_data."SkuCategory" (sku_id)
  WHERE is_primary;

-- 4. total_price tidak mungkin menyimpang dari komponennya.
ALTER TABLE master_data."WorkPrice"
  DROP COLUMN total_price,
  ADD COLUMN total_price NUMERIC(16,2)
    GENERATED ALWAYS AS (COALESCE(material_price,0) + COALESCE(labor_price,0)) STORED;

-- 5. Baris hidup saja di index. Tabel yang 40% isinya soft-deleted membuat
--    index penuh membaca baris yang tidak akan pernah ditampilkan.
CREATE INDEX sku_active_idx   ON master_data."Sku" (kind, status) WHERE deleted_at IS NULL;
CREATE INDEX party_active_idx ON master_data."Party" (type)       WHERE deleted_at IS NULL;

-- 6. spec JSON tetap bisa dicari.
CREATE INDEX sku_spec_gin       ON master_data."Sku"       USING GIN (spec jsonb_path_ops);
CREATE INDEX workprice_spec_gin ON master_data."WorkPrice" USING GIN (spec jsonb_path_ops);

-- 7. Pencarian nama produk di picker — substring, bukan prefix.
--    Tanpa pg_trgm, `name ILIKE '%walnut%'` selalu sequential scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX sku_name_trgm  ON master_data."Sku"   USING GIN (name gin_trgm_ops);
CREATE INDEX party_name_trgm ON master_data."Party" USING GIN (name gin_trgm_ops);
```

**Yang sengaja TIDAK dilakukan:**

- **Tanpa `citext`.** Dedup case-insensitive ditangani kolom `slug` yang sudah
  ternormalisasi. `citext` menular ke setiap perbandingan dan memecahkan
  kesetaraan dengan cara yang mengejutkan orang enam bulan kemudian.
- **Tanpa partisi tabel.** Volumenya ribuan baris, bukan puluhan juta.
  Partisi pada data sekecil ini hanya menambah ongkos rawat.
- **Tanpa materialized view "harga termurah".** `is_current` + index sudah
  membuatnya satu index scan. MV butuh strategi refresh, dan strategi refresh
  butuh orang yang mengingatnya.

---

## Bagian E — Peta migrasi v1 → v2

Greenfield tetap butuh urutan. Yang di bawah bukan roadmap eksekusi (itu ada di
`roadmap.md` §M) — hanya pemetaan datanya.

| v2 | Sumber v1 | Yang perlu diputuskan manusia |
|---|---|---|
| `Party` | `Company` ∪ `ServiceVendor` | Nama bertabrakan antar dua sumber → gabung atau pisah |
| `PartyRole` | tebak dari asal: Company→`MANUFACTURER`, ServiceVendor→`SERVICE_VENDOR` | Peran tambahan (`RETAIL`, `SUBCON`) tidak ada di v1 — isi manual |
| `Brand.owner_party_id` | `Brand.company_id` | langsung |
| `BrandSupplier` | **tidak ada di v1** | Seluruhnya entri manual |
| `Category` (PRODUCT) | `Category` + `Sku.catalog_tags` distinct | Induk tiap kategori belum ada di v1 — tentukan manual |
| `Category` (WORK) | `ServicePrice.vendor_category`/`category` + `MaterialLaborPrice.*` distinct | String yang mirip tapi tidak identik → putuskan mana yang sama |
| `Sku` | `Sku`, buang prefix `catalog_` | `catalog_brand` dibuang (denormalisasi dari relasi) |
| `SkuPrice` | `MaterialPrice` + `Sku.catalog_price*` | v1 punya harga di **dua** tempat; yang bertentangan butuh keputusan |
| `WorkPrice` | `ServicePrice` (material NULL) ∪ `MaterialLaborPrice` | `code` bertabrakan antar dua sumber |
| `Sample` | `Sample` | langsung |

**Titik paling berisiko: `Sku.catalog_price` vs `MaterialPrice`.** v1 menyimpan
harga di dua tempat tanpa satu pun yang dinyatakan sebagai sumber kebenaran.
Setiap SKU yang punya keduanya dan angkanya berbeda adalah keputusan manusia,
bukan `COALESCE`. Skrip migrasi harus **melaporkan** konflik ini dan berhenti,
bukan memilih salah satu — pola yang sama sudah dipakai
`move-brand-legal-name-to-company.mjs` dan alasannya tercatat di roadmap §A5.

---

## Bagian F — Master Data sebagai SSOT

Dua konsumen: **Library StudioFlow** (sekarang) dan **BQ** (nanti). SSOT bukan
sifat yang muncul sendiri dari skema yang rapi — ia sifat yang harus ditegakkan
di batas antar app. Bagian ini yang menegakkannya.

### F.1 Koreksi atas klaim §B.7

§B.7 menyebut "nol FK ke `studioflow`" sebagai capaian v2. **Itu terlalu murah
hati pada v2** — arah ketergantungannya sudah benar di v1:

```
FK studioflow → master_data : 5   (semuanya nullable)
FK master_data → studioflow : 0
```

| FK | Model |
|---|---|
| `ProjectProductRequest.brand_id` | → `Brand` |
| `ProjectProductRequest.sku_id` | → `Sku` |
| `ProjectProductRequest.linked_sample_id` | → `Sample` |
| `ProjectScheduleOption.sku_id` | → `Sku` |
| `ProjectScheduleOption.spec_brand_id` | → `Brand` |

Jadi `master_data` **sudah** berdiri sendiri secara struktur. Yang harus dijaga
v2 adalah **tetap** begitu — bukan mencapainya. Ketergantungannya nyata di tiga
tempat lain, dan ketiganya tidak terlihat di diagram relasi:

| Coupling | Bentuknya | Ongkosnya |
|---|---|---|
| **Tipe** | `Prisma.SkuGetPayload<>`, `Prisma.SampleGetPayload<>` di `extensions/library/types.ts` | Ganti nama satu kolom `master_data` → tipe StudioFlow gagal kompilasi |
| **Query** | `tx.sku`, `tx.brand`, `tx.category`, `tx.sample` langsung dari `library-service.ts` (48 pemanggilan) | Tidak ada permukaan yang bisa distabilkan; setiap query jalur sendiri |
| **Tulis** | 21 operasi tulis ke `master_data` dari luar app Master Data | §F.2 — ini yang paling merusak |

### F.2 Yang merusak SSOT hari ini: konsumennya menulis

SSOT berarti **satu penulis, banyak pembaca**. Hari ini `master_data` punya
setidaknya tiga penulis.

```
extensions/library/services/library-service.ts   20 operasi tulis
  tx.sku.create/update/updateMany, tx.brand.create/update/upsert,
  tx.category.create/update, tx.brandCategory.upsert, tx.sample.create/update,
  tx.materialPrice.updateMany, tx.sampleMovementLog.create

lib/services/settings-service.ts                  1 operasi tulis
```

Pemanggil `library-service.ts` bukan hanya app Master Data — juga
`extensions/schedule` dan `extensions/sketchup`.

**Contoh paling tajam, dan yang paling mudah dianggap tidak berbahaya:**

`settings-service.ts:342`. Mengganti nama satu kategori schedule di **Studio
settings StudioFlow** menulis ulang `Sku.catalog_tags` di seluruh
`master_data`. Sebuah pengaturan milik StudioFlow mengubah klasifikasi produk
milik Master Data, dalam satu transaksi, tanpa Master Data pernah tahu.

Itu bukan cacat kecil yang bisa dirapikan belakangan — itu definisi *bukan*
SSOT. Selama jalur ini ada, pertanyaan "kategori produk ini apa" punya dua
jawaban yang sah tergantung siapa yang terakhir menulis.

**Aturan v2, dan ini yang paling penting di seluruh dokumen:**

> **Hanya app Master Data yang menulis ke schema `master_data`.**
> StudioFlow dan BQ membaca. Titik.
>
> Kalau StudioFlow perlu sesuatu masuk Master Data — SKU baru dari barang yang
> baru datang, kategori baru — ia **mengajukan**, tidak menulis.
> `ProjectProductRequest` sudah bentuk yang benar untuk itu dan sudah ada;
> yang kurang hanya penegakan bahwa tidak ada jalan pintas di sebelahnya.

### F.3 Tiga permukaan baca, bukan satu

"SSOT" tidak berarti semua orang melihat hal yang sama. Ia berarti angkanya
berasal dari satu tempat. Apa yang boleh dilihat tetap berbeda per konsumen:

| Permukaan | Untuk | Menjawab |
|---|---|---|
| `v_library_brand` | StudioFlow Library | *Merek apa yang punya kategori ini, dan katalognya di mana?* |
| `v_bq_material_rate`, `v_bq_work_rate` | BQ | *Ini berapa, satuannya apa, dari siapa?* |
| tabel langsung | app Master Data saja | semuanya |

> **Lingkup Library dipersempit — keputusan owner 2026-08-10.**
>
> Library StudioFlow hanya mengambil **Table 1 kolom A–G**: Company, Brand,
> Product Brand, Category, dan tiga kolom Link (Google Drive, Website, Socmed).
> Layarnya: cari kategori/tag → muncul **card brand** → bisa disortir dan
> difilter per kategori / per company / per brand. **Tiap card hanya
> memunculkan link.**
>
> Akibatnya `v_library_item` — view tingkat SKU — **tidak jadi dibuat.** Library
> tidak melihat produk, tidak melihat harga, tidak melihat sampel. Rinciannya di
> §F.4a.

Bentuknya **view Postgres**, bukan hanya tipe TypeScript.

**Kenapa view, padahal DTO TypeScript lebih gampang.** Aturan visibilitas hari
ini adalah array TypeScript — `ALLOWED_LINK_KINDS` di `brand-library-service.ts`
— dan komentarnya sendiri menyebut sifat yang membuatnya bekerja:

> *"The allowlist stays closed-world regardless: a new `BrandLinkKind` is
> invisible until deliberately added, and filtering happens at the query
> boundary, not in the component — a component-level filter still ships the
> excluded data over the wire."*

Alasan itu benar, dan justru karena itu ia harus turun satu tingkat lagi. Array
TS menjaga *jalur query yang memakainya*. Jalur query **baru** — dan
`library-service.ts` sudah punya 48 di antaranya — tidak tahu array itu ada.
View memindahkan closed-world dari "harus diingat" jadi "default": kolom baru di
tabel tidak terlihat sampai sengaja ditambahkan ke view, oleh query apa pun.

Ditegakkan di level hak akses, bukan kesepakatan:

```sql
REVOKE SELECT ON ALL TABLES IN SCHEMA master_data FROM studioflow_app;
GRANT  SELECT ON master_data.v_library_brand TO studioflow_app;
GRANT  SELECT ON master_data.v_bq_material_rate, master_data.v_bq_work_rate TO bq_app;
```

**DTO TypeScript tetap dibutuhkan** — tapi sebagai *tipe tulis tangan* di
`masterdata/contracts/`, bukan `Prisma.SkuGetPayload<>`. Keduanya bekerja di
lapis berbeda: view menegakkan apa yang bisa dibaca, DTO menegakkan bahwa
StudioFlow tidak lagi mengkompilasi tipenya dari skema Master Data.

### F.4 `v_library_brand` — satu view, tujuh kolom

Lingkupnya persis Table 1 kolom A–G. Tidak lebih.

```sql
CREATE VIEW master_data.v_library_brand AS
SELECT
  b.id                AS brand_id,
  b.name              AS brand_name,      -- Table 1 kolom C "Product Brand"
  b.slug              AS brand_slug,
  p.id                AS company_id,
  p.name              AS company_name,    -- Table 1 kolom B "Brand"
  p.legal_name        AS company_legal_name, -- Table 1 kolom A "Company"
  -- Table 1 kolom D. Array supaya filter kategori satu query.
  ARRAY(SELECT c.name FROM master_data."BrandCategory" bc
        JOIN master_data."Category" c ON c.id = bc.category_id
        WHERE bc.brand_id = b.id ORDER BY bc.sort_order)          AS categories,
  ARRAY(SELECT c.slug FROM master_data."BrandCategory" bc
        JOIN master_data."Category" c ON c.id = bc.category_id
        WHERE bc.brand_id = b.id ORDER BY bc.sort_order)          AS category_slugs,
  -- Table 1 kolom E-G. Hanya kind yang ada di Excel.
  (SELECT jsonb_agg(jsonb_build_object(
       'kind', l.kind, 'url', COALESCE(l.archive_url, l.url), 'label', l.label)
     ORDER BY l.sort_order)
   FROM master_data."BrandLink" l
   WHERE l.brand_id = b.id
     AND l.kind IN ('DRIVE','WEBSITE','INSTAGRAM','FACEBOOK','TIKTOK',
                    'YOUTUBE','LINKEDIN'))                        AS links
FROM master_data."Brand" b
LEFT JOIN master_data."Party" p ON p.id = b.owner_party_id
WHERE b.deleted_at IS NULL AND b.is_active;
```

**Yang TIDAK ada di view ini, dan itu inti keputusannya:**

| Tidak diekspos | Kenapa |
|---|---|
| `Sku` — seluruh produk | Card hanya memunculkan link. Katalognya dibuka di Drive/website milik brand |
| `SkuPrice` — harga apa pun | Tidak ada baris produk untuk ditempeli harga |
| `PartyContact` — kontak/sales | Keputusan owner *"tidak usah"*, masih berlaku |
| `Sample` — rak/box | Operasional Master Data |
| `WorkPrice` — tarif jasa | Library katalog merek, bukan daftar tarif |
| `BrandLink` kind `PRICE_LIST`, `MARKETPLACE`, `WHATSAPP`, `CATALOG`, `OTHER` | **Tidak ada di Table 1.** Kolomnya hanya Drive, Website, Socmed |

**Ini membatalkan dua keputusan lama, dan keduanya perlu disadari:**

1. **Harga di Library.** Owner 1 Agu 2026: *"ada harga ga masalah"* — yang
   membatalkan aturan §6.3/§6.14 "price must never be reachable from StudioFlow".
   Dengan lingkup baru, keputusan itu jadi **tidak berlaku lagi bukan karena
   dibatalkan, tapi karena tidak ada tempatnya**: Library tidak menampilkan satu
   pun baris produk.
2. **`PRICE_LIST` dan `MARKETPLACE` di allowlist.** Keduanya masuk
   `ALLOWED_LINK_KINDS` justru sebagai akibat keputusan (1). Sekarang keduanya
   keluar — bukan karena harga jadi rahasia lagi, tapi karena Table 1 tidak
   mencantumkannya.

Efeknya di layar: link "Price list" dan "Marketplace" yang hari ini muncul di
`BrandLibraryExplorer` akan hilang. Kalau itu tidak diinginkan, `PRICE_LIST` dan
`MARKETPLACE` tinggal ditambahkan ke daftar `kind` di view — tapi itu
penyimpangan dari Table 1 dan karena itu perlu diputuskan, bukan diasumsikan.

### F.4a Yang ikut mati dari Library lama

Lingkup lama (`search-a-brand → view-its-catalog`) membaca `Sku`, `Sample`, dan
`Category` langsung. Yang hilang bersamanya:

| Berkas / tipe | Nasib |
|---|---|
| `SkuWithRelations`, `ProductCatalogWithRelations`, `attachDerivedCatalogFields` | mati — tidak ada SKU di Library |
| `LibrarySampleRow`, `BrandCategoryCoverage` | mati |
| `ProductCatalogInput`, `ProductCatalogValidationSchema`, `CatalogApprovalValidationSchema` | pindah ke app Master Data, bukan `extensions/library` |
| 20 operasi tulis di `library-service.ts` | pindah ke app Master Data (§F.2) |
| `brand-library-service.ts` — pencarian brand per kategori | **tetap**, ini justru yang jadi seluruh Library |

**Yang masih perlu diputuskan dan bukan bagian Library:** Schedule dan SketchUp
juga membaca `Sku` (`ProjectScheduleOption.sku_id`, `addEntryToSchedule`
`mode:"catalog"`, `SkuPicker`). Itu **permukaan ketiga**, bukan Library —
pertanyaannya ada di §G.

### F.5 Lima FK jadi kolom biasa

Kelimanya di §F.1 diubah jadi `String?` polos + snapshot nama, pola yang sama
dengan `WorkPriceProjectRef.project_id` (§B.7).

**Yang hilang, dinyatakan terang-terangan:** `onDelete: SetNull` hari ini memberi
jaminan nyata — menghapus SKU membuat rujukannya jadi NULL, bukan menggantung.
Tanpa FK, jaminan itu hilang dan jalur baca harus menangani id yang menunjuk
baris yang sudah tidak ada.

**Yang membuatnya tetap aman, dan ini bukan kebetulan:**
`ProjectScheduleOption.data_snapshot` sudah membekukan seluruh isi produk pada
saat dipilih. Id yang menggantung berarti "produknya sudah tidak ada di katalog"
— dan tampilannya tetap utuh dari snapshot. Schedule proyek yang sudah berjalan
memang **harus** menampilkan apa yang dipilih dulu, bukan apa yang ada sekarang.

Itu berarti FK-nya selama ini menjaga sesuatu yang snapshot sudah jaga lebih
baik. Membuangnya bukan menurunkan jaminan; ia membuang jaminan ganda yang
mengikat dua schema.

`ProjectProductRequest` beda: ia **belum** punya snapshot, karena permintaan
memang dibuat sebelum produknya ada. Butuh dua kolom snapshot nama
(`brand_name_snapshot`, `sku_name_snapshot`) sebelum FK-nya dilepas.

### F.6 `ScheduleSnapshot` sudah kontrak — kosakatanya yang salah

`src/lib/validations/schedule-snapshot.ts` sudah tepat bentuknya: zod, ditulis
tangan, milik StudioFlow, **tidak** diturunkan dari Prisma. Ia bertahan melewati
perubahan skema apa pun karena tidak pernah menyentuhnya.

Yang salah hanya kosakatanya. Ia bicara `catalog_brand`, `catalog_sub_category`,
`catalog_vendor_id`, `catalog_price` — nama kolom `master_data` **v1** yang
dipinjam apa adanya. Komentar di `library/types.ts` sudah mengakui akibatnya:

> *"`catalog_brand`, `catalog_category` dan `catalog_sub_category` adalah
> DERIVED, bukan kolom… mereka bertahan sebagai field read-only karena
> `data_snapshot` adalah JSON beku yang sudah ditulis untuk setiap proyek, dan
> ia bicara dengan nama-nama ini."*

Meminjam nama kolom membuat kontraknya **terlihat** stabil sambil sebenarnya
mengikuti tabel. v2 memutus itu: snapshot bicara bahasa kontrak
(`brand_name`, `category`, `price`), bukan bahasa tabel.

**Snapshot yang sudah ada tidak boleh ditulis ulang.** Ia catatan keputusan yang
pernah diambil. Yang ditambahkan `snapshot_version`, dan pembacanya menerjemahkan
v1 → v2 saat dibaca. Migrasi JSON beku untuk kerapian nama adalah menulis ulang
sejarah demi kosmetik.

### F.7 Tiga tuntutan SSOT pada skema, dan pelanggaran v1

| Tuntutan | Pelanggaran v1 | v2 |
|---|---|---|
| **Satu angka satu tempat** | Harga ada di `Sku.catalog_price` **dan** `MaterialPrice`, tanpa satu pun dinyatakan benar | Hanya `SkuPrice` |
| **Satu identitas satu tempat** | `Sku.catalog_brand` menyalin `brand.brand_name`; tabel Materials menandai baris yang keduanya berbeda sebagai *drift needing repair* | Nama merek hanya di `Brand` |
| **Satu penulis** | 21 operasi tulis dari luar app Master Data | §F.2 |

Yang ketiga tidak bisa diselesaikan skema. Ia keputusan arsitektur yang harus
ditegakkan hak akses database — `GRANT`/`REVOKE` di §F.3 — karena kesepakatan
tim tidak bertahan melewati orang yang tidak membaca dokumen ini.

---

## Bagian G — Pertanyaan yang masih terbuka

> **Daftar lengkap 23 pertanyaan beserta rekomendasi ada di
> `docs/TANYA-SEBELUM-EKSEKUSI.md`.** Yang di bawah adalah yang menyentuh bentuk
> skema; sisanya soal data, lingkungan, dan cara kerja eksekusi.

**Celah yang ditemukan setelah dokumen ini ditulis: `Sku.code` wajib, padahal
sumbernya tidak punya kolom SKU.**

`docs/masterdata-seed/BUILD_SUMMARY.json` mencatat
`source_has_explicit_sku_column: false` dan `fake_sku_generation: false` —
workbook sumbernya tidak punya kolom SKU sama sekali, dan impor 31 Juli sengaja
menolak mengarangnya. Draft v2 membuat `code` wajib dan mengunci
`@@unique([brand_id, code])`, yang berarti tidak satu pun dari 756 kandidat bisa
masuk tanpa kode artikel yang diketik satu per satu.

Kode artikel pabrikan adalah *fakta tentang barang*, bukan *kunci basis data*.
Menjadikannya wajib memaksa mengarang fakta. Rekomendasi: `code` nullable,
identitas kanonik pindah ke `slug`. Menunggu jawaban — Q7.

**Sudah terjawab 2026-08-10** (rincian di `docs/TANYA-SEBELUM-EKSEKUSI.md`):
Q1–Q23 ikut rekomendasi, `Sample` dipertahankan, `code` jadi nullable, lingkup
Library dipersempit ke Table 1 kolom A–G. Pertanyaan harga/supplier di Library
(dulu nomor 1 di sini) **gugur sendiri** — Library tidak lagi menampilkan produk.

Yang **baru terbuka** setelah lingkup Library dipersempit:

1. **Schedule dan SketchUp masih boleh memilih SKU dari Master Data?**

   Library sekarang berhenti di card brand + link. Tapi `ProjectScheduleOption`
   punya `sku_id`, `addEntryToSchedule` punya `mode:"catalog"`, dan `SkuPicker`
   masih hidup — itu **permukaan ketiga**, bukan Library.

   | Opsi | Akibat |
   |---|---|
   | (a) Schedule tetap boleh pilih SKU | Butuh view keempat, `v_schedule_item`. Isi dan aturan visibilitasnya perlu diputuskan sendiri |
   | (b) Schedule hanya isi manual + `ProjectProductRequest` | Master Data cukup satu view untuk StudioFlow. Desainer memilih dari katalog Drive brand, lalu mengetik atau mengajukan |

   Ini menentukan apakah StudioFlow butuh satu view atau dua, jadi harus dijawab
   sebelum M4.

2. **`PRICE_LIST` dan `MARKETPLACE` benar-benar keluar dari card brand?**

   Keduanya ada di allowlist hari ini, tapi **tidak ada di Table 1** — kolom Link
   di sana hanya Google Drive, Website, Socmed. Mengikuti Excel berarti keduanya
   hilang dari layar. Kalau tetap diinginkan, itu penyimpangan dari Table 1 dan
   perlu diputuskan, bukan diasumsikan.

3. **Riwayat harga v1 diselamatkan?** Menunggu hasil `count-masterdata.mjs`.
   Kalau `MaterialPrice` nol baris — dan `BUILD_SUMMARY` menyiratkan begitu —
   pertanyaan ini gugur juga.

4. **Tiga penyimpangan yang paling saya ragu**, ada di
   `docs/PENYIMPANGAN-DARI-EXCEL.md`: X9 (pecah `Sku`/`SkuPrice`), X10
   (`Material` vs `Category` di Table 2), X12 (`Qty` → `pack_size`).

**Ditutup sementara — bentuk yang BQ butuhkan.** Keputusan owner 2026-08-10: BQ
ditangguhkan; Master Data dikerjakan lebih dulu sebagai SSOT-nya. Yang membuat
penangguhan ini aman adalah `v_bq_material_rate` / `v_bq_work_rate` (§F.3):
selama BQ membaca **view**, bentuk akhir yang ia butuhkan bisa diubah dengan
menulis ulang view — tanpa migrasi tabel dan tanpa menyentuh Library.

Itu justru alasan terkuat memakai view sejak awal, bukan setelah BQ ada.
Membangun BQ langsung di atas tabel akan membekukan bentuk `SkuPrice` dan
`WorkPrice` pada tebakan pertama.

---

## Lampiran — Peta relasi

```
Party ─┬─< PartyRole
       ├─< PartyContact
       ├─< PartyLink
       ├─< Brand (owner)                      [SetNull]
       ├─< BrandSupplier                      [Cascade]
       ├─< SkuPrice (supplier)                [SetNull]
       └─< WorkPrice (vendor)                 [SetNull]

Brand ─┬─< BrandLink ──< SkuPrice (source)    [SetNull]
       ├─< BrandCategory >── Category         [Restrict]
       ├─< BrandSupplier >── Party
       └─< Sku                                [Restrict]

Category ─┬── Category (parent, self)         [Restrict]
          ├─< BrandCategory
          ├─< SkuCategory
          └─< WorkPrice

Sku ─┬─< SkuCategory >── Category             [Restrict]
     ├─< SkuMedia                             [Cascade]
     ├─< SkuPrice                             [Cascade]
     └─< Sample                               [Restrict]

WorkPrice ──< WorkPriceProjectRef             [Cascade]
                └── project_id : kolom biasa, TANPA FK

Sample ──< SampleMovement                     [Cascade]

MasterDataAudit : berdiri sendiri, tanpa FK
```

**Pola `onDelete` yang dipegang:**

| Aturan | Contoh | Alasan |
|---|---|---|
| `Cascade` untuk yang tidak punya arti sendiri | `PartyContact`, `SkuMedia`, `SkuPrice` | kontak tanpa perusahaan bukan apa-apa |
| `Restrict` untuk yang menahan riwayat | `Sku → Sample`, `Category → SkuCategory` | menghapus SKU yang sampelnya masih di rak adalah kekeliruan, bukan niat |
| `SetNull` untuk rujukan opsional | `Brand.owner_party_id`, `SkuPrice.supplier_party_id` | kehilangan supplier tidak boleh menghapus harganya |
