// Siren two-person rule — policy tests (no DB writes asserted; the
// refusal paths return before any dispatch).
import { describe, it, expect } from "vitest";
import { triggerSirens } from "./controller";

describe("triggerSirens policy", () => {
  it("refuses a network trigger with one confirmation", async () => {
    const result = await triggerSirens({
      towerIds: ["t1", "t2"],
      confirmations: ["operator-1"],
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("Two-person");
    expect(result.activationId).toBeNull();
  });

  it("refuses an empty tower list", async () => {
    const result = await triggerSirens({ towerIds: [], confirmations: ["a", "b"] });
    expect(result.ok).toBe(false);
  });
});
