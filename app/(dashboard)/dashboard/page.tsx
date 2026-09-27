// ---------------------------------------------------------------------
// app/(dashboard)/dashboard/page.tsx
// UI/UX Phase 4 · Step 2 — Command Center hero screen scaffold.
//
// Renders inside the auth-protected (dashboard) layout's DashboardShell
// and uses the new Command Center DashboardLayout (sticky header + district
// context). The 12-column responsive grid (`xl:grid-cols-12`) hosts the
// staggered dashboard widgets (UI/UX Phase 8 · Step 2).
// ---------------------------------------------------------------------

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import HeroKPIs from "@/components/dashboard/HeroKPIs";
import LiveMapWidget from "@/components/dashboard/LiveMapWidget";
import AlertFeedWidget from "@/components/dashboard/AlertFeedWidget";
import AIPlannerWidget from "@/components/dashboard/AIPlannerWidget";
import ResponderStatusBoard from "@/components/dashboard/ResponderStatusBoard";
import FloodPredictionChart from "@/components/dashboard/FloodPredictionChart";
import ResourceDonutChart from "@/components/dashboard/ResourceDonutChart";
import GlobalWorldMap from "@/components/dashboard/GlobalWorldMap";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <section className="p-4 sm:p-6">
        <h1 className="text-xl font-bold text-primary sm:text-2xl">
          Command Center Overview
        </h1>
        <p className="mt-1 text-sm text-muted">
          Live situational awareness across all active districts.
        </p>

        {/* Staggered widget grid — 1 col on mobile, 2 on tablet, 12 × on lg+.
            Column counts are overridden to 12 at lg/xl so the col-span-*
            classes below always match the real track count (mismatched spans
            force implicit grid tracks and break card alignment). */}
        <DashboardGrid
          items={[
            { key: "kpis", className: "lg:col-span-12", children: <HeroKPIs /> },
            {
              key: "map",
              className: "md:col-span-2 lg:col-span-8 lg:row-span-2",
              children: <LiveMapWidget />,
            },
            {
              key: "alerts",
              className: "md:col-span-2 lg:col-span-4 lg:row-span-2",
              children: <AlertFeedWidget />,
            },
            {
              key: "planner",
              className: "md:col-span-2 lg:col-span-4",
              children: <AIPlannerWidget />,
            },
            {
              key: "responders",
              className: "md:col-span-2 lg:col-span-8",
              children: <ResponderStatusBoard />,
            },
            {
              key: "flood",
              className: "md:col-span-2 lg:col-span-8",
              children: <FloodPredictionChart />,
            },
            {
              key: "donut",
              className: "md:col-span-2 lg:col-span-4",
              children: <ResourceDonutChart />,
            },
          ]}
        />

        {/* ── Global Flood Response world map (Phase 2) ──────────── */}
        <GlobalWorldMap />
      </section>
    </DashboardLayout>
  );
}
