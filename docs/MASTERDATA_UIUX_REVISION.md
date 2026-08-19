# Arsitektur & Pedoman UI/UX Master Data (SSOT) - Revisi Terpadu
**Tanggal Dokumen:** 12 Agustus 2026 (Update Pasca-Review)
**Konteks:** Dokumen ini menganulir desain UI/UX sebelumnya yang menggabungkan entitas Brand, SKU, dan Harga dalam satu formulir, demi menjaga integritas *Single Source of Truth* (SSOT).

---

## 1. Prinsip Dasar SSOT (Single Source of Truth)
Aplikasi Master Data harus memisahkan data secara tegas menjadi 3 ranah:
1.  **Entitas Induk (Brand/Pabrik):** Data statis profil perusahaan dan merek.
2.  **Entitas Fisik (SKU/Barang):** Spesifikasi visual dan dimensi murni (tanpa harga).
3.  **Entitas Transaksional (Harga & Supplier):** Relasi dinamis antara Barang, Harga, dan Tempat Membeli.

---

## 2. Restrukturisasi Form & Modal (Instruksi Refactor)

### A. Halaman Brands & `MasterDataBrandDialog.tsx`
**Masalah Sebelumnya:** Tombol "Tambah Material" di halaman *Brands* membuka modal yang berisi input SKU dan Harga.
**Revisi UI/UX:**
- Ubah label CTA utama di `/masterdata/materials` (Brand Landing View) menjadi **"Tambah Brand"**.
- `MasterDataBrandDialog.tsx` **HANYA** boleh berisi isian profil merek. Hapus semua *input* terkait SKU, dimensi, dan harga dari komponen ini.
- **Struktur Form Brand (Baru):**
  - **Company / Induk Perusahaan:** `TextInput` (opsional, misal: PT Tangkas Cipta Optimal)
  - **Product Brand:** `TextInput` (Mandatory, misal: TACO - HPL)
  - **Category:** `Multi-select / Tags` (Mendukung banyak kategori, misal: HPL, Sink)
  - **Google Drive URL:** `URL Input` (Tautan ke e-katalog/brosur)
  - **Website URL:** `URL Input`
  - **Social Media:** `Dynamic JSON Input` (Bisa *add more* IG, FB, dll)
  - *Catatan:* **Dilarang** memasukkan kolom `Image URL` di level ini.

### B. Form SKU / Material (`MasterDataProductDialog.tsx` / `SkuDetailDrawer.tsx`)
**Masalah Sebelumnya:** *Layout* berantakan, form dimensi terlalu makan tempat, dan ada field `Image URL` yang tidak sesuai skema database.
**Revisi UI/UX:**
- Form pembuatan SKU harus dipecah ke dalam grup (*sectioning*) yang rapi.
- Hapus *field* `Image URL` sepenuhnya (referensi visual cukup dari Google Drive URL di level Brand).
- **Struktur Form SKU (Baru):**
  - **Section 1: Spesifikasi Visual (1 Baris Grid)**
    - `SKU Name` | `Warna` | `Motif` | `Finishing`
  - **Section 2: Dimensi Fisik (1 Baris Input Group)**
    - `Panjang` x `Lebar` x `Tinggi` (dalam satu kesatuan visual) | `Dimension Unit` (Dropdown: cm, mm, m, dll)
  - **Section 3: Initial Sourcing (Opsional - untuk entry pertama)**
    - `Supplier` (Dropdown Picker) | `Net Price` | `Price Unit`

### C. Halaman Supplier (`SupplierClient.tsx` & `PartyDialog.tsx`)
**Konfirmasi Desain:**
- Tetap gunakan **Checkbox** untuk penetapan "Categories/Roles" (*Supplier, Subcon, Vendor, Retail, Manufacture*).
- **Alasan Bisnis:** Satu *party* (perusahaan) bisa bertindak ganda (contoh: Jual material SPC sekaligus melayani jasa pasang sebagai Subcon).
- Checkbox "Supplier" bertindak sebagai *gatekeeper*: hanya yang dicentang yang akan muncul di *dropdown* pencarian Vendor pada halaman *Pricing*.

### D. Halaman Pricing (`PricingClient.tsx`) - Poros Utama
**Konteks:** Ini adalah halaman SSOT untuk transaksi. Terdiri dari 3 Tab (Material Prices, Material + Labour, Labour Prices).
**Aturan UI/UX:**
- Staf **wajib** melakukan CRUD Harga dan menghubungkan SKU dengan Supplier dari halaman ini.
- **Khusus Tab Material + Labour (`WorkPrice`):** UI harus memaksa/menyediakan opsi bagi *user* untuk mendefinisikan/memilih (relasi data) **material dasar apa** yang ada di dalam harga *bundling* borongan tersebut. Jangan biarkan input teks kosong tanpa relasi material.

---

## 3. Kebijakan Quick Entry & Anti-Duplikasi
Fitur `useQuickEntry` (misal: mengetik nama Brand atau Vendor baru yang belum ada di database langsung dari *dropdown*) **tetap dipertahankan**, tetapi dengan syarat mutlak:
- Semua entitas baru yang lahir dari metode *Quick Entry* secara *default* harus di-set status kurasinya menjadi **`Pending`** atau **`Draft`**.
- Sistem harus menampilkan peringatan visual (misal: *badge* oranye) bahwa data tersebut bisa dipakai untuk *drafting* RAB, tetapi harus di-lengkapi profilnya oleh Admin Master Data di kemudian hari agar statusnya menjadi *Complete/Verified*.