"use client";

// ---------------------------------------------------------------------
// app/(dashboard)/settings/layout.tsx — UI/UX Phase 7 · Step 1.
//
// Global Settings shell.
//   Desktop (lg+): fixed-height workspace with a sticky 280px (w-72)
//   category sidebar on the left and a scrollable content column right.
//   Mobile: the sidebar collapses into a horizontally scrollable tab bar
//   pinned to the top of the screen.
// Dividers use --border-subtle, backgrounds --bg-primary.
// ---------------------------------------------------------------------

import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  CreditCard,
  Gauge,
  HardDrive,
  Map,
  Phone,
  Shield,
  User,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  admin?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/map", label: "Map", icon: Map },
  { href: "/settings/ai", label: "AI", icon: Shield },
  { href: "/settings/ai-setup", label: "AI Setup", icon: Gauge },
  { href: "/settings/storage", label: "Storage", icon: HardDrive },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/organization", label: "Organization", icon: Building2 },
  { href: "/settings/privacy", label: "Privacy & Security", icon: Shield },
  { href: "/settings/contacts", label: "Emergency Contacts", icon: Phone },
  { href: "/settings/admin", label: "Admin Panel", icon: Gauge, admin: true },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  const navLink = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <a
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium transition ${
          active
            ? "border-accent bg-accent/10 text-accent"
            : "border-transparent text-slate-400 hover:bg-tertiary hover:text-slate-200"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{item.label}</span>
        {item.admin && (
          <span className="ml-auto shrink-0 rounded border border-subtle bg-tertiary px-1 py-px font-mono text-[9px] uppercase tracking-wider text-muted">
            Admin
          </span>
        )}
      </a>
    );
  };

  return (
    <div className="flex h-[calc(100dvh-56px)] min-w-0 w-full flex-col bg-[var(--bg-primary)] text-foreground">
      {/* Mobile: horizontal category tab bar */}
      <nav
        aria-label="Settings categories"
        className="sticky top-0 z-20 flex shrink-0 gap-1.5 overflow-x-auto border-b border-subtle bg-[var(--bg-primary)] px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-subtle bg-secondary text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Desktop: sticky sidebar */}
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-subtle bg-[var(--bg-primary)] lg:flex">
          <div className="border-b border-subtle px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Settings
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Command preferences &amp; admin
            </p>
          </div>
          <nav
            aria-label="Settings categories"
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
          >
            {NAV_ITEMS.map((item) => navLink(item))}
          </nav>
          <div className="border-t border-subtle p-3">
            <a
              href="/command-center"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 transition hover:bg-tertiary hover:text-slate-200"
            >
              ← Back to Command Center
            </a>
          </div>
        </aside>

        {/* Content column */}
        <main id="main-content" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
