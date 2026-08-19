"use server";

/**
 * MASTER DATA — Party CRUD actions.
 *
 * Master Data v2 removed the standalone `Company` model — see X6 in
 * docs/PENYIMPANGAN-DARI-EXCEL.md: Company and Brand collapsed into one
 * `Party` (legal_name = badan hukum, name = nama dagang), and a Brand's owner
 * is a `Party` via `Brand.owner_party_id`.
 *
 * This file used to keep the old `Company*` names deliberately, to avoid a
 * rename sweep. The sweep happened 2026-08-11 (roadmap §M3): every type and
 * component now says Party. Only the ACTION names below still say Company,
 * because renaming an exported server action is a client-side breaking change
 * and there is no behaviour riding on it — noted here so the inconsistency
 * reads as a decision rather than an oversight.
 *
 * Rows written here are `Party` with `type = COMPANY`.
 */

import { z } from "zod";
import type { LinkKind, PartyRoleKind } from "@/generated/prisma";
import { prisma } from "@/core/platform/db";
import { createAction } from "@/lib/action-wrapper";
import { PERMISSION } from "@/core/rbac/constants";
import { hasPermission } from "@/core/rbac/guards";
import { ActionError } from "@/lib/error-types";
import type { PartyData, PartyInput } from "../types/party";
import type { PrismaTransaction } from "@/types/common";
import { recordAudit, diffFields } from "../services/audit-service";
import { assertPartyDeletable } from "../services/party-delete-service";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ContactSchema = z.object({
  id: z.string().optional(),
  contact_person: z.string().min(1, "Contact name is required"),
  contact_role: z.string().default(""),
  phone_number: z.string().default(""),
  email: z.string().default(""),
});

const LinkSchema = z.object({
  id: z.string().optional(),
  kind: z.string().transform((v) => v as LinkKind),
  url: z.string().min(1, "URL is required"),
  label: z.string().default(""),
});

const PARTY_ROLE_VALUES = [
  "MANUFACTURER",
  "DISTRIBUTOR",
  "SUPPLIER",
  "RETAIL",
  "SUBCON",
  "SERVICE_VENDOR",
] as const;

const CompanyInputSchema = z.object({
  name: z.string().min(1, "Party name is required"),
  legal_name: z.string().default(""),
  address: z.string().default(""),
  notes: z.string().default(""),
  contacts: z.array(ContactSchema).default([]),
  links: z.array(LinkSchema).default([]),
  /**
   * Excel Table 1 column K, "Company Categories". Until 2026-08-11 nothing in
   * the app ever wrote a `PartyRole` row except the service-vendor form, which
   * meant the supplier picker on the pricing pages could never list anybody —
   * it filters on `role: SUPPLIER`. The column existed, the enum existed, and
   * the one screen that could have filled it did not offer the field.
   */
  roles: z.array(z.enum(PARTY_ROLE_VALUES)).default([]),
});

const CompanyIdSchema = z.object({ id: z.string().min(1) });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const db = prisma;

/**
 * Satu definisi "nama ini sudah dipakai" untuk Party dan Brand.
 *
 * Sebelum 2026-08-18 setiap layar menjawabnya sendiri, dan jawabannya berbeda:
 * `create` memakai `findUnique({ where: { name } })` yang IKUT menghitung baris
 * soft-deleted (menolak nama yang sebenarnya bebas), sementara `update` memakai
 * `deleted_at: null` yang MELEWATKAN bentrokan lalu crash di database. Dua bug
 * berlawanan pada tabel yang sama.
 *
 * Sekarang keduanya memanggil ini, dan aturannya sama persis dengan index
 * `Party_name_live_uniq` / `Brand_name_live_uniq` di migrasi
 * `20260818120000`: bandingkan tanpa memedulikan huruf besar-kecil, abaikan
 * baris yang sudah dihapus. Kalau cek aplikasi dan index database menjawab
 * berbeda, yang menang adalah index — dan pengguna melihat error mentah.
 */

export type NameOwner = { id: string; name: string } | null;

async function findLivePartyByName(
  tx: PrismaTransaction,
  name: string,
  exceptId?: string
): Promise<NameOwner> {
  return tx.party.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      deleted_at: null,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true, name: true },
  });
}

/**
 * `PartyRole` is unique on (party_id, role), so a duplicated checkbox value in
 * the payload would fail the whole insert. Deduped here rather than trusted
 * from the form.
 */
function dedupeRoles(roles: PartyRoleKind[] | undefined): PartyRoleKind[] {
  return [...new Set(roles ?? [])];
}

import { slugify } from "../lib/slug";
import { ensureUniqueSlug } from "../services/slug-service";

function mapCompany(p: {
  id: string;
  name: string;
  legal_name: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  contacts: { id: string; party_id: string; person_name: string; job_title: string | null; phone: string | null; email: string | null }[];
  links: { id: string; party_id: string; kind: LinkKind; url: string; label: string | null; sort_order: number }[];
  roles?: { role: PartyRoleKind }[];
  _count?: { supplied_brands: number };
}): PartyData {
  return {
    id: p.id,
    name: p.name,
    legal_name: p.legal_name,
    address: p.address,
    notes: p.notes,
    is_active: p.is_active,
    created_at: p.created_at,
    updated_at: p.updated_at,
    deleted_at: p.deleted_at,
    contacts: p.contacts.map((ct) => ({
      id: ct.id,
      company_id: ct.party_id,
      contact_person: ct.person_name,
      contact_role: ct.job_title,
      phone_number: ct.phone,
      email: ct.email,
    })),
    links: p.links.map((l) => ({
      id: l.id,
      company_id: l.party_id,
      kind: l.kind,
      url: l.url,
      label: l.label,
      sort_order: l.sort_order,
    })),
    roles: p.roles?.map((r) => r.role) ?? [],
    _count: p._count ? { brands: p._count.supplied_brands } : undefined,
  };
}

const INCLUDE = {
  // Company-level contacts only — brand-scoped ones (PartyContact.brand_id
  // set) belong to the Brand form, not here.
  contacts: { where: { brand_id: null } },
  links: { orderBy: { sort_order: "asc" as const } },
  roles: true,
  // Supplier directory counts assigned/sold brands, not brands this Party
  // legally owns. The detail modal reads the same BrandSupplier relation.
  _count: { select: { supplied_brands: true } },
} as const;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const getCompaniesAction = createAction<undefined, PartyData[]>(
  async ({ ctx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const rows = await db.party.findMany({
      where: { deleted_at: null, type: "COMPANY" },
      include: INCLUDE,
      orderBy: { name: "asc" },
    });
    return rows.map(mapCompany);
  },
  { useTransaction: false }
);

export const createCompanyAction = createAction<PartyInput, PartyData>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    // `deleted_at: null` DAN case-insensitive — sama seperti index yang akan
    // menolaknya kalau cek ini keliru. Baris yang sudah dihapus sengaja tidak
    // menghalangi: sejak migrasi 20260818120000 ia juga tidak menghalangi di
    // database, jadi nama supplier yang pernah dihapus bisa dipakai lagi.
    const existing = await findLivePartyByName(tx, input.name.trim());
    if (existing) {
      throw new ActionError(
        `Nama "${existing.name}" sudah dipakai party lain.`,
        "CONFLICT"
      );
    }

    const contacts = input.contacts.filter((c) => c.contact_person.trim());
    const links = input.links.filter((l) => l.url.trim());

    // B3 (2026-08-18): name already passed `findLivePartyByName` above, but
    // two DIFFERENT names ("CV Abc" vs "CV. Abc") can normalise to the same
    // slug. Without this, that collided on `Party_slug_live_uniq` as a raw
    // Prisma error mid-keystroke (§7).
    const slug = await ensureUniqueSlug(slugify(input.name.trim()), async (candidate) =>
      Boolean(
        await tx.party.findFirst({
          where: { slug: candidate, deleted_at: null },
          select: { id: true },
        })
      )
    );

    const company = await tx.party.create({
      data: {
        name: input.name.trim(),
        slug,
        type: "COMPANY",
        legal_name: input.legal_name?.trim() || null,
        address: input.address?.trim() || null,
        notes: input.notes?.trim() || null,
        contacts: {
          create: contacts.map((c) => ({
            person_name: c.contact_person.trim(),
            job_title: c.contact_role?.trim() || null,
            phone: c.phone_number?.trim() || null,
            email: c.email?.trim() || null,
          })),
        },
        links: {
          create: links.map((l, i) => ({
            kind: l.kind,
            url: l.url.trim(),
            label: l.label?.trim() || null,
            sort_order: i,
          })),
        },
        roles: {
          create: dedupeRoles(input.roles).map((role) => ({ role })),
        },
      },
      include: INCLUDE,
    });

    await recordAudit(tx, {
      entity: "Party",
      entity_id: company.id,
      action: "CREATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? ctx.role },
    });

    return mapCompany(company);
  },
  { schema: CompanyInputSchema }
);

export const updateCompanyAction = createAction<
  { id: string; data: PartyInput },
  PartyData
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const existing = await tx.party.findUnique({ where: { id: input.id } });
    if (!existing || existing.deleted_at) throw new ActionError("Party not found", "NOT_FOUND");

    const nameConflict = await findLivePartyByName(tx, input.data.name.trim(), input.id);
    if (nameConflict) {
      throw new ActionError(
        `Nama "${nameConflict.name}" sudah dipakai party lain.`,
        "CONFLICT"
      );
    }

    const oldRow = await tx.party.findUnique({ where: { id: input.id } });

    const contacts = input.data.contacts.filter((c) => c.contact_person.trim());
    const links = input.data.links.filter((l) => l.url.trim());

    // Replace contacts and links (delete all, re-create) — simplest correct
    // approach. Only company-level contacts (brand_id null) are touched.
    await tx.partyContact.deleteMany({ where: { party_id: input.id, brand_id: null } });
    await tx.partyLink.deleteMany({ where: { party_id: input.id } });
    // Roles are replaced wholesale, same as contacts and links. `PartyRole` has
    // a unique on (party_id, role), so an upsert-per-role would be the only
    // alternative and it buys nothing: there is no data hanging off a role row.
    await tx.partyRole.deleteMany({ where: { party_id: input.id } });

    // B3 (2026-08-18): same slug-collision guard as create, above — and here
    // the row's OWN id must be excluded, or saving without changing the name
    // would collide with itself and pick up a spurious `-2`.
    const slug = await ensureUniqueSlug(slugify(input.data.name.trim()), async (candidate) =>
      Boolean(
        await tx.party.findFirst({
          where: { slug: candidate, deleted_at: null, id: { not: input.id } },
          select: { id: true },
        })
      )
    );

    const company = await tx.party.update({
      where: { id: input.id },
      data: {
        name: input.data.name.trim(),
        slug,
        legal_name: input.data.legal_name?.trim() || null,
        address: input.data.address?.trim() || null,
        notes: input.data.notes?.trim() || null,
        updated_at: new Date(),
        contacts: {
          create: contacts.map((c) => ({
            person_name: c.contact_person.trim(),
            job_title: c.contact_role?.trim() || null,
            phone: c.phone_number?.trim() || null,
            email: c.email?.trim() || null,
          })),
        },
        links: {
          create: links.map((l, i) => ({
            kind: l.kind,
            url: l.url.trim(),
            label: l.label?.trim() || null,
            sort_order: i,
          })),
        },
        roles: {
          create: dedupeRoles(input.data.roles).map((role) => ({ role })),
        },
      },
      include: INCLUDE,
    });

    if (oldRow) {
      const changes = diffFields(
        { name: oldRow.name, legal_name: oldRow.legal_name, address: oldRow.address, notes: oldRow.notes },
        { name: company.name, legal_name: company.legal_name, address: company.address, notes: company.notes },
        ["name", "legal_name", "address", "notes"],
      );
      if (Object.keys(changes).length > 0) {
        await recordAudit(tx, {
          entity: "Party",
          entity_id: company.id,
          action: "UPDATE",
          actor: { id: ctx.userId, name: ctx.user.name ?? ctx.role },
          changes,
        });
      }
    }

    return mapCompany(company);
  },
  { schema: z.object({ id: z.string(), data: CompanyInputSchema }) }
);

export const deleteCompanyAction = createAction<{ id: string }, { id: string }>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    // H3 (2026-08-18): was a Brand-only check — see `assertPartyDeletable`'s
    // doc comment for what this used to miss (WorkPrice, SkuPrice,
    // BrandSupplier) and why it never crashed while missing it.
    await assertPartyDeletable(tx, input.id);

    const deletedAt = new Date();
    await tx.party.update({
      where: { id: input.id },
      data: { deleted_at: deletedAt },
    });

    await recordAudit(tx, {
      entity: "Party",
      entity_id: input.id,
      action: "DELETE",
      actor: { id: ctx.userId, name: ctx.user.name ?? ctx.role },
      changes: { deleted_at: { from: null, to: deletedAt.toISOString() } },
    });

    return { id: input.id };
  },
  { schema: CompanyIdSchema }
);

// Brand -> Company backfill (P3-a) was removed 2026-08-10: it grouped Brand
// rows by `Brand.legal_name`, a column Master Data v2 no longer has — X6
// moved legal_name onto Party, the owner, not the Brand. There is nothing
// left to backfill from.

// ===========================================================================
// PartyContact CRUD (Phase 7)
// ===========================================================================

export type PartyContactRow = {
  id: string;
  party_id: string;
  contact_person: string;
  contact_role: string | null;
  phone: string | null;
  email: string | null;
  brand_id: string | null;
  brand_name: string | null;
};

const PartyContactInputSchema = z.object({
  partyId: z.string().min(1),
  contact_person: z.string().min(1, "Contact name required"),
  contact_role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  brand_id: z.string().nullable().optional(),
});

const PartyContactUpdateSchema = z.object({
  id: z.string().min(1),
  // H3/§17 (2026-08-18): optional, not required — every EXISTING caller
  // already knows which party's contact list it opened (the panel is
  // fetched via `getPartyContactsAction({ partyId })`), so this is free to
  // pass. Optional keeps any caller that genuinely can't supply it working;
  // when it IS passed, it's checked against the contact's actual
  // `party_id` below. Today's permission is global (`MASTERDATA_VENDOR_
  // MANAGE`, not per-party) so this is defense in depth, not the only
  // guard — but it is the one that stops a UI bug (or a party switched
  // mid-session) from silently editing the wrong party's contact.
  partyId: z.string().min(1).optional(),
  contact_person: z.string().min(1, "Contact name required"),
  contact_role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  brand_id: z.string().nullable().optional(),
});

const PartyContactDeleteSchema = z.object({
  id: z.string().min(1),
  partyId: z.string().min(1).optional(),
});

/**
 * SK2 (audit skema 2026-08-19) — `brand_id` sebelumnya diterima mentah dari
 * input create/update tanpa verifikasi brand itu benar-benar terkait ke
 * party ini. Skema tidak bisa menegakkan ini sendiri (constraint lintas dua
 * relasi independen — `PartyContact.party_id` vs `Brand.owner_party_id`/
 * `BrandSupplier` — tidak bisa dinyatakan Postgres tanpa trigger), jadi
 * dicek di sini: brand harus dimiliki ATAU dipasok oleh party yang sama
 * dengan kontak ini, kalau tidak ditolak sebelum tulis apa pun.
 */
async function assertBrandBelongsToParty(
  tx: PrismaTransaction,
  partyId: string,
  brandId: string
): Promise<void> {
  const brand = await tx.brand.findFirst({
    where: {
      id: brandId,
      deleted_at: null,
      OR: [{ owner_party_id: partyId }, { suppliers: { some: { party_id: partyId } } }],
    },
    select: { id: true },
  });
  if (!brand) {
    throw new ActionError("This brand is not linked to the selected party", "VALIDATION_FAILED");
  }
}

export const getPartyContactsAction = createAction<
  { partyId: string },
  PartyContactRow[]
>(
  async ({ input, ctx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const contacts = await db.partyContact.findMany({
      where: { party_id: input.partyId },
      include: { brand: { select: { name: true } } },
      orderBy: [{ is_primary: "desc" }, { person_name: "asc" }],
    });
    return contacts.map((c) => ({
      id: c.id,
      party_id: c.party_id,
      contact_person: c.person_name,
      contact_role: c.job_title,
      phone: c.phone,
      email: c.email,
      brand_id: c.brand_id,
      brand_name: c.brand?.name ?? null,
    }));
  },
  { useTransaction: false }
);

export const createPartyContactAction = createAction<
  { partyId: string; contact_person: string; contact_role?: string; phone?: string; email?: string; brand_id?: string | null },
  PartyContactRow
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    if (input.brand_id) {
      await assertBrandBelongsToParty(tx, input.partyId, input.brand_id);
    }
    const created = await tx.partyContact.create({
      data: {
        party_id: input.partyId,
        person_name: input.contact_person.trim(),
        job_title: input.contact_role?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        brand_id: input.brand_id ?? null,
      },
      include: { brand: { select: { name: true } } },
    });
    // Sampai 2026-08-18 CRUD ini tidak mencatat apa pun — pelanggaran langsung
    // terhadap kontrak "setiap tulis ke tabel master_data WAJIB lewat
    // recordAudit" di audit-service.ts. `entity_id` memakai id kontak, bukan
    // id party: kontak adalah baris sendiri, dan mencampurnya di bawah id party
    // membuat riwayat sebuah party memuat perubahan yang bukan miliknya.
    await recordAudit(tx, {
      entity: "PartyContact",
      entity_id: created.id,
      action: "CREATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? ctx.role },
      changes: { party_id: created.party_id, contact_person: created.person_name },
    });
    return {
      id: created.id,
      party_id: created.party_id,
      contact_person: created.person_name,
      contact_role: created.job_title,
      phone: created.phone,
      email: created.email,
      brand_id: created.brand_id,
      brand_name: created.brand?.name ?? null,
    };
  },
  { schema: PartyContactInputSchema }
);

export const updatePartyContactAction = createAction<
  { id: string; partyId?: string; contact_person: string; contact_role?: string; phone?: string; email?: string; brand_id?: string | null },
  PartyContactRow
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const existing = await tx.partyContact.findUnique({ where: { id: input.id } });
    if (!existing) throw new ActionError("Contact not found", "NOT_FOUND");
    if (input.partyId && existing.party_id !== input.partyId) {
      throw new ActionError("Contact does not belong to this party", "NOT_FOUND");
    }
    if (input.brand_id) {
      await assertBrandBelongsToParty(tx, existing.party_id, input.brand_id);
    }
    const updated = await tx.partyContact.update({
      where: { id: input.id },
      data: {
        person_name: input.contact_person.trim(),
        job_title: input.contact_role?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        brand_id: input.brand_id ?? null,
      },
      include: { brand: { select: { name: true } } },
    });
    const changes = diffFields(
      { person_name: existing.person_name, job_title: existing.job_title, phone: existing.phone, email: existing.email, brand_id: existing.brand_id },
      { person_name: updated.person_name, job_title: updated.job_title, phone: updated.phone, email: updated.email, brand_id: updated.brand_id },
      ["person_name", "job_title", "phone", "email", "brand_id"],
    );
    if (Object.keys(changes).length > 0) {
      await recordAudit(tx, {
        entity: "PartyContact",
        entity_id: updated.id,
        action: "UPDATE",
        actor: { id: ctx.userId, name: ctx.user.name ?? ctx.role },
        changes,
      });
    }
    return {
      id: updated.id,
      party_id: updated.party_id,
      contact_person: updated.person_name,
      contact_role: updated.job_title,
      phone: updated.phone,
      email: updated.email,
      brand_id: updated.brand_id,
      brand_name: updated.brand?.name ?? null,
    };
  },
  { schema: PartyContactUpdateSchema }
);

export const deletePartyContactAction = createAction<
  { id: string; partyId?: string },
  { id: string }
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const existing = await tx.partyContact.findUnique({ where: { id: input.id } });
    if (!existing) throw new ActionError("Contact not found", "NOT_FOUND");
    if (input.partyId && existing.party_id !== input.partyId) {
      throw new ActionError("Contact does not belong to this party", "NOT_FOUND");
    }
    await tx.partyContact.delete({ where: { id: input.id } });
    await recordAudit(tx, {
      entity: "PartyContact",
      entity_id: input.id,
      action: "DELETE",
      actor: { id: ctx.userId, name: ctx.user.name ?? ctx.role },
      changes: { party_id: existing.party_id, contact_person: existing.person_name },
    });
    return { id: input.id };
  },
  { schema: PartyContactDeleteSchema }
);
