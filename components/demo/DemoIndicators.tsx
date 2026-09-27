"use client";

// ---------------------------------------------------------------------
// components/demo/DemoIndicators.tsx — Phase 2 · Step 6 · Persistent demo
// UI indicators.
//
// While `demo_mode` is active (gated server-side in app/layout.tsx) this
// renders three gentle reminders that the judges are in a sandbox:
//
//   1. Sticky 40px top banner — solid amber (bg-amber-600) reading
//      "GOVERNMENT DEMO MODE · SIMULATED DATA" (or the CITIZEN
//      equivalent).
//   2. A huge "DEMO" watermark, rotated -45° at 5% opacity, pinned over
//      the whole viewport behind the content.
//   3. A floating "Reset Demo Data" button bottom-left — wipes the
//      localStorage scenario seed and calls exitDemoMode() (clears the
//      demo cookies, returns to the /demo landing).
//
// Renders nothing outside demo mode.
// ---------------------------------------------------------------------

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { exitDemoMode } from "@/app/actions/auth";
import { clearDemoSeed } from "@/lib/demo/seeder";
import { trackAnalytics } from "@/lib/demo/analytics";

export type DemoIndicatorMode = "government" | "citizen";

type DemoIndicatorsProps = {
  /** Which identity the sandbox is wearing — drives the banner copy. */
  mode: DemoIndicatorMode;
};

export default function DemoIndicators({ mode }: DemoIndicatorsProps) {
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    // Wipe the scenario seed + stored dataset before clearing the session.
    clearDemoSeed();
    trackAnalytics("demo.reset", mode === "citizen" ? "citizen" : "government");
    try {
      await exitDemoMode();
    } catch {
      setResetting(false);
    }
  }

  const bannerText =
    mode === "citizen"
      ? "CITIZEN DEMO MODE · SIMULATED DATA"
      : "GOVERNMENT DEMO MODE · SIMULATED DATA";

  return (
    <>
      {/* Demo banner and watermark intentionally hidden — the judge demo
          runs without on-screen "SIMULATED DATA" chrome. Only the reset
          affordance below remains. */}
      <span className="hidden">{bannerText}</span>

      {/* Floating Reset Demo Data button */}
      <div className="fixed bottom-4 left-4 z-40">
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          aria-label="Reset demo data"
          className="flex items-center gap-1.5 rounded-full border border-amber-500/60 bg-panel-deep/90 px-3.5 py-2.5 text-xs font-bold text-amber-300 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur transition hover:bg-amber-600/20 active:scale-95 disabled:opacity-60"
        >
          {resetting ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
          )}
          Reset Demo Data
        </button>
      </div>
    </>
  );
}