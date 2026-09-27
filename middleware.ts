import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Roles (mirrors lib/validations/user.ts). Keep in sync.
const ROLES = ["super_admin", "district_admin", "field_responder", "viewer"] as const;

// Phase 1 · Dual-Mode (mirrors the UserRole enum in prisma/schema.prisma).
// The mock `role` cookie is written by publicOtpLogin (role=public) and
// govLogin (role=district_admin) in app/actions/auth.ts.
const PUBLIC_ROLE = "public";
const GOV_ROLES = ["field_responder", "district_admin", "super_admin"] as const;

// Path prefixes requiring a user (authenticated or guest). Every entry is
// admit-through for any cookie session — a valid `role` cookie OR a
// guest_mode=true cookie — so demo users never get bounced back to /login
// when they switch between pages (e.g. /dashboard ↔ /command-center).
const PROTECTED_PATHS = [
  "/command-center",
  "/dashboard",
  "/inventory",
  "/alerts",
  "/field",
  "/shelter-update",
  "/shelters",
  "/evacuations",
  "/ai-planner",
  "/ngo-portal",
  "/settings",
];

// Phase 1 · Dual-mode dashboards. "Unauthenticated" here means no guest_mode
// cookie, no role cookie, and (when Supabase is configured) no session user —
// visitors matching none of those are bounced to "/".
const DASHBOARD_PATHS = ["/public/dashboard", "/gov/dashboard"] as const;

// ---------------------------------------------------------------------------
// ADMIN ROUTES (Phase 18). These back the Admin Control Panel. Access is
// STRICT: only super_admin and district_admin pass; everyone else (including
// demo guests) is bounced to /403. The matcher in `config` below must also
// list each of these so this middleware actually runs for them.
// ---------------------------------------------------------------------------
// Note: /dashboard (the Operational metrics overview) is deliberately NOT an
// admin route — it lives in the (dashboard) shell and is reachable by any
// cookie session, exactly like /command-center and /inventory.
const ADMIN_BASES = [
  "/admin",
  "/users",
  "/districts",
  "/bulk-ops",
  "/fm-stations",
  "/tts-preview",
  "/broadcast-monitor",
  "/analytics",
  "/audit-logs",
  "/health",
  "/satellite",
  // Settings · admin-only sections (Organization, Integrations). Non-admin
  // roles and guests are bounced to /403 here, like every other admin route.
  "/settings/organization",
  "/settings/integrations",
] as const;

const ADMIN_ROLES = ["super_admin", "district_admin"] as const;

type Role = (typeof ROLES)[number];

function matchesBase(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function isProtected(pathname: string) {
  return PROTECTED_PATHS.some((base) => matchesBase(pathname, base));
}

function isAdminRoute(pathname: string) {
  return ADMIN_BASES.some((base) => matchesBase(pathname, base));
}

function isDashboard(pathname: string) {
  return DASHBOARD_PATHS.some((base) => matchesBase(pathname, base));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isGuest = request.cookies.get("guest_mode")?.value === "true";
  const role = request.cookies.get("role")?.value ?? "";
  const viewAsPublic = request.cookies.get("view_as_public")?.value === "true";
  const isSandbox = request.cookies.get("sandbox")?.value === "true";
  const adminRequested = isAdminRoute(pathname);

  const isPublicRole = role === PUBLIC_ROLE;
  const isGovRole = (GOV_ROLES as readonly string[]).includes(role);
  const isOnGov = pathname === "/gov" || pathname.startsWith("/gov/");
  const isOnPublic = pathname === "/public" || pathname.startsWith("/public/");

  // Fast path: non-sandbox, non-admin API traffic. Public read-only API
  // endpoints (shelters, alerts, predictions, weather, etc.) are open by
  // design for the citizen app. Protected endpoints (chat, broadcast,
  // ingest, webhooks, admin) enforce auth via requireRole() in their
  // handlers. Sandbox traffic is handled separately below.
  if (pathname.startsWith("/api/") && !isSandbox) {
    const origin = request.headers.get("origin");
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    const allowed = new Set([
      request.nextUrl.origin,
      "http://localhost:3000",
      "https://safesphere0.netlify.app",
      ...(configured ? [configured.replace(/\/$/, "")] : []),
    ]);
    if (origin && !allowed.has(origin))
      return NextResponse.json(
        { error: "CORS error: Origin not allowed." },
        { status: 403 },
      );
    const signedWebhook =
      pathname.startsWith("/api/webhooks/") ||
      pathname.startsWith("/api/cron/") ||
      pathname === "/api/whatsapp/inbound";
    const readOnlyPost = pathname === "/api/chat" || pathname === "/api/predict";
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      !signedWebhook &&
      !readOnlyPost
    ) {
      const token = request.headers.get("x-csrf-token");
      const cookie = request.cookies.get("csrf_token")?.value;
      // Same-origin browser requests are protected by the Origin header;
      // clients without it must provide the double-submit token.
      if (!(origin && allowed.has(origin)) && (!token || token !== cookie))
        return NextResponse.json(
          { error: "CSRF token mismatch or missing." },
          { status: 403 },
        );
    }
    const response =
      request.method === "OPTIONS"
        ? new NextResponse(null, { status: 204 })
        : NextResponse.next();
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-CSRF-Token",
      );
      response.headers.set("Vary", "Origin");
    }
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; frame-ancestors 'none'; object-src 'none'",
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // =========================================================================
  // PHASE 15 · STEP 4 — JUDGES' SANDBOX (read-only Public Citizen session).
  //
  // Visiting /api/sandbox sets a short-lived `sandbox=true` cookie and lands
  // on /public/dashboard. From then on:
  //   • every non-GET request is answered with a mock success payload so
  //     forms take their normal success path (the client shows its usual
  //     success toast) but NOTHING is ever persisted — judges can click
  //     around as much as they like;
  //   • API reads still work (maps, shelters, alerts — the whole citizen
  //     app is functional);
  //   • gov/admin/field/auth/protected pages bounce back to the citizen
  //     dashboard, so a sandbox user can never wander into the Command
  //     Center or any privileged surface.
  // =========================================================================
  if (isSandbox) {
    // Lock down writes — mock success, never persist.
    if (request.method !== "GET" && request.method !== "HEAD") {
      // Server actions POST with a `next-action` header and expect an
      // RSC-encoded response — a bare JSON body makes the action client
      // throw. For those, return the redirect so the page simply reloads
      // (the UI's next paint reflects no change — read-only stays true).
      if (request.headers.get("next-action")) {
        const url = request.nextUrl.clone();
        url.pathname = "/public/dashboard";
        return NextResponse.redirect(url);
      }
      return NextResponse.json(
        {
          ok: true,
          mock: true,
          sandbox: true,
          message: "Sandbox read-only — change simulated, not saved.",
        },
        { status: 200 },
      );
    }
    // API reads pass straight through.
    if (pathname.startsWith("/api/")) {
      return NextResponse.next();
    }
    // Non-citizen surfaces → the citizen dashboard.
    if (
      pathname === "/" ||
      pathname === "/login" ||
      pathname === "/signup" ||
      matchesBase(pathname, "/auth") ||
      isOnGov ||
      adminRequested ||
      isProtected(pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/public/dashboard";
      return NextResponse.redirect(url);
    }
    // Citizen pages pass through as the read-only public identity.
    return NextResponse.next();
  }

  // =========================================================================
  // PHASE 1 · DUAL-MODE CROSSOVER GUARDS — users cannot slip into the wrong
  // mode. A public citizen visiting any /gov/* route is sent to the citizen
  // dashboard; a gov user visiting /public/* is sent back to the gov
  // dashboard UNLESS they hold the special view_as_public=true cookie.
  // =========================================================================
  if (isPublicRole && isOnGov) {
    const url = request.nextUrl.clone();
    url.pathname = "/public/dashboard";
    return NextResponse.redirect(url);
  }

  if (isGovRole && !viewAsPublic && isOnPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/gov/dashboard";
    return NextResponse.redirect(url);
  }

  // =========================================================================
  // PHASE 7 · STEP 10 — /gov/overview (Multi-District State HQ) is
  // super_admin-only. Any other gov role (or a public citizen slipping
  // through) is bounced to the district Command Center.
  // =========================================================================
  if (pathname === "/gov/overview" && role !== "super_admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/gov/dashboard";
    return NextResponse.redirect(url);
  }

  // =========================================================================
  // GUEST MODE: bypass auth/session/onboarding for the read-only demo, EXCEPT
  // the admin panel — guests must never reach admin controls.
  // =========================================================================
  if (isGuest) {
    // Guests on public/auth pages are sent to the appropriate landing spot:
    // a public guest (role=public, from enableGuestMode) goes to the citizen
    // dashboard; other guests keep the command-center target.
    if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
      const url = request.nextUrl.clone();
      url.pathname = role === PUBLIC_ROLE ? "/public/dashboard" : "/command-center";
      return NextResponse.redirect(url);
    }
    if (matchesBase(pathname, "/auth")) {
      const url = request.nextUrl.clone();
      url.pathname = role === PUBLIC_ROLE ? "/public/dashboard" : "/command-center";
      return NextResponse.redirect(url);
    }
    // Note: /public/login is deliberately NOT bounced here — the guest banner
    // invites guests to sign up, and publicOtpLogin upgrades them to a full
    // citizen session (it deletes guest_mode itself).

    // Strict: guests are never admitted to admin routes.
    if (adminRequested) {
      const url = request.nextUrl.clone();
      url.pathname = "/403";
      return NextResponse.redirect(url);
    }

    // Everything else passes straight through.
    return NextResponse.next();
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    // Cookie-only auth mode (no Supabase configured): the role cookie is the
    // auth signal — dual-mode dashboards still require it.
    if (isDashboard(pathname) && !role) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // CSRF protection for state-changing API routes
  if (
    pathname.startsWith("/api/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  ) {
    const csrfTokenHeader = request.headers.get("x-csrf-token");
    const csrfCookie = request.cookies.get("csrf_token")?.value;
    if (csrfCookie && csrfTokenHeader !== csrfCookie) {
      return NextResponse.json(
        { ok: false, error: "CSRF token mismatch." },
        { status: 403 },
      );
    }
  }

  let response = NextResponse.next({ request });

  // Security headers on response
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(self), microphone=(self), camera=()",
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Any protected OR admin route requires an authenticated user. A demo cookie
  // session — a valid `role` cookie (written by govLogin / publicOtpLogin /
  // enableGuestMode in app/actions/auth.ts) or a guest_mode=true cookie —
  // counts as authenticated even when no Supabase session is available. This
  // is the fix for the "bounced back to /login" bug: cookie-signed users are
  // admitted instead of being redirected on every protected route change.
  if (!user) {
    const hasCookieSession = isGuest || Boolean(role) || viewAsPublic;

    // Phase 1 · Dual-mode dashboards accept a cookie session as a valid
    // identity (citizen/gov logins don't create Supabase users in the demo).
    if (isDashboard(pathname) && !hasCookieSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if ((isProtected(pathname) || adminRequested) && !hasCookieSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    // Cookie-session users are admitted to all protected routes, but the
    // strict Admin Control Panel still enforces the admin role straight from
    // the cookie when there's no DB profile to consult — mirrors the
    // user + profile branch below.
    if (adminRequested && !ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
      const url = request.nextUrl.clone();
      url.pathname = "/403";
      return NextResponse.redirect(url);
    }

    return response;
  }

  if (user) {
    let role: Role | null = null;
    try {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      role =
        profile && ROLES.includes(profile.role as Role) ? (profile.role as Role) : null;
    } catch (error: unknown) {
      console.error("Failed to resolve user role in middleware:", error);
    }

    // Admin routes: strict role enforcement.
    if (adminRequested) {
      // A logged-in user without a completed profile must finish onboarding.
      if (!role) {
        const url = request.nextUrl.clone();
        url.pathname = "/profile-setup";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
      if (!ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
        const url = request.nextUrl.clone();
        url.pathname = "/403";
        return NextResponse.redirect(url);
      }
      // 2FA enforcement: admin users must verify 2FA before accessing admin routes.
      // NOTE: The 2fa_verified cookie is set server-side after real 2FA validation.
      // For cookie-only demo sessions (no Supabase user), skip 2FA enforcement
      // since there's no real identity to protect. For real Supabase users,
      // the 2FA status should be verified against the database, not just a cookie.
      if (user && !user.id.startsWith("guest")) {
        const twoFaVerified = request.cookies.get("2fa_verified")?.value === "true";
        if (!twoFaVerified) {
          const url = request.nextUrl.clone();
          url.pathname = "/2fa-setup";
          url.searchParams.set("next", pathname);
          return NextResponse.redirect(url);
        }
      }
    }

    // General protected routes: onboard users without a role.
    if (isProtected(pathname) && !role) {
      const url = request.nextUrl.clone();
      url.pathname = "/profile-setup";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/auth/:path*",
    // Phase 1 · Dual-Mode routes (crossover guards + dashboard protection)
    "/gov/:path*",
    "/public/:path*",
    "/command-center/:path*",
    "/dashboard/:path*",
    "/inventory/:path*",
    "/alerts/:path*",
    "/users/:path*",
    "/districts/:path*",
    "/bulk-ops/:path*",
    "/fm-stations/:path*",
    "/tts-preview/:path*",
    "/broadcast-monitor/:path*",
    "/analytics/:path*",
    "/audit-logs/:path*",
    "/health/:path*",
    "/satellite/:path*",
    "/admin/:path*",
    "/field/:path*",
    "/shelter-update",
    "/shelters",
    "/evacuations",
    "/ai-planner",
    "/ngo-portal/:path*",
    "/settings/:path*",
    // Phase 15 · Step 4 — the sandbox write-lockdown must cover EVERY API
    // route (a sandbox user could otherwise POST straight past the page
    // guards to /api/shelters/occupancy or similar). Non-sandbox API
    // traffic short-circuits at the top of the handler with zero auth work.
    "/api/:path*",
    "/settings/organization/:path*",
    "/settings/integrations/:path*",
  ],
};
