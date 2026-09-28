"use client";

import { useState } from "react";
import { Check, Copy, MessageSquare, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// ---------------------------------------------------------------------
// components/public/SosCodecPanel.tsx — Phase 2 · SOS relay surfaces.
//
// Shows the compact SOS code (SOS1,lat,lng,need,HHMM*checksum) with three
// no-internet relay paths:
//   • Copy — paste into any satellite messenger (Bullitt/Motorola app,
//     Garmin inReach), WhatsApp, or read aloud over IVR/voice.
//   • QR — a second phone with signal scans it and sends it on.
//   • SMS — opens the messaging app with the code pre-filled; the user
//     picks the recipient (family ICE contact, responder, control room).
//
// Honesty note is in the UI copy: SMS delivery to helplines varies by
// carrier/state — this panel never claims the SMS was received.
// ---------------------------------------------------------------------

export default function SosCodecPanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard API unavailable (permissions/insecure context) — legacy fallback.
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* user can still select the text manually */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const smsHref = `sms:?body=${encodeURIComponent(`EMERGENCY SOS ${code}`)}`;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        No internet? Relay this code
      </p>
      <p className="break-all rounded-lg bg-black/40 px-3 py-2.5 font-mono text-sm text-emerald-300">
        {code}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy code"}
        </button>
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          aria-expanded={showQr}
          className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition"
        >
          <QrCode size={12} />
          {showQr ? "Hide QR" : "Show QR"}
        </button>
        <a
          href={smsHref}
          className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition"
        >
          <MessageSquare size={12} />
          Send via SMS
        </a>
      </div>
      {showQr && (
        <div className="mx-auto w-fit rounded-xl bg-white p-3">
          <QRCodeSVG value={code} size={160} level="M" marginSize={1} />
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-slate-500">
        Read it aloud, type it into a satellite messenger, or let a second phone scan
        the QR and send it on. SMS delivery to helplines varies by carrier and state —
        confirm with a call whenever you can.
      </p>
    </div>
  );
}
