// ---------------------------------------------------------------------
// lib/broadcast/types.ts — Phase 4 · FM broadcast dispatcher types.
// ---------------------------------------------------------------------

import type { CapAlert, FmStation } from "@prisma/client";

/** The dispatch strategies: station APIs + area-wide emergency channels. */
export type DispatchStrategyName =
  | "cap_api"
  | "rds"
  | "ftp"
  | "email"
  | "ivr"
  | "eas"
  | "playout"
  | "cell_broadcast"
  | "siren";

/** Outcome of a single strategy send attempt. */
export interface DispatchResult {
  ok: boolean;
  strategy: DispatchStrategyName;
  /** HTTP status for API pushes, or a descriptive code for other channels. */
  responseCode: number;
  /** Truncated response body for the audit log. */
  responseBody: string;
  /** When the station reported the broadcast (API pushes). */
  broadcastTime?: string;
  /** Provider-side reference (Twilio CallSid for ivr) — stored in external_ref. */
  externalRef?: string;
  /** Reason for failure (for retry + logging). */
  error?: string;
}

/** Everything a strategy needs to build + send its payload. */
export interface DispatchContext {
  /** The CAP alert row (cap_xml is the authoritative message). */
  capAlert: CapAlert;
  /** The voiced MP3 for the alert. */
  audioBuffer: Buffer;
  /** The CAP <identifier> (used for filenames / references). */
  alertId: string;
  /** Human headline, e.g. "Flood Warning: Patna". */
  headline: string;
  /** Short RDS-friendly one-liner built from the alert. */
  rdsText: string;
  /** Affected district (from the DisasterEvent) — drives SAME area codes. */
  district?: string;
  /** Disaster type (from the DisasterEvent) — drives SAME event codes. */
  disasterType?: string;
}

/** The strategy contract — one implementation per delivery channel. */
export interface FMDispatchStrategy {
  readonly name: DispatchStrategyName;
  /** True when the station supports this channel (endpoint/credentials set). */
  supports(station: FmStation): boolean;
  /** Send the alert to this station. Must not throw. */
  send(station: FmStation, context: DispatchContext): Promise<DispatchResult>;
}

/** Plain JSON row shape for a broadcast log (returned by the API). */
export interface FmBroadcastLogDTO {
  id: string;
  capAlertId: string | null;
  fmStationId: string | null;
  stationName?: string;
  strategy: string;
  status: string;
  responseCode: number | null;
  responseBody: string | null;
  broadcastTime: string | null;
  retryCount: number;
  externalRef: string | null;
  createdAt: string;
}
