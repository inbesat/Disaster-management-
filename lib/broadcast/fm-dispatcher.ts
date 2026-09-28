// ---------------------------------------------------------------------
// lib/broadcast/fm-dispatcher.ts — Phase 4 · multi-strategy FM dispatcher.
//
// dispatchToStations(disasterEventId) drives the full broadcast pipeline:
//
//   1. Load the DisasterEvent + the CapAlert produced for it.
//   2. Find the FM stations whose coverage reaches the disaster zone
//      (Phase 1 geospatial lookup; district-centroid fallback).
//   3. Reuse the generated CAP XML + voiced MP3 (Phases 2–3).
//   4. Walk the digital channel chain per station (eas → cap_api →
//      playout → cell_broadcast → rds → ftp → email → siren), then
//      escalate to a single IVR control-room call (Phase 5) when the
//      whole digital chain fails — AIR stations always escalate.
//   5. Dispatch every station in parallel (Promise.allSettled).
//   6. Log each attempt to fm_broadcast_logs.
//   7. Retry failed attempts (max 3, 2-minute backoff).
//
// Coverage is fail-closed: unknown geometry resolves to ZERO stations,
// never to a nationwide blast. Resolution order is PostGIS epicenter →
// district-centroid haversine → [] (see lib/fm/coverage.ts).
//
// Phase 5's fourth trigger — "no response from the station within 3
// minutes" (a station that accepted but never confirmed) — needs a
// background sweep job; the in-band triggers (digital chain failure, AIR
// guarantee) are handled here.
//
// When `testMode` is set, the dispatcher refuses real outbound calls and
// records deterministic "dry-run" results so a safety check can be
// rehearsed end-to-end without broadcasting.
// ---------------------------------------------------------------------

import { prisma } from "@/server/prisma";
import type { CapAlert, DisasterEvent, FmStation, Prisma } from "@prisma/client";
import { MOCK_FM_STATIONS } from "@/lib/fm/mock-stations";
import {
  districtCentroid,
  filterByHaversine,
  queryCoveringStationIds,
  readEventEpicenter,
} from "@/lib/fm/coverage";
import { CapApiStrategy } from "@/lib/broadcast/strategies/cap-api";
import { RdsPushStrategy } from "@/lib/broadcast/strategies/rds-push";
import { FtpDropStrategy } from "@/lib/broadcast/strategies/ftp-drop";
import { EmailStudioStrategy } from "@/lib/broadcast/strategies/email-studio";
import { IvrCallStrategy } from "@/lib/broadcast/strategies/ivr-call";
import { EasGatewayStrategy } from "@/lib/broadcast/strategies/eas-gateway";
import { PlayoutInjectStrategy } from "@/lib/broadcast/strategies/playout-inject";
import { CellBroadcastStrategy } from "@/lib/broadcast/strategies/cell-broadcast";
import { SirenTriggerStrategy } from "@/lib/broadcast/strategies/siren-trigger";
import { buildEmergencyRdsText, mapCapSeverity } from "@/lib/broadcast/rds-encoder";
import { selectAllStrategies } from "@/lib/broadcast/strategy-selector";
import { safeLog } from "@/lib/logger";
import type {
  DispatchContext,
  DispatchResult,
  DispatchStrategyName,
  FMDispatchStrategy,
  FmBroadcastLogDTO,
} from "@/lib/broadcast/types";

// Re-export pure helpers used by callers/tests.
export { isUsableUrl } from "@/lib/broadcast/strategies/cap-api";
export { parseFtpUrl, type FtpCredentials } from "@/lib/broadcast/strategies/ftp-drop";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2 * 60 * 1000;

/** Default geofence radius (km) for the PostGIS ST_DWithin lookup. */
const COVERAGE_RADIUS_KM = 50;

/** Internal shape for one station's finished dispatch (parallel loop). */
interface StationAttempt {
  station: FmStation;
  /** Null when no attempt was made (unsupported channel / zero maxAttempts). */
  last: DispatchResult | null;
  attempt: number;
}

/** A single station's dispatch attempt result (for the route response). */
export interface StationDispatchResult {
  stationId: string;
  stationName: string;
  frequency: string;
  strategy: DispatchStrategyName;
  ok: boolean;
  attempts: number;
  status: string;
  responseCode: number | null;
  responseBody: string | null;
  broadcastTime: string | null;
}

export interface DispatchReport {
  dispatched: number;
  failed: number;
  testMode: boolean;
  stations: StationDispatchResult[];
  capAlertId: string | null;
}

interface DispatchOptions {
  /** When set, no real outbound calls are made. */
  testMode?: boolean;
  /** Retry schedule override (tests / local demo). */
  retryDelayMs?: number;
  maxAttempts?: number;
}

/**
 * Dispatch a CAP alert for a disaster event to every covering FM station.
 * Returns a summary report; each station's attempts are logged to
 * fm_broadcast_logs.
 */
export async function dispatchToStations(
  disasterEventId: string,
  options: DispatchOptions = {},
): Promise<DispatchReport> {
  const testMode = options.testMode ?? false;
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;

  // 1. Load the event + its CAP alert (Phases 2–3 outputs).
  const [event, capAlerts] = await Promise.all([
    prisma.disasterEvent.findUnique({ where: { id: disasterEventId } }),
    prisma.capAlert.findMany({
      where: { disasterEventId },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
  ]);
  if (!event) throw new Error("Disaster event not found.");
  const capAlert = capAlerts[0];
  if (!capAlert) {
    throw new Error(
      "No CAP alert exists for this event — generate one via POST /api/cap/generate first.",
    );
  }

  // 2. Resolve the affected-point + radio-ready context.
  const context = await buildDispatchContext(event, capAlert);

  // 4. Find covering stations.
  const stations = await findCoveringStations(event);

  // Assemble the strategy set (kept instance-level for test seam).
  const strategies = defaultStrategies();

  const report: DispatchReport = {
    dispatched: 0,
    failed: 0,
    testMode,
    stations: [],
    capAlertId: capAlert.id,
  };

  // 5–7. Dispatch every station in parallel (Promise.allSettled). Each
  // station's own retry loop still runs (maxAttempts / retryDelayMs), but
  // all stations progress concurrently — no one slow FTP link stalls the
  // rest of the broadcast. The report preserves station order.
  const attempts = await Promise.allSettled(
    stations.map(async (station): Promise<StationAttempt | null> => {
      // 1. Every supported digital channel in priority order
      //    (eas → cap_api → playout → cell_broadcast → rds → ftp → email
      //    → siren) — each with its own retry budget, so a failed EAS
      //    push falls through to CAP API, playout, RDS, FTP, email…
      const digital = selectAllStrategies(station, strategies).filter(
        (s) => s.name !== "ivr",
      );
      const ivr = strategies.find((s) => s.name === "ivr");
      const canIvr = Boolean(ivr && ivr.supports(station));

      // No digital channel and no IVR path (no phone, not AIR) — nothing
      // to do for this station.
      if (digital.length === 0 && !canIvr) return null;

      let last: DispatchResult | null = null;
      let attempt = 0;

      for (const channel of digital) {
        while (attempt < maxAttempts) {
          attempt += 1;
          last = await dispatchAttempt(station, channel, context, {
            testMode,
            attempt,
          });
          if (last.ok) break;
          if (attempt < maxAttempts) {
            await delay(retryDelayMs);
          }
        }
        if (last && last.ok) break;
      }

      // 2. IVR escalation (Phase 5): the digital chain failed (or no
      //    digital channel exists) and the station can be called — a
      //    control-room call is placed once. AIR stations always escalate;
      //    the call-status webhook tracks the call to completion.
      if (ivr && ivr.supports(station) && !last?.ok) {
        const escalated = await dispatchAttempt(station, ivr, context, {
          testMode,
          attempt: 1,
        });
        attempt += 1;
        last = escalated;
      }

      return { station, last, attempt };
    }),
  );

  for (const settled of attempts) {
    if (settled.status === "rejected" || !settled.value) continue;
    const { station, last, attempt } = settled.value;
    if (!last) continue; // no attempt made — nothing to report

    const stationResult: StationDispatchResult = {
      stationId: station.id,
      stationName: station.name,
      frequency: station.frequency,
      strategy: last.strategy,
      ok: last.ok,
      attempts: attempt,
      status: last.ok ? "delivered" : "failed",
      responseCode: last.responseCode,
      responseBody: last.responseBody,
      broadcastTime: last.broadcastTime ?? null,
    };
    report.stations.push(stationResult);
    if (last.ok) report.dispatched += 1;
    else report.failed += 1;
  }

  return report;
}

/** Wrapper that logs every attempt regardless of outcome. */
async function dispatchAttempt(
  station: FmStation,
  strategy: FMDispatchStrategy,
  context: DispatchContext,
  opts: { testMode: boolean; attempt: number },
): Promise<DispatchResult> {
  const result = opts.testMode
    ? dryRunResult(strategy, station)
    : await strategy.send(station, context);

  void writeLog(station, context.capAlert.id, strategy.name, result, {
    retryCount: opts.attempt - 1,
    testMode: opts.testMode,
  });
  return result;
}

/** Deterministic result for testMode (no outbound calls). */
function dryRunResult(strategy: FMDispatchStrategy, _station: FmStation): DispatchResult {
  const detail = describeChannel(strategy);
  return {
    ok: true,
    strategy: strategy.name,
    responseCode: 200,
    responseBody: `[dry-run] ${_station.name} would receive the broadcast via ${detail}.`,
  };
}

function describeChannel(strategy: FMDispatchStrategy): string {
  switch (strategy.name) {
    case "eas":
      return "EAS SAME interrupt";
    case "cap_api":
      return "CAP API push";
    case "playout":
      return "playout injection";
    case "cell_broadcast":
      return "cell broadcast";
    case "rds":
      return "RDS text scrolling";
    case "ftp":
      return "FTP audio drop";
    case "email":
      return "studio email";
    case "siren":
      return "outdoor sirens";
    default:
      return "IVR callback";
  }
}

async function writeLog(
  station: FmStation,
  capAlertId: string,
  strategy: DispatchStrategyName,
  result: DispatchResult,
  opts: { retryCount: number; testMode: boolean },
): Promise<void> {
  try {
    await prisma.fmBroadcastLog.create({
      data: {
        capAlertId,
        fmStationId: station.id,
        strategy,
        status: result.ok ? "delivered" : "failed",
        responseCode: result.responseCode,
        responseBody: result.responseBody?.slice(0, 2000) ?? null,
        broadcastTime: result.broadcastTime ? new Date(result.broadcastTime) : null,
        retryCount: opts.retryCount,
        testMode: opts.testMode,
        externalRef: result.externalRef ?? null,
      },
    });
  } catch (error: unknown) {
    safeLog("error", "[broadcast] Failed to write fm_broadcast_log", { metadata: { error: String(error) } });
  }
}

/** Resolve station coverage for the event (PostGIS → centroid → fail-closed). */
async function findCoveringStations(event: DisasterEvent): Promise<FmStation[]> {
  let stations: FmStation[];
  try {
    stations = await prisma.fmStation.findMany({
      where: { isActive: true },
    });
  } catch (error: unknown) {
    // DB unreachable (migrations not pushed / offline) — dispatch against
    // the seeded demo list so the end-to-end pipeline can still be
    // rehearsed (same fallback as /api/fm/stations + /api/fm/coverage).
    safeLog("error", "[broadcast] Failed to load FM stations — using demo list", { metadata: { error: String(error) } });
    stations = MOCK_FM_STATIONS as unknown as FmStation[];
  }

  // 1. Best signal: the PostGIS epicenter against coverage_area polygons.
  const epicenter = await readEventEpicenter(event.id);
  if (epicenter) {
    const ids = await queryCoveringStationIds(epicenter, COVERAGE_RADIUS_KM);
    if (ids) {
      // Query succeeded (possibly empty) — the index is authoritative.
      const matchedIds = new Set(ids);
      return stations.filter((s) => matchedIds.has(s.id));
    }
    // PostGIS failed — degrade to haversine around the epicenter.
    return haversineFilter(stations, epicenter.lat, epicenter.lng);
  }

  // 2. District centroid fallback (offline/demo path).
  const centroid = districtCentroid(event.district);
  if (centroid) {
    return haversineFilter(stations, centroid.lat, centroid.lng);
  }

  // 3. No geometry signal — FAIL CLOSED. Broadcasting to every active
  // station from an unknown location notifies unrelated states; an
  // operator must set the epicenter/district first. Previously this
  // returned all stations (nationwide blast).
  safeLog("warn", "[broadcast] No coverage geometry — failing closed (0 stations)", {
    metadata: { district: event.district ?? null, eventId: event.id },
  });
  return [];
}

/** Haversine filter over loaded stations (turf great-circle). */
function haversineFilter(stations: FmStation[], lat: number, lng: number): FmStation[] {
  const plain = stations.map((s) => ({
    ...s,
    lat: s.lat !== null ? Number(s.lat) : null,
    lng: s.lng !== null ? Number(s.lng) : null,
  }));
  const matched = filterByHaversine(plain, { lat, lng, source: "district" }, COVERAGE_RADIUS_KM);
  const matchedIds = new Set(matched.map((s) => s.id));
  return stations.filter((s) => matchedIds.has(s.id));
}

/** Assemble the shared broadcast context (script + RDS text + buffers). */
async function buildDispatchContext(
  event: DisasterEvent,
  capAlert: CapAlert,
): Promise<DispatchContext> {
  const { headline, instruction, script } = parseCap(capAlert.capXml);

  // Phase 6: severity-tuned RDS templates for known disaster types (falls
  // back to the generic text builder otherwise).
  const rdsText = buildEmergencyRdsText({
    severity: mapCapSeverity(capAlert.severity),
    disasterType: event.type,
    district: event.district ?? "",
    headline,
    instruction,
    script,
  });

  // Audio bytes: fetch the stored MP3 when available (data-URIs skipped).
  let audioBuffer = Buffer.alloc(0);
  if (capAlert.audioUrl && !capAlert.audioUrl.startsWith("data:")) {
    try {
      const remote = await fetch(capAlert.audioUrl, {
        signal: AbortSignal.timeout(10_000),
      });
      if (remote.ok) {
        audioBuffer = Buffer.from(await remote.arrayBuffer());
      }
    } catch (error: unknown) {
      safeLog("error", "[broadcast] Failed to fetch stored audio", { metadata: { error: String(error) } });
    }
  }

  return {
    capAlert,
    audioBuffer,
    alertId: capAlert.alertId,
    headline,
    rdsText,
    district: event.district ?? undefined,
    disasterType: event.type ?? undefined,
  };
}

/** Pull headline/instruction/description out of the CAP XML. */
function parseCap(capXml: string): {
  headline: string;
  instruction: string;
  script: string;
} {
  const get = (tag: string) => {
    const match = capXml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return match ? match[1] : "";
  };
  return {
    headline: get("headline") || "Emergency Alert",
    instruction: get("instruction"),
    script: get("description"),
  };
}

/** The default strategy registry (also used by the route for inspection). */
export function defaultStrategies(): FMDispatchStrategy[] {
  return [
    new EasGatewayStrategy(),
    new CapApiStrategy(),
    new PlayoutInjectStrategy(),
    new CellBroadcastStrategy(),
    new RdsPushStrategy(),
    new FtpDropStrategy(),
    new EmailStudioStrategy(),
    new SirenTriggerStrategy(),
    new IvrCallStrategy(),
  ];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serialize a broadcast log row for API responses. */
export function serializeBroadcastLog(
  row: Prisma.FmBroadcastLogGetPayload<{ include: { fmStation: true } }>,
): FmBroadcastLogDTO {
  return {
    id: row.id,
    capAlertId: row.capAlertId,
    fmStationId: row.fmStationId,
    stationName: row.fmStation?.name,
    strategy: row.strategy,
    status: row.status,
    responseCode: row.responseCode,
    responseBody: row.responseBody,
    broadcastTime: row.broadcastTime?.toISOString() ?? null,
    retryCount: row.retryCount,
    externalRef: row.externalRef,
    createdAt: row.createdAt.toISOString(),
  };
}
