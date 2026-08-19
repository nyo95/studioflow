"use client";

import Link from "next/link";
import { Calendar, LayoutGrid, ListTodo, Lock, Settings, ShieldAlert } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui_engine";
import { useStablePathname } from "@/hooks/use-stable-pathname";
import { useSidebar } from "@/context/sidebar-context";
import { EXTENSIONS } from "@/extensions/registry";
import { cn } from "@/lib/utils";

// Two task views, deliberately separate: `/` answers "what is on each of my
// projects", `/upcoming` answers "what is due when". One list cannot answer both
// without lying in its title, which is what "Today's View" used to do.
const coreItems = [
  { icon: LayoutGrid, label: "Projects", href: "/projects" },
  { icon: ListTodo, label: "Tasks", href: "/" },
  { icon: Calendar, label: "Upcoming", href: "/upcoming" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function NavOuter({ appTitle = "StudioFlow", userRole = "STAFF" }: { appTitle?: string; userRole?: string }) {
  const pathname = useStablePathname();
  const { close, isOpen } = useSidebar();

  const items = [
    ...coreItems.slice(0, 3),
    // for extension: library //
    ...EXTENSIONS,
    ...coreItems.slice(3),
  ];

  function isActiveHref(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  }

  function renderNavList(showLabels: boolean) {
    return (
      <ul
        className={cn(
          "flex w-full gap-2 overflow-y-auto",
          showLabels ? "flex-col" : "h-full flex-col items-center"
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isDisabled = "enabled" in item ? !item.enabled : false;
          const isActive = isActiveHref(item.href);
          const tooltipLabel = isDisabled
            ? `${item.label} (Coming Soon)`
            : item.label;

          const itemContent = isDisabled ? (
            <div
              className={cn(
                "group relative flex items-center rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] border border-transparent text-slate-400",
                showLabels
                  ? "h-11 gap-3 px-4 opacity-60"
                  : "h-12 w-12 justify-center opacity-45"
              )}
              title={tooltipLabel}
              key={item.href}
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
          ) : (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={cn(
                "group flex items-center border transition-all duration-200",
                showLabels ? "h-11 gap-3 px-4" : "h-12 w-12 justify-center",
                isActive
                  ? "border-transparent bg-slate-100 text-slate-900 rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))]"
                  : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))]"
              )}
            >
              <Icon className="h-5 w-5" />
              {showLabels ? (
                <span className="font-sans text-sm font-medium">{item.label}</span>
              ) : null}
              <span className="sr-only">{item.label}</span>
            </Link>
          );

          return (
            <li
              key={item.href}
              className={cn("w-full", showLabels ? "" : "flex justify-center")}
            >
              <Tooltip>
                <TooltipTrigger asChild>{itemContent}</TooltipTrigger>
                <TooltipContent side={showLabels ? "bottom" : "right"}>
                  <p className="font-sans text-xs">{tooltipLabel}</p>
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className="fixed left-0 top-14 bottom-0 z-30 hidden w-[78px] border-r border-[var(--ui-border-subtle,rgb(241_245_249))] bg-white/96 py-4 text-slate-500 backdrop-blur lg:block"
      >
        {renderNavList(false)}
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/20 transition lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={close}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(272px,calc(100vw-1.5rem))] flex-col border-r border-slate-200 bg-white px-4 py-5 shadow-xl transition-transform duration-200 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!isOpen}
      >
        <div className="mb-5 border-b border-slate-200 pb-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Workspace
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-slate-900">
            {appTitle}
          </p>
        </div>
        {renderNavList(true)}
      </aside>
    </TooltipProvider>
  );
}
