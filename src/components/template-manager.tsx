"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createChecklistTemplate,
  deleteChecklistTemplate,
  upsertScheduleCategoryConfig,
  deleteScheduleCategoryConfig,
  getAvailableSchedulerCategories,
  mergeGlobalCategoriesAction,
  setScheduleTemplateDefaultEntry
} from "@/actions/settings-actions";
import {
  listScheduleTemplateItemsAction,
  deleteScheduleTemplateItemAction,
} from "@/extensions/schedule/actions/schedule-template-item-actions";
import { toast } from "sonner";
import { useEffect } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Input, Label, Button, ScrollArea, CreatableSearch, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui_engine";
import { Loader2, Plus, Trash2, Save, CheckCircle2, Pencil, GitMerge, LayoutTemplate } from "lucide-react";
import { Role, ProductType, ScheduleTemplateItem } from "@/generated/prisma";
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";

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
  is_default_entry: boolean;
}

interface SchedulePrefixConfig {
  id: string;
  schedule_category: string;
  prefix: string;
  section: ProductType;
}

function isGlobalChecklistTemplate(phaseEnum: string | null) {
  return phaseEnum == null || phaseEnum === "GLOBAL";
}

interface TemplateManagerProps {
  checklistTemplates: ChecklistTemplate[];
  scheduleTemplates: ScheduleTemplateConfig[];
  schedulePrefixes: SchedulePrefixConfig[];
  userRole: Role;
  mode?: "project-engine" | "product-catalog";
}

const PHASES = ["MOODBOARD", "LAYOUT", "DESIGN_3D", "CD", "SUPERVISION"];

export function TemplateManager({
  checklistTemplates,
  scheduleTemplates,
  schedulePrefixes,
  userRole,
  mode = "project-engine",
}: TemplateManagerProps) {
  void userRole;
  const [loading, setLoading] = useState<string | null>(null);
  const [templateItems, setTemplateItems] = useState<ScheduleTemplateItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [newChecklistLabels, setNewChecklistLabels] = useState<Record<string, string>>({});
  const [newSchedulerCategory, setNewSchedulerCategory] = useState<Record<ProductType, string>>({
    [ProductType.material]: "",
    [ProductType.fixture]: "",
  });
  const [newSchedulerPrefix, setNewSchedulerPrefix] = useState<Record<ProductType, string>>({
    [ProductType.material]: "",
    [ProductType.fixture]: "",
  });
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [activeSection, setActiveSection] = useState<ProductType>(ProductType.material);
  const [editingCategory, setEditingCategory] = useState<string>("");
  const [editingPrefix, setEditingPrefix] = useState<string>("");
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [targetMergeCategory, setTargetMergeCategory] = useState<string>("");
  const router = useRouter();
  const schedulerSections = [ProductType.material, ProductType.fixture] as const;

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await getAvailableSchedulerCategories({});
        setAvailableCategories(unwrapActionResult(res));
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCats();
  }, []);

  useEffect(() => {
    if (mode !== "project-engine") return;
    setLoadingItems(true);
    listScheduleTemplateItemsAction().then((res) => {
      if ("items" in res && res.items) setTemplateItems(res.items);
    }).finally(() => setLoadingItems(false));
  }, [mode]);

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

  const handleSaveSchedulerConfig = async (section: ProductType, cat?: string, pref?: string) => {
    const category = (cat || newSchedulerCategory[section])?.trim();
    if (!category) return;

    setLoading(`scheduler-save-${section}`);
    try {
      unwrapActionResult(
        await upsertScheduleCategoryConfig({
          section,
          schedule_category: category,
          prefix: (pref || newSchedulerPrefix[section])?.trim() || undefined,
        })
      );
      setNewSchedulerCategory((prev) => ({ ...prev, [section]: "" }));
      setNewSchedulerPrefix((prev) => ({ ...prev, [section]: "" }));
      setIsModalOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const handleOpenModal = (section: ProductType, mode: "add" | "edit", config?: { category: string; prefix?: string }) => {
    setActiveSection(section);
    setModalMode(mode);
    setEditingCategory(config?.category || "");
    setEditingPrefix(config?.prefix || "");
    setIsModalOpen(true);
  };

  const handleMergeCategories = async () => {
    if (!editingCategory || !targetMergeCategory) return;
    
    setLoading(`scheduler-merge-${activeSection}`);
    try {
      const result = unwrapActionResult(await mergeGlobalCategoriesAction({
        section: activeSection,
        sourceCategory: editingCategory,
        targetCategory: targetMergeCategory
      }));
      
      toast.success(`Successfully merged "${editingCategory}" into "${targetMergeCategory}"`, {
        description: `Moved ${result.entries_moved} project entries and ${result.library_moved} library items.`
      });
      
      setIsMergeModalOpen(false);
      setTargetMergeCategory("");
      router.refresh();
    } catch (err: unknown) {
      toast.error("Failed to merge categories", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteSchedulerConfig = async (section: ProductType, category: string) => {
    setLoading(`scheduler-delete-${section}-${category}`);
    try {
      unwrapActionResult(await deleteScheduleCategoryConfig({ section, schedule_category: category }));
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const getSchedulerConfigs = (section: ProductType) => {
    const templates = scheduleTemplates.filter((item) => item.section === section);
    const prefixes = schedulePrefixes.filter((item) => item.section === section);
    const categoryMap = new Map<string, { category: string; prefix?: string; active: boolean; isDefaultEntry: boolean }>();

    for (const template of templates) {
      categoryMap.set(template.schedule_category, {
        category: template.schedule_category,
        prefix: categoryMap.get(template.schedule_category)?.prefix,
        active: template.is_active,
        isDefaultEntry: template.is_default_entry,
      });
    }

    for (const prefix of prefixes) {
      const current = categoryMap.get(prefix.schedule_category);
      categoryMap.set(prefix.schedule_category, {
        category: prefix.schedule_category,
        prefix: prefix.prefix,
        active: current?.active ?? false,
        isDefaultEntry: current?.isDefaultEntry ?? false,
      });
    }

    return Array.from(categoryMap.values()).sort((a, b) => a.category.localeCompare(b.category));
  };

  const handleToggleDefaultEntry = async (section: ProductType, category: string, nextValue: boolean) => {
    const key = `scheduler-default-${section}-${category}`;
    setLoading(key);
    try {
      unwrapActionResult(
        await setScheduleTemplateDefaultEntry({
          section,
          schedule_category: category,
          is_default_entry: nextValue,
        })
      );
      toast.success(
        nextValue
          ? `"${category}" will now be added automatically to every project.`
          : `"${category}" removed from the default project template.`
      );
      router.refresh();
    } catch (err: unknown) {
      toast.error("Failed to update default template", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-2xl font-bold text-slate-950">
          Project Defaults
        </h2>
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
          Global Studio Standards
        </p>
      </div>

      {mode === "project-engine" && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <h3 className="font-serif text-lg font-bold text-slate-900">Checklist Standards</h3>
            <p className="mt-1 text-sm text-slate-500">
              Defaults below define the checklist and starter items applied to new projects.
            </p>
          </div>
    
          <Accordion type="single" collapsible className="space-y-3">
            <AccordionItem value="universal-checklist" className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-2">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-wrap items-center justify-between gap-3 w-full pr-4">
                  <div className="text-left">
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
              </AccordionTrigger>
    
              <AccordionContent className="pt-4">
                <div className="space-y-2">
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
    
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

          {mode === "project-engine" && (
            <div className="mt-4">
              <h4 className="mb-2 text-sm font-medium">Default Items</h4>
              {loadingItems ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : templateItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No default items yet. Use &quot;Set as default item&quot; in Catalog Board to add one.
                </p>
              ) : (
                <div className="space-y-1">
                  {templateItems.map((item) => {
                    const snapshot = item.data_snapshot as Record<string, unknown>;
                    const productName = (snapshot?.catalog_product_name as string | undefined) ?? "—";
                    const brand = (snapshot?.catalog_brand as string | undefined) ?? "—";
                    return (
                      <div key={item.id} className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{item.schedule_category}</span>
                          <span className="mx-1 text-muted-foreground">·</span>
                          <span>{productName}</span>
                          {brand && brand !== "—" && (
                            <span className="ml-1 text-muted-foreground text-xs">ex. {brand}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            setLoading(`tpl-del-${item.id}`);
                            const res = await deleteScheduleTemplateItemAction(item.id);
                            if ("error" in res) toast.error(res.error);
                            else {
                              setTemplateItems((prev) => prev.filter((i) => i.id !== item.id));
                              toast.success("Default item deleted.");
                            }
                            setLoading(null);
                          }}
                          disabled={loading === `tpl-del-${item.id}`}
                          className="ml-2 text-xs text-red-500 hover:underline disabled:opacity-50"
                          aria-label={`Delete default item ${productName}`}
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {mode === "product-catalog" && (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Scheduler Config
                </p>
                <h3 className="font-serif text-2xl font-bold text-slate-950">Categories & Prefixes</h3>
                <p className="max-w-2xl text-sm text-slate-500">
                  Define how codes normalize (Prefix + Increment). Use `Add New` to create a category or `Edit` to change its prefix.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              {schedulerSections.map((section) => {
                const configs = getSchedulerConfigs(section);
                const sectionLabel = section === ProductType.material ? "Material" : "Fixture";

                return (
                  <div key={section} className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50/30">
                    <div className="flex items-center justify-between border-b border-slate-100 p-4">
                      <div>
                        <h4 className="font-serif text-lg font-bold text-slate-950">{sectionLabel} Categories</h4>
                        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                          {configs.length} configured
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full border-slate-200 bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                        onClick={() => handleOpenModal(section, "add")}
                      >
                        <Plus className="mr-1.5 h-3 w-3" />
                        Add New
                      </Button>
                    </div>

                    <ScrollArea className="h-[480px] w-full p-4">
                      <div className="space-y-2">
                        {configs.length === 0 ? (
                          <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
                            <p className="text-xs font-semibold text-slate-400">No {sectionLabel.toLowerCase()} categories.</p>
                            <p className="mt-1 text-[10px] text-slate-300">Click &quot;Add New&quot; to start.</p>
                          </div>
                        ) : (
                          configs.map((config) => {
                            const deleteKey = `scheduler-delete-${section}-${config.category}`;
                            const defaultKey = `scheduler-default-${section}-${config.category}`;
                            return (
                              <div
                                key={`${section}-${config.category}`}
                                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-all hover:border-slate-300 hover:shadow-sm"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate text-sm font-bold text-slate-900">{config.category}</span>
                                    {config.isDefaultEntry && (
                                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-indigo-600">
                                        <LayoutTemplate className="h-2.5 w-2.5" />
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                    <span className="font-medium">Prefix:</span>
                                    <span className="rounded bg-slate-100 px-1 font-mono text-slate-900">{config.prefix || "--"}</span>
                                    <span className="text-slate-200">|</span>
                                    <span>{config.active ? "Template Active" : "Prefix Only"}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  {config.active && (
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      className={cn(
                                        "h-8 w-8",
                                        config.isDefaultEntry
                                          ? "text-indigo-600 hover:bg-indigo-50"
                                          : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                                      )}
                                      title={
                                        config.isDefaultEntry
                                          ? "Remove from default project template"
                                          : "Add to default project template (auto-added to every project)"
                                      }
                                      onClick={() => handleToggleDefaultEntry(section, config.category, !config.isDefaultEntry)}
                                      disabled={loading === defaultKey}
                                    >
                                      {loading === defaultKey ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <LayoutTemplate className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-8 w-8 text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                                    onClick={() => handleOpenModal(section, "edit", config)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-8 w-8 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                                    onClick={() => {
                                      setActiveSection(section);
                                      setEditingCategory(config.category);
                                      setIsMergeModalOpen(true);
                                    }}
                                  >
                                    <GitMerge className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                    onClick={() => handleDeleteSchedulerConfig(section, config.category)}
                                    disabled={loading === deleteKey}
                                  >
                                    {loading === deleteKey ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                );
              })}
            </div>
          </section>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">
                  {modalMode === "add" ? `Add ${activeSection === ProductType.material ? "Material" : "Fixture"} Category` : "Edit Prefix"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category Name</Label>
                  {modalMode === "add" ? (
                    <CreatableSearch
                      options={availableCategories.map((cat) => ({ id: cat, name: cat }))}
                      value={editingCategory}
                      onSelect={setEditingCategory}
                      onCreate={setEditingCategory}
                      placeholder="Type or select category..."
                      className="h-11"
                    />
                  ) : (
                    <Input value={editingCategory} disabled className="h-11 bg-slate-50 font-semibold" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prefix Code</Label>
                  <Input
                    placeholder="e.g. AC"
                    value={editingPrefix}
                    onChange={(e) => setEditingPrefix(e.target.value.toUpperCase())}
                    className="h-11 font-mono text-lg uppercase tracking-widest"
                    maxLength={4}
                  />
                  <p className="text-[10px] text-slate-400 italic">This prefix will be used for auto-generating codes (e.g. AC-001).</p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSaveSchedulerConfig(activeSection, editingCategory, editingPrefix)}
                  className="rounded-full bg-slate-900 px-8"
                  disabled={!editingCategory.trim() || !editingPrefix.trim() || loading?.startsWith("scheduler-save")}
                >
                  {loading?.startsWith("scheduler-save") ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isMergeModalOpen} onOpenChange={setIsMergeModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl flex items-center gap-2">
                  <GitMerge className="h-5 w-5 text-indigo-500" />
                  Merge Categories
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="rounded-xl bg-amber-50 p-3 border border-amber-100">
                  <p className="text-[11px] font-medium text-amber-800 leading-relaxed">
                    <strong>CAUTION:</strong> This will move ALL products and project entries currently in 
                    <span className="mx-1 font-bold underline">&quot;{editingCategory}&quot;</span> 
                    to the selected target category. The source category configuration will be deleted.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Category</Label>
                  <CreatableSearch
                    options={getSchedulerConfigs(activeSection)
                      .filter(c => c.category !== editingCategory)
                      .map((c) => ({ id: c.category, name: c.category }))
                    }
                    value={targetMergeCategory}
                    onSelect={setTargetMergeCategory}
                    onCreate={setTargetMergeCategory}
                    placeholder="Select target category..."
                    className="h-11"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setIsMergeModalOpen(false)}
                  className="rounded-full px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleMergeCategories}
                  className="rounded-full bg-indigo-600 hover:bg-indigo-700 px-8 text-white"
                  disabled={!targetMergeCategory || loading?.startsWith("scheduler-merge")}
                >
                  {loading?.startsWith("scheduler-merge") ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <GitMerge className="mr-2 h-4 w-4" />
                  )}
                  Execute Merge
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
