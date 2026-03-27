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
        <ClientManagementTable clients={clients} />
      </section>
    </SettingsShell>
  );
}
