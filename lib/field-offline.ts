"use client";

// ---------------------------------------------------------------------------
// Offline-first utilities for field responders (Phase 19 Step 2).
//
//  1. CACHE   – persist a "next 24h" bundle (predictions, safe shelters, road
//              closures) so responders entering a comms blackout before/during
//              an event still know what is about to happen and where to go.
//  2. QUEUE   – stash failed API writes (check-ins, reports) and replay them to
//              the server once connectivity returns.
//  3. NETWORK – online/offline listeners. Since SMS can't leave the phone while
//              disconnected, an in-app siren + red overlay stands in for the
//              pager/alert that would otherwise be delivered by the network.
// ---------------------------------------------------------------------------

const BUNDLE_KEY = "drip_offline_bundle_v1";
const QUEUE_KEY = "drip_offline_queue_v1";
const BUNDLE_TTL_MS = 24 * 60 * 60 * 1000;

export const PATNA_CENTER = { lat: 25.5941, lng: 85.1376 };

export type RiskLevel = "Safe" | "Watch" | "Warning" | "Evacuate";

export interface OfflineShelter {
  id: string;
  name: string;
  district: string;
  capacity: number;
  remaining: number;
  safe: boolean;
}

export interface OfflinePrediction {
  riskLevel: RiskLevel;
  timestamp: string;
  forecastHorizonHrs: number;
}

export interface OfflineRoadClosure {
  id: string;
  lat: number;
  lng: number;
  reason: string;
}

export interface OfflineBundle {
  cachedAt: string;
  expiresAt: string;
  predictions: OfflinePrediction[];
  shelters: OfflineShelter[];
  roadClosures: OfflineRoadClosure[];
}

export interface PendingTask {
  id: string;
  url: string;
  method: "POST" | "PUT" | "PATCH";
  body: unknown;
  createdAt: string;
}

// --- SOS idempotency ----------------------------------------------------------
// Phase 1 (offline SOS queue): every SOS carries a client-generated id so
// Background Sync / outbox replays are idempotent — the server dedupes on it
// (stored in CrowdsourcedReport.sessionId as `sos:<clientId>`, namespaced to
// avoid demo-session collisions; a dedicated column is deferred to Phase 5).

/** Generates a unique client SOS id (e.g. "sos-1719849600000-a1b2c"). */
export function buildSosClientId(): string {
  return `sos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Minimal SOS body shape shared by /api/sos and /api/field/sos queue entries. */
export interface SosQueueBody {
  clientId: string;
  [key: string]: unknown;
}

/**
 * Enqueues an SOS payload for replay when connectivity returns. The body MUST
 * carry `clientId` (use buildSosClientId()) so the server can dedupe replays.
 */
export function enqueueSos(
  url: "/api/sos" | "/api/field/sos",
  body: SosQueueBody,
): void {
  OfflineSyncQueue.enqueue({ url, method: "POST", body });
}

// --- storage ---------------------------------------------------------------
function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err: unknown) {
    console.warn("[offline] failed to persist", key, err);
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function hoursFromNow(offsetHrs: number): string {
  return new Date(Date.now() + offsetHrs * 3600 * 1000).toISOString();
}

// --- 24h bundle ------------------------------------------------------------
const SEED_BUNDLE: OfflineBundle = {
  cachedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + BUNDLE_TTL_MS).toISOString(),
  predictions: [
    { riskLevel: "Watch", timestamp: hoursFromNow(6), forecastHorizonHrs: 6 },
    { riskLevel: "Warning", timestamp: hoursFromNow(12), forecastHorizonHrs: 12 },
    { riskLevel: "Evacuate", timestamp: hoursFromNow(18), forecastHorizonHrs: 18 },
    { riskLevel: "Evacuate", timestamp: hoursFromNow(24), forecastHorizonHrs: 24 },
  ],
  shelters: [
    { id: "m1", name: "Central Community Hall", district: "Patna (Ganga)", capacity: 450, remaining: 138, safe: true },
    { id: "m2", name: "District Hospital Annex", district: "Patna (Ganga)", capacity: 300, remaining: 206, safe: true },
    { id: "m3", name: "Riverside High School", district: "Patna (Ganga)", capacity: 380, remaining: 0, safe: false },
  ],
  roadClosures: [
    { id: "r1", lat: 25.5921, lng: 85.1301, reason: "Under water" },
    { id: "r2", lat: 25.6104, lng: 85.1322, reason: "Culvert blocked" },
  ],
};

const riskFromIndex = (idx: number): RiskLevel =>
  idx >= 3 ? "Evacuate" : idx >= 2 ? "Warning" : idx >= 1 ? "Watch" : "Safe";

/** Pull the live "next 24h" picture; on any failure keep the cached seed. */
export async function buildOfflineBundle(): Promise<OfflineBundle> {
  const bundle: OfflineBundle = { ...SEED_BUNDLE };
  try {
    const [predRes, roadRes] = await Promise.all([
      fetch("/api/predictions/history?days=2"),
      fetch("/api/road-closures"),
    ]);
    const preds = (await predRes.json()) as { points?: { riskIndex?: number }[] };
    const roads = (await roadRes.json()) as {
      closures?: { id?: string; lat: number; lng: number; reason?: string }[];
    };

    if (preds.points?.length) {
      bundle.predictions = preds.points.map((p, i) => ({
        riskLevel: riskFromIndex(p.riskIndex ?? 0),
        timestamp: hoursFromNow((i + 1) * 6),
        forecastHorizonHrs: (i + 1) * 6,
      }));
    }
    if (roads.closures?.length) {
      bundle.roadClosures = roads.closures.slice(0, 12).map((c) => ({
        id: c.id ?? String(c.lat),
        lat: c.lat,
        lng: c.lng,
        reason: c.reason ?? "Blocked",
      }));
    }
  } catch {
    /* offline/upstream down – seed bundle stands in */
  }
  return bundle;
}

export function cacheBundle(bundle: OfflineBundle): void {
  const now = Date.now();
  write(BUNDLE_KEY, {
    ...bundle,
    cachedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + BUNDLE_TTL_MS).toISOString(),
  });
}

export function getCachedBundle(): OfflineBundle | null {
  return read<OfflineBundle>(BUNDLE_KEY);
}

export function isBundleFresh(): boolean {
  const b = getCachedBundle();
  return !!b && new Date(b.expiresAt).getTime() > Date.now();
}

/**
 * Highest actionable risk in the bundle within `windowHrs`. Returns null when
 * the window is clear or the bundle is empty. Drives the in-app alarm.
 */
export function peekOfflineRisk(
  bundle: OfflineBundle | null,
  windowHrs = 24,
): { level: RiskLevel; withinHrs: number } | null {
  if (!bundle) return null;
  const rank: Record<RiskLevel, number> = { Safe: 0, Watch: 1, Warning: 2, Evacuate: 3 };
  const now = Date.now();
  let worst: { level: RiskLevel; withinHrs: number } | null = null;
  for (const p of bundle.predictions) {
    const at = new Date(p.timestamp).getTime();
    if (at < now) continue;
    const withinHrs = (at - now) / 3600e3;
    if (withinHrs > windowHrs) continue;
    if (!worst || rank[p.riskLevel] > rank[worst.level]) {
      worst = { level: p.riskLevel, withinHrs };
    }
  }
  return worst;
}

// --- sync queue -------------------------------------------------------------
export class OfflineSyncQueue {
  static list(): PendingTask[] {
    return read<PendingTask[]>(QUEUE_KEY) ?? [];
  }

  static count(): number {
    return OfflineSyncQueue.list().length;
  }

  static enqueue(task: Omit<PendingTask, "id" | "createdAt">): void {
    const queue = OfflineSyncQueue.list();
    queue.push({
      ...task,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    });
    write(QUEUE_KEY, queue);
    emitQueueChanged();
  }

  static clear(): void {
    remove(QUEUE_KEY);
    emitQueueChanged();
  }

  /** Replay queued requests to the server; keep anything that still fails. */
  static async syncAll(): Promise<{ synced: number; remaining: number }> {
    const queue = OfflineSyncQueue.list();
    if (queue.length === 0) return { synced: 0, remaining: 0 };

    const kept: PendingTask[] = [];
    let synced = 0;
    for (const task of queue) {
      try {
        const res = await fetch(task.url, {
          method: task.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task.body),
        });
        if (res.ok) synced += 1;
        else kept.push(task);
      } catch {
        kept.push(task);
      }
    }
    write(QUEUE_KEY, kept);
    emitQueueChanged();
    return { synced, remaining: kept.length };
  }
}

const queueChangedEvent = "drip:pending";
function emitQueueChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(queueChangedEvent));
}

// --- network + in-app alarm ------------------------------------------------
let bound = false;
const listeners = new Set<() => void>();
function notifyNetwork() {
  listeners.forEach((fn) => fn());
}
function bind() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  window.addEventListener("online", notifyNetwork);
  window.addEventListener("offline", notifyNetwork);
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/** Subscribe to network changes; runs `cb` immediately + on every change. */
export function subscribeToNetwork(cb: () => void): () => void {
  bind();
  listeners.add(cb);
  if (typeof window !== "undefined") queueMicrotask(cb);
  return () => listeners.delete(cb);
}

/** Loud buzzer via WebAudio — the offline stand-in for an SMS/push alert. */
export function playAlarm() {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    for (let i = 0; i < 8; i += 1) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = i % 2 === 0 ? 620 : 415;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = now + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  } catch {
    /* audio blocked — visual alarm still presents */
  }
}