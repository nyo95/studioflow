"use client";

import { useTransition, useRef, useEffect, useMemo, useState } from "react";
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
import { useHasMounted } from "@/hooks/use-hydration";
import { useAppConfirm } from "@/hooks/use-app-confirm";

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
  const hasMounted = useHasMounted();
  const { comments, addOptimisticComment, replaceComment, removeComment, syncNow, isSidebarOpen, toggleSidebar } =
    useProjectLive();
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [lastReadAt, setLastReadAt] = useState<string>("");
  const previousCommentIdsRef = useRef<string[] | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isAudioUnlockedRef = useRef(false);
  const appConfirm = useAppConfirm();

  const sidebarRef = useRef<HTMLDivElement>(null);
  const storageKey = useMemo(
    () => `project-discussion-last-read:${projectId}:${currentUserId}`,
    [currentUserId, projectId]
  );

  const latestCommentTimestamp = useMemo(() => {
    const latestComment = comments[comments.length - 1];
    return latestComment ? new Date(latestComment.created_at).toISOString() : "";
  }, [comments]);

  const unreadCount = useMemo(() => {
    if (!lastReadAt) {
      return 0;
    }

    const lastReadTime = new Date(lastReadAt).getTime();
    if (Number.isNaN(lastReadTime)) {
      return 0;
    }

    return comments.filter((comment) => {
      if (comment.author_id === currentUserId) {
        return false;
      }

      return new Date(comment.created_at).getTime() > lastReadTime;
    }).length;
  }, [comments, currentUserId, lastReadAt]);

  const persistLastReadAt = React.useCallback(
    (value: string) => {
      setLastReadAt(value);
      if (!hasMounted) {
        return;
      }

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
      } catch (error) {
        console.error("Failed to persist discussion read state:", error);
      }
    },
    [hasMounted, storageKey]
  );

  const markDiscussionAsRead = React.useCallback(() => {
    if (!latestCommentTimestamp) {
      return;
    }

    persistLastReadAt(latestCommentTimestamp);
  }, [latestCommentTimestamp, persistLastReadAt]);

  const playNotificationSound = React.useCallback(() => {
    if (!hasMounted || !isAudioUnlockedRef.current) {
      return;
    }

    try {
      const AudioContextConstructor = window.AudioContext ?? (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

      if (!AudioContextConstructor) {
        return;
      }

      const context = audioContextRef.current ?? new AudioContextConstructor();
      audioContextRef.current = context;

      if (context.state === "suspended") {
        void context.resume().catch(() => undefined);
      }

      const now = context.currentTime;
      const masterGain = context.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      masterGain.connect(context.destination);

      const createTone = (frequency: number, startAt: number, duration: number) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

        oscillator.connect(gain);
        gain.connect(masterGain);

        oscillator.start(startAt);
        oscillator.stop(startAt + duration);
      };

      createTone(880, now, 0.22);
      createTone(659.25, now + 0.26, 0.3);
    } catch (error) {
      console.error("Failed to play discussion notification sound:", error);
    }
  }, [hasMounted]);

  const unlockNotificationSound = React.useCallback(() => {
    if (!hasMounted || isAudioUnlockedRef.current) {
      return;
    }

    try {
      const AudioContextConstructor = window.AudioContext ?? (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

      if (!AudioContextConstructor) {
        return;
      }

      const context = audioContextRef.current ?? new AudioContextConstructor();
      audioContextRef.current = context;

      const finalizeUnlock = () => {
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.00015, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.03);
        isAudioUnlockedRef.current = true;
      };

      if (context.state === "suspended") {
        void context.resume().then(finalizeUnlock).catch(() => undefined);
        return;
      }

      finalizeUnlock();
    } catch (error) {
      console.error("Failed to unlock discussion notification sound:", error);
    }
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(storageKey);
      if (storedValue) {
        setLastReadAt(JSON.parse(storedValue) as string);
        return;
      }
    } catch (error) {
      console.error("Failed to restore discussion read state:", error);
    }

    persistLastReadAt(latestCommentTimestamp || new Date().toISOString());
  }, [hasMounted, latestCommentTimestamp, persistLastReadAt, storageKey]);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    const handleInteraction = () => {
      unlockNotificationSound();
    };

    window.addEventListener("pointerdown", handleInteraction, { passive: true });
    window.addEventListener("keydown", handleInteraction);

    return () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [hasMounted, unlockNotificationSound]);

  useEffect(() => {
    if (scrollRef.current && isSidebarOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments, isSidebarOpen]);

  useEffect(() => {
    if (isSidebarOpen) {
      markDiscussionAsRead();
    }
  }, [comments, isSidebarOpen, markDiscussionAsRead]);

  useEffect(() => {
    const previousCommentIds = previousCommentIdsRef.current;
    const nextCommentIds = comments.map((comment) => comment.id);

    if (previousCommentIds === null) {
      previousCommentIdsRef.current = nextCommentIds;
      return;
    }

    const previousCommentIdSet = new Set(previousCommentIds);
    const incomingComments = comments.filter(
      (comment) =>
        !previousCommentIdSet.has(comment.id) && comment.author_id !== currentUserId
    );

    if (incomingComments.length > 0) {
      playNotificationSound();
    }

    previousCommentIdsRef.current = nextCommentIds;
  }, [comments, currentUserId, playNotificationSound]);

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

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
    if (!(await appConfirm.confirm({
      title: "Delete this message?",
      description: "This message will be permanently removed from the project discussion.",
      confirmLabel: "Delete message",
    }))) return;
    
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
      onClick={() => {
        unlockNotificationSound();
        toggleSidebar();
        if (!isSidebarOpen) {
          markDiscussionAsRead();
        }
      }}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-transform active:scale-95",
        isSidebarOpen && "hidden" // Hide when sidebar is open
      )}
      aria-label="Toggle project discussion"
      title="Toggle project discussion"
    >
      <MessageSquare className="h-6 w-6" aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold ring-2 ring-white">
          {unreadCount > 99 ? '99+' : unreadCount}
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
      } catch {
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
                  comments.map((comment, index) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      prevComment={comments[index - 1]}
                      currentUserId={currentUserId}
                      onDelete={handleDelete}
                      canDelete={comment.author_id === currentUserId || userRole === "ADMIN" || userRole === "DEVELOPER"}
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
      {appConfirm.dialog}
    </>
  );
}
