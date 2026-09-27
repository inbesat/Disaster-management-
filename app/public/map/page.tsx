"use client";

// ---------------------------------------------------------------------
// app/public/map/page.tsx — Phase 4 · Steps 1–2 + 10 · "Where do I go?"
//
// Full-screen minimalist citizen map. The map owns the whole viewport
// (h-[100dvh]); a floating gradient header gives the back affordance and
// title, and the fixed BottomNav rides on top with safe-area padding.
// PublicMap is loaded client-only (maplibre-gl touches `window`). When
// the connection drops, the Step 10 offline-cache badge appears at the
// top-left so citizens know the pre-downloaded tiles still work.
// ---------------------------------------------------------------------

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Map as MapIcon, WifiOff } from "lucide-react";
import BottomNav from "@/components/public/BottomNav";
import LowBandwidthShelterList from "@/components/public/lowbandwidth/LowBandwidthShelterList";
import OfflineMapBadge from "@/components/public/map/OfflineMapBadge";
import PublicMapSidebar from "@/components/public/map/PublicMapSidebar";
import {
  DEFAULT_LAYER_VISIBILITY,
  type LayerVisibility,
} from "@/components/map/LayerToggle";
import type { PublicMapRouteIntent } from "@/components/public/map/PublicMap";
import { useBandwidth } from "@/lib/contexts/BandwidthContext";

const PublicMap = dynamic(() => import("@/components/public/map/PublicMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[var(--dl-orange)]" />
        <p className="text-sm text-[var(--dl-text-muted)]">
          Loading your map&hellip;
        </p>
      </div>
    </div>
  ),
});

/**
 * Reads the dashboard "Find Nearest Safe Shelter" handoff params
 * (?action=find-route&lat=&lng=) and forwards them to the map so it
 * routes from the citizen's live GPS location. Wrapped in <Suspense>
 * per Next.js requirements for useSearchParams.
 */
function MapWithRouteIntent({ layerVisibility }: { layerVisibility: LayerVisibility }) {
  const searchParams = useSearchParams();
  const action = searchParams.get("action");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const hasCoords =
    lat !== null &&
    lng !== null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng));

  const routeIntent: PublicMapRouteIntent | null =
    action === "find-route" && hasCoords
      ? { lat: Number(lat), lng: Number(lng) }
      : null;

  return <PublicMap routeIntent={routeIntent} layerVisibility={layerVisibility} />;
}

export default function PublicMapPage() {
  // Phase 13 · Step 2 — in extreme low-bandwidth mode the heavy MapLibre
  // map is swapped for a ~0.5KB text list of the nearest shelters.
  const { isLowBandwidthMode } = useBandwidth();

  // Citizen layer toggles — single source of truth shared by the sidebar
  // panel and the map canvas (display filter only, no data writes).
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[var(--dl-navy)] text-[var(--dl-text-on-navy)]">
      {/* Ambient backdrop while the map streams in */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_80%_-10%,rgba(37,99,235,0.22),transparent),radial-gradient(ellipse_45%_40%_at_0%_110%,rgba(249,115,22,0.14),transparent)]"
      />

      {/* Phase 13 · Step 2 — MapLibre map, or its text-only data-saver
          replacement when extreme low-bandwidth mode is on. */}
      {isLowBandwidthMode ? (
        <div className="absolute inset-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-md px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-24">
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--dl-orange)]/30 bg-[var(--dl-orange)]/10 px-3 py-2 text-[0.6875rem] font-medium text-[var(--dl-orange-light)]">
              <WifiOff aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Map hidden in low-bandwidth mode to save data
            </div>
            <LowBandwidthShelterList />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0">
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[var(--dl-orange)]" />
                  <p className="text-sm text-[var(--dl-text-muted)]">
                    Preparing your route&hellip;
                  </p>
                </div>
              </div>
            }
          >
            <MapWithRouteIntent layerVisibility={layers} />
          </Suspense>
        </div>
      )}

      {/* Citizen-safe info panel — layer toggles (wired to the canvas),
          severity legend, flood forecast chart. Hidden in low-bandwidth
          mode alongside the map itself. */}
      {!isLowBandwidthMode && (
        <PublicMapSidebar layers={layers} onLayersChange={setLayers} />
      )}

      {/* Floating gradient header over the map */}
      <header className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-[#0a1120]/85 via-[#0a1120]/40 to-transparent px-4 pb-6 pt-5">
        <div className="flex items-center gap-3">
          <Link
            href="/public/dashboard"
            aria-label="Back to dashboard"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 backdrop-blur transition hover:border-[var(--dl-orange)]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)]"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F97316]/20 ring-1 ring-[#F97316]/40">
              <MapIcon aria-hidden="true" className="h-4 w-4 text-[var(--brand-orangeLight)]" />
            </span>
            <div>
              <h1 className="text-base font-bold text-white">Map</h1>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-[var(--dl-text-muted)]">
                FIND YOUR WAY TO SAFETY
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Step 10 — offline-map badge, top-left below the header (renders
          only while the network is down; hydration-safe). */}
      <OfflineMapBadge />
      <div role="status" className="pointer-events-none absolute inset-x-3 top-24 z-30 mx-auto max-w-lg rounded-lg border border-amber-400/60 bg-slate-950/95 px-3 py-2 text-center text-xs font-semibold text-amber-100 shadow-lg">
        Demo map: shelter, road closure, flood and route layers are illustrative. Verify local advisories before travelling.
      </div>

      {/* Citizen bottom nav — Map tab lights up via route matching */}
      <BottomNav />
    </main>
  );
}