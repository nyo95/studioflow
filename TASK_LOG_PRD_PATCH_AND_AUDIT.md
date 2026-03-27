# Task Log

## Scope

Dokumen ini mencatat hasil dari 2 permintaan terakhir:

1. Implementasi backend patch untuk PRD Patch 1
2. Sync audit antara backend, Prisma schema, server actions, dan frontend App Router

---

## 1. Backend Patch: Perubahan yang Sudah Dilakukan

### File yang diubah

- [prisma/schema.prisma](/d:/Projects/radsaas-2/prisma/schema.prisma)
- [src/app/actions.ts](/d:/Projects/radsaas-2/src/app/actions.ts)

### Prisma schema

Sudah dipastikan ada dan sinkron:

- `TimelineTemplate`
- `ChecklistTemplate`
- `Vendor`
- `ProjectChecklist`
- `CDList`

Update schema yang sudah aktif:

- `GlobalLibrary.vendor_name` diganti ke:
  - `vendor_id String?`
  - `vendor Vendor?`
- `File` sudah memiliki:
  - `link_url String?`
  - `is_external Boolean @default(false)`

### bootstrapProject

Perubahan pada `bootstrapProject`:

- Auto-naming project sudah diterapkan:
  - format: `[YYYY]-[NNN]-[Input Name]`
- Nama input dinormalisasi dengan `trim()`
- Perhitungan nomor urut menggunakan count project dengan prefix tahun berjalan
- Seluruh proses tetap dibungkus dalam satu `prisma.$transaction`
- 5 phase tetap dibuat berurutan
- Inject checklist dipindahkan agar dilakukan setelah semua 5 phase selesai dibuat
- Semua `ChecklistTemplate` aktif di-copy menjadi `ProjectChecklist` berdasarkan `phase_enum`
- Timeline tetap dibuat di dalam transaksi yang sama jika `opening_date` tersedia

### Perbaikan sinkronisasi backend akibat patch schema

Selain permintaan utama, ada mismatch backend yang saya rapikan supaya schema baru tidak merusak action layer:

- `addToProjectSchedule`:
  - snapshot `vendor_name` sekarang diambil dari relasi `vendor?.name`
- `createLibraryItem`:
  - input diubah dari `vendor_name` menjadi `vendor_id`
- `deleteProject`:
  - ditambah penghapusan `ProjectChecklist`
  - ditambah penghapusan `CDList`
  - ini diperlukan agar delete tidak gagal karena foreign key setelah patch schema

### Validasi yang sudah dijalankan

- `npx prisma validate` -> sukses
- `npx prisma generate --schema prisma/schema.prisma` -> sukses

### Migration

Yang sudah dicoba:

- `npx prisma migrate dev --create-only --name prd_patch_1_backend`

Hasil:

- gagal karena Prisma mendeteksi drift antara database lokal dan migration history
- database lokal sudah berisi schema aktif, tetapi folder migration belum menjadi baseline yang sesuai

Yang kemudian saya lakukan:

- generate diff SQL manual dari database aktual ke schema Prisma
- hasilnya kosong, yang berarti database lokal saat ini sudah match dengan schema patch

File yang dibuat:

- [prisma/migrations/20260326_prd_patch_1_backend/migration.sql](/d:/Projects/radsaas-2/prisma/migrations/20260326_prd_patch_1_backend/migration.sql)

Isi file:

```sql
-- This is an empty migration.
```

Catatan:

- Saya tidak menjalankan `prisma db push`
- Saya tidak menerapkan `prisma migrate dev` ke database

---

## 2. Sync Audit: Perubahan yang Sudah Dilakukan

### File yang diubah

- Tidak ada perubahan kode untuk task audit

### Yang dilakukan

- Audit dashboard project list terhadap Prisma schema
- Audit Phase Detail Canvas terhadap server component fetching, typing, dan props client components
- Audit Deliverables Tracking View terhadap schema Patch 1 (`link_url`, `is_external`)
- Audit binding tombol UI ke server actions
- Audit masking RBAC frontend vs validasi backend

### Ringkasan temuan utama

- Ada fallback auth yang membuat user tanpa session dianggap `ADMIN`
- Tombol delete project belum dilindungi RBAC di frontend maupun backend
- Toggle checklist hanya dijaga di UI, belum dijaga di server action
- CD List belum mengikuti aturan assignment DrIC dan belum menghormati `phase.is_locked`
- Phase detail belum memverifikasi bahwa `phaseId` benar-benar milik `projectId`
- Phase detail belum memakai `link_url` untuk file external pada tampilan draft attachments
- Dialog add deliverable masih muncul untuk role yang seharusnya tidak bisa edit
- Upload file lokal masih mock path
- Type safety belum ketat karena masih ada `any` di beberapa jalur server-to-client
- Dashboard masih memakai `Table`, belum `DataTable` abstraction seperti PRD 3

---

## 3. Status Akhir

### Kode yang benar-benar berubah

- [prisma/schema.prisma](/d:/Projects/radsaas-2/prisma/schema.prisma)
- [src/app/actions.ts](/d:/Projects/radsaas-2/src/app/actions.ts)
- [prisma/migrations/20260326_prd_patch_1_backend/migration.sql](/d:/Projects/radsaas-2/prisma/migrations/20260326_prd_patch_1_backend/migration.sql)

### Kode yang hanya diaudit

- [src/app/(dashboard)/page.tsx](/d:/Projects/radsaas-2/src/app/(dashboard)/page.tsx)
- [src/components/project-list-client.tsx](/d:/Projects/radsaas-2/src/components/project-list-client.tsx)
- [src/app/(dashboard)/projects/[id]/phases/[phaseId]/page.tsx](/d:/Projects/radsaas-2/src/app/(dashboard)/projects/[id]/phases/[phaseId]/page.tsx)
- [src/app/(dashboard)/projects/[id]/deliverables/page.tsx](/d:/Projects/radsaas-2/src/app/(dashboard)/projects/[id]/deliverables/page.tsx)
- [src/components/phase-actions.tsx](/d:/Projects/radsaas-2/src/components/phase-actions.tsx)
- [src/components/phase-checklist.tsx](/d:/Projects/radsaas-2/src/components/phase-checklist.tsx)
- [src/components/cd-list-table.tsx](/d:/Projects/radsaas-2/src/components/cd-list-table.tsx)
- [src/components/activity-manager.tsx](/d:/Projects/radsaas-2/src/components/activity-manager.tsx)
- [src/components/deliverable-upload-dialog.tsx](/d:/Projects/radsaas-2/src/components/deliverable-upload-dialog.tsx)
- [src/lib/auth.ts](/d:/Projects/radsaas-2/src/lib/auth.ts)
- [src/lib/session.ts](/d:/Projects/radsaas-2/src/lib/session.ts)

