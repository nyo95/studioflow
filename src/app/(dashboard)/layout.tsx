import { cn } from "@/lib/utils";
import { NavOuter } from "@/components/nav-outer";
import { TopHeader } from "@/components/top-header";
import { SidebarProvider } from "@/context/sidebar-context";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UI_ENGINE_CANVAS_CLASS } from "@/ui_engine/tokens";
import { DESIGN_SYSTEM_CONFIG } from "@/ui_engine/design-system.config";

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

  // Fetch Brand Customization
  const systemConfig = await prisma.systemConfig.findUnique({
    where: { id: "default" },
    select: { app_title: true, ui_settings: true },
  });

  const appTitle = systemConfig?.app_title || "StudioFlow";
  const uiSettings = (systemConfig?.ui_settings as any) || {};
  const logoUrl = uiSettings.appLogoUrl || null;

  const topBarTheme = DESIGN_SYSTEM_CONFIG.ui.topBar.theme;
  const footerTheme = DESIGN_SYSTEM_CONFIG.ui.footer.theme;

  return (
    <SidebarProvider>
      <div className={cn("flex h-screen w-full flex-col overflow-hidden", UI_ENGINE_CANVAS_CLASS)}>
        <TopHeader
          userName={user?.name || "Guest"}
          userInitials={userInitials}
          userRole={user?.role || "STAFF"}
          appTitle={appTitle}
          logoUrl={logoUrl}
          theme={topBarTheme}
        />

        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <NavOuter appTitle={appTitle} />

          <main className={cn("relative flex-1 overflow-y-auto", UI_ENGINE_CANVAS_CLASS)}>
            {children}
          </main>
        </div>

        <footer
          className={cn(
            "flex flex-shrink-0 justify-center border-t py-4",
            footerTheme === "dark" 
              ? "border-slate-800 bg-slate-950 text-slate-400" 
              : "border-slate-200 bg-white text-slate-500",
            footerTheme === "light" && UI_ENGINE_CANVAS_CLASS
          )}
        >
          <p className="select-none font-sans text-[10px] font-medium uppercase tracking-widest">
            {appTitle} by BK (c)2026
          </p>
        </footer>
      </div>
    </SidebarProvider>
  );
}
