# Audit Skema Master Data — 2026-08-19

> **UPDATE 2026-08-19 sore — kelima temuan di bawah SUDAH DIEKSEKUSI.** Owner
> memutuskan semuanya sore ini dan minta Claude eksekusi langsung (bukan
> Codex). Status: SK1 opsi (a) dipilih (komentar "TIDAK DIPAKAI" + migrasi
> `20260819140000`), SK2 ditambal (`assertBrandBelongsToParty()` di
> `party-actions.ts`), SK3/finding #3 ditambal (migrasi
> `20260819150000_category_kind_slug_live_uniq`), finding #5 didokumentasikan
> di `schema.prisma`. Detail lengkap di `roadmap.md` §"MASTER DATA — Audit
> skema 2026-08-19 (SELESAI, dieksekusi Claude)".
>
> **KOREKSI finding #4 (`Category.path`) di bawah — SALAH.** Saat menulis
> laporan ini, "diverifikasi masih seperti didokumentasikan" ditulis tanpa
> benar-benar membaca `category-tree-service.ts`. Investigasi lanjutan sore
> ini menemukan `propagateDescendantPaths()` SUDAH ADA sejak **B7
> (2026-08-18)** — sehari sebelum audit ini — dan dipanggil otomatis dari
> `upsertCategory()` setiap `path` berubah. Ini BUKAN celah terbuka. Bagian
> "Catatan risiko rendah/dorman #4" di bawah dibiarkan apa adanya sebagai
> riwayat (bukan diedit diam-diam), tapi jangan dipercaya — baca update ini,
> bukan teks aslinya.

**Konteks:** owner minta cek ulang `master_data` secara khusus dari sisi
struktural: apakah desainnya solid dan bebas cacat logic. Ini **bukan**
pengulangan audit aplikasi `AUDIT-MASTERDATA-2026-08-18.md` — fokusnya murni
`prisma/schema.prisma` + migrasi raw SQL yang menegakkan invariant + jalur
tulis (`actions/*.ts`) yang benar-benar menyentuh invariant itu, dicek
langsung ke kode, bukan dipercaya dari komentar.

**Kesimpulan singkat:** skema `master_data` v2 tergolong solid. Kelima
jaminan keunikan yang tidak bisa dinyatakan `@unique` polos di Prisma (perlu
partial/expression index) semuanya **sudah** diterapkan lewat migrasi raw SQL
dan didokumentasikan lengkap di `AGENTS.md` §🧱 Master Data Contract (v2) §2 —
diverifikasi langsung ke `20260810180000_masterdata_v2_rebaseline/migration.sql`
§§1–3 dan `20260818120000_masterdata_live_unique_indexes`, semuanya cocok
persis dengan dokumentasinya. Batas schema `master_data` ↔ `studioflow`
(dilarang FK menyeberang schema) juga konsisten dipatuhi di seluruh model yang
diperiksa.

Ditemukan **2 celah baru** yang belum pernah tercatat di dokumen manapun
(`AGENTS.md`, `roadmap.md`, `HANDOFF-CODEX.md`, audit 2026-08-18), dan **2
catatan risiko rendah/dorman** (bukan bug aktif, belum bisa dipicu hari ini).

---

## Temuan baru

### 1. [SEDANG–TINGGI] `WorkPrice` — kolom versioning yang tidak pernah dipakai jalur tulis manapun

`WorkPrice.valid_from` / `valid_to` / `is_current` terlihat identik dengan pola
`SkuPrice`, yang menurut kontrak (`AGENTS.md` §3.3) **wajib** jadi tabel
riwayat: *"Mengedit penawaran berarti menutup baris lama (`is_current: false`
+ `valid_to`) dan menulis yang baru."*

Tapi `WorkPrice.code` dideklarasikan `@unique` **global** (bukan per party,
bukan per apa pun yang sempit) — secara struktural **tidak mungkin** ada dua
baris `WorkPrice` berbagi `code` yang sama (satu lama `is_current: false`,
satu baru `is_current: true`), padahal itu justru pola supersede yang dipakai
`SkuPrice`.

Jalur tulisnya dibaca langsung di
`src/subapps/master-data/actions/pricing-actions.ts`:

- `updateServicePriceAction` (kind `LABOR_ONLY`, ~baris 674) dan
  `updateMaterialLaborPriceAction` (kind `MATERIAL_LABOR`, ~baris 1232)
  sama-sama melakukan `tx.workPrice.update({ where: { id }, data: { price:
  ..., ... } })` — menimpa baris yang ada di tempat.
- `is_current`, `valid_from`, `valid_to` **tidak pernah** disentuh sesudah
  `create` di file ini — bukan cuma di dua fungsi update itu, ketiganya nol
  kemunculan di jalur tulis `WorkPrice` manapun.

**Akibatnya:** mengedit tarif jasa/paket menimpa angka lama secara permanen
pada baris yang sama. Yang tersisa dari harga lama hanyalah
`MasterDataAudit.changes` (JSON diff per-edit) — bukan baris ber-struktur yang
bisa langsung di-query "harga yang berlaku per tanggal X", padahal itu justru
yang didukung penuh oleh `SkuPrice`. Kontrak §12.3 soal viewer SKU menjanjikan
"riwayat harga, termasuk baris yang sudah ditutup" — tidak ada janji setara
untuk `WorkPrice` di manapun, dan sekarang jelas kenapa: infrastrukturnya
memang tidak ada.

Ini belum pernah disebut di manapun — bukan di `AGENTS.md` §3, bukan di
skenario "Uji manual — Master Data v2" §"Harga kerja" (langkah 18–19 cuma
menguji validasi `checkWorkPrice`, tidak menguji riwayat sama sekali), bukan
di audit 2026-08-18.

**Pertanyaan buat owner (keputusan desain, bukan bug yang jelas arah
perbaikannya):**

- **(a)** Kalau `WorkPrice` memang **sengaja** satu-baris-per-code (tidak
  butuh riwayat harga jasa/tarif tukang), maka `valid_from` / `valid_to` /
  `is_current` sebaiknya diberi komentar "TIDAK DIPAKAI" persis seperti
  kolom `qty` sekarang (lihat komentarnya di `schema.prisma` dan
  `COMMENT ON COLUMN` di migrasi) — supaya pembaca berikutnya tidak mengira
  ketiganya berfungsi seperti `SkuPrice`. Ini perubahan dokumentasi murni,
  aman dikerjakan tanpa migrasi.
- **(b)** Kalau riwayat harga jasa memang dibutuhkan (mis. buat melihat tren
  tarif tukang/vendor dari waktu ke waktu), perlu pola `recordWorkPrice()` /
  `closeCurrentWorkPrice()` setara `SkuPrice` — **dan** `code` harus lepas
  dari `@unique` global (jadi unique per sesuatu yang lebih sempit, atau
  identitas bisnis dipisah dari identitas baris). Ini perubahan skema 🔒,
  butuh migrasi dan keputusan owner sebelum dikerjakan.

### 2. [SEDANG] `PartyContact.brand_id` tidak divalidasi terhadap kepemilikan/relasi brand↔party

Komentar schema bilang field ini "Kontak khusus satu merek di **perusahaan
ini**" — menyiratkan brand yang ditunjuk harus benar-benar terkait ke party
tersebut (jadi owner brand itu lewat `Brand.owner_party_id`, atau tercatat
sebagai supplier lewat `BrandSupplier`). Tapi:

- Tidak ada FK-level check yang mungkin — constraint lintas dua relasi
  independen (`PartyContact.party_id` vs `Brand.owner_party_id`/
  `BrandSupplier`) tidak bisa dinyatakan Postgres tanpa trigger.
- `createPartyContactAction` dan `updatePartyContactAction`
  (`src/subapps/master-data/actions/party-actions.ts`) menerima `brand_id`
  mentah dari input client tanpa verifikasi brand itu benar-benar
  milik/dipasok party yang sama.

UI kemungkinan besar cuma menawarkan brand yang relevan di dropdown, jadi ini
kemungkinan besar tidak "hidup" lewat alur normal hari ini — tapi tidak ada
penjaga di server kalau ada bug UI, race condition (party diganti di tengah
sesi — pola yang sama persis yang sudah ditambal untuk `partyId` di H3/§17),
atau permintaan API langsung. Risiko rendah, tapi murah untuk ditambal (satu
`findFirst` cek `BrandSupplier`/`owner_party_id` sebelum create/update) kapan
pun file itu disentuh lagi. Tidak butuh migrasi — perbaikan aplikasi murni.

---

## Catatan risiko rendah / dorman (bukan bug aktif)

### 3. `Category(kind, slug)` unik tanpa partial-index "hanya baris hidup"

Empat kolom lain (`Party.name`/`slug`, `Brand.name`/`slug`) sudah dapat
perbaikan ini di migrasi `20260818120000` (menutup B2 — nama yang pernah
dihapus terkunci selamanya). `Category` unik pada `(kind, slug)` tapi **tidak
punya `deleted_at` sama sekali** (cuma `is_active`), dan tidak dapat
perlakuan partial-unique yang sama.

Digrep seluruh `src/subapps/master-data` — **belum ada action delete atau
nonaktifkan `Category` di manapun**, jadi ini murni risiko dorman, bukan bug
yang bisa dipicu hari ini. Begitu ada fitur "hapus/nonaktifkan kategori",
ini persis bentuk kegagalan yang sudah pernah ditemukan dan ditambal untuk
Party/Brand — layak satu baris catatan supaya tidak perlu ditemukan ulang
dari error `23505` di produksi nanti.

### 4. `Category.path` — risiko yang sudah diketahui, sekadar dikonfirmasi masih berlaku

`AGENTS.md` §4 sudah eksplisit: `path` adalah denormalisasi manual, kalau
path sebuah kategori berubah maka path **seluruh keturunannya** harus ikut
diupdate manual, tidak ada jaminan dari DB. Dicek — ini tetap seperti yang
didokumentasikan, tidak ada drift baru ditemukan. Bukan temuan baru, sekadar
verifikasi bahwa dokumennya masih akurat.

### 5. `Sku.brand_id → Brand` pakai `onDelete: Restrict`, tapi belum pernah teruji

`Restrict` mencegah hard-delete `Brand` yang masih punya `Sku` — tapi `Brand`
pakai pola soft-delete (`deleted_at`), dan hasil grep `masterdata-actions.ts`
menunjukkan **belum ada action delete Brand sama sekali** (konsisten dengan
BR10 lama sebelum ditutup, soal delete SKU). Jadi constraint ini belum pernah
benar-benar dieksekusi.

Bukan salah — sekadar pengingat: kalau fitur "delete brand" nanti dibangun
mengikuti pola soft-delete tabel lain (set `deleted_at`, bukan `DELETE` SQL
sungguhan), `Restrict` ini **tidak akan pernah terpicu** — proteksi "jangan
hapus brand yang masih dipakai SKU aktif" harus ditulis eksplisit di
application code (mirip `assertPartyDeletable` yang sudah ada untuk Party),
bukan diasumsikan otomatis dari FK.

---

## Yang sudah diverifikasi SOLID (bukan sekadar diasumsikan dari dokumen)

- **Kelima invariant di `AGENTS.md` §2** — `SkuPrice_current_uniq` (dengan
  `COALESCE` untuk supplier `NULL`), `Sku_slug_nobrand_uniq`,
  `Sku_brand_code_uniq` / `Sku_code_nobrand_uniq`, `SkuCategory_primary_uniq`,
  `Party`/`Brand` `name`/`slug` live-unique — semuanya **ada** persis seperti
  didokumentasikan, dibaca langsung dari migration SQL asli, bukan dipercaya
  dari komentar `schema.prisma`.
- **Batas schema `master_data` ↔ `studioflow`** (`AGENTS.md` §8) dipatuhi
  konsisten: `WorkPriceProjectRef.project_id`, `SampleMovement.actor_id`
  memang kolom biasa (bukan FK), pola snapshot konsisten di
  `ProjectProductRequest`/`ProjectScheduleOption`.
- **Pilihan `Cascade`/`Restrict`/`SetNull`** di seluruh model `master_data`
  konsisten dengan maksudnya: baris riwayat/harga (`SkuPrice.supplier`,
  `WorkPrice.vendor`, `PartyContact.brand`, `SkuPrice.source_link`) pakai
  `SetNull` supaya riwayat selamat kalau relasinya dihapus; baris struktural
  anak (`PartyRole`, `PartyContact`, `PartyLink`, `BrandLink`,
  `BrandSupplier`, `BrandCategory`, `SkuCategory`, `SkuMedia`,
  `SampleMovement`, `WorkPriceProjectRef`) `Cascade` bersama induknya;
  `Category`/`Sku` (sebagai target) `Restrict` mencegah kehilangan referensi
  yang masih dipakai aktif.

---

## Tindak lanjut

Tidak ada perubahan skema yang dilakukan sesi ini (sesuai aturan "jangan ubah
skema Master Data tanpa tanya owner dulu"). Kedua temuan baru ditulis sebagai
item roadmap baru — lihat `roadmap.md` §
*"MASTER DATA — Audit skema 2026-08-19 (menunggu keputusan owner)"* — item
**SK1** dan **SK2**, menunggu keputusan owner sebelum Codex/Claude eksekusi
apa pun.
