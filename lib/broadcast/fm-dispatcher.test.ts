// Phase 4 · FM broadcast — strategy tests: strategy selection, RDS text,
// FTP URL parsing, and strategy `send()` behavior with mocked fetch.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma, type CapAlert, type FmStation } from "@prisma/client";
import { CapApiStrategy, isUsableUrl } from "./strategies/cap-api";
import { RdsPushStrategy } from "./strategies/rds-push";
import { FtpDropStrategy, parseFtpUrl } from "./strategies/ftp-drop";
import { EmailStudioStrategy } from "./strategies/email-studio";
import { selectBestStrategy, selectAllStrategies } from "./strategy-selector";
import { buildRdsText, truncateSmart, RDS_MAX_CHARS } from "./rds-text";
import type { DispatchContext } from "./types";

function makeStation(overrides: Partial<FmStation> = {}): FmStation {
  const lat = new Prisma.Decimal(25.59);
  const lng = new Prisma.Decimal(85.14);
  return {
    id: "stn-1",
    name: "Radio Patna",
    frequency: "101.4",
    city: "Patna",
    state: "Bihar",
    callSign: "RDP",
    coverageRadiusKm: 50,
    lat,
    lng,
    operator: "Private",
    type: "private",
    emergencyApiEndpoint: null,
    emergencyContactPhone: null,
    emailAddress: null,
    rdsEnabled: false,
    rdsApiEndpoint: null,
    playoutEndpoint: null,
    easAreaCode: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeContext(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    capAlert: { capXml: "<alert/>" } as CapAlert,
    audioBuffer: Buffer.from("FAKE_MP3_BYTES"),
    alertId: "dl-alert-1",
    headline: "Flood Warning: Patna",
    rdsText: "Flood alert Patna. Move to higher ground now.",
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// Strategy selection
// ---------------------------------------------------------------------
describe("selectBestStrategy (Phase 4)", () => {
  const strategies = [
    new CapApiStrategy(),
    new RdsPushStrategy(),
    new FtpDropStrategy(),
    new EmailStudioStrategy(),
  ];

  it("prefers cap_api when the station has a modern endpoint", () => {
    const station = makeStation({ emergencyApiEndpoint: "https://api.station.in/cap" });
    expect(selectBestStrategy(station, strategies)?.name).toBe("cap_api");
  });

  it("falls back to rds for rds-enabled stations", () => {
    const station = makeStation({
      emergencyApiEndpoint: null,
      rdsEnabled: true,
      rdsApiEndpoint: "https://rds.station.in/ps",
    });
    expect(selectBestStrategy(station, strategies)?.name).toBe("rds");
  });

  it("returns ftp for stations with an ftp endpoint", () => {
    const station = makeStation({
      emergencyApiEndpoint: "ftp://ftp.station.in:21",
    });
    expect(selectBestStrategy(station, strategies)?.name).toBe("ftp");
  });

  it("returns email when only an inbox is set", () => {
    const station = makeStation({ emailAddress: "studio@station.in" });
    expect(selectBestStrategy(station, strategies)?.name).toBe("email");
  });

  it("returns null when no channel is configured", () => {
    const station = makeStation({});
    expect(selectBestStrategy(station, strategies)).toBeNull();
  });

  it("selectAllStrategies returns every supported channel", () => {
    const station = makeStation({
      emergencyApiEndpoint: "https://api.station.in/cap",
      rdsEnabled: true,
      rdsApiEndpoint: "https://rds.station.in/ps",
      emailAddress: "studio@station.in",
    });
    const names = selectAllStrategies(station, strategies).map((s) => s.name);
    expect(names).toEqual(["cap_api", "rds", "email"]);
  });
});

// ---------------------------------------------------------------------
// RDS text
// ---------------------------------------------------------------------
describe("buildRdsText (Phase 4)", () => {
  it("always stays within the 64-char RDS limit", () => {
    const text = buildRdsText({
      event: "Flood",
      district: "Patna",
      headline: "Severe Flood Warning: Patna District",
      instruction:
        "Move to higher ground immediately. Do not walk or drive through flood water. " +
        "Keep your emergency kit and documents ready.",
    });
    expect(text.length).toBeLessThanOrEqual(RDS_MAX_CHARS);
  });

  it("prepends the EMERGENCY prefix", () => {
    const text = buildRdsText({
      event: "Flood",
      district: "Patna",
      headline: "Flood Warning: Patna",
      instruction: "Evacuate now.",
    });
    expect(text.startsWith("EMERGENCY: ")).toBe(true);
  });

  it("keeps short messages intact (no mid-word truncation)", () => {
    const text = buildRdsText({
      event: "Cyclone",
      district: "Puri",
      headline: "Cyclone Warning: Puri",
      instruction: "Move to the nearest cyclone shelter immediately.",
    });
    expect(text.startsWith("EMERGENCY: Cyclone alert Puri.")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(RDS_MAX_CHARS);
  });

  it("drops the action sentence cleanly when it would overflow", () => {
    const long = buildRdsText({
      event: "Heatwave",
      district: "Muzaffarpur",
      headline: "Severe Heatwave Advisory for Muzaffarpur and surrounding blocks",
      instruction:
        "Avoid outdoor activity between 11 AM and 4 PM. Drink plenty of water. " +
        "Check on elderly neighbors and do not leave children or pets in parked vehicles.",
    });
    expect(long.length).toBeLessThanOrEqual(RDS_MAX_CHARS);
    expect(long.endsWith(" ")).toBe(false);
  });

  it("truncateSmart cuts at a word boundary", () => {
    expect(truncateSmart("alpha beta gamma delta", 12)).toBe("alpha beta");
    expect(truncateSmart("short", 100)).toBe("short");
  });
});

// ---------------------------------------------------------------------
// FTP URL parsing
// ---------------------------------------------------------------------
describe("parseFtpUrl (Phase 4)", () => {
  it("parses host, port, user, password", () => {
    const creds = parseFtpUrl("ftp://alerts:s3cret@ftp.station.in:2121");
    expect(creds).toEqual({
      host: "ftp.station.in",
      port: 2121,
      user: "alerts",
      password: "s3cret",
    });
  });

  it("defaults anonymous + port 21", () => {
    const creds = parseFtpUrl("ftp://ftp.station.in");
    expect(creds).toEqual({
      host: "ftp.station.in",
      port: 21,
      user: "anonymous",
      password: "",
    });
  });

  it("rejects non-FTP protocols", () => {
    expect(parseFtpUrl("https://ftp.station.in")).toBeNull();
    expect(parseFtpUrl("not a url")).toBeNull();
  });
});

// ---------------------------------------------------------------------
// CapApiStrategy.send — mocked fetch
// ---------------------------------------------------------------------
describe("CapApiStrategy (Phase 4)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks a 200 with accepted:true as delivered", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ accepted: true, broadcast_time: "2026-08-12T07:00:00Z" }), {
        status: 200,
      }),
    );
    const station = makeStation({ emergencyApiEndpoint: "https://api.station.in/cap" });
    const result = await new CapApiStrategy().send(station, makeContext());
    expect(result.ok).toBe(true);
    expect(result.responseCode).toBe(200);
    expect(result.broadcastTime).toBe("2026-08-12T07:00:00Z");
  });

  it("marks a 500 as failed", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("boom", { status: 500 }));
    const station = makeStation({ emergencyApiEndpoint: "https://api.station.in/cap" });
    const result = await new CapApiStrategy().send(station, makeContext());
    expect(result.ok).toBe(false);
    expect(result.responseCode).toBe(500);
  });

  it("handles network failure as failed without throwing", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));
    const station = makeStation({ emergencyApiEndpoint: "https://api.station.in/cap" });
    const result = await new CapApiStrategy().send(station, makeContext());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("sends multipart with cap + audio fields", async () => {
    const send = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
    vi.mocked(fetch).mockImplementation(send);
    const station = makeStation({ emergencyApiEndpoint: "https://api.station.in/cap" });
    await new CapApiStrategy().send(station, makeContext());
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("https://api.station.in/cap");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer /);
    expect(init.body).toBeInstanceOf(FormData);
  });
});

describe("isUsableUrl (Phase 4)", () => {
  it("accepts http(s) URLs and rejects placeholders/bad input", () => {
    expect(isUsableUrl("https://api.station.in/cap")).toBe(true);
    expect(isUsableUrl("http://api.station.in")).toBe(true);
    expect(isUsableUrl("https://your-station.in/cap")).toBe(false);
    expect(isUsableUrl("your-station.in")).toBe(false);
    expect(isUsableUrl(null)).toBe(false);
    expect(isUsableUrl("")).toBe(false);
  });
});

// ---------------------------------------------------------------------
// RdsPushStrategy + EmailStudioStrategy (no-op / dry-run paths)
// ---------------------------------------------------------------------
describe("RdsPushStrategy + EmailStudioStrategy (Phase 4)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rds: posts {rds_text, duration_minutes} and truncates to 64 chars", async () => {
    const send = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.mocked(fetch).mockImplementation(send);
    const station = makeStation({ rdsEnabled: true, rdsApiEndpoint: "https://rds.station.in/ps" });
    const longContext = makeContext({
      rdsText: "X".repeat(120),
    });
    const result = await new RdsPushStrategy().send(station, longContext);
    expect(result.ok).toBe(true);
    const body = JSON.parse((send.mock.calls[0][1] as RequestInit).body as string) as {
      rds_text: string;
      duration_minutes: number;
    };
    expect(body.rds_text.length).toBeLessThanOrEqual(64);
    expect(body.duration_minutes).toBe(30);
  });

  it("email: dry-runs when no SMTP is configured", async () => {
    delete process.env.FM_SMTP_HOST;
    delete process.env.FM_EMAIL_TO;
    const station = makeStation({ emailAddress: "studio@station.in" });
    const result = await new EmailStudioStrategy().send(station, makeContext());
    expect(result.ok).toBe(true);
    expect(result.responseBody).toContain("dry-run");
  });
});
