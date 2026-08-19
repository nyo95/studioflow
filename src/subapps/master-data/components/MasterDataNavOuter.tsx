"use client";

/**
 * Master Data vertical sidebar — mirrors NavOuter's pattern exactly so the
 * chrome looks identical to StudioFlow.
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
 * it is an admin tool, not a daily-use section.
 */

import Link from "next/link";
import { Building2, CircleDollarSign, Database, Layers, Library, Package } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui_engine";
import { useStablePathname } from "@/hooks/use-stable-pathname";
import { useSidebar } from "@/context/sidebar-context";
import { cn } from "@/lib/utils";

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

const RADIUS = "rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))]";

export function MasterDataNavOuter() {
  const pathname = useStablePathname();
  const { close, isOpen } = useSidebar();

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  function renderItem(item: { icon: React.ElementType; label: string; href: string }, showLabels: boolean) {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <li
        key={item.href}
        className={cn("w-full", showLabels ? "" : "flex justify-center")}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              onClick={close}
              className={cn(
                "group flex items-center border transition-all duration-200",
                showLabels ? "h-11 gap-3 px-4" : "h-12 w-12 justify-center",
                active
                  ? `border-transparent bg-slate-100 text-slate-900 ${RADIUS}`
                  : `border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 ${RADIUS}`
              )}
            >
              <Icon className="h-5 w-5" />
              {showLabels ? (
                <span className="font-sans text-sm font-medium">{item.label}</span>
              ) : null}
              <span className="sr-only">{item.label}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side={showLabels ? "bottom" : "right"}>
            <p className="font-sans text-xs">{item.label}</p>
          </TooltipContent>
        </Tooltip>
      </li>
    );
  }

  function renderNavList(showLabels: boolean) {
    return (
      <div className={cn("flex w-full flex-col", showLabels ? "gap-0" : "h-full gap-0")}>
        {/* Main nav */}
        <ul className={cn("flex w-full gap-2", showLabels ? "flex-col" : "flex-col items-center")}>
          {MAIN_ITEMS.map((item) => renderItem(item, showLabels))}
        </ul>

        {/* Divider */}
        <div className={cn(
          "border-t border-slate-100",
          showLabels ? "my-3 mx-2" : "my-3 mx-3"
        )} />

        {/* Tool items */}
        <ul className={cn("flex w-full gap-2", showLabels ? "flex-col" : "flex-col items-center")}>
          {TOOL_ITEMS.map((item) => renderItem(item, showLabels))}
        </ul>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop: fixed icon-only sidebar */}
      <aside className="fixed left-0 top-14 bottom-0 z-30 hidden w-[78px] border-r border-[var(--ui-border-subtle,rgb(241_245_249))] bg-white/96 py-4 text-slate-500 backdrop-blur lg:block">
        {renderNavList(false)}
      </aside>

      {/* Mobile: backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/20 transition lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={close}
      />

      {/* Mobile: slide-in drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(272px,calc(100vw-1.5rem))] flex-col border-r border-slate-200 bg-white px-4 py-5 shadow-xl transition-transform duration-200 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!isOpen}
      >
        <div className="mb-5 border-b border-slate-200 pb-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Subapp
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-slate-900">Master Data</p>
        </div>
        {renderNavList(true)}
      </aside>
    </TooltipProvider>
  );
}
