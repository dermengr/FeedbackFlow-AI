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
  Shield,
} from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { SearchBar } from "@/components/SearchBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTranslation } from "@/contexts/LocaleContext";
import type { MessageKey } from "@/lib/i18n/messages/en";
import { PAGE_PERMISSIONS, type PermissionName, type RoleName } from "@/lib/roles";

type NavLink = {
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  permission?: PermissionName;
};

const allNavLinks: NavLink[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, permission: PAGE_PERMISSIONS["/dashboard"] },
  { href: "/inbox", labelKey: "nav.inbox", icon: Inbox, permission: PAGE_PERMISSIONS["/inbox"] },
  { href: "/clusters", labelKey: "nav.clusters", icon: Layers, permission: PAGE_PERMISSIONS["/clusters"] },
  { href: "/sources", labelKey: "nav.sources", icon: Plug, permission: PAGE_PERMISSIONS["/sources"] },
  { href: "/team", labelKey: "nav.team", icon: Users, permission: PAGE_PERMISSIONS["/team"] },
  { href: "/routing", labelKey: "nav.routing", icon: Route, permission: PAGE_PERMISSIONS["/routing"] },
  { href: "/health", labelKey: "nav.health", icon: HeartPulse, permission: PAGE_PERMISSIONS["/health"] },
  { href: "/webhooks", labelKey: "nav.webhooks", icon: Webhook, permission: PAGE_PERMISSIONS["/webhooks"] },
  { href: "/api-keys", labelKey: "nav.apiKeys", icon: KeyRound, permission: PAGE_PERMISSIONS["/api_keys"] },
  { href: "/onboarding", labelKey: "nav.onboarding", icon: GraduationCap, permission: PAGE_PERMISSIONS["/onboarding"] },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, permission: PAGE_PERMISSIONS["/settings"] },
  { href: "/admin/logs", labelKey: "nav.logs", icon: ScrollText, permission: PAGE_PERMISSIONS["/admin"] },
  { href: "/admin/roles", labelKey: "nav.roles", icon: Shield, permission: PAGE_PERMISSIONS["/admin"] },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function usePermissions() {
  const { data: session } = useSession();
  const permissions = useMemo<PermissionName[]>(
    () => ((session?.user as { permissions?: PermissionName[] })?.permissions) ?? [],
    [session]
  );
  const roles = useMemo<RoleName[]>(
    () => ((session?.user as { roles?: RoleName[] })?.roles) ?? [],
    [session]
  );
  const isAdmin = roles.includes("Admin");
  return { permissions, roles, isAdmin };
}

function useFilteredLinks() {
  const { permissions, isAdmin } = usePermissions();
  return useMemo(() => {
    if (isAdmin) return allNavLinks;
    return allNavLinks.filter((link) => {
      if (!link.permission) return true;
      return permissions.includes(link.permission);
    });
  }, [permissions, isAdmin]);
}

function NavItem({
  link,
  label,
  pathname,
  onNavigate,
  compact,
}: {
  link: NavLink;
  label: string;
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
      {label}
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const filteredLinks = useFilteredLinks();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Split into primary (first 4) and more links
  const primaryLinks = filteredLinks.slice(0, 4);
  const moreLinks = filteredLinks.slice(4);
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
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
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
          <span className="hidden sm:inline">{t("app.name")}</span>
        </Link>

        <div className="hidden min-w-0 flex-1 md:block md:max-w-md lg:max-w-lg">
          <SearchBar />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <LanguageSelector compact />
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
            aria-label={t("nav.signOut")}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t("nav.signOut")}</span>
          </button>
        </div>
      </div>

      <div className="hidden border-t border-slate-100 lg:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-1.5 sm:px-6">
          <nav className="flex items-center gap-0.5" aria-label="Main navigation">
            {primaryLinks.map((link) => (
              <NavItem
                key={link.href}
                link={link}
                label={t(link.labelKey)}
                pathname={pathname}
              />
            ))}
          </nav>

          {moreLinks.length > 0 && (
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
                {t("nav.more")}
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
                        {t(link.labelKey)}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/20 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-0 top-14 z-50 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-slate-200 bg-white shadow-lg lg:hidden">
            <div className="space-y-3 border-b border-slate-100 p-4">
              <div className="md:hidden">
                <SearchBar />
              </div>
              <LanguageSelector />
            </div>
            <nav className="space-y-1 p-3" aria-label="Mobile navigation">
              {filteredLinks.map((link) => {
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
                    {t(link.labelKey)}
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
