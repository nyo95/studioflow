"use client";

/**
 * §6.14 Brand-First Library — StudioFlow's Library surface.
 *
 * Owner direction: "fokusnya bukan cari barang lagi, tapi cari brand yang jual
 * barang tsb." So: one search box, results are BRANDS, and the only detail
 * view is the brand panel (catalog PDF, official channels, sample
 * availability). There is no category-picking step and no product list —
 * products live in the brand's own catalog, which the brand maintains.
 *
 * Built on ui_engine primitives (SimpleCard/Heading/tokens) rather than raw
 * @/components/ui + inline `var(--ui-*)` classes. The first version of this
 * file did the latter and reintroduced MASTER_SSOT §8 Issue 7 ("Design Token
 * Hardcoding"), a defect class this codebase had already fixed once.
 */

import * as React from "react";
// One import surface for everything presentational — see
// src/ui_engine/primitives/index.ts for the boundary rule.
import {
  SimpleCard,
  SimpleCardBody,
  SimpleCardTitle,
  Heading,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
  BORDER_SUBTLE,
  BG_SUBTLE,
  TEXT_SECONDARY,
  UI_ENGINE_RADIUS_CONTROL,
} from "@/ui_engine";
import { cn } from "@/lib/utils";
import { Library, FileStack, PackageCheck } from "lucide-react";
import {
  searchBrandsAction,
  suggestedCategoriesAction,
  getBrandDetailAction,
} from "@/extensions/library/actions/brand-library-actions";
import type {
  BrandSearchResult,
  BrandMatchReason,
  BrandDetail,
} from "@/extensions/library/services/brand-library-service";
import { drivePreviewEmbedUrl } from "@/extensions/library/lib/drive-preview";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";

const LINK_KIND_LABEL: Record<string, string> = {
  WEBSITE: "Website",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  LINKEDIN: "LinkedIn",
  CATALOG: "Catalogue (PDF)",
  DRIVE: "Catalogue (Drive archive)",
  MARKETPLACE: "Online store",
  PRICE_LIST: "Price list",
};

/** Kinds rendered in the "Catalogue" group; the rest go under "Channels". */
const CATALOG_KINDS = new Set(["CATALOG", "DRIVE", "PRICE_LIST"]);

const REASON_LABEL: Record<BrandMatchReason["kind"], string> = {
  category: "category",
  tag: "tag",
  product: "product",
  brand: "brand name",
};

export function BrandLibraryExplorer() {
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebounce(query, 250);

  const [results, setResults] = React.useState<BrandSearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);

  const [activeBrand, setActiveBrand] = React.useState<BrandDetail | null>(null);
  const [loadingBrand, setLoadingBrand] = React.useState(false);
  /** Held separately so the dialog has a real DialogTitle from the first frame. */
  const [pendingBrand, setPendingBrand] = React.useState<BrandSearchResult | null>(null);
  /** Sibling, not nested inside the brand dialog — avoids stacked focus traps. */
  const [pdfLink, setPdfLink] = React.useState<{ url: string; label: string } | null>(null);

  /** Quick-pick chips for the pre-search hero state. */
  const [suggestedCategories, setSuggestedCategories] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    suggestedCategoriesAction(undefined).then((res) => {
      if (cancelled) return;
      if (res.success) setSuggestedCategories(res.data);
      // Silent on failure — chips are an affordance, not a required feature.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const term = debouncedQuery.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchBrandsAction(term)
      .then((res) => {
        if (cancelled) return;
        if (res.success) setResults(res.data);
        else toast.error(res.error);
      })
      .finally(() => !cancelled && setSearching(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const openBrand = React.useCallback(async (brand: BrandSearchResult) => {
    setPendingBrand(brand);
    setLoadingBrand(true);
    setActiveBrand(null);
    const res = await getBrandDetailAction(brand.id);
    setLoadingBrand(false);
    if (res.success) {
      setActiveBrand(res.data);
    } else {
      toast.error(res.error);
      setPendingBrand(null);
    }
  }, []);

  const closeBrand = React.useCallback(() => {
    setActiveBrand(null);
    setPendingBrand(null);
  }, []);

  const hasQuery = debouncedQuery.trim().length >= 2;

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-xl">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search an item or product type"
          aria-label="Find brands by what they sell"
        />
        <p className={cn("mt-2 text-xs", TEXT_SECONDARY)}>
          Search a material, category, hashtag, or brand name. Results are brands;
          open one to view its official catalogue.
        </p>
      </div>

      {hasQuery ? (
        <BrandResults
          results={results}
          loading={searching}
          query={debouncedQuery.trim()}
          onSelect={openBrand}
        />
      ) : (
        <LibraryHero categories={suggestedCategories} onPick={setQuery} />
      )}

      <Dialog
        open={pendingBrand !== null}
        onOpenChange={(open) => {
          if (!open) closeBrand();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {activeBrand?.brand_name ?? pendingBrand?.brand_name ?? "Brand"}
            </DialogTitle>
            <DialogDescription>
              Catalogue, official channels, and physical sample availability.
            </DialogDescription>
          </DialogHeader>

          {loadingBrand && (
            <div className="space-y-3 py-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          {activeBrand && <BrandPanel brand={activeBrand} onOpenPdf={setPdfLink} />}
        </DialogContent>
      </Dialog>

      {pdfLink && <PdfPreview link={pdfLink} onClose={() => setPdfLink(null)} />}
    </div>
  );
}

/** Two-letter monogram for the brand avatar — no logo field on Brand today. */
function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Pre-search hero: explains the search model and offers quick-pick chips
 * sourced from BrandLibraryService.suggestedCategories — so a first-time
 * visitor doesn't have to guess a search term to see what the library has. */
function LibraryHero({
  categories,
  onPick,
}: {
  categories: string[];
  onPick: (term: string) => void;
}) {
  return (
    <SimpleCard className="border-dashed">
      <SimpleCardBody className="space-y-5 py-8 text-center">
        <div
          className={cn(
            "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
            BG_SUBTLE
          )}
        >
          <Library className={cn("h-6 w-6", TEXT_SECONDARY)} />
        </div>
        <div className="space-y-1.5">
          <Heading level={4}>Find brands by what they sell</Heading>
          <p className={cn("mx-auto max-w-md text-sm", TEXT_SECONDARY)}>
            Search any material, product, category, hashtag, or brand name. Not
            sure where to start? Try one of these suggestions.
          </p>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {categories.slice(0, 12).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => onPick(category)}
                className={cn(
                  "border px-3 py-1.5 text-sm capitalize transition-colors hover:bg-slate-50",
                  BORDER_SUBTLE,
                  UI_ENGINE_RADIUS_CONTROL
                )}
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </SimpleCardBody>
    </SimpleCard>
  );
}

function BrandResults({
  results,
  loading,
  query,
  onSelect,
}: {
  results: BrandSearchResult[];
  loading: boolean;
  query: string;
  onSelect: (b: BrandSearchResult) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <p className={cn("text-sm", TEXT_SECONDARY)}>
        No brands match “{query}”. Try a broader term such as “tile” or “solid
        surface”.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Heading level={3} variant="uiMeta">
        {results.length} {results.length === 1 ? "brand matches" : "brands match"} “{query}”
      </Heading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((brand) => (
          <SimpleCard
            key={brand.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(brand)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(brand);
              }
            }}
            className="cursor-pointer transition-shadow hover:shadow-md"
          >
            <SimpleCardBody className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-slate-600",
                    BG_SUBTLE
                  )}
                  aria-hidden="true"
                >
                  {brandInitials(brand.brand_name)}
                </div>
                <SimpleCardTitle className="truncate">{brand.brand_name}</SimpleCardTitle>
              </div>

              <div className="flex flex-wrap gap-1">
                {brand.reasons.slice(0, 3).map((reason, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-normal">
                    {REASON_LABEL[reason.kind]}: {reason.label}
                  </Badge>
                ))}
                {brand.reasons.length > 3 && (
                  <Badge variant="outline" className="text-xs font-normal">
                    +{brand.reasons.length - 3}
                  </Badge>
                )}
              </div>

              <div className={cn("flex flex-wrap items-center gap-3 text-xs", TEXT_SECONDARY)}>
                <span className="inline-flex items-center gap-1">
                  <FileStack className="h-3.5 w-3.5" />
                  {brand.hasCatalog ? "Catalogue available" : "No catalogue yet"}
                </span>
                {brand.availableSampleCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <PackageCheck className="h-3.5 w-3.5" />
                    {brand.availableSampleCount} physical samples
                  </span>
                )}
              </div>
            </SimpleCardBody>
          </SimpleCard>
        ))}
      </div>
    </div>
  );
}

function BrandPanel({
  brand,
  onOpenPdf,
}: {
  brand: BrandDetail;
  onOpenPdf: (link: { url: string; label: string }) => void;
}) {
  const catalogLinks = brand.links.filter((l) => CATALOG_KINDS.has(l.kind));
  const socialLinks = brand.links.filter((l) => !CATALOG_KINDS.has(l.kind));

  return (
    <div className="space-y-4">
      {brand.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {brand.categories.map((c) => (
            <Badge key={c.id} variant="secondary">
              {c.name}
            </Badge>
          ))}
        </div>
      )}

      <div className={cn("border p-3 text-sm", BORDER_SUBTLE, BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
        {brand.sampleAvailability.hasAvailableSample ? (
          <p>
            Physical samples available ({brand.sampleAvailability.availableCount} of{" "}
            {brand.sampleAvailability.totalSkuCount} registered items).
          </p>
        ) : (
          <p className={TEXT_SECONDARY}>
            No physical samples are available yet. Request a sample from the project page.
          </p>
        )}
      </div>

      {catalogLinks.length > 0 && (
        <div>
          <Heading level={4} variant="uiMeta" className="mb-2">
            Catalogue
          </Heading>
          <div className="flex flex-wrap gap-2">
            {catalogLinks.map((link) => {
              // §10 R1: prefer kantor's own archived copy over the source link,
              // so a dead brand URL never breaks the viewer.
              const target = link.archive_url ?? link.url;
              return (
                <button
                  key={link.id}
                  type="button"
                  className={cn(
                    "border px-3 py-1.5 text-sm transition-colors hover:bg-slate-50",
                    BORDER_SUBTLE,
                    UI_ENGINE_RADIUS_CONTROL
                  )}
                  onClick={() =>
                    onOpenPdf({
                      url: target,
                      label: link.label ?? LINK_KIND_LABEL[link.kind] ?? link.kind,
                    })
                  }
                >
                  {link.label ?? LINK_KIND_LABEL[link.kind] ?? link.kind}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {socialLinks.length > 0 && (
        <div>
          <Heading level={4} variant="uiMeta" className="mb-2">
            Channels
          </Heading>
          <div className="flex flex-wrap gap-2">
            {socialLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "border px-3 py-1.5 text-sm transition-colors hover:bg-slate-50",
                  BORDER_SUBTLE,
                  UI_ENGINE_RADIUS_CONTROL
                )}
              >
                {link.label ?? LINK_KIND_LABEL[link.kind] ?? link.kind} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {catalogLinks.length === 0 && socialLinks.length === 0 && (
        <p className={cn("text-sm", TEXT_SECONDARY)}>No links for this brand yet.</p>
      )}
    </div>
  );
}

function PdfPreview({
  link,
  onClose,
}: {
  link: { url: string; label: string };
  onClose: () => void;
}) {
  const embedUrl = drivePreviewEmbedUrl(link.url);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{link.label}</DialogTitle>
          <DialogDescription>
            {embedUrl
              ? "Brand catalogue shown through Google Drive preview."
              : "Brand catalogue. No preview available for this link."}
          </DialogDescription>
        </DialogHeader>
        {embedUrl ? (
          <iframe
            src={embedUrl}
            className={cn("h-[70vh] w-full border", BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}
            title={link.label}
          />
        ) : (
          <div className="space-y-2 py-4 text-sm">
            <p className={TEXT_SECONDARY}>
              Preview is unavailable for this link (it is not a Google Drive link, or
              the file is not shared with anyone who has the link).
            </p>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-block border px-3 py-1.5 transition-colors hover:bg-slate-50",
                BORDER_SUBTLE,
                UI_ENGINE_RADIUS_CONTROL
              )}
            >
              Open in a new tab ↗
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
