"use client";

import { Bell, LogOut, Menu, Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/user-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/context/sidebar-context";
import type { Role } from "@/generated/prisma";

function UserAvatar({
  userName,
  userInitials,
}: {
  userName: string;
  userInitials?: string | null;
}) {
  const normalizedInitials = userInitials?.trim().slice(0, 3).toUpperCase();
  const fallbackInitial = userName.trim().charAt(0).toUpperCase() || "?";
  const displayValue = normalizedInitials || fallbackInitial;

  return (
    <Avatar className="h-8 w-8">
      <AvatarFallback className="bg-slate-900 text-[10px] font-bold text-white">
        {displayValue}
      </AvatarFallback>
    </Avatar>
  );
}

export function TopHeader({
  userName,
  userInitials,
  userRole,
  appTitle = "StudioFlow",
  logoUrl,
  theme = "light",
}: {
  userName: string;
  userInitials?: string | null;
  userRole: Role;
  appTitle?: string;
  logoUrl?: string | null;
  theme?: "light" | "dark";
}) {
  const { toggle } = useSidebar();
  const isDark = theme === "dark";

  return (
    <header 
      className={cn(
        "z-20 flex h-14 flex-shrink-0 items-center justify-between border-b px-4 lg:px-8 transition-colors duration-300",
        isDark 
          ? "border-slate-800 bg-slate-950" 
          : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("lg:hidden", isDark && "text-slate-400 hover:bg-slate-900 hover:text-white")}
          onClick={toggle}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </Button>

        <Link href="/" className="group flex select-none items-center gap-2">
          {logoUrl ? (
            <img 
               src={logoUrl} 
               alt={appTitle} 
               className="h-8 w-auto object-contain transition-opacity group-hover:opacity-80" 
            />
          ) : (
            <span className={cn(
              "font-serif text-lg font-black tracking-widest uppercase transition-colors",
              isDark ? "text-white" : "text-black"
            )}>
              {appTitle || "StudioFlow"}
            </span>
          )}
          <span className={cn(
            "font-sans text-[10px] font-bold uppercase tracking-tighter transition-colors",
            isDark ? "text-slate-400 group-hover:text-slate-300" : "text-slate-400 group-hover:text-slate-600"
          )}>
            by BK
          </span>
        </Link>
      </div>

      <div className="relative mx-4 hidden max-w-xl flex-1 cursor-not-allowed md:block lg:mx-8">
        <Search
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          strokeWidth={1.5}
        />
        <div
          className={cn(
            "flex h-10 w-full items-center rounded-full pl-11 pr-4 font-sans text-sm font-light transition-colors",
            isDark 
              ? "bg-slate-900/90 text-slate-500" 
              : "bg-zinc-100 text-slate-500"
          )}
        >
          Search global workspace (Coming soon)...
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <button
          disabled
          className={cn(
            "flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full transition-colors",
            isDark ? "text-slate-400" : "text-slate-300"
          )}
          title="Notifications"
        >
          <Bell className="h-5 w-5" strokeWidth={1.5} />
        </button>

        <div className={cn(
          "ml-1 flex items-center gap-3 border-l pl-3 lg:pl-4 transition-colors",
          isDark ? "border-slate-800" : "border-zinc-200"
        )}>
          <Link href="/settings" className="group/user flex items-center gap-3 transition-opacity hover:opacity-80">
            <UserAvatar userName={userName} userInitials={userInitials} />
            <div className="hidden flex-col text-left sm:flex">
              <span className={cn(
                "font-sans text-sm leading-none font-medium transition-colors",
                isDark ? "text-slate-200" : "text-slate-800"
              )}>
                {userName}
              </span>
              <span className={cn(
                "mt-1.5 text-[9px] leading-none font-bold tracking-tighter uppercase transition-colors",
                isDark ? "text-slate-500" : "text-slate-400"
              )}>
                {userRole}
              </span>
            </div>
          </Link>
          <button
              type="button"
              onClick={() => {
                void logout(undefined);
              }}
              className={cn(
                "ml-1 flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                isDark 
                  ? "text-slate-400 hover:bg-slate-900 hover:text-red-400" 
                  : "text-slate-400 hover:bg-zinc-100 hover:text-red-500"
              )}
              title="Log Out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
        </div>
      </div>
    </header>
  );
}
