"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { 
  submitForInternalReview,
  approveInternal,
  submitForClientReview,
  approveClientPhase, 
  rejectPhase, 
  reopenPhase,
  completeSupervisionPhase,
  activatePhase,
  bypassPhaseToCompleted
} from "@/actions/phase-actions";
import { Loader2, CheckCircle2, XCircle, Unlock, Send, Play, FastForward } from "lucide-react";
import { Role } from "@/generated/prisma";
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";

interface PhaseActionsProps {
  phaseId: string;
  status: string;
  isLocked: boolean;
  nameEnum: string;
  userId: string;
  userRole: Role;
  canMutate: boolean;
  isReadyToStart: boolean;
  hasHistory: boolean;
  hasOngoingTasks?: boolean;
}

export function PhaseActions({
  phaseId,
  status,
  isLocked,
  nameEnum,
  canMutate,
  isReadyToStart,
  hasHistory,
  hasOngoingTasks = false,
}: PhaseActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleAction = async (actionName: string, actionFn: () => Promise<unknown>) => {
    setLoading(actionName);
    try {
      await actionFn();
      toast.success(`${actionName} successful`);
      router.refresh();
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  };

  if (isLocked) {
    if (canMutate) {
      return (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("Reopen", async () => unwrapActionResult(await reopenPhase({ phaseId })))}
            disabled={loading !== null}
            className="border-zinc-200 text-slate-500 hover:text-slate-900 hover:bg-zinc-50 transition-all font-sans"
          >
            {loading === "Reopen" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Unlock className="w-3.5 h-3.5 mr-2" />}
            Reopen Phase
          </Button>
        </div>
      );
    }
    return null;
  }

  if (status === "READY_FOR_NEXT" || status === "COMPLETED" || !canMutate) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "PENDING" && canMutate && isReadyToStart && (
        <>
          <Button
            onClick={() => handleAction(
              hasHistory ? "Reopen" : "Activate", 
              async () => unwrapActionResult(
                hasHistory 
                  ? await reopenPhase({ phaseId }) 
                  : await activatePhase({ phaseId })
              )
            )}
            disabled={loading !== null}
            className={cn(
              "text-white font-sans font-medium px-5 transition-all",
              hasHistory ? "bg-slate-900 hover:bg-slate-800 shadow-md" : "bg-amber-600 hover:bg-amber-700"
            )}
          >
            {loading === "Activate" || loading === "Reopen" ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              hasHistory ? <Unlock className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />
            )}
            {hasHistory ? "Reopen Phase" : "Start Phase"}
          </Button>
          {!hasHistory && (
            <Button
              variant="outline"
              onClick={() => handleAction("Bypass to Completed", async () => unwrapActionResult(await bypassPhaseToCompleted({ phaseId })))}
              disabled={loading !== null}
              className="border-slate-200 text-slate-600 hover:bg-slate-100 font-sans font-medium px-5"
            >
              {loading === "Bypass to Completed" ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FastForward className="w-4 h-4 mr-2 text-slate-400" />
              )}
              Bypass to Completed
            </Button>
          )}
        </>
      )}

      {status === "IN_PROGRESS" && nameEnum !== "SUPERVISION" && (
        <>
          <Button
            onClick={() => handleAction("Submit Internal", async () => unwrapActionResult(await submitForInternalReview({ phaseId })))}
            disabled={loading !== null || hasOngoingTasks}
            className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-medium px-5"
            title={hasOngoingTasks ? "Complete all ongoing tasks first" : ""}
          >
            {loading === "Submit Internal" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Submit for Internal Review
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAction("Submit Client", async () => unwrapActionResult(await submitForClientReview({ phaseId })))}
            disabled={loading !== null || hasOngoingTasks}
            className="border-slate-200 font-sans font-medium px-5"
            title={hasOngoingTasks ? "Complete all ongoing tasks first" : ""}
          >
            {loading === "Submit Client" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Submit for Client Review
          </Button>
        </>
      )}

      {status === "IN_PROGRESS" && nameEnum === "SUPERVISION" && (
        <Button
          onClick={() => handleAction("Complete", async () => unwrapActionResult(await completeSupervisionPhase({ phaseId })))}
          disabled={loading !== null || hasOngoingTasks}
          className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-medium px-5"
          title={hasOngoingTasks ? "Complete all ongoing tasks first" : ""}
        >
          {loading === "Complete" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Complete Project
        </Button>
      )}

      {status === "ON_REVIEW_INTERNAL" && (
        <>
          <Button
            variant="outline"
            onClick={() => handleAction("Reject Internal", async () => unwrapActionResult(await rejectPhase({ phaseId, type: "INTERNAL" })))}
            disabled={loading !== null}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-sans font-medium px-5"
          >
            {loading === "Reject Internal" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
            Reject (Internal)
          </Button>
          <Button
            onClick={() => handleAction("Approve Internal", async () => unwrapActionResult(await approveInternal({ phaseId })))}
            disabled={loading !== null}
            className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-medium px-5"
          >
            {loading === "Approve Internal" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Approve Internal
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAction("Submit Client", async () => unwrapActionResult(await submitForClientReview({ phaseId })))}
            disabled={loading !== null}
            className="border-slate-200 font-sans font-medium px-5"
          >
            {loading === "Submit Client" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Send to Client in Parallel
          </Button>
        </>
      )}

      {status === "APPROVED_INTERNAL" && (
        <Button
          onClick={() => handleAction("Submit Client", async () => unwrapActionResult(await submitForClientReview({ phaseId })))}
          disabled={loading !== null}
          className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-medium px-5"
        >
          {loading === "Submit Client" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          Submit for Client Review
        </Button>
      )}

      {status === "ON_REVIEW_CLIENT" && (
        <>
          <Button
            variant="outline"
            onClick={() => handleAction("Reject Client", async () => unwrapActionResult(await rejectPhase({ phaseId, type: "CLIENT" })))}
            disabled={loading !== null}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-sans font-medium px-5"
          >
            {loading === "Reject Client" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
            Reject (Client)
          </Button>
          <Button
            onClick={() => handleAction("Approve Client", async () => unwrapActionResult(await approveClientPhase({ phaseId })))}
            disabled={loading !== null}
            className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-medium px-5"
          >
            {loading === "Approve Client" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Client Approved
          </Button>
        </>
      )}
    </div>
  );
}

