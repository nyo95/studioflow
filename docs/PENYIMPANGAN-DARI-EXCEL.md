# Penyimpangan rancangan v2 dari `design database masterdata.xlsx`

**Dibuat:** 2026-08-10
**Aturan owner (2026-08-10):** *"setiap informasi yg menyimpang dari design
database masterdata.xlsx → pertanyakan dulu."*

Dokumen ini menjalankan aturan itu **secara surut**. Rancangan di
`docs/PLAN-MASTERDATA-V2.md` dibuat sebelum aturan ini ada, dan di dalamnya ada
sejumlah keputusan yang saya ambil sendiri. Semuanya dikeluarkan di sini supaya
tidak ada yang lolos diam-diam.

Format: **X#** — apa kata Excel, apa yang saya buat, kenapa, dan apa akibatnya
kalau dikembalikan ke Excel.

**Cara menjawab:** cukup sebut nomor yang **ditolak**. Yang tidak disebut
dianggap disetujui.

---

## 🔎 Pemeriksaan ulang 2026-08-11 — schema vs CRUD

Excel dibaca ulang langsung dari berkasnya (`docs/design database
masterdata.xlsx`, Sheet1) dan dibandingkan baris per baris dengan
`schema.prisma` **dan** dengan CRUD-nya.

**Hasilnya membelah dua, dan pembelahan itu yang paling penting dari seluruh
dokumen ini:**

| | Hasil |
|---|---|
| **Schema vs Excel** | Cocok. Tidak ada penyimpangan baru. X1–X25 di bawah masih menggambarkan keadaan sebenarnya |
| **CRUD vs Excel** | **Tujuh kolom yang Excel minta dan schema sudah sediakan tidak bisa diisi dari layar mana pun** |

Jadi masalahnya bukan rancangan. Rancangannya menghormati Excel; yang tidak
menyusul adalah formulirnya. Kolom yang ada di database tapi nol jalur tulis
bukan "belum dipakai" — ia **belum ada**, dari sudut pandang siapa pun yang
memakai aplikasi.

Daftarnya ada di **§E** di bawah. Yang **bukan** pertanyaan (murni cacat, sudah
diperbaiki 2026-08-11) dipisahkan ke §E.0 supaya tidak menumpang di daftar yang
menunggu keputusan.

---

## ✅ Keputusan owner 2026-08-10

| # | Isi | Keputusan |
|---|---|---|
| **X6** | Kolom A + B jadi satu `Party` | ✅ **Diterima.** *"itu lebih utk nama brand misal taco, tapi nama PT nya kan beda"* — satu perusahaan, dua nama: dagang dan hukum |
| **X7 / X10 / X13** | Kategori jadi pohon induk-anak | ✅ **Diterima.** HPL anak dari Bahan Baku; Lighting anak dari MEP. Satu pohon menutup Table 1, 2, 3, 4. **Benar-benar terisi sejak 2026-08-11 (E3)** — sebelumnya `parent_id` tidak pernah ditulis |
| **X9** | Table 2 dipecah `Sku` + `SkuPrice` | ✅ **Diterima**, dengan alasan **keduanya**: harga dari beberapa toko untuk barang yang sama, DAN riwayat harga |
| **X12** | Kolom `Qty` | ⚠️ **Diubah.** *"simpan saja tapi tidak usah dipakai (kasi keterangan), soalnya memang kurang jelas utk apa kolom ini"* — lihat di bawah |
| X8, X11, X14, X15–X21 | Tidak disebut ditolak | ✅ Disetujui sesuai kesepakatan cara menjawab |

### X12 — tafsir `pack_size` dibuang

Draft menafsirkan `Qty` sebagai ukuran kemasan dan memberinya default `1`.
Tafsir itu **dibuang seluruhnya**. Gantinya kolom `qty Decimal?` yang disimpan
apa adanya, tanpa arti yang ditetapkan, plus `COMMENT` di database yang melarang
pemakaiannya.

Ini keputusan yang lebih baik dari usulan saya, dan alasannya layak dicatat:
**menebak arti sebuah kolom lalu memakainya dalam hitungan adalah cara paling
senyap merusak angka.** Kolom yang jujur tidak diketahui artinya tidak bisa
merusak apa pun; kolom yang salah diartikan merusak diam-diam sampai ada yang
membandingkan totalnya dengan nota.

Tiga aturan yang menjaganya tetap tidak berbahaya, ditulis di `COMMENT` kolomnya
supaya terbaca di `\d+` dan tiap tool introspeksi:

1. Tidak masuk perhitungan apa pun — `price` selalu berarti harga per satu `unit`
2. Tidak diekspos ke `v_bq_material_rate` maupun `v_library_brand`
3. Hanya tampil di form Master Data sebagai kolom catatan

---

## Ringkasan

| Kelompok | Jumlah | Perlu keputusan? |
|---|---|---|
| **A.** Sudah ditanya & disetujui di sesi sebelumnya | 5 | tidak |
| **B.** Penyimpangan struktural — mengubah bentuk data | 9 | **ya** |
| **C.** Penambahan teknis — tidak mengubah arti data | 7 | konfirmasi saja |
| **D.** Sesuai Excel | 4 | tidak |
| **E.** Kolom Excel yang CRUD-nya belum ada | 9 | ✅ semua selesai 2026-08-11 |

---

## A. Sudah ditanya & disetujui

Tidak perlu dibahas ulang, dicatat supaya daftarnya lengkap.

| # | Excel | Rancangan | Kapan disetujui |
|---|---|---|---|
| X1 | *"mungkin bisa dibuat table khusus suppliers/vendor (?)"* | Satu `Party` + `PartyRole` | Sesi 1 — *"aku ikut rekomendasi kamu"* |
| X2 | Table 3 dan Table 4 terpisah | Satu `WorkPrice`, dibedakan kolom `kind` | Sesi 1. **Diperbarui 2026-08-11 (E8):** pembedanya dulu ada-tidaknya `material_price` — disimpulkan, bukan dinyatakan. Sekarang enum eksplisit |
| X3 | Kolom `Items` hanya di blok kedua | Kolom `name` **wajib** di keduanya | Sesi 1 |
| X4 | Kolom `SKU` di Table 2 | `code` **nullable**, identitas kanonik pindah ke `slug` | Sesi 3 — Q7 |
| X5 | Tidak menyebut sample sama sekali | `Sample` + `SampleMovement` dipertahankan | Sesi 3 — Q8 |

---

## B. Penyimpangan struktural — perlu keputusan

### 🔺 X6. Kolom A `Company` + B `Brand` dijadikan **satu** entitas

**Excel:** dua kolom terpisah di bawah satu grup berjudul `Company/ Brand`.
Contoh: `PT BDA Sejahtera` | `BDA Group`, dan `PT Tangkas Cipta Optimal` | `TACO`.

**Rancangan:** satu tabel `Party` dengan `legal_name` = kolom A dan `name` =
kolom B.

**Alasan:** keduanya selalu merujuk badan usaha yang sama — satu nama hukum,
satu nama dagang. Membuat keduanya entitas terpisah berarti `BDA Group` dan
`PT BDA Sejahtera` bisa punya alamat, kontak, dan link berbeda, padahal ia satu
perusahaan.

**Kalau dikembalikan:** butuh tabel ketiga (`LegalEntity`) yang isinya hampir
selalu satu baris per Company, dan setiap query naik satu join tanpa menjawab
pertanyaan baru.

**Perlu dipastikan:** apakah pernah ada kasus **satu badan hukum menaungi
beberapa nama dagang** — mis. `PT BDA Sejahtera` juga memiliki `BDA Interior`
sebagai grup terpisah? Kalau ya, rancangan saya salah dan Excel benar.

---

### 🔺 X7. Kolom D `Category` di Table 1: tag datar → pohon

**Excel:** *"kategori dari product brand, bisa dibuat dengan model seperti
hashtag [multiple categories]"* — **tag datar**, banyak per brand.

**Rancangan:** tabel `Category` **self-referencing** (`parent_id`), dan
`BrandCategory` menunjuk ke simpul di pohon itu.

**Alasan:** Excel sendiri memakai dua tingkat di tiga tempat lain — Table 2
(`Category` `Bahan Baku` → `Material` `HPL`), Table 3 dan 4 (`Vendor Category`
`MEP` → `Category` `Lighting`). Satu pohon menutup keempatnya; tag datar hanya
menutup Table 1.

**Kalau dikembalikan:** Table 1 tetap bisa jalan, tapi Table 2/3/4 kembali punya
dua kolom kategori masing-masing — dan `"MEP"` di dua tabel jadi dua string yang
kebetulan sama, persis cacat v1.

**Catatan:** pohon **tidak mencegah** pemakaian datar. Brand tetap boleh punya
banyak kategori sekaligus, dan kategori boleh tanpa induk. Yang bertambah hanya
kemampuan menyatakan induk **kalau** dibutuhkan.

---

### 🔺 X8. Kolom G `Socmed` — JSON → tabel

**Excel:** *"url sosmed apabila ada - simpan dalam json"*.

**Rancangan:** baris di tabel `PartyLink` ber-`kind` (`INSTAGRAM`, `FACEBOOK`,
`TIKTOK`, …).

**Alasan:** URL yang sama tidak bisa dicegah masuk dua kali di dalam JSON, tidak
bisa diurutkan, dan tidak bisa dicari tanpa memindai. Tabel link sudah ada di v1
(`BrandLink`, 1010 baris) dan bekerja.

**Kalau dikembalikan:** 1010 baris link yang sudah ada harus dilipat jadi JSON,
dan editor link yang sudah jalan (`brand-links-editor.tsx`) ditulis ulang.

**Ini penyimpangan yang paling saya yakini benar** — tapi tetap saya keluarkan
karena aturannya begitu.

---

### 🔺 X9. Table 2 dipecah jadi `Sku` + `SkuPrice`

**Excel:** satu tabel — identitas produk dan harga di baris yang sama.

**Rancangan:** dua tabel. `Sku` = identitas (kode, nama, spec, dimensi),
`SkuPrice` = syarat dagang (harga, satuan, dibeli di mana, kapan berlaku).

**Alasan:** kolom identitas berubah kalau pabrikannya mengubah produk — jarang.
Kolom harga berubah tiap ada penawaran baru — sering. Di satu baris, menyimpan
harga baru berarti **menghapus harga lama**.

**Kalau dikembalikan:** satu harga per produk, tanpa riwayat, tanpa kemampuan
menyimpan harga dari dua toko berbeda. Kolom `Supplied by` di Excel jadi
berbohong — ia menyiratkan barang bisa dibeli di beberapa tempat, tapi barisnya
cuma satu.

**Perlu dipastikan:** apakah memang ingin menyimpan **harga dari beberapa toko
untuk barang yang sama**? Kalau tidak — kalau tiap barang hanya punya satu harga
dari satu tempat — maka Excel benar dan pemisahan ini berlebihan.

---

### 🔺 X10. Table 2 kolom B `Material` + C `Category` → pohon yang sama

**Excel:** dua kolom. `Material` = `HPL` / `Plywood`; `Category` = `HPL` /
`Bahan Baku`.

**Rancangan:** keduanya jadi simpul di pohon `Category` (kind=`PRODUCT`),
dihubungkan lewat `SkuCategory`.

**Alasan:** sama dengan X7. Dan pada contoh Excel-nya sendiri kedua kolom itu
tumpang tindih — baris pertama `Material`=HPL dan `Category`=HPL, isinya sama.

**Perlu dipastikan:** apa **beda** `Material` dan `Category` di Table 2? Kalau
`Material` = jenis bahan dan `Category` = pengelompokan yang lebih luas, pohon
saya benar. Kalau keduanya memang dua sumbu berbeda (mis. bahan vs fungsi),
maka butuh **dua** tag terpisah per SKU, bukan induk-anak.

**✅ DIPUTUSKAN owner 2026-08-11 — satu sumbu, dua kolomnya digabung.**
Satu pertanyaan per tingkat: **tingkat 1 = perannya apa di pekerjaan**
(Bahan Baku, Finishing, Hardware, MEP…), **tingkat 2 = barangnya apa**
(HPL, Plywood, Engsel…). "Bahan Baku" dan "Finishing" **sejajar**, bukan
bertingkat. SKU menyimpan **daunnya saja**; induknya dibaca dari `path`, tidak
pernah diketik ulang — dan baris `Material`=HPL / `Category`=HPL jadi hilang
dengan sendirinya karena cuma ada satu simpul HPL.

Dua kolom di Excel adalah cara file datar memalsukan pohon; database tidak
punya keterbatasan itu.

Tiga aturan yang menjaganya, di `category-tree-rules.ts`:

1. **Simpan daunnya saja.** `dropAncestorTags` membuang tag yang merupakan
   induk dari tag lain di daftar yang sama — "HPL, Finishing" jadi "HPL".
   Tanpa ini dua-kolom Excel kembali tumbuh di dalam satu baris.
2. **Klasifikasikan barangnya _apa_, bukan _untuk apa_.** Plywood yang dipakai
   sebagai muka terekspos tetap Bahan Baku; bahwa di proyek itu perannya
   finishing adalah sifat baris BQ, bukan sifat SKU. Kalau dilanggar, satu
   plywood pelan-pelan jadi dua SKU yang isinya sama.
3. **Sumbu kedua yang benar-benar lain jadi `CategoryKind` baru, bukan induk
   kedua.** `SkuCategory` sudah many-to-many, jadi tidak butuh migrasi.

**Tidak di-seed.** `PRODUCT_LEVEL1` / `WORK_LEVEL1` adalah konstanta yang
DITAWARKAN form; barisnya lahir saat pertama dipakai lewat `resolveCategoryPath`.
Mengubah daftarnya tidak meninggalkan baris yatim.

**Yang masih ditebak, dan sengaja sempit:** `PRODUCT_PARENT_BY_LEAF` memetakan
daun yang sudah dikenal ke tingkat 1-nya, untuk memfilekan tag lama yang
diketik bebas dari katalog/SketchUp. Tag di luar peta itu **tetap di akar** —
tidak ditebak. Menebak induk adalah cara sebuah pengelompokan berhenti berarti
apa-apa, alasan yang sama dengan X12 dan backfill kategori Party.

---

### 🔺 X11. Kolom G `Dimensions` — satu string → empat kolom numerik

**Excel:** satu sel, `1220 x 2440 mm`.

**Rancangan:** `dim_length`, `dim_width`, `dim_height` (`Decimal`), `dim_unit`,
plus `dim_display` yang menyimpan string aslinya.

**Alasan:** BQ menghitung m² dari angka ini. String harus di-parse tiap kali,
dan parse akan gagal pada `-` yang muncul di contoh Table 3/4.

**Kalau dikembalikan:** BQ tidak bisa menghitung luas otomatis; tiap baris harus
diketik luasnya manual.

**Catatan:** `dim_display` tetap menyimpan apa yang diketik, jadi tampilan di
layar tidak berubah.

---

### 🔺 X12. Kolom H `Qty (need curations)` → `pack_size`

**Excel:** kolom `Qty`, ditandai penulisnya sendiri `(need curations)`.

**Rancangan:** `SkuPrice.pack_size` dengan default `1` — "berapa satuan dasar
dalam satu satuan jual".

**Penafsiran saya:** Qty di baris **harga** tidak mungkin berarti jumlah yang
dibeli (itu milik transaksi, bukan master data). Yang masuk akal: harga 150.000
berlaku untuk 1 lembar.

**Perlu dipastikan:** apakah penafsiran itu benar? Ini satu-satunya kolom yang
penulisnya sendiri tandai belum jelas, jadi saya menebak.

---

### 🔺 X13. Table 3/4 `Vendor Category` + `Category` → pohon yang sama

**Excel:** dua kolom. `MEP` → `Lighting`; `Sipil` → `Floor Works`;
`Furniture` → `Furniture`.

**Rancangan:** pohon `Category` kind=`WORK`; `WorkPrice.category_id` menunjuk
daunnya, induknya adalah "Vendor Category".

**Alasan:** sama dengan X7 dan X10.

**Catatan:** baris `Furniture` → `Furniture` menunjukkan kedua kolom kadang
memang berisi hal yang sama, yang justru gejala bahwa keduanya satu sumbu.

---

### 🔺 X14. `Project Reference` — satu sel → tabel

**Excel:** `"Sociolla SPZ, Sociolla GI, dst"` — daftar dipisah koma di satu sel.

**Rancangan:** tabel `WorkPriceProjectRef`, satu baris per proyek, menyimpan
`project_id` (kolom biasa, **tanpa** FK ke `studioflow`) + `project_name`.

**Alasan:** daftar koma tidak bisa dijawab pertanyaannya — "tarif apa saja yang
pernah dipakai di Sociolla GI" butuh `LIKE '%Sociolla GI%'`, yang juga akan
mencocokkan `Sociolla GI 2`.

**Kalau dikembalikan:** satu kolom teks. Lebih mirip Excel, tidak bisa dicari.

---

## C. Penambahan teknis — tidak ada di Excel, tidak mengubah arti data

Konfirmasi saja. Semuanya kolom bantu, bukan konsep bisnis baru.

| # | Tambahan | Kenapa ada |
|---|---|---|
| X15 | `slug` di `Party`, `Brand`, `Category`, `Sku` | Dedup dan pencarian tanpa peduli huruf besar/kecil. Diturunkan aplikasi, tidak pernah diketik |
| X16 | `is_active`, `deleted_at` | Soft delete. Menghapus brand yang sampelnya masih di rak harus bisa dibatalkan |
| X17 | `MasterDataAudit` | Excel minta kolom "Update by/Time" — kolom hanya menyimpan perubahan **terakhir**. Riwayatnya butuh baris. Kolom denormalisasinya tetap ada |
| X18 | `SkuMedia` | Excel Table 2 tidak punya kolom gambar sama sekali; v1 punya lima kolom URL. Satu tabel memberi banyak foto |
| X19 | `WorkPrice.code` unik | Baris BQ butuh rujukan stabil yang bukan uuid |
| X20 | `valid_from` / `valid_to` / `is_current` | Konsekuensi X9. Tanpa ini pemisahan harga tidak ada gunanya |
| X21 | `PartyContact.brand_id` opsional | "Sales TACO di Ace Hardware" — kontak yang cakupannya satu merek di satu perusahaan. Excel menaruh Sales di grup Supplier, tapi yang ditanyakan orang selalu per merek |

---

## D. Sesuai Excel — dicatat supaya jelas tidak menyimpang

| # | Excel | Rancangan |
|---|---|---|
| X22 | `Specification 1/2` — *"bisa disimpan dalam json apabila ada lebih dari 2 keterangan"* | `spec Json?` — **diikuti persis**, ditambah index GIN supaya tetap bisa dicari |
| X23 | `Brand` di Table 2 — *"apabila tidak ada brand bisa di kosongkan"* | `Sku.brand_id` nullable |
| X24 | `SKU Product Relational` — *"bebas apakah mau dipisah table jg boleh"* | Dipisah, jadi relasi `Sku.brand_id` |
| X25 | `Company Categories` — *"supplier, subcon, vendor, retail store, manufacture"* | Enum `PartyRoleKind` dengan kelima nilai itu + `DISTRIBUTOR` |

---

## E. Kolom Excel yang schema-nya benar tapi CRUD-nya belum ada

**Ditemukan 2026-08-11.** Ini **bukan** penyimpangan rancangan — rancangannya
sudah sesuai Excel dan sudah disetujui di §A–§D. Yang belum ada adalah cara
mengisinya dari layar.

Dampaknya sama saja bagi yang memakai aplikasi: kolomnya tidak ada. Bedanya
hanya ongkos perbaikannya — tidak butuh migrasi, hanya formulir.

### E.0 — Sudah diperbaiki 2026-08-11 (bukan pertanyaan)

| # | Kolom Excel | Yang salah | Perbaikan |
|---|---|---|---|
| **E1** | Table 1 kolom K `Company Categories` | `PartyRole` **tidak pernah ditulis siapa pun** kecuali form vendor jasa. Akibatnya pemilih Supplier di halaman Harga — yang menyaring `role: SUPPLIER` — selalu kosong, dan tiap id yang dipaksa lewat ditolak | Checkbox kategori di form Party (Supplier / Subcon / Vendor / Retail store / Manufacture / Distributor), ditulis dan dibaca CRUD |
| **E1b** | Table 1 kolom J + Table 2 `Supplied by` | Penyaring `role: SUPPLIER` justru **menyembunyikan dua contoh Excel sendiri**: Ace Hardware dan Informa keduanya ber-Company Category **Retail**, dan "Supplied by" di Table 2 menunjuk balik ke keduanya | Aturannya jadi "party yang punya kategori apa pun" (`party-role-rules.ts`). Yang ditolak hanya Party tanpa kategori sama sekali |
| **E2** | Table 3 kolom `Update by` | `updated_by_name: ctx.role` menyimpan **"ADMIN"** di kolom yang menanyakan **siapa** | Diganti `ctx.user.name` |

**E1 layak dibaca dua kali**, karena ia contoh persis dari pola yang dicatat di
`roadmap.md`: fitur yang tidak dipakai menyembunyikan bug yang menunggunya.
Pemilih supplier ditambahkan 2026-08-11 pagi dan **tidak akan pernah menampilkan
satu nama pun** — tidak error, tidak warning, hanya daftar kosong yang terbaca
sebagai "belum ada supplier". Yang menemukannya bukan uji, melainkan membaca
Excel-nya lagi.

### E.1 — ✅ SELESAI 2026-08-11 (keputusan owner)

Ketujuhnya ditanyakan lebih dulu dan dijawab sebelum satu baris pun diubah.

| # | Kolom Excel | Keputusan | Hasil |
|---|---|---|---|
| **E3** | Table 2 `Material`+`Category`; Table 3/4 `Vendor Category`+`Category` | **Dua tingkat induk → anak.** Urutan kolomnya memang terbalik antar tabel; baris HPL/HPL adalah daun yang namanya sama dengan induknya, bukan kontradiksi | `category-tree-service.ts` mengisi `parent_id` + `path`. **Diperbarui 2026-08-11:** dua kolomnya jadi SATU field (`MEP > Lighting`), tingkat 1 dari `PRODUCT_LEVEL1`/`WORK_LEVEL1`, dan tag produk yang dulu selalu difilekan di akar kini dapat induknya lewat `productParentFor` |
| **E4** | `Project Reference` | **Pilih dari daftar proyek**, bukan teks bebas — dua ejaan akan jadi dua proyek | Snapshot `project_id` + `project_name`, tanpa FK (X14) |
| **E5** | Table 1 kolom J `Supplier's Company` | Diisi di form Brand | Field "Sold by", terpisah dari pemilik brand |
| **E6** | Table 3/4 `Qty` | Ikut disimpan seperti X12 | Kolom `WorkPrice.qty` + `COMMENT` larangan. Butuh migrasi |
| **E7** | Table 3/4 `Specification 1/2`, `Dimensions` | Diisi | Field baru di form harga kerja |
| **E8** | Table 2/3/4 `Price` — **satu** kolom | **Satu harga + penanda jenis** untuk Table 3/4. Table 2 tetap dua (list/net) karena diskon memang nyata | `WorkPrice.price` + enum `WorkPriceKind`. Butuh migrasi |
| **E9** | Halaman Supplier dibagi 5 kategori | Penyaring, bukan lima layar | Dropdown kategori di halaman Supplier |

**Tentang E8, karena ia yang paling mengubah bentuk data.** Menyatukan dua
kolom harga jadi satu berarti pembeda Table 3 dari Table 4 hilang — sekarang
pembedanya justru `material_price` terisi atau tidak. Karena itu ia diganti
enum `kind` yang **dinyatakan**, bukan disimpulkan. Tarif upah-murni yang
kebetulan diketik lengkap dengan biaya materialnya dulu terbaca sebagai paket
supply+install; sekarang tidak bisa lagi.

**Tentang E3, karena ia yang paling mudah salah tafsir.** Excel menulis dua
tingkatnya dengan urutan terbalik antar tabel, dan contoh pertama Table 2
mengisi keduanya sama persis. Kalau tafsir "induk → anak" ternyata keliru dan
keduanya sebenarnya dua sumbu berbeda, **X10 juga keliru** dan pohonnya harus
dibongkar. Itu tercatat di sini supaya pembatalannya punya pintu masuk.

---

## Yang paling saya ragu, kalau harus memilih tiga

1. **X9** (pecah `Sku`/`SkuPrice`) — paling besar akibatnya kalau ternyata tiap
   barang memang hanya punya satu harga dari satu tempat.
   **Diperbarui 2026-08-11:** sudah dipakai — pemilih supplier ada di form Harga
   dan form Material. Kalau X9 ternyata salah, sekaranglah waktu paling murah
   membatalkannya.
2. **X10** (`Material` vs `Category` di Table 2) — saya menebak keduanya satu
   sumbu induk-anak. Kalau sebenarnya dua sumbu berbeda, bentuknya salah.
   **Ditutup 2026-08-11:** owner memutuskan satu sumbu, dan dua kolomnya
   digabung jadi satu — lihat X10 di atas. Tidak lagi termasuk yang diragukan.
3. **X12** (`Qty` → `pack_size`) — penulisnya sendiri menandainya belum jelas.
   **Diperbarui 2026-08-11:** lihat E6 — hanya separuh diterapkan.
