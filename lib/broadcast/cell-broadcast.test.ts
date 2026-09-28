// Cell broadcast — single-page budget + dry-run tests.
import { describe, it, expect } from "vitest";
import {
  buildCellBroadcastText,
  CELL_BROADCAST_MAX_CHARS,
  sendCellBroadcast,
} from "./cell-broadcast";

describe("buildCellBroadcastText", () => {
  it("stays within the single-page budget", () => {
    const page = buildCellBroadcastText({
      disasterType: "flood",
      district: "Patna",
      severity: "critical",
      instruction:
        "Move to higher ground immediately. Do not walk or drive through flood water. Keep documents ready.",
    });
    expect(page.length).toBeLessThanOrEqual(CELL_BROADCAST_MAX_CHARS);
    expect(page).toContain("EVACUATE NOW");
    expect(page).toContain("PATNA");
  });

  it("never ends mid-word", () => {
    const page = buildCellBroadcastText({
      disasterType: "cyclone",
      district: "Puri",
      severity: "warning",
      instruction: "word ".repeat(60),
    });
    expect(page.length).toBeLessThanOrEqual(CELL_BROADCAST_MAX_CHARS);
    expect(page.endsWith(" ")).toBe(false);
  });
});

describe("sendCellBroadcast (no gateway → dry-run)", () => {
  it("returns the exact page in dry-run", async () => {
    delete process.env.CELL_BROADCAST_GATEWAY_URL;
    const result = await sendCellBroadcast({
      disasterType: "flood",
      district: "Patna",
      severity: "warning",
    });
    expect(result.ok).toBe(true);
    expect(result.page).toContain("PATNA");
    expect(result.responseBody).toContain("[dry-run]");
  });
});
