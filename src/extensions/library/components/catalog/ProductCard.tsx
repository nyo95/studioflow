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
      className="group relative bg-white rounded-[2rem] border border-slate-100 overflow-hidden transition-all duration-500 hover:shadow-[0_40px_80px_rgba(0,0,0,0.06)] hover:-translate-y-2 cursor-pointer"
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
          <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none font-inter text-[9px] font-black px-3 py-1.5 rounded-full shadow-sm uppercase tracking-[0.1em]">
            {category}
          </Badge>
          {product.physical_samples && product.physical_samples.length > 0 && (
            <Badge className="bg-teal-500/90 backdrop-blur-md text-white border-none font-inter text-[9px] font-black px-3 py-1.5 rounded-full shadow-sm uppercase tracking-[0.1em]">
               Sample Available
            </Badge>
          )}
        </div>

        {/* Action Overlay */}
        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
           <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center text-slate-900 shadow-2xl scale-50 group-hover:scale-100 transition-transform duration-500">
              <ArrowRight className="h-6 w-6" />
           </div>
        </div>
      </div>

      {/* Info Content */}
      <div className="p-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 font-inter">
              {brand}
            </span>
            <div onClick={(e) => e.stopPropagation()}>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-50">
                      <MoreHorizontal className="h-4 w-4 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl border-slate-100 shadow-2xl font-inter">
                    <DropdownMenuItem onClick={() => onEdit?.(product)} className="rounded-xl py-2.5 focus:bg-slate-50">
                      <Edit2 className="h-4 w-4 mr-2 text-slate-400" />
                      Quick Edit
                    </DropdownMenuItem>
                    {product.catalog_reference_url && (
                      <DropdownMenuItem onClick={() => window.open(product.catalog_reference_url!, '_blank')} className="rounded-xl py-2.5 focus:bg-slate-50">
                        <ExternalLink className="h-4 w-4 mr-2 text-slate-400" />
                        Source Link
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onDelete?.(product.id)} className="rounded-xl py-2.5 text-red-600 focus:bg-red-50 focus:text-red-700">
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
             <span className="text-[11px] font-bold text-slate-300 font-inter tracking-wider">{sku}</span>
             <span className="h-1 w-1 rounded-full bg-slate-200" />
             <span className="text-[11px] text-slate-500 font-inter opacity-80">
                {product.catalog_finishing || "Standard Finish"}
             </span>
          </div>
        </div>
        
        {/* Footer Meta */}
        <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Est. Price</span>
              <span className="text-sm font-bold text-slate-900 mt-1.5 font-inter">
                {product.catalog_price ? `IDR ${product.catalog_price.toLocaleString()}` : "Price on Request"}
              </span>
           </div>
           
           <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900"
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
