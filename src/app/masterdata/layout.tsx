/**
 * MASTER DATA SUBAPP — layout + authorisation gate.
 *
 * Shares the same chrome as StudioFlow (TopHeader + vertical sidebar) so the
 * two sub-apps feel like one product. The sidebar items differ (Master Data
 * sections vs StudioFlow project nav), but the visual pattern is identical.
 *
 * ---------------------------------------------------------------------------
 * WHY THE GATE IS HERE AS WELL AS IN THE PROXY
 * ---------------------------------------------------------------------------
 * src/auth.config.ts -> authorized() already blocks unauthorised roles at the
 * edge. This is a deliberate second check (defense in depth): the proxy matcher
 * in src/proxy.ts excludes paths by regex, and a future edit to that regex
 * could silently unprotect this route. A server-side check inside the layout
 * cannot be bypassed that way, and costs nothing — the session is already
 * loaded.
 *
 * Do NOT remove this check when adding pages under /masterdata. Nested pages
 * inherit it, which is exactly the point.
 *
 * ---------------------------------------------------------------------------
 * DESIGN SYSTEM
 * ---------------------------------------------------------------------------
 * Fetches `SystemConfig.ui_settings` so studio-level theming (canvas colour,
 * radius, spacing, fonts, density) applies here exactly as it does in
 * (dashboard)/layout.tsx. Also fetches app_title and logoUrl for TopHeader.
 *
 * Page content uses `DashboardPageShell / PageHeader / SectionCard` from
 * ui_engine — no raw <div className="p-6 ..."> shells. AGENTS.md Zero
 * Hardcode Policy applies here exactly as everywhere else.
 */

import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { prisma } from "@/core/platform/db";
import { APP, canEnterApp, landingRouteFor } from "@/core/rbac/app-access";
import { SYSTEM_CONFIG_ID } from "@/core/rbac/permissions";
import { sanitizeUISettings, uiSettingsToStyle } from "@/lib/ui-settings";
import { DESIGN_SYSTEM_CONFIG } from "@/ui_engine/design-system.config";
import { UI_ENGINE_CANVAS_CLASS } from "@/ui_engine/tokens";
import { TopHeader } from "@/components/top-header";
import { MasterDataNavOuter } from "@/subapps/master-data/components/MasterDataNavOuter";
import { SidebarProvider } from "@/context/sidebar-context";
import type { UISettings } from "@/types/common";

export const dynamic = "force-dynamic";

export default async function MasterDataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, userId } = await getSession();

  if (!userId) redirect("/login");
  if (!canEnterApp(role, APP.MASTERDATA)) redirect(landingRouteFor(role));

  const systemConfig = await prisma.systemConfig.findUnique({
    where: { id: SYSTEM_CONFIG_ID },
    select: { app_title: true, ui_settings: true },
  });

  const uiSettings = sanitizeUISettings(
    (systemConfig?.ui_settings as UISettings | null | undefined) ?? {}
  );
  const uiStyle = uiSettingsToStyle(uiSettings);
  const appTitle = systemConfig?.app_title || "StudioFlow";
  const logoUrl = uiSettings.appLogoUrl || null;
  const topBarTheme = DESIGN_SYSTEM_CONFIG.ui.topBar.theme;

  const userInitials =
    typeof (user as { initials?: string | null } | null)?.initials === "string"
      ? (user as { initials?: string | null }).initials
      : null;

  // Links to other sub-apps the current role may access.
  // Rendered as ghost buttons in the TopHeader (same as StudioFlow does for MD/BQ).
  const subappLinks = [
    ...(canEnterApp(role, APP.STUDIOFLOW) ? [{ href: "/", label: "StudioFlow" }] : []),
    ...(canEnterApp(role, APP.BQ) ? [{ href: "/bq", label: "BQ" }] : []),
  ] as const;

  return (
    <SidebarProvider>
      <div
        className={cn("flex h-screen w-full flex-col overflow-hidden", UI_ENGINE_CANVAS_CLASS)}
        style={uiStyle}
      >
        <TopHeader
          userName={user?.name ?? "Guest"}
          userInitials={userInitials}
          userRole={role}
          appTitle={appTitle}
          logoUrl={logoUrl}
          theme={topBarTheme}
          showSearch={false}
          subappLinks={subappLinks}
        />

        <div className="relative flex flex-1 min-h-0 pt-14">
          <MasterDataNavOuter />

          {/* Same padding offset as StudioFlow's (dashboard)/layout.tsx */}
          <main className={cn("flex flex-1 flex-col overflow-y-auto lg:pl-[78px] lg:pr-6", UI_ENGINE_CANVAS_CLASS)}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
