PRD PATCH 1: CORE SYSTEM BRIDGING (THE MISSING ENGINE)
0. INTRODUCTION & STRICT RULES
Dokumen ini adalah Patch (Tambalan) untuk menyempurnakan PRD 1, PRD 2, dan PRD 3. Aturan eksekusi:

JANGAN menghapus skema yang sudah ada, cukup lakukan ALTER/ADD pada Prisma Schema.

Semua aksi mutasi baru WAJIB dibungkus dalam prisma.$transaction.

1. SCHEMA ADDITIONS (ERD PATCH)
Tambahkan dan perbarui model berikut di dalam schema.prisma:

Cuplikan kode
// --- 1. SETTINGS & TEMPLATES ---
model TimelineTemplate {
  id              String   @id @default(uuid())
  phase_enum      String   @unique // MOODBOARD, LAYOUT, dll
  duration_days   Int      @default(7)
}

model ChecklistTemplate {
  id              String   @id @default(uuid())
  phase_enum      String   // MOODBOARD, LAYOUT, dll
  label           String
  is_active       Boolean  @default(true)
}

// --- 2. VENDOR RELATION ---
model Vendor {
  id              String   @id @default(uuid())
  name            String
  contact_person  String?
  phone           String?
  address         String?
  libraries       GlobalLibrary[] // Relasi 1-to-M ke GlobalLibrary
}

// Tambahkan field ini ke model GlobalLibrary eksisting (Ganti vendor_name string menjadi relasi):
// vendor_id      String?
// vendor         Vendor?  @relation(fields: [vendor_id], references: [id])

// --- 3. PROJECT CHECKLIST & CD LIST ---
model ProjectChecklist {
  id              String   @id @default(uuid())
  project_id      String
  project         Project  @relation(fields: [project_id], references: [id])
  phase_id        String
  phase           Phase    @relation(fields: [phase_id], references: [id])
  label           String
  is_checked      Boolean  @default(false)
}

model CDList {
  id              String   @id @default(uuid())
  phase_id        String   // Harus mengarah ke Phase dengan name_enum = CD
  phase           Phase    @relation(fields: [phase_id], references: [id])
  group_code      String   // misal: "ARS", "MEP", "INT"
  drawing_name    String
  status_enum     String   @default("PENDING") // PENDING, ON_PROGRESS, DELIVERED
  assigned_to_id  String?  // Relasi ke User (DrIC)
}

// --- 4. DELIVERABLES (Update model File eksisting) ---
// Tambahkan field ini ke model File di PRD 1:
// link_url       String?  // Untuk Google Drive link
// is_external    Boolean  @default(false) // True jika link_url diisi, False jika upload file lokal
2. BACKWARD TIMELINE PLANNING (ENGINE ENGINE)
Logika Kalkulasi: Jika Project.opening_date TIDAK NULL, sistem harus otomatis menghitung mundur jadwal ProjectTimeline berdasarkan TimelineTemplate.

Holiday API & Weekends: Fungsi kalkulator (calculateBackwardTimeline) HARUS melompati hari Sabtu & Minggu. Mock atau sediakan integrasi sederhana untuk Holiday API (hari libur nasional) agar tanggal tersebut juga dilewati.

Fallback: Jika opening_date == NULL, biarkan start_date dan end_date pada ProjectTimeline kosong (fitur disable).

Admin Settings: Buat UI di halaman Settings /settings agar Admin bisa mengubah duration_days di TimelineTemplate.

3. AUTO-NAMING CONVENTION
Action Update: Pada fungsi bootstrapProject(data), ubah logika penyimpanan Project.name.

Format: [YYYY]-[NNN]-[Nama Input]. (Contoh: 2026-001-Kopi Kenangan).

Logika: NNN didapat dengan menghitung jumlah proyek yang dibuat pada tahun berjalan (YYYY) ditambah 1.

4. CD LIST (DRAFTING MODULE)
Access Control: Modul ini eksklusif untuk DrIC dan ADMIN.

UI Placement: Saat user masuk ke Phase "CD" (Construction Drawing), render tabel interaktif CDList.

Action: Sediakan fungsi createCDItem, updateCDStatus, dan deleteCDItem. Hanya DrIC yang ditugaskan pada proyek tersebut (atau Admin) yang boleh memicu fungsi ini.

5. CHECKLIST SYSTEM
Bootstrap Injection: Saat bootstrapProject dijalankan, sistem HARUS mengambil semua data aktif dari ChecklistTemplate, lalu men-duplikasinya menjadi baris-baris baru di tabel ProjectChecklist yang terikat pada proyek dan fase yang baru dibuat tersebut.

UI: Tampilkan checklist ini di dalam "Phase Detail Canvas". User dengan akses Edit dapat melakukan toggle is_checked.

6. DELIVERABLES TRACKING VIEW
File vs Link: Berikan opsi pada UI saat submit deliverable: "Upload File" atau "Provide URL (Google Drive)".

Tracking Page: Buat rute baru app/projects/[id]/deliverables/page.tsx. Halaman ini menampilkan tabel rekap seluruh File/Deliverables dari semua revisi yang statusnya sudah COMPLETED, agar klien atau manajemen bisa melacak output final dengan mudah tanpa masuk ke masing-masing fase.