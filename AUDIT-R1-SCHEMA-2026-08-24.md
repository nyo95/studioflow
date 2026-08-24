# AUDIT R1 — Schema & Ownership Audit (Architecture Cleanup v2)

> **✅ DISETUJUI OWNER 2026-08-24 dengan AMANDEMEN besar:** arah pricing
> final adalah **MULTI-SUPPLIER** (jawaban ❓U1/U3). Seluruh bagian §3 di
> bawah yang memetakan "satu harga kanonik per SKU" TIDAK dieksekusi; R4
> menyusut menjadi: validasi `unit` harga = `sku.purchase_unit` (U2),
> tambah `updated_by_id` (U4), perbaikan dokumentasi. Disetujui juga:
> U5 (simpan UTC, tampil WIB), U6 (drop `ProjectTimeline`). Masih terbuka:
> U7 (PromotionRequest), R9-1 (recipe resolve).

**Tanggal:** 2026-08-24 · **Fase:** R1 · **Status:** DISETUJUI (dengan amandemen)
**Baseline:** `6377ac0` + perubahan dokumen sesi ini (R0 lulus penuh, lihat changelog)
**Metode:** pembacaan penuh `prisma/schema.prisma` (2.073 baris, 64 model,
30 enum) + verifikasi pemakaian runtime lewat `git grep`. Klasifikasi mengikuti
PRD §12 (`KEEP / NORMALIZE / CENTRALIZE / DERIVE / MERGE / REMOVE`).

> Dokumen ini adalah migration map. **Tidak ada yang dieksekusi sebelum owner
> menyetujui** (gerbang exit R1). Item bertanda ❓ adalah keputusan yang
> dimintakan secara eksplisit di bagian bawah.

---

## 1. Ringkasan eksekutif

| Klasifikasi | Jumlah | Catatan |
|---|---|---|
| KEEP | 55 model | Termasuk seluruh inti StudioFlow, Master Data, dan mesin BQ |
| NORMALIZE | 5 model | SkuPrice (R4), BqMaterialLine provenance (R9), library recipe fields (R9), MasterDataAudit (R3), komentar basi |
| MERGE | 1 model | `MasterDataAudit` → `AuditLog` (R3) |
| REMOVE | 1 model + kolom | `ProjectTimeline` (write-only); kolom lifecycle pricing (R4) |
| CENTRALIZE | — | bukan skema: unit/money/date/normalize → Shared Core (R2) |

Skema secara umum **sehat** — rebaseline v2 dan cleanup 2026-08-20 sudah
membuang sebagian besar beban legacy (`WorkPriceProjectRef`, `price_list`,
`material_price/labor_price`, view BQ lama, kolom lifecycle WorkPrice yang
tidak dipakai). Fokus sisa ada di **pricing (R4)**, **audit (R3)**, dan
**provenance/library BQ (R9)**.

---

## 2. Klasifikasi per domain

### 2.1 studioflow (36 model)

| Model | Klasifikasi | Alasan / catatan |
|---|---|---|
| User, Client, Project, Phase, Revision, Activity, File | KEEP | Inti platform. `Phase.status_changed_at` tetap DERIVE-dengan-alasan (komentar skema menjelaskan biaya scan AuditLog) — jangan dinormalisasi. |
| **AuditLog** | **MERGE target (R3)** | Menjadi satu-satunya tabel audit generic. Butuh kolom `domain` (`STUDIOFLOW/MASTER_DATA/BQ`) + konvensi entity ref. FK `project_id`/`phase_id` dipertanyakan saat merge — lihat §4-D. |
| **ProjectTimeline** | **REMOVE (R10/R12)** ❓ | **Write-only**: ditulis `project-service.ts:170` (create saat project baru) dan `:533` (deleteMany), **nol pembaca** di seluruh `src/`. Tabel mati yang terus dibayar per-insert. |
| TimelineTemplate, ChecklistTemplate, ChecklistLabel(+OnItem), ChecklistFilterView | KEEP | Dipakai aktif (settings/template-manager/checklist-service/tasks). |
| SystemConfig | KEEP | Pola single-row; nanti jadi contoh untuk `BqSettings`. |
| ProjectProductRequest | KEEP + NORMALIZE komentar | Komentar kolom `vendor_quoted_price` masih menyebut "`master_data.MaterialPrice`" — model v1 yang sudah tidak ada. Perbaikan komentar saja (R10). Kolomnya sendiri valid. |
| ProjectChecklist, CDList, Comment, TemporaryAttachment, Mom* (4) | KEEP | Dipakai aktif. |
| PrefixDictionary, ProjectScheduleEntry/Option, ScheduleTemplate(Item) | KEEP | Snapshot semantics benar (M5). Kolom `spec_*` reuse-search punya penjaga write-path terdokumentasi — jangan disentuh. |
| **PromotionRequest** | KEEP (flag-gated) ❓ | `FEATURE_PROMOTION_QUEUE_ENABLED = false`; action & tipe hidup tapi tertutup. Ini fitur tidur, bukan kode mati — keputusan nasib (hidupkan / gali) milik owner, bukan program cleanup. Usulan: biarkan sampai owner memutuskan; tidak disentuh fase mana pun. |
| Sketchup* (4), RenderBoard, RenderAnnotation | KEEP | Fondasi yang dilindungi PRD §3. |

### 2.2 master_data (17 model)

| Model | Klasifikasi | Alasan / catatan |
|---|---|---|
| Party, PartyRole, PartyContact, PartyLink | KEEP | Kontrak v2 benar. Partial live-unique indexes sudah tepat. |
| Brand, BrandLink, BrandSupplier | KEEP | Idem. `BrandLink` tetap jadi sumber `source_link` harga sampai R4 memutuskan nasibnya (lihat §3). |
| Category, BrandCategory, SkuCategory | KEEP | Pohon dua tingkat + path maintenance (B7) sudah benar. |
| Sku | KEEP | Costing profile (`usage_unit/purchase_unit/conversion/waste/min_order/rounding`) sudah di SKU sesuai PRD §14 — **termasuk `minimum_order` & `rounding_increment` yang ternyata sudah ada**, menjawab pertanyaan ambigu di review awal PRD. `preferred_supplier_party_id` = referensi, bukan ownership — KEEP. |
| **SkuPrice** | **NORMALIZE (R4)** | Lihat §3 — satu-satunya perubahan skema besar program ini. |
| WorkPrice | KEEP | Sudah satu-harga-per-code, lifecycle columns sudah dibuang 2026-08-20. Sesuai PRD §19. |
| Sample, SampleMovement | KEEP | Lima status utuh, actor plain-column benar (§8 batas schema). |
| **MasterDataAudit** | **MERGE → AuditLog (R3)** | Keputusan owner 2026-08-24. Data digabung; tabel di-drop setelah parity terverifikasi. |

### 2.3 bq (11 model)

| Model | Klasifikasi | Alasan / catatan |
|---|---|---|
| BqSettings, BqProject, BqObject, BqSubObject | KEEP | Arsitektur 3-lapis + markup-copy + locked_at semua sesuai PRD. |
| BqMaterialLine / BqServiceLine | KEEP + NORMALIZE provenance (R9) | Snapshot lengkap & benar. Kolom `sku_price_id` + `supplier_party_id` menjadi **provenance baris lama** setelah R4 (baris baru tidak lagi menunjuk baris riwayat yang tidak akan ada) — jangan di-drop; ia bagian dari reproducibility historis. `snapshot_supplier_name` tetap snapshot identitas. |
| BqLibraryObject/SubObject/SubObjectOfObject | KEEP | Resep terpisah dari instance — benar. |
| BqLibraryMaterialLine / BqLibraryServiceLine | NORMALIZE (R9) ❓ | Kolom `recipe_*` menyimpan nilai beku (harga, konversi, waste default) padahal kontrak berkata resep ≠ snapshot. PRD §33: instantiating me-resolve lewat Project Cost DB. **Usulan:** baris resep tetap boleh membawa *default suggestion*, tapi instantiasi WAJIB resolve ulang dari Master Data saat itu, bukan menyalin `recipe_price`. Tanpa perubahan skema dulu — perilaku dulu (R9), skema menyusul kalau terbukti redundan. |

---

## 3. Fokus khusus — Pricing (eksekusi R4)

Keadaan sekarang (`SkuPrice`): riwayat per-supplier dengan
`is_current`/`valid_from`/`valid_to`, index parsial `SkuPrice_current_uniq`,
jalur tulis `recordSkuPrice()`/`closeCurrentSkuPrice()`.
**Kontrak lama di AGENTS.md §3.2–3.3 sudah di-override owner 2026-08-24** —
yang dipetakan di sini adalah cara pindahnya.

### Target (PRD §15)

```
SkuPrice
  sku_id      UNIQUE          ← berubah dari multi-baris jadi 0..1 per SKU
  price_net   Decimal(16,2)   (amount)
  currency    String
  unit        String          ← lihat keputusan ❓ U2
  source_link_id / notes      ← metadata opsional
  updated_at / updated_by_name (+ updated_by_id? ❓ U4)
  supplier_party_id           ← lihat keputusan ❓ U1
  valid_to / is_current       ← DIHAPUS
  valid_from                  ← diganti created_at semantics / DIHAPUS
```

### Langkah migrasi (add-first, recoverable — PRD §47)

1. **Regression test dulu**: integration test yang mengunci perilaku viewer
   harga & readiness sebelum apa pun diubah.
2. **Konsolidasi data**: untuk tiap SKU dengan >1 baris `is_current`
   (lintas supplier), pilih satu baris kanonik (urutan keputusan ❓ U3),
   arsipkan sisanya ke tabel shadow `_sku_price_archive` (recoverability).
3. **Terapkan unique `sku_id`** + drop index `SkuPrice_current_uniq` +
   drop `is_current`/`valid_to`.
4. **Ganti jalur tulis**: `recordSkuPrice()`/`closeCurrentSkuPrice()` → satu
   `upsertCurrentPrice()` yang menulis audit before/after dalam transaksi yang
   sama.
5. **Perbaiki pembaca**: viewer SKU (#52/#53/#61) berhenti menampilkan
   "riwayat harga" dari `SkuPrice`; jika riwayat tetap dibutuhkan, ia dibaca
   dari audit. Readiness BQ berhenti bergantung pada `supplier_party_id`.

### Keputusan yang dimintakan

- **❓ U1 — `supplier_party_id`:** usulan **pertahankan sebagai referensi
  opsional** (metadata asal penawaran), bukan ownership. Alternatif: drop
  total (paling murni vs PRD §18, tapi kehilangan fakta "harga ini dikutip
  siapa"). Rekomendasi saya: **pertahankan**.
- **❓ U2 — `unit`:** usulan **pertahankan kolom** tapi tambahkan validasi
  app-layer: harga baru wajib `unit === sku.purchase_unit` (normalisasi
  sebelum commit, PRD §16). Existing mismatch ditangani di langkah konsolidasi
  (baris kanonik yang unitnya menyimpang dicatat di audit).
- **❓ U3 — pemilih baris kanonik** saat SKU punya beberapa harga berlaku:
  usulan **baris `is_current=true` termutakhir `valid_from`**; tie-break
  `created_at` termutakhir; hasil keputusan dicatat per-SKU di audit. Owner
  bisa minta preferensi lain (mis. supplier authorized lebih dulu).
- **❓ U4 — `updated_by_id`:** PRD mencantumkannya di conceptual record.
  Usulan **tambahkan kolom** (plain id, tanpa FK lintas schema — pola
  `actor_id` SampleMovement).

## 3b. Fokus khusus — Audit (eksekusi R3)

- Satu tabel `AuditLog` + kolom baru `domain String` (backfill:
  `STUDIOFLOW` untuk baris lama) + `MasterDataAudit.changes` dipetakan ke
  `details`.
- `insertAuditLog()` dan `recordAudit(tx,…)` digabung menjadi satu
  `recordAudit({ domain, entityType, entityId, action, actorId, actorName?,
  before, after, metadata })`.
- **FK `AuditLog.project_id`**: untuk domain BQ/MASTER_DATA tidak bermakna.
  Usulan: `project_id`/`phase_id` **tetap** khusus makna StudioFlow (dipakai
  UI activity), entitas non-StudioFlow cukup `(domain, entity_type,
  entity_id)` — sama seperti kunci `bq_project_id` hari ini. Tanpa FK baru.
- Migrasi dua tahap: tulis-dua-tempat (shadow) → verifikasi parity → drop
  `MasterDataAudit`.

## 3c. Fokus khusus — Unit / Money / Date / Normalization (eksekusi R2)

Bukan perubahan skema — semua kolom unit tetap `String`; SSOT-nya di Shared Core:

- **Unit Dictionary** baru (`src/core/reference/units.ts`): symbol kanonik +
  alias (`sheet/Sheet/lembar/sht` → `SHEET`, `sqm/m2/M²` → `M2`). Kolom
  existing dinormalisasi saat tulis; data lama tidak di-rewrite massal
  (read-normalize saja dulu).
- **Money/format**: `Intl.NumberFormat` tersebar di ≥5 komponen + helper
  `formatMoney` BQ → satu `src/core/utilities/money.ts`. Aritmetika BQ di
  `calc.ts` TIDAK disentuh (ia Decimal-based, bukan presentational).
- **Date**: 15 file memakai `toLocaleDateString` family → konsolidasi ke
  `src/core/utilities/datetime.ts` dengan satu timezone policy (perlu
  keputusan kecil: timezone kantor — usulan `Asia/Jakarta` fixed ❓ U5).
- **Normalization/slugify**: duplikat di `sample-actions.ts`,
  `sample-request-actions.ts`, `slug.ts` → satu modul `normalize.ts`.

---

## 4. Peta eksekusi per fase (hasil R1)

| Fase | Kerja konkret dari temuan ini |
|---|---|
| **R2** | Shared Core: units, money, datetime (❓ U5), normalize. Nol perubahan visual & skema. |
| **R3** | Merge audit (§3b), gabung error mapping, pagination contract, soft-delete helper. |
| **R4** | Pricing §3 — butuh jawaban ❓ U1–U4 sebelum work order ditulis. |
| **R9** | Hapus `price-drift-service.ts`; provenance L3 berhenti menulis `sku_price_id`; keputusan recipe_* (❓ R9-1: resolve-ulang saat instantiasi — ya/tidak). |
| **R10** | Remove `ProjectTimeline` + write path-nya (❓ U6); perbaiki komentar MaterialPrice di ProjectProductRequest. |
| **R12** | Purge sisa (tabel archive `_sku_price_archive`, flag PromotionRequest ❓ U7). |

## 5. Daftar keputusan owner (gerbang exit R1)

| # | Pertanyaan | Usulan |
|---|---|---|
| ❓ U1 | `SkuPrice.supplier_party_id` dipertahankan sebagai referensi opsional? | Ya |
| ❓ U2 | `unit` harga wajib = `sku.purchase_unit` (divalidasi app-layer)? | Ya |
| ❓ U3 | Aturan pemilih harga kanonik saat konsolidasi data? | is_current termutakhir valid_from, tie-break created_at |
| ❓ U4 | Tambah `updated_by_id` di SkuPrice? | Ya, plain column |
| ❓ U5 | Timezone policy aplikasi? | Asia/Jakarta |
| ❓ U6 | Drop `ProjectTimeline` (write-only, nol pembaca)? | Ya |
| ❓ U7 | `PromotionRequest` (flag OFF): biarkan / hapus di R12? | Biarkan — keputusan fitur, bukan cleanup |
| ❓ R9-1 | Instantiasi library recipe resolve ulang harga dari Master Data saat itu (bukan menyalin `recipe_price`)? | Ya |
