"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloudRain, RefreshCw, Waves } from "lucide-react";

type Outlook = {
  district: string;
  generatedAt: string;
  source: { rainfall: string; river: string };
  recent: { rainfall72h: number; riverMaximum: number | null };
  outlook: Array<{
    day: string;
    rain24h: number;
    rain72h: number;
    riverDischarge: number | null;
    score: number;
    risk: string;
    reasons: string[];
  }>;
  limitations: string;
};
const DISTRICTS = ["Patna", "Bhagalpur", "Gaya", "Muzaffarpur", "Darbhanga"];
const riskTone: Record<string, string> = {
  low: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  watch: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  high: "text-orange-300 border-orange-500/40 bg-orange-500/10",
  severe: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};

export default function PredictionsPage() {
  const [district, setDistrict] = useState("Patna");
  const [data, setData] = useState<Outlook | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/predictions/outlook?district=${encodeURIComponent(district)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Forecast unavailable");
        return payload as Outlook;
      })
      .then(setData)
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(cause instanceof Error ? cause.message : "Forecast unavailable");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [district, refresh]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-slate-100 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
            SafeSphere · Forecast intelligence
          </p>
          <h1 className="mt-2 text-3xl font-bold">Future flood outlook</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Five-day rainfall and river outlook, compared with the previous week of
            conditions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-sm text-slate-300">
            District
            <select
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              className="ml-2 rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-white"
            >
              {DISTRICTS.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/50 px-3 py-2 text-sm text-cyan-300"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>
      {loading && (
        <p role="status" className="mt-8 text-slate-300">
          Loading weather and river forecasts…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-rose-200"
        >
          {error}
        </p>
      )}
      {data && !loading && (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
              <CloudRain className="h-5 w-5 text-cyan-300" />
              <p className="mt-3 text-sm text-slate-400">
                Modelled rain in previous 72 hours
              </p>
              <strong className="text-2xl">
                {data.recent.rainfall72h.toFixed(1)} mm
              </strong>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
              <Waves className="h-5 w-5 text-cyan-300" />
              <p className="mt-3 text-sm text-slate-400">Recent modelled river peak</p>
              <strong className="text-2xl">
                {data.recent.riverMaximum === null
                  ? "Unavailable"
                  : `${data.recent.riverMaximum.toFixed(1)} m³/s`}
              </strong>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Updated</p>
              <strong className="mt-3 block text-lg">
                {new Date(data.generatedAt).toLocaleString()}
              </strong>
              <p className="mt-2 text-xs text-slate-400">
                Forecast refreshes about every 30 minutes.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {data.outlook.map((day) => (
              <article
                key={day.day}
                className="rounded-xl border border-white/10 bg-slate-900 p-5"
              >
                <p className="text-sm font-semibold">
                  {new Date(`${day.day}T12:00:00+05:30`).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${riskTone[day.risk] ?? riskTone.watch}`}
                >
                  {day.risk} · {day.score}/100
                </span>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-cyan-400"
                    style={{ width: `${day.score}%` }}
                  />
                </div>
                <p className="mt-4 text-sm">
                  Forecast rain: <strong>{day.rain24h.toFixed(1)} mm</strong>
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Next 72h: {day.rain72h.toFixed(1)} mm
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  River:{" "}
                  {day.riverDischarge === null
                    ? "No reading"
                    : `${day.riverDischarge.toFixed(1)} m³/s`}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-sm text-slate-400">
            Sources: {data.source.rainfall}; river: {data.source.river}.{" "}
            {data.limitations}
          </p>
          <Link
            href="/gov/map"
            className="mt-5 inline-block rounded-lg border border-cyan-400/50 px-4 py-2 text-sm text-cyan-300"
          >
            Open operational map →
          </Link>
        </>
      )}
    </main>
  );
}
