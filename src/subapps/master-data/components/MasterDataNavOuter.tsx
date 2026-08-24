"use client";

/**
 * Master Data navigation — adapter tipis di atas `AppRail` milik engine
 * (R6, PRD Architecture Cleanup v2 §41). Shell visual tidak lagi diduplikasi;
 * yang dimiliki Master Data hanyalah daftar nav-nya.
 *
 * Nav structure (2026-08-12, UX redesign spec §B):
 *   Materials    → /masterdata/materials  (brand grain landing)
 *   SKUs         → /masterdata/skus       (cross-brand SKU directory)
 *   Suppliers    → /masterdata/suppliers  (unified Party table)
 *   Prices       → /masterdata/prices     (SkuPrice + WorkPrice)
 *   Samples      → /masterdata/samples    (Sample + SampleMovement)
 *   ─────────────────────────────────────
 *   Data Tools   → /masterdata/settings   (Import / Export)
 *
 * Data Tools is visually separated by a divider and sits at the bottom —
 * it is an admin tool, not a daily-use section. Divider itu dirender engine
 * sebagai group kedua.
 */

import { Building2, CircleDollarSign, Database, Layers, Library, Package } from "lucide-react";
import { AppRail } from "@/ui_engine";

const MAIN_ITEMS = [
  { icon: Layers,            label: "Materials",   href: "/masterdata/materials" },
  { icon: Package,           label: "SKUs",        href: "/masterdata/skus"      },
  { icon: Building2,         label: "Suppliers",   href: "/masterdata/suppliers" },
  { icon: CircleDollarSign,  label: "Prices",      href: "/masterdata/prices"    },
  { icon: Library,           label: "Samples",     href: "/masterdata/samples"   },
] as const;

const TOOL_ITEMS = [
  { icon: Database,          label: "Data Tools",  href: "/masterdata/settings"  },
] as const;

export function MasterDataNavOuter() {
  return (
    <AppRail
      eyebrow="Subapp"
      title="Master Data"
      groups={[{ items: MAIN_ITEMS }, { items: TOOL_ITEMS }]}
    />
  );
}
