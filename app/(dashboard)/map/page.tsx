"use client";

// ---------------------------------------------------------------------
// app/(dashboard)/map/page.tsx — UI/UX Phase 5.
//
// The dedicated full-screen map workspace.
//
// Note on the dashboard shell: this route lives inside the (dashboard)
// group, whose parent layout always wraps pages in DashboardShell (fixed
// sidebar + top bar + mobile bottom nav). To give the map 100dvh/100vw of
// selfish real estate, this page renders a `fixed inset-0 z-[60]` layer on
// top of the shell — the sidebar and chrome are visually covered and the
// map owns the entire viewport. DisasterMap is loaded client-only (it
// touches `window` via maplibre-gl).
//
// Presentation mode (Step 10): the header's Maximize button flips
// `isFullscreen`, which strips everything except the map, legend and time
// slider; Escape exits. Right-click on the map (Step 9) opens the
// MapContextMenu at the pointer; any click elsewhere closes it.
// ---------------------------------------------------------------------

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import MapHeader from "@/components/map/MapHeader";
import LayerControl from "@/components/map/LayerControl";
import MapLegend from "@/components/map/MapLegend";
import TimeSlider from "@/components/map/TimeSlider";
import MeasurementToolbar from "@/components/map/MeasurementToolbar";
import MiniMapWidget from "@/components/map/MiniMapWidget";
import MapContextMenu from "@/components/map/MapContextMenu";
import type { LayerVisibility } from "@/components/map/LayerToggle";

const DisasterMap = dynamic(() => import("@/components/map/DisasterMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900">
      <span className="text-sm text-slate-400">Loading live map…</span>
    </div>
  ),
});

const MAP_LAYERS: LayerVisibility = {
  floodZones: true,
  shelters: true,
  resources: true,
};

export default function MapPage() {
  const [layers, setLayers] = useState<LayerVisibility>(MAP_LAYERS);
  const [hoursAhead, setHoursAhead] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [focus, setFocus] = useState("Global");
  const handleMapFocus = useCallback(({ place, district }: { place: string | null; district: string | null }) => {
    setFocus(place ?? district ?? "Global");
  }, []);

  // Escape exits presentation mode.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  return (
    <div
      className="fixed inset-0 z-[60] h-[100dvh] w-screen overflow-hidden bg-slate-900"
      aria-label="Live map workspace"
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      {!isFullscreen && (
        <MapHeader
          title={`${focus} Map Operations`}
          isFullscreen={false}
          onToggleFullscreen={() => setIsFullscreen(true)}
        />
      )}

      <div className="absolute inset-0">
        <DisasterMap
          visibleLayers={layers}
          hoursAhead={hoursAhead}
          disasterType="flood"
          searchBelowHeader
          onMapStateChange={handleMapFocus}
        />
      </div>

      {/* Presentation mode keeps only the map, legend and time slider. */}
      {!isFullscreen && (
        <>
          <LayerControl
            layers={layers}
            onLayersChange={setLayers}
            className="absolute right-3 top-[190px] z-10 sm:left-3 sm:right-auto sm:top-20"
          />
          <MeasurementToolbar className="absolute right-3 top-1/2 z-10 -translate-y-1/2" />
          <MiniMapWidget className="fixed bottom-[200px] right-6 z-20 hidden lg:block" />
        </>
      )}

      <MapLegend className="absolute bottom-4 left-3 z-10" />
      <TimeSlider value={hoursAhead} onChange={setHoursAhead} />

      {isFullscreen && (
        <p className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-slate-300 backdrop-blur">
          Press Esc to exit presentation mode
        </p>
      )}

      {menu && <MapContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </div>
  );
}
