"use client";

// ---------------------------------------------------------------------
// components/field/ResponderSOS.tsx — Phase 14 · Step 7.
//
// The responder's panic button, rendered as the 5th slot in the bottom
// nav: a massive floating 64px red circle. Tapping it opens a full-screen
// "SLIDE TO TRIGGER" guard (accidental-pocket-dial protection); sliding
// the thumb all the way across fires the RESPONDER DOWN alert.
//
// On trigger:
//   • navigator.vibrate([500, 200, 500]) — the distinct SOS pattern
//     (exposed as triggerCriticalHaptic in hooks/useHaptics.ts)
//   • POSTs a high-priority SOS_EMERGENCY payload to /api/field/sos
//   • Offline → the alert is queued via OfflineSyncQueue for replay the
//     moment connectivity returns; a local queue is not delivery.
// ---------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import { Siren, Phone, ChevronRight, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { triggerCriticalHaptic, triggerLightHaptic } from "@/hooks/useHaptics";
import { OfflineSyncQueue } from "@/lib/field-offline";

const RESPONDER = "Sunita Das · Team Alpha · NDRF";

export default function ResponderSOS() {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [sent, setSent] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [slide, setSlide] = useState(0); // 0..1
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  // Fresh GPS whenever the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setCoords(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }, [open]);

  // Slide-to-trigger pointer handlers (touch + mouse for desktop demos).
  const onPointerDown = (e: React.PointerEvent) => {
    if (sent) return;
    dragging.current = true;
    setArmed(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateSlide(e);
  };

  const updateSlide = (e: React.PointerEvent | React.TouchEvent) => {
    if (!dragging.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = "clientX" in e ? e.clientX : (e.touches?.[0]?.clientX ?? rect.left);
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setSlide(ratio);
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setArmed(false);
    if (slide >= 0.85) {
      void fire();
    } else {
      setSlide(0);
    }
  };

  async function fire() {
    triggerCriticalHaptic();
    if (!coords) {
      toast.error(
        "GPS is unavailable. Contact the control room directly and share your location.",
      );
      return;
    }
    const payload = {
      type: "SOS_EMERGENCY" as const,
      responder: RESPONDER,
      lat: coords.lat,
      lng: coords.lng,
      at: new Date().toISOString(),
    };
    try {
      const res = await fetch("/api/field/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error("SOS was not recorded. Contact the control room directly.");
        return;
      }
      setSent(true);
      toast("SOS recorded. Responder notification is unconfirmed.", { icon: "🚨" });
    } catch {
      if (!navigator.onLine) {
        OfflineSyncQueue.enqueue({
          url: "/api/field/sos",
          method: "POST",
          body: payload,
        });
        toast(
          "SOS queued on this device, not delivered. Contact the control room directly.",
          { icon: "⚠️" },
        );
      } else {
        toast.error("SOS could not be sent. Contact the control room directly.");
      }
    }
  }

  function close() {
    setOpen(false);
    setSent(false);
    setSlide(0);
    setArmed(false);
  }

  const reset = useCallback(() => {
    setSent(false);
    setSlide(0);
    setArmed(false);
  }, []);

  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(reset, 3500);
    return () => clearTimeout(t);
  }, [sent, reset]);

  return (
    <>
      {/* Massive floating 64px SOS button (bottom nav slot) */}
      <button
        type="button"
        onClick={() => {
          triggerLightHaptic();
          setOpen(true);
        }}
        aria-label="Responder SOS"
        className="sos-ring relative -mt-6 flex h-16 w-16 shrink-0 items-center justify-center self-center rounded-full border-2 border-red-300 bg-red-600 text-white shadow-[0_0_24px_rgba(239,68,68,0.6)] transition active:scale-95"
      >
        <Siren className="h-8 w-8" aria-hidden />
        <span className="absolute -bottom-5 text-[0.6875rem] font-black tracking-widest text-red-300">
          SOS
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Responder emergency SOS"
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-red-950/95 p-6"
        >
          {sent ? (
            <div className="w-full max-w-sm text-center">
              <div className="sos-ring mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-600 text-white">
                <Siren className="h-12 w-12 animate-pulse" />
              </div>
              <p className="mt-5 text-3xl font-black uppercase tracking-widest text-red-300">
                RESPONDER DOWN
              </p>
              <p className="mt-2 text-lg text-red-100/90">
                SOS report recorded. Responder notification is unconfirmed.
              </p>
              <p className="mt-3 flex items-center justify-center gap-1 font-mono text-sm text-red-200/70">
                <MapPin className="h-4 w-4" />
                {coords
                  ? `${coords.lat.toFixed(5)}° N, ${coords.lng.toFixed(5)}° E`
                  : "locating…"}
              </p>
              <a
                href="tel:+911123456789"
                className="mt-6 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-red-500 text-lg font-black text-white transition active:scale-95"
              >
                <Phone className="h-5 w-5" /> CALL CONTROL ROOM
              </a>
              <button
                type="button"
                onClick={close}
                className="mt-3 min-h-[48px] w-full rounded-full border border-red-400/60 text-lg font-bold text-red-200"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm text-center">
              <div className="sos-ring mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-white">
                <Siren className="h-10 w-10 animate-pulse" />
              </div>
              <p className="mt-4 text-2xl font-black uppercase tracking-widest text-red-300">
                Emergency SOS
              </p>
              <p className="mt-1 text-base text-red-100/80">
                Slide the thumb all the way to alert Command Center with your live
                location.
              </p>

              {/* Slide-to-trigger track */}
              <div
                ref={trackRef}
                onPointerDown={onPointerDown}
                onPointerMove={updateSlide}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onTouchMove={updateSlide}
                className="relative mt-8 h-16 w-full select-none touch-none overflow-hidden rounded-full border-2 border-red-400 bg-[#2a0a0a]"
              >
                <span className="absolute inset-0 flex items-center justify-center gap-1 text-base font-bold text-red-200/80">
                  <ChevronRight className="h-5 w-5" /> SLIDE TO TRIGGER
                </span>
                {/* progress fill */}
                <span
                  className="absolute inset-y-0 left-0 bg-red-600/40"
                  style={{ width: `${slide * 100}%` }}
                />
                {/* thumb */}
                <span
                  className={`absolute top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border-2 border-red-300 bg-red-500 text-white shadow-lg ${
                    armed ? "scale-105" : ""
                  }`}
                  style={{ left: `calc(${Math.max(0, slide * 100)}% - 1.75rem)` }}
                >
                  <Siren className="h-7 w-7" />
                </span>
              </div>
              <p className="mt-2 text-xs text-red-300/70">
                {armed ? "Keep sliding…" : "Slide right, release to send"}
              </p>

              <button
                type="button"
                onClick={close}
                className="mt-6 min-h-[48px] w-full rounded-full border border-red-400/50 text-lg font-bold text-red-200"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* pulsing ring keyframes */}
      <style jsx>{`
        @keyframes sosRing {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(255, 60, 60, 0.7);
          }
          50% {
            box-shadow: 0 0 0 18px rgba(255, 60, 60, 0);
          }
        }
        .sos-ring {
          animation: sosRing 1.4s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
