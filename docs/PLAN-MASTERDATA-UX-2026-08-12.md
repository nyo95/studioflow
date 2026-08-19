# Master Data — UX Redesign Plan
**Tanggal:** 2026-08-12
**Dasar:** Spec UX final owner (§A–AO), cross-referenced terhadap kode dan schema eksisting.
**Status:** Plan — belum ada kode yang diubah kecuali yang dicatat sebagai "sudah ada".

---

## 0. Prinsip yang sudah dikunci (dari spec §A)

| Prinsip | Implikasi implementasi |
|---|---|
| Master Data Management System, bukan kumpulan CRUD form | Detail entity = page/drawer relasional, bukan modal kecil yang flat |
| Harga hanya masuk lewat Price | SKU tidak punya tombol "Add SKU" langsung — entry via Price modal |
| Material berporos Brand | Materials page = Brand grain, bukan SKU grain |
| Supplier berporos Party | Satu tabel Party, bukan tab Material/Services terpisah |
| Relationship ≠ data delete | Remove relationship + soft delete entity harus dipisahkan secara eksplisit |
| Quick entry minimal tapi relasional | Baris quick-create valid dari awal, ditandai perlu dilengkapi |

---

## 1. Gap analysis: schema vs UI vs spec

### Yang sudah ada di schema dan di UI
| Entity | Schema | Backend action | UI |
|---|---|---|---|
| Brand | ✅ | ✅ `getVendorsAction`, create/update | ✅ `MasterDataBrandDialog` (tapi perlu dipersempit) |
| Party (Supplier) | ✅ | ✅ `party-actions.ts` | ✅ `SupplierClient` (tapi masih tab Material/Services) |
| BrandSupplier | ✅ `@@unique([brand_id, party_id])` | ✅ assign/unassign via `library-actions` | ❌ UI tidak expose relasi ini sebagai fitur sendiri |
| PartyContact + brand_id | ✅ kolom ada | ❌ nol action untuk CRUD Contact | ❌ tidak ada di UI sama sekali |
| SkuPrice + versioning | ✅ valid_from/valid_to/is_current | ✅ `recordSkuPrice()` menutup row lama | ⚠️ UI edit overwrite, tidak menunjukkan "versi baru" |
| WorkPrice (Material+Labour / Labour) | ✅ `kind` field | ✅ create/update/delete | ✅ `PricingClient` — 3 tab |
| Price history | ✅ arsip di DB | ❌ nol query untuk fetch history | ❌ tidak ada di UI |
| Sample + SampleMovement | ✅ | ✅ | ✅ `SampleLibraryClient` |
| Soft delete (Brand/Party/Sku) | ✅ `deleted_at` | ✅ sebagian | ⚠️ UI pakai confirm() bawaan browser (AUDIT §4) |
| quickCreateBrandAction | — | ✅ | ✅ dipakai di PricingClient |
| quickCreatePartyAction | — | ✅ | ✅ dipakai di PricingClient |
| **quickCreateSkuAction** | — | **❌ tidak ada** | **❌** (P3 gap #2 di roadmap) |

### Yang ada di schema tapi belum ada di UI sama sekali
1. `PartyContact.brand_id` — scope kontak per brand (§T Brand Scope)
2. `BrandSupplier` relationship management UI
3. Price history display (SkuPrice rows dengan `is_current = false`)
4. Archive/soft-delete UI yang benar (bukan `confirm()`)
5. Import preview + conflict resolution

### Yang perlu dibangun dari nol
1. Brand Detail page (`/masterdata/materials/[brandId]`) — spec §G–M
2. Supplier Detail page (`/masterdata/suppliers/[partyId]`) — spec §P–U
3. Contact CRUD UI + actions — spec §S–U
4. `quickCreateSkuAction` — spec §Y, blocking untuk Price flow
5. Add Price step-1 type selector modal — spec §W
6. Price Detail drawer dengan history — spec §AD–AF
7. Import preview page — spec §AL–AN
8. Reusable `RelationshipAssigner` component — spec §AH

---

## 2. Nav & shell restructure (spec §B)

### Target nav
```
Materials / Brands   →  /masterdata/materials
Suppliers & Vendors  →  /masterdata/suppliers
Prices               →  /masterdata/prices
Samples              →  /masterdata/samples
───────────────────
Data Tools           →  /masterdata/settings   (Import / Export)
```

### Gap vs sekarang
| Sekarang | Target | Berkas |
|---|---|---|
| "Prices" (→/materials) | "Materials" | `MasterDataNavOuter.tsx` |
| "Supplier" | "Suppliers" | `MasterDataNavOuter.tsx` |
| Nav tidak punya "Prices" route | Tambah Prices item | `MasterDataNavOuter.tsx` |
| "Pengaturan" | "Data Tools" | `MasterDataNavOuter.tsx` |
| Icon: `CircleDollarSign` untuk Materials | Ganti ke `Package` atau `Layers` | `MasterDataNavOuter.tsx` |
| Prices icon: tidak ada | `CircleDollarSign` | `MasterDataNavOuter.tsx` |
| Data Tools: `Settings2` | `Database` atau `ArrowLeftRight` | `MasterDataNavOuter.tsx` |

**Catatan:** Spec §C menampilkan `[ Import / Export ]` di header halaman Materials.
Keputusan: tombol di header akan berupa **link navigasi** ke `/masterdata/settings` (Data Tools),
bukan re-implementasi fungsi inline. Ini konsisten dengan keputusan owner 2026-08-12.

---

## 3. Phase implementasi

Diurut berdasarkan: (1) unblocking dependency, (2) business value, (3) scope.

---

### UI-Phase 1 — Nav restructure
**Effort: XS | Blocking: semua phase berikutnya secara UX**

File: `MasterDataNavOuter.tsx`

Perubahan:
- Item 1: icon `Layers` / label `"Materials"` / href `/masterdata/materials`
- Item 2: icon `Building2` / label `"Suppliers"` / href `/masterdata/suppliers`
- Item 3: icon `CircleDollarSign` / label `"Prices"` / href `/masterdata/prices`
- Item 4: icon `Library` / label `"Samples"` / href `/masterdata/samples`
- Divider visual di antara item 4 dan 5
- Item 5: icon `Database` / label `"Data Tools"` / href `/masterdata/settings`

---

### UI-Phase 2 — Materials/Brands page cleanup
**Effort: S | Blocking: UI-Phase 3 (brand detail)**

File: `MasterDataMaterialsClient.tsx`, `src/app/masterdata/materials/page.tsx`

Target (spec §C–D):
- Page title: `"Brands"` (bukan "Materials")
- Eyebrow: `"Master Data"`
- Header: tambah link `"Data Tools ↗"` yang navigasi ke `/masterdata/settings`
- Brand table: pastikan kolom `Brand | Category | SKUs | Suppliers | Completeness` semua ada
  - `Suppliers` count: butuh query count `BrandSupplier` — cek apakah `getBrandView` sudah mereturn ini
- Klik row brand → navigasi ke brand detail page (bukan open dialog)
- Tombol: `"+ Tambah Brand"` (ganti "Add Material")
- Filter: Category, Status (Complete/Incomplete), sort

Backend yang mungkin perlu ditambah di `material-view-service.ts`:
- `supplierCount` per brand (tanpa soft-deleted Party)

---

### UI-Phase 3 — Brand Detail page
**Effort: L | Nilai tertinggi**

Route baru: `/masterdata/materials/[brandId]`

File baru:
- `src/app/masterdata/materials/[brandId]/page.tsx` (server)
- `src/subapps/master-data/components/BrandDetailClient.tsx` (client, ~600 baris)

4 tab (spec §G–M):

**Tab Overview (§H):**
- Brand name, Owner (Party), Categories, Website, Links
- Completeness checklist: Owner ✓/⚠, Category ✓/⚠, Website ✓/⚠
- Tombol `[Edit Brand]` → buka `MasterDataBrandDialog` yang sudah ada (disempurnakan)
- Tombol `[•••]` → Archive brand

**Tab SKUs (§I):**
- Tabel: SKU Code, Product Name, Dimension — read-only
- Search di dalam tab
- Tidak ada `+ Add SKU` (sesuai spec)
- Klik row SKU → SKU detail drawer (§J)

**Tab Suppliers (§K–M):**
- Daftar Party yang punya `BrandSupplier` ke brand ini
- Per supplier: nama, role, jumlah price records
- Tombol `[ + Assign Supplier ]` → `AssignSupplierModal`
- `•••` per supplier → View supplier / View prices / Remove relationship

**Tab Prices (link):**
- Shortcut ke `/masterdata/prices?brand=TACO`
- Atau tampilkan embedded tabel prices untuk brand ini

Actions baru yang perlu dibuat:
- `getBrandDetailAction(brandId)` — brand + categories + links + stats
- `getBrandSkusAction(brandId, {search, page})` — SKUs paginated
- `getBrandSuppliersAction(brandId)` — BrandSupplier rows dengan party info + price count
- `assignSupplierToBrandAction({brandId, partyId})` — create BrandSupplier
- `unassignSupplierFromBrandAction({brandId, partyId})` — soft-remove BrandSupplier
  - Konfirmasi: "X has N price records. Removing relationship will not delete price history."

---

### UI-Phase 4 — SKU Detail drawer
**Effort: M | Bergantung UI-Phase 3**

Komponen: `SkuDetailDrawer.tsx`

Content (spec §J):
- Product Identity: SKU Code, Product Name, Category, Specification, Dimension, Unit
- Suppliers & Prices section: tabel Supplier + Current Price
- Tombol `[ View Prices ]` → filter ke Price page
- Tombol `[ + Add Price ]` → buka Price modal (step 1, type = MATERIAL, SKU pre-filled)

---

### UI-Phase 5 — quickCreateSkuAction (backend prasyarat)
**Effort: M | BLOCKING untuk UI-Phase 6 (Price flow)**

File: `src/subapps/master-data/actions/quick-entry-actions.ts`

Tambah `quickCreateSkuAction`:
- Input minimal: `brand_id`, `sku_code` (wajib), `product_name?`, `category?`
- Slug: pakai `slugify` kanonik (konsolidasi sudah di Fase 1.0)
- Return: `QuickEntryResult` (`id`, `name`, `reused`)
- Audit: `MasterDataAudit` entry

Form fields di UI (spec §Y): Brand, SKU Code, Product Name, Category, Specification, Color, Motif, Finishing, Dimensions, Unit

Nested quick create di dalam modal:
- Brand not found → `+ Create "TACO"` → minimal Brand create → return to SKU form
- Setelah SKU dibuat → return to Price modal dengan SKU pre-filled

---

### UI-Phase 6 — Price page & flow redesign
**Effort: L | Bergantung UI-Phase 5**

File: `PricingClient.tsx` (refactor besar), page: `/masterdata/prices`

Target (spec §V–AF):

**Header:**
```
Prices
[All] [Material] [Material + Service] [Work]
[ Search... ]                   [ + Add Price ]
```
- "Labour only" → "Work / Service" (label tab)
- "Material + Labour" → "Material + Service"

**Add Price — step 1 type selector (spec §W):**
- Modal kecil: pilih MATERIAL / MATERIAL + SERVICE / WORK / SERVICE
- Setelah pilih → buka form yang sesuai

**Material Price modal (spec §X):**
- SKU search/select di atas
- `+ Create SKU` → nested SKU drawer (UI-Phase 5)
- Brand + Product muncul otomatis dari SKU
- Supplier, Price, Unit, Specification, Dimension, Notes
- `+ Create Supplier` → nested quick create Party

**Price Detail drawer (spec §AD):**
- Nama, harga, supplier, brand, SKU, spec, dimension
- Price History section: tabel valid_from / valid_to / amount
  - Backend baru: `getSkuPriceHistoryAction(skuId, partyId)` — fetch semua rows `is_current = false`
- `[Edit Current Price]` → Edit Price modal (spec §AE)
- `[•••]` → View history / Correct entry / Mark invalid

**Edit Price modal (spec §AE):**
- Label: "Save New Price" (bukan "Save Changes")
- Input: New Price, Effective from (default today), Notes
- Backend: `recordSkuPrice()` sudah melakukan ini dengan benar

**Soft delete / mark invalid (spec §AG):**
- `•••` → Mark invalid → confirmation → update `is_current = false` tanpa hard delete
- Bukan hapus data — hapus visibilitas dari tabel aktif

---

### UI-Phase 7 — Suppliers page unification
**Effort: L | Nilai tinggi**

File: `SupplierClient.tsx` (refactor besar)

Target (spec §N–U):

**Tabel unified Party (hapus tab Material/Services):**
```
Company | Roles | Brands | Contacts
```
- Satu tombol: `+ Tambah Supplier / Vendor`
- Klik row → Supplier Detail page (bukan modal)

**Route baru:** `/masterdata/suppliers/[partyId]`
- Server page + `SupplierDetailClient.tsx`

**4 tab:**

*Overview (§P):*
- Trading name, Legal name, Roles, Address, Website
- Completeness: Role ✓/⚠, Contact ✓/⚠, Missing email ⚠

*Brands (§Q–R):*
- Daftar brand yang disuplai + SKU count + price record count
- `[ + Assign Brand ]` → `AssignBrandModal` (kebalikan AssignSupplierModal)

*Prices (§V):*
- Filtered view: prices di mana supplier ini adalah supplier

*Contacts (§S–U):*
- Daftar `PartyContact` rows
- `[ + Add Contact ]` → Contact modal
- Field: Name, Role, Phone, WhatsApp, Email, Brand Scope

**Actions baru:**
- `getSupplierDetailAction(partyId)`
- `getSupplierBrandsAction(partyId)` — BrandSupplier + brand info + stats
- `getPartyContactsAction(partyId)`
- `createPartyContactAction(partyId, input)` — tulis ke `PartyContact` + `brand_id` optional
- `updatePartyContactAction(contactId, input)`
- `deletePartyContactAction(contactId)`

---

### UI-Phase 8 — Reusable RelationshipAssigner
**Effort: M | Enabler untuk Phase 3, 4, 7**

Bisa dibangun paralel atau setelah Phase 3 dan 7 selesai sebagai refactor.

Component: `src/subapps/master-data/components/RelationshipAssigner.tsx`

Pattern (spec §AH):
```
[ + Assign ]
  → Search
  → Select
  → Assign (create relation row)

[ ••• ] on existing
  → Remove relationship
  → Confirmation (dengan info apakah ada data terkait)

Search → not found
  → + Create [entity]
  → Minimal quick-entry drawer
  → Return to original workflow
```

Dipakai oleh:
- Assign Supplier to Brand (Brand Detail → Suppliers tab)
- Assign Brand to Supplier (Supplier Detail → Brands tab)
- Brand Scope di Contact modal

---

### UI-Phase 9 — Import/Export enhancement
**Effort: XL | Bisa dikerjakan terakhir**

File baru: `src/app/masterdata/settings/import/page.tsx` atau preview modal di `MasterDataSettingsClient`

Target (spec §AK–AN):

**Export:**
- Workbook multi-sheet: README, BRANDS, PARTIES, PARTY_CONTACTS, BRAND_SUPPLIERS, SKU, SKU_CATEGORIES, SKU_PRICES, WORK_PRICES, PROJECT_REFERENCES, SAMPLES
- Kolom ID hidden (column A, lebar = 0) — tidak dihapus dari workbook
- Backend: extend `exportMasterDataExcel()` di `excel-service.ts`

**Import preview:**
- Upload → server parse → return summary: CREATE / UPDATE / CONFLICT / INVALID / UNCHANGED
- Review page sebelum Apply
- Conflict: tampilkan Excel value vs DB value, tiga pilihan (Keep DB / Use Excel / Manual)
- Apply: jalankan upsert berdasarkan pilihan
- Rules yang sudah dikunci (B-Q3): ID kosong = CREATE, ID ada = UPDATE, row hilang = KEEP (tidak hapus)

**Backend baru:**
- `parseImportPreviewAction(file)` — parse, diff, return summary + conflict details
- `applyImportAction(decisions)` — eksekusi berdasarkan keputusan user

---

## 4. Urutan eksekusi yang disarankan

```
UI-Phase 1  (XS) Nav restructure
    ↓
UI-Phase 2  (S)  Materials/Brands page cleanup
    ↓
UI-Phase 5  (M)  quickCreateSkuAction  ← BLOCKING untuk phase 6
    ↓
UI-Phase 3  (L)  Brand Detail page
    ↓
UI-Phase 6  (L)  Price page redesign
    ↓
UI-Phase 7  (L)  Suppliers page unification
    ↓
UI-Phase 4  (M)  SKU Detail drawer
    ↓
UI-Phase 8  (M)  RelationshipAssigner refactor (opsional, bisa inline dulu)
    ↓
UI-Phase 9  (XL) Import/Export enhancement
```

UI-Phase 5 (quickCreateSkuAction) harus mendahului Phase 6 karena Price modal
membutuhkan "Create SKU" flow. Sisanya bisa dikerjakan berurutan.

---

## 5. Yang TIDAK berubah (jangan disentuh)

- `SkuPrice.recordSkuPrice()` — sudah benar, versioning sudah diimplementasi
- `WorkPrice` backend actions — sudah lengkap
- `quickCreateBrandAction` + `quickCreatePartyAction` — sudah benar
- Soft delete pattern (`deleted_at`) — sudah ada, UI yang perlu diperbaiki
- RBAC matrix — tidak perlu perubahan
- Sample & SampleMovement — schema dan UI sudah berfungsi
- `/masterdata/settings` (Data Tools) — sudah dipindahkan 2026-08-12

---

## 6. Keputusan terbuka (perlu konfirmasi owner sebelum eksekusi)

| # | Pertanyaan | Dampak |
|---|---|---|
| D1 | Brand Detail: route `/masterdata/materials/[brandId]` atau `/masterdata/brands/[brandId]`? | URL structure, breadcrumb |
| D2 | Harga di Brand Detail tab — embedded tabel atau redirect ke `/masterdata/prices?brand=X`? | Scope Phase 3 |
| D3 | Supplier Detail: route `/masterdata/suppliers/[partyId]`? | URL structure |
| D4 | Archive brand yang masih punya SKU — UI memperingatkan tapi tetap boleh archive? | Confirmation dialog copy |
| D5 | Import preview — halaman terpisah atau modal besar? | Scope Phase 9 |
| D6 | Apakah ServiceVendor di Supplier page juga pakai detail page yang sama (Party-based), atau ada perbedaan UI untuk service vendor vs material supplier? | Scope Phase 7 |
