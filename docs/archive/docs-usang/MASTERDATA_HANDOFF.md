# Master Data Subapp — Handoff untuk Codex

**Tanggal:** 30 Juli 2026
**Status:** HANDOFF HISTORIS — tugas UI ini sudah selesai. Jangan gunakan larangan dalam dokumen ini untuk membatalkan keputusan lanjutan yang sudah dicatat di `MASTER_SSOT.md` §6.3–§6.5.
**Pembaruan 30 Juli 2026:** schema split, import legacy `List`, dan import `Sheet1` + halaman `/masterdata/samples` sudah selesai. Keputusan terbaru di `MASTER_SSOT.md` §6.7 membatalkan Offering sebagai domain/halaman tersendiri; kategori kemampuan vendor akan menjadi tags. Model dan 483 row import lama belum dihapus. Harga serta database-role/`GRANT` hardening tetap pekerjaan terpisah.

Salin seluruh dokumen ini sebagai prompt.

---

## 0. ATURAN KERAS — BACA DULU, JANGAN DILANGGAR

Ini bukan saran. Melanggar salah satunya berarti pekerjaan harus dibatalkan.

1. **JANGAN sentuh `prisma/schema.prisma`.** Tidak ada model baru, tidak ada kolom baru, tidak ada migration. Kalau kamu merasa butuh tabel baru, itu tanda tugasnya bukan tugasmu — tulis di bagian "Eskalasi" dan berhenti.
2. **JANGAN sentuh `src/core/rbac/`.** Matriks izin dan matriks akses app sudah final dan sudah diverifikasi script. Termasuk `app-access.ts`, `matrix.ts`, `constants.ts`, `guards.ts`.
3. **JANGAN sentuh `src/auth.ts`, `src/auth.config.ts`, `src/lib/auth.ts`, `src/proxy.ts`.** Gerbang autentikasi sudah benar dan pernah bocor sebelumnya. Jangan diutak-atik.
4. **JANGAN membuat server action / service baru.** Semua yang kamu butuhkan sudah ada di `src/extensions/library/actions/library-actions.ts`. Daftarnya di §3.
5. **JANGAN melakukan operasi tulis apa pun ke database di luar action yang sudah ada.** Tidak ada `prisma.$executeRaw`, tidak ada `deleteMany`, tidak ada seed.
6. **JANGAN membuat cek role di komponen client.** Otorisasi diputuskan di server. Kalau komponen butuh tahu hak akses, terima sebagai prop dari server component. Cek role di client adalah petunjuk tampilan, bukan kontrol.
7. **JANGAN membangun halaman `/masterdata/offerings` dan `/masterdata/prices`.** Dua-duanya butuh tabel yang belum ada (`VendorOffering`, tabel harga). Biarkan pranala-nya mati seperti sekarang.
8. **JANGAN `git commit` dan JANGAN `git push`.**
9. **JANGAN pakai `window.location.reload()`.** Pakai `router.refresh()` dari `next/navigation` (`AGENTS.md` UI Refresh Protocol).
10. **JANGAN pakai nilai visual hardcoded** (`rounded-xl`, `p-5`, `shadow-md`, `text-2xl`). Wajib pakai token. Lihat §5.

11. **PERLAKUKAN WORKING TREE SEBAGAI PEKERJAAN AKTIF MILIK PENGGUNA.** Ini penting.

    Versi pertama dokumen ini menulis bahwa ~457 file "modified" di `git status` hanyalah artefak CRLF. **Itu salah** — kesimpulan digeneralisasi dari satu file sampel. Hasil pemeriksaan sebenarnya, dengan `git diff --ignore-cr-at-eol --ignore-all-space` per file:

    | | Jumlah |
    |---|---:|
    | File modified (di luar yang disentuh handoff ini) | 249 |
    | Whitespace/CRLF saja | 189 |
    | **Punya perubahan nyata dan belum di-commit** | **60** |

    Termasuk di dalam 60 itu: `src/core/rbac/guards.ts` (+13/-3), `src/extensions/library/actions/library-actions.ts` (+151/-29), `src/core/platform/db.ts` (+104/-39), `src/extensions/library/components/LibraryTabs.tsx` (+721/-129), `src/app/api/sketchup/sync/route.ts` (+363/-11).

    Artinya: **ada pekerjaan pengguna yang belum di-commit di file-file yang bersebelahan langsung dengan tugasmu.** Maka:

    - Gunakan edit bertarget (cari string lama → ganti). **Jangan** menulis ulang file utuh.
    - Jangan pernah `git checkout`, `git restore`, `git stash`, atau `git clean`.
    - Sebelum menyentuh file mana pun, jalankan `git diff -- <file>` dan pastikan kamu tidak menghapus baris yang bukan milikmu.
    - Sesudah selesai, pastikan `git diff --numstat` untuk file yang kamu ubah menunjukkan **0 deletion**, kecuali memang kamu sengaja mengganti baris.

---

## 1. Konteks — apa ini dan kenapa ada

StudioFlow adalah main app dan memegang login + identitas. Dua subapp menempel pada session yang sama:

| Route | Subapp | Role pemilik |
|---|---|---|
| `/` | StudioFlow | DIC (desainer), DRIC (drafter) |
| `/masterdata` | Master Data | STAFF (staf administratif) |
| `/bq` | BQ | ESTIMATOR |

Master Data memiliki **identitas supplier, identitas SKU, dan harga**. Desainer hanya **viewer** atas data library dan boleh **request** promosi ke Library; yang meng-approve adalah STAFF atau admin.

Redirect setelah login sudah otomatis per role: STAFF → `/masterdata`, ESTIMATOR → `/bq`, DIC/DRIC → `/`, ADMIN/OWNER → `/` plus pranala ke dua subapp.

**Yang sudah jadi dan jangan diulang:**

- `src/core/rbac/app-access.ts` — SSOT matriks akses
- `src/auth.config.ts` — gerbang route fail-closed
- `src/app/masterdata/layout.tsx` — gerbang server-side + chrome
- `src/app/masterdata/page.tsx` — halaman Overview
- `src/subapps/master-data/components/MasterDataNav.tsx` — header + tab
- `src/app/bq/page.tsx` — stub BQ
- `scripts/verify-access-matrix.mjs` — verifier, saat ini **lulus**

---

## 2. Yang harus kamu bangun

Tiga halaman. Kerjakan **berurutan**, selesaikan satu sebelum mulai berikutnya.

### Tugas A — `/masterdata/vendors` (Vendor & Brand)

File baru: `src/app/masterdata/vendors/page.tsx` (server component) + komponen client di `src/subapps/master-data/components/`.

Tabel vendor dengan kolom:

| Kolom | Sumber |
|---|---|
| Brand | `Vendor.brand_name` |
| Company | `Vendor.company_name` |
| PT | `Vendor.company_pt` |
| Website | `Vendor.website_url` (render sebagai link, `target="_blank"`, `rel="noopener noreferrer"`) |
| IG | `Vendor.instagram_url` (idem) |
| Address | `Vendor.address` |
| Kontak | `Vendor.contacts[]` → tampilkan `contact_person` + `phone_number`, bisa lebih dari satu |

Kemampuan:

- Search berdasarkan `brand_name` / `company_name` (client-side filter cukup; data vendor tidak besar)
- Tombol tambah / edit / hapus vendor
- Modal **wajib read-only dulu** dengan tombol "Modify" (icon `Edit3`) sebagai gatekeeper — ini `AGENTS.md` View-First Protocol, tidak boleh dilewat
- Konfirmasi hapus pakai `AlertDialog` dari `@/components/ui/alert-dialog`, **bukan** `window.confirm`

**Penting soal telepon:** `phone_number` adalah **teks**. Jangan pernah dikonversi ke number, jangan diformat ulang — angka nol di depan akan hilang. Satu field bisa memuat beberapa nomor sekaligus; tampilkan apa adanya.

### Tugas B — `/masterdata/skus` (SKU)

File baru: `src/app/masterdata/skus/page.tsx` + komponen client.

Ini adalah **staff-facing maintenance view** dengan struktur 12 kolom yang dipakai kantor. Urutan kolomnya sudah ditetapkan pemilik data dan **tidak boleh diubah**:

```
No · Brand · Category · Product · Product Link · Drive Folder · Website · IG · Sales · Contact · Company · Update
```

Pemetaan ke data:

| Kolom | Sumber |
|---|---|
| No | nomor urut baris pada tampilan (bukan field database) |
| Brand | `catalog_brand` |
| Category | `catalog_category` |
| Product | `catalog_product_name` |
| Product Link | `catalog_reference_url` |
| Drive Folder | `catalog_folder_url` |
| Website | `vendor.website_url` |
| IG | `vendor.instagram_url` |
| Sales | `vendor.contacts[].contact_person` |
| Contact | `vendor.contacts[].phone_number` |
| Company | `vendor.company_name` ?? `vendor.company_pt` |
| Update | lihat di bawah |

**Kolom `Update` — baca bagian ini utuh sebelum menulis kode.**

Versi pertama dokumen ini menyuruh kamu mengambil aktor dari `AuditLog` sambil mengklaim semua action sudah tersedia. **Itu kontradiksi.** `getProductsAction()` mengembalikan `ProductCatalogWithRelations`, yang hanya memuat `vendor` (beserta `contacts`) dan `physical_samples` — **tidak ada data audit dan tidak ada nama aktor di dalamnya.** Aturan §7 seharusnya membuatmu berhenti dan eskalasi di titik ini.

Blocker itu sudah **diselesaikan untukmu**. Pakai action baru ini:

```ts
import { getProductsLastChangeAction } from "@/subapps/master-data/actions/masterdata-actions";

// Panggil SETELAH getProductsAction, dengan id baris di halaman yang sedang dirender.
const res = await getProductsLastChangeAction({ productIds: items.map((p) => p.id) });
// -> Record<string, { actorName: string | null; at: string | null; action: string | null }>
```

Kenapa action terpisah dan bukan memperluas `getProductsAction`: action itu dipakai juga oleh UI Library, schedule bridge, dan SketchUp. Mengubah bentuk payload-nya berisiko ke tiga tempat sekaligus.

Aturan render kolomnya:

| Kondisi | Tampilkan |
|---|---|
| Ada entri untuk id itu | nama aktor + waktu dari `at` |
| Tidak ada entri (id absen dari hasil) | tanda hubung `—`, **muted** |
| `updated_at` null tapi ada audit | pakai data audit; itu yang lebih akurat |
| `updated_at` null dan tidak ada audit | fallback ke `created_at`, **muted**, dengan label eksplisit bahwa itu tanggal data masuk — bukan tanggal pembaruan |

Larangan keras:

- **JANGAN** menampilkan tanggal import sebagai tanggal pembaruan historis.
- **JANGAN** mengarang aktor. `"System"`, `"—"` sebagai nama, UUID, atau nama Jessica semuanya dilarang. Absen berarti tidak diketahui.
- **JANGAN** menganggap "absen dari hasil" sebagai "belum pernah berubah". Itu tidak diketahui, dan bedanya penting.
- `action` yang dikembalikan (`CATALOG_CREATE` / `CATALOG_UPDATE` / `CATALOG_DELETE`) membedakan "dibuat" dari "diedit". Pakai itu; jangan melabeli semuanya "updated".

Catatan kalau kamu penasaran ingin query sendiri: **jangan.** `AuditLog` tidak punya foreign key ke `ProductCatalog` — sambungannya lewat `entity_type` + `entity_id` sebagai string biasa, dan penulisnya tidak konsisten kapitalisasi (`"ProductCatalog"` PascalCase untuk produk, tapi `"VENDOR"` UPPERCASE untuk vendor). Salah satu huruf dan query balik nol baris tanpa error. Konstanta `AUDIT_ENTITY` di action itu sudah diverifikasi terhadap call site sebenarnya.

Kemampuan lain: search, filter brand/kategori/status, dan paginasi ber-window (jangan render satu tombol per halaman).

### Tugas C — `/masterdata/promotions` (Promotion Queue)

File baru: `src/app/masterdata/promotions/page.tsx` + komponen client.

Antrian approval dari desainer. Daftar `PromotionRequest` dengan `status = "PENDING"`, plus tombol Approve / Reject dengan kolom catatan opsional.

- Approve/Reject **wajib** lewat `reviewPromotionRequestAction`
- Setelah aksi, panggil `router.refresh()`
- Tampilkan siapa yang request dan kapan
- Kalau antrian kosong, tampilkan empty state yang tenang — jangan tabel kosong tanpa penjelasan

---

## 3. Server action yang WAJIB kamu pakai (semua sudah ada)

Semua di `src/extensions/library/actions/library-actions.ts`. Jangan bikin yang baru.

**Hak akses (panggil ini DULU, sebelum query baris):**
```ts
getMyLibraryAccessAction()   // -> LibraryAccess, resolusi hak server-side
```
Pakai hasilnya untuk memutuskan tombol mana yang dirender. Jangan pernah menawarkan afordansi untuk aksi yang akan ditolak server.

**Vendor:**
```ts
getVendorsAction()                                    // list + contacts
createVendorAction(input)
updateVendorAction({ id, data })
deleteVendorAction({ id })
mergeVendorsAction({ sourceVendorId, targetVendorId })
```

**Produk / SKU:**
```ts
getProductsAction(filters)                            // paginated
getProductMetadataAction()                            // subCategories, finishings, tags
getLibraryCategoriesAction() / getGroupedCategoriesAction()
getBrandCategoryCoverageAction()
createProductAction(input)
updateProductAction({ id, data })
deleteProductAction({ id })
```

**Promotion queue:**
```ts
getPromotionRequestsAction()
reviewPromotionRequestAction({ requestId, action, notes })
```

**Master Data (read-only, baru — satu-satunya action yang bergerbang `MASTERDATA_*`):**
```ts
// src/subapps/master-data/actions/masterdata-actions.ts
getProductsLastChangeAction({ productIds })   // -> aktor + waktu perubahan terakhir per produk
```

Kalau kamu merasa butuh action yang tidak ada di daftar ini — **berhenti dan eskalasi**. Jangan bikin sendiri.

### ⚠️ Catatan arsitektur yang harus kamu pahami, bukan diperbaiki

Semua action vendor / SKU / promosi di atas masih bergerbang pada permission **`LIBRARY_*`** yang lama (`assertLibraryPermission`, ~20 call site), bukan pada `MASTERDATA_*` yang baru. Saat ini hasilnya benar, karena STAFF memegang kedua set. Tapi secara arsitektur otorisasi Master Data masih **kebetulan selaras**, belum benar-benar ditegakkan.

Konsekuensi praktis untukmu:

- **Tetap pakai `getMyLibraryAccessAction()`** untuk memutuskan tombol mana yang dirender. Itu yang cocok dengan gerbang server yang sesungguhnya. Jangan menebak dari `MASTERDATA_*`.
- **JANGAN** mencoba mengganti gerbang `LIBRARY_*` menjadi `MASTERDATA_*`. `library-actions.ts` dipakai bersama oleh UI Library, schedule bridge, dan SketchUp — migrasinya butuh pemecahan file dan urutan tertentu. Di luar lingkupmu. Rencananya ada di `MASTER_SSOT.md` §6.2 poin 8.

---

## 4. Pola yang wajib diikuti

**Baca dulu sebagai contoh** (jangan disalin buta, tapi ikuti polanya):

- `src/extensions/library/components/catalog/ProductTableView.tsx` — pola tabel padat
- `src/extensions/library/components/VendorTable.tsx` — pola tabel vendor
- `src/extensions/library/components/LibraryFormModal.tsx` — pola modal View-First

**Struktur:**

- Server component (`page.tsx`) mengambil data dan hak akses, lalu melempar ke komponen client sebagai prop
- Komponen client hanya menangani interaksi
- Simpan komponen di `src/subapps/master-data/components/`, bukan di `src/components/`
- Tambahkan `error.tsx` dan `loading.tsx` di setiap route baru. Route Library sebelumnya tidak punya error boundary sama sekali dan itu tercatat sebagai temuan audit P0 — jangan ulangi

**Nama field Zod harus identik dengan schema Prisma** (`catalog_category`, bukan `category`). Ini `AGENTS.md` Zod Schema Namespacing.

---

## 5. Design token — nol hardcode

Cek `src/ui_engine/design-system.config.ts` dan `src/styles/designTokens.css` sebelum menulis CSS.

Token yang tersedia dan sudah dipakai di subapp ini:

```
--ui-radius-action   --ui-radius-card    --ui-radius-control   --ui-radius-pill
--ui-border-default  --ui-border-focus   --ui-border-subtle    --ui-border-width
--ui-surface-bg      --ui-surface-raised --ui-surface-shadow
--ui-text-primary    --ui-text-secondary --ui-text-tertiary    --ui-text-inverse
```

Tipografi: `font-serif` (Lora) untuk heading, `font-sans` (Inter) untuk UI.

Jangan menambah shadow berlebih, animasi kompleks, atau font dekoratif baru. `AGENTS.md` UI/UX Preservation Protocol: pertahankan fungsi di atas hiasan. Kalau token yang kamu butuh tidak ada, pakai yang paling dekat — **jangan menebak nilai baru**.

Catat setiap perubahan UI di `CHANGELOG.md` bagian `## UI Changes`.

---

## 6. Verifikasi sebelum kamu menyatakan selesai

Jalankan semuanya. Semua harus lulus.

```bash
node scripts/verify-access-matrix.mjs     # harus: "✓ All invariants hold."
npx prisma generate                        # wajib sebelum typecheck
npx tsc --noEmit                           # harus exit 0
npx eslint <file-file yang kamu ubah>      # harus 0 errors
```

Baseline saat ini: `tsc` exit 0, dan `eslint` 0 error dengan 4 warning yang **sudah ada sebelumnya** (`footerTheme` tidak terpakai di `(dashboard)/layout.tsx`, dua `react-hooks/exhaustive-deps` dan satu `effectiveActiveIndex` di `top-header.tsx`). Jangan menambah warning baru, dan jangan "memperbaiki" empat itu — di luar lingkup.

Cek manual per role. Login sebagai masing-masing dan pastikan:

| Role | Harus mendarat di | Harus TIDAK bisa |
|---|---|---|
| STAFF | `/masterdata` | `/bq` |
| ESTIMATOR | `/bq` | `/`, `/masterdata` |
| DIC | `/` | `/masterdata`, `/bq` |
| DRIC | `/` | `/masterdata`, `/bq` |
| ADMIN / OWNER | `/` | — (semua boleh) |

Akses yang tidak diizinkan harus **redirect ke landing route role itu**, bukan 403 dan bukan halaman kosong.

---

## 7. Eskalasi — berhenti dan tanya, jangan menebak

Hentikan pekerjaan dan laporkan kalau kamu menemui salah satu dari ini:

- Kamu merasa butuh tabel, kolom, atau migration baru
- Kamu merasa butuh server action yang tidak ada di §3
- Kamu merasa butuh mengubah apa pun di `src/core/rbac/` atau lapisan auth
- Ada field wajib di schema yang tidak punya sumber data nyata (jangan isi `N/A`, `Unknown`, `-`, atau placeholder apa pun — ini aturan integritas data yang eksplisit di proyek ini)
- Ada yang terasa perlu menghapus atau menimpa data yang sudah ada

**Konteks penting soal placeholder:** proyek ini punya sejarah data terkontaminasi nilai karangan (`catalog_color = "N/A"` di 736 baris staging, SKU `LEGACY-*`, `contact_role` yang difabrikasi). Semua itu ditolak. Kalau UI-mu butuh nilai yang tidak ada di database, tampilkan keadaan kosong yang jujur — jangan diisi.

---

## 8. Di luar lingkup — jangan dikerjakan

- `/masterdata/offerings` — model sudah ada, tetapi service/action/UI belum dirancang
- `/masterdata/prices` — butuh tabel harga yang belum ada
- Import `List` workbook legacy — selesai; `Sheet1` tetap jalur terpisah
- Pemisahan schema PostgreSQL (`studioflow` / `master_data` / `bq`) — selesai; role/login database dan `GRANT` belum
- Menghapus `ProductCatalog.catalog_price` — dipakai `schedule-service.ts` di enam tempat, perubahan berisiko sendiri
- Mengubah `LEGACY_LIBRARY_ACCESS_FOR_STAFF` menjadi `false` — hanya setelah tiga halaman di atas selesai, dan itu keputusan pemilik
