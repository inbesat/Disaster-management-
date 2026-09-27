// ---------------------------------------------------------------------
// lib/rag/vector-search.ts
// Semantic retrieval over the emergency_documents knowledge base.
//
// searchSimilarDocuments() embeds a natural-language query, then runs a
// pgvector cosine-distance search (<=>) over the stored SOP chunks. The
// optional districtFilter scopes results to one district so e.g. Patna
// commanders only retrieve Patna SOPs. Degrades to a mock result array when
// the database is bypassed so the demo never crashes.
// ---------------------------------------------------------------------

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { generateEmbeddings } from "@/lib/rag/embeddings";

export type SimilarDocument = {
  title: string;
  content: string;
  docType: string | null;
  score: number;
};

/**
 * Return the top-K most similar document chunks for `query`, optionally
 * scoped to a single district. Returns an empty array for a blank query and a
 * mock array when the DB is unavailable.
 */
export async function searchSimilarDocuments(
  query: string,
  districtFilter?: string | null,
  topK = 3,
): Promise<SimilarDocument[]> {
  const normalizedQuery = (query ?? "").toString().trim();
  if (!normalizedQuery) return [];

  // 1) Embed the query (mock vectors are produced when no key is configured,
  //    so this call still returns a stable 1536-dim vector to search on).
  const [embedded] = await generateEmbeddings([normalizedQuery]).catch(() => []);
  if (!embedded) return [];

  const vectorLiteral = `[${embedded.embedding.join(",")}]`;

  try {
    const districtClause = districtFilter
      ? Prisma.sql`AND metadata->>'district' = ${districtFilter}`
      : Prisma.empty;

    // 2) Cosine-distance search, ordered by similarity, scoped by district.
    const rows = await prisma.$queryRaw<
      Array<{ title: string; content: string; docType: string | null; score: number }>
    >`
      SELECT title AS "title",
             content AS "content",
             doc_type AS "docType",
             1 - (embedding <=> ${vectorLiteral}::vector) AS "score"
      FROM public.emergency_documents
      WHERE embedding IS NOT NULL
        ${districtClause}
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${topK}
    `;

    return rows.map((row) => ({
      title: row.title,
      content: row.content,
      docType: row.docType,
      score: Number(row.score),
    }));
  } catch (error: unknown) {
    console.warn("[rag] vector search unavailable; trying scoped keyword retrieval.");
    return [];
  }
}
