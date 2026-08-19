# Repo Audit

## Status
- Audit owner: Main Lead AI
- Repo: `radsaas-2`
- Date: 2026-04-25
- Progress:
  - Tahap 1: completed
  - Tahap 2: completed
  - Tahap 3: completed

## Audit Method
- Read canonical docs: `MASTER_SSOT.md`, `CHANGELOG.md`, `AGENTS.md`, `src/extensions/schedule/README.md`
- Cross-check schema/runtime: `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/db.ts`
- Read critical services/actions/UI flows for scheduler and library
- Run verification:
  - `npm run lint` -> failed with 17 errors, 180 warnings
  - `npm run build` -> failed during type-check

## Tahap 1 - Arsitektur, SSOT, Runtime Contract

### Summary
Tahap 1 menemukan beberapa release blocker nyata. Repo ini belum aman disebut production-ready karena build production gagal, ada jalur mutasi yang melanggar audit trail, dan beberapa invariant inti SSOT masih bisa ditembus dari action/service.

### Findings

#### 1. Release blocker: production build gagal
- Severity: Critical
- Evidence:
  - `src/extensions/schedule/lib/display-utils.ts:1`
  - `src/extensions/schedule/types.ts:26`
  - `src/lib/validations/schedule-snapshot.ts:39`
- Detail:
  - `display-utils.ts` mengimpor `ScheduleSnapshot` dari `../types`, tetapi file tersebut tidak mengekspor symbol itu.
  - `npm run build` berhenti pada type error ini, artinya state repo saat ini belum deployable.
- Impact:
  - Pipeline production gagal.
  - Audit frontend/backend lain jadi sekunder sampai build gate ini ditutup.

#### 2. Jalur merge vendor melanggar audit integrity dan berpotensi meninggalkan brand snapshot katalog yang stale
- Severity: Critical
- Evidence:
  - `src/extensions/library/actions/library-actions.ts:131`
  - `src/extensions/library/actions/library-actions.ts:148`
  - `src/extensions/library/actions/library-actions.ts:164`
  - `src/extensions/library/services/library-service.ts:540`
- Detail:
  - `mergeVendorsAction` melakukan mutasi langsung ke `productCatalog` dan `vendor` tanpa memanggil `LibraryService.mergeVendors`.
  - Jalur action ini tidak menulis `insertAuditLog`.
  - Jalur action ini juga hanya memindahkan `vendor_id`, tidak menyinkronkan `catalog_brand` ke brand target, padahal service resmi melakukan keduanya.
- SSOT gap:
  - Melanggar `Audit Integrity` di `MASTER_SSOT.md`.
  - Melemahkan prinsip `catalog_brand` sebagai resilience field.
- Impact:
  - Forensic trail bolong.
  - Identitas produk bisa tidak konsisten setelah merge vendor.

#### 3. Approval promotion request berpotensi membuat duplikasi `ProductCatalog`
- Severity: Critical
- Evidence:
  - `src/extensions/library/services/library-service.ts:1035`
  - `src/extensions/library/services/library-service.ts:1078`
  - `src/extensions/library/services/library-service.ts:1105`
- Detail:
  - Saat request promosi disetujui, service langsung `create` `ProductCatalog` baru dari snapshot.
  - Tidak ada deduplication terhadap SKU + brand yang sudah ada.
  - Tidak ada guard jika `schedule_option` sudah punya `product_catalog_id`.
- SSOT gap:
  - Library seharusnya jadi master yang kurated, bukan menumpuk duplikasi dari snapshot proyek.
- Impact:
  - Catalog bisa punya item kembar.
  - Queue approval bisa memperburuk data quality alih-alih memperbaikinya.

#### 4. STAFF masih bisa membuat item library langsung `APPROVED`
- Severity: Critical
- Evidence:
  - `src/extensions/library/components/LibraryFormModal.tsx:138`
  - `src/extensions/library/components/LibraryFormModal.tsx:280`
  - `src/extensions/library/actions/library-actions.ts:224`
  - `src/extensions/library/services/library-service.ts:410`
- Detail:
  - Form product default mengirim `status: "APPROVED"`.
  - `createProductAction` mengizinkan `ADMIN` dan `STAFF`.
  - `LibraryService.createProduct` default ke `APPROVED` bila status tidak diubah.
- SSOT gap:
  - `MASTER_SSOT.md` menyatakan STAFF hanya boleh edit katalog `PENDING`, bukan publish APPROVED langsung.
  - Ini menabrak konsep `Queue`.
- Impact:
  - Approval queue bisa dilewati.
  - Governance kualitas library rusak dari UI resmi, bukan hanya edge case API.

#### 5. Schedule picker/search dapat mengambil item library non-APPROVED
- Severity: High
- Evidence:
  - `src/extensions/library/services/library-service.ts:255`
  - `src/extensions/library/services/library-service.ts:272`
  - `src/extensions/schedule/components/ScheduleSearchBar.tsx:60`
  - `src/extensions/schedule/components/ScheduleProductPickerModal.tsx:120`
  - `src/actions/schedule-actions.ts:139`
- Detail:
  - `getProductsAction` tidak memfilter default ke `APPROVED`.
  - UI scheduler memakai action ini untuk source selection.
  - `addScheduleEntryWithProductAction` juga tidak memverifikasi status item sebelum masuk ke schedule proyek.
- SSOT gap:
  - Library master yang masuk ke proyek seharusnya item yang sudah valid/approved.
- Impact:
  - Item queue atau rejected bisa ikut dipakai di proyek aktif.
  - Snapshot proyek bisa menyalin data yang belum layak pakai.

#### 6. Endpoint swap schedule belum menjaga invariant domain
- Severity: High
- Evidence:
  - `src/actions/schedule-actions.ts:459`
  - `src/actions/schedule-actions.ts:465`
  - `src/lib/services/schedule-service.ts:1135`
- Detail:
  - Service `swapEntries` tidak memverifikasi dua entry benar-benar milik `projectId` yang dikirim.
  - Tidak memverifikasi dua row berada pada category/section yang sama, padahal comment menyatakan “same category”.
  - Tidak ada audit log.
  - Tidak ada normalisasi ulang setelah swap.
- Impact:
  - Bisa memunculkan order lintas kategori yang rusak.
  - Audit trail untuk mutasi scheduler tidak lengkap.

#### 7. SSOT dan schema untuk lokasi sampel fisik sudah drift
- Severity: High
- Evidence:
  - `MASTER_SSOT.md:89`
  - `prisma/schema.prisma:231`
  - `prisma/migrations/check_catalog_inventory.sql:1`
- Detail:
  - SSOT masih menyebut `ProductCatalog` menyimpan `catalog_rak_location` dan `catalog_box_number`.
  - Schema aktif justru memakai model `PhysicalSample` dengan `rack_number` dan `box_number`.
  - Bahkan ada SQL util yang masih men-query kolom lama di table `MaterialCatalog`.
- Impact:
  - SSOT tidak lagi menjadi single source of truth pada area inventory.
  - Query operasional/dokumentasi mudah menyesatkan tim.

#### 8. Ada kode telemetry/debug tak terdokumentasi di UI inventory
- Severity: High
- Evidence:
  - `src/extensions/library/components/PhysicalInventoryTable.tsx:109`
- Detail:
  - Empty state melakukan `fetch` ke `http://127.0.0.1:7243/ingest/...`.
  - Tidak ada guard env, tidak ada feature flag, dan tidak ada dokumen di SSOT/changelog.
- Impact:
  - Side effect tak terduga saat render UI.
  - Risiko privacy, noise, dan kegagalan runtime lokal.

#### 9. State lint/build menunjukkan repo masih jauh dari “100% ready”
- Severity: High
- Evidence:
  - `npm run lint` -> 17 error, 180 warning
  - `npm run build` -> failed
- Detail:
  - Selain blocker type di scheduler, lint error masih ada di library/schedule surface yang aktif, bukan hanya script sampingan.
  - Banyak warning hook dependency dan `any` pada komponen inti.
- Impact:
  - Risiko regressions tinggi.
  - Sulit percaya pada stabilitas perubahan berikutnya sebelum baseline dibersihkan.

### Tahap 1 Recommendation Gate
- Block release sampai:
  - build production hijau
  - jalur merge vendor memakai service resmi + audit lengkap
  - workflow create/update library diselaraskan dengan queue/RBAC SSOT
  - scheduler hanya boleh mengonsumsi item library `APPROVED`
  - drift SSOT/schema inventory diselesaikan

## Tahap 2 - Backend Workflow & Integritas Bisnis
### Summary
Tahap 2 menemukan beberapa cacat logika backend yang tidak otomatis terlihat dari lint/build. Yang paling berat: ada action yang bisa memutasi request lintas project tanpa ownership check, audit delete project pada praktiknya hilang total, dan contract naming project belum dijaga konsisten dari service sampai UI.

### Findings

#### 10. `updateProductRequestStatusAction` tidak punya authorization/ownership gate
- Severity: Critical
- Evidence:
  - `src/extensions/library/actions/library-actions.ts:326`
  - `src/extensions/library/actions/library-actions.ts:330`
  - `src/extensions/library/services/library-service.ts:870`
- Detail:
  - Action menerima `id` request lalu langsung mengubah status.
  - Tidak ada `assertAdmin`, `assertAdminOrStaff`, `RBAC.assert`, atau `getProjectMembershipOrThrow`.
  - Service juga tidak memverifikasi bahwa actor punya akses ke project/request terkait.
- Impact:
  - User login mana pun berpotensi mengubah status request proyek lain jika mengetahui ID.
  - Ini cacat keamanan bisnis, bukan sekadar UI gating.

#### 11. Audit log penghapusan project praktis hilang seluruhnya
- Severity: Critical
- Evidence:
  - `src/lib/services/project-service.ts:400`
  - `src/lib/services/project-service.ts:403`
  - `src/lib/services/project-service.ts:405`
  - `prisma/schema.prisma:101`
- Detail:
  - Service menghapus semua `auditLog` dengan `project_id`.
  - Setelah itu service menulis audit `DELETE_PROJECT`.
  - Lalu `project` dihapus, sementara relasi `AuditLog.project` memakai `onDelete: Cascade`, jadi log delete yang baru dibuat ikut terhapus.
- Impact:
  - Setelah project dihapus, jejak audit project itu nol.
  - Bertentangan dengan tujuan forensic trail dan governance Main Lead.

#### 12. Naming protocol project masih race-prone dan tidak konsisten di seluruh stack
- Severity: High
- Evidence:
  - `src/lib/services/project-service.ts:48`
  - `src/lib/services/project-service.ts:52`
  - `src/lib/services/project-service.ts:53`
  - `src/components/create-project-dialog.tsx:51`
  - `src/components/create-project-dialog.tsx:82`
  - `src/components/create-project-dialog.tsx:131`
- Detail:
  - Auto naming memakai `count()` per tahun lalu `+1`; dua request paralel bisa menghasilkan nomor urut sama.
  - Service backend memakai format benar SSOT: `[YYYY]-[NNN] [Name]`.
  - UI create project masih memakai dan mengedukasi format lama `[YYYY]-[NNN]-[Name]`.
- Impact:
  - Risiko duplikasi atau lompat nomor pada create paralel.
  - User diarahkan ke format yang salah oleh UI resmi.

#### 13. Rename project oleh admin tidak lagi menegakkan canonical naming format
- Severity: High
- Evidence:
  - `src/lib/services/project-service.ts:193`
  - `src/lib/services/project-service.ts:220`
  - `src/lib/validations/index.ts:24`
- Detail:
  - Saat update metadata, jika `userRole === "ADMIN"` dan `name` diisi, backend hanya trim lalu simpan.
  - Tidak ada validasi format `[YYYY]-[NNN] [Name]` maupun proteksi prefix generated.
  - Schema validasi juga hanya `min/max`, tidak enforce naming contract.
- Impact:
  - Project yang sudah canonical bisa diubah ke format liar.
  - SSOT naming hanya kuat saat create, lemah saat update.

#### 14. Submit ke client review bisa lolos walau masih ada open task
- Severity: High
- Evidence:
  - `src/lib/services/phase-service.ts:177`
  - `src/lib/services/phase-service.ts:190`
  - `src/lib/services/phase-service.ts:513`
  - `src/lib/services/phase-service.ts:525`
- Detail:
  - Submit internal review sudah memblokir jika ada open TODO di active revision atau task project-level yang ditag ke phase.
  - Submit client review tidak melakukan blocker setara; hanya cek state phase.
- SSOT gap:
  - SSOT 4.2 menyatakan phase submission for review diblokir oleh open tasks tagged ke phase/revision.
- Impact:
  - Phase bisa dikirim ke client padahal pekerjaan internal belum selesai.

#### 15. Approval phase tidak menghitung semua open task kontekstual
- Severity: High
- Evidence:
  - `src/lib/services/phase-service.ts:488`
  - `src/lib/services/phase-service.ts:549`
  - `src/lib/services/phase-service.ts:997`
- Detail:
  - `executeApproveInternal` dan `executeApproveClientPhase` hanya memeriksa `activeRevision.activities`.
  - Mereka tidak mengecek task project-level / deferred task yang sekarang `revision_id: null` namun masih terikat `phase_id`.
  - `executeDeferActivity` justru membuat task seperti itu.
- Impact:
  - Phase bisa lolos approved walau masih ada task deferred/open pada phase yang sama.
  - Ini lubang logika nyata setelah fitur defer dipakai.

#### 16. Reopen phase selalu membuat major revision baru, merusak semantik versioning
- Severity: Medium
- Evidence:
  - `src/lib/services/phase-service.ts:625`
  - `src/lib/services/phase-service.ts:642`
- Detail:
  - Reopen selalu membuat `major + 1, minor 0`.
  - Tidak dibedakan apakah reopen karena internal revisit atau client revision.
- Impact:
  - Nomor revisi bisa membengkak dan kehilangan makna bisnis.
  - Sulit membedakan reopen administratif dari revisi mayor sesungguhnya.

### Tahap 2 Recommendation Gate
- Block operational readiness sampai:
  - `updateProductRequestStatusAction` diberi role + ownership enforcement
  - delete project mempertahankan forensic trail yang tidak ikut terhapus cascade
  - naming protocol disatukan backend/UI dan dibuat concurrency-safe
  - submit/approve phase memakai blocker yang konsisten untuk seluruh open task kontekstual
  - semantik reopen revision diputuskan eksplisit lalu di-hardcode sesuai aturan bisnis

### Tahap 2 Focus Covered
- service/action path per domain
- ownership validation
- project naming enforcement
- audit log coverage per mutation
- promotion/request lifecycle
- phase/activity state transitions

## Tahap 3 - Frontend Workflow & UX Operasional
### Summary
Tahap 3 mengonfirmasi bahwa banyak friction UI yang Anda rasakan memang punya akar arsitektural. Masalah utamanya bukan sekadar styling, tetapi `ui_engine` tidak menjadi SSOT visual yang sungguhan, terminologi domain masih drift, dan beberapa modal/page shell menumpuk terlalu banyak hierarchy sekaligus sehingga workflow terasa berat untuk operasi harian.

### Findings

#### 17. Terminologi UI masih drift dari SSOT dan membuat mental model user pecah
- Severity: High
- Evidence:
  - `src/app/(dashboard)/extensions/library/page.tsx:136`
  - `src/extensions/schedule/components/ProjectScheduleMain.tsx:473`
  - `src/extensions/schedule/components/ProjectScheduleMain.tsx:482`
  - `src/extensions/library/components/LibraryFormModal.tsx:430`
  - `src/extensions/library/components/LibraryFormModal.tsx:436`
  - `src/components/studio-settings-panel.tsx:242`
  - `src/components/studio-settings-panel.tsx:246`
- Detail:
  - Halaman library masih memakai judul `Material Library`, padahal deskripsinya sendiri sudah bicara `products`.
  - Scheduler dan library form masih memakai pasangan istilah `Architectural` dan `FF&E`.
  - Settings dan create-project dialog masih mengajarkan format lama `[YYYY]-[NNN]-[Name]`.
- SSOT gap:
  - SSOT sudah mengunci penyederhanaan canonical ke product/material/fixture dan naming project `[YYYY]-[NNN] [Name]`.
- Impact:
  - User menerima kosakata berbeda untuk objek yang sama.
  - Training cost naik, placeholder terasa “halusinasi”, dan salah input jadi lebih mungkin.

#### 18. `ui_engine` belum benar-benar menjadi design authority; implementasi masih dominan hardcoded
- Severity: High
- Evidence:
  - `AGENTS.md:30`
  - `src/components/studio-settings-panel.tsx:142`
  - `src/components/studio-settings-panel.tsx:146`
  - `src/components/studio-settings-panel.tsx:159`
  - `src/components/studio-settings-panel.tsx:205`
  - `src/components/studio-settings-panel.tsx:296`
  - `src/components/ui/creatable-search.tsx:147`
  - `src/components/ui/creatable-search.tsx:195`
  - `src/extensions/library/components/LibraryTabs.tsx:170`
  - `src/extensions/schedule/components/ScheduleSpecEditorModal.tsx:245`
- Detail:
  - Banyak surface inti masih memakai `rounded-3xl`, `rounded-xl`, `shadow-xl`, `shadow-lg`, padding dan border raw Tailwind.
  - Token design system hanya dipakai parsial di beberapa radius helper, tetapi spacing, elevation, density, input shell, dan dropdown shell tetap liar.
- Impact:
  - Konsistensi visual tidak bisa dijaga secara sistemik.
  - Perubahan design system dari settings hampir tidak akan memberi hasil yang merata.

#### 19. Design system admin panel lemah secara produk: mengubah CSS vars, tetapi tidak mengendalikan UI nyata
- Severity: High
- Evidence:
  - `src/components/studio-settings-panel.tsx:104`
  - `src/components/studio-settings-panel.tsx:108`
  - `src/components/studio-settings-panel.tsx:124`
  - `src/components/studio-settings-panel.tsx:277`
  - `src/components/studio-settings-panel.tsx:290`
  - `src/components/studio-settings-panel.tsx:363`
  - `src/components/studio-settings-panel.tsx:405`
- Detail:
  - Panel `Design System` memberi ilusi central control, tetapi mayoritas komponen penting tidak membaca token yang diubah.
  - Ia juga mencampur brand, density, layout width, dan modal behavior dalam satu form datar tanpa preview per domain.
  - Nilai seperti `containerMaxWidth` disimpan sebagai utility class (`max-w-7xl`), bukan semantic token.
- Impact:
  - Menu settings admin terasa “useless” karena perubahan tidak deterministik.
  - Admin bisa mengubah konfigurasi yang secara praktik tidak menjadi kontrak UI yang andal.

#### 20. Source token CSS sendiri masih drift dari SSOT estetika minimalis
- Severity: Medium
- Evidence:
  - `src/styles/designTokens.css:1`
  - `src/styles/designTokens.css:8`
  - `src/styles/designTokens.css:14`
  - `src/styles/designTokens.css:18`
- Detail:
  - File token global masih membawa framing `Premium UI Overhaul`, aksen teal, dan glassmorphism tokens.
  - Ini bertentangan dengan SSOT yang menekankan slate-neutral, border halus, dan color yang sangat hemat.
- Impact:
  - Bahkan bila implementasi nanti dibersihkan, fondasi token masih mendorong arah visual yang berbeda.
  - Tim tidak punya sumber visual tunggal yang benar-benar kredibel.

#### 21. Modal view-first sudah ada, tetapi UX operasionalnya masih berat dan redundant
- Severity: High
- Evidence:
  - `MASTER_SSOT.md:18`
  - `src/extensions/schedule/components/ScheduleSpecEditorModal.tsx:236`
  - `src/extensions/schedule/components/ScheduleSpecEditorModal.tsx:242`
  - `src/extensions/schedule/components/ScheduleSpecEditorModal.tsx:323`
  - `src/extensions/schedule/components/ScheduleSpecEditorModal.tsx:357`
  - `src/extensions/library/components/LibraryFormModal.tsx:360`
  - `src/extensions/library/components/LibraryFormModal.tsx:393`
  - `src/extensions/library/components/LibraryFormModal.tsx:493`
- Detail:
  - Protocol view-first sudah diikuti, tetapi modal schedule dan library sama-sama menumpuk banyak header, badge, section numbering, checklist, image block, dan CTA besar dalam satu frame.
  - Pada schedule editor, readiness sidebar, title block, numbered sections, dan footer action saling berebut perhatian.
  - Pada library form, hierarchy visual juga terlalu kaya untuk task operasional yang mestinya cepat.
- Impact:
  - Modal terasa “berat” untuk baca dan edit cepat.
  - User lebih mudah lelah, bingung fokus, dan kehilangan konteks field yang benar-benar wajib.

#### 22. `CreatableSearch` punya interaction model ambigu dan mudah memicu aksi tak disengaja
- Severity: High
- Evidence:
  - `src/components/ui/creatable-search.tsx:69`
  - `src/components/ui/creatable-search.tsx:75`
  - `src/components/ui/creatable-search.tsx:96`
  - `src/components/ui/creatable-search.tsx:107`
  - `src/components/ui/creatable-search.tsx:116`
  - `src/components/ui/creatable-search.tsx:131`
  - `src/components/ui/creatable-search.tsx:244`
- Detail:
  - Component menggabungkan search, select, create, dan free-text commit dalam satu kontrol.
  - Pada `allowFreeText`, klik di luar komponen langsung memanggil `onCreate(search.trim())`.
  - Sinkronisasi antara `value` dan `search` sengaja membiarkan teks lama tetap hidup, sehingga state visual bisa tidak sama dengan state selection.
  - CTA `Use/Add new` muncul selama tidak ada exact match, walau masih ada hasil dekat yang valid.
- Impact:
  - Search terasa tidak enak dipakai karena hasil, draft text, dan create intent bercampur.
  - Risiko accidental create / accidental overwrite tinggi, terutama untuk brand, kategori, dan finishing.

#### 23. Information architecture library terlalu padat untuk satu layar
- Severity: Medium
- Evidence:
  - `src/app/(dashboard)/extensions/library/page.tsx:136`
  - `src/extensions/library/components/LibraryTabs.tsx:121`
  - `src/extensions/library/components/LibraryTabs.tsx:124`
  - `src/extensions/library/components/LibraryTabs.tsx:176`
  - `src/extensions/library/components/LibraryTabs.tsx:194`
  - `src/extensions/library/components/LibraryTabs.tsx:214`
  - `src/extensions/library/components/LibraryTabs.tsx:222`
- Detail:
  - Satu screen library memadukan page header, left filter sidebar, primary tab strip, item count meta, grid/table content, dan modal launcher.
  - Tab `Catalog`, `Samples`, `Vendors`, `Requests`, `Queue` cukup banyak untuk level yang sama, sementara filter sidebar tetap persist meski konteks tab berubah.
- Impact:
  - Halaman terasa penuh bahkan saat data kosong.
  - ProductCatalog kehilangan fokus sebagai storefront utama karena bercampur dengan area operasional lain.

#### 24. Grid dan shell settings tidak scalable saat konten bertambah
- Severity: Medium
- Evidence:
  - `src/components/studio-settings-panel.tsx:141`
  - `src/components/studio-settings-panel.tsx:143`
  - `src/components/studio-settings-panel.tsx:146`
  - `src/components/studio-settings-panel.tsx:183`
  - `src/components/studio-settings-panel.tsx:290`
- Detail:
  - Layout settings dikunci ke grid `256px + 1fr`, lalu panel tertentu memaksa `px-10` dan `max-w-none`.
  - Isi `Design System` memakai grid dua kolom datar untuk banyak control yang heterogen.
  - Ini tidak skalabel bila setting bertambah, terutama pada desktop sempit atau saat konten admin makin panjang.
- Impact:
  - Pengaturan terlihat “kurang oke” saat field banyak.
  - Hirarki antar panel dan isi panel tidak konsisten.

#### 25. Header hierarchy antar page dan modal berulang dan mempertebal rasa redundant
- Severity: Medium
- Evidence:
  - `src/ui_engine/layout/page-header.tsx:27`
  - `src/app/(dashboard)/extensions/library/page.tsx:135`
  - `src/extensions/schedule/components/ProjectScheduleMain.tsx:385`
  - `src/extensions/schedule/components/ScheduleSpecEditorModal.tsx:311`
  - `src/extensions/library/components/LibraryFormModal.tsx:360`
- Detail:
  - `PageHeader` sendiri cukup bersih, tetapi banyak screen menambahkan lagi eyebrow, title, badge, sub-description, section divider, dan tab strip yang bekerja seperti header kedua.
  - Pada modal, struktur title + badge + section headings + checklist membuat hierarchy berlapis-lapis.
- Impact:
  - Keluhan “redundansi header” valid.
  - Informasi penting tenggelam oleh meta-information yang sebenarnya bisa diringkas.

### Tahap 3 Recommendation Gate
- Block UX sign-off sampai:
  - terminology matrix diterapkan konsisten di page title, tabs, placeholder, dan settings copy
  - `ui_engine` diubah dari helper parsial menjadi satu-satunya authority untuk radius, spacing, density, and surface
  - admin `Design System` direduksi ke token yang benar-benar dipakai, atau sementara dimatikan
  - `CreatableSearch` dipecah ulang: search/select vs create harus jadi intent yang eksplisit
  - modal schedule/library dipangkas agar fokus ke inspeksi lalu edit, bukan ke dekorasi dan panel berlapis
  - IA library dipisah lebih tegas antara catalog storefront, samples, vendors, dan queue
  - settings shell dibuat responsif terhadap pertumbuhan panel, bukan fixed two-column control dump

### Tahap 3 Focus Covered
- terminology consistency vs SSOT
- page header and modal hierarchy
- `ui_engine` adoption realism
- settings/admin UX integrity
- search control ergonomics
- information architecture density
- modal friendliness and workflow fit
