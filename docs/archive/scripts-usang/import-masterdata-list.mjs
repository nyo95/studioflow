#!/usr/bin/env node
/**
 * ===========================================================================
 * OBSOLETE as of 31 July 2026 — DOES NOT RUN.
 * ===========================================================================
 * This script targets `Vendor`, `VendorContact`, `VendorOffering` and/or
 * `ProductCatalog`. The master-data entity rework
 * (prisma/migrations/20260731190000_master_data_entity_rework) dropped all of
 * them; the shape is now Brand / BrandLink / BrandContact / Category /
 * Product / Sku / Sample.
 *
 * It is kept rather than deleted because it documents exactly how the office
 * workbook was parsed — the column mapping, the checksum rules and the
 * placeholder bans are all still the right rules, and rewriting an importer
 * for the new schema should start from them.
 *
 * The guard below is deliberate. Without it this fails deep inside Prisma with
 * "cannot read property findMany of undefined", which tells the next person
 * nothing about why.
 * ===========================================================================
 */

throw new Error(
  "OBSOLETE: do not run this importer. Re-read the source CSV using " +
  "docs/MASTERDATA_CSV_SEEDING_GUIDE.md; the canonical database is now " +
  "Vendor -> Material -> Sample, SKU is mandatory, and Offering no longer exists."
);

/**
 * Import the reviewed `List` staging package into Master Data.
 *
 * Dry-run:
 *   node scripts/import-masterdata-list.mjs --dry-run --actor-email user@example.com
 *
 * Apply:
 *   node scripts/import-masterdata-list.mjs --apply \
 *     --actor-email user@example.com \
 *     --backup backups/studioflow_pre_masterdata_YYYYMMDD_HHMMSS.dump \
 *     --backup-sha256 <sha256> \
 *     --ack-review
 *
 * Safety properties:
 * - localhost databases only;
 * - source workbook SHA-256 and staging reconciliation are mandatory;
 * - apply requires a verified backup file and explicit review acknowledgement;
 * - one database transaction for Vendor, VendorContact, VendorOffering and
 *   their AuditLog rows;
 * - vendor updates fill blank fields only;
 * - contacts and offerings are idempotent;
 * - ProductCatalog, PhysicalSample and SampleMovementLog are never touched.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const ROOT = process.cwd();
const DEFAULT_STAGING_DIR = path.join(
  ROOT,
  "docs",
  "masterdata-import-staging"
);
const BACKUPS_DIR = path.resolve(ROOT, "backups");
const CAPABLE_ROLES = new Set(["ADMIN", "OWNER", "STAFF"]);
const VENDOR_FIELDS = [
  "company_name",
  "company_pt",
  "website_url",
  "instagram_url",
  "address",
];
const JESS_STATUSES = new Set([
  "VERIFIED_GREEN",
  "INACTIVE_RED",
  "UNREACHABLE_DARKRED",
  "UNCERTAIN_PEACH",
  "UNVERIFIED_WHITE",
  "UNVERIFIED_NONE",
]);
const OFFERING_STATUSES = new Set(["ACTIVE", "ARCHIVED"]);

const EXPECTED_HEADERS = {
  vendors: [
    "vendor_row_id",
    "canonical_brand_name",
    "source_brand_variants",
    "company_name",
    "company_pt",
    "website_url",
    "instagram_url",
    "address",
    "action",
    "matched_existing_hint",
    "source_sheet",
    "source_rows",
    "source_checksum",
  ],
  contacts: [
    "vendor_row_id",
    "canonical_brand_name",
    "contact_person",
    "contact_role",
    "phone_number",
    "email",
    "source_sheet",
    "source_row",
    "note",
  ],
  offerings: [
    "vendor_row_id",
    "canonical_brand_name",
    "category_raw",
    "tags",
    "product_family_name",
    "reference_url",
    "folder_url",
    "source_notes",
    "jess_status",
    "curated_by",
    "active_status",
    "verified_at",
    "source_sheet",
    "source_row",
    "source_checksum",
    "needs_review_multiline",
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

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function fail(message) {
  throw new Error(message);
}

function normalized(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

function nullable(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

async function sha256File(filePath) {
  return sha256(await fs.readFile(filePath));
}

function parseCsv(text, label) {
  const input = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
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

  if (quoted) fail(`${label}: CSV berakhir di dalam quoted field`);
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (rows.length < 1) fail(`${label}: CSV kosong`);

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, ""));
  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index
  );
  if (duplicateHeaders.length > 0) {
    fail(`${label}: header duplikat ${duplicateHeaders.join(", ")}`);
  }

  const records = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      fail(
        `${label}: baris CSV ${index + 2} memiliki ${values.length} kolom, ` +
          `seharusnya ${headers.length}`
      );
    }
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });

  return { headers, records };
}

function assertHeaders(actual, expected, label) {
  if (
    actual.length !== expected.length ||
    actual.some((header, index) => header !== expected[index])
  ) {
    fail(
      `${label}: header tidak sesuai. actual=${JSON.stringify(actual)} ` +
        `expected=${JSON.stringify(expected)}`
    );
  }
}

function integer(value, label) {
  if (!/^\d+$/.test(String(value))) fail(`${label}: harus integer`);
  return Number(value);
}

function stringArray(value, label) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail(`${label}: tags bukan JSON valid`);
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    fail(`${label}: tags harus string[]`);
  }
  return parsed;
}

function contactKey(vendorKey, contact) {
  return [
    vendorKey,
    normalized(contact.contact_person),
    normalized(contact.contact_role),
    String(contact.phone_number ?? "").trim(),
    normalized(contact.email),
  ].join("\u001F");
}

function offeringKey(offering) {
  return [
    offering.source_checksum,
    offering.source_sheet,
    String(offering.source_row),
  ].join("\u001F");
}

function offeringPayloadEqual(existing, staged, vendorId) {
  return (
    existing.vendor_id === vendorId &&
    existing.category_raw === staged.category_raw &&
    JSON.stringify(existing.tags) === JSON.stringify(staged.tags) &&
    (existing.product_family_name ?? null) === staged.product_family_name &&
    (existing.reference_url ?? null) === staged.reference_url &&
    (existing.folder_url ?? null) === staged.folder_url &&
    (existing.source_notes ?? null) === staged.source_notes &&
    existing.jess_status === staged.jess_status &&
    (existing.curated_by ?? null) === staged.curated_by &&
    existing.active_status === staged.active_status &&
    (existing.verified_at?.toISOString() ?? null) === staged.verified_at &&
    existing.needs_review_multiline === staged.needs_review_multiline
  );
}

function redactConnectionString(connectionString) {
  return connectionString.replace(/(:\/\/[^:]+:)[^@]*(@)/, "$1***$2");
}

async function loadStaging(stagingDir) {
  const paths = {
    workbook: path.join(stagingDir, "..", "RAD - Material + Supplier.xlsx"),
    vendors: path.join(stagingDir, "01_vendors.csv"),
    contacts: path.join(stagingDir, "02_vendor_contacts.csv"),
    offerings: path.join(stagingDir, "03_vendor_offerings.csv"),
    review: path.join(stagingDir, "04_import_review.csv"),
    summary: path.join(stagingDir, "BUILD_SUMMARY.json"),
  };

  const [
    workbookBuffer,
    vendorsText,
    contactsText,
    offeringsText,
    reviewText,
    summaryText,
  ] = await Promise.all([
    fs.readFile(paths.workbook),
    fs.readFile(paths.vendors, "utf8"),
    fs.readFile(paths.contacts, "utf8"),
    fs.readFile(paths.offerings, "utf8"),
    fs.readFile(paths.review, "utf8"),
    fs.readFile(paths.summary, "utf8"),
  ]);

  const summary = JSON.parse(summaryText);
  const sourceChecksum = sha256(workbookBuffer);
  if (sourceChecksum !== summary.source_checksum_verified) {
    fail(
      `Checksum workbook tidak cocok: actual=${sourceChecksum}, ` +
        `expected=${summary.source_checksum_verified}`
    );
  }

  const parsed = {
    vendors: parseCsv(vendorsText, "01_vendors.csv"),
    contacts: parseCsv(contactsText, "02_vendor_contacts.csv"),
    offerings: parseCsv(offeringsText, "03_vendor_offerings.csv"),
    review: parseCsv(reviewText, "04_import_review.csv"),
  };

  for (const name of Object.keys(parsed)) {
    assertHeaders(parsed[name].headers, EXPECTED_HEADERS[name], name);
  }

  if (parsed.vendors.records.length !== summary.vendors_out) {
    fail("Jumlah vendor staging tidak cocok dengan BUILD_SUMMARY.json");
  }
  if (parsed.contacts.records.length !== summary.contacts_out) {
    fail("Jumlah kontak staging tidak cocok dengan BUILD_SUMMARY.json");
  }
  if (parsed.offerings.records.length !== summary.offerings_out) {
    fail("Jumlah offering staging tidak cocok dengan BUILD_SUMMARY.json");
  }

  const reviewCounts = parsed.review.records.reduce(
    (counts, row) => {
      const key = String(row.severity).toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {}
  );
  if (
    (reviewCounts.blocker ?? 0) !== summary.review_blockers ||
    (reviewCounts.warn ?? 0) !== summary.review_warnings ||
    (reviewCounts.info ?? 0) !== summary.review_info
  ) {
    fail("Rekonsiliasi review staging tidak cocok dengan BUILD_SUMMARY.json");
  }
  if (summary.review_blockers !== 0) {
    fail(`Import diblokir: ${summary.review_blockers} blocker masih terbuka`);
  }

  const vendorIds = new Set();
  const brandKeys = new Set();
  const vendors = parsed.vendors.records.map((row, index) => {
    const label = `vendor row ${index + 2}`;
    if (!row.vendor_row_id || vendorIds.has(row.vendor_row_id)) {
      fail(`${label}: vendor_row_id kosong/duplikat`);
    }
    vendorIds.add(row.vendor_row_id);

    const brandKey = normalized(row.canonical_brand_name);
    if (!brandKey || brandKeys.has(brandKey)) {
      fail(`${label}: canonical_brand_name kosong/duplikat case-insensitive`);
    }
    brandKeys.add(brandKey);

    if (row.source_checksum !== sourceChecksum) {
      fail(`${label}: source_checksum tidak cocok`);
    }
    if (
      !["INSERT_NEW", "MATCH_EXISTING_FILL_BLANKS_ONLY"].includes(row.action)
    ) {
      fail(`${label}: action tidak dikenal`);
    }

    return {
      ...row,
      brand_key: brandKey,
      company_name: nullable(row.company_name),
      company_pt: nullable(row.company_pt),
      website_url: nullable(row.website_url),
      instagram_url: nullable(row.instagram_url),
      address: nullable(row.address),
    };
  });

  const stagedContactKeys = new Set();
  const contacts = parsed.contacts.records.map((row, index) => {
    const label = `contact row ${index + 2}`;
    if (!vendorIds.has(row.vendor_row_id)) {
      fail(`${label}: vendor_row_id tidak ditemukan`);
    }
    if (!nullable(row.contact_person) || !nullable(row.contact_role)) {
      fail(`${label}: contact_person/contact_role wajib`);
    }
    const contact = {
      ...row,
      contact_person: row.contact_person.trim(),
      contact_role: row.contact_role.trim(),
      phone_number: nullable(row.phone_number),
      email: nullable(row.email),
      source_row: integer(row.source_row, `${label}.source_row`),
    };
    const key = contactKey(row.vendor_row_id, contact);
    if (stagedContactKeys.has(key)) fail(`${label}: kontak staging duplikat`);
    stagedContactKeys.add(key);
    return contact;
  });

  const stagedOfferingKeys = new Set();
  const offerings = parsed.offerings.records.map((row, index) => {
    const label = `offering row ${index + 2}`;
    if (!vendorIds.has(row.vendor_row_id)) {
      fail(`${label}: vendor_row_id tidak ditemukan`);
    }
    if (!row.category_raw.trim()) fail(`${label}: category_raw wajib`);
    if (row.source_checksum !== sourceChecksum) {
      fail(`${label}: source_checksum tidak cocok`);
    }
    if (!JESS_STATUSES.has(row.jess_status)) {
      fail(`${label}: jess_status tidak dikenal`);
    }
    if (!OFFERING_STATUSES.has(row.active_status)) {
      fail(`${label}: active_status tidak dikenal`);
    }
    if (
      (row.jess_status === "VERIFIED_GREEN" &&
        row.curated_by !== "Jessica") ||
      (row.jess_status !== "VERIFIED_GREEN" && row.curated_by !== "")
    ) {
      fail(`${label}: curated_by tidak konsisten dengan jess_status`);
    }
    if (row.verified_at !== "") {
      fail(`${label}: verified_at harus kosong karena sumber tidak punya tanggal`);
    }

    const offering = {
      vendor_row_id: row.vendor_row_id,
      category_raw: row.category_raw.trim(),
      tags: stringArray(row.tags, `${label}.tags`),
      product_family_name: nullable(row.product_family_name),
      reference_url: nullable(row.reference_url),
      folder_url: nullable(row.folder_url),
      source_notes: nullable(row.source_notes),
      jess_status: row.jess_status,
      curated_by: nullable(row.curated_by),
      active_status: row.active_status,
      verified_at: null,
      source_sheet: row.source_sheet,
      source_row: integer(row.source_row, `${label}.source_row`),
      source_checksum: row.source_checksum,
      needs_review_multiline: row.needs_review_multiline === "YES",
    };
    const key = offeringKey(offering);
    if (stagedOfferingKeys.has(key)) fail(`${label}: source key duplikat`);
    stagedOfferingKeys.add(key);
    return offering;
  });

  return {
    sourceChecksum,
    summary,
    reviewCounts,
    vendors,
    contacts,
    offerings,
  };
}

async function resolveActor(prisma, actorEmail) {
  if (!actorEmail) fail("--actor-email wajib diisi dengan User nyata");
  const actor = await prisma.user.findUnique({
    where: { email: actorEmail },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!actor) fail(`Actor ${actorEmail} tidak ditemukan`);
  if (!CAPABLE_ROLES.has(actor.role)) {
    fail(`Actor ${actorEmail} dengan role ${actor.role} tidak boleh import`);
  }
  return actor;
}

async function buildPlan(prisma, staging) {
  const [existingVendors, before] = await Promise.all([
    prisma.vendor.findMany({
      include: { contacts: true, offerings: true },
      orderBy: { brand_name: "asc" },
    }),
    Promise.all([
      prisma.vendor.count(),
      prisma.vendorContact.count(),
      prisma.vendorOffering.count(),
      prisma.auditLog.count(),
    ]),
  ]);

  const existingByBrand = new Map();
  for (const vendor of existingVendors) {
    const key = normalized(vendor.brand_name);
    if (existingByBrand.has(key)) {
      fail(
        `Database memiliki vendor duplikat case-insensitive: ` +
          `${existingByBrand.get(key).brand_name} / ${vendor.brand_name}`
      );
    }
    existingByBrand.set(key, vendor);
  }

  const vendorPlan = [];
  const vendorKeyByRowId = new Map();
  for (const staged of staging.vendors) {
    const existing = existingByBrand.get(staged.brand_key);
    vendorKeyByRowId.set(
      staged.vendor_row_id,
      existing?.id ?? `NEW:${staged.vendor_row_id}`
    );

    if (!existing) {
      vendorPlan.push({ action: "insert", staged });
      continue;
    }
    if (existing.deleted_at) {
      fail(`Vendor ${existing.brand_name} soft-deleted; revival perlu review`);
    }

    const fill = {};
    for (const field of VENDOR_FIELDS) {
      if (nullable(existing[field]) === null && staged[field] !== null) {
        fill[field] = staged[field];
      }
    }
    vendorPlan.push({
      action: Object.keys(fill).length > 0 ? "fill-blanks" : "reuse",
      staged,
      existingId: existing.id,
      fill,
    });
  }

  const existingContactKeys = new Set();
  for (const vendor of existingVendors) {
    for (const contact of vendor.contacts) {
      existingContactKeys.add(contactKey(vendor.id, contact));
    }
  }
  const contactPlan = staging.contacts.map((contact) => {
    const vendorKey = vendorKeyByRowId.get(contact.vendor_row_id);
    return {
      action: existingContactKeys.has(contactKey(vendorKey, contact))
        ? "reuse"
        : "insert",
      contact,
    };
  });

  const existingOfferings = new Map();
  for (const vendor of existingVendors) {
    for (const offering of vendor.offerings) {
      existingOfferings.set(offeringKey(offering), offering);
    }
  }
  const offeringPlan = staging.offerings.map((offering) => {
    const vendorKey = vendorKeyByRowId.get(offering.vendor_row_id);
    const existing = existingOfferings.get(offeringKey(offering));
    if (!existing) return { action: "insert", offering };
    if (!offeringPayloadEqual(existing, offering, vendorKey)) {
      fail(
        `Offering ${offering.source_sheet}:${offering.source_row} sudah ada ` +
          `tetapi payload berbeda`
      );
    }
    return { action: "reuse", offering };
  });

  const countActions = (plans) =>
    plans.reduce((counts, item) => {
      counts[item.action] = (counts[item.action] ?? 0) + 1;
      return counts;
    }, {});
  const vendorActions = countActions(vendorPlan);
  const contactActions = countActions(contactPlan);
  const offeringActions = countActions(offeringPlan);
  const projectedAuditWrites =
    (vendorActions.insert ?? 0) +
    (vendorActions["fill-blanks"] ?? 0) +
    (contactActions.insert ?? 0) +
    (offeringActions.insert ?? 0);

  return {
    before: {
      vendors: before[0],
      contacts: before[1],
      offerings: before[2],
      auditLogs: before[3],
    },
    actions: {
      vendors: vendorActions,
      contacts: contactActions,
      offerings: offeringActions,
      auditLogs: { insert: projectedAuditWrites },
    },
    projectedAfter: {
      vendors: before[0] + (vendorActions.insert ?? 0),
      contacts: before[1] + (contactActions.insert ?? 0),
      offerings: before[2] + (offeringActions.insert ?? 0),
      auditLogs: before[3] + projectedAuditWrites,
    },
  };
}

async function writeAudit(tx, actorId, action, entityType, entityId, details) {
  await tx.auditLog.create({
    data: {
      action,
      entity_type: entityType,
      entity_id: entityId,
      user_id: actorId,
      details,
    },
  });
}

async function applyImport(prisma, staging, actor) {
  return prisma.$transaction(
    async (tx) => {
      const existingVendors = await tx.vendor.findMany({
        include: { contacts: true },
      });
      const byBrand = new Map();
      for (const vendor of existingVendors) {
        const key = normalized(vendor.brand_name);
        if (byBrand.has(key)) {
          fail(`Vendor database duplikat case-insensitive: ${vendor.brand_name}`);
        }
        byBrand.set(key, vendor);
      }

      const vendorIdByRowId = new Map();
      let vendorsInserted = 0;
      let vendorsFilled = 0;
      let vendorsReused = 0;

      for (const staged of staging.vendors) {
        let vendor = byBrand.get(staged.brand_key);
        if (vendor?.deleted_at) {
          fail(`Vendor ${vendor.brand_name} soft-deleted; revival perlu review`);
        }

        if (!vendor) {
          vendor = await tx.vendor.create({
            data: {
              brand_name: staged.canonical_brand_name.trim(),
              company_name: staged.company_name,
              company_pt: staged.company_pt,
              website_url: staged.website_url,
              instagram_url: staged.instagram_url,
              address: staged.address,
            },
          });
          byBrand.set(staged.brand_key, { ...vendor, contacts: [] });
          vendorsInserted += 1;
          await writeAudit(
            tx,
            actor.id,
            "IMPORT_MASTER_DATA_VENDOR_CREATE",
            "Vendor",
            vendor.id,
            {
              source: "RAD - Material + Supplier.xlsx",
              source_sheet: staged.source_sheet,
              source_rows: staged.source_rows,
              source_checksum: staged.source_checksum,
              source_brand_variants: staged.source_brand_variants,
            }
          );
        } else {
          const fill = {};
          for (const field of VENDOR_FIELDS) {
            if (nullable(vendor[field]) === null && staged[field] !== null) {
              fill[field] = staged[field];
            }
          }
          if (Object.keys(fill).length > 0) {
            const before = Object.fromEntries(
              Object.keys(fill).map((field) => [field, vendor[field]])
            );
            vendor = await tx.vendor.update({
              where: { id: vendor.id },
              data: fill,
            });
            byBrand.set(staged.brand_key, { ...vendor, contacts: [] });
            vendorsFilled += 1;
            await writeAudit(
              tx,
              actor.id,
              "IMPORT_MASTER_DATA_VENDOR_FILL_BLANKS",
              "Vendor",
              vendor.id,
              {
                source: "RAD - Material + Supplier.xlsx",
                source_sheet: staged.source_sheet,
                source_rows: staged.source_rows,
                source_checksum: staged.source_checksum,
                before,
                after: fill,
              }
            );
          } else {
            vendorsReused += 1;
          }
        }
        vendorIdByRowId.set(staged.vendor_row_id, vendor.id);
      }

      const vendorIds = [...new Set(vendorIdByRowId.values())];
      const currentContacts = await tx.vendorContact.findMany({
        where: { vendor_id: { in: vendorIds } },
      });
      const currentContactKeys = new Set(
        currentContacts.map((contact) =>
          contactKey(contact.vendor_id, contact)
        )
      );
      let contactsInserted = 0;
      let contactsReused = 0;

      for (const contact of staging.contacts) {
        const vendorId = vendorIdByRowId.get(contact.vendor_row_id);
        const key = contactKey(vendorId, contact);
        if (currentContactKeys.has(key)) {
          contactsReused += 1;
          continue;
        }
        const created = await tx.vendorContact.create({
          data: {
            vendor_id: vendorId,
            contact_person: contact.contact_person,
            contact_role: contact.contact_role,
            phone_number: contact.phone_number,
            email: contact.email,
          },
        });
        currentContactKeys.add(key);
        contactsInserted += 1;
        await writeAudit(
          tx,
          actor.id,
          "IMPORT_MASTER_DATA_VENDOR_CONTACT_CREATE",
          "VendorContact",
          created.id,
          {
            vendor_id: vendorId,
            source_sheet: contact.source_sheet,
            source_row: contact.source_row,
            source_note: nullable(contact.note),
            source_checksum: staging.sourceChecksum,
          }
        );
      }

      const currentOfferings = await tx.vendorOffering.findMany({
        where: { source_checksum: staging.sourceChecksum },
      });
      const currentOfferingByKey = new Map(
        currentOfferings.map((offering) => [offeringKey(offering), offering])
      );
      let offeringsInserted = 0;
      let offeringsReused = 0;

      for (const offering of staging.offerings) {
        const vendorId = vendorIdByRowId.get(offering.vendor_row_id);
        const key = offeringKey(offering);
        const existing = currentOfferingByKey.get(key);
        if (existing) {
          if (!offeringPayloadEqual(existing, offering, vendorId)) {
            fail(
              `Offering ${offering.source_sheet}:${offering.source_row} ` +
                `sudah ada tetapi payload berbeda`
            );
          }
          offeringsReused += 1;
          continue;
        }

        const created = await tx.vendorOffering.create({
          data: {
            vendor_id: vendorId,
            category_raw: offering.category_raw,
            tags: offering.tags,
            product_family_name: offering.product_family_name,
            reference_url: offering.reference_url,
            folder_url: offering.folder_url,
            source_notes: offering.source_notes,
            jess_status: offering.jess_status,
            curated_by: offering.curated_by,
            active_status: offering.active_status,
            verified_at: null,
            source_sheet: offering.source_sheet,
            source_row: offering.source_row,
            source_checksum: offering.source_checksum,
            needs_review_multiline: offering.needs_review_multiline,
          },
        });
        currentOfferingByKey.set(key, created);
        offeringsInserted += 1;
        await writeAudit(
          tx,
          actor.id,
          "IMPORT_MASTER_DATA_VENDOR_OFFERING_CREATE",
          "VendorOffering",
          created.id,
          {
            vendor_id: vendorId,
            source_sheet: offering.source_sheet,
            source_row: offering.source_row,
            source_checksum: offering.source_checksum,
            jess_status: offering.jess_status,
            curated_by: offering.curated_by,
            active_status: offering.active_status,
          }
        );
      }

      const after = await Promise.all([
        tx.vendor.count(),
        tx.vendorContact.count(),
        tx.vendorOffering.count(),
        tx.auditLog.count(),
      ]);

      return {
        vendors: {
          inserted: vendorsInserted,
          filledBlanks: vendorsFilled,
          reused: vendorsReused,
        },
        contacts: {
          inserted: contactsInserted,
          reused: contactsReused,
        },
        offerings: {
          inserted: offeringsInserted,
          reused: offeringsReused,
        },
        after: {
          vendors: after[0],
          contacts: after[1],
          offerings: after[2],
          auditLogs: after[3],
        },
      };
    },
    { maxWait: 10_000, timeout: 180_000 }
  );
}

async function verifyBackup(backupPathArg, expectedHash) {
  if (!backupPathArg || !expectedHash) {
    fail("--apply membutuhkan --backup dan --backup-sha256");
  }
  const backupPath = path.resolve(ROOT, backupPathArg);
  const relative = path.relative(BACKUPS_DIR, backupPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("Backup harus berada di folder workspace backups/");
  }
  const stats = await fs.stat(backupPath);
  if (!stats.isFile() || stats.size === 0) fail("Backup tidak valid/kosong");
  const actualHash = await sha256File(backupPath);
  if (actualHash !== expectedHash.toUpperCase()) {
    fail(`Hash backup tidak cocok: actual=${actualHash}`);
  }
  return { path: backupPath, bytes: stats.size, sha256: actualHash };
}

async function writeReport(report) {
  const outputDir = path.join(ROOT, "outputs", "masterdata-import");
  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    outputDir,
    `masterdata-import-${report.mode}-${timestamp}.json`
  );
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const explicitDryRun = process.argv.includes("--dry-run");
  if (apply === explicitDryRun) {
    fail("Pilih tepat satu mode: --dry-run atau --apply");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL tidak tersedia");
  const databaseUrl = new URL(connectionString);
  if (!["localhost", "127.0.0.1"].includes(databaseUrl.hostname)) {
    fail("Importer hanya boleh dijalankan terhadap database localhost");
  }

  const stagingDir = path.resolve(
    ROOT,
    argValue("--staging-dir") ?? DEFAULT_STAGING_DIR
  );
  const actorEmail = argValue("--actor-email");
  const backup = apply
    ? await verifyBackup(argValue("--backup"), argValue("--backup-sha256"))
    : null;
  if (apply && !process.argv.includes("--ack-review")) {
    fail("--apply membutuhkan --ack-review");
  }

  const staging = await loadStaging(stagingDir);
  const pool = new pg.Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const actor = await resolveActor(prisma, actorEmail);
    const plan = await buildPlan(prisma, staging);
    const baseReport = {
      mode: apply ? "apply" : "dry-run",
      generatedAt: new Date().toISOString(),
      database: redactConnectionString(connectionString),
      actor,
      source: {
        workbook: "RAD - Material + Supplier.xlsx",
        checksum: staging.sourceChecksum,
      },
      staging: {
        vendors: staging.vendors.length,
        contacts: staging.contacts.length,
        offerings: staging.offerings.length,
        review: staging.reviewCounts,
      },
      plan,
      backup,
    };

    if (!apply) {
      const reportPath = await writeReport(baseReport);
      console.log(JSON.stringify({ ...baseReport, reportPath }, null, 2));
      console.log("\nDRY-RUN PASS — zero database writes.");
      return;
    }

    const result = await applyImport(prisma, staging, actor);
    const report = { ...baseReport, result };
    const reportPath = await writeReport(report);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
    console.log("\nAPPLY PASS — transaction committed.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`\nIMPORT FAILED: ${error.message}`);
  process.exitCode = 1;
});
