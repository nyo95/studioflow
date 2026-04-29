"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateProjectMetadata } from "@/actions/project-actions";
import { unwrapActionResult } from "@/lib/result";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Role, PhaseName } from "@/generated/prisma";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit3, User, MapPin, Calendar, Building2, Lock, CheckCircle2, X, Save } from "lucide-react";
import { Heading, SectionCard } from "@/ui_engine";
import { formatPhaseName, type ProgressState } from "@/lib/project-progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowRightCircle, Circle } from "lucide-react";

import { PhaseHeartbeatActivity } from "@/types/common";

interface UserOption {
  id: string;
  name: string;
  role: Role;
}

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectOverviewFormProps {
  project: {
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
    } | null;
    area: number | null;
    opening_date: Date | null;
    opening_date_display: string;
    opening_date_input_value: string;
    pic_designer_id: string;
    pic_drafter_id: string;
    designer_name: string;
    drafter_name: string;
  };
  designers: UserOption[];
  drafters: UserOption[];
  clients: ClientOption[];
  role: Role;
  canEdit: boolean;
  currentProgress?: ProgressState;
  phases?: {
    id: string;
    name_enum: PhaseName;
    order_index: number;
    status_enum: string;
  }[];
  deferredActivities?: PhaseHeartbeatActivity[];
}

export function ProjectOverviewForm({
  project,
  designers,
  drafters,
  clients,
  role,
  canEdit,
  currentProgress,
  phases,
  deferredActivities = [],
}: ProjectOverviewFormProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isAdmin = role === "ADMIN";
  const canEditScopedFields = isAdmin || canEdit;
  const canEditProjectName = isAdmin;
  const canEditClient = isAdmin;
  const canEditArea = canEditScopedFields;
  const canEditOpening = canEditScopedFields;
  const canEditDic = isAdmin;
  const canEditDric = isAdmin;
  const [clientSearch, setClientSearch] = React.useState(project.client?.name ?? "");
  const [selectedClientId, setSelectedClientId] = React.useState<string>(
    project.client?.id ?? "none"
  );
  const [isClientDropdownOpen, setIsClientDropdownOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setClientSearch(project.client?.name ?? "");
      setSelectedClientId(project.client?.id ?? "none");
      setIsEditMode(false); // Reset to view mode when dialog closes
    }
  }, [open, project.client?.id, project.client?.name]);

  const filteredClients = React.useMemo(() => {
    const normalizedSearch = clientSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return clients;
    }

    return clients.filter((client) =>
      client.name.toLowerCase().includes(normalizedSearch)
    );
  }, [clientSearch, clients]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin && !canEdit) return;

    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const projectName = (formData.get("name") as string | null)?.trim() ?? "";
    const areaValue = (formData.get("area") as string).trim();
    const openingDateValue = formData.get("opening_date") as string;
    const picDesignerId = (formData.get("pic_designer_id") as string | null) ?? undefined;
    const picDrafterId = (formData.get("pic_drafter_id") as string | null) ?? undefined;
    const clientIdValue = (formData.get("client_id") as string | null) ?? "none";

    const parsedArea = areaValue === "" ? undefined : Number(areaValue);
    const clientNameInput = clientSearch;

    if (isAdmin && !projectName) {
      setError("Project name is required.");
      setLoading(false);
      return;
    }

    try {
      unwrapActionResult(await updateProjectMetadata({
        projectId: project.id,
        name: projectName || undefined,
        clientId: selectedClientId === "none" ? null : selectedClientId || undefined,
        client_name: selectedClientId === "" ? clientSearch : undefined,
        area: parsedArea,
        opening_date: openingDateValue ? new Date(openingDateValue) : undefined,
        pic_designer_id: picDesignerId,
        pic_drafter_id: picDrafterId,
      }));
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update project metadata.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard
      header={
        <div className="flex w-full items-start justify-between gap-6">
          <div>
            <Heading variant="uiMeta" level={6}>Project Metadata</Heading>
            <Heading level={2} className="mt-2 text-slate-900">Overview</Heading>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-lg border-slate-200 text-xs font-semibold shadow-none hover:bg-slate-50">
                <Edit3 className="mr-2 h-3.5 w-3.5" />
                Modify Information
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <DialogTitle asChild>
                      <Heading level={3}>Project Metadata</Heading>
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {isEditMode ? "Update project details and assigned PICs." : "Viewing current project identification and assignment."}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditMode && canEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditMode(true)}
                        className="h-8 rounded-lg border-slate-200 text-[10px] font-black uppercase tracking-widest hover:border-slate-900"
                      >
                        <Edit3 className="mr-2 h-3 w-3" />
                        Modify
                      </Button>
                    )}
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setOpen(false)}
                      className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-900"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </DialogHeader>

                <TooltipProvider delayDuration={0}>
                  <div className="grid gap-6 py-6">
                    {error ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                      </div>
                    ) : null}

                    <MetadataField
                      id="name"
                      label="Project Name"
                      disabled={!canEditProjectName || !isEditMode}
                    >
                      {isEditMode ? (
                        <Input
                          id="name"
                          name="name"
                          defaultValue={project.name}
                          disabled={!canEditProjectName}
                          className="border-slate-200"
                        />
                      ) : (
                        <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-900 border border-slate-100">
                          {project.name}
                        </div>
                      )}
                    </MetadataField>

                    <MetadataField
                      id="client_id"
                      label="Client Name"
                      disabled={!canEditClient || !isEditMode}
                    >
                      {isEditMode ? (
                        <CreatableSearch
                          options={[
                            { id: "none", name: "No Client" },
                            ...clients.map(c => ({ id: c.id, name: c.name }))
                          ]}
                          value={selectedClientId}
                          onSelect={(id: string, name: string) => {
                            setSelectedClientId(id);
                            setClientSearch(name);
                          }}
                          onCreate={(name: string) => {
                            setSelectedClientId(""); // Marker for "New Client"
                            setClientSearch(name);
                          }}
                          placeholder="Search or type a new client..."
                          disabled={!canEditClient}
                        />
                      ) : (
                        <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-900 border border-slate-100">
                          {project.client?.name ?? "No Client"}
                        </div>
                      )}
                    </MetadataField>

                    <div className="grid grid-cols-2 gap-6">
                      <MetadataField id="area" label="Area (sqm)" disabled={!canEditArea || !isEditMode}>
                        {isEditMode ? (
                          <div className="relative">
                            <Input
                              id="area"
                              name="area"
                              type="number"
                              defaultValue={project.area || ""}
                              disabled={!canEditArea}
                              className="border-slate-200 pr-12"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                              sqm
                            </span>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-900 border border-slate-100">
                            {project.area ? `${project.area} sqm` : "-"}
                          </div>
                        )}
                      </MetadataField>

                      <MetadataField id="opening_date" label="Target Opening" disabled={!canEditOpening || !isEditMode}>
                        {isEditMode ? (
                          <div className="relative">
                            <Input
                              id="opening_date"
                              name="opening_date"
                              type="date"
                              defaultValue={project.opening_date_input_value}
                              disabled={!canEditOpening}
                              className="border-slate-200"
                            />
                          </div>
                        ) : (
                          <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-900 border border-slate-100">
                            {project.opening_date_display || "-"}
                          </div>
                        )}
                      </MetadataField>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <MetadataField id="pic_designer_id" label="DIC (Designer)" disabled={!canEditDic || !isEditMode}>
                        {isEditMode ? (
                          <select
                            id="pic_designer_id"
                            name="pic_designer_id"
                            defaultValue={project.pic_designer_id}
                            disabled={!canEditDic}
                            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
                          >
                            {designers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-900 border border-slate-100">
                            {project.designer_name}
                          </div>
                        )}
                      </MetadataField>

                      <MetadataField id="pic_drafter_id" label="DRIC (Drafter)" disabled={!canEditDric || !isEditMode}>
                        {isEditMode ? (
                          <select
                            id="pic_drafter_id"
                            name="pic_drafter_id"
                            defaultValue={project.pic_drafter_id}
                            disabled={!canEditDric}
                            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
                          >
                            {drafters.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-900 border border-slate-100">
                            {project.drafter_name}
                          </div>
                        )}
                      </MetadataField>
                    </div>
                  </div>
                </TooltipProvider>

                <DialogFooter className="gap-2 sm:gap-0 pt-6 border-t border-slate-100">
                  {isEditMode ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsEditMode(false)}
                        className="rounded-lg px-6 text-xs font-bold uppercase tracking-widest text-slate-400"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="rounded-lg bg-slate-900 px-8 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-slate-800"
                      >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {loading ? "Saving..." : "Save Changes"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-6 text-xs font-bold uppercase tracking-widest text-slate-400"
                    >
                      Close Details
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >

      {/* Progress Section - Placed prominently at the top */}
      {currentProgress && (
        <div className="mb-10 pb-8 border-b border-slate-100">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Project Status & Progress</p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  {currentProgress.type === 'PROJECT_DONE' ? (
                    <Heading level={1} className="text-emerald-600 font-bold uppercase tracking-tight text-3xl">PROJECT COMPLETED ✓</Heading>
                  ) : currentProgress.type === 'READY_FOR' ? (
                    <div className="flex items-center gap-3">
                      <Heading level={2} className="text-amber-600 uppercase tracking-tight">READY FOR {formatPhaseName(currentProgress.nextPhaseName)}</Heading>
                      <Badge variant="outline" className="bg-amber-50 border-amber-100 text-amber-700">Action Required</Badge>
                    </div>
                  ) : (
                    currentProgress.phases.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-4">
                        <div className="flex items-baseline gap-2">
                          <Heading level={2} className="uppercase tracking-tight font-bold text-slate-900">
                            {formatPhaseName(p.name)}
                          </Heading>
                          <span className="text-base font-medium text-slate-400">
                            v{p.major}.{p.minor}
                          </span>
                        </div>
                        
                        {p.status_enum === 'ON_REVIEW_INTERNAL' && (
                          <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-100 text-indigo-700 px-3 py-1 font-bold tracking-wider uppercase rounded-md shadow-sm">
                            Internal Review
                          </Badge>
                        )}
                        {p.status_enum === 'ON_REVIEW_CLIENT' && (
                          <Badge variant="outline" className="text-[10px] bg-orange-50 border-orange-100 text-orange-700 px-3 py-1 font-bold tracking-wider uppercase rounded-md shadow-sm">
                            Client Review
                          </Badge>
                        )}
                        {p.status_enum === 'APPROVED_INTERNAL' && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-100 text-emerald-700 px-3 py-1 font-bold tracking-wider uppercase rounded-md">
                            Approved
                          </Badge>
                        )}
                        {idx < currentProgress.phases.length - 1 && <span className="text-slate-200 text-3xl font-thin mx-1">/</span>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Progress Bar Visual */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phase Journey</span>
                {phases && currentProgress.type === 'IN_PROGRESS' && (
                  <span className="text-xs font-bold text-slate-900">
                    {Math.round(((phases.findIndex(p => p.name_enum === currentProgress.phases[currentProgress.phases.length - 1].name) + 1) / phases.length) * 100)}% Complete
                  </span>
                )}
              </div>
              {phases && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-50 border border-slate-100">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000 shadow-sm",
                      currentProgress.type === 'PROJECT_DONE' ? "bg-emerald-500" : "bg-slate-900"
                    )}
                    style={{ 
                      width: currentProgress.type === 'PROJECT_DONE' 
                        ? '100%' 
                        : currentProgress.type === 'IN_PROGRESS' && currentProgress.phases.length > 0
                          ? `${((phases.findIndex(p => p.name_enum === currentProgress.phases[currentProgress.phases.length - 1].name) + 1) / phases.length) * 100}%`
                          : '5%' 
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Project Metadata Grid - Lower Priority */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-10 md:grid-cols-4 pt-2">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-100 shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <Heading variant="uiMeta" level={6} className="text-slate-400">Client Name</Heading>
            <p className="text-sm font-bold text-slate-900">
              {project.client?.name ?? "No Client Assigned"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-100 shadow-sm">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <Heading variant="uiMeta" level={6} className="text-slate-400">Area (sqm)</Heading>
            <p className="text-sm font-bold text-slate-900">{project.area ? `${project.area} sqm` : "-"}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-100 shadow-sm">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <Heading variant="uiMeta" level={6} className="text-slate-400">Target Opening</Heading>
            <p className="text-sm font-bold text-slate-900">{project.opening_date_display}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-100 shadow-sm">
            <User className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <Heading variant="uiMeta" level={6} className="text-slate-400">Assigned Team</Heading>
            <div>
              <p className="text-sm font-bold text-slate-900">{project.designer_name} (DIC)</p>
              <p className="text-[11px] text-slate-500 font-medium">{project.drafter_name} (DRIC)</p>
            </div>
          </div>
        </div>
      </div>


      {/* Deferred Tasks Section */}
      {deferredActivities.length > 0 && (
        <div className="mt-12 pt-8 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shadow-sm">
              <ArrowRightCircle className="h-5 w-5" />
            </div>
            <div>
              <Heading level={6} className="text-slate-900 font-bold uppercase tracking-wider text-[11px]">Deferred Project Tasks</Heading>
              <p className="text-xs text-slate-400 font-medium">Items moved from phases to maintain momentum</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {deferredActivities.map((activity) => {
              const originPhase = phases?.find(p => p.id === activity.phase_id);
              return (
                <div 
                  key={activity.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    {activity.status === "DONE" || activity.status === "COMPLETED" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 group-hover:text-amber-400 shrink-0 transition-colors" />
                    )}
                    <span className={cn(
                      "text-sm font-sans text-slate-700",
                      (activity.status === "DONE" || activity.status === "COMPLETED") && "line-through opacity-50"
                    )}>
                      {activity.content}
                    </span>
                  </div>
                  
                  {originPhase && (
                    <Badge variant="outline" className="text-[9px] bg-white border-slate-200 text-slate-400 font-bold px-2 py-0.5 whitespace-nowrap">
                      Phase {formatPhaseName(originPhase.name_enum)}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function MetadataField({
  id,
  label,
  disabled,
  children,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const content = (
    <div className="grid gap-2.5">
      <Label htmlFor={id} className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
        <span>{label}</span>
        {disabled ? <Lock className="h-3.5 w-3.5 text-slate-300" /> : null}
      </Label>
      {children}
    </div>
  );

  if (!disabled) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-not-allowed opacity-80">{content}</div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-slate-900 text-white border-none shadow-xl">
        <p className="text-xs font-semibold">Restricted Access</p>
      </TooltipContent>
    </Tooltip>
  );
}
