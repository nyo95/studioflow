# PLAN — Refactor BQ: hirarki, library resep, dan UI

**Tanggal:** 2026-08-27
**Pemicu:** permintaan owner — perbaiki desain BQ, luruskan logika hirarki
terhadap `BQ template tes.xlsx`, ganti gesture tambah jadi klik-kanan.
**Status:** seluruh keputusan sudah diambil. T1 **dikonfirmasi owner 2026-08-27**
lewat diagram hirarki (5 lapis, L2 opsional).
**Urutan yang diminta owner:** logic/schema dulu, UI menyusul.

---

## 0. Ringkasan

Kode BQ sekarang memetakan dokumen kantor ke lima lapis
(`BqSection` → `BqSection` → `BqObject` → `BqSubObject` → baris L3). Pembacaan
ulang terhadap kedua sheet Excel menunjukkan dokumen aslinya butuh bentuk yang
berbeda: **pengelompok yang bersarang bebas**, lalu **satu lapis berharga**,
lalu **resep koefisien**. `BqSubObject` — pengali qty tanpa satuan dan tanpa
harga — tidak punya sumber di template mana pun.

Empat temuan di bawah, satu di antaranya (T1) mengubah schema, satu (T2)
adalah bug aktif yang harus ditutup lebih dulu.

---

## 1. Bukti dari sumber

`BQ template tes.xlsx` punya dua sheet dengan peran berbeda. Keduanya dipakai.

### 1.1 Sheet `BQ` — kerangka cetak ke klien

```
A   PRELIMINARIES                        seksi — tanpa qty/satuan/harga
  1 Mobilization                  ls     pekerjaan LANGSUNG di seksi (tanpa divisi)
  SUBTOTAL A

B   INTERIOR WORKS                       seksi
  I   Floor Works                        divisi
    1 Screeding Base H+100mm     sqm     pekerjaan
    2 Supply & Install Floor HT  sqm
      - Allowed For Wastage 10%  sqm     pekerjaan juga, ditandai strip
  SUBTOTAL B.I

  III Wall Works                         divisi
    1 Shopfront Area                     TANPA satuan, TANPA harga
      - Second Skin Partition    sqm     yang berharga justru anaknya
      - Wall Finish PT5          sqm
    2 Store Area
      - Second Skin Partition    sqm     pekerjaan sama, area beda
  SUBTOTAL B.III
```

Divisi **opsional** — PRELIMINARIES tidak punya, itemnya menggantung langsung
di seksi. `section_id` yang sudah nullable di `BqObject` sudah benar.

### 1.2 Sheet `Tes` — taxonomy resep (internal, tidak dicetak)

```
GRUP | NO | ITEM | SUB-ITEM | KOEFISIEN | SATUAN | KATEGORI | HARGA
```

Kolom `KOEFISIEN` kosong seluruhnya kecuali satu sel (baris 39 = `2`), kolom
`HARGA` kosong total, tanpa satu pun formula. Sheet ini **kerangka kosong**,
bukan data siap pakai.

`KATEGORI` punya enam nilai: Material · Upah · Alat · Biaya Umum ·
Transportasi & Akomodasi · **Material + Upah**.

### 1.3 Formula yang menentukan bacaan

```
G79            =F79*D79        Total pekerjaan = Harga Satuan × Qty
SUBTOTAL B.II  =SUM(G36:G45)
SUBTOTAL B.III =SUM(G51:G72)   ← baris 51–72 = baris STRIP
                                  baris 50/55/66/69 (nama area) TIDAK ikut
```

Baris area tidak menyumbang angka apa pun. Ia label, bukan baris biaya.

Digabung dengan sheet `Tes`, rumus lengkapnya:

```
Harga Satuan pekerjaan =  Σ ( koefisien sub-pekerjaan × harga sub-pekerjaan )
Total pekerjaan        =  Harga Satuan × Qty
Subtotal divisi        =  Σ Total pekerjaan di bawahnya (termasuk lewat area)
```

**Satu koefisien saja, di lapis sub-pekerjaan.** Tidak ada pengali kedua.

---

## 2. Temuan

### T1 — Hirarki 5 lapis ✅ **dikonfirmasi owner 2026-08-27**

Owner mengirim diagram hirarkinya. Penamaan resmi yang dipakai dari sini:

| Lapis | Nama | Contoh | Peran |
|---|---|---|---|
| **L0** | Section | PRELIMINARIES · INTERIOR WORKS · LIGHTING & MEP WORKS · **FIXTURES** | pengelompok |
| **L1** | Sub Section | Floor Works · Ceiling Works · Wall Works · Signage Work · Basic Installation | pengelompok |
| **L2** | Sub Section *(opsional)* | Shopfront Area · Store Area | pengelompok |
| **L3** | Works | Flat Ceiling · Screeding · Mobilization | **baris berharga** — Qty × Harga Satuan |
| **L4** | Sub-Works | dari template library / master data | koefisien × harga |

Tiga lapis pengelompok, **satu** lapis berharga, satu lapis resep. Konsisten
dengan formula sumber: `SUBTOTAL B.III = SUM(G51:G72)` menjumlahkan baris strip
(L3), melewati baris nama area (L2).

Karena L3 selalu jadi baris berharga — di Floor Works maupun Wall Works — tidak
ada penanda cetak-rinci yang dibutuhkan. Keputusan **O3** (`BqDetailMode`
dibuang) tetap utuh.

Dua catatan dari diagram:

- **`FIXTURES` adalah Section yang belum ada di sheet `BQ`.** Template kantor
  punya section furniture/joinery yang belum keimpor. Ditambahkan saat BQ-33.
- **`BqSubObject` tidak punya slot.** L4 menempel langsung di L3. Tabelnya
  dibiarkan di schema (belum ada data yang perlu dimigrasi), tapi jalur baru
  tidak memakainya sama sekali. Penghapusannya dijadwalkan terpisah.

Konsekuensi schema: `BqSection` **rekursif**, kedalaman dibatasi **3 lapis**
(L0 → L1 → L2), divalidasi di server.

<details>
<summary>Bacaan alternatif yang ditolak (arsip)</summary>

`Shopfront Area` sebagai Works, dan baris strip sebagai Sub-Works yang ikut
dicetak. Ditolak karena lapis yang dicetak jadi berpindah-pindah tergantung
Sub Section, dan itu memaksa kembalinya penanda cetak-rinci per pekerjaan —
secara efek menghidupkan lagi `BqDetailMode` yang dibuang di O3.

</details>

### T2 — Rollup subtotal salah begitu ada lapis ketiga 🔴 **bug aktif, blocker**

`services/breakdown-service.ts` menaikkan subtotal dengan satu kali loop datar:

```ts
for (const section of project.sections) {
  if (!section.parent_id) continue;
  rollup.set(section.parent_id,
    (rollup.get(section.parent_id) ?? 0) + (rollup.get(section.id) ?? 0));
}
```

Induk diproses sebelum anaknya terisi, karena urutannya `sort_order` dan induk
selalu dibuat lebih dulu:

```
sections: B → III → Shopfront      direct: Shopfront = 100
  B          parent null            → skip
  III        parent B   → B   = 0 + rollup[III](=0) = 0    ← B dikunci di sini
  Shopfront  parent III → III = 0 + 100            = 100

hasil:  III = 100 ✓    B = 0 ✗   (seharusnya 100)
```

`SUBTOTAL B` jadi nol. Sekarang dorman karena schema efektif 2 lapis; menjadi
nyata pada baris pertama Bacaan A. **Harus ditutup sebelum apa pun ditumpuk
di atasnya.**

Perbaikan: rekursi bottom-up (post-order), bukan satu kali loop.

### T3 — Varian spec dituang sebagai komponen aditif ❌ **angka salah**

`lib/bq-template-data.ts`, `Flat Ceiling`:

```ts
lines: [
  { name: "Hollow 20x40 t.0,8mm + Gypsum board 90mm", category: "MATERIAL" },
  { name: "Hollow 20x40 t.0,8mm + Gypsum board 90mm", category: "UPAH"     },
  { name: "Hollow 20x40 t.1,2mm + Gypsum board 90mm", category: "MATERIAL" },  // varian
  { name: "Hollow 20x40 t.1,2mm + Plywood 90mm",      category: "MATERIAL" },  // varian
]
```

Di sheet `Tes` baris 77–79 ketiga hollow itu **pilihan spec — pilih satu**,
bukan komponen yang dijumlahkan. Kasus sama di `Ceiling Finish PT`
(Vinilex / Dulux / Limewash) dan `Screeding Base` (H 20-50 / H 50-100).

**Keputusan owner 2026-08-27:** varian = **resep terpisah yang dibedakan
namanya**, dicari lewat search.

```
Flat Ceiling (Hollow t.0,8 + Gypsum 9mm)
Flat Ceiling (Hollow t.1,2 + Gypsum 9mm)
Flat Ceiling (Hollow t.1,2 + Plywood 9mm)
```

Yang memang aditif tetap satu resep:

```
Supply & Install Floor Finish HT  →  Material HT + Jasa pemasangan HT
```

Pembeda di sumber: sub-item berkategori **berbeda** (Material vs Upah) =
komponen satu resep; sub-item sejenis yang saling **menggantikan** = resep
terpisah.

Ini **membatalkan** usulan field `variantGroup` — tidak ada perubahan schema
untuk varian.

Catatan jujur: heuristik di atas tidak selalu benar. `Mobilization` punya 8
sub-item sekategori (`Transportasi & Akomodasi`) yang semuanya **aditif**.
Karena itu hasil impor masuk sebagai **draft library**, dirapikan owner, bukan
langsung dipakai.

### T4 — Kategori `Material + Upah` tidak pernah tampil

`BqCostCategory` punya 5 nilai; sheet `Tes` punya 6. Borongan
(`Material + Upah`) muncul di Screeding Base, Flat Ceiling, Demolition,
Hoarding Partition.

Datanya **sudah** tertampung — `BqServiceLine.snapshot_has_material` mencerminkan
`WorkPrice.has_material`. Yang belum ada: tampilannya. Tanpa itu rekap per
kategori (BQ-29) akan menggolongkan borongan sebagai Upah murni.

Perbaikan: tampilan saja, tanpa nilai enum baru.

### T5 — Dokumentasi saling bertentangan

Header `lib/bq-template-data.ts` baris 17–20 masih menulis peta lama:

```
Grup (I Floor Works)   -> BqObject     — KOMPONEN     (L1)
Item (Screeding Base)  -> BqSubObject  — SUBKOMPONEN  (L2)
```

Peta itu sudah dibatalkan `actions/bq-template-actions.ts` (*"sempat meleset
satu lapis"*). Dua berkas bertentangan; yang benar ada di
`bq-template-actions.ts`.

---

## 3. Model sasaran

```
BqSection   rekursif, maks 3 lapis   seksi / divisi / area   subtotal ✓
BqObject    + kolom `area` DIBATALKAN (area jadi BqSection)  Qty × Harga Satuan
BqMaterialLine / BqServiceLine                               Koefisien × Harga
BqSubObject  kedalaman OPSIONAL, bukan jalur default
```

**Harga satuan pekerjaan** = Σ(koefisien × harga) sub-pekerjaan. Kalau
sub-pekerjaan kosong, boleh diketik langsung sebagai lumpsum — dibutuhkan
`Security` (Tes baris 20, tanpa sub-item), `Insurance`, `Signage`. Begitu ada
sub-pekerjaan, kolomnya read-only dan mengikuti hitungan.

**`BqSubObject`** tetap ada tapi bukan jalur default: koefisien di template
cuma satu lapis, jadi pengali sub-rakitan tidak punya sumber. Dipakai hanya
untuk fixture joinery yang memang butuh (kabinet → Body ×2). `lib/calc.ts`
sudah mendukung L3 menempel langsung di L2 (`computeMaterialLine(m, 1)`) —
tidak ada yang perlu dibongkar, **AT-01 tidak tersentuh**.

**Template** tetap kerangka saja (seksi/divisi/nama pekerjaan), tidak membawa
resep — meneruskan keputusan yang sudah ada di `bq-template-actions.ts`.
Sheet `Tes` posisinya bahan mentah pengisi **library**, bukan sesuatu yang
dituang ke project.

**Library BQ** = daftar datar resep bernama, dicari lewat search. Spec masuk ke
dalam nama. Tidak ada struktur varian di dalam resep.

---

## 4. Urutan kerja

| # | Pekerjaan | Sifat |
|---|---|---|
| 1 | Rekursi bottom-up untuk rollup subtotal + test 3 lapis | 🔴 blocker, tanpa schema |
| 2 | `BqSection` rekursif + validasi kedalaman maks 3 di server | schema/logic |
| 3 | Harga satuan: Σ L3, dengan fallback lumpsum saat L3 kosong | logic |
| 4 | Re-impor sheet `Tes` → draft library, varian dipecah per nama | data |
| 5 | Tampilkan `Material + Upah` dari `has_material` | tampilan |
| 6 | Rapikan doc drift header `bq-template-data.ts` (T5) | dokumentasi |
| 7 | UI: klik-kanan + CreatableSearch + sentralisasi ui_engine | menyusul |

Langkah 1 harus lulus lebih dulu; sisanya menumpuk di atasnya.

---

## 5. UI (langkah 7)

### Yang dibuang

| Masalah | Lokasi | Dampak di BQ contoh |
|---|---|---|
| Form "Tambah Pekerjaan" permanen per seksi/divisi | `SectionAddObject` :770 | ~15 form nganggur |
| Form "Tambah Divisi" permanen per seksi | :511 | +3 form |
| Blok chip saran template selalu terbuka | :706 | 1 blok abu per daftar |
| Paragraf instruksi di drop zone | :663–665 | 2 kalimat penuh di UI |
| Drag-drop sebagai gesture utama | `useRecipeDropZone` :315 | wajib buka panel kedua |

### Yang menggantikan

Satu gesture — **klik kanan**:

```
area kosong  →  + Seksi
seksi        →  + Divisi · + Pekerjaan · Hapus
divisi       →  + Area · + Pekerjaan · Hapus
area         →  + Pekerjaan · Hapus
pekerjaan    →  + Sub-pekerjaan · Duplikat · Simpan ke library · Hapus
```

Setiap "+" membuka **`CreatableSearch`** (`src/components/ui/creatable-search.tsx`,
sudah ada, belum dipakai BQ). Ketemu di masterdata/library → ambil; tidak
ketemu → ketik sendiri jadi `PROJECT_LOCAL`.

Tampilan: satu grid polos, indentasi rail tipis (bukan kartu berlapis), angka
`tabular-nums` rata kanan, baris pengelompok dibedakan bobot font saja. Semua
teks instruksi pindah ke tooltip / empty state.

### `ui_engine` — yang ditambah & disentralkan

Masuk (domain-free, sesuai PRD §36/§39):

| Komponen | Sekarang | Alasan |
|---|---|---|
| `ContextMenu` | **belum ada** | paket `radix-ui@1.4.3` sudah terpasang, tinggal wrapper |
| `CreatableSearch` | ada di `components/ui`, tidak diekspor engine | dipakai BQ + Master Data |
| `TreeGrid` pattern | belum ada | node/depth/collapse/indent + slot klik-kanan; kepakai juga untuk category tree Master Data |
| `NumberCell` / `TextCell` | lokal di `BqBreakdownClient` :203–315 | `patterns/index.tsx` sudah menjanjikan "inline editable cells" tapi kosong |

Tidak masuk (domain BQ): `CostCategoryBadge`, saran template, semantik drop
zone, `formatIdr`.

`SpreadsheetTemplate` (slot header/toolbar/grid/inspector/summary) sudah dipakai
BQ sejak R7 — tetap.

---

## 6. Yang TIDAK dikerjakan

- **`BqDetailMode` tidak dihidupkan lagi.** Keputusan O3 berlaku; Bacaan A
  dipilih justru supaya tidak perlu.
- **`lib/calc.ts` tidak disentuh.**
- **`master_data` tidak ditulis dari BQ.** SSOT tidak berubah.
- **Field `variantGroup` dibatalkan** — lihat T3.
- **Kolom `area` di `BqObject` dibatalkan** — area jadi `BqSection`, lihat T1.

---

## 7. Invariant tiap tahap

```
npx prisma validate
npx tsc --noEmit
npx eslint src/
npm test
```

**Peringatan — AT-01 adalah gerbang hantu.** Tujuh dokumen (`AGENTS.md`,
`roadmap.md`, kedua HANDOFF, CHANGELOG, dan revisi awal berkas ini) menyebut
*"AT-01 = Rp5.653.559 dikunci `calc.test.ts`"*. Angka itu **tidak ada di satu
berkas pun** di `src/` maupun `prisma/` — dicari juga dalam bentuk `5_653_559`
dan `5653559`. Ia gugur saat R1/R2 menulis ulang `calc.ts` ke mode koefisien
(waste dan conversion dibuang, sehingga contoh PRD Bab 7 tidak lagi berlaku),
tapi dokumennya tidak ikut dikoreksi.

Akibatnya setiap handoff memerintahkan agen berikutnya menjaga invarian yang
tidak ditegakkan apa pun. `calc.test.ts` yang hidup menguji fixture lain
(164.500 / 197.400 / 592.200) dan tetap sah — ia cuma bukan AT-01.

Ditindaklanjuti di **BQ-37**: tetapkan fixture kanonik baru atau cabut AT-01
secara resmi dari seluruh dokumen. Jangan mengarang angka penggantinya.

Langkah 1 menambah test rollup 3 lapis. Langkah 3 paling berisiko menggeser
harga satuan — periksa dua kali.

---

## 8. Bloker operasional yang belum lepas

**BQ-2** — enam migrasi (empat R1 + dua R2) belum diterapkan ke database.
`/bq` gagal query sebelum `npx prisma migrate dev` dijalankan owner. Refactor
ini menambah migrasi baru di atasnya, jadi antreannya makin panjang kalau
ditunda.
