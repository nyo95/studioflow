/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/user-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/context/sidebar-context";
import type { Role } from "@/generated/prisma";
import { useLocalStorage, useRelativeTime } from "@/hooks/use-hydration";
import { buildActivitySentence, formatActionLabel } from "@/lib/activity-copy";

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

type HeaderProjectSearchItem = {
  id: string;
  name: string;
  client: {
    name: string;
  } | null;
};

type HeaderActivityNotificationItem = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actorName: string;
  projectId: string | null;
  projectName: string | null;
  href: string;
};

function NotificationTime({ value }: { value: string }) {
  const relative = useRelativeTime(value, true);
  const absolute = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

  return <span title={absolute}>{relative || absolute}</span>;
}

export function TopHeader({
  userName,
  userInitials,
  userRole,
  appTitle = "StudioFlow",
  logoUrl,
  theme = "light",
  projectSearchItems = [],
  activityNotifications = [],
}: {
  userName: string;
  userInitials?: string | null;
  userRole: Role;
  appTitle?: string;
  logoUrl?: string | null;
  theme?: "light" | "dark";
  projectSearchItems?: HeaderProjectSearchItem[];
  activityNotifications?: HeaderActivityNotificationItem[];
}) {
  const { toggle } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const isDark = theme === "dark";
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastSeenAt, setLastSeenAt] = useLocalStorage<string>("activity-last-seen-at", "");
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(() => {
    if (!lastSeenAt) {
      return activityNotifications.length;
    }
    const lastSeen = new Date(lastSeenAt).getTime();
    if (Number.isNaN(lastSeen)) {
      return activityNotifications.length;
    }
    return activityNotifications.filter((item) => new Date(item.createdAt).getTime() > lastSeen).length;
  }, [activityNotifications, lastSeenAt]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length === 0) {
      return projectSearchItems.slice(0, 6);
    }

    return projectSearchItems
      .filter((project) => {
        const clientName = project.client?.name?.toLowerCase() ?? "";
        return (
          project.name.toLowerCase().includes(normalizedQuery) ||
          clientName.includes(normalizedQuery)
        );
      })
      .slice(0, 8);
  }, [projectSearchItems, query]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex > filteredProjects.length - 1) {
      setActiveIndex(0);
    }
  }, [activeIndex, filteredProjects]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  function handleProjectSelect(projectId: string) {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
    router.push(`/projects/${projectId}`);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filteredProjects.length === 0) return;
    handleProjectSelect(filteredProjects[Math.min(activeIndex, filteredProjects.length - 1)].id);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(0);
      return;
    }

    if (filteredProjects.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((currentIndex) => (currentIndex + 1) % filteredProjects.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((currentIndex) =>
        currentIndex === 0 ? filteredProjects.length - 1 : currentIndex - 1
      );
    }
  }

  return (
    <header 
      className={cn(
        "z-20 flex h-16 flex-shrink-0 items-center justify-between border-b px-[var(--ui-section-px,1.5rem)] transition-colors duration-300",
        isDark 
          ? "border-slate-800 bg-slate-950" 
          : "border-slate-200 bg-white"
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
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

      <div ref={searchContainerRef} className="relative mx-4 hidden max-w-xl flex-1 md:block lg:mx-8">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search projects or clients..."
            className={cn(
              "h-10 w-full rounded-full border pl-11 pr-4 font-sans text-sm font-light outline-none transition-colors",
              isDark
                ? "border-slate-800 bg-slate-900/90 text-slate-100 placeholder:text-slate-500 focus:border-slate-700"
                : "border-transparent bg-zinc-100 text-slate-700 placeholder:text-slate-500 focus:border-slate-300"
            )}
            aria-label="Search projects"
          />
        </form>

        {isOpen ? (
          <div
            className={cn(
              "absolute left-0 right-0 top-12 overflow-hidden rounded-3xl border shadow-xl",
              isDark
                ? "border-slate-800 bg-slate-950"
                : "border-slate-200 bg-white"
            )}
          >
            {filteredProjects.length > 0 ? (
              <div className="py-2">
                {filteredProjects.map((project, index) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleProjectSelect(project.id)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors",
                      activeIndex === index
                        ? isDark
                          ? "bg-slate-900"
                          : "bg-slate-50"
                        : isDark
                        ? "hover:bg-slate-900"
                        : "hover:bg-slate-50"
                    )}
                  >
                    <div className="min-w-0">
                      <p className={cn(
                        "truncate font-sans text-sm font-medium",
                        isDark ? "text-slate-100" : "text-slate-900"
                      )}>
                        {project.name}
                      </p>
                      <p className={cn(
                        "truncate pt-1 text-[11px] uppercase tracking-wide",
                        isDark ? "text-slate-500" : "text-slate-400"
                      )}>
                        {project.client?.name || "No client"}
                      </p>
                    </div>
                    <span className={cn(
                      "shrink-0 font-sans text-[10px] font-semibold uppercase tracking-[0.2em]",
                      isDark ? "text-slate-500" : "text-slate-400"
                    )}>
                      Open
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className={cn(
                "px-4 py-4 font-sans text-sm",
                isDark ? "text-slate-500" : "text-slate-500"
              )}>
                No matching projects.
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <DropdownMenu onOpenChange={(open) => {
          if (open) {
            setLastSeenAt(new Date().toISOString());
          }
        }}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                isDark
                  ? "text-slate-400 hover:bg-slate-900 hover:text-white"
                  : "text-slate-400 hover:bg-zinc-100 hover:text-slate-700"
              )}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" strokeWidth={1.5} />
              {unreadCount > 0 ? (
              <span className={cn("absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500", isDark ? "ring-2 ring-slate-950" : "ring-2 ring-white")} />
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[360px] rounded-[var(--ui-radius-card,1.5rem)] border border-slate-200 p-0 shadow-[var(--ui-surface-shadow)]">
            <div className="flex items-center justify-between px-4 py-3">
              <DropdownMenuLabel className="p-0 font-serif text-base font-semibold text-slate-900">
                Notifications
              </DropdownMenuLabel>
              <span className="text-xs text-slate-500">
                {unreadCount > 0 ? `${unreadCount} baru` : "Semua terbaca"}
              </span>
            </div>
            <DropdownMenuSeparator className="my-0" />

            <div className="max-h-[360px] overflow-y-auto p-1">
              {activityNotifications.length > 0 ? (
                activityNotifications.map((item) => (
                  <DropdownMenuItem key={item.id} asChild className="cursor-pointer rounded-xl p-0 focus:bg-slate-50">
                    <Link href={item.href} className="flex items-start gap-3 px-3 py-3">
                      <Avatar className="mt-0.5 h-8 w-8">
                        <AvatarFallback className="bg-slate-100 text-[10px] font-semibold text-slate-700">
                          {(item.actorName?.charAt(0) || "S").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm text-slate-800">
                          {buildActivitySentence({
                            actorName: item.actorName,
                            action: item.action,
                            entityType: item.entityType,
                          })}
                        </p>
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                          {item.projectName || formatActionLabel(item.action)}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          <NotificationTime value={item.createdAt} />
                        </p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-sm text-slate-500">
                  Belum ada aktivitas terbaru.
                </div>
              )}
            </div>

            <DropdownMenuSeparator className="my-0" />
            <div className="p-2">
              <Button asChild variant="ghost" size="sm" className="h-8 w-full justify-center text-xs">
                <Link href="/activity">Lihat semua aktivitas</Link>
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

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
