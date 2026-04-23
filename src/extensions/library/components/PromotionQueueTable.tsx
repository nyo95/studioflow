"use client";

import * as React from "react";
import { Check, X, Clock, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { reviewPromotionRequestAction } from "@/extensions/library/actions/library-actions";
import { cn } from "@/lib/utils";
import { 
  UI_ENGINE_RADIUS_CARD, 
  UI_ENGINE_RADIUS_CONTROL, 
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_TYPE_META
} from "@/ui_engine";

interface PromotionRequest {
  id: string;
  project_id: string;
  schedule_option_id: string;
  requested_by_id: string;
  status: string;
  snapshot_data: any;
  notes: string | null;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
  schedule_option?: any;
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

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className={cn("h-16 w-16 bg-slate-100 flex items-center justify-center mb-6", UI_ENGINE_RADIUS_CARD)}>
          <Clock className="h-8 w-8 text-slate-300" />
        </div>
        <h3 className="font-lora text-lg font-medium text-slate-900 mb-2">No Pending Requests</h3>
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
            <h2 className="font-lora text-xl font-medium text-slate-900">Pending Review</h2>
            <Badge variant="outline" className={cn("font-inter", UI_ENGINE_TYPE_META)}>
              {pendingRequests.length}
            </Badge>
          </div>

          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className={cn("bg-white border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow", UI_ENGINE_RADIUS_CARD)}
              >
                <div className="p-6 flex items-start gap-6">
                  {req.snapshot_data?.catalog_image_url && (
                    <div className={cn("w-20 h-20 overflow-hidden bg-slate-50 flex-shrink-0", UI_ENGINE_RADIUS_CARD)}>
                      <img
                        src={req.snapshot_data.catalog_image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-lora text-lg font-medium text-slate-900 truncate">
                          {req.snapshot_data?.catalog_product_name || "Untitled Product"}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <span className="font-medium text-slate-600">
                            {req.snapshot_data?.catalog_brand || "No Brand"}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-200" />
                          <span>{req.snapshot_data?.catalog_category || "Uncategorized"}</span>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(req)}
                            className={cn("h-10 w-10 p-0 border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50", UI_ENGINE_RADIUS_CONTROL)}
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
                        <span>{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {req.notes && (
                      <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
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
            <h2 className="font-lora text-lg font-medium text-slate-400">Processed</h2>
            <Badge variant="ghost" className="font-inter text-[10px]">
              {processedRequests.length}
            </Badge>
          </div>

          <div className="space-y-2">
            {processedRequests.map((req) => (
              <div
                key={req.id}
                className={cn(
                  "flex items-center gap-4 p-4 border border-slate-100 transition-all",
                  UI_ENGINE_RADIUS_CONTROL,
                  req.status === "APPROVED" ? "bg-emerald-50/50" : "bg-slate-50/50"
                )}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "font-inter",
                    UI_ENGINE_TYPE_META,
                    req.status === "APPROVED"
                      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                      : "border-slate-200 bg-slate-100 text-slate-500"
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
                  {req.reviewed_by?.name || "Unknown"} • {new Date(req.reviewed_at || "").toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}