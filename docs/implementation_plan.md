# Implementation Plan — Master Data Rework

**Batch ini:** Fase 1.0, 1.2, 1.3, dan bagian Fase 2 yang tidak terblokir.
**Disetujui owner:** 2026-08-12 (temuan Fase 0.b + urutan revisi diterima).
**Analisis pendukung:** `docs/PLAN-MASTERDATA-REWORK-2026-08-12.md` (§A–I).
**PRD:** `docs/PRD_MASTER_DATA_REDESIGN.md`.
**Status kode aplikasi: nol baris berubah.** Dokumen ini rencana, bukan laporan
pekerjaan.

> **Catatan lingkup.** Badan pesan owner menulis *"Proceed with Fase 1.0, 1.2,
> 1.3 and the non-blocked Fase 2 work"*, tapi baris terakhirnya menutup dengan
> *"ingat tugas kamu hanya menghasilkan implementation_plan.md"*. Saya menuruti
> yang terakhir: dokumen ini yang dikerjakan, kodenya belum. Kalau maksudnya
> memang mulai menulis kode, bilang saja — rencananya sudah cukup rinci untuk
> langsung dieksekusi dari sini.

---

## 0. Koreksi: slugify ternyata **7 implementasi**, bukan 6

Laporan Fase 0.b saya menyebut enam. Salah lagi, dan ke arah yang sama seperti
kekeliruan RBAC kemarin: saya mencari nama `slugify` dan melewatkan yang tidak
bernama begitu.

Yang ketujuh: **`categorySlug`** di
`src/subapps/master-data/services/category-tree-rules.ts:17`.

Dan begitu ia masuk hitungan, gambarannya **berubah jadi lebih baik**, bukan
lebih buruk. Ketiga varian NFKD ternyata sudah **identik secara perilaku** —
diperiksa dengan membandingkan badan fungsinya setelah whitespace dinormalisasi;
satu-satunya beda adalah nama parameter (`value` vs `tag`):

| # | Lokasi | NFKD | Perilaku |
|---|---|---|---|
| 1 | `services/category-tree-rules.ts:17` `categorySlug` | ✅ | **A** — sudah murni, sudah diuji |
| 2 | `extensions/library/services/library-service.ts:70` `slugifyTag` | ✅ | **A** (identik dengan #1) |
| 3 | `actions/quick-entry-actions.ts:55` `slugify` | ✅ | **A** (identik dengan #1) |
| 4 | `actions/party-actions.ts:93` `slugify` | ❌ | **B** |
| 5 | `actions/pricing-actions.ts:135` `slugify` | ❌ | **B** |
| 6 | `actions/sample-request-actions.ts:415` inline | ❌ | **B** |
| 7 | `extensions/library/services/library-service.ts:377` `slugify` | ❌ | **B** |

**Artinya untuk Fase 1.0, dan ini menyederhanakan pekerjaannya:**

- Perilaku kanonik yang owner minta dipertahankan (NFKD) **sudah ada, sudah
  murni, sudah bebas I/O, dan sudah diimpor oleh `sku-price.test.ts`**. Tidak
  perlu menemukan algoritma baru — cukup mengangkat yang sudah terbukti.
- Konsolidasi **hanya mengubah perilaku di 4 tempat** (#4–#7). Tiga sisanya
  jadi delegasi tanpa perubahan perilaku sama sekali.
- Karena hanya #4–#7 yang berubah, **entitas yang slug-nya berisiko bergeser
  cuma tiga**: `Party` (#4, #5), `Sku` (#6), `Brand` (#7). Laporan divergensi
  §1.0.5 tidak perlu menyapu seluruh schema.

### Temuan sampingan: acuan "byte-identical" menunjuk berkas yang sudah diarsipkan

Komentar `library-service.ts:66` berbunyi:

> *"MUST stay byte-identical to `slugify()` in `scripts/seed-brand-categories.mjs`."*

Berkas itu **tidak ada lagi di `scripts/`.** Ia dipindah ke
`docs/archive/scripts-usang/seed-brand-categories.mjs` pada pengarsipan
2026-08-10. Jadi kontrak yang owner minta saya jaga sedang menunjuk alamat yang
sudah kosong.

**Rencana:** jaga kontraknya, perbaiki alamatnya. `slugifyTag` mendelegasi ke
slugify bersama (nol perubahan perilaku, jadi byte-identical-nya otomatis
selamat), dan komentarnya diperbarui supaya menunjuk lokasi arsip yang benar
plus menyebut bahwa pasangannya kini adalah modul bersama. **Skrip arsipnya
sendiri tidak disentuh** — ia sudah tidak dijalankan, dan mengedit skrip arsip
untuk mencocokkan kode hidup adalah mengarang riwayat.

---

## 1. Guardrail yang mengikat seluruh batch

Diturunkan dari instruksi owner 2026-08-12. Setiap langkah di bawah diperiksa
terhadap daftar ini sebelum dianggap selesai.

### 1.1 Batas perubahan

| Aturan | Penerapan konkret |
|---|---|
| Konsolidasi slugify **minimal/surgical** | Hanya 7 lokasi di §0 + pemanggilnya. **Bukan** redesign sistem slug. Tidak menyentuh `Category.slug`, `path`, atau aturan pohon kategori. |
| `slugifyTag` byte-identical dengan pasangannya | Delegasi ke modul bersama → nol perubahan perilaku. Keduanya tidak boleh diubah terpisah. |
| **Konsolidasi generator ≠ migrasi data** | Slug yang sudah tersimpan **tidak** ditulis ulang massal. Kalau algoritma kanonik menghasilkan slug berbeda untuk record lama → **laporkan dulu, jangan tulis**. |
| `extensions/library` boleh disentuh **hanya sejauh dibutuhkan Master Data** | Daftar putih di §3.1. Di luar itu, tidak. |
| **Jangan** pakai redesign ini sebagai alasan memperbaiki Library yang tak terkait | Bug/kekacauan Library yang ditemukan di jalan **dicatat ke roadmap**, tidak diperbaiki di batch ini. |
| Audit mencatat **operasi nyata + record terdampak** | Bukan "action dipanggil". Lihat §3.3. |
| `price_list` **tidak** jadi NOT NULL sebelum hasil inspeksi DB ada | Fase 1.4 tetap terblokir. |
| Sebelum migrasi yang mengubah data: **berhenti, laporkan dampaknya dulu** | §6. |

### 1.2 Semantik yang tidak boleh berubah (anti-regression)

Diuji terhadap **logika bisnis Excel**, bukan cuma terhadap UI/schema sekarang:

- Brand → SKU
- Brand → banyak Supplier (`BrandSupplier`, tanpa `sku_id`)
- SKU → harga spesifik per Supplier (`SkuPrice`)
- `PartyRoleKind` (satu daftar gabungan, 6 nilai, kelima nilai Excel terwakili)
- Material + Service = **satu** penawaran komersial (bukan BOM)
- SKU hanya lahir dari alur Price
- Aturan identitas Excel: ID kosong = CREATE · ID ada = UPDATE · ID kosong +
  slug duplikat = **TOLAK/LAPORKAN** · baris hilang ≠ DELETE
- `Qty` disimpan, dilarang masuk perhitungan

### 1.3 Delapan yang dilarang diperkenalkan

`PartyCategory` untuk kategori material · `BrandSupplier.sku_id` ·
`WorkPrice → Sku` · BOM · penghapusan otomatis Excel · merge konflik otomatis ·
`is_complete` yang bisa berubah · **identitas berbasis slug**.

---

## 2. Fase 1.0 — Satu `slugify` bersama

**Kelas:** C (perilaku). **Tanpa migrasi.** **Prasyarat untuk 4.1
(`quickCreateSkuAction`), yang jadi prasyarat 2.6.**

### 2.0 Kenapa ini didahulukan

`Sku.slug` hari ini cuma dibuat di satu tempat — `sample-request-actions.ts:415`,
yang inline dan tanpa NFKD. `quickCreateSkuAction` akan jadi pembuat kedua. Dan
`Sku` punya `@@unique([brand_id, slug])` sementara `Sku.name` **tidak** unik,
jadi dua generator yang tak sepakat di sana bukan cuma tidak rapi — ia melahirkan
tabrakan unique yang muncul sebagai error tak terjelaskan saat staf menyimpan.
Menulis generator kedua di atas tujuh yang tidak sepakat berarti menanam bug
kedelapan.

### 2.1 Berkas baru

```
src/subapps/master-data/lib/slug.ts
```

Isinya persis badan `categorySlug` yang sudah ada (perilaku **A**), plus dokumen
alasan. Syarat teknis yang wajib dipenuhi: **murni, tanpa `server-only`, tanpa
Prisma** — supaya `npm test` bisa mengimpornya (`scripts/run-tests.mjs` hanya
mengompilasi yang terjangkau dari test, dan test tidak boleh menyentuh I/O).

```ts
/**
 * Satu-satunya generator slug Master Data.
 *
 * Perilaku kanonik (keputusan owner 2026-08-12): NFKD → buang diakritik →
 * lowercase → trim → setiap runtun non-alfanumerik jadi satu hyphen → trim
 * hyphen di kedua ujung.
 *
 * "PT Café Créme" → "pt-cafe-creme"   (é jadi e, bukan dibuang)
 *
 * Sebelum ini ada TUJUH implementasi, tiga NFKD dan empat tidak. Yang empat
 * membuang huruf beraksen alih-alih menerjemahkannya, sehingga satu nama yang
 * sama menghasilkan slug berbeda tergantung layar mana yang dipakai.
 *
 * MURNI DAN BEBAS I/O DENGAN SENGAJA — `npm test` tidak boleh mengimpor apa pun
 * yang menyentuh Prisma atau `server-only`.
 */
export function slugify(value: string): string { … }
```

### 2.2 Tujuh lokasi — apa yang terjadi pada masing-masing

| # | Lokasi | Tindakan | Perilaku berubah? |
|---|---|---|---|
| 1 | `category-tree-rules.ts:17` `categorySlug` | `export const categorySlug = slugify` (nama lama dipertahankan — sudah dipakai 5× di berkasnya sendiri dan diimpor `sku-price.test.ts`) | ❌ tidak |
| 2 | `library-service.ts:70` `slugifyTag` | delegasi ke `slugify`; komentar `:66` diperbarui (§0) | ❌ tidak |
| 3 | `quick-entry-actions.ts:55` | hapus fungsi lokal, impor bersama | ❌ tidak |
| 4 | `party-actions.ts:93` | hapus fungsi lokal, impor bersama | ✅ **ya** — `Party.slug` |
| 5 | `pricing-actions.ts:135` | hapus fungsi lokal, impor bersama | ✅ **ya** — `Party.slug` (work vendor) |
| 6 | `sample-request-actions.ts:415` | ganti ekspresi inline dengan panggilan | ✅ **ya** — `Sku.slug` |
| 7 | `library-service.ts:377` `slugify` | delegasi ke bersama | ✅ **ya** — `Brand.slug` |

Pemanggil yang ikut terdampak (tidak ada perubahan logika, hanya sumber fungsi):
`party-actions.ts:190,256` · `pricing-actions.ts:350,383` ·
`quick-entry-actions.ts:144,206,270` · `library-service.ts:398,409,463,884`.

**Di luar daftar ini: tidak ada.** Tidak menyentuh `Category.slug`,
`Category.path`, aturan pohon kategori, atau slug apa pun di luar Master Data.

### 2.3 Regression test — `src/subapps/master-data/lib/slug.test.ts`

Mengikuti pola `sku-price.test.ts`: `node:test` + `node:assert/strict`, murni,
dijalankan `npm test`.

Kasus yang owner minta, plus yang menjaga perilaku A tidak diam-diam bergeser:

| Kategori | Masukan | Harapan |
|---|---|---|
| **Diakritik** (kasus wajib owner) | `PT Café Créme` | `pt-cafe-creme` |
| Diakritik lain | `Ångström Malmö` | `angstrom-malmo` |
| **Uppercase** | `TACO HPL` | `taco-hpl` |
| **Whitespace** | `  TACO   HPL  ` | `taco-hpl` |
| Whitespace campur | `TACO\tHPL\nSheet` | `taco-hpl-sheet` |
| **Punctuation** | `TH 231 AC - ANDESH WALNUT` | `th-231-ac-andesh-walnut` |
| Punctuation beruntun | `A---B__C!!!D` | `a-b-c-d` |
| Hyphen di ujung | `--TACO--` | `taco` |
| Alfanumerik terjaga | `plywood 9mm` | `plywood-9mm` |
| Habis tersaring | `!!!` , `   ` , `` | `""` (string kosong, **bukan** lempar error) |
| Non-Latin | `合板 9mm` | `9mm` — didokumentasikan sebagai perilaku yang diketahui, bukan kecelakaan |
| **Idempoten** | `slugify(slugify(x)) === slugify(x)` untuk seluruh tabel | wajib |
| **Kesetaraan kanonik** | `slugify` ≡ `categorySlug` ≡ perilaku lama `slugifyTag` untuk seluruh tabel | mengunci "byte-identical" jadi hal yang diuji, bukan dijanjikan komentar |

**Slug duplikat dalam scope yang sama** — di sinilah unit test berhenti dan
kontrak database mulai. Dicakup dua lapis:

1. **Unit (murni):** `slugify("Andesh Walnut") === slugify("ANDESH  WALNUT!")`
   → menegaskan dua nama berbeda **memang** bertabrakan by design. Tabrakan
   bukan bug generator; ia sinyal.
2. **Kontrak (didokumentasikan, ⛔ butuh DB untuk dieksekusi):** scope-nya
   berbeda per entitas dan harus dinyatakan supaya penanganannya tidak
   diseragamkan keliru —

   | Entitas | Scope keunikan | Tabrakan artinya |
   |---|---|---|
   | `Sku` | `@@unique([brand_id, slug])` | **per brand** — dua SKU senama di brand sama ditolak DB |
   | `Brand` | `slug @unique` global | nama brand duplikat |
   | `Party` | `slug @unique` global | perusahaan duplikat |
   | `Category` | `@@unique([kind, slug])` | per jenis pohon |

   Penanganan tabrakan **tidak diubah di batch ini**. Yang ada sekarang
   (quick-entry memakai ulang record yang namanya sama, bukan menolak) tetap
   berlaku — mengubahnya adalah perubahan perilaku yang tidak diminta.

### 2.4 Definition of Done — 1.0

- [ ] `src/subapps/master-data/lib/slug.ts` ada, murni, bebas I/O
- [ ] Ketujuh lokasi §2.2 memakai satu implementasi
- [ ] Komentar `library-service.ts:66` menunjuk lokasi arsip yang benar + modul bersama
- [ ] `slug.test.ts` hijau lewat `npm test`
- [ ] `npx tsc --noEmit` bersih
- [ ] **Laporan divergensi §2.5 sudah dijalankan dan hasilnya disampaikan**
- [ ] Nol slug tersimpan yang ditulis ulang

### 2.5 ⚠️ Laporan divergensi — **lapor, jangan tulis**

Owner: *"jangan mengubah existing persisted slugs secara massal hanya karena
algoritma baru berbeda. Konsolidasi generator ≠ data migration."*

Karena hanya #4–#7 yang berubah perilaku, yang perlu diperiksa cuma tiga tabel.
Ditambahkan sebagai bagian **hanya-baca** di
`scripts/inspect-masterdata-state.mjs`:

```
Untuk Party, Brand, Sku:
  hitung baris yang slug_tersimpan ≠ slugify(name)
  tampilkan sampel maksimal 20 (id, name, slug lama, slug kanonik)
  JANGAN MENULIS APA PUN
```

Yang akan muncul di sana hampir pasti nama beraksen dan nama dengan tanda baca
tak lazim. Setelah angkanya ada, tiga opsi — dan **semuanya butuh persetujuan
terpisah**:

| Opsi | Konsekuensi |
|---|---|
| **(a) Biarkan** — slug lama tetap, slug baru pakai algoritma kanonik | Paling aman. Slug bukan identitas (B-Q3 sudah menolak itu), jadi slug lama yang "jelek" tidak merusak apa pun. **Rekomendasi.** |
| (b) Tulis ulang selektif | Butuh approval per record. Hanya masuk akal kalau ada URL/bookmark yang bergantung padanya. |
| (c) Tulis ulang massal | **Ditolak lebih dulu oleh owner.** Dicantumkan hanya supaya jelas ia sudah dipertimbangkan dan dibuang. |

Bahwa opsi (a) aman **karena** B-Q3 menolak identitas berbasis slug adalah
poin yang layak disadari: keputusan identitas Excel kemarin secara tidak sengaja
membuat masalah slug ini jadi kosmetik, bukan struktural.

---

## 3. Fase 1.2 — `MasterDataAudit` di semua jalur tulis nyata

**Kelas:** C. **Tanpa migrasi** — modelnya sudah ada dan kosong (0 baris,
dikonfirmasi ulang oleh skrip inspeksi §I.1).

### 3.1 Prinsip

Owner: *"implementasikan audit pada semua write path yang benar-benar menyentuh
Master Data, termasuk jalur `LibraryService`... Jangan hanya memasang audit pada
`src/subapps/master-data/actions`. Audit harus mencatat actual operation dan
entity/record yang terdampak, bukan sekadar 'action dipanggil'."*

Dua hal yang mengikuti dari kalimat itu, dan keduanya menentukan desainnya:

1. **Audit dipasang di lapisan yang tahu apa yang benar-benar tertulis** — yaitu
   sedekat mungkin dengan operasi Prisma-nya, bukan di pintu masuk action. Satu
   action bisa menyentuh 5 tabel (`updateVendor` menyentuh `Brand`, `Party`,
   `BrandSupplier`, `PartyContact`); mencatat "updateVendor dipanggil" membuang
   persis informasi yang membuat audit berguna.
2. **Satu operasi nyata = satu baris audit**, dengan `entity` + `entity_id` yang
   menunjuk record sungguhan.

### 3.2 Helper — `src/subapps/master-data/services/audit-service.ts`

Ditulis mengikuti pola `src/actions/_shared.ts:48`, dengan satu penyederhanaan
yang sah: `MasterDataAudit.actor_id` adalah **kolom biasa, bukan FK**
(`schema.prisma:707` — master_data sengaja tidak menyeberang ke studioflow).
Jadi tarian "verify user exists to prevent FK violations" di `_shared.ts:41-46`
**tidak diperlukan di sini**, dan menyalinnya akan jadi cargo cult.

```ts
export type MasterDataEntity =
  | "Party" | "PartyRole" | "PartyContact" | "PartyLink"
  | "Brand" | "BrandLink" | "BrandSupplier" | "BrandCategory"
  | "Category" | "Sku" | "SkuCategory" | "SkuMedia" | "SkuPrice"
  | "WorkPrice" | "WorkPriceProjectRef" | "Sample";

export async function recordMasterDataAudit(
  tx: PrismaTransaction,
  args: {
    entity: MasterDataEntity;
    entity_id: string;         // id record sungguhan — bukan id action
    action: AuditAction;       // CREATE | UPDATE | DELETE | RESTORE
    actor: { id?: string | null; name: string };
    changes?: Record<string, { from: unknown; to: unknown }> | Record<string, unknown>;
  }
): Promise<void>
```

Aturan isi `changes`:

- **CREATE** → field yang bermakna bisnis dari record yang dibuat (bukan seluruh
  payload; jangan tulis Json besar tanpa guna)
- **UPDATE** → hanya field yang **benar-benar berubah**, bentuk `{ from, to }`.
  Kalau tidak ada yang berubah, **jangan tulis baris audit** — audit yang
  mencatat non-peristiwa membuat yang asli sulit dicari.
- **DELETE** (soft delete) → `{ deleted_at: { from: null, to: <ts> } }`
- `Decimal` diserialkan ke string; `Date` ke ISO. `Decimal` mentah masuk `Json`
  adalah bug serialisasi yang sudah pernah menggigit repo ini (CHANGELOG
  2026-08-11).

Ikut dalam `tx` yang sama dengan operasinya — audit yang selamat padahal
transaksinya rollback adalah audit yang berbohong.

### 3.3 Inventaris jalur tulis — yang harus diaudit

**A. `src/subapps/master-data/actions/` (45 action, semuanya sudah bergerbang RBAC)**

| Berkas | Cakupan |
|---|---|
| `party-actions.ts` | `Party` create/update/delete (`:190`, `:256`), `PartyRole`, `PartyContact`, `PartyLink` |
| `pricing-actions.ts` | `SkuPrice` create/update/close · `WorkPrice` create/update/delete (`:445-451`, `:485-493`, `:758-806`) · `WorkPriceProjectRef` · Party work-vendor (`:350`, `:383`) |
| `quick-entry-actions.ts` | `Party` (`:144`), `Brand` (`:206`), work vendor (`:270`) — **termasuk cabang "pakai ulang yang sudah ada"**: penambahan role ke party lama adalah UPDATE nyata dan harus tercatat |
| `sample-actions.ts` | `Sample` + `SampleMovement` |
| `sample-request-actions.ts` | `Sku` yang lahir dari permintaan sample (`:415`) |
| `masterdata-actions.ts` | jalur tulis apa pun (mayoritas baca) |

**B. `src/extensions/library/services/library-service.ts` — CRUD Brand & SKU sebenarnya**

Ini bagian yang owner tegaskan tidak boleh dilewat. Operasi tulis yang menyentuh
tabel `master_data`:

| Baris | Operasi | Entity |
|---|---|---|
| `:395`, `:460`, `:470` | `party.create` / `party.update` | `Party` |
| `:406` | `brand.create` (createVendor) | `Brand` |
| `:432`, `:529`, `:531` | `partyContact.createMany` / `deleteMany` | `PartyContact` |
| `:495`, `:568` | `brand.update` | `Brand` |
| `:519`, `:522` | `brandSupplier.deleteMany` / `createMany` | `BrandSupplier` |
| `:874`, `:883` | `brand.update` (undelete) / `brand.create` (resolveVendor) | `Brand` |
| `:969` | `sku.create` (createProduct) | `Sku` |
| `:1130` | `sku.update` (updateProduct) | `Sku` |
| `:1163`, `:1166` | `skuMedia` deleteMany/createMany | `SkuMedia` |
| `:1293`, `:1298` | `sku.updateMany` + `brand.update` (mergeVendors) | `Sku`, `Brand` |
| `:1312` | `sku.update` (deleteProduct — soft) | `Sku` |
| `:1348` | `sample.update` (deletePhysicalSample) | `Sample` |
| `:1512` | `sku.create` (receiveProjectProductRequest) | `Sku` |
| `:1530` | `sample.create` | `Sample` |
| `:129`, `:138` | `skuCategory` upsert/deleteMany | `SkuCategory` |
| `:158` | `brandCategory.upsert` | `BrandCategory` |

Dua yang butuh perhatian khusus:

- **`mergeVendors` (`:1283-1298`)** — satu panggilan memindahkan N SKU lalu
  menghapus brand sumber. Butuh audit **per SKU yang berpindah** plus satu untuk
  brand yang dihapus. `updateMany` tidak mengembalikan id, jadi id-nya harus
  diambil **sebelum** pemindahan. Ini contoh paling jelas kenapa audit di pintu
  masuk action tidak cukup.
- **`resolveVendor` (`:864-884`)** — membuat Brand secara implisit dari sebuah
  nama. Brand yang lahir tanpa ada yang sadar membuatnya adalah persis yang
  paling perlu tercatat.

**C. Tidak diaudit:** semua pembacaan · `projectProductRequest.*` (`:1430`,
`:1542`, `:1571`, `:1591`) — tabel `studioflow`, bukan master_data, dan
`AuditLog` studioflow sudah wilayahnya sendiri · `sampleMovement.create`
(`:262`) yang **sudah** merupakan catatan riwayat; menduplikatnya ke
`MasterDataAudit` menghasilkan dua sumber kebenaran untuk satu peristiwa —
kecuali owner memutuskan sebaliknya.

### 3.4 Batas sentuhan `LibraryService`

Owner: *"jangan refactor atau clean up 1.603 baris tersebut secara umum."*

**Boleh disentuh** (daftar putih): Brand UX · perilaku create/read SKU ·
`BrandSupplier` bila perlu · quick-create SKU · relasi Master Data yang sudah
diputuskan · **penyisipan panggilan audit pada operasi tulis di §3.3.B**.

**Tidak disentuh:** penataan ulang metode, penggantian nama, perbaikan tipe,
penghapusan kode mati, perbaikan bug Library yang tidak berkaitan. Apa pun yang
ditemukan di jalan → **catat ke `roadmap.md`, jangan perbaiki di sini.**

Penyisipan audit dirancang **aditif**: tambah baris `await
recordMasterDataAudit(tx, …)` sesudah operasinya, tanpa menyusun ulang kode di
sekitarnya. Diff yang bisa dibaca sebagai "hanya penambahan" adalah diff yang
bisa direview terhadap janji ini.

### 3.5 Definition of Done — 1.2

- [ ] `audit-service.ts` ada, ikut `tx`, `Decimal`/`Date` terserialisasi aman
- [ ] Seluruh jalur §3.3.A tertutup
- [ ] Seluruh jalur §3.3.B tertutup, termasuk `mergeVendors` per-SKU dan `resolveVendor`
- [ ] UPDATE tanpa perubahan nyata **tidak** menulis baris audit
- [ ] Diff di `library-service.ts` murni aditif
- [ ] `npx tsc --noEmit` bersih · `npm test` hijau
- [ ] ⛔ butuh DB: satu putaran manual CRUD → `MasterDataAudit` terisi dengan
      `entity_id` yang benar-benar menunjuk record

---

## 4. Fase 1.3 — `WorkPrice.code` dibangkitkan otomatis

**Kelas:** C. **Tanpa migrasi** (B-Q2: kolom tetap `String @unique` NOT NULL).

### 4.1 Perubahan

| Berkas | Perubahan |
|---|---|
| `pricing-actions.ts:66` | `code: z.string().min(1, "Code is required")` **keluar** dari skema input create |
| `pricing-actions.ts:445-451`, `:758-764` | `code` diisi generator sisi server |
| `pricing-actions.ts:485-493`, `:798-806` | update **tidak lagi** menerima `code` dari klien; kode yang ada dipertahankan apa adanya |
| `PricingClient.tsx` | field Code hilang dari kedua form WorkPrice; `code` keluar dari state form |
| `types/pricing.ts:238,251` | `code` tetap di tipe baca (dipakai tampilan/debug), keluar dari tipe input |

### 4.2 Generator

Bentuk yang diusulkan: awalan stabil + komponen waktu + guard tabrakan, mis.
`WP-2026-0001`. Yang mengikat, apa pun bentuknya:

- **Deterministik dan bisa dibaca manusia** — kode ini muncul di log dan dukungan
- **Tahan tabrakan.** `@unique` tetap berlaku; generator harus mengecek dan
  mencoba ulang di dalam `tx` yang sama. Skrip inspeksi §I.1 melaporkan
  `COUNT(DISTINCT code)` supaya ruang yang sudah terpakai diketahui, **bukan
  diasumsikan kosong**
- **Tidak pernah dipakai ulang** setelah soft delete — `WorkPrice` punya
  `deleted_at`, dan record terhapus tetap memegang kodenya
- **Kode lama tidak disentuh.** Ini penting: `WorkPrice` yang sudah ada punya
  kode buatan tangan yang mungkin bermakna bagi staf. Generator hanya berlaku
  untuk record **baru**.

### 4.3 Definition of Done — 1.3

- [ ] Staf tidak pernah melihat/mengisi `code` di UI mana pun
- [ ] Create menghasilkan kode unik; tabrakan ditangani, bukan dilempar ke user
- [ ] Update mempertahankan kode yang ada
- [ ] Kode lama tidak berubah
- [ ] `npx tsc --noEmit` bersih · `npm test` hijau
- [ ] Uji Excel Table 3 & Table 4 masih bisa dimasukkan penuh tanpa kolom Code

---

## 5. Fase 2 — Materials grain-Brand (bagian yang tidak terblokir)

**Termasuk:** 2.1–2.5. **TIDAK termasuk: 2.6** (hapus "Add Material") — B-Q5
menguncinya di belakang 4.1 yang sudah teruji.

| Langkah | Isi | Berkas |
|---|---|---|
| 2.1 | Grid kartu brand → **tabel grain-Brand** dengan search/sort/filter/paginasi | `MasterDataMaterialsClient.tsx:349-399`, `material-view-service.ts` |
| 2.2 | Baris expand → daftar SKU **read-only** | `MasterDataMaterialsClient.tsx`, `MasterDataProductDialog.tsx` (mode baca) |
| 2.3 | Kolom hitung SKU + hitung supplier per brand (agregat SQL, bukan JS) | `material-view-service.ts` |
| 2.4 | Indikator kelengkapan **turunan** | `material-view-service.ts` |
| 2.5 | Brand CRUD — **nol pekerjaan**, `MasterDataBrandDialog.tsx` sudah bersih | — |

### 5.1 Definisi kelengkapan (PRD §10 — turunan, bukan kolom)

Eksplisit dan bisa diuji. **Tidak ada `is_complete`**, tidak ada state yang bisa
melenceng dari datanya:

| Entitas | "Needs completion" bila |
|---|---|
| Brand | tidak punya kategori **atau** tidak punya supplier |
| SKU | `base_unit` kosong **atau** `status = DRAFT` |
| Party | `roles.length === 0` |

### 5.2 Batas

- Hitungan agregat lewat SQL (`material-view-service.ts` sudah mendelegasikan ke
  `LibraryService.getAllProducts`; pola itu dipertahankan, tidak dibongkar)
- `MaterialRow` tetap **seluruhnya skalar** — tidak ada objek Prisma, tidak ada
  `Decimal`, tidak ada relasi. Alasannya sudah ditulis panjang di
  `material-view-service.ts:1-45` dan masih berlaku; mengembalikan relasi ke sana
  akan menghidupkan lagi bug serialisasi `Decimal` yang sudah pernah diperbaiki
- Sentuhan `LibraryService` hanya sejauh Brand UX + perilaku baca SKU (§3.4)

### 5.3 Definition of Done — Fase 2 (parsial)

- [ ] Satu baris tabel = satu Brand; search/sort/filter/paginasi jalan
- [ ] Expand menampilkan SKU brand itu, **read-only**
- [ ] Hitungan SKU & supplier benar (dibandingkan dengan query manual)
- [ ] Indikator kelengkapan sesuai §5.1, nol kolom baru
- [ ] Tombol "Add Material" **masih ada** — 2.6 belum boleh jalan
- [ ] `npx tsc --noEmit` bersih · alur UX PRD §17 A dan G ditelusuri manual

---

## 6. Yang TIDAK dikerjakan di batch ini

| Item | Alasan | Pembuka blokir |
|---|---|---|
| **1.4** — arah List/Net Price | B-Q7: butuh angka `price_list IS NULL` | jalankan `scripts/inspect-masterdata-state.mjs`, tempel ke §I.1 |
| **2.6** — hapus "Add Material" | B-Q5: 4.1 harus selesai & teruji dulu | Fase 4.1 |
| **1.6** — gerbang `MASTERDATA_VIEW` di 8 read action | bukan blocker keamanan (H.2) | boleh menyusul kapan saja |
| Fase 3, 4, 5, 6 | di luar batch yang disetujui | persetujuan batch berikutnya |
| Penulisan ulang slug massal | konsolidasi generator ≠ migrasi data | approval terpisah setelah §2.5 |
| `price_list` → NOT NULL | dilarang eksplisit sebelum inspeksi DB | §I.1 |
| Refactor umum `LibraryService` | dilarang eksplisit | — |
| Promosi `color/motif/finishing` ke kolom | kelas D, di luar PRD ini | — |

### 6.1 Protokol berhenti-dan-lapor

Sebelum migrasi apa pun yang mengubah data — dan sebelum penulisan ulang slug
apa pun — **berhenti dan laporkan dampak datanya lebih dulu**:

1. jumlah baris terdampak (angka, bukan perkiraan)
2. sebelum/sesudah untuk sampel yang mewakili
3. apa yang hilang dan apakah bisa dipulihkan
4. perintah backup, dijalankan dan diverifikasi:
   `pg_dump -n master_data -Fc studioflow > backups/masterdata_pre_<perubahan>_$(date +%Y%m%d).dump`
5. **jangan mengarang nilai historis yang hilang** — bukan `COALESCE`, bukan
   tanggal tebakan, bukan `updated_by_name` karangan

Dua dump di `backups/` bertanggal 2026-07-30, **pra-rebaseline v2** — tidak sah
dijadikan pengaman, dan tidak sah dijadikan sumber asumsi tentang keadaan
sekarang.

---

## 7. Urutan eksekusi

```
1.0  slugify bersama            ← prasyarat 4.1; laporkan divergensi, jangan tulis
 ├── 1.3  WorkPrice.code auto   ← independen, boleh paralel
 └── 1.2  MasterDataAudit       ← paling besar di batch ini; sentuh library-service secara aditif
      └── 2.1–2.5  Materials grain-Brand
           └── (2.6 MENUNGGU 4.1)

paralel & di luar jalur kritis:
  §2.5 laporan divergensi slug   → lapor, tunggu keputusan
  §I.1 inspect-masterdata-state  → owner menjalankan → membuka 1.4
```

**Gerbang di antara langkah:** `npx tsc --noEmit` + `npm test` hijau sebelum
langkah berikutnya dimulai. Anti-regression §1.2 dicek ulang di setiap gerbang —
terhadap **logika bisnis Excel**, bukan cuma terhadap UI dan schema yang sekarang.

## 8. Ringkasan bobot & risiko

| Langkah | Bobot | Risiko utama |
|---|---|---|
| 1.0 | Ringan–sedang | 4 lokasi berubah perilaku. Risikonya bukan kodenya, melainkan godaan menulis ulang slug lama "sekalian". **Jangan.** |
| 1.2 | **Terbesar di batch** | ~35 titik tulis di dua modul. `mergeVendors` butuh id **sebelum** `updateMany`. Menjaga diff `library-service.ts` tetap aditif butuh disiplin, bukan kepintaran. |
| 1.3 | Ringan | tabrakan kode; kode lama tidak boleh tersentuh |
| 2.1–2.5 | Sedang | perubahan grain = penulisan ulang query. Jangan kembalikan relasi ke `MaterialRow`. |

---

**Menunggu dari owner:** keluaran `node scripts/inspect-masterdata-state.mjs`
(§I.1) — satu-satunya prasyarat Fase 1.4, dan sekaligus yang mengisi angka
laporan divergensi slug §2.5.

**Menunggu keputusan:** apakah dokumen ini dieksekusi jadi kode sekarang, atau
berhenti di sini sesuai baris terakhir instruksi 2026-08-12.
