export type UnitDimension =
  | "COUNT"
  | "LENGTH"
  | "AREA"
  | "VOLUME"
  | "TIME"
  | "LUMP_SUM";

export interface UnitDefinition {
  symbol: string;
  label: string;
  aliases: string[];
  dimension: UnitDimension;
  precision: number;
}

export const UNIT_DEFINITIONS: UnitDefinition[] = [
  { symbol: "PCS", label: "Piece", aliases: ["pc", "pcs.", "buah", "unit", "pieces"], dimension: "COUNT", precision: 0 },
  { symbol: "SET", label: "Set", aliases: ["sets", "paket"], dimension: "COUNT", precision: 0 },
  { symbol: "SHEET", label: "Sheet", aliases: ["sheet.", "sheets", "lembar", "lembaran", "sht", "sh"], dimension: "COUNT", precision: 0 },
  { symbol: "ROLL", label: "Roll", aliases: ["rolls", "rol", "gulungan"], dimension: "COUNT", precision: 0 },
  { symbol: "M", label: "Meter", aliases: ["mtr", "meter", "meters", "m’", "m'", "mp"], dimension: "LENGTH", precision: 3 },
  { symbol: "CM", label: "Centimeter", aliases: ["cms", "centimeter"], dimension: "LENGTH", precision: 1 },
  { symbol: "MM", label: "Millimeter", aliases: ["mms", "milimeter"], dimension: "LENGTH", precision: 0 },
  { symbol: "M2", label: "Square meter", aliases: ["sqm", "m²", "m^2", "m2.", "sq.m", "sq m", "meter persegi"], dimension: "AREA", precision: 3 },
  { symbol: "M3", label: "Cubic meter", aliases: ["cbm", "m³", "m^3", "meter kubik"], dimension: "VOLUME", precision: 3 },
  { symbol: "LS", label: "Lump sum", aliases: ["lumpsum", "lump sum", "lot"], dimension: "LUMP_SUM", precision: 0 },
  { symbol: "HOUR", label: "Hour", aliases: ["hr", "hrs", "jam", "hours"], dimension: "TIME", precision: 2 },
  { symbol: "DAY", label: "Day", aliases: ["days", "hari", "org-day", "org/day", "man-day"], dimension: "TIME", precision: 0 },
];

const ALIAS_TO_UNIT = new Map<string, UnitDefinition>();

for (const def of UNIT_DEFINITIONS) {
  ALIAS_TO_UNIT.set(def.symbol.toLowerCase(), def);
  for (const alias of def.aliases) {
    ALIAS_TO_UNIT.set(alias.toLowerCase(), def);
  }
}

export function normalizeUnit(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (key.length === 0) return null;
  return ALIAS_TO_UNIT.get(key)?.symbol ?? value.trim().toUpperCase();
}

export function resolveUnit(
  value: string | null | undefined
): UnitDefinition | null {
  if (!value) return null;
  return ALIAS_TO_UNIT.get(value.trim().toLowerCase()) ?? null;
}

export function isKnownUnit(value: string | null | undefined): boolean {
  if (!value) return false;
  return ALIAS_TO_UNIT.has(value.trim().toLowerCase());
}

export function unitDimension(value: string | null | undefined): UnitDimension | null {
  return resolveUnit(value)?.dimension ?? null;
}
