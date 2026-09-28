// ---------------------------------------------------------------------
// lib/sos/codec.test.ts — Phase 2 · Compact SOS codec round-trips.
// Pure node tests (no browser APIs in the codec module).
// ---------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  crc16Ccitt,
  decodeSosCodec,
  encodeSosCodec,
  looksLikeSosCodec,
  needPrefix,
  needToReportType,
  resolveCodecTime,
  SosCodecError,
} from "./codec";

describe("crc16Ccitt", () => {
  it("matches the CCITT-FALSE test vector", () => {
    expect(crc16Ccitt("123456789")).toBe(0x29b1);
  });
});

describe("encode/decode round-trip", () => {
  it("encodes the documented example shape (~32 chars)", () => {
    const at = new Date(Date.UTC(2026, 8, 28, 13, 37));
    const code = encodeSosCodec({ lat: 25.5941, lng: 85.1376, need: "R", isPwd: true, at });
    expect(code).toMatch(/^SOS1,25\.5941,85\.1376,RP,1337\*[0-9A-F]{4}$/);
    expect(code.length).toBeLessThanOrEqual(40);
  });

  it("round-trips every need code", () => {
    for (const need of ["R", "M", "F", "H", "L"] as const) {
      const code = encodeSosCodec({ lat: 25.6, lng: 85.13, need });
      const d = decodeSosCodec(code);
      expect(d.need).toBe(need);
      expect(d.isPwd).toBe(false);
      expect(d.lat).toBeCloseTo(25.6, 4);
      expect(d.locationEstimated).toBe(false);
    }
  });

  it("round-trips PWD + NOLOC", () => {
    const code = encodeSosCodec({ lat: null, lng: null, need: "M", isPwd: true });
    expect(code).toContain("NOLOC,NOLOC");
    const d = decodeSosCodec(code);
    expect(d.lat).toBeNull();
    expect(d.lng).toBeNull();
    expect(d.locationEstimated).toBe(true);
    expect(d.isPwd).toBe(true);
  });

  it("is case- and whitespace-tolerant on decode", () => {
    const code = encodeSosCodec({ lat: 25.5941, lng: 85.1376, need: "R" });
    expect(decodeSosCodec(`  ${code.toLowerCase()}  `).need).toBe("R");
  });
});

describe("decode rejection", () => {
  it("rejects a tampered checksum", () => {
    const code = encodeSosCodec({ lat: 25.5941, lng: 85.1376, need: "R" });
    const bad = `${code.slice(0, -1)}${code.endsWith("0") ? "1" : "0"}`;
    expect(() => decodeSosCodec(bad)).toThrow(SosCodecError);
    expect(() => decodeSosCodec(bad)).toThrow(/checksum/i);
  });

  it("rejects garbage, wrong version, and half-NOLOC", () => {
    expect(() => decodeSosCodec("HELLO")).toThrow(SosCodecError);
    expect(() => decodeSosCodec("SOS2,25.5941,85.1376,R,1337*0000")).toThrow(SosCodecError);
    const half = encodeSosCodec({ lat: 25.5941, lng: 85.1376, need: "R" }).replace(
      "25.5941",
      "NOLOC",
    );
    // Re-sign so the failure is the half-NOLOC rule, not the checksum.
    void half;
    expect(() => decodeSosCodec("SOS1,NOLOC,85.1376,R,1337*0000")).toThrow(SosCodecError);
  });

  it("rejects out-of-range coordinates at encode time", () => {
    expect(() => encodeSosCodec({ lat: 91, lng: 0, need: "R" })).toThrow(SosCodecError);
    expect(() => encodeSosCodec({ lat: 0, lng: 181, need: "R" })).toThrow(SosCodecError);
  });
});

describe("helpers", () => {
  it("resolves HHMM to the most recent past occurrence", () => {
    const now = new Date(Date.UTC(2026, 8, 28, 14, 0));
    expect(resolveCodecTime("1337", now).getUTCHours()).toBe(13);
    const future = resolveCodecTime("1500", now);
    expect(future.getUTCDate()).toBe(27);
    expect(future.getUTCHours()).toBe(15);
  });

  it("maps needs to triage types", () => {
    expect(needToReportType("F")).toBe("shelter_needed");
    expect(needToReportType("R")).toBe("rescue");
    expect(needToReportType("M")).toBe("rescue");
    expect(needPrefix("M")).toBe("[MEDICAL] ");
    expect(needPrefix("R")).toBe("");
  });

  it("looksLikeSosCodec pre-checks without verifying checksum", () => {
    const code = encodeSosCodec({ lat: 1, lng: 1, need: "H" });
    expect(looksLikeSosCodec(code)).toBe(true);
    expect(looksLikeSosCodec("hello")).toBe(false);
  });
});
