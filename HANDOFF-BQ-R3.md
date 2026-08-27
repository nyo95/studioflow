# HANDOFF — BQ Siklus R3

**Ditulis:** 2026-08-27 oleh Claude (Cowork)
**Untuk:** agent coding berikutnya (Codex / OpenCode / lainnya)
**Sifat:** hasil audit kode terhadap `PRD-BQ.md`, plus urutan
kerja yang sudah dipilah antara "boleh jalan" dan "tunggu owner".

---

## 0. Baca ini dulu, dalam urutan ini

| # | Berkas | Kenapa |
|---|---|---|
| 1 | **`PRD-BQ.md`** | spesifikasi yang berlaku. Semua acceptance di bawah merujuk pasalnya. |
| 2 | `designbq.md` | arah rasa & UI. Mengikat, tidak digantikan PRD. |
| 3 | `AGENTS.md` §🧾 BQ Contract | 5 aturan keras, ringkas |
| 4 | `roadmap.md` §Siklus R3 | BQ-30..BQ-39 |

**JANGAN** menurunkan aturan dari `D:\Misc\ProjectsHUB\BQ\PRD_Fixture_Breakdown.md`
maupun dari `BQ template tes.xlsx`. Keputusan owner 2026-08-27: workbook itu
**mockup, bukan spesifikasi**. Kalau kode berbeda dari workbook, cek PRD dulu —
kemungkinan besar workbook-nya yang tidak mengikat.

---

## 1. Model yang berlaku (ringkas)

```
L0 Section  →  L1 Sub Section  →  L2 Sub Section (opsional)  →  L3 Works  →  L4 Sub-Works
   BqSection      BqSection           BqSection                  BqObject     BqMaterialLine / BqServiceLine
   pengelompok    pengelompok         pengelompok                BERAPA UNIT  KOEFISIEN × HARGA
```

```
biaya baris L4        =  koefisien × harga snapshot
Harga Satuan L3       =  Σ biaya L4          ← TIDAK PERNAH diketik
Total L3              =  Harga Satuan × qty
Subtotal pengelompok  =  Σ Total L3 di bawahnya, termasuk lewat anak
```

**Koefisien ada di dua tempat, mekaniknya sama:** koefisien L4 (berapa bahan
untuk satu unit L3) dan koefisien L3 / qty (berapa unit L3 di project).

**Tidak ada markup, OH, profit, PPN, diskon.** Tidak ada lapis pengali ketiga.

> **Aturan tunggal kalau ragu** — keputusan owner 2026-08-27: *"pokoknya
> sederhana aja, ga usah ribet-ribet dan automasi gimana-gimana."* Kalau sebuah
> usulan menambah angka yang bukan koefisien atau bukan harga, jawabannya tidak.

---

## 2. Hasil audit — yang SUDAH BENAR, jangan diutak-atik

Diverifikasi ke kode 2026-08-27:

| Yang dicek | Hasil |
|---|---|
| Tabel `BqLibrary*` punya kolom `snapshot_*`? | **tidak ada** — sesuai PRD §4.1, library menunjuk |
| `breakdown-service.ts` menyentuh master data? | **tidak** — hanya kolom `snapshot_*`, sesuai §6 |
| Ada input harga satuan L3 yang diketik manual? | **tidak ada** — sesuai §2.1 |
| Subtotal pengelompok post-order? | **ya** — `lib/section-rollup.ts`, 8 test |
| Batas kedalaman ditegakkan di jalur tulis saja? | **ya** — `createBqSectionAction`, 12 test |
| `hasMaterial` tampil saat memilih baris? | **ya** — picker, quick-add, toolbar (*"incl. material"*) |

---

## 3. Temuan — divergensi kode vs PRD

### 🟢 BOLEH LANGSUNG DIKERJAKAN

---

**D3 — Penjumlahan harga hidup di komponen klien**
`src/subapps/bq/components/BqBreakdownClient.tsx:1938-1939`

```ts
const matTotal = computed.materials.reduce((s, l) => s + l.cost, 0);
const svcTotal = computed.services.reduce((s, l) => s + l.cost, 0);
```

Melanggar PRD §3.2 (*"DILARANG menjumlahkan biaya di komponen klien"*). Risikonya
memang rendah — ia menjumlahkan keluaran `calc.ts`, bukan menghitung ulang dari
harga mentah. Tapi ia tetap tempat kedua uang dijumlahkan, dan itu persis pola
yang melahirkan selisih yang baru ketahuan di kertas penawaran.

**Kerjakan:** tambahkan `materialsSubtotal` dan `servicesSubtotal` ke
`ObjectResult` dan `SubObjectResult` di `lib/calc.ts`, hitung di
`computeObject()` / `computeSubObject()`, lalu pakai itu di klien.

**Acceptance:**
- `grep -rn "reduce(" src/subapps/bq --include=*.tsx | grep -i "cost\|price"` → kosong
- test baru di `calc.test.ts` mengunci kedua subtotal itu
- angka di layar tidak berubah

---

**D4 — Guard lama memblokir pembuatan L2**
`src/subapps/bq/actions/bq-project-actions.ts`, di `createBqSectionAction`

```ts
if (directObjects > 0) {
  throw new ActionError(
    "This section already contains work items. Move them into divisions first, ...",
    "VALIDATION_ERROR");
}
```

Guard ini lahir waktu model masih dua lapis. Sekarang ia berarti: **Sub Section
yang sudah punya Works tidak bisa diberi L2.** Padahal alur nyatanya justru
begitu — estimator mengisi "Wall Works" dulu, baru sadar perlu dipisah per area.

Ia juga tidak disebut di PRD sama sekali, jadi statusnya menggantung.

**Kerjakan: cabut guard-nya.** Rollup sudah menangani Works + Sub Section
berdampingan — ada testnya (*"Works yang menempel di beberapa lapis sekaligus"*).
Tidak ada alasan teknis mempertahankannya.

`SectionBlock.allowsDirectObjects` di UI ikut dicabut, supaya tombol tambah Works
tidak hilang begitu section punya anak.

**JANGAN** membuat aksi "pindahkan Works ke Sub Section baru" — itu jalur rumit
untuk masalah yang hilang sendiri begitu guard dicabut.

Tulis pasalnya ke PRD §2.3.

**Acceptance:** bisa membuat L2 di dalam Sub Section yang sudah berisi Works, dan
Works langsung tetap bisa ditambahkan di section yang punya anak.

---

**D6 — `bq-template-data.ts` masih menulis peta lapis yang lama** *(BQ-36)*
Header berkas itu baris 17-20:

```
Grup (I Floor Works)   -> BqObject     — KOMPONEN     (L1)
Item (Screeding Base)  -> BqSubObject  — SUBKOMPONEN  (L2)
```

Sudah dibatalkan `bq-template-actions.ts` sejak lama, dan sekarang juga
bertentangan dengan PRD §2. **Berkas ini dihasilkan skrip** — perbaiki juga
generatornya, jangan cuma outputnya.

**Acceptance:** header cocok dengan PRD §2; tidak ada berkas lain di
`src/subapps/bq/` yang masih menyebut `BqSubObject` sebagai lapis normal.

---

**D5 — Rekap kategori belum membedakan borongan** *(BQ-34)*

`hasMaterial` **sudah** tampil saat memilih baris (picker / quick-add / toolbar,
*"incl. material"*) — jadi lubangnya lebih sempit dari yang ditulis roadmap.
Yang belum: rekap per `cost_category` menggolongkan borongan sebagai `UPAH`
murni, padahal ia Material + Upah.

**Kerjakan:** saat mengelompokkan per kategori, baris jasa dengan
`snapshot_has_material = true` ditampilkan terpisah dari Upah murni. **Jangan
menambah nilai enum** (PRD §8).

---

**D1 — Markup masih hidup di kode** *(BQ-39)* · 🔒 butuh migrasi

PRD §3.5 memutuskan markup **dibuang** (owner: *"TIDAK MAU DI BUAT SERUMIT INI"*,
*"hitungan hanya dari koefisien"*). Kodenya belum menyusul.

```
BqObject.markup_pct + BqSettings.default_markup_pct    migrasi
BQ_MARKUP_EDIT  → core/rbac/constants.ts (2), matrix.ts (2)
lib/calc.ts (10) · lib/calc.test.ts (7) · schema.prisma (6)
actions/bq-project-actions.ts (8) · services/settings-service.ts (7)
components/BqBreakdownClient.tsx (6) · BqToolbar.tsx (4, applyMarkupAll)
services/library-service.ts (4) · components/BqLibraryClient.tsx (1)
```

**Kerjakan:** cabut seluruhnya. Tujuh assertion markup di `calc.test.ts` ditulis
ulang jadi test aritmatika biasa — koefisien × harga, angka yang jelas benar.
Tidak perlu contoh dari dokumen kantor (lihat §4).

**Acceptance:** `grep -rin "markup" src/ prisma/schema.prisma | grep -v generated`
→ kosong; `computeObject()` mengembalikan biaya pokok apa adanya; test lulus.

⚠️ Migrasinya menambah antrean BQ-2 yang belum diterapkan (§6). Tulis migrasinya,
jangan menjalankannya — itu urusan owner di mesinnya.

---

### 🔴 SATU-SATUNYA yang ditahan

---

**D2 — `BqSubObject` masih jalur aktif** *(bagian BQ-32)*

PRD §2.2 menyatakan ia dipensiunkan: kasus furniture ditangani L3 + L4 langsung
(`L0 FIXTURES → L1 KABINET → L3 Pintu Kabinet → L4 penyusun pintu`).

Tapi ia masih hidup di **12 berkas**: `bq-library-actions`, `bq-project-actions`,
`BqBreakdownClient`, `BqLibraryClient`, `BqLinePicker`, `BqToolbar`,
`bq-template-data`, `calc.ts`, `calc.test.ts`, `breakdown-service`,
`library-service`, `types/breakdown`.

**Boleh:** berhenti menambah fitur di atasnya.
**Jangan:** mencabut, memigrasi, atau menghapus tabelnya tanpa aba-aba owner —
ada data lama yang belum diperiksa, dan `calc.test.ts` bergantung padanya.

---

## 4. AT-01 — jangan dikutip, dan tidak perlu diganti

Beberapa dokumen lama di `docs/archive/bq-2026-08/` menyuruh menjaga
*"AT-01 = Rp5.653.559 dikunci `calc.test.ts`"*.

**Angka itu tidak ada di satu berkas pun** di `src/` maupun `prisma/`. Dicari
juga sebagai `5_653_559` dan `5653559`. Ia gugur waktu R1/R2 menulis ulang
`calc.ts` ke mode koefisien.

**Dan ia tidak perlu pengganti yang setara.** AT-01 dulu masuk akal karena mesin
hitungnya rumit — waste berlapis, konversi satuan, pembulatan pembelian —
sehingga butuh satu contoh nyata dari dokumen kantor untuk membuktikan seluruh
rantainya benar. Rantai itu sudah tidak ada. Yang tersisa cuma perkalian, dan
perkalian cukup diuji dengan angka yang jelas benar:

```ts
// cukup begini. tidak perlu contoh dari dokumen kantor.
material("Plywood", 100_000, 2)  →  cost 200_000
```

Dokumen-dokumen lama itu **sengaja tidak diedit** — mengubah catatan handoff lama
supaya cocok dengan keadaan sekarang adalah mengarang riwayat. Abaikan
kutipannya; yang berlaku PRD §11.

---

## 5. Gerbang

```
npx prisma validate
npx tsc --noEmit
npx eslint src/
npm test
```

Sekarang **30 test** lulus:

| Berkas | Jumlah |
|---|---|
| `lib/calc.test.ts` | 10 |
| `lib/section-rollup.test.ts` | 8 |
| `lib/section-tree.test.ts` | 12 |

`eslint src/subapps/bq/` harus **exit 0**. Tersisa 3 warning bawaan
(`bq-template-actions.ts:115` unused `defaults`, `BqBreakdownClient.tsx:1085`
exhaustive-deps, `BqLinePicker.tsx:344` unused `mode`) — boleh dibereskan, tidak
wajib.

---

## 6. Bloker operasional yang belum lepas

**BQ-2** — enam migrasi belum diterapkan ke database (empat R1, dua R2). `/bq`
gagal query sebelum `npx prisma migrate dev` dijalankan owner di mesinnya.

Artinya: **pekerjaan di atas belum bisa diuji di browser.** Typecheck, lint, dan
unit test tetap jalan. Kalau butuh verifikasi visual, minta owner menjalankan
migrasinya dulu.

---

## 7. Lima aturan keras — berlaku untuk semua pekerjaan di atas

1. **Aritmatika hanya di `lib/calc.ts`** (modul murni: tanpa Prisma,
   `server-only`, DOM, atau `Date.now()`). Pengecualian tunggal yang sudah
   diisolasi: `lib/section-rollup.ts`.
2. **Snapshot tidak pernah refresh.** Bukan "refresh all", bukan "refresh
   selected", tidak ada banner. Satu-satunya perubahan adalah suntingan manual
   bertanda `is_manual_override`.
3. **BQ tidak pernah menulis ke `master_data`.** Harga yang hilang tidak pernah
   jadi `?? 0`. Untuk yang tidak ada di master: override project (`PROJECT_LOCAL`)
   atau library BQ — keduanya sah (PRD §5).
4. **Batas ditegakkan di jalur tulis, tidak pernah di jalur baca.** Data cacat
   (terlalu dalam, yatim, berputar) tetap ditampilkan — yang tidak tampil tidak
   bisa diperbaiki pengguna.
5. **Kalau PRD dan kode berbeda, jangan diam-diam memilih salah satu.** Perbaiki
   kodenya kalau itu bug, atau perbarui PRD kalau keputusannya memang berubah —
   dan catat di `CHANGELOG.md`. Perbedaan yang tidak dicatat adalah cara gerbang
   hantu AT-01 lahir.

---

## 8. Prinsip yang mengalahkan semua di atas

Keputusan owner 2026-08-27: *"pokoknya sederhana aja, ga usah ribet-ribet dan
automasi gimana-gimana. perhitungannya pake koefisien nantinya di level L3, L4."*

Kalau sebuah pekerjaan di dokumen ini terasa lebih rumit daripada masalah yang
diselesaikannya, **kemungkinan besar dokumen ini yang salah** — bukan tugasnya
dikerjakan sampai selesai. Katakan begitu, jangan diam-diam membangun jalur
rumitnya.

Tiga hal berikut sempat ditulis lebih rumit dari perlunya, dan sudah dibubarkan
2026-08-27 — pola yang sama patut dicurigai di tempat lain:

| Sempat direncanakan | Jadinya |
|---|---|
| Tetapkan "fixture kanonik" pengganti AT-01 sebelum boleh menyentuh angka | Test aritmatika biasa. Tidak perlu keputusan owner. |
| Aksi "pindahkan Works ke Sub Section baru" supaya guard tidak buntu | Cabut guard-nya. Masalahnya hilang sendiri. |
| Skrip impor sheet `Tes` + pemecah varian + kurasi draft | Library tumbuh dari tombol "Simpan ke library" saat estimator bekerja. |
