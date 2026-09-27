"use client";

// Three-day forecast from live weather data. When unavailable, state it
// plainly instead of rendering invented conditions or zero temperatures.

import { useEffect, useMemo, useRef, useState } from "react";
import { CloudLightning, CloudRain, CloudSun, Sun, type LucideIcon } from "lucide-react";
import SeverityBadge from "@/components/ui/SeverityBadge";
import type { SeverityLevel } from "@/components/ui/SeverityBadge";
import type { ForecastDay } from "@/app/api/weather/forecast/route";

type CarouselCard = {
  day: string;
  date: string;
  icon: LucideIcon;
  temp: number;
  rain: number;
  risk: SeverityLevel;
  riskLabel: string;
};

const PATNA = { lat: 25.5941, lng: 85.1376 };

const CONDITION_ICON: Record<ForecastDay["condition"], LucideIcon> = {
  storm: CloudLightning,
  rain: CloudRain,
  clouds: CloudSun,
  clear: Sun,
};

function riskFor(rain: number, condition: ForecastDay["condition"]): { risk: SeverityLevel; riskLabel: string } {
  if (condition === "storm" || rain >= 100) return { risk: "warning", riskLabel: "Heavy rain" };
  if (rain >= 20) return { risk: "watch", riskLabel: "Light rain" };
  return { risk: "safe", riskLabel: "Dry" };
}

/** "2026-08-24" → "24 Aug" */
function shortDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function WeatherCarousel() {
  const [cards, setCards] = useState<CarouselCard[] | null>(null); // null = loading
  const [live, setLive] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/weather/forecast?lat=${PATNA.lat}&lng=${PATNA.lng}`,
          { signal: AbortSignal.timeout(12_000) },
        );
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          source?: string;
          days?: ForecastDay[];
        };
        if (cancelled) return;
        if (!body.ok || !Array.isArray(body.days) || body.days.length === 0) throw new Error("bad payload");
        setCards(
          body.days.map((d, i) => ({
            day: i === 0 ? "Today" : i === 1 ? "Tomorrow" : "Day 3",
            date: shortDate(d.date),
            icon: CONDITION_ICON[d.condition] ?? CloudSun,
            temp: Math.round(d.tempHigh),
            rain: d.rainTotal,
            ...riskFor(d.rainTotal, d.condition),
          })),
        );
        setLive(body.source === "openweathermap");
      } catch {
        if (!cancelled) {
          setCards([]);
          setLive(false);
        }
      }
    }
    void load();
    // Refresh every 30 min while mounted.
    timerRef.current = window.setInterval(() => void load(), 30 * 60_000);
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heading = useMemo(
    () => (
      <div className="flex items-center justify-between gap-2 px-4">
        <p className="eoc-label text-[var(--dl-text-muted)]">3-DAY OUTLOOK</p>
        {cards !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider ${
              live
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-white/5 text-slate-400"
            }`}
          >
            <span
              className={`h-1 w-1 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-slate-500"}`}
              aria-hidden
            />
            {live ? "Live · OpenWeatherMap" : "Unavailable"}
          </span>
        )}
      </div>
    ),
    [cards, live],
  );

  return (
    <section aria-label="3-day weather and flood forecast">
      {heading}
      {/* Hide scrollbars: Firefox [scrollbar-width:none] + WebKit pseudo */}
      <div
        id="citizen-weather-carousel"
        className="-mx-4 mt-1 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards?.length === 0 && (
          <div role="status" className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Live forecast is unavailable. Check local weather advisories before travelling.
          </div>
        )}
        {(cards ?? [null, null, null]).map((day, i) => (
          <article
            key={day ? `${day.day}-${day.date}` : `skeleton-${i}`}
            className="w-[78%] max-w-[320px] shrink-0 snap-center rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]"
          >
            {!day ? (
              /* Loading skeleton */
              <div className="animate-pulse space-y-3" aria-hidden>
                <div className="flex items-center justify-between">
                  <span className="h-4 w-20 rounded bg-white/10" />
                  <span className="h-5 w-16 rounded-full bg-white/10" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="h-12 w-12 rounded-2xl bg-white/10" />
                  <span className="h-9 w-20 rounded bg-white/10" />
                </div>
                <span className="sr-only">Loading forecast…</span>
              </div>
            ) : (
              <>
                {/* Day label + risk badge */}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-white">{day.day}</p>
                    <p className="text-[0.6875rem] text-[var(--dl-text-muted)]">{day.date}</p>
                  </div>
                  <SeverityBadge variant={day.risk} label={day.riskLabel} size="sm" />
                </div>

                {/* Weather icon + temperature */}
                <div className="mt-3 flex items-center justify-between">
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sky-300 shadow-[0_4px_20px_rgba(59,130,246,0.3)] ring-1 ring-white/10 backdrop-blur-md"
                  >
                    <day.icon className="h-7 w-7" strokeWidth={1.5} />
                  </span>
                  <div className="text-right">
                    <p className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-3xl font-bold tabular-nums text-transparent">
                      {day.temp}
                      <span className="text-lg text-[var(--dl-text-muted)]">°C</span>
                    </p>
                    <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--dl-text-muted)]">
                      {day.rain > 0 ? `${day.rain}mm rain` : "No rain"}
                    </p>
                  </div>
                </div>
              </>
            )}
          </article>
        ))}
      </div>

      {/* Carousel hint */}
      <p className="mt-1 text-center text-[0.6875rem] text-[var(--dl-text-muted)]">
        {cards?.length ? "Swipe for the 3-day outlook" : ""}
      </p>
    </section>
  );
}

export default WeatherCarousel;