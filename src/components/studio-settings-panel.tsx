"use client";

import { useState } from "react";
import { Blocks, Settings2, Users2 } from "lucide-react";
import type { Role } from "@/generated/prisma";
import { TemplateManager } from "@/components/template-manager";
import { UserManagement } from "@/components/user-management";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TimelineTemplate {
  phase_enum: string;
  duration_days: number;
}

interface ChecklistTemplate {
  id: string;
  phase_enum: string | null;
  label: string;
}

type PanelKey = "general" | "team" | "project-engine";

const sections = [
  {
    key: "general" as const,
    label: "General",
    description: "Branding and naming rules",
    icon: Settings2,
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
];

export function StudioSettingsPanel({
  allUsers,
  currentUserId,
  requesterRole,
  timelineTemplates,
  checklistTemplates,
  isAutoNamingEnabled,
  saveBranding,
}: {
  allUsers: Array<{ id: string; name: string; email: string; role: Role }>;
  currentUserId: string;
  requesterRole: Role;
  timelineTemplates: TimelineTemplate[];
  checklistTemplates: ChecklistTemplate[];
  isAutoNamingEnabled: boolean;
  saveBranding: (formData: FormData) => Promise<void>;
}) {
  const [activePanel, setActivePanel] = useState<PanelKey>("general");

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
      <aside className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
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
                  "h-auto min-w-fit justify-start rounded-2xl px-4 py-3 text-left",
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
                Control the default naming pattern applied across StudioFlow.
              </p>
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
                    "relative h-6 w-11 rounded-full transition-colors",
                    isAutoNamingEnabled ? "bg-slate-900" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                      isAutoNamingEnabled ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </span>
              </button>
            </form>
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
              timelineTemplates={timelineTemplates}
              checklistTemplates={checklistTemplates}
              userRole={requesterRole}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
