export type SatelliteEvent = {
  id: string;
  title: string;
  category: string;
  observedAt: string;
  lat: number;
  lng: number;
  sourceUrl: string | null;
};

/** EONET events may have several geometries; the newest point locates the marker. */
export function normalizeSatelliteEvents(payload: unknown): SatelliteEvent[] {
  if (!payload || typeof payload !== "object") return [];
  const events = (payload as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  const output: SatelliteEvent[] = [];
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const event = raw as Record<string, unknown>;
    const points = Array.isArray(event.geometry)
      ? event.geometry.filter((item) => item && typeof item === "object" && (item as { type?: string }).type === "Point")
      : [];
    const latest = points[points.length - 1] as { coordinates?: unknown; date?: unknown } | undefined;
    const coords = latest?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const id = typeof event.id === "string" ? event.id : "";
    const title = typeof event.title === "string" ? event.title : "";
    if (!id || !title) continue;
    const categories = Array.isArray(event.categories) ? event.categories : [];
    const category = typeof categories[0]?.title === "string" ? categories[0].title : "Natural event";
    const sources = Array.isArray(event.sources) ? event.sources : [];
    const url = typeof sources[0]?.url === "string" && /^https:\/\//i.test(sources[0].url) ? sources[0].url : null;
    output.push({ id, title, category, observedAt: typeof latest?.date === "string" ? latest.date : "", lat, lng, sourceUrl: url });
  }
  return output;
}
