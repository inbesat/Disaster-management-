"use client";

import { useState } from "react";
import { KeyRound, Smartphone } from "lucide-react";
import { sendOTP, verifyOTP } from "@/app/actions/auth";

// ---------------------------------------------------------------------
// Passwordless Field Access (Enterprise Security · GetOTP).
// Two-step demo flow: any phone number, then any six-digit code.
// ---------------------------------------------------------------------

export default function PasswordlessLogin() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const res = await sendOTP(phone);
    setLoading(false);
    if (res.ok) {
      setNotice(res.message);
      setStep("code");
    } else {
      setError(res.message);
    }
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    // On success the server action signs the responder in and redirects to
    // /command-center, so the resolved result here is only ever a failure.
    const res = await verifyOTP(code);
    setLoading(false);
    if (!res.ok) setError(res.message);
  }

  const inputClass =
    "w-full rounded-md border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground placeholder:text-slate-500 focus:border-accent focus:outline-none";

  return (
    <section className="eoc-panel w-full max-w-md p-8">
      <p className="eoc-label mb-1 text-accent">FIELD LOGIN</p>
      <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
        <Smartphone className="h-5 w-5 text-accent" />
        Passwordless Field Access
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Enter any phone number and six-digit code. No SMS is sent in this demo.
      </p>

      {step === "phone" ? (
        <form onSubmit={handleSend} className="mt-5 space-y-4">
          <div>
            <label htmlFor="phone" className="eoc-label mb-1.5 block">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className={inputClass}
            />
          </div>

          {error && (
            <p className="rounded-md border border-severity-red-600 bg-severity-red-600/10 px-3 py-2 text-sm text-severity-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-accent/80 disabled:opacity-50"
          >
            {loading ? "Continuing…" : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="mt-5 space-y-4">
          <div>
            <label htmlFor="otp" className="eoc-label mb-1.5 block">
              6-Digit Code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className={`${inputClass} text-center text-lg tracking-[0.5em]`}
            />
            <p className="mt-1 text-xs text-slate-500">
              No code was sent to {phone || "your phone"}; any six digits work.
            </p>
          </div>

          {notice && (
            <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
              {notice}
            </p>
          )}
          {error && (
            <p className="rounded-md border border-severity-red-600 bg-severity-red-600/10 px-3 py-2 text-sm text-severity-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-accent/80 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {loading ? "Verifying…" : "Verify & Login"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setCode("");
              setNotice(null);
              setError(null);
            }}
            className="w-full text-center text-xs text-slate-400 transition hover:text-accent"
          >
            ← Use a different number
          </button>
        </form>
      )}
    </section>
  );
}
