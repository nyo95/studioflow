# Prompt Eksekusi — Codex (Master Data UI)

Salin seluruh isi di bawah garis ini sebagai prompt.

---

Kamu adalah executor untuk membangun tiga halaman UI di subapp **Master Data** pada project StudioFlow (`D:\Misc\ProjectsHUB\studioflow`).

Lapisan otorisasi, routing, dan gerbang akses **sudah selesai dan sudah diverifikasi**. Tugasmu murni presentational: merender data dan menyambungkannya ke server action yang sudah ada. Kamu tidak perlu menulis service, migration, atau query Prisma baru.

## Langkah 0 — Baca dulu, jangan langsung koding

Baca berurutan, jangan dilewat:

1. `MASTERDATA_HANDOFF.md` — **spesifikasi lengkap tugasmu.** Ini dokumen otoritatif. Kalau ada yang bertentangan antara prompt ini dan handoff itu, handoff yang menang.
2. `AGENTS.md` — protokol wajib project (View-First, Zero Hardcode, UI Refresh, Zod Namespacing).
3. `MASTER_SSOT.md` §6.1 dan §6.2 — matriks izin dan matriks akses app. Perhatikan §6.2 poin 8.
4. `src/core/rbac/app-access.ts` — baca saja untuk paham, jangan diubah.

Lalu baca tiga file ini sebagai contoh pola yang harus kamu ikuti:

- `src/extensions/library/components/catalog/ProductTableView.tsx`
- `src/extensions/library/components/VendorTable.tsx`
- `src/extensions/library/components/LibraryFormModal.tsx`

Setelah selesai membaca, **konfirmasi dulu** dengan menuliskan ringkasan: apa yang akan kamu bangun, action apa saja yang akan kamu pakai, dan file apa saja yang akan kamu buat. Jangan menulis kode sebelum itu.

## Larangan keras

Melanggar salah satu ini berarti pekerjaan dibatalkan.

1. **JANGAN sentuh `prisma/schema.prisma`.** Tidak ada model, kolom, atau migration baru.
2. **JANGAN sentuh `src/core/rbac/`** (`app-access.ts`, `matrix.ts`, `constants.ts`, `guards.ts`, `permissions.ts`).
3. **JANGAN sentuh `src/auth.ts`, `src/auth.config.ts`, `src/lib/auth.ts`, `src/proxy.ts`.** Lapisan ini pernah bocor dan baru diperbaiki.
4. **JANGAN membuat server action atau service baru.** Semua sudah ada — daftarnya di §3 handoff.
5. **JANGAN mengubah gerbang `LIBRARY_*` menjadi `MASTERDATA_*`.** Baca `MASTER_SSOT.md` §6.2 poin 8. Itu migrasi terpisah, bukan tugasmu.
6. **JANGAN cek role di komponen client.** Otorisasi diputuskan di server dan diteruskan sebagai prop.
7. **JANGAN bangun `/masterdata/offerings` dan `/masterdata/prices`.** Tabelnya belum ada. Biarkan pranalanya mati.
8. **JANGAN `git commit`, `git push`, `git checkout`, `git restore`, `git stash`, atau `git clean`.**
9. **JANGAN pakai `window.location.reload()`** — pakai `router.refresh()`.
10. **JANGAN pakai nilai visual hardcoded** (`rounded-xl`, `p-5`, `shadow-md`, `text-2xl`). Wajib token.
11. **JANGAN mengisi field kosong dengan placeholder.** Tidak ada `N/A`, `Unknown`, `-`, `System`, gambar placeholder, atau tanggal karangan. Data kosong dirender kosong.

## Working tree — hati-hati, ada kerja pengguna yang belum di-commit

`git status` menampilkan ratusan file "modified". **Itu bukan semuanya artefak CRLF.** Dari 249 file, 189 memang whitespace saja, tapi **60 punya perubahan nyata yang belum di-commit** — termasuk `src/core/rbac/guards.ts`, `src/extensions/library/actions/library-actions.ts`, `src/core/platform/db.ts`, `src/extensions/library/components/LibraryTabs.tsx`, dan `src/app/api/sketchup/sync/route.ts`.

Artinya ada pekerjaan aktif pengguna di file yang bersebelahan langsung dengan tugasmu. Maka:

- Gunakan **edit bertarget** (cari string lama → ganti). Jangan menulis ulang file utuh.
- Sebelum menyentuh file apa pun, jalankan `git diff -- <file>` dan pastikan kamu tidak menghapus baris yang bukan milikmu.
- Setelah selesai, `git diff --numstat -- <file>` untuk file yang kamu ubah harus menunjukkan **0 deletion**, kecuali kamu memang sengaja mengganti baris.

## Tugas — kerjakan berurutan, selesaikan satu sebelum lanjut

### Tugas A — `/masterdata/vendors`

Buat `src/app/masterdata/vendors/page.tsx` (server component), plus `error.tsx` dan `loading.tsx`. Komponen client di `src/subapps/master-data/components/`.

Tabel vendor: Brand, Company, PT, Website, IG, Address, Kontak (bisa lebih dari satu per vendor).

- Search `brand_name` / `company_name`
- Tambah / edit / hapus vendor
- Modal **wajib read-only dulu**, tombol "Modify" (icon `Edit3`) sebagai gatekeeper — `AGENTS.md` View-First Protocol
- Konfirmasi hapus pakai `AlertDialog`, bukan `window.confirm`
- **`phone_number` adalah teks.** Jangan pernah dikonversi ke number atau diformat ulang — nol di depan akan hilang. Satu field bisa memuat beberapa nomor; tampilkan apa adanya.

Action: `getVendorsAction`, `createVendorAction`, `updateVendorAction`, `deleteVendorAction`, `mergeVendorsAction`.

### Tugas B — `/masterdata/promotions`

Antrian approval dari desainer. Daftar `PromotionRequest` status `PENDING`, dengan Approve / Reject dan kolom catatan opsional.

- Wajib lewat `reviewPromotionRequestAction`
- Setelah aksi, `router.refresh()`
- Tampilkan siapa yang request dan kapan
- Empty state yang jelas kalau antrian kosong

Action: `getPromotionRequestsAction`, `reviewPromotionRequestAction`.

### Tugas C — `/masterdata/skus`

Staff-facing maintenance view, struktur 12 kolom kantor. **Urutan kolom sudah ditetapkan pemilik data dan tidak boleh diubah:**

```
No · Brand · Category · Product · Product Link · Drive Folder · Website · IG · Sales · Contact · Company · Update
```

Pemetaan lengkap ada di §2 Tugas B handoff. Plus search, filter brand/kategori/status, dan paginasi ber-window (jangan satu tombol per halaman).

**Kolom `Update` — baca §2 handoff bagian ini utuh sebelum koding.** Ringkasnya: aktor **tidak** ada di `getProductsAction`. Pakai action khusus yang sudah disediakan:

```ts
import { getProductsLastChangeAction } from "@/subapps/master-data/actions/masterdata-actions";
const res = await getProductsLastChangeAction({ productIds: items.map((p) => p.id) });
```

Id yang absen dari hasil berarti **tidak diketahui**, bukan "belum pernah berubah". Render tanda hubung muted. Jangan mengarang aktor, dan jangan menyajikan tanggal import sebagai tanggal pembaruan.

Action: `getProductsAction`, `getProductMetadataAction`, `getLibraryCategoriesAction`, `getGroupedCategoriesAction`, `getBrandCategoryCoverageAction`, `createProductAction`, `updateProductAction`, `deleteProductAction`, `getProductsLastChangeAction`.

## Pola wajib

- Server component (`page.tsx`) mengambil data + hak akses, lempar ke komponen client sebagai prop
- **Panggil `getMyLibraryAccessAction()` lebih dulu**, sebelum query baris. Pakai hasilnya untuk memutuskan tombol mana yang dirender. Jangan pernah menawarkan tombol untuk aksi yang akan ditolak server.
- Komponen di `src/subapps/master-data/components/`, bukan `src/components/`
- Setiap route baru wajib punya `error.tsx` dan `loading.tsx`
- Nama field Zod identik dengan schema Prisma (`catalog_category`, bukan `category`)

## Design token — nol hardcode

Cek `src/ui_engine/design-system.config.ts` dan `src/styles/designTokens.css` dulu. Yang tersedia:

```
--ui-radius-action   --ui-radius-card    --ui-radius-control   --ui-radius-pill
--ui-border-default  --ui-border-focus   --ui-border-subtle    --ui-border-width
--ui-surface-bg      --ui-surface-raised --ui-surface-shadow
--ui-text-primary    --ui-text-secondary --ui-text-tertiary    --ui-text-inverse
```

`font-serif` (Lora) untuk heading, `font-sans` (Inter) untuk UI. Jangan menambah shadow berlebih, animasi kompleks, atau font dekoratif. Kalau token yang kamu butuh tidak ada, pakai yang paling dekat — jangan menebak nilai baru.

## Verifikasi — jalankan semua, semua harus lulus

```bash
node scripts/verify-access-matrix.mjs     # harus: "✓ All invariants hold."
npx prisma generate
npx tsc --noEmit                          # harus exit 0
npx eslint <file yang kamu ubah>          # harus 0 errors
```

Baseline: `tsc` exit 0, `eslint` 0 error dengan **4 warning yang sudah ada sebelumnya** (`footerTheme` di `(dashboard)/layout.tsx`; dua `react-hooks/exhaustive-deps` dan satu `effectiveActiveIndex` di `top-header.tsx`). Jangan menambah warning baru. Jangan "memperbaiki" empat itu — di luar lingkup.

Cek manual per role:

| Role | Mendarat di | Harus TIDAK bisa |
|---|---|---|
| STAFF | `/masterdata` | `/bq` |
| ESTIMATOR | `/bq` | `/`, `/masterdata` |
| DIC | `/` | `/masterdata`, `/bq` |
| DRIC | `/` | `/masterdata`, `/bq` |
| ADMIN / OWNER | `/` | — |

Akses yang ditolak harus **redirect ke landing route role itu**, bukan 403 dan bukan halaman kosong.

## Berhenti dan eskalasi — jangan menebak

Hentikan pekerjaan dan laporkan kalau:

- Kamu merasa butuh tabel, kolom, atau migration baru
- Kamu merasa butuh server action yang tidak ada di daftar
- Kamu merasa butuh mengubah `src/core/rbac/` atau lapisan auth
- Ada field wajib di schema yang tidak punya sumber data nyata
- Ada yang terasa perlu menghapus atau menimpa data existing
- Ada pertentangan antara prompt ini dan `MASTERDATA_HANDOFF.md`

Project ini punya sejarah data terkontaminasi nilai karangan (`catalog_color = "N/A"` di 736 baris staging, SKU `LEGACY-*`, `contact_role` yang difabrikasi). Semua ditolak. Kalau UI-mu butuh nilai yang tidak ada di database, tampilkan keadaan kosong yang jujur.

## Format laporan akhir

Setelah verifikasi lulus, laporkan:

1. File yang dibuat dan diubah, dengan `git diff --numstat` per file
2. Hasil keempat perintah verifikasi (tempel outputnya)
3. Action apa saja yang dipakai per halaman
4. Yang **tidak** kamu kerjakan dan alasannya
5. Temuan yang butuh keputusan manusia
6. Konfirmasi tidak ada commit dan tidak ada push
