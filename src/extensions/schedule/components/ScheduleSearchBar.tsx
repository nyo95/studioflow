"use client";

import * as React from "react";
import { 
  Plus, 
  Search, 
  Loader2, 
  X,
  ChevronRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  addScheduleEntryWithMaterialAction,
  addScheduleEntryInstantAction,
  getScheduleCategoriesAction,
  updateScheduleOptionSnapshotAction
} from "@/actions/schedule-actions";
import { searchMaterials } from "../../library/actions/material-actions";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import { MaterialCatalog, ScheduleSection } from "@/generated/prisma";

interface ScheduleSearchBarProps {
  projectId: string;
  section: ScheduleSection;
  onSuccess: () => void;
}

export function ScheduleSearchBar({ projectId, section, onSuccess }: ScheduleSearchBarProps) {
  const [query, setQuery] = React.useState("");
  const [showResults, setShowResults] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [materials, setMaterials] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [step, setStep] = React.useState<"SEARCH" | "CATEGORY">("SEARCH");
  const [newMaterialName, setNewMaterialName] = React.useState("");
  const [categoryQuery, setCategoryQuery] = React.useState("");
  
  const searchRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const reset = () => {
    setQuery("");
    setCategoryQuery("");
    setNewMaterialName("");
    setStep("SEARCH");
    setShowResults(false);
  };

  const handleSearch = React.useCallback(async (q: string) => {
    if (q.length < 2) {
      setMaterials([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchMaterials({ query: q, limit: 10 });
      setMaterials(results);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (step === "SEARCH") handleSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, handleSearch, step]);

  const loadCategories = async () => {
    try {
      const result = unwrapActionResult(await getScheduleCategoriesAction({ section }));
      setCategories(result.map(c => c.category));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectMaterial = async (material: any) => {
    setIsCreating(true);
    try {
      await addScheduleEntryWithMaterialAction({
        projectId,
        section,
        materialId: material.id
      });
      toast.success(`Added: ${material.product_type}`);
      reset();
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add material");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartCreateNew = () => {
    setNewMaterialName(query);
    setStep("CATEGORY");
    loadCategories();
    setCategoryQuery("");
  };

  const handleFinalizeCreate = async (category: string) => {
    setIsCreating(true);
    try {
      const entry = await addScheduleEntryInstantAction({
        projectId,
        category: category.toUpperCase(),
        section,
      }) as any;

      if (entry?.options?.[0]) {
        await updateScheduleOptionSnapshotAction({
          optionId: entry.options[0].id,
          data: { name: newMaterialName }
        });
      }

      toast.success(`Created: ${newMaterialName}`);
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
            placeholder="Search material libraries or type new name to add..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
          />
        ) : (
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
              NEW: {newMaterialName}
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

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <ScrollArea className="max-h-[400px]">
            <div className="p-2 space-y-1">
              {step === "SEARCH" ? (
                <>
                  {materials.length > 0 ? (
                    <>
                      <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        From Library
                      </div>
                      {materials.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectMaterial(m)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 transition-colors group"
                        >
                          <div className="h-10 w-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                            {m.cover_url ? (
                              <img src={m.cover_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-slate-50 flex items-center justify-center text-[10px] text-slate-300 uppercase font-black">NA</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate group-hover:text-slate-950">
                              {m.product_type}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {m.vendor?.brand_name || "Unknown Brand"} • {m.category}
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  ) : query.length >= 2 && !isSearching ? (
                    <div className="px-3 py-8 text-center text-slate-400 text-xs italic">
                      No matching materials found in library.
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
                    Select Category for &quot;{newMaterialName}&quot;
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
