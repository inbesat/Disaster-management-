// ---------------------------------------------------------------------
// lib/broadcast/strategies/siren-trigger.ts — Strategy I · outdoor
// warning siren towers.
//
// Last-mile physical channel. Towers are district-scoped, not
// station-scoped, so the station parameter only scopes logging — the
// activation fans out to the district's online towers via
// lib/sirens/controller.ts (two-person rule enforced there).
// Supports() gates on SIREN_CONTROLLER_URL so unconfigured environments
// skip it and existing dispatch tests keep passing.
// ---------------------------------------------------------------------

import type { FmStation } from "@prisma/client";
import type { DispatchContext, DispatchResult, FMDispatchStrategy } from "../types";
import { listSirenTowers, triggerSirens } from "@/lib/sirens/controller";

/** Strategy I: outdoor siren network trigger. */
export class SirenTriggerStrategy implements FMDispatchStrategy {
  readonly name = "siren" as const;

  supports(station: FmStation): boolean {
    const relay = process.env.SIREN_CONTROLLER_URL?.trim();
    return Boolean(relay && /^https?:\/\//.test(relay) && station.isActive);
  }

  async send(station: FmStation, context: DispatchContext): Promise<DispatchResult> {
    const district = context.district ?? station.city ?? station.state ?? "";
    const towers = await listSirenTowers(district || undefined);
    const online = towers.filter((t) => t.status === "online").map((t) => t.id);
    if (online.length === 0) {
      return {
        ok: false,
        strategy: this.name,
        responseCode: 0,
        responseBody: `No online siren towers in ${district || "district"}.`,
        error: "No online siren towers.",
      };
    }
    // The dispatcher is the second confirmer (operator approval happened
    // upstream); the CAP alert id is the first confirmation.
    const result = await triggerSirens({
      towerIds: online,
      confirmations: [context.alertId, `dispatch:${context.alertId}`],
      district: district || undefined,
      alertId: context.alertId,
    });
    if (!result.ok) {
      return {
        ok: false,
        strategy: this.name,
        responseCode: 0,
        responseBody: result.detail.slice(0, 500),
        error: result.detail,
      };
    }
    return {
      ok: true,
      strategy: this.name,
      responseCode: 200,
      responseBody: `Sirens: ${result.detail}`.slice(0, 500),
      broadcastTime: new Date().toISOString(),
    };
  }
}
