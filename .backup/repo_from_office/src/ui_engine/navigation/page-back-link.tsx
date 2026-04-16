import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageBackLinkProps {
  href?: string;
  label?: string;
  className?: string;
}

export function PageBackLink({
  href = "/",
  label = "Back to Dashboard",
  className,
}: PageBackLinkProps) {
  return (
    <div className={cn("mb-8", className)}>
      <Link
        href={href}
        className="flex w-fit items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-900"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {label}
      </Link>
    </div>
  );
}
