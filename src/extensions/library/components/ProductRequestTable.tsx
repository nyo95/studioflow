"use client";

import * as React from "react";
import { ProductRequestStatus } from "@/generated/prisma";
import type { LucideIcon } from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Loader2, 
  Box, 
  History, 
  MoreHorizontal,
  ArrowRightCircle,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectProductRequestWithDetails } from "../types";
import { updateProductRequestStatusAction, deleteProjectProductRequestAction } from "../actions/library-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { unwrapActionResult } from "@/lib/result";
import { getEffectiveTitle } from "../../schedule/lib/display-utils";
import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
import {
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_BORDER_SUBTLE,
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_RADIUS_CARD,
  UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface ProductRequestTableProps {
  requests: ProjectProductRequestWithDetails[];
  userRole: string;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<ProductRequestStatus, { label: string; color: string; icon: LucideIcon }> = {
  REQUESTED: { label: "Requested", color: "bg-slate-50 text-slate-900 border-slate-200", icon: ArrowRightCircle },
  IN_PROGRESS: { label: "In Progress", color: "bg-amber-50 text-amber-700 border-amber-100", icon: History },
  RECEIVED: { label: "Received", color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2 },
  UNAVAILABLE: { label: "Unavailable", color: "bg-rose-50 text-rose-700 border-rose-100", icon: AlertCircle },
};

export function ProductRequestTable({ requests, userRole, onRefresh }: ProductRequestTableProps) {
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);

  const now = React.useRef(Date.now()).current;

  const { activeRequests, displayedHistory } = React.useMemo(() => {
    const active = requests.filter(r => r.status === "REQUESTED" || r.status === "IN_PROGRESS");
    const history = requests.filter(r => r.status === "RECEIVED" || r.status === "UNAVAILABLE");
    
    const filteredHistory = history.filter(req => {
      const updateDate = new Date(req.updated_at);
      const diffTime = Math.abs(now - updateDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    });

    return { 
      activeRequests: active, 
      displayedHistory: showHistory ? filteredHistory : [] 
    };
  }, [requests, showHistory, now]);

  const allDisplayed = [...activeRequests, ...displayedHistory];

  async function handleStatusUpdate(id: string, newStatus: ProductRequestStatus) {
    setUpdatingId(id);
    try {
      unwrapActionResult(await updateProductRequestStatusAction({ id, status: newStatus }));
      toast.success(`Status updated to ${newStatus}`);
      onRefresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this request?")) return;
    setUpdatingId(id);
    try {
      unwrapActionResult(await deleteProjectProductRequestAction({ id }));
      toast.success("Request deleted");
      onRefresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete request");
    } finally {
      setUpdatingId(null);
    }
  }

  if (activeRequests.length === 0 && displayedHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in duration-500">
        <div className={cn("h-16 w-16 flex items-center justify-center mb-6", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
          <Box className="h-8 w-8 text-slate-200" />
        </div>
        <h3 className="font-serif text-lg font-medium text-slate-900 mb-2">No active requests</h3>
        <p className="text-sm text-slate-400 max-w-xs">
          Project product requests will appear here for review.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className={cn("mt-6 text-[10px] h-8 px-3 uppercase tracking-wider font-bold", UI_ENGINE_RADIUS_CONTROL)}
        >
          {showHistory ? "Hide History" : "Show History"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-lg font-medium text-slate-900">Material Requests</h2>
          <Badge variant="outline" className={cn("font-sans", UI_ENGINE_TYPE_META)}>
            {activeRequests.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className={cn("text-[10px] h-8 px-3 uppercase tracking-wider font-bold text-slate-400 hover:text-slate-900", UI_ENGINE_RADIUS_CONTROL)}
        >
          {showHistory ? "Hide History" : "Show History"}
        </Button>
      </div>

      <div className={cn("border bg-white overflow-hidden shadow-sm", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
      <Table>
        <TableHeader>
          <TableRow className={cn("hover:bg-transparent h-14 border-b", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE)}>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400 pl-6">Project Context</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400">Product Requested</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400">Requestor</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400">Spec Status</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400 text-right pr-6">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allDisplayed.map((req) => {
            const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.REQUESTED;
            const StatusIcon = config.icon;
            const mat = req.product_catalog;

            return (
              <TableRow key={req.id} className={cn("group transition-colors border-b min-h-[70px]", UI_ENGINE_BORDER_SUBTLE)}>
                <TableCell className="pl-6">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-sans font-bold text-slate-900 truncate max-w-[150px]">
                      {req.project.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" />
                      {req.area_location || "Universal"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 overflow-hidden flex-shrink-0 border", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                      {mat?.catalog_image_url ? (
                        <img src={mat.catalog_image_url} alt={mat.catalog_sku} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-200">
                          <Box className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {req.schedule_entry && (
                          <Badge variant="outline" className="h-4 px-1 text-[8px] font-black bg-slate-900 text-white border-none uppercase tracking-tighter">
                            {req.schedule_entry.schedule_prefix}-{req.schedule_entry.schedule_increment}
                          </Badge>
                        )}
                        <span className="font-serif font-medium text-slate-900 text-xs">
                          {mat ? (
                            mat.catalog_sku || mat.catalog_product_name
                          ) : req.schedule_option?.data_snapshot ? (
                            getEffectiveTitle(req.schedule_option.data_snapshot as unknown as ScheduleSnapshot)
                          ) : (
                            req.custom_product_name || "Custom Product"
                          )}
                          {!mat && <Badge className="ml-1.5 bg-amber-50 text-amber-600 border-none text-[8px] h-4 px-1">Manual</Badge>}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans uppercase tracking-widest font-bold">
                        {mat?.catalog_brand || mat?.vendor?.brand_name || (req.schedule_option?.data_snapshot as any)?.catalog_brand || "Custom Source"}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-slate-700 font-sans font-semibold text-xs">
                       <UserIcon className="h-3 w-3 text-slate-300" />
                       {req.requested_by.name}
                    </div>
                    <span className="text-[9px] text-slate-400 font-sans">
                      {new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(req.created_at))}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1.5">
                    <Badge className={`w-fit rounded-lg font-bold border-none ${config.color} px-2 py-0.5 text-[9px] uppercase tracking-widest flex items-center gap-1.5 shadow-none`}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {config.label}
                    </Badge>
                    {req.status === "RECEIVED" && (
                      <span className="text-[9px] text-emerald-600 font-bold font-sans ml-1">
                        By {req.staff_name_override || "Admin"}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex justify-end gap-1">
                    {req.reference_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900"
                        >
                          <a href={req.reference_url} target="_blank" rel="noopener noreferrer">
                            <LinkIcon className="h-4 w-4" />
                          </a>
                        </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={cn("h-8 w-8 p-0 text-slate-400 hover:text-slate-900 transition-colors", UI_ENGINE_RADIUS_CONTROL)}
                          disabled={updatingId === req.id}
                        >
                          {updatingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={cn("w-[180px] shadow-2xl p-2 font-sans bg-white", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black px-2 py-2">Set Status</DropdownMenuLabel>
                        <DropdownMenuSeparator className={cn(UI_ENGINE_BG_SUBTLE)} />
                        {(Object.keys(STATUS_CONFIG) as ProductRequestStatus[]).map((status) => (
                          <DropdownMenuItem 
                            key={status}
                            onClick={() => handleStatusUpdate(req.id, status)}
                            className="rounded-lg cursor-pointer focus:bg-slate-50 py-1.5"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[status].color.split(" ")[0]}`} />
                              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{STATUS_CONFIG[status].label}</span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                        {(userRole === "ADMIN" || userRole === "STAFF") && (
                          <>
                            <DropdownMenuSeparator className={cn(UI_ENGINE_BG_SUBTLE)} />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(req.id)}
                              className="rounded-lg cursor-pointer text-rose-500 focus:bg-rose-50 focus:text-rose-600 py-1.5 font-bold text-[11px]"
                            >
                               Delete Request
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

// Helper icons
function MapPin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
