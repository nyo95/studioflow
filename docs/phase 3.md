# 🏛️ Implementation Plan: Global Terminology Refactor & Framework Standardization
## Target: Universal Prefixing, Backend-to-UI Alignment, & API Scalability

Dokumen ini adalah "Master Plan" untuk refaktor besar-besaran (Global Refactoring) yang akan menerapkan hierarki *prefix* pada seluruh basis kode, sehingga seluruh elemen antara antarmuka (UI), struktur data (Backend), dan pedoman sistem (SSOT) menggunakan bahasa eksak yang persis sama. Refaktor ini akan memastikan StudioFlow stabil, independen dari istilah legacy, dan siap di ekspansi melalui API pihak ketiga (khususnya SketchUp).

---

## 1. Tabel Pemetaan Nomenklatur & Prefix Strategy

Standardisasi ini didasarkan pada 3 pilar domain (*namespaces*):

| Domain | Legacy / UI terms (Bervariasi) | New Unified Prefix (Backend + UI) |
|---|---|---|
| **Ekstensi Schedule** | `category`, `sort`, `code` | `schedule_category`, `schedule_sort_order`, `schedule_code` |
| **Material Catalog** | `motif_or_color`, `sku`, `URL` | `catalog_motif`, `catalog_sku`, `catalog_reference_url` |
| **Architectural Core** | `project_type`, `origin_phase_id` | `core_project_type`, `phase_id` (Standardized core id) |

> [!IMPORTANT]
> **Aturan Wajib Namespacing**
> Tidak boleh ada satupun field di *Schedule Option Snapshot* atau *Material Catalog* yang membingungkan atau "saru" dengan data inti. Seluruhnya harus mereferensikan prefix yang benar.

---

## 2. Daftar Audit & Perubahan Struktural

Berikut ini adalah *scope* refactor yang akan dieksekusi di seluruh sistem:

### A. Validasi & Backend Layer (Prisma & API Actions)
- [ ] Scan total folder `src/lib/validations/` menggunakan *regex* untuk menghapus *hardcoded schema keys* yang tidak lagi sesuai standar SSOT.
- [ ] Refactor `ScheduleSnapshotSchema` untuk menjamin tidak ada alias. Jika nama objek di DB adalah `catalog_motif`, maka di JSON Payload harus eksak `catalog_motif`.
- [ ] Ganti referensi `motif_or_color` atau properti ambigu lainnya pada `ScheduleService.ts` dan `ProjectScheduleEntry`.

### B. UI & Frontend Layer
- [ ] Merapikan prop-drilling di dalam komponen *Schedule Tables* (`ProjectScheduleMain`, `ScheduleEntryRow`) untuk menghindari `as any` dan mewajibkan interface ber-prefix (`schedule_` & `catalog_`).
- [ ] Update filter & pengurutan baris UI supaya menyesuaikan key `schedule_sort_order`.

### C. Pembentukan Pilar SketchUp API (`src/api/README.md`)
- [ ] **Desain Skema**: Pembuatan dokumentasi endpoint yang memungkinkan SketchUp Plugin melakukan GET terhadap `ProjectScheduleEntry` menggunakan `project_id`.
- [ ] **Data Mapping**: Payload yang di-emit melalui API berwujud *flattened array* dengan aturan *prefix* (memudahkan rendering V-Ray & Enscape component mapper).
- [ ] Standardisasi REST payload (misal, `GET /api/schedule/:project_id`).

### D. Dokumen Governance (AGENTS.md & SSOT)
- [ ] Update `MASTER_SSOT.md` untuk mengkodifikasikan kebijakan penambahan *namespace*.
- [ ] Update `AGENTS.md` agar seluruh asisten model AI di masa depan sadar bahwa menambah field tanpa awalan domain (contoh: `price` alih-alih `catalog_price`) adalah PELANGGARAN KRITIKAL.

---

## 3. Progress Tracking (Checklist Eksekusi Baris-Demi-Baris)

Untuk menjaga *repository stability* agar aplikasi tidak "patah" di tengah jalan, eksekusi akan dipisah menjadi beberapa *PR/Commit blocks*:

- [ ] **Tahap 1: Backend & Schema Calibration.** Re-mapping *Service Layers* dan pengecekan *TypeScript build errors*.
- [ ] **Tahap 2: UI Binding & Render Pass.** Memastikan komponen React tidak *crash* setelah properti datanya diubah referensinya.
- [ ] **Tahap 3: SketchUp API Mockup & Documentation.** Membangun pedoman untuk integrasi *3rd-party*.
- [ ] **Tahap 4: Update Dokumen Perintah.** Membenahi `AGENTS.md` dan `MASTER_SSOT.md` secara literatur.

---

## 4. Kriteria Sukses (Audit Points)
1. **Zero UI Crash**: Saat membuka tabel Scheduler dan mengklik opsi, tidak memicu "White Screen of Death" dari TypeError.
2. **TypeScript 0 Errors**: Pengecekan dengan `npx tsc --noEmit` wajib lulus mulus.
3. **API Predictability**: Payload `JSON` yang di cetak melalui Server Actions memiliki root name yang seragam (mis. Semua elemen produk diawali oleh `catalog_`).
4. **Legitimasi Aturan**: Siapapun yang membaca `AGENTS.md` langsung memahami bahwa nama kolom `/^catalog_/i` wajib dipakai untuk Material.

> [!NOTE]
> Jika `implementation_plan.md` ini sudah sesuai secara komprehensif, silakan ketik **"Execute"**, dan saya akan langsung masuk ke **Tahap 1** secara sistematis.
