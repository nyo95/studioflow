/**
 * BQ SUBAPP — layout + authorisation gate.
 *
 * Sejak R6 (PRD Architecture Cleanup v2 §41) chrome visual dirender `AppShell`
 * dari engine; layout ini menyusun slot header/navigation dan memikul gerbang
 * otorisasi.
 *
 * ---------------------------------------------------------------------------
 * KENAPA GERBANGNYA DI SINI, PADAHAL PROXY SUDAH MENJAGA
 * ---------------------------------------------------------------------------
 * `src/auth.config.ts` -> `authorized()` sudah menolak role yang tidak berhak
 * di edge. Ini cek kedua yang disengaja (defense in depth): matcher di
 * `src/proxy.ts` mengecualikan path lewat regex, dan satu suntingan pada regex
 * itu bisa diam-diam membuka route ini. Cek di server component tidak bisa
 * dilewati dengan cara itu, dan ongkosnya nol — sesinya sudah dimuat.
 *
 * Versi sebelumnya menaruh gerbang ini di `page.tsx` karena `/bq` cuma satu
 * halaman stub. Sekarang ada halaman anak (`/bq/[projectId]`), jadi ia pindah
 * ke sini persis seperti catatan di stub itu memerintahkan.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/core/platform/db";
import { APP, canEnterApp, landingRouteFor } from "@/core/rbac/app-access";
import { SYSTEM_CONFIG_ID } from "@/core/rbac/permissions";
import { sanitizeUISettings, uiSettingsToStyle } from "@/lib/ui-settings";
import { DESIGN_SYSTEM_CONFIG } from "@/ui_engine/design-system.config";
import { AppShell } from "@/ui_engine";
import { TopHeader } from "@/components/top-header";
import { BqNavOuter } from "@/subapps/bq/components/BqNavOuter";
import type { UISettings } from "@/types/common";

export const dynamic = "force-dynamic";

export default async function BqLayout({ children }: { children: React.ReactNode }) {
  const { user, role, userId } = await getSession();

  if (!userId) redirect("/login");
  if (!canEnterApp(role, APP.BQ)) redirect(landingRouteFor(role));

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

  const subappLinks = [
    ...(canEnterApp(role, APP.STUDIOFLOW) ? [{ href: "/", label: "StudioFlow" }] : []),
    ...(canEnterApp(role, APP.MASTERDATA) ? [{ href: "/masterdata", label: "Master Data" }] : []),
  ] as const;

  return (
    <AppShell
      style={uiStyle}
      header={
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
      }
      navigation={<BqNavOuter />}
    >
      {children}
    </AppShell>
  );
}
