/**
 * BQ — bentuk data yang menyeberang dari server ke komponen klien.
 *
 * Kenapa ada lapisan tipe sendiri dan bukan `Prisma.BqObjectGetPayload<…>`:
 * `Decimal` Prisma tidak bisa diserialisasi ke komponen klien Next.js, dan
 * mesin hitung bekerja dengan `number` (lihat kepala `lib/calc.ts`). Konversi
 * `Decimal -> number` terjadi TEPAT SEKALI, di `services/breakdown-service.ts`,
 * dan tipe di berkas ini adalah bentuk sesudah konversi itu.
 *
 * Kalau suatu hari ada komponen yang menerima `Decimal`, yang salah adalah
 * jalur datanya, bukan tipenya.
 */

import type {
  ObjectResult,
  ProjectTotals,
  PurchaseSummary,
  WasteSource,
} from "../lib/calc";
import type { BqMaterialReadiness as MasterDataBqMaterialReadiness } from "@/subapps/master-data/lib/bq-readiness";

export type BqLineSource = "MASTER_DATA" | "PROJECT_LOCAL";

export type BqProjectSummary = {
  id: string;
  code: string | null;
  name: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  notes: string | null;
  objectCount: number;
  createdAt: string;
  updatedAt: string | null;
  createdByName: string | null;
};

/** Baris bahan sebagaimana tersimpan — sebelum dihitung. Dipakai form edit,
 *  bukan tabel hasil. */
export type BqMaterialLineRecord = {
  id: string;
  subObjectId: string;
  skuId: string | null;
  skuPriceId: string | null;
  supplierPartyId: string | null;
  source: BqLineSource;
  qtyPerSub: number;
  wasteOverridePct: number | null;
  name: string;
  code: string | null;
  brandName: string | null;
  categoryPath: string | null;
  supplierName: string | null;
  usageUnit: string | null;
  purchaseUnit: string | null;
  conversion: number | null;
  price: number;
  currency: string;
  materialDefaultWastePct: number | null;
  categoryDefaultWastePct: number | null;
  minimumOrder: number | null;
  roundingIncrement: number;
  priceValidFrom: string | null;
  snapshotTakenAt: string;
  isManualOverride: boolean;
  overrideNote: string | null;
  sortOrder: number;
  notes: string | null;
};

export type BqServiceLineRecord = {
  id: string;
  subObjectId: string;
  workPriceId: string | null;
  vendorPartyId: string | null;
  source: BqLineSource;
  qtyPerSub: number;
  name: string;
  code: string | null;
  categoryPath: string | null;
  vendorName: string | null;
  rateUnit: string;
  price: number;
  currency: string;
  scopeNote: string | null;
  hasMaterial: boolean;
  priceValidFrom: string | null;
  snapshotTakenAt: string;
  isManualOverride: boolean;
  overrideNote: string | null;
  sortOrder: number;
  notes: string | null;
};

/** Object lengkap: hasil hitung + data mentah yang dibutuhkan form edit. */
export type BqObjectView = {
  computed: ObjectResult;
  wasteOverridePct: number | null;
  lockedAt: string | null;
  lockedByName: string | null;
  notes: string | null;
  sortOrder: number;
  subObjects: {
    id: string;
    name: string;
    qty: number;
    sortOrder: number;
    notes: string | null;
    librarySubObjectId: string | null;
    materials: BqMaterialLineRecord[];
    services: BqServiceLineRecord[];
  }[];
};

export type BqProjectView = {
  project: BqProjectSummary;
  objects: BqObjectView[];
  totals: ProjectTotals;
  purchase: PurchaseSummary;
};

// ---------------------------------------------------------------------------
// Picker master data
// ---------------------------------------------------------------------------

/**
 * Satu kandidat bahan dari Master Data, sudah digabung dengan profil BQ-nya.
 *
 * `readiness` adalah alasan sebuah SKU tidak bisa dipakai, bukan sekadar
 * boolean. Estimator yang melihat "no BQ profile" tahu harus ke
 * `/bq/settings`; yang melihat "no current price" tahu harus minta staff
 * mengisi harga di Master Data. Satu boolean `disabled` akan mengirim
 * keduanya ke tempat yang salah.
 */
export type BqMaterialCandidate = {
  skuId: string;
  code: string | null;
  name: string;
  brandName: string | null;
  categoryPath: string | null;
  baseUnit: string;
  profile: {
    usageUnit: string;
    purchaseUnit: string;
    conversion: number;
    defaultWastePct: number | null;
    minimumOrder: number | null;
    roundingIncrement: number;
  } | null;
  price: {
    skuPriceId: string;
    supplierPartyId: string | null;
    supplierName: string | null;
    unit: string;
    price: number;
    currency: string;
    validFrom: string;
  } | null;
  readiness: BqMaterialReadiness;
};

export type BqMaterialReadiness = MasterDataBqMaterialReadiness;

export type BqServiceCandidate = {
  workPriceId: string;
  code: string;
  name: string;
  categoryPath: string | null;
  vendorPartyId: string | null;
  vendorName: string | null;
  rateUnit: string;
  price: number;
  currency: string;
  scopeNote: string | null;
  hasMaterial: boolean;
  validFrom: string;
};

export type { ObjectResult, ProjectTotals, PurchaseSummary, WasteSource };
