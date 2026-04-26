# Next.js & Prisma Agent Rules (RADSAAS_2)

## ⚠️ Critical Environment Warning
This project uses specific Next.js APIs and Prisma configurations that may differ from your base training data. 
- ALWAYS check `node_modules/next/dist/docs/` for recent API changes.
- HEED all deprecation notices immediately.

## 🛡️ Runtime & Configuration Audit
"Setiap kali melakukan perubahan pada konfigurasi sistem (Prisma, Next Config, Tailwind), kamu WAJIB melakukan validasi silang antara file konfigurasi (`schema.prisma`) dengan file implementasi (`src/lib/db.ts`) untuk memastikan tidak ada mismatch pada provider atau pathing."

## 🔄 UI Refresh Protocol
"DILARANG menggunakan `window.location.reload()`. Gunakan `router.refresh()` dari `next/navigation` untuk melakukan revalidasi data tanpa memuat ulang seluruh halaman."

## 🔍 Deep Context Scan Protocol
"Gunakan fitur @Codebase atau Indexing di IDE ini untuk membaca seluruh keterkaitan file sebelum men-generate kode baru. Jangan hanya mengandalkan file yang sedang terbuka atau linting standar."

## 🎨 Visual Identity (Studioflow)
"Gunakan font Lora (serif) untuk heading/judul dan Inter (sans-serif) untuk UI fungsional. Gunakan design tokens (`font-serif`, `font-sans`, `border-subtle`). Pastikan desain tetap bersih dengan border halus (slate-200) dan background slate-50."


## 🚫 UI/UX Preservation Protocol
"DILARANG KERAS mengubah struktur tata letak (layout) yang sudah ada—seperti mengganti sidebar menjadi tab horizontal—tanpa permintaan eksplisit dari pengguna. Jangan menambahkan elemen estetika 'Premium' (shadow berlebih, animasi kompleks, font dekoratif baru) jika tidak diminta. Pertahankan fungsionalitas di atas hiasan visual."

## 🏷️ Project Naming Protocol
"Format nama proyek WAJIB menggunakan: `[Tahun]-[Nomor] [Nama Proyek]`. Contoh: `2025-429 Heloskin Cimanggu`. Pastikan ada spasi (bukan dash) antara nomor urut dan nama proyek."

## 👁️ View-First Protocol
"Setiap modal/form untuk data yang sudah ada WAJIB dibuka dalam mode read-only secara default. Gunakan tombol 'Modify' (icon Edit3) sebagai gatekeeper untuk masuk ke mode edit. DOMAIN EXCEPTION: Project Schedule entries LANGSUNG terbuka dalam mode edit (tidak perlu Gatekeeper Modify) karena data bersifat lokal/project-level yang tidak mempengaruhi Master Catalog."

## 📐 Design System Enforcement (Zero Hardcode Policy)
"DILARANG KERAS menggunakan nilai hardcoded untuk visual properties (misalnya `rounded-xl`, `p-5`, `shadow-md`, `text-2xl`). Kamu WAJIB melakukan hal berikut:
1. **Cross-Check Tokens**: Selalu periksa `src/ui_engine/design-system.config.ts` dan `src/styles/designTokens.css` sebelum menulis kode UI.
2. **Use Semantic Tokens**: Gunakan variabel CSS (misal `rounded-[var(--radius-premium)]`) atau config object (`DESIGN_SYSTEM_CONFIG.spacing.radius`).
3. **Consistency over Speed**: Jangan menebak-nebak nilai. Jika token tidak ditemukan, tanyakan atau gunakan nilai yang paling mendekati dari konfigurasi yang ada."


## 🧱 Pillar 2 Resilience Protocol
1. **Explicit Promotion**: Material catalog data bersifat 'Master'. Project data harus di-snapshot (PRD 2 rules). Data dari project TIDAK BOLEH auto-sync ke Library tanpa validasi eksplisit.
2. **Gatekeeping**: 
   - **Stage 1 (Mandatory Color)**: Diperlukan untuk update snapshot lokal.
   - **Stage 2 (Identity + Media)**: SKU, Product Name, Brand, dan Image WAJIB lengkap sebelum tombol 'Promote to Library' diaktifkan.
3. **Audit Mandatory**: Setiap mutasi pada Library atau Scheduler Category WAJIB mencatat `insertAuditLog`.
3. **No Legacy Models**: DILARANG mengekspos atau menggunakan model `GlobalLibrary` dan `ProjectSchedule`. Gunakan `ProductCatalog` dan `ProjectScheduleEntry`.
4. **Deterministic Coding**: Semua kode scheduler harus dikelola melalui `ScheduleService.normalizeCodes` untuk memastikan integritas prefix.
5. **Terminology Architecture**: WAJIB menggunakan namespaced prefix (`catalog_`, `schedule_`). Format identitas produk: `[catalog_sku] - [catalog_product_name] ex. [catalog_brand]`.
6. **Documentation First**: "Apabila mengedit `src/extensions/schedule/`, kamu WAJIB membaca [src/extensions/schedule/README.md](file:///d:/Misc/ProjectsHUB/radsaas-2/src/extensions/schedule/README.md) terlebih dahulu untuk memahami workflow snapshotting dan terminologi Pillar 2."
7. **Zod Schema Namespacing**: Setiap Zod Schema yang merefleksikan model Prisma WAJIB menggunakan nama field yang identik dengan schema (mis. `schedule_category`, bukan `category`). DILARANG melakukan mapping di level Action jika field tersebut bersifat inti.

## 👑 AI Main Lead Governance (Lead Agent Protocol)
As the **Main Lead**, the AI Assistant is the designated custodian of the project's architectural integrity and documentation.
1. **SSOT Enforcement**: All code changes must be validated against `MASTER_SSOT.md`.
2. **Rule Custodian**: The AI is responsible for updating `AGENTS.md` and `MASTER_SSOT.md` to reflect architectural evolutions.
3. **Tracking & Materiality**: Every material change (defined as any change to business logic, persistence schema, or user-facing contracts) MUST be recorded in `CHANGELOG.md`.
4. **Semantic Assessment Protocol**: Upon completion of every task, the agent MUST evaluate if there were "Semantical Changes" (changes to architecture, workflow, core contracts, or canonical rules). If YES, `MASTER_SSOT.md` MUST be updated immediately.
5. **Confirm-First Protocol**: If a gap is discovered between the SSOT and the codebase that appears to be the result of a previously approved (but undocumented) user decision, the agent MUST seek explicit confirmation before treating it as a deviation.
6. **Deviation Blocking**: If a request conflicts with established SSOT rules, the AI must block the implementation, flag the conflict, and seek explicit user override.
7. **UI Changelog Protocol**: Kamu WAJIB mencatat setiap perubahan pada UI (warna, radius, spacing, skeleton) di `CHANGELOG.md` bagian `## UI Changes` untuk mencegah regresi saat pergantian agent.