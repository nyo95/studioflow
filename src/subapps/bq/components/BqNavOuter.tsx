"use client";

/**
 * BQ navigation — adapter tipis di atas `AppRail` milik engine
 * (R6, PRD Architecture Cleanup v2 §41). Shell visual tidak lagi diduplikasi.
 *
 * Nav:
 *   Breakdowns → /bq   daftar project BQ
 *   Library    → /bq/library
 *
 * isActive custom lama ("/bq" aktif untuk `/bq` dan `/bq/[projectId]`, tidak
 * untuk `/bq/library`) kini dijawab aturan generik `resolveActiveRailHref`:
 * exact match menang, lalu prefix terpanjang — `/bq/library/x` mengaktifkan
 * Library, `/bq/[projectId]` tetap mengaktifkan Breakdowns. Paritasinya
 * dikunci di `src/ui_engine/layout/rail-active.test.ts`.
 */

import { Boxes, BookOpen } from "lucide-react";
import { AppRail } from "@/ui_engine";

const MAIN_ITEMS = [
  { icon: Boxes, label: "Breakdowns", href: "/bq" },
  { icon: BookOpen, label: "Library", href: "/bq/library" },
] as const;

export function BqNavOuter() {
  return <AppRail eyebrow="Subapp" title="BQ" groups={[{ items: MAIN_ITEMS }]} />;
}
