"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/security/rate-limit";
import { consumeOtp, generateOtp, issueOtp, normalizePhone } from "@/lib/security/otp";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/scope";
import { safeLog } from "@/lib/logger";

const GUEST_COOKIE = "guest_mode";

// Shared cookie options for every demo session cookie. `path: "/"` is
// mandatory — without it Next.js scopes the cookie to the current route
// segment, so the session silently vanishes the moment the user switches
// pages (e.g. /dashboard ↔ /command-center /inventory) and the middleware
// bounces them back to /login. Centralised here so no login action can
// forget it.
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/** Set a demo session cookie with the full, site-wide options (path included). */
function setSessionCookie(name: string, value: string, maxAge: number) {
  cookies().set(name, value, { ...SESSION_COOKIE_OPTIONS, maxAge });
}

// Shared by Continue as Guest and the GetOTP demo bypass — keeps the cookie
// options (httpOnly/sameSite/secure/path/maxAge) in one place.
function setGuestCookie() {
  setSessionCookie(GUEST_COOKIE, "true", 60 * 60 * 24 * 7);
}

// ---------------------------------------------------------------------
// GetOTP passwordless responder login (Enterprise Security).
//
// Flow: sendOTP(phone) → GetOTP sends a 6-digit code by SMS; the user
// types it into the login page; verifyOTP(code) validates it and signs
// the responder in.
//
// CRITICAL HACKATHON FALLBACK: if GETOTP_API_KEY is missing the OTP is
// never sent — we log it safely and simulate success so the demo
// keeps working. The same fallback triggers on any API failure.
//
// GetOTP API (api.otp.dev): POST /v1/verifications with an X-OTP-Key
// header. We generate the code locally and pass it as the `code` field so
// the SMS always carries OUR code and verification stays a simple
// in-memory lookup (plus an optional Supabase sign-in attempt).
// ---------------------------------------------------------------------

const GETOTP_SEND_URL =
  process.env.GETOTP_SEND_URL ?? "https://api.otp.dev/v1/verifications";
const GETOTP_CHANNEL = process.env.GETOTP_CHANNEL ?? "sms";
const GETOTP_SENDER = process.env.GETOTP_SENDER ?? "GetOTP";

/**
 * Send a 6-digit OTP to the given phone number via GetOTP.
 * Fails open: missing key or API error → log the code and simulate success.
 */
export async function sendOTP(
  phoneNumber: string,
): Promise<{ ok: boolean; message: string }> {
  const phone = normalizePhone(phoneNumber);
  if (!phone) {
    return {
      ok: false,
      message: "Enter a valid phone number (digits only, with country code).",
    };
  }

  // Abuse guard: max 3 send requests per phone per 10 minutes (reuses the
  // shared in-memory rate limiter from lib/security/rate-limit.ts).
  const sendBudget = rateLimit(`getotp:send:${phone}`, 3, 10 * 60 * 1000);
  if (!sendBudget.success) {
    return {
      ok: false,
      message: "Too many OTP requests. Wait a few minutes and try again.",
    };
  }

  const code = generateOtp(6);
  const apiKey = process.env.GETOTP_API_KEY;

  if (!apiKey) {
    safeLog("info", "[getotp] DEMO — no GETOTP_API_KEY", { metadata: { phone, code } });
    issueOtp(code, phone);
    return {
      ok: true,
      message: "OTP sent (demo) — check the server console for the code.",
    };
  }

  try {
    const res = await fetch(GETOTP_SEND_URL, {
      method: "POST",
      headers: {
        "X-OTP-Key": apiKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        data: {
          channel: GETOTP_CHANNEL,
          sender: GETOTP_SENDER,
          phone,
          // Template UUID comes from the GetOTP dashboard. Until a real
          // template is configured the API rejects the call and we fall
          // back to the demo path below.
          ...(process.env.GETOTP_TEMPLATE_ID
            ? { template: process.env.GETOTP_TEMPLATE_ID }
            : {}),
          code,
        },
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`GetOTP returned ${res.status}`);

    issueOtp(code, phone);
    return { ok: true, message: "OTP sent to your phone. It expires in 5 minutes." };
  } catch (error: unknown) {
    safeLog("warn", "[getotp] API call failed — simulating success", {
      metadata: { error: String(error) },
    });
    safeLog("info", "[getotp] DEMO FALLBACK", { metadata: { phone, code } });
    issueOtp(code, phone);
    return {
      ok: true,
      message: "OTP sent (fallback demo) — check the server console for the code.",
    };
  }
}

/**
 * Verify the OTP code and sign the responder in.
 * On success, tries a real Supabase phone login first; falls back to the
 * guest_mode cookie (demo bypass) when that is not possible.
 */
export async function verifyOTP(code: string): Promise<{ ok: false; message: string }> {
  const token = (code ?? "").trim().replace(/\D/g, "");
  if (!/^\d{6}$/.test(token)) {
    return { ok: false, message: "Enter the code from your phone (6 digits)." };
  }

  if (process.env.DEMO_AUTH_ENABLED === "true") {
    setGuestCookie();
    redirect("/command-center");
  }

  // Brute-force guard: max 5 verify attempts per code per minute.
  const attemptBudget = rateLimit(`getotp:verify:${token}`, 5, 60 * 1000);
  if (!attemptBudget.success) {
    return { ok: false, message: "Too many attempts. Request a new code." };
  }

  // Consume the code (single-use). null for unknown/expired/malformed.
  const phone = consumeOtp(token);
  if (!phone) {
    return { ok: false, message: "Invalid or expired code. Request a new one." };
  }

  // Real-mode path: the phone must be a Supabase Auth user that received a
  // matching code. Since GetOTP (not Supabase) generated this code, this
  // usually fails and we fall through to the demo guest login below.
  const realMode = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.GETOTP_API_KEY);
  if (realMode) {
    let signedIn = false;
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
      signedIn = !error;
    } catch (error: unknown) {
      safeLog(
        "warn",
        "[getotp] Supabase OTP sign-in failed — falling back to guest demo",
        { metadata: { error: String(error) } },
      );
    }
    if (signedIn) redirect("/command-center");
  }

  // Demo bypass: mark the responder as a guest, exactly like Continue as Guest.
  setGuestCookie();
  redirect("/command-center");
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  cookies().delete(GUEST_COOKIE);
  cookies().delete("role");
  cookies().delete("view_as_public");
  cookies().delete("demo_mode");
  cookies().delete(DEMO_SESSION_COOKIE);
  cookies().delete("citizen_phone");
  cookies().delete("sandbox");
  redirect("/");
}

export async function setGuestMode() {
  cookies().delete("role");
  cookies().delete("view_as_public");
  cookies().delete("demo_mode");
  cookies().delete(DEMO_SESSION_COOKIE);
  cookies().delete("citizen_phone");
  cookies().delete("sandbox");
  setGuestCookie();
  redirect("/command-center");
}

export async function clearGuestMode() {
  cookies().delete(GUEST_COOKIE);
  cookies().delete("role");
  cookies().delete("view_as_public");
  cookies().delete("demo_mode");
  cookies().delete(DEMO_SESSION_COOKIE);
  cookies().delete("citizen_phone");
  cookies().delete("sandbox");
  redirect("/");
}

export async function enableGuestMode() {
  cookies().delete("view_as_public");
  cookies().delete("demo_mode");
  cookies().delete(DEMO_SESSION_COOKIE);
  cookies().delete("citizen_phone");
  cookies().delete("sandbox");
  setSessionCookie("role", "public", 60 * 60 * 24 * 7);
  setGuestCookie();
  redirect("/public/dashboard");
}

export async function exitGuestMode() {
  cookies().delete("guest_mode");
  cookies().delete("role");
  cookies().delete("view_as_public");
  cookies().delete("demo_mode");
  cookies().delete(DEMO_SESSION_COOKIE);
  cookies().delete("citizen_phone");
  cookies().delete("sandbox");
  redirect("/");
}

export async function govLogin(
  role: "district_admin" | "super_admin" = "district_admin",
) {
  cookies().delete("guest_mode");
  cookies().delete("view_as_public");
  cookies().delete("demo_mode");
  cookies().delete(DEMO_SESSION_COOKIE);
  cookies().delete("citizen_phone");
  cookies().delete("sandbox");
  setSessionCookie("role", role, 60 * 60 * 24 * 7);
  redirect(role === "super_admin" ? "/gov/overview" : "/gov/dashboard");
}

export async function govDemoLogin() {
  cookies().delete("guest_mode");
  cookies().delete("view_as_public");
  cookies().delete("citizen_phone");
  cookies().delete("sandbox");
  setSessionCookie("demo_mode", "true", 60 * 60 * 24);
  setSessionCookie(DEMO_SESSION_COOKIE, randomUUID(), 60 * 60 * 24);
  setSessionCookie("role", "district_admin", 60 * 60 * 24 * 7);
  redirect("/gov/dashboard");
}

export async function publicDemoLogin() {
  cookies().delete("guest_mode");
  cookies().delete("view_as_public");
  cookies().delete("citizen_phone");
  cookies().delete("sandbox");
  setSessionCookie("demo_mode", "true", 60 * 60 * 24);
  setSessionCookie(DEMO_SESSION_COOKIE, randomUUID(), 60 * 60 * 24);
  setSessionCookie("role", "public", 60 * 60 * 24 * 7);
  redirect("/public/dashboard");
}

export async function exitDemoMode() {
  cookies().delete("demo_mode");
  cookies().delete(DEMO_SESSION_COOKIE);
  cookies().delete("guest_mode");
  cookies().delete("role");
  cookies().delete("view_as_public");
  cookies().delete("citizen_phone");
  cookies().delete("sandbox");
  redirect("/demo");
}

export async function clearDemoSession() {
  cookies().delete("demo_mode");
  cookies().delete(DEMO_SESSION_COOKIE);
  cookies().delete("guest_mode");
  cookies().delete("role");
  cookies().delete("view_as_public");
  cookies().delete("citizen_phone");
  cookies().delete("sandbox");
}

export async function setViewAsPublic() {
  cookies().delete("guest_mode");
  setSessionCookie("view_as_public", "true", 60 * 60 * 24);
  redirect("/public/dashboard");
}

export async function clearViewAsPublic() {
  cookies().delete("view_as_public");
  redirect("/gov/dashboard");
}

export async function publicOtpLogin(phoneNumber: string) {
  const phone = (phoneNumber ?? "").trim().slice(0, 20);
  cookies().delete("guest_mode");
  cookies().delete("view_as_public");
  cookies().delete("demo_mode");
  cookies().delete(DEMO_SESSION_COOKIE);
  cookies().delete("sandbox");
  setSessionCookie("role", "public", 60 * 60 * 24 * 7);
  if (phone) {
    setSessionCookie("citizen_phone", phone, 60 * 60 * 24 * 7);
  }
  redirect("/public/onboarding");
}

export async function signUpAction(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (process.env.DEMO_AUTH_ENABLED === "true" && fullName && email && password) {
    setSessionCookie("role", "public", 60 * 60 * 24);
    redirect("/public/dashboard");
  }
  if (fullName.length < 2) {
    redirect(`/login?error=${encodeURIComponent("Please enter your full name.")}`);
  }
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    redirect(
      `/signup?error=${encodeURIComponent(
        "Password must be at least 8 characters long and contain at least one uppercase letter and one number.",
      )}`,
    );
  }

  let failure: string | null = null;
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    failure = error?.message ?? null;
  } catch (error: unknown) {
    safeLog("error", "[auth] signUpAction failed", {
      metadata: { error: String(error) },
    });
    failure = "Could not create your account. Please try again.";
  }

  if (failure) {
    redirect(`/login?error=${encodeURIComponent(failure)}`);
  }

  redirect("/public/dashboard");
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Email and password are required.")}`);
  }

  if (process.env.DEMO_AUTH_ENABLED === "true") {
    const role = email.toLowerCase().includes("superadmin")
      ? "super_admin"
      : email.toLowerCase().includes("admin")
        ? "district_admin"
        : "public";
    cookies().delete("guest_mode");
    setSessionCookie("role", role, 60 * 60 * 24);
    redirect(
      role === "super_admin"
        ? "/gov/overview"
        : role === "district_admin"
          ? "/gov/dashboard"
          : "/public/dashboard",
    );
  }
  let failure: string | null = null;
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    failure = error?.message ?? null;
  } catch (error: unknown) {
    safeLog("error", "[auth] signInAction failed", {
      metadata: { error: String(error) },
    });
    failure = "Could not sign you in. Please try again.";
  }

  if (failure) {
    redirect(`/login?error=${encodeURIComponent(failure)}`);
  }

  redirect("/public/dashboard");
}

export async function guestLoginAction() {
  await enableGuestMode();
}
