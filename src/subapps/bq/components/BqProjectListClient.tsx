"use client";

/**
 * BQ — daftar breakdown.
 *
 * Halaman paling sederhana di subapp ini dengan sengaja: yang berat ada di
 * `/bq/[projectId]`. Di sini cuma daftar, satu tombol buat, dan rename inline
 * lewat dialog.
 *
 * Teks antarmuka Bahasa Inggris (AGENTS.md §Bahasa Antarmuka); komentar tetap
 * Bahasa Indonesia.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, Layers, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  DashboardTemplate,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  PageHeader,
  SectionCard,
  StatusBadge,
  UI_ENGINE_RADIUS_CONTROL,
} from "@/ui_engine";
import { UI_ENGINE_TYPE_META } from "@/ui_engine/tokens";
import { statusToTone } from "@/lib/ui/status-tone";
import { cn } from "@/lib/utils";
import {
  createBqProjectAction,
  deleteBqProjectAction,
} from "../actions/bq-project-actions";
import type { BqProjectSummary } from "../types/breakdown";

export function BqProjectListClient({
  projects,
  canManageProjects,
}: {
  projects: BqProjectSummary[];
  canManageProjects: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  /**
   * Hapus breakdown.
   *
   * Soft delete di server (`deleted_at`) — barisnya tetap ada di database
   * lengkap dengan seluruh object, sub-object dan baris L3-nya, dan tercatat
   * di audit log. Yang hilang cuma dari daftar. Itu sebabnya konfirmasinya
   * cukup `window.confirm`: keputusan ini bisa dibatalkan lewat database,
   * bukan kehilangan permanen.
   *
   * Tombolnya hidup di kartu, bukan di halaman breakdown, karena menghapus
   * satu breakdown dari dalam breakdown itu sendiri berarti menghapus halaman
   * yang sedang dilihat — dan pengguna berakhir di layar kosong tanpa konteks.
   */
  const handleDelete = React.useCallback(
    async (project: BqProjectSummary) => {
      if (
        !window.confirm(
          `Hapus breakdown "${project.name}"?\n\n` +
            `${project.objectCount} pekerjaan beserta seluruh rinciannya ikut hilang dari daftar.`,
        )
      ) {
        return;
      }

      setDeletingId(project.id);
      const result = await deleteBqProjectAction({ id: project.id });
      setDeletingId(null);

      if (!result.success) {
        toast.error(result.error ?? "Breakdown tidak bisa dihapus.");
        return;
      }
      toast.success(`"${project.name}" dihapus.`);
      router.refresh();
    },
    [router],
  );

  const handleCreate = React.useCallback(async () => {
    if (!name.trim()) {
      toast.error("Project name is required.");
      return;
    }
    setSaving(true);
    const result = await createBqProjectAction({ name, code });
    setSaving(false);

    if (!result.success) {
      toast.error(result.error ?? "Could not create the breakdown.");
      return;
    }

    setOpen(false);
    setName("");
    setCode("");
    toast.success("Breakdown created.");
    router.push(`/bq/${result.data.id}`);
  }, [name, code, router]);

  return (
    <>
      <DashboardTemplate
        header={
          <PageHeader
            eyebrow="BQ"
            title="Fixture Breakdowns"
            description="Break one fixture down to raw materials and services, and get a reusable rate per unit."
            action={
              canManageProjects ? (
                <Button onClick={() => setOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New breakdown
                </Button>
              ) : null
            }
          />
        }
        content={
          projects.length === 0 ? (
            <SectionCard>
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <FolderOpen className="h-8 w-8 text-slate-300" />
                <p className="font-sans text-sm font-medium text-slate-700">No breakdowns yet</p>
                <p className={cn(UI_ENGINE_TYPE_META, "max-w-sm text-slate-500")}>
                  {canManageProjects
                    ? "Create one to start costing a fixture down to plywood, edging and labour."
                    : "An estimator has not created any breakdown yet."}
                </p>
              </div>
            </SectionCard>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                // Kartu jadi pembungkus posisi supaya tombol hapus bisa duduk
                // di dalamnya tanpa bersarang di dalam <Link> — anchor yang
                // membungkus button adalah HTML tidak sah, dan kliknya akan
                // ikut menavigasi.
                <div
                  key={project.id}
                  className={cn(
                    "group relative border border-slate-200 bg-white transition-colors hover:bg-slate-50",
                    UI_ENGINE_RADIUS_CONTROL
                  )}
                >
                  <Link href={`/bq/${project.id}`} className="block p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {project.code ? (
                          <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>{project.code}</p>
                        ) : null}
                        <p className="truncate font-serif text-lg font-semibold text-slate-900">
                          {project.name}
                        </p>
                      </div>
                      <StatusBadge status={project.status} tone={statusToTone(project.status)} />
                    </div>

                    {/* pr-9 menyisakan ruang untuk tombol hapus di kanan bawah */}
                    <div className="mt-4 flex items-center gap-2 pr-9 text-slate-500">
                      <Layers className="h-3.5 w-3.5" />
                      <span className={UI_ENGINE_TYPE_META}>
                        {project.objectCount} {project.objectCount === 1 ? "object" : "objects"}
                      </span>
                    </div>
                  </Link>

                  {canManageProjects ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "absolute bottom-3 right-3 h-7 w-7 p-0 text-slate-300",
                        "opacity-0 transition-opacity hover:text-red-600",
                        "focus-visible:opacity-100 group-hover:opacity-100"
                      )}
                      disabled={deletingId === project.id}
                      title={`Hapus "${project.name}"`}
                      aria-label={`Hapus ${project.name}`}
                      onClick={() => void handleDelete(project)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader className="pr-12">
            <DialogTitle>New breakdown</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="bq-project-name">Name</Label>
              <Input
                id="bq-project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Karawaci Store Fixtures"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bq-project-code">Code (optional)</Label>
              <Input
                id="bq-project-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="BQ-2026-001"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
