"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/prisma";
import { extractTextFromPDF, chunkText } from "@/lib/rag/chunker";
import { generateEmbeddings } from "@/lib/rag/embeddings";
import { requireRole } from "@/lib/security/require-role";
import { sanitizeInput } from "@/lib/security/sanitize";

const ADMIN_ROLES = ["super_admin", "district_admin"] as const;

// ---------------------------------------------------------------------
// app/actions/documents.ts
// Server Action that ingests an emergency SOP/plan document into the RAG
// knowledge base (emergency_documents, pgvector vector(1536)).
//
// Pipeline: PDF buffer → extract text → chunk → embed → raw SQL INSERT.
// Database failures are reported honestly; updates preserve the prior document.
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// computeEmbeddingVersion - Phase 15 embedding versioning.
// Returns the NEXT version integer (current max for a source + 1) so
// re-uploads monotonically bump the version tracked on each chunk row.
// ---------------------------------------------------------------------
async function computeEmbeddingVersion(sourceKey: string): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<Array<{ current: number | bigint }>>`
      SELECT COALESCE(MAX(embedding_version), 0)::int AS current
      FROM public.emergency_documents
      WHERE metadata->>'source_key' = ${sourceKey}
    `;
    const current = rows?.[0]?.current;
    return Number(current ?? 0) + 1;
  } catch {
    return 1;
  }
}

export type IngestDocumentResult = {
  ok: boolean;
  ingested: number;
  chunks: number;
  title: string;
  district: string | null;
  documentType: string;
  message?: string;
};

const DEFAULT_DOCUMENT_TYPE = "procedure";

export async function ingestDocument(formData: FormData): Promise<IngestDocumentResult> {
  // Authorization check - only admins can ingest documents
  const auth = await requireRole(ADMIN_ROLES);
  if (!auth.ok) {
    return {
      ok: false,
      ingested: 0,
      chunks: 0,
      title: "",
      district: null,
      documentType: DEFAULT_DOCUMENT_TYPE,
      message: "Unauthorized: admin access required.",
    };
  }

  const file = formData.get("file") as File | null;
  const title = sanitizeInput(String(formData.get("title") ?? "Untitled document"))
    .trim()
    .slice(0, 300);
  const districtRaw = formData.get("district");
  const district =
    districtRaw && String(districtRaw).trim().length
      ? sanitizeInput(String(districtRaw)).trim().slice(0, 200)
      : null;
  const documentTypeRaw = formData.get("document_type");
  const documentType =
    documentTypeRaw && String(documentTypeRaw).trim()
      ? sanitizeInput(String(documentTypeRaw)).trim().slice(0, 100)
      : DEFAULT_DOCUMENT_TYPE;

  if (!file) {
    return {
      ok: false,
      ingested: 0,
      chunks: 0,
      title,
      district,
      documentType,
      message: "No file provided.",
    };
  }

  // Validate file type
  if (file.type !== "application/pdf") {
    return {
      ok: false,
      ingested: 0,
      chunks: 0,
      title,
      district,
      documentType,
      message: "Only PDF files are supported.",
    };
  }

  // Validate file size (max 50MB)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      ingested: 0,
      chunks: 0,
      title,
      district,
      documentType,
      message: "File too large. Maximum size is 50MB.",
    };
  }

  // 1) Extract + chunk. Any empty result short-circuits cleanly.
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromPDF(buffer);
  const chunks = await chunkText(text);
  if (chunks.length === 0) {
    return {
      ok: false,
      ingested: 0,
      chunks: 0,
      title,
      district,
      documentType,
      message: "No text extracted from the PDF.",
    };
  }

  // 2) Prefer real embeddings, preserving keyword ingestion during provider outages.
  const embedded = await generateEmbeddings(chunks).catch(() => []);
  const semantic = embedded.length === chunks.length;
  const rows = semantic
    ? embedded
    : chunks.map((text) => ({ text, embedding: null as number[] | null }));

  // 3) Persist each chunk as its own row (embedding → pgvector).
  let ingested = 0;
  try {
    // 3a) Versioning (Phase 15): derive a content source hash and the NEXT
    // version number, then delete any previous rows for that source BEFORE
    // inserting. This guarantees a re-uploaded document cleanly replaces stale
    // vectors instead of mixing old + new chunks together.
    const sourceKey = `${documentType}:${title}${district ? `:${district}` : ""}`;
    const version = await computeEmbeddingVersion(sourceKey);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
      DELETE FROM public.emergency_documents
      WHERE metadata->>'source_key' = ${sourceKey}
    `;

      const versionedMetadata = JSON.stringify({
        district,
        source: "document-ingestor",
        document_type: documentType,
        source_key: sourceKey,
        embedding_version: version,
      });

      for (const { text: chunkTextValue, embedding } of rows) {
        // The pgvector column isn't directly exposed through the typed client,
        // so insert with raw SQL, casting the array literal to vector(1536).
        await tx.$executeRaw`
        INSERT INTO public.emergency_documents (title, doc_type, content, metadata, embedding, embedding_source, embedding_version)
        VALUES (
          ${title},
          ${documentType},
          ${sanitizeInput(chunkTextValue).slice(0, 8000)},
          ${versionedMetadata}::jsonb,
          (${embedding ? `[${embedding.join(",")}]` : null})::vector(1536),
          ${sourceKey},
          ${version}
        )
      `;
        ingested++;
      }
    });
  } catch (error: unknown) {
    console.warn("[documents] document transaction failed.");
    return {
      ok: false,
      ingested: 0,
      chunks: chunks.length,
      title,
      district,
      documentType,
      message:
        "Document was not saved. Check database connectivity; the previous version is preserved.",
    };
  }

  revalidatePath("/documents");
  return {
    ok: true,
    ingested,
    chunks: chunks.length,
    title,
    district,
    documentType,
    message: semantic
      ? "Document saved with semantic search."
      : "Document saved for keyword search. Semantic embeddings are unavailable; retry backfill when the provider is available.",
  };
}
