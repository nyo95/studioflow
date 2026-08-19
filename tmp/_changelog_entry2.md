## [Unreleased] - 2026-08-19 — Eksekusi SK1–SK5 (audit skema): keputusan owner diterapkan langsung oleh Claude

**Kenapa:** owner cek handoff Codex (BR9–BR12), lalu langsung putuskan kelima
temuan `AUDIT-SKEMA-MASTERDATA-2026-08-19.md` sore ini dan minta Claude yang
eksekusi — bukan lewat `HANDOFF-CODEX.md`/Codex.

**Yang dilakukan:**

1. **Cek handoff Codex** — changelog #60–#63 (BR9, BR10, BR11, BR12) dan
   roadmap.md keempatnya `[x]`, cocok. Spot-check langsung ke kode: grep
   `inlineBrandDraft`/`beginInlineBrandEdit` (nol hasil, BR11 benar), pola
   "and N others" ada (`MasterDataMaterialsClient.tsx:131`), `deleteSkuAction`
   via `softDeleteSku` ada (`masterdata-actions.ts`, BR10 benar). Tidak ada
   penyimpangan ditemukan.
2. **SK1 (opsi a — owner pilih):** `WorkPrice.valid_from`/`valid_to`/
   `is_current` diberi komentar "TIDAK DIPAKAI" di `schema.prisma` (pola sama
   `qty`) + migrasi `20260819140000_workprice_unused_columns_comment`
   (`COMMENT ON COLUMN`, murni metadata). `AGENTS.md` §3 dapat poin baru (7).
3. **SK2:** guard baru `assertBrandBelongsToParty()` di `party-actions.ts`,
   dipanggil dari `createPartyContactAction`/`updatePartyContactAction`
   sebelum tulis — brand harus `owner_party_id` atau `BrandSupplier` party
   yang sama, kalau tidak `VALIDATION_FAILED`.
4. **Item #3 (Category kind,slug):** constraint `@@unique([kind, slug])`
   diganti index parsial `Category_kind_slug_live_uniq` (`WHERE is_active`)
   lewat migrasi `20260819150000_category_kind_slug_live_uniq` — pola sama
   B2. Diverifikasi dulu: nol pemakaian `kind_slug` compound-unique di
   `src/subapps` (aman dihapus dari Prisma Client). `AGENTS.md` §2 dapat
   baris invariant baru.
5. **Item #4 (Category.path) — TERNYATA SUDAH BENAR, laporan audit
   dikoreksi.** Baca penuh `category-tree-service.ts`: `propagateDescendantPaths()`
   sudah ada sejak B7 (2026-08-18), dipanggil otomatis dari `upsertCategory()`.
   Audit 2026-08-19 pagi salah menyimpulkan ini risiko terbuka tanpa membaca
   kode servicenya. **Tidak ada kode diubah** — cuma komentar `schema.prisma`
   pada field `path` yang menunjuk eksplisit ke implementasinya, dan
   `AUDIT-SKEMA-MASTERDATA-2026-08-19.md` diberi update-koreksi di bagian atas
   (riwayat aslinya dibiarkan, bukan diedit diam-diam).
6. **Item #5 (Sku.brand_id Restrict):** didokumentasikan sebagai komentar
   peringatan di `schema.prisma` — tidak ada kode untuk difix karena belum
   ada action delete Brand sama sekali.
7. **`HANDOFF-CODEX.md`** diberi catatan eksplisit "SK1–SK5 DIKLAIM CLAUDE,
   JANGAN DISENTUH CODEX" supaya Codex tidak mengerjakan ulang.

**Area/berkas berubah:** `prisma/schema.prisma`,
`prisma/migrations/20260819140000_workprice_unused_columns_comment/`,
`prisma/migrations/20260819150000_category_kind_slug_live_uniq/`,
`src/subapps/master-data/actions/party-actions.ts`, `AGENTS.md`,
`HANDOFF-CODEX.md`, `roadmap.md`, `AUDIT-SKEMA-MASTERDATA-2026-08-19.md`,
`changelog.md`.

**Verifikasi yang benar-benar dijalankan:** `npm run typecheck` lulus
(exit 0); `npx eslint src/subapps/master-data/actions/party-actions.ts`
lulus (exit 0, nol warning/error); `npx prisma validate` lulus — skema
sintaksis valid. **TIDAK dijalankan** (dan tidak bisa dari sesi Claude
manapun yang dipakai hari ini): `prisma migrate deploy`/`generate` — beda
target binary engine (Linux sesi cloud & VM device vs Windows lingkungan
sungguhan proyek ini), dan mengarahkannya ke folder proyek yang sama berisiko
menimpa Prisma Client Windows yang sudah benar. Kedua migrasi baru masih
**belum diterapkan ke database** sampai owner menjalankannya manual di mesin
lokal — lihat "Langkah buat owner" di `roadmap.md`.

**Risiko:** rendah untuk SK2 (aplikasi murni, sudah typecheck+lint lulus).
SEDANG untuk migrasi SK1/item#3: keduanya non-destruktif dan arahnya
KETAT→LONGGAR (dijelaskan di komentar migrasi masing-masing) sehingga
seharusnya tidak bisa gagal pada data yang ada, tapi belum diverifikasi
benar-benar diterapkan ke database sungguhan — itu langkah owner berikutnya,
bukan sudah selesai.

**Semantic assessment:** YA untuk SK1 dan item #3 — keduanya keputusan
domain/skema baru (WorkPrice bukan tabel riwayat; Category dapat perlakuan
live-uniqueness), sudah ditulis ke `AGENTS.md` §2/§3 supaya agent berikutnya
tidak menganggapnya bug atau membalikkannya tanpa sadar itu keputusan sadar.

**Pekerjaan yang masih terbuka:** owner menjalankan `prisma migrate
deploy`/`generate` lokal untuk kedua migrasi baru, lalu `npm run build` untuk
konfirmasi akhir. Tidak ada item SK yang tersisa di roadmap.

