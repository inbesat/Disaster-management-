// ---------------------------------------------------------------------
// lib/retrieval/retrieve.ts
// RAG retrieval over the emergency_documents knowledge base.
//
// Two-tier strategy (degrade gracefully, never throw):
//   1. Vector similarity via pgvector when an embedding can be produced
//      (requires an OpenAI-compatible embeddings key in the environment).
//   2. Keyword fallback over title/content when embeddings are unavailable,
//      so the AI planner still gets useful context without any keys.
// ---------------------------------------------------------------------

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";

export type RetrievedDocument = {
  id: string;
  title: string;
  content: string;
  docType: string | null;
  score?: number;
};

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

/**
 * Produce a 1536-dim embedding for text using an OpenAI-compatible embeddings
 * endpoint. Returns null when no key is available (or the call fails) — the
 * caller then falls back to keyword retrieval.
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const { generateEmbeddings } = await import("@/lib/rag/embeddings");
    return (await generateEmbeddings([text]))[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((term) => term.length > 2);
}

/**
 * Retrieve the most relevant emergency documents for a query. Prefers
 * pgvector similarity; falls back to keyword search. Returns [] on failure.
 */
export async function retrieveRelevantDocuments(
  query: string,
  limit = 4,
  district?: string,
  keywordOnly = false,
): Promise<RetrievedDocument[]> {
  // Attempt vector similarity first.
  const embedding = keywordOnly ? null : await getEmbedding(query);
  if (embedding) {
    try {
      const vector = `[${embedding.join(",")}]`;
      interface VectorDocRow {
        id: string;
        title: string;
        content: string;
        docType: string | null;
        score: number;
      }

      const rows = await prisma.$queryRaw<VectorDocRow[]>`
        SELECT id, title, content, doc_type AS "docType",
               1 - (embedding <=> ${vector}::vector) AS score
        FROM public.emergency_documents
        WHERE embedding IS NOT NULL
          ${district ? Prisma.sql`AND (metadata->>'district' = ${district} OR metadata->>'district' IS NULL)` : Prisma.empty}
        ORDER BY embedding <=> ${vector}::vector
        LIMIT ${limit}
      `;
      if (rows.length) {
        return rows.map((row) => ({
          id: String(row.id),
          title: String(row.title ?? ""),
          content: String(row.content ?? ""),
          docType: row.docType ? String(row.docType) : null,
          score: Number(row.score),
        }));
      }
    } catch (error: unknown) {
      console.warn("[retrieval] vector search failed, using keyword fallback.", error);
    }
  }

  // Keyword fallback (also used when no embedding provider is configured).
  const terms = tokenize(query);
  const keywords = terms.length ? terms : ["evacuation"];

  try {
    const docs = await prisma.emergencyDocument.findMany({
      where: {
        ...(district
          ? {
              AND: [
                {
                  OR: [
                    { metadata: { path: ["district"], equals: district } },
                    { metadata: { path: ["district"], equals: Prisma.AnyNull } },
                  ],
                },
              ],
            }
          : {}),
        OR: keywords.map((term) => ({
          OR: [
            { title: { contains: term, mode: "insensitive" as const } },
            { content: { contains: term, mode: "insensitive" as const } },
          ],
        })),
      },
      take: limit,
      select: { id: true, title: true, content: true, docType: true },
    });

    return docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      docType: doc.docType,
    }));
  } catch {
    return [];
  }
}

/**
 * Build a printable knowledge-base context block for the AI system prompt.
 * Returns an empty string when nothing is found (the planner still runs on
 * tool data + general knowledge).
 */
export async function buildKnowledgeContext(query: string, limit = 3): Promise<string> {
  const docs = await retrieveRelevantDocuments(query, limit);
  if (docs.length === 0) return "";

  return docs
    .map(
      (doc) =>
        `- [${doc.title}${doc.docType ? ` (${doc.docType})` : ""}]: ${doc.content}`,
    )
    .join("\n");
}
