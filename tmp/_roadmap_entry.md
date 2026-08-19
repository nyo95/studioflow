# ═══ MASTER DATA — Audit skema 2026-08-19 (menunggu keputusan owner) ═══

Dari `AUDIT-SKEMA-MASTERDATA-2026-08-19.md` — cek soliditas skema
`master_data` diminta owner, terpisah dari audit aplikasi 2026-08-18. Kelima
invariant DB kontrak (`AGENTS.md` §2) diverifikasi solid, nol drift. Dua
temuan baru di bawah **butuh keputusan owner dulu** sebelum Codex/Claude
eksekusi apa pun — jangan diputuskan sendiri.

- [ ] **SK1 · `WorkPrice` — kolom versioning (`valid_from`/`valid_to`/
      `is_current`) tidak pernah dipakai jalur tulis manapun.**
      `updateServicePriceAction` dan `updateMaterialLaborPriceAction`
      (`pricing-actions.ts`) menimpa baris `WorkPrice` di tempat saat edit —
      beda dari `SkuPrice` yang kontrak §3.3 wajibkan supersede
      (`is_current:false` + baris baru). `WorkPrice.code` juga `@unique`
      global, yang secara struktural mencegah pola supersede ala `SkuPrice`
      (dua baris tak mungkin berbagi `code`). Riwayat tarif jasa yang
      diedit sekarang cuma ada di `MasterDataAudit.changes` (JSON diff),
      bukan baris ber-struktur yang bisa di-query.
      **Butuh keputusan owner:** (a) kalau memang sengaja satu-baris-per-code
      → beri komentar "TIDAK DIPAKAI" di ketiga kolom itu (pola sama seperti
      `qty`), perbaikan dokumentasi murni, aman tanpa migrasi; atau (b) kalau
      riwayat tarif jasa dibutuhkan → bangun `recordWorkPrice()`/
      `closeCurrentWorkPrice()` setara `SkuPrice` **dan** lepas `code` dari
      `@unique` global — 🔒 perubahan skema, butuh migrasi.
      **Berkas:** `prisma/schema.prisma` (model `WorkPrice`),
      `src/subapps/master-data/actions/pricing-actions.ts`.

- [ ] **SK2 · `PartyContact.brand_id` tidak divalidasi terhadap kepemilikan/
      relasi brand↔party (P3, aman ditunda).** `createPartyContactAction`
      dan `updatePartyContactAction` (`party-actions.ts`) menerima `brand_id`
      mentah tanpa cek brand itu benar-benar dimiliki/dipasok party yang
      sama (`Brand.owner_party_id` atau `BrandSupplier`). UI kemungkinan
      besar sudah membatasi pilihan brand di dropdown, jadi risikonya rendah
      hari ini — tapi tidak ada penjaga server-side. Perbaikan aplikasi
      murni (satu `findFirst` sebelum create/update), tidak butuh migrasi
      dan tidak butuh keputusan owner untuk *bagaimana* menambalnya — hanya
      perlu prioritas kapan dikerjakan.
      **Berkas:** `src/subapps/master-data/actions/party-actions.ts`.

**Catatan risiko rendah/dorman (bukan bug aktif, tidak masuk roadmap
eksekusi):** `Category(kind,slug)` unique tanpa partial-index live-row —
sama seperti B2 sebelum ditambal, tapi belum ada action delete Category jadi
belum bisa dipicu; `Sku.brand_id→Brand onDelete:Restrict` belum pernah
teruji karena belum ada action delete Brand. Detail lengkap kedua catatan ini
di `AUDIT-SKEMA-MASTERDATA-2026-08-19.md` §3 dan §5 — cukup diingat, tidak
perlu item roadmap terpisah selama tidak ada fitur delete Category/Brand.

---

