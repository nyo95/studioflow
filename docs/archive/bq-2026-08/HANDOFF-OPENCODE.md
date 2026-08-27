# HANDOFF — OpenCode: BQ Simplification (2026-08-19)

**Untuk:** OpenCode  
**Dari:** Claude (orchestrator)  
**Tanggal:** 2026-08-19  
**Acuan rencana:** `PLANBQSIMPLIFY20260819.md`  
**Kontrak domain:** `AGENTS.md` §🧾 BQ Contract  

---

## ⚠️ Baca ini sebelum menyentuh satu baris pun

### Kontrak yang wajib diikuti
- Baca `AGENTS.md` §🧾 BQ Contract sebelum coding. Itu adalah kontrak hukum domain, bukan saran.
- `src/subapps/bq/lib/calc.ts` — **jangan diubah apapun**. Mesin hitung murni. Urutan operasi normatif §3 PRD sudah benar.
- `src/subapps/bq/lib/calc.test.ts` — **jangan diubah**. Angka `Rp5.653.559` dikunci. Kalau angka ini bergeser, ada yang salah.
- Schema tiga lapis `BqProject → BqObject → BqSubObject → BqMaterialLine / BqServiceLine` — **jangan diubah strukturnya**.
- Seluruh kolom `snapshot_*` di `BqMaterialLine` dan `BqServiceLine` — **jangan dihapus**.
- Kolom `is_manual_override` — **jangan dihapus**.
- `BqDetailMode` (`DETAIL` / `RINGKAS`) — **jangan dihapus**.
- Struktur komponen `ObjectRow → SubObjectRow → LineTable` — **jangan diubah strukturnya**.
- `NumberCell` — commit saat blur/Enter, bukan tiap ketikan. **Jangan ubah**.
- `BqLinePicker` — termasuk logika menampilkan kandidat belum-siap. **Jangan ubah**.

### Checkpoin di setiap akhir tahap (wajib lulus semua)
```bash
npx tsc --noEmit        # 0 error
npx eslint src/         # 0 error
npm test                # semua pass; AT-01 tetap Rp5.653.559
```

---

## ⛔ BLOKIR — Konfirmasi owner sebelum P1

**Tiga hal ini harus dijawab owner sebelum P1 dieksekusi. Jangan kerjakan P1 sebelum ada konfirmasi:**

| # | Pertanyaan | Implikasi kalau Ya |
|---|---|---|
| **Q1 ← BLOKER** | Field costing dipindah dari `BqMaterialProfile` ke `master_data.Sku`? | Membalik keputusan owner 2026-08-19. `BqMaterialProfile` + `/bq/settings` bisa hilang. SKU langsung siap pakai BQ. |
| **Q2** | STAFF dicabut akses dari semua permission `BQ_*`? | Setelah D1, STAFF memang tidak punya pekerjaan di BQ lagi. |
| **Q3** | `BqCategoryWaste` dibuang (bukan ditunda)? | Kalau kantor sudah punya angka waste-per-kategori, keputusan berbeda. |

Kalau owner konfirmasi Q1 = Ya → lanjut P1. Q2 dan Q3 tidak memblokir P1, tapi idealnya dijawab sebelum P2.

---

## P1 — Pindah field costing ke `Sku` (butuh Q1 = Ya)

**Tujuan:** SKU baru langsung bisa dipilih estimator di picker tanpa harus diisi profil dulu.

### 1.1 Tambah kolom ke `master_data.Sku` (ADITIF — jangan hapus kolom lama dulu)

```prisma
model Sku {
  // ... kolom yang sudah ada ...

  // ── BQ costing fields (aditif) ─────────────────────────────────────────
  usage_unit          String?
  purchase_unit       String?
  conversion          Decimal?  @db.Decimal(18,6)  // CHECK > 0 di app layer
  default_waste_pct   Decimal?  @db.Decimal(9,6)
  minimum_order       Decimal?  @db.Decimal(18,6)
  rounding_increment  Decimal   @default(1) @db.Decimal(18,6)
}
```

Buat migrasi baru dengan nama `20260819_bq_costing_to_sku`. **JANGAN** drop `BqMaterialProfile` dulu di migrasi ini.

### 1.2 Backfill (script SQL dalam migrasi, aditif)

```sql
UPDATE sku s
SET
  s.usage_unit         = p.usage_unit,
  s.purchase_unit      = p.purchase_unit,
  s.conversion         = p.conversion,
  s.default_waste_pct  = p.default_waste_pct,
  s.minimum_order      = p.minimum_order,
  s.rounding_increment = p.rounding_increment
FROM bq_material_profile p
WHERE p.sku_id = s.id
  AND s.usage_unit IS NULL;  -- aditif, tidak menimpa yang sudah diisi
```

### 1.3 Update `master-data-service.ts` — `toCandidate()`

Ubah agar baca dari `Sku` langsung, bukan join ke `bq_material_profile`. Setelah ini:
- `readiness` hanya punya dua alasan: `NO_PRICE`, `UNIT_MISMATCH`.
- `NO_PROFILE` dihapus dari enum dan semua tempat yang memeriksanya.

### 1.4 Hapus `BqMaterialProfile` (di migrasi terpisah setelah backfill terverifikasi)

Setelah memastikan semua data termigrasi:
- Drop model `BqMaterialProfile` dari `schema.prisma`.
- Hapus relasi `Sku.bq_profile`.
- Hapus semua referensi ke `BqMaterialProfile` di seluruh codebase (`settings-service.ts`, dll).

### 1.5 UI management field costing

Field `usage_unit`, `purchase_unit`, `conversion`, `default_waste_pct`, dll pindah ke dialog SKU di `/masterdata`. Cukup tambahkan field ke form edit SKU yang sudah ada. Permission yang berlaku: `MASTERDATA_SKU_MANAGE` (STAFF sudah punya ini).

**Selesai P1 bila:** STAFF input SKU baru di `/masterdata`, estimator buka picker di BQ, SKU langsung muncul tanpa perlu langkah tambahan.

---

## P2 — Buang category waste, hapus halaman settings, sederhanakan drift

**Tujuan:** Hilangkan dead code dan halaman yang salah tempat. Tidak bergantung P1 kecuali untuk urutan RBAC.

### D2 — Buang `BqCategoryWaste` (perlu Q3 = "buang")

File yang terdampak: `master-data-service.ts` (sekitar baris 203), `settings-service.ts` (sekitar baris 166).

Hapus:
- Model `BqCategoryWaste` dari schema (buat migrasi `DROP TABLE bq_category_waste`)
- Relasi `Category.bq_waste`
- Fungsi `loadCategoryWaste()`, `listCategoryWasteRows()`
- Tipe `BqCategoryWasteRow`
- Tab category waste di `/bq/settings`

**PERTAHANKAN:**
- Level 4 di `resolveWaste()` di `calc.ts` — biarkan `categoryDefaultWastePct` selalu `null` sementara ini.
- Kolom `snapshot_category_default_waste_pct` di `BqMaterialLine` — **JANGAN DROP**.
- AT-03 harus tetap lulus.

### D3 — Hapus halaman `/bq/settings`

Hapus:
- `app/bq/settings/page.tsx`
- `BqSettingsClient.tsx` (~17KB)
- Sebagian besar `bq-settings-actions.ts` (~8KB) — pertahankan hanya action untuk `default_markup_pct` dan `default_detail_mode`

Tabel `BqSettings` **TETAP** (tiga kolom, satu baris). Dua field yang tersisa (`default_markup_pct` dan `default_detail_mode`) dijadikan dialog kecil di header daftar project `/bq`. Dialog ini hanya muncul untuk ADMIN (`BQ_SETTINGS_MANAGE`).

### RBAC setelah D3 (perlu Q2 = Ya)

Cabut dari role STAFF:
- `BQ_ACCESS`
- `BQ_SETTINGS_MANAGE`

STAFF tidak punya pekerjaan di BQ setelah P1.

`BQ_SETTINGS_MANAGE` tetap ada untuk ADMIN, scope-nya menyempit ke dua default kantor saja.

### D4 — Sederhanakan drift

Ubah `BqDriftKind` dari 6 varian → satu sinyal boolean.

Perubahan:
- Per baris: `hasDrift: boolean` (bukan union 6 nilai)
- Per object: satu banner `"N baris berubah sejak snapshot diambil — Tinjau | Pertahankan"`
- Aksi refresh per baris tetap ada (itu yang memenuhi "boleh diterapkan sebagian")
- Object terkunci dilewati seluruhnya (tidak ada drift check)

Target: `price-drift-service.ts` dari ~7KB → di bawah 2KB.

**Selesai P2 bila:** `/bq/settings` tidak ada di navigasi. STAFF tidak punya akses BQ. Banner drift satu kalimat per object.

---

## P3 — Hitung ulang instan di klien

**Tujuan:** Ubah qty ambalan 3 → 5, angka L1 dan grand total berubah tanpa jeda. Seperti prototype.

**Masalah sekarang:** `useMutate()` di `BqBreakdownClient.tsx` (sekitar baris 110) memanggil `router.refresh()` tiap perubahan angka → roundtrip server setiap keystroke.

**Solusi:** `calc.ts` adalah modul murni — bisa diimpor di klien tanpa modifikasi apapun.

### Alur baru

```
Estimator commit angka (blur/Enter, NumberCell sudah benar)
  → hitung ulang di browser pakai calc.ts → layar berubah seketika
  → mutasi dikirim ke server (optimistic update)
  → router.refresh() datang sebagai rekonsiliasi
  → kalau server menolak: rollback nilai lama + toast error
```

**Aturan:** Server tetap SSOT. Tidak ada logika hitung baru di klien — hanya memanggil `calc.ts` yang sudah ada. PRD rule #5 aman.

**Selesai P3 bila:** Ubah qty di field ambalan, total baris dan total object berubah di layar tanpa delay terasa. Tanpa `router.refresh()` di jalur critical path perubahan angka.

---

## P4 — Library resep (L1 dan L2)

**Tujuan:** Estimator bisa simpan object atau sub-object yang sudah dikerjakan, lalu panggil lagi di project lain.

### B2 — Schema dua tabel library

```prisma
model BqLibraryObject {
  id           String   @id @default(cuid())
  code         String?
  name         String
  unit         String
  markup_pct   Decimal  @db.Decimal(9,6)
  detail_mode  BqDetailMode @default(DETAIL)
  notes        String?
  created_by_name String
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  deleted_at   DateTime?

  sub_objects  BqLibrarySubObjectOfObject[]
}

// Sub-object yang disimpan di dalam L1 — BUKAN FK ke BqLibrarySubObject
// (supaya mengubah "Ambalan standar" tidak diam-diam mengubah setiap L1)
model BqLibrarySubObjectOfObject {
  id           String   @id @default(cuid())
  library_object_id String
  library_object   BqLibraryObject @relation(fields: [library_object_id], references: [id])
  name         String
  qty          Decimal  @db.Decimal(18,6)
  notes        String?
  sort_order   Int      @default(0)
  materials    BqLibraryMaterialLine[]
  services     BqLibraryServiceLine[]
}

model BqLibrarySubObject {
  id           String   @id @default(cuid())
  name         String
  qty          Decimal  @db.Decimal(18,6)
  notes        String?
  created_by_name String
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  deleted_at   DateTime?
  materials    BqLibraryMaterialLine[]
  services     BqLibraryServiceLine[]
}

model BqLibraryMaterialLine {
  id                  String  @id @default(cuid())
  // FK ke salah satu dari dua parent (keduanya nullable, validasi di app layer)
  sub_object_of_object_id String?
  sub_object_id        String?
  sku_id               String
  qty_per_sub          Decimal @db.Decimal(18,6)
  waste_override_pct   Decimal? @db.Decimal(9,6)
  sort_order           Int     @default(0)
}

model BqLibraryServiceLine {
  id                  String  @id @default(cuid())
  sub_object_of_object_id String?
  sub_object_id        String?
  work_price_id        String
  qty_per_sub          Decimal @db.Decimal(18,6)
  sort_order           Int     @default(0)
}
```

**Tidak ada kolom `snapshot_*`** di semua tabel library. Library menyimpan **resep**, bukan angka terkunci.

### B3 — "Save to library"

Tambahkan tombol **Save to library** di:
- Object row → simpan sebagai `BqLibraryObject` beserta seluruh sub-object-nya
- Sub-object row → simpan sebagai `BqLibrarySubObject` berdiri sendiri

Yang disalin: `sku_id`, `work_price_id`, `qty_per_sub`, `waste_override_pct`, `qty` L2, struktur.  
Yang **tidak** disalin: semua kolom `snapshot_*`, `is_manual_override`.

Baris yang `sku_id`-nya `null` (SKU-nya sudah dihapus dari master) **tidak boleh ikut** — tolak dengan pesan yang menyebut baris mana (`"Baris [nama bahan] tidak bisa disimpan: SKU sudah dihapus dari master data"`).

Flow: tombol klik → dialog kecil "beri nama" → simpan.

### B4 — "Panggil dari library"

Lewat jalur yang sudah ada di `BqLinePicker`, bukan jalur kedua. Tambahkan tab atau toggle "Dari library" di picker.

Alur konversi:
```
Estimator pilih entri library
  → untuk tiap baris: loadMaterialCandidate(sku_id)
  → bekukan snapshot_* saat itu juga
  → simpan sebagai BqMaterialLine / BqServiceLine biasa
```

Setelah dituang: baris tidak punya hubungan dengan library. Bisa disunting bebas.

Baris yang materialnya `NO_PRICE` **dilaporkan** sebelum penuangan, bukan disisipkan dengan harga nol.

### B5 — Halaman `/bq/library`

Menggantikan `/bq/settings` di navigasi sidebar BQ.

Dua tab: **Objects** | **Sub-objects**

Per entri: nama, jumlah baris, tanggal dibuat, dibuat oleh. Aksi: rename, soft-delete, lihat isi.

Permission: `BQ_BREAKDOWN_EDIT` — library milik estimator.

**Selesai P4 bila:** Estimator simpan "Ambalan standar" dari project A, buka project B, panggil dari library, harga yang terpakai adalah harga master saat itu (bukan harga saat disimpan).

---

## Urutan eksekusi ringkas

```
P1 (butuh Q1=Ya)  →  P2  →  P3  →  P4
```

Setiap tahap berakhir dengan:
```bash
npx tsc --noEmit && npx eslint src/ && npm test
# → AT-01 harus tetap Rp5.653.559
```

Migrasi **selalu aditif** terlebih dahulu. Baru hapus model/tabel setelah backfill + verifikasi.

---

## File utama yang akan terdampak

| File | Tahap | Aksi |
|---|---|---|
| `prisma/schema.prisma` | P1, P4 | Tambah kolom Sku; tambah 4 model library; drop BqMaterialProfile (P1 fase 2); drop BqCategoryWaste (P2) |
| `src/subapps/bq/services/master-data-service.ts` | P1 | `toCandidate()` baca dari Sku, bukan profil |
| `src/subapps/bq/services/settings-service.ts` | P1, P2 | Hapus `BqCategoryWaste` logic; hapus `BqMaterialProfile` logic |
| `src/subapps/bq/services/price-drift-service.ts` | P2 (D4) | Sederhanakan ke `hasDrift: boolean`, target <2KB |
| `src/app/bq/settings/page.tsx` | P2 (D3) | **HAPUS** |
| `src/subapps/bq/components/BqSettingsClient.tsx` | P2 (D3) | **HAPUS** |
| `src/subapps/bq/actions/bq-settings-actions.ts` | P2 (D3) | Sisakan hanya action untuk 2 default kantor |
| `src/subapps/bq/components/BqBreakdownClient.tsx` | P3 (B1) | Tambah optimistic update pakai `calc.ts` |
| `src/app/bq/library/page.tsx` | P4 (B5) | **BUAT BARU** |
| `src/lib/constants.ts` | P2 | Cabut `BQ_ACCESS` + `BQ_SETTINGS_MANAGE` dari STAFF (kalau Q2=Ya) |

---

## Yang TIDAK boleh dikerjakan OpenCode tanpa handoff baru dari Claude

- Mengubah `calc.ts` atau `calc.test.ts`
- Mengubah `AGENTS.md`
- Mengerjakan item yang di `roadmap.md` masih bertanda `⏳ owner`
- Menyentuh subapp lain (Master Data, dll) selain penambahan field di form SKU (P1.5)
