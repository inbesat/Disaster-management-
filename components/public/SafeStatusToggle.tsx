"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import { triggerLightHaptic } from "@/hooks/useHaptics";
import { readSafeStatus, writeSafeStatus } from "@/lib/mock-data/public-alerts";

export function SafeStatusToggle() {
  // Hydration-safe: idle on both server + first paint, then the persisted
  // status snaps in post-mount (same pattern as the other citizen state).
  const [status, setStatus] = useState<"idle" | "safe">("idle");

  useEffect(() => {
    if (readSafeStatus()) setStatus("safe");
  }, []);

  const markSafe = () => {
    if (status !== "idle") return;
    writeSafeStatus();
    setStatus("safe");
    triggerLightHaptic();
    showToast("info", {
      title: "Marked safe on this device",
      description: "Family notification is not connected. Contact your family directly.",
    });
  };

  return (
    <button
      type="button"
      onClick={markSafe}
      aria-label={
        status === "safe" ? "You are marked safe" : "Mark myself as safe"
      }
      className={`fixed bottom-[calc(160px+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-bold shadow-[var(--dl-shadow-soft)] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-severity-green-400 ${
        status === "safe"
          ? "border-severity-green-500 bg-severity-green-500 text-white"
          : "border-severity-green-500/60 bg-severity-green-500/10 text-severity-green-300 hover:bg-severity-green-500/20"
      }`}
    >
      {status === "safe" ? (
        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
      ) : (
        <ShieldCheck aria-hidden="true" className="h-4 w-4" />
      )}
      {status === "safe" ? "Marked Safe (this device)" : "Mark Myself Safe"}
    </button>
  );
}

export default SafeStatusToggle;
