"use client";

import * as React from "react";
import { DashboardPageShell, PageHeader } from "@/ui_engine";
import { LibraryTabs } from "@/extensions/library/components/LibraryTabs";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { 
  getVendorsAction, 
  getProductsAction, 
  getLibraryCategoriesAction, 
  getMyRoleAction, 
  getProductMetadataAction, 
  getGroupedCategoriesAction, 
  getAllProductRequestsAction,
  getPromotionRequestsAction 
} from "@/extensions/library/actions/library-actions";
import { toast } from "sonner";
import { ProductCatalogWithRelations, LibraryVendor, ProjectProductRequestWithDetails } from "@/extensions/library/types";
import { unwrapActionResult } from "@/lib/result";
import { useDebounce } from "@/hooks/use-debounce";
import { useSearchParams } from "next/navigation";

export default function LibraryPage() {
  const [vendors, setVendors] = React.useState<LibraryVendor[]>([]);
  const [products, setProducts] = React.useState<ProductCatalogWithRelations[]>([]);
  const [totalProducts, setTotalProducts] = React.useState(0);
  const [requests, setRequests] = React.useState<ProjectProductRequestWithDetails[]>([]);
  const [promotionRequests, setPromotionRequests] = React.useState<any[]>([]);
  
  const [categories, setCategories] = React.useState<string[]>([]);
  const [productCategories, setProductCategories] = React.useState<string[]>([]);
  const [fixtureCategories, setFixtureCategories] = React.useState<string[]>([]);
  const [subCategories, setSubCategories] = React.useState<string[]>([]);
  const [finishings, setFinishings] = React.useState<string[]>([]);
  
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "catalog";
  
  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedSearch = useDebounce(searchQuery, 400);
  
  const [activeTab, setActiveTab] = React.useState(currentTab);
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [showPhysicalOnly, setShowPhysicalOnly] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize] = React.useState(24);
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshingProducts, setIsRefreshingProducts] = React.useState(false);
  const [role, setRole] = React.useState<string>("STAFF");

  // Initial Data Load (Vendors, Metadata, Categories, Requests)
  React.useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [vendorsRes, catsRes, roleRes, metaRes, groupedCatsRes, requestsRes, promoRes] = await Promise.all([
          getVendorsAction(undefined),
          getLibraryCategoriesAction(undefined),
          getMyRoleAction(undefined),
          getProductMetadataAction(undefined),
          getGroupedCategoriesAction(undefined),
          getAllProductRequestsAction(undefined),
          getPromotionRequestsAction(undefined),
        ]);

        if (vendorsRes.success) setVendors(vendorsRes.data);
        if (requestsRes.success) setRequests(requestsRes.data);
        if (promoRes.success) setPromotionRequests(promoRes.data);
        if (catsRes.success) setCategories(catsRes.data);
        if (roleRes.success) setRole(roleRes.data);
        if (metaRes.success) {
          setSubCategories(metaRes.data.subCategories);
          setFinishings(metaRes.data.finishings);
        }
        if (groupedCatsRes.success) {
          setProductCategories(groupedCatsRes.data.material);
          setFixtureCategories(groupedCatsRes.data.fixture);
        }
      } catch {
        toast.error("Failed to load library metadata");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Product Data Load (Triggered by filters/pagination)
  const fetchProducts = React.useCallback(async () => {
    setIsRefreshingProducts(true);
    try {
      const statusFilter = activeTab === "queue" ? "PENDING" : activeTab === "catalog" ? "APPROVED" : undefined;
      
      const res = await getProductsAction({
        search: debouncedSearch,
        category: selectedCategory === "all" ? undefined : selectedCategory,
        hasPhysicalOnly: showPhysicalOnly,
        status: statusFilter,
        page: currentPage,
        pageSize: pageSize,
      });

      if (res.success) {
        setProducts(res.data.items);
        setTotalProducts(res.data.total);
      }
    } catch {
      toast.error("Failed to refresh catalog data");
    } finally {
      setIsRefreshingProducts(false);
    }
  }, [debouncedSearch, selectedCategory, showPhysicalOnly, currentPage, pageSize, activeTab]);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategory, showPhysicalOnly, activeTab]);

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
              vendors={vendors}
              products={products}
              totalProducts={totalProducts}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              categories={categories}
              productCategories={productCategories}
              fixtureCategories={fixtureCategories}
              subCategories={subCategories}
              finishings={finishings}
              requests={requests}
              promotionRequests={promotionRequests}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              showPhysicalOnly={showPhysicalOnly}
              setShowPhysicalOnly={setShowPhysicalOnly}
              userRole={role}
              isRefreshing={isRefreshingProducts}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </ErrorBoundary>
        )}
      </div>
    </DashboardPageShell>
  );
}
