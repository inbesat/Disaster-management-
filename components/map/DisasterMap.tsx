"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Map,
  Source,
  Layer,
  Popup,
  Marker,
  useMap,
  MapProvider,
  NavigationControl,
  GeolocateControl,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import type { GeoJSONSource } from "maplibre-gl";
import length from "@turf/length";
import { lineString } from "@turf/helpers";
import { center, area, convex, distance as turfDistance } from "@turf/turf";
import { nearestPointOnLine } from "@turf/nearest-point-on-line";
import type { Feature, LineString, Polygon } from "geojson";
import {
  generateShelters,
  generateResources,
  type ShelterFeature,
  type ResourceFeature,
} from "@/lib/mock-data/gis-data";
import {
  applyScenario,
  calculateAffectedPopulation,
  calculateZonePopulation,
} from "@/lib/map/flood-geojson";
import { DISASTER_META, type DisasterType } from "@/lib/disasters/disaster-types";
import {
  generateHazardPolygons,
  hazardIntensityPoints,
  type HazardZoneProperties,
} from "@/lib/map/hazard-geojson";
import { DEFAULT_INITIAL_VIEW } from "@/lib/map/default-view";
import type { LayerVisibility } from "@/components/map/LayerToggle";
import MapBottomSheet from "@/components/map/MapBottomSheet";
import LocationSelector from "@/components/map/LocationSelector";
import MapPlaceSearch from "@/components/map/MapPlaceSearch";
import type { PlaceResult } from "@/lib/map/place-search";
import RoadClosureTool from "@/components/map/RoadClosureTool";
import { getShelters } from "@/app/actions/shelters";
import {
  fetchRoadClosures,
  addRoadClosure,
  resolveRoadClosure,
  type RoadClosureLike,
} from "@/lib/map/road-closures-client";
import { findNearestShelters } from "@/lib/map/nearby-shelters";
import { getEvacuationRoute } from "@/lib/map/routing";
import { getInventory, type InventoryResource } from "@/app/actions/resources";
import { groundReportColor, type GroundReport } from "@/lib/crowdsourced/report";
import { redactReportText } from "@/lib/security/sanitize";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Matches the severity-green/amber/red/purple-500 theme tokens
const SEVERITY_COLORS: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#a855f7",
};

// Loose district matching so simulator labels like "Patna (Ganga)" resolve to
// the viewed district "Patna". Unknown values default to notify-everything.
function normalizeDistrict(district: string | null): string {
  return (district ?? "").split("(")[0].trim().toLowerCase();
}

function districtsMatch(a: string | null, b: string | null): boolean {
  const na = normalizeDistrict(a);
  const nb = normalizeDistrict(b);
  if (!na && !nb) return false;
  if (!na || !nb) return true; // one side unknown -> treat as global alert
  return na === nb || na.includes(nb) || nb.includes(na);
}

// Very short two-tone beep synthesized with the HTML5 Web Audio API.
let audioCtx: AudioContext | null = null;
function playCriticalBeep() {
  try {
    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    let ctx = audioCtx;
    if (!ctx) {
      ctx = new Ctor();
      audioCtx = ctx;
    }
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    [740, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch (error: unknown) {
    console.warn("Critical alert beep unavailable", error);
  }
}

type SelectedFeature = ShelterFeature | ResourceFeature | null;

// Live shelters rendered as Markers (from the DB via getShelters, with a demo
// fallback so the map works before the database is pushed).
type MapShelter = {
  id: string;
  name: string;
  district: string | null;
  lat: number;
  lng: number;
  capacity: number;
  currentOccupancy: number;
  status: string;
  facilities: Record<string, boolean> | null;
  imageUrl: string | null;
};

const SHELTER_MOCK: MapShelter[] = [
  {
    id: "mock-shelter-1",
    name: "Central Community Hall",
    district: "Patna (Ganga)",
    lat: 25.6,
    lng: 85.14,
    capacity: 450,
    currentOccupancy: 312,
    status: "open",
    facilities: { water: true, food: true, medical: true, electricity: true },
    imageUrl: null,
  },
  {
    id: "mock-shelter-2",
    name: "Riverside High School",
    district: "Patna (Ganga)",
    lat: 25.585,
    lng: 85.13,
    capacity: 380,
    currentOccupancy: 380,
    status: "full",
    facilities: { water: true, food: true, medical: false, electricity: true },
    imageUrl: null,
  },
  {
    id: "mock-shelter-3",
    name: "District Hospital Annex",
    district: "Patna (Ganga)",
    lat: 25.608,
    lng: 85.12,
    capacity: 300,
    currentOccupancy: 94,
    status: "open",
    facilities: { water: true, food: false, medical: true, electricity: true },
    imageUrl: null,
  },
];

// Green when empty, yellow while filling up, red when full.
function shelterMarkerColor(shelter: MapShelter): string {
  if (shelter.status === "full" || shelter.currentOccupancy >= shelter.capacity) {
    return "#ef4444"; // red / full
  }
  if (shelter.currentOccupancy <= 0) {
    return "#10b981"; // green / empty
  }
  return "#eab308"; // yellow / filling up
}

const FACILITY_META: Record<string, { icon: string; label: string }> = {
  water: { icon: "💧", label: "Water" },
  food: { icon: "🍚", label: "Food" },
  medical: { icon: "⛑️", label: "Medical" },
  electricity: { icon: "⚡", label: "Power" },
};

// A resource depot on the map — one Marker per unique location, whose popup
// lists the available inventory stored there.
type DepotMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  items: InventoryResource[];
};

// One proposed dispatch: a line drawn from the origin depot to the destination.
type MapAllocation = {
  id: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  category: string;
  quantity: number;
};

// Per-category line styling: dashed green for Medical, solid blue for Boats, etc.
const DISPATCH_STYLES: Record<string, { color: string; dash: [number, number] }> = {
  boat: { color: "#3b82f6", dash: [1, 0] }, // solid blue
  medical: { color: "#10b981", dash: [4, 3] }, // dashed green
  food: { color: "#f59e0b", dash: [6, 3] },
  water: { color: "#38bdf8", dash: [4, 3] },
  personnel: { color: "#a855f7", dash: [6, 3] },
  power: { color: "#eab308", dash: [2, 2] },
  communication: { color: "#22d3ee", dash: [2, 4] },
  other: { color: "#94a3b8", dash: [4, 2] },
};

// Path the "Rescue Boat Fleet" icon animates along (Sadar depot → Kankarbagh).
const FLEET_START = { lat: 25.594, lng: 85.132 };
const FLEET_END = { lat: 25.604, lng: 85.153 };
const FLEET_DURATION_MS = 4000;

// A road marked closed by the admin tool — persisted to the road_closures
// table through /api/road-closures (optimistic in local state).
type RoadClosurePoint = RoadClosureLike;

type LiveConditions = {
  lat: number;
  lng: number;
  loading: boolean;
  district: string | null;
  source: "live" | "synthetic" | null;
  rainfall_mm: number | null;
  river_level_m: number | null;
  river_discharge_m3s: number | null;
};

type FloodSeverity = "low" | "medium" | "high" | "critical";

// Internal severity buckets → user-facing risk labels.
const RISK_SEVERITY_LABEL: Record<FloodSeverity, string> = {
  low: "Safe",
  medium: "Watch",
  high: "Warning",
  critical: "Evacuate",
};

type SelectedZone = {
  hazardType: DisasterType;
  riskLevel: string;
  intensity: number;
  label: string;
  population: number;
  coordinates: [number, number];
};

type DisasterMapProps = {
  visibleLayers: LayerVisibility;
  hoursAhead: number;
  disasterType: DisasterType;
  scenarioMultiplier?: number;
  onSeverityChange?: (severity: FloodSeverity) => void;
  onMapStateChange?: (state: {
    center: { lat: number; lng: number };
    district: string | null;
    place: string | null;
  }) => void;
  /** Active evacuation route from the Mass Evacuation Planner. */
  evacRoute?: {
    geometry: Feature<LineString>;
    isSafe: boolean;
    shelterName?: string;
    start?: { lat: number; lng: number };
    end?: { lat: number; lng: number };
  } | null;
  /** Called when a new road closure forces a reroute of the active evac path. */
  onReroute?: (route: { geometry: Feature<LineString>; isSafe: boolean }) => void;
  /** Proposed resource dispatches to draw as depot → destination lines. */
  activeAllocations?: MapAllocation[];
  /** Citizen ground-truth reports (Phase 17) rendered as map markers. */
  groundReports?: GroundReport[];
  /** Leave room for the full-screen map header. */
  searchBelowHeader?: boolean;
};

export default function DisasterMap({
  visibleLayers,
  hoursAhead,
  disasterType,
  scenarioMultiplier = 1,
  onSeverityChange,
  onMapStateChange,
  evacRoute = null,
  onReroute,
  activeAllocations = [],
  groundReports = [],
  searchBelowHeader = false,
}: DisasterMapProps) {
  const [selected, setSelected] = useState<SelectedFeature>(null);
  const [selectedZone, setSelectedZone] = useState<SelectedZone | null>(null);
  const [searchedPlace, setSearchedPlace] = useState<PlaceResult | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);
  const [liveConditions, setLiveConditions] = useState<LiveConditions | null>(null);
  const [mapCenter, setMapCenter] = useState({
    lat: DEFAULT_INITIAL_VIEW.latitude,
    lng: DEFAULT_INITIAL_VIEW.longitude,
  });
  const [zonesGeoJSON, setZonesGeoJSON] = useState(() =>
    generateHazardPolygons(
      "flood",
      DEFAULT_INITIAL_VIEW.latitude,
      DEFAULT_INITIAL_VIEW.longitude,
      "high",
      24,
    ),
  );
  const [mlPrediction, setMlPrediction] = useState<{
    riskLevel: string;
    confidenceScore: number;
    source: "ml" | "fallback";
  } | null>(null);
  const lastFetchedCoords = useRef<{ lat: number; lng: number } | null>(null);
  const liveFetchId = useRef(0);
  const severityRef = useRef<FloodSeverity>("high");

  // Live shelters from the database (rendered as Markers below).
  const [mapShelters, setMapShelters] = useState<MapShelter[]>(SHELTER_MOCK);
  const [selectedShelter, setSelectedShelter] = useState<MapShelter | null>(null);

  // Resource depots from getInventory(), grouped by unique depot location.
  const [depots, setDepots] = useState<DepotMarker[]>([]);
  const [selectedDepot, setSelectedDepot] = useState<DepotMarker | null>(null);

  // Phase 17: selected citizen ground-truth report (opens a detail popup).
  const [selectedGroundReport, setSelectedGroundReport] = useState<GroundReport | null>(
    null,
  );

  // Phase 9 · Step 2 — the mobile bottom sheet derives its `feature` (an id
  // that merely drives open/close) and its content from whichever selection
  // is currently active, waterfall style so the most specific wins.
  const sheetFeature = useMemo<{ id: string } | null>(() => {
    if (selectedShelter) return { id: `shelter-${selectedShelter.id}` };
    if (selectedDepot) return { id: `depot-${selectedDepot.id}` };
    if (selectedGroundReport) return { id: `report-${selectedGroundReport.id}` };
    if (selectedZone)
      return { id: `zone-${selectedZone.coordinates[0]}-${selectedZone.coordinates[1]}` };
    if (selected) return { id: `feature-${selected.geometry.coordinates.join(",")}` };
    return null;
  }, [selected, selectedShelter, selectedDepot, selectedGroundReport, selectedZone]);

  const sheetContent = useMemo<ReactNode>(() => {
    if (selectedShelter) return <ShelterPopupContent shelter={selectedShelter} />;
    if (selectedDepot) return <DepotPopupContent depot={selectedDepot} />;
    if (selectedGroundReport)
      return <GroundReportPopupContent report={selectedGroundReport} />;
    if (selectedZone) return <ZonePopupContent zone={selectedZone} />;
    if (selected) return <PopupContent feature={selected} />;
    return null;
  }, [selected, selectedShelter, selectedDepot, selectedGroundReport, selectedZone]);

  const clearMapSelection = useCallback(() => {
    setSelected(null);
    setSelectedShelter(null);
    setSelectedDepot(null);
    setSelectedGroundReport(null);
    setSelectedZone(null);
  }, []);

  // Road closures placed via the RoadClosureTool — loaded from and persisted
  // to the road_closures table.
  const [closures, setClosures] = useState<RoadClosurePoint[]>([]);
  const [closingMode, setClosingMode] = useState(false);
  const toggleClosingMode = useCallback(() => setClosingMode((m) => !m), []);

  // Collaborative "Draw Risk Area" annotation tool.
  const [drawingRisk, setDrawingRisk] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [drawToast, setDrawToast] = useState<string | null>(null);

  const toggleDrawingRisk = useCallback(() => {
    setDrawingRisk((d) => {
      const next = !d;
      if (!next) setDrawPoints([]);
      return next;
    });
    setDrawToast(null);
  }, []);

  const clearDrawing = useCallback(() => {
    setDrawPoints([]);
    setDrawToast(null);
  }, []);

  const broadcastDrawing = useCallback(() => {
    setDrawToast(
      `Drawing broadcast — hazard polygon shared with ${drawPoints.length} points to all online users.`,
    );
    window.setTimeout(() => setDrawToast(null), 5000);
  }, [drawPoints.length]);

  // Hydrate persisted road closures when the map mounts.
  useEffect(() => {
    let active = true;
    fetchRoadClosures()
      .then((rows) => {
        if (active && rows.length) setClosures(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Whether a closure point sits close enough to the active route to block it.
  function closureBlocksRoute(lng: number, lat: number): boolean {
    if (!evacRoute?.geometry) return false;
    const closure = { type: "Point" as const, coordinates: [lng, lat] };
    const nearest = nearestPointOnLine(evacRoute.geometry, closure);
    const metersAway =
      turfDistance(closure, nearest.geometry.coordinates, { units: "kilometers" }) * 1000;
    return metersAway <= 200;
  }

  // Admin dropped a new closure while a convoy is en route: if it blocks the
  // active route, warn loudly and immediately regenerate the route.
  async function handleNewClosure(lat: number, lng: number) {
    const optimistic = {
      id: `closure-${Date.now()}`,
      lat,
      lng,
      reason: "Flooded road",
      isActive: true,
    };
    setClosures((prev) => [...prev, optimistic]);

    // Persist; when the DB returns the real row, swap it in so the marker id
    // matches the stored record (enabling later resolve/delete).
    const persisted = await addRoadClosure({ lat, lng, reason: optimistic.reason });
    if (persisted) {
      setClosures((prev) =>
        prev.map((c) => (c.id === optimistic.id ? { ...persisted, isActive: true } : c)),
      );
    }

    if (!evacRoute?.end || !evacRoute.start) return;

    if (closureBlocksRoute(lng, lat)) {
      showRerouteToast(
        `CRITICAL: Active route to ${evacRoute.shelterName ?? "shelter"} blocked by new road closure! Rerouting…`,
      );
      void findEvacuationRoute(evacRoute.start);
    }
  }

  async function findEvacuationRoute(start: { lat: number; lng: number }) {
    if (!evacRoute?.end) return;
    try {
      const route = await getEvacuationRoute(
        start.lng,
        start.lat,
        evacRoute.end.lng,
        evacRoute.end.lat,
      );
      onReroute?.({ geometry: route.geometry, isSafe: evacRoute.isSafe });
    } catch {
      // Keep the existing route if the reroute API call fails.
      setRerouteToast("Reroute failed — convoy remains on current path.");
    }
  }

  useEffect(() => {
    let active = true;
    getShelters()
      .then((rows) => {
        if (!active) return;
        setMapShelters(
          rows.length
            ? rows.map((s) => ({
                id: s.id,
                name: s.name,
                district: s.district,
                lat: s.lat,
                lng: s.lng,
                capacity: s.capacity,
                currentOccupancy: s.currentOccupancy,
                status: s.status,
                facilities: (s.facilities as Record<string, boolean> | null) ?? null,
                imageUrl: s.imageUrl ?? null,
              }))
            : SHELTER_MOCK,
        );
      })
      .catch(() => {
        if (active) setMapShelters(SHELTER_MOCK);
      });
    return () => {
      active = false;
    };
  }, []);

  // Resource depots grouped by unique location — each depot renders a 📦 marker.
  useEffect(() => {
    let active = true;
    getInventory()
      .then((rows) => {
        if (!active) return;
        const byDepot: Record<string, DepotMarker> = {};
        for (const r of rows) {
          const key = r.depotName ?? `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
          if (!byDepot[key]) {
            byDepot[key] = {
              id: key,
              name: r.depotName ?? `Depot ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`,
              lat: r.lat,
              lng: r.lng,
              items: [],
            };
          }
          byDepot[key].items.push(r);
        }
        setDepots(Object.values(byDepot));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Smart Allocation: auto-route simulated evacuees to the nearest shelter.
  const mockVillage = { lat: 25.5941, lng: 85.1376, name: "Ganga Floodplain Village" };
  const [route, setRoute] = useState<Feature<LineString> | null>(null);
  const [allocationToast, setAllocationToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rerouteToast, setRerouteToast] = useState<string | null>(null);
  const rerouteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showRerouteToast(message: string) {
    setRerouteToast(message);
    if (rerouteTimer.current) clearTimeout(rerouteTimer.current);
    rerouteTimer.current = setTimeout(() => setRerouteToast(null), 6000);
  }

  function showToast(message: string) {
    setAllocationToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setAllocationToast(null), 4000);
  }

  async function runSmartAllocation() {
    const nearest = (
      await findNearestShelters(mockVillage.lat, mockVillage.lng, mapShelters, 1)
    )[0];
    if (!nearest) {
      showToast("No nearby shelter with capacity available.");
      return;
    }
    setRoute(
      lineString(
        [
          [mockVillage.lng, mockVillage.lat],
          [nearest.lng, nearest.lat],
        ],
        { id: "allocation-route", description: `Evacuation route to ${nearest.name}` },
      ),
    );
    showToast(`150 Evacuees assigned to ${nearest.name}. Route mapped.`);
  }

  // Pulse the active evacuation route to signal movement.
  const [routePulse, setRoutePulse] = useState(true);
  useEffect(() => {
    if (!evacRoute) return;
    setRoutePulse(true);
    const id = setInterval(() => setRoutePulse((p) => !p), 700);
    return () => clearInterval(id);
  }, [evacRoute]);

  // Critical-alert ingress: flash the map frame red + beep when a new critical
  // AlertLog lands for the district currently being viewed.
  const [criticalFlash, setCriticalFlash] = useState(false);
  const lastCriticalSeen = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCriticalFlash = useCallback(() => {
    setCriticalFlash(true);
    playCriticalBeep();
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setCriticalFlash(false), 3000);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = () => {
      void fetch("/api/alerts?limit=5")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          const alerts: {
            severity: string;
            district: string | null;
            createdAt: string;
          }[] = Array.isArray(data.alerts) ? data.alerts : [];
          const newestCritical = alerts.find((a) => a.severity === "critical");
          if (!newestCritical) return;
          const ts = new Date(newestCritical.createdAt).getTime();
          if (Number.isNaN(ts) || ts <= lastCriticalSeen.current) return;
          const viewedDistrict = liveConditions?.district ?? null;
          if (districtsMatch(newestCritical.district ?? null, viewedDistrict)) {
            lastCriticalSeen.current = ts;
            triggerCriticalFlash();
          }
        })
        .catch(() => undefined);
    };

    poll();
    interval = setInterval(poll, 6000);
    return () => {
      if (interval) clearInterval(interval);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [liveConditions?.district, triggerCriticalFlash]);

  // Report the current focus area + district up to the command center.
  useEffect(() => {
    onMapStateChange?.({
      center: mapCenter,
      district: liveConditions?.district ?? null,
      place: searchedPlace?.label ?? null,
    });
  }, [mapCenter, liveConditions, onMapStateChange, searchedPlace]);

  // Re-generate the warning zones when the forecast horizon, the judge's
  // "What-If" scenario, the focused area, or the hazard type changes.
  useEffect(() => {
    const { riskLevel, hoursAhead: effectiveHours } = applyScenario(
      severityRef.current,
      hoursAhead,
      scenarioMultiplier,
    );
    setZonesGeoJSON(
      generateHazardPolygons(
        disasterType,
        mapCenter.lat,
        mapCenter.lng,
        riskLevel,
        effectiveHours,
      ),
    );
  }, [hoursAhead, scenarioMultiplier, mapCenter, disasterType]);

  // Densified point cloud that drives the intensity heatmap.
  const intensityPoints = useMemo(
    () => hazardIntensityPoints(zonesGeoJSON),
    [zonesGeoJSON],
  );

  // Estimated total population inside the current warning zones
  // (used by the Share Alert modal and its caption).
  const affectedPopulation = useMemo(
    () =>
      calculateAffectedPopulation(zonesGeoJSON, mapCenter.lat, mapCenter.lng)
        .totalAffected,
    [zonesGeoJSON, mapCenter],
  );

  // Shelters + resources regenerate around the focused area.
  const sheltersGeoJSON = useMemo(
    () => generateShelters(mapCenter.lat, mapCenter.lng, 5),
    [mapCenter],
  );
  const resourcesGeoJSON = useMemo(
    () => generateResources(mapCenter.lat, mapCenter.lng, 3),
    [mapCenter],
  );

  // Dispatch lines from the allocation engine — one LineString per allocation.
  const dispatchGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: activeAllocations.map((a) => ({
        type: "Feature" as const,
        id: a.id,
        properties: {
          category: DISPATCH_STYLES[a.category] ? a.category : "other",
          quantity: a.quantity,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [a.origin.lng, a.origin.lat],
            [a.destination.lng, a.destination.lat],
          ],
        },
      })),
    }),
    [activeAllocations],
  );

  async function fetchMlPrediction(lat: number, lng: number, rainfall: number) {
    try {
      const response = await fetch(
        `/api/predict?lat=${lat}&lng=${lng}&rainfall=${rainfall}`,
      );
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = (await response.json()) as {
        riskLevel?: string;
        confidenceScore?: number;
        source?: string;
      };
      if (data.source !== "ml" || !data.riskLevel)
        throw new Error("Prediction unavailable");
      const riskLevel = data.riskLevel;
      setMlPrediction({
        riskLevel,
        confidenceScore: Number(data.confidenceScore) || 0,
        source: data.source === "ml" ? "ml" : "fallback",
      });

      const severityMap: Record<string, FloodSeverity> = {
        Safe: "low",
        Watch: "medium",
        Warning: "high",
        Evacuate: "critical",
      };
      const severity = severityMap[riskLevel];
      if (severity) {
        severityRef.current = severity;
        onSeverityChange?.(severity);
        const { riskLevel, hoursAhead: effectiveHours } = applyScenario(
          severity,
          hoursAhead,
          scenarioMultiplier,
        );
        setZonesGeoJSON(
          generateHazardPolygons(disasterType, lat, lng, riskLevel, effectiveHours),
        );
      }
    } catch (error: unknown) {
      setMlPrediction(null);
      console.warn("ML prediction unavailable.");
    }
  }

  async function fetchLiveData(lat: number, lng: number) {
    const requestId = ++liveFetchId.current;
    setLiveConditions({ lat, lng, loading: true, district: null, source: null, rainfall_mm: null, river_level_m: null, river_discharge_m3s: null });

    try {
      const response = await fetch(`/api/live-conditions?lat=${lat}&lng=${lng}`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = (await response.json()) as {
        district?: string;
        source?: "live" | "synthetic";
        rainfall_mm?: number;
        cumulative_rainfall_72h?: number;
        river_level_m?: number;
        river_discharge_m3s?: number;
      };
      if (requestId !== liveFetchId.current) return;

      setLiveConditions({
        lat,
        lng,
        loading: false,
        district: data.district ?? null,
        source: data.source ?? null,
        rainfall_mm: Number.isFinite(Number(data.rainfall_mm))
          ? Number(data.rainfall_mm)
          : null,
        river_level_m:
          data.river_level_m != null && Number.isFinite(Number(data.river_level_m))
            ? Number(data.river_level_m)
            : null,
        river_discharge_m3s:
          data.river_discharge_m3s != null &&
          Number.isFinite(Number(data.river_discharge_m3s))
            ? Number(data.river_discharge_m3s)
            : null,
      });

      const rainfall = data.cumulative_rainfall_72h;
      if (
        data.source === "live" &&
        typeof rainfall === "number" &&
        Number.isFinite(rainfall)
      ) {
        void fetchMlPrediction(lat, lng, rainfall);
      }
    } catch (error: unknown) {
      if (requestId !== liveFetchId.current) return;
      console.error("Live conditions fetch failed:", error);
      setLiveConditions({ lat, lng, loading: false, district: null, source: null, rainfall_mm: null, river_level_m: null, river_discharge_m3s: null });
    }
  }

  function handleMoveEnd(e: { viewState: { latitude: number; longitude: number } }) {
    const { latitude, longitude } = e.viewState;
    const last = lastFetchedCoords.current;

    if (last && Math.hypot(last.lat - latitude, last.lng - longitude) < 0.02) {
      return;
    }

    lastFetchedCoords.current = { lat: latitude, lng: longitude };
    setSearchedPlace(null);
    setMapCenter({ lat: latitude, lng: longitude });
    void fetchLiveData(latitude, longitude);
  }

  function handlePlaceSelected(place: PlaceResult) {
    clearMapSelection();
    setSearchedPlace(place);
    lastFetchedCoords.current = { lat: place.lat, lng: place.lng };
    setMapCenter({ lat: place.lat, lng: place.lng });
    void fetchLiveData(place.lat, place.lng);
  }

  function handleMapClick(e: MapLayerMouseEvent) {
    if (drawingRisk) {
      setDrawPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      return;
    }

    if (closingMode) {
      void handleNewClosure(e.lngLat.lat, e.lngLat.lng);
      return;
    }

    if (measuring) {
      setPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      return;
    }

    setSelectedShelter(null);

    const feature = e.features?.[0];
    if (!feature) {
      setSelected(null);
      setSelectedZone(null);
      return;
    }

    const properties = (feature.properties ?? {}) as Record<string, unknown>;

    // Clicking a warning zone opens its impact popup.
    if (feature.source === "hazard-zones") {
      const zoneFeature = feature as unknown as Feature<Polygon, HazardZoneProperties>;
      const population = calculateZonePopulation(zoneFeature);
      const centroid = center(zoneFeature).geometry.coordinates as [number, number];
      const props = zoneFeature.properties;
      setSelected(null);
      setSelectedZone({
        hazardType: props.hazardType,
        riskLevel: String(props.riskLevel ?? "low"),
        intensity: Number(props.intensity) || 0,
        label: String(props.label ?? "Warning zone"),
        population,
        coordinates: centroid,
      });
      return;
    }

    // A cluster: zoom into it instead of selecting a single shelter.
    if (properties.cluster) {
      const source = e.target.getSource(feature.source) as GeoJSONSource | undefined;
      const clusterId = Number(properties.cluster_id);
      if (source && Number.isFinite(clusterId)) {
        const coordinates = (
          feature.geometry as unknown as { coordinates: [number, number] }
        ).coordinates;
        void source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            // Phase 22 · Step 6 — cinematic camera: 2.5s fly + essential:true
            // (the animation can't be interrupted by a mid-flight gesture).
            e.target.flyTo({
              center: coordinates,
              zoom,
              duration: 2500,
              essential: true,
            });
          })
          .catch(() => undefined);
      }
      return;
    }

    const coordinates = (feature.geometry as unknown as { coordinates: [number, number] })
      .coordinates;
    const matched = findFeatureByPoint(feature.source, coordinates);
    setSelected(matched);
  }

  function handleMouseEnter(e: MapLayerMouseEvent) {
    if (e.features?.length) e.target.getCanvas().style.cursor = "pointer";
  }

  function handleMouseLeave(e: MapLayerMouseEvent) {
    e.target.getCanvas().style.cursor = "";
  }

  function toggleMeasure() {
    setMeasuring((active) => !active);
    setPoints([]);
    setCursor(null);
  }

  function findFeatureByPoint(
    sourceId: string,
    coordinates: [number, number],
  ): ShelterFeature | ResourceFeature | null {
    const collection =
      sourceId === "shelters" ? sheltersGeoJSON.features : resourcesGeoJSON.features;
    return (
      collection.find(
        (feature) =>
          feature.geometry.coordinates[0] === coordinates[0] &&
          feature.geometry.coordinates[1] === coordinates[1],
      ) ?? null
    );
  }

  const measureGeoJson: GeoJSON.FeatureCollection =
    points.length > 1
      ? {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: points,
              },
            },
          ],
        }
      : {
          type: "FeatureCollection",
          features: [],
        };

  return (
    <MapProvider>
      <Map
        mapLib={maplibregl}
        initialViewState={DEFAULT_INITIAL_VIEW}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        onClick={handleMapClick}
        onMouseEnter={handleMouseEnter}
        onMouseMove={(e) => {
          if (measuring) setCursor(e.lngLat);
        }}
        onMouseLeave={(e) => {
          handleMouseLeave(e);
          setCursor(null);
        }}
        interactiveLayerIds={[
          "hazard-zone-fill",
          "shelter-cluster",
          "shelter-point",
          "resource-cluster",
          "resource-point",
        ]}
        onMoveEnd={handleMoveEnd}
        onLoad={(e) => {
          const center = e.target.getCenter();
          lastFetchedCoords.current = { lat: center.lat, lng: center.lng };
          setMapCenter({ lat: center.lat, lng: center.lng });
          void fetchLiveData(center.lat, center.lng);
        }}
      >
        {searchedPlace && (
          <Marker longitude={searchedPlace.lng} latitude={searchedPlace.lat} anchor="bottom">
            <MapPinMarker label={searchedPlace.label} />
          </Marker>
        )}
        {visibleLayers.floodZones && (
          <Source id="hazard-zones" type="geojson" data={zonesGeoJSON}>
            <Layer
              id="hazard-zone-fill"
              type="fill"
              paint={{
                "fill-color": [
                  "match",
                  ["get", "riskLevel"],
                  "low",
                  SEVERITY_COLORS.low,
                  "medium",
                  SEVERITY_COLORS.medium,
                  "high",
                  SEVERITY_COLORS.high,
                  "critical",
                  SEVERITY_COLORS.critical,
                  "#3b82f6",
                ],
                "fill-opacity": 0.5,
              }}
            />
            <Layer
              id="hazard-zone-outline"
              type="line"
              paint={{
                "line-color": "#e2e8f0",
                "line-width": 1,
              }}
            />
          </Source>
        )}

        {visibleLayers.floodZones && (
          <Source id="hazard-intensity" type="geojson" data={intensityPoints}>
            <Layer
              id="hazard-intensity-heatmap"
              type="heatmap"
              paint={{
                "heatmap-weight": [
                  "interpolate",
                  ["linear"],
                  ["get", "heatValue"],
                  0,
                  0,
                  1,
                  1,
                ],
                "heatmap-intensity": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  0,
                  1.5,
                  9,
                  4.5,
                ],
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0,
                  "rgba(0,0,0,0)",
                  0.15,
                  "rgba(165, 243, 252, 0.15)",
                  0.35,
                  "rgba(56, 189, 248, 0.35)",
                  0.55,
                  "rgba(14, 165, 233, 0.6)",
                  0.75,
                  "rgba(29, 78, 216, 0.85)",
                  1,
                  "rgba(88, 28, 135, 0.95)",
                ],
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 16, 9, 34],
                "heatmap-opacity": 0.7,
              }}
            />
          </Source>
        )}

        {points.length > 1 && (
          <Source id="measure-line" type="geojson" data={measureGeoJson}>
            <Layer
              id="measure-line-layer"
              type="line"
              paint={{
                "line-color": "#38bdf8",
                "line-width": 3,
                "line-dasharray": [2, 1],
              }}
            />
          </Source>
        )}

        {/* Collaborative risk-area drawing: points first, then the polygon. */}
        {drawingRisk && drawPoints.length > 0 && (
          <Source
            id="draw-points"
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: drawPoints.map((coords) => ({
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: coords },
              })),
            }}
          >
            <Layer
              id="draw-points-layer"
              type="circle"
              paint={{
                "circle-radius": 6,
                "circle-color": "#f59e0b",
                "circle-stroke-color": "#0A0F1D",
                "circle-stroke-width": 2,
              }}
            />
          </Source>
        )}

        {drawingRisk && drawPoints.length >= 3 && (
          <Source
            id="draw-polygon"
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "Polygon",
                    coordinates: [[...drawPoints, drawPoints[0]]],
                  },
                },
              ],
            }}
          >
            <Layer
              id="draw-polygon-fill"
              type="fill"
              paint={{
                "fill-color": "#f59e0b",
                "fill-opacity": 0.35,
              }}
            />
            <Layer
              id="draw-polygon-outline"
              type="line"
              paint={{
                "line-color": "#f59e0b",
                "line-width": 3,
              }}
            />
          </Source>
        )}

        {visibleLayers.shelters &&
          mapShelters.map((shelter) => (
            <Marker
              key={shelter.id}
              longitude={shelter.lng}
              latitude={shelter.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent?.stopPropagation();
                setSelectedShelter(shelter);
              }}
            >
              <div className="flex flex-col items-center" role="button">
                <div
                  className={`h-4 w-4 rounded-full border-2 border-white shadow-lg transition-all duration-300 ease-out ${
                    selectedShelter?.id === shelter.id ? "ring-2 ring-accent" : ""
                  }`}
                  style={{ backgroundColor: shelterMarkerColor(shelter) }}
                />
              </div>
            </Marker>
          ))}

        {closures.map((closure) => (
          <Marker
            key={closure.id}
            longitude={closure.lng}
            latitude={closure.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent?.stopPropagation();
              void resolveRoadClosure(closure.id).then((ok) => {
                if (ok) setClosures((prev) => prev.filter((c) => c.id !== closure.id));
              });
            }}
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-severity-red-600 text-sm font-black text-white shadow-lg transition-all duration-300 ease-out"
              title={`${closure.reason} (${closure.lat.toFixed(4)}, ${closure.lng.toFixed(4)}) — click to reopen`}
            >
              ✕
            </div>
          </Marker>
        ))}

        {groundReports.map((report) => (
          <Marker
            key={report.id}
            longitude={report.lng}
            latitude={report.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent?.stopPropagation();
              setSelectedGroundReport(report);
            }}
          >
            <GroundReportMarker report={report} />
          </Marker>
        ))}

        {visibleLayers.resources &&
          depots.map((depot) => (
            <Marker
              key={depot.id}
              longitude={depot.lng}
              latitude={depot.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent?.stopPropagation();
                setSelectedDepot(depot);
              }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-surface-elevated text-base shadow-lg transition-all duration-300 ease-out hover:scale-110"
                title={`${depot.name} — click for stock`}
              >
                📦
              </div>
            </Marker>
          ))}

        {visibleLayers.resources && (
          <Source
            id="resources"
            type="geojson"
            data={resourcesGeoJSON}
            cluster
            clusterMaxZoom={11}
            clusterRadius={50}
          >
            <Layer
              id="resource-cluster"
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": "#f59e0b",
                "circle-radius": ["step", ["get", "point_count"], 18, 5, 24, 10, 30],
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
                "circle-opacity": 0.85,
              }}
            />
            <Layer
              id="resource-cluster-count"
              type="symbol"
              filter={["has", "point_count"]}
              layout={{
                "text-field": "{point_count_abbreviated}",
                "text-size": 12,
              }}
              paint={{ "text-color": "#ffffff" }}
            />
            <Layer
              id="resource-point"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": "#f59e0b",
                "circle-radius": 8,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
              }}
            />
          </Source>
        )}

        {activeAllocations.length > 0 && (
          <Source id="dispatch-lines" type="geojson" data={dispatchGeoJSON}>
            <Layer
              id="dispatch-line-glow"
              type="line"
              paint={{
                "line-color": "#0b1428",
                "line-width": 5,
                "line-opacity": 0.35,
              }}
            />
            {Object.entries(DISPATCH_STYLES).map(([category, style]) => (
              <Layer
                key={category}
                id={`dispatch-line-${category}`}
                type="line"
                filter={["==", ["get", "category"], category]}
                paint={{
                  "line-color": style.color,
                  "line-width": 2.5,
                  "line-dasharray": style.dash,
                  "line-opacity": 0.9,
                }}
              />
            ))}
          </Source>
        )}

        <DispatchLineAnimator active={activeAllocations.length > 0} />

        <FleetMarker />

        {route && (
          <Source id="allocation-route" type="geojson" data={route}>
            <Layer
              id="allocation-route-outline"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#0b1428",
                "line-width": 9,
                "line-opacity": 0.5,
              }}
            />
            <Layer
              id="allocation-route-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#38bdf8",
                "line-width": 4,
                "line-dasharray": [2, 1],
              }}
            />
          </Source>
        )}

        {evacRoute && (
          <Source id="evac-route" type="geojson" data={evacRoute.geometry}>
            <Layer
              id="evac-route-glow"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#0b1428",
                "line-width": 10,
                "line-opacity": 0.35,
              }}
            />
            <Layer
              id="evac-route-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": evacRoute.isSafe ? "#3b82f6" : "#ef4444",
                "line-width": 6,
                "line-dasharray": evacRoute.isSafe ? undefined : [4, 3],
                "line-opacity": routePulse ? 1 : 0.55,
              }}
            />
          </Source>
        )}

        {route && (
          <Marker longitude={mockVillage.lng} latitude={mockVillage.lat} anchor="bottom">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black/30 bg-severity-red-600 text-[10px] font-black text-white shadow-lg transition-all duration-300 ease-out">
              V
            </div>
          </Marker>
        )}

        {selected && (
          <Popup
            longitude={selected.geometry.coordinates[0]}
            latitude={selected.geometry.coordinates[1]}
            anchor="top"
            closeButton={false}
            className="hidden md:block"
            onClose={() => setSelected(null)}
          >
            <PopupContent feature={selected} />
          </Popup>
        )}

        {selectedShelter && (
          <Popup
            longitude={selectedShelter.lng}
            latitude={selectedShelter.lat}
            anchor="top"
            closeButton={false}
            className="hidden md:block"
            onClose={() => setSelectedShelter(null)}
          >
            <ShelterPopupContent shelter={selectedShelter} />
          </Popup>
        )}

        {selectedDepot && (
          <Popup
            longitude={selectedDepot.lng}
            latitude={selectedDepot.lat}
            anchor="top"
            closeButton={false}
            className="hidden md:block"
            onClose={() => setSelectedDepot(null)}
          >
            <DepotPopupContent depot={selectedDepot} />
          </Popup>
        )}

        {selectedGroundReport && (
          <Popup
            longitude={selectedGroundReport.lng}
            latitude={selectedGroundReport.lat}
            anchor="top"
            closeButton={false}
            className="hidden md:block"
            onClose={() => setSelectedGroundReport(null)}
          >
            <GroundReportPopupContent report={selectedGroundReport} />
          </Popup>
        )}

        {selectedZone && (
          <Popup
            longitude={selectedZone.coordinates[0]}
            latitude={selectedZone.coordinates[1]}
            anchor="bottom"
            closeButton={false}
            className="hidden md:block"
            onClose={() => setSelectedZone(null)}
          >
            <ZonePopupContent zone={selectedZone} />
          </Popup>
        )}

        <NavigationControl position="bottom-right" />
        <GeolocateControl
          position="bottom-right"
          positionOptions={{ enableHighAccuracy: true }}
          trackUserLocation
          onGeolocate={(e) => {
            const { longitude, latitude } = e.coords;
            lastFetchedCoords.current = { lat: latitude, lng: longitude };
            setMapCenter({ lat: latitude, lng: longitude });
            void fetchLiveData(latitude, longitude);
          }}
        />
      </Map>

      <div className={`pointer-events-none absolute right-4 z-20 w-[min(24rem,calc(100%-2rem))] space-y-2 ${searchBelowHeader ? "top-20" : "top-4"}`}>
        <div className="pointer-events-auto"><MapPlaceSearch onPlaceSelected={handlePlaceSelected} /></div>
        <div className="pointer-events-auto"><LocationSelector /></div>
      </div>

      {/* Smart Allocation trigger + toast */}
      <div className="pointer-events-none absolute bottom-6 left-6 z-10 flex flex-col items-start gap-3">
        <div className="pointer-events-auto flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => {
              void runSmartAllocation();
            }}
            className="rounded-md border border-accent bg-accent-soft px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent shadow-glow transition hover:bg-accent hover:text-slate-950"
          >
            Run Smart Allocation
          </button>
        </div>
        {allocationToast && (
          <div className="pointer-events-auto w-72 rounded-eoc border border-severity-green-600 bg-surface-elevated px-4 py-3 shadow-2xl">
            <p className="eoc-label text-severity-green-400">SMART ALLOCATION</p>
            <p className="mt-1 text-sm font-medium text-foreground">{allocationToast}</p>
          </div>
        )}
        {rerouteToast && (
          <div className="pointer-events-auto w-80 rounded-eoc border-2 border-severity-red-600 bg-surface-elevated px-4 py-3 shadow-glow-red">
            <p className="eoc-label text-severity-red-400">CRITICAL · REROUTING</p>
            <p className="mt-1 text-sm font-semibold text-severity-red-300">
              {rerouteToast}
            </p>
          </div>
        )}
      </div>

      {mlPrediction && (
        <AiRiskBanner prediction={mlPrediction} hazardType={disasterType} />
      )}

      <div className="absolute right-3 top-32 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={toggleMeasure}
          className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
            measuring
              ? "border-accent bg-accent text-slate-950"
              : "border-border bg-surface-elevated/95 text-foreground shadow-glow-accent backdrop-blur hover:border-accent"
          }`}
        >
          {measuring ? "Stop Measuring" : "Measure"}
        </button>
        {points.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setPoints([]);
              setCursor(null);
            }}
            className="rounded-md border border-border bg-surface-elevated/95 px-3 py-2 text-xs font-semibold text-severity-red-400 shadow-glow-red backdrop-blur transition hover:border-severity-red-500"
          >
            Clear Measurement
          </button>
        )}
        <RoadClosureTool
          active={closingMode}
          onToggle={toggleClosingMode}
          count={closures.length}
        />
        <button
          type="button"
          onClick={toggleDrawingRisk}
          className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
            drawingRisk
              ? "border-amber-400 bg-amber-400 text-slate-950"
              : "border-border bg-surface-elevated/95 text-foreground shadow-glow-accent backdrop-blur hover:border-amber-400"
          }`}
        >
          {drawingRisk ? "Stop Drawing" : "Draw Risk Area"}
        </button>
        {drawPoints.length > 0 && (
          <>
            <button
              type="button"
              onClick={clearDrawing}
              className="rounded-md border border-border bg-surface-elevated/95 px-3 py-2 text-xs font-semibold text-severity-red-400 shadow-glow-red backdrop-blur transition hover:border-severity-red-500"
            >
              Clear Drawing
            </button>
            <button
              type="button"
              disabled={drawPoints.length < 3}
              onClick={broadcastDrawing}
              className="rounded-md border border-amber-400 bg-amber-400/15 px-3 py-2 text-xs font-bold text-amber-300 shadow-glow transition hover:bg-amber-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Broadcast Drawing
            </button>
          </>
        )}
      </div>

      {measuring && cursor && <MeasureReadout points={points} cursor={cursor} />}

      {drawToast && (
        <div className="pointer-events-none absolute bottom-6 right-6 z-20 w-80 rounded-eoc border-2 border-amber-400 bg-surface-elevated/95 px-4 py-3 shadow-glow-accent backdrop-blur">
          <p className="eoc-label text-amber-300">BROADCAST</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{drawToast}</p>
        </div>
      )}

      {liveConditions && <LiveConditionsPanel conditions={liveConditions} />}

      <ShareAlert
        riskLabel={mlPrediction?.riskLevel ?? RISK_SEVERITY_LABEL[severityRef.current]}
        hazardType={disasterType}
        hoursAhead={hoursAhead}
        affectedPopulation={affectedPopulation}
      />

      <FloodPulse />

      {criticalFlash && (
        <div className="map-alert-flash-ring animate-map-alert-flash pointer-events-none absolute inset-0 z-50" />
      )}

      {/* Phase 9 · Step 2 — mobile bottom sheet for the tapped detail. The
          popups above are hidden below md (`hidden md:block`), so on phones
          the same content surfaces in a draggable sheet instead. */}
      <MapBottomSheet
        feature={sheetFeature}
        defaultSnap="CONTENT"
        onDismiss={clearMapSelection}
      >
        {sheetContent}
      </MapBottomSheet>
    </MapProvider>
  );
}

// Pulsing warning effect for high/critical flood zones. Drives the map's
// paint directly via requestAnimationFrame (no React re-render per frame).
function MapPinMarker({ label }: { label: string }) {
  return <span title={label} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-slate-950 shadow-xl">●</span>;
}

function FloodPulse() {
  const map = useMap().default;

  useEffect(() => {
    let raf = 0;
    let frame = 0;
    const FLOOD_LAYER = "hazard-zone-fill";

    const tick = () => {
      frame += 1;
      const mlMap = map?.getMap();
      if (mlMap && mlMap.getLayer(FLOOD_LAYER)) {
        // Oscillate 0.3 <-> 0.7.
        const opacity = 0.5 + Math.sin(frame * 0.05) * 0.2;
        try {
          mlMap.setPaintProperty(FLOOD_LAYER, "fill-opacity", [
            "match",
            ["get", "riskLevel"],
            "critical",
            opacity,
            "high",
            opacity,
            0.5,
          ]);
        } catch {
          // Layer removed mid-frame (e.g. layer toggle) — resume next frame.
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [map]);

  return null;
}

function AiRiskBanner({
  prediction,
  hazardType,
}: {
  prediction: { riskLevel: string; confidenceScore: number; source: "ml" | "fallback" };
  hazardType: DisasterType;
}) {
  const META: Record<string, { label: string; dot: string; ring: string }> = {
    Safe: {
      label: "text-severity-green-400",
      dot: "bg-severity-green-500",
      ring: "border-severity-green-600",
    },
    Watch: {
      label: "text-severity-amber-400",
      dot: "bg-severity-amber-500",
      ring: "border-severity-amber-600",
    },
    Warning: {
      label: "text-severity-red-400",
      dot: "bg-severity-red-500",
      ring: "border-severity-red-600",
    },
    Evacuate: {
      label: "text-severity-purple-400",
      dot: "bg-severity-purple-500",
      ring: "border-severity-purple-600",
    },
  };

  const meta = META[prediction.riskLevel] ?? META.Watch;
  const pct = Math.round(prediction.confidenceScore * 100);

  return (
    <div
      className={`eoc-panel absolute left-1/2 top-16 z-10 -translate-x-1/2 border ${meta.ring} px-4 py-2.5 text-center`}
    >
      <span className="eoc-label text-accent">
        AI ASSESSMENT · {DISASTER_META[hazardType].label.toUpperCase()}
      </span>
      <div className="mt-1 flex items-center justify-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} animate-pulse`} />
        <span className={`font-semibold ${meta.label}`}>{prediction.riskLevel}</span>
        <span className="text-xs text-slate-400">Confidence: {pct}%</span>
      </div>
      {prediction.source === "fallback" && (
        <p className="mt-1 text-[10px] uppercase text-slate-500">
          Model offline · defaulted
        </p>
      )}
    </div>
  );
}

function LiveConditionsPanel({ conditions }: { conditions: LiveConditions }) {
  const warningColor: Record<string, string> = {
    green: "text-severity-green-400",
    amber: "text-severity-amber-400",
    red: "text-severity-red-400",
    critical: "text-severity-purple-400",
    unknown: "text-slate-400",
  };

  return (
    <div className="eoc-panel absolute bottom-20 left-4 z-10 w-60 p-4">
      <div className="flex items-center justify-between">
        <p className="eoc-label text-accent">LIVE CONDITIONS</p>
        {conditions.source === "synthetic" && (
          <span className="rounded-full border border-severity-amber-600 bg-severity-amber-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-severity-amber-400">
            Fallback
          </span>
        )}
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-400">District</dt>
          <dd className="font-medium">{conditions.district ?? "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Rainfall</dt>
          <dd className="font-medium">
            {conditions.rainfall_mm !== null ? `${conditions.rainfall_mm} mm` : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">River level</dt>
          <dd className="font-medium">
            {conditions.river_level_m !== null ? `${conditions.river_level_m} m` : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Discharge</dt>
          <dd className="font-medium">
            {conditions.river_discharge_m3s !== null
              ? `${conditions.river_discharge_m3s} m³/s`
              : "—"}
          </dd>
        </div>
      </dl>

      <p
        className={`mt-3 text-xs font-semibold ${warningColor[conditions.source === "live" ? "green" : "amber"]}`}
      >
        {conditions.loading
          ? "Refreshing…"
          : conditions.source === "live"
            ? "● Live feed"
            : conditions.source === "synthetic"
              ? "● Synthetic data"
              : "● Data unavailable"}
      </p>
    </div>
  );
}

function MeasureReadout({
  points,
  cursor,
}: {
  points: [number, number][];
  cursor: { lng: number; lat: number };
}) {
  const map = useMap().default;
  if (!map) return null;

  const px = map.project([cursor.lng, cursor.lat]);
  const distanceKm =
    points.length >= 2 ? length(lineString(points), { units: "kilometers" }) : 0;

  // Area of the convex hull of the measured points (km²) once ≥3 points exist.
  let areaSqKm = 0;
  if (points.length >= 3) {
    const hull = convex({
      type: "FeatureCollection",
      features: points.map((coords) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: coords },
      })),
    });
    if (hull) areaSqKm = area(hull) / 1_000_000;
  }

  return (
    <div
      className="pointer-events-none fixed z-30 rounded-md border border-accent bg-surface-elevated/95 px-3 py-1.5 text-xs font-semibold text-accent shadow-glow-accent backdrop-blur"
      style={{ left: px.x + 14, top: px.y - 16 }}
    >
      {points.length >= 2
        ? `${distanceKm.toFixed(2)} km${
            areaSqKm > 0 ? ` · ${areaSqKm.toFixed(2)} km²` : ""
          }`
        : "Click to add points"}
    </div>
  );
}

// Animates the dispatch line-dasharray (marching dashes) once the map loads.
function DispatchLineAnimator({ active }: { active: boolean }) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!active) return;

    let raf = 0;
    let timer = 0;
    let started = false;
    const layerIds = Object.keys(DISPATCH_STYLES).map((c) => `dispatch-line-${c}`);

    function start(ml: maplibregl.Map) {
      const t0 = performance.now();
      const tick = () => {
        const t = performance.now() - t0;
        for (const id of layerIds) {
          const category = id.replace("dispatch-line-", "");
          const [d, g] = DISPATCH_STYLES[category].dash;
          if (g <= 0) continue; // solid line — no animation needed
          if (!ml.getLayer(id)) continue;
          ml.setPaintProperty(id, "line-dasharray", [d, g * 8 + t / 30]);
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    }

    const ml = map?.getMap?.();
    if (ml) {
      start(ml);
    } else {
      // Map may not have registered yet — poll briefly until it exists.
      timer = window.setInterval(() => {
        const m2 = map?.getMap?.();
        if (m2 && !started) {
          started = true;
          window.clearInterval(timer);
          start(m2);
        }
      }, 200);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (timer) window.clearInterval(timer);
    };
  }, [map, active]);

  return null;
}

// Animates a "Rescue Boat Fleet" 🚤 marker, interpolating between two points
// and ping-ponging so the convoy is shown in transit continuously.
function FleetMarker() {
  const { current: map } = useMap();

  useEffect(() => {
    let raf = 0;
    let timer = 0;
    let marker: maplibregl.Marker | null = null;
    let t = 0;
    let dir = 1;
    let last = performance.now();

    function start(ml: maplibregl.Map) {
      const el = document.createElement("div");
      el.className =
        "flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-surface-elevated text-base shadow-lg transition-all duration-300 ease-out";
      el.textContent = "🚤";
      // Phase 22 · Step 6 — this marker is rAF-driven (setLngLat every frame),
      // so it opts out of the global .maplibregl-marker transform transition
      // to keep the 4s ping-pong path frame-accurate.
      el.classList.add("no-anim");
      el.title = "Rescue Boat Fleet (in transit)";
      marker = new maplibregl.Marker({ element: el })
        .setLngLat([FLEET_START.lng, FLEET_START.lat])
        .addTo(ml);

      const tick = (now: number) => {
        const dt = now - last;
        last = now;
        t += (dt / FLEET_DURATION_MS) * dir;
        if (t >= 1) {
          t = 1;
          dir = -1;
        } else if (t <= 0) {
          t = 0;
          dir = 1;
        }
        marker?.setLngLat([
          FLEET_START.lng + (FLEET_END.lng - FLEET_START.lng) * t,
          FLEET_START.lat + (FLEET_END.lat - FLEET_START.lat) * t,
        ]);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    const ml = map?.getMap?.();
    if (ml) {
      start(ml);
    } else {
      timer = window.setInterval(() => {
        const m2 = map?.getMap?.();
        if (m2) {
          window.clearInterval(timer);
          start(m2);
        }
      }, 200);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (timer) window.clearInterval(timer);
      marker?.remove();
    };
  }, [map]);

  return null;
}

// Phase 17 — pulsing "?" for unverified reports; solid color-coded icon
// (blue = water, red = rescue) for verified ones.
function GroundReportMarker({ report }: { report: GroundReport }) {
  const unverified = report.verification_status !== "verified";
  const color = groundReportColor(report.report_type);

  if (unverified) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-500 text-sm font-black text-white shadow-lg transition-all duration-300 ease-out">
        <span className="animate-pulse">?</span>
      </div>
    );
  }
  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-sm font-black text-white shadow-lg transition-all duration-300 ease-out"
      style={{ backgroundColor: color }}
    >
      {report.report_type === "rescue" ? "!" : "●"}
    </div>
  );
}

function GroundReportPopupContent({ report }: { report: GroundReport }) {
  const color = groundReportColor(report.report_type);
  return (
    <div className="w-full p-3 sm:w-64">
      <div className="flex items-center justify-between gap-2">
        <p className="eoc-label" style={{ color }}>
          {report.source.toUpperCase()} REPORT
        </p>
        <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
          {report.verification_status}
        </span>
      </div>
      {/* Phase 21 · citizen PII is auto-redacted before rendering */}
      <p className="mt-2 flex items-start gap-1.5 text-sm italic leading-relaxed text-slate-200">
        <span>“{redactReportText(report.raw_text)}”</span>
        <span
          title="PII Auto-Redacted for Privacy"
          aria-label="PII Auto-Redacted for Privacy"
          className="mt-0.5 shrink-0 text-xs not-italic leading-none"
        >
          🔒
        </span>
      </p>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
        <span>
          AI confidence:{" "}
          <span className="font-bold text-accent">
            {Math.round(report.confidence_score * 100)}%
          </span>
        </span>
        <span>
          Severity{" "}
          <span className="font-bold" style={{ color }}>
            {report.severity}
          </span>
        </span>
      </div>
      {report.locations.length > 0 && (
        <p className="mt-1 text-xs text-slate-400">{report.locations.join(" · ")}</p>
      )}
    </div>
  );
}

function ZonePopupContent({ zone }: { zone: NonNullable<SelectedZone> }) {
  const color = SEVERITY_COLORS[zone.riskLevel] ?? "#3b82f6";
  const meta = DISASTER_META[zone.hazardType];

  return (
    <div className="w-full p-3 sm:w-52">
      <p className="eoc-label text-accent">
        {meta.icon} {meta.label.toUpperCase()} ZONE
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <h3 className="font-semibold capitalize">{zone.riskLevel} Risk</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">{zone.label}</p>
      <p className="mt-2 text-sm text-slate-300">
        {meta.intensityLabel}:{" "}
        <span className="font-semibold text-foreground">
          {zone.intensity.toFixed(1)} {meta.intensityUnit}
        </span>
      </p>
      <p className="mt-1 text-sm text-slate-300">
        Affected Population:{" "}
        <span className="font-semibold text-severity-red-400">
          {zone.population.toLocaleString()}
        </span>
      </p>
    </div>
  );
}

function PopupContent({ feature }: { feature: NonNullable<SelectedFeature> }) {
  if ("capacity" in feature.properties) {
    const capacity = feature.properties.capacity;
    const occupancy = feature.properties.occupancy;
    const pct = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;

    return (
      <div className="w-full p-3 sm:w-56">
        <p className="eoc-label text-accent">SHELTER</p>
        <h3 className="mt-1 font-semibold">{feature.properties.name}</h3>
        <p className="mt-2 text-sm text-slate-300">
          Occupancy: {occupancy} / {capacity}
        </p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-severity-green-500"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">{pct}% full</p>
      </div>
    );
  }

  return (
    <div className="w-full p-3 sm:w-48">
      <p className="eoc-label text-accent">RESOURCE</p>
      <h3 className="mt-1 font-semibold capitalize">{feature.properties.type}</h3>
      <p className="mt-2 text-sm text-slate-300">
        Quantity: {feature.properties.quantity}
      </p>
    </div>
  );
}

function ShelterPopupContent({ shelter }: { shelter: MapShelter }) {
  const pct =
    shelter.capacity > 0
      ? Math.min(100, Math.round((shelter.currentOccupancy / shelter.capacity) * 100))
      : 0;
  const color = shelterMarkerColor(shelter);
  const statusChip =
    shelter.status === "full"
      ? "bg-severity-red-600 text-white"
      : shelter.status === "closed"
        ? "bg-surface-elevated text-slate-300"
        : "bg-severity-green-600 text-white";

  return (
    <div className="w-full p-3 sm:w-60">
      {shelter.imageUrl && (
        <Image
          src={shelter.imageUrl}
          alt={shelter.name}
          width={240}
          height={96}
          unoptimized
          className="mb-2 h-24 w-full rounded-md border border-border object-cover"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="eoc-label text-accent">SHELTER</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusChip}`}
        >
          {shelter.status}
        </span>
      </div>
      <h3 className="mt-1 font-semibold">{shelter.name}</h3>
      {shelter.district && <p className="text-xs text-slate-400">{shelter.district}</p>}

      <div className="mt-2 flex items-center gap-2">
        <div className="h-2.5 w-24 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-sm tabular-nums text-slate-300">
          {shelter.currentOccupancy} / {shelter.capacity}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">
        {Math.max(0, shelter.capacity - shelter.currentOccupancy)} beds remaining
      </p>

      <p className="eoc-label mt-3">FACILITIES</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {Object.entries(FACILITY_META).some(([key]) => shelter.facilities?.[key]) ? (
          Object.entries(FACILITY_META).map(([key, meta]) =>
            shelter.facilities?.[key] ? (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
              >
                <span>{meta.icon}</span>
                {meta.label}
              </span>
            ) : null,
          )
        ) : (
          <span className="text-xs text-slate-500">No facilities listed</span>
        )}
      </div>
    </div>
  );
}

function DepotPopupContent({ depot }: { depot: DepotMarker }) {
  const available = depot.items.filter((i) => i.status === "available");
  return (
    <div className="w-full p-3 sm:w-56">
      <p className="eoc-label text-accent">RESOURCE DEPOT</p>
      <h3 className="mt-1 font-semibold">{depot.name}</h3>
      {available.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">
          No available stock at this location.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {available.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-300">{item.name}</span>
              <span className="shrink-0 font-bold tabular-nums text-emerald-400">
                {item.quantity} {item.unit ?? ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// "Share Alert" — snapshots the current map canvas and opens an export modal
// pre-loaded with the alert text and affected-population numbers.
function ShareAlert({
  riskLabel,
  hazardType,
  hoursAhead,
  affectedPopulation,
}: {
  riskLabel: string;
  hazardType: DisasterType;
  hoursAhead: number;
  affectedPopulation: number;
}) {
  const map = useMap().default;
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function handleOpen() {
    const mapLib = map?.getMap();
    if (!mapLib) return;
    try {
      setImageUrl(mapLib.getCanvas().toDataURL("image/png"));
    } catch (error: unknown) {
      console.error("Screenshot failed:", error);
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="absolute right-3 top-24 z-10 rounded-md border border-accent bg-surface-elevated/95 px-3 py-2 text-xs font-semibold text-accent shadow-glow-accent backdrop-blur transition hover:bg-accent hover:text-slate-950"
      >
        Share Alert
      </button>

      {open && (
        <ShareAlertModal
          imageUrl={imageUrl}
          riskLabel={riskLabel}
          hazardType={hazardType}
          hoursAhead={hoursAhead}
          affectedPopulation={affectedPopulation}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ShareAlertModal({
  imageUrl,
  riskLabel,
  hazardType,
  hoursAhead,
  affectedPopulation,
  onClose,
}: {
  imageUrl: string | null;
  riskLabel: string;
  hazardType: DisasterType;
  hoursAhead: number;
  affectedPopulation: number;
  onClose: () => void;
}) {
  const meta = DISASTER_META[hazardType];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-eoc border border-border bg-surface p-5 shadow-glow-accent"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="eoc-label text-accent">SHARE ALERT</p>
            <h3 className="mt-1 text-lg font-bold text-severity-red-400">
              ⚠️ {riskLabel.toUpperCase()} {meta.label.toUpperCase()} ALERT
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-slate-400 transition hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {imageUrl ? (
          // Data-URL screenshot — not routable through next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Flood map snapshot"
            className="mt-3 w-full rounded-md border border-border"
          />
        ) : (
          <div className="mt-3 flex h-40 w-full items-center justify-center rounded-md border border-border text-sm text-slate-400">
            Capturing map…
          </div>
        )}

        <p className="mt-3 text-sm text-slate-300">
          {meta.impactTemplate.replace("{hours}", String(Math.max(1, hoursAhead)))}{" "}
          Estimated affected population:{" "}
          <span className="font-bold text-severity-red-400">
            {affectedPopulation.toLocaleString()}
          </span>
          .
        </p>

        <div className="mt-4 flex gap-2">
          <a
            href={imageUrl ?? undefined}
            download="disaster-alert-map.png"
            aria-disabled={!imageUrl}
            className={`flex-1 rounded-md px-4 py-2 text-center text-sm font-semibold transition ${
              imageUrl
                ? "bg-accent text-slate-950 hover:brightness-110"
                : "pointer-events-none cursor-not-allowed bg-surface-elevated text-slate-500"
            }`}
          >
            Download Image
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-accent hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
