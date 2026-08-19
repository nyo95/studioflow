/**
 * MASTER DATA — category slug and path rules, with no I/O.
 *
 * Free of `server-only` and Prisma so `npm test` can reach it
 * (roadmap §Perkakas).
 */

/**
 * Canonical slug generator, delegated to the shared module.
 *
 * MUST stay byte-identical to `slugifyTag()` in `library-service.ts`. The two
 * resolve the same `Category` rows from different call sites, and a slug that
 * differs by one character creates a duplicate category rather than finding the
 * existing one — silently, because both writes succeed.
 */
import { slugify } from "../lib/slug";
export const categorySlug = slugify;

/**
 * "bahan-baku/plywood" — the denormalised ancestry used for subtree queries.
 *
 * Two levels is all Excel asks for, but the format is deliberately open-ended:
 * a third level would append rather than need a new column. `LIKE 'bahan-baku/%'`
 * keeps working either way.
 */
export function buildCategoryPath(
  parentPath: string | null | undefined,
  name: string
): string {
  const own = categorySlug(name);
  const parent = parentPath?.trim();
  return parent ? `${parent}/${own}` : own;
}

/** Splits "MEP > Lighting" or "MEP/Lighting" into parent and child. */
export function splitCategoryInput(value: string): {
  parent: string | null;
  child: string;
} {
  const parts = value
    .split(/[>/]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { parent: null, child: "" };
  if (parts.length === 1) return { parent: null, child: parts[0] };
  // More than two levels: everything before the last is treated as the parent
  // chain's tail. Excel only ever has two, so this is a guard rather than a
  // feature — it keeps a stray "A > B > C" from silently losing "B".
  return { parent: parts[parts.length - 2], child: parts[parts.length - 1] };
}

/**
 * ============================================================================
 * THE TOP LEVEL OF THE TREE — keputusan owner 2026-08-11
 * ============================================================================
 * Satu pertanyaan per tingkat, dan mencampurnya adalah cara pohon kategori
 * membusuk:
 *
 *   Tingkat 1 menjawab: PERANNYA APA di pekerjaan?   (Finishing, Hardware, MEP)
 *   Tingkat 2 menjawab: BARANGNYA APA?               (HPL, Engsel, Lampu)
 *
 * "Bahan Baku" dan "Finishing" sejajar — keduanya jawaban pertanyaan pertama.
 * Itu sebabnya Excel Table 2 bisa menulis `Material`=HPL / `Category`=HPL tanpa
 * kontradiksi: dua kolom itu memalsukan pohon karena file datar tidak bisa
 * bersarang. Di sini SKU menunjuk daunnya saja; induknya dibaca dari `path`.
 *
 * TIDAK di-seed. Baris `Category` lahir saat pertama dipakai lewat
 * `resolveCategoryPath`; daftar ini hanya yang DITAWARKAN form. Jadi mengubah
 * daftar ini tidak meninggalkan baris yatim yang harus dibersihkan.
 *
 * Kalau nanti muncul sumbu yang benar-benar lain (Interior/Eksterior,
 * fire-rated), itu `CategoryKind` baru — BUKAN induk kedua di pohon ini.
 * `SkuCategory` sudah many-to-many, jadi tidak butuh migrasi.
 */
export const PRODUCT_LEVEL1 = [
  "Bahan Baku",
  "Finishing",
  "Hardware",
  "MEP",
  "Batu & Keramik",
  "Kaca & Cermin",
  "Kain & Upholstery",
  "Perekat & Kimia",
  "Furniture & FF&E",
  "Lain-lain",
] as const;

export const WORK_LEVEL1 = [
  "Sipil & Struktur",
  "Furniture / Custom",
  "Finishing",
  "MEP",
  "Kaca & Aluminium",
  "Batu & Keramik",
  "Lain-lain",
] as const;

/**
 * Daun yang sudah kita kenal -> induknya di tingkat 1.
 *
 * Dipakai untuk memfilekan tag lama yang diketik bebas (katalog, SketchUp) yang
 * tidak pernah menyebut induknya. SENGAJA TIDAK LENGKAP: tag yang tidak ada di
 * sini tetap di akar, tidak ditebak. Menebak induk adalah cara sebuah
 * pengelompokan berhenti berarti apa-apa — alasan yang sama yang membuat
 * `Qty` dibiarkan tak ditafsirkan (X12) dan backfill kategori Party menolak
 * mengarang.
 */
const PRODUCT_PARENT_BY_LEAF: Record<string, string> = {
  // Bahan Baku — substrat dan rangka
  plywood: "Bahan Baku",
  multiplek: "Bahan Baku",
  blockboard: "Bahan Baku",
  mdf: "Bahan Baku",
  "particle-board": "Bahan Baku",
  particleboard: "Bahan Baku",
  "kayu-solid": "Bahan Baku",
  "solid-wood": "Bahan Baku",
  "hollow-galvanis": "Bahan Baku",
  gypsum: "Bahan Baku",

  // Finishing — lapisan permukaan
  hpl: "Finishing",
  veneer: "Finishing",
  tacosheet: "Finishing",
  pvc: "Finishing",
  spc: "Finishing",
  duco: "Finishing",
  cat: "Finishing",
  edging: "Finishing",
  melamine: "Finishing",
  wallpaper: "Finishing",

  // Hardware
  engsel: "Hardware",
  "rel-laci": "Hardware",
  handle: "Hardware",
  kunci: "Hardware",
  hidrolis: "Hardware",

  // MEP
  lampu: "MEP",
  lighting: "MEP",
  saklar: "MEP",
  "stop-kontak": "MEP",
  kabel: "MEP",
  sanitair: "MEP",
  kran: "MEP",

  // Batu & Keramik
  granit: "Batu & Keramik",
  marmer: "Batu & Keramik",
  keramik: "Batu & Keramik",
  "homogeneous-tile": "Batu & Keramik",
  "solid-surface": "Batu & Keramik",

  // Kaca & Cermin
  kaca: "Kaca & Cermin",
  tempered: "Kaca & Cermin",
  cermin: "Kaca & Cermin",

  // Kain & Upholstery
  fabric: "Kain & Upholstery",
  kain: "Kain & Upholstery",
  kulit: "Kain & Upholstery",
  busa: "Kain & Upholstery",
  webbing: "Kain & Upholstery",

  // Perekat & Kimia
  lem: "Perekat & Kimia",
  sealant: "Perekat & Kimia",
  hardener: "Perekat & Kimia",
  thinner: "Perekat & Kimia",
};

/**
 * Induk tingkat 1 untuk sebuah tag produk, atau `null` kalau kita tidak tahu.
 *
 * Sebuah tag yang namanya sama dengan tingkat 1 ("Finishing") adalah tingkat 1
 * itu sendiri, bukan anaknya — kalau tidak, "Finishing" akan difilekan di bawah
 * dirinya sendiri.
 */
export function productParentFor(tag: string): string | null {
  const slug = categorySlug(tag);
  if (!slug) return null;
  if (PRODUCT_LEVEL1.some((l) => categorySlug(l) === slug)) return null;
  return PRODUCT_PARENT_BY_LEAF[slug] ?? null;
}

/**
 * Membuang tag yang merupakan INDUK dari tag lain di daftar yang sama.
 *
 * Aturan 1 dari desain: simpan daunnya saja. Orang yang mengetik
 * "HPL, Finishing" bermaksud satu hal, bukan dua — dan menyimpan keduanya
 * mengembalikan persis dua-kolom Excel yang baru saja kita gabungkan. Urutan
 * dipertahankan, karena index 0 adalah kategori primer.
 */
export function dropAncestorTags(tags: string[]): string[] {
  const parents = new Set(
    tags.map((t) => productParentFor(t)).filter((p): p is string => p !== null)
  );
  const parentSlugs = new Set([...parents].map(categorySlug));
  const kept = tags.filter((t) => !parentSlugs.has(categorySlug(t)));
  // Kalau SEMUA tag ternyata induk ("Finishing" sendirian), tidak ada yang
  // tersisa untuk difilekan. Daftar aslinya lebih baik daripada kosong.
  return kept.length > 0 ? kept : tags;
}
