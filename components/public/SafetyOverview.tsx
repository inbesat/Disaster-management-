"use client";

// ---------------------------------------------------------------------
// components/public/SafetyOverview.tsx — Phase 2 · Steps 2–5 · citizen
// safety stack.
//
// Single client island so the server-rendered dashboard page can host
// the client-only safety widgets. Calls useSafetyStatus() ONCE and feeds
// the result into the three stacked cards:
//
//   1. SafetyHero       — massive status card (Step 2)
//   2. ActionCard       — contextual "what to do next" (Step 4)
//   3. WeatherCarousel  — 3-day forecast (Step 5)
//
// Server pages just mount <SafetyOverview />; no prop-threading needed.
// ---------------------------------------------------------------------

import SafetyHero from "@/components/public/SafetyHero";
import ActionCard from "@/components/public/ActionCard";
import WeatherCarousel from "@/components/public/WeatherCarousel";
import { useSafetyStatus } from "@/hooks/useSafetyStatus";
import { TriangleAlert } from "lucide-react";

export function SafetyOverview({ demoDataEnabled = false }: { demoDataEnabled?: boolean }) {
  const { status, area, updatedAt } = useSafetyStatus();

  return (
    <div className="space-y-4">
      {demoDataEnabled ? (
        <>
          <p role="status" className="rounded-xl border border-amber-400/50 bg-amber-950/40 p-3 text-sm font-semibold text-amber-100">Demo hazard status based on sample zones; not an official warning.</p>
          <SafetyHero status={status} area={area} updatedAt={updatedAt} />
          <ActionCard status={status} />
        </>
      ) : (
        <section role="status" aria-label="Safety status unverified" className="flex min-h-[35vh] flex-col justify-center rounded-[2rem] border border-amber-400/50 bg-gradient-to-br from-amber-900/30 to-[#0a0f1a] p-6 text-white">
          <TriangleAlert aria-hidden="true" className="h-10 w-10 text-amber-300" />
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-amber-200">Current status · Unverified</p>
          <h2 className="mt-2 text-3xl font-black">Safety status unavailable</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-200">Live local hazard information is not connected. This app cannot confirm that your area is safe. Follow official local alerts and emergency instructions.</p>
        </section>
      )}
      <WeatherCarousel />
    </div>
  );
}

export default SafetyOverview;
