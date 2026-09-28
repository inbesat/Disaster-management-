// Coverage resolution — centroid + haversine filter tests.
import { describe, it, expect } from "vitest";
import { districtCentroid, filterByHaversine } from "./coverage";

const STATIONS = [
  {
    id: "patna",
    name: "Radio Patna",
    frequency: "98.3",
    city: "Patna",
    state: "Bihar",
    lat: 25.5941,
    lng: 85.1376,
    coverageRadiusKm: 50,
    type: "private",
    rdsEnabled: false,
    emergencyApiEndpoint: null,
    emergencyContactPhone: null,
    isActive: true,
  },
  {
    id: "delhi",
    name: "Radio Delhi",
    frequency: "98.3",
    city: "Delhi",
    state: "Delhi",
    lat: 28.6139,
    lng: 77.209,
    coverageRadiusKm: 55,
    type: "private",
    rdsEnabled: false,
    emergencyApiEndpoint: null,
    emergencyContactPhone: null,
    isActive: true,
  },
];

describe("districtCentroid", () => {
  it("resolves known districts", () => {
    expect(districtCentroid("Patna")).toMatchObject({ source: "district" });
    expect(districtCentroid("  PATNA ")).toMatchObject({ source: "district" });
  });

  it("returns null for unknown districts (fail-closed signal)", () => {
    expect(districtCentroid("Atlantis")).toBeNull();
    expect(districtCentroid(null)).toBeNull();
    expect(districtCentroid("")).toBeNull();
  });
});

describe("filterByHaversine", () => {
  it("keeps covering stations, drops distant ones", () => {
    const point = districtCentroid("Patna");
    expect(point).not.toBeNull();
    const matched = filterByHaversine(STATIONS, point!);
    expect(matched.map((s) => s.id)).toEqual(["patna"]);
  });
});
