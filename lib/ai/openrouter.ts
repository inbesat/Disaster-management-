import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// ---------------------------------------------------------------------
// lib/ai/openrouter.ts — resilient LLM provider chain for the AI planner.
//
// The emergency planner chats through the first *healthy* OpenAI-compatible
// provider instead of a single hard-coded model. Candidates are probed with
// a cheap chat call, classified (auth-invalid / rate-limited / provider-down
// / unreachable / not-configured), and the winner is cached for a short TTL.
//
// Chain order: Groq (free, unlimited) → OpenRouter (primary key) →
// OpenRouter (backup key) → Bluesminds. Each provider gets one candidate
// PER KEY so a dead primary key never blocks a working backup. Providers
// with no configured key are skipped entirely — the code NEVER sends a
// placeholder "missing-…-key" string upstream.
//
// This module is server-only. The browser-facing chat surfaces (gov AI
// Emergency Planner + public AI Advisor Chat) both POST to /api/chat, which
// is the ONLY consumer of these resolvers — so every fix here applies to
// both surfaces at once (see app/api/chat/route.ts).
//
// Structured diagnostic logging (`[ai-provider]` prefix) is server-side
// only and surfaces in Vercel function logs — never in the client payload.
// ---------------------------------------------------------------------

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const GROQ_BASE = "https://api.groq.com/openai/v1";
const BLUESMINDS_BASE = "https://api.bluesminds.com/v1";

// Live model ids — verified against each provider's /models endpoint.
const OPENROUTER_MODEL = "openrouter/free";
// gpt-oss-120b: strong tool-calling on Groq's free tier (llama-3.3-70b-
// versatile would stop right after a tool call instead of summarising).
const GROQ_MODEL = "openai/gpt-oss-120b";
const BLUESMINDS_MODEL = "google/gemini-2.5-flash";

// 15s — generous enough for a slow hall/airport wifi cold-start probe (an
// 8s budget dropped healthy providers on marginal networks, which cascaded
// into the "all providers unreachable" fallback). The chat stream itself
// has its own timeout; this only gates the probe.
const PROBE_TIMEOUT_MS = 15_000;
/** How long a probed provider is trusted before re-probing. */
const RESOLVER_TTL_MS = 60_000;
/**
 * The probe requests this many output tokens. A provider whose account
 * cannot afford a realistic response budget (e.g. OpenRouter with a few
 * hundred tokens of credit) fails the probe and is skipped — otherwise the
 * stream would 402 mid-chat. Keep in sync with the chat route's
 * `maxOutputTokens`.
 */
const PROBE_MAX_TOKENS = 2048;

export type ProviderGroup = "groq" | "openrouter" | "bluesminds" | "huggingface" | "auto";

/**
 * Why a provider probe/generation failed — lets the caller show a distinct
 * message for "config problem" vs "provider outage" vs "rate limited".
 */
export type ProviderStatusKind =
  | "ok"
  | "auth-invalid" // 401/403 — the key itself is bad/revoked
  | "rate-limited" // 429 — includes retryAfterMs when the API says so
  | "model-not-found" // 404 — the model id was dropped upstream
  | "provider-down" // 402/5xx — the vendor can't serve (no credits, outage)
  | "unreachable" // network failure / timeout — request never completed
  | "not-configured" // key missing in the server environment
  | "unchecked" // key present but never probed yet this process
  | "generation-failed"; // key/probe OK but the real chat request errored

export interface ProviderProbeResult {
  /** Candidate name, e.g. "openrouter" | "groq-backup". */
  provider: string;
  /** The exact env var this candidate reads, e.g. "OPENROUTER_API_KEY". */
  keyEnvVar: string;
  group: ProviderGroup;
  /** Whether the key is present (and longer than a placeholder). */
  configured: boolean;
  /** Whether a live probe was actually attempted. */
  probed: boolean;
  reachable: boolean;
  status: ProviderStatusKind;
  statusCode?: number;
  /** From the Retry-After header / 429 payload, when available. */
  retryAfterMs?: number;
  latencyMs?: number;
  error?: string;
}

/** Per-provider status for the admin "System Health" readout. */
export interface AiProviderHealth {
  /** True when every provider key in .env.example is set. */
  allConfigured: boolean;
  /** Exact env var names missing in the server environment. */
  missingKeys: string[];
  /** Config + last-known probe outcome for every key, in chain order. */
  providers: ProviderProbeResult[];
  /** ISO timestamp of the most recent probe this process made. */
  lastCheckedAt: string | null;
  /** Name of the provider that last answered (null on cold start). */
  cachedWinner: string | null;
}

export type ProviderCandidate = {
  name: string;
  group: ProviderGroup;
  model: LanguageModel;
  probe: { baseURL: string; model: string; apiKey: string; keyEnvVar: string };
};

interface ProviderKeyConfig {
  keyEnvVar: string;
  name: string;
  group: ProviderGroup;
  baseURL: string;
  modelId: string;
}

/** Every provider key the chain can read — single source of truth. */
export const PROVIDER_KEY_CONFIGS: ProviderKeyConfig[] = [
  {
    keyEnvVar: "GROQ_API_KEY",
    name: "groq",
    group: "groq",
    baseURL: GROQ_BASE,
    modelId: GROQ_MODEL,
  },
  {
    keyEnvVar: "GROQ_API_KEY_BACKUP",
    name: "groq-backup",
    group: "groq",
    baseURL: GROQ_BASE,
    modelId: GROQ_MODEL,
  },
  {
    keyEnvVar: "OPENROUTER_API_KEY",
    name: "openrouter",
    group: "openrouter",
    baseURL: OPENROUTER_BASE,
    modelId: OPENROUTER_MODEL,
  },
  {
    keyEnvVar: "OPENROUTER_API_KEY_BACKUP",
    name: "openrouter-backup",
    group: "openrouter",
    baseURL: OPENROUTER_BASE,
    modelId: OPENROUTER_MODEL,
  },
  {
    keyEnvVar: "BLUESMINDS_API_KEY",
    name: "bluesminds",
    group: "bluesminds",
    baseURL: BLUESMINDS_BASE,
    modelId: BLUESMINDS_MODEL,
  },
  {
    keyEnvVar: "HF_TOKEN",
    name: "huggingface",
    group: "huggingface",
    baseURL: "https://router.huggingface.co/v1",
    modelId: "openai/gpt-oss-120b",
  },
];

/**
 * Matches .env.example placeholder values that were never replaced (e.g.
 * "your-groq-api-key", "change-me", "sk-put-your-key-here"). A copied
 * template must be treated as NOT configured — otherwise the chain probes
 * with a fake key, gets 401 auth-invalid for every provider, and reports
 * the misleading "all providers down" banner instead of the real cause.
 */
const PLACEHOLDER_KEY_PATTERN =
  /^(your[-_. ]|change[-_.]?me|placeholder|example|put[-_. ]|xxx|sk-put)/i;

/** A usable key is longer than a placeholder — anything else is ignored. */
export function hasKey(value: string | undefined): value is string {
  return Boolean(
    value && value.trim().length > 8 && !PLACEHOLDER_KEY_PATTERN.test(value.trim()),
  );
}

/** Exact env var names that are missing (or placeholder-length) server-side. */
export function getMissingAiProviderKeys(): string[] {
  return PROVIDER_KEY_CONFIGS.filter((cfg) => !hasKey(process.env[cfg.keyEnvVar])).map(
    (cfg) => cfg.keyEnvVar,
  );
}

// ---------------------------------------------------------------------------
// One-time, masked startup diagnostic. Logs WHICH key slots are usable
// (env var names only — never values) so a misconfigured .env.local is
// obvious in dev output and Vercel function logs instead of surfacing as a
// vague "all providers unreachable" mid-chat.
// ---------------------------------------------------------------------------
let envStatusLogged = false;

function logAiEnvStatusOnce(): void {
  if (envStatusLogged) return;
  envStatusLogged = true;
  const parts: string[] = [];
  for (const cfg of PROVIDER_KEY_CONFIGS) {
    const raw = process.env[cfg.keyEnvVar];
    if (!raw || raw.trim().length === 0) {
      parts.push(`${cfg.keyEnvVar}=unset`);
    } else if (!hasKey(raw)) {
      parts.push(`${cfg.keyEnvVar}=placeholder(rejected)`);
    } else {
      parts.push(`${cfg.keyEnvVar}=ok`);
    }
  }
  const usable = PROVIDER_KEY_CONFIGS.filter((cfg) =>
    hasKey(process.env[cfg.keyEnvVar]),
  ).length;
  if (usable === 0) {
    console.error(
      `[ai-provider] env status → ${parts.join(" ")} — NO provider usable; chat will 503 until a real key is set in .env.local.`,
    );
  } else {
    console.info(`[ai-provider] env status → ${parts.join(" ")} (${usable} usable)`);
  }
}

function addCandidate(candidates: ProviderCandidate[], cfg: ProviderKeyConfig): void {
  const key = process.env[cfg.keyEnvVar]!.trim();
  const modelId = process.env[`${cfg.group.toUpperCase()}_MODEL`]?.trim() || cfg.modelId;
  candidates.push({
    name: cfg.name,
    group: cfg.group,
    model: createOpenAI({
      name: cfg.name,
      baseURL: cfg.baseURL,
      apiKey: key,
      headers: {
        Authorization: `Bearer ${key}`,
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL || "https://safesphere0.netlify.app",
        "X-Title": "SafeSphere",
      },
    }).chat(modelId),
    probe: {
      baseURL: cfg.baseURL,
      model: modelId,
      apiKey: key,
      keyEnvVar: cfg.keyEnvVar,
    },
  });
}

/**
 * The ordered candidate list (configured keys only), in the probe chain
 * order. `preferred` moves that family to the front; the last provider that
 * actually answered a request is moved to the front too, so repeated chat
 * traffic doesn't re-hit a known-dead vendor.
 */
export function getEmergencyPlannerCandidates(
  preferred?: ProviderGroup,
): ProviderCandidate[] {
  logAiEnvStatusOnce();
  const candidates: ProviderCandidate[] = [];
  for (const cfg of PROVIDER_KEY_CONFIGS) {
    if (hasKey(process.env[cfg.keyEnvVar])) addCandidate(candidates, cfg);
  }

  // Settings · AI provider preference (when set) moves that family to the
  // front of the chain — the planner still falls back to the others.
  if (preferred && preferred !== "auto") {
    candidates.sort((a, b) => {
      const pa = a.group === preferred ? 0 : 1;
      const pb = b.group === preferred ? 0 : 1;
      return pa - pb;
    });
  }

  // Last known-good provider answers first on subsequent requests.
  if (lastHealthyProviderName && (!preferred || preferred === "auto")) {
    const idx = candidates.findIndex((c) => c.name === lastHealthyProviderName);
    if (idx > 0) {
      const [winner] = candidates.splice(idx, 1);
      candidates.unshift(winner);
    }
  }

  return candidates;
}

function classifyProbeStatus(statusCode: number): ProviderStatusKind {
  if (statusCode === 401 || statusCode === 403) return "auth-invalid";
  if (statusCode === 404) return "model-not-found";
  if (statusCode === 429) return "rate-limited";
  // 402 = no credits / payment required — the vendor can't serve right now.
  if (statusCode === 402 || statusCode >= 500) return "provider-down";
  return "provider-down";
}

function parseRetryAfter(res: Response): number | undefined {
  const header = res.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
  const at = Date.parse(header);
  if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  return undefined;
}

async function safeErrorText(res: Response): Promise<string | undefined> {
  try {
    const raw = await res.text();
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string };
    if (typeof parsed?.error === "string") return parsed.error.slice(0, 300);
    if (typeof parsed?.error?.message === "string")
      return parsed.error.message.slice(0, 300);
    if (raw && raw.length < 300) return raw;
    return undefined;
  } catch {
    return undefined;
  }
}

async function probeCandidate(
  candidate: ProviderCandidate,
): Promise<ProviderProbeResult> {
  const startedAt = Date.now();
  const base = {
    provider: candidate.name,
    keyEnvVar: candidate.probe.keyEnvVar,
    group: candidate.group,
    configured: true,
    probed: true,
  };
  try {
    const res = await fetch(`${candidate.probe.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${candidate.probe.apiKey}`,
      },
      body: JSON.stringify({
        model: candidate.probe.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: PROBE_MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const latencyMs = Date.now() - startedAt;
    if (res.ok) {
      return { ...base, reachable: true, status: "ok", latencyMs };
    }
    const status = classifyProbeStatus(res.status);
    return {
      ...base,
      reachable: false,
      status,
      statusCode: res.status,
      retryAfterMs: parseRetryAfter(res),
      latencyMs,
      error: (await safeErrorText(res)) ?? `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      ...base,
      reachable: false,
      status: "unreachable",
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Module-level state (per serverless instance).
// ---------------------------------------------------------------------------
let cachedCandidate: ProviderCandidate | null = null;
let lastResolvedAt = 0;
let inFlight: Promise<LanguageModel> | null = null;
let lastHealthyProviderName: string | null = null;

const probeStatusCache = new Map<
  string,
  { result: ProviderProbeResult; checkedAt: number }
>();

function recordProbeOutcome(result: ProviderProbeResult): void {
  probeStatusCache.set(result.provider, { result, checkedAt: Date.now() });
}

/** Structured, server-side diagnostic line — visible in Vercel function logs. */
export function logAiDiagnostic(
  event: string,
  candidate: ProviderCandidate | ProviderProbeResult,
  extra: Record<string, unknown> = {},
): void {
  const name = "name" in candidate ? candidate.name : candidate.provider;
  const key = "keyEnvVar" in candidate ? candidate.keyEnvVar : "";
  const line = [
    `[ai-provider] event=${event}`,
    `provider=${name}`,
    `key=${key}`,
    ...Object.entries(extra).map(([k, v]) => `${k}=${String(v)}`),
  ].join(" ");
  // Failures are warnings (catch the eye), healthy steps are info.
  if (event === "probe-ok" || event === "generation-ok") console.info(line);
  else console.warn(line);
}

/** Remember which provider actually answered a chat request (ordering hint). */
export function recordGenerationSuccess(providerName: string): void {
  lastHealthyProviderName = providerName;
}

/**
 * Returns a LanguageModel guaranteed (as of the last probe, max TTL ago) to
 * answer. `preferred` (from Settings · AI) moves that provider family to the
 * front of the probe chain. Falls back to the first configured candidate even
 * when every probe fails (transient network blip) rather than throwing, so a
 * flaky cold-start probe can never take the chat down — the SDK surfaces the
 * real upstream error if the model genuinely cannot be reached.
 *
 * Note: the chat route's primary safety net is the generation-level fallback
 * in app/api/chat/route.ts (it tries each candidate's REAL request, not a
 * probe). This resolver remains for the Settings "Test Connection" UI and as
 * a fast-path probe cache.
 */
export async function resolveEmergencyPlannerModel(
  preferred?: ProviderGroup,
): Promise<LanguageModel> {
  const now = Date.now();
  if (cachedCandidate && now - lastResolvedAt < RESOLVER_TTL_MS) {
    return cachedCandidate.model;
  }
  // Dedupe concurrent cold-start probes (first chat message after boot).
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const candidates = getEmergencyPlannerCandidates(preferred);
    for (const candidate of candidates) {
      const result = await probeCandidate(candidate);
      recordProbeOutcome(result);
      logAiDiagnostic(result.status === "ok" ? "probe-ok" : "probe-failed", candidate, {
        status: result.status,
        statusCode: result.statusCode ?? "-",
        latencyMs: result.latencyMs ?? "-",
        retryAfterMs: result.retryAfterMs ?? "-",
      });
      if (result.status === "ok") {
        cachedCandidate = candidate;
        lastResolvedAt = Date.now();
        return candidate.model;
      }
    }

    // All probes failed — this may be a transient outage. Reuse the last
    // known-good provider rather than dropping the request.
    if (cachedCandidate) {
      console.warn(
        `[openrouter] all providers failed probe; reusing last known-good "${cachedCandidate.name}".`,
      );
      return cachedCandidate.model;
    }

    // No cache yet (cold start). Best-effort: hand back the first configured
    // candidate instead of failing — the generation-level fallback in the chat
    // route steps through the remaining providers on the real request.
    const first = candidates[0];
    if (first) {
      console.warn(
        `[openrouter] all providers failed probe (cold start); failing open to "${first.name}".`,
      );
      cachedCandidate = first;
      lastResolvedAt = Date.now();
      return first.model;
    }

    throw new Error(
      "No AI provider is configured. Set OPENROUTER_API_KEY (or _BACKUP), GROQ_API_KEY, or BLUESMINDS_API_KEY in the server environment.",
    );
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** True when at least one provider key is present in the environment. */
export function hasAnyAiProviderConfigured(): boolean {
  return getEmergencyPlannerCandidates().length > 0;
}

export type ProviderProbeStatus = {
  name: string;
  group: ProviderGroup;
  status: "healthy" | "failed";
  detail: ProviderProbeResult;
};

export type ProviderProbeReport = {
  /** How many provider keys are configured (also: candidates probed). */
  results: number;
  /** True if any configured provider answered the probe. */
  reachable: boolean;
  /** Name of the first healthy candidate, or null when all are down. */
  winner: string | null;
  statuses: ProviderProbeStatus[];
};

/**
 * Uncached diagnostic probe powering Settings · AI "Test Connection". Runs the
 * exact same per-provider probe the planner's resolver performs (no cache, no
 * fail-open sugar) so the operator sees the honest health of the chain for the
 * provider family they selected. Never touches secrets — only provider names.
 */
export async function probeEmergencyPlanner(
  preferred?: ProviderGroup,
): Promise<ProviderProbeReport> {
  const candidates = getEmergencyPlannerCandidates(preferred);
  const results = await Promise.all(
    candidates.map(async (c) => {
      const result = await probeCandidate(c);
      recordProbeOutcome(result);
      logAiDiagnostic(result.status === "ok" ? "probe-ok" : "probe-failed", c, {
        status: result.status,
        statusCode: result.statusCode ?? "-",
        latencyMs: result.latencyMs ?? "-",
        retryAfterMs: result.retryAfterMs ?? "-",
      });
      return {
        name: c.name,
        group: c.group,
        status: result.status === "ok" ? ("healthy" as const) : ("failed" as const),
        detail: result,
      };
    }),
  );
  const winner = results.find((s) => s.status === "healthy") ?? null;
  return {
    results: candidates.length,
    reachable: winner !== null,
    winner: winner?.name ?? null,
    statuses: results,
  };
}

/**
 * Admin-visible per-provider health. Cheap (no live network calls): reports
 * key configuration plus the last probe outcome this process recorded (every
 * probe — planner, chat fallback, Settings test — writes to the cache). Live
 * re-probing stays behind the rate-limited /api/ai/test endpoint.
 */
export function getAiProviderHealth(): AiProviderHealth {
  let lastCheckedAt: string | null = null;
  let latest = 0;
  probeStatusCache.forEach(({ checkedAt }) => {
    if (checkedAt > latest) {
      latest = checkedAt;
      lastCheckedAt = new Date(checkedAt).toISOString();
    }
  });

  const providers: ProviderProbeResult[] = PROVIDER_KEY_CONFIGS.map((cfg) => {
    const configured = hasKey(process.env[cfg.keyEnvVar]);
    const cached = probeStatusCache.get(cfg.name);
    if (!configured) {
      return {
        provider: cfg.name,
        keyEnvVar: cfg.keyEnvVar,
        group: cfg.group,
        configured: false,
        probed: false,
        reachable: false,
        status: "not-configured",
        error: `${cfg.keyEnvVar} not set in the server environment`,
      };
    }
    if (!cached) {
      return {
        provider: cfg.name,
        keyEnvVar: cfg.keyEnvVar,
        group: cfg.group,
        configured: true,
        probed: false,
        reachable: false,
        status: "unchecked",
      };
    }
    return { ...cached.result, configured: true, probed: true };
  });

  return {
    allConfigured: providers.every((p) => p.configured),
    missingKeys: getMissingAiProviderKeys(),
    providers,
    lastCheckedAt,
    cachedWinner: cachedCandidate?.name ?? lastHealthyProviderName,
  };
}

export { PROBE_TIMEOUT_MS, PROBE_MAX_TOKENS };
