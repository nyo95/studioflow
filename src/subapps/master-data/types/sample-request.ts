/**
 * Master Data — sample request domain types.
 *
 * A ProjectProductRequest is filed by a designer in StudioFlow and worked by
 * staff in Master Data. These types are the Master Data view of that row: flat,
 * display-ready, and free of Prisma payload generics so the client component
 * does not depend on the generated client.
 */

export type SampleRequestStatus =
  | "REQUESTED"
  | "IN_PROGRESS"
  | "RECEIVED"
  | "UNAVAILABLE";

export type SampleRequestData = {
  id: string;
  status: SampleRequestStatus;

  /** What was asked for. custom_product_name when no Sku exists yet. */
  itemName: string;
  areaLocation: string | null;
  referenceUrl: string | null;
  notes: string | null;

  /** Brand the request is made against — the brand-first entry point (§6.14). */
  brandId: string | null;
  brandName: string | null;
  companyName: string | null;
  /** Contacts inherited from the brand, so staff can call without leaving the page. */
  brandContacts: {
    contact_person: string;
    contact_role: string | null;
    phone_number: string | null;
    email: string | null;
  }[];

  /** Filled once the item is received and racked. */
  skuId: string | null;
  skuCode: string | null;
  skuProductName: string | null;

  projectId: string;
  projectName: string;
  requestedByName: string;
  requestedAt: Date;

  /** Vendor follow-up, written from Master Data. */
  vendorContactedBy: string | null;
  vendorContactedAt: Date | null;
  vendorQuotedPrice: number | null;
  vendorQuotedUnit: string | null;
  vendorNotes: string | null;

  /** Physical sample, once received. */
  linkedSampleId: string | null;
  updatedAt: Date;
};

/** Payload for the "hubungi vendor" step — moves REQUESTED → IN_PROGRESS. */
export type VendorFollowUpInput = {
  requestId: string;
  vendorContactedAt: string | null;
  vendorQuotedPrice: number | string | null;
  vendorQuotedUnit: string;
  vendorNotes: string;
  /**
   * When true and a price is present, upsert a master_data.MaterialPrice row
   * so the quote lands in the pricing SSOT without re-entry.
   */
  syncToMaterialPrice: boolean;
};

/** Payload for the "sample diterima" step — moves to RECEIVED. */
export type ReceiveSampleInput = {
  requestId: string;
  catalogSku: string;
  catalogProductName: string;
  catalogColor: string;
  catalogMotif: string;
  catalogFinishing: string;
  rackNumber: string;
  boxNumber: string;
  quantity: number;
  locationNote: string;
};

/** Payload for marking a request unfulfillable. */
export type MarkUnavailableInput = {
  requestId: string;
  reason: string;
};
