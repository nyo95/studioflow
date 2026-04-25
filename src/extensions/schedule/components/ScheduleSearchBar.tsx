"use client";

import * as React from "react";
import { Search, Plus, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { ProductType } from "@/generated/prisma";
import { LibraryFacade } from "@/extensions/library/facade";
import { 
  addScheduleEntryWithProductAction, 
} from "@/extensions/schedule/actions/schedule-actions";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { 
  UI_ENGINE_RADIUS_CONTROL, 
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_RADIUS_IMAGE
} from "@/ui_engine/tokens/layout";
import {
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_META,
  UI_ENGINE_TYPE_TITLE
} from "@/ui_engine/tokens/typography";
import {
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_BORDER_SUBTLE
} from "@/ui_engine/tokens/colors";
import type { ProductCatalogWithRelations } from "@/extensions/library/types";

import { QuickDraftDialog } from "./QuickDraftDialog";

interface ScheduleSearchBarProps {
  projectId: string;
  section: ProductType;
  onSuccess: () => void;
}

export function ScheduleSearchBar({ projectId, section, onSuccess }: ScheduleSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [products, setProducts] = React.useState<ProductCatalogWithRelations[]>([]);
  const [showResults, setShowResults] = React.useState(false);
  
  // Dialog State
  const [isDraftOpen, setIsDraftOpen] = React.useState(false);
  const [draftValue, setDraftValue] = React.useState("");

  const searchRef = React.useRef<HTMLDivElement>(null);

  // Close results on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadProducts = React.useCallback(async (q: string) => {
    if (!q.trim()) {
      setProducts([]);
      return;
    }
    setIsSearching(true);
    try {
      const { items } = unwrapActionResult(await LibraryFacade.searchProducts({ 
        search: q, 
        pageSize: 10,
      }));
      setProducts(items);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, []);



  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (query) loadProducts(query);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, loadProducts]);

  const reset = () => {
    setQuery("");
    setProducts([]);
    setShowResults(false);
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
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add product");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartCreateNew = () => {
    setDraftValue(query);
    setIsDraftOpen(true);
    setShowResults(false);
  };



  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className={cn(
        "flex items-center gap-3 px-4 h-12 border transition-all duration-200",
        UI_ENGINE_RADIUS_CONTROL,
        showResults ? "bg-white border-slate-900 shadow-lg ring-4 ring-slate-100" : "bg-slate-50 border-slate-200 hover:border-slate-300"
      )}>
        <Search className={cn("h-4 w-4 shrink-0 transition-colors", showResults ? "text-slate-900" : "text-slate-400")} />
        
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim() && !products.some(p => p.catalog_product_name?.toLowerCase() === query.toLowerCase())) {
              handleStartCreateNew();
            }
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Search product libraries or type new name to add..."
          className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 font-sans"
        />

        {query && (
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
        <div className={cn(
          "absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200",
          UI_ENGINE_RADIUS_CONTROL
        )}>
          <ScrollArea className="max-h-[400px]">
            <div className="p-2 space-y-1">
              <>
                {products.length > 0 ? (
                  <>
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                      From Library
                    </div>
                    {products.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleSelectProduct(m)}
                        className={cn("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors group", UI_ENGINE_RADIUS_CONTROL)}
                      >
                        <div className={cn("h-10 w-10 bg-slate-100 overflow-hidden shrink-0 border border-slate-100", UI_ENGINE_RADIUS_IMAGE)}>
                          {m.catalog_image_url ? (
                            <img src={m.catalog_image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className={cn("h-full w-full bg-slate-50 flex items-center justify-center text-[10px] text-slate-300 uppercase font-black", UI_ENGINE_TYPE_META)}>NA</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-sm font-semibold text-slate-900 truncate group-hover:text-slate-950", UI_ENGINE_TYPE_TITLE)}>
                            {m.catalog_product_name}
                          </div>
                          <div className={cn("text-[11px] text-slate-500 truncate", UI_ENGINE_TYPE_META)}>
                            {m.catalog_brand || m.vendor?.brand_name || "Unknown Brand"} • {m.catalog_category}
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                ) : query.length >= 2 && !isSearching ? (
                  <div className="px-3 py-8 text-center text-slate-400 text-xs italic font-sans">
                    No matching products found in library.
                  </div>
                ) : null}

                {query.trim().length > 0 && (
                  <button
                    onClick={handleStartCreateNew}
                    className={cn("flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-900 hover:text-white transition-all group mt-1 border border-transparent hover:border-slate-800", UI_ENGINE_RADIUS_CONTROL)}
                  >
                    <div className={cn("h-10 w-10 bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-slate-800 group-hover:text-white transition-colors", UI_ENGINE_RADIUS_CONTROL)}>
                      <Plus className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                       <div className={cn("text-sm font-bold", UI_ENGINE_TYPE_BODY)}>Create custom entry</div>
                       <div className={cn("text-[11px] opacity-70 italic", UI_ENGINE_TYPE_META)}>&quot;{query}&quot; (not in library)</div>
                    </div>
                    <div className={cn("px-2 py-1 bg-white group-hover:bg-slate-800 text-[10px] font-bold text-slate-400 group-hover:text-slate-300 shadow-sm border border-slate-200 group-hover:border-slate-700 flex items-center gap-1", UI_ENGINE_RADIUS_ACTION)}>
                      Press Enter <span className="text-[12px]">↵</span>
                    </div>
                  </button>
                )}
              </>
            </div>
          </ScrollArea>
        </div>
      )}
      <QuickDraftDialog
        isOpen={isDraftOpen}
        onOpenChange={setIsDraftOpen}
        projectId={projectId}
        section={section}
        initialValue={draftValue}
        onSuccess={onSuccess}
      />
    </div>
  );
}

