"use client";

import * as React from "react";
import { Search, Plus, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  UI_ENGINE_RADIUS_IMAGE,
  UI_ENGINE_RADIUS_CARD
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

import { 
  Tag, 
  Type, 
  Award, 
  Palette, 
  Layers, 
  Sparkles, 
  Maximize, 
  DollarSign, 
  Link as LinkIcon, 
  Image as ImageIcon,
  Terminal,
  Command,
  ArrowRight,
  Zap
} from "lucide-react";

const SLASH_COMMANDS = {
  // Primary
  sku: { label: "SKU", tier: "primary", icon: Tag, field: "catalog_sku" },
  name: { label: "Product Name", tier: "primary", icon: Type, field: "catalog_product_name" },
  brand: { label: "Brand", tier: "primary", icon: Award, field: "catalog_brand" },
  
  // Secondary
  color: { label: "Color", tier: "secondary", icon: Palette, field: "catalog_color" },
  motif: { label: "Motif", tier: "secondary", icon: Layers, field: "catalog_motif" },
  finishing: { label: "Finishing", tier: "secondary", icon: Sparkles, field: "catalog_finishing" },
  
  // Tertiary
  dim: { label: "Dimension", tier: "tertiary", icon: Maximize, field: "catalog_dimension" },
  link: { label: "Link", tier: "tertiary", icon: LinkIcon, field: "catalog_reference_url" },
  img: { label: "Image URL", tier: "tertiary", icon: ImageIcon, field: "catalog_image_url" },
} as const;

export function ScheduleSearchBar({ projectId, section, onSuccess }: ScheduleSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [products, setProducts] = React.useState<ProductCatalogWithRelations[]>([]);
  const [showResults, setShowResults] = React.useState(false);
  
  // Slash Command State
  const [parsedData, setParsedData] = React.useState<Record<string, string>>({});
  const isSlashCommand = query.startsWith("/");

  // Dialog State
  const [isDraftOpen, setIsDraftOpen] = React.useState(false);

  const searchRef = React.useRef<HTMLDivElement>(null);

  // Validation: Either Primary or Secondary must be present
  const hasPrimary = Object.keys(parsedData).some(k => SLASH_COMMANDS[k as keyof typeof SLASH_COMMANDS]?.tier === "primary");
  const hasSecondary = Object.keys(parsedData).some(k => SLASH_COMMANDS[k as keyof typeof SLASH_COMMANDS]?.tier === "secondary");
  const hasTertiary = Object.keys(parsedData).some(k => SLASH_COMMANDS[k as keyof typeof SLASH_COMMANDS]?.tier === "tertiary");
  const canCreate = hasPrimary || hasSecondary;
  const activeCommand = query.match(/^\/(\w+)\s*/)?.[1];

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
    if (!q.trim() || q.startsWith("/")) {
      setProducts([]);
      return;
    }
    setIsSearching(true);
    try {
      const { items } = unwrapActionResult(await LibraryFacade.searchProducts({ 
        search: q, 
        pageSize: 10,
        status: "APPROVED",
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
      if (query && !isSlashCommand) loadProducts(query);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, loadProducts, isSlashCommand]);

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

  const handleApplySlash = () => {
    const match = query.match(/^\/(\w+)\s+(.+)$/);
    if (match) {
      const [, command, value] = match;
      if (command in SLASH_COMMANDS) {
        setParsedData(prev => ({ ...prev, [command]: value.trim() }));
        setQuery("/"); // Reset to slash to keep command mode active
        toast.success(`Set ${SLASH_COMMANDS[command as keyof typeof SLASH_COMMANDS].label}: ${value.trim()}`, {
          duration: 2000,
          position: "top-center"
        });
      } else {
        toast.error(`Unknown command: /${command}`, { duration: 2000 });
      }
    } else if (query === "/" && canCreate) {
      setIsDraftOpen(true);
      setShowResults(false);
    } else if (query.startsWith("/") && query.trim().length > 1) {
      // Command but no value or malformed
      toast.info("Format: /command [value] (e.g. /sku RM-101)", { duration: 2000 });
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-3xl">
      <div className={cn(
        "flex items-center gap-3 px-4 h-12 border transition-all duration-200",
        UI_ENGINE_RADIUS_CONTROL,
        showResults ? "bg-white border-slate-900 shadow-lg ring-4 ring-slate-100" : "bg-slate-50 border-slate-200 hover:border-slate-300"
      )}>
        {isSlashCommand ? (
          <Terminal className="h-4 w-4 shrink-0 text-slate-900 animate-pulse" />
        ) : (
          <Search className={cn("h-4 w-4 shrink-0 transition-colors", showResults ? "text-slate-900" : "text-slate-400")} />
        )}
        
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (isSlashCommand) {
                handleApplySlash();
              } else if (query.trim() && products.length === 0) {
                // Ignore free-text enter unless it's a slash command
                toast.info("Use /commands for manual entry (e.g. /sku RM-101)");
              }
            }
          }}
          onFocus={() => setShowResults(true)}
          placeholder={isSlashCommand ? "Type /command [value] (e.g. /sku RM-101)" : "Search library or type / for manual entry..."}
          className={cn(
            "flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-slate-400 font-sans",
            isSlashCommand ? "text-blue-600 font-mono" : "text-slate-900"
          )}
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

      {/* Smart Entry Composition Preview */}
      {(hasPrimary || hasSecondary || hasTertiary) && !activeCommand && (
        <div className={cn("mt-4 p-4 bg-slate-50/50 border border-slate-200/60 flex flex-col gap-4", UI_ENGINE_RADIUS_CARD)}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Zap className="h-3 w-3 text-blue-500 animate-pulse" />
              Smart Entry Composition
            </span>
            <Button
              size="sm"
              disabled={!hasPrimary && !hasSecondary}
              onClick={() => setIsDraftOpen(true)}
              className={cn("h-7 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider", UI_ENGINE_RADIUS_ACTION)}
            >
              Complete & Save Draft
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-8">
            {/* Primary Tier */}
            <div className="space-y-1.5 min-w-[120px]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Primary Identity</span>
              <div className="flex flex-wrap gap-1.5">
                {parsedData.name && <Badge variant="secondary" className={cn("bg-slate-900 text-white border-none font-bold px-2 py-0.5 text-[10px]", UI_ENGINE_RADIUS_ACTION)}>NAME: {parsedData.name}</Badge>}
                {parsedData.sku && <Badge variant="secondary" className={cn("bg-slate-900 text-white border-none font-bold px-2 py-0.5 text-[10px]", UI_ENGINE_RADIUS_ACTION)}>SKU: {parsedData.sku}</Badge>}
                {parsedData.brand && <Badge variant="secondary" className={cn("bg-slate-900 text-white border-none font-bold px-2 py-0.5 text-[10px]", UI_ENGINE_RADIUS_ACTION)}>BRAND: {parsedData.brand}</Badge>}
                {!hasPrimary && <span className="text-[10px] text-slate-300 italic">None...</span>}
              </div>
            </div>

            {/* Secondary Tier */}
            <div className="space-y-1.5 min-w-[120px]">
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Appearance Tier</span>
              <div className="flex flex-wrap gap-1.5">
                {parsedData.color && <Badge variant="secondary" className={cn("bg-blue-50 border-blue-100 text-blue-700 font-bold px-2 py-0.5 text-[10px]", UI_ENGINE_RADIUS_ACTION)}>COLOR: {parsedData.color}</Badge>}
                {parsedData.motif && <Badge variant="secondary" className={cn("bg-blue-50 border-blue-100 text-blue-700 font-bold px-2 py-0.5 text-[10px]", UI_ENGINE_RADIUS_ACTION)}>MOTIF: {parsedData.motif}</Badge>}
                {parsedData.finishing && <Badge variant="secondary" className={cn("bg-blue-50 border-blue-100 text-blue-700 font-bold px-2 py-0.5 text-[10px]", UI_ENGINE_RADIUS_ACTION)}>FINISH: {parsedData.finishing}</Badge>}
                {!hasSecondary && <span className="text-[10px] text-slate-300 italic">None...</span>}
              </div>
            </div>

            {/* Tertiary Tier */}
            <div className="space-y-1.5 min-w-[120px]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Technical Tier</span>
              <div className="flex flex-wrap gap-1.5">
                {parsedData.dim && <Badge variant="secondary" className={cn("bg-white border-slate-200 text-slate-500 font-medium px-2 py-0.5 text-[10px]", UI_ENGINE_RADIUS_ACTION)}>DIM: {parsedData.dim}</Badge>}
                {parsedData.link && <Badge variant="secondary" className={cn("bg-white border-slate-200 text-slate-500 font-medium px-2 py-0.5 text-[10px]", UI_ENGINE_RADIUS_ACTION)}>LINK: {parsedData.link}</Badge>}
                {!hasTertiary && <span className="text-[10px] text-slate-200 italic">None...</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Dropdown */}
      {showResults && (
        <div className={cn(
          "absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200",
          UI_ENGINE_RADIUS_CONTROL
        )}>
          <ScrollArea className="max-h-[400px]">
            <div className="p-2 space-y-1">
              {isSlashCommand ? (
                <>
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans flex items-center gap-2">
                    <Command className="h-3 w-3" /> Slash Commands
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-1">
                    {Object.entries(SLASH_COMMANDS).map(([cmd, config]) => {
                      const Icon = config.icon;
                      const isTyped = query.startsWith(`/${cmd}`);
                      return (
                        <button
                          key={cmd}
                          onClick={() => setQuery(`/${cmd} `)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 text-left transition-all group",
                            UI_ENGINE_RADIUS_CONTROL,
                            isTyped ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-600"
                          )}
                        >
                          <Icon className={cn("h-4 w-4", isTyped ? "text-white" : "text-slate-400")} />
                          <div className="flex-1">
                            <div className="text-[11px] font-bold uppercase tracking-tight leading-none">/{cmd}</div>
                            <div className={cn("text-[9px] opacity-60", isTyped ? "text-slate-300" : "text-slate-400")}>{config.label}</div>
                          </div>
                          <ArrowRight className={cn("h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity", isTyped ? "text-white" : "text-slate-400")} />
                        </button>
                      );
                    })}
                  </div>
                  {canCreate && query === "/" && (
                    <button
                      onClick={() => setIsDraftOpen(true)}
                      className={cn("flex w-full items-center gap-3 px-3 py-4 text-left bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all group mt-2 border-t border-emerald-100", UI_ENGINE_RADIUS_CONTROL)}
                    >
                      <Plus className="h-5 w-5" />
                      <div className="flex-1">
                         <div className="text-sm font-black uppercase tracking-widest">Complete Draft Entry</div>
                         <div className="text-[10px] opacity-70">Either Primary or Secondary tier data is ready.</div>
                      </div>
                      <div className="px-2 py-1 bg-white text-[10px] font-bold text-emerald-600 shadow-sm border border-emerald-200 flex items-center gap-1">
                        Press Enter <span className="text-[12px]">↵</span>
                      </div>
                    </button>
                  )}
                </>
              ) : (
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
                              {m.catalog_sku ? `${m.catalog_sku} — ${m.catalog_product_name || ""}` : m.catalog_product_name}
                            </div>
                            <div className={cn("text-[11px] text-slate-500 truncate", UI_ENGINE_TYPE_META)}>
                              {m.catalog_brand || m.vendor?.brand_name || "Unknown Brand"} • {m.catalog_category}
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  ) : query.length >= 2 && !isSearching ? (
                    <div className="px-3 py-8 text-center text-slate-400 text-xs italic font-sans flex flex-col items-center gap-2">
                      <div className="text-slate-300">No matching library products.</div>
                      <div className={cn("text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1", UI_ENGINE_RADIUS_ACTION)}>Type &quot;/&quot; to start manual entry</div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
      <QuickDraftDialog
        isOpen={isDraftOpen}
        onOpenChange={setIsDraftOpen}
        projectId={projectId}
        section={section}
        initialValue=""
        preParsedData={parsedData}
        onSuccess={() => {
          setParsedData({});
          onSuccess();
        }}
      />
    </div>
  );
}

