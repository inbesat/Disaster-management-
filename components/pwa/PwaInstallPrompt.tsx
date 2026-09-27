"use client";

// ---------------------------------------------------------------------
// components/pwa/PwaInstallPrompt.tsx — Phase 11 · PWA install bottom
// sheet (Stitch/Antigravity spec).
//
// Design per spec:
//   • Bottom sheet sliding up from the bottom.
//   • App logo (72×72).
//   • Title: "Install SafeSphere for Offline Access".
//   • Bullet points: "Works without internet", "Local AI assistant",
//     "Instant alerts".
//   • "Install Now" primary button (orange) + "Maybe Later" secondary.
//   • Background: blurred dark overlay.
//   • After install: "Installed ✓" toast with a confetti animation.
//
// Shows only when the browser captured a `beforeinstallprompt` event, the
// citizen hasn't dismissed it before, and the app isn't running standalone
// yet. Renders nothing on the server / before hydration (no mismatch).
// ---------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Smartphone, WifiOff, Sparkles, Siren, X } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useToast } from "@/hooks/useToast";

/** Bullet copy from the spec. */
const FEATURES = [
  { icon: WifiOff, label: "Works without internet" },
  { icon: Sparkles, label: "Local AI assistant" },
  { icon: Siren, label: "Instant alerts" },
] as const;

const CONFETTI_COLORS = ["#F97316", "#FDBA74", "#34d399", "#22d3ee", "#facc15", "#fb7185"];
const CONFETTI_COUNT = 36;

/** One decorative particle for the post-install confetti burst. */
function ConfettiPiece({ color, delay }: { color: string; delay: number }) {
  const x = useMemo(() => (Math.random() - 0.5) * 320, []);
  const rotation = useMemo(() => (Math.random() - 0.5) * 720, []);
  const width = useMemo(() => 5 + Math.random() * 6, []);
  return (
    <motion.span
      aria-hidden
      className="absolute bottom-0 block rounded-[var(--radius-micro)]"
      style={{ width, height: 10 + Math.random() * 8, background: color }}
      initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
      animate={{ x, y: -260 - Math.random() * 120, opacity: 0, rotate: rotation }}
      transition={{ duration: 1.1 + Math.random() * 0.5, delay, ease: "easeOut" }}
    />
  );
}

export default function PwaInstallPrompt() {
  const { canInstall, isInstalled, dismissed, promptInstall, dismissInstall } =
    usePwaInstall();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // After a successful install, burst the confetti and show the toast.
  const celebrate = useCallback(() => {
    setConfetti(true);
    window.setTimeout(() => setConfetti(false), 1800);
    toast.success({
      title: "Installed ✓",
      description: "SafeSphere is on your home screen.",
    });
  }, [toast]);

  const onInstall = useCallback(async () => {
    const accepted = await promptInstall();
    if (accepted) celebrate();
  }, [promptInstall, celebrate]);

  const show = mounted && canInstall && !isInstalled && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="pwa-install-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
          onClick={dismissInstall}
        />
      )}

      {show && (
        <motion.div
          key="pwa-install-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={{ type: "spring", stiffness: 320, damping: 34, mass: 1 }}
          className="fixed inset-x-0 bottom-0 z-[90] mx-auto w-full max-w-md rounded-t-3xl border-t border-white/10 bg-panel-deep pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[var(--shadow-float-sheet)]"
        >
          <div className="relative px-6 pt-5">
            {/* Drag handle */}
            <div className="mx-auto h-1.5 w-10 rounded-full bg-white/15" />

            {/* Close affordance */}
            <button
              type="button"
              onClick={dismissInstall}
              aria-label="Close install prompt"
              className="absolute right-4 top-4 rounded-md p-1.5 text-[var(--dl-text-muted)] transition hover:bg-white/10 hover:text-white"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>

            <div className="mt-4 flex items-start gap-4">
              {/* App logo — 72×72 per spec */}
              <Image
                src="/icons/icon-192.png"
                alt=""
                width={72}
                height={72}
                className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
              />
              <div>
                <h2
                  id="pwa-install-title"
                  className="text-lg font-black leading-snug text-white"
                >
                  Install SafeSphere for Offline Access
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[var(--dl-text-muted)]">
                  SafeSphere keeps working through blackouts and network
                  drops — it&apos;s a real app on your phone.
                </p>
              </div>
            </div>

            {/* Feature bullets */}
            <ul className="mt-5 space-y-2.5">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm font-semibold text-slate-200">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316]/15 text-[var(--brand-orangeLight)]">
                    <Icon aria-hidden className="h-4 w-4" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => void onInstall()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-orange)] px-5 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-[0_8px_24px_rgba(249,115,22,0.45)] transition hover:brightness-110 active:scale-[0.99]"
              >
                <Smartphone aria-hidden className="h-4 w-4" />
                Install Now
              </button>
              <button
                type="button"
                onClick={dismissInstall}
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/10"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* "Installed ✓" toast + confetti (spec) */}
      <AnimatePresence>
        {confetti && (
          <motion.div
            key="pwa-install-confetti"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-x-0 bottom-28 z-[95] flex justify-center"
            aria-hidden="true"
          >
            <div className="relative flex h-0 w-0">
              {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
                <ConfettiPiece
                  key={i}
                  color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                  delay={i * 0.018}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spec "Installed ✓" — small floating check that rides with confetti */}
      <AnimatePresence>
        {confetti && (
          <motion.div
            key="pwa-install-check"
            initial={{ scale: 0.4, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 360, damping: 22 }}
            className="pointer-events-none fixed inset-x-0 bottom-32 z-[96] flex justify-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-severity-green-500 text-white shadow-[0_8px_28px_rgba(34,197,94,0.5)]">
              <Check aria-hidden className="h-6 w-6" strokeWidth={3} />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
