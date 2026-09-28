import { NextRequest, NextResponse } from "next/server";
import { loadSafetyContext } from "@/lib/public-safety/context";
import { locationSchema } from "@/lib/public-safety/location";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const result = locationSchema.safeParse({ district: params.get("district"),
    ...(params.has("lat") ? { lat: Number(params.get("lat")) } : {}),
    ...(params.has("lng") ? { lng: Number(params.get("lng")) } : {}) });
  if (!result.success) return NextResponse.json({ error: "Choose a supported district and valid coordinates." }, { status: 400 });
  return NextResponse.json(await loadSafetyContext(result.data), { headers: { "Cache-Control": "no-store" } });
}
