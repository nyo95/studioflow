# Analisa Skema Master Data — SSOT StudioFlow

**Tanggal:** 2026-08-06
**Ruang lingkup:** seluruh schema `master_data` + halaman Master Data
**Sumber:** `prisma/schema.prisma` (1411 baris), `material-view-service.ts`, komponen Master Data
**Status:** analisa — belum ada perubahan kode

---

## Ringkasan Eksekutif

Empat pertanyaan yang diajukan ternyata menunjuk ke **tiga redundansi nyata** dan
**satu masalah navigasi**. Satu di antaranya (harga material) adalah bug diam yang
sudah aktif sekarang.

| # | Temuan | Tingkat | Status |
|---|--------|---------|--------|
| 1 | Harga material tersimpan di dua tempat — `Sku.catalog_price*` vs tabel `MaterialPrice` | 🔴 Kritis | Aktif, menyebabkan "172 dari 172 belum lengkap" |
| 2 | Tiga sistem kategori paralel (`Category`, `catalog_tags`, kolom `category` free-text) | 🟠 Sedang | Vocabulary drift mulai terjadi |
| 3 | `Brand.legal_name` duplikat `Company.legal_name` setelah R7 | 🟡 Rendah | Baru muncul, mudah ditutup |
| 4 | ServiceVendor terpisah dari halaman Supplier | 🟡 Navigasi | Bukan masalah schema |

---

## 1. Harga Material — Redundansi Kritis

### Kondisi saat ini

Harga material tersimpan di **dua tempat berbeda** yang tidak saling tahu:

**A. Inline di `Sku`** (legacy, dari §6.12)

```prisma
model Sku {
  catalog_price            Float?    @map("price_after_discount")
  catalog_vendor_price     Float?    @map("price_before_discount")
  catalog_price_unit       String?   @map("price_unit")
  catalog_price_updated_at DateTime? @map("price_updated_at")
}
```

**B. Tabel `MaterialPrice`** (§6.14, desain terbaru)

```prisma
model MaterialPrice {
  brand_id              String     // required
  sku_id                String?    // OPSIONAL
  item_description      String
  price_before_discount Float?
  price_after_discount  Float?
  unit                  String?
  valid_from            DateTime?
  source_link_id        String?    // → BrandLink kind PRICE_LIST
}
```

### Bukti bug yang sedang aktif

`material-view-service.ts` baris 121–143 menghitung `bqReady` dari kolom **inline**:

```ts
const priceBeforeDiscount = product.catalog_vendor_price ?? null;
const priceAfterDiscount  = product.catalog_price ?? null;
const priceUnit           = product.catalog_price_unit ?? null;

bqReady: priceBeforeDiscount !== null
      && priceAfterDiscount  !== null
      && Boolean(priceUnit),
```

Sementara halaman **Harga → Tab "Harga Material"** menulis ke tabel `MaterialPrice`.

**Konsekuensi:** staff bisa mengisi harga lengkap di Tab Harga Material untuk 172
material, dan halaman Materials **tetap** menampilkan "Harga belum lengkap: 172".
Dua sistem, nol komunikasi.

### Jawaban atas pertanyaan #1

> *"tab materials berarti bisa jadi sub part dari harga: material kan ya? karena mengandung SKU?"*

Arahnya benar bahwa keduanya berhubungan, tapi hubungannya **kebalikan** dari
"Materials sub-part dari Harga". Yang tepat:

- **`Sku` = identitas produk.** Apa barangnya, warna, dimensi, foto, sample fisik
  di rak. Satu baris = satu artikel yang bisa diidentifikasi.
- **`MaterialPrice` = harga.** Berapa harganya, dari price-list mana, berlaku sejak
  kapan, siapa yang update.

Ini **bukan** redundansi — ini pemisahan yang benar, dan alasannya sudah tertulis
di komentar schema sendiri:

> *"Pricing detached from Sku: most price-list rows describe an item that was
> never physically received, so tying price to sample custody was the wrong
> dependency."*

Artinya: 90% baris di price-list supplier adalah item yang tidak pernah sampai ke
kantor, tidak punya sample, tidak layak jadi `Sku`. Tapi BQ tetap butuh harganya.
`MaterialPrice.sku_id` nullable persis untuk kasus ini.

Yang **redundant** adalah kolom `catalog_price*` di `Sku` — sisa desain lama yang
belum dipensiunkan.

### Rekomendasi

1. **Pensiunkan `Sku.catalog_price*`.** Jangan drop kolomnya dulu (ada snapshot
   `ProjectScheduleOption.data_snapshot` yang membekukan nama field ini). Cukup:
   - Hentikan penulisan ke kolom tersebut dari UI
   - Ubah `bqReady` supaya baca dari `MaterialPrice` aktif
2. **Halaman Materials tampilkan harga read-only** dari `MaterialPrice` terbaru
   (`valid_from` desc), dengan tombol "Kelola harga" yang membuka Tab Harga Material
   ter-filter ke SKU tersebut.
3. **Definisi "Siap BQ" baru:** SKU punya minimal satu `MaterialPrice` aktif dengan
   `price_after_discount` dan `unit` terisi.

---

## 2. Kategori — Tiga Sistem Paralel

### Kondisi saat ini

| Sistem | Model | Level | Tipe | Asal |
|--------|-------|-------|------|------|
| A | `Category` + `BrandCategory` | Brand | Kanonik, slug-unique | §6.14 |
| B | `Sku.catalog_tags String[]` | Produk | Free text array | §6.12 (legacy) |
| C | `MaterialPrice.category` | Harga | Free text | §6.14 |
| D | `ServicePrice.vendor_category` + `.category` | Harga jasa | Free text, 2 level | R8 |

Kolom **"KATEGORI TAGS"** di screenshot halaman Materials ("Wall finish", "Tile")
adalah sistem **B** — free text array, bukan `Category` kanonik.

Komentar di schema untuk `Category` menyebut alasan sistem A dibuat:

> *"Free tags were tried in §6.12 and reversed here on purpose: once category
> search IS the Library, the 'Sanitary'/'sanitary' duplication §6.11 diagnosed
> would corrupt the one surface that matters most."*

Pembalikan itu **hanya diterapkan di level Brand**. Level produk masih pakai free
text — jadi masalah yang sama persis akan terulang di sana.

### Jawaban atas pertanyaan #2

> *"kategori / tags yg di maksud gmn kalau kita ubah - kategori per product dan kategori per brands?"*

**Idenya benar dan justru sudah setengah jalan.** Dua level kategori memang perlu,
karena keduanya menjawab pertanyaan berbeda:

- **Kategori Brand** — *"brand ini jual apa?"*
  Dipakai designer saat browsing Library: "cari brand yang jual terazzo".
  Satu brand bisa punya banyak kategori.

- **Kategori Produk** — *"item ini apa?"*
  Dipakai BQ untuk sectioning dokumen, dan filter di halaman Materials.
  Lebih spesifik: brand "Dphaus" jual Tile, tapi SKU tertentu adalah "Terrazzo Tile".

Yang perlu diperbaiki: **level produk jangan free text.** Pakai vocabulary yang sama.

### Rekomendasi

Satu vocabulary (`Category`), dua titik attachment:

```prisma
model Category {
  id       String @id
  name     String @unique
  slug     String @unique
  /// BARU: level mana kategori ini boleh dipakai
  scope    CategoryScope @default(BOTH)   // BRAND | PRODUCT | BOTH
  brands   BrandCategory[]
  skus     SkuCategory[]                  // BARU
}

/// BARU — menggantikan Sku.catalog_tags
model SkuCategory {
  sku_id      String
  category_id String
  sort_order  Int @default(0)
  @@unique([sku_id, category_id])
}
```

**Migrasi `catalog_tags` → `SkuCategory`:**
1. Kumpulkan distinct value dari semua `catalog_tags`, normalisasi ke slug
2. Buat/match ke `Category` yang sudah ada
3. Isi `SkuCategory`
4. `catalog_tags` tetap ada sebagai kolom (snapshot compatibility), tapi
   read-only — tidak lagi ditulis dari UI

**Kolom `category` free-text di `MaterialPrice` / `ServicePrice`:** biarkan.
Ini kategori untuk *sectioning dokumen BQ*, bukan untuk search Library. Beda
kegunaan, beda toleransi terhadap drift. Kalau nanti mau dirapikan, itu proyek
terpisah setelah BQ jalan dan pola sectioning-nya stabil.

---

## 3. `Brand.legal_name` vs `Company.legal_name`

### Kondisi saat ini

```prisma
model Company {
  name       String  @unique   // "TACO Group"
  legal_name String?           // "PT Tangkas Cipta Optimal"
}

model Brand {
  brand_name String  @unique @map("vendor_name")   // "TACO"
  legal_name String?                                // "PT Tangkas Cipta Optimal"  ← duplikat
  company_id String?                                // → Company
}
```

Screenshot form Tambah Brand menampilkan **"Perusahaan (opsional)"** dan
**"Badan usaha (PT / CV)"** berdampingan — dua field yang, ketika Company terisi,
menyimpan informasi yang sama.

### Jawaban atas pertanyaan #3

> *"masih ada redudansi antara perusahaan dan badan usaha di brand?"*

**Ya, benar.** Tapi ini redundansi transisi, bukan cacat desain:

- Sebelum R7 (2026-08-05): `Brand.legal_name` adalah satu-satunya tempat menyimpan
  badan usaha. Wajar ada.
- Setelah R7: `Company` jadi pemilik kanonik badan usaha. `Brand.legal_name`
  jadi duplikat — **untuk brand yang punya Company**.
- Untuk brand tanpa Company (392 baris saat ini), `Brand.legal_name` masih satu-satunya
  tempat. Belum bisa dibuang.

### Rekomendasi

**Fase 1 — UI (bisa sekarang, tanpa migrasi):**

Field "Badan usaha" di form Brand jadi kondisional:
- `company_id` terisi → field disembunyikan, ganti tampilan read-only
  `company.legal_name` dengan catatan "dari perusahaan"
- `company_id` kosong → field aktif seperti sekarang, dengan hint
  "atau assign ke Perusahaan untuk mewarisi badan usaha"

Ini langsung menghilangkan kebingungan tanpa menyentuh data.

**Fase 2 — setelah backfill Company selesai:**

1. Untuk setiap Brand dengan `company_id` terisi dan `legal_name` terisi:
   - Jika `Company.legal_name` NULL → pindahkan nilai Brand ke Company
   - Jika sama → kosongkan `Brand.legal_name`
   - Jika beda → flag untuk review manual (kemungkinan Company salah assign)
2. Setelah nol konflik, `Brand.legal_name` jadi fallback murni: hanya terisi
   untuk brand yang memang tidak punya Company

**Jangan** drop kolomnya — brand independen tanpa Company adalah kasus sah.

---

## 4. ServiceVendor → Halaman Supplier

### Jawaban atas pertanyaan #4

> *"tab tukang/vendor harusnya pindah ke supplier aja? jadi 1 (hal2 eksternal). jadi ada supplier material, supplier jasa?"*

**Setuju untuk halaman. Tidak setuju untuk schema.**

**Kenapa setuju di level halaman:** `Company` dan `ServiceVendor` menjawab
pertanyaan mental yang sama — *"siapa pihak luar yang kita ajak kerja sama?"*.
Staff yang mau menambah kontak baru tidak seharusnya perlu tahu apakah pihak itu
menjual barang atau jasa untuk menemukan formnya. Menempatkan ServiceVendor di
dalam halaman Harga membuat "daftar mitra" tersebar di dua tempat.

**Kenapa tidak setuju di level schema:** struktur keduanya berbeda secara
fundamental, dan menyatukannya jadi satu tabel `Partner` dengan enum `type` akan
merusak lebih banyak dari yang diperbaiki:

| Aspek | Company | ServiceVendor |
|-------|---------|---------------|
| Kedalaman | 3 level: Company → Brand → Sku | 2 level: Vendor → Price |
| Kontak | Tabel terpisah `CompanyContact[]` | Kolom flat `phone_number`, `email` |
| Link | Tabel terpisah `CompanyLink[]` | Tidak ada |
| Punya harga langsung? | Tidak — harga menempel ke Brand | Ya — `ServicePrice`, `MaterialLaborPrice` |
| Punya "merek"? | Ya, itu inti modelnya | Tidak — tukang tidak punya merek |

Satu tabel gabungan berarti setengah kolomnya selalu NULL tergantung `type`, dan
setiap query harus menyaring `type` dulu. Itu memperburuk, bukan menyederhanakan.

### Rekomendasi

Halaman **Supplier** jadi dua tab:

```
Supplier
├── Material   → Company + Brand (tabel flat yang baru dibuat)
└── Jasa       → ServiceVendor
```

Halaman **Harga** kembali ke tiga tab murni harga:

```
Harga
├── Harga Material     → MaterialPrice
├── Material + Upah    → MaterialLaborPrice
└── Harga Upah         → ServicePrice
```

`ServiceVendorPicker` di form Harga tetap ada. Tambahkan link kecil
"Kelola vendor →" di bawah picker yang mengarah ke Supplier → tab Jasa, supaya
staff tidak buntu saat vendor yang dicari belum terdaftar.

Catatan: ini membatalkan sebagian perubahan yang baru saja diapply (tab ke-4 di
Harga). Tab ke-4 itu memang perbaikan dibanding sub-tab tersembunyi, tapi
memindahkannya ke Supplier lebih benar secara konseptual.

---

## Peta Master Data yang Diusulkan

```
MASTER DATA (SSOT)
│
├── Supplier ─────────── siapa pihak eksternalnya
│   ├── Material        Company → Brand
│   └── Jasa            ServiceVendor
│
├── Materials ────────── apa barangnya (identitas + sample)
│   └── Sku → Sample
│       harga: read-only dari MaterialPrice
│
├── Harga ────────────── berapa harganya (yang dikonsumsi BQ)
│   ├── Harga Material  MaterialPrice   (brand wajib, sku opsional)
│   ├── Material+Upah   MaterialLaborPrice
│   └── Harga Upah      ServicePrice
│
└── Kategori ─────────── vocabulary bersama
    Category → BrandCategory (level brand)
             → SkuCategory   (level produk, menggantikan catalog_tags)
```

### Prinsip pemisahan

| Halaman | Menjawab | Owner data |
|---------|----------|------------|
| Supplier | Siapa | Company, Brand, ServiceVendor |
| Materials | Apa | Sku, Sample |
| Harga | Berapa | MaterialPrice, MaterialLaborPrice, ServicePrice |
| Kategori | Klasifikasi | Category, join tables |

Tidak ada halaman yang menulis ke tabel milik halaman lain. Materials **membaca**
MaterialPrice tapi tidak menulisnya — link ke halaman Harga.

---

## Urutan Prioritas

| Prioritas | Item | Alasan | Migrasi? |
|-----------|------|--------|----------|
| **P0** | Perbaiki sumber `bqReady` → baca `MaterialPrice` | Bug aktif, angka statistik salah sekarang | Tidak |
| **P0** | Materials tampilkan harga dari `MaterialPrice` | Konsekuensi langsung P0 di atas | Tidak |
| **P1** | Pindah ServiceVendor ke halaman Supplier (tab Jasa) | Navigasi, low risk | Tidak |
| **P1** | Field "Badan usaha" kondisional di form Brand | Hilangkan kebingungan, low risk | Tidak |
| **P2** | `SkuCategory` menggantikan `catalog_tags` | Cegah drift sebelum data membesar | Ya |
| **P2** | Hentikan tulis ke `Sku.catalog_price*` | Setelah P0 stabil | Tidak |
| **P3** | Backfill `Brand.legal_name` → `Company.legal_name` | Setelah backfill Company selesai | Data only |

**Catatan penting:** P0 tidak butuh migrasi database sama sekali — hanya perubahan
query di `material-view-service.ts` dan komponen Materials. Bisa dikerjakan lebih
dulu tanpa risiko.

---

## Yang Sudah Benar dan Jangan Diubah

Beberapa hal yang terlihat seperti redundansi tapi sebenarnya desain yang tepat:

1. **`MaterialPrice` vs `MaterialLaborPrice` vs `ServicePrice`** — tiga skema BQ
   yang berbeda (material saja / supply+install / upah saja). Bukan duplikasi,
   ini tiga bentuk penawaran yang memang berbeda di lapangan.

2. **`MaterialPrice.sku_id` nullable** — sengaja. Mayoritas baris price-list tidak
   punya SKU terdaftar. Membuatnya required adalah kesalahan §6.12 yang sudah
   diperbaiki.

3. **`ServicePrice.service_vendor_id` nullable** — `NULL` berarti "harga internal
   studio", bukan data hilang. Semantik yang bermakna.

4. **`Sku.catalog_brand` vs `Brand.brand_name`** — beda hal. `catalog_brand` adalah
   merek komersial yang tercetak di produk; `Brand` adalah relasi supplier. Satu
   supplier bisa mendistribusikan beberapa merek komersial.

5. **`CompanyContact` / `CompanyLink` terpisah dari `BrandContact` / `BrandLink`** —
   satu kontak sales Company berlaku untuk semua brand di bawahnya, tapi tiap brand
   bisa punya katalog sendiri. Dua level memang perlu.
