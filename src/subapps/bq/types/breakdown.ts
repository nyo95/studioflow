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
} from "../lib/calc";
import type { BqMaterialReadiness as MasterDataBqMaterialReadiness } from "@/subapps/master-data/lib/bq-readiness";

export type BqLineSource = "MASTER_DATA" | "PROJECT_LOCAL";

/**
 * Pos biaya baris L3 — cermin `BqCostCategory` di Prisma, mengikuti kolom
 * KATEGORI pada template BQ kantor.
 *
 * Ini lapisan PELAPORAN, bukan pengganti pemisahan bahan/jasa: bahan menunjuk
 * SKU dan jasa menunjuk WorkPrice, dan itu tetap. Kategori menjawab "uang ini
 * masuk pos apa" — dan tiga yang terakhir memang tidak punya padanan di
 * Master Data, jadi harganya diketik per project.
 */
export type BqCostCategory =
  | "MATERIAL"
  | "UPAH"
  | "ALAT"
  | "BIAYA_UMUM"
  | "TRANSPORT_AKOMODASI";

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
  /** Tepat satu induk terisi: item langsung (L1) ATAU sub-item (L2). */
  objectId: string | null;
  subObjectId: string | null;
  /** Pos biaya untuk rekap — lihat `BqCostCategory`. */
  costCategory: BqCostCategory;
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
  snapshotTakenAt: string;
  isManualOverride: boolean;
  overrideNote: string | null;
  sortOrder: number;
  notes: string | null;
};

export type BqServiceLineRecord = {
  id: string;
  /** Tepat satu induk terisi: item langsung (L1) ATAU sub-item (L2). */
  objectId: string | null;
  subObjectId: string | null;
  /** Pos biaya untuk rekap — lihat `BqCostCategory` di Prisma. */
  costCategory: BqCostCategory;
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
  snapshotTakenAt: string;
  isManualOverride: boolean;
  overrideNote: string | null;
  sortOrder: number;
  notes: string | null;
};

/** Object lengkap: hasil hitung + data mentah yang dibutuhkan form edit. */
export type BqObjectView = {
  computed: ObjectResult;
  /** Divisi atau seksi induk. NULL = item tidak dikelompokkan. */
  sectionId: string | null;
  /** Baris yang menempel LANGSUNG ke item ini, tanpa lewat L2. */
  materials: BqMaterialLineRecord[];
  services: BqServiceLineRecord[];
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

/**
 * Seksi cetak (L0) beserta subtotalnya.
 *
 * `subtotal` DIHITUNG di server dari object di dalamnya, sama seperti seluruh
 * angka lain di subapp ini — tidak ada satu pun penjumlahan biaya yang hidup
 * di klien (PRD Bab 6).
 */
/**
 * Pengelompok cetak. Dua lapis dengan bentuk yang sama:
 *
 *   parentId === null  -> SEKSI  "A PRELIMINARIES"   (SUBTOTAL A)
 *   parentId !== null  -> DIVISI "I Floor Works"     (SUBTOTAL B.I)
 *
 * Keduanya tidak punya qty maupun harga satuan — itu milik item (L1). Satu
 * tipe untuk keduanya karena perilakunya memang identik; yang membedakan cuma
 * posisinya di pohon.
 */
export type BqSectionView = {
  id: string;
  parentId: string | null;
  code: string | null;
  name: string;
  sortOrder: number;
  notes: string | null;
  /** Σ total item di dalamnya, TERMASUK yang lewat divisi anak. */
  subtotal: number;
  /** Item langsung di bawahnya (tidak menghitung isi divisi anak). */
  objectCount: number;
};

export type BqProjectView = {
  project: BqProjectSummary;
  /** Urut `sort_order`. Kosong pada BQ yang tidak memakai seksi. */
  sections: BqSectionView[];
  objects: BqObjectView[];
  totals: ProjectTotals;
};

// ---------------------------------------------------------------------------
// Picker master data
// ---------------------------------------------------------------------------

/**
 * Satu kandidat bahan dari Master Data.
 *
 * `readiness` adalah alasan sebuah SKU tidak bisa dipakai, bukan sekadar
 * boolean. Pada mode koefisien, gate-nya sederhana: harus ada harga aktif
 * dengan unit yang jelas.
 */
export type BqMaterialCandidate = {
  skuId: string;
  code: string | null;
  name: string;
  brandName: string | null;
  categoryPath: string | null;
  baseUnit: string;
  priceOptions: Array<{
    skuPriceId: string;
    supplierPartyId: string | null;
    supplierName: string | null;
    unit: string;
    price: number;
    currency: string;
    updatedAt: string | null;
  }>;
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
  updatedAt: string | null;
};

export type { ObjectResult, ProjectTotals };
