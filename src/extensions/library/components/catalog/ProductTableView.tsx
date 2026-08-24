"use client";

import * as React from "react";
import Image from "next/image";
import { formatDateWithOptions } from "@/core/utilities/datetime";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD, UI_ENGINE_RADIUS_ACTION, UI_ENGINE_TYPE_META } from "@/ui_engine";
import {
  ExternalLink,
  FolderOpen,
  Globe,
  AtSign,
  Pencil,
  Trash2,
  PackageOpen,
  Boxes,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductCatalogWithRelations } from "../../types";

/**
 * Dense, row-oriented view of the catalog.
 *
 * This mirrors the office "material / supplier list" sheet one column at a time —
 * No, Brand, Category, Product, Product Link, Drive Folder, Website, IG, Sales,
 * Contact, Company, Update — because that is how the administrative staff who own
 * the list actually think about it. The card grid remains the right surface for
 * designers picking materials; this is the maintenance surface.
 *
 * Brand-level columns (Website / IG / Sales / Contact / Company) repeat per row in
 * the sheet but are normalised behind `Vendor` + `VendorContact` here, so they are
 * read straight off the joined vendor rather than duplicated per product.
 */

interface ProductTableViewProps {
  products: ProductCatalogWithRelations[];
  /** 1-based index of the first row on this page, so "No" is continuous. */
  startIndex: number;
  onEdit?: (product: ProductCatalogWithRelations) => void;
  onDelete?: (product: ProductCatalogWithRelations) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  deletingId?: string | null;
}

const HEAD = cn(
  "font-sans font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap",
  UI_ENGINE_TYPE_META
);

function LinkCell({
  href,
  label,
  icon: Icon,
}: {
  href?: string | null;
  label: string;
  icon: React.ElementType;
}) {
  if (!href) return <span className="text-slate-200">—</span>;

  // Vendors are stored with bare handles/domains in places, so normalise rather
  // than emitting a relative link that would resolve inside the app.
  const url = /^https?:\/\//i.test(href) ? href : `https://${href.replace(/^@/, "")}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={href}
      className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="sr-only">{label}</span>
    </a>
  );
}

function formatUpdated(product: ProductCatalogWithRelations) {
  // updated_at is nullable by design: rows that predate the column are unknown,
  // not "never updated". Fall back to created_at and mark it as such.
  const updated = product.updated_at;
  if (updated) {
    return {
      text: formatDateWithOptions(updated, {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      }),
      muted: false,
    };
  }
  return {
    text: formatDateWithOptions(product.created_at, {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    }),
    muted: true,
  };
}

export function ProductTableView({
  products,
  startIndex,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  deletingId,
}: ProductTableViewProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
          <PackageOpen className="h-8 w-8 text-slate-200" />
        </div>
        <h3 className="font-serif text-lg font-medium text-slate-900">No products found</h3>
        <p className="text-sm text-slate-500 font-sans mt-1">
          Try adjusting your filters or search query.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border overflow-hidden bg-white",
        UI_ENGINE_BORDER_SUBTLE,
        UI_ENGINE_RADIUS_CARD
      )}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className={cn("hover:bg-transparent", UI_ENGINE_BG_SUBTLE)}>
              <TableHead className={cn(HEAD, "w-[52px] pl-6")}>No</TableHead>
              <TableHead className={cn(HEAD, "w-[60px]")}>Img</TableHead>
              <TableHead className={HEAD}>Brand</TableHead>
              <TableHead className={HEAD}>Category</TableHead>
              <TableHead className={cn(HEAD, "min-w-[220px]")}>Product</TableHead>
              <TableHead className={cn(HEAD, "text-center w-[52px]")}>Link</TableHead>
              <TableHead className={cn(HEAD, "text-center w-[52px]")}>Drive</TableHead>
              <TableHead className={cn(HEAD, "text-center w-[52px]")}>Web</TableHead>
              <TableHead className={cn(HEAD, "text-center w-[52px]")}>IG</TableHead>
              <TableHead className={HEAD}>Sales</TableHead>
              <TableHead className={HEAD}>Contact</TableHead>
              <TableHead className={HEAD}>Company</TableHead>
              <TableHead className={HEAD}>Update</TableHead>
              <TableHead className={cn(HEAD, "text-right pr-6 w-[90px]")}>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {products.map((product, idx) => {
              const vendor = product.brand;
              // The sheet's "Sales" column is the sales contact; fall back to any
              // contact rather than showing nothing when the role wasn't recorded.
              const sales =
                vendor?.scoped_contacts?.find((c) => /sales/i.test(c.job_title ?? "")) ??
                vendor?.scoped_contacts?.[0];
              // Website and IG are BrandLink rows now, not two fixed columns.
              const websiteUrl =
                vendor?.links?.find((l) => l.kind === "WEBSITE")?.url ?? undefined;
              const instagramUrl =
                vendor?.links?.find((l) => l.kind === "INSTAGRAM")?.url ?? undefined;
              const updated = formatUpdated(product);
              const sampleCount = product.samples?.length ?? 0;
              const isDeleting = deletingId === product.id;

              return (
                <TableRow
                  key={product.id}
                  onClick={() => onEdit?.(product)}
                  className="group cursor-pointer border-slate-50 hover:bg-slate-50/60 transition-colors"
                >
                  <TableCell className="pl-6 text-slate-300 font-sans font-bold text-[11px]">
                    {startIndex + idx}
                  </TableCell>

                  <TableCell>
                    <div className="relative h-9 w-9 rounded-lg overflow-hidden bg-slate-50 shrink-0">
                      {product.catalog_image_url ? (
                        <Image
                          src={product.catalog_image_url}
                          alt={product.catalog_product_name || product.catalog_sku || "Material"}
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="font-sans">
                    <span className="font-black uppercase tracking-wider text-[10px] text-slate-900 whitespace-nowrap">
                      {vendor?.name || product.catalog_brand || "—"}
                    </span>
                  </TableCell>

                  <TableCell className="font-sans">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-700 whitespace-nowrap">
                        {product.catalog_category}
                      </span>
                      {product.catalog_sub_category && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                          {product.catalog_sub_category}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-serif text-sm text-slate-900 leading-snug">
                        {product.catalog_product_name || "Unnamed"}
                      </span>
                      <span className="font-sans text-[10px] text-slate-400 flex items-center gap-2">
                        <span className="font-bold tracking-wider">{product.catalog_sku}</span>
                        {product.catalog_color && product.catalog_color !== "N/A" && (
                          <span className="italic">{product.catalog_color}</span>
                        )}
                        {sampleCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 text-slate-400"
                            title={`${sampleCount} physical sample${sampleCount > 1 ? "s" : ""}`}
                          >
                            <Boxes className="h-3 w-3" />
                            {sampleCount}
                          </span>
                        )}
                        {product.catalog_status !== "APPROVED" && (
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded font-black uppercase tracking-widest text-[8px]",
                              product.catalog_status === "PENDING"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-rose-50 text-rose-600"
                            )}
                          >
                            {product.catalog_status}
                          </span>
                        )}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <LinkCell
                      href={product.catalog_reference_url}
                      label="Product link"
                      icon={ExternalLink}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <LinkCell
                      href={product.catalog_folder_url}
                      label="Drive folder"
                      icon={FolderOpen}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <LinkCell href={websiteUrl} label="Website" icon={Globe} />
                  </TableCell>
                  <TableCell className="text-center">
                    <LinkCell href={instagramUrl} label="Instagram" icon={AtSign} />
                  </TableCell>

                  <TableCell className="font-sans text-[11px] text-slate-600 whitespace-nowrap">
                    {sales?.person_name || <span className="text-slate-200">—</span>}
                  </TableCell>
                  <TableCell className="font-sans text-[11px] text-slate-600 whitespace-nowrap">
                    {sales?.phone || <span className="text-slate-200">—</span>}
                  </TableCell>
                  <TableCell className="font-sans text-[11px] text-slate-500">
                    <span className="truncate block max-w-[150px]" title={vendor?.owner?.legal_name || ""}>
                      {vendor?.owner?.legal_name || (
                        <span className="text-slate-200">—</span>
                      )}
                    </span>
                  </TableCell>

                  <TableCell
                    className={cn(
                      "font-sans text-[10px] whitespace-nowrap",
                      updated.muted ? "text-slate-300 italic" : "text-slate-500"
                    )}
                    title={updated.muted ? "Never updated since it was added" : "Last updated"}
                  >
                    {updated.text}
                  </TableCell>

                  <TableCell className="text-right pr-6">
                    <div
                      className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit?.(product)}
                          className={cn("h-8 w-8 text-slate-400 hover:text-slate-900", UI_ENGINE_RADIUS_ACTION)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isDeleting}
                          onClick={() => onDelete?.(product)}
                          className={cn("h-8 w-8 text-slate-300 hover:text-rose-600 hover:bg-rose-50", UI_ENGINE_RADIUS_ACTION)}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
