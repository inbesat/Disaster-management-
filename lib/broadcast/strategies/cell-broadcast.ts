// ---------------------------------------------------------------------
// lib/broadcast/strategies/cell-broadcast.ts — Strategy H · Cell
// Broadcast (SMS-CB / ETWS) to every handset in the affected area.
//
// Area-wide, not per-station: the station parameter only scopes logging.
// Supports() gates on CELL_BROADCAST_GATEWAY_URL so unconfigured
// environments skip it (existing dispatch tests unaffected).
// ---------------------------------------------------------------------

import type { FmStation } from "@prisma/client";
import type { DispatchContext, DispatchResult, FMDispatchStrategy } from "../types";
import { mapCapSeverity } from "../rds-encoder";
import { sendCellBroadcast } from "../cell-broadcast";
import { eventFromCapXml } from "./eas-gateway";

/** Strategy H: cell-broadcast page to the affected geofence. */
export class CellBroadcastStrategy implements FMDispatchStrategy {
  readonly name = "cell_broadcast" as const;

  supports(_station: FmStation): boolean {
    const url = process.env.CELL_BROADCAST_GATEWAY_URL?.trim();
    return Boolean(url && /^https?:\/\//.test(url) && _station.isActive);
  }

  async send(station: FmStation, context: DispatchContext): Promise<DispatchResult> {
    void station;
    const result = await sendCellBroadcast({
      disasterType: context.disasterType ?? eventFromCapXml(context.capAlert.capXml),
      district: context.district,
      severity: mapCapSeverity(context.capAlert.severity),
      headline: context.headline,
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
      responseBody: `Cell page: ${result.page}`.slice(0, 500),
      broadcastTime: new Date().toISOString(),
    };
  }
}
