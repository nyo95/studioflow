Baca `AGENTS.md` dulu — itu kontrak utama, berlaku untuk Claude maupun Codex
(peran, kontrak domain Master Data, aturan bahasa, dll). Berkas ini cuma
menambahkan hal yang spesifik-Claude: bagaimana Claude sebaiknya baca
`changelog.md` supaya tidak boros token, karena berkasnya sudah 350KB+.

## Kapan berkas ini dipakai

Setiap sesi Claude (Cowork maupun Claude Code lokal) yang bekerja di repo
ini — baik untuk review hasil Codex, lanjut kerja dokumen, atau ditanya
"cek changelog" oleh owner.

## Owner tidak lagi lapor verbal — `changelog.md` satu-satunya sumber

Keputusan owner 2026-08-19: kalau owner bilang "codex sudah selesai, cek
changelog" (atau versi pendek lain) — itu SATU-SATUNYA konteks yang dikasih.
Jangan minta owner jelasin manual apa yang berubah; baca sendiri dari
`changelog.md` (kontrak wajib lapor semua agent ada di `AGENTS.md` §👑 aturan
8). Owner juga menolak scheduled/polling otomatis (2026-08-19) — trigger
tetap manual dari owner, bukan Claude yang inisiatif cek berkala.

## Prosedur cek-in hemat token (checkpoint-based)

Jangan `Read`/`cat` seluruh `changelog.md`. Urutannya:

1. `grep -n "^## \[Unreleased\]" changelog.md | head -8` — murah, cuma judul
   entri. Entri paling atas = paling baru.
2. Bandingkan judul entri teratas terhadap checkpoint terakhir yang Claude
   simpan (di sesi Cowork: project memory `project_checkin_procedure.md`; di
   sesi lain tanpa memory persisten: tanya owner "terakhir saya cek sampai
   entri apa?" atau simpan sendiri di scratch file lokal).
3. **Sama** → belum ada progres baru sejak terakhir dicek. Bilang itu ke
   owner, berhenti — jangan baca lebih jauh.
4. **Beda** → ada progres baru. `sed -n '<start>,<end>p' changelog.md` baca
   HANYA rentang baris dari entri checkpoint lama sampai entri baru — bukan
   seluruh file.
5. Verifikasi klaim tiap entri baru terhadap kode asli (grep/baca file yang
   disebut) sebelum dipercaya — roadmap/changelog project ini pernah salah
   klaim "selesai" padahal belum, jadi ini bukan formalitas.
6. Silang-cek `roadmap.md`: item yang diklaim selesai di changelog seharusnya
   ikut tercentang `[x]`. Kalau tidak — itu temuan, laporkan.
7. Kalau ada `HANDOFF-CODEX.md` aktif untuk siklus berjalan, cek juga apakah
   progres baru itu masih di dalam cakupan §3 batch-nya, atau sudah keluar
   jalur (item yang di-hold ikut dikerjakan tanpa izin, dst).
8. Laporkan ke owner ringkas: apa yang selesai, terverifikasi atau tidak, ada
   penyimpangan atau tidak, sisa kerjaan apa.
9. Update checkpoint (project memory atau tempat Claude menyimpannya) ke
   judul entri teratas yang baru saja direview.

## Graphify

Dipakai bareng Codex, aturannya sudah di `AGENTS.md` §graphify — tidak
diulang di sini. Satu tambahan sisi-Claude: kalau progres kode yang
ditemukan di langkah 4 signifikan (banyak file baru/struktur berubah) dan
belum ter-commit (jadi belum ke-capture git hook), pertimbangkan
`graphify update .` manual sebelum lapor ke owner supaya `graphify query`
berikutnya (dari Claude maupun Codex) tidak menjawab dari graph yang basi.

## Peran

Default: orchestrator, spec-writer, reviewer — **bukan** penulis kode
produksi. Tiga pengecualian ada di `AGENTS.md` §🧑‍⚖️ Pembagian Peran, tidak
diulang di sini supaya tidak ada dua sumber kebenaran yang bisa selisih.
