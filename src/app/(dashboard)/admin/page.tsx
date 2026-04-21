"use client";

import * as React from "react";
import { DashboardPageShell, PageHeader } from "@/ui_engine";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, Package, Warehouse, Loader2 } from "lucide-react";
import { 
  getProductsAction, 
  getAllProductRequestsAction,
  getMyRoleAction
} from "@/extensions/library/actions/library-actions";
import { ProductCatalogWithRelations, ProjectProductRequestWithDetails } from "@/extensions/library/types";
import { toast } from "sonner";
import { ProductTable } from "@/extensions/library/components/ProductTable";
import { ProductRequestTable } from "@/extensions/library/components/ProductRequestTable";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminDashboardPage() {
  const [role, setRole] = React.useState<string | null>(null);
  const [pendingProducts, setPendingProducts] = React.useState<ProductCatalogWithRelations[]>([]);
  const [requests, setRequests] = React.useState<ProjectProductRequestWithDetails[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "queue";

  const handleTabChange = (val: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", val);
    router.push(`/admin?${params.toString()}`);
  };

  React.useEffect(() => {
    async function loadAdminData() {
      setIsLoading(true);
      try {
        const [roleRes, queueRes, requestsRes] = await Promise.all([
          getMyRoleAction(undefined),
          getProductsAction({ status: "PENDING" }),
          getAllProductRequestsAction(undefined)
        ]);

        if (roleRes.success) {
          setRole(roleRes.data);
          if (roleRes.data !== "ADMIN") {
            toast.error("Unauthorized access.");
            router.push("/");
            return;
          }
        }
        if (queueRes.success) setPendingProducts(queueRes.data.items);
        if (requestsRes.success) setRequests(requestsRes.data);
      } catch (err) {
        toast.error("Failed to load admin dashboard data");
      } finally {
        setIsLoading(false);
      }
    }
    loadAdminData();
  }, [router]);

  if (isLoading) {
    return (
      <DashboardPageShell>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-slate-200" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Admin Hub...</span>
        </div>
      </DashboardPageShell>
    );
  }

  if (role !== "ADMIN") return null;

  return (
    <DashboardPageShell className="max-w-[1440px]">
      <div className="space-y-10 animate-in fade-in duration-1000">
        <PageHeader
          eyebrow="Operations // Admin Control"
          title="Admin Dashboard"
          description="Manage product approval queues and monitor physical sample movements across the studio."
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="flex items-center justify-between border-b border-slate-100 pb-0.5 mb-8">
            <TabsList className="bg-transparent border-none h-auto p-0 flex gap-8">
              <TabsTrigger value="queue" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-0 transition-all group">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-slate-400 group-data-[state=active]:text-orange-500" />
                  <span className="font-lora text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Approval Queue</span>
                  {pendingProducts.length > 0 && (
                    <span className="h-5 w-5 rounded-full bg-orange-500 text-[10px] font-black text-white flex items-center justify-center">
                      {pendingProducts.length}
                    </span>
                  )}
                </div>
              </TabsTrigger>
              <TabsTrigger value="samples" className="relative pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent shadow-none px-0 transition-all group">
                <div className="flex items-center gap-2.5">
                  <Warehouse className="h-4 w-4 text-slate-400 group-data-[state=active]:text-blue-500" />
                  <span className="font-lora text-base font-medium text-slate-500 group-data-[state=active]:text-slate-900">Sample Requests</span>
                  {requests.filter(r => r.status === 'REQUESTED').length > 0 && (
                    <span className="h-5 w-5 rounded-full bg-blue-500 text-[10px] font-black text-white flex items-center justify-center">
                      {requests.filter(r => r.status === 'REQUESTED').length}
                    </span>
                  )}
                </div>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="queue" className="focus-visible:outline-none">
            <div className="grid gap-6">
              <div className="bg-slate-50/50 rounded-[2rem] border border-slate-100 p-8">
                <div className="max-w-2xl mb-8">
                  <h2 className="font-lora text-xl font-medium text-slate-900">Catalog Promotion Queue</h2>
                  <p className="text-sm text-slate-500 font-inter mt-2">
                    Items harvested from project schedules that are awaiting global catalog standardization. 
                    Review technical specs and images before approving.
                  </p>
                </div>
                
                <ErrorBoundary name="Admin Queue">
                  <ProductTable 
                    products={pendingProducts}
                    userRole="ADMIN"
                    isQueueMode={true}
                    onEdit={() => router.refresh()}
                    onApprove={() => router.refresh()}
                    onReject={() => router.refresh()}
                    onDelete={() => router.refresh()}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="samples" className="focus-visible:outline-none">
             <div className="bg-slate-50/50 rounded-[2rem] border border-slate-100 p-8">
                <div className="max-w-2xl mb-8">
                  <h2 className="font-lora text-xl font-medium text-slate-900">Physical Sample Logistics</h2>
                  <p className="text-sm text-slate-500 font-inter mt-2">
                    Monitor requests for physical materials. Update status to CHECKED_OUT or RECEIVED to automatically log movements.
                  </p>
                </div>

                <ErrorBoundary name="Admin Sample Requests">
                  <ProductRequestTable 
                    requests={requests}
                    userRole="ADMIN"
                    onRefresh={() => router.refresh()}
                  />
                </ErrorBoundary>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardPageShell>
  );
}
