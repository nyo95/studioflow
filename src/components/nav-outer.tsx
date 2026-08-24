"use client";

/**
 * StudioFlow navigation — adapter tipis di atas `AppRail` milik engine.
 *
 * R6 (PRD Architecture Cleanup v2 §41): implementasi visual rail (aside fixed,
 * backdrop, drawer mobile) pindah ke engine; yang tersisa di sini hanya daftar
 * item navigasi StudioFlow. Aturan aktifnya dihitung `resolveActiveRailHref`
 * (exact-match menang, lalu prefix terpanjang) — perilakunya identik dengan
 * isActiveHref lama untuk item-item ini.
 */

import { Calendar, LayoutGrid, ListTodo, Settings } from "lucide-react";
import { AppRail, type AppRailGroup } from "@/ui_engine";
import { EXTENSIONS } from "@/extensions/registry";

// Two task views, deliberately separate: `/` answers "what is on each of my
// projects", `/upcoming` answers "what is due when". One list cannot answer both
// without lying in its title, which is what "Today's View" used to do.
const CORE_ITEMS = [
  { icon: LayoutGrid, label: "Projects", href: "/projects" },
  { icon: ListTodo, label: "Tasks", href: "/" },
  { icon: Calendar, label: "Upcoming", href: "/upcoming" },
];

export function NavOuter({ appTitle = "StudioFlow" }: { appTitle?: string }) {
  const groups: readonly AppRailGroup[] = [
    {
      items: [...CORE_ITEMS, ...EXTENSIONS, { icon: Settings, label: "Settings", href: "/settings" }],
    },
  ];

  return <AppRail eyebrow="Workspace" title={appTitle} groups={groups} />;
}
