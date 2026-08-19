"use client";

import { CommentWithAuthor } from "../types/comment";
import { Trash2, FileIcon, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/ui_engine";
import { useRelativeTime } from "@/hooks/use-hydration";
import { cn } from "@/lib/utils";

interface CommentBubbleProps {
  comment: CommentWithAuthor;
  isOwn: boolean;
  showHeader: boolean; // Only shown on the first message of a group
  onDelete?: (id: string) => Promise<void>;
  canDelete?: boolean;
}

function AttachmentPreview({ file }: { file: NonNullable<CommentWithAuthor["temp_attachments"]>[number] }) {
  const isImage = file.file_type.startsWith("image/");

  if (isImage) {
    return (
      <div className="relative max-w-[220px] group/img overflow-hidden rounded-lg border border-black/10">
        <img
          src={file.url}
          alt={file.filename}
          className="max-h-48 w-auto object-contain bg-black/5"
        />
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity rounded-lg"
        >
          <ExternalLink className="h-5 w-5 text-white" />
        </a>
      </div>
    );
  }

  return (
    <a
      href={file.url}
      download
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/10 hover:bg-black/20 transition-all group/file max-w-[220px]"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white/40 text-current">
        <FileIcon className="h-3.5 w-3.5" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-medium truncate">{file.filename}</span>
        <span className="text-[9px] opacity-70 font-mono">
          {file.file_type.split("/")[1]?.toUpperCase() || "FILE"}
        </span>
      </div>
    </a>
  );
}

function CommentBubble({ comment, isOwn, showHeader, onDelete, canDelete }: CommentBubbleProps) {
  const relativeTime = useRelativeTime(comment.created_at, true);

  return (
    <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
      {/* Header (name + time) — only on first of group */}
      {showHeader && (
        <div className={cn("flex items-center gap-2 mb-1 px-1", isOwn ? "flex-row-reverse" : "flex-row")}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
            {comment.author.name}
          </span>
          <span className="text-[9px] font-mono text-slate-400">{relativeTime}</span>
        </div>
      )}

      <div className={cn("group relative flex items-end gap-1.5 max-w-[85%]", isOwn ? "flex-row-reverse" : "flex-row")}>
        {/* Bubble */}
        <div
          className={cn(
            "flex flex-col gap-2 rounded-2xl px-3 py-2 text-[12px] leading-relaxed break-words",
            isOwn
              ? "rounded-br-sm bg-indigo-600 text-white"
              : "rounded-bl-sm bg-white text-slate-800 border border-slate-200 shadow-sm"
          )}
        >
          {comment.content && (
            <p className="font-sans whitespace-pre-wrap">{comment.content}</p>
          )}

          {comment.temp_attachments && comment.temp_attachments.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {comment.temp_attachments.map((file) => (
                <div key={file.id} className="flex flex-col gap-1">
                  <AttachmentPreview file={file} />
                  <div className="flex items-center gap-1 px-1">
                    <div className={cn(
                      "flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border",
                      isOwn
                        ? "text-indigo-200 bg-indigo-500/40 border-indigo-400/20"
                        : "text-amber-600/80 bg-amber-50 border-amber-100/50"
                    )}>
                      <Clock className="h-2 w-2" />
                      <span>Temp 30m</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete button — appears on hover, positioned outside bubble */}
        {canDelete && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(comment.id)}
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500 shrink-0 mb-1"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Exported group renderer ────────────────────────────────────────────────────

interface CommentItemProps {
  comment: CommentWithAuthor;
  prevComment?: CommentWithAuthor;
  currentUserId: string;
  onDelete?: (id: string) => Promise<void>;
  canDelete?: boolean;
}

const GROUP_GAP_MS = 5 * 60 * 1000; // 5 minutes = new group

export function CommentItem({
  comment,
  prevComment,
  currentUserId,
  onDelete,
  canDelete,
}: CommentItemProps) {
  const isOwn = comment.author_id === currentUserId;

  // Show header if: first message, different author, or >5 min gap from prev
  const isSameAuthor = prevComment?.author_id === comment.author_id;
  const timeDiff = prevComment
    ? new Date(comment.created_at).getTime() - new Date(prevComment.created_at).getTime()
    : Infinity;
  const showHeader = !prevComment || !isSameAuthor || timeDiff > GROUP_GAP_MS;

  // Add a date separator / gap when switching sides or new group
  const addTopMargin = !prevComment || !isSameAuthor || timeDiff > GROUP_GAP_MS;

  return (
    <div className={cn(addTopMargin ? "mt-4" : "mt-0.5")}>
      <CommentBubble
        comment={comment}
        isOwn={isOwn}
        showHeader={showHeader}
        onDelete={onDelete}
        canDelete={canDelete}
      />
    </div>
  );
}
