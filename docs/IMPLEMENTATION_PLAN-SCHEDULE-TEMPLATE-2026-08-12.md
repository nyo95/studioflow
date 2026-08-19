# Implementation Plan — Schedule Reuse Pool + Default Template Item

**Dibuat:** 2026-08-12 · **Untuk:** agent pelaksana (coding)
**Analisa sumber:** `docs/ANALISA-SCHEDULE-REUSE-2026-08-12.md` (baca §1b dan §1c dulu — plan ini tidak mengulang buktinya)
**Roadmap:** `roadmap.md` → R-SCHED-REUSE, R-SCHED-TPL-1, R-SCHED-TPL-2 (2a–2e)

---

## 0. Baca ini dulu, jangan dilewat

Wajib dibaca sebelum menulis baris pertama:

1. `AGENTS.md` — khususnya §Pillar 2 Resilience Protocol (audit log wajib, namespaced
   prefix `catalog_`/`schedule_`, `normalizeCodes` satu-satunya jalur penomoran) dan
   §Design System Enforcement (dilarang hardcode nilai visual).
2. `src/extensions/schedule/README.md` — diwajibkan AGENTS.md §Pillar 2 no. 6 untuk siapa
   pun yang menyentuh `src/extensions/schedule/`.
3. `docs/ANALISA-SCHEDULE-REUSE-2026-08-12.md` §1b–§1c.

**Aturan main plan ini:**

- Kerjakan **berurutan**. Fase 1 memblokir Fase 2; Fase 2 memblokir Fase 3.
- **Satu fase = satu commit** (atau satu PR). Jangan gabung.
- Setiap fase punya *Definition of Done* — jangan lanjut sebelum semuanya hijau.
- Setiap fase **wajib** menambah entri `changelog.md` dan mencentang item terkait di
  `roadmap.md`. Ini aturan proyek, bukan opsional.
- Kalau menemukan fakta yang membuat plan ini salah, **berhenti dan laporkan**. Jangan
  improvisasi diam-diam — plan ini dibuat dari pembacaan kode, bukan dari database hidup.

**Batasan lingkungan:**

- Tidak ada koneksi database saat menulis kode. Migrasi **ditulis tangan** sebagai SQL
  (lihat pola `prisma/migrations/20260812130000_promotion_request_add_fk_enum_index/migration.sql`),
  jangan jalankan `prisma migrate dev`. Jangan mengarang hasil verifikasi DB.
- Verifikasi yang tersedia: `npx tsc --noEmit` (wajib exit 0), `npm run lint`,
  `node scripts/run-tests.mjs`.
- Test runner memakai `node --test` atas `*.test.ts` di `src/`. **File yang diuji tidak
  boleh menyentuh Prisma atau `server-only` saat runtime** — makanya fungsi murni
  (`deriveScheduleSpecFields`, planner pencocokan) yang diuji, bukan service-nya.

**Keputusan owner yang sudah terkunci — jangan ditawar ulang:**

| # | Keputusan |
|---|-----------|
| 1 | Template = reserved. **SketchUp yang menyesuaikan**, bukan sebaliknya. |
| 2 | **Tidak ada propagasi.** Semua product catalog hanya snapshot; salin-saat-apply. Edit template tidak mengubah proyek yang sudah jalan. |
| 3 | StudioFlow ⟂ BQ ⟂ Master Data. Master Data hanya nyambung ke `extensions/library`. **Item template dilarang ditulis ke `master_data`.** |
| 4 | Plugin SketchUp diperbaiki **belakangan** — Fase 4 di sini hanya guard sisi server. |
| 5 | Item template mendarat `is_final: true`, `status: APPROVED`. |

---

## 1. Fase 1 — Sentralisasi penulisan `ProjectScheduleOption` (R-SCHED-REUSE-1)

**Kenapa duluan:** semua yang lain bergantung pada `spec_*` yang benar. Kalau backfill
(Fase 2) dijalankan sebelum kebocoran ditutup, datanya rusak lagi besok.

### 1.1 Buat helper tunggal

File baru: `src/extensions/schedule/services/schedule-option-writer.ts`

```ts
import type { Prisma } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
import { deriveScheduleSpecFields } from "./schedule-service";

/**
 * SATU-SATUNYA jalur tulis `data_snapshot` ke ProjectScheduleOption.
 *
 * Alasannya ada di docs/ANALISA-SCHEDULE-REUSE-2026-08-12.md §2: `spec_*`
 * adalah index turunan dari snapshot, dan sebelum ini 17 titik tulis menulis
 * snapshot tanpa ikut memperbarui index-nya — akibatnya reuse pool
 * ("From a past project") tidak pernah menemukan apa pun. Jangan panggil
 * `tx.projectScheduleOption.create/update` dengan `data_snapshot` di luar
 * berkas ini.
 */
export async function createScheduleOption(
  tx: PrismaTransaction,
  data: Omit<Prisma.ProjectScheduleOptionUncheckedCreateInput, "data_snapshot" | "spec_brand_id" | "spec_product_name" | "spec_color" | "spec_finishing" | "spec_search_key"> & {
    data_snapshot: ScheduleSnapshot;
  },
) { /* create + ...deriveScheduleSpecFields(data.data_snapshot) */ }

export async function updateScheduleOptionSnapshot(
  tx: PrismaTransaction,
  optionId: string,
  snapshot: ScheduleSnapshot,
  extra?: { status?: ...; is_final?: boolean; sku_id?: string | null },
) { /* update + ...deriveScheduleSpecFields(snapshot) */ }
```

Catatan implementasi:

- `deriveScheduleSpecFields` saat ini di-`export` dari `schedule-service.ts:217`.
  Boleh dipindah ke helper baru dan di-re-export dari tempat lama supaya import lama
  tidak pecah — pilih salah satu, jangan duplikat implementasinya.
- Jangan menambah validasi baru di helper. Pemanggil sudah melakukan
  `ScheduleSnapshotSchema.parse()`; helper menerima snapshot yang **sudah** tervalidasi.
- Waspada circular import antara helper dan `schedule-service.ts`. Kalau muncul,
  pindahkan `deriveScheduleSpecFields` + tipe `ScheduleSnapshot` ke helper dan biarkan
  service yang mengimpor helper, bukan sebaliknya.

### 1.2 Migrasikan 17 titik tulis

Semua titik ini menulis `data_snapshot` **tanpa** `spec_*`. Ganti semuanya ke helper:

| File | Baris | Konteks |
|------|-------|---------|
| `src/extensions/sketchup/actions/sketchup-actions.ts` | 1218, 1223 | sync material → update/create option |
| | 1355, 1360 | sync fixture → update/create option |
| | 1426 | update snapshot material |
| | 1658 | update option |
| | **1785** | `addManualCatalogItemAction` — draft snapshot menimpa placeholder |
| | 2125 | auto-link material → create entry+option |
| | 2197 | auto-link fixture |
| | 2547, 3101, 3333 | update snapshot dari edit kartu / bulk |
| | 3734 | create option |
| `src/lib/schedule/csv-import.ts` | 92, 118, 229 | import CSV |
| `src/extensions/schedule/services/schedule-service.ts` | 773, 887, 956, 1525 | sudah benar — tetap migrasikan ke helper supaya jalurnya satu |

`csv-import.ts:106` dan `schedule-service.ts:1077` adalah `updateMany` untuk
`is_final`/status saja (tidak menyentuh snapshot) — **biarkan**.

### 1.3 Pagar regresi

Tambahkan aturan ESLint `no-restricted-syntax` di `eslint.config.mjs` yang melarang
`tx.projectScheduleOption.create`/`.update` dengan properti `data_snapshot` di luar
`schedule-option-writer.ts`. Kalau terlalu ribet dengan AST selector, minimal tambahkan
komentar `// eslint-disable` + catatan di README schedule. Pagar > niat baik: bug ini
lahir persis karena tidak ada pagarnya.

### Definition of Done — Fase 1

- [ ] `grep -rn "projectScheduleOption.create\|projectScheduleOption.update" src/ | grep -v generated | grep -v schedule-option-writer` → hanya menyisakan `updateMany` non-snapshot.
- [ ] `npx tsc --noEmit` exit 0.
- [ ] `npm run lint` bersih.
- [ ] `node scripts/run-tests.mjs` hijau.
- [ ] Test baru `src/extensions/schedule/services/schedule-spec-fields.test.ts`: fungsi murni `deriveScheduleSpecFields` — brand+product+color+finishing → key lowercase `::`-joined; field kosong dilewati; semua kosong → `null`.
- [ ] Entri `changelog.md` + centang `roadmap.md` R-SCHED-REUSE-1.

---

## 2. Fase 2 — Perluas search key + backfill (R-SCHED-REUSE-2 & -3)

### 2.1 Tambah kategori ke search key

`deriveScheduleSpecFields` sekarang memakai `[brand, product, color, finishing]`.
Designer mengetik "acr"/"acrylic" — itu **nama kategori**. Tambahkan
`snapshot.schedule_category` sebagai bagian key.

Urutan baru: `[category, brand, product, color, finishing]`.

⚠️ **Konsekuensi:** `spec_search_key` juga dipakai sebagai kunci **grouping** di
`searchReusableSpecs` (`schedule-service.ts:1621-1646`). Menambah kategori berarti spec
yang sama di dua kategori berbeda tidak lagi tergabung. Itu perilaku yang **benar**
(ACR-nya acrylic, bukan glass), tapi harus disadari — jangan kaget kalau `usage_count`
turun.

### 2.2 Saring placeholder dari reuse pool

Snapshot placeholder menghasilkan key sampah: `"[RESERVED]"`/`"PENDING"` (mode `reserve`,
`schedule-service.ts:711-717`) dan `"Manual Item"`/`"Custom"`
(`sketchup-actions.ts:1752-1753`). Kalau tidak disaring, setelah backfill reuse pool akan
penuh baris `"acrylic::custom::manual item"`.

Pakai daftar placeholder yang **sudah ada**, jangan bikin baru:
`src/extensions/schedule/lib/display-utils.ts:3` (`PLACEHOLDERS`). Aturannya: kalau
`catalog_product_name` **dan** `catalog_brand` dua-duanya placeholder →
`spec_search_key = null` (tidak masuk pool). Kategori saja tidak cukup untuk masuk pool.

### 2.3 Script backfill

File baru: `scripts/backfill-schedule-spec-fields.mjs` (ikuti pola
`scripts/backfill-party-roles.mjs`).

Perilaku wajib:

- Iterasi `ProjectScheduleOption` per batch (mis. 500) pakai cursor, bukan `findMany` sekaligus.
- Untuk tiap baris: baca `data_snapshot` → hitung ulang `spec_*` dengan logika **yang sama persis** dengan Fase 1/2.1 → update kalau berbeda.
- **`--dry-run` sebagai default.** Menulis hanya kalau ada flag `--apply` eksplisit.
- Laporkan: jumlah dibaca, jumlah berubah, jumlah `spec_search_key` null sebelum vs sesudah, dan 10 contoh key hasil.
- Idempoten: jalan dua kali → perubahan kedua = 0.
- Baris dengan `data_snapshot` null/tak-terparse: **skip + hitung**, jangan crash, jangan tulis.

Jangan duplikasi logika derivasi di script. Impor dari sumber yang sama (script `.mjs`
tidak bisa impor TS langsung — pilih: (a) jalankan lewat `tsx`, atau (b) pindahkan
derivasi ke satu modul kecil tanpa dependensi Prisma yang bisa ditranspilasi seperti
`scripts/run-tests.mjs` melakukannya). **Menyalin-tempel rumusnya = menciptakan drift
kedua** — persis penyakit yang sedang diperbaiki.

### 2.4 Guard UI saat pool kosong

`CatalogBoard.tsx` — teks *"No matching items from past projects"* tidak membedakan
"tidak ketemu" dari "pool memang belum ada isinya". Tambahkan hint sekunder saat
`reuseItems.length === 0 && reuseQuery.length >= 2`, misalnya: *"Belum ada material dari
proyek lain yang cocok. Pool terisi otomatis dari item yang sudah dispesifikasi di proyek
mana pun."* Ikuti design token yang sudah dipakai di dialog itu — jangan hardcode.

### Definition of Done — Fase 2

- [ ] Test `deriveScheduleSpecFields` diperluas: kategori masuk key; placeholder-only → `null`.
- [ ] `node scripts/backfill-schedule-spec-fields.mjs` (dry-run) jalan tanpa error dan mencetak ringkasan. **Jangan jalankan `--apply`** — itu wewenang owner terhadap DB produksi.
- [ ] `npx tsc --noEmit` exit 0, lint bersih, test hijau.
- [ ] Entri changelog + centang roadmap R-SCHED-REUSE-2 & -3, R-SCHED-REUSE-4 (guard UI).

**Serahkan ke owner:** instruksi satu baris cara menjalankan backfill `--apply`, dan
peringatan bahwa itu harus dijalankan **setelah** Fase 1 ter-deploy.

---

## 3. Fase 3 — Default Template **Item** (R-SCHED-TPL-2a/2b/2c)

### 3.1 Schema

Dua perubahan di `prisma/schema.prisma`:

```prisma
/// Item default yang otomatis dipasang ke setiap proyek baru — kartu yang sudah
/// terisi spesifikasinya, bukan sekadar kategori kosong. Snapshot-nya beku dan
/// DISALIN saat apply (keputusan owner 2026-08-12: tidak ada propagasi), formatnya
/// identik dengan ProjectScheduleOption.data_snapshot.
/// Lihat docs/ANALISA-SCHEDULE-REUSE-2026-08-12.md §1b.
model ScheduleTemplateItem {
  id                String      @id @default(uuid())
  section           ProductType @default(material)
  schedule_category String
  sort_order        Int
  data_snapshot     Json
  /// Ikut kalau sumber kartunya pernah ditautkan ke Library. Nullable dan boleh
  /// menunjuk baris yang sudah hilang — alasan sama dengan
  /// ProjectScheduleOption.sku_id sejak M5.
  sku_id            String?
  is_active         Boolean     @default(true)
  created_at        DateTime    @default(now())
  updated_at        DateTime    @updatedAt
  entries           ProjectScheduleEntry[]

  @@index([section, schedule_category, sort_order])
  @@schema("studioflow")
}
```

```prisma
model ProjectScheduleEntry {
  // ... field yang sudah ada
  /// Slot ini berasal dari template kantor. Sekaligus penanda "reserved" di sisi
  /// schedule (is_reserved yang lama hidup di SketchupMaterial — sisi yang salah,
  /// lihat §1c) dan kunci idempotensi apply template.
  template_item_id  String?
  template_item     ScheduleTemplateItem? @relation(fields: [template_item_id], references: [id], onDelete: SetNull)

  @@index([project_id, template_item_id])
}
```

Migrasi tulis tangan: `prisma/migrations/2026MMDDHHMMSS_schedule_template_item/migration.sql`.
`CREATE TABLE` + `ALTER TABLE ... ADD COLUMN` + FK `ON DELETE SET NULL` + index. Beri
komentar SQL berbahasa Indonesia seperti migrasi tetangganya. `onDelete: SetNull` disengaja:
menghapus item template **tidak boleh** menghapus kartu di proyek yang sudah jalan.

### 3.2 Service: mode `template`

`ScheduleService.addEntryToSchedule` (`schedule-service.ts:609`) — tambah `"template"`
ke union `mode` dan parameter `templateItemId?: string`.

Cabang barunya **menyalin** `ScheduleTemplateItem.data_snapshot`, persis seperti cabang
`"reuse"` yang sudah ada (`schedule-service.ts:735-746`) — jangan tulis mekanika baru:

```
mode === "template":
  source = tx.scheduleTemplateItem.findUniqueOrThrow({ id: templateItemId })
  finalSnapshot = { ...source.data_snapshot, snapshot_captured_at: now }
  resolvedCatalogId = source.sku_id
  isFinal = true; optionStatus = "APPROVED"        // keputusan owner #5
  → entry.template_item_id = templateItemId
```

`checkDuplicateProduct` tidak mengenal `"template"` — terjemahkan sama seperti `"reuse"`
sudah melakukannya (`schedule-service.ts:766`): `resolvedCatalogId ? "catalog" : "manual"`.

### 3.3 Service: `applyDefaultTemplateEntries` v2

`schedule-service.ts:388`. Perilaku baru:

1. Ambil `ScheduleTemplateItem` aktif, urut `section, schedule_category, sort_order`.
2. **Kunci idempotensi berubah** dari "kategori sudah punya baris apa pun" jadi
   **per `template_item_id`**: lewati item yang sudah punya entry di proyek ini dengan
   `template_item_id` sama. Ini memperbaiki cacat yang ditulis di §1b no. 4 — kategori
   yang sudah terisi dari SketchUp tetap kebagian item template.
3. Untuk tiap item yang belum ada → `addEntryToSchedule(..., "template", templateItemId)`.
4. **Pertahankan perilaku lama** untuk `ScheduleTemplate.is_default_entry` (kategori kosong
   tanpa item) — keputusan §1b no. 5. Dua-duanya jalan dalam satu panggilan.
5. Return diperluas: `{ createdCategories: string[], createdItems: string[], noDefaultsConfigured: boolean }`.
6. Audit log tetap wajib (`AUDIT_ACTIONS.SCHEDULE_APPLY_TEMPLATE`) — AGENTS.md §Pillar 2 no. 3.

Pemanggil yang ikut terpengaruh: `project-service.ts:234` (proyek baru) — tidak perlu
diubah selain menyesuaikan tipe return.

### 3.4 Action + CRUD template

`src/extensions/schedule/actions/` (atau `src/actions/settings-actions.ts` mengikuti pola
`setScheduleTemplateDefaultEntry`, `settings-actions.ts:150`) — tambah:

- `createScheduleTemplateItemFromEntryAction(projectId, entryId)` — **jalur pengisian utama.**
  Ambil option final dari entry (pola `selectedCatalogOption`, `sketchup-actions.ts:774`),
  salin `data_snapshot` + `sku_id` ke `ScheduleTemplateItem`, `sort_order` = max+1 dalam
  kategori. Izin: admin (`assertAdmin`, pola `settings-actions.ts:132`) — ini setting
  kantor, bukan aksi project-level.
- `listScheduleTemplateItemsAction(section)`
- `reorderScheduleTemplateItemsAction(section, category, orderedIds)`
- `deleteScheduleTemplateItemAction(id)` — soft (`is_active = false`) supaya entry lama
  yang menunjuknya tidak kehilangan jejak.

Zod schema di `src/lib/validations/index.ts`, dekat `SetScheduleTemplateDefaultEntrySchema`
(baris ~293). Nama field **identik dengan schema Prisma** (`schedule_category`, bukan
`category`) — AGENTS.md §Pillar 2 no. 7.

Semua mutasi → `insertAuditLog`. Semua action → `invalidateCache` / `revalidateCatalog`
mengikuti pola tetangganya.

**Dilarang:** menulis apa pun ke `master_data` dari jalur ini (keputusan owner #3).
Jangan pinjam `saveCatalogItemToLibraryAction`.

### 3.5 UI

**a. Tombol "Set as default item"** di toolbar kartu Catalog Board.
`CatalogBoard.tsx:922-985` — deretan `catalog-card-tools` yang sudah memuat tombol
"Save to Library" (`BookMarked`). Tambah satu tombol dengan pola identik:
ikon `LayoutTemplate` (sudah diimpor, baris 6), `className="catalog-tool-btn"`,
`aria-label`, `title`, `disabled` saat `!item.entry_id` atau sedang submit,
`toast` sukses/gagal, lalu `router.refresh()` (**bukan** `window.location.reload()` —
AGENTS.md §UI Refresh Protocol). Tampilkan hanya untuk admin.

**b. Daftar item template** di `TemplateManager` mode `project-engine`
(`template-manager.tsx`, dirender dari `studio-settings-panel.tsx:602`). Di bawah daftar
kategori yang sudah ada, tampilkan item default per kategori: thumbnail kecil, nama
produk, brand, tombol urutkan, tombol hapus. **Hanya lihat/urut/hapus — tidak ada form
ketik spesifikasi.** Jangan ubah struktur layout panel yang ada (AGENTS.md §UI/UX
Preservation Protocol); tambahkan sebagai blok baru di dalam section yang sudah ada.

**c. Toast "Apply default template"** (`CatalogBoard.tsx:555-564`) — pakai
`noDefaultsConfigured` dari §3.3 untuk membedakan tiga keadaan (ini menutup R-SCHED-TPL-1):

| Kondisi | Pesan |
|---|---|
| `noDefaultsConfigured` | "Belum ada item/kategori default. Atur di Settings → Studio → Project Engine." |
| `createdItems + createdCategories = 0` | "Sudah sesuai template — tidak ada yang perlu ditambahkan." |
| ada yang dibuat | "Menambahkan N item default." + `router.refresh()` |

### Definition of Done — Fase 3

- [ ] Migrasi SQL ditulis tangan, konsisten dengan `schema.prisma`, tidak dijalankan.
- [ ] Test murni untuk pemilihan item template (input: daftar template item + daftar entry yang ada → output: item mana yang harus dibuat). Ekstrak sebagai fungsi murni supaya bisa diuji tanpa Prisma. Kasus wajib: (a) proyek kosong → semua dibuat; (b) satu item sudah ada → hanya sisanya; (c) kategori sudah terisi item non-template → item template **tetap** dibuat; (d) apply dua kali → nol tambahan.
- [ ] `npx tsc --noEmit` exit 0, lint bersih, test hijau.
- [ ] Screenshot/deskripsi UI baru di changelog.
- [ ] Centang roadmap R-SCHED-TPL-2a/2b/2c dan R-SCHED-TPL-1.

---

## 4. Fase 4 — Guard sementara sisi server (R-SCHED-TPL-2d)

Plugin belum diperbaiki (keputusan owner #4), jadi yang dikerjakan hanya mencegah sync
merampas nomor milik template.

Titik ubah: auto-link material `sketchup-actions.ts:2069-2130` (dan padanan fixture
~1291-1385).

Perilaku baru, sekecil mungkin:

1. Sebelum `create` entry baru di `prefix + increment` tertentu, cek apakah nomor itu
   sudah dipegang entry dengan `template_item_id != null` yang **belum diklaim** material
   mana pun (`SketchupMaterial.linked_entry_id` null untuk entry itu).
2. Kalau ya → **jangan** pakai nomor itu. Ambil `increment` bebas berikutnya di kategori
   yang sama, dan catat `console.warn` dengan format yang sama seperti warning yang sudah
   ada di baris 2076.
3. Jangan menyentuh spesifikasi entry template. Perilaku "Schedule values win; the model
   only fills gaps" (baris 2083-2090) tetap berlaku apa adanya.

**Di luar cakupan Fase 4** (tulis sebagai TODO yang menunjuk R-SCHED-TPL-2e, jangan
dikerjakan): pencocokan per-kategori, adopsi slot template oleh material, antrean rename
`SketchupMergeAction`, pengiriman `reserved_codes` ke plugin.

### Definition of Done — Fase 4

- [ ] Test murni untuk pemilihan `increment` bebas dengan daftar nomor yang dipesan.
- [ ] `npx tsc --noEmit` exit 0, lint bersih, test hijau.
- [ ] Changelog + centang roadmap R-SCHED-TPL-2d.

---

## 5. Yang TIDAK boleh dikerjakan di plan ini

- ❌ Database terpisah untuk product schedule (§3 analisa — skema sekarang sudah benar).
- ❌ Propagasi edit template ke proyek yang sudah jalan (keputusan owner #2).
- ❌ Menulis item template ke `master_data` / Library (keputusan owner #3).
- ❌ Mengubah plugin SketchUp atau kontrak endpoint `/api/sketchup/sync` (keputusan owner #4 → R-SCHED-TPL-2e).
- ❌ Menjalankan backfill `--apply` terhadap database (wewenang owner).
- ❌ Mengganti `searchReusableSpecs` ke `GROUP BY` SQL (R-SCHED-REUSE-5, butuh DB hidup).
- ❌ Menyentuh `BrandLibraryService` / Library (R-LIB-1/2 item terpisah).
- ❌ Redesign layout Settings atau Catalog Board.

---

## 6. Checklist serah terima (untuk agent pelaksana)

Sebelum melapor selesai, pastikan:

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npm run lint` → bersih
- [ ] `node scripts/run-tests.mjs` → hijau, dan test baru memang ada
- [ ] `grep` pagar Fase 1.3 → tidak ada jalur tulis snapshot yang lolos
- [ ] `changelog.md` bertambah satu entri **per fase**, format mengikuti entri #16/#17
- [ ] `roadmap.md` item yang selesai dicentang, yang belum tetap terbuka dengan alasannya
- [ ] Daftar file yang berubah, per fase
- [ ] Daftar **asumsi** yang diambil karena tidak ada DB hidup — ini yang akan diperiksa manual
- [ ] Apa pun yang menyimpang dari plan ini, beserta alasannya. Menyimpang boleh; menyimpang diam-diam tidak.

## 7. Fokus review (untuk agent pemeriksa)

Titik yang paling mungkin salah, periksa duluan:

1. **Ada jalur tulis snapshot yang terlewat** di Fase 1 → gejalanya reuse pool bocor lagi. Cek dengan grep, bukan dengan membaca diff.
2. **Logika derivasi terduplikasi** antara helper TS dan script backfill → drift diam-diam.
3. **Kunci idempotensi apply template** salah → item template dobel tiap kali tombol ditekan, atau tidak pernah masuk ke kategori yang sudah terisi.
4. **`onDelete` FK `template_item_id`** bukan `SET NULL` → menghapus template menghapus kartu proyek. Fatal.
5. **`checkDuplicateProduct` menolak mode `template`** → apply gagal senyap di proyek yang sudah punya spec serupa.
6. **Snapshot template ikut berubah** saat kartu proyek diedit (harus tidak — salinan, bukan referensi).
7. **Placeholder bocor ke reuse pool** setelah backfill (§2.2).
8. **`insertAuditLog` hilang** di salah satu mutasi baru — dilarang AGENTS.md §Pillar 2 no. 3.
