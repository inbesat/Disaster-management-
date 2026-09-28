// EAS / SAME — header encoding + gateway dry-run tests.
import { describe, it, expect } from "vitest";
import {
  buildSameHeader,
  buildEasMessage,
  dayOfYear,
  sameAreaForDistrict,
  sameDuration,
  sameEventForDisaster,
  sendEasAlert,
} from "./eas";

describe("SAME header encoding", () => {
  it("builds a well-formed ZCZC header", () => {
    const header = buildSameHeader({
      originator: "CIV",
      eventCode: "EVI",
      areas: ["104001"],
      durationMinutes: 60,
      sentAt: new Date(Date.UTC(2026, 7, 12, 7, 0, 0)),
    });
    expect(header.startsWith("ZCZC-CIV-EVI-104001+")).toBe(true);
    expect(header.endsWith("-")).toBe(true);
    // ZCZC-ORG-EEE-PSSCCC+TTTT-JJJ-llllllll-
    expect(header.split("-").length).toBeGreaterThanOrEqual(6);
  });

  it("requires at least one area code", () => {
    expect(() => buildSameHeader({ eventCode: "EVI", areas: [] })).toThrow(
      "at least one",
    );
  });

  it("maps critical flood to evacuation-immediate", () => {
    expect(sameEventForDisaster("flood", "critical")).toBe("EVI");
    expect(sameEventForDisaster("flood", "warning")).toBe("FLW");
    expect(sameEventForDisaster("flood", "watch")).toBe("FLA");
    expect(sameEventForDisaster("cyclone", "warning")).toBe("HUW");
  });

  it("resolves known districts and hashes unknown ones deterministically", () => {
    expect(sameAreaForDistrict("Patna")).toBe("104001");
    expect(sameAreaForDistrict("patna")).toBe("104001");
    const a = sameAreaForDistrict("Somewhere New");
    const b = sameAreaForDistrict("somewhere new");
    expect(a).toBe(b);
    expect(a).toMatch(/^\d{6}$/);
  });

  it("encodes purge time on 15-minute slots", () => {
    expect(sameDuration(10)).toBe("0015");
    expect(sameDuration(60)).toBe("0100");
    expect(sameDuration(90)).toBe("0130");
    expect(sameDuration(9999)).toBe("0600");
  });

  it("computes day-of-year in UTC", () => {
    expect(dayOfYear(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)))).toBe("001");
  });

  it("wraps header + attention + EOM", () => {
    const msg = buildEasMessage("ZCZC-CIV-EVI-104001+0100-224-07000000-", "alert-1");
    expect(msg).toContain("ZCZC-CIV-EVI");
    expect(msg).toContain("NNNN");
  });
});

describe("sendEasAlert (no gateway → dry-run)", () => {
  it("returns a dry-run success with the SAME header", async () => {
    delete process.env.EAS_GATEWAY_URL;
    const result = await sendEasAlert({
      disasterType: "flood",
      district: "Patna",
      severity: "critical",
      headline: "Flood Warning: Patna",
      alertId: "dl-test-1",
    });
    expect(result.ok).toBe(true);
    expect(result.sameHeader).toContain("ZCZC-CIV-EVI-104001+");
    expect(result.responseBody).toContain("[dry-run]");
  });
});
