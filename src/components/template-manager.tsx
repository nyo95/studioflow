"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  upsertTimelineTemplate,
  createChecklistTemplate,
  deleteChecklistTemplate,
} from "@/actions/settings-actions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Save, CheckCircle2 } from "lucide-react";
import { Role } from "@/generated/prisma";
import { unwrapActionResult } from "@/lib/result";

interface TimelineTemplate {
  phase_enum: string;
  duration_days: number;
}

interface ChecklistTemplate {
  id: string;
  phase_enum: string | null;
  label: string;
}

function isGlobalChecklistTemplate(phaseEnum: string | null) {
  return phaseEnum == null || phaseEnum === "GLOBAL";
}

interface TemplateManagerProps {
  timelineTemplates: TimelineTemplate[];
  checklistTemplates: ChecklistTemplate[];
  userRole: Role;
}

const PHASES = ["MOODBOARD", "LAYOUT", "DESIGN_3D", "CD", "SUPERVISION"];

export function TemplateManager({
  timelineTemplates,
  checklistTemplates,
  userRole,
}: TemplateManagerProps) {
  void userRole;
  const [loading, setLoading] = useState<string | null>(null);
  const [newChecklistLabels, setNewChecklistLabels] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, number>>(
    Object.fromEntries(timelineTemplates.map((t) => [t.phase_enum, t.duration_days]))
  );
  const router = useRouter();

  const handleSaveDuration = async (phase: string) => {
    setLoading(`duration-${phase}`);
    try {
      unwrapActionResult(
        await upsertTimelineTemplate({ phaseEnum: phase, durationDays: durations[phase] || 7 })
      );
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const handleAddChecklist = async (phase: string | null) => {
    const key = phase ?? "GLOBAL";
    const label = newChecklistLabels[key];
    if (!label) return;

    setLoading(`checklist-add-${key}`);
    try {
      unwrapActionResult(await createChecklistTemplate({ phaseEnum: phase, label }));
      setNewChecklistLabels((prev) => ({ ...prev, [key]: "" }));
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteChecklist = async (id: string) => {
    setLoading(id);
    try {
      unwrapActionResult(await deleteChecklistTemplate({ id }));
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-2xl font-bold text-slate-950">
          Project Engine Templates
        </h2>
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
          Global Studio Standards
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <h3 className="font-serif text-lg font-bold text-slate-900">Automation Logic</h3>
        <p className="mt-1 text-sm text-slate-500">
          Templates below define the default timeline and checklist items for every
          new project initialized in StudioFlow.
        </p>
      </div>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-slate-400" />
              <h3 className="font-serif text-lg font-bold text-slate-950">
                Project-Wide Standard
              </h3>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Global items applied across every project.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            {checklistTemplates.filter((t) => isGlobalChecklistTemplate(t.phase_enum)).length} items
          </span>
        </div>

        <div className="mt-5 space-y-2">
          {checklistTemplates
            .filter((t) => isGlobalChecklistTemplate(t.phase_enum))
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
              >
                <span className="text-sm text-slate-700">{item.label}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-slate-300 hover:text-red-500"
                  onClick={() => handleDeleteChecklist(item.id)}
                  disabled={loading === item.id}
                >
                  {loading === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
            <Input
              placeholder="Add universal checklist item..."
              value={newChecklistLabels.GLOBAL || ""}
              onChange={(e) =>
                setNewChecklistLabels((prev) => ({ ...prev, GLOBAL: e.target.value }))
              }
              className="h-10 border-slate-200 bg-white text-sm"
            />
            <Button
              size="sm"
              className="h-10 bg-slate-900 px-4 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-slate-800"
              onClick={() => handleAddChecklist(null)}
              disabled={loading === "checklist-add-GLOBAL" || !newChecklistLabels.GLOBAL}
            >
              {loading === "checklist-add-GLOBAL" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-2 h-3.5 w-3.5" />
              )}
              Add Universal
            </Button>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Phase Templates
          </p>
          <h3 className="font-serif text-xl font-bold text-slate-950">Per-Phase Defaults</h3>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {PHASES.map((phase) => (
            <AccordionItem key={phase} value={phase}>
              <AccordionTrigger>
                <div className="min-w-0">
                  <div className="font-serif text-lg font-bold tracking-tight text-slate-950">
                    {phase.replace(/_/g, " ")}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {
                      checklistTemplates.filter((t) => t.phase_enum === phase).length
                    }{" "}
                    checklist items
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Duration
                      </Label>
                      <p className="text-sm text-slate-500">
                        Default duration assigned when this phase is created.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={durations[phase] ?? 7}
                        onChange={(e) =>
                          setDurations((prev) => ({
                            ...prev,
                            [phase]: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="h-10 w-20 border-slate-200 bg-white text-center text-sm font-semibold"
                      />
                      <span className="text-sm text-slate-500">days</span>
                      <Button
                        size="sm"
                        className="h-10 bg-slate-900 px-4 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-slate-800"
                        onClick={() => handleSaveDuration(phase)}
                        disabled={loading === `duration-${phase}`}
                      >
                        {loading === `duration-${phase}` ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-3.5 w-3.5" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {checklistTemplates
                      .filter((t) => t.phase_enum === phase)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
                        >
                          <span className="text-sm text-slate-700">{item.label}</span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-slate-300 hover:text-red-500"
                            onClick={() => handleDeleteChecklist(item.id)}
                            disabled={loading === item.id}
                          >
                            {loading === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      ))}

                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                      <Input
                        placeholder="Add new checklist item..."
                        value={newChecklistLabels[phase] || ""}
                        onChange={(e) =>
                          setNewChecklistLabels((prev) => ({
                            ...prev,
                            [phase]: e.target.value,
                          }))
                        }
                        className="h-10 border-slate-200 bg-white text-sm"
                      />
                      <Button
                        size="sm"
                        className="h-10 bg-slate-900 px-4 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-slate-800"
                        onClick={() => handleAddChecklist(phase)}
                        disabled={loading === `checklist-add-${phase}` || !newChecklistLabels[phase]}
                      >
                        {loading === `checklist-add-${phase}` ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-3.5 w-3.5" />
                        )}
                        Add Item
                      </Button>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
