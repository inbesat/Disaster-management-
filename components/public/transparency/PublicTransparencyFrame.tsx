"use client";

// ---------------------------------------------------------------------
// components/public/transparency/PublicTransparencyFrame.tsx — client
// shell for the public "Live Response Status" panel.
//
// Converted to a full-height sliding overlay drawer (Phase 3):
//
//   • Drawer: fixed top-0 right-0 h-[100dvh] z-[70], slides in/out
//     via translate-x with duration-500 ease-out.
//   • Width: w-full on mobile (full-screen overlay), md:w-[400px] on
//     desktop (side panel).
//   • Toggle: a frosted-glass button on the left outer edge of the
//     panel (absolute top-1/3 -left-12) with a Chart icon.
//   • Backdrop: fixed inset-0 bg-black/60 backdrop-blur-sm z-[65]
//     behind the panel on mobile so tapping empty space closes it.
//   • Mobile trigger: a floating pill above the BottomNav that opens
//     the drawer when it's closed.
// ---------------------------------------------------------------------

import { useEffect, useState, type ReactNode } from "react";
import { Activity, BarChart2, X } from "lucide-react";

type PublicTransparencyFrameProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export default function PublicTransparencyFrame({
  title = "Live Response Status",
  subtitle = "Read-only view of the district response",
  children,
}: PublicTransparencyFrameProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Lock body scroll on mobile while the drawer is open (< md).
  useEffect(() => {
    if (!isOpen) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
    )
      return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const header = (
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-2 text-sm font-bold text-white">
        <Activity
          aria-hidden
          className="h-4 w-4 shrink-0 text-[var(--dl-orange)]"
        />
        {title}
      </p>
      <p className="mt-0.5 text-xs text-[var(--dl-text-muted)]">{subtitle}</p>
    </div>
  );

  return (
    <>
      {/* ── Backdrop — mobile only, rendered when drawer is open ── */}
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm transition-opacity duration-500 md:hidden"
        />
      )}

      {/* Render the panel only while open so it cannot widen the document. */}
      {isOpen && (
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed top-0 right-0 z-[70] h-[100dvh] w-full border-l border-white/10 bg-[rgb(var(--bg-primary-rgb)/95)] backdrop-blur-xl md:w-[400px]"
        >
          <div className="relative flex h-full flex-col overflow-hidden">
          {/* ── Pinned header with close button ── */}
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
            {header}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close panel"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[var(--dl-text-muted)] transition hover:text-white"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>

          {/* ── Scrollable widget stack ── */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
            {children}
          </div>
        </div>
        </aside>
      )}

      {/* ── Desktop drawer trigger ── */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          aria-label="Open live response panel"
          className="fixed right-0 top-1/3 z-[70] hidden h-16 w-12 -translate-y-1/2 items-center justify-center rounded-l-2xl border-y border-l border-white/20 bg-[var(--brand-navy2)] text-white shadow-xl hover:bg-slate-700 md:flex"
        >
          <BarChart2 aria-hidden className="h-5 w-5" />
        </button>
      )}

      {/* ── Mobile floating trigger — visible when drawer is closed ── */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          aria-label="Open live response status"
          className="fixed bottom-[calc(160px+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-[var(--brand-navy2)] px-4 py-3 text-sm font-semibold text-white shadow-xl ring-1 ring-white/10 transition hover:border-[var(--dl-orange)]/60 active:scale-95 md:hidden"
        >
          <Activity aria-hidden className="h-4 w-4 text-[var(--dl-orange)]" />
          Live Status
        </button>
      )}
    </>
  );
}
