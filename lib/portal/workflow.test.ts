import { describe, expect, it } from "vitest";
import {
  CHECK_IN_RADIUS_KM,
  CLAIM_LEASE_MS,
  distanceKm,
  isClaimExpired,
  isReportOverdue,
  reportDueAt,
} from "./workflow";

describe("field report deadlines", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  it("does not expose a live claim, then makes it claimable exactly at expiry", () => {
    expect(
      isClaimExpired("claimed", new Date(now.getTime() - CLAIM_LEASE_MS + 1), now),
    ).toBe(false);
    expect(isClaimExpired("claimed", new Date(now.getTime() - CLAIM_LEASE_MS), now)).toBe(
      true,
    );
    expect(
      isClaimExpired("checked_in", new Date(now.getTime() - CLAIM_LEASE_MS), now),
    ).toBe(false);
  });
  it("gives rescue reports a shorter SLA than road or shelter reports", () => {
    expect(reportDueAt("rescue", now).getTime() - now.getTime()).toBe(15 * 60 * 1000);
    expect(reportDueAt("road_blocked", now).getTime() - now.getTime()).toBe(
      2 * 60 * 60 * 1000,
    );
    expect(
      isReportOverdue("rescue", now, "queued", new Date(now.getTime() + 16 * 60 * 1000)),
    ).toBe(true);
    expect(
      isReportOverdue(
        "rescue",
        now,
        "completed",
        new Date(now.getTime() + 16 * 60 * 1000),
      ),
    ).toBe(false);
  });
  it("rejects a check-in beyond the 100 metre on-site boundary", () => {
    expect(distanceKm(25.6, 85.1, 25.6005, 85.1)).toBeLessThan(CHECK_IN_RADIUS_KM);
    expect(distanceKm(25.6, 85.1, 25.602, 85.1)).toBeGreaterThan(CHECK_IN_RADIUS_KM);
  });
});
