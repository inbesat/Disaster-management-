import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/security/require-role";
import {
  configuredIntegrations,
  naturalEvents,
  spaceWeather,
  countryInformation,
  notionDocuments,
} from "@/lib/integrations/sources";
import { createRateLimiter } from "@/lib/security/rate-limit";
const limiter = createRateLimiter(20, 60_000);
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const rate = limiter(
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anonymous",
  );
  if (!rate.success)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const kind = request.nextUrl.searchParams.get("source");
  if (kind !== "events" && kind !== "space-weather" && kind !== "country") {
    const auth = await requireRole(["district_admin", "super_admin"]);
    if (!auth.ok)
      return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    if (kind === "events") return NextResponse.json(await naturalEvents());
    if (kind === "space-weather") return NextResponse.json(await spaceWeather());
    if (kind === "country") {
      const q = request.nextUrl.searchParams.get("q")?.trim();
      if (!q || q.length > 80)
        return NextResponse.json(
          { error: "Country query is required (max 80 characters)." },
          { status: 400 },
        );
      return NextResponse.json(await countryInformation(q));
    }
    if (kind === "notion") return NextResponse.json(await notionDocuments());
    return NextResponse.json({ integrations: configuredIntegrations() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Integration unavailable" },
      { status: 503 },
    );
  }
}
