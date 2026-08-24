"use client";

/**
 * Read-only SKU pricing viewer.
 *
 * The filename is retained because an earlier, unused implementation was a
 * Sheet. BR8 turns it into the requested popup and makes it the shared viewer
 * for Pricing rows and the cross-brand SKU directory.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { formatDate } from "@/core/utilities/datetime";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  TableCard,
  TableCardBody,
  TableCardCell,
  TableCardHead,
  TableCardHeader,
  TableCardRow,
  UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_H3,
  UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import { cn } from "@/lib/utils";
import { unwrapActionResult } from "@/lib/result";
import { getSkuPricingViewerAction } from "@/subapps/master-data/actions/pricing-actions";
import type {
  SkuPricingViewerData,
  SkuPricingViewerPrice,
} from "@/subapps/master-data/types/pricing";

function money(value: number, currency: string) {
  return value.toLocaleString("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

function dateLabel(value: Date | string | null) {
  if (!value) return "—";
  try {
    return formatDate(value);
  } catch {
    return "—";
  }
}

function priceLabel(price: SkuPricingViewerPrice) {
  return `${money(price.price, price.currency)} / ${price.unit}`;
}

export function SkuDetailDrawer({
  skuId,
  onClose,
}: {
  skuId: string | null;
  onClose: () => void;
}) {
  const [sku, setSku] = React.useState<SkuPricingViewerData | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!skuId) {
      setSku(null);
      return () => {
        cancelled = true;
      };
    }

    setSku(null);
    setLoading(true);
    void getSkuPricingViewerAction({ skuId })
      .then((result) => {
        if (!cancelled) setSku(unwrapActionResult(result));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "SKU details could not be loaded");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [skuId]);

  return (
    <Dialog open={Boolean(skuId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        size="xl"
        className="max-h-[var(--ui-dialog-max-height)] overflow-y-auto"
      >
        <DialogHeader className="pr-12">
          <DialogTitle className={UI_ENGINE_TYPE_H3}>
            {loading ? "Loading SKU…" : (sku?.name ?? "SKU details")}
          </DialogTitle>
          {sku ? (
            <p className={cn("font-mono text-[var(--ui-text-tertiary)]", UI_ENGINE_TYPE_META)}>
              {sku.code || "No manufacturer code"}
            </p>
          ) : null}
        </DialogHeader>

        {loading ? (
          <div className={cn("flex items-center justify-center gap-[calc(var(--ui-section-gap)/2)] py-[var(--ui-section-py)] text-[var(--ui-text-tertiary)]", UI_ENGINE_TYPE_BODY)}>
            <Loader2 className="size-[var(--ui-icon-size-sm)] animate-spin" />
            Loading SKU details…
          </div>
        ) : sku ? (
          <div className="flex flex-col gap-[var(--ui-section-gap)]">
            <section className="grid gap-[calc(var(--ui-section-gap)/2)] sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Brand" value={sku.brand?.name ?? "Generic / no brand"} />
              <Field
                label="Categories"
                value={sku.categories.length > 0 ? sku.categories.join(", ") : "No categories"}
              />
              <Field label="Dimension" value={sku.dimension ?? "Not recorded"} />
              <Field label="Base unit" value={sku.baseUnit || "Not recorded"} />
            </section>

            <section>
              <SectionTitle>Specifications</SectionTitle>
              {sku.specifications.length > 0 ? (
                <div className="grid gap-[calc(var(--ui-section-gap)/2)] sm:grid-cols-2 lg:grid-cols-4">
                  {sku.specifications.map((specification) => (
                    <Field
                      key={specification.label}
                      label={specification.label}
                      value={specification.value}
                    />
                  ))}
                </div>
              ) : (
                <p className={cn("text-[var(--ui-text-tertiary)]", UI_ENGINE_TYPE_BODY)}>
                  No specifications recorded.
                </p>
              )}
            </section>

            <section>
              <SectionTitle>Current supplier prices</SectionTitle>
              {sku.currentPrices.length > 0 ? (
                <TableCard layout="fixed" minWidth="var(--ui-sku-viewer-price-table-min-width)">
                  <TableCardHeader>
                    <TableCardHead>Supplier</TableCardHead>
                    <TableCardHead align="right">Price</TableCardHead>
                    <TableCardHead>Effective from</TableCardHead>
                    <TableCardHead>Notes</TableCardHead>
                  </TableCardHeader>
                  <TableCardBody>
                    {sku.currentPrices.map((price) => (
                      <TableCardRow key={price.id}>
                        <TableCardCell className="font-medium text-[var(--ui-text-primary)]">
                          {price.supplierName}
                        </TableCardCell>
                        <TableCardCell align="right" className="tabular-nums font-medium">
                          {priceLabel(price)}
                        </TableCardCell>
                        <TableCardCell>{dateLabel(price.validFrom)}</TableCardCell>
                        <TableCardCell className="text-[var(--ui-text-secondary)]">
                          {price.notes || "—"}
                        </TableCardCell>
                      </TableCardRow>
                    ))}
                  </TableCardBody>
                </TableCard>
              ) : (
                <p className={cn("text-[var(--ui-text-tertiary)]", UI_ENGINE_TYPE_BODY)}>
                  No current supplier prices.
                </p>
              )}
            </section>

            <section>
              <SectionTitle>Price history</SectionTitle>
              {sku.priceHistory.length > 0 ? (
                <TableCard layout="fixed" minWidth="var(--ui-sku-viewer-history-table-min-width)">
                  <TableCardHeader>
                    <TableCardHead>Supplier</TableCardHead>
                    <TableCardHead align="right">Price</TableCardHead>
                    <TableCardHead>Valid from</TableCardHead>
                    <TableCardHead>Valid to</TableCardHead>
                    <TableCardHead>Status</TableCardHead>
                    <TableCardHead>Updated by</TableCardHead>
                  </TableCardHeader>
                  <TableCardBody>
                    {sku.priceHistory.map((price) => (
                      <TableCardRow key={price.id}>
                        <TableCardCell>{price.supplierName}</TableCardCell>
                        <TableCardCell align="right" className="tabular-nums font-medium">
                          {priceLabel(price)}
                        </TableCardCell>
                        <TableCardCell>{dateLabel(price.validFrom)}</TableCardCell>
                        <TableCardCell>{dateLabel(price.validTo)}</TableCardCell>
                        <TableCardCell>
                          <span
                            className={cn(
                              "inline-flex rounded-[var(--ui-radius-pill)] px-[calc(var(--ui-section-px)/3)] py-[calc(var(--ui-section-py)/5)]",
                              UI_ENGINE_TYPE_META,
                              price.isCurrent
                                ? "bg-[var(--ui-change-after-bg)] text-[var(--ui-change-after)]"
                                : "bg-[var(--ui-canvas-bg)] text-[var(--ui-text-tertiary)]"
                            )}
                          >
                            {price.isCurrent ? "Current" : "Archived"}
                          </span>
                        </TableCardCell>
                        <TableCardCell>{price.updatedByName || "—"}</TableCardCell>
                      </TableCardRow>
                    ))}
                  </TableCardBody>
                </TableCard>
              ) : (
                <p className={cn("text-[var(--ui-text-tertiary)]", UI_ENGINE_TYPE_BODY)}>
                  No price history.
                </p>
              )}
            </section>
          </div>
        ) : (
          <p className={cn("py-[var(--ui-section-py)] text-center text-[var(--ui-text-tertiary)]", UI_ENGINE_TYPE_BODY)}>
            SKU not found.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className={cn("mb-[calc(var(--ui-section-gap)/2)] text-[var(--ui-text-primary)]", UI_ENGINE_TYPE_H3)}>
      {children}
    </h3>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[calc(var(--ui-section-gap)/4)] border border-[var(--ui-border-subtle)] bg-[var(--ui-canvas-bg)] p-[calc(var(--ui-section-px)/2)]",
        UI_ENGINE_RADIUS_CONTROL
      )}
    >
      <span className={cn("text-[var(--ui-text-tertiary)]", UI_ENGINE_TYPE_META)}>
        {label}
      </span>
      <span className={cn("text-[var(--ui-text-primary)]", UI_ENGINE_TYPE_BODY)}>
        {value}
      </span>
    </div>
  );
}
