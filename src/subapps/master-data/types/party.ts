import type { LinkKind, PartyRoleKind } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Party domain types — Master Data v2. Renamed from Company 2026-08-11:
// manufacturers, suppliers, service vendors and clients are all `Party` rows
// distinguished by `PartyRole`, and there is no `Company` model to name.
// ---------------------------------------------------------------------------

export type PartyContactData = {
  id: string;
  company_id: string;
  contact_person: string;
  contact_role: string | null;
  phone_number: string | null;
  email: string | null;
};

export type PartyLinkData = {
  id: string;
  company_id: string;
  kind: LinkKind;
  url: string;
  label: string | null;
  sort_order: number;
};

/**
 * Excel Table 1 column K, "Company Categories":
 * *(supplier, subcon, vendor, retail store, manufacture)*.
 *
 * This is what tells the pricing forms which parties may be picked as a
 * supplier, and it is what §Halaman baris 39–43 wants the Suppliers page split
 * by. A Party can carry several — Ace Hardware is both RETAIL and SUPPLIER.
 */
export const PARTY_ROLE_LABEL: Record<PartyRoleKind, string> = {
  SUPPLIER: "Supplier",
  SUBCON: "Subcon",
  SERVICE_VENDOR: "Vendor",
  RETAIL: "Retail store",
  MANUFACTURER: "Manufacturer",
  DISTRIBUTOR: "Distributor",
};

/** The five Excel names, in the order Table 1 lists them. */
export const PARTY_ROLE_ORDER: PartyRoleKind[] = [
  "SUPPLIER",
  "SUBCON",
  "SERVICE_VENDOR",
  "RETAIL",
  "MANUFACTURER",
  "DISTRIBUTOR",
];

export type PartyData = {
  id: string;
  name: string;
  legal_name: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  contacts: PartyContactData[];
  links: PartyLinkData[];
  roles: PartyRoleKind[];
  _count?: { brands: number };
};

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export type PartyContactInput = {
  id?: string;
  contact_person: string;
  contact_role: string;
  phone_number: string;
  email: string;
};

export type PartyLinkInput = {
  id?: string;
  kind: LinkKind;
  url: string;
  label: string;
};

export type PartyInput = {
  name: string;
  legal_name: string;
  address: string;
  notes: string;
  contacts: PartyContactInput[];
  links: PartyLinkInput[];
  /** Excel Table 1 column K. Empty is allowed — a party that only owns brands. */
  roles: PartyRoleKind[];
};
