# Test integrasi PostgreSQL

Test `getBrandView` dan `getSkusForBrand` memakai PostgreSQL nyata karena raw
SQL, aggregate, filter relasi, soft-delete, multi-schema, dan migrasi tidak
dapat diverifikasi dengan mock Prisma.

## Jalur yang direkomendasikan

```text
npm run test:integration:docker
```

Perintah ini:

1. menyalakan hanya service Compose `db-test` pada `127.0.0.1:55432`;
2. menyimpan data PostgreSQL di `tmpfs`, bukan volume database development;
3. menjalankan seluruh `prisma migrate deploy` ke `studioflow_test`;
4. mengompilasi dan menjalankan test integrasi; lalu
5. menghentikan serta membuang container test walaupun test gagal.

Service `db`, database `studioflow`, dan volume `postgres_data` tidak disentuh.
Service `db-test` juga berada di profile `test`, sehingga `docker compose up`
biasa tidak menyalakannya tanpa diminta.

Untuk menjalankan test murni dan test DB sekaligus:

```text
npm run test:all
```

## Database test yang dikelola sendiri

`npm run test:integration` tidak menyalakan container. Ia mewajibkan
`TEST_DATABASE_URL` yang:

- memakai PostgreSQL;
- mengarah ke `localhost`, `127.0.0.1`, atau `::1`;
- nama databasenya berakhiran `_test`; dan
- berbeda dari `DATABASE_URL` maupun `DIRECT_URL` yang diwarisi proses.

Runner tidak pernah fallback ke `DATABASE_URL`. Migrasi tetap dijalankan ke URL
test sebelum suite dimulai. Pengaman ini sengaja ketat: salah konfigurasi harus
gagal sebelum query pertama, bukan berisiko membersihkan fixture di database
development atau production.

## Pembagian suite

- `npm test`: aturan murni tanpa I/O; cepat dan tidak membutuhkan Docker.
- `npm run test:integration:docker`: kontrak query/migrasi PostgreSQL.
- `npm run test:all`: keduanya, untuk verifikasi sebelum handoff.

Fixture test memakai id/nama unik, menghapus datanya sendiri, dan seluruh
container disposable tetap dibuang oleh runner sebagai lapisan pengaman kedua.
