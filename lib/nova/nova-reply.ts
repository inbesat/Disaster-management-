"use client";

import { CloudAIProvider } from "@/lib/ai-bridge/cloud-provider";
import { RuleBasedFallback } from "@/lib/ai-bridge/rule-based-fallback";
import type { ChatContext, AIResponse } from "@/lib/ai-bridge/types";

const NOVA_CHAT_ENDPOINT = "/api/chat";
const NOVA_TIMEOUT_MS = 60_000;

export type NovaReplySource = "cloud" | "rule-fallback" | "static";

export interface NovaReplyResult {
  text: string;
  source: NovaReplySource;
  confidence?: number;
}

export interface CloudProviderLike {
  generateResponse(prompt: string, context: ChatContext): Promise<AIResponse>;
}

export interface RuleFallbackLike {
  generateResponse(
    prompt: string,
    context: { currentDistrict: string },
  ):
    | { text: string; confidence?: number; mode?: string }
    | Promise<{ text: string; confidence?: number; mode?: string }>;
}

/**
 * Resolves a reply for Nova using the exact fallback chain specified:
 * 1. /api/chat (CloudAIProvider) — 20s timeout, passes last ~6 messages as history
 * 2. RuleBasedFallback (61 pre-written emergency rules) — offline-capable
 * 3. Static translated "nova_reply" — final safety net
 *
 * Emergency-intent and center-intent detection MUST happen BEFORE calling this.
 * This function is only for normal conversational replies.
 */
export async function resolveNovaReply(
  prompt: string,
  history: Array<{ role: "user" | "ai"; content: string }> = [],
  currentDistrict?: string,
  // Optional injected providers for testing / customization
  cloudProvider?: CloudProviderLike,
  ruleFallback?: RuleFallbackLike,
): Promise<NovaReplyResult> {
  // Use injected providers or create defaults
  const cloud =
    cloudProvider ??
    new CloudAIProvider({
      endpoint: NOVA_CHAT_ENDPOINT,
      fetchImpl: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.timeout(NOVA_TIMEOUT_MS),
        }),
    });
  const rule = ruleFallback ?? new RuleBasedFallback();

  // 1. Cloud — attempt the LLM chain
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const ctx: ChatContext = {
        history: history
          .slice(-6)
          .map((m) => ({
            role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          })),
        currentDistrict,
      };

      const result: AIResponse = await cloud.generateResponse(prompt, ctx);

      if (result.mode === "cloud" && !result.error && result.text.trim().length > 0) {
        return { text: result.text.trim(), source: "cloud" };
      }
      // If mode is "error" or text empty, fall through to rule fallback
    } catch {
      // Network error, timeout, or parse failure — fall through
    }
  }

  // 2. RuleBasedFallback — 61 pre-written emergency rules, offline-capable
  try {
    const fbResult = await rule.generateResponse(prompt, {
      currentDistrict: currentDistrict ?? "unknown",
    });
    if (fbResult.confidence && fbResult.confidence > 0.5) {
      return {
        text: `[Offline guidance] ${fbResult.text.trim()}`,
        source: "rule-fallback",
        confidence: fbResult.confidence,
      };
    }
    // Low confidence — fall through to static
  } catch {
    // Unexpected error in fallback — fall through
  }

  // 3. Static safety net (translated elsewhere; caller supplies final fallback)
  return { text: "", source: "static" };
}
