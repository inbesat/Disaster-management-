"use client";

// ---------------------------------------------------------------------
// components/public/sos/EmergencyModeBanner.tsx — Phase 5 · Step 4 ·
// Emergency Mode lockdown UI.
//
// While an SOS is active (useSOS().emergency — set after the Step 3
// countdown completes, persisted across reloads), this fixed red banner
// pins to the absolute top of EVERY /public page: "EMERGENCY MODE
// ACTIVE: Help is on the way."
//
// It doubles as the lockdown: a "View Map" CTA keeps the citizen pointed
// at their evacuation map (the BottomNav separately hides non-essential
// tabs while emergency is active). Cancelling an SOS is deliberately
// hard — a strict HOLD-TO-CANCEL interaction: the button fills over 2
// seconds while held (pointer or keyboard), and releases before that
// cancels the hold, not the SOS.
//
// This bar is STATIC (not fixed) — app/public/layout.tsx wraps it and the
// LocationTracker in one fixed top stack, so they stack naturally with no
// overlap. The bar opts back into pointer events for its buttons (the
// wrapper is pointer-events-none).
// ---------------------------------------------------------------------

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Siren } from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import { triggerHeavyHaptic, triggerLightHaptic } from "@/hooks/useHaptics";
import { useSOS } from "./SOSContext";

/** How long the cancel button must be held (ms) before SOS is cancelled. */
const HOLD_MS = 2000;

/** Phase 5 · Step 4 lockdown — routes the citizen may stay on during Emergency Mode. */
const LOCKED_ROUTES = ["/public/map", "/public/dashboard"];

export default function EmergencyModeBanner() {
  const { emergency, cancelEmergency } = useSOS();
  const pathname = usePathname();
  const router = useRouter();
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);
  // Synchronous guard — state reads can be stale within a single frame if
  // pointerdown + keydown land together, which would double-start the hold.
  const holdingRef = useRef(false);

  // Tear down a half-finished hold if the banner unmounts.
  useEffect(
    () => () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    },
    [],
  );

  // Phase 5 · Step 4 lockdown — while Emergency Mode is active the citizen
  // is locked onto the Map or Dashboard (per the spec). Any other /public
  // route (alerts, settings, setup…) bounces to the evacuation map, and
  // the check re-runs on every navigation so they can't wander off.
  useEffect(() => {
    if (emergency && !LOCKED_ROUTES.includes(pathname)) {
      router.replace("/public/map");
    }
  }, [emergency, pathname, router]);

  const finishHold = () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    holdingRef.current = false;
    setHolding(false);
    setProgress(0);
    cancelEmergency();
    triggerHeavyHaptic();
    showToast("info", {
      title: "SOS cancelled",
      description: "Emergency Mode is off. Stay safe.",
    });
  };

  /** Start the 2-second hold (pointer down / key down). */
  const startHold = () => {
    if (holdingRef.current) return;
    holdingRef.current = true;
    setHolding(true);
    setProgress(0);
    triggerLightHaptic();
    const startedAt = Date.now();
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= HOLD_MS) {
        finishHold();
        return;
      }
      setProgress((elapsed / HOLD_MS) * 100);
    }, 40);
  };

  /** Release before the hold completes → nothing happens. */
  const abortHold = () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    holdingRef.current = false;
    setHolding(false);
    setProgress(0);
  };

  return (
    <AnimatePresence>
      {emergency && (
        <motion.div
          initial={{ y: -96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -96, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.9 }}
          className="pointer-events-auto px-0 pt-[env(safe-area-inset-top)]"
          role="status"
          aria-live="polite"
        >
          <div className="border-b border-severity-red-400/40 bg-severity-red-600 shadow-[0_8px_30px_rgba(239,68,68,0.4)]">
            <div className="mx-auto flex w-full max-w-md flex-col gap-2.5 px-4 py-3">
              {/* Headline */}
              <div className="flex items-center gap-2.5">
                <Siren
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 animate-pulse text-white"
                  strokeWidth={2.25}
                />
                <p className="text-[0.8125rem] font-black uppercase leading-tight tracking-wide text-white">
                  SOS report recorded. Dispatch is unconfirmed.
                </p>
              </div>

              {/* Actions — View Map (lock-in) + Hold to Cancel */}
              <div className="flex items-center gap-2">
                <Link
                  href="/public/map"
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 text-sm font-bold text-white transition hover:bg-white/25 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <MapPin aria-hidden="true" className="h-4 w-4" />
                  View Map
                </Link>

                <button
                  type="button"
                  onPointerDown={startHold}
                  onPointerUp={abortHold}
                  onPointerLeave={abortHold}
                  onPointerCancel={abortHold}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      startHold();
                    }
                  }}
                  onKeyUp={abortHold}
                  aria-label="Hold for 2 seconds to cancel the SOS"
                  aria-busy={holding}
                  className="relative flex h-11 flex-1 items-center justify-center overflow-hidden rounded-xl border-2 border-white/50 text-[0.6875rem] font-black uppercase tracking-wider text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {/* Hold-progress fill */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                  <span className="relative">
                    {holding ? "Keep holding…" : "Hold to Cancel"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
