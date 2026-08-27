> ## ⚠️ DOKUMEN USANG — Master Data v1
>
> Diberi tanda pada perapihan dokumentasi **2026-08-18**.
>
> Berkas ini menggambarkan **Master Data v1**, schema yang sudah
> **tidak ada** — ia di-`DROP SCHEMA … CASCADE` oleh migrasi
> `20260810180000_masterdata_v2_rebaseline` pada 2026-08-10.
> Model seperti `Vendor`, `MaterialCatalog`, `Company`, dan kolom `catalog_*`
> tidak lagi mewakili keadaan sekarang.
>
> **Dipertahankan di root semata-mata karena 2 berkas di `src/` masih
> mengutip namanya di komentar.** Menghapusnya akan membuat rujukan itu
> menggantung — lebih buruk daripada dokumen usang yang jelas bertanggal lama.
>
> **Acuan yang berlaku:** [`AGENTS.md`](AGENTS.md) §🧱 Master Data Contract (v2)
> dan [`prisma/schema.prisma`](prisma/schema.prisma).
> Pekerjaan terbuka: [`roadmap.md`](roadmap.md).
>
> Verifikasi ulang isinya dilacak sebagai **T3** di `roadmap.md` — dokumen ini
> pernah menandai sebuah perbaikan "selesai" padahal belum.

---

# Upstream Notice — Product Catalog akan bersumber dari repo BQ

**Status:** keputusan arah, belum diimplementasi. Tidak ada kode StudioFlow yang berubah karena dokumen ini.
**Tanggal:** 29 Juli 2026 · **direvisi 30 Juli 2026** (model integrasi berubah — lihat §0)
**Repo sumber:** `D:\Misc\ProjectsHUB\BQ` — BQ Fixture Breakdown
**Dokumen tandingannya di sana:** `docs/INTEGRATION_STUDIOFLOW.md` (lebih detail; dokumen ini ringkasannya untuk pembaca StudioFlow) — **dokumen itu belum direvisi dan masih memuat asumsi merge; §0 di bawah membatalkannya**

---

## 0. Revisi 30 Juli 2026 — BQ adalah subapp, bukan merge

Versi 29 Juli menulis BQ akan **melebur** ke StudioFlow. Di sisi BQ tertulis
eksplisit: *"ia dibangun **untuk** menjadi bagian StudioFlow"*, dengan rencana
FK `ProductCatalog.material_id`, `ESTIMATOR` masuk `Role` enum StudioFlow, dan
tahap I4 = port UI breakdown ke `ui_engine` StudioFlow.

**Itu dibatalkan.** Keputusan pengguna:

> BQ dibangun mandiri sampai final. Setelah final, **tinggal dikoneksikan ke
> StudioFlow sebagai subapp** — bukan dilebur.

### 0.1 Batas yang disepakati

| | Status |
|---|---|
| Login / identitas | **bersama** — bisa login dari StudioFlow |
| Database material | **bersama** — satu-satunya data yang menyatu |
| Database proyek | **terpisah** — BQ punya sendiri, StudioFlow punya sendiri |
| Harga material & harga vendor | **milik BQ saja** — standalone, permintaan klien. Tidak pernah tampil di StudioFlow |
| UI / aplikasi | **terpisah** — BQ aplikasi sendiri, dikoneksi sebagai subapp |

### 0.2 Yang gugur dari rencana lama

1. **Tahap I4 (port UI breakdown ke `ui_engine`) gugur.** BQ punya UI sendiri.
   Penyamaan design token tetap berguna supaya subapp tidak terasa asing, tapi
   itu konsistensi visual, bukan penggabungan kode.
2. **Permission `BQ_*` bukan milik `matrix.ts` StudioFlow.** `BQ_VIEW`,
   `BQ_OBJECT_ADD`, `BQ_OBJECT_EDIT`, `BQ_OBJECT_DELETE`, `BQ_MARKUP_EDIT`,
   `BQ_PURCHASE_VIEW`, `SERVICE_MASTER_*`, `SERVICE_PRICE_PUBLISH` ditegakkan di
   dalam BQ. Yang mungkin perlu ada di StudioFlow hanya `MATERIAL_MASTER_VIEW`
   / `MATERIAL_MASTER_EDIT` — karena database material memang bersama. (§4.1
   masih menyisakan satu keputusan terbuka soal ini.)
3. **FK `ProductCatalog.material_id` (tahap I3) tidak bisa apa adanya.** Ini
   konsekuensi teknis terpenting dari perubahan model — lihat §0.3.

### 0.3 BLOKER — di mana database material bertempat?

PostgreSQL **tidak punya foreign key antar-database.** Selama belum diputuskan
di mana master bahan tinggal, tahap I3 tidak bisa ditulis. Tiga kemungkinan:

| Opsi | FK `material_id` | Konsekuensi |
|---|---|---|
| **A.** Satu instance Postgres, schema terpisah (`studioflow.*` / `bq.*`) | **Bisa** — FK antar-schema sah di Postgres | Integritas dijaga DB. Dua Prisma client, satu database. Paling aman. |
| **B.** Material master di Postgres milik BQ, StudioFlow ikut baca | **Tidak bisa** | `material_id` jadi `String?` biasa tanpa constraint. Integritas dijaga aplikasi. Material terhapus di BQ → `ProductCatalog` menggantung tanpa peringatan DB. |
| **C.** Database material sebagai instance ketiga, dua-duanya ikut | **Tidak bisa** dari sisi mana pun | Paling bersih secara kepemilikan, paling mahal secara operasional. |

Kalimat "hanya material database saja yg jadi satu" paling dekat ke **A** atau
**C**. Kalau **A**, seluruh rencana I2–I3 versi lama masih hampir utuh, cuma
pindah schema. Kalau **B** atau **C**, tahap I3 harus ditulis ulang dengan
integritas di level aplikasi + reconciliation job. **Belum diputuskan.**

### 0.4 Login bersama = `User` dan `Role` juga jadi batas bersama

Kedua dokumen versi lama tidak memperhitungkan ini. Kalau BQ mengautentikasi
lewat StudioFlow, maka StudioFlow adalah **identity provider** — bukan hanya
material yang bersama, tapi juga tabel `User` dan enum `Role`.

Konsekuensinya `ESTIMATOR` **tetap** perlu masuk `Role` enum StudioFlow (tahap
I1 bertahan), karena StudioFlow-lah yang menerbitkan sesi yang dibaca BQ. Yang
berubah hanya cakupan permission-nya (§0.2 poin 2).

Mekanismenya belum ditentukan: next-auth StudioFlow sebagai OIDC/JWT provider
yang diverifikasi BQ, atau shared session table. Perlu diputuskan sebelum I1.

### 0.5 `catalog_price` lebih dalam dari yang tertulis

Versi lama memperlakukan `catalog_price` seolah kolom Library. Ia bukan. Ia
mengalir ke `ScheduleSnapshot.catalog_price`, lalu dipetakan bolak-balik ke
`unit_cost` staging SketchUp:

- `library/services/library-service.ts` — 512, 607, 1062
- `library/types.ts` — 82
- `schedule/services/schedule-service.ts` — 28, 55, 110, 153, 1209, 1254
- `schedule/types.ts` — 86
- `sketchup/actions/sketchup-actions.ts` — 871, 927, 968, 1642, 1755, 2336,
  3254, 3363, 3420

Jadi "deprecate `catalog_price`" (tahap I5) menyentuh **kontrak snapshot dan
payload plugin**, bukan satu kolom. Dan karena snapshot proyek lama sudah
menyimpan nilainya, kolom itu **wajib tetap terbaca selamanya** — `PLAN-catalog-library-sync.md`
melarang migrasi destruktif, dan larangan itu berlaku penuh di sini.

Sisi baiknya: karena harga sekarang eksplisit milik BQ saja, StudioFlow tidak
perlu menampilkan harga di UI mana pun. `LibraryFormModal` memang sudah tidak
punya field harga — jadi tidak ada UI yang perlu dibongkar untuk ini.

### 0.6 Dampak ke rework Library yang sedang berjalan

Lihat `LIBRARY-REWORK-FINDINGS.md`. Keputusan subapp ini **mengunci scope
Library StudioFlow dengan rapi**: identitas + spec + media + vendor/kontak,
tanpa harga — persis kolom sheet *material / supplier list* milik pengguna, yang
juga tidak punya kolom harga.

Tapi ada peringatan perencanaan. Kalau kepemilikan **identitas** material
(`catalog_sku`, nama, kategori, status) memang akan pindah ke BQ:

- **Aman dikerjakan sekarang, apa pun arah BQ:** perbaikan RBAC STAFF, bug
  penghapusan `PhysicalSample`, bug produk fixture tak bisa disimpan,
  vendor & kontak, sample & request, tampilan tabel/kartu untuk field spec.
- **Sebaiknya ditunda:** apa pun yang mengasumsikan `ProductCatalog` tetap
  pemegang identitas produk — termasuk penambahan kolom identitas baru.

---

## 1. Apa yang berubah

> **Direvisi.** Baca §0 lebih dulu. Bagian ini masih benar soal *kepemilikan
> data*, tapi kata "penggabungan" di mana pun harus dibaca sebagai
> "koneksi subapp".

Sedang dibangun repo terpisah, **BQ Fixture Breakdown**, yang menguraikan biaya fixture sampai ke bahan baku dan jasa. Repo itu membawa dua database: **Master Bahan Baku** dan **Master Jasa**, keduanya dengan histori harga ber-batch.

> Keputusan: **database bahan baku di repo BQ menjadi sumber utama.** Fitur Product Catalog Library di StudioFlow akan di-drop perannya sebagai pemegang identitas produk dan mengambil data dari sana.

Ini bukan penghapusan fitur. Yang berpindah hanya **kepemilikan data identitas + costing**. Alur kerja StudioFlow tetap utuh.

---

## 2. Yang TETAP di StudioFlow

Jangan bongkar bagian ini:

- Promosi desainer → library: `saveCatalogItemToLibraryAction`, gerbang Stage 1/Stage 2 (`MASTER_SSOT.md` §5.4), `LibraryItemStatus` PENDING/APPROVED/REJECTED, auto-approve ADMIN.
- Jembatan SketchUp seluruhnya: `SketchupMaterial` staging, UUID uniqueness, sync, merge queue, `full_snapshot` attestation (§5.6).
- Snapshot-first pada `ProjectScheduleEntry.data_snapshot` (§5.1).
- Two-phase re-indexing kode scheduler (§5.2).
- `Vendor`, `PhysicalSample`, `SampleMovementLog`, `ProjectProductRequest`.
- Seluruh aturan RBAC yang ada, termasuk gerbang STAFF-hanya-`PENDING` dan context check DIC/DRIC.

---

## 3. Yang berpindah kepemilikannya

`ProductCatalog` saat ini memegang dua hal sekaligus: **identitas produk** dan **spesifikasi desain**. Yang pindah cuma yang pertama.

| Kelompok field | Pemilik baru |
|---|---|
| `catalog_sku`, nama, kategori, brand, status | Repo BQ (`Material`) |
| Unit pakai, unit beli, konversi, waste default, minimum order, rounding increment | Repo BQ — **field baru, belum ada di StudioFlow** |
| Histori harga ber-`effective_date`/`verified_date`/`batch` | Repo BQ (`MaterialPrice`) |
| `catalog_color`, `catalog_finishing`, `catalog_motif`, dimensi, `catalog_image_url`, `catalog_reference_url`, `vendor_id` | **Tetap StudioFlow** |

Master **Jasa tidak punya padanan** di StudioFlow. Ia murni milik repo BQ, tidak perlu dipetakan ke apa pun di sini.

### Kenapa tidak digabung saja jadi satu tabel

`ProductCatalog` dan Master Bahan BQ menjawab pertanyaan yang berbeda tentang benda yang sama. Desainer bertanya "warnanya apa, fotonya mana, vendornya siapa". Estimator bertanya "satu lembar berapa sqm, harganya berapa, waste-nya berapa". Menggabungnya jadi satu tabel datar akan membuat salah satu sisi kehilangan alasan keberadaannya.

Modelnya: **satu identitas material, dua kelompok field, dua pemilik.** `ProductCatalog` bertahan sebagai tabel spesifikasi + media, dengan FK `material_id` ke tabel milik repo BQ.

### `catalog_price` dihentikan pemakaiannya

`catalog_price Float?` — satu kolom, nullable, tanpa tanggal berlaku — tidak bisa dipakai sebagai dasar quotation yang mengikat secara komersial. Harga pindah ke `MaterialPrice` yang ber-`effective_date`, `verified_date`, dan `batch_id`.

**Deprecate, jangan `DROP`.** `PLAN-catalog-library-sync.md` melarang migrasi destruktif; aturan itu berlaku penuh di sini.

---

## 4. Role `ESTIMATOR` belum ada

> **Direvisi — lihat §4.1 di bawah.** Kesimpulan intinya bertahan (`ESTIMATOR`
> tetap perlu ditambahkan, karena StudioFlow jadi identity provider — §0.4),
> tapi daftar permission di bawah ini **tidak semuanya milik StudioFlow lagi**.

`Role` enum saat ini: `ADMIN`, `OWNER`, `DIC`, `DRIC`, `STAFF` (`prisma/schema.prisma:496-502`). Repo BQ mengasumsikan adanya `ESTIMATOR`. Menambahkannya adalah prasyarat, dan sifatnya aditif (`ADD VALUE` pada enum PostgreSQL).

Permission baru yang perlu masuk `src/core/rbac/constants.ts`:

```ts
BQ_VIEW, BQ_OBJECT_ADD, BQ_OBJECT_EDIT, BQ_OBJECT_DELETE,   // ← lihat §4.1
BQ_MARKUP_EDIT, BQ_PURCHASE_VIEW,                            // ← lihat §4.1
MATERIAL_MASTER_VIEW, MATERIAL_MASTER_EDIT, MATERIAL_PRICE_PUBLISH,
SERVICE_MASTER_VIEW, SERVICE_MASTER_EDIT, SERVICE_PRICE_PUBLISH, // ← lihat §4.1
```

### 4.1 Pembagian permission setelah keputusan subapp

Karena BQ jadi aplikasi sendiri, penegakan izin BQ terjadi di dalam BQ. Yang
perlu diputuskan: **apakah StudioFlow tetap pemegang tunggal matriks izin, atau
hanya menerbitkan identitas + role dan BQ memetakan role→izin sendiri?**

| Opsi | Isi `matrix.ts` StudioFlow | Trade-off |
|---|---|---|
| **A. StudioFlow pemegang matriks penuh** | semua permission termasuk `BQ_*` dan `SERVICE_*` | Satu sumber kebenaran izin. Tapi StudioFlow menyimpan izin untuk fitur yang tidak dimilikinya, dan setiap fitur baru di BQ memaksa deploy StudioFlow. |
| **B. StudioFlow terbitkan identitas + role saja** | hanya `MATERIAL_MASTER_VIEW` / `MATERIAL_MASTER_EDIT` | BQ bebas berkembang. Risikonya matriks bisa menyimpang antar-aplikasi kalau tidak ada kontrak role yang tertulis. |

**Belum diputuskan.** Yang jelas: `MATERIAL_MASTER_VIEW` / `MATERIAL_MASTER_EDIT`
milik StudioFlow di kedua opsi, karena database material bersama.
`MATERIAL_PRICE_PUBLISH` sebaiknya **tidak** — harga eksplisit milik BQ (§0.1).

Satu hal yang tetap berlaku di kedua opsi: `ROLE_PERMISSIONS` bertipe
`Record<Role, PERMISSION[]>` (`src/core/rbac/matrix.ts:7`), jadi menambahkan
`ESTIMATOR` ke enum tanpa mendaftarkannya di matriks akan gagal compile.
Andalkan itu.

### 4.2 Perhatian — gerbang STAFF di §4 lama sudah usang

Versi lama menulis *"STAFF — boleh input master, tunduk pada gerbang `PENDING`
yang sudah ada"* dan memperlakukannya sebagai perilaku yang benar.
`LIBRARY-REWORK-FINDINGS.md` §3b.1 menemukan gerbang itu **cacat**: dalam kosakata
pengguna, "admin" berarti *administrative staff* = role `STAFF`, dan STAFF-lah
pemilik daftar material/supplier. Tapi `matrix.ts:14-19` hanya memberi STAFF
`LIBRARY_VIEW` + `LIBRARY_EXPORT_LIST`, sementara tiga gate lain saling
bertentangan — hasilnya kurator daftar tidak bisa menyunting daftarnya sendiri.

Jangan jadikan gerbang STAFF-hanya-`PENDING` sebagai acuan saat merancang izin
master material. Ia sedang diperbaiki.

Ringkasan matriks yang diusulkan (lengkapnya di `INTEGRATION_STUDIOFLOW.md` §4.3):

- **ESTIMATOR** — pegang penuh BQ breakdown; master data read-only.
- **DIC / DRIC** — BQ read-only; promosi ke library tetap milik mereka.
- **STAFF** — boleh input master, tunduk pada gerbang `PENDING` yang sudah ada.
- **ADMIN / OWNER** — semua.

Dua pemisahan yang disengaja:

1. **Estimator tidak boleh menyunting master.** Bukan soal kepercayaan — soal jejak. Kalau harga bisa diubah saat sedang menghitung, rate yang dihasilkan tidak bisa ditelusuri ke batch mana pun. Yang boleh: override harga di baris breakdown dengan alasan tercatat, lokal ke object.
2. **`MATERIAL_PRICE_PUBLISH` terpisah dari `MATERIAL_MASTER_EDIT`.** Publish bersifat atomic dan menyentuh semua dokumen draft yang memilih ikut. Terlalu besar untuk digabung dengan izin edit biasa.

`ROLE_PERMISSIONS` bertipe `Record<Role, PERMISSION[]>`, jadi TypeScript akan menolak compile kalau `ESTIMATOR` ditambahkan ke enum tapi lupa didaftarkan di matriks. Andalkan itu.

---

## 5. Urutan migrasi

> **Direvisi — tabel di bawah ini adalah versi 29 Juli dan sudah usang.**
> Pakai §5.1. Disimpan supaya jejak keputusannya terbaca.

| Tahap | Isi | Status setelah revisi |
|---|---|---|
| I1 | `ESTIMATOR` ke `Role` enum, permission baru ke `constants.ts`, baris baru di `matrix.ts`. | bertahan, cakupan permission menyusut (§4.1) |
| I2 | Tabel `Material`, `MaterialPrice`, `Service`, `ServicePrice`. `ProductCatalog` belum disentuh. | **tergantung §0.3** — tabel ini mungkin bukan di database StudioFlow |
| I3 | Migrasi data `ProductCatalog` → `Material`, tambah FK `ProductCatalog.material_id`. `catalog_sku` dibiarkan agar rollback masih mungkin. | **terblokir** oleh §0.3 — FK belum tentu mungkin |
| I4 | Port UI breakdown ke React + `ui_engine`, pakai RBAC asli. | **gugur** (§0.2) |
| I5 | Alihkan seluruh pembacaan harga dari `catalog_price` ke `MaterialPrice`. | bertahan, jauh lebih luas dari perkiraan (§0.5) |

### 5.1 Urutan setelah keputusan subapp

Prasyarat sebelum tahap apa pun bisa ditulis: **§0.3 (tempat database material)
dan §0.4 (mekanisme login bersama) harus diputuskan.** Tanpa itu, S3 ke bawah
tidak bisa dirancang.

| Tahap | Isi | Sifat |
|---|---|---|
| **S0** | Putuskan §0.3 (opsi A/B/C) dan §0.4 (mekanisme sesi). Tulis kontrak role antar-aplikasi. | dokumen, nol kode |
| **S1** | `ESTIMATOR` ke `Role` enum + `matrix.ts`; permission material master ke `constants.ts` sesuai §4.1. | aditif, `ADD VALUE` |
| **S2** | Jadikan StudioFlow identity provider sesuai putusan §0.4. BQ masih pakai data materialnya sendiri. | aditif |
| **S3** | Bentuk database material bersama sesuai putusan §0.3. `ProductCatalog` belum disentuh. | aditif |
| **S4** | Tambah `ProductCatalog.material_id` — FK kalau opsi A, `String?` tanpa constraint kalau B/C. `catalog_sku` **dibiarkan** agar rollback masih mungkin. | aditif, nullable |
| **S5** | Koneksikan BQ sebagai subapp (routing, navigasi, penerusan sesi). Tidak ada kode BQ yang masuk ke repo ini. | aditif |
| **S6** | Hentikan pembacaan `catalog_price` untuk perhitungan baru. Kolom + `ScheduleSnapshot.catalog_price` **tetap terbaca selamanya** untuk snapshot lama (§0.5). | tanpa `DROP` |

Semua aditif. Tidak ada `DROP`, tidak ada `ALTER` kolom yang sudah ada, tidak ada
backfill yang menimpa — sesuai `PLAN-catalog-library-sync.md`.

Verifikasi tiap tahap: `npx tsc --noEmit` + `npx eslint` pada file yang berubah.
Disarankan `pg_dump` sebelum S3 dan S4.

Catatan urutan: **S1–S2 tidak bergantung pada BQ selesai.** Keduanya bisa
dikerjakan kapan saja dan tidak merugikan kalau arah BQ berubah lagi. S3 ke atas
menunggu BQ final, sesuai keputusan pengguna.

---

## 6. Titik risiko

**Integritas lintas-database (baru, dari §0.3).** Kalau opsi B atau C dipilih,
`ProductCatalog.material_id` tidak punya penjaga di level DB. Material dihapus
di sisi BQ → baris `ProductCatalog` menggantung dan tidak ada yang memberi tahu.
Perlu reconciliation job berjadwal + soft-delete yang dihormati kedua sisi. Opsi
A menghindari seluruh kelas masalah ini; itu argumen terkuat untuk memilihnya.

**Penyimpangan matriks izin (baru, dari §4.1).** Kalau opsi B dipilih, dua
aplikasi memetakan role→izin secara independen. Tanpa kontrak role tertulis,
keduanya akan menyimpang perlahan dan tidak ada yang gagal compile.

**Jendela dua sumber kebenaran.** Antara S3 dan S6, `ProductCatalog` dan `Material` hidup berdampingan. Selama itu `Material` harus read-only dari sisi StudioFlow, dan jendelanya dibuat sependek mungkin.

**Material hasil sync SketchUp tidak punya data costing.** Material yang lahir dari `autoLinkSyncedMaterial` tidak membawa konversi maupun harga. Estimator yang memilihnya akan mendapat rate nol tanpa peringatan. Perlu diputuskan: auto-create `Material` berstatus `incomplete`, atau tunggu admin melengkapi. Kalau `incomplete`, ia harus jadi error saat lock revisi.

**Visibilitas harga.** Matriks usulan memberi `MATERIAL_MASTER_VIEW` ke semua role. Kalau harga beli bahan dianggap sensitif, pecah jadi `MATERIAL_MASTER_VIEW` (identitas + unit) dan `MATERIAL_PRICE_VIEW` (angka). **Ini belum diputuskan.**

---

## 7. Perlu keputusan

**Pemblokir — harus dijawab sebelum S3 bisa dirancang:**

1. **Di mana database material bertempat?** Opsi A / B / C di §0.3. Ini menentukan
   apakah `material_id` boleh jadi FK sungguhan. Keputusan tunggal paling penting.
2. **Bagaimana sesi bersama bekerja?** OIDC/JWT dari next-auth StudioFlow, atau
   shared session table? (§0.4)
3. **StudioFlow pemegang matriks izin penuh, atau identitas + role saja?** (§4.1)

**Masih terbuka dari versi lama:**

4. `ProductCatalog` di-rename jadi `MaterialSpec`, atau namanya dibiarkan dengan peran menyusut?
5. ~~Harga beli bahan boleh dilihat DIC/DRIC/STAFF?~~ → **terjawab.** Harga milik
   BQ saja (§0.1); tidak tampil di StudioFlow untuk role mana pun.
6. Material hasil sync SketchUp: auto-create tanpa costing, atau tunggu admin?
   (Catatan: "admin" di sini berarti *administrative staff* = role `STAFF` — lihat §4.2.)
7. Migrasi semua `ProductCatalog`, atau hanya yang `APPROVED`?
8. ~~Siapa pemegang `MATERIAL_PRICE_PUBLISH`?~~ → sebaiknya tidak ada di
   StudioFlow sama sekali (§4.1).

---

## 8. Catatan untuk agent berikutnya

Sesuai `AGENTS.md` §Deviation Blocking dan §Confirm-First Protocol: dokumen ini adalah **arah yang sudah disetujui pengguna**, bukan deviasi yang ditemukan di codebase. Tapi ia **belum** tercermin di `MASTER_SSOT.md` karena belum ada kode yang berubah.

Saat tahap S1 benar-benar dikerjakan, `MASTER_SSOT.md` §5 (Pillar 2) dan §6 (RBAC) wajib diperbarui, dan perubahannya dicatat di `CHANGELOG.md`. Sampai saat itu, perlakukan dokumen ini sebagai rencana, bukan sebagai SSOT.

**Tiga hal yang wajib dibaca agent berikutnya sebelum menyentuh Library atau BQ:**

1. **§0 membatalkan sebagian dokumen ini sendiri.** Kalau ada pertentangan antara
   §0 dan §1–§6, §0 yang menang. Bagian lama sengaja tidak dihapus supaya jejak
   keputusannya terbaca.
2. **`docs/INTEGRATION_STUDIOFLOW.md` di repo BQ belum direvisi** dan masih
   menulis rencana merge — termasuk *"ia dibangun untuk menjadi bagian
   StudioFlow"* dan port UI. Jangan diikuti sampai disinkronkan. Sinkronisasi itu
   pekerjaan di sisi repo BQ.
3. **`LIBRARY-REWORK-FINDINGS.md`** memuat temuan studi Library per 30 Juli 2026,
   termasuk dua bug destruktif/pemblokir yang belum diperbaiki dan koreksi RBAC
   STAFF. §0.6 menjelaskan bagian rework mana yang aman dikerjakan sebelum arah
   BQ final.
