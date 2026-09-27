"use client";

// ---------------------------------------------------------------------
// components/public/sos/SOSCountdown.tsx — Phase 5 · Step 3 · the
// 3-second confirmation flow.
//
// Prevents accidental massive deployments: tapping a CRITICAL action (I
// Need Rescue / Medical Emergency) replaces the 3×2 grid with this view —
// a massive pulsing circle counting 3 → 1, loud countdown text
// ("Sending Rescue Request in 3…") and a giant ghost CANCEL button.
//
// If the countdown reaches 0, `onComplete` fires and the modal confirms
// the SOS (→ Emergency Mode). If the user cancels — or simply closes the
// modal / swipes it away mid-count — the timer is torn down and NOTHING
// is sent. Cancelling is always one deliberate tap away.
// ---------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { triggerHeavyHaptic, triggerLightHaptic } from "@/hooks/useHaptics";

/** Starting count. Counting DOWN — 3, 2, 1, then send. */
const START = 3;
/** Tick interval for one number per second. */
const TICK_MS = 1000;

type SOSCountdownProps = {
  /** e.g. "Rescue Request" → "Sending Rescue Request in 3…" */
  actionLabel: string;
  /** Fired exactly once when the countdown reaches 0. */
  onComplete: () => void;
  /** Fired when the giant CANCEL button is tapped. */
  onCancel: () => void;
};

export default function SOSCountdown({
  actionLabel,
  onComplete,
  onCancel,
}: SOSCountdownProps) {
  const reduceMotion = useReducedMotion();
  const [remaining, setRemaining] = useState(START);
  const firedRef = useRef(false);

  // Tick down once per second; unmount (cancel / close / swipe) tears the
  // timer down and sends nothing.
  useEffect(() => {
    triggerHeavyHaptic(); // the countdown itself is the "arming" moment
    const timer = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Subtle tick haptic as the number falls (never inside a state updater).
  useEffect(() => {
    if (remaining > 0 && remaining < START) triggerLightHaptic();
  }, [remaining]);

  // Fire onComplete exactly once when we hit 0 (ref-guarded so re-renders
  // from a changing callback identity can't double-send).
  useEffect(() => {
    if (remaining === 0 && !firedRef.current) {
      firedRef.current = true;
      onComplete();
    }
  }, [remaining, onComplete]);

  return (
    <div
      className="flex flex-col items-center px-5 pb-2 pt-6 text-center"
      role="status"
      aria-live="polite"
      aria-label={`Sending ${actionLabel} in ${remaining}`}
    >
      {/* Massive pulsing circle with the number */}
      <div className="relative flex h-44 w-44 items-center justify-center">
        {/* Pulsing halo */}
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full bg-severity-red-500/30 motion-reduce:animate-none"
        />
        <motion.span
          aria-hidden="true"
          animate={reduceMotion ? undefined : { scale: [1, 1.07, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex h-40 w-40 items-center justify-center rounded-full bg-severity-red-600 shadow-[0_0_60px_rgba(239,68,68,0.55)] ring-4 ring-severity-red-500/40"
        >
          <span className="text-8xl font-black tabular-nums text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            {remaining}
          </span>
        </motion.span>
      </div>

      {/* Loud countdown text */}
      <p className="mt-6 text-2xl font-black uppercase leading-tight tracking-wide text-white">
        Sending {actionLabel} in {remaining}&hellip;
      </p>
      <p className="mt-2 max-w-xs text-xs font-medium text-[var(--dl-text-muted)]">
        Your request will be sent with your current location. Dispatch is not confirmed.
      </p>

      {/* Giant ghost CANCEL */}
      <button
        type="button"
        onClick={onCancel}
        className="mt-8 flex h-16 w-full max-w-sm items-center justify-center rounded-2xl border-2 border-white/30 text-lg font-black uppercase tracking-[0.2em] text-white transition hover:border-white/60 hover:bg-white/10 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-severity-red-400"
      >
        Cancel
      </button>
    </div>
  );
}
