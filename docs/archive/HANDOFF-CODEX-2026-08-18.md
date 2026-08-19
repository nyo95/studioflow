# Handoff ke Codex — StudioFlow

**Ditulis 2026-08-18.** Baca berkas ini lebih dulu, sebelum `roadmap.md`.

Urutan dokumen yang mengikat: `prisma/schema.prisma` → `AGENTS.md` →
`changelog.md` → `roadmap.md` → sisanya. Kalau dua dokumen bertentangan,
**kode yang berjalan menang** — perbaiki dokumennya, jangan diam-diam ubah
kodenya supaya cocok.

---

## 1. Keadaan repo — baca sebelum menyentuh git

Sampai 2026-08-18 repo ini punya **475 berkas yang tidak pernah masuk git**:
seluruh `prisma/migrations/` (28 folder, termasuk rebaseline v2
`20260810180000`), seluruh `src/subapps/master-data/{hooks,config,components/shared}`,
`src/app/api/masterdata/`, `src/extensions/library/contracts/`, dan
`docs/archive/`. Commit-commit sebelumnya hanya menyentuh berkas yang disebut
per task, sehingga sisanya menumpuk tak tercatat.

Sudah dibereskan pada commit `5d87662` — **nol baris kode berubah**, murni
merekam isi disk apa adanya. Sekarang `git status` bersih kecuali tiga scratch
di `tmp/`.

- Tree sudah aman. `git stash` / `checkout` / `reset` tidak lagi berisiko
  menghapus pekerjaan berbulan-bulan — sebelum `5d87662`, ketiganya berisiko.
- **Ada commit yang belum di-push** ke `origin/main`. Owner yang push.
- Sengaja di luar git: `studioflow.rar` (352 MB), dua `.zip` snapshot, `tmp/`,
  `_to_delete/`, berkas `.~lock` LibreOffice. Sudah masuk `.gitignore`.
- Commit dengan berkas yang Anda sentuh saja — tapi **jangan biarkan berkas baru
  menumpuk untracked.** Itu penyebab masalah di atas.

---

## 2. Keputusan owner 2026-08-18 — sudah final, tinggal dikerjakan

Enam item yang sebelumnya bertanda ⏳ (menunggu keputusan) sudah dijawab owner.
Ini **spesifikasi**, bukan usulan.

### 2.1 · H5 — izin harga TIDAK dipisah — SELESAI #39

Siapa yang boleh mengelola supplier juga boleh mengubah harga. Keadaan sekarang
sudah benar; yang salah hanya enum yang menganggur.

`MASTERDATA_PRICE_MANAGE` dan `MASTERDATA_OFFERING_MANAGE` sudah dihapus dari
`core/rbac/constants.ts` dan `core/rbac/matrix.ts`. Sudah diverifikasi
2026-08-18: keduanya **tidak dipakai di satu tempat pun** selain dua berkas itu,
jadi penghapusannya tidak mengubah perilaku. Mutasi harga tetap memakai
`MASTERDATA_VENDOR_MANAGE`.

*Kenapa dihapus, bukan dibiarkan:* izin yang ada di enum tapi nol penegakan
membuat agent berikutnya mengira ada pembatas yang sebenarnya tidak ada.

### 2.2 · §10 — edit TIDAK lagi menurunkan status ke Pending — SELESAI #39

**Keputusan owner:** *"staf, admin dan developer semua bisa edit — untuk master
data"*, dan edit **tidak** menurunkan status.

Keadaan sebelum #39: `catalog_status` dipaksa jadi `PENDING` di **dua** tempat
saat yang mengedit bukan approver —

- klien: `MasterDataProductDialog.tsx:477`
  `mode === "CREATE" || !access.canApproveMaterial ? PENDING : form.catalog_status`
- server (penegakan sebenarnya): `library-actions.ts:276` di `updateProductAction`

Karena `canApproveMaterial` = `MASTERDATA_MATERIAL_APPROVE` yang hanya dimiliki
ADMIN dan DEVELOPER, **setiap** edit oleh STAFF diam-diam menurunkan status.

**Sudah dikerjakan:**

1. Pada **EDIT**, status tidak lagi disentuh oleh pengecekan approver. Ekspresi
   di klien menjadi `mode === "CREATE" ? PENDING : form.catalog_status`.
2. Server: `statusToApply` pada `updateProductAction` berhenti memaksa `PENDING`
   untuk non-approver. Field status dari request non-approver dibuang, bukan
   dipercaya, sehingga approval eksplisit tetap milik approver.
3. **CREATE tetap masuk `PENDING`** — itu tidak berubah dan bukan bagian dari
   keputusan ini.
4. Dropdown ubah-status (`MasterDataProductDialog.tsx:795`) **tetap** hanya untuk
   `access.canApproveMaterial`. Yang dicabut adalah penurunan otomatis, bukan
   wewenang menyetujui.

**Konsekuensi yang owner terima sadar:** STAFF bisa mengubah isi material yang
sudah disetujui — termasuk harga dan spesifikasi — tanpa persetujuan ulang.
Peredamnya sudah ada dan **wajib dipastikan tetap jalan**: setiap perubahan
tercatat di `master_data.MasterDataAudit` lewat `recordAudit(tx, …)`. Jangan
lemahkan audit itu dengan alasan apa pun.

### 2.3 · M5 — bahasa antarmuka INGGRIS — SELESAI #41

**Status 2026-08-19:** `mapKnownPrismaError()` sudah diterjemahkan ke pesan
Inggris yang tetap actionable. Teks lama yang tersentuh di layar Brand,
Material, Pricing, dan Supplier juga sudah diselaraskan, termasuk komponen link
Brand dan nama bulan di Pricing. UI-CON-3 ikut selesai: header Pricing yang
hidup seluruhnya Inggris; sumber header campur hanya ada di `SupplierJasaTab`
mati yang dihapus #40.

**Semua teks yang dibaca pengguna di layar ditulis Bahasa Inggris** — tombol,
label, judul kolom, menu, placeholder, tooltip, empty state, **termasuk pesan
error**. Berlaku untuk teks baru maupun teks lama yang kebetulan disentuh.
Aturan lengkapnya di `AGENTS.md` §🗣️ Bahasa Antarmuka.

Yang **tetap Indonesia**: `changelog.md`, `roadmap.md`, `AGENTS.md`, berkas ini,
dan komentar kode. Itu dokumen internal, bukan permukaan produk.

**Kerjakan:** terjemahkan pesan di `mapKnownPrismaError()`
(`action-wrapper.ts`, dibuat #27) ke Inggris. **Pesannya harus tetap bisa
ditindaklanjuti** — *"Name is already used by another supplier"*, bukan kembali
ke pesan Prisma mentah. Mengembalikannya jadi mentah adalah regresi #27.

Ini membuka **UI-CON-3** (header kolom tabel Services yang campur) untuk
dikerjakan.

### 2.4 · BR8 — VIEWER SELESAI #40

**Status 2026-08-19:** kedua viewer sudah berjalan. Baris Material Prices
membuka popup read-only berisi identitas SKU, kategori, spesifikasi, seluruh
harga berlaku lintas supplier, dan seluruh riwayat harga (A7). Halaman baru
`/masterdata/skus` menampilkan SKU lintas-brand dengan pencarian dan filter
brand, kategori, ada/belum harga, serta data lengkap/belum. Tab SKU pada detail
Brand tetap ada. Definisi kelengkapan dikunci di `AGENTS.md` §12.

Premis lama item ini salah: halaman Supplier tidak punya `<Tabs>` sama sekali,
dan `SupplierJasaTab` tidak pernah dirender. Owner mengoreksi maksudnya:

> *"add sku kan harapan saya pakai CreatableSearch dari pricing (material
> pricing) — malah ideal ada viewer yg jelas, bukan masalah create nya"*

**Sisi create sudah selesai sejak #28** — `SkuPicker` meneruskan `onCreate` ke
`CreatableSearch`, jadi SKU baru bisa dibuat langsung dari Add Material Price.
Jangan dikerjakan ulang.

Yang dipesan owner adalah **dua viewer**, keduanya dikerjakan:

**(a) Popup detail SKU dari tabel harga.** Klik baris di tabel Harga Material
(kolomnya sekarang Brand · Supplier · Code · Item · Unit · Harga · Update
terakhir) → popup berisi: kode artikel, brand, kategori, spesifikasi, **semua
supplier yang menjualnya beserta harganya**, dan riwayat harga. Ini menjawab
"barang ini sebenarnya apa, dan berapa harganya di mana".

*Catatan:* bagian riwayat harga di popup ini **adalah** item **A7** — datanya
sudah utuh (`SkuPrice` menyimpan baris `is_current: false`), layarnya yang belum
ada. Kerjakan sekalian; tanpa model baru, tanpa migrasi.

**(b) Halaman daftar SKU lintas-brand (baru).** Semua SKU dari semua brand,
bisa dicari dan difilter (brand, kategori, ada/belum ada harga, data
lengkap/belum). **Tab SKU di detail Brand tetap ada** — dua pintu masuk untuk
dua kebutuhan berbeda. Owner: *"ikut rekomendasi kamu, perbaiki secara uiux agar
rapih. kalau mau buat halaman baru oke jg."*

Setelah keduanya jalan, `SupplierJasaTab` yang mati (±197 baris,
`SupplierClient.tsx`) sudah tidak punya alasan ditahan lagi — dan sudah dihapus
bersama `InlineCompanyCell` serta `toggleSort` pada #40; lihat §19.

### 2.5 · B1 — foldering deliverable DITUNDA, dengan gerbang

Owner: *"biarkan dulu — tapi tulis di roadmap. Nanti setelah master data selesai
dan StudioFlow utama tidak ada regresi dan works well, baru pindah ke sini."*

**Jangan dikerjakan sekarang.** Gerbangnya dua-duanya harus terpenuhi lebih
dulu: (1) Master Data selesai, (2) StudioFlow utama bebas regresi dan berjalan
baik. Pertanyaan aslinya — folder buatan user atau struktur dari sistem — belum
dijawab dan **baru ditanyakan saat gerbangnya terbuka**, karena jawabannya
menentukan perlu migrasi atau tidak.

### 2.6 · Urutan kerja

Owner memilih **bug layar yang mengganggu harian** sebagai yang pertama.

### 2.7 · TV1 — Today's View inline edit — SELESAI #35

**Status 2026-08-18:** sudah diimplementasikan di `today-view.tsx` untuk task
checklist dan activity/FEEDBACK, termasuk pola anti-#28b dan Escape tanpa save.

Owner: *"yang saya cek, ini saat ini, task todolist nya masih ga inline edit
(studioflow)."* Ini laporan bug langsung, di luar Master Data — masuk kategori
ketiga §🧑‍⚖️ Pembagian Peran (permintaan langsung owner), spesifikasinya ditulis
di sini karena scope-nya kecil dan sudah jelas.

**Root cause sebelum #35, diverifikasi terhadap kode:** `today-view.tsx` punya `TaskRow`
sendiri (~baris 147–317), **terpisah** dari `TaskRow` di `task-list.tsx` yang
dapat inline edit di #26. Fitur #26 hanya pernah dipasang di tab Fase dan
overview proyek. Baris 234 di `today-view.tsx` cuma `<span>{task.label}</span>`
statis — tidak ada state, tidak ada apa pun yang bisa diklik.

**Backend sudah siap:**

- `updateTask({ taskId, label })` — sudah diimpor (dipakai `setDue`), tinggal
  dipanggil dengan `label`.
- `updateActivityContent({ activityId, content })` — **belum** diimpor di
  `today-view.tsx`; pola pemakaiannya sudah ada di `ActivityManager.tsx`.
  Server menegakkan izin sendiri lewat `assertPhaseContentMutationAccess` /
  cek keanggotaan proyek — klien tidak perlu menggerbangi apa pun.

**Kerjakan di `TaskRow` (`today-view.tsx`):**

1. Tambah `editingLabel`/`labelDraft` state, pola identik `task-list.tsx`:
   klik `<span>` → `<Input autoFocus>`, Enter/blur commit, Escape batal.
2. **Salin pola anti-#28b apa adanya** — ini yang paling gampang salah:
   `useEffect` sinkronisasi deps **hanya** `[task.label]`, `editingLabel`
   sengaja **tidak** masuk deps; span merender `{labelDraft}`, bukan
   `{task.label}`. Ini persis pola di tabel §4 "gampang dirapikan jadi rusak
   lagi" — kalau ditulis ulang dari nol alih-alih disalin, kemungkinan besar
   bug flash #28b muncul lagi di tempat kedua.
3. Commit bercabang menurut `task.source` (pola yang sudah ada untuk toggle
   & due date di file yang sama):
   - `"checklist"` → `onMutate(() => updateTask({ taskId: task.id, label: trimmed }))`
   - `"activity"` → `onMutate(() => updateActivityContent({ activityId: task.id, content: trimmed }))`
     — import `updateActivityContent` dari `@/actions/phase-actions`.
4. **Tidak ada gating izin baru.** Today's View sekarang tidak menggerbangi
   mutasi apa pun di klien (toggle, due date, priority, assignee) — konsisten
   dengan itu; server tetap menolak yang tidak berhak.

**Verifikasi:** klik judul task checklist di Today's View → inline edit →
Enter → reload → nilai tetap. Ulangi untuk task FEEDBACK/activity (fase
ON_REVIEW). Escape mengembalikan teks asli tanpa memanggil server.

### 2.8 · TV2 — purge otomatis task checklist — SELESAI #35

**Status 2026-08-18:** `scripts/purge-expired-checklist-tasks.mjs` sudah tersedia
dengan dry-run default, `--apply`, guard template, penghapusan leaf lebih dulu,
dan pengecekan child kosong sebelum parent dihapus. Crontab produksi tetap
dipasang owner saat deploy.

Owner: *"todays view dan upcoming tolong dibuat dengan perlakuan yang sama.
default collapse apabila tidak ada task dan completed nya sifatnya temporary
sampai batas waktu tertentu (atau paling lama sampai proyek 'completed') maka
task completed bisa di hapus."*

**Separuh permintaan sudah terpenuhi tanpa kode baru** — verifikasi sebelum
menulis spesifikasi ini:

- *"Default collapse kalau tidak ada task"* — sudah beres di kedua halaman
  lewat mekanisme berbeda tapi setara. Today's View meng-collapse grup proyek
  kosong sejak #29. Upcoming malah tidak pernah merender bucket tanggal kosong
  sama sekali — `bucketTasksByDate()` (`task-feed.ts:282-285`) membuang bucket
  `tasks.length === 0` sebelum sampai ke layar. **Tidak ada yang perlu diubah
  di sini.**
- *"Completed bisa dihapus"* — **sebelum #35 ini belum ada.** #29 hanya
  menyembunyikan task tercentang dari query setelah 7 hari
  (`CHECKLIST_DONE_RETENTION_DAYS`, `task-feed-query.ts:28`). Barisnya tidak
  pernah benar-benar dihapus.

**Tiga keputusan owner, ditanyakan terpisah:**

1. Penghapusan **otomatis lewat batas waktu** — bukan tombol manual, bukan
   dibiarkan seperti sekarang.
2. Proyek **Completed = langsung lewat batas retensi**, berapa pun sisa hari
   yang tersisa dari 7 hari itu.
3. **Upcoming tetap tidak pernah menampilkan completed** — tidak perlu toggle
   "Show completed" seperti Today's View. Nol perubahan UI di kedua halaman;
   ini murni pekerjaan backend.
4. Hosting **self-managed (VPS/Docker)**, bukan Vercel — pemicunya **crontab
   OS**. Repo tidak punya `vercel.json` atau cron apa pun sekarang.

**Dikerjakan di #35:**

1. Script baru `scripts/purge-expired-checklist-tasks.mjs` — pola dry-run
   default + `--apply`, **sama persis** dengan
   `scripts/backfill-duplicate-categories.mjs` yang sudah ada.
2. **Eligible untuk dihapus:** `ProjectChecklist` di mana `is_checked = true`
   **DAN** (`checked_at` > 7 hari **ATAU**
   `project.status_progress === "COMPLETED"`).
3. **Skip baris `template_id !== null`** — menyalin pengaman yang sudah ada di
   `executeDeleteTask` (`checklist-service.ts:235-240`). Purge otomatis jangan
   pernah melewatinya diam-diam.
4. **⚠️ Bahaya cascade-delete, WAJIB ditangani dengan urutan yang benar.**
   `parent_id` (`schema.prisma:988`) memakai `onDelete: Cascade`. Menghapus
   parent mentah-mentah ikut menghapus **semua child-nya**, walau child itu
   sendiri belum eligible. Cascade check saat toggle
   (`executeToggleChecklist`, `phase-service.ts:515-521`) hanya terjadi SAAT
   parent di-toggle — child bisa di-uncheck sendiri sesudahnya, jadi *"parent
   checked ⟹ semua child checked"* **tidak selalu benar**. Urutan aman: hapus
   dulu child yang eligible satu per satu (child tidak punya child sendiri,
   depth dibatasi 1 level), baru hapus parent yang eligible **dan sudah tidak
   punya child tersisa**. Parent yang masih punya child belum eligible:
   **jangan disentuh**, biarkan seluruh subtree menunggu bersama.
5. Cascade lain sudah aman tanpa kerja tambahan — `ChecklistLabelOnItem` dan
   `Comment` memakai `onDelete: Cascade` ke `checklist_id`.
6. **Logging ke console, bukan `AuditLog`** — mengikuti pola skrip maintenance
   lain di `scripts/` (tidak ada aktor manusia di baliknya). Ringkasan: jumlah
   dihapus, jumlah dilewati (template), jumlah subtree ditunda.
7. **Pemicunya crontab**, dituliskan sebagai saran di header komentar skrip.
   Instalasi crontab sebenarnya tetap tugas owner (§6) — tidak bisa disiapkan
   dari sesi agent cloud.

**Sengaja di luar cakupan:** `Activity` (item TODO/FEEDBACK di diskusi fase)
tidak punya kolom setara `checked_at` dan tidak pernah difilter umur di
`task-feed-query.ts`. Tidak disentuh purge ini — kalau nanti diinginkan juga,
itu item terpisah yang butuh migrasi.

**Tidak perlu diubah:** `task-feed-query.ts` tetap seperti sekarang. Proyek
Completed sudah dikecualikan total dari feed lewat
`where: { status_progress: { not: "COMPLETED" } }` di puncak query — yang
belum ada hanyalah penghapusan barisnya dari database, dan itu murni pekerjaan
skrip di atas.

---

## 3. Urutan kerja yang disepakati

| Urutan | Item | Kenapa di sini |
|---|---|---|
| **0 ✅** | **TV1** — judul task di Today's View tidak bisa inline edit | **Selesai #35.** Inline edit berjalan untuk checklist dan activity/FEEDBACK. |
| **0b ✅** | **TV2** — purge otomatis task checklist yang lama selesai | **Selesai #35.** Skrip siap; instalasi crontab produksi tetap tugas owner. |
| **1 ✅** | **BR3** — kategori hilang/reset saat Add Brand berturut-turut | **Selesai #36.** Opsi kategori hasil save kini bertahan di state dialog lintas sesi buka–tutup sambil menunggu refresh server. |
| **2 ✅** | **BR1** — inline edit Category / Hashtag / Brand Name di tabel Brands | **Selesai #37.** Ketiga field dapat diedit langsung; perubahan tertunda dilindungi `useUnsavedChangesGuard`. Audit riwayat membuktikan fitur ini belum pernah ada—`InlineCompanyCell` hanya mengedit Company pada Supplier. |
| **3 ✅** | **BR6** — actions jadi kebab menu (⋯) saat row di-hover | **Selesai #38** pada kedua tabel. Menu juga muncul saat keyboard focus dan tetap terlihat selama terbuka; isi mengikuti permission. |
| **4 ✅** | **§10** + **H5** (§2.1, §2.2) | **Selesai #39.** Edit mempertahankan status; non-approver tetap tak bisa mengubah status. Dua permission harga mati sudah dihapus. |
| **5 ✅** | **BR8 viewer** (§2.4) — popup detail SKU + halaman daftar SKU, sekalian **A7** | **Selesai #40.** Viewer menampilkan semua harga berlaku dan riwayat; direktori lintas-brand tersedia di `/masterdata/skus`. |
| **6 ✅** | **M5** (§2.3) + **UI-CON-3** | **Selesai #41.** Error database tetap actionable dalam Inggris; layar yang tersentuh dan seluruh header Pricing kini konsisten Inggris. |
| **7 ✅** | **D5** sisa, **D2** | **Selesai #42–#43.** Tabel Sample memakai token `minWidth`; seluruh native confirm diganti dialog aplikasi dan reset massal memakai frasa `DELETE ALL`. |

**Sebelum BR1:** cek `changelog.md` dan `git log` dulu. Item #26 mengajarkan
pelajaran mahal — sebuah "regresi" yang dilaporkan owner ternyata **tidak pernah
pernah dibangun**, dan waktunya habis mencari fitur yang tidak ada. Roadmap
menyebut BR1 "kembalikan fitur yang sudah pernah ada"; buktikan dulu premisnya.

**Hasil pemeriksaan BR1 (#37):** premis regresi tidak terbukti. Riwayat hanya
memiliki `InlineCompanyCell` untuk relasi Company pada Supplier; tidak pernah
ada inline editor Brand Name/Category/Hashtag. Fitur yang diminta tetap dibangun
sebagai kemampuan baru dan sudah selesai.

---

## 4. JANGAN dimundurkan — keputusan yang sudah berlaku

Bagian terpenting berkas ini. Setiap baris adalah keadaan kode **sekarang** yang
lebih benar daripada versi sebelumnya. "Memperbaikinya sesuai roadmap" = regresi.

### Sudah selesai, tapi roadmap sempat menulisnya terbuka (#30)

| Item | Keadaan sekarang | Jangan |
|---|---|---|
| **PR1** | `PricingClient.tsx` memakai `CreatableSearch` langsung untuk field Supplier. | Jangan kembalikan `PartyPicker` di sana. |
| **M4** | `getPartyBrandsAction` hanya memuat SKU yang ada di `priceCounts` (`priceSkuIds`). | Jangan kembalikan ke `findMany` semua SKU brand. |
| **M8** | `api/masterdata/excel/import/route.ts` menolak file > 20 MB dengan `413`. Deklarasi `export const config` lama yang diabaikan App Router sudah dihapus #44. | Jangan hapus guard ukuran runtime-nya—itulah pengaman yang benar di App Router. |
| **A4b** | `upsertBrandCategories` menghapus baris `DERIVED_FROM_SKU` yang basi. | **Jangan pernah** ikut menghapus baris `source: SEED` — itu kurasi manusia, dan justru alasan kolom `source` ada. |
| **D3** | Lima handler `activity-manager.tsx` memanggil `toast.error(...)`. | Jangan hapus saat merapikan blok `catch`. |
| **BR8-create** | `SkuPicker` meneruskan `onCreate` → SKU bisa dibuat dari Add Material Price (#28). | Jangan dikerjakan ulang; yang tersisa hanya viewer (§2.4). |

### Pola React yang gampang "dirapikan" jadi rusak lagi (T6, #28, #28b)

Keempatnya bug nyata yang sudah diperbaiki. Semuanya **terlihat seperti kode
kurang rapi** bagi linter maupun agent — dan merapikannya mengembalikan bugnya
persis.

| Berkas | Bentuk yang benar sekarang | Kalau diubah |
|---|---|---|
| `components/task-list.tsx` | `useEffect` deps **hanya** `[task.label]`; `editingLabel` sengaja dihilangkan. Span merender `{labelDraft}`, bukan `{task.label}`. | Menambah `editingLabel` ke deps → label berbalik ke nilai server lama saat save. Merender `{task.label}` → label berkedip. |
| `components/today-inline-add.tsx` | `tagQuery` adalah `useMemo` dari `value`. | Kembali ke `useState`+`useEffect` → `set-state-in-effect`, dropdown berkedip. |
| `components/today-quick-add-modal.tsx` | Smart-tag lewat `applySmartTag` (`useCallback`), dipanggil dari `onChange`. | Memindahkannya balik ke `useEffect` → `setState` sinkron di dalam effect. |
| `ui_engine/components/ProjectLiveProvider.tsx` | `catch (error: unknown)` + `error instanceof Error && error.name === "AbortError"`. | `catch (error: any)` → `no-explicit-any` balik lagi. |
| `extensions/schedule/lib/display-utils.ts` | 4× `unknown`-cast bertipe (`LegacySnap = Record<string, unknown>`). | Kembali ke `as any`. |

### Kontrak domain yang sudah dibayar mahal

| Aturan | Kenapa |
|---|---|
| `Party.name` / `Party.slug` / `Brand.name` / `Brand.slug` **bukan `@unique`** di Prisma. | Keunikannya dijaga index parsial `*_live_uniq` (migrasi `20260818120000`) supaya baris soft-deleted tidak memegang namanya selamanya. **`findUnique({ where: { name } })` tidak sah** — pakai `findFirst` + `mode: "insensitive"` + `deleted_at: null`. |
| `SampleStatus` punya **lima** nilai. | Tiga fungsi pemetaan ke nilai lebih sedikit sudah dibuang. Akibat aslinya: sample HILANG tampil sebagai "Dipinjam". Jangan tulis mapper baru. |
| `WorkPrice` dihapus **soft** (`deleted_at`), bukan `tx.workPrice.delete()`. | H7. Kolomnya sudah ada sejak rebaseline — roadmap yang menandainya "butuh migrasi" sudah usang saat ditulis. |
| `generateWorkPriceCode` memakai `pg_advisory_xact_lock`. | Keputusan owner: advisory lock, bukan sequence — supaya nol migrasi. |
| Tidak ada tombol **"Modify"** sebagai gatekeeper dialog. | Dicabut owner 2026-08-14. Dialog terbuka langsung bisa disunting; pengamannya `useUnsavedChangesGuard` + tutup lewat `guard.closeAfterSave()`. |
| Setiap tulis ke `master_data` lewat `recordAudit(tx, …)`, **tepat satu kali**. | `studioflow.AuditLog` tabel berbeda. Konsolidasi `createSkuCore` membongkar dua tempat yang mencatat dobel. **Makin penting setelah §2.2** — audit adalah satu-satunya peredam yang tersisa. |
| `resolvePrice()` / `checkWorkPrice()` untuk semua jalur tulis harga. | **Dilarang `Number(input.price)` polos dan dilarang `?? 0`** — tarif nol mengalir ke dokumen komersial lewat `v_bq_*`. |
| Setiap lookup `Category` **wajib** memfilter `kind`. | "Finishing" ada dua kali: `PRODUCT` dan `WORK`. |
| Kolom `qty` pada `SkuPrice`/`WorkPrice` **tidak dipakai**. | Keputusan owner Q12/X12. Jangan masukkan ke perhitungan apa pun, jangan ekspos ke view BQ. |

---

## 5. Sisa pekerjaan terbuka

Sudah diverifikasi terhadap kode 2026-08-18 — bukan salinan roadmap lama.

| Item | Berkas | Isi |
|---|---|---|
| **M3 / §8** | `getMaterialPricesAction` | Menarik seluruh `SkuPrice` ber-`is_current: true` ke memori tanpa `take`. Butuh paginasi + pencarian server-side. |
| **§20** | `SupplierDetailClient.tsx:228` | `PricesTab` masih stub — satu kalimat + tautan ke `/masterdata/prices`. Ini **fitur belum dibangun**, bukan cacat. Kebutuhan melihat SKU/harga lintas supplier sudah dijawab viewer #40, tetapi tab supplier-specific ini tetap belum dibangun. |
| **BR2** | `MasterDataMaterialsClient.tsx` | Search Brands hanya mencari nama. Perluas ke kategori, hashtag, nama supplier terkait, SKU code. |
| **BR4 / BR7** | `BrandDetailClient.tsx`, `SupplierDetailClient.tsx` | Detail jadi modal; kolom "Lengkap" diganti pewarnaan baris. Beririsan dengan §2.4 — kerjakan sesudahnya. |
| **BR5** | `MasterDataMaterialsClient.tsx` | Kolom Katalog & Links (`BrandLink[]`), klik → modal edit links. |
| **§19** | `MasterDataNav.tsx` (sudah di `_to_delete/`) | Tiga blok mati di `SupplierClient.tsx` (`SupplierJasaTab`, `InlineCompanyCell`, `toggleSort`) sudah dihapus #40 setelah BR1/BR8 selesai. Hanya penghapusan folder `_to_delete/` oleh owner yang tersisa. |
| **C-SISA-3** | task list | Drag-and-drop pengurutan. `@dnd-kit` sudah ada dan dipakai di `CatalogCodeManager.tsx`; `reorderTasks` sudah jalan; `sort_order` sudah dihormati semua pembaca. Yang belum ada hanya cara menyeretnya. |
| **T3** | — | Verifikasi ulang warisan `PLAN-AUDIT-ROADMAP-2026Q3.md`. Dokumen itu pernah menandai perbaikan "selesai" padahal belum — periksa yang lain dengan kecurigaan yang sama. |

### Masih terkunci

🔒 butuh migrasi · ⏳ menunggu gerbang. **Aturan owner: jangan mengubah skema
Master Data; kalau memang perlu, tanya dulu.**

**B1** (ditunda, §2.5) · **A6** (`ScheduleBundle` belum ada) ·
**R-SCHED-TPL-2e** (plugin SketchUp, out of scope sampai plugin di-update) ·
**C-SISA-5** (filter tersimpan — wajib `query_json` terstruktur, **bukan** DSL
teks) · **C-SISA-6** (recurring) · **C-SISA-7** (notifikasi assignee —
StudioFlow belum punya mekanisme notifikasi sama sekali).

---

## 6. Yang perlu dikerjakan owner

Ini tindakan produksi, destruktif, atau pengelolaan git yang sengaja tidak
dijalankan sebagai bagian implementasi handoff.

1. **`npx prisma migrate deploy`** — `20260818120000_add_checked_at_to_checklist`
   (#29) mungkin belum diterapkan ke DB. ⚠️ **Dua migrasi memakai prefix
   timestamp yang sama** `20260818120000`. Prisma mengurutkan leksikografis jadi
   urutannya deterministik — tapi jangan tambah yang ketiga dengan prefix itu.
2. **Hapus `_to_delete/MasterDataNav.tsx`** — sisa §19; agent tidak menghapusnya
   karena folder itu ditetapkan sebagai tindakan owner.
3. **Pasang crontab produksi** untuk `scripts/purge-expired-checklist-tasks.mjs`
   sesuai contoh di header skrip.
4. **Push commit** yang menumpuk ke `origin/main`.
5. **Uji manual destruktif/berbasis data** — `roadmap.md` §Uji manual task (9
   langkah) dan §Uji manual
   Master Data v2 (19 langkah, butuh mesin dengan database). Langkah 3, 10, 14,
   dan 16 yang paling mudah dilewati, dan keempatnya persis cacat yang baru
   diperbaiki.

`npm run build` tidak lagi menjadi tugas owner: verifikasi produksi lulus pada
2026-08-19 (#44), termasuk Prisma Client generation dan seluruh route Next.js.

---

## 7. Aturan kerja yang mengikat

Selengkapnya di `AGENTS.md`. Yang paling sering dilanggar:

- **Baca `changelog.md` entri terbaru sebelum bekerja**, dan tambahkan entri baru
  di task yang sama setelah mengubah kode/schema/migrasi/konfigurasi/UI/data/
  dokumen. Isi minimal: hasil akhir · berkas yang berubah · verifikasi yang
  **benar-benar dijalankan** · risiko · pekerjaan yang masih terbuka.
- Perubahan UI juga dicatat di `changelog.md` §UI Changes.
- Kalau sebuah task mengubah arsitektur, workflow, atau kontrak inti,
  **`AGENTS.md` wajib diperbarui di task yang sama.**
- `createAction` sudah membuka transaksi dan menyerahkannya sebagai `tx`.
  **Pakai `tx`** — jangan klien `prisma` global, jangan `$transaction` bersarang.
- Dilarang `window.location.reload()`; pakai `router.refresh()`.
- Dilarang nilai visual hardcoded — cek `ui_engine/design-system.config.ts` dan
  `styles/designTokens.css` dulu.
- Teks yang dibaca pengguna: **Bahasa Inggris** (§2.3).
- Perubahan schema/migrasi tetap memerlukan izin owner. `prisma generate` sudah
  terbukti dapat berjalan di lingkungan ini lewat build #44; penerapan migrasi
  ke database produksi tidak ikut dilakukan.

---

## 8. Peran Claude setelah handoff ini

Codex memegang eksekusi coding. Claude bertindak sebagai **product specialist
dan reviewer**: mereview hasil coding terhadap kontrak, menjaga
`changelog.md`/`roadmap.md`/`AGENTS.md`, dan menyiapkan spesifikasi. Claude
hanya menulis kode produksi kalau item itu (1) sudah disepakati di roadmap,
(2) tercatat belum selesai di changelog, atau (3) diminta langsung owner.
Aturan lengkapnya di `AGENTS.md` §🧑‍⚖️ Pembagian Peran.
