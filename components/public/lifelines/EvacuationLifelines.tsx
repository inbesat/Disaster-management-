"use client";

// ---------------------------------------------------------------------
// components/public/lifelines/EvacuationLifelines.tsx — citizen lifelines.
//
// Two critical, mobile-first actions for the public dashboard:
//   1. "Explore Demo Shelter Map" — requests browser geolocation, then
//      hands off to /public/map?action=find-route&lat={lat}&lng={lng}
//      (the map auto-routes to the nearest open shelter). Falls back to
//      the plain map if GPS is denied/unavailable.
//   2. "WhatsApp Lifeline" —
//      · "Get WhatsApp Alerts" subscribes the citizen (server action
//        writing user_settings + local citizen_notification_prefs).
//      · "SOS via WhatsApp" is a safe <a> deep link (wa.me) to the
//        control room with a pre-filled emergency message.
//
// No admin broadcast controls — this is public-facing only.
// ---------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  MapPinned,
  MessageCircle,
  Navigation,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import { enableWhatsAppAlerts } from "@/app/actions/whatsapp";
import { safeParseJSON } from "@/lib/utils";

const NOTIF_KEY = "citizen_notification_prefs";

// Control-room WhatsApp number (E.164, no "+"). Override via env, else the
// national disaster helpline placeholder used across the app.
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_SOS_NUMBER ?? "";
const WHATSAPP_SOS_CONFIGURED = /^\d{10,15}$/.test(WHATSAPP_NUMBER) && WHATSAPP_NUMBER !== "919999999999";

const SOS_MESSAGE =
  "EMERGENCY SOS: I am in danger and need immediate rescue. Please track my phone location.";

export default function EvacuationLifelines() {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  // Reflect an existing WhatsApp opt-in from localStorage (real citizen
  // store) once mounted — SSR-safe: initial render stays false.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTIF_KEY);
      const prefs = safeParseJSON<{ whatsapp?: boolean }>(raw);
      if (prefs) setSubscribed(Boolean(prefs.whatsapp));
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  function findSafeShelter() {
    if (locating) return;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location is unavailable — opening the map at your saved spot.");
      router.push("/public/map");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lat = coords.latitude.toFixed(6);
        const lng = coords.longitude.toFixed(6);
        router.push(`/public/map?action=find-route&lat=${lat}&lng=${lng}`);
      },
      () => {
        setLocating(false);
        toast.error("Could not access your location — opening the map instead.");
        router.push("/public/map");
      },
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    );
  }

  async function subscribeWhatsApp() {
    if (subscribed) return;
    try {
      const result = await enableWhatsAppAlerts();
      if (!result.ok) {
        toast.error("WhatsApp alert preference could not be saved. Alerts are not active.");
        return;
      }
    } catch {
      toast.error("WhatsApp alert preference could not be saved. Alerts are not active.");
      return;
    }

    try {
      const raw = window.localStorage.getItem(NOTIF_KEY);
      const prefs = safeParseJSON<Record<string, unknown>>(raw, {});
      window.localStorage.setItem(
        NOTIF_KEY,
        JSON.stringify({ ...prefs, whatsapp: true }),
      );
    } catch {
      /* storage may be unavailable (private mode) — toast still shows */
    }

    setSubscribed(true);
    toast.success("Preference saved. WhatsApp delivery is not yet confirmed.");
  }

  const sosHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(SOS_MESSAGE)}`;

  return (
    <section
      aria-label="Emergency lifelines"
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
    >
      {/* ── Evacuation route finder ─────────────────────────────────── */}
      <div className="flex flex-col rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition hover:border-white/20">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F97316]/20 ring-1 ring-[#F97316]/40">
            <MapPinned aria-hidden className="h-5 w-5 text-[var(--brand-orangeLight)]" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-[var(--brand-orangeLight)]">
              Evacuation
            </p>
            <h2 className="mt-0.5 text-base font-bold text-white">
              Explore Demo Shelter Map
            </h2>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[var(--dl-text-muted)]">
          The map uses illustrative shelter and route data. Verify official local advisories before travelling.
        </p>

        <button
          type="button"
          onClick={findSafeShelter}
          disabled={locating}
          className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--dl-orange)] px-4 py-3.5 text-base font-bold text-[#0a0f1a] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)]"
        >
          {locating ? (
            <>
              <Loader2 aria-hidden className="h-5 w-5 animate-spin" />
              Locating you&hellip;
            </>
          ) : (
            <>
              <Navigation aria-hidden className="h-5 w-5" />
              Explore Demo Shelter Map
            </>
          )}
        </button>
      </div>

      {/* ── WhatsApp lifeline ───────────────────────────────────────── */}
      <div className="flex flex-col rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition hover:border-white/20">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/20 ring-1 ring-[#25D366]/40">
            <MessageCircle aria-hidden className="h-5 w-5 text-severity-green-300" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-severity-green-300">
              WhatsApp Lifeline
            </p>
            <h2 className="mt-0.5 text-base font-bold text-white">
              District alerts &amp; SOS on WhatsApp
            </h2>
          </div>
        </div>

        <div className="mt-4 flex flex-1 flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              void subscribeWhatsApp();
            }}
            disabled={subscribed}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3.5 text-base font-bold text-[#062b14] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-default disabled:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
          >
            {subscribed ? (
              <>
                <Check aria-hidden className="h-5 w-5" />
                Preference saved
              </>
            ) : (
              <>
                <MessageCircle aria-hidden className="h-5 w-5" />
                Get WhatsApp Alerts
              </>
            )}
          </button>

          {WHATSAPP_SOS_CONFIGURED ? <a
            href={sosHref}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3.5 text-base font-bold text-white transition hover:bg-red-500 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            <ShieldAlert aria-hidden className="h-5 w-5" />
            SOS via WhatsApp
          </a> : <p role="status" className="rounded-lg border border-amber-400/40 p-3 text-sm font-semibold text-amber-100">WhatsApp SOS is not configured. Use local emergency contacts directly.</p>}
        </div>
      </div>
    </section>
  );
}
