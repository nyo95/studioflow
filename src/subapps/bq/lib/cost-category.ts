import type { BqCostCategory } from "../types/breakdown";

const COST_CATEGORY_LABEL: Record<BqCostCategory, string> = {
  MATERIAL: "Material",
  UPAH: "Upah",
  ALAT: "Alat",
  BIAYA_UMUM: "Biaya Umum",
  TRANSPORT_AKOMODASI: "Transport",
};

/**
 * Label laporan untuk satu baris L4.
 *
 * Borongan tetap memakai enum UPAH; `hasMaterial` adalah dimensi presentasi
 * yang membedakannya dari upah murni tanpa menambah kategori keenam.
 */
export function costCategoryLabel(
  category: BqCostCategory,
  defaultFor: BqCostCategory,
  hasMaterial = false,
): string | null {
  if (hasMaterial) return "Material + Upah";
  return category === defaultFor ? null : COST_CATEGORY_LABEL[category];
}
