"use client";

import * as React from "react";
import { ExternalLink, Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, DashboardPageShell, PageHeader, TableCard, TableCardBody, TableCardCell, TableCardHead, TableCardHeader, TableCardRow } from "@/ui_engine";
import { UI_ENGINE_RADIUS_ACTION, UI_ENGINE_RADIUS_CONTROL } from "@/ui_engine/tokens";
import type {
  BrandCategoryCoverage,
  LibraryAccess,
  LibraryVendor,
  ProductCatalogWithRelations,
} from "@/extensions/library/types";
import { LibraryItemStatus } from "@/extensions/library/types";
import { cn } from "@/lib/utils";
import type { LastChange } from "@/subapps/master-data/actions/masterdata-actions";
import { MasterDataProductDialog } from "./MasterDataProductDialog";

const PAGE_SIZE = 25;

function externalHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^@/, "")}`;
}

function LinkCell({ value, label }: { value?: string | null; label: string }) {
  if (!value) return null;
  return (
    <a
      href={externalHref(value)}
      target="_blank"
      rel="noopener noreferrer"
      title={value}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex text-slate-500 hover:text-slate-950"
    >
      <ExternalLink className="size-[var(--ui-icon-size-sm)]" />
    </a>
  );
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function UpdateCell({
  product,
  change,
}: {
  product: ProductCatalogWithRelations;
  change?: LastChange;
}) {
  if (change) {
    const label =
      change.action === "CATALOG_CREATE"
        ? "Dibuat"
        : change.action === "CATALOG_UPDATE"
          ? "Diperbarui"
          : change.action === "CATALOG_DELETE"
            ? "Dihapus"
            : "Perubahan";
    return (
      <div className="flex min-w-[10rem] flex-col">
        <span className="text-slate-950">
          {[label, change.actorName].filter(Boolean).join(" · ")}
        </span>
        {change.at ? (
          <span className="text-slate-400">{formatDate(change.at)}</span>
        ) : null}
      </div>
    );
  }

  if (!product.updated_at) {
    return (
      <div className="flex min-w-[10rem] flex-col text-slate-400">
        <span>Data masuk</span>
        <span>{formatDate(product.created_at)}</span>
      </div>
    );
  }

  return <span className="text-slate-400">—</span>;
}

function paginationItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const values = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...values].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push("ellipsis");
    result.push(value);
  });
  return result;
}

export function MasterDataSkusClient({
  products,
  total,
  page,
  access,
  vendors,
  categories,
  materialsCategories,
  fixturesCategories,
  subCategories,
  finishings,
  tags,
  brandCoverage,
  lastChanges,
  initialFilters,
}: {
  products: ProductCatalogWithRelations[];
  total: number;
  page: number;
  access: LibraryAccess;
  vendors: LibraryVendor[];
  categories: string[];
  materialsCategories: string[];
  fixturesCategories: string[];
  subCategories: string[];
  finishings: string[];
  tags: string[];
  brandCoverage: BrandCategoryCoverage;
  lastChanges: Record<string, LastChange>;
  initialFilters: {
    search: string;
    vendorId: string;
    category: string;
    status: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(initialFilters.search);
  const [dialog, setDialog] = React.useState<{
    open: boolean;
    mode: "CREATE" | "EDIT";
    product: ProductCatalogWithRelations | null;
  }>({ open: false, mode: "CREATE", product: null });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const navigate = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    });
    if (!("page" in patch)) params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const contactNames = (product: ProductCatalogWithRelations) =>
    (product.brand?.scoped_contacts ?? []).map((contact) => contact.person_name).filter(Boolean);
  const contactPhones = (product: ProductCatalogWithRelations) =>
    (product.brand?.scoped_contacts ?? []).map((contact) => contact.phone).filter(Boolean);

  return (
    <DashboardPageShell>
      <PageHeader
        eyebrow="Master Data"
        title="SKU"
        description="Maintenance view produk nyata per SKU, dengan data supplier tetap tersimpan terpisah."
        action={
          access.canCreate ? (
            <Button
              type="button"
              onClick={() => setDialog({ open: true, mode: "CREATE", product: null })}
              className={cn(
                "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                UI_ENGINE_RADIUS_ACTION
              )}
            >
              <Plus className="size-[var(--ui-icon-size-sm)]" />
              Tambah SKU
            </Button>
          ) : undefined
        }
      />

      <form
        className="mb-6 grid gap-3 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ search: search.trim() || null });
        }}
      >
        <div className="relative md:col-span-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-[var(--ui-icon-size-sm)] -translate-y-1/2 text-slate-400"
          />
          <Input
            aria-label="Cari SKU, produk, brand, atau kategori"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)}
          />
        </div>
        <Select value={initialFilters.vendorId || "all"} onValueChange={(value) => navigate({ vendor: value })}>
          <SelectTrigger className={UI_ENGINE_RADIUS_CONTROL}>
            <SelectValue placeholder="Semua brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua brand</SelectItem>
            {vendors.map((vendor) => (
              <SelectItem key={vendor.id} value={vendor.id}>
                {vendor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={initialFilters.category || "all"} onValueChange={(value) => navigate({ category: value })}>
          <SelectTrigger className={UI_ENGINE_RADIUS_CONTROL}>
            <SelectValue placeholder="Semua kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={initialFilters.status || "all"} onValueChange={(value) => navigate({ status: value })}>
          <SelectTrigger className={UI_ENGINE_RADIUS_CONTROL}>
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value={LibraryItemStatus.PENDING}>Pending</SelectItem>
            <SelectItem value={LibraryItemStatus.APPROVED}>Approved</SelectItem>
            <SelectItem value={LibraryItemStatus.REJECTED}>Rejected</SelectItem>
          </SelectContent>
        </Select>
      </form>

      <TableCard layout="auto">
        <TableCardHeader>
          {[
            "No",
            "Brand",
            "Category",
            "Product",
            "Product Link",
            "Drive Folder",
            "Website",
            "IG",
            "Sales",
            "Contact",
            "Company",
            "Update",
          ].map((heading) => (
            <TableCardHead key={heading}>{heading}</TableCardHead>
          ))}
        </TableCardHeader>
        <TableCardBody>
          {products.map((product, index) => (
            <TableCardRow
              key={product.id}
              className="cursor-pointer"
              onClick={() => setDialog({ open: true, mode: "EDIT", product })}
            >
              <TableCardCell className="tabular-nums text-slate-400">
                {(page - 1) * PAGE_SIZE + index + 1}
              </TableCardCell>
              <TableCardCell>{product.catalog_brand}</TableCardCell>
              <TableCardCell>{product.catalog_category}</TableCardCell>
              <TableCardCell>
                <div className="flex min-w-[12rem] flex-col">
                  <span className="font-serif text-slate-950">
                    {product.catalog_product_name}
                  </span>
                  <span className="text-slate-400">{product.catalog_sku}</span>
                </div>
              </TableCardCell>
              <TableCardCell>
                <LinkCell value={product.catalog_reference_url} label="Buka product link" />
              </TableCardCell>
              <TableCardCell>
                <LinkCell value={product.catalog_folder_url} label="Buka Drive folder" />
              </TableCardCell>
              {/* Website and IG are BrandLink rows now, so these two columns
                  read the list instead of two fixed columns. */}
              <TableCardCell>
                <LinkCell
                  value={product.brand?.links.find((l) => l.kind === "WEBSITE")?.url ?? null}
                  label="Buka website vendor"
                />
              </TableCardCell>
              <TableCardCell>
                <LinkCell
                  value={product.brand?.links.find((l) => l.kind === "INSTAGRAM")?.url ?? null}
                  label="Buka Instagram vendor"
                />
              </TableCardCell>
              <TableCardCell>
                <div className="flex min-w-[8rem] flex-col">
                  {contactNames(product).map((name, contactIndex) => (
                    <span key={`${name}-${contactIndex}`}>{name}</span>
                  ))}
                </div>
              </TableCardCell>
              <TableCardCell>
                <div className="flex min-w-[8rem] flex-col whitespace-pre-wrap">
                  {contactPhones(product).map((phone, contactIndex) => (
                    <span key={`${phone}-${contactIndex}`}>{phone}</span>
                  ))}
                </div>
              </TableCardCell>
              <TableCardCell>{product.brand?.owner?.legal_name}</TableCardCell>
              <TableCardCell>
                <UpdateCell product={product} change={lastChanges[product.id]} />
              </TableCardCell>
            </TableCardRow>
          ))}
        </TableCardBody>
      </TableCard>

      {products.length === 0 ? (
        <div className="p-10 text-center font-sans text-sm text-slate-400">
          Tidak ada SKU yang cocok.
        </div>
      ) : null}

      <footer className="mt-6 flex items-center justify-between gap-4">
        <span className="font-sans text-sm text-slate-400">
          {total.toLocaleString("id-ID")} SKU
        </span>
        <div className="flex items-center gap-1.5">
          {paginationItems(page, totalPages).map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="text-slate-400">
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={item === page ? "default" : "outline"}
                onClick={() => navigate({ page: String(item) })}
                className={UI_ENGINE_RADIUS_ACTION}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </Button>
            )
          )}
        </div>
      </footer>

      <MasterDataProductDialog
        open={dialog.open}
        mode={dialog.mode}
        product={dialog.product}
        access={access}
        vendors={vendors}
        categories={categories}
        materialsCategories={materialsCategories}
        fixturesCategories={fixturesCategories}
        subCategories={subCategories}
        finishings={finishings}
        tags={tags}
        brandCoverage={brandCoverage}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />
    </DashboardPageShell>
  );
}
