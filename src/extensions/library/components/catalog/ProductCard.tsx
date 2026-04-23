"use client";

import React from "react";
import Image from "next/image";
import { MoreHorizontal, ExternalLink, Edit2, Trash2, ArrowRight } from "lucide-react";
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
  const imageUrl = product.catalog_image_url || "/placeholders/material-placeholder.jpg";
  const brand = product.vendor?.brand_name || product.catalog_brand || "Generic";
  const productName = product.catalog_product_name || "Unnamed Product";
  const sku = product.catalog_sku;
  const category = product.catalog_category;

  return (
    <div 
      className={cn(
        "group relative bg-white border border-slate-100 overflow-hidden transition-all duration-500 hover:shadow-[0_40px_80px_rgba(0,0,0,0.06)] hover:-translate-y-2 cursor-pointer",
        UI_ENGINE_RADIUS_CARD
      )}
      onClick={() => onClick?.(product)}
    >
      {/* Image Container - Aspect 1:1 for Premium Window Shopping */}
      <div className="aspect-square relative overflow-hidden bg-slate-50">
        <Image
          src={imageUrl}
          alt={productName}
          fill
          className="object-cover transition-transform duration-1000 group-hover:scale-110"
        />
        
        {/* Overlay Badges */}
        <div className="absolute top-5 left-5 flex flex-wrap gap-2">
          <Badge className={cn("bg-white/90 backdrop-blur-md text-slate-900 border-none font-inter font-black px-3 py-1.5 shadow-sm uppercase tracking-[0.1em]", UI_ENGINE_TYPE_META, UI_ENGINE_RADIUS_ACTION)}>
            {category}
          </Badge>
          {product.physical_samples && product.physical_samples.length > 0 && (
            <Badge className={cn("bg-teal-500/90 backdrop-blur-md text-white border-none font-inter font-black px-3 py-1.5 shadow-sm uppercase tracking-[0.1em]", UI_ENGINE_TYPE_META, UI_ENGINE_RADIUS_ACTION)}>
               Sample Available
            </Badge>
          )}
        </div>

        {/* Action Overlay */}
        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
           <div className={cn("h-14 w-14 bg-white flex items-center justify-center text-slate-900 shadow-2xl scale-50 group-hover:scale-100 transition-transform duration-500", UI_ENGINE_RADIUS_ACTION)}>
              <ArrowRight className="h-6 w-6" />
           </div>
        </div>
      </div>

      {/* Info Content */}
      <div className="p-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={cn("font-black uppercase tracking-[0.25em] text-slate-400 font-inter", UI_ENGINE_TYPE_META)}>
              {brand}
            </span>
            <div onClick={(e) => e.stopPropagation()}>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-50">
                      <MoreHorizontal className="h-4 w-4 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={cn("w-48 p-2 border-slate-100 shadow-2xl font-inter bg-white", UI_ENGINE_RADIUS_CONTROL)}>
                    <DropdownMenuItem onClick={() => onEdit?.(product)} className={cn("py-2.5 focus:bg-slate-50", UI_ENGINE_RADIUS_CONTROL)}>
                      <Edit2 className="h-4 w-4 mr-2 text-slate-400" />
                      Quick Edit
                    </DropdownMenuItem>
                    {product.catalog_reference_url && (
                      <DropdownMenuItem onClick={() => window.open(product.catalog_reference_url!, '_blank')} className={cn("py-2.5 focus:bg-slate-50", UI_ENGINE_RADIUS_CONTROL)}>
                        <ExternalLink className="h-4 w-4 mr-2 text-slate-400" />
                        Source Link
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onDelete?.(product.id)} className={cn("py-2.5 text-red-600 focus:bg-red-50 focus:text-red-700", UI_ENGINE_RADIUS_CONTROL)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Item
                    </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
          </div>
          
          <h3 className="font-lora text-xl font-medium text-slate-900 leading-tight group-hover:text-slate-800 transition-colors">
            {productName}
          </h3>
          
          <div className="flex items-center gap-2 mt-1">
             <span className={cn("font-bold text-slate-300 font-inter tracking-wider", UI_ENGINE_TYPE_META)}>{sku}</span>
             <span className="h-1 w-1 rounded-full bg-slate-200" />
             <span className={cn("text-slate-500 font-inter opacity-80", UI_ENGINE_TYPE_META)}>
                {product.catalog_finishing || "Standard Finish"}
             </span>
          </div>
        </div>
        
        {/* Footer Meta */}
        <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
           <div className="flex flex-col">
              <span className={cn("font-black text-slate-400 uppercase tracking-widest leading-none", UI_ENGINE_TYPE_META)}>Est. Price</span>
              <span className={cn("font-bold text-slate-900 mt-1 font-inter", UI_ENGINE_TYPE_BODY)}>
                {product.catalog_price ? `IDR ${product.catalog_price.toLocaleString()}` : "Price on Request"}
              </span>
           </div>
           
           <Button 
            variant="ghost" 
            size="sm" 
            className={cn("text-slate-400 font-black uppercase tracking-widest hover:text-slate-900", UI_ENGINE_TYPE_META, UI_ENGINE_RADIUS_ACTION)}
            onClick={(e) => {
              e.stopPropagation();
              onAddToSchedule?.(product);
            }}
           >
              Add to Schedule
           </Button>
        </div>
      </div>
    </div>
  );
}
