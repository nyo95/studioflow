"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Pencil, 
  Trash2, 
  Loader2,
  ExternalLink,
  Image as ImageIcon,
  Check,
  X,
  MoreHorizontal
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MaterialCatalogWithRelations } from "../types";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MaterialTableProps {
  materials: MaterialCatalogWithRelations[];
  onEdit: (material: MaterialCatalogWithRelations) => void;
  onDelete?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  userRole: string;
  isReviewMode?: boolean;
}

export function MaterialTable({ materials, onEdit, onDelete, onApprove, onReject, userRole, isReviewMode }: MaterialTableProps) {
  const [selectedImage, setSelectedImage] = React.useState<{ src: string; alt: string; } | undefined>(undefined);

  if (materials.length === 0) {
    return (
      <div className="py-24 text-center animate-in fade-in duration-500">
        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
          <ImageIcon className="h-6 w-6 text-slate-200" />
        </div>
        <h3 className="font-serif text-lg text-slate-900 mb-1">No items found</h3>
        <p className="text-sm text-slate-400 font-sans">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 h-12">
            <TableHead className="w-[80px] font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400 pl-6">Image</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400">Product Info</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400">Vendor</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400">Category</TableHead>
            {!isReviewMode && <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400">Price</TableHead>}
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400">Status</TableHead>
            <TableHead className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400 text-right pr-6">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((m) => (
            <TableRow key={m.id} className="hover:bg-slate-50/30 group transition-colors border-slate-50 h-16">
              <TableCell className="pl-6">
                {m.cover_url ? (
                  <button 
                    onClick={() => setSelectedImage({ 
                        src: m.original_url || m.cover_url!, 
                        alt: m.product_type 
                    })}
                    className="relative h-10 w-10 rounded-md overflow-hidden bg-slate-100 group/img focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <img 
                      src={m.cover_url} 
                      alt={m.product_type} 
                      className="h-full w-full object-cover transition-transform group-hover/img:scale-110" 
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 flex items-center justify-center transition-colors">
                      <ImageIcon className="h-3 w-3 text-white opacity-0 group-hover/img:opacity-100" />
                    </div>
                  </button>
                ) : (
                  <div className="h-10 w-10 rounded-md bg-slate-50 flex items-center justify-center border border-dashed border-slate-200">
                    <ImageIcon className="h-4 w-4 text-slate-200" />
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="font-serif font-medium text-slate-900 text-sm">{m.product_type}</span>
                  <span className="text-[10px] text-slate-400 font-sans font-medium truncate max-w-[150px]">
                    {m.motif_or_color || "No Variant"} {m.finishing ? `Â· ${m.finishing}` : ""}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-xs font-sans font-semibold text-slate-600">
                  {m.vendor.brand_name}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-black uppercase tracking-tight text-slate-900 font-sans">{m.category}</span>
                  {m.sub_category && <span className="text-[9px] text-slate-400 font-sans">{m.sub_category}</span>}
                </div>
              </TableCell>
              {(!isReviewMode) && (
                  <TableCell>
                    <span className="text-xs font-sans font-bold text-slate-900">
                      {m.price ? `Rp ${m.price.toLocaleString()}` : "-"}
                    </span>
                  </TableCell>
              )}
              <TableCell>
                <Badge 
                  variant="outline"
                  className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0 border-none ${
                    m.status === 'APPROVED' 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'bg-orange-50 text-orange-700'
                  }`}
                >
                  {m.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right pr-6">
                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {m.original_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900"
                    >
                      <a href={m.original_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {userRole === "ADMIN" || userRole === "STAFF" ? (
                    isReviewMode ? (
                      <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-4 duration-500">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => onApprove?.(m.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => onReject?.(m.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem className="cursor-pointer text-xs font-medium py-2" onClick={() => onEdit(m)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(m)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {onDelete && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(m.id)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                    )
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ImageLightbox 
        src={selectedImage?.src || null} 
        alt={selectedImage?.alt}
        onClose={() => setSelectedImage(undefined)} 
      />
    </div>
  );
}

