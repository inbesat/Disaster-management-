import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { demoWhere, resolveDemoScope } from "@/lib/demo/scope";
import { approvedResponderIdentity } from "@/lib/portal/identity";
import { anonymizePII } from "@/lib/security/sanitize";

export const dynamic = "force-dynamic";
export async function GET() {
  const actor = await approvedResponderIdentity();
  if (!actor) return NextResponse.json({ error: "Approved responder access required." }, { status: 403 });
  try {
    const rows = await prisma.crowdsourcedReport.findMany({
      where: { ...demoWhere(resolveDemoScope()), verificationStatus: { not: "rejected" } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(
      {
        reports: rows.map((r) => ({
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          report_type: r.reportType,
          source: r.source,
          raw_text: anonymizePII(r.rawText),
          confidence_score: r.confidenceScore,
          verification_status: r.verificationStatus,
          severity: r.priority === "critical" ? 90 : r.priority === "high" ? 65 : 40,
          people_trapped: r.reportType === "rescue",
          people_count: 0,
          locations: [],
          summary: anonymizePII(r.rawText).slice(0, 180),
          created_at: r.createdAt.toISOString(),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Report feed unavailable." }, { status: 503 });
  }
}
