import { NavOuter } from "@/components/nav-outer";
import { TopHeader } from "@/components/top-header";
import { SidebarProvider } from "@/context/sidebar-context";
import { getSession } from "@/lib/auth";

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

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-white lg:flex-row">
        <NavOuter />

        <div className="flex h-screen min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
          <TopHeader
            userName={user?.name || "Guest"}
            userInitials={userInitials}
            userRole={user?.role || "STAFF"}
          />

          <main className="relative flex-1 overflow-y-auto bg-white">
            {children}
          </main>

          <footer className="flex flex-shrink-0 justify-center border-t border-slate-200 bg-white py-4">
            <p className="select-none font-sans text-[10px] font-medium uppercase tracking-widest text-slate-500">
              StudioFlow by BK (c)2026
            </p>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
