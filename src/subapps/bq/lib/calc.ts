/**
 * BQ — mesin hitung koefisien.
 *
 * Mode yang berlaku sekarang sederhana: estimator menilai sendiri koefisien
 * pemakaian dari gambar kerja / 3D / pengecekan manual, lalu BQ hanya
 * mengalikan koefisien itu dengan harga snapshot pada unit yang sama.
 *
 * Tidak ada kalkulasi otomatis pemakaian lembar -> sqm, tidak ada waste
 * tersembunyi, dan tidak ada purchase summary otomatis di layar kerja.
 */

// ---------------------------------------------------------------------------
// Tipe masukan
// ---------------------------------------------------------------------------

export type MaterialLineInput = {
  id: string;
  skuId: string | null;
  name: string;
  /** Disimpan untuk provenance snapshot; tidak dipakai menghitung otomatis. */
  usageUnit: string | null;
  /** Unit harga yang dipakai estimator untuk menulis koefisien. */
  purchaseUnit: string | null;
  /** Tetap dibawa untuk snapshot historis, tetapi tidak dipakai di mode ini. */
  conversion: number | null;
  /** Harga snapshot per unit harga. */
  pricePerPurchaseUnit: number;
  /** Koefisien untuk SATU sub-object, dalam unit harga. */
  qtyPerSub: number;
  /** Field historis — tidak dipakai pada mode koefisien. */
  wasteOverridePct: number | null;
  materialDefaultWastePct: number | null;
  categoryDefaultWastePct: number | null;
  minimumOrder: number | null;
  roundingIncrement: number | null;
};

export type ServiceLineInput = {
  id: string;
  workPriceId: string | null;
  name: string;
  /** Satuan tarif snapshot. */
  rateUnit: string;
  /** Tarif snapshot per unit. */
  pricePerRateUnit: number;
  /** Koefisien untuk SATU sub-object. */
  qtyPerSub: number;
};

export type SubObjectInput = {
  id: string;
  name: string;
  /** Pengali L2 — berapa banyak sub-object ini di dalam 1 object. */
  qty: number;
  materials: MaterialLineInput[];
  services: ServiceLineInput[];
};

export type ObjectInput = {
  id: string;
  name: string;
  code: string | null;
  qty: number;
  unit: string;
  /** Field historis — tidak dipakai pada mode koefisien. */
  wasteOverridePct: number | null;
  /**
   * Baris yang menempel LANGSUNG ke item ini, tanpa lewat L2.
   *
   * Koefisiennya dibaca per SATU unit item, sama seperti baris di dalam L2
   * dengan pengali 1 — itu sebabnya `computeMaterialLine` dipanggil dengan
   * qty 1 di bawah. Item sederhana ("Screeding Base": semen, pasir, tukang
   * per sqm) memakai jalur ini; item komposit memakai L2.
   */
  materials: MaterialLineInput[];
  services: ServiceLineInput[];
  subObjects: SubObjectInput[];
};

// ---------------------------------------------------------------------------
// Tipe keluaran
// ---------------------------------------------------------------------------

export type MaterialLineResult = {
  lineId: string;
  skuId: string | null;
  name: string;
  unit: string | null;
  qtyPerSub: number;
  /** Sudah dikali `L2.qty`, BELUM dikali `L1.qty`. */
  qtyTotal: number;
  pricePerUnit: number;
  cost: number;
};

export type ServiceLineResult = {
  lineId: string;
  workPriceId: string | null;
  name: string;
  rateUnit: string;
  qtyPerSub: number;
  qtyTotal: number;
  pricePerRateUnit: number;
  cost: number;
};

export type SubObjectResult = {
  subObjectId: string;
  name: string;
  qty: number;
  materials: MaterialLineResult[];
  services: ServiceLineResult[];
  materialsSubtotal: number;
  servicesSubtotal: number;
  /** Untuk 1 object. Sudah termasuk pengali L2. */
  subtotal: number;
  lineCount: number;
};

export type ObjectResult = {
  objectId: string;
  name: string;
  code: string | null;
  qty: number;
  unit: string;
  /** Hasil hitung baris yang menempel langsung di L1. */
  materials: MaterialLineResult[];
  services: ServiceLineResult[];
  /** Subtotal baris langsung; isi sub-object tetap ada pada hasilnya sendiri. */
  materialsSubtotal: number;
  servicesSubtotal: number;
  subObjects: SubObjectResult[];
  /** Harga satuan object: jumlah biaya seluruh baris L4 untuk satu unit L3. */
  ratePerUnit: number;
  /** `ratePerUnit x qty`. */
  total: number;
  subObjectCount: number;
  lineCount: number;
};

export type ProjectTotals = {
  objects: ObjectResult[];
  /** Σ total object. */
  grandTotal: number;
};

// ---------------------------------------------------------------------------
// L3
// ---------------------------------------------------------------------------

export function computeMaterialLine(
  line: MaterialLineInput,
  subObjectQty: number
): MaterialLineResult {
  const unit =
    line.purchaseUnit?.trim() || line.usageUnit?.trim() || null;
  const qtyTotal = line.qtyPerSub * subObjectQty;

  return {
    lineId: line.id,
    skuId: line.skuId,
    name: line.name,
    unit,
    qtyPerSub: line.qtyPerSub,
    qtyTotal,
    pricePerUnit: line.pricePerPurchaseUnit,
    cost: qtyTotal * line.pricePerPurchaseUnit,
  };
}

export function computeServiceLine(
  line: ServiceLineInput,
  subObjectQty: number
): ServiceLineResult {
  const qtyTotal = line.qtyPerSub * subObjectQty;
  return {
    lineId: line.id,
    workPriceId: line.workPriceId,
    name: line.name,
    rateUnit: line.rateUnit,
    qtyPerSub: line.qtyPerSub,
    qtyTotal,
    pricePerRateUnit: line.pricePerRateUnit,
    cost: qtyTotal * line.pricePerRateUnit,
  };
}

// ---------------------------------------------------------------------------
// L2 dan L1
// ---------------------------------------------------------------------------

export function computeSubObject(sub: SubObjectInput): SubObjectResult {
  const materials = sub.materials.map((m) => computeMaterialLine(m, sub.qty));
  const services = sub.services.map((s) => computeServiceLine(s, sub.qty));
  const materialsSubtotal = materials.reduce((acc, m) => acc + m.cost, 0);
  const servicesSubtotal = services.reduce((acc, s) => acc + s.cost, 0);
  const subtotal = materialsSubtotal + servicesSubtotal;

  return {
    subObjectId: sub.id,
    name: sub.name,
    qty: sub.qty,
    materials,
    services,
    materialsSubtotal,
    servicesSubtotal,
    subtotal,
    lineCount: materials.length + services.length,
  };
}

export function computeObject(obj: ObjectInput): ObjectResult {
  // Pengali 1: koefisien baris langsung sudah dinyatakan per satu unit item.
  // Tidak ada lapis L2 di jalur ini, jadi tidak ada yang perlu dikalikan.
  const materials = obj.materials.map((m) => computeMaterialLine(m, 1));
  const services = obj.services.map((s) => computeServiceLine(s, 1));
  const subObjects = obj.subObjects.map((s) => computeSubObject(s));
  const materialsSubtotal = materials.reduce((acc, m) => acc + m.cost, 0);
  const servicesSubtotal = services.reduce((acc, s) => acc + s.cost, 0);

  // Kedua jalur dijumlahkan, dan sebuah item boleh memakai keduanya sekaligus:
  // kabinet dengan sub-rakitan Body/Pintu, plus sekrup dan lem yang tidak
  // masuk akal dipecah ke salah satunya.
  const directCost = materialsSubtotal + servicesSubtotal;
  const ratePerUnit =
    directCost + subObjects.reduce((acc, s) => acc + s.subtotal, 0);

  return {
    objectId: obj.id,
    name: obj.name,
    code: obj.code,
    qty: obj.qty,
    unit: obj.unit,
    materials,
    services,
    materialsSubtotal,
    servicesSubtotal,
    subObjects,
    ratePerUnit,
    total: ratePerUnit * obj.qty,
    subObjectCount: subObjects.length,
    lineCount:
      materials.length +
      services.length +
      subObjects.reduce((acc, s) => acc + s.lineCount, 0),
  };
}

export function computeProject(objects: ObjectInput[]): ProjectTotals {
  const results = objects.map(computeObject);
  const grandTotal = results.reduce((acc, o) => acc + o.total, 0);

  return {
    objects: results,
    grandTotal,
  };
}

// ---------------------------------------------------------------------------
// Tampilan
// ---------------------------------------------------------------------------

export function roundRupiah(value: number): number {
  return Math.round(value);
}

export function formatIdr(value: number, currency = "IDR"): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(roundRupiah(value));
}

export function formatQty(value: number, maxDigits = 4): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: maxDigits,
  }).format(value);
}
