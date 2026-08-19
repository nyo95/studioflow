# Review UI/UX StudioFlow — 2026-08-12

> **⚠️ Satu bagian dokumen ini sudah kedaluwarsa (per 2026-08-14).**
> Setiap penyebutan **View-First Protocol** dan tombol **"Modify"** (§4 tabel
> komponen, §Pola UI poin 1, §Kekuatan) menggambarkan keadaan pada 12 Agustus.
> Protokol itu **dicabut owner 2026-08-14** dan diganti Edit-First + exit guard;
> lihat `AGENTS.md` §Edit-First dan changelog #18.
>
> Isi dokumen sengaja TIDAK disunting. Mengubah catatan lama supaya cocok dengan
> keadaan sekarang adalah mengarang riwayat — konvensi yang sama dipakai
> `changelog.md`.

Dokumen ini merupakan hasil analisis struktur halaman dan UI/UX StudioFlow berdasarkan `CHANGELOG.md` terbaru (Siklus 2026-08-10 s.d. 2026-08-12) serta inspeksi kode di `src/app` dan `src/subapps`.

---

## 1. Ringkasan Siklus Terbaru (CHANGELOG 2026-08-12)

Siklus terbaru berfokus pada **Redesain UX Master Data (Fase 1–9)**. Berikut adalah entri-entries signifikan yang mempengaruhi UI/UX:

| Tanggal | Entri | Jenis Pekerjaan | Dampak UI/UX |
|---------|-------|-----------------|--------------|
| 2026-08-12 | `#9` Full execute UX redesign Master Data (Phase 1–9) | **FITUR UI BESAR** | Rute baru, komponen baru, navigasi berubah |
| 2026-08-12 | `#8` Plan UX redesign Master Data (spec §A–AO) | DOKUMENTASI PLAN | Gap analysis untuk UI |
| 2026-08-12 | `#7` Implementasi UI-CON-5: Import/Export ke Settings | **FITUR UI** | Pemindahan fitur global ke Settings |
| 2026-08-12 | `#6` Analisa UI/UX inkonsistensi Master Data | ANALISA | Temuan cacat bahasa & placement |
| 2026-08-12 | `#5` Audit balik Batch #1: 7 perbaikan | KOREKSI | Perbaikan search, sort, pagination |
| 2026-08-12 | `#4` Batch #1 eksekusi: Fase 1.0–2.4 | EKSEKUSI KODE | Slugify, audit trail, grain-Brand |

### Perubahan Utama UI/UX (Entri #9)

**File Baru:**
- `src/app/masterdata/materials/[brandId]/page.tsx` — Brand Detail server page
- `src/subapps/master-data/components/BrandDetailClient.tsx` — Brand Detail (4 tab: Overview, SKUs, Suppliers, Prices)
- `src/subapps/master-data/components/SkuDetailDrawer.tsx` — Right-side SKU detail drawer
- `src/app/masterdata/suppliers/[partyId]/page.tsx` — Supplier Detail server page
- `src/subapps/master-data/components/SupplierDetailClient.tsx` — Supplier Detail (4 tab: Overview, Brands, Prices, Contacts)

**Perubahan Navigasi (Phase 1):**
- Nav Master Data baru: Materials, Suppliers, Prices, Samples + divider + Data Tools
- Label tombol diubah: "Add Material" → "Tambah Material"

**Fitur Baru:**
- Brand Detail page dengan rute `/masterdata/materials/[brandId]`
- Supplier Detail page dengan rute `/masterdata/suppliers/[partyId]`
- Import results card inline (menggantikan bare toast)
- `quickCreateSkuAction` (Phase 5)

### Temuan Inkonsistensi (Entri #6)

| # | Temuan | Jenis | Lokasi |
|---|--------|-------|--------|
| UI-CON-1 | Bahasa campur EN/ID di tombol | Cacat | Supplier, Materials |
| UI-CON-2 | Tombol CTA di dalam search bar | Cacat | Supplier/Services |
| UI-CON-3 | Header kolom tidak konsisten | Cacat | Supplier/Services, Materials |
| UI-CON-4 | Stats strip tidak standar | Preferensi | Supplier, Materials |
| UI-CON-5 | Import/Export di page header | Preferensi | Materials (sudah dipindah ke Settings) |

---

## 2. Struktur Halaman (Page Hierarchy)

### 2.1 Root Layout (`src/app/layout.tsx`)
- **Providers**: `HydrationProvider`, `AuthProvider`, `LayoutClient`
- **Fonts**: Inter (sans-serif untuk UI) + Lora (serif untuk heading)
- **Metadata**: Title "StudioFlow", description "RAD SAAS workspace"
- **Styling**: Full-height `h-screen overflow-hidden`, antialiased, design-system canvas class

### 2.2 Route Groups

| Route | Tipe | Deskripsi |
|-------|------|-----------|
| `/(dashboard)/` | **Route Group (tanpa URL segment)** | Shell autentikasi utama — StudioFlow core app |
| `/masterdata/` | **Named Route** | Sub-aplikasi Master Data (layout terpisah) |
| `/login/` | **Named Route** | Halaman autentikasi / Login |
| `/bq/` | **Named Route** | BQ (Bill of Quantities) stub entry point |
| `/api/` | **API Routes** | Backend API endpoints |

### 2.3 `(dashboard)` — StudioFlow Core

**Layout**: `src/app/(dashboard)/layout.tsx`
- Auth-gated (checks `canEnterApp(role, APP.STUDIOFLOW)`)
- Fetches: `SystemConfig`, `ProjectSearchItems`, `RecentActivityLogs`
- Renders: `TopHeader` + `NavOuter` (vertical sidebar) + footer
- Uses `SidebarProvider` context

#### Sub-Routes:

| Path | Page File | Purpose |
|------|-----------|---------|
| `/` | `(dashboard)/page.tsx` | **Tasks** — By-project workload view |
| `/projects` | `projects/page.tsx` | **Projects List** — Semua proyek |
| `/projects/[id]` | `projects/[id]/page.tsx` | **Project Detail** — Tampilan proyek tunggal |
| `/projects/[id]/activity` | `projects/[id]/activity/page.tsx` | **Project Activity Log** |
| `/projects/[id]/deliverables` | `projects/[id]/deliverables/page.tsx` | **Deliverables** management |
| `/projects/[id]/mom` | `projects/[id]/mom/page.tsx` | **Minutes of Meeting** list |
| `/projects/[id]/mom/[momId]` | `projects/[id]/mom/[momId]/page.tsx` | **MoM Detail** view |
| `/projects/[id]/mom/[momId]/print` | `projects/[id]/mom/[momId]/print/page.tsx` | **MoM Print** layout |
| `/projects/[id]/phases/[phaseId]` | `projects/[id]/phases/[phaseId]/page.tsx` | **Phase Detail** — Checklists/tasks |
| `/projects/[id]/sketchup` | `projects/[id]/sketchup/page.tsx` | **SketchUp Integration** |
| `/projects/[id]/sketchup/catalog` | `projects/[id]/sketchup/catalog/page.tsx` | **SketchUp Material Catalog** |
| `/projects/[id]/extensions/product-catalog` | `projects/[id]/extensions/product-catalog/page.tsx` | **Project Product Catalog** |
| `/upcoming` | `upcoming/page.tsx` | **Upcoming Tasks** — Date-based view |
| `/library` | `library/page.tsx` | **Library** — Shared materials |
| `/extensions/library` | `extensions/library/page.tsx` | **Extensions Library** |
| `/activity` | `activity/page.tsx` | **Global Activity Center** |
| `/activity-center` | `activity-center/page.tsx` | **Activity Center** (alternate) |
| `/settings` | `settings/page.tsx` | **Settings** root |
| `/settings/profile` | `settings/profile/page.tsx` | **Profile Settings** |
| `/settings/studio` | `settings/studio/page.tsx` | **Studio Settings** |
| `/settings/clients` | `settings/clients/page.tsx` | **Client Management** |
| `/settings/database` | `settings/database/page.tsx` | **Database Settings** |

#### Project Layout (`projects/[id]/layout.tsx`):
- Fetches project + phases from Prisma
- Renders `ProjectLayoutShell` with phase navigation
- Wraps children in `ProjectLiveProvider` for live collaboration
- Includes `ProjectChatSidebar` (right sidebar) for real-time chat

### 2.4 `/masterdata` — Master Data Sub-Application

**Layout**: `src/app/masterdata/layout.tsx`
- Auth-gated (checks `canEnterApp(role, APP.MASTERDATA)`)
- Same chrome as StudioFlow: `TopHeader` + `MasterDataNavOuter` (separate sidebar component)
- Links to StudioFlow and BQ in subapp navigation

#### Sub-Routes (Termasuk Perubahan Terbaru):

| Path | Page File | Purpose |
|------|-----------|---------|
| `/masterdata` | `masterdata/page.tsx` | **Master Data Hub** — Landing/dashboard |
| `/masterdata/materials` | `masterdata/materials/page.tsx` | **Materials** — Material catalog list (Brand grain landing) |
| `/masterdata/materials/[brandId]` | `masterdata/materials/[brandId]/page.tsx` | **Brand Detail** — (BARU) 4 tab: Overview, SKUs, Suppliers, Prices |
| `/masterdata/suppliers` | `masterdata/suppliers/page.tsx` | **Suppliers** — Unified Party table |
| `/masterdata/suppliers/[partyId]` | `masterdata/suppliers/[partyId]/page.tsx` | **Supplier Detail** — (BARU) 4 tab: Overview, Brands, Prices, Contacts |
| `/masterdata/samples` | `masterdata/samples/page.tsx` | **Samples** — Physical sample tracking |
| `/masterdata/prices` | `masterdata/prices/page.tsx` | **Price List** management (3 tabs: Material Prices, M+L, Labour) |
| `/masterdata/settings` | `masterdata/settings/page.tsx` | **Master Data Settings** — Import/Export (BARU) |

### 2.5 `/login` — Authentication

| Path | Page File | Purpose |
|------|-----------|---------|
| `/login` | `login/page.tsx` | **Login Form** — Full-page centered login |

### 2.6 `/bq` — BQ Stub

| Path | Page File | Purpose |
|------|-----------|---------|
| `/bq` | `bq/page.tsx` | **BQ Entry Stub** — Placeholder page (BQ is a separate app) |

---

## 3. Arsitektur Komponen Master Data

### 3.1 Navigasi & Layout

| Komponen | Path | Fungsi |
|----------|------|--------|
| **MasterDataNavOuter.tsx** | `src/subapps/master-data/components/` | Vertical sidebar dengan icon navigation. Desktop: fixed 78px icon-only sidebar. Mobile: slide-in drawer dengan labels. |
| **MasterDataNav.tsx** | `src/subapps/master-data/components/` | Top header bar. Menampilkan app title "Master Data", nav links, user avatar, StudioFlow back-link. |

**Nav entries (per 2026-08-12):**
- Materials → `/masterdata/materials` (brand grain landing + SKU table)
- Suppliers → `/masterdata/suppliers` (unified Party table)
- Prices → `/masterdata/prices` (SkuPrice + WorkPrice)
- Samples → `/masterdata/samples` (Sample + SampleMovement)
- Data Tools → `/masterdata/settings` (Import/Export, visually separated at bottom)

### 3.2 Route-Level Utilities

| Komponen | Fungsi |
|----------|--------|
| **MasterDataRouteLoading.tsx** | Skeleton loader untuk route transitions |
| **MasterDataRouteError.tsx** | Error boundary UI dengan retry button |

### 3.3 Page-Level Client Components (5 Main Screens)

#### 1. Materials Page (Brand Landing + SKU Table)
**File:** `MasterDataMaterialsClient.tsx` (932 lines)

Beroperasi dalam **dua mode** yang dikontrol oleh `isBrandLandingView()`:

- **Brand Landing View** (default): Tabel brands dengan category tags, SKU counts, supplier counts, dan completeness badges. Baris diklik untuk navigasi ke brand detail. Mendukung inline SKU expansion.
- **SKU Table View** (ketika filter aktif): Tabel flat materials dengan kolom Brand, Category Tags, SKU/Product, Price, Link.

**Pola UI kunci:**
- `StatChip` untuk aggregate counts
- Brand expansion dengan lazy fetch via `getSkusForBrandAction`
- Search + 4 filter dropdowns (price, vendor, category, sort)
- Pagination dengan page count

#### 2. Supplier Page (Party Table)
**File:** `SupplierClient.tsx` (865 lines)

Unified table perusahaan/parties dengan roles. Berisi dua tab logis dalam satu halaman:

- **Material tab**: Tabel perusahaan dengan inline role badges, brand counts, contacts
- **Jasa (Services) tab**: ServiceVendor CRUD dengan dialog sendiri

#### 3. Pricing Page (3 Tabs)
**File:** `PricingClient.tsx` (1063+ lines)

Tiga tab yang memetakan ke dua tabel v2:

| Tab | Database Table | Fungsi |
|-----|---------------|--------|
| Material Prices | `SkuPrice` | Satu baris current per SKU x supplier, dengan history |
| Material + Labour | `WorkPrice (MATERIAL_LABOR)` | Combined price packages |
| Labour Prices | `WorkPrice (LABOR_ONLY)` | Service labour rates |

#### 4. Sample Library Page
**File:** `SampleLibraryClient.tsx` (766 lines)

Manajemen rack sampel fisik dengan dua view modes:

- **Per rak (shelf view)**: Grouped by rack
- **Daftar (list view)**: Flat table untuk searching dan auditing

#### 5. Settings Page (Data Tools)
**File:** `MasterDataSettingsClient.tsx` (223 lines)

Operasi Import/Export untuk bulk SKU + pricing data via Excel.

### 3.4 Detail / Tab Pages (2 Detail Views — BARU)

#### Brand Detail
**File:** `BrandDetailClient.tsx` (535 lines)

Empat tab: Overview, SKUs, Suppliers, Prices

- **Overview**: Brand name, owner, categories, completeness
- **SKUs**: Paginated table dengan search, membuka `SkuDetailDrawer` saat diklik
- **Suppliers**: Assign/unassign suppliers dengan dialog
- **Prices**: Link-through ke Prices page

#### Supplier (Party) Detail
**File:** `SupplierDetailClient.tsx` (453 lines)

Empat tab: Overview, Brands, Prices, Contacts

- **Overview**: Trading name, legal name, roles, address
- **Brands**: Tabel associated brands dengan SKU/price counts
- **Prices**: Link-through ke Prices page
- **Contacts**: Full CRUD untuk party contacts

### 3.5 Dialogs & Drawers

| Komponen | Fungsi |
|----------|--------|
| **MasterDataProductDialog.tsx** | Material create/edit dialog (862 lines). View-First protocol: opens read-only with "Modify" button. |
| **MasterDataBrandDialog.tsx** | Brand create/edit sheet (side panel, 529 lines). |
| **PartyDialog.tsx** | Party/Company create/edit dialog (535 lines). |
| **SampleRequestDialog.tsx** | Sample request processing dialog (636 lines). |
| **SkuDetailDrawer.tsx** | Read-only SKU detail side panel (144 lines). **BARU** |
| **SampleRequestPanel.tsx** | Request feed panel (not a dialog, 283 lines). |

### 3.6 Picker Components

| Komponen | Fungsi |
|----------|--------|
| **MasterDataBrandPicker.tsx** | Brand search + quick create |
| **PartyPicker.tsx** | Party/Company search + quick create |
| **WorkVendorPicker.tsx** | Service vendor search + quick create |
| **SkuPicker.tsx** | SKU search (NO quick entry) |

---

## 4. Analisis UI/UX

### 4.1 Pola Desain yang Konsisten

1. **View-First Protocol**: Semua dialog edit (Product, Brand, Party, MaterialPrice) terbuka dalam mode read-only secara default. Tombol "Modify" (icon Edit3) menjadi gatekeeper untuk masuk ke mode edit.

2. **Design Token Compliance**: Semua komponen menggunakan CSS variables (`--ui-section-gap`, `--ui-radius-control`, `--ui-border-subtle`, dll.) dan design system tokens (`UI_ENGINE_RADIUS_ACTION`, `UI_ENGINE_TYPE_H3`, dll.) alih-alih nilai hardcoded.

3. **Quick Entry Pattern**: Hook `useQuickEntry` menyediakan inline entity creation dari dropdown picker. Menghindari context-switching saat entity yang dibutuhkan belum ada.

4. **Optimistic Updates**: Operasi CRUD kebanyakan update local state segera, lalu panggil `router.refresh()` untuk server reconciliation.

5. **History-Aware Pricing**: Material Prices menggunakan model supersede-on-edit. Editing membuat baris baru dan archive baris lama.

6. **Consistent Empty States**: Setiap tabel memiliki empty state contextual dengan icon dan deskripsi.

7. **Status Badges**: Color-coded pill badges untuk sample status (green/amber/blue) dan request status (slate/amber/emerald/rose).

### 4.2 Temuan Masalah (Berdasarkan AUDIT-UX 2026-08-10)

| # | Temuan | Jenis | Dampak |
|---|--------|-------|--------|
| 1 | Tidak ada `error.tsx` di seluruh StudioFlow (kecuali Master Data) | **CACAT** | Tinggi |
| 2 | Tidak ada `not-found.tsx`; 10 halaman memanggil `notFound()` | **CACAT** | Tinggi |
| 3 | Bahasa campur EN/ID, kadang dalam satu halaman | **CACAT** | Tinggi |
| 4 | 14 `confirm()` bawaan browser untuk aksi merusak | **CACAT** | Sedang |
| 5 | 38 `catch` yang hanya `console.error` | **CACAT** | Sedang |
| 6 | StudioFlow punya 1 `loading.tsx` untuk 21 halaman | **CACAT** | Sedang |
| 7 | 11 tabel tanpa `minWidth` → gepeng di layar sempit | **CACAT** | Sedang |
| 8 | Dua kotak pencarian di halaman Projects | Preferensi | Sedang |
| 9 | Kapitalisasi judul tidak konsisten | Preferensi | Rendah |
| 10 | Sidebar ikon tanpa label, 2 item mati | Preferensi | Sedang |

**Rekomendasi Prioritas:** Perbaiki nomor 1, 2, dan 3 terlebih dahulu karena murah dan menyentuh setiap halaman.

### 4.3 Inkonsistensi Terbaru (Entri #6)

| # | Temuan | Lokasi |
|---|--------|--------|
| UI-CON-1 | Bahasa campur EN/ID di tombol | Supplier, Materials |
| UI-CON-2 | Tombol CTA di dalam search bar | Supplier/Services |
| UI-CON-3 | Header kolom tidak konsisten | Supplier/Services, Materials |
| UI-CON-4 | Stats strip tidak standar | Supplier, Materials |

**Keputusan yang diambil:**
- **UI-CON-5 (Import/Export):** Dipindah ke `/masterdata/settings` (Opsi A) karena operasinya global, bukan kontekstual per tampilan.

---

## 5. Kesimpulan

Siklus 2026-08-12 menandai perubahan signifikan pada UI/UX Master Data dengan penambahan detail pages (Brand & Supplier), perbaikan navigasi, dan pemindahan fitur global ke Settings. Namun, masih ada beberapa temuan cacat yang perlu ditangani dari audit UX sebelumnya, terutama terkait error handling, 404 pages, dan konsistensi bahasa.

Struktur halaman sudah mengikuti pola yang baik dengan:
- Defense-in-depth auth di setiap layout
- Konsistensi design tokens
- Pola View-First untuk edit dialogs
- Loading states dan error boundaries di level yang tepat

**Rekomendasi Selanjutnya:**
1. Implementasi `error.tsx` dan `not-found.tsx` di `(dashboard)/`
2. Standardisasi bahasa UI ke Indonesia (kecuali istilah domain)
3. Penambahan `minWidth` pada tabel yang gepeng
4. Penggantian `confirm()` bawaan browser dengan custom dialog
