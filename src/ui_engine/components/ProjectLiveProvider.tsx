"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ProjectDiscussionSnapshot } from "@/types/common";
import { CommentWithAuthor } from "@/extensions/live-collaboration/types/comment";

interface ProjectLiveContextValue extends ProjectDiscussionSnapshot {
  addOptimisticComment: (comment: CommentWithAuthor) => void;
  replaceComment: (tempCommentId: string, comment: CommentWithAuthor) => void;
  removeComment: (commentId: string) => void;
  syncNow: () => Promise<void>;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const ProjectLiveContext = createContext<ProjectLiveContextValue | null>(null);

interface ProjectLiveProviderProps {
  projectId: string;
  initialSnapshot: ProjectDiscussionSnapshot;
  children: React.ReactNode;
}

export function ProjectLiveProvider({
  projectId,
  initialSnapshot,
  children,
}: ProjectLiveProviderProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(v => !v), []);

  const syncNow = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/heartbeat`, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("FAILED_TO_FETCH_PROJECT_HEARTBEAT - syncNow", response.status);
      return;
    }

    const nextSnapshot = (await response.json()) as ProjectDiscussionSnapshot;
    setSnapshot(nextSnapshot);
  }, [projectId]);

  useEffect(() => {
    let isActive = true;

    const poll = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/heartbeat`, {
          cache: "no-store",
        });

        if (!response.ok) {
          console.warn("FAILED_TO_FETCH_PROJECT_HEARTBEAT - poll", response.status);
          return;
        }

        const nextSnapshot = (await response.json()) as ProjectDiscussionSnapshot;
        if (isActive) {
          setSnapshot((current) => {
            const hasChanged = JSON.stringify(current) !== JSON.stringify(nextSnapshot);
            return hasChanged ? nextSnapshot : current;
          });
        }
      } catch (error) {
        console.error("Failed to fetch project heartbeat:", error);
      }
    };

    const intervalId = window.setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [projectId]);

  const addOptimisticComment = useCallback((comment: CommentWithAuthor) => {
    setSnapshot((current) => {
      if (current.comments.some((item) => item.id === comment.id)) {
        return current;
      }

      return {
        ...current,
        comments: [...current.comments, comment],
      };
    });
  }, []);

  const replaceComment = useCallback(
    (tempCommentId: string, comment: CommentWithAuthor) => {
      setSnapshot((current) => {
        const commentsWithoutTemp = current.comments.filter(
          (item) => item.id !== tempCommentId
        );

        if (commentsWithoutTemp.some((item) => item.id === comment.id)) {
          return {
            ...current,
            comments: commentsWithoutTemp,
          };
        }

        return {
          ...current,
          comments: [...commentsWithoutTemp, comment],
        };
      });
    },
    []
  );

  const removeComment = useCallback((commentId: string) => {
    setSnapshot((current) => ({
      ...current,
      comments: current.comments.filter((comment) => comment.id !== commentId),
    }));
  }, []);

  const value = useMemo<ProjectLiveContextValue>(
    () => ({
      comments: snapshot.comments,
      addOptimisticComment,
      replaceComment,
      removeComment,
      syncNow,
      isSidebarOpen,
      toggleSidebar,
    }),
    [
      snapshot,
      addOptimisticComment,
      replaceComment,
      removeComment,
      syncNow,
      isSidebarOpen,
      toggleSidebar,
    ]
  );

  return (
    <ProjectLiveContext.Provider value={value}>
      {children}
    </ProjectLiveContext.Provider>
  );
}

export function useProjectLive() {
  const context = useContext(ProjectLiveContext);

  if (!context) {
    throw new Error("useProjectLive must be used within a ProjectLiveProvider.");
  }

  return context;
}
