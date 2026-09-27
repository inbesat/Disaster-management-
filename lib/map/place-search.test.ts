import { describe, expect, it } from "vitest";
import { coordinatesFromQuery, normalizePlaces } from "./place-search";

describe("place search result validation", () => {
  it("keeps only named results with valid coordinates", () => {
    const places = normalizePlaces({ local_results: [
      { title: "Patna", gps_coordinates: { latitude: 25.6, longitude: 85.1 }, address: "Bihar, India" },
      { title: "Broken", gps_coordinates: { latitude: 200, longitude: 85 } },
      { title: "Missing coordinates" },
    ] });
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ label: "Patna", lat: 25.6, lng: 85.1 });
  });
  it("accepts valid coordinate searches and rejects out-of-range points", () => {
    expect(coordinatesFromQuery("25.5941, 85.1376")).toMatchObject({ lat: 25.5941, lng: 85.1376 });
    expect(coordinatesFromQuery("100, 85")).toBeNull();
  });
});
