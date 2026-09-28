// Fail-closed coverage — unknown geometry dispatches to ZERO stations,
// never nationwide. Prisma is mocked; $queryRaw absent → epicenter null.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma, type CapAlert, type DisasterEvent, type FmStation } from "@prisma/client";
import { dispatchToStations } from "./fm-dispatcher";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    disasterEvent: { findUnique: vi.fn() },
    capAlert: { findMany: vi.fn() },
    fmStation: { findMany: vi.fn() },
    fmBroadcastLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/alerts/twilio-client", () => ({
  placeVoiceCall: vi.fn().mockResolvedValue({ ok: true, callSid: "CA-test" }),
}));

function makeStation(overrides: Partial<FmStation> = {}): FmStation {
  return {
    id: "stn-1",
    name: "Radio Delhi",
    frequency: "98.3",
    city: "Delhi",
    state: "Delhi",
    callSign: "RDP",
    coverageRadiusKm: 55,
    lat: new Prisma.Decimal(28.61),
    lng: new Prisma.Decimal(77.2),
    operator: "Private",
    type: "private",
    emergencyApiEndpoint: "https://api.station.in/cap",
    emergencyContactPhone: null,
    emailAddress: null,
    rdsEnabled: false,
    rdsApiEndpoint: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FmStation;
}

function makeCapAlert(): CapAlert {
  return {
    id: "cap-1",
    alertId: "dl-alert-1",
    disasterEventId: "evt-1",
    capXml:
      "<alert><info><headline>Flood Warning: Atlantis</headline>" +
      "<instruction>Move to higher ground now.</instruction>" +
      "<description>Flood alert. Evacuate now.</description></info></alert>",
    capHash: null,
    audioUrl: null,
    language: "hi-IN",
    severity: "Severe",
    status: "pending",
    sentAt: null,
    createdAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.fmStation.findMany.mockResolvedValue([makeStation(), makeStation({ id: "stn-2" })]);
  prismaMock.capAlert.findMany.mockResolvedValue([makeCapAlert()]);
  prismaMock.fmBroadcastLog.create.mockResolvedValue({});
});

describe("fail-closed coverage", () => {
  it("dispatches to zero stations when the district is unknown", async () => {
    prismaMock.disasterEvent.findUnique.mockResolvedValue({
      id: "evt-1",
      name: "Atlantis Flood",
      type: "flood",
      status: "active",
      district: "Atlantis",
      epicenter: null,
      startedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDemo: false,
      sessionId: null,
    } as DisasterEvent);

    const report = await dispatchToStations("evt-1", { testMode: true });
    expect(report.dispatched).toBe(0);
    expect(report.failed).toBe(0);
    expect(report.stations).toHaveLength(0);
    expect(prismaMock.fmBroadcastLog.create).not.toHaveBeenCalled();
  });

  it("dispatches to zero stations when the district is missing", async () => {
    prismaMock.disasterEvent.findUnique.mockResolvedValue({
      id: "evt-1",
      name: "Untitled",
      type: "flood",
      status: "active",
      district: null,
      epicenter: null,
      startedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDemo: false,
      sessionId: null,
    } as DisasterEvent);

    const report = await dispatchToStations("evt-1", { testMode: true });
    expect(report.stations).toHaveLength(0);
  });
});
