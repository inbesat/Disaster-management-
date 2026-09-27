export type PlaceResult = {
  id: string;
  label: string;
  address: string | null;
  kind: string | null;
  lat: number;
  lng: number;
};

type RawPlace = {
  title?: unknown;
  address?: unknown;
  type?: unknown;
  data_id?: unknown;
  place_id?: unknown;
  gps_coordinates?: { latitude?: unknown; longitude?: unknown };
};

/** Keep only places with real, valid coordinates supplied by the provider. */
export function normalizePlaces(payload: unknown, limit = 6): PlaceResult[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as { place_results?: RawPlace | RawPlace[]; local_results?: RawPlace[] };
  const individual = Array.isArray(data.place_results)
    ? data.place_results
    : data.place_results
      ? [data.place_results]
      : [];
  const rows = [...individual, ...(Array.isArray(data.local_results) ? data.local_results : [])];
  const seen = new Set<string>();
  const places: PlaceResult[] = [];
  for (const row of rows) {
    const rawLat = row.gps_coordinates?.latitude;
    const rawLng = row.gps_coordinates?.longitude;
    if (rawLat == null || rawLng == null) continue;
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    const label = typeof row.title === "string" ? row.title.trim() : "";
    if (!label || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const id = typeof row.data_id === "string" ? row.data_id : typeof row.place_id === "string" ? row.place_id : `${label}:${lat}:${lng}`;
    if (seen.has(id)) continue;
    seen.add(id);
    places.push({
      id,
      label,
      address: typeof row.address === "string" ? row.address : null,
      kind: typeof row.type === "string" ? row.type : null,
      lat,
      lng,
    });
    if (places.length >= limit) break;
  }
  return places;
}

export function coordinatesFromQuery(query: string): PlaceResult | null {
  const match = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { id: `coordinates:${lat}:${lng}`, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, address: null, kind: "Coordinates", lat, lng };
}
