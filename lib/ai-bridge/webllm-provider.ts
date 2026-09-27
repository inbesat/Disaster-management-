"use client";

// ---------------------------------------------------------------------
// lib/ai-bridge/webllm-provider.ts — Offline-First Architecture · Phase 4
// WebLLMProvider: the Phase 4 "real" local inference provider, built on
// the @mlc-ai/web-llm engine (Gemma / TinyLlama / Phi-2 4-bit) exactly as
// the spec's Option A describes. It supersedes the Phase 1 LocalGemma
// provider stub with:
//
//   • initialize(onProgress) — creates the MLCEngine and reload()s the
//     selected model, streaming 0-100% download progress to the callback.
//   • DISASTER_SYSTEM_PROMPT — the spec's emergency-assistant system
//     prompt ("never hallucinate emergency procedures").
//   • Injection points (engineLoader / engineFactory) so unit tests run
//     hermetically without the optional package installed.
//
// Like every provider in lib/ai-bridge it implements the shared AIProvider
// contract, so the AIBridge swaps it in transparently. WebLLM caches model
// weights in the browser Cache API automatically; Phase 3's ModelChunkStore
// handles the resume/delete UX and reports progress to the Storage Manager.
// ---------------------------------------------------------------------

import type { AIProvider, AIResponse, ChatContext, ProviderStatus } from "./types";
import { estimateTokens } from "./estimate-tokens";

/** Spec's disaster-specific system prompt for the local model. */
export const DISASTER_SYSTEM_PROMPT =
  "You are SafeSphere AI, an emergency assistant. " +
  "Use only the provided offline context. Be concise, actionable, and calm. " +
  "If you don't know something, say so clearly. Never hallucinate emergency procedures.";

/** Default model id (Phase 4 spec). */
export const DEFAULT_WEBLLM_MODEL = "gemma-2b-it-q4f16_1-MLC";

/** Minimal structural view of the WebLLM engine we depend on. */
export interface WebLlmEngineLike {
  loadedModel?: string;
  chat?: {
    completions?: {
      create: (opts: {
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
      }) => Promise<{ choices?: Array<{ message?: { content?: string } }> }>;
    };
  };
  /** Streaming completions (WebLLM's async generator API). */
  chatCompletions?: {
    create: (opts: {
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
    }) => AsyncGenerator<{ choices?: Array<{ delta?: { content?: string } }> }>;
  };
}

export interface WebLLMProviderOptions {
  modelId?: string;
  /**
   * Lazy engine loader override (tests / prewired WebLLM). Defaults to the
   * real dynamic import of @mlc-ai/web-llm and degrades to null when the
   * package is missing or the dynamic import is blocked.
   */
  loadEngine?: (
    modelId: string,
    onProgress: (progress: number) => void,
  ) => Promise<WebLlmEngineLike | null>;
  /** Force "ready" (used by the simulator/tests). */
  engineAvailable?: boolean;
}

export class WebLLMProvider implements AIProvider {
  private engine: WebLlmEngineLike | null = null;
  private enginePromise: Promise<WebLlmEngineLike | null> | null = null;
  private status: ProviderStatus = "local-unavailable";
  private lastProgress = 0;
  private readonly modelId: string;
  private readonly loadEngine: NonNullable<WebLLMProviderOptions["loadEngine"]>;

  constructor(options: WebLLMProviderOptions = {}) {
    this.modelId = options.modelId ?? DEFAULT_WEBLLM_MODEL;
    this.loadEngine = options.loadEngine ?? defaultLoadEngine;
    if (options.engineAvailable) this.status = "local-ready";
  }

  getStatus(): ProviderStatus {
    if (this.engine) return "local-ready";
    return this.status;
  }

  /** Last reported download progress fraction (0..1). */
  get lastDownloadProgress(): number {
    return this.lastProgress;
  }

  get loadedModelId(): string | null {
    return this.engine?.loadedModel ?? null;
  }

  /** True once the engine reports a loaded model. */
  isModelLoaded(): boolean {
    return this.getStatus() === "local-ready";
  }

  /**
   * Phase 4 initialize(onProgress): downloads (or loads from WebLLM's cache)
   * the model weights and streams 0-100% progress. Resolves true on success.
   */
  async initialize(onProgress: (progress: number) => void): Promise<boolean> {
    if (this.engine) {
      onProgress(1);
      return true;
    }
    if (!this.enginePromise) {
      this.status = "local-loading";
      this.enginePromise = Promise.resolve()
        .then(() => this.loadEngine(this.modelId, (p) => {
          this.lastProgress = p;
          onProgress(p);
        }))
        .then((engine) => {
          this.engine = engine && hasChat(engine) ? engine : null;
          this.status = this.engine ? "local-ready" : "local-unavailable";
          if (!this.engine) onProgress(0);
          return this.engine;
        })
        .catch(() => {
          this.status = "local-unavailable";
          onProgress(0);
          return null;
        });
    }
    const engine = await this.enginePromise;
    return engine !== null;
  }

  /** loadModel() alias so the AIBridge warm-up path works unchanged. */
  async loadModel(): Promise<boolean> {
    return this.initialize(() => {});
  }

  async generateResponse(prompt: string, context: ChatContext): Promise<AIResponse> {
    const startedAt = Date.now();

    if (this.engine && hasChat(this.engine)) {
      try {
        const create = this.engine.chat!.completions!.create.bind(this.engine.chat!.completions!);
        const result = await create({
          messages: [
            { role: "system", content: DISASTER_SYSTEM_PROMPT },
            ...(context.history ?? []).map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        });
        const text = result.choices?.[0]?.message?.content?.trim();
        return {
          text:
            text || "The local model returned an empty response. Try rephrasing, or reconnect for the cloud planner.",
          mode: "local",
          durationMs: Date.now() - startedAt,
        };
      } catch (error: unknown) {
        return {
          text:
            error instanceof Error
              ? `Local model inference failed: ${error.message}`
              : "Local model inference failed.",
          mode: "error",
          durationMs: Date.now() - startedAt,
          error: true,
        };
      }
    }

    if (this.status === "local-loading") {
      const loaded = await this.loadModel();
      if (loaded) return this.generateResponse(prompt, context);
    }

    return {
      text:
        "The local model isn't ready on this device. Start the download from " +
        "Settings · Storage · Download AI Model, then reconnect or run the onboarding.",
      mode: "error",
      durationMs: Date.now() - startedAt,
      error: true,
    };
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }

  /**
   * Phase 6 · streaming: yields partial tokens as the local model generates
   * them (WebLLM's async-generator API), so the chat UI can render text
   * token-by-token even fully offline. Falls back to the non-streaming path
   * when the engine exposes only `chat.completions`.
   */
  async *streamResponse(
    prompt: string,
    context: ChatContext,
  ): AsyncGenerator<{ text: string; done: boolean; mode: "local" | "error" }> {
    if (this.engine && hasStreaming(this.engine)) {
      try {
        const generator = this.engine.chatCompletions!.create({
          messages: [
            { role: "system", content: DISASTER_SYSTEM_PROMPT },
            ...(context.history ?? []).map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        });
        for await (const chunk of generator) {
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (delta) yield { text: delta, done: false, mode: "local" };
        }
        yield { text: "", done: true, mode: "local" };
        return;
      } catch (error: unknown) {
        yield {
          text:
            error instanceof Error
              ? `Local model streaming failed: ${error.message}`
              : "Local model streaming failed.",
          done: true,
          mode: "error",
        };
        return;
      }
    }
    // Non-streaming fallback: emit the whole reply as one token burst.
    const res = await this.generateResponse(prompt, context);
    if (res.text) yield { text: res.text, done: false, mode: res.error ? "error" : "local" };
    yield { text: "", done: true, mode: res.error ? "error" : "local" };
  }
}

function hasStreaming(engine: WebLlmEngineLike): engine is WebLlmEngineLike {
  return typeof engine.chatCompletions?.create === "function";
}

function hasChat(engine: WebLlmEngineLike): engine is WebLlmEngineLike {
  return !!engine.chat?.completions?.create;
}

/**
 * Defensive lazy importer — a blocked or missing @mlc-ai/web-llm module
 * degrades to null so the client build and cloud path never break.
 */
const defaultLoadEngine: NonNullable<WebLLMProviderOptions["loadEngine"]> = (modelId, onProgress) =>
  import("@mlc-ai/web-llm").then(
    (mod: unknown) => {
      const m = mod as {
        CreateMLCEngine?: (modelId: string, config: { initProgressCallback?: (r: { progress: number }) => void }) => Promise<WebLlmEngineLike>;
        MLCEngine?: new (modelId?: string, config?: { initProgressCallback?: (r: { progress: number }) => void }) => WebLlmEngineLike;
      };
      if (typeof m.CreateMLCEngine === "function") {
        return m.CreateMLCEngine(modelId, {
          initProgressCallback: (report) => onProgress(report.progress),
        });
      }
      if (typeof m.MLCEngine === "function") {
        return new m.MLCEngine(modelId);
      }
      return null;
    },
    () => null, // module not installed / blocked — offline fallback stays.
  );
