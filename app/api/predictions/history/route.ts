import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { warnDbUnavailableOnce } from "@/lib/server/db-fallback";

export const dynamic = "force-dynamic";

// UI risk labels -> 0-3 index used as the chart's Y axis.
const RISK_INDEX: Record<string, number> = {
  Safe: 0,
  Watch: 1,
  Warning: 2,
  Evacuate: 3,
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const daysParam = Number(request.nextUrl.searchParams.get("days") ?? 7);
  const days = Math.min(14, Math.max(1, Number.isFinite(daysParam) ? daysParam : 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const rows = await prisma.floodPrediction.findMany({
      where: { predictionTimestamp: { gte: since }, isDemo: false },
      orderBy: { predictionTimestamp: "asc" },
      select: { riskLevel: true, predictionTimestamp: true },
    });

    if (rows.length === 0)
      return NextResponse.json({ source: "unavailable", points: [], total: 0 });

    // Bucket by ISO date so weeks remain chronological and never merge.
    const buckets = new Map<string, { total: number; count: number }>();
    for (const row of rows) {
      const day = new Date(row.predictionTimestamp).toISOString().slice(0, 10);
      const index = RISK_INDEX[row.riskLevel] ?? 0;
      const current = buckets.get(day) ?? { total: 0, count: 0 };
      current.total += index;
      current.count += 1;
      buckets.set(day, current);
    }

    const points = Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, bucket]) => ({
        day,
        riskIndex: Number((bucket.total / bucket.count).toFixed(2)),
        predictions: bucket.count,
      }));

    return NextResponse.json({ source: "real", points, total: rows.length });
  } catch (error: unknown) {
    warnDbUnavailableOnce("predictions/history", error);
    return NextResponse.json(
      { source: "unavailable", points: [], error: "Prediction history is unavailable" },
      { status: 503 },
    );
  }
}
