"use client";

import * as React from "react";
import { Check, X, Clock, ChevronRight, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { reviewPromotionRequestAction } from "@/extensions/library/actions/library-actions";
import { cn } from "@/lib/utils";
import { VisualAsset } from "@/components/ui/visual-asset";
import { 
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_BORDER_SUBTLE,
  UI_ENGINE_RADIUS_CARD, 
  UI_ENGINE_RADIUS_CONTROL, 
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_TYPE_META
} from "@/ui_engine";

type PromotionSnapshot = {
  catalog_image_url?: string | null;
  catalog_product_name?: string | null;
  catalog_brand?: string | null;
  catalog_category?: string | null;
};

interface PromotionRequest {
  id: string;
  status: string;
  snapshot_data: PromotionSnapshot | null;
  notes?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
  project?: { id: string; name: string } | null;
  requested_by?: { id: string; name: string } | null;
  reviewed_by?: { id: string; name: string } | null;
}

interface PromotionQueueTableProps {
  requests: PromotionRequest[];
  userRole: string;
  onRefresh?: () => void;
}

export function PromotionQueueTable({ requests, userRole, onRefresh }: PromotionQueueTableProps) {
  const isAdmin = userRole === "ADMIN";

  const handleApprove = async (request: PromotionRequest) => {
    try {
      unwrapActionResult(await reviewPromotionRequestAction({ requestId: request.id, action: "APPROVED" }));
      toast.success("Promotion request approved");
      onRefresh?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    }
  };

  const handleReject = async (request: PromotionRequest) => {
    try {
      unwrapActionResult(await reviewPromotionRequestAction({ requestId: request.id, action: "REJECTED" }));
      toast.success("Promotion request rejected");
      onRefresh?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to reject");
    }
  };

  const pendingRequests = requests.filter(r => r.status === "PENDING");
  const processedRequests = requests.filter(r => r.status !== "PENDING");

  const [showHistory, setShowHistory] = React.useState(false);

  const now = React.useRef(Date.now()).current;

  const displayedProcessedRequests = React.useMemo(() => {
    if (!showHistory) return [];
    return processedRequests.filter(req => {
      if (!req.reviewed_at) return true; // Show if no date (fallback)
      const reviewDate = new Date(req.reviewed_at);
      const diffTime = Math.abs(now - reviewDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    });
  }, [processedRequests, showHistory, now]);

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className={cn("h-16 w-16 flex items-center justify-center mb-6", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
          <Clock className="h-8 w-8 text-slate-300" />
        </div>
        <h3 className="font-serif text-lg font-medium text-slate-900 mb-2">No Pending Requests</h3>
        <p className="text-sm text-slate-400 max-w-xs">
          Promotion requests from project schedules will appear here for admin review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {pendingRequests.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="font-serif text-xl font-medium text-slate-900">Pending Review</h2>
            <Badge variant="outline" className={cn("font-sans", UI_ENGINE_TYPE_META)}>
              {pendingRequests.length}
            </Badge>
          </div>

          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className={cn("bg-white border shadow-sm overflow-hidden hover:shadow-md transition-shadow", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}
              >
                <div className="p-6 flex items-start gap-6">
                  <div className={cn("w-20 h-20 overflow-hidden flex-shrink-0", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
                    <VisualAsset
                      src={req.snapshot_data?.catalog_image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-serif text-lg font-medium text-slate-900 truncate">
                          {req.snapshot_data?.catalog_product_name || "Untitled Product"}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <span className="font-medium text-slate-600">
                            {req.snapshot_data?.catalog_brand || "No Brand"}
                          </span>
                          <span className={cn("w-1 h-1 rounded-full", UI_ENGINE_BG_SUBTLE)} />
                          <span>{req.snapshot_data?.catalog_category || "Uncategorized"}</span>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(req)}
                            className={cn("h-10 w-10 p-0 border text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(req)}
                            className={cn("h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white shadow-sm", UI_ENGINE_RADIUS_CONTROL)}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-6 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-600">{req.project?.name || "Unknown Project"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>by {req.requested_by?.name || "Unknown User"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span>{req.created_at ? new Date(req.created_at).toLocaleDateString() : "Unknown date"}</span>
                      </div>
                    </div>

                    {req.notes && (
                      <p className={cn("mt-3 text-xs text-slate-500 p-3", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                        {req.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {processedRequests.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="font-serif text-lg font-medium text-slate-400">Processed</h2>
            <Badge variant="ghost" className="font-sans text-[10px]">
              {processedRequests.length}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className={cn("ml-auto text-[10px] h-7 px-2 uppercase tracking-wider font-bold", UI_ENGINE_RADIUS_CONTROL)}
            >
              {showHistory ? "Hide History" : "Show History"}
            </Button>
          </div>

          <div className="space-y-2">
            {displayedProcessedRequests.map((req) => (
              <div
                key={req.id}
                className={cn(
                  "flex items-center gap-4 p-4 border transition-all",
                  UI_ENGINE_RADIUS_CONTROL,
                  UI_ENGINE_BORDER_SUBTLE,
                  req.status === "APPROVED" ? "bg-emerald-50/50" : UI_ENGINE_BG_SUBTLE
                )}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "font-sans",
                    UI_ENGINE_TYPE_META,
                    req.status === "APPROVED"
                      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                      : cn("border text-slate-500", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_BG_SUBTLE)
                  )}
                >
                  {req.status === "APPROVED" ? "Approved" : "Rejected"}
                </Badge>

                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-600 truncate block">
                    {req.snapshot_data?.catalog_product_name || "Untitled"}
                  </span>
                </div>

                <div className="text-xs text-slate-400">
                  {req.reviewed_by?.name || "Unknown"} • {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : "Unknown date"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
