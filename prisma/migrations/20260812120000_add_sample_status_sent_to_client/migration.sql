-- AlterEnum: Tambah nilai SENT_TO_CLIENT ke enum SampleStatus
-- Alasan: UI (SampleLibraryClient.tsx) sudah menggunakan nilai ini di 5 lokasi,
-- tapi schema sebelumnya hanya punya AVAILABLE, BORROWED, LOST, DISCARDED.
-- Ini bug runtime — query status ini mengembalikan hasil kosong.

ALTER TYPE "master_data"."SampleStatus" ADD VALUE 'SENT_TO_CLIENT' BEFORE 'LOST';
