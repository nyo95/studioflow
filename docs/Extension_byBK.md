PLUGIN: Schedule & Product_Catalog
GENERAL IDEA:
1.	Sentralisasi data yang dibutuhkan:
a.	Product
b.	Brand / Vendor dari product tersebut
c.	Inventory System 
d.	Sample Request
2.	Product memiliki data-data sebagai berikut:
a.	Product berupa “material” dan “fixtures”
b.	Category dan Sub Category. 
Tiap produk memiliki category, dan sub-category. Misalnya category: Paint; sub-category:Texture Paint - category: Lighting; sub-category: Downlight, Spotlight. 
*Mandatory value adalah “category”, sub-category nya optional.
c.	Gambar 
Gambar dengan fitur smart upload: optimize gambar agar ringan, dan fitur utk cropping rasio 1:1 - gambar utuh tetap disimpan, gambar rasio 1:1 jadi thumbnail
d.	Product Information
o	Primary: [SKU] [Nama Produk]
o	Secondary (saat ini disebut intials): [Color] –[Pattern]-[Finishing Type]
o	Tertiary (optional):[Dimensions]-[Smart Tags]
*smart_tags misalnya Link toko online, harga, lain-lain yang bisa di tambah secara on the go per product.
o	Mandatory value berbeda tiap plugin, akan dijelaskan spesifik di plugin yg bersangkutan
o	Apabila value nya tidak diketahui: N/A -> jangan di tulis “N/A” / “reserved” / “pending” / “unknown” -> jangan dimunculkan saja
3.	Brands / Vendor: memiliki informasi antara lain:
a.	Nama Perusahaan (mandatory)
b.	Alamat Perusahaan (optional)
c.	Website Perusahaan (optional)
d.	Contact Person [Nama]-[Nomor CP]; yang mana bisa lebih dari satu CP dengan role yang berbeda-beda. Misalnya: sales, marketing, project sales, dll 
4.	Inventory System
Tracking posisi penyimpanan “sample fisik” di kantor. [Rack_number] dan [Box_number]. Tracking saat user mau ambil barang, kapan, oleh siapa, dan kapan barang itu di kembalikan lagi, tracking barang jika di kirim ke klien.
5.	Sample Request
Kemampuan utk mentracking “request” utk “sample fisik”. Apabila sampel sudah di terima bisa di atur di inventory system.
Schedule:
1.	table FFNE utk product. Focus utama itu harus visual catchy (gambar harus besar, bisa di popup dan di zoom, di download, harus user friendly)
2.	esensi utama nya adalah relasi antara "kode", "product", dan “brands / vendor” 
3.	kolom lain2 yang penting: location & qty (khusus product: fixtures) - ini terikat pada kode
4.	product information dan location / qty terikat pada kode
5.	kode adalah join dari [prefix_product_category + unique increment number]
6.	kode dapat di swap antar category yang sama
7.	Pada table FFNE, tiap kode bisa punya “ALTERNATIF”. 
Contoh KODE: HT-1, opsi A – Roman, Opsi B – Niro Granite; bisa di geser via arrow kecil pada table
8.	Schedule ini terikat per project (snapshot project), tiap proyek punya Schedule yang berbeda-beda dengan kode berbeda-beda, dan product per kode yang berbeda-beda juga. 
9.	Product dapat dinaikan dari snapshot project menuju product_catalog.
10.	Ada fitur utk request naik snapshot per project ini ke product_catalog, saat sudah naik ke product_catalog, value di setiap proyek di override lgsg dari database product_catalog.
11.	Utk keperluan user friendly ui/ux data yg perlu / wajib ditanya secara bertahap adalah: 
a.	Primary; even hanya salah satu dari sku / nama material tidak apa2 – dianggap sudah terpenuhi primary nya; apabila tidak tahu primary nya sama sekali -> baru tanyakan:
b.	Secondary (mandatory, minimal harus ada data intials, minimal “color”), apabila tidak ada, tidak bisa input material nya, apabila data minimal sudah ada -> tanyakan juga:
c.	Tertier (optional / bisa di skip), 
d.	Tanyakan juga jenis kategori nya -> kategori wajib diisi dengan metode creatablesearch, subcategory ditanyakan selanjutnya tapi sifatnya “optional”, kemudian
e.	Tanyakan lagi dari Brand / Vendor mana (hanya tanyakan “nama brand” dengan metode createablesearch.
f.	Apabila sudah tercapai semua data minimal nya -> bisa input ke table FFNE
12.	Utk naik dari snapshot ke product_catalog wajib: gambar, “primary product information”, “brand / vendor”
13.	Apabila sudah di approve dan ada di product_catalog; dilarang merubah / edit details material nya via schedule (hanya data input snapshot proyek yang bisa di rubah via schedule)
14.	Dapat dilakukan “REQUEST SAMPLE” pada product yang ada pada table FFNE (baik sebagai input Tunggal atau pun alternatif)
Product_Catalog
1.	Product Catalog (dulunya material_catalog / global_library)
2.	Tujuan utama membuat katalog material atau fixture utk di gunakan baik pada fitur schedule atau keperluan mencari product tertentu oleh desainer
3.	Halaman spesifik khusus admin / staff yang diberikan akses RBAC utk edit dan approval di halaman ini:
a.	Product Inventory 
b.	Sample Request
c.	Queue: table simple utk appove permintaan naik ke product catalog dari snapshot project
d.	Brand / Vendor Page – utk mengisi dan melengkapi detail informasi tiap vendor atau brand. Disini bisa di lakukan pengecekan manual dan “merging” apabila ada brand yang sama tapi terinput 2 kali atau typo, dlsb. 
Saat melakukan apapun dari product_catalog -> schedule yang terikat harus di update paksa. Tapi apabila di “hapus” maka biarin schedule punya “cache” supaya tidak “null” atau “error”; utk ini perlu dibuatkan mitigasi nya.
4.	Halaman utama semua user adalah halaman katalog itu sendiri.
5.	Katalog dibuat optimize  dan efisien, dengan tampilan layaknya “toko online”. Utk kemudahan user mencari produk tertentu. Modals pop up nya saat di klik jangan editable, tapi informasi read-only yang nyaman di baca user. Apabila “admin / staff yg punya akses rbac kesini” kasi aja titik 3 atau symbol utk edit -> dan buka modals editnya dengan inline edit supaya nyaman dan user friendly; disable edit utk user non admin / staff ber akses.

Secara keseluruhan:
plugin ini saling bekerja sama dengan efektif dan efisien, Dimana product_catalog adalah perpustakaan global nya, Dimana produk-produk di dalam “schedule” nya adalah buku-buku nya. Buku nya bisa hanya ada dalam schedule -> snapshot per proyek; ataupun bisa di “globalkan” -> ke product_catalog.
Pertimbangkan penggunaan “creatablesearch” utk tiap2 input dan modals.
Ingat utk schedule -> harus catch dengan main focal nya adalah visualnya; utk product_catalog -> harus enak di lihat dan di pakai seperti saat sedang lihat-lihat toko online
