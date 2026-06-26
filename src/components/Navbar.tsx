"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Inbox,
  Layers,
  LogOut,
  MessageSquareWarning,
  Plug,
  ScrollText,
  Users,
  Webhook,
  KeyRound,
  Route,
  HeartPulse,
  GraduationCap,
  Settings,
  Menu,
  X,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SearchBar } from "@/components/SearchBar";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const primaryLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/clusters", label: "Clusters", icon: Layers },
  { href: "/sources", label: "Sources", icon: Plug },
];

const moreLinks: NavLink[] = [
  { href: "/team", label: "Team", icon: Users },
  { href: "/routing", label: "Routing", icon: Route },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
];

const allLinks = [...primaryLinks, ...moreLinks];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavItem({
  link,
  pathname,
  onNavigate,
  compact,
}: {
  link: NavLink;
  pathname: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const active = isActive(pathname, link.href);
  const Icon = link.icon;

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
        compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-1.5 text-sm",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {link.label}
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const moreActive = moreLinks.some((l) => isActive(pathname, l.href));

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      {/* Top bar: logo, search, user actions */}
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 font-semibold text-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white">
            <MessageSquareWarning className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">FeedbackFlow AI</span>
        </Link>

        <div className="hidden min-w-0 flex-1 md:block md:max-w-md lg:max-w-lg">
          <SearchBar />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {session?.user?.email && (
            <span
              className="hidden max-w-[10rem] truncate text-sm text-slate-500 xl:inline"
              title={session.user.email}
            >
              {session.user.email}
            </span>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* Desktop navigation row */}
      <div className="hidden border-t border-slate-100 lg:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-1.5 sm:px-6">
          <nav className="flex items-center gap-0.5" aria-label="Main navigation">
            {primaryLinks.map((link) => (
              <NavItem key={link.href} link={link} pathname={pathname} />
            ))}
          </nav>

          <div className="relative ml-1" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                moreActive || moreOpen
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal className="h-4 w-4" />
              More
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")}
              />
            </button>

            {moreOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                {moreLinks.map((link) => {
                  const active = isActive(pathname, link.href);
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-brand-50 text-brand-700"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile / tablet navigation drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/20 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-0 top-14 z-50 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-slate-200 bg-white shadow-lg lg:hidden">
            <div className="border-b border-slate-100 p-4 md:hidden">
              <SearchBar />
            </div>
            <nav className="space-y-1 p-3" aria-label="Mobile navigation">
              {allLinks.map((link) => {
                const active = isActive(pathname, link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            {session?.user?.email && (
              <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                Signed in as {session.user.email}
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}