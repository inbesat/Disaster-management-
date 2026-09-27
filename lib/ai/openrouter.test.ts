// ---------------------------------------------------------------------
// lib/ai/openrouter.test.ts
// Unit tests for the resilient LLM provider resolver. The resolver probes
// OpenAI-compatible providers (Groq → OpenRouter → Bluesminds) with a cheap
// chat call, skips unconfigured keys, and caches the winner for a short
// TTL. fetch and the environment are mocked so the tests are hermetic.
// ---------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OK_RESPONSE = new Response(JSON.stringify({ choices: [] }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});
const FAIL_RESPONSE = new Response(JSON.stringify({ error: "no credits" }), {
  status: 402,
  headers: { "Content-Type": "application/json" },
});

type OpenRouterModule = typeof import("./openrouter");

/** Every provider key the resolver reads. Real .env / shell values are blanked
 * before each test — `vi.unstubAllEnvs()` restores them, so without this the
 * suite breaks on any machine that actually has keys set (verified Aug 10,
 * 2026: 4 failures from leaked GROQ/OPENROUTER/BLUESMINDS keys). */
const PROVIDER_KEY_ENVS = [
  "GROQ_API_KEY",
  "GROQ_API_KEY_BACKUP",
  "OPENROUTER_API_KEY",
  "OPENROUTER_API_KEY_BACKUP",
  "BLUESMINDS_API_KEY",
  "HF_TOKEN",
] as const;

/** Blank every provider key — `hasKey("")` is false, so an unstubbed test
 * sees a clean environment no matter what the host machine exports. */
function clearProviderKeys(): void {
  for (const key of PROVIDER_KEY_ENVS) {
    vi.stubEnv(key, "");
  }
}

/** Fresh module instance so the module-level cache resets between tests. */
async function freshModule(): Promise<OpenRouterModule> {
  vi.resetModules();
  return import("./openrouter");
}

describe("hasAnyAiProviderConfigured", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    clearProviderKeys();
  });

  it("returns false when no provider keys are set", async () => {
    const mod = await freshModule();
    expect(mod.hasAnyAiProviderConfigured()).toBe(false);
  });

  it("returns true when a Groq key is set", async () => {
    vi.stubEnv("GROQ_API_KEY", "gk-1234567890");
    const mod = await freshModule();
    expect(mod.hasAnyAiProviderConfigured()).toBe(true);
  });

  it("returns true when only Bluesminds is set", async () => {
    vi.stubEnv("BLUESMINDS_API_KEY", "bs-1234567890");
    const mod = await freshModule();
    expect(mod.hasAnyAiProviderConfigured()).toBe(true);
  });

  it("ignores placeholder-length keys", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "short");
    const mod = await freshModule();
    expect(mod.hasAnyAiProviderConfigured()).toBe(false);
  });

  it("rejects .env.example placeholder values as not configured", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "your-openrouter-api-key");
    vi.stubEnv("GROQ_API_KEY", "your-groq-api-key");
    vi.stubEnv("BLUESMINDS_API_KEY", "your-bluesminds-api-key");
    const mod = await freshModule();
    expect(mod.hasAnyAiProviderConfigured()).toBe(false);
    expect(mod.getMissingAiProviderKeys()).toContain("OPENROUTER_API_KEY");
    expect(mod.getMissingAiProviderKeys()).toContain("GROQ_API_KEY");
    expect(mod.getMissingAiProviderKeys()).toContain("BLUESMINDS_API_KEY");
  });
});

describe("resolveEmergencyPlannerModel", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    clearProviderKeys();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws a clear error when no provider is configured", async () => {
    const mod = await freshModule();
    await expect(mod.resolveEmergencyPlannerModel()).rejects.toThrow(
      /No AI provider is configured/,
    );
  });

  it("steps down from a dead groq key to a healthy openrouter key", async () => {
    vi.stubEnv("GROQ_API_KEY", "gk-dead-1234567890");
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-1234567890");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      return String(url).includes("api.groq.com") ? FAIL_RESPONSE : OK_RESPONSE;
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await freshModule();
    const model = await mod.resolveEmergencyPlannerModel();

    expect((model as { provider?: string }).provider).toBe("openrouter.chat");
    const probedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(probedUrls[0]).toContain("api.groq.com");
    expect(probedUrls[1]).toContain("openrouter.ai");
  });

  it("steps down to the backup key when the primary key is dead", async () => {
    vi.stubEnv("GROQ_API_KEY", "gk-dead-1234567890");
    vi.stubEnv("GROQ_API_KEY_BACKUP", "gk-alive-1234567890");
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const auth = headers.Authorization ?? "";
      // The dead primary key fails; the alive backup key succeeds.
      return auth.includes("gk-dead") ? FAIL_RESPONSE : OK_RESPONSE;
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await freshModule();
    const model = await mod.resolveEmergencyPlannerModel();

    expect((model as { provider?: string }).provider).toBe("groq-backup.chat");
  });

  it("never probes a provider whose key is missing", async () => {
    vi.stubEnv("GROQ_API_KEY", "gk-1234567890");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      void url;
      return OK_RESPONSE;
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await freshModule();
    await mod.resolveEmergencyPlannerModel();

    // Only the configured Groq provider is probed — no OpenRouter/Bluesminds.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.groq.com");
  });

  it("serves the cached winner within the TTL without re-probing", async () => {
    vi.stubEnv("GROQ_API_KEY", "gk-1234567890");
    const fetchMock = vi.fn(async () => OK_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);

    const mod = await freshModule();
    await mod.resolveEmergencyPlannerModel();
    await mod.resolveEmergencyPlannerModel();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reuses the last known-good provider when all probes fail after TTL expiry", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GROQ_API_KEY", "gk-1234567890");
    let healthy = true;
    const fetchMock = vi.fn(async () => (healthy ? OK_RESPONSE : FAIL_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const mod = await freshModule();
    await mod.resolveEmergencyPlannerModel(); // groq cached

    healthy = false;
    vi.setSystemTime(Date.now() + 61_000); // force TTL expiry

    const model = await mod.resolveEmergencyPlannerModel();
    expect((model as { provider?: string }).provider).toBe("groq.chat");
  });

  it("probes the preferred provider family first (Settings · AI wiring)", async () => {
    vi.stubEnv("GROQ_API_KEY", "gk-1234567890");
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-1234567890");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      void url;
      return OK_RESPONSE;
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await freshModule();
    await mod.resolveEmergencyPlannerModel("openrouter");

    // OpenRouter jumps ahead of Groq even though Groq is configured first.
    expect(String(fetchMock.mock.calls[0][0])).toContain("openrouter.ai");
  });

  it("fails open to the first candidate on a cold-start probe outage", async () => {
    vi.stubEnv("GROQ_API_KEY", "gk-1234567890");
    const fetchMock = vi.fn(async () => FAIL_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);

    const mod = await freshModule();
    const model = await mod.resolveEmergencyPlannerModel();

    // No cached provider and every probe 402'd — best-effort instead of throw.
    expect((model as { provider?: string }).provider).toBe("groq.chat");
  });

  it("falls through to Groq when the preferred OpenRouter returns HTTP 500", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-1234567890");
    vi.stubEnv("GROQ_API_KEY", "gk-1234567890");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      return String(url).includes("api.groq.com")
        ? OK_RESPONSE
        : new Response(JSON.stringify({ error: "server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await freshModule();
    const model = await mod.resolveEmergencyPlannerModel("openrouter");

    expect((model as { provider?: string }).provider).toBe("groq.chat");
  });

  it("classifies a 429 as rate-limited and surfaces the Retry-After hint", async () => {
    vi.stubEnv("GROQ_API_KEY", "gk-1234567890");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "rate limit" }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "45" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const mod = await freshModule();
    const report = await mod.probeEmergencyPlanner();

    expect(report.results).toBe(1);
    expect(report.reachable).toBe(false);
    const groq = report.statuses.find((s) => s.name === "groq");
    expect(groq?.status).toBe("failed");
    expect(groq?.detail.status).toBe("rate-limited");
    expect(groq?.detail.statusCode).toBe(429);
    expect(groq?.detail.retryAfterMs).toBe(45_000);
  });
});

describe("getAiProviderHealth (admin / health endpoint)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    clearProviderKeys();
  });

  it("reports missing keys distinctly from provider outages", async () => {
    vi.stubEnv("GROQ_API_KEY", "gk-1234567890");
    const mod = await freshModule();

    const health = mod.getAiProviderHealth();
    expect(health.allConfigured).toBe(false);
    expect(health.missingKeys).toContain("OPENROUTER_API_KEY");

    const groq = health.providers.find((p) => p.provider === "groq");
    expect(groq?.status).toBe("unchecked"); // key present, never probed yet

    const openrouter = health.providers.find((p) => p.provider === "openrouter");
    expect(openrouter?.configured).toBe(false);
    expect(openrouter?.status).toBe("not-configured");
    expect(openrouter?.error).toContain("OPENROUTER_API_KEY not set");
  });

  it("reflects a recorded probe outcome without making network calls", async () => {
    vi.stubEnv("GROQ_API_KEY", "gk-1234567890");
    const fetchMock = vi.fn(async () => OK_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);

    const mod = await freshModule();
    await mod.resolveEmergencyPlannerModel(); // probes groq → ok, cached

    const health = mod.getAiProviderHealth();
    const groq = health.providers.find((p) => p.provider === "groq");
    expect(groq?.status).toBe("ok");
    expect(groq?.reachable).toBe(true);
    expect(health.cachedWinner).toBe("groq");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getEmergencyPlannerCandidates", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    clearProviderKeys();
  });

  it("orders the last healthy provider first on the next request", async () => {
    vi.stubEnv("GROQ_API_KEY", "gk-1234567890");
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-1234567890");
    const mod = await freshModule();

    let order = mod.getEmergencyPlannerCandidates().map((c) => c.name);
    expect(order[0]).toBe("groq");

    mod.recordGenerationSuccess("openrouter");
    order = mod.getEmergencyPlannerCandidates().map((c) => c.name);
    expect(order[0]).toBe("openrouter");
  });
});
