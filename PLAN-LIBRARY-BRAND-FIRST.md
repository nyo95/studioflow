> ## ⚠️ DOKUMEN USANG — Master Data v1
>
> Diberi tanda pada perapihan dokumentasi **2026-08-18**.
>
> Berkas ini menggambarkan **Master Data v1**, schema yang sudah
> **tidak ada** — ia di-`DROP SCHEMA … CASCADE` oleh migrasi
> `20260810180000_masterdata_v2_rebaseline` pada 2026-08-10.
> Model seperti `Vendor`, `MaterialCatalog`, `Company`, dan kolom `catalog_*`
> tidak lagi mewakili keadaan sekarang.
>
> **Dipertahankan di root semata-mata karena 8 berkas di `src/` masih
> mengutip namanya di komentar.** Menghapusnya akan membuat rujukan itu
> menggantung — lebih buruk daripada dokumen usang yang jelas bertanggal lama.
>
> **Acuan yang berlaku:** [`AGENTS.md`](AGENTS.md) §🧱 Master Data Contract (v2)
> dan [`prisma/schema.prisma`](prisma/schema.prisma).
> Pekerjaan terbuka: [`roadmap.md`](roadmap.md).
>
> Verifikasi ulang isinya dilacak sebagai **T3** di `roadmap.md` — dokumen ini
> pernah menandai sebuah perbaikan "selesai" padahal belum.

---

# PLAN — Library Brand-First & Tiga Surface dalam Satu Codebase

**Status:** perencanaan. Belum ada kode/migrasi.
**Tanggal:** 31 Juli 2026
**Menggantikan:** `PLAN-APP-SPLIT.md` (pemisahan repo/database dibatalkan).
**Menggantikan sebagian:** MASTER_SSOT.md **§6.12** dan **§6.13** — lihat §8, ini wajib dibaca sebelum menyentuh master data.

---

## 0. Perubahan arah

| | Rencana sebelumnya | Sekarang |
|---|---|---|
| Repo | Dua repo | **Satu repo** |
| Database | Dua database | **Satu database**, tiga schema seperti sekarang |
| Pemisahan | Fisik | **Logis** — aplikasi berbeda dibedakan oleh permission & data yang boleh diakses, bukan oleh infrastruktur |
| Unit Library | Material per-SKU | **Brand + kategori.** Katalog milik brand yang jadi daftar produknya |
| SKU | Wajib di semua Material | **Hanya untuk sample fisik** |
| Nama app biaya | usul "BuildFlow" | **CostFlow** (dari owner) |

Tiga surface: **StudioFlow** (desain + PM), **Master Data** (lapisan input), **CostFlow** (BQ/estimasi). Master Data adalah SSOT bersama; StudioFlow dan CostFlow adalah dua konsumen dengan hak baca yang berbeda.

Konsekuensi langsung: hampir semua langkah destruktif di `PLAN-APP-SPLIT.md` tidak berlaku. `app-access.ts`, matriks app-access, `multiSchema`, `verify-access-matrix.mjs`, role STAFF/CURATOR/ESTIMATOR — **semua tetap hidup dan sekarang justru jadi tulang punggung pemisahan logis.** Yang dibongkar cuma Library.

---

## 1. Penilaian: kenapa ini lebih baik

Bukan sekadar lebih sederhana — model lama tidak cocok dengan kenyataan, dan datanya sudah membuktikan itu.

**1. 580 kandidat yang macet adalah gejala, bukan pekerjaan yang belum selesai.**
§6.12 menetapkan SKU wajib, jadi baris tanpa SKU adalah *import blocker*. Hasilnya: dari 756 MaterialCandidate, **580 masih PENDING** dan tidak bisa dipromosikan. Bukan karena workbook-nya kotor, tapi karena **kantor memang tidak punya SKU untuk material yang belum pernah dipegang.** Kontraknya menuntut data yang tidak ada dan tidak akan pernah ada sampai barangnya datang. Model baru memindahkan syarat SKU ke titik di mana SKU benar-benar tersedia: saat sample fisik masuk.

**2. Dua sheet sumber ternyata memang dua entitas berbeda.**
Ini bukti terkuat model baru cocok dengan kenyataan lapangan:

| Sheet | Isi | Punya SKU? | Di model baru |
|---|---|---|---|
| `List` (394 vendor, 483 baris kapabilitas) | brand + perusahaan + web + IG + kategori | Tidak, tidak pernah | **Brand + Category** |
| `Sheet1` (287 baris) | Tipe + Motif + rak + box | Ya (`Tipe + Motif`) | **Sku + Sample** |

Workbook-nya selalu berbentuk dua entitas. Model lama memaksa keduanya masuk satu tabel `Material`, lalu 580 baris menolak masuk. Dan ke-172 baris yang **berhasil** dipromosikan? Semuanya dari `Sheet1` — yaitu baris yang punya sample fisik. **Yang lolos, lolos karena kebetulan sudah sesuai model baru.**

**3. Katalog brand adalah daftar SKU yang dirawat gratis oleh brand.**
Menyalin katalog Niro Granite ke database sendiri artinya mengambil alih pekerjaan pemeliharaan seumur hidup: seri baru, warna discontinued, ukuran berubah. Untuk apa? Desainer tidak butuh 4.000 SKU di database — dia butuh tahu **siapa yang jual terazzo**, lalu buka katalognya. Link katalog tidak pernah basi karena brand yang merawat.

**4. Menutup redundansi terakhir yang §6.11 belum berani sentuh.**
§6.11 mencatat kecurigaan yang benar (`catalog_brand` cuma salinan `vendor.brand_name`; `VendorOffering` = "logic aneh") tapi solusinya masih tabel material terpusat. Model baru menyelesaikannya: `ProjectScheduleOption.data_snapshot` **sudah** memuat spesifikasi lengkap, dan sudah immutable. Tabel `Material` selama ini adalah salinan kedua yang berpura-pura jadi hulu. Schedule tidak pernah membutuhkannya.

**5. Data SKU jadi terisi sendiri.**
Alur `request sample → staff adakan → barang datang → dicatat di rak` menghasilkan SKU sebagai **efek samping pekerjaan yang toh sudah dilakukan.** Tidak ada lagi proyek "isi katalog" yang tidak pernah selesai. Data yang ada = data yang dipakai.

### Yang harus diakui hilang
- **Spec terstruktur untuk BQ.** Tanpa Material terpusat, baris schedule bukan lagi FK ke item berharga. Estimator membaca schedule sebagai teks dan mengambil harga dari tabel harga secara manual. Di skala kantor ini wajar, tapi harus disengaja — bukan ditemukan belakangan. Lihat R3.
- **`VendorOffering` kembali dalam bentuk lain.** Brand × Category memang mirip tabel yang dibuang 31 Juli. **Perbedaannya bukan kosmetik:** dulu ia berpura-pura jadi SKU tanpa kode artikel — bayangan tabel Material. Sekarang dia *adalah* Library, satu-satunya hal yang dicari desainer, dan tidak berpretensi jadi item spesifik. Membuangnya waktu itu benar; menghidupkan bentuknya sekarang juga benar. **Yang tidak boleh:** menganggapnya baris Material setengah jadi lagi.

---

## 2. Model baru

Tiga rantai yang berdiri sendiri, tidak saling menyalin:

```text
LIBRARY (yang dilihat desainer)
    Category  <--  BrandCategory  -->  Brand  -->  BrandLink   (web / IG / katalog PDF / drive)
                                          |
                                          +----->  BrandContact

FISIK (yang dipegang kantor)
    Brand  -->  Sku  -->  Sample  -->  SampleMovementLog
                   ^                        (rak, box, qty, pinjam)
                   |
    ProjectProductRequest  (desainer minta sample; SKU lahir di sini saat barang datang)

SPEC PROYEK (mandiri)
    ProjectScheduleEntry  -->  ProjectScheduleOption.data_snapshot   (immutable, sudah lengkap)
                                     + spec_* untuk pencarian reuse
                                     + brand_id opsional
                                     + sku_id opsional (kalau sample-nya ada)

BIAYA (yang dilihat CostFlow saja)
    Brand  -->  MaterialPrice   (unit, sebelum/sesudah diskon, tanggal, dokumen sumber)
```

### 2.0 Koreksi owner, 1 Agustus 2026 — hasil pencarian selalu BRAND

> *"fokusnya harus bukan cari barang lagi — tapi cari brand yg jual barang tsb"*

Satu kotak cari, hasilnya **daftar brand**, tanpa langkah pilih-kategori di
tengah, dan tanpa daftar produk. Produk ada di katalog brand, yang dirawat
brand.

Langkah kategori dibuang bukan demi kesederhanaan — dia **menyembunyikan
data**. Cari `terazzo` mengembalikan 2 brand; workbook membuktikan 12+.
Sebabnya tiga, dan dua di antaranya bug seed:

1. **Ejaan.** `Terrazzo` (Kammer, Madana, Sib, Tmac, Kumeli, Papan Ruma,
   Reflecto, Arna) vs `Terazzo` (Dphaus, Lava, Titanium) jadi dua kartu
   kategori. Pilih satu, kehilangan satunya.
2. **Kategori komposit tidak dipecah.** Seed split di `|` saja, tidak di ` - `,
   jadi `"Granite - Stones - Terazzo - Marbles"` masuk sebagai SATU baris.
   Itu sebabnya ada 418 Category untuk 392 brand.
3. **Kategori kolom yang salah untuk baris asal sample.** Semua tile terrazzo
   Titanium bertag `Tile`; kata "Terrazzo" cuma ada di nama produk.

Perbaikannya: cocokkan potongan nama Category + `catalog_tags` + nama produk +
nama brand, union di tingkat brand, urutkan berdasarkan banyaknya bukti, dan
tampilkan alasan kecocokannya di kartu. Karena dedup terjadi di tingkat brand,
**duplikat ejaan kategori berhenti jadi blocker** — penggabungannya turun jadi
housekeeping di `/masterdata`. Jangan menghidupkan lagi langkah pilih-kategori
untuk "memperbaiki" duplikat itu.

### 2.1 Library = Brand + Category
- `Category` **tabel kanonik, slug unik.** Search kategori sekarang *adalah* Library-nya, jadi ini titik paling rawan — pelajaran §6.11 ("Sanitary" vs "sanitary") tetap berlaku dan justru makin penting. Ini membalik keputusan §6.12 yang mengganti Category dengan tag array; alasannya berubah karena fungsinya berubah dari label jadi indeks pencarian.
- `BrandCategory` join, punya `sort_order` — tag pertama tetap kategori utama, jadi semantik urutan §6.12 tidak hilang.
- Alias kategori dipending sampai terbukti perlu. Kalau nanti perlu, `CategoryAlias(category_id, alias)` cukup — jangan bikin tag bebas lalu tambal dengan alias.
- **`Brand` tetap satu entitas** (model `Brand`, tabel `Vendor` — jangan di-rename, sudah cukup churn). Konsep "toko/distributor yang menjual brand X" **belum dibuat.** Kalau CostFlow nanti butuh, itu `Supplier` terpisah yang lahir bersama kebutuhan harga, bukan sekarang.

### 2.2 Sku = artikel yang sample fisiknya pernah ada
- SKU wajib, dan itu **bukan beban** lagi karena barangnya ada di tangan — kode artikelnya bisa dibaca.
- Satu `Sku` boleh punya banyak `Sample` (3 keping keramik sama). Relasi ini sudah ada dan tidak berubah.
- Kolom harga **pindah keluar** dari `Sku` ke `MaterialPrice`. Alasan: sebagian besar item berharga tidak punya sample, jadi harga tidak boleh bergantung pada keberadaan sample.
- `Sku` **tidak lagi jadi katalog.** Tidak ada halaman "browse semua SKU" untuk desainer. `/masterdata/skus` (yang sekarang redirect ke materials) jadi turunan halaman sample.

### 2.3 Project Schedule berdiri sendiri
Ini menjawab pertanyaan owner — lihat §3.

### 2.4 Harga = milik Master Data, tak terlihat StudioFlow
`MaterialPrice`: `brand_id` (wajib) · `sku_id?` · `item_description` · `unit` · `price_before_discount` · `price_after_discount` · `valid_from` · `source_link_id?` (rujuk ke `BrandLink` kind `PRICE_LIST`) · audit.

- Tidak butuh SKU. Sebagian besar harga menempel pada "nama item di price list", bukan artikel yang kita pegang.
- `unit` **tanpa default**, alasan §6.10 tetap berlaku: tarif tanpa unit merusak kuantitas BQ secara diam-diam.
- Tidak ada kolom harga di mana pun yang bisa dibaca role StudioFlow. Ini akhirnya menutup *"known pre-existing leak"* §6.3 (DIC/DRIC bisa lihat harga lewat snapshot schedule) — bukan dengan RBAC, tapi dengan tidak menaruh harga di jalur yang mereka lewati.

---

## 3. Jawaban: "possible ga schedule ngambil dari material yang pernah dipakai?"

**Possible, dan tidak butuh halaman entry khusus.**

Kuncinya: setiap `ProjectScheduleOption` sudah menyimpan `data_snapshot` berisi spesifikasi penuh dan immutable. Kumpulan material yang pernah dipakai kantor **sudah ada di database sejak hari pertama** — belum pernah bisa dicari saja.

### Cara kerjanya
- Halaman entry-nya **adalah form schedule itu sendiri.** Desainer isi satu baris schedule seperti biasa → otomatis masuk kolam reuse. Tidak ada pekerjaan tambahan, tidak ada halaman kedua yang harus diingat untuk diisi.
- Di form, sebelum ketik manual: kotak cari **"pernah dipakai"** → hasil dikelompokkan per `brand + nama produk + warna/motif + finishing`, ditampilkan dengan gambar, kapan terakhir dipakai, dan di proyek mana.
- Pilih satu → nilainya dikopi ke opsi baru. Ini persis mekanisme snapshot-on-insert yang sudah jalan; sumber kopinya saja yang berubah dari `Material` ke snapshot lama.
- Ya, tiap desainer bebas menambah, dan otomatis bisa dipakai ulang semua orang. Kolamnya kolam kantor, bukan per-orang.

### Masalah teknisnya, dan solusinya
`data_snapshot` itu JSON dan `ProjectScheduleOption` **tidak punya satu pun kolom nyata** untuk brand/nama produk/warna (sudah diperiksa: hanya `sku_id`, `manual_data`, `data_snapshot`, `option_label`, `is_final`, `status`). Mencari + dedup + ranking di dalam JSONB akan jadi query yang buruk dan lambat.

Solusi: tambahkan **kolom pencarian turunan** di `ProjectScheduleOption`, diisi dari input yang sama pada saat write:

`spec_brand_id?` · `spec_product_name?` · `spec_color?` · `spec_finishing?` · `spec_search_key` (normalisasi lowercase untuk dedup)

Lalu "pernah dipakai" jadi `GROUP BY` biasa dengan index — bukan crawl JSONB, bukan tabel cache terpisah yang bisa melenceng.

**Varian yang lebih disukai:** jadikan kolom-kolom itu PostgreSQL **generated column** dari `data_snapshot` (`GENERATED ALWAYS AS (data_snapshot->>'catalog_brand') STORED`). Database yang menghitung, jadi **mustahil melenceng dari snapshot secara konstruksi.** Prisma bisa membacanya via `@default(dbgenerated())` selama tidak pernah menulisinya. Kalau ternyata rewel dengan Prisma 7.5, jatuh ke kolom biasa yang diisi di service — tapi coba generated dulu, jaminan tanpa-drift itu mahal kalau dibeli belakangan.

### Yang harus dijaga
- **Brand tetap relasional** (dipilih dari tabel `Brand`, tidak diketik). Satu field itu yang dipakai mengelompokkan, jadi harus kanonik. Nama produk/warna/motif silakan teks bebas — di situ variasi ejaan tidak merusak apa-apa.
- **Tidak ada gerbang kurasi**, dan itu memang pilihannya. Kolam reuse memantulkan apa yang kantor benar-benar tulis, termasuk salah tulisnya. Trade-off yang diterima: akurasi pemakaian nyata > kerapian katalog yang tidak pernah selesai diisi.
- **Tidak ada tempat menyimpan material yang belum dipakai.** Kalau desainer lihat sesuatu yang bagus dan belum ada proyeknya: yang disimpan **brand**-nya, bukan itemnya. Itu memang inti model baru. Kalau butuh item spesifik → minta sample. Jangan diam-diam bikin "scrapbook pribadi", itu tabel Material lama yang menyelundup lewat pintu belakang.

---

## 4. Yang sudah terpasang di schema (jangan dibangun ulang)

Hasil pemeriksaan schema — model baru ternyata sudah ~70% ada:

| Kebutuhan baru | Sudah ada | Yang kurang |
|---|---|---|
| Link brand (web/IG/FB/TikTok/YT/LinkedIn/WA/marketplace/**katalog**) | ✅ `BrandLink` + enum `BrandLinkKind`, sudah typed + `label` + `sort_order` + unique per URL | Tambah kind `DRIVE`/`PRICE_LIST`; tambah `archive_url` |
| Kontak brand | ✅ `BrandContact` (phone TEXT, tidak pernah diparse) | — |
| Request sample dari StudioFlow | ✅ `ProjectProductRequest`: `custom_product_name`, `reference_url`, `area_location`, `linked_sample_id`, `staff_name_override`, status REQUESTED/IN_PROGRESS/RECEIVED/UNAVAILABLE | `brand_id`; `sku_id` jadi hasil, bukan syarat |
| Penempatan sample fisik | ✅ `Sample`: `catalog_rack_number`, `catalog_box_number`, `location_note`, `quantity`, borrower, `due_at`, soft-delete | — |
| Jejak pinjam | ✅ `SampleMovementLog` (cascade, `user_id` plain agar selamat kalau user dihapus) | — |
| Pemisahan per-app | ✅ `app-access.ts`, `matrix.ts`, `proxy.ts`, `verify-access-matrix.mjs`, `LEAST_PRIVILEGE_ROLE` | Permission baca per-field untuk harga |

Yang benar-benar baru cuma: `Category`, `BrandCategory`, `MaterialPrice`, kolom `spec_*`, dan UI-nya.

**`ProjectProductRequest` layak disorot:** alurnya sudah lengkap sampai `linked_sample_id`. Poin 4.2 owner bukan fitur baru — perbaikan arah. Sekarang request menunjuk `sku_id` (harus sudah ada di katalog dulu); nanti request menunjuk **brand + deskripsi bebas**, dan `sku_id` diisi saat status jadi `RECEIVED`. Itu pembalikan satu kolom, bukan alur baru.

---

## 5. Yang dibongkar

1. **`Sku` berhenti jadi katalog.** Empat kolom harga keluar ke `MaterialPrice`. `catalog_status` (PENDING/APPROVED/REJECTED) kehilangan makna — barang fisik tidak perlu di-approve; kemungkinan besar dibuang. `/masterdata/materials` bukan lagi permukaan CRUD utama.
2. **Curation queue berubah tujuan, tidak dibuang.** `MaterialCandidate` sekarang staging bukti-tanpa-SKU. Di model baru bukti-tanpa-SKU **bukan lagi masalah** — ia jadi Brand + Category. 580 baris PENDING itu selesai lewat promosi ke Brand/Category, bukan lewat menunggu SKU yang tidak akan datang. `SampleCandidate` tetap valid apa adanya.
3. **`library-service.ts` (1.590 baris) dipecah tiga:** brand+kategori · sku+sample · jembatan schedule. Ini bongkaran terbesar dan paling berisiko — kerjakan setelah schema hijau, jangan barengan.
4. **`LibraryTabs.tsx` (1.012 baris) dan `LibraryFormModal.tsx` (1.207 baris)** dirancang untuk katalog per-SKU. Tab desainer diganti permukaan search-kategori. Form modal-nya kemungkinan ditulis ulang, bukan ditambal.
5. **`schedule-service.ts`:** 6 tempat pembaca `catalog_price` dibersihkan; jalur "insert dari Material" ditambah jalur "insert dari snapshot lama". Snapshot lama yang sudah memuat angka harga **dibiarkan** — immutable artinya immutable.
6. **SketchUp bridge — bukan FK, tapi coupling-nya nyata.** Sudah diperiksa: `SketchupMaterial` **tidak** punya FK ke `Sku`; ia menyambung ke `ProjectScheduleEntry` via `linked_entry_id` dan menyimpan spec sebagai kolom teks (`brand`, `type`, `finish`, `color_size`, `unit_cost`). Yang menempel justru di `sketchup-actions.ts`:
   - **Jalur "save to library"** (baris ~3307) membuat baris `Sku` lalu mengisi `option.sku_id`, diaudit sebagai `CATALOG_CREATE`. Ini pembuat `Sku` kedua di luar Master Data. Di model baru jalur ini **dihapus** — `Sku` hanya lahir saat sample fisik masuk. `canSaveToLibrary` sudah dibatasi ADMIN/STAFF, jadi menghapusnya tidak menyentuh desainer.
   - **Library search di `CatalogBoard.tsx`** (`addMode: "manual" | "library"`, `searchCatalogLibraryProductsAction`) **diarahkan ke kolam reuse.** Ini justru pasangan alaminya: yang dicari board itu "material yang pernah saya pakai", persis isi kolam reuse. Sekaligus mewujudkan cita-cita "SketchUp berhenti jadi pulau" di `STUDIOFLOW_DESIGNER_VISION.md`, tanpa fitur baru.
   - **`catalog_price ↔ unit_cost` di ~10 tempat.** `SketchupMaterial.unit_cost` tetap ada sebagai **angka manual milik admin**, tidak lagi dibaca dari data harga Master Data. Aman karena SketchUp ADMIN-only — tapi lihat R4, ada satu jalur ekspor yang perlu disadari.

   Sisa bridge-nya (sync, merge, render board, code manager) **tidak disentuh.** ADMIN-only, jalan, dan tidak menghalangi apa pun.

---

## 6. Data yang ada sekarang

| Data | Jumlah | Nasib |
|---|---|---|
| Sku/Material canonical | 172 | **Tetap.** Semuanya turunan `Sheet1` (sample-backed) — sudah sesuai model baru. Kolom harga dipindah |
| MaterialCandidate PENDING | 580 | Dipromosikan jadi **Brand + Category**, bukan Material |
| MaterialCandidate PROMOTED / DISMISSED | 172 / 4 | Tetap sebagai riwayat |
| SampleCandidate | 287 | Tetap; jalur promosi ke Sample tidak berubah |
| Sample canonical | 0 | Terisi lewat alur request, atau promosi 287 kandidat |
| Brand (dari `List`) | ikut seed | **Inti Library sekarang.** Perlu kategori diisi dari kolom kapabilitas workbook |
| Project/Phase/Schedule/snapshot/MOM/AuditLog | live | **Tidak disentuh** |

Kategori brand direkonstruksi dari kolom kapabilitas `List` (483 baris yang dulu jadi `VendorOffering`). Datanya sudah pernah dibaca dan diverifikasi — tinggal dipetakan ke `Category` kanonik. Aturan seed tetap `docs/MASTERDATA_CSV_SEEDING_GUIDE.md`: dry-run, backup + SHA-256 restore-tested, idempoten, audit per baris dengan actor nyata, tidak pernah mengarang data.

---

## 7. Tiga surface & permission

| | StudioFlow (DIC, DRIC) | Master Data (STAFF, CURATOR) | CostFlow (ESTIMATOR) |
|---|---|---|---|
| Brand + kategori + katalog | **baca**, link ter-allowlist (§7.2) | tulis | baca |
| Category | baca | tulis | baca |
| Sku + Sample + rak | baca ketersediaan | tulis | baca |
| `MaterialPrice` | **tidak terlihat sama sekali** | tulis | baca |
| `BrandContact` | **tidak terlihat** | tulis | baca |
| Project / schedule / MOM | tulis (sesuai fase & role) | tidak | **tidak, sama sekali** |
| Curation queue | tidak | tulis | tidak |

Master Data = SSOT. StudioFlow dan CostFlow tidak menyalin, mereka membaca irisan yang berbeda. Karena satu database, "irisan berbeda" ditegakkan **di service layer + permission**, bukan oleh batas jaringan — jadi `MASTERDATA_*` akhirnya harus jadi otoritas nyata, bukan kebetulan.

### 7.1 Jembatan desain → biaya: PDF manual, dan sudah jalan

**Keputusan owner: CostFlow tidak terhubung ke data proyek StudioFlow.** Desainer mengirim PDF ke estimator secara manual. Jadi tidak ada permission lintas-app, tidak ada `SCHEDULE_READ_FOR_COST`, tidak ada halaman CostFlow yang membaca schedule. ESTIMATOR hanya menyentuh Master Data (harga, brand, SKU/sample).

Ini sederhana **dan surface-nya sudah ada** — hasil pemeriksaan:

- `/projects/[id]/extensions/product-catalog` adalah implementasi kanonik product schedule (board + tabel + cover), lengkap dengan **CSS print** (cover jadi halaman 1, toolbar disembunyikan, `print-color-adjust` dipaksa) dan `PrintButton`. Print browser → PDF, selesai.
- **Gerbangnya `PLUGIN_SCHEDULE_VIEW`, bukan ADMIN.** Jadi DIC/DRIC memang sudah bisa buka, print, dan **Export to Sheets (.xlsx)** via `api/projects/[id]/sketchup/sheet-export`.
- Halaman ini kebetulan tinggal di dalam ekstensi SketchUp, tapi **bukan bagian ADMIN-only-nya.** Perbedaan itu penting: langkah 7 boleh membongkar bridge SketchUp, **tidak boleh merusak halaman ini** — ia satu-satunya jembatan resmi ke CostFlow.

Artinya poin ini nol pekerjaan baru. Yang perlu: masukkan halaman ini ke daftar regresi wajib di langkah 8, dan pastikan pembersihan `catalog_price` tidak mengosongkan kolom yang ikut tercetak.

### 7.2 Allowlist `BrandLink` — panel brand StudioFlow tidak menampilkan semua link

**Keputusan owner: `BrandContact` tidak terlihat dari Library StudioFlow.** Konteksnya spesifik — Master Data yang diakses *lewat Library StudioFlow*. Di subapp Master Data sendiri, STAFF/CURATOR tetap punya kontak seperti biasa.

Tapi menyembunyikan `BrandContact` saja **tidak cukup**, karena `BrandLink` bocor lewat pintu sebelahnya. Enum `BrandLinkKind` yang sudah ada berisi:

| Kind | Panel brand StudioFlow | Alasan |
|---|:---:|---|
| `WEBSITE` `INSTAGRAM` `FACEBOOK` `TIKTOK` `YOUTUBE` `LINKEDIN` | ✅ tampil | Kanal publik brand. Ini memang inti poin 3 owner |
| `CATALOG` `DRIVE` | ✅ tampil | Katalog PDF — alasan Library ini dibangun |
| `WHATSAPP` | ❌ sembunyi | **Ini kontak, cuma beda kolom.** Menyembunyikan `BrandContact` lalu menampilkan nomor WA yang sama = tidak menyembunyikan apa pun |
| `MARKETPLACE` | ❌ sembunyi | **Ini harga.** Link toko Tokopedia/Shopee menampilkan harga di layar pertama. Membuang kolom harga dari `Sku` lalu menampilkan link toko = harga tetap sampai ke desainer |
| `PRICE_LIST` | ❌ sembunyi | Harga, eksplisit |
| `OTHER` | ❌ sembunyi | **Default deny.** Kind tak dikenal tidak boleh lolos, mengikuti prinsip fail-closed yang sudah dipakai `resolveAppForPath` di §6.2 |

Aturannya **allowlist, bukan blocklist**: kind baru default tidak tampil sampai sengaja diizinkan. Kalau ditulis sebagai blocklist, `BrandLinkKind` berikutnya yang ditambahkan orang akan langsung terlihat desainer tanpa ada yang memutuskan itu.

Ditegakkan di **service layer** (`BrandLink` untuk konsumen StudioFlow difilter di query, bukan di komponen). Filter di UI berarti datanya tetap terkirim ke browser dan tinggal dibuka di devtools.

⚠️ **§6.2 poin 8 sekarang jadi jalur kritis.** SSOT sudah mencatat bahwa setiap penulisan vendor/SKU masih bergantung pada permission `LIBRARY_*` lama, dan `MASTERDATA_*` cuma "kebetulan benar" karena STAFF punya dua-duanya. Selama Master Data bukan SSOT yang benar-benar dipagari, harga bisa bocor ke StudioFlow lewat gerbang yang salah. Urutan yang sudah ditulis di §6.2 tetap dipakai: pecah action → pasang gerbang `MASTERDATA_*` → arahkan `/masterdata` → sempitkan `LIBRARY_*` STAFF. **Refactor Library ini adalah kesempatan melakukannya**, karena `library-service.ts` toh sudah dipecah di langkah 5.3.

---

## 8. ⚠️ Supersession terhadap MASTER_SSOT.md

Wajib ditulis ke SSOT sebelum kode disentuh. Tanpa ini, agent berikutnya akan membaca §6.12 dan menegakkan ulang kontrak yang sedang dibongkar — §6.12 sendiri berbunyi *"they are not permission to reintroduce Offering, nullable SKU, Category/Product tables, or unlinked Sample."*

| Aturan §6.12/§6.13 | Status baru |
|---|---|
| "Material adalah satu item nyata; Vendor, Brand, SKU, nama produk, min. 1 tag wajib" | **Dibatalkan.** Berlaku hanya untuk `Sku` yang punya sample fisik |
| "Offering dihapus total. Baris tanpa SKU adalah import blocker" | **Dibatalkan.** Baris tanpa SKU = bukti Brand + Category, warga kelas satu |
| "Category dan Product-sebagai-subkategori jadi satu tag array" | **Dibatalkan** di sisi Brand. `Category` kanonik + slug kembali. Semantik urutan dipertahankan via `sort_order` di join |
| "Harga material dipegang inline di baris material" (§6.10 #3) | **Dibatalkan.** Pindah ke `MaterialPrice` |
| "Material PENDING bisa dipakai Library & di-snapshot; kurasi = sinyal keyakinan" | **Tidak berlaku** — Library tidak lagi berisi item |
| "Sample wajib menunjuk tepat satu Material" | **Tetap berlaku** |
| "Snapshot schedule immutable, key JSON `catalog_*` dipertahankan" | **Tetap berlaku, dan makin penting** — sekarang snapshot adalah kolam reuse |
| "Kolom `catalog_*` tidak di-rename" (§6.11) | **Tetap berlaku.** 39 file, dan nama itu key JSON yang beku |
| Kandidat PENDING ≠ Material PENDING; promosi selalu eksplisit | **Tetap berlaku** |
| Audit tidak pernah ditulis ulang | **Tetap berlaku** |

Tulis sebagai **§6.14 — Brand-First Library**, jangan edit §6.12/§6.13 di tempat. Alasannya sama dengan alasan audit log tidak boleh menyunting sejarahnya sendiri: kenapa kontrak SKU-first gagal (580 baris macet) adalah bukti yang harus tetap terbaca.

---

## 9. Urutan eksekusi

**Langkah 0 — amankan.** Backup + SHA-256 + restore-test. Tag `pre-library-brand-first`.

**Langkah 1 — SSOT dulu, kode belakangan.** Tulis §6.14 (§8 di atas). Ini satu-satunya langkah yang tidak boleh ditunda, karena semua langkah lain melanggar kontrak yang masih tertulis.

**Langkah 2 — schema aditif** (belum ada yang dibuang, aplikasi tetap jalan):
- `Category`, `BrandCategory`, `MaterialPrice`
- `BrandLinkKind` + `DRIVE`, `PRICE_LIST`; `BrandLink.archive_url`
- `ProjectScheduleOption.spec_*` (coba generated column dulu)
- `ProjectProductRequest.brand_id?`

**Langkah 3 — seed kategori.** Rekonstruksi Brand × Category dari 483 baris kapabilitas `List` + 580 kandidat PENDING. Dry-run → review → apply. Setelah ini Library baru sudah punya isi walaupun UI-nya belum ada.

**Langkah 4 — Library brand-first untuk desainer.** Search kategori → daftar brand → panel brand: katalog PDF (iframe Drive preview), tombol ke web/IG, kontak, ketersediaan sample. **Ini titik di mana owner bisa menilai apakah modelnya benar** — sebelum ada yang dibongkar.

**Langkah 5 — reuse pool di form schedule.** Kotak "pernah dipakai" + insert-dari-snapshot. Jalur lama insert-dari-Material tetap hidup berdampingan dulu.

**Langkah 6 — request sample brand-first.** `ProjectProductRequest` pakai brand + deskripsi; `sku_id` diisi saat `RECEIVED`, memproduksi `Sku` + `Sample` + rak/box.

**Langkah 7 — baru sekarang bongkar.** Harga pindah ke `MaterialPrice`, pecah `library-service.ts` (sekaligus pasang gerbang `MASTERDATA_*` per §7), pensiunkan permukaan katalog per-SKU, bersihkan 6 pembaca `catalog_price` di `schedule-service.ts` + ~10 di `sketchup-actions.ts`, hapus jalur "save to library", arahkan library search `CatalogBoard` ke kolam reuse.

**Langkah 8 — verifikasi.** `prisma migrate diff` zero-drift · `tsc` bersih · `next build` · `verify-access-matrix.mjs` · **uji negatif: login sebagai DIC dan pastikan tidak ada satu pun angka harga Master Data yang bisa dicapai.**

Regresi wajib, buka satu per satu dan bandingkan dengan sebelum:
- Proyek lama: schedule + snapshot lama render identik
- **`/projects/[id]/extensions/product-catalog`** — preview, print (cover jadi halaman 1), dan Export to Sheets `.xlsx`. Ini jembatan resmi ke CostFlow (§7.1); kalau ini rusak, alur kantor berhenti dan itu tidak akan langsung kelihatan dari test lain
- **Panel brand sebagai DIC** — periksa payload jaringannya, bukan cuma layarnya: `BrandContact` dan link kind `WHATSAPP`/`MARKETPLACE`/`PRICE_LIST`/`OTHER` tidak boleh ikut terkirim sama sekali (§7.2)
- MOM print view
- CatalogBoard: tambah item manual + dari kolam reuse
- Request sample end-to-end: minta → `RECEIVED` → `Sku` + `Sample` + rak/box terisi

Urutan ini disengaja: **semua yang aditif dulu, pembongkaran paling akhir.** Setiap langkah sampai 6 bisa di-rollback tanpa menyentuh data proyek, dan model barunya sudah bisa dinilai di langkah 4 — jauh sebelum ada yang tidak bisa dibalik.

---

## 10. Risiko & yang belum diputuskan

**R1 — Katalog PDF: URL asal + salinan arsip.** Owner memilih dua-duanya. Yang perlu disiplin: `BrandLink.url` = sumber asli (jejak), `archive_url` = salinan Drive kantor (yang ditampilkan). Viewer pakai `https://drive.google.com/file/d/{id}/preview` di iframe — tanpa API key, **syaratnya file di-share "anyone with link"**. Kalau folder Drive kantor restricted, iframe tampil kosong dan butuh OAuth + Drive API (jauh lebih mahal). **Cek satu file dulu sebelum bangun viewer-nya.** Instagram memblokir embed — itu redirect, bukan preview, jangan dijanjikan sebagai viewer.

**R2 — Kolam reuse tanpa gerbang kurasi akan kotor.** Diterima, tapi perlu ambang: kalau satu spec cuma dipakai sekali dan setahun lalu, masih layak muncul di hasil search? Usul: urutkan berdasarkan frekuensi pakai + terakhir dipakai, jangan filter — biarkan urutan yang bekerja, bukan aturan penghapusan.

**R3 — ~~Estimator butuh akses schedule~~ SELESAI.** Owner memutuskan CostFlow tidak terhubung; desainer kirim PDF manual. Tidak ada permission lintas-app yang perlu dibuat. Lihat §7.1 — surface print/export-nya sudah ada dan sudah terbuka untuk DIC/DRIC.

**R4 — ~~SketchUp bridge menggantung~~ SELESAI, dengan satu catatan.** ADMIN-only, milik owner sendiri, tidak direfaktor. Tiga titik coupling-nya dan penanganannya ada di §5 poin 6.

**Catatan yang tersisa:** `SketchupMaterial.unit_cost` ikut tercetak dan ikut ke ekspor `.xlsx`, dan ekspor itu bisa dijalankan DIC/DRIC (`PLUGIN_SCHEDULE_VIEW`). Angkanya diketik manual oleh admin, jadi **bukan** kebocoran data Master Data — tapi kalau owner mengisinya dengan harga vendor asli, angka itu sampai ke desainer lewat pintu yang tidak dijaga. Dua pilihan: sadari dan pakai `unit_cost` hanya untuk angka kasar, atau sembunyikan kolomnya dari ekspor untuk role non-admin. **Perlu diputuskan, tapi kecil dan bisa belakangan.**

**R5 — ~~Kontak brand~~ SELESAI.** Tidak terlihat dari Library StudioFlow. Ikut menutup lubang `WHATSAPP`/`MARKETPLACE` di `BrandLink` sekaligus — lihat §7.2, karena menyembunyikan `BrandContact` sendirian tidak menyembunyikan apa pun.

**Konsekuensi alur kerja yang perlu disadari:** desainer yang butuh tanya ketersediaan ke brand sekarang tidak punya jalur langsung dari aplikasi. Jalurnya jadi **request sample**, atau tanya STAFF. Ini konsisten dengan modelnya — hubungan supplier milik Master Data — dan bukan lubang yang tertinggal. Tapi kalau di lapangan desainer ternyata tetap menelepon brand sendiri, aturan ini akan dilanggar di luar aplikasi (kontak dicatat di HP pribadi), dan itu lebih buruk daripada menampilkannya. **Pantau setelah langkah 4 jalan.**

**R6 — Curation queue baru selesai kemarin dan tujuannya sudah berubah.** Dibangun 31 Juli untuk menampung bukti-tanpa-SKU menuju Material. Sekarang bukti-tanpa-SKU jalan ke Brand+Category. Kodenya belum pernah dipakai produksi, jadi bug-nya belum ketemu **dan** arahnya sudah bergeser. Jangan tambal — pakai langkah 3 sebagai pemakaian nyata pertamanya, lalu nilai apakah UI-nya masih cocok.

**R7 — Ini pembalikan ketiga pada master data dalam dua hari** (§6.11 → §6.12 → §6.13 → §6.14). Bukan alasan untuk berhenti: 580 baris macet adalah bukti empiris, bukan perubahan selera. Tapi itu alasan kuat untuk **berhenti di langkah 4 dan menilai model barunya di layar** sebelum satu tabel pun dibongkar. Urutan di §9 memang dirancang begitu.
