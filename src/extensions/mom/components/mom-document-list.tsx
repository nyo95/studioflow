"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { CalendarDays, FilePlus2, Printer, Trash2 } from "lucide-react";
import { formatDate, formatDateWithOptions } from "@/core/utilities/datetime";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui_engine";
import { createMomDocument, deleteMomDocument } from "../actions/mom-actions";
import { unwrapActionResult } from "@/lib/result";
import { useAppConfirm } from "@/hooks/use-app-confirm";

interface MomDocumentListProps {
  projectId: string;
  documents: {
    id: string;
    mom_topic: string;
    mom_date: string;
    mom_venue: string | null;
    updated_at: string;
  }[];
}

export function MomDocumentList({ projectId, documents }: MomDocumentListProps) {
  const router = useRouter();
  const [loading, startTransition] = React.useTransition();
  const appConfirm = useAppConfirm();

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const document = unwrapActionResult(await createMomDocument({ projectId }));
        router.push(`/projects/${projectId}/mom/${document.id}`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create MOM document.");
      }
    });
  };

  const handleDelete = async (momDocumentId: string) => {
    if (!(await appConfirm.confirm({
      title: "Delete this MOM document?",
      description: "The document, its sections, notes, and images will be permanently deleted.",
      confirmLabel: "Delete document",
    }))) return;

    startTransition(async () => {
      try {
        unwrapActionResult(await deleteMomDocument({ projectId, mom_document_id: momDocumentId }));
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete MOM document.");
      }
    });
  };

  return (
    <div className="space-y-[var(--ui-section-gap)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Project MOM</p>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-slate-950">Minutes & Site Reports</h2>
        </div>
        <Button type="button" onClick={handleCreate} disabled={loading} className="gap-2">
          <FilePlus2 className="h-4 w-4" />
          New MOM
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <p className="font-serif text-xl font-bold text-slate-900">No MOM documents yet</p>
            <p className="max-w-md font-sans text-sm text-slate-500">
              Create the first project-level MOM report. Project identity stays synced from StudioFlow automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((document) => (
            <Card key={document.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="min-w-0 space-y-2">
                  <CardTitle className="font-serif text-xl font-bold text-slate-950">{document.mom_topic}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(document.mom_date)}
                    </span>
                    <span>{document.mom_venue || "Venue not set"}</span>
                    <span>
                      Updated{" "}
                      {formatDateWithOptions(document.updated_at, {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </CardDescription>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/projects/${projectId}/mom/${document.id}/print`}>
                      <Printer className="h-3.5 w-3.5" />
                      Print
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleDelete(document.id)}
                    disabled={loading}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 pt-0">
                <p className="font-sans text-sm text-slate-500">
                  Structured MOM with section notes, image annotation, and print export.
                </p>
                <Button asChild size="sm">
                  <Link href={`/projects/${projectId}/mom/${document.id}`}>Open Editor</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {appConfirm.dialog}
    </div>
  );
}
