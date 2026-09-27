"use client";

// ---------------------------------------------------------------------
// components/demo/DemoMode.tsx — Phase 12 · Demo Mode controls
//
// The floating "Demo Controls" panel shown during the live pitch. Toggled
// on from settings ("Demo Mode"), it mounts app-wide and lets the presenter
// rehearse the exact failure scenarios a judge might ask about:
//
//   • Simulate Offline         → drops the connectivity monitor (orange bar)
//   • Simulate Low Battery     → 15% charge, background sync pauses
//   • Clear All Cache          → wipes IDB + Cache Storage + drip keys
//   • Corrupt Model            → deletes half the model chunks (re-download)
//   • Reset to First-Time User → clears everything, routes to onboarding
//
// Styling follows the spec: dark theme, danger-red accents, a red-bordered
// floating panel and a diagonal "DEMO MODE" watermark over the whole app.
// ---------------------------------------------------------------------

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BatteryLow,
  Eraser,
  Loader2,
  MonitorOff,
  RotateCcw,
  ShieldX,
  X,
} from "lucide-react";
import {
  clearAllCache,
  corruptModel,
  isDemoModeEnabled,
  isOfflineSimulated,
  resetToFirstTimeUser,
  restoreBattery,
  restoreNetwork,
  simulateLowBattery,
  simulateOffline,
} from "@/lib/demo/scenarios";
import { getDemoMode, trackAnalytics } from "@/lib/demo/analytics";
import { showToast } from "@/components/ui/Toast";

type DemoButtonState = { offline: boolean; battery: boolean };
const IDLE_BUTTONS: DemoButtonState = { offline: false, battery: false };

export default function DemoMode() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [simulated, setSimulated] = useState<DemoButtonState>(IDLE_BUTTONS);

  useEffect(() => {
    setEnabled(isDemoModeEnabled());
    setSimulated({ offline: isOfflineSimulated(), battery: false });
  }, []);

  if (!enabled) return null;

  const log = (scenario: string) =>
    trackAnalytics(`demo.${scenario}`, getDemoMode());

  const run = async (id: string, fn: () => void | Promise<unknown>) => {
    if (busy) return;
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {/* Diagonal watermark intentionally removed — the judge demo runs
          without on-screen "Demo Mode" chrome. The floating control panel
          below still toggles scenarios. */}

      <div className="fixed left-0 top-1/2 z-[80] flex -translate-y-1/2 items-center">
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="demo-panel"
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="ml-3 w-72 overflow-hidden rounded-xl border-2 border-red-500/60 bg-panel-deep/95 shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-red-500/30 px-4 py-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-red-400">
                    Demo Controls
                  </p>
                  <p className="mt-0.5 text-[0.6875rem] text-[var(--dl-text-muted)]">
                    Scenario simulators · for the pitch
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Collapse demo controls panel"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-red-500/30 bg-white/5 text-red-300 transition hover:border-red-500/60 hover:text-white"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>

              <ul className="space-y-2 p-3">
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      void run("toggle-offline", () => {
                        if (simulated.offline) {
                          restoreNetwork();
                          setSimulated((s) => ({ ...s, offline: false }));
                          showToast("success", {
                            id: "demo-offline",
                            title: "📶 Network restored",
                            description: "Live detection is back on.",
                          });
                        } else {
                          simulateOffline();
                          setSimulated((s) => ({ ...s, offline: true }));
                          log("simulate-offline");
                          showToast("warning", {
                            id: "demo-offline",
                            title: "📴 Offline simulated",
                            description:
                              "App now runs fully on cache — try the alerts map.",
                          });
                        }
                      })
                    }
                    disabled={busy !== null}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
                      simulated.offline
                        ? "border-red-500/60 bg-red-600/25 text-red-200 hover:bg-red-600/35"
                        : "border-red-500/40 bg-red-600/15 text-red-300 hover:bg-red-600/25"
                    }`}
                  >
                    {simulated.offline ? (
                      <RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />
                    ) : (
                      <MonitorOff aria-hidden="true" className="h-4 w-4 shrink-0" />
                    )}
                    {simulated.offline ? "Restore Network" : "Simulate Offline"}
                  </button>
                </li>

                <li>
                  <button
                    type="button"
                    onClick={() =>
                      void run("toggle-battery", () => {
                        if (simulated.battery) {
                          restoreBattery();
                          setSimulated((s) => ({ ...s, battery: false }));
                          showToast("success", {
                            id: "demo-battery",
                            title: "🔋 Battery restored",
                            description: "Sync engine back to normal power.",
                          });
                        } else {
                          simulateLowBattery();
                          setSimulated((s) => ({ ...s, battery: true }));
                          log("simulate-low-battery");
                          showToast("warning", {
                            id: "demo-battery",
                            title: "🔻 Low battery: 15%",
                            description:
                              "Background sync paused — battery gate active.",
                          });
                        }
                      })
                    }
                    disabled={busy !== null}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
                      simulated.battery
                        ? "border-red-500/60 bg-red-600/25 text-red-200 hover:bg-red-600/35"
                        : "border-red-500/40 bg-red-600/15 text-red-300 hover:bg-red-600/25"
                    }`}
                  >
                    {simulated.battery ? (
                      <RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />
                    ) : (
                      <BatteryLow aria-hidden="true" className="h-4 w-4 shrink-0" />
                    )}
                    {simulated.battery ? "Restore Battery" : "Simulate Low Battery"}
                  </button>
                </li>

                <li>
                  <button
                    type="button"
                    onClick={() =>
                      void run("clear-cache", async () => {
                        const { cleared } = await clearAllCache();
                        log("clear-all-cache");
                        showToast("success", {
                          id: "demo-clear-cache",
                          title: "🧹 Cache cleared",
                          description: `${cleared} stores wiped — everything re-syncs on demand.`,
                        });
                      })
                    }
                    disabled={busy !== null}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-red-500/40 bg-red-600/15 px-3 py-2.5 text-left text-sm font-semibold text-red-300 transition hover:bg-red-600/25 active:scale-[0.98] disabled:opacity-60"
                  >
                    {busy === "clear-cache" ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Eraser aria-hidden="true" className="h-4 w-4 shrink-0" />
                    )}
                    Clear All Cache
                  </button>
                </li>

                <li>
                  <button
                    type="button"
                    onClick={() =>
                      void run("corrupt-model", async () => {
                        const { deleted } = await corruptModel();
                        log("corrupt-model");
                        showToast("error", {
                          id: "demo-corrupt-model",
                          title: "💥 Model corrupted",
                          description: `${deleted} chunks deleted — integrity check will re-download them.`,
                        });
                      })
                    }
                    disabled={busy !== null}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-red-500/40 bg-red-600/15 px-3 py-2.5 text-left text-sm font-semibold text-red-300 transition hover:bg-red-600/25 active:scale-[0.98] disabled:opacity-60"
                  >
                    {busy === "corrupt-model" ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <ShieldX aria-hidden="true" className="h-4 w-4 shrink-0" />
                    )}
                    Corrupt Model
                  </button>
                </li>

                <li>
                  <button
                    type="button"
                    onClick={() =>
                      void run("reset-first-time", async () => {
                        log("reset-first-time");
                        await resetToFirstTimeUser();
                        showToast("info", {
                          id: "demo-reset",
                          title: "🔄 First-time user reset",
                          description: "Cache cleared — taking you to onboarding.",
                        });
                      })
                    }
                    disabled={busy !== null}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-red-500/40 bg-red-600/15 px-3 py-2.5 text-left text-sm font-semibold text-red-300 transition hover:bg-red-600/25 active:scale-[0.98] disabled:opacity-60"
                  >
                    {busy === "reset-first-time" ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />
                    )}
                    Reset to First-Time User
                  </button>
                </li>
              </ul>

              <p className="border-t border-red-500/20 px-4 py-2 text-[0.6875rem] text-[var(--dl-text-muted)]">
                Every scenario is logged for the /demo/insights tracker.
              </p>
            </motion.div>
          ) : (
            <motion.button
              key="demo-tab"
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open demo controls panel"
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              className="flex items-center gap-2 rounded-r-lg border border-l-0 border-red-500/60 bg-red-600/90 px-2 py-3 text-white shadow-[var(--shadow-float-md)] transition hover:bg-red-500"
            >
              <MonitorOff aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="text-xs font-black uppercase tracking-widest [writing-mode:vertical-rl]">
                Demo
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}