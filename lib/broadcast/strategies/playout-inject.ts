// ---------------------------------------------------------------------
// lib/broadcast/strategies/playout-inject.ts — Strategy G · direct audio
// injection into the station's playout/automation system.
//
// For stations with a modern automation install (Audemat/Axia, ENPS
// newsroom). The per-station endpoint lives in
// fm_stations.playout_endpoint (migration 0035); a shared
// PLAYOUT_GATEWAY_URL covers the single-partner pilot. Interrupt=true
// for critical (seize now), queue-next otherwise.
// ---------------------------------------------------------------------

import type { FmStation } from "@prisma/client";
import type { DispatchContext, DispatchResult, FMDispatchStrategy } from "../types";
import { mapCapSeverity } from "../rds-encoder";
import {
  playoutSystemFromEnv,
  sharedPlayoutEndpoint,
} from "../playout";

/** Strategy G: playout-system emergency cart injection. */
export class PlayoutInjectStrategy implements FMDispatchStrategy {
  readonly name = "playout" as const;

  supports(station: FmStation): boolean {
    if (!station.isActive) return false;
    const perStation = playoutEndpointOf(station);
    return Boolean(perStation || sharedPlayoutEndpoint());
  }

  async send(station: FmStation, context: DispatchContext): Promise<DispatchResult> {
    const endpoint = playoutEndpointOf(station) ?? sharedPlayoutEndpoint();
    if (!endpoint) {
      return {
        ok: false,
        strategy: this.name,
        responseCode: 0,
        responseBody: "No playout endpoint configured (station or PLAYOUT_GATEWAY_URL).",
        error: "No playout endpoint configured.",
      };
    }
    const severity = mapCapSeverity(context.capAlert.severity);
    const result = await playoutSystemFromEnv().inject(
      {
        alertId: context.alertId,
        headline: context.headline,
        rdsText: context.rdsText,
        audioBuffer: context.audioBuffer,
        capXml: context.capAlert.capXml,
        interrupt: severity === "critical",
        durationMinutes: 30,
      },
      endpoint,
    );
    if (!result.ok) {
      return {
        ok: false,
        strategy: this.name,
        responseCode: result.responseCode,
        responseBody: result.responseBody,
        error: result.error,
      };
    }
    return {
      ok: true,
      strategy: this.name,
      responseCode: result.responseCode,
      responseBody: result.cartId
        ? `${result.responseBody} (cart ${result.cartId})`.slice(0, 500)
        : result.responseBody,
      broadcastTime: new Date().toISOString(),
    };
  }
}

/** Read the per-station endpoint without depending on generated types. */
function playoutEndpointOf(station: FmStation): string | null {
  const value = (station as unknown as Record<string, unknown>).playoutEndpoint;
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  const legacy = station.emergencyApiEndpoint;
  if (typeof legacy === "string" && legacy.includes("playout=")) {
    try {
      const url = new URL(legacy);
      const tagged = url.searchParams.get("playout");
      if (tagged && /^https?:\/\//.test(tagged)) return tagged;
    } catch {
      // Fall through to null.
    }
  }
  return null;
}
