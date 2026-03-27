import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ClientManagementTable } from "@/components/client-management-table";
import { SettingsShell } from "@/ui_engine";

export default async function ClientSettingsPage() {
  const { userId, role } = await getSession();

  if (!userId) {
    redirect("/login");
  }

  if (role !== "ADMIN") {
    redirect("/settings");
  }

  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      address: true,
      logo_url: true,
      updated_at: true,
      projects: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <SettingsShell
      activeTab="clients"
      isAdmin
      title="Clients and Branding Assets"
      description="Centralize client records. Logos remain available for dashboard and client management views only."
    >
      <section className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Directory
              </p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-slate-950">
                Clients and Branding Assets
              </h2>
            </div>
            <p className="text-sm text-slate-500">{clients.length} clients indexed</p>
          </div>
        </div>

        <ClientManagementTable clients={clients} />
      </section>
    </SettingsShell>
  );
}
