import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP, canEnterApp, landingRouteFor, subappLinksFor } from "@/core/rbac/app-access";
import { NavOuter } from "@/components/nav-outer";
import { TopHeader } from "@/components/top-header";
import { SidebarProvider } from "@/context/sidebar-context";
import { getSession } from "@/lib/auth";
import { prisma } from "@/core/platform/db";
import { UI_ENGINE_CANVAS_CLASS } from "@/ui_engine/tokens";
import { DESIGN_SYSTEM_CONFIG } from "@/ui_engine/design-system.config";
import { sanitizeUISettings, uiSettingsToStyle } from "@/lib/ui-settings";
import { SYSTEM_CONFIG_ID } from "@/core/rbac/permissions";
import type { UISettings } from "@/types/common";
import type { Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role } = await getSession();

  // DEFENSE IN DEPTH. The edge proxy (src/auth.config.ts -> authorized) already
  // blocks roles that may not enter StudioFlow, but this layout re-checks
  // server-side so a proxy matcher change or middleware bypass cannot leak
  // project data to an ESTIMATOR. Cheap: no extra query, role is already loaded.
  if (!canEnterApp(role, APP.STUDIOFLOW)) {
    redirect(landingRouteFor(role));
  }
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
        {/* userRole previously fell back to "STAFF" here. With STAFF owning
            Master Data that default rendered a privileged nav for a session
            with no role claim. `role` from getSession() is already resolved
            against LEAST_PRIVILEGE_ROLE, so pass it straight through.
            subappLinks is non-empty only for ADMIN/DEVELOPER — see
            src/core/rbac/app-access.ts#subappLinksFor. */}
        <TopHeader
          userName={user?.name || "Guest"}
          userInitials={userInitials}
          userRole={role}
          appTitle={appTitle}
          logoUrl={logoUrl}
          theme={topBarTheme}
          projectSearchItems={projectSearchItems}
          activityNotifications={recentActivity}
          subappLinks={subappLinksFor(role)}
        />

        <div className="flex flex-1 pt-14 min-h-0 relative">
          <NavOuter appTitle={appTitle} userRole={role} />

          <main className={cn("flex flex-1 flex-col overflow-y-auto lg:pl-[78px] lg:pr-6", UI_ENGINE_CANVAS_CLASS)}>
            <div className="flex flex-1 flex-col w-full">
              {children}
            </div>
            
            <footer className="mt-auto flex justify-center py-4 border-t border-[var(--ui-border-subtle,rgb(241_245_249))] text-slate-400">
              <p className="select-none font-sans text-[10px] font-medium uppercase tracking-[0.2em]">
                {appTitle} by BK (c)2026
              </p>
            </footer>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
