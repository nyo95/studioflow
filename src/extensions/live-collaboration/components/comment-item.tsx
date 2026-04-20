import { CommentWithAuthor } from "../types/comment";
import { Trash2, FileIcon, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRelativeTime } from "@/hooks/use-hydration";

interface CommentItemProps {
  comment: CommentWithAuthor;
  onDelete?: (id: string) => Promise<void>;
  isDeleting?: boolean;
  canDelete?: boolean;
}

export function CommentItem({ comment, onDelete, isDeleting, canDelete }: CommentItemProps) {
  const relativeTime = useRelativeTime(comment.created_at, true);

  return (
    <div className="group flex flex-col gap-1 border-l-2 border-slate-100 py-3 pl-4 transition-colors hover:border-slate-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900">
            {comment.author.name}
          </span>
          <span className="text-[9px] font-mono uppercase tracking-tight text-slate-400">
            {relativeTime}
          </span>
        </div>
        
        {canDelete && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(comment.id)}
            disabled={isDeleting}
            className="h-6 w-6 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      {comment.content && (
        <p className="font-sans text-[12px] leading-relaxed text-slate-600">
          {comment.content}
        </p>
      )}

      {comment.temp_attachments && comment.temp_attachments.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.temp_attachments.map((file) => {
            const isImage = file.file_type.startsWith("image/");
            
            return (
              <div key={file.id} className="flex flex-col gap-1">
                {isImage ? (
                  <div className="relative max-w-xs group/img overflow-hidden rounded-lg border border-slate-200">
                    <img 
                      src={file.url} 
                      alt={file.filename} 
                      className="max-h-48 w-auto object-contain bg-slate-50"
                    />
                    <a 
                      href={file.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="h-5 w-5 text-white" />
                    </a>
                  </div>
                ) : (
                  <a 
                    href={file.url} 
                    download 
                    className="flex items-center gap-3 p-2 rounded-md bg-white border border-slate-100 hover:border-slate-300 transition-all group/file"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-50 text-slate-400 group-hover/file:text-indigo-500 group-hover/file:bg-indigo-50 transition-colors">
                      <FileIcon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-medium text-slate-700 truncate underline decoration-slate-200 underline-offset-4">
                        {file.filename}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {file.file_type.split("/")[1]?.toUpperCase() || "FILE"}
                      </span>
                    </div>
                  </a>
                )}
                
                <div className="flex items-center gap-1.5 px-1 font-sans">
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-amber-500/80 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100/50">
                    <Clock className="h-2.5 w-2.5" />
                    <span>Temp: Expires in 30m</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
