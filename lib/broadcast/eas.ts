// ---------------------------------------------------------------------
// lib/broadcast/eas.ts — EAS / SAME (Specific Area Message Encoding)
// encoder + gateway client.
//
// The actual radio alerting standard, and the one channel that can seize
// a receiver mid-song. A SAME burst is an in-band AFSK transmission on
// the carrier itself (520.83 baud):
//
//   ZCZC-ORG-EEE-PSSCCC+TTTT-JJJJJJJ-LLLLLLLL-
//
//   ORG      originator      (EAS = EAS participant, CIV = civil authority,
//                            WXR = weather office, PEP = primary entry point)
//   EEE      event code      (EVI = evacuation immediate, FRW = fire warning,
//                            FLW = flood warning, TOR = tornado, …)
//   PSSCCC   area codes      (P = state part 0-9, SS = state, CCC = county;
//                            repeated, "+" separates, "-" terminates)
//   TTTT     duration        (HHMM purge time, 0015 = 15 min … 9959 = 6 h)
//   JJJJJJJ  day-of-year     (001-366, UTC)
//   LLLLLLLL callsign/time   (HHMMSS in 24 h UTC)
//
// The header is transmitted 3×, then an attention signal (8 s two-tone
// 853/960 Hz or NWS 1050 Hz), then the audio message, then EOM (NNNN)
// transmitted 3×. Receivers whose configured location matches one of the
// PSSCCC areas interrupt; everyone else ignores the burst. That area list
// is a built-in geofence — no per-station API endpoint required.
//
// Wiring: we do NOT talk to stations. We POST the SAME header + CAP
// reference + audio URL to the EAS gateway (national/state entry point
// or a vendor such as an Absolut-style encoder host). The gateway fans
// out to every encoder polling it; each station's encoder injects the
// burst into its own RF. One gateway integration replaces N station
// integrations. Without a gateway URL the client degrades to a
// deterministic dry-run so demos stay hermetic.
// ---------------------------------------------------------------------

import { safeLog } from "@/lib/logger";

/** SAME originator codes (FCC Part 11 Table 1). */
export const SAME_ORIGINATORS = ["EAS", "CIV", "WXR", "PEP"] as const;
export type SameOriginator = (typeof SAME_ORIGINATORS)[number];

/** SAME event codes relevant to flood-led multi-hazard dispatch. */
export const SAME_EVENT_CODES = {
  flood: "FLW",
  flashFlood: "FFW",
  floodWatch: "FLA",
  evacuationImmediate: "EVI",
  cyclone: "HUW",
  earthquake: "EQW",
  civilEmergency: "CEM",
  shelterInPlace: "SPW",
  severeThunderstorm: "SVR",
} as const;

export type SameEventKey = keyof typeof SAME_EVENT_CODES;

/** Map our disaster vocabulary onto SAME event codes. */
export function sameEventForDisaster(
  disasterType: string | null | undefined,
  severity: "critical" | "warning" | "watch",
): string {
  const key = (disasterType ?? "").trim().toLowerCase();
  if (severity === "critical") return SAME_EVENT_CODES.evacuationImmediate;
  switch (key) {
    case "flood":
      return severity === "watch"
        ? SAME_EVENT_CODES.floodWatch
        : SAME_EVENT_CODES.flood;
    case "cyclone":
      return SAME_EVENT_CODES.cyclone;
    case "earthquake":
      return SAME_EVENT_CODES.earthquake;
    default:
      return SAME_EVENT_CODES.civilEmergency;
  }
}

export interface SameHeaderInput {
  originator?: SameOriginator;
  /** SAME 3-letter event code (use sameEventForDisaster to derive). */
  eventCode: string;
  /** Area codes in PSSCCC form, e.g. ["102003"]. At least one required. */
  areas: string[];
  /** How long receivers should treat the alert as active. */
  durationMinutes?: number;
  /** UTC timestamp of the burst (defaults to now). */
  sentAt?: Date;
  /** Station callsign / LLLLLLLL field (8 chars, defaults to SFSHERE/). */
  callsign?: string;
}

/**
 * District → SAME-style PSSCCC area code. India has no FCC FIPS table;
 * this is a stable internal mapping (state part 1 + state index +
 * district index) so the header is well-formed and routable by our
 * gateway stub. A production MIB integration would substitute the
 * NDMA-notified area code table here — the wire format is unchanged.
 */
const DISTRICT_AREA_CODES: Record<string, string> = {
  patna: "104001",
  muzaffarpur: "104002",
  darbhanga: "104003",
  bhagalpur: "104004",
  munger: "104005",
  puri: "121001",
  bhubaneswar: "121002",
  chennai: "133001",
  bengaluru: "129001",
  mumbai: "127001",
  kolkata: "119001",
  delhi: "107001",
  bihar: "104000",
  odisha: "121000",
};

export function sameAreaForDistrict(district: string | null | undefined): string {
  const key = (district ?? "").trim().toLowerCase();
  if (DISTRICT_AREA_CODES[key]) return DISTRICT_AREA_CODES[key];
  // Deterministic fallback: hash the district into a CCC slot so unknown
  // districts still produce a routable (if coarse) code instead of failing.
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return `199${String(hash).padStart(3, "0")}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** Day-of-year 001-366 (UTC). */
export function dayOfYear(date: Date): string {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start;
  return pad3(Math.floor(diff / 86_400_000));
}

/**
 * SAME purge-time TTTT: duration encoded as HHMM with the SAME quirk
 * (minutes 00/15/30/45 only; hours 00-99). Rounds up to the next valid
 * slot, clamped to 15 min … 6 h.
 */
export function sameDuration(durationMinutes: number): string {
  const clamped = Math.min(Math.max(Math.ceil(durationMinutes), 15), 360);
  const rounded = Math.ceil(clamped / 15) * 15;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return `${pad2(hours)}${pad2(mins)}`;
}

/** LLLLLLLL field: HHMMSS callsign-ish stamp (8 chars). */
function callsignStamp(date: Date, callsign: string): string {
  const time = `${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(
    date.getUTCSeconds(),
  )}`;
  const call = (callsign || "SFSHERE/").slice(0, 8).padEnd(8, "/").slice(0, 8);
  // SAME LLLLLLLL is callsign (variable) — we emit time+short call.
  return `${time}${call}`.slice(0, 8);
}

/**
 * Build a single SAME header line:
 *   ZCZC-ORG-EEE-PSSCCC+TTTT-JJJJJJJ-LLLLLLLL-
 */
export function buildSameHeader(input: SameHeaderInput): string {
  const event = (input.eventCode || "CEM").toUpperCase().slice(0, 3).padEnd(3, "X");
  if (!input.areas || input.areas.length === 0) {
    throw new Error("SAME header requires at least one PSSCCC area code.");
  }
  const org: string = SAME_ORIGINATORS.includes(
    (input.originator ?? "CIV") as SameOriginator,
  )
    ? (input.originator as string)
    : "CIV";
  const areas = input.areas
    .map((a) => a.trim().toUpperCase().replace(/[^0-9]/g, "").slice(0, 6).padStart(6, "0"))
    .join("+");
  const sentAt = input.sentAt ?? new Date();
  const tttt = sameDuration(input.durationMinutes ?? 60);
  const jjj = dayOfYear(sentAt);
  const lll = callsignStamp(sentAt, input.callsign ?? "SFSHERE/");
  return `ZCZC-${org}-${event}-${areas}+${tttt}-${jjj}-${lll}-`;
}

/** Full EAS message: header ×3, attention placeholder, EOM ×3. */
export function buildEasMessage(header: string, audioMarker?: string): string {
  const attention = "[ATTN: 8s two-tone 853/960Hz]";
  const body = audioMarker ? `AUDIO:${audioMarker}` : "AUDIO:<attached>";
  return [`${header}${header}${header}`, attention, body, "NNNNNNNNNN"].join("\n");
}

export interface EasAlertInput {
  disasterType?: string | null;
  district?: string | null;
  severity?: "critical" | "warning" | "watch" | null;
  headline?: string;
  audioUrl?: string | null;
  alertId?: string;
  durationMinutes?: number;
  originator?: SameOriginator;
}

export interface EasSendResult {
  ok: boolean;
  confirmed: boolean;
  responseCode: number;
  responseBody: string;
  /** The SAME header that was (or would be) transmitted. */
  sameHeader: string;
  error?: string;
}

function easGatewayUrl(): string | null {
  const url = process.env.EAS_GATEWAY_URL?.trim();
  return url && /^https?:\/\//.test(url) ? url : null;
}

/**
 * Push an EAS alert via the gateway. No gateway configured → deterministic
 * dry-run (header still built + returned, so demos and tests can assert
 * the SAME encoding without touching RF).
 */
export async function sendEasAlert(input: EasAlertInput): Promise<EasSendResult> {
  const severity = input.severity ?? "warning";
  const eventCode = sameEventForDisaster(input.disasterType, severity);
  const sameHeader = buildSameHeader({
    originator: input.originator ?? "CIV",
    eventCode,
    areas: [sameAreaForDistrict(input.district)],
    durationMinutes: input.durationMinutes ?? (severity === "critical" ? 120 : 60),
  });
  const message = buildEasMessage(sameHeader, input.audioUrl ?? input.alertId);

  const gateway = easGatewayUrl();
  if (!gateway) {
    return {
      ok: true,
      confirmed: false,
      responseCode: 202,
      responseBody:
        `[dry-run] EAS gateway not configured (EAS_GATEWAY_URL). ` +
        `Would transmit SAME ${sameHeader} with audio ${input.audioUrl ?? "n/a"}.`,
      sameHeader,
    };
  }

  try {
    const response = await fetch(gateway, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FM_BROADCAST_TOKEN ?? "demo-fm-broadcast-token"}`,
      },
      body: JSON.stringify({
        same_header: sameHeader,
        event_code: eventCode,
        areas: [sameAreaForDistrict(input.district)],
        headline: input.headline ?? "",
        audio_url: input.audioUrl ?? null,
        alert_id: input.alertId ?? null,
        message,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.text()).slice(0, 500);
    if (!response.ok) {
      return {
        ok: false,
        confirmed: false,
        responseCode: response.status,
        responseBody: body,
        sameHeader,
        error: `EAS gateway rejected (${response.status}): ${body}`,
      };
    }
    const confirmed = /accepted|queued|active|confirmed|live/i.test(body);
    return { ok: true, confirmed, responseCode: response.status, responseBody: body, sameHeader };
  } catch (error: unknown) {
    const messageText = error instanceof Error ? error.message : String(error);
    safeLog("error", "[eas] Gateway push failed", { metadata: { error: messageText } });
    return {
      ok: false,
      confirmed: false,
      responseCode: 0,
      responseBody: messageText.slice(0, 500),
      sameHeader,
      error: messageText,
    };
  }
}
