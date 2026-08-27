/**
 * BQ — subtotal pengelompok (L0 Section / L1 Sub Section / L2 Sub Section).
 *
 * ============================================================================
 * KENAPA INI FUNGSI MURNI DAN BUKAN LOOP DI DALAM SERVICE
 * ============================================================================
 * Versi sebelumnya menaikkan subtotal dengan SATU KALI loop datar di
 * `services/breakdown-service.ts`:
 *
 *     for (const s of sections) {
 *       if (!s.parent_id) continue;
 *       rollup.set(s.parent_id, rollup.get(s.parent_id) + rollup.get(s.id));
 *     }
 *
 * Itu benar hanya selama pohonnya dua lapis. Urutan barisnya `sort_order`, dan
 * induk hampir selalu dibuat lebih dulu daripada anaknya — jadi induk sudah
 * "lewat" sebelum anaknya sempat menerima sumbangan dari cucunya:
 *
 *     sections: B -> III -> Shopfront        direct: Shopfront = 100
 *       B          induk null            -> lewat
 *       III        induk B   -> B   = 0 + rollup[III](=0) = 0   <- B dikunci
 *       Shopfront  induk III -> III = 0 + 100            = 100
 *
 *     hasil:  III = 100 benar    B = 0 SALAH (seharusnya 100)
 *
 * `SUBTOTAL B` jadi nol pada Section yang seluruh Works-nya duduk di dalam
 * L2 — persis bentuk "Wall Works -> Shopfront Area" di dokumen kantor. Bug itu
 * dorman selama schema efektif dua lapis, dan menjadi nyata pada baris pertama
 * hirarki L2 (BQ-31).
 *
 * Yang benar adalah post-order: subtotal sebuah pengelompok baru boleh
 * ditetapkan SESUDAH seluruh anaknya selesai dihitung. Karena itu ia ditulis
 * sebagai rekursi bermemo di sini, terpisah dari service, supaya bisa diuji
 * tanpa database.
 *
 * Berkas ini tidak tahu apa-apa soal Prisma maupun mata uang — ia cuma
 * menjumlahkan angka pada sebuah pohon.
 */

/** Bentuk minimum yang dibutuhkan: identitas dan induknya. */
export type SectionRollupNode = {
  id: string;
  parentId: string | null;
};

/**
 * Subtotal setiap pengelompok = total Works yang menempel LANGSUNG padanya,
 * ditambah subtotal seluruh pengelompok anaknya, sampai ke dasar.
 *
 * @param sections      Seluruh pengelompok satu project. Urutannya bebas —
 *                      hasilnya tidak bergantung `sort_order`, dan itu memang
 *                      intinya.
 * @param directTotals  Total Works yang menempel langsung, per `section.id`.
 *                      Yang tidak ada di peta ini dianggap nol.
 * @returns             Subtotal per `section.id`, untuk SEMUA section yang
 *                      diberikan.
 */
export function rollupSectionSubtotals(
  sections: readonly SectionRollupNode[],
  directTotals: ReadonlyMap<string, number>,
): Map<string, number> {
  const known = new Set(sections.map((s) => s.id));

  // Induk -> daftar anak. Section yang induknya tidak ada di daftar (mis.
  // induknya sudah di-soft-delete) diperlakukan sebagai akar: subtotalnya tetap
  // dihitung, ia cuma tidak naik ke mana-mana. Membiarkannya menunjuk induk
  // hantu akan menaruh angka di kunci yang tidak pernah dibaca siapa pun.
  const childrenOf = new Map<string, string[]>();
  for (const s of sections) {
    if (s.parentId === null || !known.has(s.parentId)) continue;
    const siblings = childrenOf.get(s.parentId);
    if (siblings) siblings.push(s.id);
    else childrenOf.set(s.parentId, [s.id]);
  }

  const settled = new Map<string, number>();
  const visiting = new Set<string>();

  const resolve = (id: string): number => {
    const cached = settled.get(id);
    if (cached !== undefined) return cached;

    // Penjaga siklus. Kedalaman sudah dibatasi di server (BQ-31), jadi ini
    // seharusnya tidak pernah kena — tapi data rusak tidak boleh berujung
    // rekursi tak berhingga di jalur baca. Cabang yang berputar dihitung nol,
    // bukan melempar: satu baris cacat tidak sepantasnya membuat seluruh
    // breakdown gagal dimuat.
    if (visiting.has(id)) return 0;
    visiting.add(id);

    let total = directTotals.get(id) ?? 0;
    for (const childId of childrenOf.get(id) ?? []) {
      total += resolve(childId);
    }

    visiting.delete(id);
    settled.set(id, total);
    return total;
  };

  for (const s of sections) resolve(s.id);
  return settled;
}
