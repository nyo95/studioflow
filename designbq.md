# Design BQ

Catatan arah desain untuk app BQ di StudioFlow.

Dokumen ini mencatat **arah yang diminta owner** supaya keputusan UI berikutnya
konsisten. Ini bukan kontrak schema atau algoritma detail. Detail teknis tetap
hidup di `PRD-Architecture-Cleanup-v2.md`.

## 1. Product Goal

BQ harus menjadi:

- **pengganti Excel untuk estimator**
- **mudah dipakai saat menyusun breakdown**
- **cepat diisi, cepat dibaca, cepat direvisi**
- **tetap bisa diekspor ke format BQ formal ala Excel**

Artinya:

- viewer kerja di app tidak perlu meniru seluruh bentuk Excel
- justru viewer harus lebih sederhana dari Excel
- format export boleh lebih formal dan lebih mirip template Excel final

## 2. Core Principle

BQ ini **bukan kalkulator material otomatis**.

BQ ini adalah alat estimator yang bekerja dengan:

- **harga satuan**
- **koefisien**
- **penilaian manual estimator**

Contoh arah hitung:

- 1 lembar HPL punya harga beli
- estimator melihat gambar kerja / 3D
- estimator memutuskan pemakaian realistisnya, misal `0.7 lembar`
- angka `0.7` itulah koefisien
- sistem menghitung cost dari koefisien itu, bukan dari simulasi nesting otomatis

## 3. What The App Should Feel Like

Saat dipakai, BQ harus terasa seperti:

- worksheet estimator yang rapi
- bukan ERP
- bukan costing engine yang terlalu pintar
- bukan software optimasi cutting

Pengguna harus merasa:

- saya mengerti angka ini datang dari mana
- saya bisa edit cepat tanpa melawan sistem
- saya tidak dibebani field yang sebenarnya saya hitung manual

## 4. UI Goals

UI BQ harus mengejar 5 hal:

1. **Ringkas**
2. **Tidak redundant**
3. **Hierarki jelas**
4. **Cepat untuk input**
5. **Mudah dipindai mata**

Implikasinya:

- object header harus jadi satu area utama untuk ringkasan dan aksi
- hindari dua baris yang terasa seperti dua header untuk level yang sama
- informasi penting ditempatkan di row paling atas
- detail estimator muncul hanya saat dibuka
- tabel line cukup menampilkan hal yang relevan untuk keputusan estimator

## 5. Information Priority

Urutan informasi yang paling penting di viewer kerja:

1. nama object / sub-object
2. qty object
3. rate per unit
4. total
5. line items dan koefisien

Yang harus tampil dominan:

- nama
- angka rate
- angka total

Yang boleh lebih tenang:

- code
- provenance Master / Local
- metadata tambahan

## 6. Desired Interaction Pattern

Default reading:

- **closed = client-style summary**
- **open = estimator-style detail**

Saat object dibuka:

- aksi object tetap menempel di area header atas
- input utama seperti `Qty` boleh berada tepat di bawahnya
- line items baru muncul setelah itu

Jadi:

- header = identitas + angka + aksi
- body = editing dan breakdown

## 7. Explicit Non-Goals

Yang **bukan** arah BQ ini:

- otomatis menghitung pemakaian lembar dari dimensi bahan
- otomatis menentukan waste dari engine internal
- otomatis menghitung buy quantity final untuk kebutuhan viewer kerja
- memaksa estimator mengikuti logika sistem yang tidak transparan
- menampilkan terlalu banyak angka teknis yang membuat layar terasa berat

Kalau ada data seperti waste, conversion, minimum order, atau rounding:

- jangan dijadikan pusat pengalaman editing harian
- jangan sampai lebih dominan dari koefisien

## 8. Design Rules For Future Changes

Kalau ada usulan UI baru, cek dengan pertanyaan ini:

1. Apakah ini membuat estimator lebih cepat?
2. Apakah ini mengurangi redundansi?
3. Apakah ini membuat angka lebih mudah dipahami?
4. Apakah ini memindahkan fokus dari koefisien ke otomasi yang tidak perlu?
5. Apakah ini cocok untuk viewer kerja, bukan sekadar meniru Excel?

Kalau jawaban nomor 4 adalah "iya", besar kemungkinan arahnya salah.

## 9. One-Line Summary

**BQ harus sederhana: estimator memilih harga, memasukkan koefisien manual,
lalu sistem menghitung hasilnya dengan tampilan yang ringkas, jelas, dan tidak
redundant.**
