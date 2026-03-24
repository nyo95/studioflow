# PRD 2: RAD SAAS — EXTENSIONS (AGENT-OPTIMIZED)

## 0. STRICT CONSTRAINTS
* **Urutan Eksekusi**: Modul ini hanya boleh dikerjakan jika seluruh fitur di PRD 1 telah lulus uji.
* **Immutability**: Dilarang mengubah *behavior* transisi fase atau skema inti yang ada di PRD 1.
* **Data Integrity**: *Snapshot* data harus bersifat deterministik dan mengikuti *interface* TypeScript yang kaku.

---

## 1. SCHEMA ADDITIONS (PRISMA)
Tambahkan blok kode ini ke dalam `schema.prisma`. Jangan menghapus model yang sudah ada dari PRD 1.

```prisma
model GlobalLibrary {
  id            String            @id @default(uuid())
  category_enum String            // MATERIAL, FIXTURE
  internal_code String            @unique
  item_name     String
  vendor_name   String
  price         Float
  specs         Json              // Detail spesifikasi (Key-Value pair)
  image_url     String?
  status        String            @default("PENDING") // PENDING, APPROVED
  schedules     ProjectSchedule[]
}

model ProjectSchedule {
  id                  String         @id @default(uuid())
  project_id          String
  project             Project        @relation(fields: [project_id], references: [id])
  category_enum       String
  data_snapshot       Json           // WAJIB mengikuti interface LibrarySnapshot
  original_library_id String?
  library_master      GlobalLibrary? @relation(fields: [original_library_id], references: [id], onDelete: SetNull)
  created_at          DateTime       @default(now())
}
```

---

## 2. STRICT SNAPSHOT INTERFACE
Untuk mencegah Agent memasukkan data sampah ke dalam *field* JSON, gunakan kontrak *interface* berikut di level aplikasi:

```typescript
interface LibrarySnapshot {
  internal_code: string;
  item_name: string;
  vendor_name: string;
  price_at_snapshot: number; // Penamaan spesifik untuk audit harga historis
  specs: Record<string, string>;
  image_url: string | null;
  snapshot_timestamp: string; // ISO String saat data ditarik
}
```

---

## 3. ACTION CONTRACTS (DETERMINISTIC)

### A. addToProjectSchedule(projectId, libraryItemId)
Aksi untuk menarik item dari katalog global ke dalam daftar material proyek.
* **Preconditions**:
    * Item di `GlobalLibrary` harus ada dan memiliki `status == "APPROVED"`.
* **Steps ($transaction)**:
    1.  Ambil data terbaru dari `GlobalLibrary` berdasarkan `libraryItemId`.
    2.  Validasi status (Throw `ITEM_NOT_APPROVED` jika gagal).
    3.  **Mapping**: Transformasi data master menjadi objek yang sesuai dengan `LibrarySnapshot`.
    4.  **Insert**: Masukkan ke `ProjectSchedule` dengan `data_snapshot` berisi objek hasil transformasi dan `original_library_id` terhubung ke master.

### B. updateGlobalItemStatus(libraryItemId, newStatus)
Aksi khusus Admin untuk menyetujui item baru di katalog.
* **Preconditions**: `User.role == ADMIN`.
* **Steps**: Update `GlobalLibrary.status`.

### C. createLibraryItem(data)
* **Preconditions**: User role is ADMIN, DIC, DRIC, or STAFF.
* **Steps**:  
    * **Logic Status**:
        * IF User.role == ADMIN, set status = "APPROVED".
        * ELSE (untuk DIC, DrIC, STAFF), set status = "PENDING".  
    * **Insert** : Insert data ke GlobalLibrary dengan status yang sudah ditentukan.

### D. insertAuditLog(action, entityType, entityId, userId, details)
* **Aturan Wajib**: Fungsi ini HARUS dipanggil di dalam `prisma.$transaction` setiap kali terjadi mutasi data krusial.
* **Integrasi**: 
  - Saat `addToProjectSchedule` dieksekusi, catat aksi ini ke AuditLog.
  - Saat `approveClientPhase` atau `reopenPhase` dieksekusi, catat ke AuditLog.

---

## 4. UI & FALLBACK RULES

### A. Handling Master Deleted (The "Archive" Rule)
Jika item asli di `GlobalLibrary` dihapus, relasi `original_library_id` akan menjadi `null`. Sistem **DILARANG** *crash* dan harus mengikuti aturan berikut:
* **Render**: Gunakan data yang ada di dalam `data_snapshot` untuk menampilkan informasi barang.
* **Visual Warning**: Tampilkan label atau *badge* bertuliskan **"[MASTER DIARSIPKAN]"** pada baris tabel tersebut.
* **Disabled Actions**: Matikan tombol "Sync with Master" atau "View Original" karena referensi master sudah hilang.

### B. Library Catalog Modal
* Tampilkan semua item dengan `status == "APPROVED"`.
* Saat DIC memilih item, jalankan aksi `addToProjectSchedule` secara *background*.

---

## 5. REVISION & SNAPSHOT SYNC
* **Snapshot Persistence**: Data di `ProjectSchedule` tidak boleh berubah meskipun harga di `GlobalLibrary` diperbarui, kecuali user menekan tombol "Sync" secara manual.
* **Audit Trail**: Setiap penambahan ke `ProjectSchedule` harus dicatat dalam `AuditLog` (jika diaktifkan di PRD 1).