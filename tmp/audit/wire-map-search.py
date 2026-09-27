from pathlib import Path
p=Path('components/map/MapPlaceSearch.tsx')
p.write_text('''"use client";

import { useState, type FormEvent } from "react";
import { MapPin, Search } from "lucide-react";
import { useMap } from "react-map-gl/maplibre";
import { coordinatesFromQuery, type PlaceResult } from "@/lib/map/place-search";

type Props = { onPlaceSelected: (place: PlaceResult) => void };

export default function MapPlaceSearch({ onPlaceSelected }: Props) {
  const { current: map } = useMap();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selected, setSelected] = useState<PlaceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function choose(place: PlaceResult) {
    if (!map) {
      setError("The map is still loading. Try again shortly.");
      return;
    }
    setSelected(place);
    setQuery(place.label);
    setResults([]);
    setError("");
    onPlaceSelected(place);
    map.flyTo({ center: [place.lng, place.lat], zoom: 10, duration: 1800, essential: true });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    const coordinates = coordinatesFromQuery(value);
    if (coordinates) return choose(coordinates);
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const response = await fetch(`/api/map/places?q=${encodeURIComponent(value)}`);
      const data = (await response.json()) as { places?: PlaceResult[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Search is unavailable.");
      const places = Array.isArray(data.places) ? data.places : [];
      setResults(places);
      if (places.length === 0) setError("No mapped places found. Try a more specific name or coordinates.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Search is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-lg border border-border bg-surface-elevated/95 p-2 text-foreground shadow-glow-accent backdrop-blur">
      <form onSubmit={(event) => void submit(event)} className="flex items-center gap-2">
        <Search aria-hidden className="h-4 w-4 shrink-0 text-accent" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search places on the map"
          placeholder="Search place name or lat, lng"
          className="min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground placeholder:text-slate-400 focus:outline-none"
        />
        <button type="submit" disabled={loading || !query.trim()} className="min-h-10 rounded-md bg-accent px-3 text-xs font-bold text-slate-950 disabled:opacity-50">
          {loading ? "Searching…" : "Find"}
        </button>
      </form>
      {error && <p role="alert" className="px-1 pb-1 pt-2 text-xs text-amber-300">{error}</p>}
      {results.length > 0 && (
        <ul aria-label="Place search results" className="mt-2 max-h-56 space-y-1 overflow-y-auto border-t border-border pt-2">
          {results.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => choose(place)} className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-white/10">
                <MapPin aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{place.label}</span><span className="block truncate text-xs text-slate-400">{place.address || place.kind || `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <p aria-live="polite" className="mt-2 border-t border-border px-1 pt-2 text-xs text-slate-300">
          Viewing <strong className="text-white">{selected.label}</strong> · {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}. Conditions and map layers below update for this location when available.
        </p>
      )}
      <p className="mt-1 px-1 text-[10px] text-slate-500">Place data: Google Maps via SerpAPI · search on submit</p>
    </div>
  );
}
''',encoding='utf-8')
p=Path('components/map/DisasterMap.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('import LocationSelector from "@/components/map/LocationSelector";','import LocationSelector from "@/components/map/LocationSelector";\nimport MapPlaceSearch from "@/components/map/MapPlaceSearch";\nimport type { PlaceResult } from "@/lib/map/place-search";')
s=s.replace('    district: string | null;\n  }) => void;','    district: string | null;\n    place: string | null;\n  }) => void;',1)
s=s.replace('  const [selectedZone, setSelectedZone] = useState<SelectedZone | null>(null);','  const [selectedZone, setSelectedZone] = useState<SelectedZone | null>(null);\n  const [searchedPlace, setSearchedPlace] = useState<PlaceResult | null>(null);',1)
s=s.replace('      district: liveConditions?.district ?? null,\n    });\n  }, [mapCenter, liveConditions, onMapStateChange]);','      district: liveConditions?.district ?? null,\n      place: searchedPlace?.label ?? null,\n    });\n  }, [mapCenter, liveConditions, onMapStateChange, searchedPlace]);',1)
s=s.replace('      setLiveConditions((prev) => (prev ? { ...prev, loading: false } : prev));','      setLiveConditions({ lat, lng, loading: false, district: null, source: null, rainfall_mm: null, river_level_m: null, river_discharge_m3s: null });',1)
s=s.replace('    lastFetchedCoords.current = { lat: latitude, lng: longitude };\n    setMapCenter({ lat: latitude, lng: longitude });','    lastFetchedCoords.current = { lat: latitude, lng: longitude };\n    setSearchedPlace(null);\n    setMapCenter({ lat: latitude, lng: longitude });',1)
needle='  function handleMapClick(e: MapLayerMouseEvent) {'
repl='''  function handlePlaceSelected(place: PlaceResult) {
    clearMapSelection();
    setSearchedPlace(place);
    lastFetchedCoords.current = { lat: place.lat, lng: place.lng };
    setMapCenter({ lat: place.lat, lng: place.lng });
    void fetchLiveData(place.lat, place.lng);
  }

'''+needle
assert needle in s;s=s.replace(needle,repl,1)
s=s.replace('        {visibleLayers.floodZones && (','        {searchedPlace && (\n          <Marker longitude={searchedPlace.lng} latitude={searchedPlace.lat} anchor="bottom">\n            <MapPinMarker label={searchedPlace.label} />\n          </Marker>\n        )}\n        {visibleLayers.floodZones && (',1)
s=s.replace('      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">\n        <div className="pointer-events-auto">\n          <LocationSelector />\n        </div>\n      </div>','      <div className="pointer-events-none absolute right-4 top-4 z-20 w-[min(24rem,calc(100%-2rem))] space-y-2">\n        <div className="pointer-events-auto"><MapPlaceSearch onPlaceSelected={handlePlaceSelected} /></div>\n        <div className="pointer-events-auto"><LocationSelector /></div>\n      </div>',1)
s=s.replace('function FloodPulse() {','function MapPinMarker({ label }: { label: string }) {\n  return <span title={label} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-slate-950 shadow-xl">●</span>;\n}\n\nfunction FloodPulse() {',1)
p.write_text(s,encoding='utf-8')
p=Path('components/command-center/CommandCenterClient.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('    district: string | null;\n  }>(() => ({','    district: string | null;\n    place: string | null;\n  }>(() => ({',1)
s=s.replace('    district: settings.defaultView.focusDistrict,','    district: settings.defaultView.focusDistrict,\n    place: null,',1)
s=s.replace('    (state: { center: { lat: number; lng: number }; district: string | null }) =>','    (state: { center: { lat: number; lng: number }; district: string | null; place: string | null }) =>',1)
s=s.replace('  const focusLabel = mapState.district?.toUpperCase() ?? "GLOBAL";','  const focusLabel = (mapState.place ?? mapState.district ?? "GLOBAL").toUpperCase();',1)
p.write_text(s,encoding='utf-8')
p=Path('app/(dashboard)/map/page.tsx');s=p.read_text(encoding='utf-8').replace('import MapSearchBar from "@/components/map/MapSearchBar";\n','').replace('          <MapSearchBar className="absolute left-1/2 top-[64px] z-20 -translate-x-1/2" />\n','');p.write_text(s,encoding='utf-8')
