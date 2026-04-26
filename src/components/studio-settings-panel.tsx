"use client";

import { useState } from "react";
import { Blocks, Palette, Settings2, Users2, ShoppingBag } from "lucide-react";
import type { Role, ProductType } from "@/generated/prisma";
import { TemplateManager } from "@/components/template-manager";
import { UserManagement } from "@/components/user-management";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UISettings } from "@/types/common";

interface TimelineTemplate {
  phase_enum: string;
  duration_days: number;
}

interface ChecklistTemplate {
  id: string;
  phase_enum: string | null;
  label: string;
}

interface ScheduleTemplateConfig {
  id: string;
  schedule_category: string;
  section: ProductType;
  is_active: boolean;
}

interface SchedulePrefixConfig {
  id: string;
  schedule_category: string;
  prefix: string;
  section: ProductType;
}

type PanelKey = "general" | "team" | "project-engine" | "design-system" | "product-catalog";

const sections = [
  {
    key: "general" as const,
    label: "General",
    description: "Branding and naming rules",
    icon: Settings2,
  },
  {
    key: "design-system" as const,
    label: "Design System",
    description: "UI Engine & Studioflow specs",
    icon: Palette,
  },
  {
    key: "team" as const,
    label: "Team",
    description: "User access and roles",
    icon: Users2,
  },
  {
    key: "project-engine" as const,
    label: "Project Engine",
    description: "Timeline and checklist templates",
    icon: Blocks,
  },
  {
    key: "product-catalog" as const,
    label: "Product Library",
    description: "Scheduler categories and prefixes",
    icon: ShoppingBag,
  },
];

export function StudioSettingsPanel({
  allUsers,
  currentUserId,
  requesterRole,
  timelineTemplates,
  checklistTemplates,
  scheduleTemplates,
  schedulePrefixes,
  isAutoNamingEnabled,
  appTitleInitial = "StudioFlow",
  saveBranding,
  uiSettings = {},
  updateUISettings,
}: {
  allUsers: Array<{ id: string; name: string; email: string; role: Role }>;
  currentUserId: string;
  requesterRole: Role;
  timelineTemplates: TimelineTemplate[];
  checklistTemplates: ChecklistTemplate[];
  scheduleTemplates: ScheduleTemplateConfig[];
  schedulePrefixes: SchedulePrefixConfig[];
  isAutoNamingEnabled: boolean;
  appTitleInitial?: string;
  saveBranding: (formData: FormData) => Promise<void>;
  uiSettings: UISettings;
  updateUISettings: (settings: UISettings, appTitle?: string) => Promise<UISettings>;
}) {
  const [activePanel, setActivePanel] = useState<PanelKey>("general");
  const [localUISettings, setLocalUISettings] = useState<UISettings>(uiSettings || {});
  const [appTitle, setAppTitle] = useState(appTitleInitial);
  const [isSaving, setIsSaving] = useState(false);

  const handleUISettingChange = (key: string, value: string) => {
    const nextSettings = { ...localUISettings, [key]: value };
    setLocalUISettings(nextSettings);
    
    // Apply live preview by updating CSS variables on the fly
    const variableMap: Record<string, string> = {
      canvasBg: "--ui-canvas-bg",
      radiusCard: "--ui-radius-card",
      sectionPx: "--ui-section-px",
      sectionPy: "--ui-section-py",
      sidebarWidth: "--ui-sidebar-width",
      containerMaxWidth: "--ui-container-max-width",
      fontSerif: "--ui-font-serif",
      rowPaddingY: "--ui-row-padding-y",
      pagePaddingY: "--ui-page-padding-y",
      pageMaxWidth: "--ui-page-max-width",
      tableDensity: "--ui-table-density",
      modalDensity: "--ui-modal-density",
    };
    
    if (variableMap[key]) {
      document.documentElement.style.setProperty(variableMap[key], value);
    }
  };

  const saveDesignSystem = async () => {
    setIsSaving(true);
    try {
      await updateUISettings(localUISettings, appTitle);
    } catch (error) {
      console.error("Failed to save UI settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn(
      "grid gap-6 lg:grid-cols-[256px_minmax(0,1fr)] lg:items-start transition-all duration-300",
      activePanel === "product-catalog" ? "max-w-none px-10" : localUISettings.containerMaxWidth || "max-w-7xl",
      "mx-auto w-full"
    )}>
      <aside className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = section.key === activePanel;

            return (
              <Button
                key={section.key}
                type="button"
                variant="ghost"
                onClick={() => setActivePanel(section.key)}
                className={cn(
                  "h-auto w-full justify-start rounded-2xl px-4 py-3 text-left",
                  isActive
                    ? "bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{section.label}</span>
                  <span
                    className={cn(
                      "block text-[11px]",
                      isActive ? "text-slate-300" : "text-slate-400"
                    )}
                  >
                    {section.description}
                  </span>
                </span>
              </Button>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        {activePanel === "general" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1 border-b border-slate-100 pb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                General
              </p>
              <h3 className="font-serif text-2xl font-bold text-slate-950">Branding</h3>
              <p className="max-w-2xl text-sm text-slate-500">
                Customize your website identity and naming rules.
              </p>
            </div>

            <div className="mt-6 space-y-6 border-b border-slate-100 pb-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-900">Website Title</label>
                  <input
                    type="text"
                    value={appTitle}
                    onChange={(e) => setAppTitle(e.target.value)}
                    placeholder="StudioFlow"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  />
                  <p className="text-[10px] text-slate-400 italic">Watermark &quot;by BK&quot; is preserved.</p>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-900">App Logo URL</label>
                  <input
                    type="text"
                    value={localUISettings.appLogoUrl || ""}
                    onChange={(e) => handleUISettingChange("appLogoUrl", e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  />
                  <p className="text-[10px] text-slate-400 italic">Provide a direct link to your logo image.</p>
                </div>
              </div>
              <Button 
                onClick={saveDesignSystem}
                disabled={isSaving}
                className="rounded-full bg-slate-900 px-6 py-2 text-xs font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90"
              >
                {isSaving ? "Saving..." : "Update Branding"}
              </Button>
            </div>

            <form
              action={saveBranding}
              className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Auto-Naming Format
                  </p>
                  <p className="text-sm text-slate-500">
                    {isAutoNamingEnabled
                      ? "System generates the [YYYY]-[NNN]- prefix automatically."
                      : "Admins must enter the full title manually using [YYYY]-[NNN]-[Name]."}
                  </p>
                </div>
                <p className="font-mono text-xs text-slate-500">
                  Format: [YYYY]-[NNN]-[Name]
                </p>
              </div>

              <button
                type="submit"
                name="is_auto_naming_enabled"
                value={String(!isAutoNamingEnabled)}
                className="inline-flex items-center gap-3 self-start rounded-full border border-slate-200 bg-slate-50 px-4 py-2 transition-colors hover:border-slate-300 hover:bg-slate-100"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {isAutoNamingEnabled ? "Enabled" : "Disabled"}
                </span>
                <span
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                    isAutoNamingEnabled ? "bg-slate-900" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                      isAutoNamingEnabled ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </span>
              </button>
            </form>
          </section>
        ) : null}

        {activePanel === "design-system" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1 border-b border-slate-100 pb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                UI Engine
              </p>
              <h3 className="font-serif text-2xl font-bold text-slate-950">Design System</h3>
              <p className="max-w-2xl text-sm text-slate-500">
                Tweak the Studioflow visual identity. Changes apply globally.
              </p>
            </div>

            <div className="mt-8 space-y-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Card Radius</label>
                  <select
                    value={localUISettings?.radiusCard || "1rem"}
                    onChange={(e) => handleUISettingChange("radiusCard", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="0.5rem">Sharp (8px)</option>
                    <option value="1rem">Soft (16px) - Default</option>
                    <option value="1.25rem">Modern (20px)</option>
                    <option value="1.5rem">Extra Rounded (24px)</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Canvas Background</label>
                  <select
                    value={localUISettings?.canvasBg || "oklch(0.985 0 0)"}
                    onChange={(e) => handleUISettingChange("canvasBg", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="white">Pure White</option>
                    <option value="oklch(0.985 0 0)">Studio Slate (Default)</option>
                    <option value="oklch(0.967 0 0)">Deep Slate</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Horizontal Padding</label>
                  <select
                    value={localUISettings?.sectionPx || "2rem"}
                    onChange={(e) => handleUISettingChange("sectionPx", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="1rem">Narrow (16px)</option>
                    <option value="1.5rem">Studio (24px)</option>
                    <option value="2rem">Standard (32px)</option>
                    <option value="3rem">Wide (48px)</option>
                    <option value="4rem">Extra Wide (64px)</option>
                    <option value="6rem">Ultra Wide (96px)</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Vertical Padding</label>
                  <select
                    value={localUISettings?.sectionPy || "1.5rem"}
                    onChange={(e) => handleUISettingChange("sectionPy", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="1rem">Tight (16px)</option>
                    <option value="1.5rem">Standard (24px) - Default</option>
                    <option value="2rem">Loose (32px)</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Sidebar Width</label>
                  <select
                    value={localUISettings?.sidebarWidth || "256px"}
                    onChange={(e) => handleUISettingChange("sidebarWidth", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="220px">Compact (220px)</option>
                    <option value="256px">Standard (256px)</option>
                    <option value="280px">Wide (280px)</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Max Container Width</label>
                  <select
                    value={localUISettings?.containerMaxWidth || "max-w-7xl"}
                    onChange={(e) => handleUISettingChange("containerMaxWidth", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="max-w-4xl">4xl (896px)</option>
                    <option value="max-w-5xl">5xl (1024px)</option>
                    <option value="max-w-6xl">6xl (1152px)</option>
                    <option value="max-w-7xl">7xl (1280px) - Default</option>
                    <option value="max-w-full">Full Width</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Heading Font (Serif)</label>
                  <select
                    value={localUISettings?.fontSerif || "var(--font-serif-base)"}
                    onChange={(e) => handleUISettingChange("fontSerif", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="var(--font-serif-base)">Lora (StudioFlow Serif)</option>
                    <option value="ui-serif, Georgia, serif">System Serif</option>
                    <option value="var(--font-sans-base)">Switch to Sans (All-Inter)</option>
                  </select>
                </div>
 
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Row Compactness</label>
                  <select
                    value={localUISettings?.rowPaddingY || "1.25rem"}
                    onChange={(e) => handleUISettingChange("rowPaddingY", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="0.75rem">Compact (12px) - Best Proportion</option>
                    <option value="1rem">Tighter (16px)</option>
                    <option value="1.25rem">Standard (20px) - Default</option>
                    <option value="1.5rem">Relaxed (24px)</option>
                    <option value="2rem">Loose (32px)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 italic">Controls internal spacing of standard lists.</p>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Table Density</label>
                  <select
                    value={localUISettings?.tableDensity || "compact"}
                    onChange={(e) => handleUISettingChange("tableDensity", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="compact">Compact (Dense Data)</option>
                    <option value="standard">Standard (Default)</option>
                    <option value="relaxed">Relaxed (More Spacing)</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Modal Density</label>
                  <select
                    value={localUISettings?.modalDensity || "standard"}
                    onChange={(e) => handleUISettingChange("modalDensity", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="compact">Compact (Tighter Forms)</option>
                    <option value="standard">Standard (Default)</option>
                    <option value="relaxed">Relaxed (Spacious Forms)</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Page Vertical Padding</label>
                  <select
                    value={localUISettings?.pagePaddingY || "2.5rem"}
                    onChange={(e) => handleUISettingChange("pagePaddingY", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="1.5rem">Compact (24px)</option>
                    <option value="2.5rem">Standard (40px) - Default</option>
                    <option value="3.5rem">Relaxed (56px)</option>
                    <option value="5rem">Spacious (80px)</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-900">Page Max Width</label>
                  <select
                    value={localUISettings?.pageMaxWidth || "1280px"}
                    onChange={(e) => handleUISettingChange("pageMaxWidth", e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <option value="896px">Focused (896px)</option>
                    <option value="1024px">Standard (1024px)</option>
                    <option value="1280px">Wide (1280px) - Default</option>
                    <option value="100%">Full Width</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  onClick={saveDesignSystem}
                  disabled={isSaving}
                  className="rounded-full bg-slate-900 px-8 py-6 text-xs font-bold uppercase tracking-widest text-white transition-all hover:scale-105 active:scale-95"
                >
                  {isSaving ? "Publishing Changes..." : "Publish Design System"}
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {activePanel === "team" ? (
          <section className="rounded-3xl border border-slate-200 bg-slate-50/50 p-6">
            <UserManagement
              allUsers={allUsers}
              currentUserId={currentUserId}
              requesterRole={requesterRole}
            />
          </section>
        ) : null}

        {activePanel === "project-engine" ? (
          <section className="rounded-3xl border border-slate-200 bg-slate-50/50 p-6">
            <TemplateManager
              mode="project-engine"
              timelineTemplates={timelineTemplates}
              checklistTemplates={checklistTemplates}
              scheduleTemplates={scheduleTemplates}
              schedulePrefixes={schedulePrefixes}
              userRole={requesterRole}
            />
          </section>
        ) : null}
        
        {activePanel === "product-catalog" ? (
          <section className="rounded-3xl border border-slate-200 bg-slate-50/50 p-6">
            <TemplateManager
              mode="product-catalog"
              timelineTemplates={timelineTemplates}
              checklistTemplates={checklistTemplates}
              scheduleTemplates={scheduleTemplates}
              schedulePrefixes={schedulePrefixes}
              userRole={requesterRole}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
