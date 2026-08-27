# HANDOFF R2 — OpenCode: BQ Selaraskan ke Prototype

**Untuk:** OpenCode
**Dari:** Claude (orchestrator)
**Tanggal:** 2026-08-19
**Acuan wajib:** `D:\Misc\ProjectsHUB\BQ\prototype_fixture_breakdown.html` + `BQ\README.md` + `BQ\PRD_Fixture_Breakdown.md`
**Menggantikan:** bagian library di `HANDOFF-OPENCODE.md` (R1)

---

## 0. Kenapa ada R2

R1 (P1–P4) sudah dikerjakan dan lulus review struktural. Tapi saat dibandingkan
dengan prototype yang **sudah di-QC estimator kantor**, ketahuan editor BQ di
StudioFlow menyimpang di beberapa titik.

Satu penyimpangan adalah kesalahan plan R1, bukan kesalahan OpenCode:

> R1 §B4 menulis *"Sesudah dituang, baris itu tidak lagi punya hubungan apa pun
> dengan entri library-nya."*

Prototype tidak begitu. Prototype memakai **template tertaut + copy-on-write**,
persis block SketchUp. R2 membetulkan ini.

---

## 1. Kontrak yang tetap berlaku dari R1

Masih berlaku, jangan dilanggar:

- `calc.ts` dan `calc.test.ts` **jangan disentuh** kecuali diperintahkan eksplisit di R2 §R3.
- AT-01 harus tetap **Rp5.653.559** di setiap tahap.
- Seluruh kolom `snapshot_*` dan `is_manual_override` **jangan dihapus**.
- Master data tetap SSOT. Tidak ada baris L3 karangan.
- Setiap tahap: `npx tsc --noEmit` + `npx eslint src/` + `npm test` harus bersih.

---

## 2. Prinsip domain (dari owner, 2026-08-19)

Empat kalimat ini yang menentukan bentuk editor:

1. **L1 custom per proyek.** Judul tiap L1 boleh beda-beda. L1 boleh disimpan ke
   library sebagai titik-mulai, tapi tidak tertaut.
2. **L2 bisa naik library BQ.** Ini yang punya semantik template tertaut.
3. **L3 ambil dari master data.** Harga dibekukan jadi snapshot saat diambil —
   tidak pernah realtime.
4. **BQ itu snapshot per proyek.** Tool ini pengganti Excel yang bolak-balik,
   bukan dashboard harga hidup.

---

## 3. Keputusan owner untuk R2

| # | Keputusan | Konsekuensi |
|---|---|---|
| **O1** | Template L2 **tertaut + copy-on-write** (ikut prototype) | Perlu kolom tautan di `BqSubObject` + logika auto-detach |
| **O2** | Library L1 **dipertahankan** bersama L2 | `BqLibraryObject` tetap; tapi L1 **pour-and-forget**, hanya L2 yang tertaut |
| **O3** | Mode ringkas (`BqDetailMode`) **dibuang sepenuhnya** | PRD §4 gugur. AT-05, AT-05b, AT-05c dihapus. AT-01 tidak terpengaruh |

---

## R1 — Buang `BqDetailMode` (keputusan O3)

**Ini satu-satunya izin menyentuh `calc.ts` dan `calc.test.ts` di R2.**

Owner memutuskan mode ringkas dibuang. Setiap object selalu mode detail.

Hapus:
- Enum `BqDetailMode` dari schema (migrasi `DROP TYPE`)
- Kolom `detail_mode` di `BqObject`, `BqSettings`, `BqLibraryObject`
- Gate mode di `resolveWaste()` — waste selalu aktif
- Skip-mode di Purchase Summary — semua object selalu ikut terhitung
- Field `skippedObjectCount` (atau sejenisnya) di Purchase Summary
- Tombol **"Use summary mode"** di `BqBreakdownClient.tsx`
- Test **AT-05, AT-05b, AT-05c** di `calc.test.ts`
- `default_detail_mode` dari dialog setelan ADMIN — tinggal `default_markup_pct` saja

**Verifikasi khusus:** setelah ini AT-01 harus **tetap Rp5.653.559**. Contoh Bab 7
memang mode detail, jadi angkanya tidak boleh bergeser satu rupiah pun. Kalau
bergeser, ada gate waste yang salah dihapus.

**Catatan untuk dokumentasi:** tulis di CHANGELOG bahwa PRD §4 sekarang usang
karena keputusan owner O3, supaya sesi berikutnya tidak menganggap ini regresi.

---

## R2 — Template L2 tertaut + copy-on-write (keputusan O1)

**Ini pekerjaan terbesar di R2.** Baca prototype baris 466–471 dan 703–707 sebelum mulai.

### R2.1 Semantik yang harus direproduksi

```
⧉  instance      sub-object yang MEMBACA definisi template
◇  berdiri sendiri  sub-object yang memegang barisnya sendiri
```

Aturan:

- Instance `⧉` hanya **membaca** baris dari definisi template.
- Begitu barisnya **disentuh** — ubah koefisien, tambah baris, hapus baris, atau
  override harga — instance itu **otomatis lepas** jadi `◇` dengan salinan
  barisnya sendiri.
- Definisi template dan instance lain **tidak pernah** ikut berubah dari sini.
- **Nama dan qty pengali selalu milik instance**, tidak pernah merambat. Mengubah
  keduanya **tidak** melepas tautan.
- Satu-satunya tempat mengubah definisi untuk semua instance adalah editor
  template di `/bq/library`.

### R2.2 Schema

Tambah ke `BqSubObject` (aditif):

```prisma
model BqSubObject {
  // ... kolom yang sudah ada ...

  /// Tautan ke definisi template L2. null = ◇ berdiri sendiri.
  /// Instance MEMBACA baris dari definisi; begitu barisnya disentuh,
  /// kolom ini di-null-kan (copy-on-write detach).
  library_sub_object_id String?
  library_sub_object    BqLibrarySubObject? @relation(fields: [library_sub_object_id], references: [id], onDelete: SetNull)
}
```

`onDelete: SetNull` — kalau definisi template dihapus, instance-nya jadi `◇`
berdiri sendiri, tidak ikut terhapus.

Migrasi: `20260819210000_bq_subobject_template_link`.

### R2.3 Titik detach — implementasikan sebagai satu helper

Buat satu fungsi di `bq-project-actions.ts`, panggil dari **setiap** action yang
menyentuh baris:

```ts
/** Copy-on-write: lepaskan sub-object dari template-nya sebelum barisnya diubah.
 *  Mengembalikan nama template lama kalau memang terjadi detach, supaya
 *  pemanggilnya bisa memberi tahu estimator. */
async function detachFromTemplate(subObjectId: string): Promise<string | null>
```

Panggil dari:

| Action | Detach? |
|---|---|
| `addBqMaterialLineAction` | ✅ ya |
| `addBqServiceLineAction` | ✅ ya |
| `updateBqMaterialLineAction` (qtyPerSub / waste / price) | ✅ ya |
| `updateBqServiceLineAction` (qtyPerSub / price) | ✅ ya |
| `deleteBqMaterialLineAction` | ✅ ya |
| `deleteBqServiceLineAction` | ✅ ya |
| `refreshMaterialLineSnapshotAction` | ✅ ya |
| rename sub-object | ❌ **tidak** |
| ubah qty pengali sub-object | ❌ **tidak** |

**Penting:** detach berarti baris-baris yang tadinya dibaca dari definisi harus
**disalin dulu** jadi milik instance, baru diubah. Jangan sampai detach
menghasilkan sub-object kosong.

### R2.4 Umpan balik ke estimator

Setiap detach memunculkan toast, seperti prototype:

```
«Ambalan» dilepas otomatis dari AMB-01 — barisnya diubah.
Template dan instance lain tidak ikut berubah.
```

### R2.5 Tampilan status di baris L2

Di header setiap sub-object:

- `⧉ Instance dari template AMB-01 · 3 instance` — kalau tertaut
- `◇` polos — kalau berdiri sendiri
- Tombol `+⧉` **hanya muncul pada `◇`** (yang sudah tertaut tidak perlu disimpan lagi)

Hitung jumlah instance dengan `count` pada `library_sub_object_id`.

---

## R3 — Tombol "Save to library" di editor (B3 R1 belum selesai)

Backend **sudah ada** dan tidak perlu ditulis ulang:

- `saveObjectToLibraryAction` (`bq-library-actions.ts:24`)
- `saveSubObjectToLibraryAction` (`bq-library-actions.ts:119`)

Yang belum ada: **tombolnya di `BqBreakdownClient.tsx`.** Halaman
`/bq/library` sudah menulis *"Save an object from a BQ breakdown"* padahal
jalannya belum dibuat.

### Yang harus dibuat

**Di baris L2 (sub-object):** tombol `+⧉` dengan tooltip
*"Simpan isi sub-object ini sebagai definisi template L2 baru"*.
Muncul hanya kalau sub-object berstatus `◇`.

Klik → dialog kecil: nama template + unit → simpan → **sub-object itu langsung
jadi instance pertamanya** (set `library_sub_object_id` ke definisi yang baru dibuat).

**Di baris L1 (object):** tombol "Simpan ke library". L1 **pour-and-forget** —
tidak ada tautan, tidak ada `⧉`, tidak ada copy-on-write. Ini cuma titik-mulai.

Kedua tombol tunduk pada `BQ_BREAKDOWN_EDIT` dan disembunyikan pada object terkunci.

---

## R4 — Override harga per baris (†)

Backend **sudah ada**: `updateBqMaterialLineAction` menerima `input.price` dan
`input.overrideNote`, lalu menulis `snapshot_price` + `is_manual_override: true`
(`bq-project-actions.ts:720-731`). Hal yang sama untuk service line di baris 938-941.

Yang belum ada: **field input di UI.** Sekarang `isManualOverride` cuma
ditampilkan sebagai badge pasif (`BqBreakdownClient.tsx:865`) — estimator bisa
melihat status override tapi tidak bisa membuatnya.

### Yang harus dibuat

Kolom **Harga satuan** di baris L3 jadi bisa diedit (`NumberCell`, commit saat blur/Enter).

Perilaku, ikut prototype:

- Nilai **sama dengan master** → bukan override, tanda `†` tidak muncul.
  (Prototype `isOverride()` baris 464 — pakai epsilon `1e-9`.)
- Nilai **beda dari master** → `is_manual_override: true`, tampilkan
  `† override · master Rp285.000` di bawah angkanya.
- **Kosongkan field** → kembali ke harga master, `is_manual_override: false`.
- Tooltip saat belum override: *"Harga master Rp285.000. Ubah untuk override khusus baris ini — akan ditandai †."*
- Override **melepas instance dari template** (lihat R2.3).

---

## R5 — Kolom koefisien eksplisit

Prototype punya header kolom yang jelas:

```
NO │ URAIAN PEKERJAAN │ SAT │ VOL · KOEF │ HARGA SATUAN │ JUMLAH │ CATATAN
```

Editor sekarang menaruh `qtyPerSub` sebagai `NumberCell` polos tanpa header —
estimator tidak tahu angka itu koefisien pemakaian **dalam satuan beli**.

### Yang harus dibuat

Header kolom di setiap tabel baris L3, dengan label yang sama seperti prototype.
Kolom `VOL · KOEF` diberi tooltip:

> Koefisien pemakaian untuk **satu** sub-object, dalam satuan beli.
> Jumlah sub-object = volume × harga satuan hasil analisa.

Ini bukan kosmetik. Tanpa label, koefisien 1,50 pada Plywood terbaca sebagai
"1,5 lembar dipakai" padahal artinya "1,5 lembar per satu Body Kabinet".

---

## R6 — Hierarki visual tombol tambah (L1 / L2 / L3)

Prototype memberi tiga tingkat yang jelas beda posisi dan indentasinya:

| Lapis | Tombol | Posisi |
|---|---|---|
| L3 | `+ Tambah Bahan` `+ Tambah Jasa` | Di dalam sub-object, indentasi paling dalam |
| L2 | `+ Tambah Sub-object` | Di kaki object, indentasi tengah |
| L1 | `+ Tambah Pos Pekerjaan` | Di kaki dokumen, indentasi paling luar |

Editor sekarang menaruh ketiganya nyaris rata — estimator kehilangan rasa
"saya sedang menambah di lapis mana".

### Yang harus dibuat

- Indentasi kiri bertingkat mengikuti kedalaman lapis.
- Garis vertikal penanda kedalaman (prototype pakai border kiri).
- Tombol L3 secara visual **lebih ringan** dari tombol L2, dan L2 lebih ringan dari L1.
- Tombol **Library** di L3 sekarang duduk sejajar `+ Material` / `+ Service`
  padahal fungsinya beda lapis — ia menuang **sub-object** dari library.
  Pindahkan ke sebelah `+ Tambah Sub-object` (lapis L2), bukan di dalam L3.

Ini yang paling terasa di layar dan paling murah dikerjakan.

---

## R7 — Bahasa UI *(perlu keputusan owner, jangan dikerjakan dulu)*

Dokumen yang di-QC estimator berbahasa Indonesia
(`URAIAN PEKERJAAN`, `Tambah Pos Pekerjaan`, `HARGA SATUAN`). Editor
StudioFlow berbahasa Inggris (`Add object`, `Rate / unit`, `Materials`).

Estimator kantor bekerja dengan istilah Indonesia. Menyamakan istilah editor
dengan dokumen keluarannya mengurangi salah baca.

**Jangan dikerjakan sebelum owner memutuskan.** Kalau diputuskan ya, ini
pekerjaan terpisah — sentuh label saja, jangan campur dengan R1–R6.

---

## 4. Yang TIDAK dikerjakan di R2

- **Item custom project (★)** — prototype punya `PMAT`/`PSVC`, tapi ini
  bertabrakan dengan keputusan owner #1-4 (*master data SSOT, tidak ada baris L3
  karangan*) dan PRD §11 no. 3 belum dijawab kantor. Biarkan dilarang.
- **Editor definisi template di Master Data** — prototype menaruhnya di sana;
  R1 menaruhnya di `/bq/library` dan owner tidak mempermasalahkan. Tetap di `/bq/library`.
- **RBAC cabut STAFF dari BQ** — masih menunggu konfirmasi owner (Q2 di R1).
  `constants.ts` belum disentuh dan itu memang benar untuk sekarang.
- **Rename `NO_PROFILE` → `NO_COSTING_DATA`** — kosmetik, boleh disisipkan kapan saja.

---

## 5. Urutan eksekusi

| Tahap | Isi | Kenapa urutannya begini |
|---|---|---|
| **T1** | R6 (hierarki tombol) + R5 (kolom koefisien) | Murni presentasi, tidak menyentuh data. Hasilnya langsung kelihatan dan aman. |
| **T2** | R1 (buang `BqDetailMode`) | Menyederhanakan `calc.ts` duluan supaya T3 tidak menambah kerumitan di atas kerumitan. |
| **T3** | R2 (template tertaut + copy-on-write) | Pekerjaan terberat. Butuh migrasi + helper detach + toast. |
| **T4** | R3 (tombol save to library) + R4 (override harga †) | Keduanya cuma wiring UI ke backend yang sudah ada. R4 wajib memanggil helper detach dari T3. |

Tiap tahap ditutup dengan:

```bash
npx tsc --noEmit && npx eslint src/ && npm test
```

**AT-01 wajib Rp5.653.559 di setiap tahap.** T2 adalah tahap paling berisiko
menggesernya — periksa dua kali di sana.

---

## 6. Test baru yang harus ditulis

Di `calc.test.ts` atau file test baru untuk copy-on-write:

| Test | Skenario | Harapan |
|---|---|---|
| CoW-01 | Instance `⧉`, ubah koefisien satu baris | Instance jadi `◇`; definisi template tidak berubah; instance lain tidak berubah |
| CoW-02 | Instance `⧉`, ubah **nama** sub-object | Tetap `⧉` — nama milik instance |
| CoW-03 | Instance `⧉`, ubah **qty pengali** | Tetap `⧉` — qty milik instance |
| CoW-04 | Instance `⧉`, tambah baris bahan | Jadi `◇`; baris lama ikut tersalin, tidak hilang |
| CoW-05 | Instance `⧉`, override harga satu baris | Jadi `◇`; `is_manual_override` true |
| CoW-06 | Definisi template dihapus | Semua instance jadi `◇`, barisnya utuh |
| OVR-01 | Set harga = harga master persis | `is_manual_override` **false**, `†` tidak muncul |
| OVR-02 | Kosongkan override | Kembali ke harga master |

---

## 7. Sebelum apa pun bisa dites

`npx prisma migrate dev` **belum dijalankan owner.** Ada 5 migrasi menunggu
dari R1 ditambah migrasi baru R2. Tanpa itu `/bq` gagal query dan tidak ada
satu pun tahap di atas yang bisa diverifikasi di browser.

Ini langkah owner, bukan OpenCode.
