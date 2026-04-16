"use client";

import { useTransition, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SimpleCard, SimpleCardHeader, SimpleCardTitle, SimpleCardBody, UI_ENGINE_CANVAS_CLASS, Heading } from "@/ui_engine";
import { HydrationGuard } from "@/ui_engine/components/HydrationGuard";
import { CommentWithAuthor } from "../types/comment";
import { createComment, deleteComment } from "../actions/comment-actions";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";
import { MessageSquare } from "lucide-react";
import { useProjectLive } from "@/ui_engine";

interface DiscussionBoardProps {
  projectId: string;
  phaseId: string;
  currentUserId: string;
  currentUserName: string;
  userRole: string;
}

export function DiscussionBoard({ 
  projectId,
  phaseId, 
  currentUserId,
  currentUserName,
  userRole 
}: DiscussionBoardProps) {
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { comments, addOptimisticComment, replaceComment, removeComment, syncNow } =
    useProjectLive();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handlePost = async (content: string) => {
    startTransition(async () => {
      const tempComment: CommentWithAuthor = {
        id: `temp-${Date.now()}`,
        content,
        author_id: currentUserId,
        project_id: projectId,
        phase_id: phaseId,
        task_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        author: {
          id: currentUserId,
          name: currentUserName,
          email: "",
        },
      };

      addOptimisticComment(tempComment);

      try {
        const savedComment = await createComment(phaseId, content);
        replaceComment(tempComment.id, savedComment);
      } catch (error) {
        removeComment(tempComment.id);
        console.error("Failed to create comment:", error);
      } finally {
        void syncNow().catch((error) => {
          console.error("Failed to sync live discussion after create:", error);
        });
      }
    });
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    
    startTransition(async () => {
      const deletedComment = comments.find((comment) => comment.id === commentId);
      removeComment(commentId);

      try {
        await deleteComment(commentId, phaseId);
      } catch (error) {
        if (deletedComment) {
          addOptimisticComment(deletedComment);
        }
        console.error("Failed to delete comment:", error);
      } finally {
        void syncNow().catch((error) => {
          console.error("Failed to sync live discussion after delete:", error);
        });
      }
    });
  };

  return (
    <HydrationGuard>
      <SimpleCard className={cn(UI_ENGINE_CANVAS_CLASS, "flex h-[600px] flex-col")}>
        <SimpleCardHeader className="bg-slate-50/50 shrink-0 px-6">
          <Heading level={6} variant="uiMeta" className="flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Live Discussion
          </Heading>
        </SimpleCardHeader>
        
        <SimpleCardBody className="flex flex-1 flex-col overflow-hidden px-6 py-6">
          <div 
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200"
          >
            {comments.length === 0 ? (
              <div className="py-10 text-center">
                <p className="font-sans text-xs italic text-slate-400">
                  No messages yet. Start the conversation.
                </p>
              </div>
            ) : (
              comments.map((comment) => (
                <CommentItem 
                  key={comment.id} 
                  comment={comment} 
                  onDelete={handleDelete}
                  canDelete={comment.author_id === currentUserId || userRole === "ADMIN"}
                />
              ))
            )}
          </div>

          <div className="shrink-0 border-t border-slate-100 pt-6 mt-4">
            <CommentForm onPost={handlePost} isPending={isPending} />
          </div>
        </SimpleCardBody>
      </SimpleCard>
    </HydrationGuard>
  );
}
