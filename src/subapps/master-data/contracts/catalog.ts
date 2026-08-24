import { Prisma, Brand, PartyContact, BrandLink, LinkKind, PartyRoleKind, ProductType, PromotionRequest, Role, SkuStatus } from "@/generated/prisma";
// ↑ `Prisma` namespace kept ONLY for `Prisma.ProjectProductRequestGetPayload` (studioflow schema).
//   `Prisma.SkuGetPayload` and `Prisma.SampleGetPayload` (master_data schema) are
//   gone — replaced by hand-written DTOs. See contracts/sku-dto.ts (M4 step 2).
import type { SkuDto, SampleRowDto } from "./sku-dto";
import { z } from "zod";

/**
 * Legacy three-value catalog status: PENDING / APPROVED / REJECTED.
 *
 * NOT a Prisma enum any more, and that is the point. Master Data v2 stores
 * `Sku.status` as `SkuStatus` (DRAFT / ACTIVE / DISCONTINUED); this triple is
 * purely how the Library and Master Data UIs talk about the same thing, mapped
 * by `skuStatusToCatalogStatus` / `catalogStatusToSkuStatus` below.
 *
 * It used to be `enum LibraryItemStatus @@schema("studioflow")`. After v2 no
 * model referenced it, so Prisma stopped emitting it into the browser bundle
 * (`index-browser.js` only carries enums reachable from the datamodel) while
 * still emitting its TYPE — which type-checks fine and then explodes at module
 * evaluation in any client component: "Cannot read properties of undefined
 * (reading 'PENDING')". Declaring it here is what makes the value real on both
 * sides of the network boundary.
 *
 * Shaped as a const object + same-named type so call sites keep reading
 * `LibraryItemStatus.PENDING` exactly as before.
 */
export const LibraryItemStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type LibraryItemStatus =
  (typeof LibraryItemStatus)[keyof typeof LibraryItemStatus];


export type LibraryVendor = Brand & {
  scoped_contacts?: PartyContact[];
  links?: BrandLink[];
  /** Excel Table 1 column J — parties that sell this brand (`BrandSupplier`). */
  suppliers?: { party_id: string }[];
  /** Master Data v2: Party owning this Brand (was `company`). Null = unassigned. */
  owner?: {
    id: string;
    name: string;
    legal_name: string | null;
    address: string | null;
    /** Excel Table 1 column K, "Company Categories". */
    roles?: { role: PartyRoleKind }[];
  } | null;
  /**
   * Excel Table 1 "Category" — categories explicitly set at the Brand level
   * (source = SEED). Distinct from categories derived automatically from SKUs.
   */
  seed_categories?: { id: string; name: string }[];
};

/**
 * The caller's effective Library rights, resolved server-side from the permission
 * matrix. The UI gates on this instead of comparing role strings, so an affordance
 * can never be shown for an action the server will refuse.
 */
export type LibraryAccess = {
  role: Role;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageVendors: boolean;
  canManageBrands: boolean;
  canManageSamples: boolean;
  canProcessRequests: boolean;
  canRequestMaterial: boolean;
  canExport: boolean;
  /** May approve/reject Material curation. Admin-level (ADMIN, DEVELOPER) only. */
  canApproveMaterial: boolean;
  /** May approve/reject project-to-Master-Data promotion requests. */
  canApprovePromotions: boolean;
};

/**
 * One physical sample row, joined to its SKU and that SKU's brand.
 *
 * M4 step 2: was `Prisma.SampleGetPayload<{include:{sku:{...}}}>`.
 * Now uses the hand-written contract from `contracts/sku-dto.ts`.
 */
export type LibrarySampleRow = SampleRowDto;

/** Which categories a brand actually carries. A brand is not bound to one. */
export type BrandCategoryCoverage = Record<
  string,
  { category: string; section: ProductType; count: number }[]
>;

/**
 * A Sku loaded with everything the Library UI needs, Master Data v2 shape.
 *
 * v2 has no `catalog_*` columns on Sku — pricing lives in `SkuPrice`
 * (one current row per supplier; history in audit), images in `SkuMedia`,
 * categories in `SkuCategory` -> `Category`. The
 * `catalog_*` fields below are DERIVED by `attachDerivedCatalogFields`, kept
 * under their v1 names on purpose: `ProjectScheduleOption.data_snapshot` is
 * frozen JSON already written in these names for every existing project, and
 * ~20 UI files still read them. Reshaping the read model as well as the
 * underlying tables would have made this migration unreviewable.
 *
 * M4 step 2: was `Prisma.SkuGetPayload<{include: typeof SKU_FULL_INCLUDE}>`.
 * Now uses the hand-written contract from `contracts/sku-dto.ts`, so the
 * StudioFlow build no longer depends on master_data's generated Prisma schema.
 */
export type SkuWithRelations = SkuDto;

export type ProductCatalogWithRelations = SkuWithRelations & {
  catalog_brand: string;
  catalog_category: string;
  catalog_sub_category: string | null;
  catalog_tags: string[];
  catalog_sku: string;
  catalog_product_name: string;
  catalog_pattern: string | null;
  catalog_motif: string | null;
  catalog_color: string | null;
  catalog_finishing: string | null;
  catalog_dimension_p: string | null;
  catalog_dimension_l: string | null;
  catalog_dimension_t: string | null;
  catalog_dimension_unit: string | null;
  catalog_type: ProductType;
  catalog_status: LibraryItemStatus;
  catalog_image_url: string | null;
  catalog_image_thumbnail_url: string | null;
  catalog_image_original_url: string | null;
  catalog_reference_url: string | null;
  catalog_folder_url: string | null;
  catalog_price: number | null;
  catalog_price_unit: string | null;
  catalog_price_updated_at: Date | null;
  /**
   * Who is offering `catalog_price`. NULL means the manufacturer's own list
   * price rather than a shop's quote — a real distinction, not missing data.
   */
  catalog_price_supplier_id: string | null;
  catalog_price_supplier_name: string | null;
  /**
   * How many suppliers currently quote this SKU. `catalog_price` is the
   * cheapest of them. Exposed so a card can say "3 offers" instead of
   * presenting one shop's number as if it were the only one.
   */
  catalog_price_offer_count: number;
  catalog_metadata: Record<string, unknown> | null;
};

/** SkuKind (v2) -> legacy ProductType. FURNITURE/FIXTURE/SERVICE all read as "fixture". */
function skuKindToProductType(kind: string): ProductType {
  return kind === "MATERIAL" ? "material" : "fixture";
}

/** SkuStatus (v2: DRAFT/ACTIVE/DISCONTINUED) -> legacy LibraryItemStatus. */
export function skuStatusToCatalogStatus(status: SkuStatus): LibraryItemStatus {
  if (status === "ACTIVE") return LibraryItemStatus.APPROVED;
  if (status === "DISCONTINUED") return LibraryItemStatus.REJECTED;
  return LibraryItemStatus.PENDING;
}

/** Legacy LibraryItemStatus -> v2 SkuStatus. */
export function catalogStatusToSkuStatus(status: LibraryItemStatus): SkuStatus {
  if (status === LibraryItemStatus.APPROVED) return "ACTIVE";
  if (status === LibraryItemStatus.REJECTED) return "DISCONTINUED";
  return "DRAFT";
}

/**
 * True for a Prisma `Decimal` (decimal.js instance) without importing it.
 *
 * Pengenalan lewat bentuk, bukan `instanceof`: `Decimal` datang dari
 * `@prisma/client/runtime`, dan berkas ini sengaja tidak bergantung pada
 * runtime Prisma (lihat catatan M4 di `contracts/sku-dto.ts`). `d` adalah
 * penanda internal decimal.js — dipakai bersama `s` dan `e` supaya objek biasa
 * yang kebetulan punya `toFixed` tidak ikut tertangkap.
 */
function isDecimalLike(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof (v as { toFixed?: unknown }).toFixed === "function" &&
    "d" in v &&
    "s" in v &&
    "e" in v
  );
}

/**
 * Menyalin objek dengan setiap Decimal diubah jadi string, rekursif.
 *
 * `Date` sengaja dilewati apa adanya — Next.js bisa menyeberangkannya, dan
 * mengubahnya jadi string akan merusak setiap `toLocaleDateString()` di hilir.
 * Array dan objek biasa ditelusuri; sisanya dikembalikan tanpa disentuh.
 */
function serializeDecimalFields<T>(input: T): T {
  if (isDecimalLike(input)) return String(input) as unknown as T;
  if (input instanceof Date) return input;
  if (Array.isArray(input)) {
    return input.map((item) => serializeDecimalFields(item)) as unknown as T;
  }
  if (typeof input === "object" && input !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = serializeDecimalFields(value);
    }
    return out as T;
  }
  return input;
}

/** Adds the legacy `catalog_*` derived display fields to a freshly-loaded v2 Sku. */
export function attachDerivedCatalogFields<T extends SkuWithRelations>(
  sku: T
): T & ProductCatalogWithRelations {
  const spec = (sku.spec ?? {}) as Record<string, unknown>;
  // `prices` arrives ordered cheapest-first (SKU_FULL_INCLUDE), so index 0 is
  // the best current offer rather than an arbitrary row. Since suppliers became
  // real there can be several current prices for one SKU.
  const currentPrice = sku.prices[0];
  const media = sku.media;
  const findMedia = (kind: string) => media.find((m) => m.kind === kind)?.url ?? null;
  const primaryCategory =
    sku.categories.find((c) => c.is_primary)?.category.name ??
    sku.categories[0]?.category.name ??
    "";

  /**
   * ==========================================================================
   * SERIALISASI Decimal — jangan disederhanakan.
   * ==========================================================================
   * Prisma `Decimal` bukan objek biasa, dan React Server Components melempar
   * begitu ia sampai ke Client Component ("Only plain objects can be passed to
   * Client Components from Server Components").
   *
   * Komentar di sini dulu berbunyi *"`dim_*` are already handled above via
   * `.toString()`"* — **itu tidak benar, dan sudah lama tidak benar.** Yang
   * di-`.toString()` adalah `catalog_dimension_p/l/t`, yaitu SALINAN turunan.
   * Kolom aslinya (`dim_length`, `dim_width`, `dim_height`) tetap ikut lewat
   * `...sku` sebagai Decimal mentah. Dilaporkan owner 2026-08-14 sebagai tiga
   * dari empat error konsol.
   *
   * Pendekatannya sekarang GENERIK, bukan daftar nama kolom: apa pun yang
   * berperilaku seperti Decimal dikonversi. Daftar nama kolom adalah cara bug
   * ini lahir pertama kali — kolom baru ditambahkan, daftarnya tidak, dan
   * kegagalannya baru terlihat di runtime pada halaman yang jarang dibuka.
   *
   * Kasus nyatanya: `SkuPrice.price_list` dihapus dari skema 2026-08-14, tapi
   * pada database yang belum dimigrasi kolomnya MASIH ADA dan tetap terbawa —
   * error keempat yang dilaporkan owner. Serialiser generik menanganinya tanpa
   * perlu tahu namanya.
   */
  const serialized = serializeDecimalFields(sku);

  return {
    ...serialized,
    catalog_brand: sku.brand?.name ?? "",
    catalog_category: primaryCategory,
    catalog_sub_category: null,
    catalog_tags: sku.categories.map((c) => c.category.name),
    catalog_sku: sku.code ?? "",
    catalog_product_name: sku.name,
    catalog_pattern: typeof spec.pattern === "string" ? spec.pattern : null,
    catalog_motif: typeof spec.motif === "string" ? spec.motif : null,
    catalog_color: typeof spec.color === "string" ? spec.color : null,
    catalog_finishing: typeof spec.finishing === "string" ? spec.finishing : null,
    catalog_dimension_p: sku.dim_length?.toString() ?? null,
    catalog_dimension_l: sku.dim_width?.toString() ?? null,
    catalog_dimension_t: sku.dim_height?.toString() ?? null,
    catalog_dimension_unit: sku.dim_unit ?? null,
    catalog_type: skuKindToProductType(sku.kind),
    catalog_status: skuStatusToCatalogStatus(sku.status),
    catalog_image_url: findMedia("IMAGE"),
    catalog_image_thumbnail_url: findMedia("THUMBNAIL"),
    catalog_image_original_url: findMedia("ORIGINAL"),
    catalog_reference_url: findMedia("REFERENCE"),
    catalog_folder_url: findMedia("FOLDER"),
    catalog_price: currentPrice ? Number(currentPrice.price_net) : null,
    catalog_price_unit: currentPrice?.unit ?? null,
    catalog_price_updated_at: currentPrice?.updated_at ?? null,
    catalog_price_supplier_id: currentPrice?.supplier_party_id ?? null,
    catalog_price_supplier_name: currentPrice?.supplier?.name ?? null,
    catalog_price_offer_count: sku.prices.length,
    catalog_metadata: spec,
  };
}

/**
 * DIHAPUS 2026-08-18 — `sampleStatusToLegacy`.
 *
 * Fungsi ini memetakan lima nilai `SampleStatus` menjadi tiga dengan aturan
 * "apa pun selain AVAILABLE adalah BORROWED", dan sudah tidak dipanggil dari
 * mana pun (dicek dengan grep ke seluruh `src/` pada tanggal itu). Ia dihapus
 * bersama kembarannya di `subapps/master-data` karena alasan yang sama: enum
 * schema kini sama persis dengan enum database, jadi tidak ada yang perlu
 * diterjemahkan — dan penerjemah yang menganggur adalah undangan untuk
 * memakainya lagi.
 */

/**
 * Nilai status sample yang boleh dikirim dari input katalog.
 *
 * Sengaja TIDAK memasukkan LOST dan DISCARDED: keduanya keadaan akhir yang
 * ditetapkan lewat layar rak sample (`/masterdata/samples`), bukan lewat form
 * katalog material. Form katalog mendaftarkan benda yang ADA.
 */
export type CatalogSampleStatus = "AVAILABLE" | "BORROWED" | "SENT_TO_CLIENT";

export type ProjectProductRequestWithDetails = Prisma.ProjectProductRequestGetPayload<{
  include: {
    requested_by: true,
    project: true,
    schedule_entry: true,
    schedule_option: true
  };
}> & {
  /** Master Data terputus dari StudioFlow (M5) — brand/sku dibaca dari snapshot,
   *  bukan relasi Prisma. Lihat `brand_name_snapshot`/`sku_name_snapshot`. */
  brand: { id: string; name: string } | null;
  sku: { id: string; name: string } | null;
};

export type VendorContactInput = {
  id?: string;
  contact_person: string;
  contact_role: string;
  phone_number?: string;
  email?: string;
};

export type BrandLinkInput = {
  id?: string;
  kind: LinkKind;
  url: string;
  label?: string;
};

export type LibraryVendorInput = {
  brand_name: string;
  legal_name?: string;
  address?: string;
  notes?: string;
  /** Replaces the fixed website_url/instagram_url pair — a brand has any number. */
  links?: BrandLinkInput[];
  contacts: VendorContactInput[];
  /** Master Data v2: owning Party id. Null/undefined = unassigned. */
  company_id?: string | null;
  /**
   * Excel Table 1 column J, "Supplier's Company" — *"perusahaan yg menjual
   * produk ini"*. Which parties sell this brand, as opposed to which party
   * OWNS it (`company_id`). Ace Hardware sells TACO; it does not own it.
   *
   * Undefined means "leave as is"; an empty array clears the list.
   */
  supplier_party_ids?: string[];
  /**
   * Excel Table 1 "Category" — categories explicitly assigned to this brand
   * (stored with source = SEED in BrandCategory). The brand's declared product
   * domains (e.g. ["HPL", "SPC"]), independent of which SKUs it carries.
   *
   * Undefined = leave as is; empty array = clears all SEED categories.
   */
  brand_category_tags?: string[];
  /**
   * Free-form hashtags (owner feedback 2026-08-18, item 5) — general, awam
   * terms like "batu", "tegel murah", "finishing lantai", separate from the
   * curated Category checklist above. Stored directly on `Brand.tags`, no
   * join table (see migration `20260818090000_add_brand_tags`).
   *
   * Undefined = leave as is; empty array = clears all tags.
   */
  tags?: string[];
};

export type PhysicalSampleInput = {
  id?: string;
  catalog_rack_number: string;
  catalog_box_number: string;
  catalog_notes?: string;
  catalog_status?: CatalogSampleStatus;
  current_borrower_name?: string;
};

export type ProductCatalogInput = {
  brand_id?: string;
  /** Typed-in brand when the picker has no match; resolved or created server-side. */
  vendor_name?: string;
  /** Commercial brand; separate from the relational Vendor above. */
  catalog_brand: string;
  /** Category NAME. The service resolves it to a `master_data.Category` row,
   *  creating one on first use — the same resolve-or-create the brand picker
   *  has always used. The form keeps sending a string. */
  catalog_category?: string;
  catalog_type?: ProductType; // material or fixture
  /** Sub-category NAME. Kept as a field for form compatibility; v2 has no
   *  sub-category concept — always resolves to null. */
  catalog_sub_category?: string;
  catalog_sku: string;
  catalog_product_name: string;
  catalog_pattern?: string;
  catalog_motif?: string;
  catalog_tags?: string[];
  catalog_dimension_p?: string;
  catalog_dimension_l?: string;
  catalog_dimension_t?: string;
  catalog_dimension_unit?: string;
  catalog_color?: string;
  catalog_finishing?: string;
  catalog_image_url?: string;
  catalog_image_thumbnail_url?: string;
  catalog_image_original_url?: string;
  catalog_reference_url?: string;
  catalog_folder_url?: string;
  catalog_metadata?: Record<string, unknown>;
  catalog_status?: LibraryItemStatus;
  /**
   * Satu harga yang berlaku, dipakai BQ apa adanya.
   * `catalog_vendor_price` (harga sebelum diskon) dihapus 2026-08-14.
   */
  catalog_price?: number | null;
  catalog_price_unit?: string | null;
  /**
   * Which Party is quoting the price above. NULL = the manufacturer's own list
   * price rather than a shop's offer — the distinction `SkuPrice_pair_uniq`
   * encodes with its COALESCE sentinel.
   *
   * `undefined` and `null` differ here, as everywhere else in this input type:
   * omitted means "leave the supplier as it is", explicit null means "this is a
   * list price, detach it from any shop".
   */
  supplier_party_id?: string | null;
  // ── BQ costing fields (moved from BqMaterialProfile → Sku, 2026-08-19) ──
  usage_unit?: string | null;
  purchase_unit?: string | null;
  conversion?: number | null;
  default_waste_pct?: number | null;
  minimum_order?: number | null;
  rounding_increment?: number | null;
  // We'll handle physical samples as an optional nested creation/update
  samples?: PhysicalSampleInput[];
};

export type ProjectProductRequestInput = {
  project_id: string;
  /** §6.14 Brand-First Library: the entry point for a new request. */
  brand_id?: string;
  sku_id?: string;
  schedule_entry_id?: string;
  schedule_option_id?: string;
  custom_product_name?: string;
  reference_url?: string;
  cover_url?: string;
  original_url?: string;
  area_location?: string;
  is_scheduled?: boolean;
  notes?: string;
  linked_sample_id?: string;
};

/**
 * §6.14 / PLAN-LIBRARY-BRAND-FIRST.md §9 step 6. What STAFF fills in when a
 * requested item physically arrives — this is the ONLY place a Sku is
 * allowed to originate from a StudioFlow-initiated request. catalog_sku is
 * required here (not at request time) because the article code can only be
 * read off a physical box once it exists.
 */
export type ReceiveProductRequestInput = {
  request_id: string;
  catalog_sku: string;
  catalog_product_name: string;
  catalog_color?: string | null;
  catalog_motif?: string | null;
  catalog_finishing?: string | null;
  rack_number: string;
  box_number: string;
  quantity?: number;
  location_note?: string | null;
};

export const ProductMetadataSchema = z.record(z.string(), z.unknown());
export const LibraryItemStatusSchema = z.nativeEnum(LibraryItemStatus);

/**
 * Strict validation for Product Catalog according to Extension_rule.md
 */
const ProductCatalogBaseSchema = z.object({
  catalog_category: z.string().optional(),
  catalog_tags: z.array(z.string()).optional(),
  catalog_color: z.string().optional(),
  catalog_finishing: z.string().optional(),
  catalog_motif: z.string().optional(),
  catalog_sku: z.string().trim().min(1, "Article code is required"),
  catalog_product_name: z.string().trim().min(1, "Product name is required"),
  // Brand is OPTIONAL (Q7): Excel Table 2 column D allows generic stock with no
  // brand, and `Sku.brand_id` is nullable to match. Requiring it here is what
  // used to force "plywood 9mm" under a junk brand named "-".
  catalog_brand: z.string().trim().optional(),
  catalog_image_url: z.string().optional(),
  catalog_type: z.nativeEnum(ProductType),
  brand_id: z.string().optional(),
  vendor_name: z.string().optional(),
  supplier_party_id: z.string().nullable().optional(),
});

const hasCategoryTag = (data: {
  catalog_category?: string;
  catalog_tags?: string[];
}) =>
  Boolean(data.catalog_category?.trim()) ||
  Boolean(data.catalog_tags?.some((tag) => tag.trim()));

export const ProductCatalogValidationSchema = ProductCatalogBaseSchema.refine(
  hasCategoryTag,
  {
    message: "At least one category tag is required",
    path: ["catalog_tags"],
  }
);

/**
 * Hyper-Strict validation for Catalog Approval (Source of Truth)
 */
/**
 * Approval is stricter than draft, but NOT on brand.
 *
 * It used to require `brand_id`, which made approving generic stock impossible
 * — the same Q7 contradiction that `Sku.brand_id` being nullable was meant to
 * settle. What approval actually needs is an identity someone can order
 * against and a category it can be found under; a brand is neither, and
 * "plywood 9mm" has no brand to give.
 */
export const CatalogApprovalValidationSchema = ProductCatalogBaseSchema.extend({
  catalog_product_name: z.string().trim().min(1, "Product name is required before approval"),
}).refine(
  (data) =>
    hasCategoryTag(data),
  {
    message: "At least one category tag is required before approval",
    path: ["catalog_tags"],
  }
);

/**
 * Type-specific assertions for material vs fixture
 */
export const ProductTypeAssertionSchema = z.object({
  catalog_type: z.nativeEnum(ProductType),
  schedule_qty: z.number().optional(),
  schedule_location: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.catalog_type === "material") {
    if (data.schedule_qty !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Materials FORBID qty",
        path: ["schedule_qty"]
      });
    }
  } else if (data.catalog_type === "fixture") {
    // Note: These are required only in SNAPSHOT context
    // This schema will be used contextually by the service layer
  }
});

export type PromotionRequestWithDetails = PromotionRequest;
