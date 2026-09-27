import { describe, expect, it } from "vitest";
import { normalizeSatelliteEvents } from "./events";

describe("EONET event normalization", () => {
  it("uses the newest point geometry and drops events without usable coordinates", () => {
    const events = normalizeSatelliteEvents({ events: [
      { id: "EONET_1", title: "Flood", categories: [{ title: "Floods" }], geometry: [
        { type: "Point", coordinates: [85, 25], date: "2026-09-20" },
        { type: "Point", coordinates: [86, 26], date: "2026-09-21" },
      ] },
      { id: "EONET_2", title: "Invalid", geometry: [{ type: "Point", coordinates: [200, 91] }] },
    ] });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: "EONET_1", category: "Floods", lat: 26, lng: 86, observedAt: "2026-09-21" });
  });
});
