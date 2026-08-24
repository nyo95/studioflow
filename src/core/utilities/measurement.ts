const LENGTH_TO_M: Record<string, number> = { MM: 0.001, CM: 0.01, M: 1 };
const AREA_TO_M2: Record<string, number> = { MM2: 0.000001, CM2: 0.0001, M2: 1 };
const VOLUME_TO_M3: Record<string, number> = { CM3: 0.000001, M3: 1 };

const TABLES = [LENGTH_TO_M, AREA_TO_M2, VOLUME_TO_M3];

function locate(unit: string): { table: Record<string, number>; factor: number } {
  for (const table of TABLES) {
    const f = table[unit];
    if (f !== undefined) return { table, factor: f };
  }
  throw new Error(`UNSUPPORTED_UNIT:${unit}`);
}

export type LengthUnit = keyof typeof LENGTH_TO_M;
export type AreaUnit = keyof typeof AREA_TO_M2;
export type VolumeUnit = keyof typeof VOLUME_TO_M3;

export function convertMeasurement(
  value: number,
  from: string,
  to: string
): number {
  const fromU = from.trim().toUpperCase();
  const toU = to.trim().toUpperCase();
  if (fromU === toU) return value;

  const src = locate(fromU);
  const dst = locate(toU);
  if (src.table !== dst.table) {
    throw new Error(`DIMENSION_MISMATCH:${from}->${to}`);
  }
  return (value * src.factor) / dst.factor;
}

export function calculateArea(
  width: number,
  height: number,
  unit: string
): number {
  const u = unit.trim().toUpperCase();
  const w = convertMeasurement(width, u, "M");
  const h = convertMeasurement(height, u, "M");
  return w * h;
}

export function calculateVolume(
  width: number,
  height: number,
  depth: number,
  unit: string
): number {
  const u = unit.trim().toUpperCase();
  const w = convertMeasurement(width, u, "M");
  const h = convertMeasurement(height, u, "M");
  const d = convertMeasurement(depth, u, "M");
  return w * h * d;
}

export function normalizeMeasurement(value: number, precision = 6): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function applyPurchaseConversion(
  qtyPerUsageUnit: number,
  conversion: number
): number {
  if (!(conversion > 0)) throw new Error("CONVERSION_NOT_POSITIVE");
  return qtyPerUsageUnit / conversion;
}
