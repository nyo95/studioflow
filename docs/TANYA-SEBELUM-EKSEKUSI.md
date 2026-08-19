# Pertanyaan sebelum eksekusi Master Data v2

**Dibuat:** 2026-08-10
**Untuk:** owner
**Sumber:** `roadmap.md` (seluruhnya) + `docs/PLAN-MASTERDATA-V2.md` + audit kode

Setiap pertanyaan punya **rekomendasi saya**. Kalau setuju semua, cukup balas
*"ikut rekomendasi"* dan saya jalan. Kalau ada yang beda, sebut nomornya saja —
mis. *"ikut rekomendasi kecuali Q4 dan Q11 pilih b"*.

Tujuh bertanda 🔴 **memblokir eksekusi** — tidak bisa saya tebak karena salah
tebak menghasilkan kerja yang harus diulang, bukan sekadar diperbaiki.

---

## ✅ TERJAWAB 2026-08-10

**Owner: *"sisanya ikut rekomendasi."*** Q3, Q5–Q13, Q15, Q17–Q20, Q23 mengikuti
rekomendasi apa adanya. Tiga jawaban mengubah rancangan dan dicatat terpisah:

### Lingkup Library dipersempit — mengubah Q4, Q5, Q6 sekaligus

> *"library studioflow - hanya mengambil table 1 dibagian yang saya screenshot.
> hanya utk mencari categori/tag2 category, munculkan card brand / bisa di sort
> atau di filter by category / by company / by brand. tiap card hanya utk
> memunculkan link."*

Table 1 **kolom A–G saja**: Company, Brand, Product Brand, Category, dan tiga
kolom Link (Google Drive, Website, Socmed). Bukan kolom H–K (Supplier
Information), bukan L–M (Update Information), bukan N (SKU relational).

Akibatnya:

| | Sebelum | Sesudah |
|---|---|---|
| View untuk StudioFlow | `v_library_brand` + `v_library_item` | **`v_library_brand` saja** |
| Q4 harga di Library | pertanyaan terbuka | **gugur** — tidak ada baris produk untuk ditempeli harga |
| Q5 `WorkPrice` di Library | rekomendasi "tidak" | tetap tidak, sekarang jelas |
| Q6 kontak di Library | rekomendasi "sembunyikan" | tetap, sekarang jelas |
| `PRICE_LIST` + `MARKETPLACE` di allowlist | ada | **keluar** — tidak ada di Table 1 (perlu konfirmasi, §baru N2) |

Rincian view-nya di `docs/PLAN-MASTERDATA-V2.md` §F.4.

### Aturan baru — penyimpangan dari Excel harus ditanya dulu

> *"setiap informasi yg menyimpang dari design database masterdata.xlsx →
> pertanyakan dulu."*

Berlaku sejak sekarang **dan surut**. Seluruh penyimpangan yang sudah terlanjur
saya putuskan sendiri dikeluarkan di
**`docs/PENYIMPANGAN-DARI-EXCEL.md`** — 25 butir, 9 di antaranya perlu
keputusan.

### Q8 `Sample` — dipertahankan, sisanya boleh di-drop

> *"yg selihat saya perlu di pertahankan hanya si sample dari masterdata, sisanya
> bisa di drop, tapi better kamu makesure dulu."*

**Hasil pengecekan — lihat §Q2a di bawah.** Ringkasnya: sebagian besar memang
aman di-drop karena bisa dipulihkan dari CSV di repo, **tapi tidak semuanya**,
dan yang tidak bisa dipulihkan justru termasuk `Sample`.

---

## Jawaban cepat

| # | Pertanyaan | Rekomendasi saya |
|---|---|---|
| 🔴 Q1 | DB-nya hidup di mana, sudah `migrate deploy`? | — perlu jawaban |
| 🔴 Q2 | Isi `master_data` sekarang berapa baris? | — perlu angka |
| 🔴 Q3 | 756 material candidate belum dikurasi — diapakan? | (b) ekspor CSV, impor ulang setelah v2 |
| 🔴 Q4 | Library boleh lihat harga beli + supplier? | **tidak** |
| Q5 | Library boleh lihat `WorkPrice` (tarif jasa)? | tidak |
| Q6 | Kontak tetap disembunyikan dari Library? | ya, tetap |
| 🔴 Q7 | `Sku.code` wajib, padahal sumbernya tidak punya kolom SKU? | (b) `code` nullable, identitas dari `slug` |
| Q8 | `Sample` (rak/box) dipertahankan? | ya |
| Q9 | `currency` perlu? | ya, biarkan (`IDR` default) |
| Q10 | Pohon kategori dibatasi dua tingkat? | tidak di DB, ya di UI |
| Q11 | `PartyRole` awal — siapa berperan apa? | semua brand-owner → `MANUFACTURER`, sisanya manual |
| Q12 | `WorkPrice.code` siapa yang bikin? | auto dari kategori + urutan, boleh diedit |
| Q13 | Route `/masterdata/curation` + `/promotions` ikut dibuang? | ya, kalau Q3 = (b) atau (c) |
| 🔴 Q14 | Rename kategori schedule tidak boleh tulis `master_data` — gantinya? | (a) berhenti dipetakan |
| Q15 | Bahasa UI Master Data v2 | Inggris |
| 🔴 Q16 | Siapa jalankan migrasi? Saya tidak punya akses DB | — perlu jawaban |
| Q17 | Eksekusi sekaligus M2–M6 atau bertahap? | bertahap, jeda review tiap tahap |
| Q18 | Branch terpisah atau working tree? | branch `masterdata-v2` |
| Q19 | 5 berkas mati (T1, T4) — hapus? | ya |
| Q20 | D2/D3/D5 dikerjakan kapan? | paralel, tidak menunggu Master Data |
| Q21 | A6 paket schedule masih diinginkan? | — perlu jawaban |
| Q22 | B1 foldering deliverable — folder user atau sistem? | — perlu jawaban |
| Q23 | C-SISA-3/5/6/7 prioritasnya? | hanya C-SISA-3 (drag-drop) |

---

## Blok 1 — Lingkungan & data

### 🔴 Q1. Database-nya hidup di mana, dan sudah pernah `migrate deploy`?

`docker-compose.yml` menyiapkan Postgres lokal; `.env` menunjuk
`localhost:5432/studioflow`, tapi komentarnya menyebut Supabase sebagai bentuk
produksinya.

Roadmap mencatat **tiga migrasi menunggu** di §A1 dan §C-SISA-1
(`20260806120000_add_sku_category`, `20260810120000_checklist_tasks`,
`20260810140000_activity_due_date`), dan folder `prisma/migrations/` berisi 13
migrasi yang belum pernah masuk git.

**Yang perlu saya tahu:**
- DB mana yang jadi acuan — lokal Docker, Supabase, atau keduanya?
- `npx prisma migrate status` keluarannya apa?

**Kenapa memblokir:** greenfield di DB kosong dan greenfield di DB berisi adalah
dua pekerjaan berbeda. Yang pertama satu sore; yang kedua butuh ekspor,
rekonsiliasi konflik, dan jendela di mana app tidak boleh dipakai.

### 🔴 Q2. Isi `master_data` sekarang berapa baris?

`docs/masterdata-seed/BUILD_SUMMARY.json` (31 Jul 2026) mencatat yang **pernah
di-seed**:

| Tabel | Baris |
|---|---|
| Brand (`vendors`) | 392 |
| BrandContact | 399 |
| BrandLink | 1010 |
| **Sku (`materials`)** | **0** |
| **Sample** | **0** |
| MaterialCandidate | 756 |
| SampleCandidate | 287 |

Kalau DB-nya masih seperti ini, sebagian besar pertanyaan berat di rancangan
**hilang sendiri**: tidak ada riwayat harga yang perlu diselamatkan, tidak ada
konflik `Sku.catalog_price` vs `MaterialPrice`, tidak ada `Sample` yang perlu
dipindahkan. M2 tinggal: ekspor 392 brand + kontak + link, terapkan v2, seed
ulang.

**Skripnya sudah saya siapkan** — read-only, tinggal dijalankan di mesin yang
punya DB dan kirim balik keluarannya apa adanya:

```bash
node scripts/count-masterdata.mjs
```

Ia menghitung 18 tabel `master_data` (memakai nama tabel fisik, karena beberapa
di-`@@map`), melaporkan tabel yang belum ada alih-alih gagal, dan menghitung satu
angka tambahan: **berapa SKU yang harganya berbeda antara `Material` dan
`MaterialPrice`**. Angka terakhir itu titik paling berisiko di M2 — kalau > 0,
tiap barisnya butuh keputusan manusia saat seeding.

### Q2a. "Sisanya bisa di-drop" — apa yang sebenarnya bisa dipulihkan

Diminta memastikan dulu. Hasilnya: **tidak semuanya bisa dipulihkan**, dan yang
paling berisiko justru `Sample` — hal yang justru ingin dipertahankan.

**Bisa dipulihkan** — datanya ada di repo, bukan hanya di database:

| Data v1 | Sumber pemulihan | Baris |
|---|---|---|
| Brand | `docs/masterdata-seed/01_vendors.csv` | 392 |
| BrandContact | `02_vendor_contacts.csv` | 399 |
| BrandLink | `03_vendor_links.csv` | 1010 |
| Antrian kurasi material | `06_material_candidates.csv` | 756 |
| Antrian kurasi sample **mentah** | `07_sample_candidates.csv` — sudah memuat `rack_number`, `box_number`, `quantity`, `status`, `current_borrower_name` | 287 |
| Workbook aslinya | `docs/RAD - Material + Supplier.xlsx` | — |

**TIDAK bisa dipulihkan** — hanya lahir dari UI, tidak pernah ada di CSV mana
pun. Semua halaman yang membuatnya baru ada sejak 5–6 Agustus, jadi isinya
bergantung pada berapa banyak yang sudah dipakai sejak itu:

| Data v1 | Lahir dari | Kenapa hilang |
|---|---|---|
| `Company` | halaman Supplier + tombol Backfill (§A5) | Pengelompokan brand → badan usaha adalah **keputusan manusia**. CSV hanya punya `legal_name` per brand |
| `MaterialPrice` | halaman Harga | Seluruh harga yang diketik sejak 5 Agu |
| `ServiceVendor` + `ServicePrice` + `MaterialLaborPrice` | tab Jasa | Tidak ada di workbook sumber sama sekali |
| **`Sample`** | promosi dari `SampleCandidate` lewat UI kurasi | CSV punya data **mentahnya**, tapi **bukan keputusan kurasinya** — sampel ini SKU yang mana |
| Keputusan kurasi | halaman Curation | `review_status`, `decision_notes`, `*_confirmed` yang sudah diisi manusia |
| `SkuCategory` | jalur `upsertSkuCategories` | Turunan `catalog_tags`, jadi ikut hilang kalau `Sku` hilang |

**Kesimpulan:** "drop semua kecuali Sample" **aman untuk brand/kontak/link**
karena ketiganya memang lahir dari CSV. Tidak aman untuk `Company`, harga, dan
keputusan kurasi — dan `Sample` sendiri hanya setengah aman: fisiknya bisa
di-seed ulang dari CSV, tapi sambungannya ke SKU tidak.

**Karena itu urutan M2 tetap: ekspor dulu, baru drop.** Bukan karena datanya
banyak, tapi karena yang sedikit itu justru yang tidak ada duplikatnya. Ekspornya
murah — satu skrip, sekali jalan.

**Menunggu `count-masterdata.mjs`.** Kalau enam tabel di daftar "tidak bisa
dipulihkan" ternyata nol baris semua, maka betul: drop bebas, tidak ada yang
perlu diselamatkan, dan M2 selesai dalam satu sore.

### 🔴 Q3. 756 material candidate yang belum dikurasi — diapakan?

Rancangan v2 **membuang** `MaterialCandidate` dan `SampleCandidate` (§C.2),
dengan alasan keduanya tabel staging impor sekali jalan. Alasan itu benar untuk
tabelnya. Tapi 756 + 287 baris di dalamnya bukan sampah — itu **antrian kerja
kurasi** yang belum dikerjakan, dan `1046 blockers` di ringkasan impor berarti
sebagian besar memang menunggu keputusan manusia.

| Opsi | Akibat |
|---|---|
| **(a)** Kurasi dulu sampai habis, baru M2 | Paling bersih, tapi menunda rombakan entah berapa lama |
| **(b) ← rekomendasi** Ekspor ke CSV, buang tabelnya, impor ulang setelah v2 lewat jalur impor baru | Antrian selamat, rombakan jalan, jalur impornya jadi permanen dan itu memang dibutuhkan |
| **(c)** Buang | Hilang 1043 baris hasil kerja impor 31 Juli |

**Kenapa (b).** Kalau antrian kurasi masih akan terjadi lagi — dan pasti, tiap
kali ada workbook supplier baru — maka jalur impornya memang harus permanen.
Bedanya di v2 ia hidup di schema `staging` terpisah, bukan menumpang di
`master_data` yang isinya harus data final.

---

## Blok 2 — Visibilitas & kontrak SSOT

### 🔴 Q4. Library StudioFlow boleh melihat harga beli dan identitas supplier?

Keputusan lama (1 Agu 2026, tercatat di `brand-library-service.ts`): *"ada harga
ga masalah"*. Itu jelas mencakup **harga jual**.

Yang belum pernah ditanyakan: apakah juga mencakup **`price_list`** (harga
sebelum diskon) dan **nama supplier**. Keduanya bersama-sama mengungkap margin
beli studio, di layar yang dipakai desainer di depan klien.

| | Library | BQ |
|---|---|---|
| `price_net` (harga jual) | ✅ sudah diputuskan | ✅ |
| `price_list` (sebelum diskon) | ❓ | ✅ |
| nama supplier | ❓ | ✅ |

**Rekomendasi: tidak.** Presedennya sudah ada dan masih berlaku — `BrandContact`
disembunyikan dari Library dengan alasan *"supplier relationships belong to
Master Data"*. Supplier per baris harga adalah hubungan supplier yang sama.

**Konsekuensi teknis kalau "tidak":** `v_library_item` menampilkan **satu** harga
per SKU (`price_net` termurah yang berlaku), bukan daftar penawaran per supplier.
Kalau "boleh", bentuknya jadi daftar. Ini yang membuatnya harus dijawab sebelum
view-nya ditulis, bukan sesudah.

> **✅ GUGUR 2026-08-10.** Lingkup Library dipersempit ke Table 1 kolom A–G —
> tidak ada satu pun baris produk di layarnya, jadi tidak ada tempat untuk harga
> apa pun. `v_library_item` batal dibuat. Pertanyaan ini tidak perlu dijawab.

### Q5. Library boleh melihat `WorkPrice` (tarif jasa/upah)?

Excel Table 3 & 4 berisi tarif vendor: `Penarikan kabel CAT` 1jt/titik,
`Screeding Base` 500rb/m².

**Rekomendasi: tidak.** Library adalah katalog **produk** — scope lock owner 1
Agu: *"Library for a designer is search-a-brand → view-its-catalog. Nothing
else."* Tarif pekerjaan bukan katalog dan bukan brand; ia milik BQ.

### Q6. Kontak (`PartyContact`) tetap disembunyikan dari Library?

Sekadar konfirmasi bahwa keputusan *"tidak usah"* masih berlaku di v2, karena
v2 memindahkan kontak dari `BrandContact` ke `PartyContact` — kalau aturannya
tidak ikut dipindahkan, ia hilang tanpa ada yang membatalkannya.

**Rekomendasi: ya, tetap disembunyikan.**

---

## Blok 3 — Bentuk skema

### 🔴 Q7. `Sku.code` wajib, padahal sumber datanya tidak punya kolom SKU

Ini yang paling mudah terlewat dan paling mahal kalau terlewat.

`BUILD_SUMMARY.json` mencatat dua fakta dari workbook sumber:

```
"source_has_explicit_sku_column": false
"fake_sku_generation": false
```

Artinya: **workbook aslinya tidak punya kolom SKU sama sekali**, dan impor 31
Juli sengaja **menolak mengarang** SKU palsu. Itu keputusan yang benar. Tapi
draft v2 saya membuat `Sku.code` **wajib** dan mengunci `@@unique([brand_id,
code])` — yang berarti tidak satu pun dari 756 kandidat itu bisa masuk tanpa
seseorang mengetik kode artikelnya satu per satu.

Excel yang baru pun begitu: `TH 231 AC - ANDESH WALNUT` punya kode, tapi
`plywood 9mm` tidak.

| Opsi | Akibat |
|---|---|
| **(a)** `code` tetap wajib | Setiap SKU tanpa kode artikel harus diberi kode karangan — persis yang impor Juli menolak lakukan |
| **(b) ← rekomendasi** `code` nullable; identitas kanonik = `slug` dari nama; `code` diisi kalau ada | Barang bermerek tetap punya kode artikel; barang generik cukup nama |
| **(c)** `code` wajib tapi auto-generate | Kode karangan yang terlihat asli — bentuk kesalahan yang paling sulit dideteksi |

**Kenapa (b).** Kode artikel pabrikan adalah *fakta tentang barang*, bukan
*kunci basis data*. Menjadikannya wajib memaksa mengarang fakta. `slug` yang
diturunkan aplikasi tidak berpura-pura jadi apa pun.

Kalau (b), `@@unique([brand_id, code])` diganti `@@unique([brand_id, slug])`,
plus partial unique pada `code` di mana ia terisi.

### Q8. `Sample` (register rak/box) dipertahankan?

Excel tidak menyebutnya sama sekali. Menurut `BUILD_SUMMARY` nol baris pernah
di-seed, tapi ada 287 `SampleCandidate` menunggu.

**Rekomendasi: ya, dipertahankan.** Excel ini merancang katalog dan harga, bukan
seluruh Master Data. Kalau memang fungsi rak sample mau dihentikan, itu keputusan
tersendiri — sebutkan saja dan saya buang berikut UI-nya.

### Q9. `currency` perlu?

Saya tambahkan `currency String @default("IDR")` di `SkuPrice` dan `WorkPrice`.

**Rekomendasi: biarkan.** Kolom mata uang jauh lebih murah ada dari awal
daripada di-backfill nanti, dan default-nya membuat ia tak terasa. Buang kalau
yakin tidak akan pernah ada harga dalam USD.

### Q10. Pohon kategori dibatasi dua tingkat?

Excel selalu dua tingkat (`MEP` → `Lighting`, `Bahan Baku` → `HPL`). Draft v2
memakai self-referencing tanpa batas kedalaman.

**Rekomendasi: tidak dibatasi di DB, dibatasi di UI.** Batas kedalaman di DB
adalah CHECK constraint yang harus dilonggarkan begitu ada satu kasus tingkat
ketiga; batas di UI cukup diubah satu angka. Kedalaman tak terbatas juga tidak
menambah ongkos apa pun selama `path` dirawat.

### Q11. `PartyRole` awal — siapa berperan apa?

v1 tidak punya konsep peran sama sekali, jadi seluruh 392 baris harus diberi
peran. Tidak ada di data yang bisa menebaknya.

**Rekomendasi:** seed otomatis semua pemilik brand → `MANUFACTURER`, lalu peran
lain (`SUPPLIER`, `RETAIL`, `SUBCON`, `DISTRIBUTOR`) diisi manual lewat UI.
Alasan: `MANUFACTURER` adalah satu-satunya peran yang bisa disimpulkan dari
fakta yang ada (ia memiliki merek). Sisanya menebak.

Kalau ada daftar toko/supplier yang sudah diketahui (Ace Hardware, Informa,
Depo, dsb.), kirim saja — saya masukkan ke seed.

### Q12. `WorkPrice.code` siapa yang membuatnya?

Kolomnya `@unique` dan dirujuk baris BQ, mis. `MEP-LGT-CAT6`.

**Rekomendasi:** dibuat otomatis dari slug kategori + nomor urut, boleh diedit
manusia sesudahnya. Kode yang harus diketik dari nol pada tiap entri akan
menghasilkan tabrakan dan format yang tidak seragam.

---

## Blok 4 — Ruang lingkup UI & perilaku

### Q13. Route `/masterdata/curation` dan `/masterdata/promotions` ikut dibuang?

Keduanya hidup di atas `MaterialCandidate`/`SampleCandidate` yang v2 buang.

**Rekomendasi: ya**, kalau Q3 dijawab (b) atau (c). Jalur impor yang baru
mendapat UI-nya sendiri di schema `staging`, bukan mewarisi yang ini.

Tujuh route `/masterdata/*` yang ada sekarang: `page`, `suppliers`, `materials`,
`prices`, `samples`, `curation`, `promotions`. Yang tersisa di v2 menurut
rekomendasi: lima yang pertama.

### 🔴 Q14. Rename kategori schedule tidak boleh lagi menulis `master_data` — gantinya apa?

`settings-service.ts:342`. Hari ini: mengganti nama kategori schedule di Studio
settings StudioFlow menulis ulang `Sku.catalog_tags` di seluruh `master_data`.

Itu harus berhenti — tapi berhentinya punya dua bentuk, dan keduanya keputusan
produk, bukan refactor:

| Opsi | Akibat |
|---|---|
| **(a) ← rekomendasi** Kategori schedule berhenti dipetakan ke kategori produk. Rename hanya mengubah milik StudioFlow | Sederhana. Ongkosnya: kategori schedule dan kategori produk boleh menyimpang, dan pencocokannya jadi pekerjaan pemetaan tersendiri |
| **(b)** Rename jadi permintaan yang Master Data setujui | Konsisten penuh, tapi menambah antrian persetujuan untuk hal sekecil ganti nama |
| **(c)** Kategori schedule dibaca **dari** Master Data, tidak punya salinan sendiri | Paling benar secara SSOT, tapi berarti StudioFlow tidak bisa punya kategori yang belum ada produknya |

**Kenapa (a).** Kategori schedule dan kategori produk memang bukan hal yang
sama: `PT-01` adalah *posisi di gambar*, `HPL` adalah *jenis barang*. Selama ini
keduanya dipaksa satu karena kebetulan namanya sering sama.

### Q15. Bahasa UI Master Data v2

Roadmap §D4 sudah menetapkan **Inggris**, dan Master Data sengaja dilewati saat
penyeragaman supaya diterjemahkan sekali di sini.

**Rekomendasi: Inggris.** Sekadar konfirmasi sebelum saya menulis ratusan label.

---

## Blok 5 — Cara kerja eksekusi

### 🔴 Q16. Siapa yang menjalankan migrasi?

**Saya tidak punya akses ke database dari sini.** Yang bisa saya lakukan:
menulis schema, migrasi SQL, skrip ekspor/seed, dan menjalankan `prisma
validate` / `tsc` / `eslint` / `npm test`.

Yang **harus** dijalankan di mesin yang punya DB: `migrate deploy`, skrip
ekspor, skrip seed, `GRANT`/`REVOKE`, dan enam uji verifikasi di §M6.

Perlu dipastikan: apakah kamu yang menjalankannya dan mengirim balik
keluarannya? Kalau iya, saya siapkan tiap langkah sebagai satu perintah yang
bisa disalin, bukan instruksi bertele-tele.

### Q17. Sekaligus M2–M6 atau bertahap?

**Rekomendasi: bertahap dengan jeda review.** Urutan yang saya usulkan:

1. **M2a** — skrip ekspor + laporan konflik (tanpa mengubah apa pun). Kamu
   jalankan, kirim keluarannya. Di sini kita tahu ukuran sebenarnya.
2. **M2b** — schema v2 + SQL invariant + skrip seed
3. **M3** — service layer + UI Master Data
4. **M4** — view + DTO + pindahkan 21 operasi tulis + `REVOKE`
5. **M5** — lepas lima FK
6. **M6** — verifikasi

Alasan: langkah 1 murah dan mengubah semua estimasi setelahnya. Menjalankan
semuanya sekaligus berarti menemukan ukuran sebenarnya setelah `DROP SCHEMA`.

### Q18. Branch terpisah atau langsung di working tree?

`git status` sekarang menunjukkan ~90 berkas termodifikasi dan ~60 belum
ter-track — pekerjaan beberapa sesi yang belum di-commit.

**Rekomendasi:** commit dulu yang ada sekarang, lalu branch `masterdata-v2`.
Rombakan ini menyentuh schema, service, dan UI sekaligus; kalau bercampur dengan
pekerjaan StudioFlow yang belum di-commit, tidak ada cara membatalkannya
sebagian.

---

## Blok 6 — Sisa roadmap di luar Master Data

Bukan blocker, tapi perlu arah supaya tidak menggantung.

### Q19. Lima berkas mati — hapus? (§T1, §T4)

| Berkas | Digantikan oleh |
|---|---|
| `MasterDataSkusClient.tsx` | route-nya sudah dihapus 2026-08-06 |
| `components/delete-button.tsx` | `RowActions` |
| `components/activity-list-today.tsx` | `TodayView` |
| `components/today-task-item.tsx` | `TaskRow` |
| `types/dashboard.ts` | `types/task-feed.ts` |

Nol importer semuanya. Belum dihapus karena menghapus berkas sumber di luar yang
diminta.

**Rekomendasi: hapus.** `tsc` langsung menangkap kalau keliru. Ditambah
`src/generated/prisma_old_bak/` yang juga terlihat mati.

### Q20. D2, D3, D5 (temuan audit UX) dikerjakan kapan?

- **D2** — 14 tempat memakai `confirm()` bawaan browser, yang bisa dimatikan
  permanen oleh "jangan tampilkan lagi"
- **D3** — enam berkas dengan nol `toast`, jadi kegagalannya tidak terlihat
- **D5** — sepuluh tabel gepeng di layar sempit, satu baris per berkas

**Rekomendasi: paralel, tidak menunggu Master Data.** Ketiganya di StudioFlow
dan tidak bersinggungan dengan §M sama sekali. D5 yang paling murah.

### Q21. A6 — paket schedule berisi produk terpilih, masih diinginkan?

Rancangannya sudah lengkap di roadmap. Ia bergantung pada validasi kategori SKU
yang v2 ubah bentuknya, jadi mengerjakannya sebelum §M selesai berarti
menyentuhnya dua kali.

**Perlu jawaban:** masih diinginkan? Kalau ya, ia masuk antrian setelah M3.

### Q22. B1 — foldering deliverable per fase: folder buatan user atau ditentukan sistem?

`File` sekarang datar di bawah `Revision`, tanpa kolom folder atau path.
`PrefixDictionary` memetakan `schedule_category` → prefix per section.

Jawabannya menentukan apakah butuh migrasi. Belum bisa saya rinci tanpa arah ini.

### Q23. C-SISA-3/5/6/7 — prioritasnya?

| | Isi | Rekomendasi |
|---|---|---|
| C-SISA-3 | Drag-and-drop pengurutan task. Aksi `reorderTasks` **sudah jalan**, `@dnd-kit` sudah ada — yang kurang hanya cara menyeretnya di layar | **kerjakan** |
| C-SISA-5 | Filter tersimpan | tunda (sudah diputuskan owner) |
| C-SISA-6 | Task berulang | tunda — sebesar seluruh bagian C digabung |
| C-SISA-7 | Notifikasi assignee | tunda — StudioFlow belum punya mekanisme notifikasi sama sekali |

---

## Yang **tidak** saya tanyakan, dan kenapa

Supaya jelas mana yang sudah saya putuskan sendiri berdasarkan bukti di repo:

| Sudah diputuskan | Dasarnya |
|---|---|
| Kolom `Items` Excel → satu kolom `name` wajib | Blok pertama Table 3/4 menaruh nama pekerjaan di `Specification 1`; itu slot yang sama |
| Table 3 + 4 → satu `WorkPrice` | Kolomnya identik; bedanya data (`material_price` NULL atau tidak) |
| `Decimal` menggantikan `Float` | 10 kolom uang; galat pembulatan di dokumen komersial |
| Satu `Party` + `PartyRole` | Excel kolom J+K menggambarkan satu entitas banyak peran |
| Satu pohon `Category` | Excel memunculkan pasangan dua tingkat empat kali dengan nama berbeda |
| Harga keluar dari tabel produk | Menyimpan harga baru = menghapus harga lama |
| `Sku.brand_id` nullable | Excel menyatakannya eksplisit; contohnya `plywood 9mm` brand `-` |
| Socmed tetap tabel link, bukan JSON | JSON tidak bisa di-unique-kan, diurutkan, atau dicari |
| Dimensi tetap numerik | BQ menghitung m² dari angkanya |

Kalau ada yang mau dibalik, sebut saja — semuanya masih di atas kertas.
