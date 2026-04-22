import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, Database, Settings2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageBackLink } from "@/ui_engine/navigation/page-back-link";
import { PageHeader } from "@/ui_engine/layout/page-header";
import { DashboardPageShell } from "@/ui_engine/layout/shells/dashboard-page-shell";
import { Heading } from "@/ui_engine/components/heading";

type SettingsShellProps = {
  activeTab: "profile" | "studio" | "clients" | "database";
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
  {
    id: "database" as const,
    label: "Database",
    href: "/settings/database",
    icon: Database,
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
      <PageHeader
        eyebrow="Settings"
        title="Studio Settings"
        description={description}
        divider={false}
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-[var(--ui-radius-card,1.5rem)] border border-slate-200 bg-white p-2 shadow-[var(--ui-surface-shadow)]">
          <div className="mb-2 px-3 py-3">
            <Heading level={6} variant="uiMeta">
              {activeTab === "profile" ? "Personal Settings" : "Admin Settings"}
            </Heading>
          </div>
          <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;

              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    "inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="space-y-6">
          <div className="space-y-1">
            <Heading level={2}>
              {title}
            </Heading>
          </div>

          {children}
        </section>
      </div>
    </DashboardPageShell>
  );
}
