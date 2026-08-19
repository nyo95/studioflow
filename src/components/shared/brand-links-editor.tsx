"use client";

/**
 * BRAND LINKS — repeatable editor + read-only view.
 *
 * Replaces the fixed `website_url` + `instagram_url` pair that used to live on
 * the vendor row. Two columns could not hold a Facebook page, a marketplace
 * store or a second catalogue PDF without another schema change, and brands in
 * this list routinely have all three.
 *
 * Shared by the Library vendor form and the Master Data brand dialog so the two
 * cannot drift. It owns no data: the parent holds `BrandLinkInput[]` in state
 * and this component reports every change back through `onChange`.
 */

import * as React from "react";
import {
  AtSign,
  Camera,
  ExternalLink,
  FileText,
  Folder,
  Globe,
  Link2,
  MessageCircle,
  Music2,
  Plus,
  ReceiptText,
  ShoppingBag,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { Button, Input, Label, UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_META } from "@/ui_engine";
import type { BrandLinkInput } from "@/extensions/library/types";
import { LinkKind } from "@/generated/prisma";
import { cn } from "@/lib/utils";

/** Display labels. Keyed off the enum so adding a kind is a compile error here. */
const KIND_LABEL: Record<LinkKind, string> = {
  WEBSITE: "Website",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  LINKEDIN: "LinkedIn",
  WHATSAPP: "WhatsApp",
  MARKETPLACE: "Marketplace",
  CATALOG: "Catalog",
  DRIVE: "Drive Archive",
  PRICE_LIST: "Price List",
  OTHER: "Other",
};

/**
 * Ikon per jenis link (2026-08-14).
 *
 * Menggantikan `<select>` selebar 10rem yang isinya satu kata. Kata itu
 * memakan ruang yang seharusnya milik URL — di dialog Brand, field URL sempat
 * tersisa selebar "https:" saja, dan "Label (opsional)" justru tampak lebih
 * penting daripada alamat yang sedang diketik.
 *
 * Semuanya ikon generik, bukan logo merek. Bukan pilihan estetika: lucide-react
 * v1 MENGHAPUS seluruh ikon logo (Instagram, Facebook, Youtube, Linkedin) karena
 * alasan merek dagang — mengimpornya adalah error kompilasi, bukan sekadar
 * gaya yang berbeda. Menggambar ulang logo itu di dalam repo memindahkan urusan
 * lisensinya ke kita, dan tidak sebanding dengan hasilnya.
 *
 * Karena ikonnya generik, NAMA JENISNYA harus selalu terbaca: setiap tombol
 * membawa `title` dan `aria-label`, dan daftar pilihannya menampilkan ikon
 * bersama namanya. Ikon di sini mempersingkat pengenalan, tidak menggantikannya.
 */
const KIND_ICON: Record<LinkKind, React.ComponentType<{ className?: string }>> = {
  WEBSITE: Globe,
  INSTAGRAM: Camera,
  FACEBOOK: Users,
  TIKTOK: Music2,
  YOUTUBE: Video,
  LINKEDIN: AtSign,
  WHATSAPP: MessageCircle,
  MARKETPLACE: ShoppingBag,
  CATALOG: FileText,
  DRIVE: Folder,
  PRICE_LIST: ReceiptText,
  OTHER: Link2,
};

const KIND_ORDER: LinkKind[] = [
  "WEBSITE",
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "YOUTUBE",
  "LINKEDIN",
  "WHATSAPP",
  "MARKETPLACE",
  "CATALOG",
  "DRIVE",
  "PRICE_LIST",
  "OTHER",
];

function externalLinkHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * Best-effort classification of a pasted URL, applied only when the user has
 * not already chosen a kind. It is a convenience, never an override — a wrong
 * guess is always one dropdown click away from being corrected, and anything
 * unrecognised stays OTHER rather than being forced into a category.
 */
export function guessLinkKind(url: string): LinkKind {
  const host = url.trim().toLowerCase();
  if (host.includes("instagram.")) return "INSTAGRAM";
  if (host.includes("facebook.") || host.includes("fb.")) return "FACEBOOK";
  if (host.includes("tiktok.")) return "TIKTOK";
  if (host.includes("youtube.") || host.includes("youtu.be")) return "YOUTUBE";
  if (host.includes("linkedin.")) return "LINKEDIN";
  if (host.includes("wa.me") || host.includes("whatsapp.")) return "WHATSAPP";
  if (
    host.includes("tokopedia.") ||
    host.includes("shopee.") ||
    host.includes("bukalapak.") ||
    host.includes("lazada.")
  ) {
    return "MARKETPLACE";
  }
  if (host.includes("drive.google.com")) return "DRIVE";
  if (host.endsWith(".pdf")) return "CATALOG";
  if (host.startsWith("http")) return "WEBSITE";
  return "OTHER";
}

type Props = {
  value: BrandLinkInput[];
  onChange: (next: BrandLinkInput[]) => void;
  /**
   * Mode baca untuk pengguna tanpa izin ubah. Bukan lagi keadaan default —
   * View-First Protocol dicabut 2026-08-14; lihat AGENTS.md §Edit-First.
   */
  readOnly?: boolean;
};

export function BrandLinksEditor({ value, onChange, readOnly = false }: Props) {
  const update = (index: number, patch: Partial<BrandLinkInput>) => {
    onChange(value.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  };

  const addRow = () => onChange([...value, { kind: "WEBSITE", url: "", label: "" }]);
  const removeRow = (index: number) => onChange(value.filter((_, i) => i !== index));

  if (readOnly) {
    return <BrandLinksReadView links={value} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className={cn(UI_ENGINE_TYPE_META)}>Links &amp; Social Media</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addRow}
          className={cn(UI_ENGINE_RADIUS_CONTROL)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add link
        </Button>
      </div>

      {value.length === 0 ? (
        <p className={cn(UI_ENGINE_TYPE_META, "text-muted-foreground")}>
          No links yet.
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((link, index) => (
            <LinkRow
              key={link.id ?? index}
              link={link}
              onChange={(patch) => update(index, patch)}
              onRemove={() => removeRow(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Satu baris link: ikon jenis, URL, lalu label di bawahnya.
 *
 * Hierarkinya sengaja tiga tingkat menurun — jenis (satu ikon), alamat (yang
 * sebenarnya sedang diketik, mendapat seluruh sisa lebar), lalu label yang
 * memang opsional dan karenanya paling kecil. Susunan sebelumnya menempatkan
 * ketiganya berdampingan dengan lebar tetap, sehingga field terpenting justru
 * yang paling sempit.
 */
function LinkRow({
  link,
  onChange,
  onRemove,
}: {
  link: BrandLinkInput;
  onChange: (patch: Partial<BrandLinkInput>) => void;
  onRemove: () => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [showLabel, setShowLabel] = React.useState(Boolean(link.label?.trim()));
  const pickerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const Icon = KIND_ICON[link.kind];

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border p-2.5",
        UI_ENGINE_BORDER_SUBTLE,
        UI_ENGINE_RADIUS_CONTROL
      )}
    >
      <div className="flex items-center gap-2">
        {/* Pemilih jenis — satu tombol ikon, bukan dropdown selebar 10rem. */}
        <div ref={pickerRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPickerOpen((current) => !current)}
            aria-label={`Link type: ${KIND_LABEL[link.kind]}`}
            title={KIND_LABEL[link.kind]}
            className={cn(
              "flex size-9 items-center justify-center text-slate-500 transition-colors hover:text-slate-900",
              UI_ENGINE_BG_SUBTLE,
              UI_ENGINE_RADIUS_CONTROL
            )}
          >
            <Icon className="size-4" />
          </button>

          {pickerOpen && (
            <div
              className={cn(
                "absolute left-0 top-[calc(100%+0.35rem)] z-50 grid w-56 grid-cols-1 gap-0.5 border bg-white p-1",
                "border-[var(--ui-border-subtle)] rounded-[var(--ui-radius-card)]",
                "shadow-[var(--ui-shadow-elevated)]"
              )}
            >
              {KIND_ORDER.map((kind) => {
                const KindIcon = KIND_ICON[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      onChange({ kind });
                      setPickerOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors",
                      "rounded-[var(--ui-radius-action)]",
                      kind === link.kind
                        ? "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)]"
                        : "text-slate-700 hover:bg-[var(--ui-canvas-bg,rgb(248_250_252))]"
                    )}
                  >
                    <KindIcon className="size-4 shrink-0" />
                    {KIND_LABEL[kind]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Input
          value={link.url}
          onChange={(event) => {
            const url = event.target.value;
            // Only auto-classify while the row is still on its default kind, so
            // a deliberate choice is never silently rewritten.
            const shouldGuess = link.kind === "WEBSITE" && !link.id;
            onChange(shouldGuess ? { url, kind: guessLinkKind(url) } : { url });
          }}
          placeholder="https://…"
          aria-label="URL"
          className={cn("h-9 min-w-0 flex-1 border-none", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove link"
          className="shrink-0 text-slate-400 hover:text-red-500"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Label disembunyikan sampai diminta. Ia opsional, dan sebuah field
          kosong yang selalu terpampang membaca sebagai pekerjaan yang belum
          selesai. */}
      {showLabel ? (
        <Input
          value={link.label ?? ""}
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="Label—e.g. 2026 Catalog"
          aria-label="Link label"
          className={cn(
            "h-8 border-none text-xs",
            UI_ENGINE_BG_SUBTLE,
            UI_ENGINE_RADIUS_CONTROL
          )}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowLabel(true)}
          className={cn("self-start text-slate-400 hover:text-slate-700", UI_ENGINE_TYPE_META)}
        >
          + Add label
        </button>
      )}
    </div>
  );
}

/** Read-only rendering, also used by the brand tables. */
export function BrandLinksReadView({
  links,
}: {
  links: { kind: LinkKind; url: string; label?: string | null }[];
}) {
  if (!links || links.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {links.map((link, index) => (
        <a
          key={`${link.url}-${index}`}
          href={externalLinkHref(link.url)}
          target="_blank"
          rel="noopener noreferrer"
          title={link.url}
          className="inline-flex items-center gap-1.5 hover:underline"
        >
          {React.createElement(KIND_ICON[link.kind], { className: "size-3.5 shrink-0 text-slate-400" })}
          <span className={cn(UI_ENGINE_TYPE_META, "text-muted-foreground")}>
            {link.label?.trim() || KIND_LABEL[link.kind]}
          </span>
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}

export { KIND_LABEL as BRAND_LINK_KIND_LABEL };
