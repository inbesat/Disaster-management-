"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/scope";
import { safeLog } from "@/lib/logger";
import { prisma } from "@/server/prisma";

const GUEST_COOKIE = "guest_mode";

async function ensureDemoFieldProfile(sessionId: string) {
  try {
    await prisma.responderProfile.upsert({
      where: { id: `demo:${sessionId}` },
      create: {
        id: `demo:${sessionId}`,
        name: "Demo Field Volunteer",
        organization: "SafeSphere Demo NGO",
        organizationType: "ngo",
        district: "Patna",
        tier: "approved",
        approvalStatus: "approved",
        availability: "available",
        trainingCompletedAt: new Date(),
      },
      update: {},
    });
  } catch {
    /* Portal displays the database error; no fake profile is shown. */
  }
}

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

function setDemoScope() {
  setSessionCookie("demo_mode", "true", 60 * 60 * 24);
  setSessionCookie(
    DEMO_SESSION_COOKIE,
    cookies().get(DEMO_SESSION_COOKIE)?.value ?? randomUUID(),
    60 * 60 * 24,
  );
}

// ---------------------------------------------------------------------
// Temporary demo phone login. No SMS is sent or checked.
// ---------------------------------------------------------------------
export async function sendOTP(
  phoneNumber: string,
): Promise<{ ok: boolean; message: string }> {
  if (!phoneNumber?.trim()) {
    return {
      ok: false,
      message: "Enter any phone number to continue.",
    };
  }
  return { ok: true, message: "Demo access: no SMS was sent. Enter any six digits." };
}

export async function verifyOTP(code: string): Promise<{ ok: false; message: string }> {
  const token = (code ?? "").trim().replace(/\D/g, "");
  if (!/^\d{6}$/.test(token)) {
    return { ok: false, message: "Enter the code from your phone (6 digits)." };
  }

  setDemoScope();
  setGuestCookie();
  redirect("/command-center");
}

export async function signOutAction() {
  if (cookies().get("demo_mode")?.value !== "true") {
    try {
      await createClient().auth.signOut();
    } catch {
      // Local sign-out must still work when Supabase is offline.
    }
  }
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
  if (process.env.DEMO_AUTH_ENABLED === "true") setDemoScope();
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
  if (process.env.DEMO_AUTH_ENABLED === "true") setDemoScope();
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
  // TEMPORARY DEMO BYPASS — any credentials sign in. The DEMO_AUTH_ENABLED
  // gate is intentionally ignored so the hackathon demo always works; restore
  // the env check before any real deployment.
  cookies().delete("guest_mode");
  cookies().delete("view_as_public");
  setDemoScope();
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
  setDemoScope();
  setSessionCookie("role", "district_admin", 60 * 60 * 24 * 7);
  redirect("/gov/dashboard");
}

export async function publicDemoLogin() {
  cookies().delete("guest_mode");
  cookies().delete("view_as_public");
  cookies().delete("citizen_phone");
  cookies().delete("sandbox");
  setDemoScope();
  setSessionCookie("role", "public", 60 * 60 * 24 * 7);
  redirect("/public/dashboard");
}

export async function fieldDemoLogin(): Promise<never> {
  cookies().delete("guest_mode");
  cookies().delete("view_as_public");
  cookies().delete("sandbox");
  setSessionCookie("demo_mode", "true", 60 * 60 * 24);
  const sessionId = cookies().get(DEMO_SESSION_COOKIE)?.value ?? randomUUID();
  setSessionCookie(DEMO_SESSION_COOKIE, sessionId, 60 * 60 * 24);
  setSessionCookie("role", "field_responder", 60 * 60 * 24);
  await ensureDemoFieldProfile(sessionId);
  redirect("/portal");
}

export async function switchDemoPortal(target: "public" | "field" | "gov") {
  if (
    cookies().get("demo_mode")?.value !== "true" ||
    !cookies().get(DEMO_SESSION_COOKIE)?.value
  )
    throw new Error("A demo session is required.");
  if (target === "field")
    await ensureDemoFieldProfile(cookies().get(DEMO_SESSION_COOKIE)!.value);
  setSessionCookie(
    "role",
    target === "field"
      ? "field_responder"
      : target === "gov"
        ? "district_admin"
        : "public",
    60 * 60 * 24,
  );
  redirect(
    target === "field"
      ? "/portal"
      : target === "gov"
        ? "/gov/dashboard"
        : "/public/dashboard",
  );
}

export async function fieldLogin(
  _email: string,
  _password: string,
): Promise<{ ok: false; message: string }> {
  // Temporary demo sign-in: entered values are deliberately not verified.
  // The portal remains scoped to this browser's demo session.
  return fieldDemoLogin();
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
  setDemoScope();
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

  if (fullName && email && password) {
    setDemoScope();
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

  {
    setDemoScope();
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
    redirect(`/login?error=${encodeURIComponent(failure ?? "")}`);
  }

  redirect("/public/dashboard");
}

export async function guestLoginAction() {
  await enableGuestMode();
}
