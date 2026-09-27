"use client";

// ---------------------------------------------------------------------
// app/(auth)/login/UnifiedLoginPage.tsx — Unified Login Surface.
//
// Single entry point for BOTH citizen and gov authentication. A mode
// switcher (segmented tabs: "Citizen" vs "Government Responder") drives
// which form is rendered. The ?mode= query param sets the initial tab
// so old links (/public/login → /login?mode=citizen, /gov/login →
// /login?mode=gov) land on the correct form.
//
// Auth mechanisms are NOT merged — they are legitimately different:
//   • Citizen  → phone + 6-digit OTP  → publicOtpLogin()
//   • Gov      → email + password     → govLogin()
//
// After successful login the SERVER ACTIONS handle redirects. The
// middleware's existing dual-mode guards (isPublicRole → /public/dashboard,
// isGovRole → /gov/dashboard) fire as before — no redirect logic here.
//
// Guest mode ("Continue as Guest") is always available and calls
// enableGuestMode() (sets role=public + guest_mode cookies).
// ---------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { publicOtpLogin, govLogin, enableGuestMode } from "@/app/actions/auth";

type LoginMode = "citizen" | "gov" | "field";

/** Demo role options for the gov form (Phase 7 · Step 10). */
const DEMO_ROLES = [
  { key: "district_admin" as const, label: "District Admin", description: "District Command Center" },
  { key: "super_admin" as const, label: "Super Admin", description: "State HQ Multi-District Overview" },
];

export default function UnifiedLoginPage() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const initialMode: LoginMode =
    modeParam === "gov" ? "gov" : modeParam === "field" ? "field" : "citizen";

  const [mode, setMode] = useState<LoginMode>(initialMode);

  // Sync mode with URL query param when it changes (e.g. back/forward nav).
  useEffect(() => {
    const next = modeParam === "gov" ? "gov" : modeParam === "field" ? "field" : "citizen";
    setMode(next);
  }, [modeParam]);

  return (
    <main className="landing-page relative flex min-h-screen flex-col overflow-hidden bg-[var(--dl-navy)]">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_-10%,rgba(37,99,235,0.18),transparent),radial-gradient(ellipse_50%_40%_at_0%_110%,rgba(249,115,22,0.14),transparent)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
        {/* Back to landing */}
        <Link
          href="/"
          className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--dl-text-muted)] transition hover:text-white"
        >
          ← Back to SafeSphere
        </Link>

        <div className="rounded-[var(--dl-radius)] border border-white/10 bg-white/5 p-7 backdrop-blur-md md:p-8">
          {/* Brand header */}
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--dl-blue)]/30 to-[var(--dl-orange)]/30 ring-1 ring-white/20">
              <ShieldCheck aria-hidden className="h-5 w-5 text-white" />
            </span>
            <div className="min-w-0">
              <p className="eoc-label text-[var(--dl-blue-light)]">SAFESPHERE · SIGN IN</p>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Emergency Portal
              </h1>
            </div>
          </div>

          {/* ---- Mode switcher (segmented tabs) ---- */}
          <div
            role="tablist"
            aria-label="Login mode"
            className="mt-6 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/5 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "citizen"}
              data-testid="mode-citizen"
              onClick={() => setMode("citizen")}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                mode === "citizen"
                  ? "bg-[var(--dl-orange)] text-white shadow"
                  : "text-[var(--dl-text-muted)] hover:text-white"
              }`}
            >
              <Home aria-hidden className="h-4 w-4" />
              Citizen
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "gov"}
              data-testid="mode-gov"
              onClick={() => setMode("gov")}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                mode === "gov"
                  ? "bg-[var(--dl-blue)] text-white shadow"
                  : "text-[var(--dl-text-muted)] hover:text-white"
              }`}
            >
              <ShieldCheck aria-hidden className="h-4 w-4" />
              Government
            </button>
            <button type="button" role="tab" aria-selected={mode === "field"} data-testid="mode-field" onClick={() => setMode("field")} className={`rounded-lg px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${mode === "field" ? "bg-cyan-500 text-slate-950" : "text-[var(--dl-text-muted)] hover:text-white"}`}>Field teams</button>
          </div>

          {/* ---- Active form panel ---- */}
          <div role="tabpanel" className="mt-6">
            {mode === "citizen" ? <CitizenForm /> : mode === "gov" ? <GovForm /> : <div><p className="eoc-label text-cyan-300">FIELD RESPONDER ACCESS</p><h2 className="mt-3 text-xl font-bold text-white">Verify public reports on site</h2><p className="mt-2 text-sm text-slate-300">For approved NGOs, police, medical and rescue teams.</p><Link href="/portal/login" className="mt-5 block rounded-xl bg-cyan-400 px-4 py-3 text-center font-bold text-slate-950">Open field portal →</Link></div>}
          </div>

          {/* ---- Divider ---- */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-widest text-[var(--dl-text-muted)]">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* ---- Guest access ---- */}
          <form action={enableGuestMode}>
            <button
              type="submit"
              data-testid="guest-login"
              className="flex w-full items-center justify-center gap-2 rounded-[var(--dl-radius-sm)] border-2 border-dashed border-[var(--dl-blue)]/40 bg-transparent px-4 py-3 text-sm font-semibold text-[var(--dl-blue-light)] transition hover:border-[var(--dl-blue)] hover:bg-white/5 hover:text-white"
            >
              <User aria-hidden className="h-4 w-4" />
              Continue as Guest
            </button>
          </form>
          <p className="mt-1.5 text-center text-[11px] text-[var(--dl-text-muted)]">
            (Explore the platform with view-only permissions)
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--dl-text-muted)]">
          Emergency? Call the District Control Room{" "}
          <a
            href="tel:1070"
            className="font-semibold text-[var(--dl-orange-light)] hover:underline"
          >
            1070
          </a>
        </p>
      </div>
    </main>
  );
}

// =====================================================================
// CITIZEN FORM — phone + 6-digit OTP → publicOtpLogin()
// =====================================================================

function CitizenForm() {
  type Step = "phone" | "otp";
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === "otp") otpRefs.current[0]?.focus();
  }, [step]);

  function handlePhoneSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) {
      setError("Enter a valid phone number.");
      return;
    }
    setError(null);
    setStep("otp");
  }

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const chars = prev.split("");
      chars[index] = digit;
      return chars.join("");
    });
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6 - index);
    if (!pasted) return;
    e.preventDefault();
    setOtp(
      (prev) =>
        (prev.slice(0, index) + pasted + prev.slice(index + pasted.length)).slice(0, 6),
    );
    otpRefs.current[Math.min(index + pasted.length, 5)]?.focus();
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (otp.replace(/\D/g, "").length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await publicOtpLogin(phone);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  }

  const inputClass =
    "w-full rounded-[var(--dl-radius-sm)] border border-white/15 bg-white/5 px-4 py-3.5 text-base text-white placeholder:text-[var(--dl-text-muted)] transition focus:border-[var(--dl-orange)] focus:outline-none";

  if (step === "phone") {
    return (
      <>
        <p className="eoc-label mb-2 text-[var(--dl-orange-light)]">CITIZEN ACCESS</p>
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--dl-orange)]/20 text-3xl ring-1 ring-[var(--dl-orange)]/40"
        >
          🏠
        </span>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-white">
          Welcome, neighbor
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dl-text-on-navy)]">
          No passwords here. Enter your phone number and we&apos;ll send a
          one-time code — it takes seconds.
        </p>

        <form onSubmit={handlePhoneSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="citizen-phone" className="eoc-label mb-1.5 block text-[var(--dl-text-on-navy)]">
              Phone Number
            </label>
            <div className="relative">
              <Phone
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dl-text-muted)]"
              />
              <input
                id="citizen-phone"
                data-testid="citizen-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={`${inputClass} pl-11`}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-[var(--dl-radius-sm)] border border-[var(--dl-orange)]/40 bg-[var(--dl-orange)]/10 px-3 py-2 text-sm text-[var(--dl-orange-light)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="citizen-send-otp"
            className="flex w-full items-center justify-center gap-2 rounded-[var(--dl-radius-sm)] bg-[var(--dl-orange)] px-4 py-3.5 text-base font-bold text-white transition hover:bg-[#EA5B0C] disabled:opacity-60"
          >
            Send OTP
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </button>
          <p className="text-center text-xs text-[var(--dl-text-muted)]">
            Free of charge. Your number is only used for emergency alerts.
          </p>
        </form>
      </>
    );
  }

  // OTP step
  return (
    <>
      <p className="eoc-label mb-2 text-[var(--dl-orange-light)]">CITIZEN ACCESS</p>
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--dl-blue)]/20 ring-1 ring-[var(--dl-blue)]/40"
      >
        <KeyRound aria-hidden="true" className="h-7 w-7 text-[var(--dl-blue-light)]" />
      </span>
      <h2 className="mt-4 text-xl font-bold tracking-tight text-white">
        Enter the 6-digit code
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--dl-text-on-navy)]">
        Sent to <span className="font-semibold text-white">{phone}</span>.{" "}
        <span className="text-[var(--dl-orange-light)]">Demo:</span> any 6
        digits work — no SMS is sent.
      </p>

      <form onSubmit={handleVerify} className="mt-5 space-y-4">
        <div
          role="group"
          aria-label="6-digit verification code"
          className="flex justify-between gap-2"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <input
              key={index}
              ref={(el) => {
                otpRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              aria-label={`Digit ${index + 1}`}
              data-testid={`otp-digit-${index}`}
              value={otp[index] ?? ""}
              onChange={(e) => handleDigit(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={(e) => handlePaste(index, e)}
              className="h-14 w-11 rounded-[var(--dl-radius-sm)] border border-white/15 bg-white/5 text-center text-xl font-bold text-white transition focus:border-[var(--dl-orange)] focus:outline-none sm:w-12"
            />
          ))}
        </div>

        {error && (
          <p className="rounded-[var(--dl-radius-sm)] border border-[var(--dl-orange)]/40 bg-[var(--dl-orange)]/10 px-3 py-2 text-sm text-[var(--dl-orange-light)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          data-testid="citizen-verify"
          className="w-full rounded-[var(--dl-radius-sm)] bg-[var(--dl-orange)] px-4 py-3.5 text-base font-bold text-white transition hover:bg-[#EA5B0C] disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Verify & Continue"}
        </button>

        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setOtp("");
            setError(null);
          }}
          className="w-full text-center text-sm text-[var(--dl-text-muted)] transition hover:text-white"
        >
          ← Use a different number
        </button>
      </form>
    </>
  );
}

// =====================================================================
// GOV FORM — email + password + role selector → govLogin()
// =====================================================================

function GovForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"district_admin" | "super_admin">("district_admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid official email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await govLogin(role);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
    }
  }

  const inputClass =
    "w-full rounded-[var(--dl-radius-sm)] border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-[var(--dl-text-muted)] transition focus:border-[var(--dl-blue)] focus:outline-none";

  return (
    <>
      <p className="eoc-label mb-2 text-[var(--dl-blue-light)]">GOV ACCESS · SECURE CHANNEL</p>
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--dl-blue)]/20 ring-1 ring-[var(--dl-blue)]/40"
      >
        🛡️
      </span>
      <h2 className="mt-4 text-xl font-bold tracking-tight text-white">
        Responder / Official Sign In
      </h2>
      <p className="mt-1 text-sm text-[var(--dl-text-on-navy)]">
        Role-assigned credentials required. Contact your district admin for access.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="gov-email"
            className="eoc-label mb-1.5 block text-[var(--dl-text-on-navy)]"
          >
            Official Email
          </label>
          <div className="relative">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dl-text-muted)]"
            />
            <input
              id="gov-email"
              data-testid="gov-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@organisation.gov.in"
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        <div>
          <p className="eoc-label mb-1.5 block text-[var(--dl-text-on-navy)]">
            Demo Role
          </p>
          <div
            role="radiogroup"
            aria-label="Demo role"
            className="grid grid-cols-2 gap-2"
          >
            {DEMO_ROLES.map((option) => {
              const active = role === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`role-${option.key}`}
                  onClick={() => setRole(option.key)}
                  className={`rounded-[var(--dl-radius-sm)] px-3 py-2.5 text-left transition-all duration-200 ease-in-out ${
                    active
                      ? "border-2 border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                      : "cursor-pointer border-2 border-slate-700/50 bg-slate-800/30 hover:bg-slate-800 hover:border-slate-600"
                  }`}
                >
                  <span
                    className={`block text-sm ${active ? "font-bold text-blue-400" : "font-semibold text-slate-400"}`}
                  >
                    {option.label}
                  </span>
                  <span
                    className={`mt-0.5 block text-[0.6875rem] ${active ? "text-blue-200/70" : "text-slate-500"}`}
                  >
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="gov-password"
            className="eoc-label mb-1.5 block text-[var(--dl-text-on-navy)]"
          >
            Password
          </label>
          <div className="relative">
            <Lock
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dl-text-muted)]"
            />
            <input
              id="gov-password"
              data-testid="gov-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputClass} pl-10 pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dl-text-muted)] transition hover:text-white"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Eye aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-[var(--dl-radius-sm)] border border-[var(--dl-orange)]/40 bg-[var(--dl-orange)]/10 px-3 py-2 text-sm text-[var(--dl-orange-light)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          data-testid="gov-submit"
          className="flex w-full items-center justify-center gap-2 rounded-[var(--dl-radius-sm)] bg-[var(--dl-blue)] px-4 py-3.5 text-base font-bold text-white transition hover:bg-[var(--dl-blue-light)] disabled:opacity-60"
        >
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          {loading ? "Authenticating…" : "Sign In"}
        </button>

        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--dl-text-muted)]">
            Demo: any credentials work
          </span>
          <Link
            href="/gov/signup"
            className="font-semibold text-[var(--dl-blue-light)] transition hover:text-white"
          >
            Request access →
          </Link>
        </div>
      </form>
    </>
  );
}
