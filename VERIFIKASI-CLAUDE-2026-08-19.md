# Verifikasi Roadmap oleh Claude — 2026-08-19

**Tujuan:** owner meminta pengecekan independen — apakah item yang ditandai
selesai oleh Codex di `roadmap.md` / `CHANGELOG.md` benar-benar terimplementasi
di kode, dan apakah roadmap sudah 100% selesai. Ini **audit read-only**: tidak
ada kode yang diubah.

**Metode:** membaca `roadmap.md` (929 baris), `CHANGELOG.md` entri #25–#44,
dan `HANDOFF-CODEX.md` penuh, lalu memverifikasi klaim "SELESAI" langsung
terhadap isi berkas sumber dan `git log`/`git status` — bukan hanya percaya
catatannya.

## Ringkasan jawaban

**Tidak ada satu pun kesalahan klaim yang ditemukan** pada 13 item yang
di-spot-check (daftar di bawah) — kodenya persis seperti yang didokumentasikan.
Disiplin dokumentasi Codex di repo ini di atas rata-rata: setiap entri
changelog #35–#44 sudah mencantumkan sendiri "Verifikasi yang benar-benar
dijalankan", "Risiko", dan "Semantic assessment", dan roadmap sudah tiga kali
mengoreksi klaim salahnya sendiri (H7, M1, D5) sebelum sesi ini.

**Tapi ditemukan satu gap serius yang tidak tercatat di roadmap/changelog
manapun: seluruh pekerjaan #35–#44 (10 dari 20 entri changelog siklus ini)
belum pernah di-commit ke git.**

## Temuan A — Gap kritis: 50 berkas belum ter-commit

- Commit terakhir di `git log` adalah **`d53d712` — "#34: spesifikasi purge
  otomatis"**. Semua pekerjaan sesudahnya — **TV1, TV2 (implementasi), BR3,
  BR1, BR6, §10, H5, BR8, A7, M5, D5, D2, dan build produksi #44** — hanya ada
  sebagai perubahan **uncommitted** di working tree.
- `git status --short` menunjukkan **50 berkas** berstatus modified/untracked,
  termasuk file inti seperti `pricing-actions.ts`, `library-actions.ts`,
  `today-view.tsx`, `SkuDetailDrawer.tsx` (baru), `SkuDirectoryClient.tsx`
  (baru), `use-app-confirm.tsx` (baru), `scripts/purge-expired-checklist-tasks.mjs`
  (baru).
- Branch lokal **18 commit di depan `origin/main`**, belum pernah di-push.
  Ini bukan temuan baru — `HANDOFF-CODEX.md` §6.4 sudah mencatatnya sejak #31
  (saat itu masih 14 commit) — tapi angkanya terus bertambah dan belum pernah
  dieksekusi.
- **Risikonya nyata:** `git stash`, `git checkout .`, `git reset --hard`, crash
  disk, atau bahkan sesi agent lain yang tidak sadar keadaan ini bisa
  menghapus 10 putaran pekerjaan (#35–#44) tanpa jejak. Tidak ada commit
  checkpoint sejak `d53d712`.
- `.next/BUILD_ID` bertanggal **2026-08-19 02:39** — ini mengonfirmasi klaim
  build produksi #44 benar-benar dijalankan dan lulus, jadi *pekerjaannya*
  nyata, hanya *penyimpanannya* yang belum aman.

**Rekomendasi:** commit dulu (bisa satu commit besar seperti checkpoint
`5d87662` di #31, atau dipecah per nomor changelog #35–#44), lalu push ke
`origin/main`. Ini seharusnya jadi prioritas nomor satu sebelum pekerjaan
lain berikutnya — bukan menunggu siklus berikutnya.

## Temuan B — Klaim yang diverifikasi BENAR terhadap kode

| Item | Klaim | Cara verifikasi | Hasil |
|---|---|---|---|
| D2 | Nol `confirm()`/`window.confirm()` tersisa di `src/` | `grep -rn` seluruh `src/**/*.{ts,tsx}` | ✅ kosong, `use-app-confirm.tsx` ada |
| M9 | `pg_advisory_xact_lock` di `generateWorkPriceCode` | grep `pricing-actions.ts` | ✅ baris 215 |
| H7 | `WorkPrice` soft-delete, bukan hard delete | grep `workPrice.update`/`.delete` | ✅ empat pemanggil pakai `.update({ deleted_at })`, nol `.delete()` |
| H8 | Filter `kind` + `deleted_at` di keempat aksi | grep `pricing-actions.ts` | ✅ delapan lokasi cocok |
| BR8/A7 | `SkuDetailDrawer.tsx` + halaman `/masterdata/skus` ada | `find src` | ✅ keduanya ada |
| TV2 | `scripts/purge-expired-checklist-tasks.mjs` ada | `ls -la` | ✅ ada, 7127 byte |
| TV1 | `today-view.tsx` punya state `editingLabel`/`labelDraft`, pola anti-#28b | grep + baca kode | ✅ `useEffect` deps `[task.label]` saja, span merender `labelDraft` |
| §19 | `SupplierJasaTab`/`InlineCompanyCell`/`toggleSort` sudah dihapus dari `SupplierClient.tsx` | grep | ✅ nol hasil |
| H5 | `MASTERDATA_PRICE_MANAGE`/`MASTERDATA_OFFERING_MANAGE` dihapus total | grep seluruh `src/` | ✅ nol hasil |
| §10 | Edit non-approver tidak lagi memaksa status turun ke `PENDING`; Create tetap `PENDING` | baca `library-actions.ts:269-284` | ✅ status di-destructure, hanya diterapkan bila `canApproveMaterial` |
| BR6 | Kebab menu (⋯) di tabel Brands/Suppliers | grep `DropdownMenu`/`MoreHorizontal` | ✅ ada, dengan permission gating |
| M3/§8 | Pagination server-side **belum** dikerjakan (item ini memang masih terbuka di roadmap) | grep `take:`/`skip:` di `getMaterialPricesAction` | ✅ benar masih kosong — roadmap akurat menandainya terbuka |
| Migrasi | Dua folder migrasi prefix sama `20260818120000` benar-benar ada di disk | `ls prisma/migrations` | ✅ `add_checked_at_to_checklist` + `masterdata_live_unique_indexes` |

## Temuan C — Apakah roadmap 100% selesai?

**Tidak, dan roadmap sendiri tidak pernah mengklaim itu.** Yang 100% selesai
adalah **urutan kerja spesifik yang disepakati** di `HANDOFF-CODEX.md` §3
(item 0 sampai 7: TV1, TV2, BR3, BR1, BR6, §10+H5, BR8+A7, M5+UI-CON-3,
D5+D2) — kedelapan-delapannya terverifikasi ✅ di atas.

Roadmap sendiri secara eksplisit masih menyisakan item terbuka (ditandai
`[ ]`), tidak disembunyikan:

- **Gelombang 5 sisa:** M3/§8 (pagination halaman harga), §20 (tab Prices di
  Supplier detail masih stub)
- **UI/UX dari screenshot owner:** BR2 (perluas search Brands), BR4 (detail
  brand jadi modal), BR5 (kolom Katalog & Links), BR7 (pola BR4 ke Supplier),
  UI-CON-2 (posisi CTA Services), UI-CON-4 (konsistensi stats summary)
- **Schedule & deliverable:** A6 🔒 (schedule bundle, butuh migrasi),
  R-SCHED-TPL-2e (nunggu update plugin SketchUp), B1 ⏳ (ditunda dengan
  gerbang, sengaja oleh owner)
- **Todo v1 sisa:** C-SISA-3 (drag-and-drop), C-SISA-5/6/7 🔒 (filter
  tersimpan, recurring, notifikasi — ketiganya butuh migrasi/infra baru)
- **Utang teknis:** T3 (verifikasi ulang `PLAN-AUDIT-ROADMAP-2026Q3.md`), test
  integrasi untuk `getBrandView`/`getSkusForBrand`
- **§19 sisa:** owner perlu menghapus folder `_to_delete/MasterDataNav.tsx`
  secara manual

Item-item ini **bukan salah kerja Codex** — memang belum diambil karena
butuh keputusan owner, migrasi skema, atau scope besar yang sengaja ditunda.

## Yang belum sempat diverifikasi sesi ini

- `npm test` (118/118) dan `npm run build` tidak dijalankan ulang dari sisi
  saya — lingkungan cloud ini Linux sedangkan proyek memakai binary Prisma
  Windows; menjalankannya berisiko merusak `src/generated/prisma` seperti
  yang sudah diperingatkan di `roadmap.md`. Saya memverifikasi lewat bukti
  tidak langsung: `.next/BUILD_ID` bertanggal sesuai klaim #44.
- Migrasi `20260818120000_add_checked_at_to_checklist` sudah diterapkan ke
  database produksi/lokal atau belum — butuh akses DB yang tidak tersedia
  dari sesi ini. Owner yang perlu konfirmasi (`HANDOFF-CODEX.md` §6.1).
- 19 langkah uji manual Master Data v2 dan 9 langkah uji manual task di
  `roadmap.md` — butuh mata manusia dan database sungguhan, sama seperti
  yang dicatat roadmap sendiri.
