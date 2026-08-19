# Implementation Plan — Master Data Redesign (PRD 2026-08-12)

**Status:** ✅ **Keputusan owner B-Q1…B-Q7 diterima 2026-08-12 — rencana terkunci, eksekusi boleh mulai.**
Revisi 2 (2026-08-12): keputusan owner dimasukkan (§F), Fase 0.b selesai (§H), protokol pra-migrasi ditambahkan (§I).
**Kode aplikasi yang berubah sampai saat ini: nol.**
**Sumber permintaan:** `docs/PRD_MASTER_DATA_REDESIGN.md` §24 ("Required First Response From Coding Agent")
**Bukti yang dibaca:** `docs/design database masterdata.xlsx` (Sheet1 Table 1–4, Sheet2 rencana halaman), `prisma/schema.prisma` (18 model + 12 enum `master_data`), `prisma/migrations/` (19 migrasi), seluruh `src/subapps/master-data/` (44 berkas, 12.138 baris), `src/app/masterdata/`, `src/app/api/masterdata/excel/`, `roadmap.md`, `CHANGELOG.md`, `docs/PENYIMPANGAN-DARI-EXCEL.md`, `docs/TANYA-SEBELUM-EKSEKUSI.md`.
**Tanggal verifikasi terhadap repo:** 2026-08-12.

> **Aturan yang dipegang dokumen ini:** setiap baris "sudah ada" menyebut berkas
> dan barisnya. Setiap baris "belum ada" berarti saya sudah mencarinya dan tidak
> menemukannya, bukan berarti saya belum mencari. Yang tidak bisa saya pastikan
> tanpa database hidup ditandai **⛔ butuh DB**.

---

## 0. Temuan utama sebelum apa pun dibaca lebih jauh

PRD §16 menyebut enam "known project concerns". **Tiga di antaranya sudah tidak
berlaku** karena dikerjakan 2026-08-11, setelah PRD ditulis. Menjalankan PRD apa
adanya berarti mengerjakan ulang pekerjaan yang sudah selesai.

| PRD §16 menyebut | Keadaan sebenarnya 2026-08-12 | Bukti |
|---|---|---|
| Prisma ↔ migration drift `WorkPrice` | **Sudah beres.** `material_price`+`labor_price`+`total_price` sudah dilebur jadi satu `price` + `kind`, view `v_bq_work_rate` sudah didefinisikan ulang. | `prisma/migrations/20260811120000_workprice_single_price_and_qty/`, `20260811120100_redefine_v_bq_work_rate/`, `schema.prisma:565-628` |
| `extensions/library` rusak/menggantung ke model StudioFlow | **Sebagian usang.** 13 berkas `src/extensions/library/` ada dan `library-service.ts` tidak menyentuh model `studioflow` mana pun. Yang tersisa: `material-view-service.ts` *sengaja* mendelegasikan ke `LibraryService.getAllProducts` — dependensi lintas-subapp yang disengaja, bukan kerusakan. | `src/subapps/master-data/services/material-view-service.ts:1-45`, `src/extensions/library/services/library-service.ts` |
| Excel terbatas SKU + SkuPrice | **Masih benar.** Hanya 2 sheet: `SKU` dan `Prices`. | `src/subapps/master-data/services/excel-service.ts:92,150` |
| `MasterDataAudit` tidak ditulis | **Masih benar, dan ini gap paling serius.** Nol pemanggilan `prisma.masterDataAudit.create` di seluruh `src/`. Model ada, tabel ada, isinya tidak akan pernah bertambah. | grep `masterDataAudit` → hanya `src/generated/prisma/index.d.ts` |
| RBAC belum ditegakkan | **Sebagian beres.** `quick-entry-actions.ts` memakai `hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)`. Cakupan penuh di 6 berkas actions belum diaudit baris-per-baris. | `src/subapps/master-data/actions/quick-entry-actions.ts:104` |
| Slugifikasi tidak konsisten | Belum diverifikasi pada level ini. Masuk Fase 0.b. | — |

**Konsekuensi untuk urutan kerja:** Fase 1 PRD ("Priority 1: WorkPrice
schema/migration consistency") turun jadi *verifikasi 15 menit*, dan slot
prioritas teratas diambil oleh **audit trail** — yang oleh PRD §15 sendiri
disebut syarat "production-safe".

Dan satu temuan baru yang tidak ada di PRD maupun roadmap:

> **🔺 Temuan baru — arah List Price / Net Price terbalik.**
> Excel Sheet2 baris 11–12 menulis: *"List Price (mandatory)"*, *"Net Price
> (optional)"*. Schema menulis kebalikannya: `price_list Decimal?` (opsional),
> `price_net Decimal` (**wajib**). Artinya staf yang cuma tahu harga katalog dan
> belum tahu harga nettnya **tidak bisa menyimpan barisnya sama sekali** —
> persis dead end yang PRD §6.2 larang. Lihat §E.3 dan pertanyaan **B-Q4**.

---

# A. Business Model Map

Kardinalitas dibaca dari `schema.prisma`, bukan dari niat.

```
Party (perusahaan/orang)                              schema.prisma:244
 ├─1..N─> PartyRole      (enum PartyRoleKind, unique [party_id, role])   :281
 ├─1..N─> PartyContact   (brand_id NULLABLE → kontak khusus merek)       :294
 ├─1..N─> PartyLink      (LinkKind: WEBSITE/IG/DRIVE/CATALOG/…)          :318
 ├─1..N─> Brand          via Brand.owner_party_id  (relasi "BrandOwner") :341
 ├─N..M─> Brand          via BrandSupplier         ("di mana beli merek")  :383
 ├─1..N─> SkuPrice       via supplier_party_id     ("harga dari siapa")    :532
 └─1..N─> WorkPrice      via vendor_party_id       ("jasa dari siapa")     :574

Brand                                                                     :335
 ├─1..N─> Sku            (Sku.brand_id NULLABLE — "plywood 9mm" sah tanpa merek) :476
 ├─N..M─> Category       via BrandCategory (kind=PRODUCT)                 :429
 ├─1..N─> BrandLink                                                       :364
 ├─N..M─> Party          via BrandSupplier                                :383
 └─1..N─> PartyContact   (scoped_contacts — kontak sales khusus merek ini) :357

Sku                                                                       :465
 ├─N..M─> Category       via SkuCategory (is_primary)                     :447
 ├─1..N─> SkuMedia                                                        :511
 ├─1..N─> SkuPrice       (satu SKU, banyak supplier, banyak periode)      :527
 └─1..N─> Sample         (rak/box)                                        :649

WorkPrice                                                                 :565
 ├─N..1─> Category       (kind=WORK, wajib)                               :571
 ├─N..1─> Party          (vendor, NULLABLE)                               :574
 ├─1..N─> WorkPriceProjectRef  (project_id = kolom biasa, BUKAN FK)       :630
 └─ kind: MATERIAL_LABOR (Table 3) | LABOR_ONLY (Table 4)                 :603

Category (pohon)                                                          :399
 └─ kind: PRODUCT | WORK, self-relation parent/children, unique [kind, slug]

MasterDataAudit  (entity, entity_id, action, actor, changes Json)          :700
 └─ ⚠️ TIDAK ADA PENULIS. Lihat §0.
```

**Dua relasi yang PRD §2.3 larang keras untuk dilebur, dan memang terpisah di
schema:**

- `BrandSupplier(brand_id, party_id)` — "di mana merek ini bisa dibeli". Tidak
  ada `sku_id`. ✅ sesuai PRD §2.2.
- `SkuPrice(sku_id, supplier_party_id, price)` — "berapa harga SKU ini dari
  supplier itu". ✅ sesuai PRD §2.3.

**Yang PRD §22 larang, dan memang tidak ada di schema:** `PartyCategory`,
`BrandSupplier.sku_id`, `WorkPrice → Sku`, `is_complete`. ✅ empat-empatnya bersih.

---

# B. Excel Mapping — Table 1–4 → entitas/field

## Table 1 — Material / Supplier List

| Kolom Excel | Target | Status | Catatan |
|---|---|---|---|
| A `Company` | `Party.legal_name` + `Party.name` | ✅ ada | X6: Company dan Brand jadi dua entitas terpisah (`Party` ⟶ `Brand.owner_party_id`), bukan satu. Sudah disetujui. |
| B `Brand` | `Brand.name` | ✅ ada | |
| C `Product Brand` | `Brand.name` (sub-merek → Brand tersendiri) | ✅ ada | "TACO - HPL" = Brand, owner-nya PT Tangkas Cipta Optimal. |
| D `Category` (hashtag/multi) | `BrandCategory` → `Category(kind=PRODUCT)` | ✅ ada | Multi-kategori terjaga lewat tabel N..M. X7: tag datar jadi pohon. |
| E `Google Drive URL` | `BrandLink(kind=DRIVE)` | ✅ ada | |
| F `Website` | `BrandLink(kind=WEBSITE)` / `PartyLink` | ✅ ada | |
| G `Socmed (IG/FB/…)` | `BrandLink` / `PartyLink` per platform | ✅ ada | X8: JSON jadi baris tabel. |
| H `Sales Name` | `PartyContact.person_name` | ✅ ada | |
| I `Contact` | `PartyContact.phone` | ✅ ada | |
| J `Supplier's Company` | `Party` + `BrandSupplier` | ✅ ada | |
| K `Company Categories` | `PartyRole.role` (enum 6 nilai) | ⚠️ **verifikasi selesai — lihat di bawah** | |
| L `Update by` | `*.updated_by_name` | ✅ ada | |
| M `Update Time` | `*.updated_at` | ✅ ada | |
| N `SKU Product Relational` | `Sku.code` + `Sku.name` | ✅ ada | `code` NULLABLE (Q7). |

### Penyelesaian baris "Must verify" pada Anti-Regression Matrix PRD §18

PRD menandai `Company Categories` sebagai **"Must verify"** dan §23.3 melarang
mengubah maknanya tanpa persetujuan. Hasil verifikasi:

Nilai Excel: **Supplier, Subcon, Vendor, Retail Store, Manufacture**.
Enum `PartyRoleKind` (`schema.prisma:726`): `MANUFACTURER, DISTRIBUTOR,
SUPPLIER, RETAIL, SUBCON, SERVICE_VENDOR`.

| Excel | Enum | Terwakili? |
|---|---|---|
| Supplier | `SUPPLIER` | ✅ |
| Subcon | `SUBCON` | ✅ |
| Vendor | `SERVICE_VENDOR` | ✅ |
| Retail Store | `RETAIL` | ✅ |
| Manufacture | `MANUFACTURER` | ✅ |
| — | `DISTRIBUTOR` | tambahan, tidak menghapus apa pun |

**Kesimpulan: tidak ada nilai Excel yang hilang. Tidak perlu perubahan schema.**
Rekomendasi: **tandai baris ini "Verified — no change"** dan cabut statusnya
sebagai penghalang eksekusi (PRD §18 penutup).

Satu hal yang tetap perlu keputusan owner: PRD §3.2 meminta *"Role toward the
office"* (Supplier/Subcon/Service Vendor) dan *"Business nature"*
(Manufacturer/Retailer/Distributor) **dibedakan** "kecuali model yang ada
membuktikan keduanya memang sengaja sama". Enum sekarang **mencampur keduanya
dalam satu daftar**. Excel juga mencampurnya dalam satu kolom `Company
Categories`. Jadi model yang ada *memang* cerminan Excel. Memisahkannya jadi dua
field menambah satu keputusan yang harus diisi staf untuk setiap perusahaan,
tanpa ada laporan yang meminta pemisahan itu. **Rekomendasi: jangan pisahkan.**
Ini pertanyaan **B-Q1**.

## Table 2 — Database Harga Material

| Kolom Excel | Target | Status |
|---|---|---|
| `SKU` | `Sku.code` / `Sku.name` | ✅ |
| `Material` | `SkuCategory` → `Category` | ✅ (X10: Material+Category → pohon yang sama) |
| `Category` | `SkuCategory` → `Category` | ✅ |
| `Brand` | `Sku.brand_id` (nullable) | ✅ |
| `Specification 1` / `Specification 2` | `Sku.spec` (Json) | ✅ |
| `Dimensions` | `Sku.dim_length/width/height/unit/display` | ✅ (X11) |
| `Qty` | `SkuPrice.qty` — **disimpan, dilarang masuk perhitungan** | ✅ (X12/Q12) |
| `Unit` | `SkuPrice.unit` | ✅ |
| `Price` | `SkuPrice.price_net` (+ `price_list`) | ⚠️ arah wajib/opsional terbalik — §E.3 |
| `Supplied by` | `SkuPrice.supplier_party_id` → `Party` | ✅ |
| `Notes` | `SkuPrice.notes` | ✅ |
| `Update by` / `Update Time` | `updated_by_name` / `updated_at` | ✅ |

## Table 3 & Table 4 — Harga Material+Upah / Harga Upah

Kolomnya identik; pembedanya `WorkPrice.kind`.

| Kolom Excel | Target | Status |
|---|---|---|
| `Vendor Category` | `Category(kind=WORK)` induk | ✅ (X13) |
| `Category` | `Category(kind=WORK)` anak | ✅ |
| `Vendor Name` | `WorkPrice.vendor_party_id` → `Party` | ✅ |
| `Specification 1/2` | `WorkPrice.spec` (Json) | ✅ |
| `Dimensions` | `WorkPrice.dim_display` | ✅ |
| `Qty (need curations)` | `WorkPrice.qty` — disimpan, dilarang dihitung | ✅ |
| `Unit` | `WorkPrice.unit` | ✅ |
| `Price` | `WorkPrice.price` (SATU kolom) | ✅ sejak E8 |
| `Project Reference` | `WorkPriceProjectRef` | ✅ (X14) |
| `Notes` | `WorkPrice.notes` / `scope_note` | ✅ |
| Table 3 vs Table 4 | `WorkPrice.kind = MATERIAL_LABOR \| LABOR_ONLY` | ✅ |

**Jawaban untuk audit PRD §8 soal `LABOR_ONLY`:** enum-nya sudah *bukan*
tebakan sejak E8 — `kind` dinyatakan, bukan disimpulkan dari `material_price !=
null`. Yang tersisa murni soal kosakata layar: label tab sekarang "Labour
Prices", sementara Table 4 berisi penawaran vendor/fabrikasi yang tidak selalu
"upah". **Ini perubahan kelas A (UI only)** — ganti label, jangan ganti enum
(PRD §8: *"Do not rename schema just for UI wording"*).

## Sheet2 — rencana halaman (permintaan owner di dalam workbook)

| Permintaan Sheet2 | Status di repo | Aksi |
|---|---|---|
| `BQ code - remove` (tab Material+Upah & Upah) | ❌ `WorkPrice.code` masih `String @unique` **wajib**, form masih minta (`pricing-actions.ts:66` `z.string().min(1,"Code is required")`) | **B-Q2** — otomatiskan atau buang |
| `Unit dropdown` | ❌ tidak ada; semua unit `<Input>` teks bebas | Fase 4 |
| `remove valid from` | ✅ sudah — `PricingClient.tsx:727` | — |
| `List Price (mandatory)` / `Net Price (optional)` | ❌ **terbalik** di schema | **B-Q4** |
| `Specification bisa ditambah on the go` | ✅ ada tombol tambah spec | — |
| `Category dibuat jadi category dan subcategory` | ✅ pohon `Category` | — |
| `Qty (optional; default = 1)` | ⚠️ nullable, default DB tidak 1 | Fase 4 (UI default) |
| `Project Reference dari tabel project BQ` | ✅ `WorkPriceProjectRef.project_id` kolom biasa | — |
| Supplier: *"Add Vendor bisa dipisah material/jasa"* | ⚠️ dipisah jadi **tab eksklusif** | Bentrok PRD §3.1 — §D.3 |
| `quick entry` di semua halaman | ⚠️ 3 dari sekian: party, brand, work-vendor | Fase 4 |
| `searchable edit` di semua halaman | ✅ `CreatableSearch` (utility bersama) | — |

---

# C. Anti-Regression Matrix (PRD §18, diisi dengan bukti)

| Konsep Excel | Target UX | Data terjaga? | Perilaku berubah? | Bukti | Perlu approval |
|---|---|---|---|---|---|
| Company / Brand | Halaman Brand | ✅ Ya | Tidak | `Party` + `Brand.owner_party_id` | — (X6 sudah disetujui) |
| Product Brand | Brand/SKU | ✅ Ya | Tidak | `Brand`, `Sku.brand_id` | — |
| Product Category | Kategori Brand/SKU | ✅ Ya | Tidak | `BrandCategory`, `SkuCategory` | — |
| Sales Name | `PartyContact.person_name` | ✅ Ya | UX membaik | `schema:298` | — |
| Contact | `PartyContact.phone/email` | ✅ Ya | UX membaik | `schema:301-302` | — |
| Supplier Company | `Party` / `BrandSupplier` | ✅ Ya | UX membaik | `schema:383` | — |
| **Company Categories** | `PartyRole` (6 nilai) | ✅ **Ya — terverifikasi §B** | Tidak | `schema:726` | ✅ **selesai, cabut blocker** |
| SKU | SKU dibuat dari alur Price | ✅ Ya | **Ya — alur kerja** | belum: `MaterialsClient.tsx:328` masih punya "Add Material" | **YA** |
| Specification | `Sku.spec` / `WorkPrice.spec` | ✅ Ya | Tidak | Json | — |
| Dimensions | kolom numerik + display | ✅ Ya | Tidak | `schema:484-488` | — |
| Qty | disimpan, dilarang dihitung | ✅ Ya | Perhitungan dilarang | `schema:543,585` + COMMENT | — |
| Unit | `SkuPrice.unit` / `WorkPrice.unit` | ✅ Ya | Tidak | | — |
| Price | `SkuPrice` / `WorkPrice` | ⚠️ **Ya tapi arah wajib terbalik** | UX membaik | `schema:535-536` vs Sheet2 b.11 | **YA (B-Q4)** |
| Supplied by | `BrandSupplier` + `SkuPrice` | ✅ Ya | Direlasionalkan | `schema:383,532` | — |
| Project Reference | `WorkPriceProjectRef` | ✅ Ya | Tidak | `schema:630` | — |
| Notes | field di record terkait | ✅ Ya | Tidak | | — |
| Update by/time | `updated_by_name` + `updated_at` | ✅ Ya | Tidak | | — |
| — *(implisit)* **Jejak siapa mengubah apa** | `MasterDataAudit` | ❌ **TIDAK — tabel tidak pernah ditulis** | Regresi diam | grep: 0 penulis | **YA** |

Dua baris berwarna merah: **SKU workflow** dan **audit trail**. Sisanya aman.

---

# D. Current vs Target UX

## D.1 Halaman Materials (`/masterdata/materials`)

**Sekarang** (`MasterDataMaterialsClient.tsx`, 718 baris):

```
Landing = grid kartu brand (nama + jumlah SKU)     :349-399   ← hasil R1, 2026-08-11
  ↓ klik brand
Tabel butir SKU (50/halaman, filter vendorId)      :508+
Tombol "Add Material" (bikin SKU langsung)         :328       ← bentrok PRD §2.1
Dialog SKU dimuat by-id saat baris diklik          :169
Peringatan "⚠ perlu diselaraskan" (brand vs catalog_brand) :562-570
```

**Target PRD §5** — satu baris tabel = satu **Brand**:

```
Brand      Kategori    SKU   Supplier   Kelengkapan
TACO       HPL          24      4        ✓
TOTO       Sanitary     18      3        ⚠ 3 SKU tanpa unit
  ↓ expand
  daftar SKU brand itu — READ ONLY
```

**Delta yang harus dikerjakan:**

1. Ubah grid kartu → **tabel brand** dengan search / sort / filter / paginasi
   (PRD §5.2). Angka SKU per brand sudah tersedia; angka supplier per brand
   diambil dari `BrandSupplier`.
2. **Baris SKU jadi read-only dari halaman ini** (PRD §5.2 penutup) →
   `MasterDataProductDialog` di sini jadi mode baca.
3. **Hapus tombol "Add Material"** (`:328`). Ini yang butuh approval — lihat
   §F **B-Q5**, karena satu-satunya jalan bikin SKU jadi lewat halaman Price.
4. Indikator kelengkapan **diturunkan dari data**, tanpa kolom `is_complete`
   (PRD §10). Definisi yang saya usulkan, eksplisit dan bisa diuji:
   - Brand: tidak punya kategori **atau** tidak punya supplier → *Needs completion*
   - SKU: `base_unit` kosong **atau** `status = DRAFT` → *Needs completion*
   - Party: `roles.length === 0` → *Needs completion*
5. `MasterDataBrandDialog` sudah bersih — **nol** field SKU/harga/dimensi
   (diperiksa: tidak ada satu pun kemunculan `sku|price|dimension|unit`).
   ✅ PRD §5.3 sudah terpenuhi, tidak ada pekerjaan.

## D.2 Halaman Price (`/masterdata/prices`)

**Sekarang** (`PricingClient.tsx`, 1.175 baris): tiga tab —
`material | material-upah | upah` (`:68`), form WorkPrice dipakai bersama oleh
dua tab terakhir (`:102-141`, ekstraksi yang benar — jangan disalin lagi).

**Delta:**

1. **Quick entry SKU belum ada.** Yang ada: `quickCreatePartyAction`,
   `quickCreateBrandAction`, `quickCreateWorkVendorAction`
   (`quick-entry-actions.ts:99,169,236`). **`quickCreateSkuAction` tidak ada.**
   Ini prasyarat mutlak untuk PRD §17 alur C dan D — tanpa itu, menghapus "Add
   Material" dari Materials membuat SKU tidak bisa dibuat sama sekali.
   → **Kerjakan ini SEBELUM menghapus tombolnya.** Urutan ini tidak boleh dibalik.
2. Unit dropdown (Sheet2) — masih input teks bebas.
3. `Qty` default 1 di UI (Sheet2), tetap tidak masuk perhitungan.
4. Label tab: "Labour Prices" → kosakata yang tidak menyesatkan untuk Table 4
   (PRD §8). Kelas A.
5. Field "Code" WorkPrice — B-Q2.

## D.3 Halaman Supplier (`/masterdata/suppliers`)

**Sekarang** (`SupplierClient.tsx:637`): tab **`Material` | `Services`** yang
saling eksklusif, dan tombol "Perusahaan"/"Brand" hanya muncul di tab Material
(`:645-648`).

**Bentrok langsung dengan PRD §3.1**: satu party bisa Supplier *dan* Subcon
*dan* Service Vendor sekaligus; memaksa staf memilih tab lebih dulu adalah
persis yang PRD larang.

**Target:** satu tombol **Add Party** → modal dengan pilihan peran
(checkbox multi-pilih, bukan radio). Tab boleh tetap ada **sebagai filter
tampilan**, bukan sebagai gerbang pembuatan data.

**Gap kedua, lebih senyap:** `PartyContact.brand_id` **ada di schema**
(`:308`) tapi **tidak pernah muncul di UI** — `PartyDialog.tsx` hanya menulis
`contact_person` dan `contact_role` (`:473-474`), nol kemunculan `brand_id`.
Jadi pertanyaan PRD §4 — *"Siapa sales TACO kita di Supplier A?"* — **belum
bisa dijawab tanpa catatan bebas**, padahal kolomnya sudah tersedia. PRD §4
menyuruh: *"expose it through the UI rather than filtering it away."*

## D.4 Excel (`/api/masterdata/excel/{export,import}`)

**Sekarang:** 2 sheet (`SKU`, `Prices`), upsert **by id, fallback slug**,
tanpa penghapusan, error per baris. Tidak ada deteksi konflik.

**Target PRD §11–14:** seluruh schema. Perbandingan cakupan:

| Entitas | Sheet sekarang | Butuh sheet? |
|---|---|---|
| `Sku` | ✅ `SKU` | ✅ |
| `SkuPrice` | ✅ `Prices` | ✅ |
| `Brand` | ❌ | ✅ |
| `BrandLink` | ❌ | ✅ |
| `BrandCategory` | ❌ | ✅ (sheet relasi) |
| `BrandSupplier` | ❌ | ✅ (sheet relasi) |
| `Party` | ❌ | ✅ |
| `PartyRole` | ❌ | ✅ (sheet relasi) |
| `PartyContact` | ❌ | ✅ (termasuk `brand_id`) |
| `PartyLink` | ❌ | ✅ |
| `Category` | ❌ | ✅ (dengan `parent_id`) |
| `SkuCategory` | ❌ | ✅ (sheet relasi) |
| `SkuMedia` | ❌ | ✅ |
| `WorkPrice` | ❌ | ✅ |
| `WorkPriceProjectRef` | ❌ | ✅ |
| `Sample` / `SampleMovement` | ❌ | ⚠️ **B-Q6** — riwayat gerakan sample lewat Excel berisiko |

**Deteksi konflik (PRD §13):** belum ada apa pun. Butuh kolom snapshot
`updated_at` (hidden) di setiap sheet + perbandingan saat import. Tanpa ini,
dua orang yang mengekspor di pagi yang sama akan saling menimpa diam-diam.

**Deviasi yang harus diputuskan:** import sekarang cocokkan **id, lalu slug**.
PRD §11.2 bilang *ID blank → CREATE*. Fallback slug berarti baris ber-ID kosong
dengan slug yang sudah ada akan **meng-update**, bukan membuat. Itu penjaga
duplikat yang bagus, tapi bukan yang PRD tulis. → **B-Q3**.

---

# E. Perubahan Schema — diklasifikasi

## E.1 — Tidak ada perubahan (mayoritas)

`Party`, `PartyRole`, `PartyLink`, `Brand`, `BrandLink`, `BrandSupplier`,
`Category`, `BrandCategory`, `SkuCategory`, `Sku`, `SkuMedia`, `WorkPrice`,
`WorkPriceProjectRef`, `Sample`, `SampleMovement`, `MasterDataAudit`,
seluruh 12 enum. **Semua sudah merepresentasikan Table 1–4.**

## E.2 — Koreksi yang diperlukan (kelas B, butuh approval)

| # | Perubahan | Keputusan owner | Dampak migrasi | Risiko |
|---|---|---|---|---|
| **S1** | `WorkPrice.code` | **B-Q2: simpan kolomnya, bangkitkan otomatis, sembunyikan dari staf.** | **TIDAK ADA MIGRASI.** Kolom tetap `String @unique` NOT NULL. Perubahan murni di action + form. | **Rendah.** Turun dari kelas B jadi **kelas C (perilaku)**. |
| **S2** | Arah `price_list` / `price_net` | **B-Q4: List wajib, Net opsional — final.** Dilarang mengarang `price_list` dari `price_net`. | **Belum tentu ada.** Kalau `price_list IS NULL` = 0 baris → `SET NOT NULL` aman. Kalau > 0 → **opsi (a): kolom DB tetap nullable, kewajiban ditegakkan di form.** | **Sedang.** Turun drastis karena opsi (a) tidak menyentuh data historis sama sekali. |

**Perubahan penting sejak revisi 1:** keputusan owner **menurunkan kedua item
ini dari kelas B (koreksi schema) ke kelas C (perilaku)**. B-Q2 tidak lagi butuh
migrasi sama sekali; B-Q4 kemungkinan besar juga tidak, tergantung angka dari
§I.1. Fase 1 karenanya jauh lebih ringan daripada perkiraan revisi 1 — dan
larangan mengarang `price_list` itulah yang menghemat migrasinya, bukan
mempersulitnya.

**S3 — baru, dari B-Q3.** `excel-service.ts` harus berhenti memakai slug sebagai
pencocok identitas (`:365`, `:503`) dan mulai memakainya sebagai **pendeteksi
duplikat yang menolak**. Kelas C, tanpa migrasi, tapi **membalik perilaku yang
ada** — lihat §F B-Q3.

## E.3 — Tambahan untuk Excel round-trip (kelas C, perilaku)

| # | Perubahan | Kenapa perlu | Alternatif tanpa schema |
|---|---|---|---|
| **S3** | Kolom snapshot versi untuk deteksi konflik | PRD §13 | ✅ **Ada** — pakai `updated_at` yang sudah dimiliki setiap model, ditulis ke kolom tersembunyi di sheet. **Tidak perlu schema baru.** |
| **S4** | Penulisan `MasterDataAudit` di setiap create/update/delete + import | PRD §15 | Tidak ada alternatif. **Model sudah ada — ini murni pekerjaan kode, bukan migrasi.** |

## E.4 — Optimasi opsional (kelas D) — **tidak dikerjakan**

Promosi `color/motif/finishing` dari `Sku.spec` Json ke kolom nyata (supaya
bisa dicari di SQL — lihat catatan `material-view-service.ts`). Nyata, tapi
bukan bagian PRD ini. **Ditunda, jangan diselundupkan.**

## E.5 — Yang PRD larang, dan tetap dilarang

`PartyCategory` untuk kategori material · `BrandSupplier.sku_id` ·
`WorkPrice → Sku` · BOM · penghapusan otomatis dari Excel · merge konflik
otomatis · `is_complete` · mengganti ID dengan slug/nama.

---

# F. Keputusan Owner — TERKUNCI 2026-08-12

Ketujuhnya dijawab. Yang di bawah ini **bukan rekomendasi lagi, melainkan
kontrak**. Kalau implementasi menyimpang darinya, yang salah implementasinya.

### B-Q1 — Klasifikasi peran party · **PERTAHANKAN**

`PartyRoleKind` tetap **satu daftar peran gabungan**. Peran-terhadap-kantor dan
sifat usaha **tidak** dipisah jadi dua field. Kelima `Company Categories` Excel
sudah terwakili benar.

→ **Nol perubahan schema. Baris "Must verify" di Anti-Regression Matrix PRD §18
resmi tertutup.** Rekomendasi §B diterima.

### B-Q2 — `WorkPrice.code` · **SIMPAN, BANGKITKAN OTOMATIS**

`code` dipertahankan sebagai identitas internal/kompatibilitas teknis, dan
**dibangkitkan sistem**. Staf tidak boleh diminta mengisinya, tidak boleh
diminta memahaminya, dan ia **bukan field bisnis yang terlihat**.

Konsekuensi kode:

- `pricing-actions.ts:66` — `code: z.string().min(1, "Code is required")` keluar
  dari skema input, masuk ke generator sisi server.
- `PricingClient.tsx` — field Code hilang dari kedua form WorkPrice.
- Generator harus tahan tabrakan: `@unique` tetap berlaku, jadi retry atau
  suffix. Skrip inspeksi melaporkan berapa kode yang sudah terpakai.
- **Tanpa migrasi.** Kolomnya tetap `String @unique` NOT NULL.

### B-Q3 — Identitas Excel · **SLUG DITOLAK SEBAGAI FALLBACK**

Aturan final:

| Keadaan sel ID | Aksi |
|---|---|
| ID terisi, cocok dengan record | **UPDATE record itu persis** |
| ID kosong | **CREATE record baru** |
| ID kosong **tapi slug sudah ada** | **TOLAK barisnya, laporkan sebagai duplikat** — beri tahu user supaya mengisi ID kalau memang mau meng-update |
| ID terisi tapi tidak ditemukan | tolak, laporkan |
| Record ada di DB, barisnya hilang dari Excel | **tidak ada aksi** (PRD §12) |

Slug **boleh** dipakai untuk mendeteksi duplikat/konflik, tapi **tidak boleh**
diam-diam mengubah CREATE jadi UPDATE.

> Alasan owner, yang layak dikutip karena ia menjelaskan seluruh sikap terhadap
> Excel: *"Excel is a manual-editable SSOT representation. We must never
> silently update an existing record when the user supplied a blank ID."*

→ Ini **membalik perilaku `excel-service.ts` yang ada sekarang**
(`:365` `where: { slug: data.slug, brand_id: brandId }` dan `:503` fallback
`findFirst({ where: { slug: data.sku_slug } })`). Kedua tempat itu harus
berubah dari "cocokkan" jadi "deteksi lalu tolak". Ini **regresi yang
disengaja** terhadap perilaku lama — dicatat di sini supaya tidak ada yang
"memperbaikinya" balik.

### B-Q4 — List / Net Price · **LIST WAJIB, NET OPSIONAL — FINAL**

Keputusan bisnisnya final. Yang **tidak** boleh dilakukan, kata owner, persis:
*"Do NOT fabricate historical List Price values from existing Net Price."*

Urutan kerja yang diwajibkan:

1. Periksa dulu berapa baris `SkuPrice` yang `price_list IS NULL`
   → `scripts/inspect-masterdata-state.mjs` §3.
2. Laporkan dampaknya sebelum menulis migrasi.
3. **Jangan** isi `price_list := price_net`. Itu mengarang harga katalog yang
   tidak pernah ada, dan harga katalog yang salah lebih berbahaya daripada
   harga katalog yang kosong — ia terlihat seperti fakta.
4. Kalau ada baris lama yang `price_list` NULL, opsinya **(a)** kolom DB
   dibiarkan nullable dan kewajiban ditegakkan di **form** saja, atau **(b)**
   baris lama diisi tangan lebih dulu. Pilih setelah angkanya diketahui.

→ Artinya **S2 belum tentu jadi migrasi.** Kalau angkanya > 0, opsi (a)
memenuhi keputusan bisnis tanpa menyentuh data historis sama sekali — dan itu
yang paling patuh pada "preserve historical data".

### B-Q5 — Hapus "Add Material" · **YA, TAPI TERAKHIR**

Bentuk akhir: Materials = brand-centric, SKU read-only, SKU hanya lahir dari
Price.

**Syarat mutlak yang owner tegaskan sendiri:** jangan hapus kemampuan yang ada
sampai `quickCreateSkuAction` + integrasi Price **berfungsi penuh dan sudah
diuji**. Alur yang wajib jalan lebih dulu:

```
Price → cari SKU → tidak ketemu → Create SKU inline
                                → Brand tidak ketemu → Create Brand inline
                                → kembali ke alur Price
```

→ Mengunci pembalikan urutan yang saya usulkan: **4.1 sebelum 2.6.**

### B-Q6 — Sample / SampleMovement · **ASIMETRIS**

Karena syarat produknya adalah backup Excel seluruh schema:

| Entitas | Export | Import |
|---|---|---|
| `Sample` | penuh, bisa diedit | **create + update via import** |
| `SampleMovement` | penuh, untuk diperiksa manual | **READ-ONLY — suntingan ditolak & dilaporkan** |

Excel **tidak boleh** mengubah catatan riwayat pergerakan. Berarti import perlu
membandingkan baris `SampleMovement` dengan DB dan **melaporkan** setiap
perbedaan sebagai penolakan — bukan mengabaikannya diam-diam. Mengabaikan diam-diam
akan membuat user mengira suntingannya masuk.

### B-Q7 — Keadaan DB · **TIDAK BISA SAYA PERIKSA DARI SINI — LIHAT §I.1**

Owner: *"Do NOT ask the owner ... if the repository environment allows
inspection."* Lingkungannya tidak mengizinkan, dan ini sudah diuji, bukan
diasumsikan:

- `.env` → `DATABASE_URL="postgresql://postgres:***@localhost:5432/studioflow"`
- Postgres-nya dari `docker-compose.yml`, jalan di PC owner.
- Shell saya VM Linux terisolasi. `localhost` di sana = VM itu sendiri.
- Dicoba lima rute: `localhost`, `host.docker.internal`, `172.17.0.1`,
  `10.0.2.2`, `192.168.65.254` → **connection refused / unreachable, semuanya.**
- Dua dump di `backups/` bertanggal 2026-07-30, **sebelum** rebaseline v2 —
  tidak sah dijadikan bukti keadaan sekarang.

Yang saya lakukan sebagai gantinya, alih-alih menebak angka: menulis
pemeriksanya. **`scripts/inspect-masterdata-state.mjs`** — hanya baca, nol
perintah tulis. Jalankan, tempel hasilnya, dan §I.1 terisi.

---

# G. Rencana Eksekusi — Fase 0–6

Urutan di bawah **berbeda dari PRD §19** pada satu titik, dan sengaja:
**quick-entry SKU dikerjakan sebelum tombol "Add Material" dihapus.** Urutan PRD
(Fase 2 hapus tombol, Fase 4 bikin penggantinya) meninggalkan jendela di mana
SKU tidak bisa dibuat dengan cara apa pun.

### Fase 0 — Bukti & baseline · **SELESAI** (0.a revisi 1, 0.b revisi 2 → §H)

### Fase 1 — Keselamatan kontrak · **TIDAK LAGI TERBLOKIR** (kecuali 1.4, butuh §I.1)
| Langkah | Berkas | Kelas |
|---|---|---|
| 1.0 **Satu `slugify` bersama** — 6 implementasi jadi 1 (§H.1). Prasyarat 4.1. | `src/subapps/master-data/lib/slugify.ts` (baru) + 4 pemanggil | C |
| 1.1 Verifikasi drift `WorkPrice` tertutup di DB, bukan cuma di schema | `scripts/inspect-masterdata-state.mjs` §1 | verifikasi |
| 1.2 **Penulisan `MasterDataAudit`** di semua jalur tulis | helper baru `services/audit-service.ts` + 6 berkas actions + `library-actions.ts` | C |
| 1.3 `WorkPrice.code` dibangkitkan otomatis, field hilang dari form (B-Q2) | `pricing-actions.ts:66`, `PricingClient.tsx` | C — **tanpa migrasi** |
| 1.4 Arah List/Net (B-Q4) — **jalankan §I.1 dulu**, baru pilih opsi (a)/(b) | `pricing-actions.ts`, mungkin `schema.prisma` | C atau B |
| 1.5 Jalur `BrandSupplier` + `PartyContact.brand_id` lengkap di service layer | `party-actions.ts`, `types/party.ts` | C |
| 1.6 Gerbang `MASTERDATA_VIEW` untuk 8 read action yang belum punya (§H.2) | `library-actions.ts`, `masterdata-actions.ts:98` | C |

### Fase 2 — Materials / Brand UX · kelas A kecuali disebut
| Langkah | Berkas |
|---|---|
| 2.1 Tabel grain-Brand + search/sort/filter/paginasi | `MasterDataMaterialsClient.tsx`, `material-view-service.ts` |
| 2.2 Baris expand → daftar SKU **read-only** | `MasterDataMaterialsClient.tsx`, `MasterDataProductDialog.tsx` (mode baca) |
| 2.3 Kolom hitung SKU + hitung supplier per brand | `material-view-service.ts` (query agregat) |
| 2.4 Indikator kelengkapan turunan (definisi §D.1.4) | `material-view-service.ts` |
| 2.5 Brand CRUD — **tidak ada pekerjaan**, sudah bersih | `MasterDataBrandDialog.tsx` |
| 2.6 Hapus "Add Material" — **hanya setelah Fase 4.1 jalan** | `MasterDataMaterialsClient.tsx:328` |

### Fase 3 — Party / Supplier UX
| Langkah | Berkas |
|---|---|
| 3.1 Satu tombol **Add Party**, peran multi-pilih di dalam modal | `SupplierClient.tsx:637-648`, `PartyDialog.tsx` |
| 3.2 Tab Material/Services diturunkan jadi filter tampilan | `SupplierClient.tsx` |
| 3.3 **Ekspos `PartyContact.brand_id`** — picker brand per kontak | `PartyDialog.tsx:462-500`, `types/party.ts`, `party-actions.ts` |
| 3.4 Kelola relasi Brand–Supplier dari halaman Party | `SupplierClient.tsx` |

### Fase 4 — Price UX (**hub utama**)
| Langkah | Berkas |
|---|---|
| **4.1 `quickCreateSkuAction`** — prasyarat 2.6 | `quick-entry-actions.ts` (baru), `SkuPicker.tsx` |
| 4.2 Rantai quick entry tanpa dead end: SKU → Brand → Supplier | `PricingClient.tsx`, `hooks/use-quick-entry.ts` |
| 4.3 Unit dropdown (Sheet2) | komponen baru + `PricingClient.tsx` |
| 4.4 Qty default 1 di UI, tetap dilarang dihitung | `PricingClient.tsx` |
| 4.5 Kosakata tab Table 4 (PRD §8) | `PricingClient.tsx`, `prices/page.tsx` |
| 4.6 Tampilan banding harga antar supplier per SKU (§17-F) | `PricingClient.tsx` |

### Fase 5 — Excel seluruh schema *(fase terbesar — perlakukan sebagai proyek sendiri)*
| Langkah | Berkas |
|---|---|
| 5.1 Export multi-sheet (15 sheet, §D.4) + kolom ID tersembunyi | `excel-service.ts` |
| 5.2 Sheet relasi (`BrandSupplier`, `PartyRole`, `SkuCategory`, `BrandCategory`) dengan FK-ID | `excel-service.ts` |
| 5.3 Import per aturan identitas **B-Q3**: ID ada → update; ID kosong → create; **ID kosong + slug sudah ada → TOLAK sebagai duplikat**; baris hilang → tidak ada aksi. Hapus fallback slug di `:365` dan `:503`. | `excel-service.ts` |
| 5.3b `Sample` create/update via import; **`SampleMovement` read-only** — setiap suntingan dibandingkan dan **ditolak dengan laporan**, bukan diabaikan diam-diam (B-Q6) | `excel-service.ts` |
| 5.4 Snapshot `updated_at` + deteksi konflik: deteksi → laporkan → **tolak**, tanpa merge | `excel-service.ts` |
| 5.5 Validasi & error per baris untuk 15 sheet | `excel-service.ts` |
| 5.6 Ringkasan import (dibuat/diupdate/konflik/gagal) + tulis `MasterDataAudit` | `excel-service.ts`, `api/masterdata/excel/import/route.ts` |
| 5.7 Urutan tulis menghormati FK: Category → Party → PartyRole → Brand → BrandSupplier → Sku → SkuCategory → SkuPrice → WorkPrice → ProjectRef | `excel-service.ts` |

### Fase 6 — Regresi & penerimaan
`tsc --noEmit` · `prisma validate` + `migrate status` · unit test
(`sku-price.test.ts` diperluas) · 6 uji round-trip PRD §20 · telusuri manual 15
alur UX PRD §17 A–O · ⛔ butuh DB untuk 4 dari 6 uji Excel.

## Ringkasan risiko

| Fase | Bobot | Risiko utama |
|---|---|---|
| 1 | **Ringan–sedang** ↓ | Turun dari revisi 1: B-Q2 tanpa migrasi, B-Q4 kemungkinan besar juga. Sisa risiko ada di 1.0 (slugify bersama menyentuh 4 pemanggil) dan 1.2 (audit di semua jalur tulis). |
| 2 | Sedang | perubahan grain tabel = penulisan ulang query, bukan penataan ulang kolom. **Sebagian kodenya ada di `extensions/library`, bukan di subapp** (§H.3). |
| 3 | Ringan | terisolasi di dua berkas |
| 4 | Sedang | 4.1 prasyarat 2.6 — **dikunci oleh B-Q5, jangan dibalik** |
| 5 | **Berat** | ~15 sheet × (export + import + validasi + konflik), plus aturan tolak-duplikat B-Q3 dan read-only `SampleMovement` B-Q6. Bisa jadi setengah dari total pekerjaan. |
| 6 | Sedang | ⛔ terhalang ketersediaan DB |

## Yang tidak akan saya kerjakan tanpa diminta lagi

Refactor `ui_engine` · perombakan visual di luar alur ini · promosi
`color/motif/finishing` jadi kolom (§E.4) · menyentuh `extensions/library` di
luar yang dipakai Master Data · 11 error eslint lama (§T6 roadmap) ·
apa pun di PRD §22 · dan delapan larangan eksplisit owner 2026-08-12:
`PartyCategory` untuk kategori material, `BrandSupplier.sku_id`,
`WorkPrice → Sku`, BOM, penghapusan otomatis dari Excel, merge konflik otomatis,
`is_complete` yang bisa berubah, **identitas berbasis slug**.

---

# H. Fase 0.b — hasil audit slugifikasi & RBAC

Butir Fase 0 yang tersisa. Dikerjakan 2026-08-12. Dua dari tiga temuannya
mengubah rencana.

## H.1 — Slugifikasi: **7 implementasi, 2 perilaku berbeda** ❌

> **⚠️ DIKOREKSI 2026-08-12 (revisi 3).** Angka di bawah semula tertulis **6**.
> Yang ketujuh — `categorySlug` di `services/category-tree-rules.ts:17` —
> terlewat karena saya mencari nama `slugify` dan ia tidak bernama begitu.
> Koreksinya justru **menguntungkan**: ketiga varian NFKD ternyata identik
> secara perilaku, dan yang #1 sudah murni + sudah diuji, jadi ia bisa langsung
> jadi implementasi kanonik. Rincian dan konsekuensinya di
> **`docs/implementation_plan.md` §0 dan §2**.

PRD §16 menyebut "inconsistent slugification" tanpa merinci. Rinciannya:

| # | Lokasi | NFKD / diakritik? |
|---|---|---|
| 1 | `services/category-tree-rules.ts:17` `categorySlug` | ✅ ya — **murni & sudah diuji; jadi implementasi kanonik** |
| 2 | `actions/quick-entry-actions.ts:55` | ✅ ya (identik perilaku dengan #1) |
| 3 | `extensions/library/services/library-service.ts:70` `slugifyTag` | ✅ ya (identik perilaku dengan #1) — acuan "byte-identical"-nya menunjuk `scripts/seed-brand-categories.mjs` yang **sudah diarsipkan** ke `docs/archive/scripts-usang/` |
| 4 | `actions/party-actions.ts:93` | ❌ tidak |
| 5 | `actions/pricing-actions.ts:135` | ❌ tidak |
| 6 | `actions/sample-request-actions.ts:415` | ❌ tidak — **inline, bahkan bukan fungsi** |
| 7 | `extensions/library/services/library-service.ts:377` `slugify` | ❌ tidak |

Akibat konkretnya, satu nama yang sama menghasilkan dua slug berbeda tergantung
layar mana yang dipakai:

```
"PT Café Créme"
  lewat quick entry  (#3) → pt-cafe-creme
  lewat form Party   (#1) → pt-caf-cr-me      ← é dibuang, bukan diubah jadi e
```

`Party.name` dan `Brand.name` `@unique`, jadi ini tidak melahirkan duplikat di
sana — slugnya saja yang tidak bisa ditebak. **Yang berbahaya `Sku`:** namanya
tidak unik, tapi `@@unique([brand_id, slug])` berlaku. Dan `Sku.slug` sekarang
cuma dibuat di **satu** tempat — #4, yang inline dan tanpa NFKD.

→ **Konsekuensi rencana: `quickCreateSkuAction` (4.1) akan jadi pembuat
`Sku.slug` kedua.** Menulisnya di atas tujuh implementasi yang tidak sepakat
berarti menanam bug kedelapan. Karena 4.1 mengunci 2.6 yang mengunci B-Q5,
konsolidasi slugify **naik jadi langkah 1.0** — paling awal, bukan utang teknis.

Aturan penggabungan: varian **NFKD** (#1–#3) yang benar, dan #1 dipakai sebagai
sumbernya karena sudah murni, bebas I/O, dan sudah masuk `npm test`. Konsolidasi
karenanya **hanya mengubah perilaku di 4 tempat** (#4–#7), yang berarti entitas
yang slug-nya berisiko bergeser cuma `Party`, `Sku`, dan `Brand`. `slugifyTag`
mendelegasi ke modul bersama — nol perubahan perilaku, jadi kontrak
byte-identical-nya selamat dengan sendirinya.

**Rencana eksekusi penuh untuk langkah ini: `docs/implementation_plan.md` §2**,
termasuk daftar kasus uji regresi dan aturan "lapor dulu, jangan tulis ulang
slug lama".

## H.2 — RBAC: **tidak ada jalur tulis yang tanpa gerbang** ✅

PRD §16 menyebut "incomplete RBAC enforcement". Setelah dihitung per-action:

| Berkas | Action | Bergerbang |
|---|---|---|
| `src/subapps/master-data/actions/*.ts` (6 berkas) | 45 | **45** — `hasPermission` 1:1 |
| `src/extensions/library/actions/library-actions.ts` | 26 | 18 via `assertLibraryPermission` |

Delapan sisanya diperiksa satu per satu. **Tujuh adalah pembacaan**
(`getVendorsAction`, `getProductsAction`, `getProductMetadataAction`,
`getBrandCategoryCoverageAction`, `getLibraryCategoriesAction`,
`getGroupedCategoriesAction`, `getMyRoleAction`, `getCatalogSuggestionsAction`)
— semuanya tetap di balik `requireSession()` di dalam `createAction`, jadi bukan
akses anonim; yang kurang cuma `MASTERDATA_VIEW` yang eksplisit. Satu penulisan,
`createProjectProductRequestAction:364`, **bergerbang** — tapi lewat
`getProjectMembershipOrThrow`, keanggotaan proyek, bukan PERMISSION. Sah, hanya
berbeda mekanisme. Ditambah `masterdata-actions.ts:98`
`getProductsLastChangeAction`, juga pembacaan.

> **Koreksi terhadap draf saya sendiri.** Sapuan pertama saya melaporkan
> "23 dari 27 action tanpa gerbang" karena mencari string `hasPermission` dan
> tidak melihat bahwa `assertLibraryPermission` (`:39`) membungkusnya. Angka itu
> salah dan sempat masuk catatan kerja. Yang benar: **8 dari 26, semuanya baca.**
> Dicatat di sini karena kalau saya diam saja, temuan yang salah itu akan
> dikutip belakangan seolah terverifikasi.

→ **Bukan lubang keamanan.** Diturunkan jadi langkah **1.6** (konsistensi),
bukan prioritas.

## H.3 — Temuan sampingan yang mengubah lingkup Fase 2 & 3 ⚠️

Saat melacak slugify, ketahuan: **CRUD `Brand` dan `Sku` tidak tinggal di
`src/subapps/master-data/`.** Keduanya ada di `LibraryService`:

- `brand.create` / `brand.update` → `library-service.ts:406, 495, 568, 883, 1298`
- `sku.create` / `sku.update` → `library-service.ts:969, 1130, 1293, 1312, 1512`
- satu-satunya `brand.create` di dalam subapp: `quick-entry-actions.ts:203`

`library-service.ts` sendiri 1.603 baris, `library-actions.ts` 471 baris.

Ini **memperjelas** status `extensions/library` di §0: bukan cuma "tidak rusak",
tapi **jalur tulis utama Master Data**. Jadi Fase 2 (Materials grain-Brand),
Fase 3, dan 4.1 (`quickCreateSkuAction`) semuanya akan menyentuh berkas di luar
subapp. Perkiraan lingkup revisi 1 yang cuma menyebut berkas subapp **terlalu
kecil** — dan lebih baik diketahui sekarang daripada di tengah Fase 2.

Catatan batas: menyentuh `library-service.ts` **sejauh yang dipakai Master
Data** sekarang tidak terhindarkan. Refactor `extensions/library` di luar itu
tetap di daftar "tidak dikerjakan".

---

# I. Protokol pra-migrasi (aturan eksekusi owner 2026-08-12)

Sebelum migrasi schema **apa pun**, berurutan, tanpa satu pun dilewati:

1. **Periksa baris yang terdampak** — `node scripts/inspect-masterdata-state.mjs`
2. **Laporkan dampak migrasi/backfill** — angka dulu, baru rencana
3. **Jangan mengarang nilai historis yang hilang** — tidak ada
   `COALESCE(price_list, price_net)`, tidak ada tanggal tebakan, tidak ada
   `updated_by_name` karangan
4. **Ambil/verifikasi backup**:
   `pg_dump -n master_data -Fc studioflow > backups/masterdata_pre_<perubahan>_$(date +%Y%m%d).dump`
   (dua dump di `backups/` bertanggal 2026-07-30 — **pra-rebaseline v2, tidak
   sah** dijadikan pengaman sekarang)
5. **Pertahankan makna bisnis Excel** — anti-regression matrix §C dicek ulang

## I.1 — Laporan keadaan DB · ⏳ **MENUNGGU EKSEKUSI OWNER**

Sandbox saya tidak punya rute ke Postgres di PC owner (§F B-Q7 — lima rute
diuji, semuanya gagal). Jalankan:

```bash
docker compose up -d db          # kalau belum jalan
node scripts/inspect-masterdata-state.mjs
```

Tempel keluarannya ke bawah sini. Yang ditunggu, dan apa yang berubah karenanya:

| Angka | Menentukan |
|---|---|
| `20260811120100` applied? | apakah §0 baris 1 benar-benar terbukti di DB, bukan cuma di berkas migrasi |
| kolom `material_price`/`labor_price` sudah hilang? | bukti fisik drift `WorkPrice` tertutup — Fase 1.1 lewat atau gagal |
| jumlah baris per tabel | apakah backup wajib (langkah 4) dan seberapa berat Fase 5 |
| `MasterDataAudit` = 0? | konfirmasi gap §0 dari DB, bukan cuma dari grep |
| `SkuPrice.price_list IS NULL` | **B-Q4: 0 → `SET NOT NULL` aman; > 0 → opsi (a), kolom tetap nullable** |
| `COUNT(DISTINCT WorkPrice.code)` | ruang tabrakan yang harus dihindari generator B-Q2 |
| grup slug duplikat | berapa baris yang akan ditolak aturan duplikat B-Q3 saat import pertama |

**Sampai kotak ini terisi, Fase 1.4 tidak boleh dieksekusi.** Sisanya —
1.0, 1.1, 1.2, 1.3, 1.5, 1.6, dan seluruh Fase 2 — boleh jalan.

---

**Langkah berikutnya:** jalankan `scripts/inspect-masterdata-state.mjs` dan
tempel hasilnya (§I.1). Paralel dengan itu, Fase 1.0 (slugify bersama) dan
Fase 1.2 (audit trail) sudah boleh dikerjakan.
