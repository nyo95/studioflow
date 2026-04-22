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
import { Loader2, Image as ImageIcon, Link as LinkIcon, Info, Warehouse, Users, Crop, Palette, Layers, ChevronDown, ChevronUp } from "lucide-react";
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import { UniversalImageUploader } from "@/components/ui/universal-image-uploader";

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
  productCategories?: string[];
  /** Categories belonging to the FIXTURE section from PrefixDictionary */
  fixtureCategories?: string[];
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
  productCategories = [],
  ffeCategories = [],
  subCategories = [],
  finishings = [],
  onSuccess,
}: LibraryFormModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
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
  // Must align with Prisma `ProductType` enum.
  const [productSection, setProductSection] = React.useState<ProductType>(ProductType.material);

  // Product Form State (Catalog + Single Physical Sample for ease of use)
  const [productData, setProductData] = React.useState<ProductCatalogInput>({
    vendor_id: "",
    catalog_category: "HPL",
    catalog_sub_category: "",
    catalog_sku: "",
    catalog_product_name: "",
    catalog_motif: "",
    tags: [],
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
    metadata: undefined,
    status: "APPROVED" as LibraryItemStatus,
    physical_samples: [{ rack_number: "", box_number: "", notes: "" }]
  });

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  React.useEffect(() => {
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
        const physical = productInitial.physical_samples?.[0] || { rack_number: "", box_number: "", notes: "" };
        setProductData({
          vendor_id: productInitial.vendor_id || "",
          catalog_category: productInitial.catalog_category || "",
          catalog_sub_category: productInitial.catalog_sub_category || "",
          catalog_sku: productInitial.catalog_sku || "",
          catalog_product_name: productInitial.catalog_product_name || "",
          catalog_motif: productInitial.catalog_motif || "",
          tags: productInitial.tags || [],
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
          metadata: (productInitial.metadata as Record<string, unknown> | null) || undefined,
          status: productInitial.status || "APPROVED",
          physical_samples: [{ 
            rack_number: physical.rack_number || "", 
            box_number: physical.box_number || "", 
            notes: physical.notes || "" 
          }]
        });

        // Auto-show advanced if data exists
        const hasAdvancedData = Boolean(
          productInitial.catalog_sub_category || 
          productInitial.catalog_motif || 
          productInitial.catalog_color || 
          productInitial.catalog_finishing || 
          productInitial.catalog_dimension_p || 
          (productInitial.tags && productInitial.tags.length > 0)
        );
        setShowAdvanced(hasAdvancedData);
      }
    } else {
      // Reset
      setVendorData({
        brand_name: "",
        company_name: "",
        company_pt: "",
        address: "",
        website_url: "",
        instagram_url: "",
        contacts: [{ contact_person: "", contact_role: "Sales" }],
      });
      setProductData({
        vendor_id: vendors[0]?.id || "",
        catalog_category: "GENERAL",
        catalog_sub_category: "",
        catalog_sku: "",
        catalog_product_name: "",
        catalog_motif: "",
        tags: [],
        catalog_dimension_p: "",
        catalog_dimension_l: "",
        catalog_dimension_t: "",
        catalog_dimension_unit: "cm",
        catalog_color: "",
        catalog_finishing: "",
        catalog_price: null,
        metadata: undefined,
        status: "APPROVED",
        physical_samples: [{ rack_number: "", box_number: "", notes: "" }]
      });
      setProductSection(ProductType.material);
      setShowAdvanced(false);
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

  // Image Handling replaced by UniversalImageUploader

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (type === "PRODUCT") {
      if (!productData.vendor_id && !productData.vendor_name?.trim()) {
        toast.error("Brand/Vendor is required");
        return;
      }
      if (!productData.catalog_category?.trim()) {
        toast.error("Category is required");
        return;
      }
      if (!productData.catalog_sku?.trim()) {
        toast.error("Type / SKU is required");
        return;
      }
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
        // Clean up empty physical sample if not fully filled
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/cd158293-dca0-40ab-802e-0d83dd59ba8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H2',location:'src/extensions/library/components/LibraryFormModal.tsx:handleSubmit',message:'Submitting product form',data:{productSection,type,mode},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        const finalProduct: ProductCatalogInput = {
          ...productData,
          section: productSection,
          catalog_category: productData.catalog_category.trim(),
          catalog_sku: productData.catalog_sku.trim(),
          vendor_name: productData.vendor_name?.trim() || undefined,
        };
        if (!finalProduct.physical_samples?.[0]?.rack_number && !finalProduct.physical_samples?.[0]?.box_number) {
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
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle className="font-lora text-2xl font-medium tracking-tight">
              {mode === "CREATE" ? "Add" : "Edit"}{" "}
              {type === "VENDOR" ? "Vendor" : "Product"}
            </DialogTitle>
            <p className="text-slate-400 text-xs font-inter uppercase tracking-[0.2em] font-bold mt-1">
              Library Management
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="p-6 space-y-8">
              {type === "VENDOR" ? (
                <div className="grid gap-8">
                    {/* BRAND SECTION */}
                    <div className="space-y-4">
                        <Label className="text-slate-900 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                             <Info className="h-3 w-3 text-slate-400" /> Basic Information
                        </Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="brand_name" className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Brand Name *</Label>
                                <Input
                                    id="brand_name"
                                    value={vendorData.brand_name}
                                    onChange={(e) => setVendorData({ ...vendorData, brand_name: e.target.value })}
                                    placeholder="e.g. Taco, Aica"
                                    className="bg-slate-50 border-none focus-visible:ring-slate-900 h-10"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="company_name" className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Legal Company Name (PT)</Label>
                                <Input
                                    id="company_pt"
                                    value={vendorData.company_pt}
                                    onChange={(e) => setVendorData({ ...vendorData, company_pt: e.target.value })}
                                    placeholder="e.g. PT Arta Prima Utama"
                                    className="bg-slate-50 border-none focus-visible:ring-slate-900 h-10"
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="company_brand_desc" className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Business / Brand Name</Label>
                            <Input
                                id="company_name"
                                value={vendorData.company_name}
                                onChange={(e) => setVendorData({ ...vendorData, company_name: e.target.value })}
                                placeholder="e.g. Taco Group"
                                className="bg-slate-50 border-none focus-visible:ring-slate-900 h-10"
                            />
                        </div>
                    </div>

                    {/* CONTACTS SECTION */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-slate-900 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                                <Users className="h-3 w-3 text-slate-400" /> Authorized Contacts
                            </Label>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={addContact}
                                className="h-7 text-[10px] font-bold text-slate-500 hover:text-slate-900"
                            >
                                + Add Contact
                            </Button>
                        </div>
                        
                        <div className="grid gap-4">
                            {vendorData.contacts.map((contact, index) => (
                                <div key={index} className="relative grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-100 bg-white shadow-sm ring-1 ring-slate-100">
                                    {vendorData.contacts.length > 1 && (
                                        <button 
                                            type="button" 
                                            onClick={() => removeContact(index)}
                                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs shadow-lg transition-transform hover:scale-110"
                                        >
                                            ×
                                        </button>
                                    )}
                                    <div className="grid gap-2 col-span-2 md:col-span-1">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Contact Person *</Label>
                                        <Input
                                            value={contact.contact_person}
                                            onChange={(e) => updateContact(index, "contact_person", e.target.value)}
                                            className="bg-slate-50 border-none focus-visible:ring-slate-900 h-9"
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2 col-span-2 md:col-span-1">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Role</Label>
                                        <CreatableSearch
                                            options={CONTACT_ROLES.map(r => ({ id: r, name: r }))}
                                            value={contact.contact_role}
                                            allowFreeText
                                            onSelect={(_, name) => updateContact(index, "contact_role", name)}
                                            onCreate={(name) => updateContact(index, "contact_role", name)}
                                            placeholder="Select or type role..."
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Input
                                            value={contact.phone_number || ""}
                                            onChange={(e) => updateContact(index, "phone_number", e.target.value)}
                                            placeholder="Phone Number"
                                            className="bg-slate-50 border-none h-9 text-xs"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Input
                                            value={contact.email || ""}
                                            onChange={(e) => updateContact(index, "email", e.target.value)}
                                            placeholder="Email Address"
                                            className="bg-slate-50 border-none h-9 text-xs"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* INFO SECTION */}
                    <div className="space-y-4">
                        <Label className="text-slate-900 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                             <LinkIcon className="h-3 w-3 text-slate-400" /> Web & Social
                        </Label>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                value={vendorData.website_url}
                                onChange={(e) => setVendorData({ ...vendorData, website_url: e.target.value })}
                                placeholder="Website (https://...)"
                                className="bg-slate-50 border-none h-10 text-sm"
                            />
                            <Input
                                value={vendorData.instagram_url}
                                onChange={(e) => setVendorData({ ...vendorData, instagram_url: e.target.value })}
                                placeholder="Instagram (@...)"
                                className="bg-slate-50 border-none h-10 text-sm"
                            />
                        </div>
                        <textarea
                            value={vendorData.address}
                            onChange={(e) => setVendorData({ ...vendorData, address: e.target.value })}
                            placeholder="HQ/Showroom Address"
                            className="flex w-full rounded-md bg-slate-50 px-3 py-2 text-sm border-none ring-offset-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 resize-none h-20"
                        />
                    </div>
                </div>
              ) : (
                <div className="grid gap-8">
                  {/* DIGITAL CATALOG SECTION */}
                  <div className="space-y-4">
                    <Label className="text-slate-900 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon className="h-3 w-3 text-slate-400" /> Images & Links
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1">
                        <UniversalImageUploader
                          initialImageUrl={productData.catalog_image_url}
                          onUploadComplete={({ original, cover }) => {
                            setProductData(prev => ({
                              ...prev,
                              catalog_image_original_url: original,
                              catalog_image_url: cover
                            }));
                          }}
                          label="Cover Image"
                          className="aspect-square"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Tokopedia / PDF Catalog URL</Label>
                            <Input
                              value={productData.catalog_reference_url || ""}
                              onChange={(e) => setProductData({ ...productData, catalog_reference_url: e.target.value })}
                              placeholder="https://..."
                              className="bg-slate-50 border-none focus-visible:ring-slate-900 h-10 text-sm"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Google Drive Folder URL</Label>
                            <Input
                              value={productData.catalog_folder_url || ""}
                              onChange={(e) => setProductData({ ...productData, catalog_folder_url: e.target.value })}
                              placeholder="https://drive..."
                              className="bg-slate-50 border-none focus-visible:ring-slate-900 h-10 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MATERIAL SPECS */}
                  <div className="space-y-4">
                    <Label className="text-slate-900 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                      <Info className="h-3 w-3 text-slate-400" /> Specifications
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2 col-span-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Select Brand *</Label>
                        <CreatableSearch
                          options={vendors.map(v => ({ id: v.id, name: v.brand_name }))}
                          value={productData.vendor_id}
                          onSelect={(id, name) => {
                            setProductData({ ...productData, vendor_id: id, vendor_name: name !== vendors.find(v => v.id === id)?.brand_name ? name : undefined });
                          }}
                          onCreate={(name) => {
                            setProductData({ ...productData, vendor_id: "", vendor_name: name });
                          }}
                          allowFreeText
                          placeholder="Search existing or type new brand..."
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Category *</Label>
                        <CreatableSearch
                          groups={[
                            ...(productCategories.length > 0 ? [{
                              label: "Product",
                              options: productCategories.map(cat => ({ id: `${ProductType.material}:${cat}`, name: cat }))
                            }] : []),
                            ...(ffeCategories.length > 0 ? [{
                              label: "FF&E",
                              options: ffeCategories.map(cat => ({ id: `${ProductType.fixture}:${cat}`, name: cat }))
                            }] : []),
                            // Fallback: if no grouped data yet, show categories flat
                            ...(productCategories.length === 0 && ffeCategories.length === 0 ? [{
                              label: "Product",
                              options: categories.map(cat => ({ id: `${ProductType.material}:${cat}`, name: cat }))
                            }] : []),
                          ]}
                          value={productData.catalog_category ? `${productSection}:${productData.catalog_category}` : undefined}
                          onSelect={(id, name) => {
                            const parts = id.split(":");
                            const section = (parts[0] || ProductType.material) as ProductType;
                            const cat = parts.slice(1).join(":") || name;
                            setProductSection(section);
                            setProductData({ ...productData, catalog_category: cat });
                          }}
                          onCreate={(name) => {
                            // New categories default to the currently selected section
                            setProductData({ ...productData, catalog_category: name.toUpperCase() });
                          }}
                          placeholder="Search or type new category..."
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Type / SKU *</Label>
                        <Input
                          value={productData.catalog_sku}
                          onChange={(e) => setProductData({ ...productData, catalog_sku: e.target.value })}
                          className="bg-slate-50 border-none h-10"
                          placeholder="e.g. Model SKU"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter flex items-center gap-1.5">Pricing Estimate</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                          <Input
                            type="number"
                            value={productData.catalog_price || ""}
                            onChange={(e) => setProductData({ ...productData, catalog_price: e.target.value ? Number(e.target.value) : null })}
                            className="bg-slate-50 border-none h-10 pl-9"
                            placeholder="Optional..."
                          />
                        </div>
                      </div>

                      {/* ADVANCED TOGGLE */}
                      <div className="col-span-2 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="w-full flex items-center justify-between px-4 py-6 bg-slate-50 hover:bg-slate-100 rounded-xl group transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-lg transition-colors",
                              showAdvanced ? "bg-slate-900 text-white" : "bg-white text-slate-400 group-hover:text-slate-600 shadow-sm"
                            )}>
                              <Layers className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                              <span className="text-xs font-bold uppercase tracking-widest block">Details</span>
                              <span className="text-[10px] text-slate-400 font-medium">Color, Finishing, Dimensions, etc.</span>
                            </div>
                          </div>
                          {showAdvanced ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </Button>
                      </div>

                      {showAdvanced && (
                        <div className="col-span-2 space-y-6 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Sub Category</Label>
                              <CreatableSearch
                                options={subCategories.map(s => ({ id: s, name: s }))}
                                value={productData.catalog_sub_category || ""}
                                allowFreeText
                                onSelect={(_, name) => setProductData({ ...productData, catalog_sub_category: name })}
                                onCreate={(name) => setProductData({ ...productData, catalog_sub_category: name })}
                                placeholder="Select or type sub category..."
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Pattern / Motif</Label>
                              <Input
                                value={productData.catalog_motif || ""}
                                onChange={(e) => setProductData({ ...productData, catalog_motif: e.target.value })}
                                placeholder="e.g. Marble"
                                className="bg-slate-50 border-none h-10"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter flex items-center gap-1.5">
                                <Palette className="h-3 w-3" /> Color
                              </Label>
                              <Input
                                value={productData.catalog_color || ""}
                                onChange={(e) => setProductData({ ...productData, catalog_color: e.target.value })}
                                placeholder="e.g. Charcoal"
                                className="bg-white border-slate-100 h-10"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter flex items-center gap-1.5">
                                <Layers className="h-3 w-3" /> Finishing
                              </Label>
                              <CreatableSearch
                                options={[
                                  ...FINISHING_PRESETS,
                                  ...finishings.filter(f => !FINISHING_PRESETS.some(p => p.toLowerCase() === f.toLowerCase()))
                                ].map(f => ({ id: f, name: f }))}
                                value={productData.catalog_finishing || ""}
                                allowFreeText
                                onSelect={(_, name) => setProductData({ ...productData, catalog_finishing: name })}
                                onCreate={(name) => setProductData({ ...productData, catalog_finishing: name })}
                                placeholder="Select or type finishing..."
                              />
                            </div>
                          </div>

                          <div className="grid gap-2 border-t border-slate-100 pt-4">
                            <Label className="text-slate-900 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                              <Crop className="h-3.5 w-3.5 text-slate-400" /> Physical Dimensions (P x L x T)
                            </Label>
                            <div className="grid grid-cols-4 gap-3">
                              <div className="grid gap-1.5">
                                <Label className="text-[9px] font-bold text-slate-400 uppercase text-center">P</Label>
                                <Input 
                                  value={productData.catalog_dimension_p || ""} 
                                  onChange={(e) => setProductData({...productData, catalog_dimension_p: e.target.value})}
                                  placeholder="60"
                                  className="bg-slate-50 border-none h-9 text-sm text-center"
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label className="text-[9px] font-bold text-slate-400 uppercase text-center">L</Label>
                                <Input 
                                  value={productData.catalog_dimension_l || ""} 
                                  onChange={(e) => setProductData({...productData, catalog_dimension_l: e.target.value})}
                                  placeholder="60"
                                  className="bg-slate-50 border-none h-9 text-sm text-center"
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label className="text-[9px] font-bold text-slate-400 uppercase text-center">T</Label>
                                <Input 
                                  value={productData.catalog_dimension_t || ""} 
                                  onChange={(e) => setProductData({...productData, catalog_dimension_t: e.target.value})}
                                  placeholder="1"
                                  className="bg-slate-50 border-none h-9 text-sm text-center"
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label className="text-[9px] font-bold text-slate-400 uppercase text-center">Unit</Label>
                                <Select 
                                  value={productData.catalog_dimension_unit} 
                                  onValueChange={(val) => setProductData({...productData, catalog_dimension_unit: val})}
                                >
                                  <SelectTrigger className="bg-slate-50 border-none h-9 text-xs font-bold px-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="cm">cm</SelectItem>
                                    <SelectItem value="mm">mm</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-2 border-t border-slate-100 pt-4">
                            <Label className="text-slate-900 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                              <Info className="h-3.5 w-3.5 text-slate-400" /> Search Tags
                            </Label>
                            <TagInput
                              tags={productData.tags || []}
                              onChange={(newTags) => setProductData({ ...productData, tags: newTags })}
                              placeholder="Type and press enter..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PHYSICAL INVENTORY */}
                  <div className="p-5 rounded-2xl bg-slate-900/5 ring-1 ring-slate-900/10 space-y-4">
                    <Label className="text-slate-900 font-bold text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                      <Warehouse className="h-4 w-4" /> Samples
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Rak Location</Label>
                        <Input
                          value={productData.physical_samples?.[0]?.rack_number || ""}
                          onChange={(e) => {
                            const newSamples = [...(productData.physical_samples || [{ rack_number: "", box_number: "", notes: "" }])];
                            newSamples[0] = { ...newSamples[0], rack_number: e.target.value };
                            setProductData({ ...productData, physical_samples: newSamples });
                          }}
                          placeholder="Loc..."
                          className="bg-white border-none h-9 text-sm"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Box Number</Label>
                        <Input
                          value={productData.physical_samples?.[0]?.box_number || ""}
                          onChange={(e) => {
                            const newSamples = [...(productData.physical_samples || [{ rack_number: "", box_number: "", notes: "" }])];
                            newSamples[0] = { ...newSamples[0], box_number: e.target.value };
                            setProductData({ ...productData, physical_samples: newSamples });
                          }}
                          placeholder="Box..."
                          className="bg-white border-none h-9 text-sm"
                        />
                      </div>
                    </div>
                    <Input
                      value={productData.physical_samples?.[0]?.notes || ""}
                      onChange={(e) => {
                        const newSamples = [...(productData.physical_samples || [{ rack_number: "", box_number: "", notes: "" }])];
                        newSamples[0] = { ...newSamples[0], notes: e.target.value };
                        setProductData({ ...productData, physical_samples: newSamples });
                      }}
                      placeholder="Internal notes..."
                      className="bg-white border-none h-9 text-xs italic"
                    />
                  </div>

                  {/* STATUS MANAGEMENT (ADMIN/STAFF ONLY) */}
                  {(((initialData as { status?: LibraryItemStatus } | undefined)?.status === "PENDING")
                    || ((initialData as { status?: LibraryItemStatus } | undefined)?.status === "REJECTED")) && (
                    <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 space-y-3">
                       <div className="flex items-center gap-2">
                         <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-orange-950 font-inter">Approval Status</span>
                       </div>
                       <div className="grid gap-2">
                         <Label className="text-[10px] font-bold text-orange-900 uppercase">Current Status</Label>
                         <Select 
                            value={productData.status} 
                            onValueChange={(val) => setProductData({...productData, status: val as LibraryItemStatus})}
                         >
                            <SelectTrigger className="bg-white border-orange-200 h-10 text-sm font-bold text-slate-900 shadow-sm transition-all focus:ring-orange-500">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="APPROVED" className="font-bold text-emerald-600">Approved (Show in Catalog)</SelectItem>
                              <SelectItem value="PENDING" className="font-bold text-orange-500">Queue (Waiting for Review)</SelectItem>
                              <SelectItem value="REJECTED" className="font-bold text-rose-500">Rejected (Hidden)</SelectItem>
                            </SelectContent>
                         </Select>
                       </div>
                       <p className="text-[9px] text-orange-700/70 font-medium italic">Approval makes this item visible to the entire design team in the main catalog.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[10px] text-slate-400 font-medium max-w-[200px]">
                  * Required fields must be filled for system integrity.
              </p>
              <div className="flex gap-3">
                  <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onOpenChange(false)}
                      disabled={isSubmitting}
                      className="text-slate-500 hover:text-slate-900 font-bold text-xs uppercase tracking-widest px-6"
                  >
                      Discard
                  </Button>
                  <Button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-8 h-10 font-bold text-xs uppercase tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-95"
                  >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalize Record"}
                  </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </>
  );
}
