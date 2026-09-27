"use client";

// ---------------------------------------------------------------------
// lib/ai-bridge/cloud-provider.ts — Offline-First Architecture · Phase 1
// CloudAIProvider: the online path of the AI Bridge. Streams the prompt to
// the existing SafeSphere planner UI API (app/api/chat/route.ts) via the
// AI SDK JSON protocol, so the bridge gets the SAME tool-calling planner
// the dashboard already uses — RAG grounding, district scoping, provider
// failover (Groq → OpenRouter → Bluesminds) all happen server-side.
//
// Status resolution: browser online → 'online' (the authoritative "can we
// reach the backend" check is the ConnectivityMonitor's heartbeat, which
// the bridge asks first before ever calling this provider).
// ---------------------------------------------------------------------

import type { AIProvider, AIResponse, ChatContext, ProviderStatus } from "./types";
import { estimateTokens } from "./estimate-tokens";

/** Default chat endpoint — same route the dashboard AI planner hits. */
export const DEFAULT_CHAT_ENDPOINT = "/api/chat";

/** Raw JSON-encoded part any of our parse paths may produce. */
interface UiStreamPart {
  type?: string;
  text?: string;
  delta?: string;
  errorText?: string;
  error?: { message?: string };
}

function isErrorPart(
  part: UiStreamPart,
): part is UiStreamPart & { error: { message?: string } } {
  return part.type === "error";
}

function isTextPart(part: UiStreamPart): part is UiStreamPart & { text: string } {
  return (
    (part.type === "text" && typeof part.text === "string") ||
    (part.type === "text-delta" && typeof part.delta === "string")
  );
}

/**
 * Extracts the assistant text from an AI SDK `UIMessageStreamResponse`.
 * The stream encodes one JSON-encoded message part per line
 * (`data: {...}\n\n`); a fallback treats a whole-body JSON array as a parts
 * list (older protocol) and finally returns raw text verbatim.
 */
async function partFromLine(line: string): Promise<UiStreamPart | null> {
  const trimmed = line.replace(/^data:\s*/, "").trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as UiStreamPart;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

async function readUIMessageText(res: Response): Promise<string> {
  const raw = await res.clone().text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* Parse SSE below. */
  }
  if (Array.isArray(parsed)) return joinParts(parsed);
  if (parsed && typeof parsed === "object") {
    const payload = parsed as { error?: unknown; message?: string };
    if (payload.error)
      throw new Error(
        typeof payload.error === "string" ? payload.error : "AI request failed",
      );
    if (typeof payload.message === "string") return payload.message;
    throw new Error("Unrecognized AI response.");
  }

  // Line-oriented AI SDK v5+ stream: `data: {"type":"text","text":"..."}`.
  const parts: UiStreamPart[] = [];
  for (const line of raw.split("\n")) {
    const part = await partFromLine(line);
    if (part) parts.push(part);
  }
  if (parts.length > 0) return joinParts(parts);

  return raw.trim();
}

/** Structured error payload from the shared /api/chat route. */
interface ChatErrorBody {
  error?: {
    message?: string;
    kind?: string;
    stage?: string;
    missingKeys?: string[];
  };
}

function errorFromBody(res: Response, bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as ChatErrorBody;
    const err = parsed.error;
    if (err?.message) {
      const head =
        err.kind === "not-configured" ? "AI provider not configured" : err.message;
      const missing = err.missingKeys?.length
        ? ` Missing env keys: ${err.missingKeys.join(", ")}.`
        : "";
      return `${head}.${missing}`;
    }
  } catch {
    // not JSON — fall through
  }
  return `Cloud AI unavailable right now (HTTP ${res.status}). The queue will retry once you're back online.`;
}

function joinParts(parts: UiStreamPart[]): string {
  const errorPart = parts.find(isErrorPart);
  if (errorPart)
    throw new Error(
      errorPart.errorText ?? errorPart.error?.message ?? "upstream failure",
    );
  return parts
    .filter(isTextPart)
    .map((p) => p.delta ?? p.text ?? "")
    .join("");
}

export class CloudAIProvider implements AIProvider {
  constructor(
    private options: {
      endpoint?: string;
      fetchImpl?: typeof fetch;
    } = {},
  ) {
    this.doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private doFetch: (input: string, init?: RequestInit) => Promise<Response>;

  getStatus(): ProviderStatus {
    return typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline";
  }

  async generateResponse(prompt: string, context: ChatContext): Promise<AIResponse> {
    const startedAt = Date.now();
    const endpoint = this.options.endpoint ?? DEFAULT_CHAT_ENDPOINT;

    const messages = [
      ...(context.history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: prompt },
    ];

    try {
      const res = await this.doFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          messages,
          currentDistrict: context.currentDistrict,
          provider: context.provider,
        }),
      });

      if (!res.ok) {
        const bodyText = await res.clone().text();
        return {
          text: errorFromBody(res, bodyText),
          mode: "error",
          durationMs: Date.now() - startedAt,
          error: true,
        };
      }

      const text = await readUIMessageText(res);
      if (!text.trim()) throw new Error("Cloud AI returned an empty response.");
      return {
        text,
        mode: "cloud",
        durationMs: Date.now() - startedAt,
      };
    } catch (error: unknown) {
      return {
        text:
          error instanceof Error
            ? `Cloud AI failed: ${error.message}`
            : "Cloud AI failed to reach the server.",
        mode: "error",
        durationMs: Date.now() - startedAt,
        error: true,
      };
    }
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }
}
