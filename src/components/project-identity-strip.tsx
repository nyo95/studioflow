"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateProjectMetadata } from "@/actions/project-actions";
import { unwrapActionResult } from "@/lib/result";
import {
  UnsavedChangesPrompt,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { Role } from "@/generated/prisma";
import {
  Button,
  CreatableSearch,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Heading,
  Input,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui_engine";
import { Edit3, Loader2, Lock, Save } from "lucide-react";

interface UserOption {
  id: string;
  name: string;
  role: Role;
}

interface ClientOption {
  id: string;
  name: string;
}

export interface ProjectIdentityStripProps {
  project: {
    id: string;
    name: string;
    client: { id: string; name: string } | null;
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

/**
 * PROJECT IDENTITY STRIP — tier 1 of the project page: who, what, where, when.
 *
 * ============================================================================
 * WHY THIS IS A STRIP UNDER THE TITLE AND NOT A CARD BELOW THE FOLD
 * ============================================================================
 * Client, area, target opening and assigned team answer "which project is
 * this". They are read once on arrival and change rarely. That makes them
 * masthead material, not a content block.
 *
 * They previously lived in a card titled "Overview" that sat BELOW the phase
 * matrix — an overview placed after the detail it was supposed to introduce,
 * and a name that described the whole page rather than that card. Two of the
 * four fields were also printed a second time in the page subtitle
 * ("Sociolla — No area SQM"), which has since been dropped in favour of this
 * strip.
 *
 * Editing is unchanged: it was already a modal, so moving the read view up the
 * page cost nothing. The dialog markup below is the original, moved verbatim.
 */
export function ProjectIdentityStrip({
  project,
  designers,
  drafters,
  clients,
  role,
  canEdit,
}: ProjectIdentityStripProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  /**
   * Form ini uncontrolled (`FormData` + `defaultValue`), jadi tidak ada objek
   * state yang bisa dibandingkan dengan snapshot. Satu bendera yang dinyalakan
   * oleh event `change` yang menggelembung dari field mana pun sudah cukup, dan
   * lebih jujur daripada berpura-pura melacak nilai per field.
   */
  const [dirty, setDirty] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isAdmin = role === "ADMIN" || role === "DEVELOPER";
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

  React.useEffect(() => {
    if (!open) {
      setClientSearch(project.client?.name ?? "");
      setSelectedClientId(project.client?.id ?? "none");
      setDirty(false);
    }
  }, [open, project.client?.id, project.client?.name]);

  /**
   * Bisa disunting = punya izin. Gatekeeper "Modify" dihapus 2026-08-14
   * bersama View-First Protocol (permintaan owner). Field per-field tetap
   * dikunci sendiri-sendiri lewat `canEditProjectName`, `canEditDic`, dst. —
   * itu aturan RBAC, bukan gerbang UI, dan tetap berlaku.
   */
  const isEditMode = isAdmin || canEdit;

  const guard = useUnsavedChangesGuard({
    open,
    value: dirty,
    onOpenChange: setOpen,
    enabled: isEditMode,
  });

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

    const parsedArea = areaValue === "" ? undefined : Number(areaValue);

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
      guard.closeAfterSave();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update project metadata.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-x-10 gap-y-4 border-b border-[var(--ui-border-subtle,rgb(241_245_249))] pb-6">
      {/* Label-over-value pairs on one line. No icon tiles and no card chrome:
          reference data should be legible at a glance and visually quieter than
          the phase matrix, which is what people actually came to read. */}
      <dl className="flex flex-wrap items-start gap-x-10 gap-y-4">
        <IdentityField label="Client" value={project.client?.name ?? "No client assigned"} />
        <IdentityField label="Area" value={project.area ? `${project.area} sqm` : "—"} />
        <IdentityField label="Target opening" value={project.opening_date_display || "—"} />
        <IdentityField
          label="Assigned team"
          value={`${project.designer_name} (DIC)`}
          secondary={`${project.drafter_name} (DRIC)`}
        />
      </dl>

          <Dialog open={open} onOpenChange={guard.handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-lg border-slate-200 text-xs font-semibold shadow-none hover:bg-slate-50">
                <Edit3 className="mr-2 h-3.5 w-3.5" />
                Modify Information
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit} onChange={() => setDirty(true)}>
                <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4 pr-12">
                  <div className="space-y-1">
                    <DialogTitle asChild>
                      <Heading level={3}>Project Information</Heading>
                    </DialogTitle>
                    {/* Kept only in edit mode, and only because it names the
                        one thing the fields do not: that PICs are editable
                        here. The view-mode line ("Viewing current project
                        identification and assignment") described the act of
                        looking at a form. */}
                    {isEditMode ? (
                      <DialogDescription className="text-xs">
                        Changing a PIC reassigns every phase they own.
                      </DialogDescription>
                    ) : (
                      <DialogDescription className="sr-only">Project information</DialogDescription>
                    )}
                  </div>
                  {/* Tombol tutup buatan sendiri dihapus 2026-08-14:
                      `DialogContent` sudah merender tombol X sendiri di
                      `absolute right-4 top-4`, sehingga selama ini ada DUA
                      tombol tutup yang bertumpuk di sudut yang sama. `pr-12`
                      menyisakan tempat untuknya. */}
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
                      {/* "Cancel" sekarang menutup dialog, bukan kembali ke
                          mode baca yang sudah tidak ada. Kalau ada perubahan,
                          `handleOpenChange` yang akan bertanya. */}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => guard.handleOpenChange(false)}
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

          <UnsavedChangesPrompt guard={guard} />
    </div>
  );
}

function IdentityField({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-sans text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-1.5 font-sans text-sm font-semibold text-slate-900">{value}</dd>
      {secondary ? (
        <dd className="font-sans text-[11px] font-medium text-slate-500">{secondary}</dd>
      ) : null}
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
