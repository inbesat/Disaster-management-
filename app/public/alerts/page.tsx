"use client";

// ---------------------------------------------------------------------
// app/public/alerts/page.tsx — Phase 3 · Step 1 · Public Alerts feed.
//
// Mobile-first single-column page (the citizen phone frame, matching the
// dashboard) with:
//   • a sticky header (back to dashboard + live count of the current view)
//   • a horizontal scrollable filter bar — All / My Area / District /
//     State — that really filters the mock feed (Phase 3 · Step 1)
//   • the touch-friendly AlertCard list with swipe-right-to-mark-read
//     (Phase 3 · Step 2)
//   • safe-area bottom padding so nothing hides behind the fixed BottomNav
//
// The filter bar is a deliberate small extension of the "placeholder
// list" step: the mock alerts carry a `scope` and the chips drive a pure
// filter (lib/mock-data/public-alerts.ts), so the tab bar demos live
// instead of being inert — swap in real geo logic later without touching
// this page's shape.
// ---------------------------------------------------------------------

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  Inbox,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import AlertCard from "@/components/public/AlertCard";
import AlertDetailModal from "@/components/public/AlertDetailModal";
import BottomNav from "@/components/public/BottomNav";
import SafeStatusToggle from "@/components/public/SafeStatusToggle";
import {
  CRITICAL_OVERLAY_SESSION_KEY,
} from "@/components/public/CriticalAlertOverlay";
import { useAlertPreferences } from "@/hooks/useAlertPreferences";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { filterAlertsByPreferences } from "@/lib/mock-data/alert-preferences";
import {
  ALERT_FILTERS,
  CITIZEN_CRITICAL_ALERT_EVENT,
  CITIZEN_DEMO_ALERT_EVENT,
  PUBLIC_ALERTS,
  cacheAlerts,
  filterAlertsByScope,
  formatCachedAt,
  readCachedAlerts,
  type AlertFilter,
  type PublicAlert,
} from "@/lib/mock-data/public-alerts";

const DEMO_ALERTS_ENABLED = process.env.NEXT_PUBLIC_DEMO_DATA_ENABLED === "true";

export default function PublicAlertsPage() {
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [selected, setSelected] = useState<PublicAlert | null>(null);
  // Phase 3 · Steps 5 + 7 — connectivity, preferences and offline cache.
  const offline = useOfflineStatus();
  const { preferences } = useAlertPreferences();
  const [cachedAlerts, setCachedAlerts] = useState<PublicAlert[] | null>(null);
  const [cachedAtLabel, setCachedAtLabel] = useState<string | null>(null);
  // Judge-triggered simulated alerts (Phase 3 · Step 10).
  const [extraAlerts, setExtraAlerts] = useState<PublicAlert[]>([]);

  // Persist the feed to the offline cache on load, and remember when it
  // was written so the amber banner can say "cached from …" (Step 7).
  useEffect(() => {
    if (!DEMO_ALERTS_ENABLED) return;
    cacheAlerts(PUBLIC_ALERTS);
    const cached = readCachedAlerts();
    if (cached.alerts) setCachedAlerts(cached.alerts);
    setCachedAtLabel(formatCachedAt(cached.cachedAt));
  }, []);

  // Critical takeover (Step 3): request the overlay once per tab session
  // when the feed carries a critical alert — the layout-level
  // PublicAlertHost owns the actual overlay and opens it on this event.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.sessionStorage.getItem(CRITICAL_OVERLAY_SESSION_KEY);
      if (DEMO_ALERTS_ENABLED && !seen && PUBLIC_ALERTS.some((a) => a.severity === "critical")) {
        // Defer past this commit's effect flush: on a full page load this
        // page's effects run BEFORE the layout host's listener attaches
        // (sibling order), so a synchronous dispatch would be lost — the
        // once-per-session takeover would never appear on first visit.
        queueMicrotask(() =>
          window.dispatchEvent(new CustomEvent(CITIZEN_CRITICAL_ALERT_EVENT)),
        );
      }
    } catch {
      // storage unavailable (private mode) — skip the auto-takeover
    }
  }, []);

  // Dev Tools "Simulate Official Alert" (Step 10) — prepend the payload.
  useEffect(() => {
    const onDemoAlert = (event: Event) => {
      const alert = (event as CustomEvent<PublicAlert>).detail;
      // Cap the simulated feed so a judge spamming the button can't grow
      // the list without bound.
      if (DEMO_ALERTS_ENABLED && alert) setExtraAlerts((prev) => [alert, ...prev].slice(0, 10));
    };
    window.addEventListener(CITIZEN_DEMO_ALERT_EVENT, onDemoAlert);
    return () =>
      window.removeEventListener(CITIZEN_DEMO_ALERT_EVENT, onDemoAlert);
  }, []);

  // Offline → show the last cached feed instead of the live array;
  // simulated alerts ride on top of whichever source is active.
  const base = DEMO_ALERTS_ENABLED
    ? [...(offline && cachedAlerts ? cachedAlerts : PUBLIC_ALERTS), ...extraAlerts]
    : [];
  // Filter bar (Step 1) then the citizen's preferences (Step 5).
  const alerts = filterAlertsByPreferences(
    filterAlertsByScope(base, filter),
    preferences,
  );

  return (
    <main className="relative flex min-h-screen flex-col bg-[var(--dl-navy)] pb-[100px] text-[var(--dl-text-on-navy)]">
      {/* Ambient backdrop — same treatment as the citizen dashboard */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_80%_-10%,rgba(37,99,235,0.22),transparent),radial-gradient(ellipse_45%_40%_at_0%_110%,rgba(249,115,22,0.14),transparent)]"
      />

      {/* Responsive container — expands on desktop, stays phone-frame on mobile */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 md:px-6 md:py-8 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-8">
        {/* Sticky header (offline banner rides inside it, so it sticks too) */}
        <header className="sticky top-0 z-20 -mx-4 border-b border-white/10 bg-[var(--dl-navy)]/85 px-4 pb-3 pt-5 backdrop-blur-lg">
          {/* Offline banner (Phase 3 · Step 7) — amber, always visible while
              the network is down. Renders client-side only (offline starts
              false on both server and first paint), so no hydration risk. */}
          {offline && (
            <div
              role="status"
              aria-live="polite"
              className="-mx-4 -mt-5 mb-3 flex items-center gap-2 bg-severity-amber-500/15 px-4 py-2"
            >
              <TriangleAlert
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-severity-amber-300"
              />
              <p className="text-xs font-semibold text-severity-amber-300">
                Offline Mode — Showing cached alerts from{" "}
                {cachedAtLabel ?? "last sync"}
              </p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Link
              href="/public/dashboard"
              aria-label="Back to dashboard"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition hover:border-[var(--dl-orange)]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)]"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F97316]/20 ring-1 ring-[#F97316]/40">
                <BellRing aria-hidden="true" className="h-4 w-4 text-[var(--brand-orangeLight)]" />
              </span>
              <div>
                <h1 className="text-base font-bold text-white">Alerts</h1>
                <p className="eoc-label text-[var(--dl-text-muted)]">
                  LIVE WARNINGS FOR YOUR DISTRICT
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* Alert settings (Phase 3 · Step 5) */}
              <Link
                href="/public/settings/alerts"
                aria-label="Alert settings"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[var(--dl-text-muted)] transition hover:border-[var(--dl-orange)]/60 hover:text-[var(--dl-orange-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)]"
              >
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              </Link>
              <span
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#F97316]/15 px-2 text-xs font-bold tabular-nums text-[var(--dl-orange-light)]"
                aria-label={`${alerts.length} alerts in this view`}
              >
                {alerts.length}
              </span>
            </div>
          </div>

          {/* Horizontal filter bar — All / My Area / District / State.
              Plain toggle buttons (aria-pressed): they're filters, not
              tabs — no roving tabindex/aria-controls to fake. */}
          <div
            aria-label="Filter alerts"
            className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {ALERT_FILTERS.map(({ key, label }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(key)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-[0.8125rem] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)] ${
                    active
                      ? "border-[var(--brand-orange)] bg-[#F97316]/20 text-[var(--brand-orangeLight)]"
                      : "border-white/10 bg-white/5 text-[var(--dl-text-muted)] hover:border-white/25 hover:text-[var(--dl-text-on-navy)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </header>

        {!DEMO_ALERTS_ENABLED && <p role="status" className="mt-4 rounded-xl border border-amber-400/50 bg-amber-950/30 p-4 text-sm font-semibold text-amber-100">Live official alerts are not connected. An empty list does not mean your area is safe. Follow official local advisories.</p>}

        {/* Feed — single column on mobile, 2-col grid on tablet+ */}
        {alerts.length > 0 ? (
          <>
            <p className="mt-4 text-center text-[0.6875rem] text-[var(--dl-text-muted)] md:hidden">
              Swipe right on an alert to mark it read
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onOpen={() => setSelected(alert)} />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <Inbox aria-hidden="true" className="h-6 w-6 text-[var(--dl-text-muted)]" />
            </span>
            <p className="text-sm font-semibold text-white">{DEMO_ALERTS_ENABLED ? "No alerts in this view" : "Alert feed unavailable"}</p>
            <p className="max-w-xs text-sm text-[var(--dl-text-muted)]">
              {DEMO_ALERTS_ENABLED ? "Try a different filter or check back later." : "Check official local warnings for current conditions."}
            </p>
          </div>
        )}
      </div>

      {/* Citizen bottom nav — mobile only, hidden on desktop where sidebar exists */}
      <BottomNav className="md:hidden" />

      {/* "I Am Safe" floating action (Step 9) */}
      {DEMO_ALERTS_ENABLED && <SafeStatusToggle />}

      {/* Alert detail bottom sheet (Step 4) — opened by tapping a card */}
      <AlertDetailModal alert={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
