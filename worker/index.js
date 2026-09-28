// ---------------------------------------------------------------------
// worker/index.js — Phase 13 · Step 1 · next-pwa custom worker.
//
// next-pwa (customWorkerDir) bundles this file and importScripts it into
// the generated public/sw.js. It carries BOTH responsibilities of the app
// service worker:
//
//   1. Web Push notifications (VAPID receiver).
//   2. Offline shell — precaches /~offline + icons and serves navigations
//      network-first with the offline fallback page.
//   3. Offline-First sync (Phase 2) — relays a periodic background-sync
//      event (or an in-page "sync now" message) out to every open client,
//      which runs the IndexedDB offline sync engine.
//
// Workbox coexistence: inside the generated worker, next-pwa's
// DefinePlugin replaces the `__PWA_SW__` token with a string at build time
// (it is applied to the custom-worker bundle too) — that gives us a
// deterministic "running inside the generated worker" signal. When it is
// present, workbox owns precaching, runtime caching and the document
// fallback (fallbacks: { document: "/~offline" }), so our handlers no-op
// to avoid double respondWith. When this file runs standalone (dev
// public/sw.js), the token is undeclared and the handlers act.
//
// NOTE: keep public/sw.js in sync with this file (it is the dev fallback;
// next-pwa overwrites it on every production build).
// ---------------------------------------------------------------------

// --- Offline shell ------------------------------------------------------
const OFFLINE_CACHE = "bharat-shakti-shell-v1";
const OFFLINE_SHELL = [
  "/~offline",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
];

// Defined only inside the next-pwa-generated worker (DefinePlugin).
const inGeneratedWorker = () => typeof __PWA_SW__ !== "undefined";

self.addEventListener("install", (event) => {
  if (inGeneratedWorker()) return; // workbox precaches + fallback document
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      // Per-URL so one missing asset degrades to 'no offline shell' instead
      // of failing the whole install (which would kill push notifications).
      .then((cache) =>
        Promise.all(OFFLINE_SHELL.map((url) => cache.add(url).catch(() => undefined))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  if (inGeneratedWorker()) return; // workbox cleans its own outdated caches
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (inGeneratedWorker()) return; // workbox owns caching in the generated worker
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never touch cross-origin requests (map tiles, CDNs) or the dynamic API.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, then cache, then the offline fallback page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(OFFLINE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/~offline");
        }),
    );
    return;
  }

  // Same-origin static assets: cache-first with a network backfill.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(OFFLINE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

// --- Web Push (VAPID receiver) + offline queue ---------------------------
// Register hook in lib/alerts/web-push.ts #registerServiceWorker.
//
// Phase 7 · push notification queue: when a push arrives while the device
// is offline (or no window client is visible to catch it live), the payload
// is parked in a dedicated Cache API store instead of being dropped. The
// next background-sync tick (or an explicit "flush" message from the page)
// replays every queued notification — so alerts sent during a blackout are
// still surfaced the moment connectivity returns.
const PUSH_QUEUE_CACHE = "disasterlink-push-queue-v1";

/** True when the SW believes the network is reachable right now. */
function swOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/** Parks one push payload for later replay (resolves true if queued). */
async function enqueuePushPayload(payload, title, options) {
  try {
    const cache = await caches.open(PUSH_QUEUE_CACHE);
    const id = `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await cache.put(new Request(`/${id}`), new Response(JSON.stringify({ payload, title, options })));
    return true;
  } catch {
    return false;
  }
}

/** Replays every queued notification and clears the queue. */
async function flushPushQueue() {
  let cache;
  try {
    cache = await caches.open(PUSH_QUEUE_CACHE);
  } catch {
    return;
  }
  const requests = await cache.keys();
  if (requests.length === 0) return;
  const shows = requests.map(async (request) => {
    const response = await cache.match(request);
    if (!response) return;
    let entry;
    try {
      entry = await response.json();
    } catch {
      entry = {};
    }
    const payload = entry.payload || {};
    const title = String(entry.title || payload.title || "Disaster Alert");
    const options = {
      body: String(entry.options?.body || payload.body || "You have a new disaster alert."),
      icon: String(entry.options?.icon || payload.icon || "/icons/icon-192.png"),
      badge: String(entry.options?.badge || payload.badge || "/icons/icon-192.png"),
      tag: String(entry.options?.tag || payload.tag || "disaster-alert"),
      renotify: entry.options?.renotify === true ? true : false,
      data: { url: String(entry.options?.data?.url || payload.url || "/command-center") },
    };
    await self.registration.showNotification(title, options);
  });
  await Promise.all(shows);
  await cache.delete(PUSH_QUEUE_CACHE);
}

function buildPushOptions(payload) {
  return {
    body: String(payload.body ?? "You have a new disaster alert."),
    icon: String(payload.icon ?? "/icons/icon-192.png"),
    badge: String(payload.badge ?? "/icons/icon-192.png"),
    tag: String(payload.tag ?? "disaster-alert"),
    renotify: payload.renotify === true ? true : false,
    data: { url: String(payload.url || "/command-center") },
  };
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = String(payload.title ?? "Disaster Alert");
  const options = buildPushOptions(payload);

  // Offline (or no visible client) → queue for replay on the next sync tick.
  if (!swOnline()) {
    event.waitUntil(enqueuePushPayload(payload, title, options));
    return;
  }

  // Online → try to show immediately, but park on failure so nothing drops.
  event.waitUntil(
    self.registration.showNotification(title, options).catch(() =>
      enqueuePushPayload(payload, title, options).then(() => undefined),
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/command-center";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      }),
  );
});

// --- Offline-First sync (Phase 2) ---------------------------------------
// The engine itself (Dexie + fetchers) runs in the page; the SW only
// nudges open clients to run a sync. Covers:
//   • Periodic Background Sync ('periodicsync' event with our tag).
//   • An explicit in-page nudge via postMessage({ type: "drip:sync:request" })
//     (the page uses it for "Sync Now" while backgrounded).
const SYNC_TAG = "disasterlink-sync";
const SYNC_MSG = "drip:sync:request";

// One-shot background sync tags registered from the page (Phase 7 + offline SOS queue).
const BG_SYNC_TAGS = ["sync-predictions", "sync-alerts", "sync-sos"];

function relaySyncRequest() {
  self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      for (const client of clients) client.postMessage({ type: SYNC_MSG });
    })
    .catch(() => {});
}

// Every sync tick — one-shot, periodic or message nudge — also replays any
// notifications queued during the last outage (push offline queue).
function handleSyncTick() {
  relaySyncRequest();
  return flushPushQueue();
}

// One-shot Background Sync ('sync' event) — the browser retried a queued
// registration now that connectivity returned. Sync the matching dataset(s)
// via the page engine and flush the push queue.
self.addEventListener("sync", (event) => {
  if (!BG_SYNC_TAGS.includes(event.tag)) return;
  event.waitUntil(handleSyncTick());
});

// Periodic Background Sync — browser woke us to sync offline data.
self.addEventListener("periodicsync", (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(Promise.resolve(handleSyncTick()));
});

// In-page "Sync Now" nudge → relay to all open clients.
self.addEventListener("message", (event) => {
  const data = event.data && typeof event.data === "object" ? event.data : {};
  if (data.type !== SYNC_MSG) return;
  event.waitUntil(Promise.resolve(handleSyncTick()));
});
