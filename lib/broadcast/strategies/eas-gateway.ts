// ---------------------------------------------------------------------
// lib/broadcast/strategies/eas-gateway.ts — Strategy F · EAS SAME burst
// via the national/state gateway.
//
// The interrupt channel: a SAME header (+ audio reference) is pushed to
// the EAS gateway, which fans out to every encoder polling it. Supports()
// gates on EAS_GATEWAY_URL so unconfigured environments stay silent and
// existing dispatch tests (no env) keep skipping this channel.
// ---------------------------------------------------------------------

import type { FmStation } from "@prisma/client";
import type { DispatchContext, DispatchResult, FMDispatchStrategy } from "../types";
import { mapCapSeverity } from "../rds-encoder";
import { sendEasAlert } from "../eas";

/** Strategy F: EAS SAME interrupt via the gateway. */
export class EasGatewayStrategy implements FMDispatchStrategy {
  readonly name = "eas" as const;

  supports(_station: FmStation): boolean {
    const url = process.env.EAS_GATEWAY_URL?.trim();
    return Boolean(url && /^https?:\/\//.test(url) && _station.isActive);
  }

  async send(station: FmStation, context: DispatchContext): Promise<DispatchResult> {
    const severity = mapCapSeverity(context.capAlert.severity);
    const result = await sendEasAlert({
      disasterType: context.disasterType ?? eventFromCapXml(context.capAlert.capXml),
      district: context.district ?? station.city ?? station.state ?? undefined,
      severity,
      headline: context.headline,
      audioUrl: context.capAlert.audioUrl,
      alertId: context.alertId,
    });
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
      responseBody: `${result.responseBody} SAME=${result.sameHeader}`.slice(0, 500),
      broadcastTime: new Date().toISOString(),
    };
  }
}

/** Pull the CAP <event> value out of the XML for SAME event mapping. */
export function eventFromCapXml(capXml: string): string | undefined {
  const match = capXml.match(/<event>([\s\S]*?)<\/event>/);
  return match ? match[1].trim() : undefined;
}
