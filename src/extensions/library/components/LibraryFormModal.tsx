"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { createVendorAction, updateVendorAction, createProductAction, updateProductAction } from "../actions/library-actions";
import { TagInput } from "@/components/ui/tag-input";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { LibraryVendor, ProductCatalogWithRelations, LibraryVendorInput, ProductCatalogInput } from "../types";
import { LibraryItemStatus, ProductType } from "@/generated/prisma";
import { toast } from "sonner";
import { 
  Loader2, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Info, 
  Warehouse, 
  Users, 
  Crop, 
  Palette, 
  Layers, 
  ChevronDown, 
  ChevronUp,
  Type,
  Building2,
  Check,
  ChevronRight,
  Save,
  X,
  Edit3
} from "lucide-react";
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import { 
  UI_ENGINE_RADIUS_CARD, 
  UI_ENGINE_RADIUS_CONTROL, 
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_BORDER_SUBTLE,
  UI_ENGINE_BG_SUBTLE
} from "@/ui_engine";
import { ImagePlaceholder } from "@/ui_engine/components/image-placeholder";

import { UniversalImageUploader } from "@/components/ui/universal-image-uploader";
import { useSession } from "next-auth/react";
import { ScrollArea } from "@/components/ui/scroll-area";

type FormType = "VENDOR" | "PRODUCT";

const CONTACT_ROLES = ["Sales", "Marketing", "Admin", "Technical Support", "Procurement", "Other"];
const FINISHING_PRESETS = ["Matte", "Glossy", "Polished", "Semi-Gloss", "Satin", "Rough", "Textured", "Brushed"];

interface LibraryFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  type: FormType;
  mode: "CREATE" | "EDIT";
  initialData?: unknown;
  vendors?: LibraryVendor[];
  /** Flat list of category strings (all sections combined), used for filter UI */
  categories?: string[];
  /** Categories belonging to the PRODUCT section from PrefixDictionary */
  materialsCategories?: string[];
  /** Categories belonging to the FIXTURE section from PrefixDictionary */
  fixturesCategories?: string[];
  /** Unique sub_category values from existing catalog entries */
  subCategories?: string[];
  /** Unique finishing values from existing catalog entries (merged with presets) */
  finishings?: string[];
  onSuccess?: () => void;
}

export function LibraryFormModal({
  isOpen,
  onOpenChange,
  type,
  mode,
  initialData,
  vendors = [],
  categories = [],
  materialsCategories = [],
  fixturesCategories = [],
  subCategories = [],
  finishings = [],
  onSuccess,
}: LibraryFormModalProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN";
  const isStaff = userRole === "STAFF";
  const canEdit = isAdmin || isStaff;

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(mode === "CREATE");
  const editingId = (initialData as { id?: string } | undefined)?.id;

  // Vendor Form State
  const [vendorData, setVendorData] = React.useState<LibraryVendorInput>({
    brand_name: "",
    company_name: "",
    company_pt: "",
    address: "",
    website_url: "",
    instagram_url: "",
    contacts: [{ contact_person: "", contact_role: "Sales" }],
  });

  // Section for grouped category picker (ARCHITECTURAL or FFE)
  const [productSection, setProductSection] = React.useState<ProductType>(ProductType.material);

  // Product Form State
  const [productData, setProductData] = React.useState<ProductCatalogInput>({
    vendor_id: "",
    catalog_category: "HPL",
    catalog_sub_category: "",
    catalog_sku: "",
    catalog_product_name: "",
    catalog_motif: "",
    catalog_tags: [],
    catalog_dimension_p: "",
    catalog_dimension_l: "",
    catalog_dimension_t: "",
    catalog_dimension_unit: "cm",
    catalog_color: "",
    catalog_finishing: "",
    catalog_image_url: "",
    catalog_image_original_url: "",
    catalog_reference_url: "",
    catalog_folder_url: "",
    catalog_price: null,
    catalog_metadata: undefined,
    catalog_status: "APPROVED" as LibraryItemStatus,
    physical_samples: [{ catalog_rack_number: "", catalog_box_number: "", catalog_notes: "" }]
  });

  React.useEffect(() => {
    if (isOpen) {
      setIsEditMode(mode === "CREATE");
      if (initialData) {
        if (type === "VENDOR") {
          const vendorInitial = initialData as LibraryVendor;
          setVendorData({
            brand_name: vendorInitial.brand_name || "",
            company_name: vendorInitial.company_name || "",
            company_pt: vendorInitial.company_pt || "",
            address: vendorInitial.address || "",
            website_url: vendorInitial.website_url || "",
            instagram_url: vendorInitial.instagram_url || "",
            contacts: (vendorInitial.contacts ?? []).length > 0 
              ? (vendorInitial.contacts ?? []).map((c) => ({
                  contact_person: c.contact_person || "",
                  contact_role: c.contact_role || "Sales",
                  phone_number: c.phone_number || "",
                  email: c.email || "",
                }))
              : [{ contact_person: "", contact_role: "Sales" }],
          });
        } else {
          const productInitial = initialData as ProductCatalogWithRelations;
          const physical = productInitial.physical_samples?.[0] || { catalog_rack_number: "", catalog_box_number: "", catalog_notes: "" };
          setProductData({
            vendor_id: productInitial.vendor_id || "",
            catalog_category: productInitial.catalog_category || "",
            catalog_sub_category: productInitial.catalog_sub_category || "",
            catalog_sku: productInitial.catalog_sku || "",
            catalog_product_name: productInitial.catalog_product_name || "",
            catalog_motif: productInitial.catalog_motif || "",
            catalog_tags: productInitial.catalog_tags || [],
            catalog_dimension_p: productInitial.catalog_dimension_p || "",
            catalog_dimension_l: productInitial.catalog_dimension_l || "",
            catalog_dimension_t: productInitial.catalog_dimension_t || "",
            catalog_dimension_unit: productInitial.catalog_dimension_unit || "cm",
            catalog_color: productInitial.catalog_color || "",
            catalog_finishing: productInitial.catalog_finishing || "",
            catalog_image_url: productInitial.catalog_image_url || "",
            catalog_image_original_url: productInitial.catalog_image_original_url || "",
            catalog_reference_url: productInitial.catalog_reference_url || "",
            catalog_folder_url: productInitial.catalog_folder_url || "",
            catalog_price: productInitial.catalog_price || null,
            catalog_metadata: (productInitial.catalog_metadata as Record<string, unknown> | null) || undefined,
            catalog_status: productInitial.catalog_status || "APPROVED",
            physical_samples: [{ 
              catalog_rack_number: physical.catalog_rack_number || "", 
              catalog_box_number: physical.catalog_box_number || "", 
              catalog_notes: physical.catalog_notes || "" 
            }]
          });
        }
      } else {
        // Reset
        setVendorData({
          brand_name: "", company_name: "", company_pt: "", address: "", website_url: "", instagram_url: "",
          contacts: [{ contact_person: "", contact_role: "Sales" }],
        });
        setProductData({
          vendor_id: vendors[0]?.id || "",
          catalog_category: "GENERAL",
          catalog_sub_category: "",
          catalog_sku: "",
          catalog_product_name: "",
          catalog_motif: "",
          catalog_tags: [],
          catalog_dimension_p: "",
          catalog_dimension_l: "",
          catalog_dimension_t: "",
          catalog_dimension_unit: "cm",
          catalog_color: "",
          catalog_finishing: "",
          catalog_price: null,
          catalog_metadata: undefined,
          catalog_status: "APPROVED",
          physical_samples: [{ catalog_rack_number: "", catalog_box_number: "", catalog_notes: "" }]
        });
        setProductSection(ProductType.material);
      }
    }
  }, [isOpen, initialData, type, vendors]);

  const addContact = () => {
    setVendorData({
      ...vendorData,
      contacts: [...vendorData.contacts, { contact_person: "", contact_role: "Sales" }],
    });
  };

  const removeContact = (index: number) => {
    if (vendorData.contacts.length <= 1) return;
    const newContacts = [...vendorData.contacts];
    newContacts.splice(index, 1);
    setVendorData({ ...vendorData, contacts: newContacts });
  };

  const updateContact = (index: number, field: string, value: string) => {
    const newContacts = [...vendorData.contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setVendorData({ ...vendorData, contacts: newContacts });
  };

  const isFormValid = type === "VENDOR" 
    ? !!vendorData.brand_name?.trim() 
    : (!!productData.vendor_id || !!productData.vendor_name?.trim()) && 
      !!productData.catalog_sku?.trim() && 
      !!productData.catalog_category?.trim() &&
      !!productData.catalog_color?.trim();

  async function handleSubmit() {
    if (type === "PRODUCT" && !productData.catalog_color?.trim()) {
      toast.error("Color is mandatory for library inclusion");
      return;
    }
    setIsSubmitting(true);
    try {
      if (type === "VENDOR") {
        if (mode === "CREATE") {
          unwrapActionResult(await createVendorAction(vendorData));
          toast.success("Vendor created successfully");
        } else {
          if (!editingId) throw new Error("Vendor id is missing");
          unwrapActionResult(await updateVendorAction({ id: editingId, data: vendorData }));
          toast.success("Vendor updated successfully");
        }
      } else {
        const finalProduct: ProductCatalogInput = {
          ...productData,
          catalog_type: productSection,
          catalog_category: productData.catalog_category.trim(),
          catalog_sku: productData.catalog_sku.trim(),
          vendor_name: productData.vendor_name?.trim() || undefined,
        };
        if (!finalProduct.physical_samples?.[0]?.catalog_rack_number && !finalProduct.physical_samples?.[0]?.catalog_box_number) {
            finalProduct.physical_samples = [];
        }

        if (mode === "CREATE") {
          unwrapActionResult(await createProductAction(finalProduct));
          toast.success("Product created successfully");
        } else {
          if (!editingId) throw new Error("Product id is missing");
          unwrapActionResult(await updateProductAction({ id: editingId, data: finalProduct }));
          toast.success("Product updated successfully");
        }
      }
      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          "p-0 overflow-hidden border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] bg-white",
          UI_ENGINE_RADIUS_CARD,
          "max-w-[1000px] w-[95vw]"
        )}
      >
        <div className="flex flex-col md:flex-row h-[750px] max-h-[90vh]">
          {/* Sidebar: Branding & Context */}
          <div className="w-full md:w-[320px] bg-slate-900 flex flex-col p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-24 -mr-24 -mt-24 bg-white/5 rounded-full blur-3xl" />
            
            <div className="relative z-10 space-y-10">
              <div className="space-y-2">
                <h2 className="font-serif text-3xl font-bold tracking-tight">
                  {mode === "CREATE" ? "New Entry" : "Modify Entry"}
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                  {type} Master Library
                </p>
              </div>

              <div className="p-8 bg-white/5 border border-white/10 rounded-[24px] space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center">
                    {type === "PRODUCT" ? <Layers className="h-5 w-5 text-white" /> : <Building2 className="h-5 w-5 text-white" />}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">System Type</span>
                    <span className="text-sm font-bold text-white">{type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center">
                    <Crop className="h-5 w-5 text-white" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Operation</span>
                    <span className="text-sm font-bold text-white">{mode} Mode</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto relative z-10 pt-8 border-t border-white/10">
              <div className="flex items-start gap-4 text-slate-400">
                <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] font-medium leading-relaxed italic">
                  Ensure all mandatory fields are completed to maintain the integrity of our master product catalog.
                </p>
              </div>
            </div>
          </div>

          {/* Main Content Area: Single Scrollable Form */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
            <DialogHeader className={cn("p-10 pb-6 border-b flex flex-row items-center justify-between", UI_ENGINE_BORDER_SUBTLE)}>
              <div className="flex items-center gap-4">
                <DialogTitle className="font-serif text-2xl font-bold text-slate-900">
                  {type === "PRODUCT" ? "Product Specification" : "Vendor Details"}
                </DialogTitle>
                {mode === "EDIT" && canEdit && (
                  <Button
                    variant={isEditMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={cn(
                      "h-8 px-4 text-[10px] font-black uppercase tracking-widest transition-all",
                      isEditMode 
                        ? "bg-slate-900 text-white border-transparent" 
                        : "bg-white text-slate-900 border-slate-200 hover:border-slate-900",
                      UI_ENGINE_RADIUS_ACTION
                    )}
                  >
                    {isEditMode ? <><Save className="h-3 w-3 mr-2" /> Editing</> : <><Edit3 className="h-3 w-3 mr-2" /> Modify</>}
                  </Button>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onOpenChange(false)}
                className="h-10 w-10 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogHeader>

            <ScrollArea className="flex-1">
              <div className="p-10 space-y-12">
                {type === "PRODUCT" ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
                    {/* Section 1: Identity */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-1 bg-slate-900 rounded-full" />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Identity & Branding</h4>
                      </div>
                      <div className="grid gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Brand / Manufacturer *</Label>
                          {isEditMode ? (
                            <CreatableSearch
                              options={vendors.map(v => ({ id: v.id, name: v.brand_name }))}
                              value={productData.vendor_id}
                              onSelect={(id, name) => setProductData({ ...productData, vendor_id: id, vendor_name: name !== vendors.find(v => v.id === id)?.brand_name ? name : undefined })}
                              onCreate={(name) => setProductData({ ...productData, vendor_id: "", vendor_name: name })}
                              allowFreeText
                              placeholder="Search or type brand..."
                              className="h-12"
                            />
                          ) : (
                            <div className={cn("h-12 px-4 flex items-center text-sm font-bold", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                              {vendors.find(v => v.id === productData.vendor_id)?.brand_name || productData.vendor_name || "—"}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Section / Hierarchy *</Label>
                            {isEditMode ? (
                              <Select 
                                value={productSection} 
                                onValueChange={(val) => setProductSection(val as ProductType)}
                              >
                                <SelectTrigger className={cn("h-12 border-transparent text-xs font-bold uppercase tracking-widest", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={ProductType.material}>Materials</SelectItem>
                                  <SelectItem value={ProductType.fixture}>Fixtures</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className={cn("h-12 px-4 flex items-center text-[10px] font-black uppercase tracking-widest", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                {productSection === ProductType.material ? "Materials" : "Fixtures"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category *</Label>
                            {isEditMode ? (
                              <CreatableSearch
                                options={(productSection === ProductType.material ? materialsCategories : fixturesCategories).map(cat => ({ id: cat, name: cat }))}
                                value={productData.catalog_category}
                                onSelect={(_, name) => setProductData({ ...productData, catalog_category: name })}
                                onCreate={(name) => setProductData({ ...productData, catalog_category: name.toUpperCase() })}
                                placeholder="e.g. HPL, PAINT"
                                className="h-12"
                              />
                            ) : (
                              <div className={cn("h-12 px-4 flex items-center text-sm font-bold", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                {productData.catalog_category || "—"}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">SKU / Type Code *</Label>
                            {isEditMode ? (
                              <Input 
                                value={productData.catalog_sku}
                                onChange={(e) => setProductData({ ...productData, catalog_sku: e.target.value })}
                                placeholder="e.g. PT-01" 
                                className={cn("h-12 border-transparent focus:bg-white focus:border-slate-200 transition-all text-sm font-medium", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}
                              />
                            ) : (
                              <div className={cn("h-12 px-4 flex items-center text-sm font-bold", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                {productData.catalog_sku || "—"}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Product Name</Label>
                            {isEditMode ? (
                              <Input 
                                value={productData.catalog_product_name}
                                onChange={(e) => setProductData({ ...productData, catalog_product_name: e.target.value })}
                                placeholder="e.g. Oak Wood Texture" 
                                className={cn("h-12 border-transparent focus:bg-white focus:border-slate-200 transition-all text-sm font-medium", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}
                              />
                            ) : (
                              <div className={cn("h-12 px-4 flex items-center text-sm font-bold", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                {productData.catalog_product_name || "—"}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Physical Specs */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-1 bg-slate-900 rounded-full" />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Physical Specifications</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2 col-span-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-950 ml-1">Color / Variant * (Mandatory)</Label>
                            {isEditMode ? (
                              <Input 
                                value={productData.catalog_color}
                                onChange={(e) => setProductData({ ...productData, catalog_color: e.target.value })}
                                placeholder="e.g. Warm Grey" 
                                className={cn("h-12 bg-white border-slate-900/20 ring-1 ring-slate-900/5 text-sm font-bold shadow-sm", UI_ENGINE_RADIUS_CONTROL)}
                              />
                            ) : (
                              <div className={cn("h-12 px-4 flex items-center bg-slate-950 text-white text-sm font-bold shadow-lg shadow-slate-200", UI_ENGINE_RADIUS_CONTROL)}>
                                {productData.catalog_color || "—"}
                              </div>
                            )}
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pattern / Motif</Label>
                            {isEditMode ? (
                              <Input 
                                value={productData.catalog_motif}
                                onChange={(e) => setProductData({ ...productData, catalog_motif: e.target.value })}
                                placeholder="e.g. Grainy" 
                                className={cn("h-12 border-transparent text-sm font-medium", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}
                              />
                            ) : (
                              <div className={cn("h-12 px-4 flex items-center text-sm font-medium", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                {productData.catalog_motif || "—"}
                              </div>
                            )}
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Finishing</Label>
                            {isEditMode ? (
                              <CreatableSearch
                                options={finishings.map(f => ({ id: f, name: f }))}
                                value={productData.catalog_finishing}
                                onSelect={(_, name) => setProductData({ ...productData, catalog_finishing: name })}
                                onCreate={(name) => setProductData({ ...productData, catalog_finishing: name })}
                                placeholder="e.g. Matte"
                                className="h-12"
                              />
                            ) : (
                              <div className={cn("h-12 px-4 flex items-center text-sm font-medium", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                {productData.catalog_finishing || "—"}
                              </div>
                            )}
                         </div>
                         <div className={cn("grid grid-cols-4 gap-4 col-span-2 p-6 border", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-slate-400 text-center block">P</Label>
                              {isEditMode ? (
                                <Input value={productData.catalog_dimension_p} onChange={e => setProductData({...productData, catalog_dimension_p: e.target.value})} className="h-10 text-center bg-white border-none shadow-sm" />
                              ) : (
                                <div className="h-10 flex items-center justify-center bg-white rounded-lg text-xs font-bold">{productData.catalog_dimension_p || "—"}</div>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-slate-400 text-center block">L</Label>
                              {isEditMode ? (
                                <Input value={productData.catalog_dimension_l} onChange={e => setProductData({...productData, catalog_dimension_l: e.target.value})} className="h-10 text-center bg-white border-none shadow-sm" />
                              ) : (
                                <div className="h-10 flex items-center justify-center bg-white rounded-lg text-xs font-bold">{productData.catalog_dimension_l || "—"}</div>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-slate-400 text-center block">T</Label>
                              {isEditMode ? (
                                <Input value={productData.catalog_dimension_t} onChange={e => setProductData({...productData, catalog_dimension_t: e.target.value})} className="h-10 text-center bg-white border-none shadow-sm" />
                              ) : (
                                <div className="h-10 flex items-center justify-center bg-white rounded-lg text-xs font-bold">{productData.catalog_dimension_t || "—"}</div>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-slate-400 text-center block">Unit</Label>
                              {isEditMode ? (
                                <Select value={productData.catalog_dimension_unit} onValueChange={v => setProductData({...productData, catalog_dimension_unit: v})}>
                                  <SelectTrigger className="h-10 bg-white border-none shadow-sm text-[10px] font-black">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="cm">CM</SelectItem>
                                    <SelectItem value="mm">MM</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="h-10 flex items-center justify-center bg-white rounded-lg text-[9px] font-black uppercase">{productData.catalog_dimension_unit || "cm"}</div>
                              )}
                            </div>
                         </div>
                      </div>
                    </div>

                    {/* Section 3: Inventory */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-1 bg-slate-900 rounded-full" />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Logistics & Approval</h4>
                      </div>
                      <div className="space-y-6">
                         <div className={cn("p-8 border flex items-center gap-8", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
                           <div className="h-14 w-14 bg-white shadow-md flex items-center justify-center rounded-2xl text-slate-400">
                             <Warehouse className="h-7 w-7" />
                           </div>
                           <div className="grid grid-cols-2 gap-6 flex-1">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Rack Location</Label>
                                {isEditMode ? (
                                  <Input 
                                    value={productData.physical_samples?.[0]?.catalog_rack_number} 
                                    onChange={(e) => {
                                      const s = [...productData.physical_samples!]; s[0].catalog_rack_number = e.target.value; setProductData({...productData, physical_samples: s});
                                    }}
                                    placeholder="e.g. R-01"
                                    className="h-11 bg-white border-none shadow-sm" 
                                  />
                                ) : (
                                  <div className="h-11 px-4 flex items-center bg-white rounded-lg text-sm font-bold shadow-sm">{productData.physical_samples?.[0]?.catalog_rack_number || "—"}</div>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Box Number</Label>
                                {isEditMode ? (
                                  <Input 
                                    value={productData.physical_samples?.[0]?.catalog_box_number} 
                                    onChange={(e) => {
                                      const s = [...productData.physical_samples!]; s[0].catalog_box_number = e.target.value; setProductData({...productData, physical_samples: s});
                                    }}
                                    placeholder="e.g. B-01"
                                    className="h-11 bg-white border-none shadow-sm" 
                                  />
                                ) : (
                                  <div className="h-11 px-4 flex items-center bg-white rounded-lg text-sm font-bold shadow-sm">{productData.physical_samples?.[0]?.catalog_box_number || "—"}</div>
                                )}
                              </div>
                           </div>
                         </div>

                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Library Approval Status</Label>
                               {isEditMode ? (
                                 <Select value={productData.catalog_status} onValueChange={v => setProductData({...productData, catalog_status: v as LibraryItemStatus})}>
                                   <SelectTrigger className={cn("h-12 border-transparent text-xs font-bold", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                     <SelectValue />
                                   </SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="APPROVED" className="text-emerald-600 font-bold">Approved (Visible to All)</SelectItem>
                                     <SelectItem value="PENDING" className="text-amber-600 font-bold">Pending (Queue)</SelectItem>
                                     <SelectItem value="REJECTED" className="text-rose-600 font-bold">Rejected (Hidden)</SelectItem>
                                   </SelectContent>
                                 </Select>
                               ) : (
                                 <div className={cn("h-12 px-4 flex items-center text-[10px] font-black uppercase tracking-widest", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                   <span className={cn(
                                     productData.catalog_status === "APPROVED" ? "text-emerald-600" :
                                     productData.catalog_status === "PENDING" ? "text-amber-600" : "text-rose-600"
                                   )}>
                                     {productData.catalog_status}
                                   </span>
                                 </div>
                               )}
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Search Tags</Label>
                               {isEditMode ? (
                                 <TagInput tags={productData.catalog_tags || []} onChange={catalog_tags => setProductData({...productData, catalog_tags})} placeholder="Type and press enter..." />
                               ) : (
                                 <div className="flex flex-wrap gap-1.5 mt-3">
                                   {productData.catalog_tags?.length ? productData.catalog_tags.map(tag => (
                                     <span key={tag} className="px-3 py-1 bg-slate-100 text-[10px] font-bold uppercase tracking-tighter rounded-full">{tag}</span>
                                   )) : <span className="text-slate-300 text-xs italic">No tags</span>}
                                 </div>
                               )}
                            </div>
                         </div>
                      </div>
                    </div>

                    {/* Section 4: Media */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-1 bg-slate-900 rounded-full" />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Visual Assets & References</h4>
                      </div>
                      <div className="flex flex-col items-center justify-center py-6">
                        <div className="w-56">
                          {isEditMode ? (
                            <UniversalImageUploader
                              initialImageUrl={productData.catalog_image_url}
                              onUploadComplete={({ original, cover }) => {
                                setProductData(prev => ({
                                  ...prev,
                                  catalog_image_original_url: original,
                                  catalog_image_url: cover
                                }));
                              }}
                              className="shadow-2xl shadow-slate-200 rounded-[24px]"
                            />
                          ) : (
                            <div className="w-full aspect-square bg-white rounded-[24px] shadow-2xl shadow-slate-200 overflow-hidden border border-slate-100">
                              {productData.catalog_image_url ? (
                                <img src={productData.catalog_image_url} alt="Product" className="w-full h-full object-cover" />
                              ) : (
                                <ImagePlaceholder iconSize={48} />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-center space-y-1 mt-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Master Catalog Hero Image</p>
                          {isEditMode && <p className="text-[10px] text-slate-400 italic">Recommended: 1000x1000px, White Background.</p>}
                        </div>
                      </div>
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Reference URL</Label>
                              {isEditMode ? (
                                <Input value={productData.catalog_reference_url || ""} onChange={e => setProductData({...productData, catalog_reference_url: e.target.value})} placeholder="https://..." className={cn("h-11 border-none", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)} />
                              ) : (
                                <div className={cn("h-11 px-4 flex items-center text-xs font-medium text-slate-600 truncate", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                  {productData.catalog_reference_url || "—"}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Asset Folder</Label>
                              {isEditMode ? (
                                <Input value={productData.catalog_folder_url || ""} onChange={e => setProductData({...productData, catalog_folder_url: e.target.value})} placeholder="Drive Link..." className={cn("h-11 border-none", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)} />
                              ) : (
                                <div className={cn("h-11 px-4 flex items-center text-xs font-medium text-slate-600 truncate", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                  {productData.catalog_folder_url || "—"}
                                </div>
                              )}
                            </div>
                         </div>
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
                    {/* VENDOR FORM */}
                    <div className="space-y-6">
                       <div className="flex items-center gap-3">
                         <div className="h-6 w-1 bg-slate-900 rounded-full" />
                         <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Brand Identity</h4>
                       </div>
                       <div className="grid gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Public Brand Name *</Label>
                            {isEditMode ? (
                              <Input value={vendorData.brand_name} onChange={e => setVendorData({...vendorData, brand_name: e.target.value})} className={cn("h-12 border-none font-bold text-lg", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)} placeholder="e.g. TACO" />
                            ) : (
                              <div className={cn("h-12 px-4 flex items-center bg-slate-900 text-white font-bold text-lg", UI_ENGINE_RADIUS_CONTROL)}>
                                {vendorData.brand_name || "—"}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Legal Entity (PT)</Label>
                               {isEditMode ? (
                                 <Input value={vendorData.company_pt} onChange={e => setVendorData({...vendorData, company_pt: e.target.value})} className={cn("h-11 border-none", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)} placeholder="e.g. PT Arta Prima" />
                               ) : (
                                 <div className={cn("h-11 px-4 flex items-center text-sm font-bold", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                   {vendorData.company_pt || "—"}
                                 </div>
                               )}
                             </div>
                             <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Business Name</Label>
                               {isEditMode ? (
                                 <Input value={vendorData.company_name} onChange={e => setVendorData({...vendorData, company_name: e.target.value})} className={cn("h-11 border-none", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)} placeholder="e.g. Taco Group" />
                               ) : (
                                 <div className={cn("h-11 px-4 flex items-center text-sm font-bold", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                   {vendorData.company_name || "—"}
                                 </div>
                               )}
                             </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Headquarters Address</Label>
                            {isEditMode ? (
                              <textarea value={vendorData.address} onChange={e => setVendorData({...vendorData, address: e.target.value})} className={cn("w-full h-32 border-none p-6 text-sm font-medium resize-none", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)} placeholder="Full legal or business address..." />
                            ) : (
                              <div className={cn("w-full min-h-[80px] p-6 text-sm font-medium leading-relaxed", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                {vendorData.address || "—"}
                              </div>
                            )}
                          </div>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-6 w-1 bg-slate-900 rounded-full" />
                            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Authorized Contacts</h4>
                          </div>
                          {isEditMode && (
                            <Button variant="outline" size="sm" onClick={addContact} className={cn("text-[10px] font-black uppercase tracking-widest h-9 px-6 border-slate-200 hover:bg-slate-900 hover:text-white transition-all", UI_ENGINE_RADIUS_ACTION)}>
                              + Add Person
                            </Button>
                          )}
                       </div>
                       <div className="space-y-6">
                          {vendorData.contacts.map((contact, idx) => (
                            <div key={idx} className={cn("p-8 border relative group transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-100", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
                               {vendorData.contacts.length > 1 && isEditMode && (
                                 <Button variant="ghost" size="icon" onClick={() => removeContact(idx)} className="absolute -top-3 -right-3 h-8 w-8 bg-slate-900 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                   <X className="h-4 w-4" />
                                 </Button>
                               )}
                               <div className="grid grid-cols-2 gap-6">
                                  <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Full Name</Label>
                                    {isEditMode ? (
                                      <Input value={contact.contact_person} onChange={e => updateContact(idx, "contact_person", e.target.value)} className="h-10 bg-white border-none shadow-sm" />
                                    ) : (
                                      <div className="h-10 px-4 flex items-center bg-white rounded-lg text-xs font-bold shadow-sm">{contact.contact_person || "—"}</div>
                                    )}
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Job Role</Label>
                                    {isEditMode ? (
                                      <Input value={contact.contact_role} onChange={e => updateContact(idx, "contact_role", e.target.value)} className="h-10 bg-white border-none shadow-sm" />
                                    ) : (
                                      <div className="h-10 px-4 flex items-center bg-white rounded-lg text-xs font-bold shadow-sm">{contact.contact_role || "—"}</div>
                                    )}
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">WhatsApp / Phone</Label>
                                    {isEditMode ? (
                                      <Input value={contact.phone_number || ""} onChange={e => updateContact(idx, "phone_number", e.target.value)} className="h-10 bg-white border-none shadow-sm" />
                                    ) : (
                                      <div className="h-10 px-4 flex items-center bg-white rounded-lg text-xs font-bold shadow-sm">{contact.phone_number || "—"}</div>
                                    )}
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Email Address</Label>
                                    {isEditMode ? (
                                      <Input value={contact.email || ""} onChange={e => updateContact(idx, "email", e.target.value)} className="h-10 bg-white border-none shadow-sm" />
                                    ) : (
                                      <div className="h-10 px-4 flex items-center bg-white rounded-lg text-xs font-bold shadow-sm">{contact.email || "—"}</div>
                                    )}
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="flex items-center gap-3">
                         <div className="h-6 w-1 bg-slate-900 rounded-full" />
                         <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Digital Presence</h4>
                       </div>
                       <div className="grid gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Official Website</Label>
                            <div className="relative">
                              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              {isEditMode ? (
                                <Input value={vendorData.website_url} onChange={e => setVendorData({...vendorData, website_url: e.target.value})} className={cn("h-12 border-none pl-12", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)} placeholder="https://..." />
                              ) : (
                                <div className={cn("h-12 pl-12 pr-4 flex items-center text-xs font-medium text-slate-900 underline truncate", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                  <a href={vendorData.website_url} target="_blank" rel="noopener noreferrer">{vendorData.website_url || "—"}</a>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Instagram Handle</Label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                              {isEditMode ? (
                                <Input value={vendorData.instagram_url} onChange={e => setVendorData({...vendorData, instagram_url: e.target.value})} className={cn("h-12 border-none pl-10", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)} placeholder="username" />
                              ) : (
                                <div className={cn("h-12 pl-10 pr-4 flex items-center text-xs font-medium text-slate-900 truncate", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                  {vendorData.instagram_url || "—"}
                                </div>
                              )}
                            </div>
                          </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className={cn("p-10 pt-6 border-t flex items-center justify-between", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE)}>
              <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className={cn("h-12 px-10 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-950 hover:bg-slate-100/50", UI_ENGINE_RADIUS_CONTROL)}
              >
                {isEditMode ? "Discard Changes" : "Close Viewer"}
              </Button>
              {isEditMode && canEdit && (
                <Button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || !isFormValid}
                  className={cn("bg-slate-900 hover:bg-slate-800 text-white h-12 px-12 shadow-2xl shadow-slate-200 font-black text-[10px] uppercase tracking-widest gap-2 transition-all disabled:opacity-50 disabled:grayscale", UI_ENGINE_RADIUS_CONTROL)}
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5" /> Commit to Library</>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
