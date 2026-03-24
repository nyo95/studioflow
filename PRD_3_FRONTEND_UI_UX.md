PRD 3: RAD SAAS — FRONTEND & UI/UX (AGENT-OPTIMIZED)
0. STRICT FRONTEND CONSTRAINTS
Prerequisite: PRD 1 dan PRD 2 HARUS sudah diimplementasikan (Backend, Prisma Schema, dan Server Actions sudah berjalan).

Tech Stack: Next.js (App Router), Tailwind CSS, Shadcn UI, dan Lucide Icons.

Server Components First: Prioritaskan penggunaan React Server Components untuk fetching data. Gunakan Client Components ("use client") hanya jika memerlukan interactivity (misalnya: drag-and-drop, modals, buttons yang memanggil mutasi).

Direct Server Actions: Panggil Server Actions dari PRD 1 & 2 secara langsung di Client Components tanpa perlu membuat rute API (/api/...) perantara.

No Mock Data: Gunakan tipe data TypeScript yang dihasilkan dari schema.prisma di PRD 1 & 2.

1. UI/UX DESIGN SYSTEM (THE "STUDIOFLOW" VIBE)
Tampilan aplikasi harus mengadopsi struktur layout modern dengan prinsip berikut:

Global Navigation (Sidebar Kiri Luar): Berisi menu utama seperti Today, Upcoming, Projects, Timeline, dan Admin Settings.

Contextual Navigation (Sidebar Kiri Dalam): Hanya muncul saat masuk ke dalam spesifik proyek. Berisi navigasi Phases (Moodboard, Layout, dll) dan Deliverables.

Main Canvas (Area Kanan): Area kerja utama untuk menampilkan Tasks, Revisions, dan Data Tables.

Minimalist Aesthetic: Gunakan background putih/abu-abu terang (bg-slate-50), border halus (border-slate-200), dan tipografi yang bersih (Inter atau font sans-serif default Tailwind).

2. COMPONENT SPECIFICATIONS (SHADCN UI MAPPING)
Gunakan komponen Shadcn UI untuk elemen-elemen berikut:

Data Tables: Gunakan DataTable untuk Project List, Global Library, dan Project Schedule.

Badges: Gunakan Badge untuk menampilkan status_enum dari Phase dan Project (misal: "In Progress" warna biru, "Locked" warna abu-abu).

Modals/Dialogs: Gunakan Dialog untuk form "Create Project", "Add to Project Schedule", dan konfirmasi Actions.

Tabs: Gunakan Tabs di dalam tampilan Revisi untuk memisahkan "Tasks" dan "Feedback".

Buttons: Gunakan Button standar. Jika tombol memicu mutasi (seperti Approve Phase), tambahkan state loading (disabled saat pending).

3. CORE VIEWS & BEHAVIORAL BINDING
A. Project Dashboard (The Master List)
Visual: Menampilkan daftar semua proyek dalam format tabel yang mirip dengan Google Sheets eksisting (Nama Proyek, Klien, PIC, Status, dsb).

Action: Tombol "Create Project" memanggil modal form. Saat form di-submit, eksekusi Server Action bootstrapProject(data).

B. Phase Detail View (The Engine Room)
Visual: Tampilan kanvas utama saat sebuah Fase diklik dari Contextual Sidebar. Tampilkan Header Nama Fase, Status Fase, dan Daftar Revisi.

State Binding:

Baca is_locked dari model Phase.

Jika is_locked == true, render seluruh komponen form dan tombol (kecuali "Reopen Phase" untuk Admin) dalam keadaan disabled.

Actions Integration:

Tombol "Submit for Client Review" -> Panggil approveInternal(phaseId).

Tombol "Approve (Move to Next Phase)" -> Panggil approveClientPhase(phaseId).

C. Material & Fixtures (Project Schedule View)
Visual: Tampilan tabel untuk melihat Bill of Materials pada proyek tertentu.

Fallback Rule (CRITICAL): Terapkan The Archive Rule dari PRD 2. Jika referensi master hilang (original_library_id == null), baca data dari data_snapshot dan render Badge merah "[MASTER DIARSIPKAN]". Tombol "Sync" harus dimatikan.

4. AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
Middleware: Terapkan Next.js Middleware sederhana. Baca nilai Role dari session/context user saat ini.

UI Masking: Sembunyikan atau nonaktifkan elemen UI berdasarkan Role Permission Matrix di PRD 1.

Contoh: Jika Role == STAFF, tombol "Approve Phase" tidak di-render sama sekali.

Contoh: Jika Role == DIC, menu "Global Library" hanya merender tombol "Request Item" (bukan "Add & Approve").