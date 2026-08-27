/**
 * BQ — template standar kantor, hasil impor "BQ template tes.xlsx".
 *
 * ============================================================================
 * DARI MANA BENTUK INI DATANG
 * ============================================================================
 * Berkas Excel itu punya dua sheet dengan dua peran berbeda, dan keduanya
 * dipakai di sini:
 *
 *   sheet "BQ"   -> KERANGKA DOKUMEN. Seksi A/B/C, divisi I/II/III, dan
 *                   daftar itemnya. Inilah yang dicetak ke klien.
 *   sheet "Tes"  -> TAXONOMY RESEP. Untuk sebagian item, ia merinci
 *                   pembentuknya: nama sub-item, satuan, dan KATEGORI biaya.
 *
 * Pemetaan ke tiga lapis BQ (komponen -> subkomponen -> pembentuk):
 *
 *   Seksi   (A PRELIMINARIES)      -> BqSection      — pengelompok cetak (L0)
 *   Grup    (I Floor Works)        -> BqObject       — KOMPONEN        (L1)
 *   Item    (Screeding Base)       -> BqSubObject    — SUBKOMPONEN     (L2)
 *   Sub-item(Material HT)          -> baris bahan/jasa — PEMBENTUK     (L3)
 *
 * PRELIMINARIES tidak punya divisi di sheet aslinya — itemnya menggantung
 * langsung di bawah seksi. Di sini ia diberi satu grup implisit bernama sama,
 * supaya setiap item selalu punya induk L1 dan aturan "L1 = satu baris BQ"
 * tidak perlu dikecualikan.
 *
 * ============================================================================
 * HARGA SENGAJA KOSONG
 * ============================================================================
 * Tidak ada satu pun angka rupiah di berkas ini, dan itu bukan kelalaian.
 * Master Data adalah SSOT untuk bahan dan jasa; template cuma menyebut APA
 * yang dibutuhkan, bukan berapa harganya. Untuk kategori yang memang tidak
 * punya padanan di Master Data (ALAT, BIAYA_UMUM, TRANSPORT_AKOMODASI),
 * harganya diketik estimator per project sebagai baris PROJECT_LOCAL.
 *
 * Koefisien pun mayoritas kosong: sheet "Tes" masih kerangka. Yang kosong
 * dituang sebagai 0 dan menunggu diisi estimator.
 *
 * BERKAS INI DIHASILKAN SKRIP — jangan disunting tangan. Untuk memperbarui,
 * impor ulang workbook-nya.
 */

/** Pos biaya baris L3 — cermin `BqCostCategory` di Prisma. */
export type BqTemplateCategory =
  | "MATERIAL"
  | "UPAH"
  | "ALAT"
  | "BIAYA_UMUM"
  | "TRANSPORT_AKOMODASI";

/** Pembentuk (L3) — satu baris bahan atau jasa di dalam subkomponen. */
export type BqTemplateLine = {
  name: string;
  unit: string;
  /** NULL di sumber = belum ditentukan; dituang sebagai 0. */
  coef: number | null;
  category: BqTemplateCategory;
};

/** Subkomponen (L2) — satu item BQ dengan qty, satuan, dan pembentuknya. */
export type BqTemplateItem = {
  name: string;
  /** Kolom "Specification" sheet BQ. */
  spec: string | null;
  unit: string;
  /** Area pada sheet BQ ("Shopfront Area") — label, bukan lapis hirarki. */
  area: string | null;
  lines: BqTemplateLine[];
};

/** Komponen (L1) — grup / divisi. `code` = angka romawi pada sheet BQ. */
export type BqTemplateGroup = {
  code: string | null;
  name: string;
  items: BqTemplateItem[];
};

/** Seksi cetak (L0) — "A", "B", "C". */
export type BqTemplateSection = {
  code: string;
  name: string;
  groups: BqTemplateGroup[];
};

/** Resep yang ada di sheet "Tes" tapi belum punya item di sheet "BQ". */
export type BqTemplateExtraRecipe = {
  group: string;
  name: string;
  lines: BqTemplateLine[];
};

export const BQ_TEMPLATE_SECTIONS: BqTemplateSection[] = [
  {
    code: "A",
    name: "PRELIMINARIES",
    groups: [
      {
        code: null,
        name: "Preliminaries",
        items: [
          {
            name: "Mobilization",
            spec: null,
            unit: "ls",
            area: null,
            lines: [
              { name: "Mobilisasi lapangan", unit: "rit", coef: null, category: "TRANSPORT_AKOMODASI" },
              { name: "Mobilisasi project", unit: "rit", coef: null, category: "TRANSPORT_AKOMODASI" },
              { name: "Mobilisasi sipil", unit: "rit", coef: null, category: "TRANSPORT_AKOMODASI" },
              { name: "Mobilisasi furniture", unit: "rit", coef: null, category: "TRANSPORT_AKOMODASI" },
              { name: "Mobilisasi signage", unit: "rit", coef: null, category: "TRANSPORT_AKOMODASI" },
              { name: "Mobilisasi door", unit: "rit", coef: null, category: "TRANSPORT_AKOMODASI" },
              { name: "Mobilisasi MEP", unit: "rit", coef: null, category: "TRANSPORT_AKOMODASI" },
              { name: "Mobilisasi extra", unit: "rit", coef: null, category: "TRANSPORT_AKOMODASI" },
            ],
          },
          {
            name: "Electrical & Water Supply for Fit Out",
            spec: null,
            unit: "ls",
            area: null,
            lines: [
              { name: "Instalasi", unit: "ls", coef: null, category: "MATERIAL" },
              { name: "Deposit", unit: "ls", coef: null, category: "BIAYA_UMUM" },
            ],
          },
          {
            name: "Loading/Unloading",
            spec: null,
            unit: "ls",
            area: null,
            lines: [
              { name: "Tenaga bongkar muat material", unit: "ls", coef: null, category: "UPAH" },
              { name: "Proteksi jalur angkut", unit: "ls", coef: null, category: "MATERIAL" },
              { name: "Biaya konsumsi", unit: "ls", coef: null, category: "BIAYA_UMUM" },
            ],
          },
          { name: "Security", spec: null, unit: "ls", area: null, lines: [] },
          {
            name: "Safety & Cleaning",
            spec: null,
            unit: "ls",
            area: null,
            lines: [
              { name: "General cleaning", unit: "ls", coef: null, category: "UPAH" },
            ],
          },
          {
            name: "Fire Retardant",
            spec: null,
            unit: "gln",
            area: null,
            lines: [
              { name: "Material fire retardant", unit: "gln", coef: null, category: "MATERIAL" },
            ],
          },
          {
            name: "Fit Out",
            spec: null,
            unit: "ls",
            area: null,
            lines: [
              { name: "Deposit ke building management", unit: "ls", coef: null, category: "BIAYA_UMUM" },
            ],
          },
          {
            name: "Insurance",
            spec: null,
            unit: "ls",
            area: null,
            lines: [
              { name: "Insurance", unit: "ls", coef: null, category: "BIAYA_UMUM" },
            ],
          },
          { name: "Temporary Scafolding & Material Support", spec: null, unit: "ls", area: null, lines: [] },
        ],
      },
    ],
  },
  {
    code: "B",
    name: "INTERIOR WORKS",
    groups: [
      {
        code: "I",
        name: "Floor Works",
        items: [
          { name: "Screeding Base H+100mm", spec: null, unit: "sqm", area: null, lines: [] },
          { name: "Supplly & Install Floor Finish HT1", spec: "Ex. Niro 600x600mm White Amber", unit: "sqm", area: null, lines: [] },
          { name: "Supply & Install Floor Finish Storage Area CT1", spec: "Ex. Asia Tile / Roman 300x300mm White", unit: "sqm", area: null, lines: [] },
          { name: "Lease Line MT1", spec: "Inlay Stainless Steel", unit: "m'", area: null, lines: [] },
        ],
      },
      {
        code: "II",
        name: "Ceiling Works",
        items: [
          {
            name: "Flat Ceiling",
            spec: "Hollow 20x40mm T 0,8mm + Gypsum 9mm",
            unit: "sqm",
            area: null,
            lines: [
              { name: "Hollow 20x40 t.0,8mm + Gypsum board 90mm", unit: "sqm", coef: null, category: "MATERIAL" },
              { name: "Hollow 20x40 t.0,8mm + Gypsum board 90mm", unit: "sqm", coef: null, category: "UPAH" },
              { name: "Hollow 20x40 t.1,2mm + Gypsum board 90mm", unit: "sqm", coef: null, category: "MATERIAL" },
              { name: "Hollow 20x40 t.1,2mm + Plywood 90mm", unit: "sqm", coef: null, category: "MATERIAL" },
            ],
          },
          { name: "Drop Ceiling", spec: "Hollow 20x40mm T 0,8mm + Gypsum 9mm", unit: "m'", area: null, lines: [] },
          { name: "Cove Ceiling", spec: "Hollow 20x40mm T 0,8mm + Gypsum 9mm", unit: "m'", area: null, lines: [] },
          { name: "Celing Finish PT1", spec: "Col. White", unit: "sqm", area: null, lines: [] },
          { name: "Celing Finish PT5", spec: "Wash Paint", unit: "sqm", area: null, lines: [] },
          { name: "Celing Finish PT6", spec: "Texture Paint", unit: "sqm", area: null, lines: [] },
          { name: "Ceiling Finish MSC1", spec: "ACP", unit: "sqm", area: null, lines: [] },
          { name: "Wiremesh Partition", spec: null, unit: "sqm", area: null, lines: [] },
          { name: "Manhole", spec: null, unit: "unit", area: null, lines: [] },
        ],
      },
      {
        code: "III",
        name: "Wall Works",
        items: [
          { name: "Second Skin Partition", spec: "Hollow 20x40mm T 0,6mm + Plywood 9mm", unit: "sqm", area: "Shopfront Area", lines: [] },
          { name: "Wall Finish PT5", spec: "Wash Paint", unit: "sqm", area: "Shopfront Area", lines: [] },
          { name: "Wall Finish PT6", spec: "Texture Paint", unit: "sqm", area: "Shopfront Area", lines: [] },
          { name: "Tempered Glass GL1", spec: "Tempered Glass 12mm Jumbo", unit: "sqm", area: "Shopfront Area", lines: [] },
          { name: "Second Skin Partition", spec: "Hollow 20x40mm T 0,6mm + Gypsum 9mm", unit: "sqm", area: "Store Area", lines: [] },
          { name: "Wall Finish PT1", spec: "Col. White", unit: "sqm", area: "Store Area", lines: [] },
          { name: "Wall Finish PT5", spec: "Wash Paint", unit: "sqm", area: "Store Area", lines: [] },
          { name: "Wall Finish PT6", spec: "Texture Paint", unit: "sqm", area: "Store Area", lines: [] },
          { name: "Wall Finish MSC1", spec: "ACP", unit: "sqm", area: "Store Area", lines: [] },
          { name: "Wall Finish GL2", spec: "Clear Mirror", unit: "sqm", area: "Store Area", lines: [] },
          { name: "Wall Frame", spec: "Plywood Fin. ACP, LED Strip", unit: "m1", area: "Store Area", lines: [] },
          { name: "Frame Wall Unit", spec: "Plywood Fin. ACP", unit: "m1", area: "Store Area", lines: [] },
          { name: "Skirting", spec: null, unit: "sqm", area: "Store Area", lines: [] },
          { name: "Corner Guard", spec: null, unit: "unit", area: "Store Area", lines: [] },
          { name: "Second Skin Partition", spec: null, unit: "sqm", area: "Office/Storage Area", lines: [] },
          { name: "Wall Finish PT1", spec: "Col. White", unit: "sqm", area: "Office/Storage Area", lines: [] },
          { name: "Full Slab Partition", spec: null, unit: "sqm", area: "Full Slab", lines: [] },
          { name: "Wall Finish PT1", spec: "Col. White", unit: "sqm", area: "Full Slab", lines: [] },
        ],
      },
      {
        code: "V",
        name: "Signage Work",
        items: [
          { name: "Signage 1 ID400A", spec: null, unit: "unit", area: null, lines: [] },
          { name: "Signage 2 ID400B", spec: null, unit: "unit", area: null, lines: [] },
          { name: "Signage 3 ID400C", spec: null, unit: "unit", area: null, lines: [] },
        ],
      },
    ],
  },
  {
    code: "C",
    name: "LIGHTING & MEP WORKS",
    groups: [
      {
        code: "I",
        name: "Basic Installation",
        items: [
          { name: "Power Outlet", spec: "Ex. Supreme 3 x 2.5mm, Include Socket / Isolator, Installation Fee", unit: "nos", area: null, lines: [] },
          { name: "Direct Power/ Lighting Outlet", spec: "Ex. Supreme 3 x 2.5mm", unit: "nos", area: null, lines: [] },
          { name: "Parallel Lighting Outlet", spec: "Ex. Supreme 3 x 2.5mm", unit: "nos", area: null, lines: [] },
          { name: "Switch/Dimmer Switch Outlet", spec: "Ex. Supreme 3 x 2.5mm, Include Socket / Isolator, Installation Fee", unit: "nos", area: null, lines: [] },
          { name: "Data Outlet Installation", spec: "Ex. Belden cat6, Pipe Conduit", unit: "nos", area: null, lines: [] },
          { name: "Speaker Outlet Installation", spec: null, unit: "nos", area: null, lines: [] },
          { name: "LED Strip Installation (Ceiling)", spec: null, unit: "ml", area: null, lines: [] },
          { name: "Speaker Installation", spec: null, unit: "nos", area: null, lines: [] },
          { name: "Access Control Installation", spec: null, unit: "nos", area: null, lines: [] },
          { name: "Access Point Installation", spec: null, unit: "nos", area: null, lines: [] },
          { name: "CCTV Installation", spec: null, unit: "nos", area: null, lines: [] },
        ],
      },
      {
        code: "II",
        name: "Switch and Socket Accessories",
        items: [
          { name: "16A 1 Gang Power Socket", spec: "Ex. Boss", unit: "pcs", area: null, lines: [] },
          { name: "3 Gang Power Socket", spec: "Ex. Uticon", unit: "pcs", area: null, lines: [] },
          { name: "4 Gang Power Socket", spec: "Ex. Uticon", unit: "pcs", area: null, lines: [] },
          { name: "6 Gang Power Socket", spec: "Ex. Uticon", unit: "pcs", area: null, lines: [] },
          { name: "3 Gang 1 Way Switch", spec: "Ex. Panasonic", unit: "pcs", area: null, lines: [] },
          { name: "Outbowdoos 1G", spec: "Ex. Schneider", unit: "pcs", area: null, lines: [] },
          { name: "RJ45 Cat6 Plug/Jack", spec: "Ex. Commscope, Include Crimping", unit: "pcs", area: null, lines: [] },
        ],
      },
      {
        code: "III",
        name: "Lighting Works",
        items: [
          { name: "Spotlight 7W 4000K", spec: "Ex. Vocalux", unit: "pcs", area: null, lines: [] },
          { name: "Spotlight 20W 4000K", spec: "Ex. Vocalux", unit: "pcs", area: null, lines: [] },
          { name: "Spotlight 24W 4000K", spec: "Ex. Hiled", unit: "pcs", area: null, lines: [] },
          { name: "Downlight Grill 20W 4000K", spec: "Ex. Welite", unit: "pcs", area: null, lines: [] },
          { name: "Tracklight 20W 4000k", spec: "Ex. Artalux", unit: "pcs", area: null, lines: [] },
          { name: "TL LED Lighting 6500K", spec: "Ex. Philips T5 Linea 1200mm", unit: "pcs", area: null, lines: [] },
          { name: "Housing Alumunium", spec: null, unit: "ml", area: null, lines: [] },
          { name: "LED Strip Installation Fee", spec: "Ex. Hiled", unit: "m'", area: null, lines: [] },
          { name: "Switching Power Supply 12V 5A", spec: "Ex. Hiled", unit: "pcs", area: null, lines: [] },
          { name: "Switching Power Supply 12V 10A", spec: "Ex. Vinder", unit: "pcs", area: null, lines: [] },
          { name: "Emergency Light Battery Kit", spec: "Ex. Nero/Hinolux", unit: "pcs", area: null, lines: [] },
        ],
      },
      {
        code: "IV",
        name: "DB Panel",
        items: [
          { name: "Kabel Tufur nyy 4 X6 mm + gronding", spec: null, unit: "m'", area: null, lines: [] },
          { name: "Distribution Panel 3P + Timer & Contractor + Auto Manual", spec: "Ex. Schneider", unit: "Unit", area: null, lines: [] },
          { name: "Part Panel 24 Port", spec: "Ex. Commscope", unit: "Unit", area: null, lines: [] },
          { name: "Fire Stop", spec: null, unit: "Unit", area: null, lines: [] },
          { name: "Cable Tray For Electrical Cable", spec: "Ex. Traytek BRC 200x100", unit: "m'", area: null, lines: [] },
          { name: "Cable Tray For Electrical Cable", spec: "Ex. Traytek BRC 150x100", unit: "m'", area: null, lines: [] },
          { name: "Cable Tray For Data Cable", spec: "Ex. Traytek BRC 100x100", unit: "m'", area: null, lines: [] },
          { name: "Junction Box", spec: null, unit: "ls", area: null, lines: [] },
          { name: "Accessories, Jointing, Elbow, Tee, Hanger", spec: null, unit: "lot", area: null, lines: [] },
        ],
      },
      {
        code: "V",
        name: "MVAC",
        items: [
          { name: "Bar Grille 1000 x 200", spec: null, unit: "pcs", area: null, lines: [] },
          { name: "Difuser  400 x 400", spec: null, unit: "pcs", area: null, lines: [] },
          { name: "RAG 300 x 300", spec: null, unit: "pcs", area: null, lines: [] },
          { name: "Volume Demper", spec: null, unit: "nos", area: null, lines: [] },
          { name: "Spigot", spec: null, unit: "unit", area: null, lines: [] },
          { name: "Flexible Duct 250mm", spec: "Include Installation Fee", unit: "m'", area: null, lines: [] },
          { name: "Plenum box", spec: "Include Installation Fee", unit: "pcs", area: null, lines: [] },
          { name: "Ducting", spec: "Ex. Tdi,  Include Installation Fee, Fitting & Accessories", unit: "sqm", area: null, lines: [] },
        ],
      },
      {
        code: "VI",
        name: "Fire Protection System",
        items: [
          { name: "Relocation Sprinkler", spec: null, unit: "nos", area: null, lines: [] },
          { name: "New Sprinkler", spec: null, unit: "nos", area: null, lines: [] },
          { name: "Relokasi Pipa Induk Splinkler kena Roling", spec: null, unit: "nos", area: null, lines: [] },
          { name: "Fitting & Accessories", spec: null, unit: "nos", area: null, lines: [] },
          { name: "Test Tekan dan alat bantu", spec: null, unit: "nos", area: null, lines: [] },
          { name: "New Smoke Detektor", spec: null, unit: "nos", area: null, lines: [] },
          { name: "Relocation Smoke Detector", spec: null, unit: "nos", area: null, lines: [] },
        ],
      },
      {
        code: "VII",
        name: "Testing - Commisioning - As Built Drawings",
        items: [
          { name: "for Mechanical Electrical Installation", spec: null, unit: "ls", area: null, lines: [] },
        ],
      },
    ],
  },
];

export const BQ_TEMPLATE_EXTRA_RECIPES: BqTemplateExtraRecipe[] = [
  {
    group: "PRELIMINARIES",
    name: "Hoarding Partition",
    lines: [
      { name: "Partisi hoarding", unit: "m2", coef: null, category: "MATERIAL" },
      { name: "Partisi hoarding", unit: "m2", coef: null, category: "UPAH" },
    ],
  },
  {
    group: "PRELIMINARIES",
    name: "Site Management & Supervision",
    lines: [
      { name: "Supervisor", unit: "bln", coef: null, category: "TRANSPORT_AKOMODASI" },
    ],
  },
  {
    group: "PRELIMINARIES",
    name: "Temporary Scaffolding & Material Support",
    lines: [
      { name: "Sewa scaffolding", unit: "ls", coef: null, category: "ALAT" },
      { name: "Rak / gudang sementara", unit: "ls", coef: null, category: "BIAYA_UMUM" },
    ],
  },
  {
    group: "PRELIMINARIES",
    name: "Transportation & Accomodation",
    lines: [
      { name: "Transportasi PM", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Akomodasi PM", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Transportasi supervisor", unit: "ls", coef: 2.0, category: "TRANSPORT_AKOMODASI" },
      { name: "Akomodasi supervisor", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Transportasi sipil", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Akomodasi sipil", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Transportasi furniture", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Akomodasi furniture", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Transportasi door", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Akomodasi door", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Transportasi MEP", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Akomodasi MEP", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Transportasi extra", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Akomodasi extra", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
    ],
  },
  {
    group: "PRELIMINARIES",
    name: "Expedition",
    lines: [
      { name: "Ekspedisi MEP", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Ekspedisi furniture - pick up", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Ekspedisi furniture - truk", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Ekspedisi furniture - fuso", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Ekspedisi furniture - long fuso", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Ekspedisi furniture laut", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Ekspedisi signage", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Ekspedisi door", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Ekspedisi MEP", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
      { name: "Ekspedisi extra", unit: "ls", coef: null, category: "TRANSPORT_AKOMODASI" },
    ],
  },
  {
    group: "PRELIMINARIES",
    name: "Demolition Work",
    lines: [
      { name: "Bongkar", unit: "m2", coef: null, category: "MATERIAL" },
      { name: "Bongkar", unit: "m2", coef: null, category: "UPAH" },
    ],
  },
  {
    group: "FLOOR WORKS",
    name: "Screeding Base",
    lines: [
      { name: "H 20-50", unit: "m2", coef: null, category: "MATERIAL" },
      { name: "H 20-50", unit: "m2", coef: null, category: "UPAH" },
      { name: "H 50-100", unit: "m2", coef: null, category: "MATERIAL" },
      { name: "H 50-100", unit: "m2", coef: null, category: "UPAH" },
    ],
  },
  {
    group: "FLOOR WORKS",
    name: "Supply & Install Floor Finish HT",
    lines: [
      { name: "Material HT", unit: "m2", coef: null, category: "MATERIAL" },
      { name: "Jasa pemasangan HT", unit: "m2", coef: null, category: "UPAH" },
    ],
  },
  {
    group: "FLOOR WORKS",
    name: "Allowed for waste 10%",
    lines: [
      { name: "Material HT", unit: "m2", coef: null, category: "MATERIAL" },
      { name: "Jasa pemasangan HT", unit: "m2", coef: null, category: "UPAH" },
    ],
  },
  {
    group: "FLOOR WORKS",
    name: "Lease Line",
    lines: [
      { name: "Inlay stainless steel 50", unit: "m'", coef: null, category: "MATERIAL" },
      { name: "Jasa pemasangan inlay", unit: "m'", coef: null, category: "UPAH" },
    ],
  },
  {
    group: "CEILING WORKS",
    name: "Ceiling Finish PT",
    lines: [
      { name: "Vinilex col. White", unit: "sqm", coef: null, category: "MATERIAL" },
      { name: "Vinilex col. White", unit: "sqm", coef: null, category: "UPAH" },
      { name: "Dulux Easy Clean col. Soft Pink", unit: "sqm", coef: null, category: "MATERIAL" },
      { name: "Dulux Easy Clean col. Soft Pink", unit: "sqm", coef: null, category: "UPAH" },
      { name: "Texture Paint - Limewash", unit: "ls", coef: null, category: "MATERIAL" },
    ],
  },
  {
    group: "SIGNAGE WORKS",
    name: "xxx",
    lines: [
      { name: "Front-Lit Signage + spray painted metal return + acrylic face panel - h.500 x w.3000", unit: "ls", coef: null, category: "MATERIAL" },
      { name: "Back-Lit Signage + spray painted metal return + acrylic face panel - h.600 x w.4000", unit: "ls", coef: null, category: "MATERIAL" },
    ],
  },
];

/** Ringkasan untuk UI — dihitung sekali saat modul dimuat. */
export const BQ_TEMPLATE_SUMMARY = {
  sectionCount: BQ_TEMPLATE_SECTIONS.length,
  groupCount: BQ_TEMPLATE_SECTIONS.reduce((n, s) => n + s.groups.length, 0),
  itemCount: BQ_TEMPLATE_SECTIONS.reduce(
    (n, s) => n + s.groups.reduce((m, g) => m + g.items.length, 0),
    0,
  ),
  lineCount: BQ_TEMPLATE_SECTIONS.reduce(
    (n, s) =>
      n +
      s.groups.reduce(
        (m, g) => m + g.items.reduce((k, i) => k + i.lines.length, 0),
        0,
      ),
    0,
  ),
} as const;
