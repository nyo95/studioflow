# MASTER_SSOT.md — DIARSIPKAN 2026-08-18

> **Berkas ini bukan lagi sumber kebenaran.** Isinya dipindahkan ke
> [`docs/archive/MASTER_SSOT-v1-2026-08-18.md`](docs/archive/MASTER_SSOT-v1-2026-08-18.md).
> Yang tersisa di sini hanya penunjuk arah, supaya komentar kode yang masih
> menyebut "MASTER_SSOT §…" tetap mendarat di sesuatu yang menjelaskan.

## Kenapa diarsipkan

Berkas aslinya 947 baris dan mengaku sebagai *source of truth* arsitektur.
Pemeriksaan 2026-08-18 menemukan isinya **seluruhnya menggambarkan Master Data
v1**: nol sebutan `Party`, `SkuPrice`, atau `WorkPrice`, sementara
`ProductCatalog.catalog_brand`, `Vendor.brand_name`, antrean promosi, dan
`catalog_image_url` masih ditulis sebagai keadaan sekarang.

Skema itu **tidak ada lagi**. Ia di-`DROP SCHEMA … CASCADE` oleh migrasi
`20260810180000_masterdata_v2_rebaseline` pada 2026-08-10.

Sumber kebenaran yang salah lebih berbahaya daripada dokumen usang yang
jelas-jelas bertanggal lama — terutama yang namanya sendiri menyuruh orang
mempercayainya.

## Ke mana sekarang

| Yang dulu dicari di sini | Sekarang di |
|---|---|
| Kontrak domain Master Data (model, index, aturan harga/kategori/sample/audit) | [`AGENTS.md`](AGENTS.md) §🧱 Master Data Contract (v2) |
| Aturan kerja agent (protokol, larangan, changelog) | [`AGENTS.md`](AGENTS.md) |
| Bentuk schema yang berlaku | [`prisma/schema.prisma`](prisma/schema.prisma) — beranotasi panjang, dan ia satu-satunya yang tidak bisa basi |
| Riwayat keputusan & alasannya | [`changelog.md`](changelog.md) |
| Pekerjaan yang masih terbuka | [`roadmap.md`](roadmap.md) |
| Isi v1 (untuk melacak asal-usul keputusan lama) | [`docs/archive/MASTER_SSOT-v1-2026-08-18.md`](docs/archive/MASTER_SSOT-v1-2026-08-18.md) |

## Rujukan §-nomor dari komentar kode

Lima komentar di `src/` masih mengutip nomor bagian berkas lama
(`§5.7`, `§6.2`, `§6.12`, `§8 Issue 7`). Nomor-nomor itu **hanya berlaku untuk
versi arsip**, bukan untuk `AGENTS.md`. Komentar-komentar tersebut sengaja
dibiarkan apa adanya pada perapihan 2026-08-18 — mengubahnya adalah perubahan
kode, dan perapihan itu dokumentasi saja. Perbaiki saat menyentuh berkasnya:

| Berkas | Kutipan |
|---|---|
| `src/core/rbac/constants.ts:60` | §5.7 known-leak DIC/DRIC |
| `src/extensions/library/actions/brand-library-actions.ts:14` | §6.2 rule 6 |
| `src/extensions/library/components/BrandLibraryExplorer.tsx:14` | §8 Issue 7 (Design Token) |
| `src/subapps/master-data/components/MasterDataNav.tsx:37` | §6.12 required-SKU contract |
| `src/ui_engine/primitives/index.ts:19` | §8 Issue 7 |

`src/extensions/schedule/README.md:105` juga menyuruh memvalidasi terhadap
berkas ini; yang dimaksud sekarang adalah `AGENTS.md`.
