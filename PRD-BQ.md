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

```
L0 Section          FIXTURES · PRELIMINARIES · INTERIOR WORKS   pengelompok
 └ L1 Sub Section     KABINET · Floor Works · Wall Works        pengelompok
    └ L2 Sub Section    Shopfront Area · Store Area  (opsional) pengelompok
       └ L3 Works         Pintu Kabinet · Screeding            KOEFISIEN (qty)
          └ L4 Sub-Works    penyusun pintu · Material HT       KOEFISIEN × HARGA
```

| Lapis | Tabel | Isinya |
|---|---|---|
| L0–L2 | `BqSection` (menunjuk dirinya sendiri) | nama + subtotal. **Maks 3 lapis.** L1 & L2 opsional. |
| L3 Works | `BqObject` | nama, satuan, **koefisien (qty)**. Harga satuannya **tidak pernah diketik**. |
| L4 Sub-Works | `BqMaterialLine` / `BqServiceLine` | **koefisien**, harga snapshot |

### Rumus

```
biaya baris L4        =  koefisien L4 × harga snapshot
Harga Satuan L3       =  Σ biaya L4
Total L3              =  Harga Satuan × koefisien L3 (qty)
Subtotal pengelompok  =  Σ Total L3 di bawahnya, termasuk lewat anak
Grand Total           =  Σ Total L3
```

Koefisien ada di **dua** tempat — L4 (berapa bahan untuk satu unit L3) dan L3
(berapa unit di project) — dan mekaniknya sama: mengalikan. **Tidak ada lapis
pengali ketiga. Tidak ada markup, OH, profit, PPN, diskon.**

Contoh:

```
L0 FIXTURES → L1 KABINET → L3 Pintu Kabinet (qty 4)
                              ├ L4 Plywood 9mm   koef 0,5 × harga
                              ├ L4 HPL           koef 0,7 × harga
                              ├ L4 Engsel        koef 2   × harga
                              └ L4 Jasa finishing koef 1  × harga
```

---

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

**Menyimpan resep L3** — satu Works beserta baris L4-nya.

**Library menunjuk, project membekukan.** Baris L4 di library menyimpan
`sku_id` / `work_price_id` + koefisien, **tanpa kolom `snapshot_*`**. Harga baru
dibekukan saat resep diimpor ke project. Jadi update harga di Master Data ikut ke
resep, tapi tidak pernah menyentuh project yang sudah mengimpornya.

**Varian dibedakan lewat nama**, bukan struktur: `Second Skin Partition
(Plywood 9mm)` / `(Gypsum 9mm)`. Daftar datar yang dicari lewat search.

Library tumbuh dari tombol **"Simpan ke library"** saat estimator bekerja —
bukan dari impor massal taxonomy.

---

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
| **Markup / OH / profit / PPN / diskon** | owner 2026-08-27: *"TIDAK MAU DI BUAT SERUMIT INI"*. Dicabut dari skema dan aplikasi pada BQ-39. |
| **`BqSubObject`** (pengali tanpa satuan/harga) | kasus furniture ditangani L3+L4 langsung. Masih di 12 berkas; jangan dibangun di atasnya |
| `BqDetailMode` (mode detail/ringkas) | O3 — model §2 dirancang supaya tidak dibutuhkan |
| `BqMaterialProfile`, `BqCategoryWaste` | R1 — costing pindah ke `master_data.Sku` |
| `price-drift-service.ts`, `pickPrice()`, field drift | R9 — snapshot tidak pernah refresh, melapor pun tidak |
| `BqPurchaseSummary`, packaging variance | R2 |
| Waste berlapis, konversi otomatis, pembulatan pembelian | R1/R2 — melanggar §1 |
| AT-01 Rp5.653.559 sebagai gerbang | tidak pernah ada di kode; lihat §9 |

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
