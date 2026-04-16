### 🚀 MASTER PROMPT: UI RECOVERY & LOGIC CONSOLIDATION

**[OBJECTIVE]**
Lakukan refactor menyeluruh pada modul "Material & Fixtures Schedule" (Pillar 2) untuk menyelaraskan Terminologi, Logika Bisnis, dan UI Layout. Kita akan menghentikan inkonsistensi data dan memperbaiki tampilan menjadi "High-Density Smart Spreadsheet" yang solid.

---

### 1. TERMINOLOGY CONSOLIDATION (NOMENKLATUR BAKU)
Gunakan pemetaan variabel berikut secara konsisten di seluruh *Service*, *Types*, dan *Component Props*:

* **CODE**: Mengacu pada `entry.code` (Indeks deterministik seperti PT-1, PT-2).
* **CATEGORY**: Mengacu pada `snapshot.category` (Primary) dan `snapshot.sub_category` (Secondary).
* **BRAND**: Mengacu pada `snapshot.brand` atau `vendor_name`.
* **SKU / ITEM**: Mengacu pada `snapshot.name` (atau `product_type` dari master).
* **VARIANT / FINISH**: Mengacu pada `snapshot.initials_type` dan metadata dari `snapshot.specs` (color, pattern, finishing).

---

### 2. BUSINESS LOGIC REFINEMENT (FIXING THE AUDIT GAPS)
Perbaiki logika pengolahan data berikut sebelum melakukan *rendering*:

1.  **Category Priority Fix**: 
    Ubah logika penentuan kategori. **DILARANG** mendahulukan `sub_category`. 
    * *Logic:* `displayCategory = snapshot.category || snapshot.sub_category || entry.category`.
2.  **SKU Formatting**:
    Nama item yang ditampilkan harus menggabungkan Kode SKU internal (jika ada) dan Nama Material.
    * *Format:* `{sku_code} - {material_name}`.
3.  **Fallback Initials**:
    Jika `initials_type` kosong, tarik data dari `specs.color` atau `specs.finishing` sebagai teks pengganti di kolom Variant.

---

### 3. UI STRUCTURE & LAYOUT (STRICT 5-COLUMN)
Pastikan `ScheduleEntryRow.tsx` dan `TableHeader` memiliki jumlah sel yang **PRESISI (5 Kolom)** untuk mencegah *misalignment*.

* **Kolom 1: CODE (w-24)**
    * Render: `Code` + `Status Globe Icon` (Flex-row, items-center, gap-2).
    * *Interaksi:* Klik ikon bola dunia merah untuk `promoteToLibraryAction` (Re-request).
* **Kolom 2: IMAGE (w-16)**
    * Render: Thumbnail `h-10 w-10 object-cover rounded-sm`.
* **Kolom 3: PRODUCT INFO (flex-1)**
    * Gunakan *Stacked Typography*:
        * **Atas (SKU/Item):** `font-medium text-slate-900 text-sm hover:underline cursor-pointer`. (Trigger Snapshot Modal).
        * **Bawah (Metadata):** `text-slate-500 text-[10px] uppercase tracking-wider`.
        * *Content Bawah:* `{BRAND} • {CATEGORY} • {VARIANT}`.
* **Kolom 4: LOCATION (w-32)**
    * Render: `entry.location` (Text-slate-600).
* **Kolom 5: ACTIONS (w-16 text-right)**
    * Render: 3-dot kebab menu.
    * *Visibility:* Gunakan `group` pada `<tr>` dan `opacity-0 group-hover:opacity-100` pada menu ini.

---

### 4. MICRO-UX & POLISH
* **Density:** Semua sel tabel wajib menggunakan `py-2`.
* **Edit Trigger:** Tambahkan `onDoubleClick` pada seluruh baris `<tr>` untuk membuka Snapshot Edit Modal.
* **Bulk Actions:** Tombol "Delete" di header harus menggunakan gaya *Ghost Button* (teks merah, tanpa background solid).
* **Omnibox Integration:** Pastikan `CreatableSearch` tetap berada di bawah tab sebagai satu-satunya pintu masuk data baru.

**[EXECUTION]**
Segera perbarui `ScheduleEntryRow.tsx`, `ProjectScheduleMain.tsx`, dan file terkait di `src/extensions/schedule/`. Pastikan tidak ada `<td>` yang berlebih dan semua variabel terhubung ke data yang benar sesuai hasil audit.

***

### 💡 Analisis Visual Konsolidasi
Untuk memastikan tim memahami perubahan nomenklatur ini, berikut adalah peta visual hubungan antara Data Master dan tampilan UI baru:



| Terminologi Lama | Terminologi Baru (SSOT) | Lokasi di UI |
| :--- | :--- | :--- |
| Ex / Vendor | **Brand** | Baris bawah (Metadata) |
| Initial Type | **Variant / Finish** | Baris bawah (Metadata) |
| Type | **SKU / Item** | Baris atas (Primary Link) |
| Material Type | **Category** | Baris bawah (Metadata) |