import { cn } from "@/lib/utils";
import { NavOuter } from "@/components/nav-outer";
import { TopHeader } from "@/components/top-header";
import { SidebarProvider } from "@/context/sidebar-context";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UI_ENGINE_CANVAS_CLASS } from "@/ui_engine/tokens";
import { DESIGN_SYSTEM_CONFIG } from "@/ui_engine/design-system.config";
import { sanitizeUISettings, uiSettingsToStyle } from "@/lib/ui-settings";
import { SYSTEM_CONFIG_ID } from "@/lib/permissions";
import type { UISettings } from "@/types/common";
import type { Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getSession();
  const userInitials =
    typeof (user as { initials?: string | null } | null)?.initials === "string"
      ? (user as { initials?: string | null }).initials
      : null;

  type AuditDetailsRecord = Record<string, unknown>;
  const toRecord = (value: Prisma.JsonValue | null): AuditDetailsRecord =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as AuditDetailsRecord)
      : {};

  const [systemConfig, projectSearchItems, recentActivityLogs] = await Promise.all([
    prisma.systemConfig.findUnique({
      where: { id: SYSTEM_CONFIG_ID },
      select: { app_title: true, ui_settings: true },
    }),
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        client: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { created_at: "desc" },
      take: 8,
      include: {
        user: {
          select: { id: true, name: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const appTitle = systemConfig?.app_title || "StudioFlow";
  const uiSettings = sanitizeUISettings((systemConfig?.ui_settings as UISettings | null | undefined) ?? {});
  const logoUrl = uiSettings.appLogoUrl || null;
  const uiStyle = uiSettingsToStyle(uiSettings);
  const recentActivity = recentActivityLogs.map((log) => {
    const details = toRecord(log.details);
    const detailsProjectId = typeof details.project_id === "string" ? details.project_id : null;
    const detailsProjectName = typeof details.project_name === "string" ? details.project_name : null;
    const projectId = log.project_id ?? detailsProjectId;

    return {
      id: log.id,
      action: log.action,
      entityType: log.entity_type,
      createdAt: log.created_at.toISOString(),
      actorName: log.user?.name ?? "Sistem",
      projectId,
      projectName: log.project?.name ?? detailsProjectName ?? null,
      href: projectId ? `/projects/${projectId}/activity` : "/activity",
    };
  });

  const topBarTheme = DESIGN_SYSTEM_CONFIG.ui.topBar.theme;
  const footerTheme = DESIGN_SYSTEM_CONFIG.ui.footer.theme;

  return (
    <SidebarProvider>
      <div
        className={cn("flex h-screen w-full flex-col overflow-hidden", UI_ENGINE_CANVAS_CLASS)}
        style={uiStyle}
      >
        <TopHeader
          userName={user?.name || "Guest"}
          userInitials={userInitials}
          userRole={user?.role || "STAFF"}
          appTitle={appTitle}
          logoUrl={logoUrl}
          theme={topBarTheme}
          projectSearchItems={projectSearchItems}
          activityNotifications={recentActivity}
        />

        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <NavOuter appTitle={appTitle} />

          <main className={cn("relative flex-1 overflow-y-auto", UI_ENGINE_CANVAS_CLASS)}>
            {children}
          </main>
        </div>

        <footer
          className={cn(
            "flex flex-shrink-0 items-center justify-center border-t px-[var(--ui-section-px,1.5rem)] py-4",
            footerTheme === "dark" 
              ? "border-slate-800 bg-slate-950 text-slate-400" 
              : "border-slate-200 bg-white text-slate-500",
            footerTheme === "light" && UI_ENGINE_CANVAS_CLASS
          )}
        >
          <p className="select-none font-sans text-[10px] font-medium uppercase tracking-[0.2em]">
            {appTitle} by BK (c)2026
          </p>
        </footer>
      </div>
    </SidebarProvider>
  );
}
