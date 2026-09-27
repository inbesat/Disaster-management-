import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), success: vi.fn() }));
vi.mock("ai", () => ({ generateText: mocks.generate, isStepCount: () => () => false }));
vi.mock("./openrouter", () => ({
  getEmergencyPlannerCandidates: () => [
    { name: "primary", model: {} },
    { name: "backup", model: {} },
  ],
  recordGenerationSuccess: mocks.success,
}));
import { generateAnswer } from "./generate-answer";
beforeEach(() => {
  vi.clearAllMocks();
});
describe("provider failover", () => {
  it("retries an asynchronous failure with the backup and records the actual provider", async () => {
    mocks.generate
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValueOnce({ text: "Real answer" });
    expect(
      await generateAnswer({
        system: "test",
        messages: [{ role: "user", content: "Flood preparation" }],
      }),
    ).toEqual({ text: "Real answer", provider: "backup" });
    expect(mocks.success).toHaveBeenCalledWith("backup");
  });
  it("rejects exhausted/empty providers instead of returning a canned success", async () => {
    mocks.generate.mockResolvedValue({ text: "" });
    await expect(generateAnswer({ system: "test", messages: [] })).rejects.toThrow(
      "unavailable",
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
