"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Package, Search, Filter, Warehouse, Plus, LayoutGrid, ArrowRightCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StudioCard } from "./StudioCard";
import { VendorTable } from "./VendorTable";
import { PhysicalInventoryTable } from "./PhysicalInventoryTable";
import { LibraryFormModal } from "./LibraryFormModal";
import { MaterialCatalogWithRelations, LibraryVendor, ProjectMaterialRequestWithDetails } from "../types";
import { MaterialTable } from "./MaterialTable";
import { MaterialRequestTable } from "./MaterialRequestTable";
import { Button } from "@/components/ui/button";
import { deleteMaterialAction, updateMaterialAction } from "../actions/library-actions";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/ui_engine";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ErrorFallback } from "@/components/shared/error-fallback";

interface LibraryTabsProps {
  vendors: LibraryVendor[];
  materials: MaterialCatalogWithRelations[];
  categories: string[];
  materialCategories?: string[];
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
  requests: ProjectMaterialRequestWithDetails[];
}

export function LibraryTabs({
  vendors,
  materials,
  categories,
  materialCategories = [],
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
  requests
}: LibraryTabsProps) {
  const [activeTab, setActiveTab] = React.useState("catalog");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"CREATE" | "EDIT">("CREATE");
  const [selectedData, setSelectedData] = React.useState<LibraryVendor | MaterialCatalogWithRelations | null>(null);
  const retryTab = () => window.location.reload();

  const handleSuccess = () => {
    window.location.reload(); 
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm("Are you sure you want to delete this material?")) return;
    
    try {
      unwrapActionResult(await deleteMaterialAction({ id }));
      toast.success("Material deleted successfully");
      window.location.reload();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete material");
    }
  };

  const handleApproveMaterial = async (id: string) => {
    const material = materials.find(m => m.id === id);
    if (!material) return;
    try {
        // Find existing to get necessary required fields
       unwrapActionResult(await updateMaterialAction({ id, data: { status: "APPROVED" } }));
       toast.success("Material approved and moved to catalog");
       window.location.reload();
    } catch (error: unknown) {
       toast.error(error instanceof Error ? error.message : "Failed to approve material");
    }
  };

  const handleRejectMaterial = async (id: string) => {
    try {
       unwrapActionResult(await updateMaterialAction({ id, data: { status: "REJECTED" } }));
       toast.success("Material request rejected");
       window.location.reload();
    } catch (error: unknown) {
       toast.error(error instanceof Error ? error.message : "Failed to reject material");
    }
  };

  return (
    <Tabs 
      defaultValue="catalog" 
      value={activeTab} 
      onValueChange={setActiveTab}
      className="w-full"
    >
      <div className="flex flex-col lg:flex-row gap-10 items-start">
        {/* Left Column: Sticky Sidebar (Fixed Width), Project Details Style */}
        <aside className="w-full lg:w-[280px] lg:sticky lg:top-8 flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-700">
          
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden rounded-lg">
            <div className="border-b border-slate-100 bg-slate-50/30 p-5 pb-3">
              <div className="space-y-1">
                <Heading level={4}>Library Tools</Heading>
                <Heading variant="uiMeta" level={6} className="opacity-80">
                  Search & Filters
                </Heading>
              </div>
            </div>
            <CardContent className="p-5 space-y-5">
              <div className="flex flex-col gap-3">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-sans">Quick Search</h2>
                 <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                    <Input
                      placeholder="Find materials..."
                      className="pl-9 w-full bg-white border-slate-200 focus:border-slate-400 focus:ring-0 h-10 font-sans text-sm shadow-none rounded-md transition-all"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-sans">Filter Category</h2>
                 <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full h-10 border-slate-200 font-sans text-sm focus:ring-0 shadow-none rounded-md transition-all">
                      <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-slate-400" />
                        <SelectValue placeholder="All Categories" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="font-sans text-sm rounded-md border-slate-200 shadow-lg">
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                 </Select>
              </div>

              <div className="flex flex-col gap-3">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-sans">Availability</h2>
                 <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-md border border-slate-100 transition-all hover:border-slate-200">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-slate-700 font-sans">Physical Only</span>
                      <span className="text-[9px] text-slate-400 font-sans">Hide digital assets</span>
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
              </div>
            </CardContent>
          </Card>

            <Button 
              onClick={() => {
                setModalMode("CREATE");
                setSelectedData(null);
                setIsModalOpen(true);
              }}
              disabled={activeTab === "requests"}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-sans text-xs h-11 px-4 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Add {activeTab === "vendors" ? "Vendor" : "Material"}</span>
            </Button>
        </aside>

        {/* Right Column: Dynamic Content Grid (75% on LG) */}
        <main className="flex-1 w-full animate-in fade-in slide-in-from-right-4 duration-1000">
          <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
             <TabsList className="bg-transparent border-none h-auto p-0 flex gap-6">
                <TabsTrigger value="catalog" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-2 transition-all group">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                    <span className="font-serif text-sm md:text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Catalog</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="inventory" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-2 transition-all group">
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                    <span className="font-serif text-sm md:text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Inventory</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="vendors" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-2 transition-all group">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400 group-data-[state=active]:text-slate-900" />
                    <span className="font-serif text-sm md:text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Vendors</span>
                  </div>
                </TabsTrigger>
                
                {(userRole === "ADMIN" || userRole === "STAFF") && (
                  <>
                    <TabsTrigger value="requests" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-2 transition-all group shrink-0">
                      <div className="flex items-center gap-2">
                        <ArrowRightCircle className="h-4 w-4 text-slate-400 group-data-[state=active]:text-blue-500" />
                        <span className="font-serif text-sm md:text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Requests</span>
                        {requests.filter(r => r.status === 'REQUESTED').length > 0 && (
                          <Badge className="h-4 min-w-[16px] px-1 bg-blue-500 text-white border-none text-[8px] font-black">
                            {requests.filter(r => r.status === 'REQUESTED').length}
                          </Badge>
                        )}
                      </div>
                    </TabsTrigger>
                    <TabsTrigger value="review" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-2 transition-all group shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Package className="h-4 w-4 text-slate-400 group-data-[state=active]:text-orange-500" />
                          <span className="absolute -top-1 -right-1 h-1.5 w-1.5 bg-orange-500 rounded-full animate-pulse" />
                        </div>
                        <span className="font-serif text-sm md:text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900 underline decoration-orange-200 decoration-2 underline-offset-4">Inbox/Review</span>
                      </div>
                    </TabsTrigger>
                  </>
                )}
             </TabsList>
             
             <div className="hidden lg:flex text-[10px] font-black uppercase tracking-widest text-slate-300">
                {activeTab === "catalog" ? materials.filter(m => m.status === 'APPROVED').length : 
                 activeTab === "review" ? materials.filter(m => m.status === 'PENDING').length :
                 activeTab === "inventory" ? materials.length :
                 vendors.length} Items Total
             </div>
          </div>

          <TabsContent value="catalog" className="mt-0 focus-visible:outline-none focus-visible:ring-0 min-h-[500px]">
            <ErrorBoundary
              name="Library Catalog"
              fallback={<ErrorFallback title="Catalog Failed" message="Catalog section failed to render." onRetry={retryTab} />}
            >
              <MaterialTable 
                materials={materials.filter(m => m.status === 'APPROVED')}
                userRole={userRole}
                onEdit={(data) => {
                  setModalMode("EDIT");
                  setSelectedData(data);
                  setIsModalOpen(true);
                }}
                onDelete={handleDeleteMaterial}
              />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="review" className="mt-0 focus-visible:outline-none focus-visible:ring-0 min-h-[500px]">
            <div className="mb-6 p-4 bg-orange-50/50 border border-orange-100 rounded-lg flex items-center gap-4 animate-in slide-in-from-top-2 duration-500">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-orange-900 font-sans">Inbox/Review Management</span>
                <p className="text-[11px] text-orange-700/80 font-medium font-sans">These items were auto-saved from project schedules or requests. Review and set to &quot;Approved&quot; to finalize in catalog.</p>
              </div>
            </div>

            <ErrorBoundary
              name="Library Review"
              fallback={<ErrorFallback title="Review Failed" message="Review section failed to render." onRetry={retryTab} />}
            >
              <MaterialTable 
                materials={materials.filter(m => m.status === 'PENDING')}
                userRole={userRole}
                isReviewMode={true}
                onApprove={handleApproveMaterial}
                onReject={handleRejectMaterial}
                onEdit={(data) => {
                  setModalMode("EDIT");
                  setSelectedData(data);
                  setIsModalOpen(true);
                }}
                onDelete={handleDeleteMaterial}
              />
            </ErrorBoundary>
          </TabsContent>
          
          <TabsContent value="requests" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
             <ErrorBoundary
               name="Material Requests"
               fallback={<ErrorFallback title="Requests Failed" message="Request table failed to render." onRetry={retryTab} />}
             >
               <MaterialRequestTable 
                 requests={requests}
                 userRole={userRole}
                 onRefresh={() => window.location.reload()}
               />
             </ErrorBoundary>
          </TabsContent>

          <TabsContent value="inventory" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ErrorBoundary
              name="Physical Inventory"
              fallback={<ErrorFallback title="Inventory Failed" message="Inventory section failed to render." onRetry={retryTab} />}
            >
              <StudioCard className="p-0 border-slate-100 shadow-sm rounded-xl overflow-hidden">
                <PhysicalInventoryTable 
                  materials={materials} 
                  onEdit={(data) => {
                    setModalMode("EDIT");
                    setSelectedData(data);
                    setIsModalOpen(true);
                  }} 
                />
              </StudioCard>
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="vendors" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ErrorBoundary
              name="Vendor Table"
              fallback={<ErrorFallback title="Vendors Failed" message="Vendor section failed to render." onRetry={retryTab} />}
            >
              <StudioCard className="p-0 border-slate-100 shadow-sm rounded-xl overflow-hidden">
                <VendorTable 
                  vendors={vendors} 
                  onEdit={(data) => {
                    setModalMode("EDIT");
                    setSelectedData(data);
                    setIsModalOpen(true);
                  }} 
                />
              </StudioCard>
            </ErrorBoundary>
          </TabsContent>
        </main>
      </div>

      <LibraryFormModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        type={activeTab === "vendors" ? "VENDOR" : "MATERIAL"}
        mode={modalMode}
        initialData={selectedData}
        vendors={vendors}
        categories={categories}
        materialCategories={materialCategories}
        fixtureCategories={fixtureCategories}
        subCategories={subCategories}
        finishings={finishings}
        onSuccess={handleSuccess}
      />
    </Tabs>
  );
}

