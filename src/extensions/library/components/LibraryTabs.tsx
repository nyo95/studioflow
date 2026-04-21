"use client";

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Search, Filter, Warehouse, Plus, LayoutGrid, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VendorTable } from "./VendorTable";
import { PhysicalInventoryTable } from "./PhysicalInventoryTable";
import { LibraryFormModal } from "./LibraryFormModal";
import { ProductDetailModal } from "./modals/ProductDetailModal";
import { ProductCatalogWithRelations, LibraryVendor, ProjectProductRequestWithDetails } from "../types";
import { ProductGrid } from "./catalog/ProductGrid";
import { PromotionQueueTable } from "./PromotionQueueTable";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ActionSidebar, ActionSidebarSection, ActionSidebarItem } from "@/ui_engine";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ErrorFallback } from "@/components/shared/error-fallback";

interface LibraryTabsProps {
  vendors: LibraryVendor[];
  products: ProductCatalogWithRelations[];
  totalProducts: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  categories: string[];
  productCategories?: string[];
  fixtureCategories?: string[];
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
  promotionRequests?: any[];
  isRefreshing?: boolean;
  activeTab: string;
  onTabChange: (val: string) => void;
}

export function LibraryTabs({
  vendors,
  products,
  totalProducts,
  currentPage,
  pageSize,
  onPageChange,
  categories,
  productCategories = [],
  fixtureCategories = [],
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
  onTabChange
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
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"CREATE" | "EDIT">("CREATE");
  const [selectedData, setSelectedData] = React.useState<LibraryVendor | ProductCatalogWithRelations | null>(null);

  const retryTab = () => router.refresh();

  const handleSuccess = () => {
    router.refresh(); 
  };

  const openDetail = (product: ProductCatalogWithRelations) => {
    setSelectedData(product);
    setIsDetailModalOpen(true);
  };

  const openVendorEdit = (vendor: LibraryVendor) => {
    setSelectedData(vendor);
    setModalMode("EDIT");
    setIsFormModalOpen(true);
  };

  const isAdmin = userRole === "ADMIN";

  return (
    <Tabs 
      defaultValue="catalog" 
      value={activeTab} 
      onValueChange={handleTabChange}
      className="w-full"
    >
      <div className="flex flex-col lg:flex-row gap-10 items-start">
        {/* Left Column: Designers/Staff optimized sidebar */}
        <ActionSidebar>
          <ActionSidebarSection title="Experience" subtitle="Search & Refine">
              <ActionSidebarItem label="Product Name">
                 <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                    <Input
                      placeholder="Search catalog..."
                      className="pl-9 w-full bg-slate-50/50 border-slate-100 focus:bg-white focus:border-slate-200 focus:ring-0 h-10 font-inter text-xs shadow-none rounded-xl transition-all"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>
              </ActionSidebarItem>

              <ActionSidebarItem label="Collection Category">
                 <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full h-10 border-slate-100 bg-slate-50/50 font-inter text-xs focus:ring-0 shadow-none rounded-xl transition-all">
                      <div className="flex items-center gap-2">
                        <Filter className="h-3 w-3 text-slate-400" />
                        <SelectValue placeholder="All Categories" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="font-inter text-xs rounded-xl border-slate-100 shadow-2xl">
                      <SelectItem value="all">Every Category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                 </Select>
              </ActionSidebarItem>

              <ActionSidebarItem label="Discovery Settings">
                 <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-50 transition-all hover:border-slate-100">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-black text-slate-900 font-inter uppercase tracking-widest">Physical Only</span>
                      <span className="text-[9px] text-slate-400 font-inter">Filter items with samples</span>
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

          {isAdmin && (
            <Button 
              onClick={() => {
                setModalMode("CREATE");
                setSelectedData(null);
                setIsFormModalOpen(true);
              }}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-inter text-[10px] font-black uppercase tracking-widest h-12 px-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Add to Catalog</span>
            </Button>
          )}
        </ActionSidebar>

        {/* Right Column: Premium Storefront Grid */}
        <main className="flex-1 w-full animate-in fade-in slide-in-from-right-4 duration-1500">
          <div className="flex items-center justify-between mb-10 border-b border-slate-100 pb-0.5">
             <TabsList className="bg-transparent border-none h-auto p-0 flex gap-8">
                <TabsTrigger value="catalog" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-0 transition-all group">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                    <span className="font-lora text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Storefront</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="inventory" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-0 transition-all group">
                  <div className="flex items-center gap-3">
                    <Warehouse className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                    <span className="font-lora text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Physical Inventory</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="vendors" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-0 transition-all group">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                    <span className="font-lora text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Partner Brands</span>
                  </div>
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="queue" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-0 transition-all group">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                      <span className="font-lora text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Approval Queue</span>
                    </div>
                  </TabsTrigger>
                )}
             </TabsList>
             
             <div className="hidden lg:flex text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
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

      {/* Detail Modal (RBAC Enabled) */}
      <ProductDetailModal
        isOpen={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        product={selectedData as ProductCatalogWithRelations}
        userRole={userRole}
      />

      {/* Global Form Modal (Creation) */}
      <LibraryFormModal
        isOpen={isFormModalOpen}
        onOpenChange={setIsFormModalOpen}
        type={activeTab === "vendors" ? "VENDOR" : "PRODUCT"}
        mode={modalMode}
        initialData={selectedData}
        vendors={vendors}
        categories={categories}
        onSuccess={handleSuccess}
      />
    </Tabs>
  );
}
