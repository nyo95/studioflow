import { ScheduleCsvImportRow } from "./csv-types";
import { ActionError } from "@/lib/error-types";

type CsvRecord = string[];

function normalizeCell(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeHeader(value: string | undefined): string {
  return normalizeCell(value).replace(/^\uFEFF/, "").toLowerCase();
}

function parseContactString(contact: string | null | undefined): {
  name?: string;
  phone?: string;
  email?: string;
} {
  if (!contact) return {};

  const parts = contact.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
  const result: { name?: string; phone?: string; email?: string } = {};

  for (const part of parts) {
    if (part.includes("@")) {
      result.email = part;
    } else if (/^[\d\s\-+()]+$/.test(part)) {
      result.phone = part;
    } else {
      result.name = part;
    }
  }

  return result;
}

function parseNumber(value: string | undefined): number | undefined {
  const normalized = normalizeCell(value);
  if (!normalized) return undefined;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCsvRecords(csvContent: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let currentRecord: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];

    if (char === "\"") {
      if (inQuotes && csvContent[i + 1] === "\"") {
        currentField += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRecord.push(currentField);
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && csvContent[i + 1] === "\n") {
        i++;
      }
      currentRecord.push(currentField);
      records.push(currentRecord);
      currentRecord = [];
      currentField = "";
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField);
    records.push(currentRecord);
  }

  return records
    .map((record) => record.map((field) => field.trim()))
    .filter((record) => record.some((field) => field.length > 0));
}

function toObject(record: CsvRecord, headers: string[]): Record<string, string> {
  const row: Record<string, string> = {};

  headers.forEach((header, index) => {
    row[header] = normalizeCell(record[index]);
  });

  return row;
}

function isGSheetsHeader(record: CsvRecord, section: "ARCHITECTURAL" | "FFE"): boolean {
  const headers = record.map(normalizeHeader);
  if (headers[0] !== "code") return false;

  const required = section === "ARCHITECTURAL"
    ? ["product category", "ex", "type"]
    : ["ex", "type"];

  return required.every((header) => headers.includes(header));
}

function parseGSheetsRow(row: Record<string, string>, section: "ARCHITECTURAL" | "FFE"): ScheduleCsvImportRow | null {
  const code = row.code;
  if (!code) return null;

  const contactInfo = parseContactString(row.contact);
  const productCategory = section === "ARCHITECTURAL"
    ? row["product category"] || row.product_category || undefined
    : undefined;

  return {
    code,
    category: productCategory,
    productCategory,
    ex: row.ex || undefined,
    type: row.type || undefined,
    initialsType: row["initials type"] || row.initials_type || undefined,
    imageUrl: row.image || undefined,
    location: row.location || undefined,
    contactName: contactInfo.name,
    contactPhone: contactInfo.phone,
    contactEmail: contactInfo.email,
    schedule_qty: parseNumber(row.qty),
    schedule_unit: row.unit || undefined,
    sourcePayload: row,
  };
}

export function parseGSheetsProductCsv(
  csvContent: string,
  section: "ARCHITECTURAL" | "FFE"
): ScheduleCsvImportRow[] {
  const records = parseCsvRecords(csvContent);
  const headerIndex = records.findIndex((record) => isGSheetsHeader(record, section));

  if (headerIndex === -1) {
    throw new ActionError(
      `Malformed Google Sheets CSV header for ${section.toLowerCase()} schedule`,
      "VALIDATION_FAILED"
    );
  }

  const headers = records[headerIndex].map(normalizeHeader);
  const rows: ScheduleCsvImportRow[] = [];

  for (let i = headerIndex + 1; i < records.length; i++) {
    const rowObject = toObject(records[i], headers);
    const parsed = parseGSheetsRow(rowObject, section);
    if (parsed) {
      rows.push(parsed);
    }
  }

  return rows;
}

export function parseSketchUpCsv(csvContent: string): ScheduleCsvImportRow[] {
  void csvContent;
  throw new ActionError(
    "SketchUp CSV import is temporarily disabled while core extensions are stabilized.",
    "FEATURE_DISABLED"
  );
}
