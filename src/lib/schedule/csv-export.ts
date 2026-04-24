import { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
import { ScheduleEntryWithOptions } from "./csv-types";

export function exportScheduleToCsv(
  entries: ScheduleEntryWithOptions[]
): string {
  const headers = [
    "Code",
    "Category",
    "Product Name",
    "Brand",
    "SKU",
    "Color",
    "Finishing",
    "Location",
    "Qty",
    "Unit",
    "Price",
    "Total",
    "Contact",
    "Image URL"
  ];

  const rows = entries.map(entry => {
    const finalOption = entry.options.find((o) => o.is_final);
    const snapshot = finalOption?.data_snapshot as unknown as ScheduleSnapshot | null;
    
    return [
      `${entry.schedule_prefix}-${entry.schedule_increment}`,
      entry.schedule_category,
      snapshot?.catalog_product_name || "",
      snapshot?.catalog_brand || "",
      snapshot?.specs?.catalog_sku || "",
      snapshot?.specs?.catalog_color || "",
      snapshot?.specs?.catalog_finishing || "",
      entry.schedule_location || "",
      entry.schedule_qty?.toString() || "0",
      entry.schedule_unit || "",
      snapshot?.catalog_price?.toString() || "0",
      ((entry.schedule_qty || 0) * (snapshot?.catalog_price || 0)).toString(),
      snapshot?.catalog_contact_name || "",
      snapshot?.catalog_image_url || ""
    ].map(v => `"${v.replace(/"/g, '""')}"`).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
