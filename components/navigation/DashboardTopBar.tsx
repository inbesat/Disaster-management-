// ---------------------------------------------------------------------
// components/navigation/DashboardTopBar.tsx
// UI/UX Phase 2 · Step 4 — slim top bar above dashboard content.
//
// Replaces the old full-width Navbar inside the dashboard shell: the nav
// links moved into the fixed Sidebar, so this bar only hosts the utility
// cluster that used to live in the Navbar's right side — avatar + name,
// sync status, presence, notifications, push toggle, settings, language
// selector, mobile hamburger and the sign-out / exit-demo form. (The
// theme toggle was removed — dark mode is LOCKED for demo day, see
// Demo-day hardening · Step 6 in docs/CONTEXT_HANDOFF.md.)
//
// Client component because of LanguageSelector/etc. The server layout
// resolves identity (guest flag + name/email/avatar) and passes it in as
// props — mirroring the Navbar's old server-side auth reads.
// ---------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Settings } from "lucide-react";
import NotificationCenter from "@/components/dashboard/NotificationCenter";
import PushNotificationToggle from "@/components/dashboard/PushNotificationToggle";
import PresenceIndicators from "@/components/dashboard/PresenceIndicators";
import SyncStatus from "@/components/dashboard/SyncStatus";
import LanguageSelector from "@/components/ui/LanguageSelector";
import NavbarAvatar from "@/components/NavbarAvatar";
import BackButton from "@/components/ui/BackButton";
import Translated from "@/components/ui/Translated";

type DashboardTopBarProps = {
  /** Guest (demo) mode — swaps the avatar for the guest icon + labels. */
  guest: boolean;
  /** Resolved display name ("Guest Commander" in demo mode). */
  displayName: string;
  /** User email (null in demo mode). */
  email: string | null;
  /** Server-provided avatar URL (client falls back to local snapshot). */
  avatarUrl: string | null;
  /** Opens the mobile sidebar drawer (<lg). */
  onOpenMobile?: () => void;
};

export function DashboardTopBar({
  guest,
  displayName,
  email,
  avatarUrl,
  onOpenMobile,
}: DashboardTopBarProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    // Clear any mock auth data
    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
      localStorage.removeItem("auth_token");
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/");
      });
    }
    // Redirect to login
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-subtle bg-secondary px-4">
      <div className="flex min-w-0 items-center gap-2">
        <BackButton />
      </div>

      {/* Phase 10 · Step 2 — live IST clock, centered on every dashboard
          page (incl. the guest command center judges see; the hero-header
          clock alone lives on the admin-only /dashboard route). timeClassName
          keeps it readable when the top bar re-themes in day-ops. Hidden
          below md where the right utility cluster crowds it. */}
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">
        {/* Identity — avatar + name (mirrors the old Navbar layout) */}
        <div className="flex items-center gap-2.5">
          {guest ? (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 bg-surface-elevated text-accent"
              aria-hidden="true"
            >
              <GuestAvatarIcon />
            </span>
          ) : (
            <NavbarAvatar serverAvatarUrl={avatarUrl} displayName={displayName} />
          )}

          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-semibold text-primary">
              {displayName}
            </span>
            {guest ? (
              <span className="block text-[0.6875rem] font-medium uppercase tracking-wider text-accent">
                Demo mode
              </span>
            ) : (
              <span className="block text-[0.6875rem] text-muted">{email}</span>
            )}
          </span>
        </div>

        <div className="hidden md:block">
          <SyncStatus />
        </div>
        <div className="hidden sm:block"><PresenceIndicators /></div>
        <NotificationCenter />
        <div className="hidden md:block">
          <PushNotificationToggle />
        </div>

        {/* Settings module entry point (Phase 1 · Settings shell) */}
        <Link
          href="/settings/profile"
          aria-label="Open settings"
          title="Settings"
          className="hidden h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-elevated text-muted transition hover:border-accent hover:text-accent sm:flex"
        >
          <Settings className="h-4 w-4" aria-hidden />
        </Link>

        {/* Phase 25 · Step 4 — multilingual selector (23 languages) */}
        <div className="sm:hidden"><LanguageSelector compact /></div>
        <div className="hidden sm:block"><LanguageSelector /></div>

        {/* ThemeToggle removed for demo day — dark mode is LOCKED via
            ThemeProvider forcedTheme="dark". */}

        {/* Mobile drawer hamburger — opens the fixed Sidebar overlay (<md).
            Tablet+ hides it; the sidebar is visible on its own there. */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open navigation drawer"
          aria-haspopup="dialog"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated text-foreground transition hover:border-accent hover:text-accent md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSignOut();
          }}
          className="ml-1 hidden border-l border-border pl-4 sm:block"
        >
          <button
            type="submit"
            className="min-h-[44px] rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs font-medium text-primary transition hover:border-accent hover:text-accent"
          >
            <Translated k={guest ? "exit_demo" : "sign_out"} />
          </button>
        </form>
      </div>
    </header>
  );
}

function GuestAvatarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default DashboardTopBar;
