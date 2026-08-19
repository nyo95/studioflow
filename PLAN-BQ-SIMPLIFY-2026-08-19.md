# PLAN — Sederhanakan BQ, Tambah Library

**Status:** rencana, belum dieksekusi
**Tanggal:** 19 Agustus 2026
**Acuan:** `BQ/PRD_Fixture_Breakdown.md`, `BQ/README.md`, `BQ/prototype_fixture_breakdown.html`

> **Prinsip:** BQ di StudioFlow harus terasa sesederhana prototype di repo BQ. Yang sudah melampaui prototype tanpa alasan kuat diturunkan; yang prototype punya tapi StudioFlow belum, dikerjakan.

---

## 0. Ringkasan keputusan

| # | Keputusan | Alasan singkat |
|---|---|---|
| K1 | Field costing pindah dari `BqMaterialProfile` ke `master_data.Sku` | Selama konversi terpisah dari SKU, tidak ada material yang bisa dipakai sampai profilnya diisi manual satu per satu |
| K2 | `BqCategoryWaste` dibuang (tabel + UI), level presedensinya tetap di `calc.ts` | Kodenya hidup tapi tabelnya kosong, dan PRD §11 no. 5 belum dijawab kantor |
| K3 | `/bq/settings` dihapus | Isinya bukan setelan BQ — itu master data yang salah tempat |
| K4 | Drift 6 kategori → 1 sinyal | Prototype cukup "ada yang berubah, mau tinjau?" |
| K5 | `calc.ts` juga dipakai di klien untuk umpan balik instan | Mengembalikan FR-EXP-06 seperti prototype tanpa melanggar rule #5 |
| K6 | Library resep L1 dan L2, **dua tabel terpisah** | Menjawab PRD §11 no. 2. Dipanggil di tempat berbeda, jadi menyatukannya tidak menghemat call site |

---

## 1. Yang TETAP — jangan disentuh

Bagian ini sudah setia ke PRD dan tidak over-engineered.

- `src/subapps/bq/lib/calc.ts` — mesin hitung. Urutan operasi normatif §3 sudah benar.
- `src/subapps/bq/lib/calc.test.ts` — AT-01 s.d. AT-12. Angka Rp5.653.559 dikunci apa adanya.
- Schema tiga lapis: `BqProject`, `BqObject`, `BqSubObject`, `BqMaterialLine`, `BqServiceLine`.
- Seluruh kolom `snapshot_*` di baris L3, termasuk `is_manual_override`.
- Ketiadaan kolom waste/konversi di `BqServiceLine` — itu penegakan AT-07 lewat skema.
- `BqDetailMode` (`DETAIL` / `RINGKAS`) — ada dasarnya di PRD §4.
- Struktur komponen `ObjectRow` → `SubObjectRow` → `LineTable`.
- `NumberCell` — commit saat blur/Enter, bukan tiap ketikan. Sudah benar.
- `BqLinePicker` — termasuk keputusan menampilkan kandidat belum-siap beserta alasannya.

---

## 2. Yang DI-DOWNGRADE

### D1 — Pindahkan field costing ke `Sku`

**Masalah.** Sebuah SKU baru muncul di picker sebagai `NO_PROFILE` dan tidak bisa dipilih sampai seseorang mengisi `BqMaterialProfile`-nya di `/bq/settings`. Akibatnya: staff input material di Master Data, estimator buka BQ, tidak ada yang bisa dipakai. Prototype tidak punya masalah ini karena konversi adalah kolom di master bahan itu sendiri.

**Tindakan.** Tambahkan ke `master_data.Sku` (aditif):

```
usage_unit          String?
purchase_unit       String?
conversion          Decimal?  @db.Decimal(18,6)   -- CHECK > 0
default_waste_pct   Decimal?  @db.Decimal(9,6)
minimum_order       Decimal?  @db.Decimal(18,6)
rounding_increment  Decimal   @default(1) @db.Decimal(18,6)
```

Lalu:

- Backfill dari `BqMaterialProfile` (aditif, tidak menimpa).
- `master-data-service.ts` → `toCandidate()` baca dari `Sku`, bukan relasi profil.
- Hapus model `BqMaterialProfile` dan relasi `Sku.bq_profile`.
- `readiness` menyusut jadi dua alasan: `NO_PRICE`, `UNIT_MISMATCH`. `NO_PROFILE` hilang.
- UI pengelolaannya masuk ke dialog SKU di `/masterdata` — surface yang sudah dipegang STAFF lewat `MASTERDATA_SKU_MANAGE`.

**Catatan.** Ini membalik keputusan owner 2026-08-19 (*"setting ini hanya perlu untuk keperluan BQ"*). Keputusan itu diambil sebelum efek sampingnya terlihat. **Perlu konfirmasi ulang — lihat Bab 5.**

### D2 — Buang `BqCategoryWaste`

Kodenya hidup (`master-data-service.ts:203`, `settings-service.ts:166`) tapi tabelnya nol baris, dan PRD §11 no. 5 belum dijawab.

Hapus: model `BqCategoryWaste`, relasi `Category.bq_waste`, `loadCategoryWaste()`, `listCategoryWasteRows()`, tipe `BqCategoryWasteRow`, tab-nya di settings.

**Pertahankan** level 4 di `resolveWaste()`. `categoryDefaultWastePct` cukup selalu `null` — AT-03 tetap lulus, dan kalau kantor suatu hari memutuskan angkanya, sumbernya tinggal disambung tanpa menyentuh mesin hitung. Kolom `snapshot_category_default_waste_pct` di `BqMaterialLine` juga tetap (jangan `DROP`).

### D3 — Hapus `/bq/settings`

Setelah D1 dan D2, isinya tinggal dua field: `default_markup_pct` dan `default_detail_mode`.

- `BqSettings` sebagai tabel **tetap** — tiga kolom, satu baris.
- Halamannya dihapus. Dua field itu jadi dialog kecil di header daftar project `/bq`, ADMIN saja.
- Hapus: `app/bq/settings/page.tsx`, `BqSettingsClient.tsx` (17KB), sebagian besar `bq-settings-actions.ts` (8KB).

**RBAC ikut menyusut:**

- `BQ_SETTINGS_MANAGE` tetap ada, tapi hanya untuk dua default kantor. ADMIN saja.
- **STAFF keluar dari BQ.** Cabut `BQ_ACCESS` dan `BQ_SETTINGS_MANAGE` dari STAFF. Setelah D1, tidak ada lagi yang perlu STAFF kerjakan di dalam BQ — costing SKU dikelola di `/masterdata` dengan permission yang sudah ia punya. Ini justru mengembalikan PRD §5.1: Admin Bahan *"tidak bisa mengubah isi project"*.

### D4 — Sederhanakan drift

`BqDriftKind` 6 varian → satu sinyal.

- Per baris: `hasDrift: boolean`.
- Per object: satu banner, "N baris berubah sejak snapshot diambil — Tinjau / Pertahankan".
- Aksi refresh per baris tetap seperti sekarang (itu yang memenuhi "boleh diterapkan sebagian").
- `price-drift-service.ts` 7KB → target di bawah 2KB.

Object terkunci tetap dilewati seluruhnya.

---

## 3. Yang DIKERJAKAN

### B1 — Hitung ulang instan di klien

**Masalah.** `useMutate()` (`BqBreakdownClient.tsx:110`) memanggil `router.refresh()` tiap perubahan angka — roundtrip server, query Prisma, hitung ulang, payload RSC baru. Di prototype, ubah qty ambalan 3 → 5 itu instan. Ini regresi pada fitur yang PRD sebut sebagai pembeda utama alat ini dari Excel.

**Tindakan.** `calc.ts` modul murni — impor juga di klien.

1. Estimator commit angka → hitung ulang di browser → layar berubah seketika.
2. Mutasi dikirim ke server di belakang.
3. `router.refresh()` datang belakangan sebagai koreksi.
4. Kalau server menolak, kembalikan nilai lama dan tampilkan toast.

Server tetap SSOT. PRD rule #5 aman — yang berubah cuma dari mana angka di layar datang sambil menunggu.

### B2 — Tabel library

Dua tabel. Isinya **resep**, bukan angka: tidak ada satu pun kolom `snapshot_*`.

```
BqLibraryObject        -- L1
  id, code, name, unit, markup_pct, detail_mode, notes
  created_by_name, created_at, updated_at, deleted_at
  sub_objects  BqLibrarySubObjectOfObject[]

BqLibrarySubObject     -- L2, berdiri sendiri
  id, name, qty, notes
  created_by_name, created_at, updated_at, deleted_at
  materials  BqLibraryMaterialLine[]
  services   BqLibraryServiceLine[]

BqLibraryMaterialLine
  sku_id, qty_per_sub, waste_override_pct, sort_order

BqLibraryServiceLine
  work_price_id, qty_per_sub, sort_order
```

`BqLibraryObject` menyimpan sub-object-nya sendiri (bukan FK ke `BqLibrarySubObject`) supaya mengubah "Ambalan standar" tidak diam-diam mengubah setiap L1 yang pernah memakainya. Aturan yang sama dengan snapshot: perubahan tidak merambat tanpa konfirmasi.

### B3 — Simpan ke library

Dari hasil kerja, bukan form kosong. Estimator selesai menyusun sebuah object atau sub-object → tombol **Save to library** → beri nama.

Yang disalin: `sku_id`, `work_price_id`, `qty_per_sub`, `waste_override_pct`, `qty` L2, struktur. Yang **tidak** disalin: seluruh kolom `snapshot_*`.

Baris yang `sku_id`-nya `null` (master-nya sudah lenyap) tidak bisa ikut — tolak dengan pesan yang menyebut baris mana.

### B4 — Panggil dari library

Masuk lewat jalur yang sudah ada, bukan jalur kedua:

```
entri library → untuk tiap baris: loadMaterialCandidate(sku_id)
              → bekukan snapshot_* saat itu juga
              → simpan sebagai BqMaterialLine biasa
```

Sesudah dituang, baris itu tidak lagi punya hubungan apa pun dengan entri library-nya. Ia baris biasa yang bisa disunting bebas.

Baris yang materialnya sudah tidak punya harga aktif dilaporkan sebelum penuangan (`NO_PRICE`), bukan disisipkan dengan harga nol.

### B5 — Halaman `/bq/library`

Dua tab: Objects dan Sub-objects. Per entri: nama, jumlah baris, kapan dibuat, siapa. Aksi: rename, hapus (soft), lihat isi.

Menggantikan `/bq/settings` di navigasi. Permission: `BQ_BREAKDOWN_EDIT` — ini perpustakaan milik estimator, hasil pekerjaannya sendiri.

---

## 4. Urutan eksekusi

| Tahap | Isi | Selesai bila |
|---|---|---|
| **P1** | D1 — costing ke `Sku`, hapus `BqMaterialProfile` | Staff input SKU + harga di `/masterdata`, estimator langsung bisa memilihnya di picker tanpa langkah lain |
| **P2** | D2, D3, D4 — buang category waste, hapus halaman settings, sederhanakan drift | `/bq/settings` tidak ada lagi; STAFF tidak punya akses BQ; banner drift satu kalimat |
| **P3** | B1 — hitung ulang instan | Ambalan 3 → 5, angka L1 dan grand total berubah tanpa jeda yang terasa |
| **P4** | B2, B3, B4, B5 — library | "Ambalan standar" disimpan dari satu project, dipanggil di project lain, harganya harga hari ini bukan harga saat disimpan |

P1 duluan karena tanpanya tidak ada yang bisa diuji — picker kosong.

Tiap tahap: migrasi aditif saja, verifikasi `npx tsc --noEmit` + `npx eslint` + `npm test`. Angka AT-01 wajib tetap Rp5.653.559 di setiap tahap.

---

## 5. Perlu konfirmasi owner sebelum P1

1. **Field costing pindah ke `Sku`?** Membalik keputusan 2026-08-19. Konsekuensinya: SKU baru langsung siap dipakai BQ, `/bq/settings` bisa hilang, satu tabel dan satu service file lenyap. Biayanya: kolom BQ-only ikut duduk di tabel master data.
2. **STAFF dicabut dari BQ?** Setelah P1 tidak ada lagi pekerjaan STAFF di dalam BQ.
3. **Waste per kategori dibuang atau ditunda?** Rencana ini membuangnya. Kalau kantor sudah punya angkanya, keputusan berbeda.
4. **Baris custom khusus project** (PRD §11 no. 3) — tetap dilarang seperti sekarang? Rencana ini mengasumsikan ya.

Nomor 1 memblokir seluruh rencana. Nomor 2–4 tidak.
