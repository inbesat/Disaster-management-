"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass, Layers, Minus, Plus, Maximize2, Clock } from "lucide-react";

// ---------------------------------------------------------------------
// components/gov/dashboard/LiveMapWidget.tsx — Phase 7 · Step 3.
//
// The 2x2 tactical map canvas of the Command Center. A pure CSS/SVG
// placeholder for now — the header chip marks it as the MapLibre GL
// injection target (Phase 7 · Step 7 will swap the SVG canvas for a real
// MapLibre instance). The decorative zoom controls scale the SVG canvas
// so commanders get the "live ops map" feel before the real tiles load.
//
// Phase 8: Added layer toggle panel, last updated timestamp, expand button,
// and hover tooltips on markers.
// ---------------------------------------------------------------------

const ZOOM_LEVELS = [1, 1.25, 1.6] as const;

/** HTML-overlay live markers — % coordinates over the SVG canvas. */
const LIVE_MARKERS = [
  { label: "SOS · Sector 4", status: "Critical", x: "34%", y: "30%", tone: "bg-red-400" },
  { label: "Responder 12", status: "En route", x: "56%", y: "52%", tone: "bg-blue-400" },
  {
    label: "Shelter · KHS",
    status: "75% full",
    x: "72%",
    y: "38%",
    tone: "bg-emerald-400",
  },
  { label: "Road closed", status: "Blocked", x: "46%", y: "72%", tone: "bg-amber-400" },
] as const;

/** Layer toggle definitions. */
const LAYERS = [
  { id: "flood", label: "Flood Zones", color: "bg-red-400" },
  { id: "shelters", label: "Shelters", color: "bg-emerald-400" },
  { id: "responders", label: "Responders", color: "bg-blue-400" },
  { id: "routes", label: "Routes", color: "bg-amber-400" },
] as const;

export function LiveMapWidget() {
  const [zoomIdx, setZoomIdx] = useState(0);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(
    new Set(LAYERS.map((l) => l.id)),
  );

  const zoom = ZOOM_LEVELS[zoomIdx];

  const toggleLayer = (id: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section className="flex h-full min-h-[440px] flex-col rounded-xl border border-white/10 bg-[#111827] backdrop-blur transition hover:border-white/20">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Layers aria-hidden="true" className="h-4 w-4 text-blue-400" />
          <h2 className="eoc-label text-white">Live Operations Map</h2>
          <span className="rounded-full border border-blue-400/30 bg-blue-500/15 px-2 py-0.5 text-[0.625rem] font-semibold tracking-wide text-blue-400">
            MAPLIBRE READY
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layer toggle mini-panel */}
          <div className="hidden lg:flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1">
            {LAYERS.map((layer) => (
              <button
                key={layer.id}
                type="button"
                aria-label={`Toggle ${layer.label} layer`}
                onClick={() => toggleLayer(layer.id)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] font-semibold transition ${
                  activeLayers.has(layer.id)
                    ? "bg-white/10 text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${layer.color} ${
                    activeLayers.has(layer.id) ? "opacity-100" : "opacity-30"
                  }`}
                />
                {layer.label}
              </button>
            ))}
          </div>

          {/* Expand button */}
          <Link
            href="/gov/map"
            aria-label="Expand to full map"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <Maximize2 className="h-4 w-4" />
          </Link>

          {/* Decorative zoom controls */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoomIdx === 0}
              onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="eoc-label w-9 text-center text-slate-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden p-2">
        <svg
          viewBox="0 0 640 420"
          role="img"
          aria-label="Tactical map placeholder — flood zones, river and shelters over the district grid"
          className="h-full w-full transition-transform duration-300 ease-out"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
        >
          {/* District base */}
          <rect width="640" height="420" fill="#0d1526" />
          <rect width="640" height="420" fill="url(#gov-map-grid)" opacity="0.6" />
          <defs>
            <pattern
              id="gov-map-grid"
              width="80"
              height="70"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M80 0H0V70"
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.05"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* Ganga river */}
          <path
            d="M-20 340 C 120 300, 200 260, 300 240 C 420 216, 520 250, 660 190"
            fill="none"
            stroke="#16324f"
            strokeWidth="26"
            strokeLinecap="round"
          />
          <path
            d="M-20 340 C 120 300, 200 260, 300 240 C 420 216, 520 250, 660 190"
            fill="none"
            stroke="#1f4e7a"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="14 10"
            opacity="0.8"
          />

          {/* NH-31 trunk road */}
          <path
            d="M-20 150 C 140 160, 320 140, 480 170 L 660 120"
            fill="none"
            stroke="#8a6d1d"
            strokeWidth="7"
            strokeDasharray="16 8"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* Flood hazard zones */}
          <polygon
            points="90,60 230,48 260,150 120,170"
            fill="#ef4444"
            fillOpacity="0.12"
            stroke="#ef4444"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />
          <polygon
            points="380,300 520,288 560,380 400,398"
            fill="#ef4444"
            fillOpacity="0.10"
            stroke="#ef4444"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />

          {/* Shelters */}
          <rect x="468" y="130" width="12" height="12" fill="#10b981" opacity="0.9" />
          <rect x="196" y="300" width="12" height="12" fill="#10b981" opacity="0.9" />

          {/* Compass rose */}
          <g transform="translate(596, 52)" opacity="0.9">
            <circle r="22" fill="#0a0f1a" stroke="#ffffff" strokeOpacity="0.25" />
            <path d="M0 -16 L5 6 L0 2 L-5 6 Z" fill="#f87171" />
            <path d="M0 16 L5 -6 L0 -2 L-5 -6 Z" fill="#e2e8f0" />
            <text
              y="-28"
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="11"
              fontWeight="700"
            >
              N
            </text>
          </g>
        </svg>

        {/* Live overlay markers with hover tooltips */}
        {LIVE_MARKERS.map((m) => (
          <div
            key={m.label}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: m.x, top: m.y }}
            onMouseEnter={() => setHoveredMarker(m.label)}
            onMouseLeave={() => setHoveredMarker(null)}
          >
            <span className="relative flex h-3 w-3">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${m.tone} opacity-60`}
              />
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${m.tone} cursor-pointer`}
              />
            </span>
            {/* Tooltip */}
            {hoveredMarker === m.label && (
              <div className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-800 px-3 py-2 shadow-xl z-10">
                <p className="text-xs font-semibold text-white">{m.label}</p>
                <p className="text-[0.625rem] text-slate-400">{m.status}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-400/70" /> Flood zone
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/70" /> Road closed
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400/70" /> Shelter
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Compass aria-hidden="true" className="h-3 w-3 text-blue-400" /> MapLibre GL
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          Last updated 2 min ago
        </div>
      </footer>
    </section>
  );
}

export default LiveMapWidget;
