/** Pure completeness rule shared by the SKU directory row and its tests. */
export function isSkuDataComplete(input: {
  productName: string;
  baseUnit: string;
  categoryCount: number;
}) {
  return input.productName.length > 0 && input.baseUnit.length > 0 && input.categoryCount > 0;
}
