"use client";

import { useTransition, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { HydrationGuard } from "@/ui_engine/components/HydrationGuard";
import { CommentWithAuthor } from "../types/comment";
import { createComment, deleteComment } from "../actions/comment-actions";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";
import { MessageSquare, X, Upload } from "lucide-react";
import React from "react";
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
  const [isDragOver, setIsDragOver] = React.useState(false);


  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && isSidebarOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments, isSidebarOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        // Find if we clicked the toggle button
        const isToggle = (event.target as HTMLElement).closest('button')?.contains((event.target as HTMLElement)) && 
                         (event.target as HTMLElement).closest('button')?.className.includes("fixed bottom-6 right-6");
        
        if (!isToggle) {
          toggleSidebar();
        }
      }
    };

    if (isSidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSidebarOpen, toggleSidebar]);

  // Removed transition/ref misuse


  const handlePost = async (content: string, attachmentIds?: string[]) => {
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
        temp_attachments: [], // Simplified for optimistic UI
      };

      addOptimisticComment(tempComment);

      try {
        const savedComment = await createComment(projectId, content, attachmentIds);
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
      aria-label="Toggle project discussion"
      title="Toggle project discussion"
    >
      <MessageSquare className="h-6 w-6" aria-hidden="true" />
      {comments.length > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold ring-2 ring-white">
          {comments.length > 99 ? '99+' : comments.length}
        </span>
      )}
    </button>
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Trigger the child CommentForm upload logic if possible, 
      // or implement local upload logic.
      // For now, I'll notify the user or try to find a way to pass this to the form.
      // A better way is to move the upload logic to a shared hook.
      toast.info("Uploading dropped files...");
      
      const file = files[0];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload/temp", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const attachment = await res.json();
        
        // This is tricky because the state is in CommentForm.
        // I'll emit a custom event or use an ID-based strategy.
        // For now, I'll just post a message with this attachment immediately if it's a quick drop,
        // OR better: use a singleton/context for the current comment being drafted.
        
        await handlePost(`Attached file: ${attachment.filename}`, [attachment.id]);
        toast.success("File uploaded and posted");
      } catch (error) {
        toast.error("Failed to upload dropped file");
      }
    }
  };

  return (
    <>
      {toggleButton}
      <HydrationGuard>
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/20 lg:hidden"
            onClick={toggleSidebar}
          />
        )}
        {isSidebarOpen && (
          <aside 
            ref={sidebarRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "fixed bottom-0 right-0 top-0 z-50 flex w-[min(100vw,24rem)] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out translate-x-0",
              isDragOver && "ring-4 ring-indigo-500 ring-inset"
            )}
          >
            {isDragOver && (
              <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-indigo-600/10 backdrop-blur-[2px] pointer-events-none">
                <div className="rounded-2xl bg-white p-6 shadow-xl border-2 border-dashed border-indigo-500 flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="font-serif text-sm font-bold text-slate-900">Drop to share media</p>
                </div>
              </div>
            )}
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
                aria-label="Close project discussion"
                title="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
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
