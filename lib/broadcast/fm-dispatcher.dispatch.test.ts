// Phase 4 · FM broadcast — dispatchToStations orchestration tests.
//
// dispatchToStations is the full pipeline: load the event + CAP alert,
// find covering stations, pick the best strategy per station, dispatch
// every station in parallel (Promise.allSettled), log attempts to
// fm_broadcast_logs, and retry failures. Prisma is mocked (same pattern
// as lib/data-ingestion/fetcher.test.ts) so these run hermetically — no
// database, no network.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Prisma,
  type CapAlert,
  type DisasterEvent,
  type FmStation,
} from "@prisma/client";
import { dispatchToStations } from "./fm-dispatcher";

// Prisma mock (vi.hoisted so the factory can reference it).
const { prismaMock, placeVoiceCallMock } = vi.hoisted(() => ({
  prismaMock: {
    disasterEvent: { findUnique: vi.fn() },
    capAlert: { findMany: vi.fn() },
    fmStation: { findMany: vi.fn() },
    fmBroadcastLog: { create: vi.fn() },
  },
  placeVoiceCallMock: vi.fn(),
}));

vi.mock("@/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/alerts/twilio-client", () => ({
  placeVoiceCall: placeVoiceCallMock,
}));

function makeStation(overrides: Partial<FmStation> = {}): FmStation {
  const lat = new Prisma.Decimal(25.59); // Patna
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

function makeEvent(overrides: Partial<DisasterEvent> = {}): DisasterEvent {
  return {
    id: "evt-1",
    name: "Patna Flood",
    type: "flood",
    status: "active",
    district: "Patna",
    epicenter: null,
    startedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDemo: false,
    sessionId: null,
    ...overrides,
  } as DisasterEvent;
}

function makeCapAlert(overrides: Partial<CapAlert> = {}): CapAlert {
  return {
    id: "cap-1",
    alertId: "dl-alert-1",
    disasterEventId: "evt-1",
    capXml:
      '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><identifier>dl-alert-1</identifier>' +
      "<info><headline>Flood Warning: Patna</headline>" +
      "<instruction>Move to higher ground now.</instruction>" +
      "<description>Flood alert in Patna. Evacuate now.</description></info></alert>",
    capHash: null,
    audioUrl: null,
    language: "hi-IN",
    severity: "Severe",
    status: "pending",
    sentAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.FM_SMTP_HOST; // email strategy must stay in dry-run mode
  placeVoiceCallMock.mockReset();
  placeVoiceCallMock.mockResolvedValue({ ok: true, callSid: "CA-test" });
  prismaMock.disasterEvent.findUnique.mockResolvedValue(makeEvent());
  prismaMock.capAlert.findMany.mockResolvedValue([makeCapAlert()]);
  prismaMock.fmStation.findMany.mockResolvedValue([makeStation()]);
  prismaMock.fmBroadcastLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dispatchToStations (Phase 4)", () => {
  it("throws when the disaster event is missing", async () => {
    prismaMock.disasterEvent.findUnique.mockResolvedValue(null);
    await expect(dispatchToStations("evt-missing")).rejects.toThrow("not found");
    expect(prismaMock.fmBroadcastLog.create).not.toHaveBeenCalled();
  });

  it("throws when no CAP alert exists for the event", async () => {
    prismaMock.capAlert.findMany.mockResolvedValue([]);
    await expect(dispatchToStations("evt-1")).rejects.toThrow("No CAP alert");
    expect(prismaMock.fmBroadcastLog.create).not.toHaveBeenCalled();
  });

  it("testMode dry-runs every station with no outbound calls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("outbound call made in testMode")),
    );
    prismaMock.fmStation.findMany.mockResolvedValue([
      makeStation({ id: "stn-a", emergencyApiEndpoint: "https://api.station.in/cap" }),
      makeStation({ id: "stn-b", emailAddress: "studio@station.in" }),
    ]);

    const report = await dispatchToStations("evt-1", { testMode: true });

    expect(report.testMode).toBe(true);
    expect(report.dispatched).toBe(2);
    expect(report.failed).toBe(0);
    expect(report.stations).toHaveLength(2);
    expect(report.stations.every((s) => s.ok)).toBe(true);
    expect(report.stations.map((s) => s.stationId)).toEqual(["stn-a", "stn-b"]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    // Every station attempt is still logged (marked test_mode).
    expect(prismaMock.fmBroadcastLog.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.fmBroadcastLog.create.mock.calls[0][0].data.testMode).toBe(true);
  });

  it("retries a failing station up to maxAttempts with the backoff", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 })),
    );
    prismaMock.fmStation.findMany.mockResolvedValue([
      makeStation({ id: "stn-a", emergencyApiEndpoint: "https://api.station.in/cap" }),
    ]);

    const report = await dispatchToStations("evt-1", {
      testMode: false,
      maxAttempts: 3,
      retryDelayMs: 0,
    });

    expect(report.failed).toBe(1);
    expect(report.dispatched).toBe(0);
    expect(report.stations[0].attempts).toBe(3);
    expect(report.stations[0].status).toBe("failed");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3); // 3 CAP API attempts
    const retryCounts = prismaMock.fmBroadcastLog.create.mock.calls.map(
      (call) => call[0].data.retryCount,
    );
    expect(retryCounts).toEqual([0, 1, 2]);
  });

  it("stops retrying once a station accepts the broadcast", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("rejected", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accepted: true, broadcast_time: "2026-08-12T07:00:00Z" }),
          {
            status: 200,
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    prismaMock.fmStation.findMany.mockResolvedValue([
      makeStation({ id: "stn-a", emergencyApiEndpoint: "https://api.station.in/cap" }),
    ]);

    const report = await dispatchToStations("evt-1", {
      testMode: false,
      maxAttempts: 3,
      retryDelayMs: 0,
    });

    expect(report.dispatched).toBe(1);
    expect(report.stations[0].attempts).toBe(2);
    expect(report.stations[0].status).toBe("delivered");
    expect(report.stations[0].broadcastTime).toBe("2026-08-12T07:00:00Z");
    expect(fetchMock).toHaveBeenCalledTimes(2); // no third attempt after success
    expect(prismaMock.fmBroadcastLog.create).toHaveBeenCalledTimes(2);
  });

  it("aggregates success + failure across stations in parallel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 })),
    );
    prismaMock.fmStation.findMany.mockResolvedValue([
      makeStation({ id: "stn-a", emergencyApiEndpoint: "https://api.station.in/cap" }),
      makeStation({ id: "stn-b", emailAddress: "studio@station.in" }),
    ]);

    const report = await dispatchToStations("evt-1", {
      testMode: false,
      maxAttempts: 1,
      retryDelayMs: 0,
    });

    expect(report.dispatched).toBe(1); // stn-b (email dry-run) succeeds
    expect(report.failed).toBe(1); // stn-a (CAP 500) fails after 1 attempt
    expect(report.stations.map((s) => s.stationId)).toEqual(["stn-a", "stn-b"]);
    expect(report.stations[0].ok).toBe(false);
    expect(report.stations[1].ok).toBe(true);
    // Two stations × one attempt each.
    expect(prismaMock.fmBroadcastLog.create).toHaveBeenCalledTimes(2);
  });

  it("skips stations with no supported channel", async () => {
    prismaMock.fmStation.findMany.mockResolvedValue([
      makeStation({ id: "stn-a", emergencyApiEndpoint: "https://api.station.in/cap" }),
      makeStation({ id: "stn-ghost" }), // no endpoint, no RDS, no email, not AIR
    ]);

    const report = await dispatchToStations("evt-1", { testMode: true });

    expect(report.stations).toHaveLength(1);
    expect(report.stations[0].stationId).toBe("stn-a");
    expect(prismaMock.fmBroadcastLog.create).toHaveBeenCalledTimes(1);
  });
});

describe("dispatchToStations IVR escalation (Phase 5)", () => {
  it("escalates a failed CAP API push to a control-room call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 })),
    );
    prismaMock.fmStation.findMany.mockResolvedValue([
      makeStation({
        id: "stn-a",
        emergencyApiEndpoint: "https://api.station.in/cap",
        emergencyContactPhone: "+919876543210",
      }),
    ]);

    const report = await dispatchToStations("evt-1", {
      testMode: false,
      maxAttempts: 1,
      retryDelayMs: 0,
    });

    expect(report.dispatched).toBe(1);
    expect(report.stations[0].status).toBe("delivered");
    expect(report.stations[0].strategy).toBe("ivr");
    expect(report.stations[0].attempts).toBe(2); // CAP API + IVR escalation
    expect(placeVoiceCallMock).toHaveBeenCalledTimes(1);

    const logs = prismaMock.fmBroadcastLog.create.mock.calls.map((call) => call[0].data);
    expect(logs.map((l) => l.strategy)).toEqual(["cap_api", "ivr"]);
    expect(logs[1].externalRef).toBe("CA-test"); // Twilio CallSid stored
  });

  it("attempts IVR for an AIR station and reports the missing phone clearly", async () => {
    prismaMock.fmStation.findMany.mockResolvedValue([
      makeStation({ id: "stn-air", type: "air" }), // AIR, but no phone configured
    ]);

    const report = await dispatchToStations("evt-1", {
      testMode: false,
      maxAttempts: 1,
      retryDelayMs: 0,
    });

    expect(report.failed).toBe(1);
    expect(report.stations[0].strategy).toBe("ivr");
    expect(report.stations[0].ok).toBe(false);
    expect(report.stations[0].responseBody).toContain("no emergency contact phone");
    expect(placeVoiceCallMock).not.toHaveBeenCalled();
  });

  it("routes a phone-only station straight to IVR", async () => {
    prismaMock.fmStation.findMany.mockResolvedValue([
      makeStation({ id: "stn-phone", emergencyContactPhone: "+919800000000" }),
    ]);

    const report = await dispatchToStations("evt-1", { testMode: true });

    expect(report.dispatched).toBe(1);
    expect(report.stations[0].strategy).toBe("ivr");
    expect(report.stations[0].ok).toBe(true);
    // Dry-run: no outbound Twilio call.
    expect(placeVoiceCallMock).not.toHaveBeenCalled();
  });
});
