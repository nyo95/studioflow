"use client";

import * as React from "react";
import { Search, Plus, Loader2, X, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { ProductType } from "@/generated/prisma";
import { getProductsAction } from "@/extensions/library/actions/library-actions";
import { 
  addScheduleEntryWithProductAction, 
  addScheduleEntryInstantAction,
  updateScheduleOptionSnapshotAction,
  getScheduleCategoriesAction 
} from "@/actions/schedule-actions";
import { cn } from "@/lib/utils";
import type { ProductCatalogWithRelations } from "@/extensions/library/types";

interface ScheduleSearchBarProps {
  projectId: string;
  section: ProductType;
  onSuccess: () => void;
}

export function ScheduleSearchBar({ projectId, section, onSuccess }: ScheduleSearchBarProps) {
  const [query, setQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [products, setProducts] = React.useState<ProductCatalogWithRelations[]>([]);
  const [showResults, setShowResults] = React.useState(false);
  
  // Creation Flow State
  const [step, setStep] = React.useState<"SEARCH" | "CATEGORY">("SEARCH");
  const [newProductName, setNewProductName] = React.useState("");
  const [categories, setCategories] = React.useState<string[]>([]);
  const [categoryQuery, setCategoryQuery] = React.useState("");

  const searchRef = React.useRef<HTMLDivElement>(null);

  // Close results on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        if (step === "CATEGORY") reset();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [step]);

  const loadProducts = React.useCallback(async (q: string) => {
    if (!q.trim()) {
      setProducts([]);
      return;
    }
    setIsSearching(true);
    try {
      const result = unwrapActionResult(await getProductsAction({ 
        search: q,
      })) as { items: ProductCatalogWithRelations[] };
      setProducts(result.items);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const loadCategories = async () => {
    try {
      const results = unwrapActionResult(await getScheduleCategoriesAction({ section })) as { category: string }[];
      setCategories(results.map(r => r.category));
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (query && step === "SEARCH") loadProducts(query);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, loadProducts, step]);

  const reset = () => {
    setQuery("");
    setProducts([]);
    setShowResults(false);
    setStep("SEARCH");
    setNewProductName("");
    setCategoryQuery("");
  };

  const handleSelectProduct = async (product: ProductCatalogWithRelations) => {
    setIsCreating(true);
    try {
      await addScheduleEntryWithProductAction({
        projectId,
        product_catalog_id: product.id,
        section,
      });
      toast.success(`Added: ${product.catalog_product_name}`);
      reset();
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add product");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartCreateNew = () => {
    setNewProductName(query);
    setStep("CATEGORY");
    loadCategories();
    setCategoryQuery("");
  };

  const handleFinalizeCreate = async (category: string) => {
    setIsCreating(true);
    try {
const entry = unwrapActionResult(await addScheduleEntryInstantAction({
          projectId,
          schedule_category: category.toUpperCase(),
          section,
        }));

        if (entry?.options?.[0]) {
          await updateScheduleOptionSnapshotAction({
            optionId: entry.options[0].id,
            data: { catalog_product_name: newProductName }
          });
      }

      toast.success(`Created: ${newProductName}`);
      reset();
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create entry");
    } finally {
      setIsCreating(false);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.toLowerCase().includes(categoryQuery.toLowerCase())
  );

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className={cn(
        "flex items-center gap-3 px-4 h-12 rounded-xl border transition-all duration-200",
        showResults ? "bg-white border-slate-900 shadow-lg ring-4 ring-slate-100" : "bg-slate-50 border-slate-200 hover:border-slate-300"
      )}>
        <Search className={cn("h-4 w-4 shrink-0 transition-colors", showResults ? "text-slate-900" : "text-slate-400")} />
        
        {step === "SEARCH" ? (
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search product libraries or type new name to add..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
          />
        ) : (
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
              NEW: {newProductName}
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
            <input
              autoFocus
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
              placeholder="Type or select category..."
              className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
            />
          </div>
        )}

        {(query || categoryQuery) && (
          <button 
            onClick={reset}
            className="p-1 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}

        {isCreating && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {/* Results Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <ScrollArea className="max-h-[400px]">
            <div className="p-2 space-y-1">
              {step === "SEARCH" ? (
                <>
                  {products.length > 0 ? (
                    <>
                      <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        From Library
                      </div>
                      {products.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectProduct(m)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 transition-colors group"
                        >
                          <div className="h-10 w-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                            {m.catalog_image_url ? (
                              <img src={m.catalog_image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-slate-50 flex items-center justify-center text-[10px] text-slate-300 uppercase font-black">NA</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate group-hover:text-slate-950">
                              {m.catalog_product_name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {m.catalog_brand || m.vendor?.brand_name || "Unknown Brand"} • {m.catalog_category}
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  ) : query.length >= 2 && !isSearching ? (
                    <div className="px-3 py-8 text-center text-slate-400 text-xs italic">
                      No matching products found in library.
                    </div>
                  ) : null}

                  {query.trim().length > 0 && (
                    <button
                      onClick={handleStartCreateNew}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-900 hover:text-white transition-all group"
                    >
                      <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        <Plus className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold">Create custom entry</div>
                        <div className="text-[11px] opacity-70 italic">&quot;{query}&quot; (not in library)</div>
                      </div>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Select Category for &quot;{newProductName}&quot;
                  </div>
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleFinalizeCreate(cat)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-slate-50 transition-colors group"
                    >
                      <span className="text-sm font-medium text-slate-900 uppercase tracking-tight">{cat}</span>
                      <Plus className="h-4 w-4 text-slate-300 group-hover:text-slate-900" />
                    </button>
                  ))}
                  {categoryQuery && !categories.some(c => c.toLowerCase() === categoryQuery.toLowerCase()) && (
                    <button
                      onClick={() => handleFinalizeCreate(categoryQuery)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <div className="text-sm font-bold">Create Category: &quot;{categoryQuery.toUpperCase()}&quot;</div>
                    </button>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
