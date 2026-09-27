// ---------------------------------------------------------------------
// lib/ai-bridge/cloud-provider.test.ts
// Phase 1 · CloudAIProvider: POSTs to the chat endpoint, streams back the
// assistant text from the AI SDK UIMessage protocol, and reports HTTP
// failures as errors without throwing.
// ---------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudAIProvider } from "./cloud-provider";

function jsonResponse(parts: unknown[], status = 200): Response {
  return new Response(JSON.stringify(parts), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(lines: string[], status = 200): Response {
  return new Response(lines.join("\n"), { status });
}

describe("CloudAIProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports online against the browser network state", () => {
    expect(new CloudAIProvider().getStatus()).toBe("online");
    vi.stubGlobal("navigator", { onLine: false });
    expect(new CloudAIProvider().getStatus()).toBe("offline");
  });

  it("collects text parts from the whole-body JSON parts array", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        { type: "text", text: "Plan 1" },
        { type: "text", text: "Plan 2" },
      ]),
    );
    const provider = new CloudAIProvider({ endpoint: "/api/chat", fetchImpl });
    const res = await provider.generateResponse("plan", {});
    expect(res.mode).toBe("cloud");
    expect(res.text).toBe("Plan 1Plan 2");
  });

  it("parses the line-oriented UIMessage stream protocol", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        'data: {"type":"text","text":"Evacuate the waterfront."}',
        'data: {"type":"tool-call","toolCallId":"t1"}',
        "",
        'data: {"type":"text","text":" Then head north."}',
        "",
      ]),
    );
    const provider = new CloudAIProvider({ endpoint: "/api/chat", fetchImpl });
    const res = await provider.generateResponse("plan", {});
    expect(res.mode).toBe("cloud");
    expect(res.text).toBe("Evacuate the waterfront. Then head north.");
  });

  it("marks HTTP errors as error responses (no throw)", async () => {
    const fetchImpl = vi.fn(async () => new Response("unavailable", { status: 503 }));
    const provider = new CloudAIProvider({ endpoint: "/api/chat", fetchImpl });
    const res = await provider.generateResponse("plan", {});
    expect(res.mode).toBe("error");
    expect(res.error).toBe(true);
    expect(res.text).toContain("503");
  });

  it("surfaces network failures as error responses", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const provider = new CloudAIProvider({ endpoint: "/api/chat", fetchImpl });
    const res = await provider.generateResponse("plan", {});
    expect(res.mode).toBe("error");
    expect(res.error).toBe(true);
    expect(res.text).toContain("Failed to fetch");
  });

  it("includes hidden context in the outgoing request body", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse([{ type: "text", text: "ok" }]),
    );
    const provider = new CloudAIProvider({ endpoint: "/api/chat", fetchImpl });
    await provider.generateResponse("what next?", {
      currentDistrict: "Patna",
      provider: "groq-llama3",
      history: [{ role: "user", content: "earlier" }],
    });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init?.body as string);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1]).toEqual({ role: "user", content: "what next?" });
    expect(body.currentDistrict).toBe("Patna");
    expect(body.provider).toBe("groq-llama3");
  });
  it("reads current SDK text-delta events", async () => {
    const provider = new CloudAIProvider({
      fetchImpl: vi.fn(async () =>
        sseResponse([
          'data: {"type":"text-start","id":"a"}',
          'data: {"type":"text-delta","id":"a","delta":"Live answer"}',
          "data: [DONE]",
        ]),
      ),
    });
    expect((await provider.generateResponse("help", {})).text).toBe("Live answer");
  });
  it("surfaces errors even when the HTTP status is successful", async () => {
    const provider = new CloudAIProvider({
      fetchImpl: vi.fn(
        async () => new Response(JSON.stringify({ error: "Provider unavailable" })),
      ),
    });
    expect((await provider.generateResponse("help", {})).mode).toBe("error");
  });
});
