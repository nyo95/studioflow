/**
 * Master Data — physical sample library types.
 *
 * A Sample is a physical object sitting in a rack. It hangs off a Sku and
 * nothing else: brand, category and price are all reachable through that Sku,
 * so duplicating them here would only create drift.
 *
 * Sample and MaterialPrice are siblings, not a chain — one Sku can have three
 * physical pieces in three racks and two prices from two suppliers, and neither
 * side needs to know about the other. BQ never reads this table: a piece of
 * tile in the office has no bearing on cost.
 */

/**
 * Lima nilai, sama persis dengan `master_data.SampleStatus`.
 *
 * Sampai 2026-08-18 tipe ini hanya punya tiga, dan `toLegacySampleStatus`
 * menjejalkan lima nilai database ke dalamnya dengan aturan "apa pun selain
 * AVAILABLE adalah BORROWED". Akibatnya sample HILANG tampil identik dengan
 * sample yang dipinjam staf — pada satu-satunya layar yang menjawab
 * "benda ini di mana". Tidak ada lagi pemetaan; nilai database ditampilkan apa
 * adanya.
 */
export type SampleStatusValue =
  | "AVAILABLE"
  | "BORROWED"
  | "SENT_TO_CLIENT"
  | "LOST"
  | "DISCARDED";

/**
 * Status yang berarti "benda sedang dipegang orang", jadi WAJIB menyebut nama.
 * LOST dan DISCARDED sengaja di luar daftar: benda yang hilang tidak dipegang
 * siapa-siapa, dan memaksa mengisi nama peminjam untuk menandainya hilang
 * adalah cara staf berhenti menandainya sama sekali.
 */
export const SAMPLE_STATUS_NEEDS_HOLDER = ["BORROWED", "SENT_TO_CLIENT"] as const;

export function sampleStatusNeedsHolder(status: SampleStatusValue): boolean {
  return (SAMPLE_STATUS_NEEDS_HOLDER as readonly string[]).includes(status);
}

export type SampleData = {
  id: string;

  /** Where it physically is. Normalised to upper case on write. */
  rackNumber: string;
  boxNumber: string;
  locationNote: string | null;
  quantity: number;

  status: SampleStatusValue;
  /** Free text: borrowers include clients and contractors with no User row. */
  borrowerName: string | null;
  borrowedAt: Date | null;

  notes: string | null;

  /** Identity, via Sku. Everything else about the product joins from here. */
  skuId: string;
  skuCode: string;
  skuProductName: string;
  skuColor: string | null;
  skuMotif: string | null;
  skuFinishing: string | null;

  brandId: string | null;
  brandName: string | null;
  companyName: string | null;

  createdAt: Date;
  updatedAt: Date;
};

export type SampleInput = {
  skuId: string;
  rackNumber: string;
  boxNumber: string;
  locationNote: string;
  quantity: number | string;
  notes: string;
};

export type SampleStatusInput = {
  sampleId: string;
  status: SampleStatusValue;
  /** Required when status is not AVAILABLE — an item that is out must name who has it. */
  borrowerName: string;
  notes: string;
};

/** Aggregate shown above the table so staff can see the shelf at a glance. */
export type SampleLibrarySummary = {
  total: number;
  available: number;
  borrowed: number;
  sentToClient: number;
  /** LOST + DISCARDED. Sebelum 2026-08-18 keduanya terhitung sebagai `borrowed`. */
  offShelf: number;
  rackCount: number;
};
