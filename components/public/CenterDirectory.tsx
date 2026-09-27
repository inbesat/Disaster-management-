"use client";

// ---------------------------------------------------------------------
// components/public/CenterDirectory.tsx — Phase 1 · Step 4 · Disaster
// Management Center Directory.
//
// Citizens get a quick, filterable "Nearby Help Centers" card list on
// the public dashboard: NDRF offices, police stations, hospitals and
// fire stations. Every card shows the name, distance, operating hours,
// current status (Open / Overloaded) and a massive "One-Tap Call" button
// (a plain <a href="tel:…"> so taps open the native dialer — no JS
// needed to ring). Filter chips at the top — All / Medical / 24/7 /
// Rescue — narrow the list, and a "Show on Map" toggle plots the centers
// as distinct emoji pins (🚨 🚓 🏥 🚒) on a lightweight mini-map, with a
// tappable pin that deep-links to Google Maps directions.
// ---------------------------------------------------------------------

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Map as MapIcon, X } from "lucide-react";
import {
  CENTER_FILTERS,
  CENTER_TYPE_EMOJI,
  CENTER_TYPE_LABEL,
  filterHelpCenters,
  HELP_CENTERS,
  plotHelpCenters,
  type CenterFilter,
  type HelpCenter,
  type HelpCenterType,
} from "@/lib/mock-data/help-centers";

export default function CenterDirectory() {
  const [filter, setFilter] = useState<CenterFilter>("all");
  const [showMap, setShowMap] = useState(false);

  const centers = useMemo(
    () => filterHelpCenters(HELP_CENTERS, filter),
    [filter],
  );

  const pins = useMemo(() => plotHelpCenters(centers), [centers]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      aria-label="Nearby help centers"
      className="rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/[0.04] p-4 backdrop-blur"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
            <MapIcon aria-hidden="true" className="h-[18px] w-[18px] text-[var(--dl-blue)]" />
          </span>
          <div>
            <h2 className="text-base font-bold text-white">Demo Help Centers</h2>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-[var(--dl-text-muted)]">
              NDRF · Police · Hospitals · Fire
            </p>
          </div>
        </div>
      </div>

      <p role="status" className="mt-3 text-xs font-semibold text-amber-200">Sample locations, hours, status and phone numbers are unverified. Use official local directories for emergency contact.</p>

      {/* Filter chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {CENTER_FILTERS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            aria-pressed={filter === chip.key}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-blue)] ${
              filter === chip.key
                ? "bg-[var(--dl-blue)] text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]"
                : "border border-white/15 bg-white/5 text-[var(--dl-text-muted)] hover:border-white/30 hover:text-white"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Center cards */}
      <ul className="mt-3 space-y-2">
        {centers.map((center) => (
          <CenterCard key={center.id} center={center} />
        ))}
      </ul>

      {/* Show on Map toggle */}
      <button
        type="button"
        onClick={() => setShowMap((v) => !v)}
        aria-expanded={showMap}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--dl-blue)]/40 bg-[var(--dl-blue)]/10 px-4 py-2.5 text-sm font-bold text-[var(--dl-blue)] transition hover:border-[var(--dl-blue)]/70 hover:bg-[var(--dl-blue)]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-blue)]"
      >
        {showMap ? (
          <>
            <X aria-hidden="true" className="h-4 w-4" /> Hide Map
          </>
        ) : (
          <>
            <MapIcon aria-hidden="true" className="h-4 w-4" /> Show on Map
          </>
        )}
      </button>

      {/* Mini-map with emoji pins */}
      {showMap && (
        <div
          aria-label="Help center map"
          className="relative mt-3 h-52 w-full overflow-hidden rounded-xl border border-white/15 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.18),rgba(10,15,26,0.9))]"
        >
          {/* Faint street grid */}
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />
          {pins.map(({ center, x, y }) => (
            <span
              key={center.id}
              title={`${center.name} — sample location`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="block text-2xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                {CENTER_TYPE_EMOJI[center.type]}
              </span>
            </span>
          ))}
          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-black/40 px-2 py-1 backdrop-blur">
            {(Object.keys(CENTER_TYPE_EMOJI) as HelpCenterType[]).map((type) => (
              <span
                key={type}
                className="flex items-center gap-1 text-[0.625rem] font-semibold text-white/80"
              >
                <span aria-hidden="true">{CENTER_TYPE_EMOJI[type]}</span>
                {CENTER_TYPE_LABEL[type]}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

function CenterCard({ center }: { center: HelpCenter }) {
  const overloaded = center.status === "overloaded";
  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-white/20 hover:bg-white/[0.06]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl ring-1 ring-white/15">
        {CENTER_TYPE_EMOJI[center.type]}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{center.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] font-semibold text-[var(--dl-text-muted)]">
          <span className="uppercase tracking-wide">
            {CENTER_TYPE_LABEL[center.type]}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{center.distanceKm.toFixed(1)} km</span>
          <span aria-hidden="true">·</span>
          <span>{center.hours}</span>
        </p>
        <span
          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide ${
            overloaded
              ? "bg-severity-red-500/15 text-severity-red-300 ring-1 ring-severity-red-500/40"
              : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              overloaded ? "animate-pulse bg-severity-red-400" : "bg-emerald-400"
            }`}
          />
          {overloaded ? "Sample: Overloaded" : "Sample: Open"}
        </span>
      </div>

      <span className="rounded-lg border border-amber-400/40 px-2 py-1 text-[0.625rem] font-bold uppercase text-amber-200">Unverified</span>
    </li>
  );
}
