"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductCatalogWithRelations } from "../../types";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Tag, 
  Maximize2, 
  ExternalLink, 
  Warehouse, 
  Clock, 
  Edit3, 
  PackageCheck,
  ChevronRight,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LibraryFormModal } from "../LibraryFormModal";

interface ProductDetailModalProps {
  product: ProductCatalogWithRelations | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: string;
}

export function ProductDetailModal({
  product,
  isOpen,
  onOpenChange,
  userRole
}: ProductDetailModalProps) {
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  
  if (!product) return null;

  const isAdmin = userRole === "ADMIN";
  const imageUrl = product.catalog_image_url || "/placeholders/material-placeholder.jpg";
  const brandName = product.vendor?.brand_name || product.catalog_brand || "Generic Vendor";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden border-none rounded-[2.5rem] bg-white shadow-2xl">
          <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
            {/* Left: Image Showcase (60%) */}
            <div className="relative w-full md:w-[55%] aspect-square md:aspect-auto bg-slate-50 group">
              <Image
                src={imageUrl}
                alt={product.catalog_product_name || "Product"}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              
              <div className="absolute top-8 left-8 flex flex-col gap-3">
                 <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none font-inter text-[10px] font-black px-4 py-2 rounded-full shadow-lg uppercase tracking-widest">
                    {product.catalog_category}
                 </Badge>
              </div>

              <Button 
                variant="secondary" 
                size="icon" 
                className="absolute bottom-8 right-8 rounded-full bg-white/20 backdrop-blur-md border-none text-white hover:bg-white/40 h-12 w-12 shadow-xl"
                onClick={() => window.open(imageUrl, '_blank')}
              >
                <Maximize2 className="h-5 w-5" />
              </Button>
            </div>

            {/* Right: Content & Specs (40%) */}
            <div className="flex-1 flex flex-col p-10 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-slate-400">
                   <Building2 className="h-4 w-4" />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] font-inter">
                      {brandName}
                   </span>
                </div>
                {isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsEditModalOpen(true)}
                    className="rounded-full h-10 px-4 gap-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all font-inter text-[10px] font-bold uppercase tracking-widest"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Specs
                  </Button>
                )}
              </div>

              <h2 className="font-lora text-4xl font-medium text-slate-900 leading-[1.1] mb-2">
                {product.catalog_product_name}
              </h2>
              <p className="font-inter text-sm text-slate-500 mb-10 leading-relaxed max-w-sm">
                Part of the {product.catalog_sub_category} collection. Featuring premium {product.catalog_finishing} finish.
              </p>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-y-10 gap-x-6 mb-12">
                 <div className="space-y-1.5">
                    <span className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                       <Tag className="h-3 w-3" /> SKU / CODE
                    </span>
                    <p className="font-inter text-sm font-bold text-slate-700">{product.catalog_sku}</p>
                 </div>
                 <div className="space-y-1.5">
                     <span className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                        <Warehouse className="h-3 w-3" /> DIMENSIONS
                     </span>
                     <p className="font-inter text-sm font-bold text-slate-700">
                        {product.catalog_dimension_p && product.catalog_dimension_l && product.catalog_dimension_t 
                          ? `${product.catalog_dimension_p} x ${product.catalog_dimension_l} x ${product.catalog_dimension_t} ${product.catalog_dimension_unit || "cm"}`
                          : "Standard"}
                     </p>
                  </div>
                  <div className="space-y-1.5">
                     <span className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                        <PackageCheck className="h-3 w-3" /> UNIT
                     </span>
                     <p className="font-inter text-sm font-bold text-slate-700">{product.catalog_dimension_unit || "cm"}</p>
                  </div>
                  <div className="space-y-1.5">
                     <span className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                        <Clock className="h-3 w-3" /> NOTES
                     </span>
                     <p className="font-inter text-sm font-bold text-slate-700">{product.physical_samples?.[0]?.notes || "N/A"}</p>
                  </div>
               </div>

               {/* Price Banner */}
               <div className="bg-slate-50 rounded-3xl p-8 mb-10 border border-slate-100/50">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Estimated Pricing</span>
                  <div className="flex items-baseline gap-2">
                     <span className="text-2xl font-lora font-medium text-slate-900">
                        {product.catalog_price ? `IDR ${product.catalog_price.toLocaleString()}` : "Contact for Price"}
                     </span>
                     {product.catalog_price && <span className="text-[10px] text-slate-400 font-inter">/ {product.catalog_dimension_unit || "cm"}</span>}
                  </div>
               </div>

               {/* Inventory Status */}
               <div className="mt-auto pt-8 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className={cn(
                       "h-3 w-3 rounded-full border-2 border-white shadow-sm animate-pulse",
                       product.physical_samples && product.physical_samples.length > 0 ? "bg-teal-500" : "bg-slate-200"
                     )} />
                     <span className="text-[11px] font-bold text-slate-600 font-inter">
                       {product.physical_samples && product.physical_samples.length > 0 
                         ? `Physical Sample In Stock` 
                         : "Digital Asset Only"}
                     </span>
                  </div>
                 
                 {product.catalog_reference_url && (
                   <Button 
                    variant="link" 
                    className="text-slate-400 hover:text-slate-900 p-0 text-[10px] font-black uppercase tracking-widest gap-2"
                    onClick={() => window.open(product.catalog_reference_url!, '_blank')}
                   >
                     View Site <ExternalLink className="h-3 w-3" />
                   </Button>
                 )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Admin Edit Modal */}
      {isAdmin && product && (
        <LibraryFormModal
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          type="PRODUCT"
          mode="EDIT"
          initialData={product}
          vendors={[]} // Vendors will be fetched inside or passed if available
          categories={[product.catalog_category]}
          onSuccess={() => {
            setIsEditModalOpen(false);
            onOpenChange(false);
            // Parent should refresh
          }}
        />
      )}
    </>
  );
}
