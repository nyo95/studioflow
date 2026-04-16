"use client";

import * as React from "react";
import { MaterialRequestStatus } from "@/generated/prisma";
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
import { ProjectMaterialRequestWithDetails } from "../types";
import { updateMaterialRequestStatusAction, deleteProjectMaterialRequestAction } from "../actions/library-actions";
import { unwrapActionResult } from "@/lib/result";
import { toast } from "sonner";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface MaterialRequestTableProps {
  requests: ProjectMaterialRequestWithDetails[];
  userRole: string;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<MaterialRequestStatus, { label: string; color: string; icon: LucideIcon }> = {
  REQUESTED: { label: "Requested", color: "bg-blue-50 text-blue-700 border-blue-100", icon: ArrowRightCircle },
  ORDERED: { label: "Ordered", color: "bg-amber-50 text-amber-700 border-amber-100", icon: History },
  SHIPPED: { label: "Shipped", color: "bg-purple-50 text-purple-700 border-purple-100", icon: Box },
  RECEIVED: { label: "Received", color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2 },
  UNAVAILABLE: { label: "Unavailable", color: "bg-rose-50 text-rose-700 border-rose-100", icon: AlertCircle },
  CANCELLED: { label: "Cancelled", color: "bg-slate-100 text-slate-700 border-slate-200", icon: AlertCircle },
};

export function MaterialRequestTable({ requests, userRole, onRefresh }: MaterialRequestTableProps) {
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  async function handleStatusUpdate(id: string, newStatus: MaterialRequestStatus) {
    setUpdatingId(id);
    try {
      unwrapActionResult(await updateMaterialRequestStatusAction({ id, status: newStatus }));
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
      unwrapActionResult(await deleteProjectMaterialRequestAction({ id }));
      toast.success("Request deleted");
      onRefresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete request");
    } finally {
      setUpdatingId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <div className="py-24 text-center animate-in fade-in duration-500">
        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
          <Box className="h-6 w-6 text-slate-200" />
        </div>
        <h3 className="font-serif text-lg text-slate-900 mb-1">No requests active</h3>
        <p className="text-sm text-slate-400 font-sans font-medium tracking-tight">Project material requests will appear here for review.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 h-14">
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400 pl-6">Project Context</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400">Material Requested</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400">Requestor</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400">Spec Status</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400 text-right pr-6">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((req) => {
            const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.REQUESTED;
            const StatusIcon = config.icon;
            const mat = req.material;

            return (
              <TableRow key={req.id} className="hover:bg-slate-50/30 group transition-colors border-slate-50 min-h-[70px]">
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
                    <div className="h-10 w-10 rounded-md bg-slate-50 overflow-hidden flex-shrink-0 border border-slate-100">
                      {mat?.cover_url ? (
                        <img src={mat.cover_url} alt={mat.product_type} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-200">
                          <Box className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-serif font-medium text-slate-900 text-xs">
                        {mat?.product_type || req.custom_material_name || "Custom Material"}
                        {!mat && <Badge className="ml-2 bg-amber-50 text-amber-600 border-none text-[8px] h-4 px-1">Manual</Badge>}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans uppercase tracking-widest font-bold">
                        {mat?.vendor?.brand_name || "Custom Source"}
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
                          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                          disabled={updatingId === req.id}
                        >
                          {updatingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[180px] rounded-xl shadow-2xl border-slate-100 p-2 font-sans bg-white">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black px-2 py-2">Set Status</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-slate-50" />
                        {(Object.keys(STATUS_CONFIG) as MaterialRequestStatus[]).map((status) => (
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
                            <DropdownMenuSeparator className="bg-slate-50" />
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

