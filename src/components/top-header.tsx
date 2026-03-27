"use client";

import { Bell, LogOut, Menu, Search } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/actions";
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
}: {
  userName: string;
  userInitials?: string | null;
  userRole: Role;
}) {
  const { toggle } = useSidebar();

  return (
    <header className="z-20 flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={toggle}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </Button>

        <Link href="/" className="group flex select-none items-baseline gap-2">
          <span className="font-serif text-lg font-black tracking-widest text-black uppercase">
            STUDIOFLOW
          </span>
          <span className="font-sans text-[10px] font-bold uppercase tracking-tighter text-slate-400 transition-colors group-hover:text-slate-600">
            by BK
          </span>
        </Link>
      </div>

      <div className="relative mx-4 hidden max-w-xl flex-1 cursor-not-allowed opacity-50 md:block lg:mx-8">
        <Search
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          strokeWidth={1.5}
        />
        <input
          disabled
          className="h-10 w-full cursor-not-allowed rounded-full border-none bg-zinc-100 pl-11 pr-4 font-sans text-sm placeholder:font-light placeholder:text-slate-500 focus:outline-none"
          placeholder="Search global workspace (Coming soon)..."
        />
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <button
          disabled
          className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full text-slate-300"
          title="Notifications"
        >
          <Bell className="h-5 w-5" strokeWidth={1.5} />
        </button>

        <div className="ml-1 flex items-center gap-3 border-l border-zinc-200 pl-3 lg:pl-4">
          <UserAvatar userName={userName} userInitials={userInitials} />
          <div className="hidden flex-col text-left sm:flex">
            <span className="font-sans text-sm leading-none font-medium text-slate-800">
              {userName}
            </span>
            <span className="mt-1.5 text-[9px] leading-none font-bold tracking-tighter text-slate-400 uppercase">
              {userRole}
            </span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-zinc-100 hover:text-red-500"
              title="Log Out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
