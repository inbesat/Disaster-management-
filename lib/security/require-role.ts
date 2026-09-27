// ---------------------------------------------------------------------
// lib/security/require-role.ts — Step 7 · Government API role guard
//
// requireRole(allowedRoles) resolves the caller's role the same way the
// middleware does — Supabase profile when configured, the demo `role`
// cookie otherwise — and admits the request only when the role satisfies
// the required access. Supports role hierarchy:
// super_admin > district_admin > field_responder > viewer > public.
//
//   const auth = await requireRole(GOV_ROLES);
//   if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
// ---------------------------------------------------------------------

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeLog } from "@/lib/logger";

export type RequireRoleResult =
  { ok: true; role: string } | { ok: false; status: 401 | 403; error: string };

/**
 * Role hierarchy rank mapping.
 * Higher number = higher permission level.
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  district_admin: 80,
  field_responder: 60,
  viewer: 40,
  public: 20,
};

/**
 * Helper to check if user's role satisfies allowed roles or hierarchy.
 */
export function hasRequiredRole(
  userRole: string,
  allowedRoles: readonly string[],
): boolean {
  if (allowedRoles.includes(userRole)) return true;

  const userRank = ROLE_HIERARCHY[userRole] ?? 0;
  // If user's role rank is greater than or equal to the minimum rank among allowedRoles, permit access.
  const allowedRanks = allowedRoles
    .map((r) => ROLE_HIERARCHY[r])
    .filter((rank): rank is number => rank !== undefined);

  if (allowedRanks.length === 0) return false;
  const minAllowedRank = Math.min(...allowedRanks);

  return userRank >= minAllowedRank;
}

function deny(authenticated: boolean): RequireRoleResult {
  return authenticated
    ? {
        ok: false,
        status: 403,
        error: "Forbidden: your role does not have access to this endpoint.",
      }
    : {
        ok: false,
        status: 401,
        error: "Unauthorized: a government session is required.",
      };
}

/**
 * Resolve the caller's role and check it against the allow-list or hierarchy.
 */
export async function requireRole(
  allowedRoles: readonly string[],
): Promise<RequireRoleResult> {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get("role")?.value ?? "";
  const isGuest = cookieStore.get("guest_mode")?.value === "true";

  if (isGuest) return deny(false);

  const demoEnabled = process.env.DEMO_AUTH_ENABLED === "true";
  const cookieAdmitted = roleCookie !== "" && hasRequiredRole(roleCookie, allowedRoles);

  if (demoEnabled && cookieAdmitted) return { ok: true, role: roleCookie };

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return demoEnabled && cookieAdmitted
      ? { ok: true, role: roleCookie }
      : deny(roleCookie !== "" && roleCookie !== "public");
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // No real Supabase session — admit the demo cookie session.
    if (!user) {
      return demoEnabled && cookieAdmitted ? { ok: true, role: roleCookie } : deny(false);
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role as string | undefined;
    if (!role) return deny(true);
    return hasRequiredRole(role, allowedRoles) ? { ok: true, role } : deny(true);
  } catch (error: unknown) {
    // Supabase unreachable (placeholder env, offline demo, vendor outage):
    // degrade to the SAME cookie-only demo admission the middleware applies
    // to /gov pages, instead of 401-ing every gov API route while the UI
    // itself still loads. Anonymous callers remain denied.
    safeLog("warn", "[requireRole] Supabase lookup failed; admitting demo role cookie", {
      metadata: { error: String(error) },
    });
    return demoEnabled && cookieAdmitted ? { ok: true, role: roleCookie } : deny(false);
  }
}

/**
 * Higher-order authorization wrapper for API route handlers (Prompt 5.5).
 */
export function requireRoleHandler(
  allowedRoles: readonly string[],
  handler: (req: Request, auth: { role: string }) => Promise<Response>,
) {
  return async (req: Request) => {
    const auth = await requireRole(allowedRoles);
    if (!auth.ok) {
      return new Response(JSON.stringify({ ok: false, error: auth.error }), {
        status: auth.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return handler(req, auth);
  };
}

/**
 * Centralized requireAuth wrapper for any authenticated session.
 */
export async function requireAuth(): Promise<RequireRoleResult> {
  return requireSession();
}

/**
 * requireSession() — weaker sibling of requireRole(): admits ANY signed-in
 * identity (guest_mode cookie, role cookie, or Supabase user) so citizen-facing
 * endpoints keep working for demo guests while blocking anonymous callers.
 */
export async function requireSession(): Promise<RequireRoleResult> {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get("role")?.value ?? "";
  const isGuest = cookieStore.get("guest_mode")?.value === "true";

  if (isGuest || roleCookie !== "") return { ok: true, role: roleCookie || "guest" };

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return deny(false);
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? { ok: true, role: user.id } : deny(false);
  } catch (error: unknown) {
    safeLog("error", "[requireSession] Supabase lookup failed; denying access", {
      metadata: { error: String(error) },
    });
    return deny(false);
  }
}
