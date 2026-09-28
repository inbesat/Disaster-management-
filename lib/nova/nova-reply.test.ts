import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveNovaReply,
  type CloudProviderLike,
  type RuleFallbackLike,
} from "./nova-reply";

describe("resolveNovaReply — cloud-first fallback chain", () => {
  let originalOnLine: boolean;
  let mockCloudGenerate: ReturnType<typeof vi.fn<CloudProviderLike["generateResponse"]>>;
  let mockRuleGenerate: ReturnType<typeof vi.fn<RuleFallbackLike["generateResponse"]>>;
  let mockCloudProvider: CloudProviderLike;
  let mockRuleFallback: RuleFallbackLike;

  beforeEach(() => {
    vi.clearAllMocks();
    originalOnLine = navigator.onLine;

    mockCloudGenerate = vi.fn();
    mockRuleGenerate = vi.fn();

    mockCloudProvider = {
      generateResponse: mockCloudGenerate,
    };
    mockRuleFallback = {
      generateResponse: mockRuleGenerate,
    };
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      configurable: true,
    });
  });

  it("returns cloud response when provider succeeds", async () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    mockCloudGenerate.mockResolvedValue({
      durationMs: 0,
      text: "The nearest shelter is 1.2 km away.",
      mode: "cloud",
      error: false,
    });

    const result = await resolveNovaReply(
      "Where is the nearest shelter?",
      [],
      undefined,
      mockCloudProvider,
      mockRuleFallback,
    );

    expect(result.source).toBe("cloud");
    expect(result.text).toBe("The nearest shelter is 1.2 km away.");
    expect(mockCloudGenerate).toHaveBeenCalledTimes(1);
    expect(mockRuleGenerate).not.toHaveBeenCalled();
  });

  it("falls back to RuleBasedFallback when cloud returns error mode", async () => {
    mockCloudGenerate.mockResolvedValue({
      durationMs: 0,
      text: "Cloud AI failed: Network error",
      mode: "error",
      error: true,
    });
    mockRuleGenerate.mockReturnValue({
      text: "Nearest shelter: Patna Central Community Hall, 1.2 km",
      confidence: 0.9,
      mode: "local",
    });

    const result = await resolveNovaReply(
      "Where is the nearest shelter?",
      [],
      undefined,
      mockCloudProvider,
      mockRuleFallback,
    );

    expect(result.source).toBe("rule-fallback");
    expect(result.confidence).toBe(0.9);
    expect(mockRuleGenerate).toHaveBeenCalledTimes(1);
  });

  it("falls back to RuleBasedFallback when cloud times out", async () => {
    mockCloudGenerate.mockRejectedValue(new Error("Aborted"));
    mockRuleGenerate.mockReturnValue({
      text: "Nearest shelter: Patna Central Community Hall, 1.2 km",
      confidence: 0.8,
    });

    const result = await resolveNovaReply(
      "Where is the nearest shelter?",
      [],
      undefined,
      mockCloudProvider,
      mockRuleFallback,
    );

    expect(result.source).toBe("rule-fallback");
    expect(result.confidence).toBe(0.8);
  });

  it("falls back to RuleBasedFallback when offline (navigator.onLine = false)", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    mockRuleGenerate.mockReturnValue({
      text: "Nearest shelter: Patna Central Community Hall, 1.2 km",
      confidence: 0.7,
    });

    const result = await resolveNovaReply(
      "Where is the nearest shelter?",
      [],
      undefined,
      mockCloudProvider,
      mockRuleFallback,
    );

    expect(result.source).toBe("rule-fallback");
    expect(mockCloudGenerate).not.toHaveBeenCalled();
  });

  it("falls back to static when RuleBasedFallback confidence is low", async () => {
    mockCloudGenerate.mockRejectedValue(new Error("Network error"));
    mockRuleGenerate.mockReturnValue({
      text: "I don't understand.",
      confidence: 0.2,
    });

    const result = await resolveNovaReply(
      "Where is the nearest shelter?",
      [],
      undefined,
      mockCloudProvider,
      mockRuleFallback,
    );

    expect(result.source).toBe("static");
    expect(result.text).toBe("");
  });

  it("passes last 6 messages as history to cloud provider", async () => {
    mockCloudGenerate.mockResolvedValue({
      durationMs: 0,
      text: "OK",
      mode: "cloud",
      error: false,
    });

    const history = [
      { role: "user" as const, content: "msg1" },
      { role: "ai" as const, content: "reply1" },
      { role: "user" as const, content: "msg2" },
      { role: "ai" as const, content: "reply2" },
      { role: "user" as const, content: "msg3" },
      { role: "ai" as const, content: "reply3" },
      { role: "user" as const, content: "msg4" },
      { role: "ai" as const, content: "reply4" },
      { role: "user" as const, content: "msg5" },
      { role: "ai" as const, content: "reply5" },
      { role: "user" as const, content: "msg6" },
      { role: "ai" as const, content: "reply6" },
      { role: "user" as const, content: "msg7" },
    ];

    // Explicitly ensure online
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });

    await resolveNovaReply(
      "hello",
      history,
      undefined,
      mockCloudProvider,
      mockRuleFallback,
    );

    expect(mockCloudGenerate).toHaveBeenCalledTimes(1);
    const calledWith = mockCloudGenerate.mock.calls[0][1] as {
      history: Array<{ content: string }>;
    };
    expect(calledWith.history.length).toBe(6);
    expect(calledWith.history[0].content).toBe("reply4");
    expect(calledWith.history[5].content).toBe("msg7");
  });
});
