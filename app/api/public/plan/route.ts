import { NextRequest, NextResponse } from "next/server";
import { householdSchema, generateHouseholdPlan } from "@/lib/public-safety/plan";
import { loadSafetyContext } from "@/lib/public-safety/context";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpFromRequest } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const rate = rateLimit(`public-plan:${clientIpFromRequest(request)}`, 5, 60000);
  if (!rate.success) return NextResponse.json({ error: "Please wait a minute before creating another plan." }, { status: 429, headers: { "Retry-After": "60" } });
  const body = await request.json().catch(() => null);
  const parsed = householdSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a location and a household size from 1 to 30. Keep additional details brief." }, { status: 400 });
  try {
    const context = await loadSafetyContext(parsed.data.location);
    return NextResponse.json(await generateHouseholdPlan(parsed.data, context), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The AI could not complete a validated plan. Retry shortly; check official local instructions in the meantime." }, { status: 503 });
  }
}
