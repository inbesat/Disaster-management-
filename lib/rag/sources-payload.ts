import type { SimilarDocument } from "./vector-search";
import type { RetrievedDocument } from "@/lib/retrieval/retrieve";

export type RagSourcePayload = {
  title: string;
  docType: string | null;
  score: number | null;
  snippet: string;
};

const MAX_SOURCES = 4;
const SNIPPET_MAX = 180;

function snippet(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > SNIPPET_MAX ? t.slice(0, SNIPPET_MAX - 1) + "…" : t;
}

export function buildRagSourcesPayload(
  vectorHits: SimilarDocument[],
  fallbackDocs: RetrievedDocument[] = [],
  max = MAX_SOURCES,
): RagSourcePayload[] {
  const seen = new Set<string>();
  const out: RagSourcePayload[] = [];

  for (const hit of vectorHits) {
    if (seen.has(hit.title)) continue;
    seen.add(hit.title);
    out.push({
      title: hit.title,
      docType: hit.docType,
      score: typeof hit.score === "number" ? Number(hit.score.toFixed(3)) : null,
      snippet: snippet(hit.content),
    });
    if (out.length >= max) return out;
  }

  for (const doc of fallbackDocs) {
    if (seen.has(doc.title)) continue;
    seen.add(doc.title);
    out.push({
      title: doc.title,
      docType: doc.docType,
      score: typeof doc.score === "number" ? Number(doc.score.toFixed(3)) : null,
      snippet: snippet(doc.content),
    });
    if (out.length >= max) return out;
  }

  return out;
}
