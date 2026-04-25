"use client";

import * as React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Search, 
  Plus, 
  Loader2, 
  Package, 
  Check, 
  Building2,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
import {
  LibraryFacade,
} from "@/extensions/library/facade";
import {
  addScheduleEntryAction,
  addScheduleOptionAction,
} from "@/extensions/schedule/actions/schedule-actions";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GradualInputForm } from "./GradualInputForm";
import type {
  ProductCatalogWithRelations,
  LibraryVendor,
} from "@/extensions/library/facade";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { ProductType } from "@/generated/prisma";
import { useProjectScheduleContext } from "../context/ProjectScheduleContext";

type SchedulePickerPayload =
  | {
      projectId: string;
      schedule_category: string;
      section: ProductType;
      mode: "catalog";
      catalogItemId: string;
    }
  | {
      projectId: string;
      schedule_category: string;
      section: ProductType;
      mode: "manual";
      catalogCreateData: {
        catalog_sku: string;
        catalog_product_name: string;
        catalog_brand: string;
        catalog_color?: string | null;
        catalog_motif?: string | null;
        catalog_finishing?: string | null;
        catalog_sub_category?: string | null;
        catalog_dimension_p?: string | null;
        catalog_reference_url?: string | null;
      };
    };

interface ScheduleProductPickerModalProps {
  entryId?: string; // If provided, we are adding an option to an existing entry
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleProductPickerModal({
  entryId,
  isOpen,
  onOpenChange,
}: ScheduleProductPickerModalProps) {
  const { projectId, category, section, onSuccess } = useProjectScheduleContext();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [products, setProducts] = React.useState<ProductCatalogWithRelations[]>([]);
  const [vendors, setVendors] = React.useState<LibraryVendor[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  
  // Custom Creation State
  const [createCatalogName, setCreateCatalogName] = React.useState<string | null>(null);
  const [createBrand, setCreateBrand] = React.useState("");
  const [createReferenceUrl, setCreateReferenceUrl] = React.useState("");

  const fetchVendors = React.useCallback(async () => {
    try {
      const res = unwrapActionResult<LibraryVendor[]>(await LibraryFacade.getVendors(undefined));
      setVendors(res);
    } catch (e) {
      console.error("Failed to fetch vendors", e);
    }
  }, []);

  const fetchProducts = React.useCallback(async () => {
    setIsSearching(true);
    try {
      const res = unwrapActionResult<{ items: ProductCatalogWithRelations[]; total: number }>(await LibraryFacade.searchProducts({ 
        search: searchQuery,
        type: section
      }));
      setProducts(res.items);
    } catch (error) {
      toast.error("Failed to fetch library catalog");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  React.useEffect(() => {
    if (isOpen) {
      fetchVendors();
      fetchProducts();
    }
  }, [isOpen, fetchProducts, fetchVendors]);

  // Load catalog options
  React.useEffect(() => {
    let isMounted = true;
    const run = async () => {
      setIsSearching(true);
      try {
        const results = unwrapActionResult(
          await LibraryFacade.searchProducts({
            category: searchQuery.trim() ? undefined : (category !== "all" ? category : undefined),
            search: searchQuery.trim() || undefined,
            type: section,
          }),
        ) as { items: ProductCatalogWithRelations[] };
        if (isMounted) setProducts(results.items);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    };

    const timer = setTimeout(() => { run(); }, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [category, searchQuery]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let payload: SchedulePickerPayload;

      if (createCatalogName) {
        payload = {
          projectId,
          schedule_category: category,
          section,
          mode: "manual",
          catalogCreateData: {
            catalog_sku: createCatalogName,
            catalog_product_name: createCatalogName,
            catalog_brand: createBrand.trim() || "Custom",
            catalog_reference_url: createReferenceUrl.trim() || null,
          },
        };
      } else {
        payload = {
          projectId,
          schedule_category: category,
          section,
          mode: "catalog",
          catalogItemId: selectedProductId as string,
        };
      }

      if (entryId) {
        unwrapActionResult(
          await addScheduleOptionAction({
            entryId: entryId,
            mode: payload.mode,
            ...(payload.mode === "catalog" ? { catalogItemId: payload.catalogItemId } : {}),
            ...(payload.mode === "manual" ? { catalogCreateData: payload.catalogCreateData } : {}),
          }),
        );
        toast.success("New alternative option added successfully");
      } else {
        unwrapActionResult(await addScheduleEntryAction(payload));
        toast.success(`New row added to ${category}`);
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
      // Note: Removed router.refresh() - onSuccess already triggers fetchSchedule

      // Reset form
      setCreateBrand("");
      setCreateReferenceUrl("");
      setSelectedProductId(null);
      setCreateCatalogName(null);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong during submission"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        onKeyDown={(e) => e.stopPropagation()}
        className="sm:max-w-[700px] p-0 overflow-hidden border-none rounded-[var(--radius-premium)] shadow-2xl bg-white focus-visible:outline-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Add Product to Schedule</DialogTitle>
        </DialogHeader>
        <GradualInputForm
          section={section}
          category={category}
          isSearching={isSearching}
          products={products}
          onSearch={setSearchQuery}
          onCancel={() => onOpenChange(false)}
          onConfirm={async (data) => {
            setIsSubmitting(true);
            try {
              let payload: SchedulePickerPayload;

              if (data.selectedId === "" && data.customData) {
                // Bespoke Manual Entry
                payload = {
                  projectId,
                  schedule_category: category,
                  section,
                  mode: "manual",
                  catalogCreateData: {
                    catalog_sku: data.customData.catalog_sku || data.customData.catalog_color || "DRAFT",
                    catalog_product_name: data.customData.catalog_product_name || data.customData.catalog_color || "New Item",
                    catalog_brand: data.customData.catalog_brand || "Custom",
                    catalog_color: data.customData.catalog_color || null,
                    catalog_motif: data.customData.catalog_motif || null,
                    catalog_finishing: data.customData.catalog_finishing || null,
                    catalog_sub_category: data.customData.catalog_sub_category || null,
                    catalog_dimension_p: data.customData.catalog_dimensions || null,
                    catalog_reference_url: data.customData.catalog_reference_url || null,
                  },
                };
              } else {
                payload = {
                  projectId,
                  schedule_category: category,
                  section,
                  mode: "catalog",
                  catalogItemId: data.selectedId as string,
                };
              }

              if (entryId) {
                unwrapActionResult(
                  await addScheduleOptionAction({
                    entryId: entryId,
                    mode: payload.mode,
                    ...(payload.mode === "catalog" ? { catalogItemId: payload.catalogItemId } : {}),
                    ...(payload.mode === "manual" ? { catalogCreateData: payload.catalogCreateData } : {}),
                  }),
                );
                toast.success("New alternative option added successfully");
              } else {
                unwrapActionResult(await addScheduleEntryAction(payload));
                toast.success(`New row added to ${category}`);
              }

              onOpenChange(false);
              if (onSuccess) onSuccess();
            } catch (error: unknown) {
              toast.error(error instanceof Error ? error.message : "Submission failed");
            } finally {
              setIsSubmitting(false);
            }
          }}
        />
      </DialogContent>

    </Dialog>
  );
}
