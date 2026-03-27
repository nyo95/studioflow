"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Edit2, GitMerge, ImageIcon, MapPin, Trash2 } from "lucide-react";
import {
  deleteClient,
  mergeClients,
  updateClientBranding,
} from "@/app/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ClientBranding, getClientInitials } from "@/components/client-branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ManagedClient {
  id: string;
  name: string;
  address: string | null;
  logo_url: string | null;
  updated_at: Date;
  projects: Array<{ id: string }>;
}

interface ClientManagementTableProps {
  clients: ManagedClient[];
}

const clientDateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

export function ClientManagementTable({ clients }: ClientManagementTableProps) {
  const router = useRouter();
  const [selectedClient, setSelectedClient] = React.useState<ManagedClient | null>(null);
  const [open, setOpen] = React.useState(false);
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const [clientToMerge, setClientToMerge] = React.useState<ManagedClient | null>(null);
  const [mergeTargetId, setMergeTargetId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [mergeLoading, setMergeLoading] = React.useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [mergeError, setMergeError] = React.useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelectedClient(null);
      setError(null);
    }
  };

  const handleMergeOpenChange = (nextOpen: boolean) => {
    setMergeOpen(nextOpen);
    if (!nextOpen) {
      setClientToMerge(null);
      setMergeTargetId("");
      setMergeError(null);
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClient) return;

    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      await updateClientBranding({
        clientId: selectedClient.id,
        address: String(formData.get("address") ?? ""),
        logo_url: String(formData.get("logo_url") ?? ""),
      });
      handleOpenChange(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update client branding.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(client: ManagedClient) {
    setDeleteLoadingId(client.id);
    try {
      await deleteClient(client.id);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete client.");
    } finally {
      setDeleteLoadingId(null);
    }
  }

  async function handleMerge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientToMerge || !mergeTargetId) return;

    setMergeLoading(true);
    setMergeError(null);

    try {
      await mergeClients({
        sourceClientId: clientToMerge.id,
        targetClientId: mergeTargetId,
      });
      handleMergeOpenChange(false);
      router.refresh();
    } catch (err: unknown) {
      setMergeError(err instanceof Error ? err.message : "Failed to merge clients.");
    } finally {
      setMergeLoading(false);
    }
  }

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <TooltipProvider delayDuration={0}>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="px-6 py-4 font-sans text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Client</TableHead>
                <TableHead className="px-6 py-4 font-sans text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Address</TableHead>
                <TableHead className="px-6 py-4 font-sans text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Projects</TableHead>
                <TableHead className="px-6 py-4 text-right font-sans text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow className="hover:bg-white">
                  <TableCell colSpan={4} className="px-6 py-16 text-center font-sans text-sm text-slate-500">
                    No clients found.
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => {
                  const hasProjects = client.projects.length > 0;
                  const mergeCandidates = clients.filter((candidate) => candidate.id !== client.id);

                  return (
                    <TableRow key={client.id} className="border-slate-200 hover:bg-slate-50/60">
                      <TableCell className="px-6 py-5">
                        <div className="space-y-2">
                          {client.logo_url ? (
                            <ClientBranding
                              name={client.name}
                              logoUrl={client.logo_url}
                              fallback="text"
                              showName
                              nameClassName="font-medium text-slate-900"
                            />
                          ) : (
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 rounded-2xl border border-slate-200 bg-white">
                                <AvatarFallback className="rounded-2xl bg-slate-100 font-sans text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
                                  {getClientInitials(client.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-sans text-sm font-semibold text-slate-900">{client.name}</p>
                                <p className="text-xs text-slate-500">No logo uploaded.</p>
                              </div>
                            </div>
                          )}
                          <p className="text-xs text-slate-400">
                            Updated {clientDateFormatter.format(client.updated_at)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="flex items-start gap-2 text-sm text-slate-600">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="whitespace-normal">{client.address || "No address yet."}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-5 font-sans text-sm font-semibold text-slate-700">
                        {client.projects.length}
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg border-slate-200 text-xs font-semibold"
                            onClick={() => {
                              setSelectedClient(client);
                              setError(null);
                              setOpen(true);
                            }}
                          >
                            <Edit2 className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg border-slate-200 text-xs font-semibold"
                            onClick={() => {
                              setClientToMerge(client);
                              setMergeTargetId(mergeCandidates[0]?.id ?? "");
                              setMergeError(null);
                              setMergeOpen(true);
                            }}
                            disabled={mergeCandidates.length === 0}
                          >
                            <GitMerge className="mr-2 h-3.5 w-3.5" />
                            Merge
                          </Button>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  className="rounded-lg border-slate-200 text-slate-600 hover:text-red-600"
                                  disabled={hasProjects || deleteLoadingId === client.id}
                                  onClick={() => handleDelete(client)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="sr-only">Delete client</span>
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {hasProjects ? (
                              <TooltipContent side="left">
                                <p>Cannot delete client with active projects. Use Merge instead.</p>
                              </TooltipContent>
                            ) : null}
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl font-bold text-slate-950">Edit Client Branding</DialogTitle>
              <DialogDescription>
                Update the client address and logo URL used across the app.
              </DialogDescription>
            </DialogHeader>

            {selectedClient ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  {selectedClient.logo_url ? (
                    <ClientBranding
                      name={selectedClient.name}
                      logoUrl={selectedClient.logo_url}
                      fallback="text"
                      showName
                      nameClassName="font-semibold text-slate-900"
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 rounded-2xl border border-slate-200 bg-white">
                        <AvatarFallback className="rounded-2xl bg-slate-100 font-sans text-sm font-bold uppercase tracking-[0.18em] text-slate-700">
                          {getClientInitials(selectedClient.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-sans text-sm font-semibold text-slate-900">{selectedClient.name}</p>
                        <p className="text-xs text-slate-500">Client name is shown until a logo URL is added.</p>
                      </div>
                    </div>
                  )}
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="address" className="text-slate-700">Client Address</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={selectedClient.address ?? ""}
                    placeholder="e.g., Jl. Sudirman No. 21, Jakarta"
                    className="border-slate-200"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="logo_url" className="text-slate-700">Client Logo URL</Label>
                  <div className="relative">
                    <ImageIcon className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="logo_url"
                      name="logo_url"
                      defaultValue={selectedClient.logo_url ?? ""}
                      placeholder="https://example.com/logo.png"
                      className="border-slate-200 pl-9"
                    />
                  </div>
                  <p className="text-xs text-slate-500">If empty, the app will keep showing the client name. Logo is only used after a valid logo URL is added.</p>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={loading} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                {loading ? "Saving..." : "Save Branding"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={handleMergeOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <form onSubmit={handleMerge} className="space-y-6">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl font-bold text-slate-950">
                Merge Clients
              </DialogTitle>
              <DialogDescription>
                Consolidate duplicate client records into one canonical client.
              </DialogDescription>
            </DialogHeader>

            {clientToMerge ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                    Warning
                  </p>
                  <p className="mt-2 text-sm font-medium text-amber-900">
                    This action will move all projects and is irreversible.
                  </p>
                </div>

                {mergeError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {mergeError}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label className="text-slate-700">Merge Source</Label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                    {clientToMerge.name}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="merge_target" className="text-slate-700">
                    Merge into
                  </Label>
                  <select
                    id="merge_target"
                    value={mergeTargetId}
                    onChange={(event) => setMergeTargetId(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                    required
                  >
                    {clients
                      .filter((client) => client.id !== clientToMerge.id)
                      .map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="submit"
                disabled={mergeLoading || !mergeTargetId}
                className="w-full bg-slate-900 text-white hover:bg-slate-800"
              >
                {mergeLoading ? "Merging..." : "Merge Clients"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
