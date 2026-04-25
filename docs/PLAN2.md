# Rencana Hardening Core, Modularisasi, dan Sinkronisasi SSOT

## Ringkasan
Target fase ini adalah menjadikan `coreapp` release-ready dan arsitekturnya aman untuk pengembangan lanjutan: bug/logika kritis ditutup, boundary core-vs-extension diperjelas, RBAC dan utilitas umum dipusatkan sebagai modul reusable, serta relasi Schedule-Product Catalog dipaksa lewat internal public API yang stabil.

Default keputusan yang dikunci:
- Modularisasi: `architectural hard split`, tetapi dieksekusi bertahap agar aman.
- Dokumentasi: `MASTER_SSOT.md` wajib diupdate untuk semua perubahan semantik; `CHANGELOG.md` wajib diupdate untuk semua pekerjaan selesai yang material.
- Quality bar: `strict release gate` untuk coreapp.
- Boundary Schedule-Catalog: Schedule hanya boleh mengonsumsi public API/facade Catalog, bukan import internal sembarang.

## Perubahan Inti
### 1. Governance dan aturan dokumentasi
- Tambahkan rule baru di `AGENTS.md`:
  - setiap request yang selesai dikerjakan oleh agent mana pun, di repo mana pun, wajib menilai apakah ada perubahan semantik;
  - jika ada perubahan semantik, `MASTER_SSOT.md` wajib diupdate;
  - perubahan besar, keputusan, bug fix, atau hardening wajib dicatat di `CHANGELOG.md`;
  - bila ditemukan gap antara codebase dan SSOT yang bisa jadi akibat approval user yang belum terdokumentasi, agent wajib konfirmasi dulu sebelum menyebutnya sebagai deviasi.
- Tambahkan bab baru di `MASTER_SSOT.md` untuk:
  - aturan sinkronisasi dokumentasi;
  - boundary core module vs extension module;
  - prinsip “public internal API only” untuk dependency antarmodul;
  - definisi shared utility/domain module yang boleh dipakai lintas extension.

### 2. Quality gate coreapp menjadi release baseline
- Tetapkan gate wajib:
  - `npm run build` hijau;
  - `npm run lint` hijau;
  - typecheck hijau;
  - flow kritis core lolos tanpa error runtime.
- Tutup semua blocker audit tahap 1-3 yang menyentuh core correctness:
  - RBAC hole, ownership hole, audit log hole, naming drift, schedule/library approval leak, modal/workflow breakage yang menyesatkan user.
- Pisahkan antara:
  - `release blockers` yang harus nol sebelum merge;
  - `refactor debt` yang boleh bertahap setelah baseline stabil.

### 3. Modularisasi core menjadi boundary yang eksplisit
- Bentuk ulang arsitektur menjadi empat lapisan:
  - `core/platform`: auth, db, audit, config, error, transaction, session.
  - `core/rbac`: role matrix, permission map, access evaluator, project membership policy, reusable access guards.
  - `core/domain-shared`: timeline, phase helpers, naming, code normalization, snapshot helpers, common validation, shared upload/file contracts bila benar-benar lintas domain.
  - `extensions/*`: schedule, library/product-catalog, live-collaboration, dan extension lain.
- Semua extension dilarang saling bergantung ke helper internal extension lain secara langsung.
- Jika butuh lintas domain, buat `facade`/`application service` di boundary yang jelas, bukan import file internal.
- `src/lib/permissions.ts` dipecah:
  - engine dan permission contract tetap di modul RBAC;
  - helper data-backed access dipindah ke modul access service/policy yang tidak bercampur dengan constant umum.
- Utility yang sering dipakai dipusatkan dan dinamespac e:
  - project naming;
  - phase lifecycle guards;
  - schedule code normalization;
  - snapshot contract/schema;
  - catalog identity formatter;
  - shared date/time utilities;
  - file upload contract bila dipakai lebih dari satu domain.

### 4. Isolasi extension dari coreapp dan antar-extension
- Product Catalog dan Schedule dipisah dengan kontrak eksplisit:
  - Schedule hanya boleh memanggil facade Catalog untuk search approved items, request sample/product, submit promotion, dan resolve catalog identity.
  - Schedule tidak boleh import `library-actions`, `library/lib/upload-client`, atau types internal Catalog secara liar.
- Buat modul orchestration/facade internal untuk hubungan Schedule-Catalog:
  - search catalog products for schedule;
  - create promotion request from schedule snapshot;
  - create project product request from schedule;
  - resolve approved catalog item into immutable schedule snapshot.
- Audit relasi dua plugin itu dan rapikan ownership:
  - Catalog owns `ProductCatalog`, vendor, request queue, promotion review.
  - Schedule owns `ProjectScheduleEntry`, `ProjectScheduleOption`, snapshot editing, local project drafting.
  - Orchestrator/facade owns cross-domain use cases.
- Extension lain mengikuti pola yang sama: hanya boleh bergantung pada core modules dan public facades.

### 5. Sinkronisasi SSOT dengan codebase yang “lebih benar”
- Saat codebase jelas lebih valid dari SSOT, update SSOT agar mengikuti codebase yang disetujui, bukan memaksa rollback ke dokumen lama.
- Namun untuk area ambigu atau yang tampak seperti approval user yang belum terdokumentasi:
  - berhenti dan konfirmasi dulu;
  - setelah dikonfirmasi, update SSOT sebagai sumber resmi baru.
- Prioritas sinkronisasi awal:
  - project naming;
  - physical sample schema vs SSOT;
  - terminology product/material/fixture;
  - library approval and queue semantics;
  - schedule snapshot and promotion contract;
  - module boundary policy.

## Public API / Interface yang perlu dibakukan
- `core/rbac`:
  - permission constants;
  - role-to-permission matrix;
  - reusable guard functions;
  - membership/access policy contracts.
- `core/domain-shared`:
  - `ProjectNamingPolicy`;
  - `PhaseLifecyclePolicy`;
  - `ScheduleSnapshotContract`;
  - `CatalogIdentityFormatter`;
  - `ScheduleCodeNormalizer`.
- `extensions/catalog` public facade:
  - search approved catalog items;
  - submit promotion request;
  - submit product/sample request;
  - fetch catalog metadata needed by schedule.
- `extensions/schedule` public facade:
  - create local snapshot draft;
  - attach approved catalog item to schedule;
  - expose snapshot payload contract for promotion/request flows.
- `AGENTS.md` / `MASTER_SSOT.md`:
  - tambah aturan “confirm-first on undocumented approved drift”.

## Urutan Implementasi
### Batch 1: Stabilitas dan aturan
- Tambah aturan baru di `AGENTS.md`.
- Tambah bab governance dan module boundary di `MASTER_SSOT.md`.
- Rapikan changelog policy di SSOT.
- Definisikan release gate dan checklist audit closure.

### Batch 2: Core hardening
- Bereskan build/lint/typecheck blockers.
- Tutup RBAC, ownership, dan audit log gaps dari audit tahap 1-2.
- Satukan naming policy dan enforce di create/update paths.
- Selaraskan terminology dan workflow labels yang menyesatkan.

### Batch 3: Boundary refactor
- Ekstrak RBAC ke modul reusable yang bersih.
- Ekstrak shared domain utilities/policies.
- Buat Catalog facade dan pindahkan seluruh konsumsi Schedule ke facade itu.
- Hapus import langsung Schedule ke helper internal Catalog yang tidak public.

### Batch 4: UX safety pass
- Sederhanakan modal hierarchy.
- Refactor `CreatableSearch` agar search/select/create jadi intent eksplisit.
- Rapikan library IA dan settings shell agar mengikuti module boundary dan design tokens.
- Pastikan perubahan UX tetap mengikuti view-first dan tidak mengubah layout besar tanpa kebutuhan eksplisit.

## Test Plan
- Build/lint/typecheck:
  - `npm run build` sukses.
  - `npm run lint` sukses tanpa error.
- RBAC:
  - STAFF tidak bisa publish approved catalog item langsung.
  - request status tidak bisa diubah user tanpa hak/ownership.
  - schedule tidak bisa mengonsumsi item non-approved.
- Audit integrity:
  - create/update/delete/approve pada library dan scheduler selalu menulis audit log.
  - delete project masih menyisakan forensic trail yang benar sesuai desain final.
- Module boundary:
  - tidak ada import ilegal antar-extension selain melalui facade/public contract.
  - RBAC dapat diubah di modul sendiri tanpa memaksa edit extension.
- Schedule-Catalog integration:
  - search catalog dari schedule lewat facade dan hanya menampilkan item yang valid.
  - promotion request dari snapshot tetap jalan tanpa coupling internal.
  - sample/product request dari schedule tetap jalan lewat contract resmi.
- UX core flows:
  - project creation/edit naming konsisten.
  - detail modal existing data default read-only.
  - search control tidak auto-create pada blur.
  - library page dan schedule page tetap usable setelah boundary refactor.

## Asumsi dan default
- “100% fungsional” untuk fase ini berarti release-ready pada coreapp, bukan janji zero future defect.
- `MASTER_SSOT.md` diupdate hanya saat ada perubahan semantik, arsitektur, kontrak, workflow, atau canonical rule.
- `CHANGELOG.md` diupdate untuk semua pekerjaan selesai yang material.
- Jika codebase tampak lebih benar daripada SSOT, SSOT akan mengikuti codebase setelah diverifikasi; bila ada indikasi itu hasil approval user yang belum terdokumentasi, wajib konfirmasi dulu.
- Refactor dilakukan bertahap dengan menjaga perilaku user-facing tetap stabil, kecuali perubahan diperlukan untuk menutup bug/logika atau drift SSOT yang sudah diputuskan.
