"use client";

import { useTransition, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { HydrationGuard } from "@/ui_engine/components/HydrationGuard";
import { CommentWithAuthor } from "../types/comment";
import { createComment, deleteComment } from "../actions/comment-actions";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";
import { MessageSquare, X } from "lucide-react";
import { useProjectLive } from "@/ui_engine";
import { toast } from "sonner";

interface ProjectChatSidebarProps {
  projectId: string;
  currentUserId: string;
  currentUserName: string;
  userRole: string;
}

export function ProjectChatSidebar({ 
  projectId, 
  currentUserId,
  currentUserName,
  userRole 
}: ProjectChatSidebarProps) {
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { comments, addOptimisticComment, replaceComment, removeComment, syncNow, isSidebarOpen, toggleSidebar } =
    useProjectLive();

  useEffect(() => {
    if (scrollRef.current && isSidebarOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments, isSidebarOpen]);

  const handlePost = async (content: string) => {
    startTransition(async () => {
      const tempComment: CommentWithAuthor = {
        id: `temp-${Date.now()}`,
        content,
        author_id: currentUserId,
        project_id: projectId,
        phase_id: null,
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
        const savedComment = await createComment(projectId, content);
        replaceComment(tempComment.id, savedComment);
      } catch (error) {
        removeComment(tempComment.id);
        console.error("Failed to create comment:", error);
        toast.error(error instanceof Error ? error.message : "Failed to post comment");
      } finally {
        void syncNow().catch((error) => {
          console.error("Failed to sync live discussion after create:", error);
          toast.error("Failed to sync comments. Please retry.");
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
        await deleteComment(commentId, projectId);
      } catch (error) {
        if (deletedComment) {
          addOptimisticComment(deletedComment);
        }
        console.error("Failed to delete comment:", error);
        toast.error(error instanceof Error ? error.message : "Failed to delete comment");
      } finally {
        void syncNow().catch((error) => {
          console.error("Failed to sync live discussion after delete:", error);
          toast.error("Failed to sync comments. Please retry.");
        });
      }
    });
  };

  // Re-write the render logic to be safer
  const toggleButton = (
    <button 
      onClick={toggleSidebar}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-transform active:scale-95",
        isSidebarOpen && "hidden" // Hide when sidebar is open
      )}
    >
      <MessageSquare className="h-6 w-6" />
      {comments.length > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold ring-2 ring-white">
          {comments.length > 99 ? '99+' : comments.length}
        </span>
      )}
    </button>
  );

  return (
    <>
      {toggleButton}
      <HydrationGuard>
        {isSidebarOpen && (
          <aside className={cn(
            "fixed bottom-0 right-0 top-0 z-50 flex w-96 flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out translate-x-0"
          )}>
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <h2 className="font-serif text-sm font-bold tracking-wide text-slate-900">Project Discussion</h2>
              </div>
              <button 
                onClick={toggleSidebar}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex flex-1 flex-col overflow-hidden px-6 py-6 bg-slate-50/30">
              <div 
                ref={scrollRef}
                className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200"
              >
                {comments.length === 0 ? (
                  <div className="py-20 text-center">
                    <MessageSquare className="mx-auto mb-4 h-8 w-8 text-slate-300" />
                    <p className="font-sans text-sm text-slate-500">
                      No messages yet.<br />Start the project conversation.
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

              <div className="shrink-0 border-t border-slate-100 pt-5 mt-4">
                <CommentForm onPost={handlePost} isPending={isPending} />
              </div>
            </div>
          </aside>
        )}
      </HydrationGuard>
    </>
  );
}

