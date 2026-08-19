# AUDIT MENYELURUH — MASTER DATA
**Tanggal:** 2026-08-18 · **Cakupan:** `src/subapps/master-data/**`, `src/app/masterdata/**`, `src/app/api/masterdata/**`, `prisma/schema.prisma` (schema `master_data`), `prisma/migrations/`, plus jalur tulis Master Data di `src/extensions/library/services/library-service.ts`.
**Sifat:** read-only. Tidak ada satu baris kode pun yang diubah oleh audit ini.

---

## 0. Ringkasan Eksekutif

Fondasi database Master Data v2 **kuat** — partial unique index di
`03_invariants.sql` (satu harga berlaku per SKU×supplier, satu kategori primer
per SKU, keunikan `code` per merek termasuk kasus tanpa merek) menutup persis
lubang-lubang yang biasanya dibiarkan ke aplikasi. Lapisan `sku-price-service.ts`
dan `sku-price-rules.ts` adalah bagian terbaik dari kode ini: satu jalur tulis,
judgement terpisah dan bisa dites.

Cacatnya **tidak ada di fondasi itu, melainkan di lapisan di atasnya** — dan
polanya konsisten: *disiplin yang sudah ditegakkan di satu tempat tidak
diterapkan di tempat kembarannya.*

| Severitas | Jumlah | Inti masalah |
|---|---|---|
| 🔴 Blocker | 7 | Drift schema, crash P2002 yang bisa direproduksi, harga 0 karangan masuk BQ, transaksi bersarang |
| 🟠 Tinggi | 9 | Audit trail bocor, status sample berbohong, dua jalur CRUD yang tidak sepakat, permission mati |
| 🟡 Sedang | 10 | IA/UX, halaman yatim, guard wajib tidak dipasang, load-everything |
| ⚪ Rendah | 4 | Dokumen acuan (`AGENTS.md`) mendeskripsikan model v1 yang sudah tidak ada |

**Tiga yang harus dikerjakan lebih dulu:** B1 (drift `SampleStatus`), B4 (harga
kerja bisa jadi 0), B2/B3 (crash P2002 pada nama & slug).

---

## 🔴 BLOCKER

### B1 — `SampleStatus` drift: migrasi jalan, `schema.prisma` tidak ikut
**Berkas:** `prisma/migrations/20260812120000_add_sample_status_sent_to_client/migration.sql` vs `prisma/schema.prisma:816-823`

Migrasi 12 Agustus menambahkan nilai enum ke database:

```sql
ALTER TYPE "master_data"."SampleStatus" ADD VALUE 'SENT_TO_CLIENT' BEFORE 'LOST';
```

Komentarnya menyebut alasannya sendiri: *"Ini bug runtime — query status ini
mengembalikan hasil kosong."* Tetapi `schema.prisma` **tidak pernah diperbarui**
— sampai hari ini enumnya masih `AVAILABLE / BORROWED / LOST / DISCARDED`, dan
`grep SENT_TO_CLIENT src/generated/prisma/index.d.ts` tidak menemukan apa pun.

Akibat berantai, semuanya masih hidup di produksi:

| Lokasi | Perilaku sekarang |
|---|---|
| `SampleLibraryClient.tsx:128` | `sentToClient` **selalu 0** |
| `SampleLibraryClient.tsx:341` | Filter "Di klien" **selalu kosong** |
| `SampleLibraryClient.tsx:668` | Pilihan "Di klien" tersimpan diam-diam sebagai `BORROWED` |
| `sample-actions.ts:87` `toV2SampleStatus` | `SENT_TO_CLIENT → BORROWED` |
| `sample-actions.ts:83` `toLegacySampleStatus` | **`LOST` dan `DISCARDED` juga terbaca "Dipinjam"** |
| `getSampleSummaryAction:190` | `borrowed = status !== "AVAILABLE"` → sample hilang dihitung sebagai dipinjam |

Sample yang **hilang** dan sample yang **ada di klien** tampil identik dengan
sample yang dipinjam staf. Itu bukan kosmetik: rak fisik adalah satu-satunya
sumber kebenaran tentang di mana benda itu berada.

> **Risiko tambahan:** `prisma migrate dev` berikutnya akan melihat nilai enum di
> DB yang tidak ada di schema dan mencoba menghapusnya — Postgres tidak bisa
> `DROP VALUE` dari enum. Migrasi akan gagal atau menuntut rewrite tabel.

---

### B2 — Soft-delete melawan `@unique` global → crash P2002 yang bisa direproduksi
**Berkas:** `quick-entry-actions.ts:98-140, 168-200, 240-265`, `pricing-actions.ts:370-380`, `party-actions.ts:166-172`

`Party.name`, `Party.slug`, `Brand.name`, `Brand.slug` semuanya `@unique`
**tanpa** `WHERE deleted_at IS NULL`. Tapi ketiga aksi quick-create menuliskan:

```ts
const existing = await tx.party.findUnique({ where: { name } });
if (existing && !existing.deleted_at) return { ...existing, reused: true };
// ⬇ jatuh ke sini kalau baris ADA tapi soft-deleted
const created = await tx.party.create({ data: { name, slug: slugify(name), ... } });
```

Baris soft-deleted **tidak** memicu `reused`, jalannya diteruskan ke `create`,
dan `create` menabrak index unik. Pengguna melihat pesan Prisma mentah, bukan
kalimat yang bisa ditindaklanjuti. **Nama supplier yang pernah dihapus tidak
akan pernah bisa dipakai lagi.**

Lebih buruk: create dan update **tidak sepakat arah kesalahannya**.

| Aksi | Cek konflik | Akibat |
|---|---|---|
| `createServiceVendorAction:370` | `findUnique({ name })` — termasuk yang terhapus | Menolak nama yang sebenarnya bebas ("sudah dipakai" padahal tidak) |
| `updateServiceVendorAction:404` | `findFirst({ name, deleted_at: null })` | Melewatkan bentrokan → **P2002 crash** |
| `createCompanyAction:166` | termasuk terhapus | sama seperti create vendor |
| `updateCompanyAction:229` | `deleted_at: null` | sama seperti update vendor |

Dua bug yang berlawanan pada tabel yang sama.

**Perbaikan:** jadikan index parsial (`WHERE deleted_at IS NULL`) — konsisten
dengan `Sku_brand_code_uniq` yang sudah melakukannya — atau perlakukan baris
soft-deleted sebagai "restore", bukan "create".

---

### B3 — `slug` ditulis tanpa pernah dicek keunikannya
**Berkas:** `party-actions.ts:176, 246`, `pricing-actions.ts:375, 417`, `quick-entry-actions.ts:127, 196, 258`

Setiap jalur tulis melakukan `slug: slugify(name.trim())`. `Party.slug` dan
`Brand.slug` `@unique`. Yang dicek konfliknya hanya **`name`**.

`slugify` sengaja lossy (`"PT Café Créme"` → `"pt-cafe-creme"`), jadi dua nama
yang *berbeda dan sah* bisa menghasilkan slug yang sama:

- `"PT Maju Jaya"` dan `"PT. Maju-Jaya"` → keduanya `pt-maju-jaya`
- `"Ace Hardware"` dan `"ACE HARDWARE"` → keduanya `ace-hardware`

Cek nama lolos, `create` menabrak `Party_slug_key`, dan yang dilihat pengguna
adalah error database.

Kasus kedua, lebih senyap: `slugify("美的")` → `""`. Slug kosong. Merek non-latin
**pertama** tersimpan; yang **kedua** menabrak unik dengan pesan yang tidak
menyebut merek sama sekali.

**Perbaikan:** satu helper `ensureUniqueSlug(tx, table, base)` yang menambahkan
sufiks `-2`, `-3`, dan fallback ke id pendek saat slug kosong.

---

### B4 — Harga kerja (`WorkPrice`) bisa jadi **0** dari field kosong — dan masuk ke BQ
**Berkas:** `pricing-actions.ts:75` (skema), `:508, :551, :875, :912` (penulisan)

```ts
price: z.union([z.number(), z.string()]).transform((v) => Number(v)),
```

Tidak ada `.refine()`. `Number("")` adalah **`0`**. `Number("abc")` adalah `NaN`.
Nilainya langsung dipakai:

```ts
price: Number(input.price),   // createServicePriceAction, createMaterialLaborPriceAction,
                              // updateServicePriceAction, updateMaterialLaborPriceAction
```

Ini **persis cacat yang basis kode ini sudah singkirkan** untuk `SkuPrice`.
`sku-price-rules.ts` menuliskan alasannya secara eksplisit:

> *"Aturan yang digantikan ini adalah `price_net: … ?? 0`, di empat tempat.
> `v_bq_material_rate` menghitung `bq_ready` dari kolom ini, jadi nol karangan
> tidak berhenti di Master Data — ia menjadi satu baris di dokumen komersial."*

Kalimat itu berlaku sama persis untuk `WorkPrice` → `v_bq_work_rate`, dan
`WorkPrice` **tidak pernah mendapat perlindungan yang sama**:

| | `SkuPrice` | `WorkPrice` |
|---|---|---|
| Kosong → tidak menulis baris | ✅ `resolvePrice()` | ❌ jadi `0` |
| Tolak harga negatif | ✅ `assertPriceSane()` | ❌ tidak ada |
| Tolak `NaN` | ✅ `Number.isFinite` | ❌ diteruskan ke Prisma |

Migrasi `20260811120000` bahkan **menghentikan dirinya sendiri** ketika menemukan
baris tanpa harga: *"Itu bukan harga, itu data yang tidak lengkap — dan
membiarkannya lolos sebagai 0 adalah persis cacat `price_net ?? 0` yang baru
saja dibuang."* Perlindungan itu ada di migrasi, tidak ada di form.

Table 3 dan Table 4 adalah **seluruh dataset upah dan material+upah** yang
dikonsumsi BQ.

---

### B5 — Lima jalur pembuatan SKU, lima invariant yang berbeda

| Jalur | `slug` dari | `base_unit` | Kategori primer | `recordAudit` |
|---|---|---|---|---|
| `library-service.ts:1072` (dialog utama) | nama | `priceUnit ?? "pcs"` | ✅ `upsertSkuCategories` | ✅ |
| `library-service.ts:1625` (terima request) | nama | `"pcs"` | ❌ **tidak ada** | ✅ |
| `sample-request-actions.ts:411` | nama, **fallback ke `code` mentah** | `"pcs"` | ❌ **tidak ada** | ❌ **tidak ada** |
| `quick-entry-actions.ts:345` | **`code`** | `""` **kosong** | ⚠️ dibuat tapi `is_primary=false` | ✅ |
| `excel-service.ts:403` | slug import | `"pcs"` | ✅ `ci === 0` | ❌ **tidak ada** |

Empat konsekuensi konkret:

1. **Quick-entry tidak bisa menemukan SKU yang sudah ada.** Dedupnya mencari
   `brand_id_slug` dengan `slugify(code)`; dialog utama menyimpan
   `slugify(name)`. Slug tidak pernah cocok → jatuh ke `create` → menabrak
   `Sku_brand_code_uniq`. Yang seharusnya `reused: true` menjadi crash.
2. **`base_unit: ""`** — kolomnya `NOT NULL`, jadi string kosong lolos. Unit
   kosong ini yang muncul di tabel material dan di BQ.
3. **Tiga jalur meninggalkan SKU tanpa kategori primer.** Index
   `SkuCategory_primary_uniq` menjamin *paling banyak* satu, bukan *tepat* satu.
   SKU tanpa primer hilang dari setiap tampilan yang digerakkan kategori
   Schedule.
4. **`sample-request-actions.ts:411` menulis `master_data.Sku` tanpa
   `recordAudit`** — melanggar kontrak `audit-service.ts` ("Setiap tulis ke tabel
   `master_data` WAJIB lewat `recordAudit`").

Satu detail tambahan di `sample-request-actions.ts:415`:
`slug: slugify(catalogProductName) || catalogSku`. Kalau nama kosong, slugnya
menjadi **kode mentah yang belum di-slug** — `"AB/12 X"` masuk ke kolom slug.

---

### B6 — Transaksi bersarang: tulisan lolos dari transaksi yang seharusnya membungkusnya
**Berkas:** `quick-entry-actions.ts:97, 167, 239, 330` · `pricing-actions.ts:369-470`

`createAction` default `useTransaction: true` (`action-wrapper.ts:76-80`) dan
sudah menjalankan handler di dalam `prisma.$transaction`. Tapi:

**(a) Quick-entry membuka transaksi kedua di dalamnya.**

```ts
export const quickCreatePartyAction = createAction(async ({ input, ctx }) => {
  ...
  return db.$transaction(async (tx) => { ... });   // ← tx BARU, koneksi BARU
});                                                // options tidak diisi → outer tx aktif
```

Transaksi dalam berjalan di koneksi berbeda dari yang dipegang transaksi luar.
Ia commit terlepas dari nasib yang luar, dan bisa menunggu lock yang dipegang
yang luar — deadlock yang hanya muncul saat beban naik.

**(b) CRUD vendor di `pricing-actions.ts` mengabaikan `tx` yang disediakan.**

```ts
const vendor = await db.party.create({ ... });          // ← db global, bukan tx
await recordAudit(db, { entity: "Party", ... });        // ← db global lagi
```

`recordAudit` mendokumentasikan kontraknya sendiri: *"Panggil ini DI DALAM `tx`
yang sama... Kalau transaksinya rollback, baris auditnya ikut rollback — dan itu
benar: audit yang selamat dari rollback adalah kebohongan."* Empat aksi
(`create` / `update` / `deleteServiceVendor`, dan pemanggil di sekitarnya)
melanggarnya, sambil membiarkan transaksi luar terbuka tanpa melakukan apa-apa.

---

### B7 — Pohon kategori: cabang re-parent **tidak pernah bisa dieksekusi**, dan `path` tidak menurun ke anak
**Berkas:** `category-tree-service.ts:86-140`

```ts
const existing = await tx.category.findFirst({
  where: { kind, OR: [{ slug }, { name, parent_id: parentId }] },
});
const needsParent = existing.parent_id === null && parentId !== null;
```

`needsParent` menuntut `parentId !== null`. Tapi kalau `parentId !== null`, maka
`parentPath !== null`, jadi `slug` menjadi `"induk-anak"` — dan baris root lama
bernama `"anak"` (slug `"anak"`) tidak cocok dengan cabang `{ slug }` **maupun**
cabang `{ name, parent_id: parentId }` (parent_id-nya null, bukan `parentId`).

**Konsekuensinya:** `needsParent` adalah dead code. Perilaku sebenarnya bukan
re-parent, melainkan **membuat kategori duplikat**. Setelah seseorang mengetik
"Plywood" polos lalu kemudian "Bahan Baku > Plywood", ada **dua** baris Plywood;
SKU lama menggantung di yang root, SKU baru di yang bercabang, dan dropdown
kategori menampilkan "Plywood" dua kali.

**Cacat kedua di fungsi yang sama:** saat `path` diperbarui, anak-anaknya tidak
ikut. `Category.path` ada persis supaya `LIKE 'bahan-baku/%'` menggantikan
recursive CTE — dan komentar di berkas itu sadar akan risikonya (*"ia bisa jadi
basi — jadi ia ditulis di sini, di satu-satunya fungsi yang boleh membuat
kategori"*). Menulisnya di satu tempat tidak cukup kalau perubahan pada induk
tidak diturunkan.

---

## 🟠 TINGGI

### H1 — Kolom "Update" membaca tabel audit yang **tidak lagi ditulis**
`masterdata-actions.ts:100-140` menanyakan `prisma.auditLog` (schema
`studioflow`) dengan `entity_type IN ("Sku", "ProductCatalog")`. Tapi seluruh
Master Data v2 menulis lewat `recordAudit` → `prisma.masterDataAudit` (schema
`master_data`). Dua tabel berbeda. Provenance yang benar-benar ada tidak akan
pernah ditemukan; kolomnya menampilkan strip selamanya — persis kegagalan yang
komentar panjang di kepala berkas itu ditulis untuk mencegah.

### H2 — `sampleState()` menyebut sample hilang sebagai "tersedia"
`material-view-service.ts:160-172`

```ts
if (samples.some((s) => s.status === "BORROWED")) return "BORROWED";
return samples.length > 0 ? "AVAILABLE" : "UNAVAILABLE";
```

`LOST` dan `DISCARDED` masuk ke cabang kedua. `sampleCount` juga menjumlahkan
`quantity` mereka. Kontrak Master Data §5 menuntut *"Tidak tersedia diturunkan
dari nol sample hidup"* — sample yang hilang bukan sample hidup.
Komentar di atasnya (*"v2's SampleStatus has no SENT_TO_CLIENT"*) sudah salah
sejak migrasi 12 Agustus (lihat B1).

### H3 — Dua jalur hapus Party dengan penjaga yang berbeda
| Aksi | Memblokir kalau… | Tidak memeriksa |
|---|---|---|
| `deleteCompanyAction` (party-actions:290) | punya brand | `WorkPrice.vendor_party_id`, `SkuPrice.supplier_party_id`, `BrandSupplier` |
| `deleteServiceVendorAction` (pricing-actions:445) | punya work price | brand, `SkuPrice`, `BrandSupplier` |

Menghapus lewat layar Supplier melewati penjaga harga; menghapus lewat layar
Pricing melewati penjaga brand. **Tidak satu pun** memeriksa `SkuPrice`.
Karena ini soft-delete, FK `onDelete: SetNull` tidak ikut jalan — referensinya
tetap menunjuk baris hantu.

Efek yang terlihat: `getBrandSkusAction` (masterdata-actions:270) menyertakan
`supplier` tanpa filter `deleted_at`, jadi supplier terhapus **tetap muncul** di
tabel SKU, sementara `getSupplierOptionsAction` (yang memfilter) tidak lagi
menawarkannya di picker. Tabel dan form tidak sepakat siapa yang ada.

### H4 — Picker "Vendor" menampilkan **semua** Party
`getServiceVendorsAction` (pricing-actions:355):

```ts
const rows = await db.party.findMany({ where: { deleted_at: null } });  // tanpa filter role
```

`AGENTS.md §Master Data Material Contract 0` menetapkan **Vendor = penyedia jasa**
(tukang, aplikator, workshop). Picker ini menampilkan pemilik merek, retail, dan
distributor sebagai kandidat vendor kerja. Bandingkan dengan
`getSupplierOptionsAction` tepat di bawahnya, yang **memang** memfilter
`roles: { some: { role: { in: PRICE_SOURCE_ROLES } } }` — polanya sudah ada,
hanya tidak dipakai di sini.

### H5 — `MASTERDATA_PRICE_MANAGE` diberikan ke role tapi **tidak pernah diperiksa**

| Permission | Pemakaian di luar `src/core/rbac/` |
|---|---|
| `MASTERDATA_VENDOR_MANAGE` | 27 |
| `MASTERDATA_VIEW` | 24 |
| `MASTERDATA_SKU_MANAGE` | 3 |
| `MASTERDATA_PRICE_VIEW` | 2 |
| **`MASTERDATA_PRICE_MANAGE`** | **0** |
| **`MASTERDATA_OFFERING_MANAGE`** | **0** |

Setiap mutasi harga — `SkuPrice`, `WorkPrice` LABOR_ONLY, `WorkPrice`
MATERIAL_LABOR — bergantung pada `MASTERDATA_VENDOR_MANAGE`. Artinya:
memberi seseorang hak mengelola supplier **otomatis** memberinya hak menulis
ulang seluruh harga, dan mencabut `MASTERDATA_PRICE_MANAGE` tidak melakukan
apa-apa. Model izinnya menggambarkan pemisahan yang tidak ditegakkan.
`MASTERDATA_OFFERING_MANAGE` mati total (Offering sudah dihapus 31 Jul) dan
sebaiknya dicabut dari enum.

### H6 — Tulisan `master_data` tanpa audit
Melanggar kontrak `audit-service.ts` secara langsung:

- `createPartyContactAction` / `updatePartyContactAction` / `deletePartyContactAction` (party-actions:390-470) — **tidak ada** `recordAudit`
- `sample-request-actions.ts:411` `tx.sku.create` — hanya `insertAuditLog` (tabel studioflow), bukan `recordAudit`
- `excel-service.ts:403, 423` — impor massal, **tidak ada audit sama sekali**

### H7 — `WorkPrice` dihapus keras padahal punya `deleted_at`
`deleteServicePriceAction:583` dan `deleteMaterialLaborPriceAction:940`:

```ts
await tx.workPrice.delete({ where: { id: input.id } });   // DELETE, bukan soft-delete
```

Kolom `deleted_at` ada, dan setiap pembacaan memfilter `deleted_at: null` —
infrastruktur soft-delete-nya lengkap dan tidak dipakai. `WorkPriceProjectRef`
(`onDelete: Cascade`) ikut terhapus, jadi **riwayat proyek mana saja yang pernah
memakai tarif itu hilang bersamanya**. Bandingkan dengan
`deleteMaterialPriceAction` tepat di atasnya, yang dokumentasinya menjelaskan
dengan tepat mengapa itu salah: *"'Delete' menutup penawaran; ia tidak
menghapusnya."*

### H8 — Endpoint harga tidak memfilter `kind` maupun `deleted_at`
`updateServicePriceAction` / `deleteServicePriceAction` mencari
`workPrice.findUnique({ id })` tanpa `kind: "LABOR_ONLY"`. Id dari tab
"Material + Upah" yang dikirim ke endpoint tab "Upah" akan diproses — mengedit
lintas jenis, atau menghapus baris yang layarnya tidak menampilkan. Update juga
tidak menolak baris yang sudah `deleted_at`.

### H9 — Quick-entry SKU bisa melampirkan kategori **WORK** ke sebuah SKU
`quick-entry-actions.ts:360`:

```ts
const cat = await tx.category.findFirst({
  where: { name: { equals: input.category.trim(), mode: "insensitive" } },  // tanpa kind
});
```

`Category` unik pada `(kind, slug)`, jadi "Finishing" ada dua kali — satu
`PRODUCT`, satu `WORK` (keduanya di `PRODUCT_LEVEL1` dan `WORK_LEVEL1`).
`findFirst` mengambil mana saja yang lebih dulu. Kategori tarif kerja menempel
ke material.

---

## 🟡 SEDANG — UI/UX, IA, dan skala

### M1 — Nav bernama "Prices" tidak menuju halaman harga
`MasterDataNav.tsx:56-60`:

```ts
{ href: "/masterdata/materials", label: "Prices" },   // ← katalog material
{ href: "/masterdata/suppliers", label: "Supplier" },
{ href: "/masterdata/samples",   label: "Sample" },
```

Editor harga yang sebenarnya — `/masterdata/prices`, tiga tab, seluruh Table 2/3/4
— **tidak ada di nav**. Komentarnya mengakui: *"accessible via direct URL."*
`/masterdata/settings` juga yatim. Jadi ada dua hal bernama "Prices", dan yang
berlabel Prices bukan halaman prices.

### M2 — Guard "pintu keluar" yang **WAJIB** tidak dipasang di lima layar
`AGENTS.md §Edit-First Protocol` butir 3: *"WAJIB: pengaman di pintu keluar.
Setiap dialog yang bisa disunting HARUS memakai `useUnsavedChangesGuard` +
`<UnsavedChangesPrompt>`... Ini bukan hiasan — ia satu-satunya pengganti
perlindungan yang dulu diberikan tombol Modify."*

| Komponen | `<Dialog` | field input | guard |
|---|---|---|---|
| `MasterDataProductDialog` | ✔ | ✔ | ✅ |
| `MasterDataBrandDialog` | ✔ | ✔ | ✅ |
| `PartyDialog` | ✔ | ✔ | ✅ |
| `PricingClient` | ✔ | ✔ | ✅ |
| **`SampleLibraryClient`** | 10 | 19 | ❌ |
| **`SampleRequestDialog`** | 4 | 18 | ❌ |
| **`SupplierClient`** | 5 | 7 | ❌ |
| **`SupplierDetailClient`** | 5 | 2 | ❌ |
| **`BrandDetailClient`** | 4 | 4 | ❌ |

Tombol "Modify" sudah dicabut di seluruh Master Data — tapi penggantinya baru
terpasang di empat dari sembilan layar. Lima sisanya sekarang **tidak punya
perlindungan sama sekali**: klik di luar dialog membuang ketikan tanpa bertanya.

### M3 — Halaman yang memuat seluruh tabel, lalu memfilter di browser
`/masterdata/prices/page.tsx` (`force-dynamic`, tanpa cache) menjalankan
**delapan** aksi tanpa paginasi sekaligus:

- `getMaterialPricesAction` — **semua** `SkuPrice` berlaku
- `getServiceVendorsAction` — **semua** Party
- `getVendorsAction` — **semua** Brand
- `getSampleSkuOptionsAction` — **seluruh tabel SKU**
- `getProjectOptionsAction` — semua Project
- ditambah 3 lagi

Lalu `PricingClient.tsx:586, 946, 1127` mencari dan memfilter semuanya di
browser dengan `rows.filter(...)`.

Ini persis pola yang `material-view-service.ts` dokumentasikan sudah dibuang:
*"Filtering dan sorting sekarang terjadi di Postgres, jadi server tidak lagi
memuat seluruh katalog ke memori untuk merender 50 baris."* Halaman harga tidak
ikut diperbaiki. `/masterdata/materials` juga masih memuat `getCompaniesAction`
(semua Party + kontak + link + role) dan `getVendorsAction` **di sebelah**
tabelnya yang sudah rapi dipaginasi.

### M4 — `getPartyBrandsAction` memuat semua SKU untuk menghitung
`masterdata-actions.ts:400-430` mengambil setiap `Sku` dari setiap brand yang
dipasok, hanya untuk membangun map `sku_id → brand_id`. Bisa jadi satu
`groupBy` di SQL.

### M5 — Bahasa campur di satu permukaan
Nav Inggris ("Prices", "Supplier", "Sample"), badan halaman Indonesia ("Di
klien", "Tersedia", "Dipinjam"), pesan error campur dalam satu berkas:
`"That vendor name is already taken"` bersebelahan dengan `"Vendor ini masih
dipakai di N harga."` Dropdown status: `"All statuses"` / `"Tersedia"` /
`"Dipinjam"`.

### M6 — Pesan error internal sampai ke browser
`action-wrapper.ts:93-95`:

```ts
const message = error instanceof Error ? error.message : "Internal Server Error";
return { success: false, error: message };
```

Setiap error non-`ActionError` — termasuk pelanggaran constraint Prisma dengan
nama index, nama kolom, dan potongan query — dikembalikan apa adanya ke klien.
Karena B2/B3 memang menghasilkan P2002, ini bukan skenario teoretis.

### M7 — Dropdown kategori tanpa filter `kind` dan tanpa dedup
`material-view-service.ts:280` mengambil `Category` yang punya SKU tanpa
memfilter `kind`. Digabung dengan B7 (kategori duplikat root + bercabang),
dropdown menampilkan nama yang sama dua atau tiga kali.

### M8 — Batas ukuran impor Excel yang tidak ada
`api/masterdata/excel/import/route.ts:9-10`:

```ts
// Max 20 MB
export const config = { api: { bodyParser: false } };
```

`config.api` adalah opsi **Pages Router** — tidak berpengaruh apa pun di App
Router. Tidak ada batas ukuran yang benar-benar berlaku, dan komentarnya
menjanjikan batas yang tidak ada. Di dalamnya, `importMasterDataExcel` menulis
per baris dengan `prisma` global tanpa transaksi → impor yang gagal di tengah
meninggalkan katalog setengah jadi tanpa jalan mundur.

### M9 — `generateWorkPriceCode` bentrok saat bersamaan
`pricing-actions.ts:140-165` membaca kode tertinggi lalu `+1`. Dua transaksi
bersamaan tidak melihat baris satu sama lain yang belum commit, jadi keduanya
memilih nomor yang sama; `findUnique` retry di dalam transaksi yang sama tidak
menolongnya. Selain itu `orderBy: { code: "desc" }` adalah urutan leksikal —
setelah `WP-2026-9999`, `WP-2026-10000` berurutan **sebelum** `WP-2026-9999`.

### M10 — State UI mati
`material-view-service.ts:245`:
`archived: meta.offering_active_status === "ARCHIVED"` membaca
`catalog_metadata` peninggalan v1. Offering dihapus 31 Jul 2026 — nilainya
selalu `false`. Kolom/badge "archived" tidak pernah menyala.

---

## ⚪ RENDAH — dokumen acuan sudah tidak sesuai kode

### D1 — `AGENTS.md §Master Data Material Contract` mendeskripsikan model v1
Ini yang paling penting dari empat, karena `AGENTS.md` adalah berkas yang setiap
agent diperintahkan patuhi lebih dulu. Isinya masih:

| Disebut `AGENTS.md` | Kenyataan setelah rebaseline v2 (10 Agu) |
|---|---|
| `model Material`, `catalog_brand`, `catalog_sku` | `model Sku` (`code`, `name`, `brand_id`) |
| unik `(vendor_id, catalog_brand, catalog_sku)` | `Sku_brand_code_uniq` partial index |
| `MaterialCandidate`, `SampleCandidate` | **tidak ada** di `schema.prisma` |
| `/masterdata/curation` | **tidak ada** direktori itu |
| `master_data.ServiceVendor` | dilebur ke `Party` + `PartyRole` |
| butir 4: "harga sebelum diskon, sesudah diskon, dan satuan" | pasangan itu dihapus 14 Agu — satu harga |
| butir 8/9: status `PENDING` / `REJECTED` untuk Material | `SkuStatus` = `DRAFT` / `ACTIVE` / `DISCONTINUED` |

Agent berikutnya yang membaca kontrak ini akan mencari model yang tidak ada dan
menegakkan aturan yang sudah dicabut.

### D2 — `/masterdata/prices/page.tsx:4-7`
> *"Material + labour → WorkPrice with material_price set / Labour only →
> WorkPrice with material_price NULL"*

Kedua kolom itu dihapus migrasi `20260811120000`; pembedanya sekarang kolom
`kind`, yang justru dibuat agar tidak perlu disimpulkan.

### D3 — `material-view-service.ts:166`
> *"v2's SampleStatus has no SENT_TO_CLIENT value — that branch is now
> unreachable"*

Salah sejak migrasi `20260812120000` (lihat B1).

### D4 — `CHANGELOG-CODEX.md` tidak ada
`AGENTS.md §Agent Handoff Log` mewajibkan setiap agent membaca dan memperbarui
`CHANGELOG-CODEX.md`. Berkas itu tidak ada di root repo. Aturan yang tidak bisa
dipatuhi mengikis wibawa aturan di sekitarnya.

---

## Yang sudah benar dan sebaiknya dijaga

Supaya perbaikan tidak merusak yang berhasil:

- **`03_invariants.sql`** — `SkuPrice_current_uniq` dengan `COALESCE` untuk NULL
  supplier adalah tepat, dan alasannya ditulis di tempat yang tepat.
- **`sku-price-service.ts` / `sku-price-rules.ts`** — satu jalur tulis, judgement
  murni dan bisa dites, demosi yang di-scope per supplier. **Ini modelnya**;
  `WorkPrice` seharusnya mendapat perlakuan yang sama (B4).
- **`slug.ts`** — satu generator kanonik menggantikan tujuh implementasi.
- **Migrasi `20260811120000`** yang `RAISE EXCEPTION` alih-alih menambal diam-diam.
- **`getBrandView`** — agregasi dan urutan di SQL, bukan JS di atas halaman yang
  sudah dipotong.
- **Keputusan menolak menebak** (`productParentFor`, kolom `qty` yang sengaja
  tidak ditafsirkan, `MaterialCandidate` yang tidak mengarang SKU).

---

## Urutan pengerjaan yang disarankan

**Gelombang 1 — hentikan kerusakan data (1–2 hari)**
1. B1 — samakan `SampleStatus` di `schema.prisma`, `prisma generate`, perbaiki `toLegacySampleStatus` agar `LOST`/`DISCARDED` tidak dibaca "Dipinjam".
2. B4 — `resolvePrice` + `assertPriceSane` untuk `WorkPrice`, `.refine()` di Zod.
3. H2 — `sampleState` dan `sampleCount` hanya menghitung sample hidup.

**Gelombang 2 — hentikan crash (2–3 hari)**
4. B2 — index parsial `WHERE deleted_at IS NULL` untuk `Party`/`Brand` name+slug, samakan cek create/update.
5. B3 — `ensureUniqueSlug` di semua jalur tulis.
6. B5 — satu `createSkuCore(tx, …)` yang dipakai kelima jalur.
7. M6 — jangan kembalikan `error.message` mentah.

**Gelombang 3 — konsistensi (3–5 hari)**
8. B6 — buang `db.$transaction` bersarang; ganti `db` → `tx` di CRUD vendor.
9. B7 — perbaiki lookup kategori, turunkan `path` ke anak, backfill duplikat yang sudah terlanjur.
10. H1 — arahkan kolom Update ke `MasterDataAudit`.
11. H3/H4/H7/H8/H9 — satukan penjaga hapus, filter role, soft-delete `WorkPrice`, filter `kind`.
12. H5/H6 — tegakkan `MASTERDATA_PRICE_MANAGE`, cabut `MASTERDATA_OFFERING_MANAGE`, lengkapi audit.

**Gelombang 4 — UX & skala (3–5 hari)**
13. M2 — pasang `useUnsavedChangesGuard` di lima layar tersisa.
14. M1 — masukkan `/masterdata/prices` ke nav, ganti label "Prices" → "Material".
15. M3/M4 — paginasi + pencarian server-side di halaman harga.
16. M5/M7/M8/M9/M10.

**Gelombang 5 — dokumen (1 hari)**
17. D1 — tulis ulang `§Master Data Material Contract` terhadap v2. Ini yang paling murah dan mencegah agent berikutnya menegakkan aturan yang sudah mati.
18. D2/D3/D4.

---

*Audit ini read-only. Tidak ada perbaikan yang diterapkan — setiap butir di atas
menunggu keputusan owner sebelum dikerjakan.*
