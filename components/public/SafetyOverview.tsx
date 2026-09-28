"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WeatherCarousel from "./WeatherCarousel";
import { PUBLIC_DISTRICTS, coordinates, locationQuery, savedPublicLocation, type PublicLocation } from "@/lib/public-safety/location";
import type { SafetyContext } from "@/lib/public-safety/context";

export function SafetyOverview() {
  const [location, setLocation] = useState<PublicLocation>({ district: "Patna" });
  const [data, setData] = useState<SafetyContext | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { const saved = savedPublicLocation(); if (saved) setLocation(saved); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    async function load() {
      try {
        const response = await fetch(`/api/public/safety?${locationQuery(location)}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (!controller.signal.aborted) setData(body);
      } catch {
        if (!controller.signal.aborted) setError("Local outlook could not be loaded. Try refreshing.");
      }
    }
    void load();
    const timer = setInterval(() => setRefresh((value) => value + 1), 30 * 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [location, refresh]);
  const { lat, lng } = coordinates(location);
  const elevated = data && ["HIGH", "CRITICAL"].includes(data.risk);
  return <div className="space-y-4">
    <section aria-label="Local safety outlook" className={`rounded-[2rem] border p-6 text-white ${elevated ? "border-red-400/60 bg-red-950/30" : "border-sky-400/40 bg-slate-950/40"}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm font-semibold">Outlook location
          <select aria-label="Outlook location" value={location.district} onChange={(event) => setLocation({ district: event.target.value as PublicLocation["district"] })} className="ml-3 rounded-lg border border-white/20 bg-slate-900 p-2">
            {Object.keys(PUBLIC_DISTRICTS).map((district) => <option key={district}>{district}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setRefresh((value) => value + 1)} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Refresh outlook</button>
      </div>
      <p className="mt-3 text-xs text-slate-300">{location.lat !== undefined ? `Saved GPS position: ${lat.toFixed(3)}, ${lng.toFixed(3)}; district selector is approximate.` : `District centre: ${location.district}. Set your exact location for more local information.`} <Link href="/public/setup/location" className="underline">Set location</Link></p>
      <div role="status" aria-live="polite">
        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-sky-200">Three-day screening outlook · {data?.risk ?? (error ? "Unavailable" : "Loading")}</p>
        <h2 className="mt-2 text-3xl font-black">{data?.risk === "UNKNOWN" ? "Local data needs confirmation" : data ? `${data.risk === "LOW" ? "Lower" : data.risk === "WATCH" ? "Watch" : data.risk === "HIGH" ? "High" : "Critical"} risk signals for your area` : error || "Checking local conditions…"}</h2>
      </div>
      {data && <>
        <p className="mt-3 text-sm text-slate-200">{elevated ? "Prepare your household and follow official evacuation instructions. If there is immediate danger, seek emergency help." : "Keep your household prepared and follow local advisories. A lower forecast risk does not confirm your area is safe."}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {data.forecast?.days.map((day) => <article key={day.day} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="font-semibold">{day.day}</p><p className="mt-1 text-sm">{day.rain24h.toFixed(1)} mm rain · {day.risk.toUpperCase()}</p>
          </article>)}
        </div>
        <p className="mt-4 text-xs text-sky-200">Weather: {data.availability.weather ? data.forecast?.source : "unavailable"} · Verified local reports: {data.availability.verifiedReports ? data.reports.length : "feed unavailable"}</p>
        <p className="mt-2 text-xs text-slate-300">Updated {new Date(data.generatedAt).toLocaleString("en-IN")}. {data.limitations.join(" ")}</p>
      </>}
      <Link href={`/public/ai?district=${location.district}`} className="mt-5 inline-flex rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950">Build my household safety plan →</Link>
    </section>
    <WeatherCarousel lat={lat} lng={lng} />
  </div>;
}
export default SafetyOverview;

