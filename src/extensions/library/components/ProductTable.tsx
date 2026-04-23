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
import { ProductCatalogWithRelations } from "../types";
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
import { 
  UI_ENGINE_RADIUS_CARD, 
  UI_ENGINE_RADIUS_CONTROL, 
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_TYPE_META
} from "@/ui_engine";
import { cn } from "@/lib/utils";

interface ProductTableProps {
  products: ProductCatalogWithRelations[];
  onEdit: (product: ProductCatalogWithRelations) => void;
  onDelete?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  userRole: string;
  isQueueMode?: boolean;
}

export function ProductTable({ products, onEdit, onDelete, onApprove, onReject, userRole, isQueueMode }: ProductTableProps) {
  const [selectedImage, setSelectedImage] = React.useState<{ src: string; alt: string; } | undefined>(undefined);

  if (products.length === 0) {
    return (
      <div className="py-24 text-center animate-in fade-in duration-500">
        <div className={cn("h-16 w-16 bg-slate-50 flex items-center justify-center mx-auto mb-4", UI_ENGINE_RADIUS_ACTION)}>
          <ImageIcon className="h-6 w-6 text-slate-200" />
        </div>
        <h3 className="font-lora text-lg text-slate-900 mb-1">No items found</h3>
        <p className="text-sm text-slate-400 font-inter">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className={cn("border border-slate-100 bg-white overflow-hidden shadow-sm", UI_ENGINE_RADIUS_CARD)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 h-12">
            <TableHead className={cn("w-[80px] font-inter font-bold uppercase tracking-wider text-slate-400 pl-6", UI_ENGINE_TYPE_META)}>Image</TableHead>
            <TableHead className={cn("font-inter font-bold uppercase tracking-wider text-slate-400", UI_ENGINE_TYPE_META)}>Product Info</TableHead>
            <TableHead className={cn("font-inter font-bold uppercase tracking-wider text-slate-400", UI_ENGINE_TYPE_META)}>Vendor</TableHead>
            <TableHead className={cn("font-inter font-bold uppercase tracking-wider text-slate-400", UI_ENGINE_TYPE_META)}>Category</TableHead>
            {!isQueueMode && <TableHead className={cn("font-inter font-bold uppercase tracking-wider text-slate-400", UI_ENGINE_TYPE_META)}>Price</TableHead>}
            <TableHead className={cn("font-inter font-bold uppercase tracking-wider text-slate-400", UI_ENGINE_TYPE_META)}>Status</TableHead>
            <TableHead className={cn("font-inter font-bold uppercase tracking-wider text-slate-400 text-right pr-6", UI_ENGINE_TYPE_META)}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((m) => (
            <TableRow key={m.id} className="hover:bg-slate-50/30 group transition-colors border-slate-50 h-20">
              <TableCell className="pl-6">
                {m.catalog_image_url ? (
                  <button 
                    onClick={() => setSelectedImage({ 
                        src: m.catalog_image_original_url || m.catalog_image_url!, 
                        alt: m.catalog_sku 
                    })}
                    className={cn("relative h-14 w-14 overflow-hidden bg-slate-100 group/img focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm border border-slate-200", UI_ENGINE_RADIUS_CONTROL)}
                  >
                    <img 
                      src={m.catalog_image_url} 
                      alt={m.catalog_sku} 
                      className="h-full w-full object-cover transition-transform group-hover/img:scale-110" 
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 flex items-center justify-center transition-colors">
                      <ImageIcon className="h-4 w-4 text-white opacity-0 group-hover/img:opacity-100" />
                    </div>
                  </button>
                ) : (
                  <div className={cn("h-14 w-14 bg-slate-50 flex items-center justify-center border border-dashed border-slate-200", UI_ENGINE_RADIUS_CONTROL)}>
                    <ImageIcon className="h-6 w-6 text-slate-200" />
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="font-lora font-semibold text-slate-900 text-[13px]">
                    {m.catalog_sku} - {m.catalog_product_name || m.catalog_motif || 'Item'} ex. {m.catalog_brand || m.vendor.brand_name}
                  </span>
                  <span className={cn("text-slate-400 font-inter font-medium truncate max-w-[250px]", UI_ENGINE_TYPE_META)}>
                    {m.catalog_motif || "No Variant"} {m.catalog_finishing ? `· ${m.catalog_finishing}` : ""}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-xs font-inter font-semibold text-slate-600">
                  {m.catalog_brand || m.vendor.brand_name}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className={cn("font-black uppercase tracking-tight text-slate-900 font-inter", UI_ENGINE_TYPE_META)}>{m.catalog_category}</span>
                  {m.catalog_sub_category && <span className={cn("text-slate-400 font-inter", UI_ENGINE_TYPE_META)}>{m.catalog_sub_category}</span>}
                </div>
              </TableCell>
              {(!isQueueMode) && (
                  <TableCell>
                    <span className="text-xs font-inter font-bold text-slate-900">
                      {m.catalog_price ? `Rp ${m.catalog_price.toLocaleString()}` : "-"}
                    </span>
                  </TableCell>
              )}
              <TableCell>
                <Badge 
                  variant="outline"
                  className={cn("font-bold uppercase tracking-widest px-1.5 py-0 border-none", UI_ENGINE_TYPE_META, UI_ENGINE_RADIUS_CONTROL, 
                    m.status === 'APPROVED' 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'bg-orange-50 text-orange-700'
                  )}
                >
                  {m.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right pr-6">
                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {m.catalog_image_original_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900"
                    >
                      <a href={m.catalog_image_original_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {userRole === "ADMIN" || userRole === "STAFF" ? (
                    isQueueMode ? (
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
