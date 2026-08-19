"use client";
import { cn } from "@/lib/utils";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDeliverable } from "@/actions/phase-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, Button, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui_engine";
import { Loader2, Upload, Link as LinkIcon, FileIcon, Paperclip, X } from "lucide-react";
import { Role } from "@/generated/prisma";
import { unwrapActionResult } from "@/lib/result";
import { toast } from "sonner";

interface DeliverableUploadDialogProps {
  projectId: string;
  phaseId: string;
  revisionId: string;
  userId: string;
  userRole: Role;
  canMutate: boolean;
  phaseLabel?: string;
  revisionLabel?: string;
  triggerLabel?: string;
  className?: string;
}

export function DeliverableUploadDialog({
  projectId,
  phaseId,
  revisionId,
  canMutate,
  phaseLabel,
  revisionLabel,
  triggerLabel = "+ Add Deliverable",
  className,
}: DeliverableUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("PDF");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const resetState = () => {
    setFileName("");
    setFileType("PDF");
    setLinkUrl("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sanitizeFileName = (value: string) =>
    value.replace(/[^a-zA-Z0-9.\-_]/g, "_");

  const handleUpload = async (e: React.FormEvent, isExternal: boolean) => {
    e.preventDefault();
    if (!fileName || !canMutate || (!isExternal && !selectedFile)) return;

    setLoading(true);
    try {
      let fileUrl: string | undefined;

      if (!isExternal && selectedFile) {
        const timestamp = Date.now();
        const safeName = sanitizeFileName(selectedFile.name);
        const uploadPath = [
          "projects",
          projectId,
          "deliverables",
          phaseId,
          revisionId,
          `${timestamp}-${safeName}`,
        ].join("/");

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("folder", "deliverables");
        formData.append("path", uploadPath);

        const uploadResponse = await fetch("/api/upload/media", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload deliverable file");
        }

        const uploaded = (await uploadResponse.json()) as { url?: string };
        fileUrl = uploaded.url;

        if (!fileUrl) {
          throw new Error("Deliverable upload did not return a file URL");
        }
      }

      unwrapActionResult(await addDeliverable({
        revisionId,
        data: {
          file_name: fileName,
          file_type: isExternal ? "LINK" : fileType,
          link_url: isExternal ? linkUrl : undefined,
          file_url: isExternal ? undefined : fileUrl,
          is_external: isExternal,
        },
      }));
      toast.success(isExternal ? "Deliverable link saved" : "Deliverable uploaded");
      setOpen(false);
      resetState();
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save deliverable");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);

    if (!file) {
      return;
    }

    if (!fileName) {
      setFileName(file.name);
    }

    const inferredType = file.name.split(".").pop()?.toUpperCase() || file.type || "FILE";
    setFileType(inferredType);
  };

  if (!canMutate) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className={cn("w-full border-dashed border-zinc-300 text-slate-500 hover:text-slate-900 hover:border-zinc-400 font-sans shadow-none", className)}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-white border-zinc-200">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-bold">Add Deliverable</DialogTitle>
          {phaseLabel || revisionLabel ? (
            <p className="text-sm text-slate-500">
              {phaseLabel ? `Phase: ${phaseLabel}` : null}
              {phaseLabel && revisionLabel ? " | " : null}
              {revisionLabel ? `Revision: ${revisionLabel}` : null}
            </p>
          ) : null}
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full mt-4">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <TabsList className="grid w-full grid-cols-2 bg-slate-50 p-1 border border-slate-200">
            <TabsTrigger value="upload" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-sans text-xs">
              <Upload className="w-3.5 h-3.5 mr-2" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="link" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-sans text-xs">
              <LinkIcon className="w-3.5 h-3.5 mr-2" />
              Provide Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Attachment</Label>
              {selectedFile ? (
                <div className="flex items-center justify-between gap-3 rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] bg-white text-slate-500 border border-slate-200">
                      <FileIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-800">{selectedFile.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                        Replaced automatically on next revision upload
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition-colors hover:bg-red-100 hover:text-red-500"
                    title="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-between rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-left transition-colors hover:border-slate-400 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] bg-white text-slate-500 border border-slate-200">
                      <Paperclip className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Attach deliverable file</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                        Same pattern as project chat, but revision-based replacement
                      </p>
                    </div>
                  </div>
                  <Upload className="h-4 w-4 text-slate-400" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">File Name</Label>
              <Input 
                placeholder="Design-Layout-V1.pdf" 
                value={fileName} 
                onChange={e => setFileName(e.target.value)}
                className="border-slate-200 focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">File Type</Label>
              <Input 
                placeholder="PDF / DWG / JPG" 
                value={fileType} 
                onChange={e => setFileType(e.target.value)}
                className="border-slate-200 focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <DialogFooter>
              <Button 
                onClick={(e) => handleUpload(e, false)} 
                disabled={loading || !fileName || !selectedFile}
                className="w-full bg-slate-900 text-white font-sans"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload Deliverable"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="link" className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Label / Name</Label>
              <Input 
                placeholder="Google Drive Link" 
                value={fileName} 
                onChange={e => setFileName(e.target.value)}
                className="border-slate-200 focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Google Drive URL</Label>
              <Input 
                placeholder="https://drive.google.com/..." 
                value={linkUrl} 
                onChange={e => setLinkUrl(e.target.value)}
                className="border-slate-200 focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <DialogFooter>
              <Button 
                onClick={(e) => handleUpload(e, true)} 
                disabled={loading || !fileName || !linkUrl}
                className="w-full bg-slate-900 text-white font-sans"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Link"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
