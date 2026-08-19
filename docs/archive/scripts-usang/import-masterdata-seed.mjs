#!/usr/bin/env node

/**
 * Import reviewed Master Data seed files.
 *
 * Validation only:
 *   node scripts/import-masterdata-seed.mjs --validate-only
 *
 * Database dry-run:
 *   node scripts/import-masterdata-seed.mjs --dry-run \
 *     --actor-email user@example.com
 *
 * Apply to localhost only:
 *   node scripts/import-masterdata-seed.mjs --apply \
 *     --actor-email user@example.com \
 *     --backup D:\outside-project\studioflow_before_seed.dump \
 *     --backup-sha256 <SHA256> \
 *     --pg-restore-container studioflow-db-1 \
 *     --ack-review
 *
 * Canonical domain: Vendor -> Material -> Sample.
 * Incomplete evidence is imported into MaterialCandidate/SampleCandidate and
 * remains unusable until explicit, validated promotion.
 * Pending and Approved Materials are usable. Rejected means takedown from new
 * usage and never causes existing immutable project snapshots to be rewritten.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultStagingDir = path.join(root, "docs", "masterdata-seed");
const capableRoles = new Set(["ADMIN", "OWNER", "STAFF", "CURATOR"]);
const validLinkKinds = new Set([
  "WEBSITE",
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "YOUTUBE",
  "LINKEDIN",
  "WHATSAPP",
  "MARKETPLACE",
  "CATALOG",
  "OTHER",
]);
const validSampleStatuses = new Set([
  "AVAILABLE",
  "BORROWED",
  "SENT_TO_CLIENT",
]);
const placeholders = new Set([
  "",
  "-",
  "—",
  "N/A",
  "NA",
  "UNKNOWN",
  "DRAFT",
  "PENDING",
  "NULL",
  "NONE",
]);

const expectedHeaders = {
  vendors: [
    "vendor_key",
    "vendor_name",
    "legal_name",
    "address",
    "notes",
    "source_sheet",
    "source_rows",
    "source_checksum",
  ],
  contacts: [
    "vendor_key",
    "contact_person",
    "contact_role",
    "phone_number",
    "email",
    "source_sheet",
    "source_row",
  ],
  links: [
    "vendor_key",
    "kind",
    "url",
    "label",
    "source_sheet",
    "source_rows",
    "source_checksum",
  ],
  materials: [
    "vendor_key",
    "brand",
    "category_tags",
    "product_name",
    "sku",
    "color",
    "motif",
    "finishing",
    "dimension_p",
    "dimension_l",
    "dimension_t",
    "dimension_unit",
    "reference_url",
    "folder_url",
    "image_url",
    "price_before_discount",
    "price_after_discount",
    "price_unit",
    "source_sheet",
    "source_row",
    "source_checksum",
  ],
  samples: [
    "sample_key",
    "vendor_key",
    "brand",
    "sku",
    "rack_number",
    "box_number",
    "quantity",
    "status",
    "current_borrower_name",
    "borrowed_at",
    "due_at",
    "notes",
    "source_sheet",
    "source_row",
    "source_checksum",
  ],
  materialCandidates: [
    "candidate_key",
    "source_context",
    "source_sheet",
    "source_rows",
    "vendor_key_candidate",
    "vendor_key_confirmed",
    "brand_candidate",
    "brand_confirmed",
    "category_tags_candidate",
    "category_tags_confirmed",
    "source_product_or_type",
    "product_name_confirmed",
    "sku_confirmed",
    "motif_candidate",
    "reference_url_candidate",
    "folder_url_candidate",
    "price_before_discount",
    "price_after_discount",
    "price_unit",
    "material_status",
    "bq_status",
    "blocker_reasons",
    "decision_notes",
  ],
  sampleCandidates: [
    "sample_candidate_key",
    "source_sheet",
    "source_row",
    "source_no",
    "source_category",
    "source_brand",
    "source_type",
    "source_motif",
    "vendor_key_candidate",
    "vendor_key_confirmed",
    "brand_confirmed",
    "sku_confirmed",
    "rack_number",
    "box_number",
    "quantity",
    "status_candidate",
    "current_borrower_name",
    "notes",
    "sample_status",
    "blocker_reasons",
    "decision_notes",
  ],
  review: [
    "severity",
    "entity_type",
    "source_sheet",
    "source_row",
    "source_key",
    "issue_code",
    "issue_detail",
    "suggested_action",
  ],
};

function fail(message) {
  throw new Error(message);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function compact(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalized(value) {
  return compact(value).toLocaleLowerCase("id-ID");
}

function nullable(value) {
  const result = compact(value);
  return result || null;
}

function isPlaceholder(value) {
  const normalizedValue = compact(value).toUpperCase();
  return (
    placeholders.has(normalizedValue) ||
    normalizedValue.startsWith("LEGACY-")
  );
}

function redactConnectionString(value) {
  return value.replace(/(:\/\/[^:]+:)[^@]*(@)/, "$1***$2");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

async function sha256File(filePath) {
  return sha256(await fs.readFile(filePath));
}

function deterministicUuid(namespace, key) {
  const bytes = crypto
    .createHash("sha256")
    .update(`${namespace}\u001F${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function parseCsv(text, label) {
  const input = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) fail(`${label}: CSV berakhir di dalam quoted field.`);
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  while (
    rows.length > 1 &&
    rows.at(-1).every((value) => String(value).trim() === "")
  ) {
    rows.pop();
  }
  if (rows.length === 0) fail(`${label}: CSV kosong.`);

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, ""));
  if (new Set(headers).size !== headers.length) {
    fail(`${label}: header duplikat.`);
  }

  const records = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      fail(
        `${label}: row ${index + 2} memiliki ${values.length} kolom; ` +
          `seharusnya ${headers.length}.`,
      );
    }
    return Object.fromEntries(
      headers.map((header, column) => [header, values[column]]),
    );
  });
  return { headers, records };
}

function assertHeaders(actual, expected, label) {
  if (
    actual.length !== expected.length ||
    actual.some((header, index) => header !== expected[index])
  ) {
    fail(
      `${label}: header tidak sesuai.\nActual: ${JSON.stringify(actual)}\n` +
        `Expected: ${JSON.stringify(expected)}`,
    );
  }
}

function parsePositiveInteger(value, label) {
  if (!/^[1-9]\d*$/.test(String(value).trim())) {
    fail(`${label}: harus bilangan bulat positif.`);
  }
  return Number(value);
}

function parseOptionalNumber(value, label) {
  const raw = compact(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    fail(`${label}: harus angka non-negatif.`);
  }
  return parsed;
}

function parseOptionalDate(value, label) {
  const raw = compact(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw)) {
    fail(`${label}: gunakan ISO date YYYY-MM-DD atau ISO datetime.`);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) fail(`${label}: tanggal tidak valid.`);
  return parsed;
}

function parseTags(value, label) {
  const seen = new Set();
  const tags = [];
  for (const token of String(value ?? "").split("|")) {
    const tag = compact(token);
    if (!tag) continue;
    const key = normalized(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  if (tags.length === 0) fail(`${label}: minimal satu category tag.`);
  return tags;
}

function parseDelimitedList(value, separator) {
  const seen = new Set();
  return compact(value)
    .split(separator)
    .map((item) => compact(item))
    .filter((item) => {
      const key = normalized(item);
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function canonicalUrlKey(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const parameter of [...url.searchParams.keys()]) {
      if (
        parameter === "fbclid" ||
        parameter === "hl" ||
        parameter === "source" ||
        parameter === "st" ||
        parameter.startsWith("utm_")
      ) {
        url.searchParams.delete(parameter);
      }
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return value;
  }
}

function requireHttpUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label}: URL tidak valid.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    fail(`${label}: hanya http/https yang diizinkan.`);
  }
  return value;
}

async function readCsv(stagingDir, fileName, key) {
  const parsed = parseCsv(
    await fs.readFile(path.join(stagingDir, fileName), "utf8"),
    fileName,
  );
  assertHeaders(parsed.headers, expectedHeaders[key], fileName);
  return parsed.records;
}

async function loadStaging(stagingDir) {
  const [
    vendors,
    contacts,
    links,
    materials,
    samples,
    materialCandidates,
    sampleCandidates,
    review,
    summaryText,
  ] = await Promise.all([
    readCsv(stagingDir, "01_vendors.csv", "vendors"),
    readCsv(stagingDir, "02_vendor_contacts.csv", "contacts"),
    readCsv(stagingDir, "03_vendor_links.csv", "links"),
    readCsv(stagingDir, "04_materials.csv", "materials"),
    readCsv(stagingDir, "05_physical_samples.csv", "samples"),
    readCsv(stagingDir, "06_material_candidates.csv", "materialCandidates"),
    readCsv(stagingDir, "07_sample_candidates.csv", "sampleCandidates"),
    readCsv(stagingDir, "08_import_review.csv", "review"),
    fs.readFile(path.join(stagingDir, "BUILD_SUMMARY.json"), "utf8"),
  ]);

  let summary;
  try {
    summary = JSON.parse(summaryText);
  } catch {
    fail("BUILD_SUMMARY.json bukan JSON valid.");
  }

  const sourceChecksum = compact(summary.source_checksum).toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(sourceChecksum)) {
    fail("BUILD_SUMMARY.json source_checksum tidak valid.");
  }

  const payloadCounts = summary.seed_payload ?? {};
  for (const [field, rows] of [
    ["vendors", vendors],
    ["vendor_contacts", contacts],
    ["vendor_links", links],
    ["materials", materials],
    ["physical_samples", samples],
  ]) {
    if (payloadCounts[field] !== rows.length) {
      fail(
        `BUILD_SUMMARY count ${field}=${payloadCounts[field]} tidak cocok ` +
          `dengan CSV=${rows.length}.`,
      );
    }
  }
  if (summary.review_queue?.material_candidates !== materialCandidates.length) {
    fail("Count material_candidates tidak cocok dengan CSV.");
  }
  if (summary.review_queue?.sample_candidates !== sampleCandidates.length) {
    fail("Count sample_candidates tidak cocok dengan CSV.");
  }

  const reviewCounts = review.reduce(
    (counts, row) => {
      counts[row.severity] = (counts[row.severity] ?? 0) + 1;
      return counts;
    },
    {},
  );
  for (const [field, severity] of [
    ["blockers", "BLOCKER"],
    ["warnings", "WARN"],
    ["information", "INFO"],
  ]) {
    if ((summary.review_queue?.[field] ?? 0) !== (reviewCounts[severity] ?? 0)) {
      fail(`Count review ${field} tidak cocok dengan 08_import_review.csv.`);
    }
  }

  return {
    stagingDir,
    sourceChecksum,
    summary,
    vendors,
    contacts,
    links,
    materials,
    samples,
    materialCandidates,
    sampleCandidates,
    review,
  };
}

function validateStaging(staging) {
  const issues = { blockers: [], warnings: [] };
  const vendorKeys = new Set();
  const vendorNames = new Set();

  for (const [index, vendor] of staging.vendors.entries()) {
    const label = `01_vendors.csv row ${index + 2}`;
    const vendorKey = compact(vendor.vendor_key);
    const vendorName = compact(vendor.vendor_name);
    if (!vendorKey) issues.blockers.push(`${label}: vendor_key kosong.`);
    if (!vendorName || isPlaceholder(vendorName)) {
      issues.blockers.push(`${label}: vendor_name tidak valid.`);
    }
    if (vendorKeys.has(vendorKey)) {
      issues.blockers.push(`${label}: vendor_key duplikat ${vendorKey}.`);
    }
    if (vendorNames.has(normalized(vendorName))) {
      issues.blockers.push(`${label}: vendor_name duplikat ${vendorName}.`);
    }
    if (
      compact(vendor.source_checksum).toUpperCase() !== staging.sourceChecksum
    ) {
      issues.blockers.push(`${label}: source_checksum tidak cocok.`);
    }
    vendorKeys.add(vendorKey);
    vendorNames.add(normalized(vendorName));
  }

  const contactKeys = new Set();
  for (const [index, contact] of staging.contacts.entries()) {
    const label = `02_vendor_contacts.csv row ${index + 2}`;
    if (!vendorKeys.has(compact(contact.vendor_key))) {
      issues.blockers.push(`${label}: vendor_key tidak ditemukan.`);
    }
    if (!compact(contact.contact_person)) {
      issues.blockers.push(`${label}: contact_person kosong.`);
    }
    const key = [
      compact(contact.vendor_key),
      normalized(contact.contact_person),
      normalized(contact.contact_role),
      compact(contact.phone_number),
      normalized(contact.email),
    ].join("\u001F");
    if (contactKeys.has(key)) {
      issues.blockers.push(`${label}: contact duplikat.`);
    }
    contactKeys.add(key);
  }

  const linkKeys = new Set();
  for (const [index, link] of staging.links.entries()) {
    const label = `03_vendor_links.csv row ${index + 2}`;
    if (!vendorKeys.has(compact(link.vendor_key))) {
      issues.blockers.push(`${label}: vendor_key tidak ditemukan.`);
    }
    if (!validLinkKinds.has(compact(link.kind))) {
      issues.blockers.push(`${label}: kind tidak valid.`);
    }
    try {
      requireHttpUrl(link.url, label);
    } catch (error) {
      issues.blockers.push(error.message);
    }
    if (compact(link.source_checksum).toUpperCase() !== staging.sourceChecksum) {
      issues.blockers.push(`${label}: source_checksum tidak cocok.`);
    }
    const key = `${compact(link.vendor_key)}\u001F${canonicalUrlKey(link.url)}`;
    if (linkKeys.has(key)) issues.blockers.push(`${label}: URL duplikat.`);
    linkKeys.add(key);
  }

  const materialKeys = new Set();
  const normalizedMaterials = [];
  for (const [index, material] of staging.materials.entries()) {
    const label = `04_materials.csv row ${index + 2}`;
    if (!vendorKeys.has(compact(material.vendor_key))) {
      issues.blockers.push(`${label}: vendor_key tidak ditemukan.`);
    }
    for (const [field, value] of [
      ["brand", material.brand],
      ["product_name", material.product_name],
      ["sku", material.sku],
    ]) {
      if (!compact(value) || isPlaceholder(value)) {
        issues.blockers.push(`${label}: ${field} wajib dan bukan placeholder.`);
      }
    }

    let tags = [];
    try {
      tags = parseTags(material.category_tags, label);
    } catch (error) {
      issues.blockers.push(error.message);
    }

    let before = null;
    let after = null;
    try {
      before = parseOptionalNumber(
        material.price_before_discount,
        `${label} price_before_discount`,
      );
      after = parseOptionalNumber(
        material.price_after_discount,
        `${label} price_after_discount`,
      );
    } catch (error) {
      issues.blockers.push(error.message);
    }
    const priceUnit = nullable(material.price_unit);
    const priceParts = [before !== null, after !== null, Boolean(priceUnit)];
    if (priceParts.some(Boolean) && !priceParts.every(Boolean)) {
      issues.warnings.push(
        `${label}: BQ_NOT_READY — harga harus before + after + unit.`,
      );
    }
    if (before !== null && after !== null && after > before) {
      issues.blockers.push(
        `${label}: price_after_discount lebih besar dari before_discount.`,
      );
    }

    if (
      compact(material.source_checksum).toUpperCase() !== staging.sourceChecksum
    ) {
      issues.blockers.push(`${label}: source_checksum tidak cocok.`);
    }

    const key = [
      compact(material.vendor_key),
      normalized(material.brand),
      normalized(material.sku),
    ].join("\u001F");
    if (materialKeys.has(key)) {
      issues.blockers.push(
        `${label}: kombinasi vendor + brand + sku duplikat.`,
      );
    }
    materialKeys.add(key);
    normalizedMaterials.push({
      ...material,
      _tags: tags,
      _priceBefore: before,
      _priceAfter: after,
      _priceUnit: priceUnit,
    });
  }

  const sampleKeys = new Set();
  const normalizedSamples = [];
  for (const [index, sample] of staging.samples.entries()) {
    const label = `05_physical_samples.csv row ${index + 2}`;
    const sampleKey = compact(sample.sample_key);
    if (!sampleKey || sampleKeys.has(sampleKey)) {
      issues.blockers.push(`${label}: sample_key kosong atau duplikat.`);
    }
    sampleKeys.add(sampleKey);

    if (!vendorKeys.has(compact(sample.vendor_key))) {
      issues.blockers.push(`${label}: vendor_key tidak ditemukan.`);
    }
    for (const [field, value] of [
      ["brand", sample.brand],
      ["sku", sample.sku],
      ["rack_number", sample.rack_number],
      ["box_number", sample.box_number],
    ]) {
      if (!compact(value) || isPlaceholder(value)) {
        issues.blockers.push(`${label}: ${field} wajib.`);
      }
    }
    const materialKey = [
      compact(sample.vendor_key),
      normalized(sample.brand),
      normalized(sample.sku),
    ].join("\u001F");
    if (!materialKeys.has(materialKey)) {
      issues.blockers.push(
        `${label}: Sample tidak match tepat ke Material payload.`,
      );
    }
    if (!validSampleStatuses.has(compact(sample.status))) {
      issues.blockers.push(`${label}: status tidak valid.`);
    }
    if (
      ["BORROWED", "SENT_TO_CLIENT"].includes(compact(sample.status)) &&
      !compact(sample.current_borrower_name)
    ) {
      issues.blockers.push(
        `${label}: borrowed/sent wajib memiliki borrower/client.`,
      );
    }

    let quantity = null;
    let borrowedAt = null;
    let dueAt = null;
    try {
      quantity = parsePositiveInteger(sample.quantity, `${label} quantity`);
      borrowedAt = parseOptionalDate(
        sample.borrowed_at,
        `${label} borrowed_at`,
      );
      dueAt = parseOptionalDate(sample.due_at, `${label} due_at`);
    } catch (error) {
      issues.blockers.push(error.message);
    }
    if (compact(sample.source_checksum).toUpperCase() !== staging.sourceChecksum) {
      issues.blockers.push(`${label}: source_checksum tidak cocok.`);
    }
    normalizedSamples.push({
      ...sample,
      _quantity: quantity,
      _borrowedAt: borrowedAt,
      _dueAt: dueAt,
    });
  }

  const materialCandidateKeys = new Set();
  const normalizedMaterialCandidates = [];
  for (const [index, candidate] of staging.materialCandidates.entries()) {
    const label = `06_material_candidates.csv row ${index + 2}`;
    const candidateKey = compact(candidate.candidate_key);
    if (!candidateKey || materialCandidateKeys.has(candidateKey)) {
      issues.blockers.push(`${label}: candidate_key kosong atau duplikat.`);
    }
    materialCandidateKeys.add(candidateKey);

    if (!compact(candidate.source_context) || !compact(candidate.source_sheet)) {
      issues.blockers.push(`${label}: konteks/sheet sumber wajib diisi.`);
    }

    let before = null;
    let after = null;
    try {
      before = parseOptionalNumber(
        candidate.price_before_discount,
        `${label} price_before_discount`,
      );
      after = parseOptionalNumber(
        candidate.price_after_discount,
        `${label} price_after_discount`,
      );
    } catch (error) {
      issues.blockers.push(error.message);
    }
    if (before !== null && after !== null && after > before) {
      issues.blockers.push(
        `${label}: price_after_discount lebih besar dari before_discount.`,
      );
    }

    normalizedMaterialCandidates.push({
      ...candidate,
      _candidateTags: parseDelimitedList(
        candidate.category_tags_candidate,
        "|",
      ),
      _confirmedTags: parseDelimitedList(
        candidate.category_tags_confirmed,
        "|",
      ),
      _priceBefore: before,
      _priceAfter: after,
      _priceUnit: nullable(candidate.price_unit),
      _blockerReasons: parseDelimitedList(candidate.blocker_reasons, ";"),
    });
  }

  const sampleCandidateKeys = new Set();
  const normalizedSampleCandidates = [];
  for (const [index, candidate] of staging.sampleCandidates.entries()) {
    const label = `07_sample_candidates.csv row ${index + 2}`;
    const candidateKey = compact(candidate.sample_candidate_key);
    if (!candidateKey || sampleCandidateKeys.has(candidateKey)) {
      issues.blockers.push(
        `${label}: sample_candidate_key kosong atau duplikat.`,
      );
    }
    sampleCandidateKeys.add(candidateKey);

    let sourceRow = null;
    let quantity = null;
    try {
      sourceRow = parsePositiveInteger(candidate.source_row, `${label} source_row`);
      quantity = parsePositiveInteger(candidate.quantity, `${label} quantity`);
    } catch (error) {
      issues.blockers.push(error.message);
    }
    if (!compact(candidate.rack_number) || !compact(candidate.box_number)) {
      issues.blockers.push(`${label}: rack_number dan box_number wajib.`);
    }
    const status = validSampleStatuses.has(compact(candidate.status_candidate))
      ? compact(candidate.status_candidate)
      : "AVAILABLE";
    const materialCandidateMatch = compact(candidate.decision_notes).match(
      /Material candidate:\s*([A-Za-z0-9_-]+)/i,
    );
    normalizedSampleCandidates.push({
      ...candidate,
      _sourceRow: sourceRow,
      _quantity: quantity,
      _status: status,
      _blockerReasons: parseDelimitedList(candidate.blocker_reasons, ";"),
      _materialCandidateKey: materialCandidateMatch?.[1] ?? null,
    });
  }

  return {
    issues,
    vendors: staging.vendors,
    contacts: staging.contacts,
    links: staging.links,
    materials: normalizedMaterials,
    samples: normalizedSamples,
    materialCandidates: normalizedMaterialCandidates,
    sampleCandidates: normalizedSampleCandidates,
  };
}

async function resolveActor(prisma, actorEmail) {
  if (!actorEmail) fail("--actor-email wajib diisi dengan User nyata.");
  const actor = await prisma.user.findUnique({
    where: { email: actorEmail },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!actor) fail(`Actor ${actorEmail} tidak ditemukan.`);
  if (!capableRoles.has(actor.role)) {
    fail(`Role ${actor.role} tidak boleh mengelola Master Data.`);
  }
  return actor;
}

function contactNaturalKey(vendorId, contact) {
  return [
    vendorId,
    normalized(contact.contact_person),
    normalized(contact.contact_role),
    compact(contact.phone_number),
    normalized(contact.email),
  ].join("\u001F");
}

function linkNaturalKey(vendorId, link) {
  return `${vendorId}\u001F${canonicalUrlKey(link.url)}`;
}

function materialNaturalKey(vendorId, brand, sku) {
  return [vendorId, normalized(brand), normalized(sku)].join("\u001F");
}

async function buildDatabasePlan(prisma, staging, normalizedStaging) {
  const [
    existingVendors,
    existingContacts,
    existingLinks,
    existingMaterials,
    existingSamples,
    existingMaterialCandidates,
    existingSampleCandidates,
    counts,
  ] = await Promise.all([
    prisma.brand.findMany(),
    prisma.brandContact.findMany(),
    prisma.brandLink.findMany(),
    prisma.sku.findMany(),
    prisma.sample.findMany(),
    prisma.materialCandidate.findMany(),
    prisma.sampleCandidate.findMany(),
    Promise.all([
      prisma.brand.count(),
      prisma.brandContact.count(),
      prisma.brandLink.count(),
      prisma.sku.count(),
      prisma.sample.count(),
      prisma.sampleMovementLog.count(),
      prisma.materialCandidate.count(),
      prisma.sampleCandidate.count(),
      prisma.auditLog.count(),
      prisma.project.count(),
      prisma.projectScheduleEntry.count(),
      prisma.projectScheduleOption.count(),
    ]),
  ]);

  const blockers = [];
  const warnings = [...normalizedStaging.issues.warnings];
  const existingVendorsByName = new Map();
  for (const vendor of existingVendors) {
    const key = normalized(vendor.brand_name);
    const rows = existingVendorsByName.get(key) ?? [];
    rows.push(vendor);
    existingVendorsByName.set(key, rows);
  }

  const vendorPlans = [];
  const vendorIdByKey = new Map();
  for (const staged of normalizedStaging.vendors) {
    const matches = existingVendorsByName.get(normalized(staged.vendor_name)) ?? [];
    if (matches.length > 1) {
      blockers.push(
        `Vendor ${staged.vendor_name}: lebih dari satu case-insensitive match di database.`,
      );
      continue;
    }
    if (matches[0]?.deleted_at) {
      blockers.push(
        `Vendor ${staged.vendor_name}: match database sudah soft-deleted; tidak direvive otomatis.`,
      );
      continue;
    }

    if (!matches[0]) {
      const id = deterministicUuid(
        "studioflow-masterdata-vendor",
        `${staging.sourceChecksum}:${staged.vendor_key}`,
      );
      vendorIdByKey.set(staged.vendor_key, id);
      vendorPlans.push({ action: "create", id, staged, update: null });
      continue;
    }

    const existing = matches[0];
    vendorIdByKey.set(staged.vendor_key, existing.id);
    const update = {};
    for (const [field, stagedValue] of [
      ["legal_name", nullable(staged.legal_name)],
      ["address", nullable(staged.address)],
      ["notes", nullable(staged.notes)],
    ]) {
      const existingValue = nullable(existing[field]);
      if (!existingValue && stagedValue) {
        update[field] = stagedValue;
      } else if (
        existingValue &&
        stagedValue &&
        normalized(existingValue) !== normalized(stagedValue)
      ) {
        warnings.push(
          `Vendor ${staged.vendor_name}: ${field} existing dipertahankan; ` +
            `staging berbeda (${stagedValue}).`,
        );
      }
    }
    vendorPlans.push({
      action: Object.keys(update).length > 0 ? "enrich" : "reuse",
      id: existing.id,
      staged,
      update: Object.keys(update).length > 0 ? update : null,
    });
  }

  const existingContactKeys = new Set(
    existingContacts.map((contact) =>
      contactNaturalKey(contact.brand_id, contact),
    ),
  );
  const contactPlans = [];
  for (const staged of normalizedStaging.contacts) {
    const vendorId = vendorIdByKey.get(staged.vendor_key);
    if (!vendorId) {
      blockers.push(
        `Contact ${staged.contact_person}: Vendor ${staged.vendor_key} unresolved.`,
      );
      continue;
    }
    const key = contactNaturalKey(vendorId, staged);
    if (existingContactKeys.has(key)) {
      contactPlans.push({ action: "reuse", staged, vendorId, id: null });
      continue;
    }
    const id = deterministicUuid(
      "studioflow-masterdata-contact",
      `${staging.sourceChecksum}:${staged.vendor_key}:${key}`,
    );
    existingContactKeys.add(key);
    contactPlans.push({ action: "create", staged, vendorId, id });
  }

  const existingLinkKeys = new Set(
    existingLinks.map((link) => linkNaturalKey(link.brand_id, link)),
  );
  const linkPlans = [];
  for (const staged of normalizedStaging.links) {
    const vendorId = vendorIdByKey.get(staged.vendor_key);
    if (!vendorId) {
      blockers.push(
        `Link ${staged.url}: Vendor ${staged.vendor_key} unresolved.`,
      );
      continue;
    }
    const key = linkNaturalKey(vendorId, staged);
    if (existingLinkKeys.has(key)) {
      linkPlans.push({ action: "reuse", staged, vendorId, id: null });
      continue;
    }
    const id = deterministicUuid(
      "studioflow-masterdata-link",
      `${staging.sourceChecksum}:${staged.vendor_key}:${key}`,
    );
    existingLinkKeys.add(key);
    linkPlans.push({ action: "create", staged, vendorId, id });
  }

  const existingMaterialsByKey = new Map();
  for (const material of existingMaterials) {
    const key = materialNaturalKey(
      material.brand_id,
      material.catalog_brand,
      material.catalog_sku,
    );
    const rows = existingMaterialsByKey.get(key) ?? [];
    rows.push(material);
    existingMaterialsByKey.set(key, rows);
  }

  const materialPlans = [];
  const materialIdByKey = new Map();
  for (const staged of normalizedStaging.materials) {
    const vendorId = vendorIdByKey.get(staged.vendor_key);
    if (!vendorId) {
      blockers.push(
        `Material ${staged.brand}/${staged.sku}: Vendor unresolved.`,
      );
      continue;
    }
    const key = materialNaturalKey(vendorId, staged.brand, staged.sku);
    const matches = existingMaterialsByKey.get(key) ?? [];
    const activeMatches = matches.filter((item) => !item.deleted_at);
    if (activeMatches.length > 1) {
      blockers.push(
        `Material ${staged.brand}/${staged.sku}: duplicate case-insensitive di database.`,
      );
      continue;
    }
    if (activeMatches.length === 0 && matches.length > 0) {
      blockers.push(
        `Material ${staged.brand}/${staged.sku}: match soft-deleted; tidak direvive otomatis.`,
      );
      continue;
    }
    if (activeMatches[0]) {
      materialIdByKey.set(key, activeMatches[0].id);
      materialPlans.push({
        action: "reuse",
        staged,
        vendorId,
        id: activeMatches[0].id,
      });
      continue;
    }

    const id = deterministicUuid(
      "studioflow-masterdata-material",
      `${staging.sourceChecksum}:${staged.vendor_key}:${normalized(
        staged.brand,
      )}:${normalized(staged.sku)}`,
    );
    materialIdByKey.set(key, id);
    materialPlans.push({ action: "create", staged, vendorId, id });
  }

  const existingSamplesById = new Map(
    existingSamples.map((sample) => [sample.id, sample]),
  );
  const samplePlans = [];
  for (const staged of normalizedStaging.samples) {
    const vendorId = vendorIdByKey.get(staged.vendor_key);
    const materialId = vendorId
      ? materialIdByKey.get(
          materialNaturalKey(vendorId, staged.brand, staged.sku),
        )
      : null;
    if (!materialId) {
      blockers.push(
        `Sample ${staged.sample_key}: Material Vendor + Brand + SKU unresolved.`,
      );
      continue;
    }
    const id = deterministicUuid(
      "studioflow-masterdata-sample",
      `${staging.sourceChecksum}:${staged.sample_key}`,
    );
    const existing = existingSamplesById.get(id);
    if (existing) {
      const same =
        existing.sku_id === materialId &&
        existing.catalog_rack_number === staged.rack_number &&
        existing.catalog_box_number === staged.box_number &&
        existing.quantity === staged._quantity &&
        existing.catalog_status === staged.status &&
        nullable(existing.current_borrower_name) ===
          nullable(staged.current_borrower_name);
      if (!same) {
        blockers.push(
          `Sample ${staged.sample_key}: deterministic id sudah ada dengan payload berbeda.`,
        );
        continue;
      }
      samplePlans.push({
        action: "reuse",
        staged,
        materialId,
        id,
      });
      continue;
    }
    samplePlans.push({ action: "create", staged, materialId, id });
  }

  const existingMaterialCandidatesByKey = new Map(
    existingMaterialCandidates.map((candidate) => [
      candidate.candidate_key,
      candidate,
    ]),
  );
  const materialCandidateIdByKey = new Map();
  const materialCandidatePlans = [];
  for (const staged of normalizedStaging.materialCandidates) {
    const existing = existingMaterialCandidatesByKey.get(staged.candidate_key);
    if (existing) {
      materialCandidateIdByKey.set(staged.candidate_key, existing.id);
      if (existing.source_checksum !== staging.sourceChecksum) {
        blockers.push(
          `MaterialCandidate ${staged.candidate_key}: checksum sumber berubah; ` +
            "review manual sebelum import ulang.",
        );
        continue;
      }
      materialCandidatePlans.push({
        action: "reuse",
        staged,
        id: existing.id,
        candidateVendorId: existing.candidate_vendor_id,
        confirmedVendorId: existing.confirmed_vendor_id,
      });
      continue;
    }

    const candidateVendorId =
      vendorIdByKey.get(compact(staged.vendor_key_candidate)) ?? null;
    const confirmedVendorKey = compact(staged.vendor_key_confirmed);
    const confirmedVendorId = confirmedVendorKey
      ? vendorIdByKey.get(confirmedVendorKey)
      : null;
    if (confirmedVendorKey && !confirmedVendorId) {
      blockers.push(
        `MaterialCandidate ${staged.candidate_key}: vendor_key_confirmed ` +
          `${confirmedVendorKey} tidak ditemukan.`,
      );
      continue;
    }
    const id = deterministicUuid(
      "studioflow-masterdata-material-candidate",
      `${staging.sourceChecksum}:${staged.candidate_key}`,
    );
    materialCandidateIdByKey.set(staged.candidate_key, id);
    materialCandidatePlans.push({
      action: "create",
      staged,
      id,
      candidateVendorId,
      confirmedVendorId,
    });
  }

  const existingSampleCandidatesByKey = new Map(
    existingSampleCandidates.map((candidate) => [
      candidate.sample_candidate_key,
      candidate,
    ]),
  );
  const sampleCandidatePlans = [];
  for (const staged of normalizedStaging.sampleCandidates) {
    const existing = existingSampleCandidatesByKey.get(
      staged.sample_candidate_key,
    );
    if (existing) {
      if (existing.source_checksum !== staging.sourceChecksum) {
        blockers.push(
          `SampleCandidate ${staged.sample_candidate_key}: checksum sumber berubah; ` +
            "review manual sebelum import ulang.",
        );
        continue;
      }
      sampleCandidatePlans.push({
        action: "reuse",
        staged,
        id: existing.id,
        materialCandidateId: existing.material_candidate_id,
        confirmedMaterialId: existing.confirmed_material_id,
      });
      continue;
    }

    const materialCandidateId = staged._materialCandidateKey
      ? materialCandidateIdByKey.get(staged._materialCandidateKey)
      : null;
    if (staged._materialCandidateKey && !materialCandidateId) {
      blockers.push(
        `SampleCandidate ${staged.sample_candidate_key}: MaterialCandidate ` +
          `${staged._materialCandidateKey} tidak ditemukan.`,
      );
      continue;
    }

    const confirmedVendorId = vendorIdByKey.get(
      compact(staged.vendor_key_confirmed),
    );
    const confirmedMaterialId =
      confirmedVendorId &&
      compact(staged.brand_confirmed) &&
      compact(staged.sku_confirmed)
        ? materialIdByKey.get(
            materialNaturalKey(
              confirmedVendorId,
              staged.brand_confirmed,
              staged.sku_confirmed,
            ),
          )
        : null;
    const id = deterministicUuid(
      "studioflow-masterdata-sample-candidate",
      `${staging.sourceChecksum}:${staged.sample_candidate_key}`,
    );
    sampleCandidatePlans.push({
      action: "create",
      staged,
      id,
      materialCandidateId,
      confirmedMaterialId,
    });
  }

  const before = {
    vendors: counts[0],
    contacts: counts[1],
    links: counts[2],
    materials: counts[3],
    samples: counts[4],
    sampleMovements: counts[5],
    materialCandidates: counts[6],
    sampleCandidates: counts[7],
    auditLogs: counts[8],
    studioflowProjects: counts[9],
    studioflowScheduleEntries: counts[10],
    studioflowScheduleOptions: counts[11],
  };
  const summarize = (plans) => ({
    create: plans.filter((plan) => plan.action === "create").length,
    enrich: plans.filter((plan) => plan.action === "enrich").length,
    reuse: plans.filter((plan) => plan.action === "reuse").length,
  });

  return {
    before,
    actions: {
      vendors: summarize(vendorPlans),
      contacts: summarize(contactPlans),
      links: summarize(linkPlans),
      materials: summarize(materialPlans),
      samples: summarize(samplePlans),
      materialCandidates: summarize(materialCandidatePlans),
      sampleCandidates: summarize(sampleCandidatePlans),
    },
    blockers,
    warnings,
    _vendorPlans: vendorPlans,
    _contactPlans: contactPlans,
    _linkPlans: linkPlans,
    _materialPlans: materialPlans,
    _samplePlans: samplePlans,
    _materialCandidatePlans: materialCandidatePlans,
    _sampleCandidatePlans: sampleCandidatePlans,
  };
}

async function applyPlan(prisma, staging, plan, actor) {
  if (plan.blockers.length > 0) {
    fail(
      `Apply diblokir oleh ${plan.blockers.length} masalah payload/database.`,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const touchedVendors = new Map();

      for (const item of plan._vendorPlans) {
        if (item.action === "create") {
          await tx.brand.create({
            data: {
              id: item.id,
              brand_name: compact(item.staged.vendor_name),
              legal_name: nullable(item.staged.legal_name),
              address: nullable(item.staged.address),
              notes: nullable(item.staged.notes),
            },
          });
          touchedVendors.set(item.id, {
            action: "IMPORT_MASTERDATA_VENDOR_CREATE",
            staged: item.staged,
            contacts: 0,
            links: 0,
          });
        } else if (item.action === "enrich") {
          await tx.brand.update({
            where: { id: item.id },
            data: item.update,
          });
          touchedVendors.set(item.id, {
            action: "IMPORT_MASTERDATA_VENDOR_ENRICH",
            staged: item.staged,
            contacts: 0,
            links: 0,
          });
        }
      }

      for (const item of plan._contactPlans) {
        if (item.action !== "create") continue;
        await tx.brandContact.create({
          data: {
            id: item.id,
            brand_id: item.vendorId,
            contact_person: compact(item.staged.contact_person),
            contact_role: nullable(item.staged.contact_role),
            phone_number: nullable(item.staged.phone_number),
            email: nullable(item.staged.email),
          },
        });
        const touched = touchedVendors.get(item.vendorId) ?? {
          action: "IMPORT_MASTERDATA_VENDOR_ENRICH",
          staged: plan._vendorPlans.find(
            (vendor) => vendor.id === item.vendorId,
          )?.staged,
          contacts: 0,
          links: 0,
        };
        touched.contacts += 1;
        touchedVendors.set(item.vendorId, touched);
      }

      for (const item of plan._linkPlans) {
        if (item.action !== "create") continue;
        await tx.brandLink.create({
          data: {
            id: item.id,
            brand_id: item.vendorId,
            kind: item.staged.kind,
            url: item.staged.url,
            label: nullable(item.staged.label),
            sort_order: 0,
          },
        });
        const touched = touchedVendors.get(item.vendorId) ?? {
          action: "IMPORT_MASTERDATA_VENDOR_ENRICH",
          staged: plan._vendorPlans.find(
            (vendor) => vendor.id === item.vendorId,
          )?.staged,
          contacts: 0,
          links: 0,
        };
        touched.links += 1;
        touchedVendors.set(item.vendorId, touched);
      }

      for (const [vendorId, touched] of touchedVendors) {
        await tx.auditLog.create({
          data: {
            action: touched.action,
            entity_type: "VENDOR",
            entity_id: vendorId,
            user_id: actor.id,
            details: {
              source: "RAD - Material + Supplier.xlsx",
              source_sheet: touched.staged?.source_sheet ?? "List",
              source_rows: touched.staged?.source_rows ?? null,
              source_checksum: staging.sourceChecksum,
              vendor_key: touched.staged?.vendor_key ?? null,
              contacts_created: touched.contacts,
              links_created: touched.links,
            },
          },
        });
      }

      for (const item of plan._materialPlans) {
        if (item.action !== "create") continue;
        const staged = item.staged;
        await tx.sku.create({
          data: {
            id: item.id,
            brand_id: item.vendorId,
            catalog_brand: compact(staged.brand),
            catalog_sku: compact(staged.sku),
            catalog_product_name: compact(staged.product_name),
            catalog_color: nullable(staged.color),
            catalog_motif: nullable(staged.motif),
            catalog_finishing: nullable(staged.finishing),
            catalog_dimension_p: nullable(staged.dimension_p),
            catalog_dimension_l: nullable(staged.dimension_l),
            catalog_dimension_t: nullable(staged.dimension_t),
            catalog_dimension_unit: nullable(staged.dimension_unit),
            catalog_tags: staged._tags,
            catalog_reference_url: nullable(staged.reference_url),
            catalog_folder_url: nullable(staged.folder_url),
            catalog_image_url: nullable(staged.image_url),
            catalog_vendor_price: staged._priceBefore,
            catalog_price: staged._priceAfter,
            catalog_price_unit: staged._priceUnit,
            catalog_price_updated_at:
              staged._priceBefore !== null ||
              staged._priceAfter !== null ||
              staged._priceUnit !== null
                ? new Date()
                : null,
            catalog_status: "PENDING",
            catalog_type: "material",
            catalog_metadata: {
              seed_source: "RAD - Material + Supplier.xlsx",
              source_sheet: staged.source_sheet,
              source_row: staged.source_row,
              source_checksum: staging.sourceChecksum,
              seed_vendor_key: staged.vendor_key,
            },
          },
        });
        await tx.auditLog.create({
          data: {
            action: "IMPORT_MASTERDATA_MATERIAL_CREATE",
            entity_type: "Sku",
            entity_id: item.id,
            user_id: actor.id,
            details: {
              source: "RAD - Material + Supplier.xlsx",
              source_sheet: staged.source_sheet,
              source_row: staged.source_row,
              source_checksum: staging.sourceChecksum,
              vendor_key: staged.vendor_key,
              brand: staged.brand,
              sku: staged.sku,
              catalog_status: "PENDING",
            },
          },
        });
      }

      for (const item of plan._samplePlans) {
        if (item.action !== "create") continue;
        const staged = item.staged;
        await tx.sample.create({
          data: {
            id: item.id,
            sku_id: item.materialId,
            catalog_rack_number: compact(staged.rack_number),
            catalog_box_number: compact(staged.box_number),
            quantity: staged._quantity,
            catalog_status: staged.status,
            current_borrower_name: nullable(staged.current_borrower_name),
            borrowed_at: staged._borrowedAt,
            due_at: staged._dueAt,
            catalog_notes: nullable(staged.notes),
          },
        });
        await tx.sampleMovementLog.create({
          data: {
            id: deterministicUuid(
              "studioflow-masterdata-sample-audit",
              `${staging.sourceChecksum}:${staged.sample_key}`,
            ),
            sample_id: item.id,
            action: "AUDITED",
            notes:
              "Initial registration from reviewed seed; current state only, not historical movement.",
            user_id: actor.id,
            taken_by: nullable(staged.current_borrower_name),
          },
        });
        await tx.auditLog.create({
          data: {
            action: "IMPORT_MASTERDATA_SAMPLE_CREATE",
            entity_type: "Sample",
            entity_id: item.id,
            user_id: actor.id,
            details: {
              source: "RAD - Material + Supplier.xlsx",
              source_sheet: staged.source_sheet,
              source_row: staged.source_row,
              source_checksum: staging.sourceChecksum,
              sample_key: staged.sample_key,
              material_id: item.materialId,
              initial_status: staged.status,
            },
          },
        });
      }

      for (const item of plan._materialCandidatePlans) {
        if (item.action !== "create") continue;
        const staged = item.staged;
        await tx.materialCandidate.create({
          data: {
            id: item.id,
            candidate_key: compact(staged.candidate_key),
            source_context: compact(staged.source_context),
            source_sheet: compact(staged.source_sheet),
            source_rows: compact(staged.source_rows),
            source_checksum: staging.sourceChecksum,
            vendor_key_candidate: nullable(staged.vendor_key_candidate),
            candidate_vendor_id: item.candidateVendorId,
            confirmed_vendor_id: item.confirmedVendorId,
            brand_candidate: nullable(staged.brand_candidate),
            brand_confirmed: nullable(staged.brand_confirmed),
            category_tags_candidate: staged._candidateTags,
            category_tags_confirmed: staged._confirmedTags,
            source_product_or_type: nullable(staged.source_product_or_type),
            product_name_confirmed: nullable(staged.product_name_confirmed),
            sku_confirmed: nullable(staged.sku_confirmed),
            motif_candidate: nullable(staged.motif_candidate),
            reference_url_candidate: nullable(
              staged.reference_url_candidate,
            ),
            folder_url_candidate: nullable(staged.folder_url_candidate),
            price_before_discount: staged._priceBefore,
            price_after_discount: staged._priceAfter,
            price_unit: staged._priceUnit,
            review_status: "PENDING",
            blocker_reasons: staged._blockerReasons,
            decision_notes: nullable(staged.decision_notes),
          },
        });
        await tx.auditLog.create({
          data: {
            action: "IMPORT_MASTERDATA_MATERIAL_CANDIDATE_CREATE",
            entity_type: "MaterialCandidate",
            entity_id: item.id,
            user_id: actor.id,
            details: {
              source: "RAD - Material + Supplier.xlsx",
              source_sheet: staged.source_sheet,
              source_rows: staged.source_rows,
              source_checksum: staging.sourceChecksum,
              candidate_key: staged.candidate_key,
              blocker_count: staged._blockerReasons.length,
            },
          },
        });
      }

      for (const item of plan._sampleCandidatePlans) {
        if (item.action !== "create") continue;
        const staged = item.staged;
        await tx.sampleCandidate.create({
          data: {
            id: item.id,
            sample_candidate_key: compact(staged.sample_candidate_key),
            source_sheet: compact(staged.source_sheet),
            source_row: staged._sourceRow,
            source_no: nullable(staged.source_no),
            source_category: nullable(staged.source_category),
            source_brand: nullable(staged.source_brand),
            source_type: nullable(staged.source_type),
            source_motif: nullable(staged.source_motif),
            vendor_key_candidate: nullable(staged.vendor_key_candidate),
            material_candidate_id: item.materialCandidateId,
            confirmed_material_id: item.confirmedMaterialId,
            rack_number: compact(staged.rack_number),
            box_number: compact(staged.box_number),
            quantity: staged._quantity,
            status_candidate: nullable(staged.status_candidate),
            confirmed_status: staged._status,
            current_borrower_name: nullable(staged.current_borrower_name),
            notes: nullable(staged.notes),
            review_status: "PENDING",
            blocker_reasons: staged._blockerReasons,
            decision_notes: nullable(staged.decision_notes),
            source_checksum: staging.sourceChecksum,
          },
        });
        await tx.auditLog.create({
          data: {
            action: "IMPORT_MASTERDATA_SAMPLE_CANDIDATE_CREATE",
            entity_type: "SampleCandidate",
            entity_id: item.id,
            user_id: actor.id,
            details: {
              source: "RAD - Material + Supplier.xlsx",
              source_sheet: staged.source_sheet,
              source_row: staged.source_row,
              source_checksum: staging.sourceChecksum,
              sample_candidate_key: staged.sample_candidate_key,
              material_candidate_key: staged._materialCandidateKey,
              blocker_count: staged._blockerReasons.length,
            },
          },
        });
      }

      const afterCounts = await Promise.all([
        tx.brand.count(),
        tx.brandContact.count(),
        tx.brandLink.count(),
        tx.sku.count(),
        tx.sample.count(),
        tx.sampleMovementLog.count(),
        tx.materialCandidate.count(),
        tx.sampleCandidate.count(),
        tx.auditLog.count(),
        tx.project.count(),
        tx.projectScheduleEntry.count(),
        tx.projectScheduleOption.count(),
      ]);
      const after = {
        vendors: afterCounts[0],
        contacts: afterCounts[1],
        links: afterCounts[2],
        materials: afterCounts[3],
        samples: afterCounts[4],
        sampleMovements: afterCounts[5],
        materialCandidates: afterCounts[6],
        sampleCandidates: afterCounts[7],
        auditLogs: afterCounts[8],
        studioflowProjects: afterCounts[9],
        studioflowScheduleEntries: afterCounts[10],
        studioflowScheduleOptions: afterCounts[11],
      };
      for (const field of [
        "studioflowProjects",
        "studioflowScheduleEntries",
        "studioflowScheduleOptions",
      ]) {
        if (after[field] !== plan.before[field]) {
          fail(`${field} berubah selama seed; transaksi dibatalkan.`);
        }
      }
      return after;
    },
    { maxWait: 10_000, timeout: 180_000 },
  );
}

async function verifyBackup(
  backupPathArgument,
  expectedHash,
  pgRestoreCommand,
  pgRestoreContainer,
) {
  if (!backupPathArgument || !expectedHash) {
    fail("--apply membutuhkan --backup dan --backup-sha256.");
  }
  const backupPath = path.resolve(backupPathArgument);
  const relativeToProject = path.relative(root, backupPath);
  if (
    relativeToProject === "" ||
    (!relativeToProject.startsWith("..") &&
      !path.isAbsolute(relativeToProject))
  ) {
    fail("Backup wajib berada di luar folder project.");
  }
  const stats = await fs.stat(backupPath);
  if (!stats.isFile() || stats.size === 0) fail("Backup kosong/tidak valid.");

  const actualHash = await sha256File(backupPath);
  if (actualHash !== expectedHash.toUpperCase()) {
    fail(`Backup SHA-256 tidak cocok. Actual ${actualHash}.`);
  }

  let restoreCheck;
  let restoreVerifier;
  if (pgRestoreContainer) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(pgRestoreContainer)) {
      fail("--pg-restore-container berisi nama container yang tidak valid.");
    }
    const containerBackupPath = `/tmp/studioflow-seed-backup-${actualHash.slice(
      0,
      16,
    )}.dump`;
    const copyCheck = spawnSync(
      "docker",
      ["cp", backupPath, `${pgRestoreContainer}:${containerBackupPath}`],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    if (copyCheck.error || copyCheck.status !== 0) {
      fail(
        `Backup tidak dapat disalin ke container ${pgRestoreContainer}: ${
          copyCheck.error?.message ||
          copyCheck.stderr.trim() ||
          "docker cp gagal"
        }`,
      );
    }
    restoreCheck = spawnSync(
      "docker",
      [
        "exec",
        pgRestoreContainer,
        "pg_restore",
        "--list",
        containerBackupPath,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    const cleanupCheck = spawnSync(
      "docker",
      ["exec", pgRestoreContainer, "rm", "-f", containerBackupPath],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    if (cleanupCheck.error || cleanupCheck.status !== 0) {
      fail(
        `File verifikasi sementara gagal dibersihkan dari ${pgRestoreContainer}: ${
          cleanupCheck.error?.message ||
          cleanupCheck.stderr.trim() ||
          "cleanup gagal"
        }`,
      );
    }
    restoreVerifier = `docker:${pgRestoreContainer}`;
  } else {
    restoreCheck = spawnSync(
      pgRestoreCommand || "pg_restore",
      ["--list", backupPath],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    restoreVerifier = pgRestoreCommand || "pg_restore";
  }
  if (restoreCheck.error) {
    fail(
      `pg_restore tidak dapat dijalankan: ${restoreCheck.error.message}. ` +
        "Gunakan --pg-restore <path executable> atau " +
        "--pg-restore-container <nama container>.",
    );
  }
  if (restoreCheck.status !== 0 || !restoreCheck.stdout.trim()) {
    fail(
      `Backup gagal pg_restore --list: ${
        restoreCheck.stderr.trim() || "output kosong"
      }`,
    );
  }
  return {
    path: backupPath,
    bytes: stats.size,
    sha256: actualHash,
    restoreListVerified: true,
    restoreVerifier,
  };
}

async function writeReport(report) {
  const outputDir = path.join(root, "outputs", "masterdata-seed-import");
  await fs.mkdir(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    outputDir,
    `masterdata-seed-${report.mode}-${stamp}.json`,
  );
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

async function main() {
  const validateOnly = process.argv.includes("--validate-only");
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if ([validateOnly, dryRun, apply].filter(Boolean).length !== 1) {
    fail("Pilih tepat satu mode: --validate-only, --dry-run, atau --apply.");
  }

  const stagingDir = path.resolve(
    argValue("--staging-dir") ?? defaultStagingDir,
  );
  const staging = await loadStaging(stagingDir);
  const normalizedStaging = validateStaging(staging);
  if (normalizedStaging.issues.blockers.length > 0) {
    fail(
      `Payload seed memiliki ${normalizedStaging.issues.blockers.length} blocker:\n` +
        normalizedStaging.issues.blockers.slice(0, 30).join("\n"),
    );
  }

  if (validateOnly) {
    const report = {
      mode: "validate-only",
      generatedAt: new Date().toISOString(),
      stagingDir,
      sourceChecksum: staging.sourceChecksum,
      payload: staging.summary.seed_payload,
      reviewQueue: staging.summary.review_queue,
      payloadWarnings: normalizedStaging.issues.warnings,
      databaseWrites: 0,
    };
    const reportPath = await writeReport(report);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
    console.log("\nVALIDATION PASS — zero database access and zero writes.");
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL tidak tersedia.");
  const databaseUrl = new URL(connectionString);
  if (!["localhost", "127.0.0.1"].includes(databaseUrl.hostname)) {
    fail("Importer hanya boleh dijalankan terhadap database localhost.");
  }
  if (apply && !process.argv.includes("--ack-review")) {
    fail("--apply membutuhkan --ack-review.");
  }

  const backup = apply
    ? await verifyBackup(
        argValue("--backup"),
        argValue("--backup-sha256"),
        argValue("--pg-restore"),
        argValue("--pg-restore-container"),
      )
    : null;

  const pool = new pg.Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const actor = await resolveActor(prisma, argValue("--actor-email"));
    const plan = await buildDatabasePlan(prisma, staging, normalizedStaging);
    const base = {
      mode: apply ? "apply" : "dry-run",
      generatedAt: new Date().toISOString(),
      database: redactConnectionString(connectionString),
      actor,
      stagingDir,
      sourceChecksum: staging.sourceChecksum,
      payload: staging.summary.seed_payload,
      reviewQueue: staging.summary.review_queue,
      backup,
      before: plan.before,
      actions: plan.actions,
      blockers: plan.blockers,
      warnings: plan.warnings,
    };

    if (!apply) {
      const reportPath = await writeReport(base);
      console.log(JSON.stringify({ ...base, reportPath }, null, 2));
      console.log("\nDRY-RUN PASS — zero database writes.");
      return;
    }

    const after = await applyPlan(prisma, staging, plan, actor);
    const report = { ...base, after };
    const reportPath = await writeReport(report);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
    console.log("\nAPPLY PASS — transaction committed.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`\nMASTER DATA SEED FAILED: ${error.message}`);
  process.exitCode = 1;
});
