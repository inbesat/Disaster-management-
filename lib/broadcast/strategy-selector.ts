// ---------------------------------------------------------------------
// lib/broadcast/strategy-selector.ts — Phase 4 · best-strategy selection.
//
// Decides which channel to use for a station, in priority order:
//   eas → cap_api → playout → cell_broadcast → rds → ftp → email → siren
// Strategy A is preferred when the station has a modern CAP endpoint; a
// station that also has RDS gets the RDS text *as well* when the selector
// is asked for all viable strategies. The pure functions here are
// unit-tested with fixture stations.
//
// Area-wide channels (eas / cell_broadcast / siren) interrupt or reach
// beyond a single station: EAS SAME bursts seize receivers mid-song, cell
// broadcast reaches every handset in the geofence, sirens cover the last
// mile. They sit in the same priority list so the dispatcher treats them
// as ordinary waterfall entries (see lib/broadcast/types.ts).
// ---------------------------------------------------------------------

import type { FmStation } from "@prisma/client";
import type { DispatchStrategyName, FMDispatchStrategy } from "./types";

const PRIORITY: DispatchStrategyName[] = [
  "eas",
  "cap_api",
  "playout",
  "cell_broadcast",
  "rds",
  "ftp",
  "email",
  "siren",
];

/** Strategy priority order (eas best, siren last-mile). */
export function strategyPriority(): DispatchStrategyName[] {
  return [...PRIORITY];
}

/** Pick the single best strategy for a station (EAS → API → … → siren). */
export function selectBestStrategy(
  station: FmStation,
  strategies: readonly FMDispatchStrategy[],
): FMDispatchStrategy | null {
  for (const name of PRIORITY) {
    const strategy = strategies.find((s) => s.name === name);
    if (strategy && strategy.supports(station)) return strategy;
  }
  return null;
}

/** All strategies a station supports (for multi-channel dispatch). */
export function selectAllStrategies(
  station: FmStation,
  strategies: readonly FMDispatchStrategy[],
): FMDispatchStrategy[] {
  return PRIORITY.map((name) => strategies.find((s) => s.name === name)).filter(
    (s): s is FMDispatchStrategy => Boolean(s && s.supports(station)),
  );
}
