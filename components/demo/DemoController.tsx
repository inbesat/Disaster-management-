"use client";

// ---------------------------------------------------------------------
// components/demo/DemoController.tsx
// UI/UX Phase 10 · Step 4 — secret demo controller.
//
// Hidden pitch-day tool: when the URL carries ?demo=1, a persistent,
// semi-transparent control bar pins to the bottom of the screen with a
// "DEMO MODE ACTIVE" watermark and three scenario buttons. Each button
// currently fires a roadmap toast + console.log to prove it intercepts
// state — the real wiring (inject flood spike / clear shelters / drain
// inventory) lands in a later step by replacing the handler bodies.
//
//   • Gate — reads ?demo=1 from the URL (client-side only, so SSR and the
//     first client paint agree on "hidden", avoiding hydration mismatch).
//   • Styling — dark translucent slab above everything (z-9999). The
//     emoji button labels are kept verbatim per the spec — this is a
//     hidden dev tool, matching the field components' emoji-in-string
//     precedent rather than the design system's no-emoji rule.
//   • Mount once at the app root (e.g. app/layout.tsx) — the component
//     renders nothing unless the query param is present.
// ---------------------------------------------------------------------

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import useToast from "@/hooks/useToast";

type DemoControllerProps = {
  className?: string;
};

/** One scenario button — edit this table to wire real state later. */
type Scenario = {
  key: string;
  emoji: string;
  label: string;
  /** Roadmap toast tone — the `tone` method on useToast(). */
  tone: "success" | "warning" | "error" | "info";
  toastTitle: string;
  toastDescription: string;
  /** Border/text tint classes for the pill. */
  pillClass: string;
};

const SCENARIOS: Scenario[] = [
  {
    key: "critical-flood",
    emoji: "💥",
    label: "Trigger Critical Flood",
    tone: "error",
    toastTitle: "Critical Flood Triggered",
    toastDescription: "Water-level spike injected into the map + KPI stream.",
    pillClass: "border-red-500/50 bg-red-500/10 text-red-200 hover:bg-red-500/20",
  },
  {
    key: "evacuation",
    emoji: "✅",
    label: "Complete Evacuation",
    tone: "success",
    toastTitle: "Evacuation Completed",
    toastDescription: "All shelters reporting clear — residents relocated.",
    pillClass:
      "border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
  },
  {
    key: "deplete-resources",
    emoji: "⚠️",
    label: "Deplete Resources",
    tone: "warning",
    toastTitle: "Resources Depleted",
    toastDescription: "Inventory levels dropped — shortages now visible.",
    pillClass: "border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20",
  },
];

export function DemoController({ className = "" }: DemoControllerProps) {
  const [enabled, setEnabled] = useState(false);
  const pathname = usePathname();
  const toast = useToast();

  // Read ?demo=1. Starts false on both server and first client paint (no
  // hydration mismatch), and re-reads on every route change — the App
  // Router doesn't remount the root layout on client-side navigation, so a
  // plain mount-only read would miss param changes while navigating.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabled(new URLSearchParams(window.location.search).get("demo") === "1");
  }, [pathname]);

  if (!enabled) return null;

  const fire = (scenario: Scenario) => {
    console.log(`[demo-controller] ${scenario.label}`);
    toast[scenario.tone]({
      title: scenario.toastTitle,
      description: scenario.toastDescription,
    });
  };

  return (
    <div
      role="region"
      aria-label="Demo controller"
      className={`fixed inset-x-0 bottom-0 z-[9999] flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-t border-white/10 bg-black/70 px-3 py-1.5 backdrop-blur-sm ${className}`}
    >
      {SCENARIOS.map((scenario) => (
        <button
          key={scenario.key}
          type="button"
          onClick={() => fire(scenario)}
          className={`flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition active:scale-95 ${scenario.pillClass}`}
        >
          <span aria-hidden>{scenario.emoji}</span>
          {scenario.label}
        </button>
      ))}
    </div>
  );
}

export default DemoController;
