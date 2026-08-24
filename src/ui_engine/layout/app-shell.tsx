/**
 * UI ENGINE — APP SHELL (PRD Architecture Cleanup v2 §41, dibangun R6)
 * ============================================================================
 * Satu shell untuk seluruh sub-app:
 *
 *   <AppShell
 *     style={uiStyle}                       // theme studio-level (opsional)
 *     header={<TopHeader … />}              // slot — aplikasi yang menyusun
 *     navigation={<AppRail … />}            // slot
 *     footer={…}                            // slot opsional
 *   >
 *     {children}
 *   </AppShell>
 *
 * Shell memikul: canvas, tinggi header (token §37), offset rail di main,
 * SidebarProvider untuk drawer mobile. Sub-app TETAP memikul otorisasi
 * (gerbang sesi/role tetap di layout masing-masing) dan daftar nav-nya —
 * yang tidak lagi diduplikasi adalah implementasi visual chrome.
 *
 * Server-compatible: tanpa state, tanpa "use client" — slot boleh berisi
 * server-rendered element (TopHeader dengan data server, dsb.).
 */

import { cn } from "@/lib/utils";
import { SidebarProvider } from "@/context/sidebar-context";
import { UI_ENGINE_CANVAS_CLASS } from "@/ui_engine/tokens";

export interface AppShellProps {
  /** Inline style root (biasanya `uiSettingsToStyle(uiSettings)`). */
  style?: React.CSSProperties;
  /** Baris header atas (fixed). Biasanya `<TopHeader/>`. */
  header?: React.ReactNode;
  /** Navigasi luar. Biasanya `<AppRail/>`. */
  navigation?: React.ReactNode;
  /** Footer opsional di dalam main (dipakai StudioFlow dashboard). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ style, header, navigation, footer, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <div
        className={cn("flex h-screen w-full flex-col overflow-hidden", UI_ENGINE_CANVAS_CLASS)}
        style={style}
      >
        {header}
        <div className="relative flex min-h-0 flex-1 pt-[var(--ui-header-height)]">
          {navigation}
          <main
            className={cn(
              "flex flex-1 flex-col overflow-y-auto lg:pl-[var(--ui-rail-width-collapsed)] lg:pr-6",
              UI_ENGINE_CANVAS_CLASS
            )}
          >
            {footer ? (
              <>
                <div className="flex w-full flex-1 flex-col">{children}</div>
                {footer}
              </>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
