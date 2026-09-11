/**
 * BQ — pengelompok bertingkat: kedalaman, penomoran, dan pembangun pohonnya.
 *
 * ============================================================================
 * DUA LAPIS PENGELOMPOK, SATU LAPIS BERHARGA
 * ============================================================================
 * Aturan owner 2026-08-27 (revisi sore):
 *
 *     Section     ->  Sub Section  DAN  Works
 *     Sub Section ->  Works saja
 *
 * Jadi:
 *
 *   L0  Section       PRELIMINARIES · INTERIOR WORKS · FIXTURES
 *   L1  Sub Section   Floor Works · Ceiling Works · Wall Works   (OPSIONAL)
 *   L2  Works         Flat Ceiling · Screeding — Qty x Harga Satuan
 *   L3  Sub-Works     koefisien x harga, dari master data / library
 *
 * L0 dan L1 sama-sama `BqSection` — sifatnya identik (pengelompok tanpa qty,
 * tanpa harga, punya subtotal), jadi satu tabel yang menunjuk dirinya sendiri.
 * Yang membedakan cuma posisinya di pohon.
 *
 * **Sub Section tidak boleh berisi Sub Section lain.** Versi pagi 2026-08-27
 * sempat mengizinkan lapis pengelompok ketiga ("Shopfront Area" di dalam "Wall
 * Works"); owner mencabutnya sore itu juga. Kasus area kini ditangani dengan
 * menjadikan areanya Sub Section langsung di bawah Section, atau memasukkan
 * namanya ke nama Works.
 *
 * Lapis berharga SELALU Works. Itu yang membuat Floor Works (Works langsung di
 * Sub Section) dan Preliminaries (Works langsung di Section) bisa dicetak
 * dengan aturan yang sama, tanpa penanda cetak-rinci per pekerjaan.
 *
 * ============================================================================
 * KENAPA DIBATASI TIGA
 * ============================================================================
 * Bukan karena teknis — `rollupSectionSubtotals` menangani kedalaman berapa pun
 * dan ada testnya untuk empat lapis. Batasnya ada karena DOKUMENNYA: penomoran
 * BQ kantor cuma punya tiga bentuk (A/B/C, I/II/III, 1/2/3), dan lapis keempat
 * tidak punya bentuk cetak. Karena itu batas ini ditegakkan saat MENULIS
 * (server action), bukan saat membaca — jalur baca harus tetap sanggup
 * menampilkan data lama apa pun bentuknya.
 */

/** L0 Section dan L1 Sub Section. Kedalaman terdalam yang sah berindeks 1. */
export const MAX_SECTION_DEPTH = 2;

/** A, B, C, … Z, AA. Untuk L0 Section. */
export function letterForIndex(i: number): string {
  let n = i;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** I, II, III, … Untuk L1 Sub Section, mengikuti dokumen BQ kantor. */
export function romanForIndex(i: number): string {
  const table: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let n = i + 1;
  let out = "";
  for (const [value, sym] of table) {
    while (n >= value) {
      out += sym;
      n -= value;
    }
  }
  return out;
}

/**
 * Kode otomatis menurut kedalaman — A/B/C, lalu I/II/III, lalu 1/2/3.
 *
 * Diberikan otomatis dan bukan diketik pengguna: membiarkannya bebas membuka
 * pintu ke dua "B" dalam satu dokumen. Pengguna tetap boleh menimpanya lewat
 * `input.code` kalau kantor memang melompati nomor.
 */
export function sectionCodeForDepth(depth: number, siblingIndex: number): string {
  if (depth <= 0) return letterForIndex(siblingIndex);
  if (depth === 1) return romanForIndex(siblingIndex);
  // Tidak lagi bisa dicapai lewat jalur tulis sejak batasnya jadi dua, tapi
  // data lama yang terlanjur lebih dalam tetap butuh kode untuk ditampilkan.
  return String(siblingIndex + 1);
}

/** Label lapis untuk tombol dan pesan. Indeks = kedalaman. */
export const SECTION_DEPTH_LABEL = ["Section", "Sub Section"] as const;

// ---------------------------------------------------------------------------
// Pembangun pohon
// ---------------------------------------------------------------------------

export type SectionLike = { id: string; parentId: string | null };

export type SectionTreeNode<S extends SectionLike, O> = {
  section: S;
  /** Works yang menempel LANGSUNG di pengelompok ini. */
  objects: O[];
  children: SectionTreeNode<S, O>[];
};

/**
 * Susun daftar datar jadi pohon, berapa pun kedalamannya.
 *
 * Sengaja TIDAK memaksakan `MAX_SECTION_DEPTH`: batas itu milik jalur tulis.
 * Data yang terlanjur lebih dalam — hasil impor, atau batas yang dulu berbeda —
 * tetap harus tampil, karena yang tidak tampil tidak bisa diperbaiki pengguna.
 *
 * Pengelompok yang induknya tidak ada di daftar (mis. induknya sudah
 * di-soft-delete) naik jadi akar, bukan menghilang — dengan alasan yang sama.
 */
export function buildSectionTree<S extends SectionLike, O>(
  sections: readonly S[],
  objectsBySection: ReadonlyMap<string, O[]>,
): SectionTreeNode<S, O>[] {
  const known = new Set(sections.map((s) => s.id));

  const nodes = new Map<string, SectionTreeNode<S, O>>();
  for (const section of sections) {
    nodes.set(section.id, {
      section,
      objects: objectsBySection.get(section.id) ?? [],
      children: [],
    });
  }

  const roots: SectionTreeNode<S, O>[] = [];
  for (const section of sections) {
    const node = nodes.get(section.id);
    if (!node) continue;

    const parentId = section.parentId;
    if (parentId === null || !known.has(parentId) || parentId === section.id) {
      roots.push(node);
      continue;
    }
    nodes.get(parentId)?.children.push(node);
  }

  // Data berputar (A induk B, B induk A) tidak akan muncul sebagai akar dan
  // karenanya hilang dari layar. Itu justru yang berbahaya: yang tidak tampil
  // tidak bisa diperbaiki. Sisanya diangkat jadi akar.
  const reachable = new Set<string>();
  const walk = (node: SectionTreeNode<S, O>) => {
    if (reachable.has(node.section.id)) return;
    reachable.add(node.section.id);
    node.children.forEach(walk);
  };
  roots.forEach(walk);
  for (const section of sections) {
    if (reachable.has(section.id)) continue;
    const stranded = nodes.get(section.id);
    if (stranded) {
      roots.push(stranded);
      walk(stranded);
    }
  }

  return roots;
}

/** Jumlah Works di dalam sebuah cabang, TERMASUK yang lewat anak-anaknya. */
export function countWorksDeep<S extends SectionLike, O>(
  node: SectionTreeNode<S, O>,
): number {
  return (
    node.objects.length +
    node.children.reduce((total, child) => total + countWorksDeep(child), 0)
  );
}
