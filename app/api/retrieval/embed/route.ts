import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { getEmbedding } from "@/lib/retrieval/retrieve";

export const dynamic = "force-dynamic";

import { requireRole, requireSession } from "@/lib/security/require-role";
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireSession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const district = request.nextUrl.searchParams.get("district")?.trim();
  if (!district || district.length > 100)
    return NextResponse.json({ error: "A valid district is required" }, { status: 400 });
  try {
    const results = await prisma.$queryRaw<
      { id: string; title: string; content: string }[]
    >`
      SELECT id, title, content FROM public.emergency_documents
      WHERE metadata->>'district' = ${district} AND content IS NOT NULL AND content != '' LIMIT 50
    `;
    return NextResponse.json({ ok: true, results });
  } catch {
    return NextResponse.json(
      { ok: false, results: [], error: "Knowledge database unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(["super_admin"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let docs: { id: string; title: string; content: string }[] = [];

  // Optional: embed a single new document by title+content.
  let body: { title?: string; content?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (typeof body.title === "string" && typeof body.content === "string") {
    return NextResponse.json(
      { error: "Use the document upload workflow to ingest a new document." },
      { status: 400 },
    );
  } else {
    try {
      docs = await prisma.$queryRaw<{ id: string; title: string; content: string }[]>`
        SELECT id, title, content
        FROM public.emergency_documents
        WHERE embedding IS NULL
        LIMIT 50
      `;
    } catch (error: unknown) {
      console.error("[retrieval] failed to read documents:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to read documents." },
        { status: 500 },
      );
    }
  }

  if (docs.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: "No documents awaiting embedding.",
      embedded: 0,
    });
  }

  let embedded = 0;
  for (const doc of docs) {
    const vector = await getEmbedding(`${doc.title}\n${doc.content}`);
    if (!vector) break;
    try {
      const vec = `[${vector.join(",")}]`;
      await prisma.$executeRaw`
        UPDATE public.emergency_documents
        SET embedding = (${vec}::vector),
            embedding_version = embedding_version + 1,
            embedding_source = ${"backfill:" + doc.title},
            updated_at = now()
        WHERE id = ${doc.id}::uuid
      `;
      embedded++;
    } catch (error: unknown) {
      console.warn("[retrieval] embedding write failed:", error);
    }
  }

  if (embedded === 0) {
    return NextResponse.json({
      ok: false,
      skipped:
        "No documents embedded. Check the embedding provider and database connection. Keyword retrieval remains available.",
      embedded: 0,
    });
  }

  return NextResponse.json({ ok: true, embedded, total: docs.length });
}
