"use client";

// ---------------------------------------------------------------------
// lib/ai-bridge/ai-bridge.ts — Offline-First Architecture · Phase 1
// AIBridge: the routing heart of the offline-first AI story. Uses the
// ConnectivityMonitor (navigator.onLine + Supabase heartbeat) to decide
// whether to answer from the cloud planner or the local Gemma model:
//
//   1. Backend reachable → CloudAIProvider (full tool-calling planner).
//   2. Backend unreachable & local model loaded → LocalGemmaProvider.
//   3. Neither → the guided offline notice (BridgeMode 'error').
//
// The chat UI never knows which path answered — both providers return the
// same AIResponse shape. `useAI()` (hooks/useAI.ts) wraps this class for
// the React UI and owns message state + the server sync queue.
// ---------------------------------------------------------------------

import type { AIProvider, AIResponse, ChatContext, ProviderStatus } from "./types";
import { CloudAIProvider } from "./cloud-provider";
import { LocalGemmaProvider } from "./local-provider";
import { ConnectivityMonitor, getConnectivityMonitor } from "./connectivity";
import { RuleBasedFallback } from "./rule-based-fallback";
import { guardLocalResponse, scoreResponseConfidence } from "./confidence";

export interface AIBridgeOptions {
  cloud?: AIProvider;
  local?: AIProvider;
  monitor?: ConnectivityMonitor;
  /**
   * Phase 9 resilience: when neither cloud nor local can answer (device too
   * weak for Gemma, model not downloaded), step down to a rule-based
   * emergency responder instead of a dead-end notice.
   */
  fallback?: AIProvider | null;
  /**
   * Phase 9 confidence scoring: when true, low-confidence local output is
   * replaced with the guided general-advice reply (spec threshold 0.6).
   */
  guardConfidence?: boolean;
}

export class AIBridge {
  private cloud: AIProvider;
  private local: AIProvider;
  private monitor: ConnectivityMonitor;
  private readonly fallback: AIProvider | null;
  private readonly guardConfidence: boolean;

  constructor(options: AIBridgeOptions = {}) {
    this.cloud = options.cloud ?? new CloudAIProvider();
    this.local = options.local ?? new LocalGemmaProvider();
    this.monitor = options.monitor ?? getConnectivityMonitor();
    this.fallback = options.fallback ?? null;
    this.guardConfidence = options.guardConfidence ?? false;
  }

  /** Combined readiness — the status the UI badge should display. */
  getStatus(): ProviderStatus {
    const snapshot = this.monitor.getSnapshot();
    if (snapshot.online) return "online";
    return this.local.getStatus();
  }

  /**
   * Routes a prompt to cloud or local. Uses the latest connectivity snapshot
   * (never a blocking probe on the hot path — the monitor heartbeats in the
   * background), then falls back to local/offline when cloud is unreachable.
   */
  async route(prompt: string, context: ChatContext = {}): Promise<AIResponse> {
    const snapshot = this.monitor.getSnapshot();
    if (snapshot.online) {
      const res = await this.cloud.generateResponse(prompt, context);
      if (!res.error) return res;
      // Cloud answered but errored mid-stream (5xx etc.) — don't drop the
      // user's message; step down to local before giving up entirely.
      const localRes = await this.tryLocal(prompt, context);
      return localRes ?? res;
    }
    const localRes = await this.tryLocal(prompt, context);
    if (localRes) return localRes;
    return this.ruleFallback(prompt, context);
  }

  /** Phase 9: rule-based emergency answers when no model path is available. */
  private async ruleFallback(prompt: string, context: ChatContext): Promise<AIResponse> {
    if (!this.fallback) return this.offlineReply();
    try {
      const res = await this.fallback.generateResponse(prompt, context);
      if (res.error) return this.offlineReply();
      return res;
    } catch {
      return this.offlineReply();
    }
  }

  /** Runs the local model when ready; returns null so callers keep cloud err. */
  private async tryLocal(
    prompt: string,
    context: ChatContext,
  ): Promise<AIResponse | null> {
    if (this.local.getStatus() === "local-loading") {
      await this.local.loadModel?.();
    }
    if (this.local.getStatus() === "local-ready") {
      const res = await this.local.generateResponse(prompt, context);
      if (res.error) return null;
      if (!this.guardConfidence) return res;
      // Phase 9: score local output; replace garbage with guided advice.
      const score = res.confidence ?? scoreResponseConfidence(res.text);
      const guarded = guardLocalResponse(res.text, score);
      if (guarded.text !== res.text) {
        return {
          ...res,
          text: guarded.text,
          confidence: guarded.score,
          source: "confidence-guard",
        };
      }
      return { ...res, confidence: guarded.score, source: res.source ?? "local" };
    }
    return null;
  }

  private offlineReply(): AIResponse {
    return {
      text: "AI assistant is temporarily unavailable. For emergencies, use the SOS button or call 108. Reconnect or prepare Offline AI in Settings.",
      mode: "error",
      durationMs: 0,
      error: true,
    };
  }

  /** Preloads the local Gemma model in the background (returns immediately). */
  startLocalModelWarmup(): Promise<boolean> {
    return (this.local as LocalGemmaProvider).loadModel?.() ?? Promise.resolve(false);
  }
}

/** App/device-wide bridge singleton shared by useAI() and admin previews. */
let sharedBridge: AIBridge | null = null;

export function getAIBridge(): AIBridge {
  if (!sharedBridge) {
    sharedBridge = new AIBridge({
      fallback: new RuleBasedFallback(),
      guardConfidence: true,
    });
  }
  return sharedBridge;
}
