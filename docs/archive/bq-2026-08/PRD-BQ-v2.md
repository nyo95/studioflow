# PRD — BQ (Bill of Quantity)

**Revisi 3 — 2026-08-27.** Ditulis ulang mengikuti keputusan owner hari itu,
lalu disederhanakan lagi sore harinya (markup dibuang, fallback harga dibuka).
**Status:** KANONIK untuk `src/subapps/bq/`, `src/app/bq/`, dan schema `bq`.

> **Revisi 1 (pagi 2026-08-27) sudah tidak berlaku.** Ia masih membawa asumsi
> dari PRD lama. Owner: *"PRD lama lupain aja."* Berkas ini berdiri sendiri —
> jangan menambalnya dengan bab dari `PRD_Fixture_Breakdown.md`.

**Dokumen pendamping yang tetap mengikat:** `designbq.md` (arah rasa & UI).

---

## 0. Status `BQ template tes.xlsx`

**Workbook itu MOCKUP, bukan spesifikasi.** Keputusan owner 2026-08-27.

Ia berguna untuk dua hal: memperlihatkan bentuk dokumen yang dicetak ke klien
(sheet `BQ`), dan menyediakan bahan mentah untuk mengisi library (sheet `Tes`).
Ia **bukan** acuan harga, bukan model data, dan bentuk aplikasinya **tidak wajib
persis sama**.

Konsekuensi yang harus dipegang: kalau model di bawah ini berbeda dari workbook,
**yang menang model ini**. Jangan lagi menurunkan aturan dari formula Excel.

---

## 1. Apa itu BQ

Pengganti Excel untuk estimator. Estimator memilih harga dari Master Data,
menuliskan **koefisien pemakaian** hasil penilaiannya atas gambar kerja, dan
sistem mengalikannya.

Bukan costing engine: tidak ada simulasi nesting, tidak ada waste yang dihitung
mesin, tidak ada pembelian yang dibulatkan diam-diam.

Aturan rasa & UI ada di `designbq.md`. Yang paling sering dilanggar: *"jangan
memindahkan fokus dari koefisien ke otomasi yang tidak perlu."*

---

## 2. Model — lima lapis

```
L0  Section        FIXTURES              PRELIMINARIES     pengelompok
 └ L1  Sub Section   KABINET               Floor Works      pengelompok
    └ L2  Sub Section  (opsional)          Shopfront Area   pengelompok
       └ L3  Works      Pintu Kabinet      Screeding Base   BERAPA UNIT
          └ L4  Sub-Works  penyusun pintu  Material HT      KOEFISIEN × HARGA
```

| Lapis | Tabel | Isinya | Punya subtotal |
|---|---|---|---|
| L0 Section | `BqSection` (`parent_id` NULL) | nama | ya |
| L1 Sub Section | `BqSection` | nama | ya |
| L2 Sub Section | `BqSection` | nama, **opsional** | ya |
| **L3 Works** | `BqObject` | nama, **qty**, satuan | — |
| **L4 Sub-Works** | `BqMaterialLine` / `BqServiceLine` | **koefisien**, harga snapshot | — |

### 2.1 Pembagian tugas antar lapis

Ini inti modelnya, dan satu-satunya hal yang tidak boleh dikaburkan:

- **L4 adalah satu-satunya lapis yang dirinci dengan perhitungan.** Koefisien ×
  harga. Di sinilah seluruh biaya sebenarnya lahir.
- **L3 adalah pengali.** Ia menjawab *"berapa unit"*, bukan *"terbuat dari apa"*.
  Harga satuannya **tidak diketik** — ia hasil penjumlahan L4 di bawahnya.
- **L0–L2 tidak punya angka sendiri.** Hanya nama dan subtotal.

Contoh furniture, dari owner:

```
L0  FIXTURES
 └ L1  KABINET
    └ L3  Pintu Kabinet          qty 4 unit
       └ L4  Plywood 9mm          koef 0,5 lembar  × harga
       └ L4  HPL                  koef 0,7 lembar  × harga
       └ L4  Engsel               koef 2 pcs       × harga
       └ L4  Jasa finishing       koef 1 unit      × harga
```

Harga satuan "Pintu Kabinet" lahir dari empat baris itu; qty 4 mengalikannya.
**Tidak ada lapis rakitan di antara L3 dan L4.**

### 2.2 `BqSubObject` — dipensiunkan

Tabel `BqSubObject` (pengali qty tanpa satuan dan tanpa harga) adalah sisa model
lama "tiga lapis fixture". Model ini tidak memakainya: kasus furniture yang dulu
jadi alasan keberadaannya kini ditangani L3 + L4 langsung (§2.1).

Status: **dibiarkan di schema, tidak dipakai jalur baru, jangan dibangun di
atasnya.** Penghapusannya dijadwalkan terpisah.

### 2.3 Kedalaman

Pengelompok maksimal **tiga lapis** (L0 → L1 → L2), L1 dan L2 sama-sama
opsional. `BqObject.section_id` NULLABLE dan harus tetap begitu — memaksa
Section berarti setiap BQ kecil harus mengarang "A PEKERJAAN" sebelum boleh
menulis satu baris.

Batas ini mengikuti model, bukan bentuk cetak. Ditegakkan
`createBqSectionAction` di **jalur tulis**.

> **Jalur baca tidak pernah menegakkan batas apa pun.** Data yang terlanjur
> lebih dalam, pengelompok yatim (induknya di-soft-delete), bahkan data yang
> berputar — semuanya tetap ditampilkan. *Yang tidak tampil tidak bisa
> diperbaiki pengguna.* Berlaku umum di seluruh subapp.

---

## 3. Mesin hitung

### 3.1 Rumus

```
biaya satu baris L4   =  koefisien × harga snapshot
Harga Satuan L3       =  Σ biaya L4 di bawahnya
Total L3              =  Harga Satuan × qty L3
Subtotal pengelompok  =  Σ Total L3 di bawahnya, termasuk lewat anak
Grand Total           =  Σ Total L3
```

**Koefisien ada di dua tempat, dan mekaniknya sama: mengalikan.**

- **koefisien L4** — berapa banyak bahan/jasa itu untuk SATU unit L3
- **koefisien L3** (qty) — berapa banyak unit L3 itu di project

Tidak ada lapis pengali ketiga.

**Tidak ada markup, OH, profit, PPN, maupun diskon** — lihat §3.5. Seluruh angka
BQ lahir dari koefisien × harga, dan tidak ada apa pun yang ditambahkan
sesudahnya.

> **Aturan tunggal kalau ragu:** kalau sebuah usulan menambah angka yang bukan
> koefisien atau bukan harga, jawabannya tidak. Keputusan owner 2026-08-27:
> *"pokoknya sederhana aja, ga usah ribet-ribet dan automasi gimana-gimana."*

### 3.2 Satu tempat

Seluruh aritmatika hidup di `src/subapps/bq/lib/calc.ts`. Modul itu **murni**:
tidak menyentuh Prisma, `server-only`, DOM, atau tanggal sekarang. Batas itu
yang membuat mesin hitung tidak bisa diam-diam membaca ulang master data, dan
yang membuatnya bisa diuji tanpa database.

**DILARANG menjumlahkan biaya di komponen klien, service, atau action.** `reduce`
atas harga di luar `calc.ts` jadi sumber kebenaran kedua, dan selisih semacam itu
selalu ketahuan belakangan — di kertas penawaran.

Satu pengecualian yang disengaja dan sudah diisolasi: subtotal pengelompok
dijumlahkan `lib/section-rollup.ts`, dari hasil `computeObject()` yang sama yang
dipakai grand total. Fungsi murni, ada testnya.

### 3.3 Subtotal pengelompok wajib post-order

Anak dulu, induk belakangan. Loop datar sekali jalan hanya benar pada pohon dua
lapis:

```
sections: B → III → Shopfront        direct: Shopfront = 100
  III  induk B   → B   = 0 + rollup[III](=0) = 0    ← B dikunci sebelum terisi
  Shopfront induk III → III = 0 + 100        = 100

hasil:  III = 100 benar    B = 0 SALAH
```

`SUBTOTAL B` jadi nol pada Section yang seluruh Works-nya duduk di dalam L2.
**Jangan pernah mengembalikannya ke loop datar.**

### 3.4 Field yang dibawa tapi tidak dihitung

`conversion`, `wasteOverridePct`, `materialDefaultWastePct`,
`categoryDefaultWastePct`, `minimumOrder`, `roundingIncrement` masih ada di
`MaterialLineInput` dan kolom snapshot. **Tidak satu pun dipakai menghitung** —
dibawa sebagai provenance historis supaya baris lama tetap bisa dijelaskan
asalnya. Ini bukan bug. Menghidupkannya kembali membalik premis §1.

### 3.5 Markup dibuang

**Keputusan owner 2026-08-27:** OH, profit, markup, PPN, dan diskon —
*"TIDAK MAU DI BUAT SERUMIT INI"*. Dan: *"hitungan hanya dari koefisien."*

Jadi BQ tidak mengenal margin sama sekali. Harga satuan sebuah Works adalah
biaya pokoknya, titik. Kalau kantor perlu menambahkan margin, itu terjadi di
luar BQ — di dokumen penawaran, atau sudah termasuk di harga Master Data.

> **⚠️ Kode belum menyusul.** `markup_pct` masih ada di `BqObject`,
> `BqSettings.default_markup_pct` masih ada, `BQ_MARKUP_EDIT` masih terdaftar di
> RBAC, dan `computeObject()` masih mengalikannya — ~60 kemunculan, termasuk 7 di
> `calc.test.ts`. Dilacak roadmap **BQ-39**. **Sampai dikerjakan, markup masih
> hidup di aplikasi.**

## 4. Library resep BQ

**Library menyimpan resep L3.** Satu resep = satu Works beserta baris L4-nya.

```
Resep: "Pintu Kabinet HPL"
  ├ L4  → sku_id: <Plywood 9mm>      koef 0,5
  ├ L4  → sku_id: <HPL putih>        koef 0,7
  ├ L4  → sku_id: <Engsel Huben>     koef 2
  └ L4  → work_price_id: <Finishing> koef 1
```

### 4.1 Yang disimpan adalah RUJUKAN, bukan harga

Baris L4 di library menyimpan **id master data** (`sku_id` / `work_price_id`) dan
koefisiennya. **Tidak ada kolom `snapshot_*` di tabel library.**

Harga baru dibekukan **saat resep diimpor ke project** — diambil dari master data
pada detik itu. Dua project yang mengimpor resep yang sama di bulan berbeda dapat
harga yang berbeda, dan itu memang yang diinginkan.

Konsekuensinya: memperbarui harga di Master Data otomatis memperbarui resep
library (karena ia cuma menunjuk), tapi **tidak pernah** menyentuh project yang
sudah mengimpornya (§6).

### 4.2 Varian dibedakan lewat NAMA

Spec masuk ke dalam nama resep. Tidak ada struktur varian, tidak ada field
`variantGroup`, tidak ada pengelompokan varian:

```
Second Skin Partition (Plywood 9mm)
Second Skin Partition (Gypsum 9mm)
Flat Ceiling (Hollow t.0,8 + Gypsum 9mm)
Flat Ceiling (Hollow t.1,2 + Plywood 9mm)
```

Estimator yang butuh yang plywood tinggal mencarinya. Bentuknya **daftar datar
yang dicari lewat search** — bukan pohon, bukan kategori bertingkat.

> Heuristik "kategori berbeda = aditif, kategori sama = varian" yang sempat
> diusulkan **dibatalkan** — owner: *"terlalu ribet."* Impor dari sheet `Tes`
> menghasilkan draft yang dikurasi manual.

---

## 5. Dari mana harga datang

**Master Data lebih dulu.** BQ **membaca** `master_data`; `master_data` tidak
tahu BQ ada. Tidak ada satu pun berkas di `src/subapps/bq/` yang boleh
**menulis** ke tabel `master_data`.

Tapi estimator tidak pernah diblokir. Untuk yang tidak ada di Master Data,
keputusan owner 2026-08-27 memberi dua jalan keluar:

| Jalan | Untuk apa | Hidup di mana |
|---|---|---|
| **Override per project** | sekali pakai, khas project itu | baris L4 di project, `PROJECT_LOCAL` |
| **Library BQ** | berulang, tapi memang bukan urusan Master Data | resep L3 di library BQ |

Owner: *"data yang tidak ada di master data → override per proyek / dibuat
library di bq saja."*

Ini menyelesaikan `ALAT`, `BIAYA_UMUM`, dan `TRANSPORT_AKOMODASI`, yang memang
tidak punya padanan di Master Data — tidak ada SKU *"akomodasi supervisor"*.
Ketiganya sah hidup sebagai override project atau entri library BQ, **tanpa
menunggu Master Data menyediakan tempat**.

### 5.1 Urutannya tetap: Master Data dulu

Dua jalan keluar di atas adalah **jalan keluar**, bukan jalan pintas. Bahan atau
jasa yang seharusnya ada di Master Data tetap diminta ke staff lewat Master Data
— supaya harga yang sama tidak hidup di lima project dengan lima angka berbeda.
Override dipakai ketika itemnya memang bukan urusan Master Data.

### 5.2 Kosong bukan nol

Harga yang hilang membuat sebuah SKU **tidak siap dipakai** — dilaporkan sebagai
`readiness.reason`, **tidak pernah** disulap jadi `?? 0` yang kemudian tercetak
di dokumen komersial.

Kalau satu SKU punya beberapa supplier, picker menampilkan seluruh opsi dan
estimator memilihnya **eksplisit**. Pilihan itu ikut dibekukan ke snapshot.

## 6. Snapshot — larangan silent update

Setiap baris L4 di **project** membekukan harga, satuan, dan tanggal saat baris
dibuat. **Sistem tidak pernah membaca ulang master data saat menampilkan
breakdown.**

- `breakdown-service.ts` membaca kolom `snapshot_*` saja. Satu join "kecil" ke
  `SkuPrice` di sana membuat setiap Works diam-diam mengikuti harga hari ini.
- **Tidak ada refresh, tidak ada drift, tidak ada banner "update available".**
  Ditegaskan owner 2026-08-24, dieksekusi R9: `price-drift-service.ts` dan
  seluruh mekanisme lapor-drift **sudah dihapus**. Jangan dibangun lagi.
- Satu-satunya cara mengubah nilai baris yang sudah ada adalah **suntingan
  manual**, ditandai `is_manual_override`, hidup di project itu saja, tidak
  pernah merambat balik ke Master Data.
- Works terkunci (`locked_at`) tidak menerima perubahan apa pun. Diperiksa di
  server — menyembunyikan tombol bukan pengamanan.

Perhatikan pembagiannya: **library menunjuk** (§4.1), **project membekukan**
(§6). Keduanya sengaja berbeda.

---

## 7. Template kerangka

Template kantor menuang **kerangka pengelompok saja** — L0, L1, dan L2 kalau ada.
L3 Works **tidak ikut dibuat**; ia ditawarkan sebagai saran.

Versi pertama menuang seluruh 97 Works sekaligus, dan hasilnya salah arah: BQ
baru langsung berisi 97 pekerjaan bernilai Rp 0 — Security, Insurance, Fire
Retardant — yang mayoritasnya tidak ada di project itu. Estimator jadi harus
**menghapus**, dan menghapus lebih berisiko daripada menambah: satu baris yang
lupa dibuang tetap tercetak ke penawaran sebagai pekerjaan bernilai nol.

Yang tidak diklik tidak pernah ada.

**Konsekuensi yang disengaja:** BQ hasil template kosong sampai estimator
mengisinya. Itu jujur — kerangka kosong memang belum punya harga. Yang berbahaya
adalah kerangka yang tampak sudah berharga padahal angkanya karangan.

> Template menuang baris L3 sebagai `PROJECT_LOCAL` harga 0. Sesuai §5 itu tetap
> sah — ia override project yang menunggu diisi, bukan pelanggaran. Yang perlu
> diperbaiki cuma pengalamannya: baris harga 0 harus terlihat jelas *belum diisi*,
> bukan terbaca seolah gratis.

---

## 8. Kategori biaya

`BqCostCategory`: `MATERIAL` · `UPAH` · `ALAT` · `BIAYA_UMUM` ·
`TRANSPORT_AKOMODASI`.

Lapisan **pelaporan**, bukan pengganti pemisahan bahan/jasa: baris bahan menunjuk
SKU dan baris jasa menunjuk WorkPrice, dan itu tetap.

Borongan (*"Material + Upah"* di mockup) **bukan** nilai enum baru — ia baris
jasa dengan `snapshot_has_material = true`, diwarisi dari `WorkPrice.has_material`.
Tampilannya belum ada (BQ-34); tanpa itu rekap per kategori menggolongkan
borongan sebagai Upah murni.

`ALAT`, `BIAYA_UMUM`, dan `TRANSPORT_AKOMODASI` tidak punya padanan di Master
Data. Sesuai §5 keduanya sah lewat override project atau library BQ — ini bukan
lagi masalah terbuka.

---

## 9. Peran & permission

| Permission | Cakupan |
|---|---|
| `BQ_ACCESS` | masuk ke surface `/bq` |
| `BQ_PROJECT_MANAGE` | buat / ubah nama / arsipkan project BQ |
| `BQ_BREAKDOWN_EDIT` | Section, Works, baris L4 |
| `BQ_MARKUP_EDIT` | ⚠️ **akan dicabut** bersama markup (§3.5, BQ-39) |
| `BQ_SETTINGS_MANAGE` | `BqSettings` (default markup, mata uang) |

Permission `BQ_*` granular milik StudioFlow. Penolakan ditegakkan **di server**,
di setiap aksi tulis.

> Doc `BQ_SETTINGS_MANAGE` di `constants.ts` masih menyebut `BqMaterialProfile`
> dan `category waste defaults` — keduanya dihapus di R1. Permission-nya sendiri
> tetap sah untuk `BqSettings`.

---

## 10. Arsip — yang sudah GUGUR

Ada supaya tidak ada yang menghidupkannya lagi karena membaca dokumen lama.

| Yang gugur | Kapan & kenapa |
|---|---|
| `BqDetailMode` (mode detail/ringkas) | O3, 2026-08-19. Model §2 dirancang supaya tidak pernah dibutuhkan. |
| `BqMaterialProfile` — costing pindah ke `master_data.Sku` | R1, 2026-08-19 |
| `BqCategoryWaste` — waste default per kategori | R1, 2026-08-19 |
| `price-drift-service.ts`, `pickPrice()`, seluruh field drift | R9, 2026-08-24 |
| `BqPurchaseSummary` + packaging variance di viewer kerja | R2, 2026-08-26 |
| Urutan "waste sebelum pengali L2", "pembulatan setelah agregasi" | gugur bersama waste & rounding |
| Contoh angka Rp4.711.299 / Rp5.653.559 / variance Rp721.201 | tidak bisa direproduksi mode koefisien — lihat §11 |
| "Tiga lapis, tidak lebih" (`BqObject → BqSubObject → L3`) | digantikan §2 |
| Heuristik varian aditif-vs-pengganti | dibatalkan owner 2026-08-27 — *"terlalu ribet"* |
| Markup / OH / profit / PPN / diskon | dibuang owner 2026-08-27 — *"TIDAK MAU DI BUAT SERUMIT INI"*. **Belum dicabut dari kode**, lihat §3.5 dan BQ-39. |

---

## 11. Gerbang & invariant

```
npx prisma validate
npx tsc --noEmit
npx eslint src/
npm test
```

### ⚠️ AT-01 adalah gerbang hantu

Tujuh dokumen menyatakan *"AT-01 = Rp5.653.559 dikunci `calc.test.ts`"*, dan
setiap handoff memerintahkan agen berikutnya menjaganya.

**Angka itu tidak ada di satu berkas pun** di `src/` maupun `prisma/` — dicari
juga sebagai `5_653_559` dan `5653559`. Ia gugur saat R1/R2 menulis ulang
`calc.ts` ke mode koefisien, tapi dokumennya tidak ikut dikoreksi.

`calc.test.ts` yang hidup tetap sah dan tetap lulus; ia menguji fixture lain
(164.500 / 197.400 / 592.200). Yang hilang **gerbangnya**, bukan mesin hitungnya.

**Jangan mengutip AT-01.** Tapi ia juga tidak perlu pengganti yang setara.

AT-01 dulu masuk akal karena mesin hitungnya rumit — waste berlapis, konversi
satuan, pembulatan pembelian — sehingga butuh satu contoh nyata dari dokumen
kantor untuk membuktikan seluruh rantainya benar. Rantai itu sudah tidak ada.

Yang tersisa cuma perkalian. Gerbangnya cukup test aritmatika biasa dengan angka
yang jelas benar (`2 × 100.000 = 200.000`), dan itu **tidak butuh keputusan
owner**. Menuntut "fixture kanonik" sebelum boleh menyentuh angka adalah
kerumitan yang kita buat sendiri.

### Test yang benar-benar ada

| Berkas | Isi |
|---|---|
| `lib/calc.test.ts` | 10 test — koefisien × harga, markup, qty, jalur langsung & sub-object |
| `lib/section-rollup.test.ts` | 8 test — post-order, regresi "SUBTOTAL B = 0", invarian urutan, orphan, siklus |
| `lib/section-tree.test.ts` | 12 test — penomoran per lapis, pohon 3 lapis, orphan, self-parent, siklus, data lebih dalam dari batas |

---

## 12. Belum diputuskan

| # | Pertanyaan | Menunggu |
|---|---|---|
| **BQ-1** | Export Internal Cost Detail — PDF atau xlsx, kolom apa | owner |
| **BQ-13** | Cabut `BQ_ACCESS` dari STAFF? | owner |
| — | Penomoran cetak L3 Works — **keputusan UI**, bukan model | BQ-35 |

Sudah terjawab dan **tidak lagi terbuka**: letak markup (dibuang, §3.5), nasib
`PROJECT_LOCAL` (tetap sah sebagai override, §5), dan gerbang pengganti AT-01
(cukup test aritmatika, §11).

## 13. Menggantung secara operasional

**BQ-2** — enam migrasi belum diterapkan ke database. `/bq` gagal query sebelum
`npx prisma migrate dev` dijalankan owner. Bukan keputusan desain, cuma langkah
yang belum dijalankan.
