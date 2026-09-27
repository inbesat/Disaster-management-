import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { demoWhere, resolveDemoScope } from "@/lib/demo/scope";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const rows = await prisma.crowdsourcedReport.findMany({
      where: {
        ...demoWhere(resolveDemoScope()),
        verificationStatus: "verified",
        completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        reportType: true,
        priority: true,
        createdAt: true,
      },
      orderBy: { completedAt: "desc" },
      take: 200,
    });
    return NextResponse.json(
      { reports: rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Verified reports are temporarily unavailable." },
      { status: 503 },
    );
  }
}
