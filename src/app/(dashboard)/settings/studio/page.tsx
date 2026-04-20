import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setAutoNamingEnabled, updateUISettings } from "@/actions/settings-actions";
import { StudioSettingsPanel } from "@/components/studio-settings-panel";
import { unwrapActionResult } from "@/lib/result";
import { SettingsShell } from "@/ui_engine";
import { sanitizeUISettings } from "@/lib/ui-settings";
import { SYSTEM_CONFIG_ID } from "@/lib/permissions";
import type { UISettings } from "@/types/common";

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
  const scheduleTemplates = await prisma.scheduleTemplate.findMany({
    orderBy: [{ section: "asc" }, { schedule_category: "asc" }],
  });
  const schedulePrefixes = await prisma.prefixDictionary.findMany({
    orderBy: [{ section: "asc" }, { schedule_category: "asc" }],
  });
  const systemConfig = await prisma.systemConfig.findUnique({
    where: { id: SYSTEM_CONFIG_ID },
    select: { is_auto_naming_enabled: true, ui_settings: true, app_title: true },
  });
  const isAutoNamingEnabled = systemConfig?.is_auto_naming_enabled ?? true;
  const uiSettings = sanitizeUISettings((systemConfig?.ui_settings as UISettings | null | undefined) ?? {});

  async function saveBranding(formData: FormData) {
    "use server";

    const isAutoNamingEnabled =
      String(formData.get("is_auto_naming_enabled")) === "true";
    unwrapActionResult(await setAutoNamingEnabled({ isEnabled: isAutoNamingEnabled }));
  }

  async function saveUISettings(
    uiSettings: UISettings,
    appTitle?: string
  ) {
    "use server";

    unwrapActionResult(await updateUISettings({ uiSettings, appTitle }));
    return uiSettings;
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
        scheduleTemplates={scheduleTemplates}
        schedulePrefixes={schedulePrefixes}
        isAutoNamingEnabled={isAutoNamingEnabled}
        appTitleInitial={systemConfig?.app_title || "StudioFlow"}
        saveBranding={saveBranding}
        uiSettings={uiSettings}
        updateUISettings={saveUISettings}
      />
    </SettingsShell>
  );
}
