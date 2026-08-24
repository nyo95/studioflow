"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DirectoryTemplate,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableCard,
  TableCardBody,
  TableCardCell,
  TableCardHead,
  TableCardHeader,
  TableCardRow,
  UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import { cn } from "@/lib/utils";
import { unwrapActionResult } from "@/lib/result";
import { useAppConfirm } from "@/hooks/use-app-confirm";
import { deleteSkuAction } from "@/subapps/master-data/actions/masterdata-actions";
import type { MaterialRow } from "@/subapps/master-data/services/material-view-service";
import { SkuDetailDrawer } from "./SkuDetailDrawer";

type DirectoryFilters = {
  search: string;
  brand: string;
  category: string;
  price: "ALL" | "WITH" | "WITHOUT";
  completeness: "ALL" | "COMPLETE" | "INCOMPLETE";
  sort: "brand" | "sku" | "newest";
};

function money(value: number) {
  return value.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export function SkuDirectoryClient({
  rows,
  total,
  page,
  pageSize,
  categories,
  brands,
  canManage,
  initialFilters,
}: {
  rows: MaterialRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
  brands: Array<{ id: string; name: string }>;
  canManage: boolean;
  initialFilters: DirectoryFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appConfirm = useAppConfirm();
  const [search, setSearch] = React.useState(initialFilters.search);
  const [viewerSkuId, setViewerSkuId] = React.useState<string | null>(null);
  const [deletingSkuId, setDeletingSkuId] = React.useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  React.useEffect(
    () => setSearch(initialFilters.search),
    [initialFilters.search],
  );

  const navigate = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "ALL" || value === "all") params.delete(key);
      else params.set(key, value);
    }
    if (!("page" in updates)) params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const requestDeleteSku = async (row: MaterialRow) => {
    const skuLabel = row.sku || row.productName;
    const confirmed = await appConfirm.confirm({
      title: "Delete SKU?",
      description: (
        <>
          Delete <strong>{skuLabel}</strong> from active Master Data? Its price
          history will be retained.
        </>
      ),
      confirmLabel: "Delete SKU",
    });
    if (!confirmed) return;

    setDeletingSkuId(row.id);
    try {
      unwrapActionResult(await deleteSkuAction({ id: row.id }));
      if (viewerSkuId === row.id) setViewerSkuId(null);
      toast.success("SKU deleted");
      router.refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "SKU could not be deleted",
      );
    } finally {
      setDeletingSkuId(null);
    }
  };

  return (
    <>
      <DirectoryTemplate
        header={
          <PageHeader
            eyebrow="Master Data"
            title="SKU Directory"
            description="All SKUs across brands. Open a row to review its identity, suppliers, current prices, and price history."
          />
        }
        search={
          <form
            className="mb-[var(--ui-section-gap)] grid gap-[calc(var(--ui-section-gap)/2)] md:grid-cols-2 lg:grid-cols-6"
            onSubmit={(event) => {
              event.preventDefault();
              navigate({ search: search.trim() || null });
            }}
          >
            <div className="relative lg:col-span-2">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-[var(--ui-icon-size-sm)] -translate-y-1/2 text-[var(--ui-text-tertiary)]"
              />
              <Input
                aria-label="Search SKUs"
                placeholder="Search code, product, brand, or category…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)}
              />
            </div>

            <DirectorySelect
              label="Filter by brand"
              value={initialFilters.brand || "all"}
              placeholder="All brands"
              onValueChange={(value) => navigate({ brand: value })}
            >
              <SelectItem value="all">All brands</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </DirectorySelect>

            <DirectorySelect
              label="Filter by category"
              value={initialFilters.category || "all"}
              placeholder="All categories"
              onValueChange={(value) => navigate({ category: value })}
            >
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </DirectorySelect>

            <DirectorySelect
              label="Filter by price state"
              value={initialFilters.price}
              placeholder="Any price state"
              onValueChange={(value) => navigate({ price: value })}
            >
              <SelectItem value="ALL">Any price state</SelectItem>
              <SelectItem value="WITH">Has current price</SelectItem>
              <SelectItem value="WITHOUT">No current price</SelectItem>
            </DirectorySelect>

            <DirectorySelect
              label="Filter by data completeness"
              value={initialFilters.completeness}
              placeholder="Any data state"
              onValueChange={(value) => navigate({ completeness: value })}
            >
              <SelectItem value="ALL">Any data state</SelectItem>
              <SelectItem value="COMPLETE">Complete data</SelectItem>
              <SelectItem value="INCOMPLETE">Incomplete data</SelectItem>
            </DirectorySelect>
          </form>
        }
        content={
          <>
            <div className="mb-[calc(var(--ui-section-gap)/2)] flex flex-wrap items-center justify-between gap-[calc(var(--ui-section-gap)/2)]">
              <p
                className={cn(
                  "text-[var(--ui-text-secondary)]",
                  UI_ENGINE_TYPE_BODY,
                )}
              >
                {total.toLocaleString("id-ID")} SKU{total === 1 ? "" : "s"}
              </p>
              <DirectorySelect
                label="Sort SKUs"
                value={initialFilters.sort}
                placeholder="Sort by brand"
                onValueChange={(value) => navigate({ sort: value })}
                triggerClassName="w-[var(--ui-filter-secondary-width)]"
              >
                <SelectItem value="brand">Sort by brand</SelectItem>
                <SelectItem value="sku">Sort by SKU code</SelectItem>
                <SelectItem value="newest">Sort by newest</SelectItem>
              </DirectorySelect>
            </div>

            <TableCard
              layout="fixed"
              minWidth="var(--ui-sku-directory-table-min-width)"
            >
              <TableCardHeader>
                <TableCardHead
                  style={{ width: "var(--ui-sku-directory-col-brand)" }}
                >
                  Brand
                </TableCardHead>
                <TableCardHead
                  style={{ width: "var(--ui-sku-directory-col-product)" }}
                >
                  SKU / Product
                </TableCardHead>
                <TableCardHead
                  style={{ width: "var(--ui-sku-directory-col-category)" }}
                >
                  Category
                </TableCardHead>
                <TableCardHead
                  style={{ width: "var(--ui-sku-directory-col-unit)" }}
                >
                  Base unit
                </TableCardHead>
                <TableCardHead
                  align="right"
                  style={{ width: "var(--ui-sku-directory-col-price)" }}
                >
                  Best current price
                </TableCardHead>
                <TableCardHead
                  align="center"
                  style={{ width: "var(--ui-sku-directory-col-complete)" }}
                >
                  Data
                </TableCardHead>
                <TableCardHead
                  align="right"
                  style={{ width: "var(--ui-sku-directory-col-actions)" }}
                >
                  Actions
                </TableCardHead>
              </TableCardHeader>
              <TableCardBody>
                {rows.map((row) => (
                  <TableCardRow
                    key={row.id}
                    className="group cursor-pointer"
                    tabIndex={0}
                    onClick={() => setViewerSkuId(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setViewerSkuId(row.id);
                      }
                    }}
                  >
                    <TableCardCell>
                      <span className="font-serif font-semibold text-[var(--ui-text-primary)]">
                        {row.vendorName || "Generic / no brand"}
                      </span>
                    </TableCardCell>
                    <TableCardCell>
                      <div className="flex flex-col gap-[calc(var(--ui-section-gap)/5)]">
                        <span className="font-mono text-[var(--ui-text-primary)]">
                          {row.sku || "No manufacturer code"}
                        </span>
                        <span className="text-[var(--ui-text-secondary)]">
                          {row.productName}
                        </span>
                      </div>
                    </TableCardCell>
                    <TableCardCell className="text-[var(--ui-text-secondary)]">
                      {row.categoryTags.length > 0
                        ? row.categoryTags.join(", ")
                        : "No categories"}
                    </TableCardCell>
                    <TableCardCell>{row.baseUnit || "—"}</TableCardCell>
                    <TableCardCell align="right" className="tabular-nums">
                      {row.hasCurrentPrice && row.price !== null ? (
                        <div className="flex flex-col items-end gap-[calc(var(--ui-section-gap)/5)]">
                          <span className="font-medium text-[var(--ui-text-primary)]">
                            {money(row.price)} / {row.priceUnit || row.baseUnit}
                          </span>
                          {row.priceOfferCount > 1 ? (
                            <span className="text-[var(--ui-text-tertiary)]">
                              {row.priceOfferCount} current offers
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[var(--ui-text-tertiary)]">
                          —
                        </span>
                      )}
                    </TableCardCell>
                    <TableCardCell align="center">
                      {row.dataComplete ? (
                        <span
                          role="img"
                          aria-label="Complete data"
                          title="Complete data — product name, base unit, and category are recorded"
                          className="inline-flex text-[var(--ui-change-after)]"
                        >
                          <CheckCircle2 className="size-[var(--ui-icon-size-sm)]" />
                        </span>
                      ) : (
                        <span
                          role="img"
                          aria-label="Incomplete data"
                          title="Incomplete data — add product name, base unit, or category"
                          className="inline-flex text-[var(--ui-change-pending)]"
                        >
                          <AlertCircle className="size-[var(--ui-icon-size-sm)]" />
                        </span>
                      )}
                    </TableCardCell>
                    <TableCardCell
                      align="right"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={deletingSkuId === row.id}
                            aria-label={`Open actions for ${row.sku || row.productName}`}
                            title="Open SKU actions"
                            className={cn(
                              "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100",
                              UI_ENGINE_RADIUS_ACTION,
                            )}
                          >
                            {deletingSkuId === row.id ? (
                              <Loader2
                                aria-hidden
                                className="size-[var(--ui-icon-size-sm)] animate-spin"
                              />
                            ) : (
                              <MoreHorizontal
                                aria-hidden
                                className="size-[var(--ui-icon-size-sm)]"
                              />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => setViewerSkuId(row.id)}
                          >
                            <Eye aria-hidden />
                            View details
                          </DropdownMenuItem>
                          {canManage ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => void requestDeleteSku(row)}
                            >
                              <Trash2 aria-hidden />
                              Delete SKU
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCardCell>
                  </TableCardRow>
                ))}
              </TableCardBody>
            </TableCard>

            {rows.length === 0 ? (
              <p
                className={cn(
                  "p-[var(--ui-section-py)] text-center text-[var(--ui-text-tertiary)]",
                  UI_ENGINE_TYPE_BODY,
                )}
              >
                No SKUs match these filters.
              </p>
            ) : null}
          </>
        }
        pagination={
          total > 0 ? (
            <div className="mt-[calc(var(--ui-section-gap)/2)] flex flex-wrap items-center justify-between gap-[calc(var(--ui-section-gap)/2)]">
              <span
                className={cn(
                  "tabular-nums text-[var(--ui-text-secondary)]",
                  UI_ENGINE_TYPE_META,
                )}
              >
                Showing {rangeStart.toLocaleString("id-ID")}–
                {rangeEnd.toLocaleString("id-ID")} of{" "}
                {total.toLocaleString("id-ID")}
              </span>
              {totalPages > 1 ? (
                <div className="flex items-center gap-[calc(var(--ui-section-gap)/4)]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => navigate({ page: String(page - 1) })}
                    className={UI_ENGINE_RADIUS_CONTROL}
                  >
                    <ChevronLeft className="size-[var(--ui-icon-size-sm)]" />
                    Previous
                  </Button>
                  <span
                    className={cn(
                      "tabular-nums text-[var(--ui-text-secondary)]",
                      UI_ENGINE_TYPE_META,
                    )}
                  >
                    {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => navigate({ page: String(page + 1) })}
                    className={UI_ENGINE_RADIUS_CONTROL}
                  >
                    Next
                    <ChevronRight className="size-[var(--ui-icon-size-sm)]" />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null
        }
      />

      {appConfirm.dialog}
      <SkuDetailDrawer
        skuId={viewerSkuId}
        onClose={() => setViewerSkuId(null)}
      />
    </>
  );
}

function DirectorySelect({
  label,
  value,
  placeholder,
  onValueChange,
  triggerClassName,
  children,
}: {
  label: string;
  value: string;
  placeholder: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(UI_ENGINE_RADIUS_CONTROL, triggerClassName)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
