// Playout adapters — factory selection tests (no network).
import { describe, it, expect } from "vitest";
import { MosRundownPlayout, AudematRestPlayout, playoutSystemFromEnv } from "./playout";

describe("playout factory", () => {
  it("defaults to Audemat REST", () => {
    delete process.env.PLAYOUT_KIND;
    expect(playoutSystemFromEnv()).toBeInstanceOf(AudematRestPlayout);
  });

  it("selects the MOS adapter when configured", () => {
    process.env.PLAYOUT_KIND = "mos";
    try {
      expect(playoutSystemFromEnv()).toBeInstanceOf(MosRundownPlayout);
    } finally {
      delete process.env.PLAYOUT_KIND;
    }
  });
});
