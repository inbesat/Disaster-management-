"use client";

// ---------------------------------------------------------------------
// lib/offline-sync/sw-sync.ts — Offline-First Architecture · Phase 2 + 7
// Background sync bridge between the page and the service worker.
//
//   • requestBackgroundSync(tag) — Phase 7 one-shot Background Sync
//     (SyncManager): registers `sync-predictions` / `sync-alerts` so the
//     browser retries them the moment connectivity returns.
//   • registerSyncJobs() — arms every one-shot tag + the periodic tag in one
//     call (best-effort per tag).
//   • requestPeriodicSync() — registers the `disasterlink-sync` periodic
//     background sync tag (Periodic Background Sync API) where supported so
//     the OS can wake the SW to nudge a pending sync. Degrades silently to
//     no-op on unsupported browsers (Chrome desktop 80+).
//   • postSyncRequest() — asks the SW to dispatch a `sync` broadcast to all
//     open clients (the controller page listens and runs fullSync()).
//   • onSyncRequest() — page-side listener wired in the hook: any SW
//     `drip:sync:request` message → fullSync().
//
// The actual IndexedDB writes always run in the page's SyncEngine (the SW
// has no module access to the Dexie wrapper); the SW is nudge/relay only.
// ---------------------------------------------------------------------

import { SYNC_EVENT_STARTED, SYNC_EVENT_FINISHED } from "./sync-engine";

export const SYNC_TAG = "disasterlink-sync";

/**
 * One-shot background sync tags (Phase 7 · Step 2). The page registers these
 * on `navigator.serviceWorker.ready`; the browser queues them and fires the
 * worker's `sync` event the next time connectivity returns, so the engine
 * refreshes the matching datasets without user intervention.
 */
export const BG_SYNC_TAGS = {
  predictions: "sync-predictions",
  alerts: "sync-alerts",
  sos: "sync-sos",
} as const;

export type BgSyncTag = (typeof BG_SYNC_TAGS)[keyof typeof BG_SYNC_TAGS];
export type BgSyncKey = keyof typeof BG_SYNC_TAGS;

/** True when the browser supports one-shot Background Sync (SyncManager). */
export function supportsBackgroundSync(): boolean {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  return "SyncManager" in window;
}

/**
 * Phase 7 · Step 2 — registers a one-shot background sync tag. When the
 * device goes offline after this call, the browser queues the tag and fires
 * the worker's `sync` event (worker/index.js #handleSyncTick) once it is
 * back online. Resolves false (never throws) when unsupported/unregistered.
 */
export async function requestBackgroundSync(tag: BgSyncTag): Promise<boolean> {
  if (!supportsBackgroundSync()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const syncManager = reg as unknown as {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (!syncManager.sync) return false;
    await syncManager.sync.register(tag);
    return true;
  } catch {
    return false;
  }
}

/**
 * Registers every background-sync job the app cares about (predictions +
 * alerts + SOS outbox replay) and the periodic tag. Best-effort — resolves
 * the per-tag booleans so callers know which jobs are actually armed on
 * this browser.
 */
export async function registerSyncJobs(): Promise<Record<BgSyncKey | "periodic", boolean>> {
  const [predictions, alerts, sos, periodic] = await Promise.all([
    requestBackgroundSync(BG_SYNC_TAGS.predictions),
    requestBackgroundSync(BG_SYNC_TAGS.alerts),
    requestBackgroundSync(BG_SYNC_TAGS.sos),
    requestPeriodicSync(),
  ]);
  return { predictions, alerts, sos, periodic };
}

/**
 * True when the browser supports Periodic Background Sync. The API is a
 * `PeriodicSyncManager` exposed on `window` (Chromium) and on each
 * ServiceWorkerRegistration — NOT on `navigator.serviceWorker` — so the
 * synchronous gate checks the window constructor.
 */
export function supportsPeriodicSync(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  return "PeriodicSyncManager" in window;
}

/**
 * Registers a periodic background-sync tag (min interval 3h) so supported
 * browsers can trigger sync even after the page is backgrounded. Resolves
 * false (never throws) when unsupported / not registered.
 */
export async function requestPeriodicSync(
  minIntervalMs = 3 * 60 * 60 * 1000,
): Promise<boolean> {
  if (!supportsPeriodicSync()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const syncApi = reg as unknown as {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
    };
    if (!syncApi.periodicSync) return false;
    await syncApi.periodicSync.register(SYNC_TAG, { minInterval: minIntervalMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Phase 11 · background-fetch config — unregisters the periodic sync tag
 * (e.g. when the citizen turns "auto-refresh offline data" off). Resolves
 * false when unsupported or nothing was registered.
 */
export async function unregisterPeriodicSync(): Promise<boolean> {
  if (!supportsPeriodicSync()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const syncApi = reg as unknown as {
      periodicSync?: { unregister: (tag: string) => Promise<void> };
    };
    if (!syncApi.periodicSync?.unregister) return false;
    await syncApi.periodicSync.unregister(SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}

/** Asks the SW to broadcast a sync request to all open page clients. */
export async function postSyncRequest(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !navigator.serviceWorker.controller
  ) {
    return false;
  }
  try {
    navigator.serviceWorker.controller.postMessage({ type: "drip:sync:request" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Page-side listener: any SW `drip:sync:request` message (periodic bg-sync
 * event or an explicit nudge) triggers a full sync. Returns an unsubscribe
 * function so the hook can clean up on unmount.
 */
export function onSyncRequest(syncFn: () => Promise<unknown>): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => undefined;
  const handler = (event: MessageEvent): void => {
    const data = event.data as { type?: string } | undefined;
    if (data?.type !== "drip:sync:request") return;
    window.dispatchEvent(new CustomEvent("drip:sync:sw"));
    void syncFn();
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}

export { SYNC_EVENT_STARTED, SYNC_EVENT_FINISHED };