"use client";

// ---------------------------------------------------------------------
// components/offline/BackgroundSyncInit.tsx — Phase 7 · Step 2–3
// Mounted once per session; wires the invisible background-sync plumbing:
//
//   • One-shot Background Sync — once the service worker is ready, arms
//     `sync-predictions` + `sync-alerts` (SyncManager). The browser queues
//     these tags while offline and fires the worker's 'sync' event on
//     reconnect, so the sync engine refreshes without user intervention.
//     Degrades silently when SyncManager is unsupported.
//   • Periodic Background Sync — requests the user's permission, then arms
//     the 3h `disasterlink-sync` periodic tag where supported.
//   • SW sync relay — listens for the worker's `drip:sync:request` message
//     and runs a full page sync, so every SW sync tick lands in IndexedDB.
//
// Adds a "Synced X ✓" entry to the sync log on each completion via the
// `drip:sync:*` events the engine already emits.
//
// Phase 10 · battery gate — when the device charge drops below 20% the
// SW relay stops triggering full syncs (radio wakes drain a dying battery
// fastest). The gate re-arms automatically the moment the device starts
// charging or crosses back above 20%.
// ---------------------------------------------------------------------

import { useEffect } from "react";
import { getSyncEngine } from "@/lib/offline-sync/sync-engine";
import { onSyncRequest, registerSyncJobs } from "@/lib/offline-sync/sw-sync";
import { OfflineSyncQueue } from "@/lib/field-offline";
import { createBatteryGate } from "@/lib/perf/battery-gate";

export default function BackgroundSyncInit() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Phase 10 · battery-aware sync relay: skip full syncs below 20% charge.
    const gate = createBatteryGate();

    // SW sync-tick relay → full page sync + SOS outbox replay.
    const unsubscribe = onSyncRequest(async () => {
      if (gate.shouldPauseSync()) return; // dying battery — hold off
      // Phase 1: a distress signal outranks datasets — replay queued SOS
      // first so a reconnect delivers SOS before refreshing predictions.
      try {
        await OfflineSyncQueue.syncAll();
      } catch {
        /* outbox replay is best-effort; the engine sync still runs */
      }
      await getSyncEngine().fullSync({ force: true });
    });

    // Arm one-shot + periodic sync jobs once the SW is registered.
    void registerSyncJobs();

    // Resume syncs automatically once the battery recovers.
    const resume = gate.onChange(() => {
      if (!gate.shouldPauseSync()) {
        void getSyncEngine().fullSync({ force: false });
      }
    });

    return () => {
      unsubscribe();
      resume();
    };
  }, []);

  return null;
}