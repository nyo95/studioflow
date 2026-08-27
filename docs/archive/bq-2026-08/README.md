# Arsip BQ — dipindahkan 2026-08-27

Isi folder ini **bukan acuan keadaan sekarang.** Yang berlaku:

- **`PRD-BQ.md`** (root) — spesifikasi BQ
- **`designbq.md`** (root) — arah rasa & UI
- **`HANDOFF-BQ-R3.md`** (root) — urutan kerja untuk agent
- `AGENTS.md` §BQ Contract — 5 aturan keras

Disimpan untuk satu guna: menjawab *"kenapa dulu diputuskan begitu"*.

---

## Kenapa dipindahkan

Tiga siklus refactor (R1, R2, R9) membongkar sebagian besar mesin yang
dijelaskan dokumen-dokumen ini, tapi dokumennya tidak ikut dikoreksi. Akibatnya
setiap handoff mengutip kontrak yang menggambarkan kode yang sudah tidak ada —
dan salah satunya (AT-01) sempat jadi "gerbang" yang tidak menjaga apa pun
selama berbulan.

**Yang membuat sebagian besar isi folder ini usang sekaligus:** BQ berpindah ke
mode koefisien murni. Setiap dokumen yang menyebut **waste berlapis**,
**konversi purchase unit otomatis**, **pembulatan pembelian**, **purchase
summary**, **mode detail/ringkas**, **drift/refresh harga**, `BqMaterialProfile`,
`BqCategoryWaste`, atau `price-drift-service.ts` merujuk mesin yang **sudah
dibongkar**.

---

## Isi

| Berkas | Statusnya |
|---|---|
| `PRD-BQ-v2.md` | PRD BQ 27 Agustus pagi–sore, lima revisi dalam sehari. Digantikan `PRD-BQ.md` yang kompak. Isi teknisnya sama, cuma jauh lebih panjang. |
| `PLAN-BQ-REFACTOR-2026-08-27.md` | Rencana R3 + bukti pembacaan `BQ template tes.xlsx`. Berguna kalau perlu menelusuri **kenapa** hirarki lima lapis dipilih. Sebagian usulannya dibatalkan owner di hari yang sama (field `variantGroup`, kolom `area`, heuristik varian). |
| `PLAN-BQ-SIMPLIFY-2026-08-19.md` | Rencana R1. Sudah dieksekusi. Mengutip AT-01. |
| `HANDOFF-OPENCODE.md` | Handoff R1. **Bagian library-nya salah** — menulis library = pour-and-forget, padahal template L2 tertaut + copy-on-write. Dibetulkan R2. Mengutip AT-01. |
| `HANDOFF-OPENCODE-R2.md` | Handoff R2 (T1–T4). Sudah dieksekusi #67. Mengutip AT-01. |
| `UPSTREAM-BQ-MATERIAL-SOURCE.md` | Menggambarkan BQ sebagai **aplikasi terpisah**. Owner membalikkannya 2026-08-19: BQ di dalam StudioFlow. Bloker §0.3 (*"di mana database material bertempat"*) gugur — material tetap di `master_data`. |

---

## ⚠️ AT-01 — jangan diikuti

Empat berkas di folder ini menyuruh menjaga
*"AT-01 = Rp5.653.559 dikunci `calc.test.ts`"*.

**Angka itu tidak pernah ada di kode.** Dicari di seluruh `src/` dan `prisma/`,
termasuk sebagai `5_653_559` dan `5653559` — nihil. Ia gugur waktu R1/R2 menulis
ulang `calc.ts` ke mode koefisien, karena contoh PRD Bab 7 memang tidak bisa
direproduksi tanpa waste dan konversi.

Berkas-berkas ini **sengaja tidak diedit**. Mengubah catatan handoff lama supaya
cocok dengan keadaan sekarang adalah mengarang riwayat. Yang berlaku `PRD-BQ.md`
§9.
