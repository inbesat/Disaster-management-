// ---------------------------------------------------------------------
// app/api/public/shelters/route.ts — Step 6 · Public API Endpoint
// (Cached & Sanitized)
//
// The fast, read-only shelter feed for the Citizen App.
//   • Rate limited to the `public` tier (30 req/min per IP) — 429 when
//     exhausted, with Retry-After.
//   • Data is cached at the edge for 5 minutes under the `public_shelters`
//     cache tag, so Gov writes can revalidateTag() it instantly (Step 8).
//   • Only citizen-safe fields leave this route (sanitizeShelterForPublic);
//     gov-only columns never reach the public payload.
// ---------------------------------------------------------------------

import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import {
  clientIpFromRequest,
  rateLimitByRole,
} from "@/lib/security/rate-limiter";
import { sanitizeShelterForPublic } from "@/lib/security/sanitize";
import { PUBLIC_SHELTERS_CACHE_TAG } from "@/lib/cache-tags";

/**
 * Edge cache floor for the data below (5 minutes).
 *
 * Next 14 nuance: reading `request` headers for the client IP keeps this
 * handler per-request, so the route-level `revalidate` acts as a floor
 * rather than a whole-response cache — the real caching + purge flows
 * through `fetchPublicShelters` (unstable_cache + tag) below, which is
 * exactly what revalidateTag(PUBLIC_SHELTERS_CACHE_TAG) invalidates.
 * Don't "simplify" the handler into a fully static route: that would cache
 * the rate-limit decision (including 429s) for 5 minutes.
 */
export const revalidate = 300;

/**
 * Tagged data cache. `revalidateTag("public_shelters")` fired by the
 * shelter write actions purges this immediately, so a Gov update reaches
 * the Citizen App without waiting out the 5-minute window.
 */
const fetchPublicShelters = unstable_cache(
  async () => {
    const rows = await prisma.shelter.findMany({
      where: { isDemo: false },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(sanitizeShelterForPublic);
  },
  [PUBLIC_SHELTERS_CACHE_TAG],
  { revalidate: 300, tags: [PUBLIC_SHELTERS_CACHE_TAG] },
);

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Step 5 · role-based rate limiting — public tier, keyed by client IP.
  const ip = clientIpFromRequest(request);
  const rate = rateLimitByRole("public", ip);
  if (!rate.success) {
    const retryAfterMs = Math.max(0, rate.resetTime - Date.now());
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded. Please try again shortly.", rate },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      },
    );
  }

  try {
    const shelters = await fetchPublicShelters();
    return NextResponse.json({ ok: true, shelters, source: "db" });
  } catch (error: unknown) {
    console.error("[public/shelters] Database unavailable", error);
    return NextResponse.json({ ok: false, shelters: [], source: "unavailable", error: "Shelter information is temporarily unavailable. Contact local authorities before travelling." }, { status: 503 });
  }
}
