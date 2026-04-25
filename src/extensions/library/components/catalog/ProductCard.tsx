"use client";

import React from "react";
import Image from "next/image";
import { MoreHorizontal, ExternalLink, Edit2, Trash2, ArrowRight, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { 
  UI_ENGINE_RADIUS_CARD, 
  UI_ENGINE_RADIUS_CONTROL, 
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_TYPE_META,
  UI_ENGINE_TYPE_BODY
} from "@/ui_engine";
import type { ProductCatalogWithRelations } from "../../types";

interface ProductCardProps {
  product: ProductCatalogWithRelations;
  onEdit?: (product: ProductCatalogWithRelations) => void;
  onDelete?: (id: string) => void;
  onAddToSchedule?: (product: ProductCatalogWithRelations) => void;
  onClick?: (product: ProductCatalogWithRelations) => void;
}

export function ProductCard({ 
  product, 
  onEdit, 
  onDelete,
  onAddToSchedule,
  onClick
}: ProductCardProps) {
  const [imgError, setImgError] = React.useState(false);
  const imageUrl = (!product.catalog_image_url || imgError) 
    ? "/placeholders/material-placeholder.jpg" 
    : product.catalog_image_url;
    
  const brand = product.vendor?.brand_name || product.catalog_brand || "Generic";
  const productName = product.catalog_product_name || "Unnamed Product";
  const sku = product.catalog_sku;
  const category = product.catalog_category;

  return (
    <div 
      className={cn(
        "group relative bg-white border border-slate-100 overflow-hidden transition-all duration-500 hover:shadow-[0_40px_80px_rgba(0,0,0,0.06)] hover:-translate-y-1 cursor-pointer",
        UI_ENGINE_RADIUS_CARD
      )}
      onClick={() => onClick?.(product)}
    >
      {/* Image Container */}
      <div className="aspect-square relative overflow-hidden bg-slate-50 border-b border-slate-100 flex items-center justify-center">
        {imgError ? (
          <div className="flex flex-col items-center gap-2 opacity-20">
            <ImageIcon className="h-10 w-10 text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">No Preview</span>
          </div>
        ) : (
          <Image
            src={imageUrl}
            alt={productName}
            fill
            className="object-cover transition-transform duration-1000 group-hover:scale-105"
            onError={() => setImgError(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        )}
        
        {/* Overlay Badges */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          <Badge className={cn("bg-white/95 backdrop-blur-md text-slate-900 border-none font-inter font-black px-2.5 py-1 shadow-sm uppercase tracking-[0.1em] text-[9px]", UI_ENGINE_RADIUS_ACTION)}>
            {category}
          </Badge>
          {product.catalog_status !== "APPROVED" && (
            <Badge className={cn(
              "backdrop-blur-md border-none font-inter font-black px-2.5 py-1 shadow-sm uppercase tracking-[0.1em] text-[9px]",
              product.catalog_status === "PENDING" ? "bg-amber-500 text-white" : "bg-red-500 text-white",
              UI_ENGINE_RADIUS_ACTION
            )}>
              {product.catalog_status}
            </Badge>
          )}
        </div>

        {/* Action Overlay */}
        <div className="absolute inset-0 bg-slate-950/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[1px]">
           <div className={cn("h-10 w-10 bg-white flex items-center justify-center text-slate-900 shadow-xl scale-75 group-hover:scale-100 transition-transform duration-500", UI_ENGINE_RADIUS_ACTION)}>
              <ArrowRight className="h-5 w-5" />
           </div>
        </div>
      </div>

      {/* Info Content */}
      <div className="p-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className={cn("font-black uppercase tracking-[0.2em] text-slate-400 font-inter text-[9px]")}>
              {brand}
            </span>
            <div onClick={(e) => e.stopPropagation()}>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-50">
                      <MoreHorizontal className="h-3.5 w-3.5 text-slate-300" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={cn("w-48 p-1.5 border-slate-100 shadow-xl font-inter bg-white text-xs", UI_ENGINE_RADIUS_CONTROL)}>
                    <DropdownMenuItem onClick={() => onEdit?.(product)} className={cn("py-2 px-3 focus:bg-slate-50")}>
                      <Edit2 className="h-3.5 w-3.5 mr-2 text-slate-400" />
                      Manage Item
                    </DropdownMenuItem>
                    {product.catalog_reference_url && (
                      <DropdownMenuItem onClick={() => window.open(product.catalog_reference_url!, '_blank')} className={cn("py-2 px-3 focus:bg-slate-50")}>
                        <ExternalLink className="h-3.5 w-3.5 mr-2 text-slate-400" />
                        Source Link
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onDelete?.(product.id)} className={cn("py-2 px-3 text-red-600 focus:bg-red-50 focus:text-red-700")}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
          </div>
          
          <h3 className="font-lora text-lg font-medium text-slate-900 leading-tight">
            {productName}
          </h3>
          
          <div className="flex items-center gap-2 mt-0.5">
             <span className="font-bold text-slate-300 font-inter tracking-wider text-[10px]">{sku}</span>
             <span className="h-0.5 w-0.5 rounded-full bg-slate-200" />
             <span className="text-slate-400 font-inter text-[10px] italic">
                {product.catalog_finishing || "Standard"}
             </span>
          </div>
        </div>
      </div>
    </div>
  );
}
