import { redirect } from "next/navigation";
import { prisma } from "@/core/platform/db";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/core/rbac/rbac";
import { ClientManagementTable } from "@/components/client-management-table";
import { SettingsShell } from "@/ui_engine";

export default async function ClientSettingsPage() {
  const { userId, role } = await getSession();

  if (!userId) {
    redirect("/login");
  }

  if (!isAdminLevel(role)) {
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
        <ClientManagementTable clients={clients} />
      </section>
    </SettingsShell>
  );
}
