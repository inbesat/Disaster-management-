// ---------------------------------------------------------------------
// lib/rag/embeddings.ts
// Converts text chunks into vector embeddings for the RAG pipeline.
//
// Uses the OpenAI client (text-embedding-3-small → 1536 dims). If the API key
// is missing or the call fails (no key, bad key, rate-limit, or a provider
// that does not offer embeddings), ingestion fails explicitly and retrieval
// can use keyword search over existing documents.
// ---------------------------------------------------------------------

import OpenAI from "openai";

export type EmbeddedChunk = {
  text: string;
  embedding: number[];
};

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

// Embeddings are OpenAI-specific (text-embedding-3-small is not served by
// DeepSeek), so pin the base URL to the OpenAI embeddings endpoint unless
// explicitly overridden.
const EMBEDDING_BASE_URL =
  process.env.OPENAI_EMBEDDING_BASE_URL || "https://api.openai.com/v1";

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

// ---------------------------------------------------------------------
// In-memory LRU embedding cache (Step 9).
// Re-queries like "Give me evacuation SOPs" don't re-hit OpenAI — identical
// query text returns a cached vector instantly, saving API spend. A simple
// Map (last-access → re-insert at tail) approximates LRU; the oldest entry is
// evicted once the cache exceeds its cap.
// ---------------------------------------------------------------------
interface LruCache {
  map: Map<string, number[]>;
  hits: number;
  misses: number;
}

const CACHE_CAP = 512;

const cache: LruCache = { map: new Map(), hits: 0, misses: 0 };

/** Normalise a query string so trivial differences don't defeat the cache. */
function cacheKeyFor(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function cacheGet(key: string): number[] | undefined {
  const found = cache.map.get(key);
  if (found) {
    // Touch → move to the most-recently-used (tail) position.
    cache.map.delete(key);
    cache.map.set(key, found);
    cache.hits += 1;
    return found;
  }
  cache.misses += 1;
  return undefined;
}

function cacheSet(key: string, vector: number[]) {
  cache.map.delete(key);
  cache.map.set(key, vector);
  // Evict the least-recently-used (head) entry when over capacity.
  if (cache.map.size > CACHE_CAP) {
    const oldest = cache.map.keys().next().value;
    if (oldest !== undefined) cache.map.delete(oldest);
  }
}

export type EmbeddingCacheStats = {
  size: number;
  capacity: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
};

/** Observable stats for the cost/transparency UI. */
export function getEmbeddingCacheStats(): EmbeddingCacheStats {
  return {
    size: cache.map.size,
    capacity: CACHE_CAP,
    hits: cache.hits,
    misses: cache.misses,
    hitRate:
      cache.hits + cache.misses === 0 ? 0 : cache.hits / (cache.hits + cache.misses),
    evictions: 0,
  };
}

/**
 * Generate an embedding vector for every provided chunk. Returns
 * `{ text, embedding }[]`. Failure rejects without storing synthetic vectors. Identical
 * text already cached (Step 9) short-circuits to the stored vector.
 */
export async function generateEmbeddings(textChunks: string[]): Promise<EmbeddedChunk[]> {
  const cleanChunks = (textChunks ?? []).filter(
    (c) => typeof c === "string" && c.length > 0,
  );
  if (cleanChunks.length === 0) return [];

  // Split into chunks already cached (serve instantly) vs. those we must embed.
  const results: EmbeddedChunk[] = [];
  const pending: string[] = [];
  const keysOfPending: string[] = [];

  for (const chunk of cleanChunks) {
    const key = cacheKeyFor(chunk);
    const cached = cacheGet(key);
    if (cached) {
      results.push({ text: chunk, embedding: cached });
    } else {
      pending.push(chunk);
      keysOfPending.push(key);
    }
  }
  if (pending.length === 0) return results;

  // Embed only the pending batch (real OpenAI call, or mock fallback).
  const embeddedBatch = await embedBatch(pending);

  for (let i = 0; i < embeddedBatch.length; i++) {
    const item = embeddedBatch[i];
    cacheSet(keysOfPending[i], item.embedding);
    results.push(item);
  }

  const byText = new Map(results.map((item) => [item.text, item]));
  return cleanChunks.map((text) => byText.get(text)!);
}

/** Single OpenAI (or mock) embedding call for a batch of uncached chunks. */
async function embedBatch(chunks: string[]): Promise<EmbeddedChunk[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No embedding provider configured. Use keyword retrieval until embeddings are configured.",
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_API_KEY
      ? EMBEDDING_BASE_URL
      : "https://openrouter.ai/api/v1",
    timeout: 6000,
    maxRetries: 0,
  });

  try {
    const response = await client.embeddings.create({
      model: process.env.OPENAI_API_KEY
        ? EMBEDDING_MODEL
        : "openai/text-embedding-3-small",
      dimensions: EMBEDDING_DIM,
      input: chunks,
    });
    const data = response.data;
    if (!data?.length) throw new Error("Empty embeddings response.");

    return chunks.map((text, index) => {
      const raw = data[index]?.embedding;
      if (
        !Array.isArray(raw) ||
        raw.length !== EMBEDDING_DIM ||
        raw.some((v) => !Number.isFinite(v))
      )
        throw new Error("Invalid embedding dimensions.");
      const embedding = normalize(raw);
      return { text, embedding };
    });
  } catch (error: unknown) {
    throw new Error("Embedding service unavailable; no synthetic vectors were stored.");
  }
}
