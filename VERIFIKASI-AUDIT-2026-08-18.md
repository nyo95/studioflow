# Verifikasi Audit Master Data — 25 temuan agent lain

**Tanggal:** 2026-08-18
**Metode:** setiap temuan dibaca ulang terhadap kode nyata di mesin ini,
bukan dipercaya dari ringkasannya. `prisma validate` bersih, `npm test`
118/118 lulus saat verifikasi dijalankan.

**Hasil ringkas:**

| Verdict | Jumlah |
|---|---|
| ❌ Salah baca (tidak ada bug) | 5 |
| ⚠️ Benar tapi bobotnya dilebihkan | 3 |
| ✅ Benar & **baru** (belum ada di roadmap) | 12 |
| 🔁 Benar tapi **sudah tercatat** di roadmap (B3/B7/H3) | 5 |

Dua temuan mengubah gambaran yang kita punya sebelumnya, dan keduanya
tidak ada di audit #21. Selebihnya sebagian besar mengonfirmasi ulang
temuan lama dengan nomor baru.

---

## ❌ Salah baca — jangan dikerjakan

### #1 `checkWorkPrice` menerima 0

**Tidak ada bug. Ini keputusan desain yang disengaja dan ada testnya.**

Aturan AGENTS.md §3.2 berjudul **"Kosong bukan nol"** — artinya *jangan
menyamakan* keduanya, yaitu jangan biarkan `Number("")` yang bernilai `0`
lolos jadi harga. Bunyinya untuk `WorkPrice` adalah **"kosong = tolak"**,
bukan "nol = tolak".

`checkWorkPrice` menolak `null`, `undefined`, `""`, string spasi, `NaN`,
dan negatif — persis yang diminta. Nol yang **diketik orang** adalah
pernyataan harga ("gratis", "sudah termasuk") dan memang harus diterima.
Ada testnya: *"checkWorkPrice menerima nol yang DIKETIK dengan sengaja"*.

Kalau ini "diperbaiki", tarif gratis jadi mustahil diinput.

### #2 `resolvePrice(0)` mengembalikan `0`

**Tidak ada bug, dan pemanggil yang dikhawatirkan tidak ada.**

Test di `sku-price.test.ts:41` menuliskan alasannya eksplisit: *"a zero
someone typed on purpose is a free-of-charge item and must not be erased."*

Kekhawatirannya — caller yang mengoper `Number("")` — tidak terjadi.
Skema Zod `SkuPrice` (`pricing-actions.ts:131-133`) memetakan `""` ke
**`null`**, bukan `0`, sebelum angkanya sampai ke `resolvePrice`.

### #9 `readyCount` tidak cek `price_net NOT NULL`

**Tidak bisa gagal.** `SkuPrice.price_net` bertipe `Decimal` **non-nullable**
di `schema.prisma:576`. Cek yang diusulkan selalu true. Karena harga wajib
ada secara skema, "harga DAN satuan ada" memang menyusut jadi cek satuan
saja — dan itulah yang querynya lakukan.

### #12 `WORK_PRICE_INCLUDE` shadow import

**Hanya ada satu deklarasi**, di `pricing-actions.ts:216`.
`sku-price-service.ts` tidak punya simbol bernama itu. Tidak ada shadowing.

### #16 Contact delete tidak cek existence

**Cek-nya ada**, `party-actions.ts` melakukan `findUnique` sebelum
`delete`. Yang benar-benar kurang cuma `throw` yang ramah kalau barisnya
tidak ketemu — sekarang yang muncul error Prisma mentah. Itu bagian dari
**M6** yang sudah ada di roadmap, bukan temuan baru.

---

## ⚠️ Benar tapi bobotnya dilebihkan

### #3 Dropdown kategori tanpa filter `kind` — **P2, bukan P0**

Benar, `material-view-service.ts:302` tidak memfilter `kind`. Tapi
where-nya berbunyi `skus: { some: { sku: { deleted_at: null } } }` —
hanya kategori yang **punya SKU** yang ikut. Kategori `WORK` menempel ke
`WorkPrice`, bukan ke `Sku`, jadi pencampuran cuma mungkin dari data lama
sisa bug H9 (yang sudah ditutup).

Tetap layak diperbaiki — satu baris, dan AGENTS.md memang mewajibkannya —
tapi ini kepatuhan kontrak, bukan korupsi data yang sedang berjalan.

### #13 `mapWorkPriceCommon` memaksa null → 0

Cabang `: 0` **tidak pernah tereksekusi**: `WorkPrice.price` non-nullable
(`schema.prisma:635`). Ini kode mati yang menyesatkan pembaca, bukan bug.

Perbaikan yang diusulkan ("seharusnya null") justru **salah** — akan
melawan tipe kolomnya. Yang benar: buang cabangnya, jadi `Number(p.price)`.

### #23 `Number(quotedPrice)` tanpa NaN guard

String kosong **sudah dijaga**: `quotedPrice === "" ? null : Number(...)`.
Sisa risikonya hanya teks non-angka, dan itupun tergantung apakah
input-nya `type="number"`. Bobot rendah.

---

## ✅ Benar & baru — ini yang layak dikerjakan

Diurutkan berdasarkan nilai per biaya, bukan berdasarkan label P0/P1 yang
diberikan agent sebelumnya.

### ⭐ #11 Audit Sample menulis ke tabel yang salah — **tangkapan terbaik**

`sample-actions.ts` memanggil `insertAuditLog` di **3 tempat** (baris 284,
342, 417) — itu menulis ke `studioflow.AuditLog`.

AGENTS.md §6 melarangnya dengan kalimat yang sulit disalahpahami:

> Setiap tulis ke tabel `master_data` WAJIB lewat `recordAudit(tx, …)` →
> `master_data.MasterDataAudit`, **di dalam transaksi yang sama**…
> `studioflow.AuditLog` adalah tabel yang BERBEDA, milik StudioFlow.
> Jangan … menulis ke sana sebagai pengganti.

Ini kelas cacat yang sama persis dengan H1 yang sudah kita tutup, di
tempat yang belum diperiksa. Audit #21 **melewatkan ini** — H6 hanya
mencari audit yang *hilang*, bukan audit yang *nyasar*. Akibatnya jejak
audit Sample terputus dari sistem audit Master Data.

### ⭐ #19 Kode mati di `SupplierClient.tsx` — **dan ini mengoreksi changelog #23**

Tiga blok tidak pernah dirender, dikonfirmasi grep ke seluruh `src/`:

| Simbol | Baris | Ukuran |
|---|---|---|
| `SupplierJasaTab` | 299–496 | ±197 baris |
| `InlineCompanyCell` | 149–272 | ±124 baris |
| `toggleSort` | 587 | dideklarasi, tak dipanggil |

`SupplierClient.tsx` bahkan **tidak punya `<Tabs>` sama sekali** — "tab
Jasa" tidak ada di UI.

**Konsekuensinya untuk M2:** guard `useUnsavedChangesGuard` yang changelog
#23 catat terpasang di "Supplier Jasa tab" berada di baris 315/341/486 —
**seluruhnya di dalam `SupplierJasaTab` yang mati.** Jadi klaim changelog
itu perlu dikoreksi.

Kabar baiknya: layar Supplier yang **hidup** tetap aman, karena dialog
yang benar-benar dirender adalah `MasterDataBrandDialog` dan `PartyDialog`,
dan keduanya sudah punya guard sendiri. Jadi tidak ada lubang UX nyata —
yang ada adalah pekerjaan yang terbuang dan catatan yang salah.

### #10 Non-approver mengedit → status turun ke PENDING diam-diam

`MasterDataProductDialog.tsx:477` memaksa `PENDING` saat
`!access.canApproveMaterial`. Sebagai **kebijakan** ini masuk akal (edit
oleh non-approver wajib disetujui ulang). Yang salah adalah **diamnya** —
tidak ada apa pun di layar yang memberi tahu.

**Butuh keputusan Anda:** apakah "edit mencabut approval" memang
diinginkan? Kalau ya, cukup tambahkan peringatan di dialog. Kalau tidak,
logikanya yang diubah. Saya tidak mengubah ini sendiri.

### #8 `getMaterialPricesAction` tanpa pagination

Memuat seluruh `SkuPrice` dengan `is_current: true` ke memori. Nyata;
mendesaknya tergantung volume harga Anda hari ini.

### #14 Picker vendor tidak menyaring `is_active`

`Party.is_active` **ada** (`schema.prisma:273`) dan tidak dipakai di
`getServiceVendorsAction`. Vendor yang dinonaktifkan tetap muncul.
Satu baris.

### #17 Contact update/delete tidak verifikasi kepemilikan `party_id`

Benar. Tapi izinnya global (`MASTERDATA_VENDOR_MANAGE`), bukan per-party,
jadi ini **pertahanan berlapis**, bukan celah privilese yang bisa
dieksploitasi hari ini. Kerjakan bersama H3.

### #15 `generateWorkPriceCode` punya TOCTOU

Nyata, tapi `@unique` pada `code` menangkapnya dan komentarnya sudah
menyebut itu. Akibat terburuk: error mentah yang jarang — yang mana
tertutup **M6**.

### #21 `<a href>` untuk navigasi internal

`SupplierDetailClient.tsx` baris ~208 dan di `PricesTab`. Menyebabkan full
page reload. Semangatnya sama dengan larangan `window.location.reload()`
di AGENTS.md §UI Refresh Protocol. Ganti ke `<Link>`.

### #22 Search brand memicu server action tiap ketikan

`BrandDetailClient.tsx:286` — `useEffect` dengan `search` di dependency,
tanpa debounce. Satu `useDebounce` 300ms.

### #24 Urutan tutup dialog rapuh

`SampleLibraryClient.save()` memanggil
`setDialog(...open:false)` **lalu** `editGuard.closeAfterSave()`.
`saveStatus()` di file yang sama sudah benar — hanya `closeAfterSave()`.
Samakan; buang baris `setDialog`-nya.

### #25 Typo label

`types/party.ts:40` — `MANUFACTURER: "Manufacture"` → `"Manufacturer"`.

### #20 Tab Prices di Supplier detail masih stub

Benar, isinya cuma tautan ke halaman Prices. Ini **fitur belum dibangun**,
bukan cacat — masukkan ke roadmap fitur, bukan ke daftar bug.

---

## 🔁 Benar, tapi sudah tercatat di roadmap

Empat temuan ini sudah ada di `roadmap.md` sejak audit #21, dengan
deskripsi yang lebih lengkap daripada versi barunya:

| Temuan baru | Sudah tercatat sebagai | Catatan |
|---|---|---|
| #4 path tidak turun ke anak | **B7** | B7 juga menyebut backfill duplikat |
| #18 lookup OR salah match | **B7** | bagian dari item yang sama |
| #5 delete vendor tak cek Brand | **H3** | |
| #6 delete company tak cek WorkPrice | **H3** | |
| #7 slug tanpa cek unik | **B3** | B3 menyebut 7 jalur tulis, bukan 2 |

**Satu koreksi penting untuk #5.** Bukan "tidak ada penjaga" —
`deleteServiceVendorAction` **sudah** memeriksa `work_prices`, dan
`deleteCompanyAction` **sudah** memeriksa `owned_brands`. Masalahnya lebih
tajam dari yang dilaporkan: **masing-masing memeriksa persis apa yang
dilewatkan yang lain.** Itulah sebabnya H3 berbunyi "satukan menjadi satu
jalur yang memeriksa semua" — bukan "tambahkan cek".

Perlu dicatat juga: karena ini *soft* delete dan FK-nya `onDelete: SetNull`,
tidak ada crash — yang terjadi adalah baris menunjuk party yang sudah
dihapus. Masalah kualitas data, bukan korupsi.

---

## Urutan kerja yang saya sarankan

Bukan P0→P1 seperti usulan agent sebelumnya, karena separuh P0-nya salah
baca. Urutan berdasarkan nilai nyata per biaya:

**Batch A — murah, berdiri sendiri, nol risiko regresi (±1 jam)**
#25 typo · #24 urutan guard · #13 buang cabang mati · #21 `<Link>` ·
#22 debounce · #14 filter `is_active` · #3 filter `kind`

**Batch B — kepatuhan kontrak, nilai tinggi (±2 jam)**
#11 audit Sample ke `recordAudit` — *kerjakan ini lebih dulu dari apa pun
di batch A kalau harus memilih satu*

**Batch C — pembersihan, perlu ketelitian (±1 jam)**
#19 buang ±330 baris kode mati, lalu **koreksi changelog #23** soal klaim
guard di Supplier Jasa tab

**Batch D — sudah di roadmap, kerjakan sesuai gelombangnya**
B3 (#7) · B7 (#4, #18) · H3 (#5, #6, #17) · M6 (#15, #16)

**Butuh keputusan Anda dulu — tidak saya sentuh**
#10 apakah edit non-approver memang harus mencabut approval ·
#8 apakah volume harga sudah cukup besar untuk butuh pagination ·
#20 apakah tab Prices mau dibangun beneran

**Tidak ada satupun di batch A–C yang menyentuh `schema.prisma` atau
butuh migrasi baru.**
