"use client";

import { useState, type FormEvent } from "react";
import { MapPin, Search } from "lucide-react";
import { useMap } from "react-map-gl/maplibre";
import { coordinatesFromQuery, type PlaceResult } from "@/lib/map/place-search";

type Props = { onPlaceSelected: (place: PlaceResult) => void };

export default function MapPlaceSearch({ onPlaceSelected }: Props) {
  const map = useMap().default;
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
