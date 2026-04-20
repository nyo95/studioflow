"use client";

import * as React from "react";
import { DashboardPageShell, PageHeader } from "@/ui_engine";
import { LibraryTabs } from "@/extensions/library/components/LibraryTabs";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { getVendorsAction, getMaterialsAction, getLibraryCategoriesAction, getMyRoleAction, getMaterialMetadataAction, getGroupedCategoriesAction, getAllMaterialRequestsAction } from "@/extensions/library/actions/library-actions";
import { toast } from "sonner";
import { MaterialCatalogWithRelations, LibraryVendor, ProjectMaterialRequestWithDetails } from "@/extensions/library/types";

export default function LibraryPage() {
  const [vendors, setVendors] = React.useState<LibraryVendor[]>([]);
  const [materials, setMaterials] = React.useState<MaterialCatalogWithRelations[]>([]);
  const [requests, setRequests] = React.useState<ProjectMaterialRequestWithDetails[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [materialCategories, setMaterialCategories] = React.useState<string[]>([]);
  const [fixtureCategories, setFixtureCategories] = React.useState<string[]>([]);
  const [subCategories, setSubCategories] = React.useState<string[]>([]);
  const [finishings, setFinishings] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [showPhysicalOnly, setShowPhysicalOnly] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [role, setRole] = React.useState<string>("STAFF");

  React.useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [vendorsRes, materialsRes, catsRes, roleRes, metaRes, groupedCatsRes, requestsRes] = await Promise.all([
          getVendorsAction(undefined),
          getMaterialsAction(undefined),
          getLibraryCategoriesAction(undefined),
          getMyRoleAction(undefined),
          getMaterialMetadataAction(undefined),
          getGroupedCategoriesAction(undefined),
          getAllMaterialRequestsAction(undefined),
        ]);

        if (vendorsRes.success) setVendors(vendorsRes.data);
        if (materialsRes.success) setMaterials(materialsRes.data);
        if (requestsRes.success) setRequests(requestsRes.data);
        if (catsRes.success) setCategories(catsRes.data);
        if (roleRes.success) setRole(roleRes.data);
        if (metaRes.success) {
          setSubCategories(metaRes.data.subCategories);
          setFinishings(metaRes.data.finishings);
        }
        if (groupedCatsRes.success) {
          setMaterialCategories(groupedCatsRes.data.material);
          setFixtureCategories(groupedCatsRes.data.fixture);
        }
      } catch {
        toast.error("Failed to load library data");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const filteredMaterials = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return materials.filter((m) => {
      const matchesSearch =
        query.length === 0 ||
        m.catalog_product_name?.toLowerCase().includes(query) ||
        m.vendor?.brand_name?.toLowerCase().includes(query) ||
        m.catalog_category?.toLowerCase().includes(query) ||
        m.catalog_sub_category?.toLowerCase().includes(query) ||
        m.catalog_motif?.toLowerCase().includes(query) ||
        (m.tags && m.tags.some(tag => tag.toLowerCase().includes(query)));
      
      const matchesCategory = selectedCategory === "all" || m.catalog_category === selectedCategory;
      const matchesPhysical = !showPhysicalOnly || (m.physical_samples && m.physical_samples.length > 0);
      
      return matchesSearch && matchesCategory && matchesPhysical;
    });
  }, [materials, searchQuery, selectedCategory, showPhysicalOnly]);

  const filteredVendors = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return vendors.filter((vendor) => {
      if (query.length === 0) return true;
      return (
        vendor.brand_name?.toLowerCase().includes(query) ||
        vendor.company_name?.toLowerCase().includes(query) ||
        (vendor.contacts && vendor.contacts.some(c => c.contact_person?.toLowerCase().includes(query)))
      );
    });
  }, [vendors, searchQuery]);

  return (
    <DashboardPageShell className="max-w-[min(var(--ui-page-max-width,1280px),96rem)]">
      <div className="space-y-8 animate-in fade-in duration-700">
        <PageHeader
          eyebrow="Extension // Pillar 2"
          title="Digital Library"
          description="A curated catalog of materials, queue approval, vendor management, and physical sample tracking."
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-100 border-t-slate-900" />
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Catalog...</span>
            </div>
          </div>
        ) : (
          <ErrorBoundary name="Library">
            <LibraryTabs
              vendors={filteredVendors}
              materials={filteredMaterials}
              categories={categories}
              materialCategories={materialCategories}
              fixtureCategories={fixtureCategories}
              subCategories={subCategories}
              finishings={finishings}
              requests={requests}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              showPhysicalOnly={showPhysicalOnly}
              setShowPhysicalOnly={setShowPhysicalOnly}
              userRole={role}
            />
          </ErrorBoundary>
        )}
      </div>
    </DashboardPageShell>
  );
}
