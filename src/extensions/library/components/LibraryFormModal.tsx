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
import { createVendorAction, updateVendorAction, createMaterialAction, updateMaterialAction } from "../actions/library-actions";
import { TagInput } from "@/components/ui/tag-input";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { LibraryVendor, MaterialCatalogWithRelations, LibraryVendorInput, MaterialCatalogInput } from "../types";
import { LibraryItemStatus } from "@/generated/prisma";
import { toast } from "sonner";
import { Loader2, Image as ImageIcon, Link as LinkIcon, Info, Warehouse, Users, Crop, Palette, Layers, ChevronDown, ChevronUp } from "lucide-react";
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import { UniversalImageUploader } from "@/components/ui/universal-image-uploader";

type FormType = "VENDOR" | "MATERIAL";

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
  /** Categories belonging to the MATERIAL section from PrefixDictionary */
  materialCategories?: string[];
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
  materialCategories = [],
  fixtureCategories = [],
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

  // Section for grouped category picker (MATERIAL or FIXTURE)
  const [materialSection, setMaterialSection] = React.useState<"MATERIAL" | "FIXTURE">("MATERIAL");

  // Material Form State (Catalog + Single Physical Sample for ease of use)
  const [materialData, setMaterialData] = React.useState<MaterialCatalogInput>({
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
    catalog_rak_location: "",
    catalog_box_number: "",
    catalog_price: null,
    metadata: undefined,
    status: "APPROVED" as LibraryItemStatus,
    physical_samples: [{ location_rak: "", container_box: "", notes: "" }]
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
        const materialInitial = initialData as MaterialCatalogWithRelations;
        const physical = materialInitial.physical_samples?.[0] || { location_rak: "", container_box: "", notes: "" };
        setMaterialData({
          vendor_id: materialInitial.vendor_id || "",
          catalog_category: materialInitial.catalog_category || "",
          catalog_sub_category: materialInitial.catalog_sub_category || "",
          catalog_sku: materialInitial.catalog_sku || "",
          catalog_product_name: materialInitial.catalog_product_name || "",
          catalog_motif: materialInitial.catalog_motif || "",
          tags: materialInitial.tags || [],
          catalog_dimension_p: materialInitial.catalog_dimension_p || "",
          catalog_dimension_l: materialInitial.catalog_dimension_l || "",
          catalog_dimension_t: materialInitial.catalog_dimension_t || "",
          catalog_dimension_unit: materialInitial.catalog_dimension_unit || "cm",
          catalog_color: materialInitial.catalog_color || "",
          catalog_finishing: materialInitial.catalog_finishing || "",
          catalog_image_url: materialInitial.catalog_image_url || "",
          catalog_image_original_url: materialInitial.catalog_image_original_url || "",
          catalog_reference_url: materialInitial.catalog_reference_url || "",
          catalog_folder_url: materialInitial.catalog_folder_url || "",
          catalog_rak_location: materialInitial.catalog_rak_location || "",
          catalog_box_number: materialInitial.catalog_box_number || "",
          catalog_price: materialInitial.catalog_price || null,
          metadata: (materialInitial.metadata as Record<string, unknown> | null) || undefined,
          status: materialInitial.status || "APPROVED",
          physical_samples: [{ 
            location_rak: physical.location_rak || "", 
            container_box: physical.container_box || "", 
            notes: physical.notes || "" 
          }]
        });

        // Auto-show advanced if data exists
        const hasAdvancedData = Boolean(
          materialInitial.catalog_sub_category || 
          materialInitial.catalog_motif || 
          materialInitial.catalog_color || 
          materialInitial.catalog_finishing || 
          materialInitial.catalog_dimension_p || 
          (materialInitial.tags && materialInitial.tags.length > 0)
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
      setMaterialData({
        vendor_id: vendors[0]?.id || "",
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
        catalog_rak_location: "",
        catalog_box_number: "",
        catalog_price: null,
        metadata: undefined,
        status: "APPROVED",
        physical_samples: [{ location_rak: "", container_box: "", notes: "" }]
      });
      setMaterialSection("MATERIAL");
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

    if (type === "MATERIAL") {
      if (!materialData.vendor_id && !materialData.vendor_name?.trim()) {
        toast.error("Brand/Vendor is required");
        return;
      }
      if (!materialData.catalog_category?.trim()) {
        toast.error("Category is required");
        return;
      }
      if (!materialData.catalog_sku?.trim()) {
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
        const finalMaterial: MaterialCatalogInput = {
          ...materialData,
          section: materialSection,
          catalog_category: materialData.catalog_category.trim(),
          catalog_sku: materialData.catalog_sku.trim(),
          vendor_name: materialData.vendor_name?.trim() || undefined,
        };
        if (!finalMaterial.physical_samples?.[0]?.location_rak && !finalMaterial.physical_samples?.[0]?.container_box) {
            finalMaterial.physical_samples = [];
        }

        if (mode === "CREATE") {
          unwrapActionResult(await createMaterialAction(finalMaterial));
          toast.success("Material created successfully");
        } else {
          if (!editingId) throw new Error("Material id is missing");
          unwrapActionResult(await updateMaterialAction({ id: editingId, data: finalMaterial }));
          toast.success("Material updated successfully");
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
              {mode === "CREATE" ? "New" : "Edit"}{" "}
              {type === "VENDOR" ? "Vendor Account" : "Material Listing"}
            </DialogTitle>
            <p className="text-slate-400 text-xs font-inter uppercase tracking-[0.2em] font-bold mt-1">
              StudioFlow Library Management
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
                             <LinkIcon className="h-3 w-3 text-slate-400" /> Social & Online Presence
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
                      <ImageIcon className="h-3 w-3 text-slate-400" /> Smart Visual Showcase
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1">
                        <UniversalImageUploader
                          initialImageUrl={materialData.catalog_image_url}
                          onUploadComplete={({ original, cover }) => {
                            setMaterialData(prev => ({
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
                              value={materialData.catalog_reference_url || ""}
                              onChange={(e) => setMaterialData({ ...materialData, catalog_reference_url: e.target.value })}
                              placeholder="https://..."
                              className="bg-slate-50 border-none focus-visible:ring-slate-900 h-10 text-sm"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Google Drive Folder URL</Label>
                            <Input
                              value={materialData.catalog_folder_url || ""}
                              onChange={(e) => setMaterialData({ ...materialData, catalog_folder_url: e.target.value })}
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
                      <Info className="h-3 w-3 text-slate-400" /> Core Specifications
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2 col-span-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Select Brand *</Label>
                        <CreatableSearch
                          options={vendors.map(v => ({ id: v.id, name: v.brand_name }))}
                          value={materialData.vendor_id}
                          onSelect={(id, name) => {
                            setMaterialData({ ...materialData, vendor_id: id, vendor_name: name !== vendors.find(v => v.id === id)?.brand_name ? name : undefined });
                          }}
                          onCreate={(name) => {
                            setMaterialData({ ...materialData, vendor_id: "", vendor_name: name });
                          }}
                          allowFreeText
                          placeholder="Search existing or type new brand..."
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Category *</Label>
                        <CreatableSearch
                          groups={[
                            ...(materialCategories.length > 0 ? [{
                              label: "Material",
                              options: materialCategories.map(cat => ({ id: `MATERIAL:${cat}`, name: cat }))
                            }] : []),
                            ...(fixtureCategories.length > 0 ? [{
                              label: "Fixture",
                              options: fixtureCategories.map(cat => ({ id: `FIXTURE:${cat}`, name: cat }))
                            }] : []),
                            // Fallback: if no grouped data yet, show categories flat under Material
                            ...(materialCategories.length === 0 && fixtureCategories.length === 0 ? [{
                              label: "Material",
                              options: categories.map(cat => ({ id: `MATERIAL:${cat}`, name: cat }))
                            }] : []),
                          ]}
                          value={materialData.catalog_category ? `${materialSection}:${materialData.catalog_category}` : undefined}
                          onSelect={(id, name) => {
                            const parts = id.split(":");
                            const section = (parts[0] || "MATERIAL") as "MATERIAL" | "FIXTURE";
                            const cat = parts.slice(1).join(":") || name;
                            setMaterialSection(section);
                            setMaterialData({ ...materialData, catalog_category: cat });
                          }}
                          onCreate={(name) => {
                            // New categories default to the currently selected section
                            setMaterialData({ ...materialData, catalog_category: name.toUpperCase() });
                          }}
                          placeholder="Search or type new category..."
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Type / SKU *</Label>
                        <Input
                          value={materialData.catalog_sku}
                          onChange={(e) => setMaterialData({ ...materialData, catalog_sku: e.target.value })}
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
                            value={materialData.catalog_price || ""}
                            onChange={(e) => setMaterialData({ ...materialData, catalog_price: e.target.value ? Number(e.target.value) : null })}
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
                              <span className="text-xs font-bold uppercase tracking-widest block">Detailed Metadata</span>
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
                                value={materialData.catalog_sub_category || ""}
                                allowFreeText
                                onSelect={(_, name) => setMaterialData({ ...materialData, catalog_sub_category: name })}
                                onCreate={(name) => setMaterialData({ ...materialData, catalog_sub_category: name })}
                                placeholder="Select or type sub category..."
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Pattern / Motif</Label>
                              <Input
                                value={materialData.catalog_motif || ""}
                                onChange={(e) => setMaterialData({ ...materialData, catalog_motif: e.target.value })}
                                placeholder="e.g. Marble"
                                className="bg-slate-50 border-none h-10"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter flex items-center gap-1.5">
                                <Palette className="h-3 w-3" /> Color
                              </Label>
                              <Input
                                value={materialData.catalog_color || ""}
                                onChange={(e) => setMaterialData({ ...materialData, catalog_color: e.target.value })}
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
                                value={materialData.catalog_finishing || ""}
                                allowFreeText
                                onSelect={(_, name) => setMaterialData({ ...materialData, catalog_finishing: name })}
                                onCreate={(name) => setMaterialData({ ...materialData, catalog_finishing: name })}
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
                                  value={materialData.catalog_dimension_p || ""} 
                                  onChange={(e) => setMaterialData({...materialData, catalog_dimension_p: e.target.value})}
                                  placeholder="60"
                                  className="bg-slate-50 border-none h-9 text-sm text-center"
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label className="text-[9px] font-bold text-slate-400 uppercase text-center">L</Label>
                                <Input 
                                  value={materialData.catalog_dimension_l || ""} 
                                  onChange={(e) => setMaterialData({...materialData, catalog_dimension_l: e.target.value})}
                                  placeholder="60"
                                  className="bg-slate-50 border-none h-9 text-sm text-center"
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label className="text-[9px] font-bold text-slate-400 uppercase text-center">T</Label>
                                <Input 
                                  value={materialData.catalog_dimension_t || ""} 
                                  onChange={(e) => setMaterialData({...materialData, catalog_dimension_t: e.target.value})}
                                  placeholder="1"
                                  className="bg-slate-50 border-none h-9 text-sm text-center"
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label className="text-[9px] font-bold text-slate-400 uppercase text-center">Unit</Label>
                                <Select 
                                  value={materialData.catalog_dimension_unit} 
                                  onValueChange={(val) => setMaterialData({...materialData, catalog_dimension_unit: val})}
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
                              tags={materialData.tags || []}
                              onChange={(newTags) => setMaterialData({ ...materialData, tags: newTags })}
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
                      <Warehouse className="h-4 w-4" /> Physical Sample Inventory
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Rak Location</Label>
                        <Input
                          value={materialData.catalog_rak_location || ""}
                          onChange={(e) => {
                            setMaterialData({ ...materialData, catalog_rak_location: e.target.value });
                          }}
                          placeholder="Loc..."
                          className="bg-white border-none h-9 text-sm"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Box Number</Label>
                        <Input
                          value={materialData.catalog_box_number || ""}
                          onChange={(e) => {
                            setMaterialData({ ...materialData, catalog_box_number: e.target.value });
                          }}
                          placeholder="Box..."
                          className="bg-white border-none h-9 text-sm"
                        />
                      </div>
                    </div>
                    <Input
                      value={materialData.physical_samples?.[0]?.notes || ""}
                      onChange={(e) => {
                        const newSamples = [...(materialData.physical_samples || [])];
                        newSamples[0].notes = e.target.value;
                        setMaterialData({ ...materialData, physical_samples: newSamples });
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
                         <span className="text-[10px] font-black uppercase tracking-widest text-orange-950 font-inter">Approval Authority</span>
                       </div>
                       <div className="grid gap-2">
                         <Label className="text-[10px] font-bold text-orange-900 uppercase">Current Asset Status</Label>
                         <Select 
                            value={materialData.status} 
                            onValueChange={(val) => setMaterialData({...materialData, status: val as LibraryItemStatus})}
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
