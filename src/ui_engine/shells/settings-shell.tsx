import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, Settings2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageBackLink } from "@/ui_engine/navigation/page-back-link";
import { PageHeader } from "@/ui_engine/layout/page-header";
import { DashboardPageShell } from "@/ui_engine/shells/dashboard-page-shell";

type SettingsShellProps = {
  activeTab: "profile" | "studio" | "clients";
  isAdmin: boolean;
  title: string;
  description: string;
  children: ReactNode;
};

const tabs = [
  {
    id: "profile" as const,
    label: "Profile",
    href: "/settings/profile",
    icon: UserRound,
  },
  {
    id: "studio" as const,
    label: "Studio",
    href: "/settings/studio",
    icon: Settings2,
    adminOnly: true,
  },
  {
    id: "clients" as const,
    label: "Clients",
    href: "/settings/clients",
    icon: Building2,
    adminOnly: true,
  },
];

export function SettingsShell({
  activeTab,
  isAdmin,
  title,
  description,
  children,
}: SettingsShellProps) {
  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <DashboardPageShell className="space-y-8">
      <PageBackLink />
      <PageHeader title="SETTINGS" description={description} divider={false} />

      <div className="inline-flex w-full flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      <section className="space-y-8">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {activeTab === "profile" ? "Personal Settings" : "Admin Settings"}
          </p>
          <h2 className="font-serif text-2xl font-bold text-slate-950">
            {title}
          </h2>
        </div>

        {children}
      </section>
    </DashboardPageShell>
  );
}
