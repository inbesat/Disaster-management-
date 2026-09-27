import { cookies } from "next/headers";
import { ShieldCheck } from "lucide-react";
import ViewAsPublicToggle from "@/components/gov/ViewAsPublicToggle";
import SituationHeader from "@/components/gov/dashboard/SituationHeader";
import HeroKPIRow from "@/components/gov/dashboard/HeroKPIRow";
import LiveMapWidget from "@/components/gov/dashboard/LiveMapWidget";
import FloodChartWidget from "@/components/gov/dashboard/FloodChartWidget";
import AlertFeedWidget from "@/components/gov/dashboard/AlertFeedWidget";
import CrowdReportsWidget from "@/components/gov/dashboard/CrowdReportsWidget";
import ShelterStatusWidget from "@/components/gov/dashboard/ShelterStatusWidget";
import ResourceWidget from "@/components/gov/dashboard/ResourceWidget";
import ResponderTracker from "@/components/gov/dashboard/ResponderTracker";
import AISuggestionsWidget from "@/components/gov/dashboard/AISuggestionsWidget";
import { prisma } from "@/server/prisma";
import { resolveDemoScope } from "@/lib/demo/scope";

// ---------------------------------------------------------------------
// app/gov/dashboard/page.tsx — Phase 7 · Steps 1–4 · Gov Command Center
// Dashboard.
//
// The government command center: an information-dense, dark-themed
// (#0a0f1a = --bg-primary) tactical workspace. The SituationHeader
// (Step 2) pins a persistent top bar with the district selector, the four
// pulsing mini-stat counters and the blinking sync line; underneath it,
// everything rides in a MASSIVE responsive CSS grid:
//
//     grid-cols-1 → md:grid-cols-2 → lg:grid-cols-4 · gap-4 · p-4
//
// Primary widgets (Steps 3–6), laid out at lg:grid-cols-4. The container
// uses grid-flow-dense so the row-spanning widgets leave no holes:
//   • Live Operations Map     — col-span-2 · row-span-2 (tactical canvas)
//   • Incoming Alerts         — col-span-1 · row-span-2 (scrolling feed)
//   • Crowdsourced Reports    — col-span-1 · row-span-1 (verify/reject)
//   • 72-h River Forecast     — col-span-2 · row-span-1 (Recharts area)
//   • Shelter Status / Resource / Responder / AI Suggestion — 1×1 cells
// plus three baseline stat cells. The View-as-Public toggle (Phase 1 ·
// Step 10) stays mounted so officials can preview the citizen app with
// one switch.
// ---------------------------------------------------------------------

/** Baseline stat cells filling the remaining grid slots. The last one
    spans the full row on md (3 stats + 2-col grid = 1 orphan otherwise). */
const STAT_CELLS: Array<{
  label: string;
  value: string;
  tone: string;
  mdFull?: boolean;
}> = [
  { label: "Active Events", value: "3", tone: "text-red-300" },
  { label: "People at Risk", value: "12,480", tone: "text-amber-300" },
  { label: "Casualties / Injured", value: "42 / 128", tone: "text-red-400" },
  { label: "Reported Missing", value: "14", tone: "text-orange-300" },
];

export default async function GovDashboardPage() {
  // Reflect a still-active preview session if the official navigates back
  // here mid-preview (middleware allows gov users with view_as_public on
  // /gov/*), so the toggle never lies about the current state.
  const previewing = cookies().get("view_as_public")?.value === "true";
  const scope = resolveDemoScope();
  let teamStats: { ngos: string; available: string } = {
    ngos: "Unavailable",
    available: "Unavailable",
  };
  try {
    const profiles = await prisma.responderProfile.findMany({
      where: {
        approvalStatus: "approved",
        ...(scope.demo
          ? { id: `demo:${scope.sessionId}` }
          : { NOT: { id: { startsWith: "demo:" } } }),
      },
      select: { organizationType: true, availability: true },
    });
    teamStats = {
      ngos: String(
        profiles.filter(
          (profile) =>
            profile.organizationType === "ngo" && profile.availability === "available",
        ).length,
      ),
      available: String(
        profiles.filter((profile) => profile.availability === "available").length,
      ),
    };
  } catch {
    /* Show unavailable rather than a fabricated live count. */
  }

  return (
    <main id="main-content" className="min-h-screen bg-primary text-foreground">
      {/* Phase 7 · Step 2 — persistent situation-awareness top bar. */}
      <SituationHeader />

      <div className="mx-auto w-full max-w-[1720px]">
        {/* Page title strip */}
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-6 sm:px-6">
          <div>
            <p className="eoc-label text-blue-400">BIHAR · OPERATIONAL OVERVIEW · LIVE</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">
              District Command Overview
            </h1>
          </div>

          {/* View-as-Public toggle (Phase 1 · Step 10) */}
          <div className="w-full max-w-sm">
            <ViewAsPublicToggle initialActive={previewing} />
          </div>
        </div>

        {/* Hero KPI row — 4 stat cards with count-up animations */}
        <div className="px-4 sm:px-6">
          <HeroKPIRow />
        </div>

        {/* MASSIVE responsive grid — 1 / 2 / 4 columns, dense packing so
            the row-spanning widgets leave no holes. */}
        <div className="grid grid-flow-dense grid-cols-1 gap-4 p-4 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Step 3 — Live Operations Map: spans 2 cols × 2 rows. */}
          <div className="md:col-span-2 lg:col-span-2 lg:row-span-2">
            <LiveMapWidget />
          </div>

          {/* Step 4 — Incoming system alerts: 1 col × 2 rows. */}
          <div className="lg:row-span-2">
            <AlertFeedWidget />
          </div>

          {/* Step 4 — Crowdsourced reports: 1 col × 1 row. */}
          <div>
            <CrowdReportsWidget />
          </div>

          {/* Step 3 — 72-hour flood forecast: spans 2 cols. */}
          <div className="md:col-span-2 lg:col-span-2">
            <FloodChartWidget />
          </div>

          {/* Step 5 — Shelter status: occupancy bars (1×1). */}
          <div>
            <ShelterStatusWidget />
          </div>

          {/* Step 5 — Resource inventory donut + low-stock (1×1). */}
          <div>
            <ResourceWidget />
          </div>

          {/* Step 6 — Field responder tracker (1×1). */}
          <div>
            <ResponderTracker />
          </div>

          {/* Step 6 — AI suggestion with glowing purple border (1×1). */}
          <div>
            <AISuggestionsWidget />
          </div>

          {/* Baseline stat cells filling the remaining slots. */}
          {[
            ...STAT_CELLS,
            { label: "Active NGOs", value: teamStats.ngos, tone: "text-sky-300" },
            {
              label: "Responders Available",
              value: teamStats.available,
              tone: "text-emerald-300",
              mdFull: true,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`flex min-h-[150px] flex-col justify-between rounded-xl border border-white/10 bg-[#111827] p-5 backdrop-blur transition hover:border-white/20 ${
                stat.mdFull ? "md:col-span-2 lg:col-span-1" : ""
              }`}
            >
              <p className="eoc-label text-slate-400">{stat.label}</p>
              <p className={`font-mono text-3xl font-bold ${stat.tone}`}>{stat.value}</p>
              <p className="text-xs text-slate-500">
                {stat.label.includes("NGO") || stat.label.includes("Responders")
                  ? "Field portal records"
                  : "Overview estimate"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-5">
        <p className="flex items-center justify-center gap-2 px-4 text-center text-xs text-slate-500">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-blue-400" />
          Authorized personnel only · All access is logged &amp; audited
        </p>
      </footer>
    </main>
  );
}
