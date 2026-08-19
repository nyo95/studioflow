import { Clock3, Search, type LucideIcon } from "lucide-react";

export type Extension = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  enabled: boolean;
};

function isEnabled(rawValue: string | undefined, fallback = true) {
  if (!rawValue) return fallback;
  return rawValue.toLowerCase() !== "false";
}

export const EXTENSIONS: Extension[] = [
  // §6.14 Brand-First Library. Search a material term → get brands that sell it.
  // /extensions/library (old per-SKU surface) is retired; it redirects to /masterdata.
  // Label decided 2026-08-04 (PLAN-AUDIT-ROADMAP-2026Q3.md §2.5/§5 R5):
  // "Search Library" over the literal "Search on Library".
  {
    id: "brand-library",
    label: "Search Library",
    icon: Search,
    href: "/library",
    enabled: isEnabled(process.env.NEXT_PUBLIC_ENABLE_LIBRARY, true),
  },
  // for extension: timeline //
  {
    id: "timeline",
    label: "Timeline",
    icon: Clock3,
    href: "/timeline",
    enabled: isEnabled(process.env.NEXT_PUBLIC_ENABLE_TIMELINE, false),
  },
  // "Upcoming" used to sit here as a disabled placeholder. It shipped
  // 2026-08-10 as a core route (see nav-outer.tsx) — a date view of the same
  // tasks `/` lists by project — so it is no longer an optional extension.
];
