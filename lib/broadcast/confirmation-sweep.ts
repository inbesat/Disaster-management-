// ---------------------------------------------------------------------
// lib/broadcast/confirmation-sweep.ts — "accepted but never aired"
// background sweep (the dispatcher's documented fourth trigger).
//
// The gap: dispatchToStations logs cap_api 202-queued as ok=true with no
// broadcastTime. A station that ACKs but never airs sits in the audit
// trail as delivered forever. This module finds those rows (accepted +
// unconfirmed + older than the confirmation window + no later delivered
// log for the same capAlert+station) and:
//   1. marks them "retrying" (re-queues the audit state), and
//   2. optionally escalates to IVR when a control-room number exists.
//
// Run from GET /api/cron/broadcast-confirmation (CRON_SECRET guarded,
// same convention as /api/cron/audio-retention). Pure selection logic
// (findUnconfirmed) is unit-tested; sweepUnconfirmedBroadcasts does I/O.
// ---------------------------------------------------------------------

import { prisma } from "@/server/prisma";
import { safeLog } from "@/lib/logger";
import { callStationControlRoom } from "./fm-ivr-fallback";

/** Minutes a station has to confirm before we treat silence as failure. */
export const CONFIRMATION_WINDOW_MINUTES = 3;

export interface BroadcastAttemptRow {
  id: string;
  capAlertId: string | null;
  fmStationId: string | null;
  strategy: string;
  status: string;
  broadcastTime: Date | null;
  createdAt: Date;
  retryCount: number;
}

/**
 * Pure selection: rows that were accepted (ok-path, no broadcastTime)
 * past the window with no later delivered confirmation for the same
 * capAlert+station.
 */
export function findUnconfirmed(
  rows: BroadcastAttemptRow[],
  now: Date = new Date(),
  windowMinutes: number = CONFIRMATION_WINDOW_MINUTES,
): BroadcastAttemptRow[] {
  const cutoff = now.getTime() - windowMinutes * 60_000;
  const confirmedKeys = new Set(
    rows
      .filter((r) => r.status === "delivered" && r.broadcastTime)
      .map((r) => `${r.capAlertId ?? ""}|${r.fmStationId ?? ""}|${r.strategy}`),
  );
  return rows.filter((row) => {
    if (row.strategy !== "cap_api") return false;
    if (row.status !== "delivered" && row.status !== "sent") return false;
    if (row.broadcastTime) return false; // confirmed on time
    if (row.createdAt.getTime() > cutoff) return false; // still in window
    const key = `${row.capAlertId ?? ""}|${row.fmStationId ?? ""}|${row.strategy}`;
    return !confirmedKeys.has(key);
  });
}

export interface SweepResult {
  checked: number;
  unconfirmed: number;
  markedRetrying: number;
  ivrEscalated: number;
}

/**
 * Sweep the DB: find unconfirmed CAP API pushes, mark them retrying,
 * and escalate to IVR where a control-room number exists.
 */
export async function sweepUnconfirmedBroadcasts(
  opts: { windowMinutes?: number; escalateIvr?: boolean } = {},
): Promise<SweepResult> {
  const windowMinutes = opts.windowMinutes ?? CONFIRMATION_WINDOW_MINUTES;
  const cutoff = new Date(Date.now() - windowMinutes * 60_000);

  const candidates = await prisma.fmBroadcastLog.findMany({
    where: {
      strategy: "cap_api",
      status: { in: ["sent", "delivered"] },
      broadcastTime: null,
      createdAt: { lt: cutoff },
    },
    include: { fmStation: true, capAlert: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  let markedRetrying = 0;
  let ivrEscalated = 0;

  for (const row of candidates) {
    // Skip when a later delivered confirmation exists for the same pair.
    const confirmed = await prisma.fmBroadcastLog.findFirst({
      where: {
        capAlertId: row.capAlertId,
        fmStationId: row.fmStationId,
        strategy: row.strategy,
        status: "delivered",
        broadcastTime: { not: null },
      },
      select: { id: true },
    });
    if (confirmed) continue;

    try {
      await prisma.fmBroadcastLog.update({
        where: { id: row.id },
        data: { status: "retrying", retryCount: { increment: 1 } },
      });
      markedRetrying += 1;
    } catch (error: unknown) {
      safeLog("error", "[sweep] Failed to mark retrying", {
        metadata: { id: row.id, error: String(error) },
      });
      continue;
    }

    if (opts.escalateIvr !== false && row.fmStation?.emergencyContactPhone) {
      try {
        const headline = extractHeadline(row.capAlert?.capXml ?? "");
        const call = await callStationControlRoom(
          row.fmStation.emergencyContactPhone,
          row.capAlert?.audioUrl ?? null,
          headline || "Please broadcast the attached emergency alert.",
          { state: row.fmStation.state },
        );
        await prisma.fmBroadcastLog.create({
          data: {
            capAlertId: row.capAlertId,
            fmStationId: row.fmStationId,
            strategy: "ivr",
            status: call.ok ? "delivered" : "failed",
            responseCode: call.responseCode,
            responseBody: `sweep-escalation: ${call.responseBody}`.slice(0, 2000),
            broadcastTime: call.ok ? new Date() : null,
            externalRef: call.callSid,
          },
        });
        if (call.ok) ivrEscalated += 1;
      } catch (error: unknown) {
        safeLog("error", "[sweep] IVR escalation failed", {
          metadata: { id: row.id, error: String(error) },
        });
      }
    }
  }

  return { checked: candidates.length, unconfirmed: candidates.length, markedRetrying, ivrEscalated };
}

function extractHeadline(capXml: string): string {
  const match = capXml.match(/<headline>([\s\S]*?)<\/headline>/);
  return match ? match[1] : "";
}
