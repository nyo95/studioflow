export type BqMaterialReadinessReason =
  | "SKU_NOT_FOUND"
  | "SKU_DELETED"
  | "SKU_DISCONTINUED"
  | "NO_PRICE"
  | "PRICE_UNIT_MISSING"
  | "PURCHASE_UNIT_MISSING"
  | "CONVERSION_INVALID"
  | "UNIT_MISMATCH";

export type BqMaterialReadiness =
  | { ok: true }
  | { ok: false; reason: BqMaterialReadinessReason; detail: string };

export type BqMaterialReadinessInput = {
  skuExists: boolean;
  skuDeleted: boolean;
  skuStatus: string | null;
  price: { unit: string } | null;
  purchaseUnit: string | null;
  conversion: number | null;
};

export function evaluateBqMaterialReadiness(
  input: BqMaterialReadinessInput
): BqMaterialReadiness {
  if (!input.skuExists) {
    return { ok: false, reason: "SKU_NOT_FOUND", detail: "This SKU no longer exists." };
  }
  if (input.skuDeleted) {
    return { ok: false, reason: "SKU_DELETED", detail: "This SKU is deleted in Master Data." };
  }
  if (input.skuStatus === "DISCONTINUED") {
    return { ok: false, reason: "SKU_DISCONTINUED", detail: "This SKU is discontinued in Master Data." };
  }
  if (!input.price) {
    return { ok: false, reason: "NO_PRICE", detail: "No current price in Master Data. Ask Master Data staff to record one." };
  }
  if (!input.price.unit.trim()) {
    return { ok: false, reason: "PRICE_UNIT_MISSING", detail: "The current price has no unit in Master Data." };
  }
  if (!input.purchaseUnit?.trim()) {
    return { ok: false, reason: "PURCHASE_UNIT_MISSING", detail: "This SKU has no purchase unit in Master Data." };
  }
  if (input.conversion === null || input.conversion <= 0) {
    return { ok: false, reason: "CONVERSION_INVALID", detail: "This SKU needs a conversion greater than zero in Master Data." };
  }
  if (input.price.unit.trim() !== input.purchaseUnit.trim()) {
    return {
      ok: false,
      reason: "UNIT_MISMATCH",
      detail: `This SKU is set to buy per "${input.purchaseUnit}", but the current price is quoted per "${input.price.unit}". Fix whichever one is wrong before using it.`,
    };
  }
  return { ok: true };
}