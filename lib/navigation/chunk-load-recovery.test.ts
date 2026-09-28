import { describe, expect, it, beforeEach } from "vitest";
import {
  isChunkLoadError,
  resetChunkRecoveryGuard,
} from "@/lib/navigation/chunk-load-recovery";

/**
 * Guards the Back-after-deploy failure mode: a restored document references a
 * build chunk the current deploy deleted, and the client-side ChunkLoadError
 * used to strand the user on the generic "Something went wrong" boundary.
 */
describe("isChunkLoadError", () => {
  it("matches the bundler's ChunkLoadError", () => {
    const e = new Error("ChunkLoadError: Loading chunk 4213 failed.");
    (e as Error & { name: string }).name = "ChunkLoadError";
    expect(isChunkLoadError(e)).toBe(true);
  });

  it("matches the browser's dynamic-import failure", () => {
    expect(
      isChunkLoadError(new Error("Failed to fetch dynamically imported module")),
    ).toBe(true);
  });

  it("matches a module-script load failure", () => {
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
  });

  it("sees through a wrapped cause", () => {
    const inner = new Error("error loading dynamically imported module");
    expect(isChunkLoadError(new Error("Router error", { cause: inner }))).toBe(true);
  });

  it("does NOT swallow ordinary application errors", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(new TypeError("x is not a function"))).toBe(false);
  });

  it("tolerates junk input", () => {
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError("Loading chunk 5 failed")).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });
});

describe("chunk recovery guard", () => {
  beforeEach(() => {
    // No window in the node environment, so this is a no-op that simply keeps
    // the suite honest about the module being import-safe outside the browser.
    resetChunkRecoveryGuard();
  });

  it("is importable and does not attempt a reload outside the browser", async () => {
    const { attemptChunkRecovery } = await import("@/lib/navigation/chunk-load-recovery");
    expect(typeof attemptChunkRecovery).toBe("function");
    expect(attemptChunkRecovery()).toBe(false);
  });
});
