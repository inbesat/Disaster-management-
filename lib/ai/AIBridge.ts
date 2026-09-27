"use client";

// ---------------------------------------------------------------------
// lib/ai/AIBridge.ts — routeChatQuery: the chat router (cloud ↔ local).
//
// Thin entry point over the existing routing stack (lib/ai-bridge/):
//
//   • Online  → the standard /api/chat endpoint via the shared AIBridge
//               (CloudAIProvider) — the same tool-calling planner the
//               dashboard uses, with RAG grounding + provider failover.
//   • Offline → pulls the 48-hour Dexie cache (DisasterLinkDB) for the
//               district, summarizes it into a readable context string,
//               and answers from the in-browser WebLLM model via
//               LocalLLMProvider.generateLocalResponse — zero network.
//
// Returns { text, source: 'cloud' | 'local' } so callers can badge the
// reply. Shared singletons are reused throughout (getAIBridge /
// getLocalLLMProvider / getOfflineDb), so a warm model or monitor state
// is never duplicated.
// ---------------------------------------------------------------------

import { getAIBridge } from "@/lib/ai-bridge/ai-bridge";
import { getLocalLLMProvider } from "@/lib/ai/LocalLLMProvider";
import { generateFallbackResponse } from "@/lib/ai/FallbackEngine";
import { getOfflineDb } from "@/lib/offline-sync/db";
import type { AIResponse } from "@/lib/ai-bridge/types";
import type { OfflineRecord } from "@/lib/offline-sync/types";

/** Which engine actually answered — surfaced to the chat UI badge. */
export type ChatEngine = "cloud" | "local-gemma" | "local-fallback";

export interface RouteChatResult {
  /** The assistant's reply text. */
  text: string;
  /** Two-state alias for legacy consumers (cloud vs any offline answer). */
  source: "cloud" | "local";
  /** The engine that produced the reply — drives the 3-state badge. */
  engineUsed: ChatEngine;
}

export interface HardwareCapability {
  /** True when navigator.gpu.requestAdapter exists (WebGPU backend). */
  webgpu: boolean;
  /** navigator.deviceMemory in GB (conservative 2 when not exposed). */
  memoryGb: number;
  /** WebGPU AND at least 4 GB RAM — enough to attempt a local model. */
  supported: boolean;
}

/**
 * Quick, synchronous hardware gate before attempting WebLLM: WebGPU present
 * AND deviceMemory >= 4 GB. SSR-safe (always unsupported in Node).
 */
export function checkHardwareCapability(): HardwareCapability {
  if (typeof navigator === "undefined") {
    return { webgpu: false, memoryGb: 0, supported: false };
  }
  const nav = navigator as Navigator & {
    gpu?: { requestAdapter?: unknown };
    deviceMemory?: number;
  };
  const webgpu = !!nav.gpu?.requestAdapter;
  const memoryGb =
    typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 ? nav.deviceMemory : 2;
  return { webgpu, memoryGb, supported: webgpu && memoryGb >= 4 };
}

/** Rows still inside the 48h offline window. */
function freshRows(rows: Array<OfflineRecord<unknown>>): Array<OfflineRecord<unknown>> {
  const now = Date.now();
  return rows.filter((row) => new Date(row.expiresAt).getTime() >= now);
}

/** Best-effort risk level derived from prediction payloads. */
function riskLevelFrom(rows: Array<OfflineRecord<unknown>>): string {
  const values: string[] = [];
  for (const row of rows) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    for (const key of ["risk", "riskLevel", "severity", "level"]) {
      const value = data[key];
      if (typeof value === "string" || typeof value === "number") {
        values.push(String(value));
      }
    }
  }
  const order = ["critical", "high", "medium", "moderate", "low"];
  for (const level of order) {
    if (values.some((v) => v.toLowerCase().includes(level))) return level.toUpperCase();
  }
  return values.length > 0 ? values[0].toUpperCase() : "Unknown";
}

/**
 * Loads the district's 48h offline cache from DisasterLinkDB and formats
 * it into a compact context string for the local model, e.g.:
 *
 *   "Current Offline Context: District Patna · 2 Shelters open ·
 *    Risk Level: HIGH · 5 active alerts · 12 predictions cached"
 */
async function loadOfflineContext(district: string): Promise<string> {
  try {
    const db = getOfflineDb();
    const [predictions, alerts, shelters, resources] = await Promise.all([
      freshRows(await db.predictions.where("district").equals(district).toArray()),
      freshRows(await db.alerts.where("district").equals(district).toArray()),
      freshRows(await db.shelters.where("district").equals(district).toArray()),
      freshRows(await db.resources.where("district").equals(district).toArray()),
    ]);

    const lines = [
      `Current Offline Context for district ${district}`,
      `- Predictions cached: ${predictions.length}`,
      `- Open shelters: ${shelters.length}`,
      `- Active alerts: ${alerts.length}`,
      `- Resources cached: ${resources.length}`,
      `- Risk Level: ${riskLevelFrom(predictions)}`,
    ];
    return lines.join("\n");
  } catch {
    // IndexedDB unavailable (SSR / first paint) — the model still answers,
    // just without cached ground truth.
    return `Current Offline Context: no cached data available for ${district}.`;
  }
}

/**
 * Loads the raw fresh shelter rows for a district — used by the offline
 * logic engine to answer "nearest shelter" from real cached data.
 */
async function loadShelterContext(
  district: string,
): Promise<Array<OfflineRecord<unknown>>> {
  try {
    const db = getOfflineDb();
    return freshRows(await db.shelters.where("district").equals(district).toArray());
  } catch {
    return [];
  }
}

/** Dependency overrides so the router is testable without real engines. */
export interface RouteChatDeps {
  history?: import("@/lib/ai-bridge/types").ChatMessage[];
  isOnline?: () => boolean;
  capability?: () => HardwareCapability;
  cloudRoute?: (message: string, district: string) => Promise<AIResponse>;
  localGenerate?: (message: string, context: unknown) => Promise<AIResponse>;
  shelterContext?: (district: string) => Promise<unknown>;
  offlineContext?: (district: string) => Promise<string>;
}

function defaultCloudRoute(message: string, district: string): Promise<AIResponse> {
  return getAIBridge().route(message, { currentDistrict: district });
}

function defaultLocalGenerate(message: string, context: unknown): Promise<AIResponse> {
  return getLocalLLMProvider().generateLocalResponse(message, context);
}

/**
 * Routes a chat message to cloud or local AI depending on connectivity.
 *
 * Bulletproof chain (offline): hardware gate → WebLLM in a strict try/catch
 * → the zero-MB offline logic engine. The engine used is always reported.
 *
 * @param userMessage The user's prompt.
 * @param district    District scoping — used for the cloud call and to
 *                    load the district's offline cache.
 * @param deps        Injectable overrides (tests).
 */
export async function routeChatQuery(
  userMessage: string,
  district: string,
  deps: RouteChatDeps = {},
): Promise<RouteChatResult> {
  const isOnline =
    deps.isOnline ?? (() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const capability = deps.capability ?? checkHardwareCapability;
  const cloudRoute =
    deps.cloudRoute ??
    ((message: string, district: string) =>
      getAIBridge().route(message, { currentDistrict: district, history: deps.history }));
  const localGenerate = deps.localGenerate ?? defaultLocalGenerate;
  const shelterContext = deps.shelterContext ?? loadShelterContext;
  const offlineContext = deps.offlineContext ?? loadOfflineContext;

  // ---- Cloud path: the standard /api/chat planner. -------------------
  if (isOnline()) {
    const response = await cloudRoute(userMessage, district);
    if (response.error) throw new Error(response.text);
    const local = response.mode === "local";
    return {
      text: response.text,
      source: local ? "local" : "cloud",
      // The bridge may step down to local if the cloud call errored.
      engineUsed: local
        ? response.source === "rule-based"
          ? "local-fallback"
          : "local-gemma"
        : "cloud",
    };
  }

  // ---- Offline path: hardware gate → WebLLM → zero-MB fallback. -------
  if (!capability().supported) {
    // Weak device (no WebGPU / <4 GB RAM) — never attempt the heavy model.
    return {
      text: generateFallbackResponse(userMessage, await shelterContext(district)),
      source: "local",
      engineUsed: "local-fallback",
    };
  }

  try {
    const contextData = await offlineContext(district);
    const response = await localGenerate(userMessage, contextData);
    if (response.error) throw new Error(response.text);
    return { text: response.text, source: "local", engineUsed: "local-gemma" };
  } catch (error: unknown) {
    // WebLLM crashed (WebView limits, OOM, corrupted weights) — log it
    // silently and step down to the rule engine, never a dead end.
    if (typeof console !== "undefined") {
      console.warn(
        "[AIBridge] local inference failed — using offline logic engine:",
        error instanceof Error ? error.message : error,
      );
    }
    return {
      text: generateFallbackResponse(userMessage, await shelterContext(district)),
      source: "local",
      engineUsed: "local-fallback",
    };
  }
}

export default routeChatQuery;
