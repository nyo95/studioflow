"use client";

/**
 * UI ENGINE — APP RAIL (PRD Architecture Cleanup v2 §41, dibangun R6)
 * ============================================================================
 * Satu implementasi visual untuk rail navigasi luar yang sebelumnya diduplikasi
 * tiga kali (NavOuter, MasterDataNavOuter, BqNavOuter): aside ikon fixed di
 * desktop, backdrop + drawer slide-in di mobile.
 *
 * Engine hanya tahu "items", "groups", "eyebrow", "title" — daftar nav dan
 * nama subapp tetap dimiliki masing-masing aplikasi lewat adapter tipis di
 * `@/components` (nav-outer.tsx, MasterDataNavOuter.tsx, BqNavOuter.tsx).
 * Geometri (tinggi header, lebar rail) dibaca dari token theme §37, bukan
 * angka hardcoded.
 */

import { Fragment } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStablePathname } from "@/hooks/use-stable-pathname";
import { useSidebar } from "@/context/sidebar-context";
import { cn } from "@/lib/utils";
import { APP_HEADER_TOP_CLASS, APP_RAIL_COLLAPSED_WIDTH_CLASS } from "@/ui_engine/theme";
import { resolveActiveRailHref } from "./rail-active";

export type AppRailItem = {
  icon: React.ElementType;
  label: string;
  href: string;
  /** false → item terkunci dengan ikon gembok (dipakai extension registry). */
  enabled?: boolean;
};

/** Group dipisah divider tipis; satu group = tanpa divider. */
export type AppRailGroup = {
  items: readonly AppRailItem[];
};

export interface AppRailProps {
  groups: readonly AppRailGroup[];
  /** Baris kecil uppercase di atas judul drawer mobile ("Workspace"/"Subapp"). */
  eyebrow: string;
  /** Judul drawer mobile. */
  title: string;
}

const ACTIVE_RADIUS =
  "rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))]";

export function AppRail({ groups, eyebrow, title }: AppRailProps) {
  const pathname = useStablePathname();
  const { close, isOpen } = useSidebar();

  const activeHref = resolveActiveRailHref(
    pathname,
    groups.flatMap((group) => group.items.map((item) => item.href))
  );

  function renderItem(item: AppRailItem, showLabels: boolean) {
    const Icon = item.icon;
    const isEnabled = item.enabled !== false;
    const tooltipLabel = isEnabled ? item.label : `${item.label} (Coming Soon)`;

    const itemContent = isEnabled ? (
      <Link
        href={item.href}
        onClick={close}
        className={cn(
          "group flex items-center border transition-all duration-200",
          showLabels ? "h-11 gap-3 px-4" : "h-12 w-12 justify-center",
          item.href === activeHref
            ? `border-transparent bg-slate-100 text-slate-900 ${ACTIVE_RADIUS}`
            : `border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 ${ACTIVE_RADIUS}`
        )}
      >
        <Icon className="h-5 w-5" />
        {showLabels ? (
          <span className="font-sans text-sm font-medium">{item.label}</span>
        ) : null}
        <span className="sr-only">{item.label}</span>
      </Link>
    ) : (
      <div
        className={cn(
          "group relative flex items-center rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] border border-transparent text-slate-400",
          showLabels ? "h-11 gap-3 px-4 opacity-60" : "h-12 w-12 justify-center opacity-45"
        )}
        title={tooltipLabel}
      >
        <div className="relative">
          <Icon className="h-5 w-5" />
          <Lock className="absolute -bottom-1 -right-1 h-2.5 w-2.5 text-slate-400" />
        </div>
        {showLabels ? (
          <span className="ml-3 font-sans text-sm font-medium">{item.label}</span>
        ) : null}
        <span className="sr-only">{tooltipLabel}</span>
      </div>
    );

    return (
      <li key={item.href} className={cn("w-full", showLabels ? "" : "flex justify-center")}>
        <Tooltip>
          <TooltipTrigger asChild>{itemContent}</TooltipTrigger>
          <TooltipContent side={showLabels ? "bottom" : "right"}>
            <p className="font-sans text-xs">{tooltipLabel}</p>
          </TooltipContent>
        </Tooltip>
      </li>
    );
  }

  function renderGroups(showLabels: boolean) {
    return (
      <div className="flex w-full flex-col">
        {groups.map((group, index) => (
          <Fragment key={group.items.map((item) => item.href).join("|")}>
            {index > 0 ? (
              <div
                className={cn(
                  "border-t border-slate-100",
                  showLabels ? "my-3 mx-2" : "my-3 mx-3"
                )}
              />
            ) : null}
            <ul
              className={cn(
                "flex w-full gap-2",
                showLabels ? "flex-col" : "h-full flex-col items-center overflow-y-auto"
              )}
            >
              {group.items.map((item) => renderItem(item, showLabels))}
            </ul>
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop: fixed icon-only rail */}
      <aside
        className={cn(
          "fixed left-0 bottom-0 z-30 hidden border-r border-[var(--ui-border-subtle,rgb(241_245_249))] bg-white/96 py-4 text-slate-500 backdrop-blur lg:block",
          APP_HEADER_TOP_CLASS,
          APP_RAIL_COLLAPSED_WIDTH_CLASS
        )}
      >
        {renderGroups(false)}
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
            {eyebrow}
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-slate-900">{title}</p>
        </div>
        {renderGroups(true)}
      </aside>
    </TooltipProvider>
  );
}
