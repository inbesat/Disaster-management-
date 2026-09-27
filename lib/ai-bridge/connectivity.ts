"use client";

// ---------------------------------------------------------------------
// lib/ai-bridge/connectivity.ts — Offline-First Architecture · Phase 1
// Connectivity monitor for the AI Bridge. More truthful than raw
// `navigator.onLine` (a browser can be "online" while the Supabase edge /
// API is unreachable): every listener receives `true` only when BOTH
// the browser reports a network AND the backend heartbeat answers.
//
//   - navigator.onLine flips instantly on the 'online'/'offline' events.
//   - The heartbeat re-probes the Supabase project on a fixed interval
//     (15s default) with a short per-request timeout, so a downstream
//     outage surfaces within seconds instead of on the next user action.
//   - SSR-safe: every operation no-ops if `window`/`navigator` are absent,
//     and the initial status is assumed online until corrected on mount.
// ---------------------------------------------------------------------

/** How current a status snapshot may be before forcing a fresh heartbeat. */
const HEARTBEAT_INTERVAL_MS = 15_000;
/** Per-heartbeat budget — generous enough for slow emergency-site wifi. */
const HEARTBEAT_TIMEOUT_MS = 4_000;

/** Injectable probe — defaults to the Supabase /auth/v1/health heartbeat. */
export type BackendProbe = (signal?: AbortSignal) => Promise<boolean>;

export interface ConnectivitySnapshot {
  /** True only when the browser network AND the backend heartbeat both pass. */
  online: boolean;
  /** Raw browser network state (navigator.onLine). */
  browserOnline: boolean;
  /** True when the last heartbeat actually reached Supabase. */
  backendReachable: boolean;
  /** Age of the last backend probe in ms (0 when never probed). */
  heartbeatAgeMs: number;
}

export type ConnectivityListener = (snapshot: ConnectivitySnapshot) => void;

function browserIsOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine === true;
}

/**
 * Probes the Supabase project. Uses the unauthenticated `/auth/v1/health`
 * endpoint (no token, no RLS, always answers 200 when reachable) as a
 * connectivity heartbeat. Resolves `false` on any fetch/timeout failure.
 */
async function pingBackend(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch("/api/ping", { signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export class ConnectivityMonitor {
  private listeners = new Set<ConnectivityListener>();
  private snapshot: ConnectivitySnapshot = {
    online: true,
    browserOnline: true,
    backendReachable: false,
    heartbeatAgeMs: Infinity,
  };
  private bound = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly probe: BackendProbe;
  /**
   * Demo-mode override. `null` = follow the real browser network; a boolean
   * forces the reported browser state so the "Simulate Offline" scenario can
   * be demonstrated without touching `navigator.onLine` (read-only).
   */
  private simulatedNetwork: boolean | null = null;

  constructor(probe?: BackendProbe) {
    this.probe = probe ?? pingBackend;
  }

  /** Coalesces the raw browser network event into listener notifications. */
  private handleNetworkChange = (): void => {
    this.update({ browserOnline: this.effectiveBrowserOnline() });
  };

  private effectiveBrowserOnline(): boolean {
    if (this.simulatedNetwork !== null) return this.simulatedNetwork;
    return browserIsOnline();
  }

  /**
   * Demo-mode override for the reported browser network. `null` restores the
   * real `navigator.onLine`; `false` force-drops the whole app offline even
   * though the device still has a connection.
   */
  setSimulatedNetwork(online: boolean | null): void {
    this.simulatedNetwork = online;
    this.handleNetworkChange();
  }

  /** Current simulated state — `null` when following the real network. */
  getSimulatedNetwork(): boolean | null {
    return this.simulatedNetwork;
  }

  private update(partial: Partial<ConnectivitySnapshot>): void {
    const next = {
      ...this.snapshot,
      ...partial,
      // A reported-absent browser network always wins over the backend probe.
      online:
        (partial.browserOnline ?? this.snapshot.browserOnline) &&
        (partial.backendReachable ?? this.snapshot.backendReachable),
    };
    this.snapshot = next;
    this.listeners.forEach((listener) => listener(next));
  }

  /** Starts the browser listeners + the periodic backend heartbeat. */
  start(intervalMs = HEARTBEAT_INTERVAL_MS): void {
    if (typeof window === "undefined" || this.bound) return;
    this.bound = true;

    window.addEventListener("online", this.handleNetworkChange);
    window.addEventListener("offline", this.handleNetworkChange);

    void this.heartbeat();
    this.timer = setInterval(() => void this.heartbeat(), intervalMs);
  }

  /** Stops listeners + heartbeat. Safe to call more than once. */
  stop(): void {
    if (typeof window === "undefined") return;
    window.removeEventListener("online", this.handleNetworkChange);
    window.removeEventListener("offline", this.handleNetworkChange);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.bound = false;
  }

  /** One immediate backend probe, then re-notifies listeners. */
  async heartbeat(): Promise<ConnectivitySnapshot> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
    const reachable = await this.probe(controller.signal);
    clearTimeout(timeout);

    this.update({ backendReachable: reachable, heartbeatAgeMs: Date.now() - startedAt });
    return this.getSnapshot();
  }

  getSnapshot(): ConnectivitySnapshot {
    // Guards against an unnaturally stale positive — if the last heartbeat is
    // older than the interval, report the browser state truthfully.
    if (this.snapshot.heartbeatAgeMs > HEARTBEAT_INTERVAL_MS * 2) {
      return { ...this.snapshot, online: this.snapshot.browserOnline };
    }
    return this.snapshot;
  }

  subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    // Deliver the current state immediately (correct-after-mount pattern).
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }
}

/** App-wide singleton the AI Bridge and useAI() share. */
let sharedMonitor: ConnectivityMonitor | null = null;

export function getConnectivityMonitor(): ConnectivityMonitor {
  if (!sharedMonitor) sharedMonitor = new ConnectivityMonitor();
  return sharedMonitor;
}
