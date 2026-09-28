"use client";

// ---------------------------------------------------------------------
// components/gov/dashboard/SituationHeader.tsx — Phase 7 · Step 2 ·
// Situation Awareness Header.
//
// The persistent top bar that gives commanders instant global context on
// every gov dashboard screen:
//
//   • Left   — "District Context" dropdown selector (Patna / Ernakulam /
//              Kamrup) — the same accessible listbox pattern as the
//              command center's DashboardHeader.
//   • Center — live IST clock with seconds ticking
//   • Right  — global flood status badge, notification bell with unread
//              count, user avatar with role chip, and the 4 mini-stat
//              counters with pulsing live dots.
//   • "Last synced: Just now" — a relative timestamp that re-syncs (and
//              blinks) every 30 seconds, so the bar always reads live.
//
// On critical events: entire header gets subtle red border-bottom glow.
// ---------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUp, Bell, ChevronDown, MapPin, ShieldCheck, User } from "lucide-react";
import PresenceBar from "@/components/gov/dashboard/PresenceBar";

/** Districts the gov command center can switch between. */
export const GOV_DISTRICTS = ["Patna", "Ernakulam", "Kamrup"] as const;

/** How often the sync line re-syncs (and blinks). */
const SYNC_MS = 30_000;
/** Relative label threshold — under this it reads "Just now". */
const JUST_NOW_MS = 3000;

type Stat = {
  label: string;
  value: string;
  /** Show the ▲ trend glyph before the value. */
  trend?: boolean;
  dot: string;
  tone: string;
};

const STATS: Stat[] = [
  {
    label: "Active Events",
    value: "3",
    dot: "bg-severity-red-500",
    tone: "text-severity-red-300",
  },
  {
    label: "At Risk",
    value: "12k",
    trend: true,
    dot: "bg-severity-amber-500",
    tone: "text-severity-amber-300",
  },
  {
    label: "Responders Online",
    value: "45",
    dot: "bg-severity-green-500",
    tone: "text-severity-green-300",
  },
  {
    label: "Pending Alerts",
    value: "2",
    trend: true,
    dot: "bg-blue-500",
    tone: "text-blue-400",
  },
];

/** Format current time in IST (HH:MM:SS). */
function formatIST(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Format current date in IST (DD MMM YYYY). */
function formatDateIST(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Accessible district dropdown — button + floating listbox (same pattern
 * as DashboardHeader's DistrictSelect). */
function DistrictSelect() {
  const [open, setOpen] = useState(false);
  const [district, setDistrict] = useState<string>("Patna");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Preselect the district from ?district= (Drill Down links from the
  // super-admin overview page land here with the district in the URL).
  // Read in an effect (not the useState initializer) so SSR and the first
  // client render agree — no hydration mismatch.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("district");
    if (fromUrl && (GOV_DISTRICTS as readonly string[]).includes(fromUrl)) {
      setDistrict(fromUrl);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="District context"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold text-slate-100 transition ${
          open
            ? "border-white/25 bg-white/10"
            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
        }`}
      >
        <MapPin className="h-4 w-4 text-blue-400" aria-hidden />
        <span className="max-w-[150px] truncate">{district}</span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Select district"
          className="absolute left-0 top-full z-50 mt-2 w-52 rounded-lg border border-white/10 bg-slate-800 p-1 shadow-xl shadow-black/40"
        >
          {GOV_DISTRICTS.map((d) => {
            const active = d === district;
            return (
              <li key={d} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-blue-500/15 font-semibold text-blue-400"
                      : "text-slate-200 hover:bg-white/5"
                  }`}
                  onClick={() => {
                    setDistrict(d);
                    setOpen(false);
                  }}
                >
                  {active && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                  )}
                  <span className="truncate">{d}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SituationHeader() {
  // Re-sync (and blink) every 30s; tick every second so the relative label
  // ("Just now" → "12s ago") stays honest between resyncs.
  const lastSyncRef = useRef(0);
  const [clock, setClock] = useState<Date | null>(null);
  const [blink, setBlink] = useState(0);

  useEffect(() => {
    lastSyncRef.current = Date.now();
    setClock(new Date());
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setClock(new Date());
      const now = Date.now();
      if (now - lastSyncRef.current >= SYNC_MS) {
        lastSyncRef.current = now;
        setBlink((b) => b + 1);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = clock ? clock.getTime() - lastSyncRef.current : 0;
  const syncLabel =
    elapsed < JUST_NOW_MS ? "Just now" : `${Math.floor(elapsed / 1000)}s ago`;

  return (
    <header className="sticky top-14 z-30 border-b border-white/10 bg-[#0a0f1a]/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.3)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        {/* Left — District Context */}
        <div className="flex items-center gap-3">
          <span className="eoc-label hidden text-slate-400 sm:block">
            DISTRICT CONTEXT
          </span>
          <DistrictSelect />
        </div>

        {/* Center — Live IST Clock */}
        <div className="hidden lg:flex flex-col items-center ml-auto">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-bold text-white tabular-nums tracking-wider">
              {clock ? formatIST(clock) : "--:--:--"}
            </span>
            <span className="text-xs text-slate-400">IST</span>
          </div>
          <span className="text-[0.625rem] text-slate-500">
            {clock ? formatDateIST(clock) : "Loading date"}
          </span>
        </div>

        {/* Right — Status badges + Stats + Presence */}
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2.5">
          {/* Global flood status badge */}
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
            </span>
            <span className="text-xs font-bold text-red-400">3 CRITICAL EVENTS</span>
          </div>

          {/* Notification bell with unread count */}
          <Link
            href="/settings/notifications/history"
            aria-label="Open notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <Bell className="h-4 w-4" />
          </Link>

          {/* User avatar with role chip */}
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20">
              <User className="h-4 w-4 text-blue-400" />
            </span>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-white">District Admin</p>
              <p className="text-[0.625rem] text-slate-400">Patna · Bihar</p>
            </div>
          </div>

          {/* Mini-stat counters */}
          {STATS.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full ${stat.dot} opacity-60`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${stat.dot}`}
                />
              </span>
              <div>
                <p
                  className={`flex items-center gap-0.5 font-mono text-sm font-bold leading-none ${stat.tone}`}
                >
                  {stat.trend && (
                    <ArrowUp className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  )}
                  {stat.value}
                </p>
                <p className="eoc-label mt-0.5 text-[0.625rem] text-slate-400">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}

          {/* Phase 7 · Step 9 — who is viewing right now (mock WebSocket). */}
          <div className="border-l border-white/10 pl-4">
            <PresenceBar />
          </div>

          {/* Blinking "Last synced" — remounts (fades in) every 30s */}
          <div className="flex items-center gap-1.5 border-l border-white/10 pl-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            <motion.p
              key={blink}
              initial={{ opacity: 0.2 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-xs font-semibold tabular-nums text-emerald-400"
            >
              Last synced: {syncLabel}
            </motion.p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default SituationHeader;
