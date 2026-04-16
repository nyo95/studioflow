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
  Activity,
  PhaseHeartbeatChecklistItem,
  PhaseHeartbeatSnapshot,
} from "@/lib/phase-heartbeat";
interface PhaseLiveContextValue extends PhaseHeartbeatSnapshot {
  activities: Activity[];
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

  const syncNow = useCallback(async () => {
    const response = await fetch(`/api/phases/${phaseId}/heartbeat`, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("FAILED_TO_FETCH_PHASE_HEARTBEAT - syncNow", response.status);
      return;
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
          console.warn("FAILED_TO_FETCH_PHASE_HEARTBEAT - poll", response.status);
          return;
        }

        const nextSnapshot = (await response.json()) as PhaseHeartbeatSnapshot;
        if (isActive) {
          setSnapshot((current) => {
            // Simple reconciliation: only update if something actually changed
            // This also helps avoid overwriting optimistic updates if they are already in the new snapshot
            const hasChanged = JSON.stringify(current) !== JSON.stringify(nextSnapshot);
            return hasChanged ? nextSnapshot : current;
          });
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
      checklistItems: snapshot.checklistItems,
      activities: snapshot.activities,
      toggleChecklistOptimistic,
      syncNow,
    }),
    [
      snapshot,
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

export type { Activity, PhaseHeartbeatChecklistItem, PhaseHeartbeatSnapshot };
