import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";

/**
 * Set nilai yang dianggap placeholder — tidak merepresentasikan spesifikasi nyata.
 * Baris yang brand DAN product-name keduanya placeholder tidak masuk reuse pool
 * (spec_search_key = null).
 *
 * Sumber: display-utils.ts PLACEHOLDERS + nilai placeholder manual dari
 * addManualCatalogItemAction (sketchup-actions.ts:1752-1753).
 * Disalin di sini, bukan diimpor, agar file ini tetap bebas dependensi
 * (diperlukan backfill script yang mengkompilasinya tanpa modul lain).
 */
const PLACEHOLDER_VALS = new Set([
  "N/A", "UNKNOWN", "PENDING", "-", "—", "[RESERVED]", "GENERIC", "DRAFT",
  "MANUAL ITEM", "CUSTOM", "MANUAL",
]);

function isPlaceholderVal(val: string | null | undefined): boolean {
  if (!val || val.trim() === "") return true;
  return PLACEHOLDER_VALS.has(val.trim().toUpperCase());
}

/**
 * Derives ProjectScheduleOption.spec_* dari snapshot yang sudah divalidasi.
 *
 * SATU-SATUNYA sumber logika derivasi — jangan duplikat di tempat lain.
 * Dipanggil oleh schedule-option-writer.ts (satu-satunya jalur tulis snapshot).
 *
 * Urutan search key: [kategori, brand, product, color, finishing].
 * Kalau brand DAN product keduanya placeholder → spec_search_key = null
 * (baris tidak masuk reuse pool).
 *
 * spec_brand_id hanya terisi ketika snapshot membawa FK Brand nyata.
 */
export function deriveScheduleSpecFields(snapshot: ScheduleSnapshot) {
  const category = snapshot.schedule_category?.trim() || null;
  const productName = snapshot.catalog_product_name?.trim() || null;
  const color = snapshot.specs?.catalog_color?.trim() || null;
  const finishing = snapshot.specs?.catalog_finishing?.trim() || null;
  const brandText = snapshot.catalog_brand?.trim() || "";

  // Baris placeholder tidak masuk reuse pool
  const isPlaceholder = isPlaceholderVal(brandText) && isPlaceholderVal(productName);

  const searchKey = isPlaceholder
    ? null
    : [category, brandText, productName, color, finishing]
        .filter((part): part is string => !!part && part.length > 0)
        .map((part) => part.toLowerCase())
        .join("::");

  return {
    spec_brand_id: snapshot.catalog_vendor_id ?? null,
    spec_product_name: productName,
    spec_color: color,
    spec_finishing: finishing,
    spec_search_key: searchKey || null,
  };
}
