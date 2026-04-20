"use client";

import React from "react";
import Image from "next/image";
import { MoreHorizontal, ExternalLink, Heart, Plus, Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MaterialCatalogWithRelations } from "../../types";

interface MaterialCardProps {
  material: MaterialCatalogWithRelations;
  onEdit?: (material: MaterialCatalogWithRelations) => void;
  onDelete?: (id: string) => void;
  onAddToSchedule?: (material: MaterialCatalogWithRelations) => void;
}

export function MaterialCard({ 
  material, 
  onEdit, 
  onDelete,
  onAddToSchedule 
}: MaterialCardProps) {
  const imageUrl = material.catalog_image_url || "/placeholders/material-placeholder.jpg";
  const brand = material.vendor?.brand_name || material.catalog_brand || "Generic";
  const prductName = material.catalog_product_name || "Unnamed Material";
  const sku = material.catalog_sku;
  const category = material.catalog_category;

  return (
    <div className="group relative bg-white rounded-[2rem] border border-slate-100 overflow-hidden transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-1">
      {/* Image Container */}
      <div className="aspect-[4/3] relative overflow-hidden bg-slate-50">
        <Image
          src={imageUrl}
          alt={prductName}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Overlay Badges */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          <Badge className="bg-white/80 backdrop-blur-md text-slate-900 border-none font-inter text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wider">
            {category}
          </Badge>
          {material.physical_samples && material.physical_samples.length > 0 && (
            <Badge className="bg-teal-500/80 backdrop-blur-md text-white border-none font-inter text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wider">
               Sample In Stock
            </Badge>
          )}
        </div>

        {/* Hover Actions */}
        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
           
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40 border-none h-10 w-10">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl border-slate-100 shadow-2xl font-inter">
                <DropdownMenuItem onClick={() => onEdit?.(material)} className="rounded-xl py-2 focus:bg-slate-50">
                  <Edit2 className="h-4 w-4 mr-2 text-slate-400" />
                  Edit Details
                </DropdownMenuItem>
                {material.catalog_reference_url && (
                  <DropdownMenuItem onClick={() => window.open(material.catalog_reference_url!, '_blank')} className="rounded-xl py-2 focus:bg-slate-50">
                    <ExternalLink className="h-4 w-4 mr-2 text-slate-400" />
                    View Source
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onDelete?.(material.id)} className="rounded-xl py-2 text-red-600 focus:bg-red-50 focus:text-red-700">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Item
                </DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
        </div>
      </div>

      {/* Info Content */}
      <div className="p-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-inter">
              {brand}
            </span>
            <span className="text-[11px] font-bold text-slate-300 font-inter">{sku}</span>
          </div>
          <h3 className="font-lora text-lg font-medium text-slate-900 leading-tight line-clamp-1 group-hover:text-slate-700 transition-colors">
            {prductName}
          </h3>
          <p className="text-[11px] text-slate-500 font-inter line-clamp-1 mt-1 opacity-70">
            {material.catalog_sub_category || "No sub-category"} • {material.catalog_finishing || "Standard Finish"}
          </p>
        </div>
        
        {/* Footer Meta */}
        <div className="mt-5 pt-5 border-t border-slate-50 flex items-center justify-between">
           <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-none">Est. Price</span>
              <span className="text-sm font-bold text-slate-900 mt-1 font-inter">
                {material.catalog_price ? `IDR ${material.catalog_price.toLocaleString()}` : "Price on Request"}
              </span>
           </div>
           
           <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
              <ArrowRightCircle className="h-5 w-5 text-slate-200 group-hover:text-teal-600" />
           </div>
        </div>
      </div>
    </div>
  );
}

function ArrowRightCircle(props: any) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="m12 16 4-4-4-4" />
    </svg>
  );
}
