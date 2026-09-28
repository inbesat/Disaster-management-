import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { buildCapAtomFeed, buildCapRssFeed, toFeedItems } from "@/lib/cap/feed";

export const dynamic = "force-dynamic";

/**
 * GET /api/cap/feed — public CAP pull feed (no auth: mandated
 * dissemination). ?format=rss (default) | atom. ?limit= (1-100, default
 * 50). Broadcasters poll this instead of waiting for a push.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "rss").toLowerCase();
  if (format !== "rss" && format !== "atom") {
    return NextResponse.json(
      { ok: false, error: "format must be rss or atom." },
      { status: 400 },
    );
  }
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  try {
    const rows = await prisma.capAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { alertId: true, capXml: true, severity: true, language: true, createdAt: true },
    });
    const items = toFeedItems(rows, site);
    const xml = format === "atom" ? buildCapAtomFeed(items, site) : buildCapRssFeed(items, site);
    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": format === "atom" ? "application/atom+xml" : "application/rss+xml",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
