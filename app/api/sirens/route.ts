import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/security/require-role";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { listSirenTowers } from "@/lib/sirens/controller";

export const dynamic = "force-dynamic";

const GOV_ROLES = ["super_admin", "district_admin", "field_responder"] as const;

const sirenLimiter = createRateLimiter(30, 60_000);

/**
 * GET /api/sirens — list outdoor-warning towers (?district= optional).
 * Gov roles only (siren detail never public).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(GOV_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const limit = sirenLimiter(`sirens:${ip}`);
  if (!limit.success) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const district = searchParams.get("district")?.trim() || undefined;

  const towers = await listSirenTowers(district);
  return NextResponse.json({ ok: true, towers });
}
