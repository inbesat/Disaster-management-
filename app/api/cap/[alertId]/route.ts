import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/cap/:alertId — raw CAP v1.2 XML for one alert (public, no
 * auth: mandated dissemination). This is what feed entries link to and
 * what broadcaster automation polls.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> },
): Promise<NextResponse> {
  const { alertId } = await params;
  if (!alertId) {
    return NextResponse.json({ ok: false, error: "alertId is required." }, { status: 400 });
  }
  try {
    const row = await prisma.capAlert.findUnique({ where: { alertId } });
    if (!row) {
      return NextResponse.json({ ok: false, error: "CAP alert not found." }, { status: 404 });
    }
    return new NextResponse(row.capXml, {
      status: 200,
      headers: {
        "Content-Type": "application/cap+xml",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
