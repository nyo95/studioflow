# PRD 1: RAD SAAS — CORE SYSTEM (AGENT-OPTIMIZED)

## 0. STRICT SYSTEM BOUNDARIES
* **DILARANG** menambah logika, *field*, atau perilaku di luar dokumen ini.
* Semua mutasi database **HARUS** bersifat deterministik dan atomik menggunakan `prisma.$transaction`.
* **DILARANG** melakukan *parsing* string manual untuk versi revisi; gunakan *field* `major` dan `minor` secara numerik.
* Gunakan kode error standar yang telah ditentukan untuk semua kegagalan validasi.

---

## 1. PRISMA SCHEMA (SINGLE SOURCE OF TRUTH)
Gunakan skema relasional ini. Jangan mengubah nama *field* atau tipe data.

```prisma
enum Role { ADMIN; DIC; DRIC; STAFF }
enum PhaseName { MOODBOARD; LAYOUT; DESIGN_3D; CD; SUPERVISION }
enum ProjectStatus { ACTIVE; COMPLETED; ON_HOLD }

model User {
  id                   String    @id @default(uuid())
  name                 String
  role                 Role      @default(STAFF)
  projects_as_designer Project[] @relation("Designer")
  projects_as_drafter  Project[] @relation("Drafter")
}

model Project {
  id              String        @id @default(uuid())
  name            String
  pic_designer_id String
  designer        User          @relation("Designer", fields: [pic_designer_id], references: [id])
  pic_drafter_id  String
  drafter         User          @relation("Drafter", fields: [pic_drafter_id], references: [id])
  opening_date    DateTime?
  project_type    String        @default("RETAIL") // RETAIL, NON_RETAIL
  status_progress ProjectStatus @default(ACTIVE)
  phases          Phase[]
}

model Phase {
  id                String      @id @default(uuid())
  project_id        String
  project           Project     @relation(fields: [project_id], references: [id])
  name_enum         PhaseName
  status_enum       String      @default("PENDING") // PENDING, IN_PROGRESS, ON_REVIEW_INTERNAL, ON_REVIEW_CLIENT, READY_FOR_NEXT, COMPLETED
  order_index       Int
  is_locked         Boolean     @default(false)
  revisions         Revision[]
}

model Revision {
  id          String         @id @default(uuid())
  phase_id    String
  phase       Phase          @relation(fields: [phase_id], references: [id])
  major       Int            @default(1)
  minor       Int            @default(0)
  status_enum String         @default("ACTIVE") // ACTIVE, COMPLETED
  activities  Activity[]
}

model Activity {
  id          String         @id @default(uuid())
  revision_id String
  revision    Revision       @relation(fields: [revision_id], references: [id])
  content     String
  mode        String         // TODO, FEEDBACK
  status      String         @default("OPEN") // OPEN, DONE
}
```

---

## 2. ERROR CODES
Gunakan string persis seperti di bawah ini untuk *throw error*:
* `UNAUTHORIZED_ACTION`: User tidak memiliki peran yang sesuai.
* `INVALID_PHASE_STATE`: Status fase tidak memungkinkan untuk aksi tersebut.
* `PHASE_ALREADY_LOCKED`: Mencoba mengubah fase yang sudah terkunci.
* `UNRESOLVED_ACTIVITIES_EXIST`: Masih ada Activity dengan status `OPEN`.
* `RACE_CONDITION_PREVENTED`: Terjadi konflik akses data simultan.

---

## 3. BOOTSTRAP PROJECT (ATOMIC TRANSACTION)
Saat membuat Proyek baru, jalankan langkah-langkah berikut dalam satu transaksi:
1.  Simpan entitas `Project`.
2.  Buat 5 `Phase` secara berurutan (`order_index` 1-5): `MOODBOARD`, `LAYOUT`, `DESIGN_3D`, `CD`, `SUPERVISION`.
3.  Set `Phase[1]` (MOODBOARD) -> `status_enum = IN_PROGRESS`.
4.  Set `Phase[2-5]` -> `status_enum = PENDING`.
5.  Buat `Revision` pertama untuk `Phase[1]` dengan `major=1, minor=0, status=ACTIVE`.

---

## 4. ACTION CONTRACTS (DETERMINISTIC LOGIC)

### A. approveInternal(phaseId)
* **Preconditions**: `phase.is_locked == false` AND `phase.status_enum == IN_PROGRESS` AND tidak ada `Activity.status == OPEN`.
* **Steps**: Update `phase.status_enum` -> `ON_REVIEW_CLIENT`.

### B. approveClientPhase(phaseId)
* **Preconditions**: `phase.is_locked == false` AND `phase.status_enum == ON_REVIEW_CLIENT` AND tidak ada `Activity.status == OPEN`.
* **Steps**:
    1.  Update `phase.status_enum` -> `READY_FOR_NEXT`, `phase.is_locked` -> `true`.
    2.  Set `current_revision.status_enum` -> `COMPLETED`.
    3.  Cari fase berikutnya (`order_index + 1`).
    4.  **IF** fase berikutnya ada: set status -> `IN_PROGRESS`, buat `Revision` baru (1.0, ACTIVE).
    5.  **IF** tidak ada fase berikutnya: set `project.status_progress` -> `COMPLETED`.

### C. rejectPhase(phaseId, type: 'INTERNAL' | 'CLIENT')
* **Preconditions**: `phase.is_locked == false`.
* **Steps**:
    1.  Set `current_revision.status_enum` -> `COMPLETED`.
    2.  Hitung versi baru:
        * **INTERNAL**: `newMajor = oldMajor`, `newMinor = oldMinor + 1`.
        * **CLIENT**: `newMajor = oldMajor + 1`, `newMinor = 0`.
    3.  Buat `Revision` baru dengan versi tersebut.
    4.  **KLONING**: Salin semua `Activity` (`mode == FEEDBACK` AND `status == OPEN`) dari revisi lama ke revisi baru sebagai `mode == TODO`.
    5.  Update `phase.status_enum` -> `IN_PROGRESS`.

### D. reopenPhase(phaseId)
* **Preconditions**: `phase.is_locked == true` AND `User.role == ADMIN`.
* **Steps**:
    1.  Set `phase.is_locked` -> `false`, `phase.status_enum` -> `IN_PROGRESS`.
    2.  Set `active_revision.status_enum` -> `COMPLETED`.
    3.  **Major Reset Rule**: Buat `Revision` baru dengan `major = oldMajor + 1` dan `minor = 0`.

### E. completeSupervisionPhase(phaseId) - *Khusus Fase 5*
* **Preconditions**: `phase.name_enum == SUPERVISION` AND `phase.status_enum == IN_PROGRESS`.
* **Steps**:
    1.  Set `phase.status_enum` -> `COMPLETED`, `phase.is_locked` -> `true`.
    2.  Set `project.status_progress` -> `COMPLETED`.
    3.  Set `current_revision.status_enum` -> `COMPLETED`.

---

## 5. UI & LOGIC GUARDRAILS
* **Deliverables Dependency**: *Deliverables* bersifat mandiri. Tidak adanya file **TIDAK BOOTSTRAP** atau menghalangi transisi fase.
* **Locked UI**: Jika `phase.is_locked == true`, semua kontrol mutasi (tombol edit/delete/status) **HARUS** dinonaktifkan (*Read-only*).
* **Revision Labeling**: Render label menggunakan logika `${major}.${minor}`.

---

## 6. ROLE PERMISSION MATRIX
Validasi ini **WAJIB** diterapkan pada level *Server Actions*.

| Role | Phase 1, 2, 3, 5 Access | Phase 4 (CD) Access | Global Library Access |
| :--- | :--- | :--- | :--- |
| **ADMIN** | Full Access | Full Access | Full CRUD (Auto-Approve) |
| **DIC** | Full Access | Read-Only | Create (Status: PENDING) |
| **DrIC** | Read-Only | Full Access | Create (Status: PENDING) |
| **STAFF** | Read-Only | Read-Only | Create (Status: PENDING) |