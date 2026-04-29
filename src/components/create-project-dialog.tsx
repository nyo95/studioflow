"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Building, Folder, Calendar } from "lucide-react";
import { bootstrapProject } from "@/actions/project-actions";
import { unwrapActionResult } from "@/lib/result";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { format } from "date-fns";

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface CreateProjectDialogProps {
  designers: UserOption[];
  drafters: UserOption[];
  clients: Array<{ id: string; name: string }>;
  isAutoNamingEnabled: boolean;
}

export function CreateProjectDialog({
  designers,
  drafters,
  clients,
  isAutoNamingEnabled,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nameInput, setNameInput] = React.useState("");
  const [selectedClientId, setSelectedClientId] = React.useState<string>("");
  const [clientNameInput, setClientNameInput] = React.useState("");

  const trimmedName = nameInput.trim();
  const hasPrefixedName = /^\d{4}-\d{3} /.test(trimmedName);
  const namingPreview = isAutoNamingEnabled
    ? trimmedName
      ? `${currentYear}-AUTO ${trimmedName}`
      : `${currentYear}-NNN Project Name`
    : trimmedName || `${currentYear}-001 Project Name`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const client_name = clientNameInput;
    const pic_designer_id = formData.get("pic_designer_id") as string;
    const pic_drafter_id = formData.get("pic_drafter_id") as string;
    const opening_date = formData.get("opening_date") as string;

    if (!name || !pic_designer_id || !pic_drafter_id) {
        setError("Please fill in all required fields.");
        setLoading(false);
        return;
    }

    if (isAutoNamingEnabled && /^\d{4}-\d{3} /.test(name.trim())) {
      setError("Enter only the readable project name. Year and sequence are generated automatically.");
      setLoading(false);
      return;
    }

    if (!isAutoNamingEnabled && !/^\d{4}-\d{3} .+/.test(name.trim())) {
      setError("Project name must use the format: [YYYY]-[NNN] [Name] (Note: Use SPACE after the code).");
      setLoading(false);
      return;
    }

    try {
      unwrapActionResult(await bootstrapProject({
        name: name.trim(),
        pic_designer_id,
        pic_drafter_id,
        client_name: client_name || undefined,
        opening_date: opening_date ? new Date(opening_date) : undefined,
        core_project_type: "RETAIL", // default
      }));
      setOpen(false);
      router.refresh(); // Refresh the page to see the new project
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-sans font-bold flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white shadow-sm h-10 px-5 rounded-md tracking-wide">
          <Plus className="w-4 h-4" />
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] font-sans">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-bold">Create New Project</DialogTitle>
          <DialogDescription>
            Enter details to initialize a new project workflow.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && (
            <div className="p-2 border border-red-200 bg-red-50 text-red-600 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="name">Project Name <span className="text-red-500">*</span></Label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Format</p>
              <p className="mt-1 font-mono text-xs text-slate-700">[YYYY]-[NNN] [Name]</p>
              <p className="mt-2 text-xs text-slate-500">
                {isAutoNamingEnabled
                  ? "Auto-naming is enabled. Type only the readable project title."
                  : "Auto-naming is disabled. Enter the full project name manually."}
              </p>
              <p className="mt-2 text-xs text-slate-500">Preview: <span className="font-mono text-slate-700">{namingPreview}</span></p>
            </div>
            <div className="relative">
              <Folder className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="name"
                name="name"
                placeholder={
                  isAutoNamingEnabled
                    ? "e.g., Kopi Kenangan Mall"
                    : `${currentYear}-001 Kopi Kenangan Mall`
                }
                required
                className="pl-9"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
              />
            </div>
            {isAutoNamingEnabled && hasPrefixedName ? (
              <p className="text-xs text-red-600">Use only the project title. The `YYYY-NNN` prefix and space are added automatically.</p>
            ) : !isAutoNamingEnabled ? (
              <p className="text-xs text-slate-500">Format: [YYYY]-[NNN] [Name]</p>
            ) : (
              <p className="text-xs text-slate-500">Type only the project title. Sequence number and space are assigned when the project is created.</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client_name">Client Name</Label>
            <CreatableSearch
              options={clients}
              value={selectedClientId}
              onSelect={(id, name) => {
                setSelectedClientId(id);
                setClientNameInput(name);
              }}
              onCreate={(name) => {
                setSelectedClientId(""); // It's a new client
                setClientNameInput(name);
              }}
              placeholder="Search or type a new client..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opening_date">Target Opening Date</Label>
            <Input id="opening_date" name="opening_date" type="date" className="border-slate-200" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pic_designer_id">PIC Designer <span className="text-red-500">*</span></Label>
            <select
              id="pic_designer_id"
              name="pic_designer_id"
              required
              className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select Designer</option>
              {designers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pic_drafter_id">PIC Drafter <span className="text-red-500">*</span></Label>
            <select
              id="pic_drafter_id"
              name="pic_drafter_id"
              required
              className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select Drafter</option>
              {drafters.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full bg-slate-900 text-white hover:bg-slate-800">
              {loading ? "Creating..." : "Initialize Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
