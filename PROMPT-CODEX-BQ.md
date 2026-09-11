# Prompt untuk Codex — lanjutkan BQ

> Salin blok di bawah ini apa adanya ke Codex.

---

Lanjutkan pekerjaan BQ di repo StudioFlow.

## Baca dulu, urut

1. `PRD-BQ.md` — spesifikasi yang berlaku
2. `HANDOFF-BQ-R3.md` — hasil audit kode + urutan kerja + acceptance tiap tugas
3. `AGENTS.md` §🧾 BQ Contract — 5 aturan keras

Jangan membaca `docs/archive/bq-2026-08/**` sebagai acuan. Isinya sudah gugur —
menggambarkan mesin yang sudah dibongkar (waste berlapis, konversi otomatis,
pembulatan pembelian, purchase summary, mode detail/ringkas, drift harga).

## Kerjakan, urut ini

Semua detail dan acceptance ada di `HANDOFF-BQ-R3.md` §3 bagian 🟢.

1. **BQ-71 — cabut markup.** Paling besar. `markup_pct` di `BqObject` +
   `default_markup_pct` di `BqSettings` (migrasi), `BQ_MARKUP_EDIT` di
   `core/rbac/constants.ts` + `matrix.ts`, `computeObject()` di `calc.ts`,
   `applyMarkupAll` di `BqToolbar`, dan 7 assertion di `calc.test.ts`.
   Tujuh assertion itu ditulis ulang jadi test aritmatika biasa — koefisien ×
   harga, angka yang jelas benar. Tidak perlu contoh dari dokumen kantor.

2. **BQ-70 — pindahkan penjumlahan harga dari klien ke `calc.ts`.**
   `BqBreakdownClient.tsx:1938-1939`. Tambahkan `materialsSubtotal` dan
   `servicesSubtotal` ke `ObjectResult` + `SubObjectResult`, kunci dengan test.
   Kerjakan **sesudah** BQ-71 — keduanya menyentuh `calc.ts` dan `calc.test.ts`.

3. **BQ-69 — cabut guard yang memblokir L2.** `createBqSectionAction` menolak
   menambah Sub Section ke section yang sudah punya Works. Cabut guard-nya, dan
   cabut juga `SectionBlock.allowsDirectObjects` di `BqBreakdownClient`.
   **JANGAN** membuat aksi "pindahkan Works ke Sub Section baru" — itu jalur
   rumit untuk masalah yang hilang sendiri begitu guard dicabut.
   Tulis pasalnya ke `PRD-BQ.md` §2.

4. **BQ-36 — rapikan doc drift `lib/bq-template-data.ts`** baris 17-20. Berkas
   itu dihasilkan skrip — perbaiki generatornya juga, jangan cuma outputnya.

5. **BQ-34 — rekap kategori belum membedakan borongan.** Baris jasa dengan
   `snapshot_has_material = true` dipisahkan dari Upah murni. **Jangan menambah
   nilai enum** `BqCostCategory`.

Commit terpisah per nomor. Kalau kehabisan waktu, berhenti di batas nomor —
jangan menyisakan satu nomor setengah jalan.

## Batch berikutnya — BQ-65

Kalau lima nomor di atas sudah selesai, lanjut ke **BQ-65: satukan Template +
Library BQ**. Spesifikasi lengkap `PRD-BQ.md` §5, ringkasan tugas `roadmap.md`.

Intinya: sekarang ada DUA sumber untuk benda yang sama (resep Works) — tab
`Library` baca `BqLibraryObject` (DB), tab `Template` baca `bq-template-data.ts`
(file TS). Dan skema library-nya masih memaksa baris lewat
`BqLibrarySubObjectOfObject`, bentuk warisan yang sudah tidak sah.

Empat hal yang tidak boleh keliru:

1. **Baris bahan/jasa menempel LANGSUNG ke object.** Migrasi harus menaikkan
   baris yang terlanjur ada dari `BqLibrarySubObjectOfObject`.
2. **`Harga` TIDAK dilebur ke `Template`.** Beda lapis dan beda hak — owner:
   *"master data hanya untuk di-snapshot harga terbaru, bukan untuk
   diotak-atik."* Tab Harga read-only.
3. **Menyunting template bawaan membuat SALINAN milik user.** Yang bawaan tetap
   utuh supaya seed ulang tidak bertabrakan.
4. **`bq-template-data.ts` jadi bahan SEED, bukan sumber runtime.** Ini
   sekaligus menutup BQ-36 — kerjakan bersamaan, jangan dua kali.

## Jangan dikerjakan

- **`BqSubObject`.** PRD §8 menyatakan ia dipensiunkan. Jalur membuat yang baru
  sudah dicabut dari UI (BQ-64), dan baris lama tetap dirender supaya bisa
  dibaca dan dipindahkan. **Jangan mencabut, memigrasi, atau menghapus
  tabelnya** — data lama belum diperiksa. Pengecualian tunggal: BQ-65 memang
  menaikkan baris LIBRARY keluar dari `BqLibrarySubObjectOfObject`, dan itu
  tabel yang berbeda.
- **Jangan menjalankan migrasi.** Tulis berkas migrasinya, biarkan owner yang
  menjalankan `npx prisma migrate dev` di mesinnya. Ada enam migrasi lain yang
  juga belum diterapkan (BQ-2).
- **Jangan mengutip AT-01 / Rp5.653.559.** Angka itu tidak pernah ada di kode.
  Beberapa dokumen di arsip masih menyuruh menjaganya — abaikan, dan jangan edit
  dokumen arsipnya.
- **Jangan menurunkan aturan dari `BQ template tes.xlsx`.** Workbook itu mockup,
  bukan spesifikasi. Kalau kode berbeda darinya, cek `PRD-BQ.md` dulu.

## Aturan tunggal kalau ragu

Keputusan owner: *"pokoknya sederhana aja, ga usah ribet-ribet dan automasi
gimana-gimana."*

**Kalau sebuah usulan menambah angka yang bukan koefisien atau bukan harga,
jawabannya tidak.**

Kalau sebuah tugas di atas terasa lebih rumit daripada masalah yang
diselesaikannya, kemungkinan besar **dokumennya yang salah** — laporkan begitu,
jangan diam-diam membangun jalur rumitnya.

## Gerbang — jalankan sebelum menyatakan selesai

```
npx prisma validate
npx tsc --noEmit
npx eslint src/
npm test
```

Sekarang 30 test lulus: `calc.test.ts` (10), `section-rollup.test.ts` (8),
`section-tree.test.ts` (12). Angka `calc.test.ts` akan berubah setelah BQ-71 —
yang penting seluruhnya lulus dan `eslint src/subapps/bq/` exit 0.

`/bq` **tidak bisa diuji di browser** sampai owner menjalankan migrasi. Typecheck,
lint, dan unit test tetap jalan — itu gerbang yang berlaku.

## Sebelum selesai

Sesuai instruksi project:

1. Catat tiap perubahan di `CHANGELOG.md` — apa yang diubah **dan alasannya**,
   mengikuti format entri yang sudah ada (`### Hasil akhir` / `### Area/berkas` /
   `### Verifikasi` / `### Risiko`).
2. Perbarui `roadmap.md` §Siklus R3 — tandai `[x]` yang selesai, dan tulis apa
   yang berubah dari rencananya kalau ada.
3. Kalau kode dan `PRD-BQ.md` ternyata berbeda, jangan diam-diam memilih salah
   satu: perbaiki kodenya kalau itu bug, atau perbarui PRD kalau keputusannya
   memang berubah — lalu catat. Perbedaan yang tidak dicatat adalah cara dokumen
   jadi tidak bisa dipercaya.
