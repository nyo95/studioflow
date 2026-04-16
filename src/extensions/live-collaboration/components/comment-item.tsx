import { CommentWithAuthor } from "../types/comment";
import { Trash2 } from "lucide-react";
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
    <div className="group flex flex-col gap-1 border-l-2 border-slate-100 py-2 pl-4 transition-colors hover:border-slate-300">
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
      
      <p className="font-sans text-[12px] leading-relaxed text-slate-600">
        {comment.content}
      </p>
    </div>
  );
}

