"use client";

/**
 * Shared presentational cells used by SupplierClient.
 *
 * MasterDataBrandsClient used to be the other consumer. It was archived
 * 2026-08-11 with zero importers — the flat Supplier table replaced it.
 */

import * as React from "react";
import {
  BookOpen,
  ExternalLink,
  FolderOpen,
  Globe,
  MessageCircle,
  ShoppingBag,
} from "lucide-react";
import type { LibraryVendor } from "@/subapps/master-data/contracts/catalog";

// ---------------------------------------------------------------------------
// Link icon + label maps (lucide@0.383 — no social media icons)
// ---------------------------------------------------------------------------
const LINK_ICONS: Record<string, React.ElementType> = {
  WEBSITE: Globe,
  INSTAGRAM: ExternalLink,
  FACEBOOK: ExternalLink,
  TIKTOK: ExternalLink,
  YOUTUBE: ExternalLink,
  LINKEDIN: ExternalLink,
  WHATSAPP: MessageCircle,
  MARKETPLACE: ShoppingBag,
  CATALOG: BookOpen,
  DRIVE: FolderOpen,
  PRICE_LIST: BookOpen,
  OTHER: ExternalLink,
};

const LINK_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  LINKEDIN: "LinkedIn",
  WHATSAPP: "WhatsApp",
  MARKETPLACE: "Marketplace",
  CATALOG: "Katalog",
  DRIVE: "Drive",
  PRICE_LIST: "Price List",
  OTHER: "Link",
};

function externalHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^@/, "")}`;
}

// ---------------------------------------------------------------------------
// LinkIcons — icon-only, deduplicated by kind, max 4
// ---------------------------------------------------------------------------
export function LinkIcons({ links }: { links: LibraryVendor["links"] }) {
  if (!links?.length) return <span className="text-slate-300">—</span>;
  const seen = new Set<string>();
  const deduped = links
    .filter((l) => { if (seen.has(l.kind)) return false; seen.add(l.kind); return true; })
    .slice(0, 4);
  return (
    <div className="flex items-center gap-2">
      {deduped.map((link) => {
        const Icon = LINK_ICONS[link.kind] ?? ExternalLink;
        const label = LINK_LABELS[link.kind] ?? link.kind;
        return (
          <a
            key={link.id}
            href={externalHref(link.url)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${label}: ${link.url}`}
            aria-label={`Buka ${label}`}
            onClick={(e) => e.stopPropagation()}
            className="text-slate-400 transition-colors hover:text-slate-950"
          >
            <Icon className="size-4" />
          </a>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContactCell — first contact + "+N more"
// ---------------------------------------------------------------------------
export function ContactCell({ contacts }: { contacts: LibraryVendor["scoped_contacts"] }) {
  if (!contacts?.length) return <span className="text-slate-300">—</span>;
  const first = contacts[0];
  const extra = contacts.length - 1;
  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-slate-900">{first.person_name}</span>
      {first.phone ? (
        <span className="text-xs text-slate-500">{first.phone}</span>
      ) : null}
      {extra > 0 ? <span className="text-xs text-slate-400">+{extra} lainnya</span> : null}
    </div>
  );
}
