"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Search, Filter, Warehouse, Plus, LayoutGrid, Clock, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductCatalogWithRelations, LibraryVendor, ProjectProductRequestWithDetails } from "../types";
import { ProductGrid } from "./catalog/ProductGrid";
import { Button } from "@/components/ui/button";

import dynamic from "next/dynamic";

const VendorTable = dynamic(
  () => import("./VendorTable").then((mod) => mod.VendorTable),
  { ssr: false }
);

const PhysicalInventoryTable = dynamic(
  () => import("./PhysicalInventoryTable").then((mod) => mod.PhysicalInventoryTable),
  { ssr: false }
);

const LibraryFormModal = dynamic(
  () => import("./LibraryFormModal").then((mod) => mod.LibraryFormModal),
  { ssr: false }
);

const ProductRequestTable = dynamic(
  () => import("./ProductRequestTable").then((mod) => mod.ProductRequestTable),
  { ssr: false }
);

const PromotionQueueTable = dynamic(
  () => import("./PromotionQueueTable").then((mod) => mod.PromotionQueueTable),
  { ssr: false }
);
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ActionSidebar, ActionSidebarSection, ActionSidebarItem, UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_RADIUS_ACTION } from "@/ui_engine";
import { UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE } from "@/ui_engine/tokens/colors";
import { UI_ENGINE_TYPE_META } from "@/ui_engine/tokens/typography";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ErrorFallback } from "@/components/shared/error-fallback";
import { deleteProductAction } from "../actions/library-actions";
import { unwrapActionResult } from "@/lib/result";

interface LibraryTabsProps {
  vendors: LibraryVendor[];
  products: ProductCatalogWithRelations[];
  totalProducts: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  categories: string[];
  materialsCategories?: string[];
  fixturesCategories?: string[];
  subCategories?: string[];
  finishings?: string[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  showPhysicalOnly: boolean;
  setShowPhysicalOnly: (val: boolean) => void;
  userRole: string;
  requests: ProjectProductRequestWithDetails[];
  promotionRequests?: Array<{
    id: string;
    status: string;
    snapshot_data: {
      catalog_image_url?: string | null;
      catalog_product_name?: string | null;
      catalog_brand?: string | null;
      catalog_category?: string | null;
    } | null;
    notes?: string | null;
    reviewed_at?: string | null;
    created_at?: string;
    project?: { id: string; name: string } | null;
    requested_by?: { id: string; name: string } | null;
    reviewed_by?: { id: string; name: string } | null;
  }>;
  isRefreshing?: boolean;
  activeTab: string;
  onTabChange: (val: string) => void;
  onRefreshAll?: () => void;
}

export function LibraryTabs({
  vendors,
  products,
  totalProducts,
  currentPage,
  pageSize,
  onPageChange,
  categories,
  materialsCategories = [],
  fixturesCategories = [],
  subCategories = [],
  finishings = [],
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  showPhysicalOnly,
  setShowPhysicalOnly,
  userRole,
  requests,
  promotionRequests = [],
  isRefreshing,
  activeTab,
  onTabChange,
  onRefreshAll
}: LibraryTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const handleTabChange = (val: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", val);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    onTabChange(val);
  };

  const [isFormModalOpen, setIsFormModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"CREATE" | "EDIT">("CREATE");
  const [modalType, setModalType] = React.useState<"PRODUCT" | "VENDOR">("PRODUCT");
  const [selectedData, setSelectedData] = React.useState<LibraryVendor | ProductCatalogWithRelations | null>(null);

  const retryTab = () => { onRefreshAll?.(); };

  const handleSuccess = () => {
    onRefreshAll?.();
  };

  const openDetail = (product: ProductCatalogWithRelations) => {
    setSelectedData(product);
    setModalType("PRODUCT");
    setModalMode("EDIT");
    setIsFormModalOpen(true);
  };

  const openVendorEdit = (vendor: LibraryVendor) => {
    setSelectedData(vendor);
    setModalType("VENDOR");
    setModalMode("EDIT");
    setIsFormModalOpen(true);
  };

  const isAdmin = userRole === "ADMIN";
  const canManageCatalog = userRole === "ADMIN" || userRole === "STAFF";

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      unwrapActionResult(await deleteProductAction({ id }));
      toast.success("Product deleted successfully");
      onRefreshAll?.();
    } catch (err: any) {
      toast.error("Failed to delete product", { description: err.message });
    }
  };

  return (
    <Tabs 
      defaultValue="catalog" 
      value={activeTab} 
      onValueChange={handleTabChange}
      className="w-full"
    >
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Column: Designers/Staff optimized sidebar */}
        <ActionSidebar>
          <ActionSidebarSection title="Filters" subtitle="Refine Catalog">
              <ActionSidebarItem label="Product Name">
                 <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                    <Input
                      placeholder="Search Library..."
                      className={cn("pl-9 w-full border-transparent focus:bg-white focus:border-slate-200 focus:ring-0 h-10 shadow-none transition-all", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_META)}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>
              </ActionSidebarItem>

              <ActionSidebarItem label="Collection Category">
                 <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className={cn("w-full h-10 border-transparent focus:ring-0 shadow-none transition-all", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_META)}>
                      <div className="flex items-center gap-2">
                        <Filter className="h-3 w-3 text-slate-400" />
                        <SelectValue placeholder="All Categories" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className={cn("border-transparent shadow-2xl", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_META)}>
                      <SelectItem value="all">Every Category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                 </Select>
              </ActionSidebarItem>

              <ActionSidebarItem label="Options">
                 <div className={cn("flex items-center justify-between p-4 border transition-all hover:border-slate-100", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                    <div className="flex flex-col gap-0.5">
                      <span className={cn("font-black text-slate-900 uppercase tracking-widest", UI_ENGINE_TYPE_META)}>Physical Only</span>
                      <span className={cn("text-slate-400 font-sans", UI_ENGINE_TYPE_META)}>Filter items with samples</span>
                    </div>
                    <label htmlFor="physical-toggle" className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        id="physical-toggle"
                        className="sr-only peer"
                        checked={showPhysicalOnly}
                        onChange={(e) => setShowPhysicalOnly(e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900 hover:bg-slate-300"></div>
                    </label>
                 </div>
              </ActionSidebarItem>
          </ActionSidebarSection>

          {canManageCatalog && (
            <Button 
              onClick={() => {
                setModalMode("CREATE");
                setModalType("PRODUCT");
                setSelectedData(null);
                setIsFormModalOpen(true);
              }}
              className={cn("w-full bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest h-12 px-4 shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]", UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_META)}
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </Button>
          )}
        </ActionSidebar>

        {/* Right Column: Premium Storefront Grid */}
        <main className="flex-1 w-full animate-in fade-in slide-in-from-right-4 duration-1500">
          <div className={cn("flex items-center justify-between mb-10 border-b pb-0.5", UI_ENGINE_BORDER_SUBTLE)}>
             <TabsList className="bg-transparent border-none h-auto p-0 flex gap-8">
                <TabsTrigger value="catalog" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-1 transition-all group focus-visible:ring-0 focus-visible:outline-none">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                    <span className="font-serif text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Catalog</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="inventory" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-1 transition-all group focus-visible:ring-0 focus-visible:outline-none">
                  <div className="flex items-center gap-3">
                    <Warehouse className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                    <span className="font-serif text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Samples</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="vendors" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-1 transition-all group focus-visible:ring-0 focus-visible:outline-none">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                    <span className="font-serif text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Vendors</span>
                  </div>
                </TabsTrigger>
                {canManageCatalog && (
                  <TabsTrigger value="requests" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-1 transition-all group focus-visible:ring-0 focus-visible:outline-none">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                      <span className="font-serif text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Requests</span>
                    </div>
                  </TabsTrigger>
                )}
                {isAdmin && (
                  <TabsTrigger value="queue" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-1 transition-all group focus-visible:ring-0 focus-visible:outline-none">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                      <span className="font-serif text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Queue</span>
                    </div>
                  </TabsTrigger>
                )}
             </TabsList>
             
             <div className={cn("hidden lg:flex font-black uppercase tracking-[0.2em] text-slate-300", UI_ENGINE_TYPE_META)}>
                {products.length} Active Items 
             </div>
          </div>

          <TabsContent value="catalog" className="mt-0 focus-visible:outline-none focus-visible:ring-0 min-h-[500px]">
            <ErrorBoundary
              name="Library Catalog"
              fallback={<ErrorFallback title="Storefront Error" message="Unable to load catalog storefront." onRetry={retryTab} />}
            >
              {isRefreshing ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-10 w-10 animate-spin text-slate-100" />
                </div>
              ) : (
                <ProductGrid 
                  products={products}
                  totalItems={totalProducts}
                  currentPage={currentPage}
                  pageSize={pageSize}
                  onPageChange={onPageChange}
                  onEdit={(data) => openDetail(data)}
                  onDelete={handleDelete}
                  onAddToSchedule={(product) => {
                     toast.success(`${product.catalog_product_name} ready to be added.`);
                  }}
                />
              )}
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="inventory" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ErrorBoundary name="Physical Inventory">
              <PhysicalInventoryTable 
                products={products} 
                userRole={userRole}
                onEdit={(data) => openDetail(data)}
              />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="vendors" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ErrorBoundary name="Vendor Table">
              <VendorTable vendors={vendors} onEdit={openVendorEdit} />
            </ErrorBoundary>
          </TabsContent>

          {canManageCatalog && (
            <TabsContent value="requests" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <ErrorBoundary name="Product Requests">
                <ProductRequestTable
                  requests={requests}
                  userRole={userRole}
                  onRefresh={retryTab}
                />
              </ErrorBoundary>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="queue" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <ErrorBoundary name="Promotion Queue">
                <PromotionQueueTable
                  requests={promotionRequests}
                  userRole={userRole}
                  onRefresh={retryTab}
                />
              </ErrorBoundary>
            </TabsContent>
          )}
        </main>
      </div>

      {/* Unified Form/Viewer Modal (RBAC & View-First Enabled) */}
      <LibraryFormModal
        isOpen={isFormModalOpen}
        onOpenChange={setIsFormModalOpen}
        type={modalType}
        mode={modalMode}
        initialData={selectedData}
        vendors={vendors}
        categories={categories}
        materialsCategories={materialsCategories}
        fixturesCategories={fixturesCategories}
        onSuccess={handleSuccess}
      />
    </Tabs>
  );
}
