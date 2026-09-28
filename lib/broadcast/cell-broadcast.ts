// ---------------------------------------------------------------------
// lib/broadcast/cell-broadcast.ts — Cell Broadcast (SMS-CB / ETWS)
// provider client.
//
// Why this channel matters: in-app, WhatsApp and SMS all fail for the
// same citizen — no data, congested cells, or a ₹800 featurephone. Cell
// broadcast (3GPP TS 23.040 SMS-CB; ETWS over LTE eMBMS/FeMBMS) sends one
// 160-char message to EVERY handset in a geofence with no per-recipient
// cost, no subscription, and — critically — it cannot be snoozed or
// deferred by the user. It is the only channel that legally outranks
// Do Not Disturb.
//
// Path: platform → DoT/operator cell-broadcast gateway (or an aggregator
// in front of it) → BSC/RNC/MME → every cell in the area list. In India
// this runs through the SDMA/NDMA chain, not a commercial SMS API, so
// the client posts to CELL_BROADCAST_GATEWAY_URL and degrades to a
// deterministic dry-run when unconfigured (same convention as EAS).
//
// Message budget: GSM 7-bit default alphabet, 82 octets payload per page
// after headers — we cap at a single 139-char page prioritising DISASTER
// + LOCATION + ACTION, mirroring the RDS truncation policy.
// ---------------------------------------------------------------------

import { safeLog } from "@/lib/logger";

export const CELL_BROADCAST_MAX_CHARS = 139;

export type CellBroadcastSeverity = "critical" | "warning" | "watch";

export interface CellBroadcastInput {
  disasterType?: string | null;
  district?: string | null;
  severity?: CellBroadcastSeverity | null;
  headline?: string;
  instruction?: string;
  helpline?: string;
}

const DEFAULT_HELPLINE = "1070";

/** Single-page cell-broadcast text (≤139 chars, ACTION-first). */
export function buildCellBroadcastText(input: CellBroadcastInput): string {
  const disaster = (input.disasterType ?? "Emergency").trim().toUpperCase() || "EMERGENCY";
  const district = (input.district ?? "").trim().toUpperCase() || "YOUR AREA";
  const severity = input.severity ?? "warning";
  const helpline = (input.helpline ?? "").trim() || DEFAULT_HELPLINE;
  const action =
    severity === "critical"
      ? "EVACUATE NOW to nearest shelter"
      : severity === "warning"
        ? "Stay alert, tune FM for updates"
        : "Monitor local news";
  const instruction = (input.instruction ?? "").trim();
  const base = `${severity === "critical" ? "EVACUATE NOW" : "ALERT"}: ${disaster} in ${district}. ${action}. Call ${helpline}.`;
  const withInstruction = instruction ? `${base} ${instruction}` : base;
  if (withInstruction.length <= CELL_BROADCAST_MAX_CHARS) return withInstruction;
  // Truncate at a word boundary, never mid-word.
  const cut = base.slice(0, CELL_BROADCAST_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

export interface CellBroadcastResult {
  ok: boolean;
  confirmed: boolean;
  responseCode: number;
  responseBody: string;
  /** The exact page that was (or would be) broadcast. */
  page: string;
  error?: string;
}

function cellGatewayUrl(): string | null {
  const url = process.env.CELL_BROADCAST_GATEWAY_URL?.trim();
  return url && /^https?:\/\//.test(url) ? url : null;
}

/**
 * Broadcast one page to the gateway's area list. No gateway → dry-run
 * success carrying the exact page, so demos/tests assert copy without a
 * carrier integration.
 */
export async function sendCellBroadcast(
  input: CellBroadcastInput & { alertId?: string },
): Promise<CellBroadcastResult> {
  const page = buildCellBroadcastText(input);
  const gateway = cellGatewayUrl();
  if (!gateway) {
    return {
      ok: true,
      confirmed: false,
      responseCode: 202,
      responseBody:
        `[dry-run] Cell-broadcast gateway not configured ` +
        `(CELL_BROADCAST_GATEWAY_URL). Would broadcast page: ${page}`,
      page,
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
        page,
        district: input.district ?? null,
        severity: input.severity ?? "warning",
        alert_id: input.alertId ?? null,
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
        page,
        error: `Cell-broadcast gateway rejected (${response.status}): ${body}`,
      };
    }
    return {
      ok: true,
      confirmed: /accepted|queued|broadcasting|active/i.test(body),
      responseCode: response.status,
      responseBody: body,
      page,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    safeLog("error", "[cell-broadcast] Gateway push failed", { metadata: { error: message } });
    return {
      ok: false,
      confirmed: false,
      responseCode: 0,
      responseBody: message.slice(0, 500),
      page,
      error: message,
    };
  }
}
