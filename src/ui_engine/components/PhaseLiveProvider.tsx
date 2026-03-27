"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  PhaseHeartbeatChecklistItem,
  PhaseHeartbeatSnapshot,
} from "@/lib/phase-heartbeat";
import { CommentWithAuthor } from "@/extensions/live-collaboration/types/comment";

interface PhaseLiveContextValue extends PhaseHeartbeatSnapshot {
  addOptimisticComment: (comment: CommentWithAuthor) => void;
  replaceComment: (tempCommentId: string, comment: CommentWithAuthor) => void;
  removeComment: (commentId: string) => void;
  toggleChecklistOptimistic: (checklistId: string, isChecked: boolean) => void;
  syncNow: () => Promise<void>;
}

const PhaseLiveContext = createContext<PhaseLiveContextValue | null>(null);

interface PhaseLiveProviderProps {
  phaseId: string;
  initialSnapshot: PhaseHeartbeatSnapshot;
  children: React.ReactNode;
}

export function PhaseLiveProvider({
  phaseId,
  initialSnapshot,
  children,
}: PhaseLiveProviderProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const syncNow = useCallback(async () => {
    const response = await fetch(`/api/phases/${phaseId}/heartbeat`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("FAILED_TO_FETCH_PHASE_HEARTBEAT");
    }

    const nextSnapshot = (await response.json()) as PhaseHeartbeatSnapshot;
    setSnapshot(nextSnapshot);
  }, [phaseId]);

  useEffect(() => {
    let isActive = true;

    const poll = async () => {
      try {
        const response = await fetch(`/api/phases/${phaseId}/heartbeat`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("FAILED_TO_FETCH_PHASE_HEARTBEAT");
        }

        const nextSnapshot = (await response.json()) as PhaseHeartbeatSnapshot;
        if (isActive) {
          setSnapshot(nextSnapshot);
        }
      } catch (error) {
        console.error("Failed to fetch phase heartbeat:", error);
      }
    };

    const intervalId = window.setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [phaseId]);

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

  const toggleChecklistOptimistic = useCallback(
    (checklistId: string, isChecked: boolean) => {
      setSnapshot((current) => ({
        ...current,
        checklistItems: current.checklistItems.map((item) =>
          item.id === checklistId ? { ...item, is_checked: isChecked } : item
        ),
      }));
    },
    []
  );

  const value = useMemo<PhaseLiveContextValue>(
    () => ({
      comments: snapshot.comments,
      checklistItems: snapshot.checklistItems,
      addOptimisticComment,
      replaceComment,
      removeComment,
      toggleChecklistOptimistic,
      syncNow,
    }),
    [
      snapshot,
      addOptimisticComment,
      replaceComment,
      removeComment,
      toggleChecklistOptimistic,
      syncNow,
    ]
  );

  return (
    <PhaseLiveContext.Provider value={value}>
      {children}
    </PhaseLiveContext.Provider>
  );
}

export function usePhaseLive() {
  const context = useContext(PhaseLiveContext);

  if (!context) {
    throw new Error("usePhaseLive must be used within a PhaseLiveProvider.");
  }

  return context;
}

export type { PhaseHeartbeatChecklistItem, PhaseHeartbeatSnapshot };
