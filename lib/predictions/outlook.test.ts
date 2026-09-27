import { describe, expect, it } from "vitest";
import { riskFromSignals, sumFinite } from "./outlook";

describe("flood outlook screening", () => {
  it("treats little forecast rain and dry ground as low concern", () => {
    expect(riskFromSignals(2, 5, 3, 80, 100).risk).toBe("low");
  });

  it("raises concern when heavy rain follows wet conditions", () => {
    const dry = riskFromSignals(55, 100, 0, null, null);
    const wet = riskFromSignals(55, 100, 120, null, null);
    expect(wet.score).toBeGreaterThan(dry.score);
    expect(["high", "severe"]).toContain(wet.risk);
  });

  it("uses river trend when available and tolerates missing readings", () => {
    const baseline = riskFromSignals(20, 40, 15, null, null);
    const rising = riskFromSignals(20, 40, 15, 180, 100);
    expect(rising.score).toBeGreaterThan(baseline.score);
    expect(sumFinite([1, null, undefined, 2, NaN])).toBe(3);
  });
});
