import { roundHalfUp } from "./round";

export interface CurrencyDefinition {
  code: string;
  symbol: string;
  decimalPlaces: number;
  decimalSeparator: string;
  groupSeparator: string;
}

export const CURRENCIES: Record<string, CurrencyDefinition> = {
  IDR: { code: "IDR", symbol: "Rp", decimalPlaces: 0, decimalSeparator: ",", groupSeparator: "." },
  SGD: { code: "SGD", symbol: "S$", decimalPlaces: 2, decimalSeparator: ".", groupSeparator: "," },
  USD: { code: "USD", symbol: "$", decimalPlaces: 2, decimalSeparator: ".", groupSeparator: "," },
};

export type CurrencyCode = keyof typeof CURRENCIES;

export function resolveCurrency(code: string): CurrencyDefinition {
  const def = CURRENCIES[code.toUpperCase()];
  if (!def) throw new Error(`UNKNOWN_CURRENCY:${code}`);
  return def;
}

export function roundMoney(amount: number, currency: string): number {
  const dp = resolveCurrency(currency).decimalPlaces;
  const factor = 10 ** dp;
  return roundHalfUp(amount * factor) / factor;
}

function groupDigits(digits: string, separator: string): string {
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    const remaining = digits.length - i;
    out += digits[i];
    if (remaining > 1 && (remaining - 1) % 3 === 0) out += separator;
  }
  return out;
}

export function formatMoney(amount: number, currency: string): string {
  const def = resolveCurrency(currency);
  const rounded = roundMoney(amount, currency);
  const negative = rounded < 0;
  const scaled = Math.round(Math.abs(rounded) * 10 ** def.decimalPlaces);
  const intPart = Math.floor(scaled / 10 ** def.decimalPlaces).toString();
  const fracPart = (scaled % 10 ** def.decimalPlaces)
    .toString()
    .padStart(def.decimalPlaces, "0");
  let body = groupDigits(intPart, def.groupSeparator);
  if (def.decimalPlaces > 0) body += def.decimalSeparator + fracPart;
  return `${negative ? "-" : ""}${def.symbol}${body}`;
}

export function parseMoney(input: string, currency: string): number | null {
  const def = resolveCurrency(currency);
  let s = input.trim();
  if (s.length === 0) return null;

  s = s.replace(new RegExp(`^${def.symbol.replace("$", "\\$")}\\s*`, "i"), "");
  s = s.replace(new RegExp(`\\s*${def.code}\\s*$`, "i"), "");
  s = s.replace(/[^0-9.,-]/g, "");
  if (s.length === 0) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let decimalSeparator = "";
  if (lastDot !== -1 && lastComma !== -1) {
    decimalSeparator = lastDot > lastComma ? "." : ",";
  } else if (lastDot !== -1) {
    decimalSeparator = /^\d{1,2}(\.\d{1,2})?$/.test(s) ? "." : "";
  } else if (lastComma !== -1) {
    decimalSeparator = /^\d{1,2}(,\d{1,2})?$/.test(s) ? "," : "";
  }

  let normalized = s;
  if (decimalSeparator) {
    const [intPart, decPart] = decimalSeparator === "," ? s.split(",") : splitOnLast(s, ".");
    normalized = `${intPart.replace(/[.,]/g, "")}.${decPart || ""}`;
  } else {
    normalized = s.replace(/[.,]/g, "");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return roundMoney(parsed, currency);
}

function splitOnLast(value: string, sep: string): [string, string] {
  const idx = value.lastIndexOf(sep);
  return [value.slice(0, idx), value.slice(idx + 1)];
}
