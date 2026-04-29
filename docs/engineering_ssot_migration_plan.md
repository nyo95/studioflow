# Implementation Plan: SSOT Optimization (Zero-Regression & No Downgrade)

**Document Purpose:** 
Panduan eksekusi yang telah disaring secara ketat berdasarkan prinsip: **Hanya mengimplementasikan optimasi logika**, serta **menolak aturan SSOT v1.2 yang berpotensi menjadi regresi atau downgrade** (misal: memaksakan perubahan enum uppercase yang berisiko merusak data lama, atau membuang sistem `Revision` yang sudah canggih).

---

## 🟢 PHASE 1: Workflow Optimization (Smart Input Guard)
**Tujuan:** Mempercepat kerja desainer di tahap awal (moodboard) dengan membolehkan input "Color/Finishing" tanpa harus memaksa adanya "SKU" (mengikuti aturan SSOT: *SKU+Name OR Category+Color/Finish*).

*   [ ] **T1.1: Refactor `ScheduleSnapshotSchema`**
    *   **File:** `src/lib/validations/schedule-snapshot.ts`
    *   **Action:** Ubah `catalog_sku` dan `catalog_product_name` menjadi `.optional()`.
    *   **Action:** Tambahkan `.superRefine()` pada schema object untuk menegakkan aturan:
        *   Jika `catalog_sku` KOSONG, maka `catalog_color` (atau finishing) WAJIB ADA.
        *   Jika `catalog_color` KOSONG, maka `catalog_sku` WAJIB ADA.
*   [ ] **T1.2: UI Form Adjustment**
    *   **File:** `src/extensions/schedule/components/ScheduleProductPickerModal.tsx` (atau komponen form terkait).
    *   **Action:** Pastikan UI merespons validasi Zod yang baru. Hilangkan tanda `*` (required murni) dari field SKU jika Color sudah diisi, sehingga form bisa di-submit sebagai Draft.
*   [ ] **T1.3: Service Layer Safeguard**
    *   **File:** `src/extensions/schedule/services/schedule-service.ts`.
    *   **Action:** Pastikan logika pengecekan duplikat (`checkDuplicateProduct`) tidak *crash* jika SKU kosong (lakukan pencarian duplikat berbasis color/finishing jika mode draft).

---

## 🟢 PHASE 2: Data Integrity Optimization (Project Code Isolation)
**Tujuan:** Memisahkan identitas unik proyek (`project_code`) dari nama proyek (`name`). Saat ini kode dan nama tergabung di `name`, yang rapuh jika klien tiba-tiba meminta ganti nama proyek.

*   [ ] **T2.1: Prisma Schema Update**
    *   **File:** `prisma/schema.prisma`
    *   **Action:** Tambahkan `project_code String @unique @default("TEMP")` pada model `Project`. (Note: kita beri default sementara untuk bypass error saat migrasi data lama).
*   [ ] **T2.2: Migration & Backfill**
    *   **Action:** Buat Prisma migration.
    *   **Action:** Buat skrip seed kecil di dalam `ProjectService` atau via script terpisah untuk melakukan *backfill*: mengekstrak kode dari `name` proyek lama (misal "2025-429 Heloskin" -> `project_code: 2025-429`) untuk memastikan **zero regression** pada data existing.
*   [ ] **T2.3: Project Creation Logic**
    *   **File:** `src/extensions/project-management/services/project-service.ts`
    *   **Action:** Modifikasi fungsi `createProject` agar menerima atau meng-generate `project_code` secara terpisah dari `name` saat proyek baru dibuat.

---

## 🛑 REJECTED TASKS (DO NOT IMPLEMENT)
Tugas-tugas dari SSOT v1.2 berikut **ditolak** pelaksanaannya karena melanggar prinsip *"No Regression / No Downgrade"*:

1.  **Enum Uppercase Standardization (`ProductType.MATERIAL`)**
    *   *Alasan Penolakan:* Mengubah enum di DB akan menyebabkan migrasi data skala besar yang berisiko merusak integrasi UI dan data existing tanpa memberikan keuntungan optimasi logika yang nyata (murni kosmetik).
2.  **Downgrade ke Model `DesignItem`**
    *   *Alasan Penolakan:* Sistem codebase saat ini (`Revision` + `File`) adalah fitur *advanced* yang mendukung pengelompokan banyak file dalam satu iterasi revisi. Menggantinya dengan `DesignItem` tunggal adalah sebuah **downgrade arsitektural**.
3.  **Mengubah status `FINISHED` menjadi `COMPLETED` di CDList**
    *   *Alasan Penolakan:* Kosmetik murni; mengubahnya berisiko mematahkan status badge UI tanpa value operasional.

---
*Status: PLAN ONLY - Ready for Execution Review*
