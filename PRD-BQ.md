# PRD — BQ (Bill of Quantity)

**2026-08-27.** Kanonik untuk `src/subapps/bq/`, `src/app/bq/`, schema `bq`.
Pendamping yang tetap mengikat: **`designbq.md`** (arah rasa & UI).

> Menggantikan `PRD-BQ-v2.md` dan seluruh bab `PRD_Fixture_Breakdown.md`.
> Dokumen BQ lama sudah dipindah ke `docs/archive/` — **jangan menambal berkas
> ini dengan isinya.**

---

## 1. Prinsip

BQ adalah **pengganti Excel untuk estimator**, bukan costing engine. Estimator
memilih harga dari Master Data, menulis **koefisien** hasil penilaiannya atas
gambar kerja, sistem mengalikannya. Titik.

> **Aturan tunggal kalau ragu** (owner 2026-08-27): *"pokoknya sederhana aja, ga
> usah ribet-ribet dan automasi gimana-gimana."*
> **Kalau sebuah usulan menambah angka yang bukan koefisien atau bukan harga,
> jawabannya tidak.**

---

## 2. Model

**Aturan bentuknya dua kalimat:**

```
Section      →  Sub Section  DAN  Works
Sub Section  →  Works saja
```

```
L0  Section       FIXTURES           PRELIMINARIES     pengelompok
 └ L1  Sub Section  KABINET            (tidak dipakai)  pengelompok, OPSIONAL
    └ L2  Works       Pintu Kabinet     Mobilization    BERAPA UNIT
       └ L3  Sub-Works  penyusun pintu   Material HT    KOEFISIEN × HARGA
```

| Lapis | Tabel | Isinya | Punya subtotal |
|---|---|---|---|
| L0 Section | `BqSection` (`parent_id` NULL) | nama | ya |
| L1 Sub Section | `BqSection` | nama, **opsional** | ya |
| **L2 Works** | `BqObject` | nama, satuan, **koefisien (qty)** | — |
| **L3 Sub-Works** | `BqMaterialLine` / `BqServiceLine` | **koefisien**, harga snapshot | — |

### 2.1 Pembagian tugas antar lapis

Inti modelnya, dan satu-satunya hal yang tidak boleh dikaburkan:

- **Sub-Works adalah satu-satunya lapis yang dirinci dengan perhitungan.**
  Koefisien × harga. Di sinilah seluruh biaya lahir.
- **Works adalah pengali.** Ia menjawab *"berapa unit"*, bukan *"terbuat dari
  apa"*. Harga satuannya **tidak diketik** — ia hasil penjumlahan Sub-Works.
- **Section dan Sub Section tidak punya angka sendiri.** Hanya nama dan subtotal.

Works boleh menggantung langsung di Section (bentuk PRELIMINARIES) atau di dalam
Sub Section (bentuk Floor Works). Keduanya dicetak dengan aturan yang sama.

Contoh furniture:

```
L0 FIXTURES → L1 KABINET → L2 Pintu Kabinet (qty 4)
                              ├ L3 Plywood 9mm   koef 0,5 × harga
                              ├ L3 HPL           koef 0,7 × harga
                              └ L3 Jasa finishing koef 1  × harga
```

Nama-nama di panel Sumber (Mobilization, Security, Loading/Unloading) semuanya
**Works** — pekerjaan seperti itu tidak butuh elemen Sub-Works di tengah,
barisnya menempel langsung.

### 2.2 `BqSubObject` — dipensiunkan

Tabel `BqSubObject` (pengali qty tanpa satuan dan tanpa harga) adalah sisa model
lama. Model ini tidak memakainya: kasus furniture ditangani Works + Sub-Works
langsung (§2.1). Jalur membuat yang baru sudah dicabut dari UI; baris yang
terlanjur ada tetap ditampilkan.

Status: **dibiarkan di schema, jangan dibangun di atasnya.**

### 2.3 Kedalaman

Pengelompok maksimal **dua lapis**, dan L1 opsional.
`BqObject.section_id` NULLABLE dan harus tetap begitu — memaksa Section berarti
setiap BQ kecil harus mengarang "A PEKERJAAN" sebelum boleh menulis satu baris.

> **Lapis pengelompok ketiga sempat diizinkan pagi 2026-08-27** ("Shopfront
> Area" di dalam "Wall Works"), lalu **dicabut owner sore harinya**. Kasus area
> ditangani dengan menjadikan areanya Sub Section langsung di bawah Section,
> atau memasukkan namanya ke nama Works.

Batas ditegakkan `createBqSectionAction` di **jalur tulis**.

> **Jalur baca tidak pernah menegakkan batas apa pun.** Data yang terlanjur
> lebih dalam, pengelompok yatim, bahkan data yang berputar — semuanya tetap
> ditampilkan. *Yang tidak tampil tidak bisa diperbaiki pengguna.*

## 3. Aturan keras

1. **Aritmatika hanya di `lib/calc.ts`** — modul murni: tanpa Prisma,
   `server-only`, DOM, `Date.now()`. Tidak ada `reduce` atas harga di komponen,
   service, atau action; itu jadi sumber kebenaran kedua, dan selisihnya baru
   ketahuan di kertas penawaran. Satu pengecualian yang sudah diisolasi:
   `lib/section-rollup.ts`.

2. **Subtotal pengelompok wajib post-order** — anak dulu, induk belakangan. Loop
   datar sekali jalan membuat `SUBTOTAL B` jadi nol pada Section yang seluruh
   Works-nya duduk di dalam L2. Jangan dikembalikan.

3. **Snapshot tidak pernah refresh.** Harga dibekukan sekali saat baris ditarik
   ke project. Bukan "refresh all", bukan "refresh selected", tidak ada banner.
   Satu-satunya perubahan sesudahnya: suntingan manual `is_manual_override`,
   hidup di project itu saja, tidak pernah merambat balik.

4. **BQ tidak pernah menulis ke `master_data`.** Harga yang hilang membuat SKU
   *tidak siap dipakai* (`readiness.reason`) — **tidak pernah** disulap jadi
   `?? 0` yang lalu tercetak di dokumen komersial.

5. **Batas ditegakkan di jalur tulis, tidak pernah di jalur baca.** Data cacat —
   terlalu dalam, yatim, berputar — tetap ditampilkan. *Yang tidak tampil tidak
   bisa diperbaiki pengguna.*

6. **Works terkunci (`locked_at`) tidak menerima perubahan apa pun**, diperiksa
   di server. Menyembunyikan tombol bukan pengamanan.

7. **Menambah apa pun lewat klik-kanan di tempat hasilnya muncul.**

   | Klik kanan di | Menawarkan |
   |---|---|
   | ruang kosong grid | Tambah Section |
   | Section | Tambah Sub Section · Tambah Pekerjaan · Hapus |
   | Sub Section | Tambah Pekerjaan · Hapus |
   | baris Bahan/Jasa | lewat quick-add row, bukan menu |

   Section dan Sub Section dibuat **langsung dengan nama bawaan**, lalu barisnya
   masuk mode ganti-nama. Tidak ada kotak mengambang yang bisa tertinggal.

   Menu hanya menawarkan yang sah di baris itu — itulah yang menghapus
   kebutuhan akan pesan "kamu menjatuhkannya di tempat yang salah".

   **Tidak ada drag-drop.** Panel Sumber beserta seluruh mesin drag-nya dicabut
   2026-08-27: ia tidak pernah berfungsi (lihat §8), dan fungsinya sudah ada
   semua di klik-kanan dan quick-add row.

8. **Seluruh teks lolos WCAG AA (4,5:1).** Tangga teks ada di
   `ui_engine/tokens/colors.ts` dan sudah dipatok: `slate-950` / `slate-600` /
   `slate-500`. `slate-400` hanya sah untuk ikon yang MURNI dekoratif
   (`ICON_DECORATIVE`). Kalau butuh lebih redup dari tier terendah, jawabannya
   bukan warna yang lebih pucat — melainkan menghapus teksnya atau
   memindahkannya ke tooltip.

---

## 4. Dari mana harga datang

**Master Data lebih dulu.** Untuk yang tidak ada di sana, dua jalan keluar
(owner 2026-08-27):

| Jalan | Untuk apa | Hidup di |
|---|---|---|
| Override per project | sekali pakai, khas project itu | baris L4 `PROJECT_LOCAL` |
| Library BQ | berulang, tapi bukan urusan Master Data | resep L3 di library BQ |

Ini jalan keluar, bukan jalan pintas — bahan yang seharusnya ada di Master Data
tetap diminta ke sana, supaya harga yang sama tidak hidup di lima project dengan
lima angka. `ALAT` / `BIAYA_UMUM` / `TRANSPORT_AKOMODASI` memang tidak punya
padanan Master Data; keduanya sah lewat jalur di atas.

Satu SKU dengan banyak supplier: picker menampilkan seluruh opsi, estimator
memilih **eksplisit**, pilihannya ikut dibekukan.

---

## 5. Library BQ

**Menyimpan resep L3 Works** — satu Works beserta baris L4-nya. Nama-nama di
panel Sumber (Mobilization, Loading/Unloading, Security) semuanya **Works**,
bukan Sub-Works: pekerjaan seperti itu memang tidak butuh elemen sub-works,
barisnya menempel langsung.

```
Resep: "Pintu Kabinet HPL"
  ├ L4  → sku_id: <Plywood 9mm>      koef 0,5
  ├ L4  → sku_id: <HPL putih>        koef 0,7
  └ L4  → work_price_id: <Finishing> koef 1
```

### 5.1 Yang disimpan adalah RUJUKAN, bukan harga

Baris L4 di library menyimpan **id master data** (`sku_id` / `work_price_id`)
dan koefisiennya. **Tidak ada kolom `snapshot_*` di tabel library.** Harga baru
dibekukan saat resep diimpor ke project.

Konsekuensinya: memperbarui harga di Master Data otomatis memperbarui resep
library (karena ia cuma menunjuk), tapi **tidak pernah** menyentuh project yang
sudah mengimpornya (§7).

### 5.2 "Library" selalu berarti library BQ

Keputusan owner 2026-08-27: *"library/template maksudnya library dari ranah BQ,
bukan master data. Master data hanya untuk di-snapshot harga terbaru, bukan
untuk diotak-atik."*

Jadi panel Sumber punya dua tab yang **tidak boleh dilebur**:

| Tab | Isinya | Lapis | Bisa disunting dari BQ? |
|---|---|---|---|
| **Template** | resep Works | L3 | ya — ini milik BQ |
| **Harga** | SKU & WorkPrice | L4 | **tidak** — sumber harga saja |

Menggabungkan keduanya akan menaruh dua jenis benda yang tidak bisa saling
menggantikan dalam satu hasil pencarian, dan mengaburkan bahwa yang satu boleh
disunting dan yang satu tidak.

### 5.3 Satu daftar template: bawaan + buatan user

Template bawaan kantor dan resep buatan user **satu tabel, satu daftar**
(keputusan owner 2026-08-27). `bq-template-data.ts` turun status jadi **bahan
seed**, bukan sumber runtime.

- `category` — nama Section yang cocok (`"PRELIMINARIES"`). Section bernama
  Preliminaries menawarkan Mobilization, Loading/Unloading, Security.
- `is_default` — hasil seed vs buatan user.
- **Menyunting template bawaan membuat SALINAN milik user**; yang bawaan tetap
  utuh, jadi seed ulang tidak pernah bertabrakan dengan suntingan siapa pun.

### 5.4 Varian dibedakan lewat NAMA

Spec masuk ke dalam nama resep. Tidak ada struktur varian, tidak ada field
`variantGroup`:

```
Second Skin Partition (Plywood 9mm)
Second Skin Partition (Gypsum 9mm)
```

Daftar datar yang dicari lewat search — bukan pohon, bukan kategori bertingkat.
`category` di §5.3 adalah penyaring saran, bukan hirarki.

## 6. Template

Menuang **kerangka pengelompok saja** (L0–L2). L3 tidak ikut dibuat; ia
ditawarkan sebagai saran, dan yang tidak diklik tidak pernah ada.

Versi pertama menuang 97 Works sekaligus dan hasilnya salah arah: BQ baru berisi
97 pekerjaan Rp 0 yang mayoritasnya tidak ada di project itu. Estimator jadi
harus **menghapus**, dan satu baris yang lupa dibuang tetap tercetak sebagai
pekerjaan bernilai nol.

Konsekuensi yang disengaja: BQ hasil template kosong sampai diisi. Kerangka
kosong memang belum punya harga; yang berbahaya adalah kerangka yang tampak
sudah berharga padahal angkanya karangan.

---

## 7. Kategori & permission

`BqCostCategory`: `MATERIAL` · `UPAH` · `ALAT` · `BIAYA_UMUM` ·
`TRANSPORT_AKOMODASI`. Lapisan **pelaporan** — bahan tetap menunjuk SKU, jasa
tetap menunjuk WorkPrice.

Borongan (*"Material + Upah"*) **bukan** enum baru: baris jasa dengan
`snapshot_has_material = true`.

| Permission | Cakupan |
|---|---|
| `BQ_ACCESS` | masuk `/bq` |
| `BQ_PROJECT_MANAGE` | buat / ubah nama / arsipkan project |
| `BQ_BREAKDOWN_EDIT` | Section, Works, baris L4 |
| `BQ_SETTINGS_MANAGE` | `BqSettings` |

Penolakan ditegakkan di server, di setiap aksi tulis.

---

## 8. Yang TIDAK ada — jangan dihidupkan lagi

| Yang gugur | Kenapa |
|---|---|
| **Markup / OH / profit / PPN / diskon** | owner 2026-08-27: *"TIDAK MAU DI BUAT SERUMIT INI"*. Dicabut dari skema dan aplikasi pada BQ-71. |
| **`BqSubObject`** (pengali tanpa satuan/harga) | kasus furniture ditangani L3+L4 langsung. Masih di 12 berkas; jangan dibangun di atasnya |
| `BqDetailMode` (mode detail/ringkas) | O3 — model §2 dirancang supaya tidak dibutuhkan |
| `BqMaterialProfile`, `BqCategoryWaste` | R1 — costing pindah ke `master_data.Sku` |
| `price-drift-service.ts`, `pickPrice()`, field drift | R9 — snapshot tidak pernah refresh, melapor pun tidak |
| `BqPurchaseSummary`, packaging variance | R2 |
| Waste berlapis, konversi otomatis, pembulatan pembelian | R1/R2 — melanggar §1 |
| AT-01 Rp5.653.559 sebagai gerbang | tidak pernah ada di kode; lihat §9 |
| **Panel Sumber + drag-drop** | tidak pernah berfungsi. `useRecipeDropZone` membaca `dataTransfer.getData()` di `dragenter`/`dragover`, padahal di dua fase itu drag data store ada dalam **protected mode** dan `getData()` selalu mengembalikan string kosong — hanya `types` yang boleh dibaca. Penjaganya selalu null → `preventDefault()` tak pernah dipanggil → browser menolak drop. Dicabut, bukan diperbaiki: fungsinya sudah ada di klik-kanan dan quick-add. |

`conversion` · `waste*` · `minimumOrder` · `roundingIncrement` **masih ada** di
`MaterialLineInput` dan kolom snapshot tapi **tidak dipakai menghitung** —
provenance historis. Bukan bug.

---

## 9. Gerbang

```
npx prisma validate · npx tsc --noEmit · npx eslint src/ · npm test
```

30 test: `calc.test.ts` (10) · `section-rollup.test.ts` (8) ·
`section-tree.test.ts` (12).

**AT-01 jangan dikutip, dan tidak perlu diganti.** Ia dulu masuk akal karena
mesin hitungnya rumit — waste berlapis, konversi, pembulatan — sehingga butuh
contoh nyata dari dokumen kantor untuk membuktikan seluruh rantainya. Rantai itu
sudah tidak ada. Yang tersisa cuma perkalian, dan perkalian cukup diuji dengan
angka yang jelas benar (`2 × 100.000 = 200.000`). Beberapa handoff lama masih
menyuruh menjaganya — abaikan; dokumen itu sengaja tidak diedit.

---

## 10. Terbuka

| # | Pertanyaan | Menunggu |
|---|---|---|
| BQ-1 | Export Internal Cost Detail — PDF atau xlsx, kolom apa | owner |
| BQ-13 | Cabut `BQ_ACCESS` dari STAFF? | owner |
| BQ-2 | Enam migrasi belum diterapkan ke DB — `/bq` gagal query sebelum `npx prisma migrate dev` | owner |
| — | Penomoran cetak L3 — keputusan UI, bukan model | BQ-35 |

Pekerjaan terbuka lengkap: `roadmap.md` §Siklus R3. Urutan kerja untuk agent:
`HANDOFF-BQ-R3.md`.

---

## 11. Riwayat

`BQ template tes.xlsx` adalah **mockup, bukan spesifikasi** (owner 2026-08-27).
Kalau model di atas berbeda dari workbook, **model yang menang**. Jangan
menurunkan aturan dari formulanya.

Dokumen BQ lama ada di `docs/archive/` — disimpan untuk menjawab *"kenapa dulu
diputuskan begitu"*, bukan sebagai acuan sekarang. Alasan tiap keputusan ada di
`CHANGELOG.md` entri 2026-08-27 (rev 1–5).
