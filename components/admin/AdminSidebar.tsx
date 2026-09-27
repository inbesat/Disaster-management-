"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  MapPinned,
  ListChecks,
  ScrollText,
  Activity,
  Satellite,
  Settings,
  BarChart3,
  Radio,
  Volume2,
  PhoneCall,
  History,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import Logo from "@/components/ui/Logo";
import LanguageSelector from "@/components/ui/LanguageSelector";
import { signOutAction } from "@/app/actions/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "User Management", icon: Users },
  { href: "/districts", label: "District Config", icon: MapPinned },
  { href: "/bulk-ops", label: "Bulk Operations", icon: ListChecks },
  { href: "/fm-stations", label: "FM Stations", icon: Radio },
  { href: "/tts-preview", label: "Voice Preview", icon: Volume2 },
  { href: "/broadcast-monitor", label: "Broadcast Monitor", icon: PhoneCall },
  { href: "/broadcast-history", label: "Broadcast History", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/satellite", label: "Satellite", icon: Satellite },
  { href: "/settings/profile", label: "Settings", icon: Settings },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/health", label: "System Health", icon: Activity },
] as const;

function SidebarContent() {
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-14 items-center justify-between gap-2.5 border-b border-panel-border px-5">
        <div className="flex items-center gap-2.5">
          <Logo className="h-7 w-7 shrink-0" />
          <span className="eoc-label text-amber-400/90">SAFESPHERE / ADMIN</span>
        </div>
        <BackButton />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-amber-500/10 text-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.25)]"
                  : "text-slate-400 hover:bg-panel-hoverAlt hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-panel-border px-5 py-4">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">
          Super Admin
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Full system control · restricted access
        </p>
        {/* Sign out — server action ends the session + cookie ride. */}
        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-panel-border bg-panel px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign Out
          </button>
        </form>
      </div>
    </>
  );
}

export default function AdminSidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#070b13] text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-panel-border bg-panel lg:flex">
        <SidebarContent />
      </aside>

      {/* Distinguant elevated top header — darker/stricter than the main app */}
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between gap-3 border-b border-panel-border bg-panel-darker px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-md border border-panel-border bg-panel px-3 py-2 text-sm font-medium text-amber-300 transition hover:bg-panel-hoverAlt lg:hidden"
              aria-label="Open admin navigation"
            >
              <Menu className="h-4 w-4" />
              Admin menu
            </button>
          )}
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300">
            <Logo className="h-6 w-6 shrink-0" />
            <span className="hidden sm:inline">SafeSphere / Admin Console</span>
            <span className="sm:hidden">Admin</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSelector />
          <span className="hidden items-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-widest text-red-400 sm:inline-flex">
            Elevated Access
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-panel-border bg-panel px-2.5 py-1 font-mono text-[0.625rem] text-slate-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            LIVE
          </span>
          <BackButton />
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-panel-border bg-panel">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-md p-2 text-slate-400 transition hover:bg-panel-hoverAlt hover:text-slate-200"
              aria-label="Close admin navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="lg:pl-[260px]">
        <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
