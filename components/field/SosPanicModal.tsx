"use client";

import { useEffect, useRef, useState } from "react";
import { Siren, X, MapPin, User, Clock } from "lucide-react";
import { OfflineSyncQueue } from "@/lib/field-offline";

const RESPONDER_NAME = "Sunita Das · Team Alpha";
const HOLD_MS = 2000;

type SosPayload = {
  type: "SOS_EMERGENCY";
  responder: string;
  lat: number;
  lng: number;
  at: string;
};

export default function SosPanicModal() {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [broadcast, setBroadcast] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  // Capture best-known GPS up front so the payload is ready when armed.
  const refreshCoords = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setCoords(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  useEffect(() => {
    if (open) refreshCoords();
  }, [open]);

  function startHold() {
    setArmed(true);
    holdStart.current = performance.now();
    const tick = () => {
      const startAt = holdStart.current;
      if (startAt === null) return;
      const now = performance.now();
      setHoldProgress(Math.min(1, (now - startAt) / HOLD_MS));
      if (now - startAt >= HOLD_MS) {
        cancelHold();
        void dispatch();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  function cancelHold() {
    setArmed(false);
    setHoldProgress(0);
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    holdStart.current = null;
  }

  async function dispatch() {
    setDispatchError(null);
    if (!coords) {
      setDispatchError(
        "GPS is unavailable. Contact the control room directly and share your location.",
      );
      return;
    }
    const payload: SosPayload = {
      type: "SOS_EMERGENCY",
      responder: RESPONDER_NAME,
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
        setDispatchError("SOS was not recorded. Contact the control room directly.");
        return;
      }
      setBroadcast(true);
      setCoords(null);
      setOpen(false);
    } catch {
      if (!navigator.onLine) {
        OfflineSyncQueue.enqueue({
          url: "/api/field/sos",
          method: "POST",
          body: payload,
        });
        setDispatchError(
          "SOS is queued on this device, not delivered. Contact the control room directly.",
        );
      } else {
        setDispatchError("SOS could not be sent. Contact the control room directly.");
      }
    }
  }

  function close() {
    cancelHold();
    setOpen(false);
    setBroadcast(false);
  }

  return (
    <>
      {/* Pulsing SOS trigger — rendered in the FieldShell header */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="SOS emergency"
        className="sos-pulse flex min-h-[48px] min-w-[64px] items-center justify-center gap-1 rounded-md border-2 border-red-400 bg-red-600 px-3 text-base font-black text-white"
      >
        <Siren className="h-5 w-5" />
        SOS
      </button>

      {/* Confirmation that the SOS report was recorded, not delivered. */}
      {broadcast && !open && (
        <div className="sos-flash fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-3 bg-red-600 px-4 py-3 text-center text-white">
          <Siren className="h-6 w-6 shrink-0" />
          <span className="text-lg font-black">
            🚨 SOS REPORT RECORDED. RESPONDER NOTIFICATION IS UNCONFIRMED.
          </span>
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="SOS emergency confirmation"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-red-950/90 p-4"
        >
          <div className="flex max-h-[90dvh] w-full max-w-md flex-col items-center overflow-y-auto rounded-3xl border-4 border-red-500 bg-[#160a0a] p-6 text-center">
            <button
              type="button"
              onClick={close}
              aria-label="Cancel"
              className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-xl bg-red-900 text-red-200"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="sos-pulse flex h-24 w-24 items-center justify-center rounded-full bg-red-600 text-white">
              <Siren className="h-12 w-12" />
            </div>
            <h2 className="mt-4 text-2xl font-black text-red-300">SOS EMERGENCY</h2>
            <p className="mt-1 text-center text-base text-red-200/80">
              This records an SOS report. Contact the control room directly for immediate
              help.
            </p>

            <div className="mt-4 w-full space-y-1 rounded-xl border-2 border-red-500/40 bg-red-950 p-4 text-sm font-semibold text-red-100">
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-400" />
                {coords
                  ? `${coords.lat.toFixed(5)}° N, ${coords.lng.toFixed(5)}° E`
                  : "fetching GPS…"}
              </p>
              <p className="flex items-center gap-2">
                <User className="h-4 w-4 text-red-400" />
                {RESPONDER_NAME}
              </p>
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-red-400" />
                {new Date().toLocaleTimeString()}
              </p>
            </div>

            {dispatchError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-400 bg-red-950 p-3 text-sm font-bold text-white"
              >
                {dispatchError}
              </p>
            )}

            {/* Hold-to-confirm (accidental trigger protection) */}
            <button
              type="button"
              onPointerDown={startHold}
              onPointerUp={armed ? cancelHold : undefined}
              onPointerLeave={armed ? cancelHold : undefined}
              onContextMenu={(e) => e.preventDefault()}
              aria-describedby="sos-hold-hint"
              className="relative mt-6 flex min-h-[64px] w-full select-none items-center justify-center overflow-hidden rounded-2xl border-2 border-red-500 bg-red-600 text-xl font-black text-white"
            >
              {armed && (
                <span
                  className="absolute inset-y-0 left-0 bg-white/25"
                  style={{ width: `${holdProgress * 100}%` }}
                />
              )}
              <Siren className="mr-2 h-7 w-7" />
              {armed ? "KEEP HOLDING…" : "PRESS & HOLD TO CONFIRM"}
            </button>
            <p id="sos-hold-hint" className="mt-2 text-center text-xs text-red-300/70">
              Hold for 2 seconds to send. Release to cancel.
            </p>
          </div>
        </div>
      )}

      {/* pulse + flash keyframes */}
      <style jsx>{`
        @keyframes sosPulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(255, 60, 60, 0.7);
          }
          50% {
            box-shadow: 0 0 0 24px rgba(255, 60, 60, 0);
          }
        }
        @keyframes sosFlash {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
        .sos-pulse {
          animation: sosPulse 1.4s ease-in-out infinite;
          background: #dc2626;
        }
        .sos-flash {
          animation: sosFlash 0.7s steps(1) infinite;
        }
      `}</style>
    </>
  );
}
