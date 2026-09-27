"use client";

// ---------------------------------------------------------------------
// components/navigation/MoreBottomSheet.tsx
// UI/UX Phase 3 · Step 5 — spillover menu for the 8+ pages the 7-tab
// BottomNav can't fit.
//
// Framer Motion overlay sheet that slides up from the bottom:
//   • AnimatePresence drives mount/unmount, so the backdrop fades in and
//     the sheet springs up (and reverses on close) instead of popping.
//   • Backdrop is bg-black/60 — clicking it closes the sheet (Escape and
//     the grab-handle close it too).
//   • Content is a 3-column grid of large touch targets (min 72px tall):
//     Shelters · Resources · Routes · Satellite · Settings · Profile ·
//     Logout. Nav items are <Link>s (close the sheet on tap); Logout is a
//     button that ends the demo session.
// ---------------------------------------------------------------------

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  LifeBuoy,
  LogOut,
  PackageOpen,
  Route,
  Satellite,
  Settings,
  Tent,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";

type MoreSheetProps = {
  /** Mounts/unmounts the overlay (drives the enter/exit animation). */
  open: boolean;
  /** Close the sheet — wired to the backdrop, Escape and grab handle. */
  onClose: () => void;
};

type MoreItem =
  | { kind: "link"; label: string; href: string; icon: LucideIcon }
  | { kind: "logout"; label: string; icon: LucideIcon };

const ITEMS: MoreItem[] = [
  { kind: "link", label: "Shelters", href: "/shelters", icon: Tent },
  { kind: "link", label: "Resources", href: "/inventory", icon: PackageOpen },
  { kind: "link", label: "Routes", href: "/evacuations", icon: Route },
  { kind: "link", label: "Satellite", href: "/satellite", icon: Satellite },
  { kind: "link", label: "Settings", href: "/settings/profile", icon: Settings },
  { kind: "link", label: "Profile", href: "/settings/profile", icon: UserRound },
  { kind: "link", label: "Help Center", href: "https://help.safesphere.com", icon: LifeBuoy },
  { kind: "logout", label: "Logout", icon: LogOut },
];

export function MoreBottomSheet({ open, onClose }: MoreSheetProps) {

  // Escape closes the sheet — matching the backdrop / handle behaviour.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleLogout = async () => {
    toast.success("Logged out — demo session ended.");
    onClose();
    // MUST call the server action — a bare router.push("/login") leaves every
    // role/guest cookie behind, so a later gov login gets bounced back to the
    // public dashboard (role contamination). signOutAction() clears the whole
    // cookie session and redirects server-side; the hard reload below resets
    // any client-side state/cache so the next login starts clean.
    try {
      await signOutAction();
    } catch {
      // signOutAction redirects — swallowing the redirect so the hard reload
      // below always runs and guarantees a clean client reset.
    }
    window.location.href = "/";
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Dimmed backdrop — click to dismiss. */}
          <motion.div
            key="more-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60"
          />

          {/* Sheet — springs up from the bottom edge. */}
          <motion.div
            key="more-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-label="More options"
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-white/10 bg-secondary pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.45)]"
          >
            {/* Grab handle */}
            <div className="flex items-center justify-between px-5 pt-3">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close more menu"
                className="-ml-1 rounded-md p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
              <span className="h-1.5 w-10 rounded-full bg-white/15" aria-hidden />
              <span className="w-7" aria-hidden />
            </div>

            <p className="px-5 pb-1 pt-2 text-[0.625rem] font-bold uppercase tracking-widest text-slate-500">
              More
            </p>

            {/* 3-column grid of large touch targets. */}
            <div className="grid grid-cols-3 gap-2 px-3 pb-4 pt-2">
              {ITEMS.map((item) => {
                const Icon = item.icon;
                const baseClassName =
                  "flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl p-3 text-[0.6875rem] font-semibold transition-colors duration-150 motion-reduce:transition-none";
                if (item.kind === "logout") {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={handleLogout}
                      className={`${baseClassName} text-rose-300 hover:bg-rose-500/10`}
                    >
                      <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
                      <span>{item.label}</span>
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className={`${baseClassName} text-slate-200 hover:bg-white/5`}
                  >
                    <Icon
                      className="h-6 w-6 text-[var(--accent-primary)]"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default MoreBottomSheet;
