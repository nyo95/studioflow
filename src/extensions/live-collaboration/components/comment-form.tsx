"use client";

import { useState, useRef } from "react";
import { Button } from "@/ui_engine";
import { Send, Paperclip, X, Loader2, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TemporaryAttachment } from "@/generated/prisma";

interface CommentFormProps {
  onPost: (content: string, attachmentIds?: string[]) => Promise<void>;
  isPending: boolean;
}

export function CommentForm({ onPost, isPending }: CommentFormProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<TemporaryAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && attachments.length === 0) || isPending || isUploading) return;

    const currentContent = content;
    const attachmentIds = attachments.map(a => a.id);
    
    setContent(""); 
    setAttachments([]);
    try {
      await onPost(currentContent, attachmentIds);
    } catch {
      setContent(currentContent);
      setAttachments(attachments); // Revert on error
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const file = files[0]; // Single file for now for simplicity, can be expanded
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload/temp", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const attachment = await res.json() as TemporaryAttachment;
      setAttachments(prev => [...prev, attachment]);
      toast.success("File attached");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((file) => (
            <div 
              key={file.id} 
              className="flex items-center gap-2 px-2 py-1 bg-slate-100 rounded-md border border-slate-200 group relative"
            >
              <FileIcon className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] font-medium text-slate-700 truncate max-w-[100px]">
                {file.filename}
              </span>
              <button
                onClick={() => removeAttachment(file.id)}
                className="h-4 w-4 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-colors"
                title="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          placeholder="Type a message..."
          value={content}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
          maxLength={5000}
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white/50 px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            "resize-none font-sans text-xs focus-visible:ring-slate-400"
          )}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        />
        
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange}
        />

        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending || isUploading}
            title="Attach a temporary file (30m)"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>

          <Button 
            type="submit" 
            disabled={(!content.trim() && attachments.length === 0) || isPending || isUploading}
            size="sm"
            className="h-8 rounded-sm bg-slate-900 px-4 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-slate-800"
          >
            {isPending ? "Posting..." : (
              <>
                Post <Send className="ml-2 h-3 w-3" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
