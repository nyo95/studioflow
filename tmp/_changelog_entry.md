## [Unreleased] - 2026-08-19 — Audit skema Master Data: soliditas & cacat logic (SK1–SK2 roadmap baru)

**Kenapa:** owner minta cek `master_data` secara skema — solid atau ada cacat
logic — terpisah dari audit aplikasi 2026-08-18.

**Yang dilakukan:**

1. Baca penuh `prisma/schema.prisma` bagian `master_data`
   (Party→Brand→Sku→Sample, SkuPrice, WorkPrice, Category) dan silang-cek
   terhadap `AGENTS.md` §🧱 Master Data Contract (v2).
2. Verifikasi langsung kelima invariant DB di §2 kontrak terhadap migration
   SQL asli (`20260810180000_masterdata_v2_rebaseline` §§1–3,
   `20260818120000_masterdata_live_unique_indexes`) — semuanya cocok, tidak
   ada drift.
3. Baca jalur tulis `pricing-actions.ts` (WorkPrice create/update, kedua
   kind) dan `party-actions.ts` (PartyContact create/update) untuk verifikasi
   perilaku sungguhan, bukan cuma baca skema statis.
4. Grep seluruh `src/subapps/master-data/actions/*.ts` untuk memastikan
   belum ada action delete Category/Brand (relevan buat temuan #3 dan #5 di
   laporan).
5. Tulis laporan lengkap ke `AUDIT-SKEMA-MASTERDATA-2026-08-19.md`.

**Temuan:**

- Solid: lima invariant DB kontrak (`SkuPrice_current_uniq`,
  `Sku_slug_nobrand_uniq`, `Sku_brand_code_uniq`/`Sku_code_nobrand_uniq`,
  `SkuCategory_primary_uniq`, `Party`/`Brand` name/slug live-unique)
  semuanya benar diterapkan; batas schema `master_data`↔`studioflow`
  konsisten dipatuhi; pilihan Cascade/Restrict/SetNull di seluruh model
  sudah tepat maksud.
- Baru, butuh keputusan owner: **SK1** `WorkPrice.valid_from`/`valid_to`/
  `is_current` tidak pernah dipakai jalur tulis manapun (edit menimpa baris
  di tempat, bukan supersede seperti `SkuPrice`) — kolom `code` yang
  `@unique` global bahkan secara struktural mencegah pola supersede itu;
  **SK2** `PartyContact.brand_id` tidak divalidasi terhadap
  kepemilikan/relasi brand-party di action create/update.
- Risiko rendah/dorman: `Category(kind,slug)` unique tanpa partial-index
  live-row (sama seperti B2 sebelum ditambal, tapi belum ada action delete
  Category jadi belum bisa dipicu); `Sku.brand_id→Brand onDelete:Restrict`
  belum pernah teruji karena belum ada action delete Brand.

**Area/berkas berubah:** `AUDIT-SKEMA-MASTERDATA-2026-08-19.md` (baru),
`roadmap.md`, `changelog.md`. Tidak ada kode aplikasi disentuh — sesi ini
murni review sesuai `AGENTS.md` §🧑‍⚖️ Pembagian Peran.

**Verifikasi yang benar-benar dijalankan:** baca langsung
`prisma/schema.prisma`, migration SQL mentah, dan tiga file action
(`pricing-actions.ts`, `party-actions.ts`, `masterdata-actions.ts`) — bukan
menyimpulkan dari komentar/dokumen saja.

**Risiko:** tidak ada — dokumentasi/analisis murni, nol kode diubah.

**Pekerjaan yang masih terbuka:** SK1 dan SK2 menunggu keputusan owner
sebelum ada eksekusi (lihat roadmap baru).

