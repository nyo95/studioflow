"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { PhaseSectionBadge } from "@/components/phase-section";

interface PhaseLinkProps {
  href: string;
  name: string;
  badgeClass?: string;
}

export function PhaseLink({ href, name, badgeClass }: PhaseLinkProps) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.stopPropagation();
      }}
      className="transition-transform hover:scale-105 active:scale-95"
    >
      <PhaseSectionBadge
        className={cn(
          badgeClass,
          "hover:border-slate-400 hover:bg-slate-50 transition-colors"
        )}
      >
        {name}
      </PhaseSectionBadge>
    </Link>
  );
}
