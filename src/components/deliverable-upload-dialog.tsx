"use client";
import { cn } from "@/lib/utils";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDeliverable } from "@/actions/phase-actions";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, Link as LinkIcon } from "lucide-react";
import { Role } from "@/generated/prisma";
import { unwrapActionResult } from "@/lib/result";

interface DeliverableUploadDialogProps {
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
  revisionId,
  userId,
  userRole,
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
  const router = useRouter();

  const handleUpload = async (e: React.FormEvent, isExternal: boolean) => {
    e.preventDefault();
    if (!fileName || !canMutate) return;

    setLoading(true);
    try {
      unwrapActionResult(await addDeliverable({
        revisionId,
        data: {
          file_name: fileName,
          file_type: isExternal ? "LINK" : fileType,
          link_url: isExternal ? linkUrl : undefined,
          file_url: isExternal ? undefined : "/mock/path/" + fileName, // Mock upload path
          is_external: isExternal,
        },
      }));
      setOpen(false);
      setFileName("");
      setLinkUrl("");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
                disabled={loading || !fileName}
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
