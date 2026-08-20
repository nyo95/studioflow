/**
 * BQ — MESIN HITUNG (murni, tanpa I/O).
 *
 * ============================================================================
 * KENAPA BERKAS INI MURNI
 * ============================================================================
 * PRD BQ Bab "Aturan yang tidak boleh dilanggar" no. 5: *"Perhitungan di
 * server, bukan di klien."* Konsekuensi teknisnya bukan cuma "jalankan di
 * server" — tapi bahwa satu-satunya tempat aritmatika BQ hidup adalah modul
 * ini, yang tidak menyentuh Prisma, `server-only`, DOM, atau tanggal
 * sekarang. Server action, komponen tabel, dan export Internal Cost Detail
 * semuanya memanggil fungsi yang sama.
 *
 * `scripts/run-tests.mjs` hanya bisa mengompilasi berkas yang tidak menjangkau
 * Prisma. Itu bukan kebetulan melainkan pagar: mesin hitung yang bisa diuji
 * tanpa database adalah mesin hitung yang tidak bisa diam-diam membaca ulang
 * master data. Larangan silent update (PRD §5.4) ditegakkan oleh bentuk modul
 * ini, bukan oleh disiplin penulisnya.
 *
 * ============================================================================
 * URUTAN OPERASI — NORMATIF, JANGAN DIUBAH
 * ============================================================================
 * PRD Bab 3 menetapkan urutannya, dan urutannya membawa arti:
 *
 *   - waste dikali SEBELUM pengali L2 (§3.1 langkah 3-4);
 *   - `L1.qty` masuk PALING AKHIR (§3.3) supaya `rate_L1` tetap harga satuan
 *     yang bisa dipindah ke Rate Library dan dipakai ulang di project lain;
 *   - pembulatan pembelian terjadi SETELAH agregasi seluruh project (§3.5
 *     langkah 3), tidak pernah per baris.
 *
 * Menukar salah satunya menghasilkan angka yang tetap "masuk akal" di layar
 * dan salah di kertas penawaran. Itu sebabnya `calc.test.ts` mengunci angka
 * contoh Bab 7 (Rp5.653.559) apa adanya: kalau meleset, mesin hitungnya yang
 * salah, bukan angkanya.
 *
 * ============================================================================
 * ANGKA
 * ============================================================================
 * Skema menyimpan qty `numeric(18,6)` dan uang `numeric(18,4)`. Modul ini
 * bekerja dengan `number` (float64) karena contoh Bab 7 memang sudah
 * diverifikasi silang Python vs JS oleh penulis PRD, dan karena `Decimal`
 * Prisma tidak bisa masuk ke berkas yang diuji tanpa menarik Prisma.
 * Pembulatan HANYA di lapisan tampilan (`formatIdr`) — kecuali `ceil` pada
 * langkah pembulatan pembelian, yang memang bagian dari perhitungan.
 */

// ---------------------------------------------------------------------------
// Tipe masukan
// ---------------------------------------------------------------------------

export type MaterialLineInput = {
  id: string;
  /** Kunci agregasi Purchase Summary. Null untuk baris yang snapshot-nya sudah
   *  lepas dari master data — baris seperti itu tetap dihitung ke rate, tapi
   *  tidak bisa digabung dengan baris lain karena tidak ada yang menjamin ia
   *  barang yang sama. Lihat `buildPurchaseSummary`. */
  skuId: string | null;
  name: string;
  /** Satuan pakai (sqm, m', pcs) — satuan `qtyPerSub`. `null` bila SKU tidak punya costing profile. */
  usageUnit: string | null;
  /** Satuan beli (lembar, roll, kg). `null` bila SKU tidak punya costing profile. */
  purchaseUnit: string | null;
  /** Berapa usage unit dalam 1 purchase unit. `null` = 1:1 fallback (SKU tanpa costing). */
  conversion: number | null;
  /** Harga per PURCHASE unit, dari snapshot baris. Bukan per usage unit. */
  pricePerPurchaseUnit: number;
  /** Kebutuhan untuk SATU sub-object, dalam usage unit. */
  qtyPerSub: number;
  /** Presedensi waste level 1. `null` = tidak di-override. `0` adalah nilai
   *  sah yang MENANG atas default di bawahnya (PRD §4.1, AT-04). */
  wasteOverridePct: number | null;
  /** Presedensi level 3 — default waste bahan, dari snapshot. */
  materialDefaultWastePct: number | null;
  /** Presedensi level 4 — default waste kategori bahan, dari snapshot. */
  categoryDefaultWastePct: number | null;
  minimumOrder: number | null;
  roundingIncrement: number | null;
};

export type ServiceLineInput = {
  id: string;
  workPriceId: string | null;
  name: string;
  /** Satuan tarif (sqm, m', pcs, ls, org-hari). */
  rateUnit: string;
  /** Tarif per rate unit. */
  pricePerRateUnit: number;
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
  /** Fraksi, bukan persen: 20% = 0.2. */
  markupPct: number;
  /** Presedensi waste level 2 — berlaku untuk seluruh baris di object ini. */
  wasteOverridePct: number | null;
  subObjects: SubObjectInput[];
};

// ---------------------------------------------------------------------------
// Tipe keluaran
// ---------------------------------------------------------------------------

export type MaterialLineResult = {
  lineId: string;
  skuId: string | null;
  name: string;
  usageUnit: string | null;
  purchaseUnit: string | null;
  qtyPerSub: number;
  /** Waste yang benar-benar dipakai setelah presedensi. */
  wastePct: number;
  /** Level presedensi yang menang (1-5). Ditampilkan di Internal Cost Detail
   *  supaya tidak ada angka waste yang asalnya tidak bisa dijelaskan. */
  wasteSource: WasteSource;
  grossPerSub: number;
  /** Sudah dikali `L2.qty`, BELUM dikali `L1.qty` (PRD §3.3). */
  grossTotal: number;
  pricePerUsageUnit: number;
  pricePerPurchaseUnit: number;
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
  markupPct: number;
  subObjects: SubObjectResult[];
  /** Biaya pokok untuk 1 unit object. */
  baseCostPerUnit: number;
  markupAmountPerUnit: number;
  /** Harga satuan yang bisa dipindah ke Rate Library. */
  ratePerUnit: number;
  /** `ratePerUnit x qty`. */
  total: number;
  subObjectCount: number;
  lineCount: number;
};

export type ProjectTotals = {
  objects: ObjectResult[];
  /** Σ biaya pokok x L1.qty. */
  baseCost: number;
  markupAmount: number;
  /** Σ total object. Ini yang dilihat klien. */
  grandTotal: number;
};

/** Level presedensi waste yang menang (PRD §4.1). */
export type WasteSource =
  | "LINE_OVERRIDE"
  | "OBJECT_OVERRIDE"
  | "MATERIAL_DEFAULT"
  | "CATEGORY_DEFAULT"
  | "ZERO_FALLBACK";

// ---------------------------------------------------------------------------
// Presedensi waste — PRD §4.1
// ---------------------------------------------------------------------------

/**
 * Dari yang paling menang:
 *   1 override baris · 2 override object · 3 default bahan ·
 *   4 default kategori · 5 nol.
 *
 * `0` eksplisit adalah nilai sah dan menang atas default di bawahnya —
 * `0 !== null` (AT-04). Ini sebabnya seluruh parameter bertipe
 * `number | null` dan BUKAN `number | undefined` yang di-`||`: `0 || 10`
 * adalah `10`, dan itu persis bug yang AT-04 tangkap.
 */
export function resolveWaste(
  line: Pick<
    MaterialLineInput,
    "wasteOverridePct" | "materialDefaultWastePct" | "categoryDefaultWastePct"
  >,
  objectWasteOverridePct: number | null
): { pct: number; source: WasteSource } {
  if (line.wasteOverridePct !== null)
    return { pct: line.wasteOverridePct, source: "LINE_OVERRIDE" };
  if (objectWasteOverridePct !== null)
    return { pct: objectWasteOverridePct, source: "OBJECT_OVERRIDE" };
  if (line.materialDefaultWastePct !== null)
    return { pct: line.materialDefaultWastePct, source: "MATERIAL_DEFAULT" };
  if (line.categoryDefaultWastePct !== null)
    return { pct: line.categoryDefaultWastePct, source: "CATEGORY_DEFAULT" };
  return { pct: 0, source: "ZERO_FALLBACK" };
}

// ---------------------------------------------------------------------------
// L3
// ---------------------------------------------------------------------------

/**
 * PRD §3.1. Langkah 5 (`harga_usage_unit = harga_purchase_unit / konversi`)
 * tidak pernah dilewati.
 *
 * `conversion <= 0` dilempar, bukan di-`|| 1`. Konversi nol adalah data yang
 * rusak, dan diam-diam menggantinya dengan 1 menghasilkan angka yang salah
 * tanpa ada yang tahu.
 */
export function computeMaterialLine(
  line: MaterialLineInput,
  subObjectQty: number,
  objectWasteOverridePct: number | null
): MaterialLineResult {
  // null → 1:1 fallback (SKU tanpa costing profile).
  const conversion = line.conversion ?? 1;
  if (!(conversion > 0)) {
    throw new Error(
      `BQ: conversion must be greater than zero for line "${line.name}" (got ${conversion}).`
    );
  }

  const waste = resolveWaste(line, objectWasteOverridePct);
  const grossPerSub = line.qtyPerSub * (1 + waste.pct);
  const grossTotal = grossPerSub * subObjectQty;
  const pricePerUsageUnit = line.pricePerPurchaseUnit / conversion;

  return {
    lineId: line.id,
    skuId: line.skuId,
    name: line.name,
    usageUnit: line.usageUnit,
    purchaseUnit: line.purchaseUnit,
    qtyPerSub: line.qtyPerSub,
    wastePct: waste.pct,
    wasteSource: waste.source,
    grossPerSub,
    grossTotal,
    pricePerUsageUnit,
    pricePerPurchaseUnit: line.pricePerPurchaseUnit,
    cost: grossTotal * pricePerUsageUnit,
  };
}

/**
 * PRD §3.2. Tanpa waste, tanpa konversi — dan itu ditegakkan SKEMA, bukan
 * fungsi ini: `bq.BqServiceLine` memang tidak punya kolomnya (AT-07). Kalau
 * suatu saat kolom itu muncul di tabel jasa, yang salah adalah migrasinya.
 */
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
// L2 dan L1 — PRD §3.3
// ---------------------------------------------------------------------------

export function computeSubObject(
  sub: SubObjectInput,
  objectWasteOverridePct: number | null
): SubObjectResult {
  const materials = sub.materials.map((m) =>
    computeMaterialLine(m, sub.qty, objectWasteOverridePct)
  );
  const services = sub.services.map((s) => computeServiceLine(s, sub.qty));

  const subtotal =
    materials.reduce((acc, m) => acc + m.cost, 0) +
    services.reduce((acc, s) => acc + s.cost, 0);

  return {
    subObjectId: sub.id,
    name: sub.name,
    qty: sub.qty,
    materials,
    services,
    subtotal,
    lineCount: materials.length + services.length,
  };
}

/**
 * Markup diterapkan di L1, bukan per baris L3 (PRD §3.4) — ia keputusan
 * komersial atas satu fixture utuh, bukan atas sebatang edging.
 *
 * `L1.qty` sengaja baru masuk di `total`, bukan di `ratePerUnit`. Itu yang
 * membuat `ratePerUnit` bisa dipindah ke Rate Library dan dipakai ulang di
 * project lain dengan qty berbeda.
 */
export function computeObject(obj: ObjectInput): ObjectResult {
  const subObjects = obj.subObjects.map((s) =>
    computeSubObject(s, obj.wasteOverridePct)
  );

  const baseCostPerUnit = subObjects.reduce((acc, s) => acc + s.subtotal, 0);
  const markupAmountPerUnit = baseCostPerUnit * obj.markupPct;
  const ratePerUnit = baseCostPerUnit + markupAmountPerUnit;

  return {
    objectId: obj.id,
    name: obj.name,
    code: obj.code,
    qty: obj.qty,
    unit: obj.unit,
    markupPct: obj.markupPct,
    subObjects,
    baseCostPerUnit,
    markupAmountPerUnit,
    ratePerUnit,
    total: ratePerUnit * obj.qty,
    subObjectCount: subObjects.length,
    lineCount: subObjects.reduce((acc, s) => acc + s.lineCount, 0),
  };
}

export function computeProject(objects: ObjectInput[]): ProjectTotals {
  const results = objects.map(computeObject);
  const baseCost = results.reduce((acc, o) => acc + o.baseCostPerUnit * o.qty, 0);
  const grandTotal = results.reduce((acc, o) => acc + o.total, 0);
  return {
    objects: results,
    baseCost,
    markupAmount: grandTotal - baseCost,
    grandTotal,
  };
}

// ---------------------------------------------------------------------------
// Purchase Summary — PRD §3.5
// ---------------------------------------------------------------------------

export type PurchaseRow = {
  skuId: string;
  name: string;
  usageUnit: string | null;
  purchaseUnit: string | null;
  conversion: number | null;
  pricePerPurchaseUnit: number;
  /** Σ(gross_per_sub x L2.qty x L1.qty) lintas seluruh object yang ikut. */
  projectGross: number;
  /** `projectGross / conversion`, sebelum dibulatkan. */
  purchaseRaw: number;
  /** Setelah `ceil` ke `roundingIncrement` dan lantai `minimumOrder`. */
  purchaseQty: number;
  purchaseCost: number;
  /** Σ biaya baris bahan ini di breakdown — pembanding untuk variance. */
  bqCost: number;
};

export type PurchaseSummary = {
  rows: PurchaseRow[];
  totalPurchaseCost: number;
  totalBqCost: number;
  /**
   * `Σ purchase_cost − Σ biaya_baris bahan`. TIDAK dialokasikan balik ke
   * object, tidak memengaruhi rate mana pun, tidak dikenai markup (PRD §3.5).
   * Kalau ia dialokasikan, rate Counter Cabinet berubah setiap kali object
   * lain ikut pakai plywood — mustahil dijelaskan, dan merusak nilai rate
   * sebagai entri yang bisa dipakai ulang.
   */
  packagingVariance: number;
  /** Baris bahan yang snapshot-nya sudah tidak menunjuk SKU mana pun, jadi
   *  tidak bisa diagregasi dengan aman. Dilaporkan, bukan didiamkan. */
  unlinkedLineCount: number;
};

/**
 * Pembulatan HANYA di langkah 3, SETELAH agregasi seluruh project. Tidak
 * pernah per baris (AT-06): kalau plywood dipakai di 8 tempat masing-masing
 * 0,5 lembar, yang dibeli 4 lembar, bukan 8.
 */
export function buildPurchaseSummary(objects: ObjectInput[]): PurchaseSummary {
  /** `minimumOrder` dan `roundingIncrement` hanya dipakai saat menutup baris,
   *  jadi mereka hidup di akumulator dan tidak bocor ke `PurchaseRow` yang
   *  dibaca UI — angka yang tidak ditampilkan tidak perlu jadi kontrak. */
  type Accumulated = PurchaseRow & {
    minimumOrder: number | null;
    roundingIncrement: number | null;
  };

  const acc = new Map<string, Accumulated>();
  let unlinkedLineCount = 0;

  for (const obj of objects) {
    const computed = computeObject(obj);

    for (const sub of computed.subObjects) {
      for (const line of sub.materials) {
        if (line.skuId === null) {
          unlinkedLineCount += 1;
          continue;
        }

        const source = obj.subObjects
          .find((s) => s.id === sub.subObjectId)
          ?.materials.find((m) => m.id === line.lineId);
        if (!source) continue;

        // Kunci agregasi menyertakan purchase unit dan harga, bukan hanya
        // SKU: dua baris ber-SKU sama yang snapshot-nya diambil dari
        // penawaran supplier berbeda adalah dua pembelian yang berbeda, dan
        // menjumlahkannya jadi satu baris akan menampilkan harga salah satu
        // supplier untuk qty milik keduanya.
        const key = `${line.skuId}::${source.purchaseUnit}::${source.pricePerPurchaseUnit}`;
        const existing = acc.get(key);

        // Gross project = gross_per_sub x L2.qty x L1.qty. `grossTotal`
        // sudah mengandung L2.qty (PRD §3.3), jadi di sini tinggal L1.qty.
        const projectGross = line.grossTotal * obj.qty;

        if (existing) {
          existing.projectGross += projectGross;
          existing.bqCost += line.cost * obj.qty;
        } else {
          acc.set(key, {
            skuId: line.skuId,
            name: line.name,
            usageUnit: line.usageUnit,
            purchaseUnit: source.purchaseUnit,
            conversion: source.conversion,
            pricePerPurchaseUnit: source.pricePerPurchaseUnit,
            projectGross,
            purchaseRaw: 0,
            purchaseQty: 0,
            purchaseCost: 0,
            bqCost: line.cost * obj.qty,
            minimumOrder: source.minimumOrder,
            roundingIncrement: source.roundingIncrement,
          });
        }
      }
    }
  }

  const rows: PurchaseRow[] = [];
  for (const r of acc.values()) {
    const increment = r.roundingIncrement && r.roundingIncrement > 0 ? r.roundingIncrement : 1;
    const purchaseRaw = r.projectGross / (r.conversion ?? 1);
    const rounded = Math.ceil(purchaseRaw / increment) * increment;
    const purchaseQty = Math.max(rounded, r.minimumOrder ?? 0);

    rows.push({
      skuId: r.skuId,
      name: r.name,
      usageUnit: r.usageUnit,
      purchaseUnit: r.purchaseUnit,
      conversion: r.conversion,
      pricePerPurchaseUnit: r.pricePerPurchaseUnit,
      projectGross: r.projectGross,
      purchaseRaw,
      purchaseQty,
      purchaseCost: purchaseQty * r.pricePerPurchaseUnit,
      bqCost: r.bqCost,
    });
  }

  const totalPurchaseCost = rows.reduce((a, r) => a + r.purchaseCost, 0);
  const totalBqCost = rows.reduce((a, r) => a + r.bqCost, 0);

  return {
    rows,
    totalPurchaseCost,
    totalBqCost,
    packagingVariance: totalPurchaseCost - totalBqCost,
    unlinkedLineCount,
  };
}

// ---------------------------------------------------------------------------
// Tampilan
// ---------------------------------------------------------------------------

/** Pembulatan ke rupiah utuh. HANYA untuk tampilan — jangan memberi hasilnya
 *  balik ke perhitungan mana pun. */
export function roundRupiah(value: number): number {
  return Math.round(value);
}

/** Format uang untuk layar. Teks antarmuka Bahasa Inggris (AGENTS.md §Bahasa),
 *  tapi mata uangnya tetap IDR dan pemisah ribuannya mengikuti `id-ID` karena
 *  itu yang dibaca estimator di kertas. */
export function formatIdr(value: number, currency = "IDR"): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(roundRupiah(value));
}

/** Format qty. 6 desimal adalah presisi simpan; tampilan memangkas nol di
 *  ekor supaya "3" tidak tampil sebagai "3,000000". */
export function formatQty(value: number, maxDigits = 4): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: maxDigits,
  }).format(value);
}

/** 0.1 → "10%". */
export function formatPct(value: number): string {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value * 100)}%`;
}
