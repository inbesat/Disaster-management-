"use client";

import { useState } from "react";
import {
  Phone,
  MapPin,
  AlertTriangle,
  Shield,
  Loader2,
  CheckCircle2,
  Accessibility,
} from "lucide-react";
import PublicBackButton from "@/components/public/PublicBackButton";

// ---------------------------------------------------------------------
// app/(public)/sos/page.tsx — Standalone Emergency SOS Page
//
// Public, no-auth page for citizens to send an emergency SOS.
// Includes PWD priority flag. Works on any device with a browser.
// URL: /sos
// ---------------------------------------------------------------------

type Gps = { lat: number; lng: number };

const EMERGENCY_CONTACTS = [
  {
    label: "National Emergency",
    number: "112",
    description: "Police / Fire / Ambulance",
  },
  { label: "Disaster Helpline", number: "1070", description: "NDRF / SDRF" },
  { label: "Ambulance", number: "108", description: "Medical Emergency" },
  { label: "Women Helpline", number: "1091", description: "Women in distress" },
];

export default function SosPage() {
  const [gps, setGps] = useState<Gps | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isPwd, setIsPwd] = useState(false);
  const [pwdDetails, setPwdDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sosId, setSosId] = useState<string | null>(null);
  const [sosError, setSosError] = useState<string | null>(null);

  function captureLocation() {
    setGpsLoading(true);
    setGpsError(null);
    if (!("geolocation" in navigator)) {
      setGpsError("GPS not available on this device.");
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => {
        setGpsError("Could not access location. Please enable GPS.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSos(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSosError(null);
    try {
      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || "Unknown",
          phone: phone || null,
          message: message || "SOS — Emergency assistance needed",
          lat: gps?.lat ?? null,
          lng: gps?.lng ?? null,
          isPwd,
          pwdDetails: isPwd ? pwdDetails || "Person with disability" : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSosError(
          data.error ??
            "SOS could not be recorded. Call your local emergency number now.",
        );
        return;
      }
      setSosId(data.sosId);
      setSubmitted(true);
    } catch {
      setSosError("SOS could not be sent. Call your local emergency number now.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 size={40} className="text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">SOS Report Recorded</h1>
            <p className="text-slate-400">
              Your report was saved. Responder notification has not been confirmed.
            </p>
            {sosId && (
              <p className="text-xs text-slate-500 mt-2 font-mono">
                Reference: {sosId.slice(0, 8)}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-300">
              Call your local emergency number for immediate help. Keep your location
              available if it is safe to do so.
            </p>
          </div>
          <button
            onClick={() => {
              setSubmitted(false);
              setSosId(null);
              setName("");
              setPhone("");
              setMessage("");
              setIsPwd(false);
              setPwdDetails("");
              setGps(null);
            }}
            className="rounded-full border border-white/20 px-6 py-2.5 text-sm text-white hover:bg-white/10 transition"
          >
            Send Another SOS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary p-4 sm:p-6 relative">
      <PublicBackButton />
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-red-500/15 border-2 border-red-500/30 flex items-center justify-center animate-pulse">
              <AlertTriangle size={32} className="text-red-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">Emergency SOS</h1>
          <p className="text-sm text-slate-400">
            Send your location and status to nearby responders immediately.
          </p>
        </div>

        {/* Emergency Contacts Quick Dial */}
        <div className="grid grid-cols-2 gap-2">
          {EMERGENCY_CONTACTS.map((c) => (
            <a
              key={c.number}
              href={`tel:${c.number}`}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition group"
            >
              <Phone
                size={16}
                className="text-emerald-400 group-hover:scale-110 transition"
              />
              <div>
                <p className="text-sm font-semibold text-white">{c.label}</p>
                <p className="text-xs text-slate-500">
                  {c.number} · {c.description}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* SOS Form */}
        <form onSubmit={handleSos} className="space-y-4">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield size={18} className="text-red-400" />
              SOS Alert
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 outline-none"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 outline-none"
                  placeholder="Optional — for callback"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                What&apos;s happening?
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 outline-none resize-none"
                rows={2}
                placeholder="e.g. Trapped in flood water, need immediate rescue"
              />
            </div>

            {/* PWD Toggle */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPwd}
                  onChange={(e) => setIsPwd(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                />
                <Accessibility size={16} className="text-blue-400" />
                <span className="text-sm font-medium text-blue-400">
                  Person with Disability (PWD) — Priority Rescue
                </span>
              </label>
              {isPwd && (
                <input
                  type="text"
                  value={pwdDetails}
                  onChange={(e) => setPwdDetails(e.target.value)}
                  className="w-full rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/50 outline-none"
                  placeholder="e.g. Wheelchair user, visually impaired..."
                />
              )}
            </div>
          </div>

          {/* GPS Location */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <MapPin size={16} className="text-accent" />
                {gps ? (
                  <span>
                    Location captured: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                  </span>
                ) : (
                  <span>No location captured yet</span>
                )}
              </div>
              <button
                type="button"
                onClick={captureLocation}
                disabled={gpsLoading}
                className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition disabled:opacity-50"
              >
                {gpsLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <MapPin size={12} />
                )}
                {gps ? "Refresh" : "Get Location"}
              </button>
            </div>
            {gpsError && <p className="text-xs text-amber-400">{gpsError}</p>}
          </div>

          {sosError && (
            <p
              role="alert"
              className="rounded-xl border border-red-400 bg-red-950 p-3 text-sm font-semibold text-white"
            >
              {sosError}
            </p>
          )}

          {/* SOS Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-red-600 py-4 text-lg font-bold text-white shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:bg-red-500 hover:shadow-[0_0_40px_rgba(220,38,38,0.5)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Sending SOS...
              </>
            ) : (
              <>
                <AlertTriangle size={20} />
                SEND SOS NOW
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600">
          Your report is recorded when the service is available. Contact emergency
          services directly for immediate help.
        </p>
      </div>
    </div>
  );
}
