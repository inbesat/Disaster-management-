"use client";

// ---------------------------------------------------------------------
// components/demo/DemoIndicators.tsx — Phase 2 · Step 6 · Persistent demo
// UI indicators.
//
// Provides the scenario reset control while `demo_mode` is active.
// The full-width banner and viewport watermark are deliberately absent.
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
  /** Identity used when recording a scenario reset. */
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

  return (
    <>
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
