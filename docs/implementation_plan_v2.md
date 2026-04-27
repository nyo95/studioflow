# Implementation Plan v2 (UPDATED) — Critical Audit Fixes & Production Readiness
**Dokumen ini dibuat oleh Main Lead. DILARANG interpretasi bebas. Ikuti instruksi TEPAT KATA PER KATA. This is strict, no hallucination.**

**Version:** 2.1 (Updated 2026-04-27)  
**Audit Reference:** `audit.md` (Tahap 1-3)  
**Target Audience:** Junior Agent (MUST follow execution checklist exactly)

---

## ⚠️ CRITICAL GATE: Production Build Status
**Status:** ✅ PASSING (verified)
- `npx tsc --noEmit` → exit code 0
- `npm run build` → PASSING (build block #1 from audit finding is RESOLVED in v2.4.0)

---

## Status Pekerjaan Sebelumnya (Sudah Selesai - v2.4.3.3)

Pekerjaan yang SUDAH diselesaikan oleh Main Lead:

| Fitur | Status | Detail | Audit Reference |
| :--- | :--- | :--- | :--- |
| **Shell Layout** | DONE | Fixed sidebar/footer height chain & padding. | - |
| **Search Format** | DONE | Format `[SKU] — [Nama]` di SearchBar & Gradual Form. | - |
| **Sample Indicator (Table)** | DONE | Horizontal layout, font 10px, horizontal flex-row. | - |
| **Sample Indicator (Visual)** | DONE | Status-aware Package button (Emerald/Amber). | - |
| **Library Bug Fix** | DONE | Fixed "Remove Item" prop-drilling & confirmation dialog. | - |
| **Navigation Refactor** | DONE | Sidebar Settings → Horizontal Tabs dengan Arrow Controls. | - |
| **UI Translation (ID→EN)** | DONE | Changed "Diterima/Dipesan/Dikirim/Diminta" → "Received/Ordered/Shipped/Requested" | Audit finding #17 |
| **Production Build** | DONE | Fixed type import in display-utils.ts. Build now passes. | Audit finding #1 |
| **Parallel Phase Logic** | DONE | `PhasePolicy.canActivate` enforces `allow_parallel` flags correctly. | - |

---

## Tugas Baru: Phase 3 — Critical Audit Fixes & Production Safety Hardening

**Situasi:** Audit (3 tahap) menemukan 25 findings (7 critical, 18 high/medium severity). Implementation_plan_v2 hanya mengcover 4 dari 25 issues. Plan ini DIUPDATE untuk mencakup SEMUA critical/release-blocker findings.

### TASK 3.1 — Vendor Identity Normalization (CRITICAL - Audit #4)
**File Utama:** `src/extensions/library/services/library-service.ts` (Fungsi `resolveVendor`)  
**Severity:** HIGH  
**Status:** ✅ DONE

**Masalah:** Fungsi `resolveVendor` menggunakan `.trim()` tetapi TIDAK menggunakan `.toUpperCase()`. Ini memungkinkan vendor duplikat seperti "Mowilex" vs "MOWILEX" yang seharusnya sama.

**Yang harus dilakukan (EXACT STEPS - NO INTERPRETATION):**
1. Buka file `src/extensions/library/services/library-service.ts` pada baris ~388 (fungsi `resolveVendor`)
2. Pada baris yang melakukan `const normalized = brand.trim();`:
   - Ubah menjadi: `const normalized = brand.trim().toUpperCase();`
3. Pada baris `where: { brand_name: { equals: normalized, mode: "insensitive" } }`:
   - TETAP seperti sekarang (sudah case-insensitive)
4. Pastikan fallback race condition juga tetap menggunakan `.toUpperCase()`
5. Run `npx tsc --noEmit` untuk verifikasi tidak ada type error
6. Manual test: Coba buat vendor "Mowilex", lalu buat "MOWILEX" - harus return existing vendor

**Catatan Keras:**
- JANGAN mengubah logic perbandingan (itu sudah `.mode: "insensitive"`), hanya nilai normalized saja
- JANGAN ubah error message atau throw logic
- Pastikan `.toUpperCase()` hanya diapply pada `brand` input, bukan pada hasil query

---

### TASK 3.2 — Authorization Gate untuk Update Request Status (RESOLVED NATIVELY - Audit #10)
**File Utama:** `src/extensions/library/actions/library-actions.ts` (Fungsi `updateProductRequestStatusAction`)  
**Severity:** CRITICAL (Security Issue)  
**Status:** ✅ RESOLVED NATIVELY

**Rekomendasi Main Lead (Updated):**
Berdasarkan investigasi, fungsi `updateProductRequestStatusAction` saat ini SUDAH menggunakan `getProjectMembershipOrThrow(tx, request.project_id, ctx.userId, ctx.role)` dan `RBAC.assert(tx, "plugin.library.manage", ctx.role);`. 

Fungsi `getProjectMembershipOrThrow` sudah secara aman melakukan validasi terhadap `pic_designer_id` (DIC) dan `pic_drafter_id` (DRIC) dari project tersebut, serta otomatis memberikan bypass untuk role `ADMIN`.

**Mengapa kita TIDAK melakukan refactor ke `team_members` di Phase 3 ini?**
1. **Stabilitas (Phase 3 Goal):** Schema saat ini sangat terikat pada 1 DIC dan 1 DRIC per project. Mengubahnya menjadi tabel `ProjectTeamMember` akan menghancurkan logic assignment di Phase, Activity, dan Checklist.
2. **Keamanan sudah terpenuhi:** `getProjectMembershipOrThrow` sudah secara efektif mengunci akses agar user dari project lain tidak bisa memanipulasi request.
3. **Future Plan:** Jika bisnis membutuhkan banyak member per project (misal ada tambahan role Staff/3D Artist khusus project), maka fitur `ProjectTeamMember` harus dibuat di Phase/Epic terpisah (Phase 4).

**Tindakan:**
Tidak ada perubahan kode yang diperlukan untuk fungsi ini. Task 3.2 dinyatakan selesai (Resolved by existing code). Pindah ke Task berikutnya.



### TASK 3.3 — Delete Project Audit Trail Preservation (RESOLVED NATIVELY - Audit #11)
**File Utama:** `prisma/schema.prisma` dan `src/lib/services/project-service.ts`  
**Severity:** CRITICAL (Forensic Integrity)  
**Status:** ✅ RESOLVED NATIVELY

**Rekomendasi Main Lead (Updated):**
Pengecekan schema menunjukkan bahwa model `AuditLog` sudah menggunakan `onDelete: SetNull` untuk `project` relation. Selain itu, fungsi `executeDeleteProject` di `project-service.ts` telah dimodifikasi (hard-delete audit log sudah dihapus). Audit trail sudah aman saat project dihapus. Task selesai tanpa perubahan kode tambahan.

---

### TASK 3.4 — Project Naming Protocol Enforcement (RESOLVED NATIVELY - Audit #12 & #13)
**File Utama:** `src/lib/services/project-service.ts`  
**Severity:** HIGH (Data Quality)  
**Status:** ✅ RESOLVED NATIVELY

**Rekomendasi Main Lead (Updated):**
1. **Race-Condition Auto-naming:** Fungsi bootstrap project saat ini TIDAK menggunakan `count()`. Fungsi sudah menggunakan mekanisme retry pada `P2002` constraint error yang jauh lebih aman dari race-condition dibandingkan `count()`.
2. **Manual Update Format:** Fungsi `executeUpdateProjectMetadata` sudah memiliki blok validasi regex `/^\d{4}-\d{3} .+/` untuk Admin. 
Kedua masalah ini telah ditangani di iterasi sebelumnya. Task selesai tanpa perubahan kode tambahan.

---

### TASK 3.5 — Phase Submission & Approval Blocker Consistency (HIGH - Audit #14 & #15)
**File Utama:** `src/lib/services/phase-service.ts` (Fungsi `executeSubmitInternalReview`, `executeApproveClientPhase`, `executeDeferActivity`)  
**Severity:** HIGH (Workflow Logic)  
**Status:** ✅ RESOLVED

**Masalah:** Ada inkonsistensi: Submit internal check open task, tetapi submit client review tidak. Plus approval tidak menghitung deferred task yang masih `revision_id: null`. Ini bisa lolos approval dengan work belum selesai.

**Yang harus dilakukan (EXACT STEPS - NO INTERPRETATION):**

**SubTask A - Align Client Submit Blocker:**
1. Buka `src/lib/services/phase-service.ts` pada baris ~177 (executeSubmitInternalReview)
2. Lihat logic blocker existing untuk open task
3. Cari `executeSubmitClientReview` (sekitar baris ~200-an)
4. Tambahkan blocker SAMA seperti internal: cek `OPEN` activity di active revision ATAU `OPEN` deferred (revision_id: null) pada phase ini
5. Error message: "Cannot submit to client: Deferred internal tasks still pending"

**SubTask B - Approval Must Count Deferred Tasks:**
1. Buka `src/lib/services/phase-service.ts` pada baris ~488 (executeApproveInternal)
2. Cari blocker yang memeriksa `activeRevision.activities`
3. TAMBAHKAN cek untuk deferred task:
   ```typescript
   const deferredTasks = await tx.activity.findMany({
     where: {
       phase_id: phaseId,
       revision_id: null,
       status: "OPEN"
     }
   });
   
   if (deferredTasks.length > 0) {
     throw new ActionError(
       "Cannot approve phase: Deferred tasks still pending. Must resolve or re-assign to revision first.",
       "APPROVAL_BLOCKED"
     );
   }
   ```
4. Lakukan hal yang sama di `executeApproveClientPhase` (baris ~549)

**SubTask C - executeDeferActivity Should Clarify Semantics:**
1. Buka `src/lib/services/phase-service.ts` pada `executeDeferActivity`
2. Tambahkan comment agar jelas bahwa deferred activity tetap dalam scope phase (tidak berpindah):
   ```typescript
   // Deferred tasks remain scoped to the phase but are unassigned from this revision.
   // They must be resolved before phase approval.
   ```

**Test:**
- Phase dengan open deferred task tidak bisa di-approve (error)
- Submit client review dengan open deferred task harus error
- Assign deferred task back to active revision, kemudian phase bisa approve

**Catatan Keras:**
- Jangan ubah semantik defer, hanya tambahkan blocker saat approval
- Deferred task harus tetap terlihat di phase overview agar visible untuk action

---

### TASK 3.6 — Scheduler Only Accepts APPROVED Library Items (HIGH - Audit #5)
**File Utama:** `src/extensions/library/services/library-service.ts` + `src/actions/schedule-actions.ts`  
**Severity:** HIGH (Data Quality)  
**Status:** ✅ RESOLVED

**Masalah:** Schedule picker bisa mengambil item library yang belum APPROVED (status PENDING atau REJECTED). Ini memungkinkan snapshot yang "tidak layak" masuk ke project.

**Yang harus dilakukan (EXACT STEPS - NO INTERPRETATION):**
1. Buka `src/extensions/library/services/library-service.ts` pada baris ~255 (getProductsAction atau search method)
2. Cari WHERE clause untuk product search
3. TAMBAHKAN filter: `catalog_status: "APPROVED"`
4. Buka `src/actions/schedule-actions.ts` pada baris ~139 (addScheduleEntryWithProductAction)
5. Setelah mendapatkan product dari library, VERIFIKASI status sebelum snapshot:
   ```typescript
   if (resolvedCatalogItem.catalog_status !== "APPROVED") {
     throw new ActionError(
       "Cannot use non-approved items in schedule. Status: " + resolvedCatalogItem.catalog_status,
       "INVALID_CATALOG_STATE"
     );
   }
   ```
6. Sama untuk `addScheduleOptionWithProductAction` (baris ~180-an)

**Test:**
- Create item library dengan status PENDING
- Coba add ke schedule → error "non-approved"
- Approve item, coba add lagi → success
- Search library dari schedule picker → hanya APPROVED items muncul

**Catatan Keras:**
- JANGAN ubah library filter secara global (malah harus tampil di catalog admin)
- Filter APPROVED hanya berlaku untuk scheduler context
- Manual/custom items di project tetap bisa dibuat (tidak harus library)

---

### TASK 3.7 — Schedule Swap Entry Domain Validation (HIGH - Audit #6)
**File Utama:** `src/lib/services/schedule-service.ts` (Fungsi `swapEntries`)  
**Severity:** HIGH (Data Integrity)  
**Status:** ✅ DONE

**Masalah:** Swap entries tidak memverifikasi: (a) kedua entry milik project yang sama, (b) kedua entry di category/section yang sama, (c) tidak ada audit log.

**Yang harus dilakukan (EXACT STEPS - NO INTERPRETATION):**
1. Buka `src/lib/services/schedule-service.ts` pada baris ~1135 (swapEntries)
2. Pada awal function, TAMBAHKAN validasi:
   ```typescript
   if (entryA.project_id !== entryB.project_id) {
     throw new ActionError(
       "Cannot swap entries: Different projects",
       "CROSS_PROJECT_SWAP_BLOCKED"
     );
   }
   
   if (entryA.section !== entryB.section) {
     throw new ActionError(
       "Cannot swap entries: Different product types (Material vs Fixture)",
       "CROSS_SECTION_SWAP_BLOCKED"
     );
   }
   
   if (entryA.schedule_category !== entryB.schedule_category) {
     throw new ActionError(
       "Cannot swap entries: Different categories",
       "CROSS_CATEGORY_SWAP_BLOCKED"
     );
   }
   ```
3. Tambahkan audit log SEBELUM swap terjadi (jangan setelah):
   ```typescript
   await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_SWAP_ENTRIES, "ProjectScheduleEntry", entryA.id, userId, {
     project_id: entryA.project_id,
     entry_a_id: entryA.id,
     entry_b_id: entryB.id,
     action: "SWAP_POSITIONS"
   });
   ```
4. Pastikan normalizeCodes dipanggil di akhir (sudah ada, tapi verify)

**Test:**
- Try swap dari project A dengan entry dari project B → error
- Try swap material dengan fixture → error
- Try swap paint (PT-01) dengan sanitary (SN-01) → error
- Valid swap dalam kategori → success + audit logged

**Catatan Keras:**
- Validasi HARUS sebelum transaksi mutation
- Category mismatch sudah di-protect di UI, ini adalah backend safety net
- Audit harus log KEDUA entry id

---

### TASK 3.8 — Schedule Entry Ownership Validation untuk Swap (HIGH - Audit #6)
**File Utama:** `src/actions/schedule-actions.ts` (Fungsi action yang call swapEntries)  
**Severity:** HIGH (Security)  
**Status:** ✅ DONE

**Masalah:** Action entry point untuk swap tidak memverifikasi ownership terhadap project.

**Yang harus dilakukan (EXACT STEPS - NO INTERPRETATION):**
1. Buka `src/actions/schedule-actions.ts` pada baris ~459 (swapScheduleEntriesAction atau setara)
2. Tambahkan di awal:
   ```typescript
   // Fetch entries untuk validate ownership
   const [entryA, entryB] = await Promise.all([
     tx.projectScheduleEntry.findUnique({ where: { id: input.entryAId } }),
     tx.projectScheduleEntry.findUnique({ where: { id: input.entryBId } })
   ]);
   
   // Verify both entries exist
   if (!entryA || !entryB) {
     throw new ActionError("One or both entries not found", "NOT_FOUND");
   }
   
   // Verify user has access to this project
   const project = await tx.project.findUnique({
     where: { id: entryA.project_id },
     include: { team_members: true }
   });
   
   if (!project) {
     throw new ActionError("Project not found", "NOT_FOUND");
   }
   
   if (ctx.role !== "ADMIN") {
     const isMember = project.team_members.some(m => m.user_id === ctx.userId);
     if (!isMember) {
       throw new ActionError("Unauthorized: not a member of this project", "UNAUTHORIZED");
     }
   }
   ```

**Test:**
- Login user dari Project A, try swap entry dari Project B → error
- Admin bisa swap dari any project
- Project member bisa swap dalam project mereka

**Catatan Keras:**
- JANGAN duplicate ownership logic, reuse dari project-service jika available
- Role ADMIN selalu bypass

---

### TASK 3.9 — STAFF Cannot Create APPROVED Library Items (HIGH - Audit #4)
**File Utama:** `src/extensions/library/components/LibraryFormModal.tsx` + `src/extensions/library/actions/library-actions.ts`  
**Severity:** HIGH (Governance)  
**Status:** ✅ DONE

**Masalah:** Form create product default kirim `status: "APPROVED"` dan action allow STAFF to create. Ini bypass approval queue.

**Yang harus dilakukan (EXACT STEPS - NO INTERPRETATION):**
1. Buka `src/extensions/library/components/LibraryFormModal.tsx` pada baris ~138
2. Cari default value untuk `status`:
   - Current: `status: "APPROVED"` (hardcoded)
   - Ubah menjadi: `status: "PENDING"`
3. Buka `src/extensions/library/actions/library-actions.ts` pada baris ~224 (createProductAction)
4. Cari authorization check - seharusnya ada `assertAdmin` atau `assertAdminOrStaff`:
   - Jika ada `assertAdminOrStaff`: UBAH menjadi `assertAdmin` saja
   - Jika ada `assertAdmin`: BIARKAN (sudah correct)
5. Pastikan service `createProduct` default ke `PENDING` jika role !== ADMIN:
   ```typescript
   status: ctx.role === "ADMIN" ? input.status : "PENDING"
   ```
6. Add this to LibraryFormModal display agar user tahu: 
   ```typescript
   {ctx.role !== "ADMIN" && (
     <Badge variant="secondary" className="text-xs">
       Submission will be reviewed before publication
     </Badge>
   )}
   ```

**Test:**
- STAFF create item → default PENDING
- STAFF lihat form → ada badge "will be reviewed"
- Admin create item → bisa pilih status (APPROVED atau PENDING)
- STAFF tidak bisa create action (action blocked)

**Catatan Keras:**
- Queue adalah source-of-truth untuk library quality
- STAFF boleh edit PENDING item, tapi tidak boleh bypass queue
- Existing APPROVED item yang dibuat before fix biarkan (tidak perlu migrate)

---

### TASK 3.10 — Clean Up Telemetry Fetch (HIGH - Audit #8)
**File Utama:** `src/extensions/library/components/PhysicalInventoryTable.tsx`  
**Severity:** MEDIUM (Code Quality)  
**Status:** ✅ DONE

**Masalah:** Empty state melakukan `fetch` ke `http://127.0.0.1:7243/ingest/...` tanpa guard atau feature flag. Ini adalah debug code yang seharusnya tidak ada di production.

**Yang harus dilakukan (EXACT STEPS - NO INTERPRETATION):**
1. Buka `src/extensions/library/components/PhysicalInventoryTable.tsx` pada baris ~109
2. Cari blok yang melakukan fetch ke `http://127.0.0.1:7243`
3. HAPUS sepenuhnya blok tersebut
4. Atau jika ada konteks produksi yang perlu, wrap dengan:
   ```typescript
   if (process.env.NODE_ENV === "development" && process.env.TELEMETRY_ENABLED === "true") {
     // fetch logic
   }
   ```
5. Pastikan empty state masih render dengan message yang sesuai

**Test:**
- PhysicalInventoryTable empty state → tidak ada network request ke localhost:7243
- Browser dev tools network tab → tidak ada spurious fetch
- Production build tidak include code ini

**Catatan Keras:**
- Jangan tinggal side effect di render function
- Hapus jika tidak ada use case eksplisit
- Jika ada use case, document dengan env var + comment

---

### TASK 3.11 — Vendor Merge Action Must Use Service (HIGH - Audit #2)
**File Utama:** `src/extensions/library/actions/library-actions.ts` (mergeVendorsAction)  
**Severity:** CRITICAL (Audit Trail)  
**Status:** ✅ DONE

**Masalah:** `mergeVendorsAction` melakukan mutasi langsung tanpa memanggil `LibraryService.mergeVendors`. Ini bypass audit log dan tidak sinkronisasi `catalog_brand` ke target vendor.

**Yang harus dilakukan (EXACT STEPS - NO INTERPRETATION):**
1. Buka `src/extensions/library/actions/library-actions.ts` pada baris ~131 (mergeVendorsAction)
2. Cari blok yang melakukan mutasi langsung ke `productCatalog` dan `vendor`:
   ```typescript
   // OLD - WRONG
   await tx.productCatalog.updateMany(...);
   await tx.vendor.update(...);
   // NO AUDIT LOG
   ```
3. GANTI sepenuhnya dengan:
   ```typescript
   // NEW - CORRECT
   await LibraryService.mergeVendors(tx, sourceVendorId, targetVendorId, ctx.userId);
   ```
4. Verify bahwa `LibraryService.mergeVendors` sudah call `insertAuditLog` (buka service pada baris ~654)
5. Verify bahwa service juga handle `catalog_brand` sinkronisasi (seharusnya ada di merge logic)

**Test:**
- Merge vendor A ke vendor B
- Check: semua product yang sebelumnya referensi vendor A sekarang referensi vendor B
- Check: `catalog_brand` di product tidak stale
- Check: audit log tercatat untuk setiap product yang berubah

**Catatan Keras:**
- Action hanya coordinator, SERVICE yang execute
- Jangan duplikasi logic antara action dan service
- Audit WAJIB tercatat di service layer

---

### TASK 3.12 — Promotion Request Deduplication (CRITICAL - Audit #3)
**File Utama:** `src/extensions/library/services/library-service.ts` (Fungsi promoteScheduleOptionToLibrary)  
**Severity:** CRITICAL (Data Quality)  
**Status:** ✅ DONE

**Masalah:** Saat request promosi disetujui, service langsung `create` ProductCatalog baru tanpa deduplication. Bisa menghasilkan duplikasi item dengan SKU + brand yang sama.

**Yang harus dilakukan (EXACT STEPS - NO INTERPRETATION):**
1. Buka `src/extensions/library/services/library-service.ts` pada baris ~1035 (method yang approve promotion request)
2. Sebelum `create` ProductCatalog, tambahkan check:
   ```typescript
   // Check if already exists (SKU + Brand combination)
   const existing = await tx.productCatalog.findFirst({
     where: {
       AND: [
         { catalog_sku: snapshot.specs.catalog_sku },
         { vendor: { brand_name: { equals: snapshot.catalog_brand, mode: "insensitive" } } },
         { deleted_at: null }
       ]
     },
     include: { vendor: true }
   });
   
   if (existing) {
     // Instead of creating new, link schedule_option to existing
     await tx.projectScheduleOption.update({
       where: { id: schedule_option_id },
       data: { product_catalog_id: existing.id }
     });
     
     await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_PROMOTION_DEDUPLICATED, "ProductCatalog", existing.id, userId, {
       schedule_option_id,
       reason: "Duplicate SKU+Brand found, linked instead of creating new"
     });
     
     return existing;
   }
   ```
3. Hanya jika tidak ada existing, lakukan `create`
4. Update snapshot field jika existing item lebih lengkap (merge metadata jika perlu)

**Test:**
- Create project item A (SKU: "PT-001", Brand: "Mowilex")
- Promote ke library → create ProductCatalog
- Create project item B (SKU: "PT-001", Brand: "Mowilex")  - Promote ke library → LINK to existing, bukan create baru
- Check: hanya 1 ProductCatalog dengan SKU=PT-001 Brand=Mowilex
- Check: kedua project snapshot link ke same catalog item

**Catatan Keras:**
- Dedup hanya check SKU + Brand (jangan tambah field lain seperti color)
- Existing item harus tidak deleted (deleted_at: null)
- Log dedup event untuk audit trail
- Jangan hard-overwrite existing field, hanya link

---

### TASK 3.13 — Verify Snapshot Field Mapping (MEDIUM - Audit #7)
**File Utama:** `src/extensions/schedule/services/schedule-service.ts` (Fungsi buildScheduleSnapshot)  
**Severity:** MEDIUM (Data Quality)  
**Status:** ✅ DONE

**Masalah:** Mapping antara ProductCatalog field dan snapshot field belum fully verified. Ada kemungkinan field baru di schema tidak ter-copy dengan benar.

**Yang harus dilakukan (EXACT STEPS - NO INTERPRETATION):**
1. Buka `src/extensions/schedule/services/schedule-service.ts` pada baris ~67 (buildScheduleSnapshot)
2. Review mapping logic:
   - `catalog_motif` → `specs.catalog_motif` ✓ (verify ada)
   - `catalog_color` → `specs.catalog_color` ✓ (verify ada)
   - `catalog_finishing` → `specs.catalog_finishing` ✓ (verify ada)
   - `catalog_dimension_p, l, t` → `specs.catalog_dimension_{p,l,t}` ✓ (verify ada)
3. Pastikan field baru di ProductCatalog schema (jika ada sejak v2.4) juga di-map
4. Buka `src/lib/validations/schedule-snapshot.ts` (ScheduleSnapshotSchema)
5. Verify bahwa schema Zod mencakup semua field yang di-map
6. Jalankan test: Create project entry, promote to library, verify snapshot tidak ada field yang hilang

**Test:**
- Create custom item dengan semua field (color, motif, finishing, dimensions)
- Snapshot hasil build → check semua field terisi di `specs` object
- Baca snapshot di UI → semua value muncul dengan benar
- Promote to library → ProductCatalog memiliki data lengkap

**Catatan Keras:**
- Jangan add field baru tanpa update snapshot schema Zod
- Snapshot field harus semua prefix `catalog_` atau `specs.`
- Backward compat: old snapshot yang missing field harus tetap render (fallback ke null/default)

---

---

## ✅ Verifikasi Wajib Setelah Eksekusi SETIAP Task

1. **TypeScript Check:** `npx tsc --noEmit` wajib exit code 0 setelah setiap task
2. **Build Check:** `npm run build` wajib PASSING setelah task yang berhubungan schema/type
3. **Lint Check:** `npm run lint` untuk check style
4. **Manual Test:** Setiap task harus punya minimal 1 manual test yang EXPLICIT

---

## 📋 PRIORITAS EKSEKUSI (Junior Agent WAJIB URUTI)

**CRITICAL BLOCKING (Do These FIRST - 3 tasks):**
1. ✅ **TASK 3.1** (Vendor Normalization) — Quick fix, low risk
2. ✅ **TASK 3.2** (Request Status Auth) — Security blocker, affects API
3. ✅ **TASK 3.3** (Audit Trail Preservation) — Database migration, test thoroughly

**HIGH PRIORITY (Do These SECOND - 5 tasks):**
4. ✅ **TASK 3.4** (Project Naming) — Affects future projects, race-fix required
5. ✅ **TASK 3.5** (Phase Approval Logic) — Workflow correctness, affects team
6. ✅ **TASK 3.6** (Scheduler Approved Filter) — Data quality gate
7. ✅ **TASK 3.7** (Swap Validation) — Backend safety net
8. ✅ **TASK 3.8** (Swap Ownership) — Security for action endpoint

**MEDIUM PRIORITY (Do These THIRD - 2 tasks):**
9. ✅ **TASK 3.9** (STAFF Approval Gate) — Governance fix
10. ✅ **TASK 3.10** (Clean Telemetry) — Code cleanup

**VERIFICATION TASKS (Do LAST - 3 tasks):**
11. ✅ **TASK 3.11** (Vendor Merge Service) — Audit trail cleanup
12. ✅ **TASK 3.12** (Promotion Dedup) — Data quality check
13. ✅ **TASK 3.13** (Snapshot Mapping Verify) — Integration test

---

## 🎯 Workflow untuk Junior Agent

**PENTING:** Setiap task WAJIB:
1. Read the EXACT steps
2. Do ONLY what is written (no interpretation/hallucination)
3. Run verifikasi di akhir
4. Report status: DONE / BLOCKED / NEEDS_CLARIFICATION
5. Move to next task HANYA setelah current task DONE

**Jika ada ambiguity atau kode yang tidak sesuai ekspektasi:**
- STOP
- Report exact line number dan situasi yang berbeda
- Jangan guess atau modify beyond spec

---

## 📊 Mapping Audit Findings to Tasks

| Audit Finding | Task | Status |
|---|---|---|
| #1 - Production build fail | ✅ DONE (v2.4.0) | - |
| #2 - Merge vendor bypass audit | TASK 3.11 | ⏳ |
| #3 - Promotion duplikasi | TASK 3.12 | ⏳ |
| #4 - Vendor duplicates + STAFF bypass | TASK 3.1, 3.9 | ⏳ |
| #5 - Scheduler non-APPROVED items | TASK 3.6 | ⏳ |
| #6 - Swap cross-category + no auth | TASK 3.7, 3.8 | ⏳ |
| #7 - SSOT/schema inventory drift | TASK 3.13 | ⏳ |
| #8 - Telemetry fetch debug | TASK 3.10 | ⏳ |
| #9 - Lint/build errors | ✅ DONE (v2.4.0) | - |
| #10 - Request status no auth | TASK 3.2 | ⏳ |
| #11 - Delete project audit | TASK 3.3 | ⏳ |
| #12, #13 - Project naming | TASK 3.4 | ⏳ |
| #14, #15 - Phase approval logic | TASK 3.5 | ⏳ |
| #16-25 - UI/UX friction (deferred to Phase 4) | - | - |

---

## Catatan Keras (NO EXCEPTIONS)

1. **JANGAN Interpretation:** Follow setiap step EXACTLY. Jika kode berbeda, STOP dan report.
2. **JANGAN Skip Verification:** Tiap task harus pass `npx tsc --noEmit` sebelum lanjut.
3. **JANGAN Batch Changes:** SATU task = SATU verifikasi cycle. Tidak boleh combine.
4. **JANGAN Add Features:** Hanya fix yang EXPLICIT di spec, tidak boleh improve/refactor.
5. **JANGAN Manual SQL:** Semua schema change via `prisma migrate dev`, bukan SQL langsung.
6. **JANGAN Copy-Paste Blind:** Understand code context sebelum edit. Baca file utuh jika perlu.
7. **SSOT is Source of Truth:** Jika ada conflict antara task spec dan MASTER_SSOT, PRIORITIZE SSOT.

---

## Catatan Keras untuk Vendor Identity Normalization (TASK 3.1)
- JANGAN mengubah logic perbandingan (itu sudah `.mode: "insensitive"`), hanya nilai normalized saja
- JANGAN ubah error message atau throw logic
- Pastikan `.toUpperCase()` hanya diapply pada `brand` input, bukan pada hasil query

---

## Post-Implementation Actions

Setelah semua 13 tasks SELESAI:
1. Run `npm run build` final check
2. Update CHANGELOG.md dengan semua perubahan
3. Update MASTER_SSOT.md jika ada architectural changes
4. Mark implementation_plan_v2.md as COMPLETE atau ARCHIVE


# Phase 4: UX/IA Consolidation & Complex Logic (Draft)

See [implementation_plan_v2_phase4.md](file:///C:/Users/IMBA%20PC/.gemini/antigravity/brain/15982b85-fb73-4132-9eb4-8a3a5ee55ac9/implementation_plan_v2_phase4.md) for full details.

- [ ] Task 4.1: Smart Reopen Semantics
- [ ] Task 4.2: Comprehensive Approval Gates
- [ ] Task 4.3: CreatableSearch Refactor
- [ ] Task 4.4: SSOT & Legacy Cleanup
- [ ] Task 4.5: Terminology Normalization
- [ ] Task 4.6: CDList Assignment Support
