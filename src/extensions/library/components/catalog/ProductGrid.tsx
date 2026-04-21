"use client";

import React from "react";
import { ProductCard } from "./ProductCard";
import { ProductCatalogWithRelations } from "../../types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, PackageOpen } from "lucide-react";

interface ProductGridProps {
  products: ProductCatalogWithRelations[];
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit?: (product: ProductCatalogWithRelations) => void;
  onDelete?: (id: string) => void;
  onAddToSchedule?: (product: ProductCatalogWithRelations) => void;
}

export function ProductGrid({
  products,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onEdit,
  onDelete,
  onAddToSchedule,
}: ProductGridProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
          <PackageOpen className="h-8 w-8 text-slate-200" />
        </div>
        <h3 className="font-lora text-lg font-medium text-slate-900">No products found</h3>
        <p className="text-sm text-slate-500 font-inter mt-1">Try adjusting your filters or search query.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddToSchedule={onAddToSchedule}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12 py-8 border-t border-slate-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="h-10 px-4 rounded-xl font-inter text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex items-center gap-1 px-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "ghost"}
                size="sm"
                onClick={() => onPageChange(page)}
                className={`h-10 w-10 rounded-xl font-inter text-xs font-bold ${
                  currentPage === page 
                    ? "bg-slate-900 text-white shadow-lg" 
                    : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {page}
              </Button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="h-10 px-4 rounded-xl font-inter text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
