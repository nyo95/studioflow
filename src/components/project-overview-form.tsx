"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateProjectMetadata } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Role } from "@/generated/prisma";
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
import { Edit2, User, MapPin, Calendar, Building2, Lock } from "lucide-react";

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
}

export function ProjectOverviewForm({
  project,
  designers,
  drafters,
  clients,
  role,
  canEdit,
}: ProjectOverviewFormProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
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
  const canSubmit = canEditScopedFields;
  const [clientSearch, setClientSearch] = React.useState(project.client?.name ?? "");
  const [selectedClientId, setSelectedClientId] = React.useState<string>(
    project.client?.id ?? "none"
  );
  const [isClientDropdownOpen, setIsClientDropdownOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setClientSearch(project.client?.name ?? "");
      setSelectedClientId(project.client?.id ?? "none");
      setIsClientDropdownOpen(false);
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
    if (!canSubmit) return;

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
    if (parsedArea !== undefined && Number.isNaN(parsedArea)) {
      setError("Area must be a valid number.");
      setLoading(false);
      return;
    }

    if (isAdmin && !projectName) {
      setError("Project name is required.");
      setLoading(false);
      return;
    }

    try {
      await updateProjectMetadata({
        projectId: project.id,
        name: projectName || undefined,
        clientId: clientIdValue === "none" ? null : clientIdValue,
        area: parsedArea,
        opening_date: openingDateValue ? new Date(openingDateValue) : undefined,
        pic_designer_id: picDesignerId,
        pic_drafter_id: picDrafterId,
      });
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update project metadata.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Project Metadata</p>
          <h2 className="mt-2 font-serif text-2xl font-bold text-slate-950">Overview</h2>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 rounded-lg border-slate-200 text-xs font-semibold">
              <Edit2 className="mr-2 h-3.5 w-3.5" />
              Edit Information
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl font-bold">Edit Project Metadata</DialogTitle>
                <DialogDescription>
                  Update project details and assigned PICs.
                </DialogDescription>
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
                    disabled={!canEditProjectName}
                  >
                    <Input
                      id="name"
                      name="name"
                      defaultValue={project.name}
                      disabled={!canEditProjectName}
                      className="border-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </MetadataField>

                  <MetadataField
                    id="client_id"
                    label="Client Name"
                    disabled={!canEditClient}
                  >
                    <div className="relative">
                      <input
                        type="hidden"
                        name="client_id"
                        value={selectedClientId}
                      />
                      <Input
                        id="client_id"
                        value={clientSearch}
                        disabled={!canEditClient}
                        onFocus={() => {
                          if (canEditClient) {
                            setIsClientDropdownOpen(true);
                          }
                        }}
                        onChange={(event) => {
                          setClientSearch(event.target.value);
                          setIsClientDropdownOpen(true);
                          setSelectedClientId("none");
                        }}
                        placeholder="Search existing clients..."
                        className="border-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                      />
                      {canEditClient && isClientDropdownOpen ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                          <button
                            type="button"
                            className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                              selectedClientId === "none"
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                            }`}
                            onClick={() => {
                              setSelectedClientId("none");
                              setClientSearch("");
                              setIsClientDropdownOpen(false);
                            }}
                          >
                            No client
                          </button>

                          {filteredClients.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-slate-500">
                              No matching clients.
                            </div>
                          ) : (
                            filteredClients.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                  selectedClientId === client.id
                                    ? "bg-slate-900 text-white"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                                }`}
                                onClick={() => {
                                  setSelectedClientId(client.id);
                                  setClientSearch(client.name);
                                  setIsClientDropdownOpen(false);
                                }}
                              >
                                {client.name}
                              </button>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  </MetadataField>

                  <div className="grid grid-cols-2 gap-4">
                    <MetadataField id="area" label="Area (sqm)" disabled={!canEditArea}>
                      <Input
                        id="area"
                        name="area"
                        type="number"
                        step="0.01"
                        defaultValue={project.area ?? ""}
                        disabled={!canEditArea}
                        className="border-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    </MetadataField>
                    <MetadataField id="opening_date" label="Target Opening" disabled={!canEditOpening}>
                      <Input
                        id="opening_date"
                        name="opening_date"
                        type="date"
                        defaultValue={project.opening_date_input_value}
                        disabled={!canEditOpening}
                        className="border-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    </MetadataField>
                  </div>

                  <div className="space-y-4">
                    <MetadataField
                      id="pic_designer_id"
                      label="DIC (Designer In Charge)"
                      disabled={!canEditDic}
                    >
                      <select
                        id="pic_designer_id"
                        name="pic_designer_id"
                        defaultValue={project.pic_designer_id}
                        disabled={!canEditDic}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-950 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        {designers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </MetadataField>
                    <MetadataField
                      id="pic_drafter_id"
                      label="DRIC (Drafter In Charge)"
                      disabled={!canEditDric}
                    >
                      <select
                        id="pic_drafter_id"
                        name="pic_drafter_id"
                        defaultValue={project.pic_drafter_id}
                        disabled={!canEditDric}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-950 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        {drafters.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </MetadataField>
                  </div>
                </div>
              </TooltipProvider>

              <DialogFooter>
                <Button type="submit" disabled={loading || !canSubmit} className="w-full bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300">
                  {loading ? "Saving..." : canSubmit ? "Save Changes" : "Read Only"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client Name</p>
            {project.client ? (
              <p className="text-sm font-semibold text-slate-900">
                {project.client.name}
              </p>
            ) : (
              <p className="text-sm font-semibold text-slate-900">-</p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Area (sqm)</p>
            <p className="text-sm font-semibold text-slate-900">{project.area ? `${project.area} sqm` : "-"}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Opening</p>
            <p className="text-sm font-semibold text-slate-900">{project.opening_date_display}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400">
            <User className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Team</p>
            <p className="text-sm font-semibold text-slate-900">{project.designer_name} (DIC)</p>
            <p className="text-[11px] text-slate-500">{project.drafter_name} (DRIC)</p>
          </div>
        </div>
      </div>
    </div>
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
  disabled: boolean;
  children: React.ReactNode;
}) {
  const content = (
    <div className="grid gap-2">
      <Label htmlFor={id} className="flex items-center gap-2 text-slate-700">
        <span>{label}</span>
        {disabled ? <Lock className="h-3.5 w-3.5 text-slate-400" /> : null}
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
        <div>{content}</div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>Only Admin can modify this metadata.</p>
      </TooltipContent>
    </Tooltip>
  );
}
