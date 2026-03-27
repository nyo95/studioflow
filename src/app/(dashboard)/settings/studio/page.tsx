import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setAutoNamingEnabled } from "@/app/actions";
import { StudioSettingsPanel } from "@/components/studio-settings-panel";
import { SettingsShell } from "@/ui_engine";

export default async function StudioSettingsPage() {
  const { userId, role } = await getSession();

  if (!userId) {
    redirect("/login");
  }

  if (role !== Role.ADMIN) {
    redirect("/settings/profile");
  }

  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  const timelineTemplates = await prisma.timelineTemplate.findMany();
  const checklistTemplates = await prisma.checklistTemplate.findMany();
  const [systemConfig] = await prisma.$queryRaw<Array<{ is_auto_naming_enabled: boolean }>>`
    SELECT "is_auto_naming_enabled"
    FROM "SystemConfig"
    WHERE "id" = 'default'
    LIMIT 1
  `;
  const isAutoNamingEnabled = systemConfig?.is_auto_naming_enabled ?? true;

  async function saveBranding(formData: FormData) {
    "use server";

    const isAutoNamingEnabled =
      String(formData.get("is_auto_naming_enabled")) === "true";
    await setAutoNamingEnabled(isAutoNamingEnabled);
  }

  return (
    <SettingsShell
      activeTab="studio"
      isAdmin
      title="Studio Controls"
      description="Manage branding rules, team access, and project engine templates."
    >
      <StudioSettingsPanel
        allUsers={allUsers}
        currentUserId={userId}
        requesterRole={role}
        timelineTemplates={timelineTemplates}
        checklistTemplates={checklistTemplates}
        isAutoNamingEnabled={isAutoNamingEnabled}
        saveBranding={saveBranding}
      />
    </SettingsShell>
  );
}
