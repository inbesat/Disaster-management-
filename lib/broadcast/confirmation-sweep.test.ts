// Confirmation sweep — pure selection tests.
import { describe, it, expect } from "vitest";
import { findUnconfirmed, type BroadcastAttemptRow } from "./confirmation-sweep";

function row(overrides: Partial<BroadcastAttemptRow> = {}): BroadcastAttemptRow {
  return {
    id: "r1",
    capAlertId: "cap-1",
    fmStationId: "stn-1",
    strategy: "cap_api",
    status: "delivered",
    broadcastTime: null,
    createdAt: new Date("2026-08-12T06:50:00Z"),
    retryCount: 0,
    ...overrides,
  };
}

const NOW = new Date("2026-08-12T07:00:00Z");

describe("findUnconfirmed", () => {
  it("flags accepted-but-unconfirmed rows past the window", () => {
    expect(findUnconfirmed([row()], NOW, 3)).toHaveLength(1);
  });

  it("ignores rows still inside the window", () => {
    const fresh = row({ createdAt: new Date("2026-08-12T06:59:00Z") });
    expect(findUnconfirmed([fresh], NOW, 3)).toHaveLength(0);
  });

  it("ignores rows with a broadcastTime (confirmed)", () => {
    const confirmed = row({ broadcastTime: new Date("2026-08-12T06:55:00Z") });
    expect(findUnconfirmed([confirmed], NOW, 3)).toHaveLength(0);
  });

  it("ignores non-CAP strategies", () => {
    expect(findUnconfirmed([row({ strategy: "rds" })], NOW, 3)).toHaveLength(0);
  });

  it("suppresses when a later delivered confirmation exists", () => {
    const pending = row({ id: "old" });
    const confirmed = row({
      id: "new",
      broadcastTime: new Date("2026-08-12T06:58:00Z"),
    });
    expect(findUnconfirmed([pending, confirmed], NOW, 3)).toHaveLength(0);
  });
});
