"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Satellite, Settings2 } from "lucide-react";
import { normalizeSatelliteEvents, type SatelliteEvent } from "@/lib/satellite/events";

const SatelliteMap = dynamic(() => import("./SatelliteMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-400">Loading satellite imagery…</div>,
});

export default function SatelliteWorkspace() {
  const [date, setDate] = useState("");
  const [events, setEvents] = useState<SatelliteEvent[]>([]);
  const [selected, setSelected] = useState<SatelliteEvent | null>(null);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState("");

  useEffect(() => {
    // MODIS daily imagery can arrive after the observation day.
    setDate(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10));
  }, []);

  async function refresh(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/integrations?source=events", { signal, cache: "no-store" });
      const data = (await response.json()) as { events?: unknown; fetchedAt?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "NASA event feed unavailable.");
      setEvents(normalizeSatelliteEvents(data));
      setFetchedAt(data.fetchedAt ?? new Date().toISOString());
    } catch (cause) {
      if (signal?.aborted) return;
      setEvents([]);
      setError(cause instanceof Error ? cause.message : "NASA event feed unavailable.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, []);

  const categories = useMemo(() => Array.from(new Set(events.map((event) => event.category))).sort(), [events]);
  const visibleEvents = category === "all" ? events : events.filter((event) => event.category === category);

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-5 p-4 pb-20 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-300"><Satellite className="h-4 w-4" /> Intelligence / Earth observation</p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Satellite &amp; Ground Truth</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Explore NASA MODIS true-colour imagery and recent NASA EONET events. Imagery is dated and may lag; event markers are observations, not verified local alerts.</p>
        </div>
        <Link href="/settings/integrations" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm text-slate-200 hover:border-sky-400"><Settings2 className="h-4 w-4" /> Integration settings</Link>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
        <label className="text-xs font-semibold text-slate-300">Imagery date
          <input type="date" value={date} max={new Date(Date.now() - 86400000).toISOString().slice(0, 10)} min="2000-01-01" onChange={(event) => setDate(event.target.value)} className="mt-1 block min-h-11 rounded-md border border-border bg-slate-950 px-3 text-sm text-white" />
        </label>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-200 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh events</button>
        <p className="text-xs text-slate-400">Imagery: NASA GIBS · Events: NASA EONET{fetchedAt ? ` · fetched ${new Date(fetchedAt).toLocaleString()}` : ""}</p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Satellite imagery map" className="min-w-0 overflow-hidden rounded-xl border border-border bg-slate-950">
          <div className="relative h-[52vh] min-h-[360px] max-h-[680px] sm:h-[65vh]">
            {date ? <SatelliteMap date={date} events={visibleEvents} selected={selected} onSelect={setSelected} /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Preparing imagery…</div>}
          </div>
          <p className="border-t border-border px-3 py-2 text-xs text-slate-400">NASA MODIS daily mosaic · up to zoom level 8 · image acquisition and tile availability vary by place/date. Map markers show reported EONET event locations.</p>
        </section>
        <aside className="min-w-0 space-y-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">Recent natural events</h2>
            <p className="mt-1 text-xs text-slate-400">{loading ? "Loading NASA feed…" : `${visibleEvents.length} mapped of ${events.length} fetched events`}</p>
            <label className="mt-3 block text-xs text-slate-300">Category
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 min-h-10 w-full rounded-md border border-border bg-slate-950 px-2 text-sm text-white">
                <option value="all">All categories</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            {error && <p role="alert" className="mt-3 text-sm text-amber-300">{error}</p>}
            {!loading && !error && visibleEvents.length === 0 && <p className="mt-3 text-sm text-slate-400">No mapped events in this selection.</p>}
            <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {visibleEvents.map((event) => <li key={event.id}><button type="button" onClick={() => setSelected(event)} className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-white/10 ${selected?.id === event.id ? "bg-sky-500/15 text-sky-200" : "text-slate-200"}`}><span className="block font-medium">{event.title}</span><span className="block text-xs text-slate-400">{event.category} · {event.observedAt ? new Date(event.observedAt).toLocaleDateString() : "Date unavailable"}</span></button></li>)}
            </ul>
          </div>
          {selected && <section aria-label="Selected event details" className="rounded-xl border border-sky-500/30 bg-surface p-4">
            <h2 className="font-semibold text-sky-200">{selected.title}</h2>
            <dl className="mt-3 space-y-1 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-400">Category</dt><dd>{selected.category}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-400">Observed</dt><dd>{selected.observedAt ? new Date(selected.observedAt).toLocaleString() : "Unknown"}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-400">Coordinates</dt><dd>{selected.lat.toFixed(3)}, {selected.lng.toFixed(3)}</dd></div></dl>
            {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-sky-300 underline">Open source report</a>}
          </section>}
        </aside>
      </div>
    </main>
  );
}
