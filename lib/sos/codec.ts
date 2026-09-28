// ---------------------------------------------------------------------
// lib/sos/codec.ts — Phase 2 · Compact SOS codec.
//
// One-SMS-page distress payload, typable into any satellite messenger
// (Bullitt/Motorola app, Garmin inReach), IVR/DTMF-readable, QR-able:
//
//   SOS1,<lat>,<lng>,<need>[P],<HHMM>*<CCCC>
//   SOS1,NOLOC,NOLOC,<need>[P],<HHMM>*<CCCC>   (no GPS fix; arity is fixed —
//                                              NOLOC replaces BOTH coordinates)
//
//   <need>  R rescue · M medical · F food/shelter · H hazard · L location share
//   P       appended when the person has a disability (priority rescue)
//   <HHMM>  UTC time of the SOS (24h) — human-verifiable when re-typed
//   <CCCC>  CRC-16/CCITT-FALSE over everything before `*`, uppercase hex
//
// Example: SOS1,25.5941,85.1376,RP,1337*9F3A  (32 chars)
//
// Pure module — no browser APIs — so API routes, components, and vitest
// share one implementation. The native shell mirrors it in SosCodec.java
// (same grammar, same checksum, same test vector).
// ---------------------------------------------------------------------

export type SosNeed = "R" | "M" | "F" | "H" | "L";

export const SOS_CODEC_VERSION = "SOS1";

export const NEED_LABELS: Record<SosNeed, string> = {
  R: "Rescue",
  M: "Medical emergency",
  F: "Food / shelter needed",
  H: "Hazard report",
  L: "Location share",
};

const NEEDS = new Set<string>(["R", "M", "F", "H", "L"]);

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF). Test vector: "123456789" → 0x29B1. */
export function crc16Ccitt(input: string): number {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= (input.charCodeAt(i) & 0xff) << 8;
    for (let b = 0; b < 8; b += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

export interface EncodeSosCodecInput {
  lat: number | null;
  lng: number | null;
  need: SosNeed;
  isPwd?: boolean;
  /** Moment of the SOS; defaults to now. UTC HHMM is embedded. */
  at?: Date;
}

export function encodeSosCodec(input: EncodeSosCodecInput): string {
  const { need, isPwd = false, at = new Date() } = input;
  if (!NEEDS.has(need)) throw new SosCodecError(`Unknown need code: ${need}`);
  let loc: string;
  if (input.lat == null || input.lng == null) {
    loc = "NOLOC,NOLOC";
  } else {
    if (
      !Number.isFinite(input.lat) ||
      !Number.isFinite(input.lng) ||
      Math.abs(input.lat) > 90 ||
      Math.abs(input.lng) > 180
    ) {
      throw new SosCodecError("Coordinates out of range.");
    }
    loc = `${input.lat.toFixed(4)},${input.lng.toFixed(4)}`;
  }
  const hh = String(at.getUTCHours()).padStart(2, "0");
  const mm = String(at.getUTCMinutes()).padStart(2, "0");
  const body = `${SOS_CODEC_VERSION},${loc},${need}${isPwd ? "P" : ""},${hh}${mm}`;
  const checksum = crc16Ccitt(body).toString(16).toUpperCase().padStart(4, "0");
  return `${body}*${checksum}`;
}

export interface DecodedSosCodec {
  lat: number | null;
  lng: number | null;
  /** True when the payload carries NOLOC (no GPS fix at capture). */
  locationEstimated: boolean;
  need: SosNeed;
  isPwd: boolean;
  /** HHMM string as embedded (UTC). */
  hhmm: string;
  /** Most recent past UTC occurrence of HHMM relative to now. */
  atUtc: Date;
  raw: string;
}

export class SosCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SosCodecError";
  }
}

const CODEC_RE =
  /^SOS1,(-?\d{1,2}\.\d{4}|NOLOC),(-?\d{1,3}\.\d{4}|NOLOC),([RMFHL])(P?),([01]\d|2[0-3])([0-5]\d)\*([0-9A-F]{4})$/;

/** Most recent past UTC occurrence of a HHMM wall-time. */
export function resolveCodecTime(hhmm: string, now: Date = new Date()): Date {
  const at = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      Number(hhmm.slice(0, 2)),
      Number(hhmm.slice(2, 4)),
      0,
      0,
    ),
  );
  if (at.getTime() > now.getTime()) at.setUTCDate(at.getUTCDate() - 1);
  return at;
}

export function decodeSosCodec(input: string, now: Date = new Date()): DecodedSosCodec {
  const raw = input.trim().toUpperCase();
  const m = CODEC_RE.exec(raw);
  if (!m) throw new SosCodecError("Not a valid SOS code. Format: SOS1,lat,lng,need,HHMM*checksum.");
  const [, latS, lngS, needS, pwdS, hh, mm, checksumS] = m;
  const body = raw.slice(0, raw.lastIndexOf("*"));
  const expected = crc16Ccitt(body).toString(16).toUpperCase().padStart(4, "0");
  if (expected !== checksumS) {
    throw new SosCodecError(
      "Checksum mismatch — the code was mistyped. Please re-enter it exactly.",
    );
  }
  const noLoc = latS === "NOLOC" || lngS === "NOLOC";
  if ((latS === "NOLOC") !== (lngS === "NOLOC")) {
    throw new SosCodecError("NOLOC must replace both coordinates, not one.");
  }
  const lat = noLoc ? null : Number(latS);
  const lng = noLoc ? null : Number(lngS);
  if (!noLoc && (Math.abs(lat as number) > 90 || Math.abs(lng as number) > 180)) {
    throw new SosCodecError("Coordinates out of range.");
  }
  const hhmm = `${hh}${mm}`;
  return {
    lat,
    lng,
    locationEstimated: noLoc,
    need: needS as SosNeed,
    isPwd: pwdS === "P",
    hhmm,
    atUtc: resolveCodecTime(hhmm, now),
    raw,
  };
}

/** Quick pre-check (regex only, no checksum) for UI affordances. */
export function looksLikeSosCodec(input: string): boolean {
  return CODEC_RE.test(input.trim().toUpperCase());
}

/** Triage mapping shared by every ingest route. */
export function needToReportType(need: SosNeed): "rescue" | "shelter_needed" {
  return need === "F" ? "shelter_needed" : "rescue";
}

/** rawText prefix per need so triage keeps the need type without a new column. */
export function needPrefix(need: SosNeed): string {
  switch (need) {
    case "M":
      return "[MEDICAL] ";
    case "H":
      return "[HAZARD] ";
    case "L":
      return "[LOCATION SHARE] ";
    default:
      return "";
  }
}
