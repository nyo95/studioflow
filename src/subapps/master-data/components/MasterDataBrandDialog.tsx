"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  CreatableChecklist,
  CreatableTagInput,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_BORDER_SUBTLE,
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_RADIUS_CARD,
  UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_H3,
  UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import {
  createVendorAction,
  updateVendorAction,
} from "@/extensions/library/actions/library-actions";
import type {
  BrandLinkInput,
  LibraryVendor,
  LibraryVendorInput,
} from "@/extensions/library/types";
import type { PartyData } from "../types/party";
import { BrandLinksEditor } from "@/components/shared/brand-links-editor";
import { unwrapActionResult } from "@/lib/result";
import {
  UnsavedChangesPrompt,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { cn } from "@/lib/utils";
import { PartyPicker } from "./PartyPicker";
import { useQuickEntry } from "../hooks/use-quick-entry";
import { quickCreatePartyAction } from "../actions/quick-entry-actions";
import type { PartyRoleKind } from "@/generated/prisma";
import { normalizeSearchText } from "@/core/utilities/normalize";

type VendorDialogMode = "CREATE" | "EDIT";

/**
 * Internal form shape — matches Excel Table 1:
 * Company | Brand | Product Brand | Category | Links (GDrive, Website, Socmed)
 *
 * REMOVED from earlier version: Sold-by (→ Pricing page), Legal entity, Address, Contacts
 * (those belong to Party, not Brand — SSOT 2026-08-12).
 */
type BrandForm = {
  brand_name: string;
  company_id: string | null;
  notes: string;
  links: BrandLinkInput[];
  /**
   * Kategori sebagai array, bukan lagi string mentah dipisah koma.
   *
   * Sebelum 2026-08-14 field ini adalah `category_text: string` yang baru
   * dipecah saat save — artinya "HPL,SPC" (tanpa spasi) dan "HPL , SPC" adalah
   * dua string berbeda yang harus dinormalkan di dua tempat, dan tidak ada
   * satu momen pun di mana form tahu ada berapa tag. Sekarang pemecahannya
   * terjadi di titik input (`CreatableTagInput`) dan sisanya bekerja dengan
   * daftar.
   */
  categories: string[];
  /**
   * Hashtag bebas, terpisah dari `categories` (owner feedback 2026-08-18, item
   * 5). Category tetap daftar terkurasi ~40 opsi; ini pool umum & awam yang
   * tumbuh organik (mis. "batu", "tegel murah", "finishing lantai").
   */
  tags: string[];
};

const EMPTY_FORM: BrandForm = {
  brand_name: "",
  company_id: null,
  notes: "",
  links: [],
  categories: [],
  tags: [],
};

/** Case-insensitive union for option pools that arrive from server + session. */
function mergeOptionNames(...groups: string[][]) {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const raw of groups.flat()) {
    const name = raw.trim();
    const key = normalizeSearchText(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    merged.push(name);
  }

  return merged;
}

function toForm(vendor?: LibraryVendor | null, initialName = ""): BrandForm {
  if (!vendor) {
    return { ...EMPTY_FORM, brand_name: initialName };
  }
  return {
    brand_name: vendor.name ?? "",
    company_id: vendor.owner_party_id ?? null,
    notes: vendor.notes ?? "",
    links: (vendor.links ?? []).map((link) => ({
      id: link.id,
      kind: link.kind,
      url: link.url,
      label: link.label ?? "",
    })),
    categories: (vendor.seed_categories ?? []).map((c) => c.name),
    tags: vendor.tags ?? [],
  };
}

function ReadValue({ children }: { children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "min-h-[2.5rem] whitespace-pre-wrap px-[calc(var(--ui-section-px)/2)] py-[calc(var(--ui-section-py)/2)] text-slate-950",
        UI_ENGINE_BG_SUBTLE,
        UI_ENGINE_RADIUS_CONTROL,
        UI_ENGINE_TYPE_BODY
      )}
    >
      {children || <span className="text-slate-400">—</span>}
    </div>
  );
}

/*
 * `CategoryInput` (strip chip semua kategori + satu Input teks bebas) dihapus
 * 2026-08-14, feedback item 9. Digantikan `CreatableTagInput`, yang menyarankan
 * kategori sambil diketik alih-alih memajang seluruh daftar di muka. Alasan
 * lengkapnya ada di header `components/ui/creatable-tag-input.tsx`.
 */

export function MasterDataBrandDialog({
  open,
  mode,
  vendor,
  initialName,
  canManage,
  companies = [],
  categoryOptions = [],
  tagOptions = [],
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mode: VendorDialogMode;
  vendor?: LibraryVendor | null;
  initialName?: string;
  canManage: boolean;
  companies?: PartyData[];
  /**
   * Category names available as suggestions. They come from the Master Data
   * default config plus existing BrandCategory records explicitly entered on a
   * Brand, never from SKU/Product Library category suggestions.
   */
  categoryOptions?: string[];
  /**
   * Hashtag suggestions (owner feedback 2026-08-18, item 5) — the catalog-wide
   * free-tag pool (same one SKUs suggest from), NOT the Category list above.
   */
  tagOptions?: string[];
  onOpenChange: (open: boolean) => void;
  onSaved: (vendor: LibraryVendor) => void;
}) {
  const [form, setForm] = React.useState<BrandForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = React.useState(false);
  // `CreatableChecklist` lives inside DialogContent and is unmounted whenever
  // the dialog closes. Keep options created during this page session one level
  // higher so a category added to Brand A is still available when Add Brand is
  // opened immediately for Brand B, even before router.refresh() finishes.
  const [sessionCategoryOptions, setSessionCategoryOptions] = React.useState<string[]>([]);
  const visibleCategoryOptions = React.useMemo(
    () => mergeOptionNames(categoryOptions, sessionCategoryOptions),
    [categoryOptions, sessionCategoryOptions]
  );

  /**
   * Quick entry for the owning Party.
   * No role forced — which category a company belongs to is separate from owning a brand.
   */
  const partyEntry = useQuickEntry<PartyData, { name: string; roles: PartyRoleKind[] }>({
    serverRows: companies,
    action: quickCreatePartyAction,
    input: (name) => ({ name, roles: [] }),
    toRow: (created) => ({ id: created.id, name: created.name } as PartyData),
    onCreated: (id) => setForm((prev) => ({ ...prev, company_id: id })),
    label: "Company",
  });

  const canSave = Boolean(form.brand_name.trim());

  /**
   * Bisa disunting = punya izin. State `isEditing` dan gatekeeper "Modify"
   * dihapus 2026-08-14 (View-First Protocol dicabut). Di berkas ini tombolnya
   * memang sudah tidak pernah tampil — efeknya menyetel `isEditing` ke
   * `mode === "CREATE" || canManage`, sementara tombolnya menuntut
   * `canManage && !isEditing`. Dua syarat yang saling meniadakan.
   */
  const editable = canManage;

  const guard = useUnsavedChangesGuard({ open, value: form, onOpenChange, enabled: editable });

  React.useEffect(() => {
    if (!open) return;
    const next = toForm(vendor, initialName);
    setForm(next);
    guard.markPristine(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialName, mode, open, vendor]);

  const save = async () => {
    if (!canSave) return;
    setIsSaving(true);

    const payload: LibraryVendorInput = {
      brand_name: form.brand_name.trim(),
      company_id: form.company_id,
      notes: form.notes.trim() || undefined,
      links: (form.links ?? []).filter((l) => l.url.trim()),
      contacts: [], // contacts live on Party, not Brand — handled from Suppliers page
      brand_category_tags: form.categories,
      tags: form.tags,
    };

    try {
      let savedVendor: LibraryVendor;
      if (mode === "CREATE") {
        savedVendor = unwrapActionResult(await createVendorAction(payload));
        toast.success("Brand added");
      } else {
        if (!vendor?.id) throw new Error("Brand not found");
        savedVendor = unwrapActionResult(
          await updateVendorAction({ id: vendor.id, data: payload })
        );
        toast.success("Brand updated");
      }
      // The server refresh that adds a newly created Category to
      // `categoryOptions` is asynchronous. Preserve only categories from a
      // successful save (not abandoned form input) so the next Create session
      // can use them immediately without inheriting Brand A's checked values.
      setSessionCategoryOptions((current) => mergeOptionNames(current, form.categories));
      guard.closeAfterSave();
      onSaved(savedVendor);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Brand could not be saved"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /*
   * Item 10 (feedback 2026-08-14): "kenapa ini munculnya side panel, bukan
   * pop-up modal?"
   *
   * Jawabannya: `Sheet` memang komponen bersama milik StudioFlow (dipakai
   * drawer detail SKU, panel sample request, dsb.), dan dialog Brand ikut
   * memakainya tanpa alasan khusus — bukan keputusan desain, melainkan warisan.
   * Akibatnya satu halaman Master Data punya dua bahasa: Supplier dan Pricing
   * membuka modal di tengah, Brand menggeser panel dari kanan.
   *
   * Sekarang `Dialog`, sama seperti dua dialog tetangganya.
   *
   * Catatan 2026-08-14 (sore): setelah `SkuDetailDrawer` ikut digantikan
   * `MasterDataProductDialog`, TIDAK ADA LAGI pemakai `Sheet` di seluruh
   * `src/` selain primitifnya sendiri. Primitifnya sengaja tidak dihapus —
   * panel yang menggeser dari samping adalah pola yang sah untuk konten yang
   * mendampingi (bukan menggantikan) apa yang ada di belakangnya, dan
   * StudioFlow kemungkinan besar membutuhkannya lagi. Yang salah bukan
   * `Sheet`-nya, melainkan memakainya untuk form yang menuntut perhatian penuh.
   */
  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-2xl overflow-y-auto border bg-white p-6",
          UI_ENGINE_BORDER_SUBTLE,
          UI_ENGINE_RADIUS_CARD
        )}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className={UI_ENGINE_TYPE_H3}>
              {mode === "CREATE" ? "Add Brand" : form.brand_name || "Edit Brand"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div>
          <div className="flex flex-col gap-[var(--ui-section-gap)]">

            {/* ── Section: Identitas Brand ─────────────────────────── */}
            <div className={cn(
              "grid gap-[calc(var(--ui-section-gap)/2)] rounded-[var(--ui-radius-card)] border p-[calc(var(--ui-section-px)/1.5)]",
              UI_ENGINE_BORDER_SUBTLE
            )}>
              <h3 className={cn(UI_ENGINE_TYPE_H3, "text-slate-500")}>Brand Identity</h3>

              {/* Product Brand — mandatory */}
              <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
                <Label htmlFor="brand-name" className={UI_ENGINE_TYPE_META}>
                  Product Brand <span className="text-[var(--ui-change-before)]">*</span>
                </Label>
                {editable ? (
                  <Input
                    id="brand-name"
                    value={form.brand_name}
                    onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))}
                    placeholder="e.g. TACO - HPL"
                    className={UI_ENGINE_RADIUS_CONTROL}
                  />
                ) : (
                  <ReadValue>{form.brand_name}</ReadValue>
                )}
              </div>

              {/* Induk Perusahaan (Company) — optional */}
              <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
                <Label htmlFor="brand-company" className={UI_ENGINE_TYPE_META}>
                  Company / Brand Owner
                  <span className={cn("ml-1 font-normal", UI_ENGINE_TYPE_META)}>
                    (optional)
                  </span>
                </Label>
                {editable ? (
                  <PartyPicker
                    companies={partyEntry.options}
                    value={form.company_id ?? null}
                    onSelect={(id) => setForm((f) => ({ ...f, company_id: id }))}
                    onQuickCreate={canManage ? partyEntry.create : undefined}
                  />
                ) : (
                  <ReadValue>
                    {partyEntry.options.find((c) => c.id === form.company_id)?.name}
                  </ReadValue>
                )}
                {editable && (
                  <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                    The company that owns the brand. This is separate from a supplier—for
                    example, TACO is owned by PT Tangkas Cipta Optimal.
                  </p>
                )}
              </div>

              {/* Category — checklist, bisa lebih dari satu (owner feedback
                  2026-08-18, item 5). Sumbernya tetap ~40 kategori default di
                  brand-catalog-categories.json plus kategori yang sudah
                  dipakai brand lain — hanya bentuknya yang berubah dari
                  ketik-untuk-cari menjadi centang-dari-daftar, dan tetap bisa
                  menambah opsi baru lewat kolom di bawah daftar. */}
              <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
                <Label className={UI_ENGINE_TYPE_META}>
                  Category
                  <span className={cn("ml-1 font-normal", UI_ENGINE_TYPE_META)}>
                    (select one or more)
                  </span>
                </Label>
                <CreatableChecklist
                  value={form.categories}
                  onChange={(next) => setForm((f) => ({ ...f, categories: next }))}
                  options={visibleCategoryOptions}
                  readOnly={!editable}
                  aria-label="Brand categories"
                  placeholder='New category…'
                  addLabel="Add"
                />
                {editable ? (
                  <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                    Select every applicable category. You can add a new category
                    using the field below the list.
                  </p>
                ) : null}
              </div>

              {/* Hashtag — pool umum & awam, terpisah dari Category. Contoh
                  owner: batu, batu buatan, tegel murah, finishing lantai. */}
              <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
                <Label className={UI_ENGINE_TYPE_META}>
                  Hashtag
                  <span className={cn("ml-1 font-normal", UI_ENGINE_TYPE_META)}>
                    (optional, add one or more)
                  </span>
                </Label>
                <CreatableTagInput
                  value={form.tags}
                  onChange={(next) => setForm((f) => ({ ...f, tags: next }))}
                  suggestions={tagOptions}
                  readOnly={!editable}
                  aria-label="Brand hashtags"
                  placeholder='e.g. stone, budget tile… — press Enter or comma to add'
                  createLabel='Add hashtag "{q}"'
                />
                {editable ? (
                  <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                    Everyday terms that make the brand easier to find. Categories
                    describe the product type instead.
                  </p>
                ) : null}
              </div>
            </div>

            {/* ── Section: Katalog & Link ──────────────────────────── */}
            <div className={cn(
              "grid gap-[calc(var(--ui-section-gap)/2)] rounded-[var(--ui-radius-card)] border p-[calc(var(--ui-section-px)/1.5)]",
              UI_ENGINE_BORDER_SUBTLE
            )}>
              <h3 className={cn(UI_ENGINE_TYPE_H3, "text-slate-500")}>Catalog & Links</h3>
              <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                Google Drive archive, website, Instagram, Facebook, and other links.
                Suppliers and prices are managed on the Pricing page.
              </p>
              <BrandLinksEditor
                value={form.links ?? []}
                onChange={(links: BrandLinkInput[]) =>
                  setForm((f) => ({ ...f, links }))
                }
                readOnly={!editable}
              />
            </div>

            {/* ── Notes (opsional) ─────────────────────────────────── */}
            <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
              <Label htmlFor="brand-notes" className={UI_ENGINE_TYPE_META}>
                Notes
                <span className={cn("ml-1 font-normal", UI_ENGINE_TYPE_META)}>(optional)</span>
              </Label>
              {editable ? (
                <textarea
                  id="brand-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className={cn(
                    "resize-y border bg-[var(--ui-canvas-bg)] p-[calc(var(--ui-section-py)/2)] outline-none focus:border-[var(--ui-border-focus)]",
                    UI_ENGINE_BORDER_SUBTLE,
                    UI_ENGINE_RADIUS_CONTROL,
                    UI_ENGINE_TYPE_BODY
                  )}
                />
              ) : (
                <ReadValue>{form.notes}</ReadValue>
              )}
            </div>

          </div>
        </div>

        <DialogFooter>
          {editable ? (
            <Button
              type="button"
              onClick={() => void save()}
              disabled={!canSave || isSaving}
              className={cn(
                "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                UI_ENGINE_RADIUS_ACTION
              )}
            >
              {isSaving ? (
                <Loader2 className="size-[var(--ui-icon-size-sm)] animate-spin" />
              ) : (
                <Save className="size-[var(--ui-icon-size-sm)]" />
              )}
              Save Brand
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <UnsavedChangesPrompt guard={guard} />
    </>
  );
}
