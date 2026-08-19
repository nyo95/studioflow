import { redirect } from "next/navigation";
import { isAdminLevel } from "@/core/rbac/rbac";
import { getSession } from "@/lib/auth";
import { DatabaseSettingsPanel } from "@/components/DatabaseSettingsPanel";
import { SettingsShell } from "@/ui_engine";

export default async function DatabaseSettingsPage() {
  const { userId, role } = await getSession();

  if (!userId) {
    redirect("/login");
  }

  if (!isAdminLevel(role)) {
    redirect("/settings/profile");
  }

  return (
    <SettingsShell
      activeTab="database"
      isAdmin
      title="Database Management"
      description="Create snapshots of your studio data and restore them if needed."
    >
      <DatabaseSettingsPanel />
    </SettingsShell>
  );
}
