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
  activatePhase
} from "@/app/actions";
import { Loader2, CheckCircle2, XCircle, Unlock, Send, Play } from "lucide-react";
import { Role } from "@/generated/prisma";

interface PhaseActionsProps {
  phaseId: string;
  status: string;
  isLocked: boolean;
  nameEnum: string;
  userId: string;
  userRole: Role;
  canMutate: boolean;
  isReadyToStart: boolean;
}

export function PhaseActions({
  phaseId,
  status,
  isLocked,
  nameEnum,
  userId,
  userRole,
  canMutate,
  isReadyToStart,
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
            onClick={() => handleAction("Reopen", () => reopenPhase(phaseId, userId, userRole))}
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
        <Button
          onClick={() => handleAction("Activate", () => activatePhase(phaseId, userId, userRole))}
          disabled={loading !== null}
          className="bg-amber-600 hover:bg-amber-700 text-white font-sans font-medium px-5"
        >
          {loading === "Activate" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
          Start Phase
        </Button>
      )}

      {status === "IN_PROGRESS" && nameEnum !== "SUPERVISION" && (
        <Button
          onClick={() => handleAction("Submit Internal", () => submitForInternalReview(phaseId, userId, userRole))}
          disabled={loading !== null}
          className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-medium px-5"
        >
          {loading === "Submit Internal" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          Submit for Internal Review
        </Button>
      )}

      {status === "IN_PROGRESS" && nameEnum === "SUPERVISION" && (
        <Button
          onClick={() => handleAction("Complete", () => completeSupervisionPhase(phaseId, userId, userRole))}
          disabled={loading !== null}
          className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-medium px-5"
        >
          {loading === "Complete" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Complete Project
        </Button>
      )}

      {status === "ON_REVIEW_INTERNAL" && (
        <>
          <Button
            variant="outline"
            onClick={() => handleAction("Reject Internal", () => rejectPhase(phaseId, "INTERNAL", userId, userRole))}
            disabled={loading !== null}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-sans font-medium px-5"
          >
            {loading === "Reject Internal" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
            Reject (Internal)
          </Button>
          <Button
            onClick={() => handleAction("Approve Internal", () => approveInternal(phaseId, userId, userRole))}
            disabled={loading !== null}
            className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-medium px-5"
          >
            {loading === "Approve Internal" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Approve Internal
          </Button>
        </>
      )}

      {status === "APPROVED_INTERNAL" && (
        <Button
          onClick={() => handleAction("Submit Client", () => submitForClientReview(phaseId, userId, userRole))}
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
            onClick={() => handleAction("Reject Client", () => rejectPhase(phaseId, "CLIENT", userId, userRole))}
            disabled={loading !== null}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-sans font-medium px-5"
          >
            {loading === "Reject Client" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
            Reject (Client)
          </Button>
          <Button
            onClick={() => handleAction("Approve Client", () => approveClientPhase(phaseId, userId, userRole))}
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
