"use client";

import { useEffect, useState } from "react";
import { isDemoModeEnabled } from "@/lib/demo/scenarios";
import {
  createRealtimeClient,
  PollingTransport,
  WebSocketTransport,
  type RealtimeMessage,
  type RealtimeStatus,
  type WebSocketLike,
} from "@/lib/realtime";

export type RealtimeEventType =
  "SHELTER_UPDATE" | "RESOURCE_MOVE" | "CRITICAL_ALERT" | "ROAD_CLOSURE" | "FIELD_REPORT";

export interface RealtimeEvent {
  id: string;
  type: RealtimeEventType;
  message: string;
  at: string;
}

// --- mock generators (mirrors the Supabase Realtime channel payloads) ------
const SHELTER_MESSAGES = [
  "Patna High School occupancy increased by 15.",
  "Riverside Community Hall reopened — 32 beds freed.",
  "Sampatchak shelter nearing capacity at 92%.",
  "District Hospital Annex occupancy increased by 8.",
  "Central Community Hall beds reduced by 6.",
];

const RESOURCE_MESSAGES = [
  "2 rescue boats dispatched to Rajendra Nagar.",
  "400 food packs en route to Kankarbagh.",
  "Medical kit convoy departed Patliputra Road.",
  "50 tents allocated to Bypass Road sector.",
  "Water tanker re-routed to Sampatchak.",
];

const CRITICAL_MESSAGES = [
  "FLASH FLOOD WARNING: Sector 4 — evacuate immediately.",
  "Bridge collapse risk on NH-31 near Digha.",
  "SOS broadcast received from Team Alpha.",
  "Power outage reported at Patna General Hospital.",
  "Cellular network down in Danapur sector.",
];

const ROAD_MESSAGES = [
  "Bypass Road closed — under water.",
  "Ashok Rajpath partially blocked by debris.",
  "Culvert blocked on Bailey Road.",
  "Gandhi Maidan route reopened to traffic.",
];

const FIELD_MESSAGES = [
  "Responder Sunita Das checked in at Rajendra Nagar.",
  "Photo report: severe flooding near Kankarbagh bridge.",
  "Voice note: water rising near bypass junction.",
  "Responder A. Kumar completed delivery at District Hospital.",
];

const POOL: { type: RealtimeEventType; messages: string[] }[] = [
  { type: "SHELTER_UPDATE", messages: SHELTER_MESSAGES },
  { type: "RESOURCE_MOVE", messages: RESOURCE_MESSAGES },
  { type: "CRITICAL_ALERT", messages: CRITICAL_MESSAGES },
  { type: "ROAD_CLOSURE", messages: ROAD_MESSAGES },
  { type: "FIELD_REPORT", messages: FIELD_MESSAGES },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Demo transport simulating an environment where WebSocket/Realtime
 * connections are blocked (hackathon hall wifi, corporate proxy, offline):
 * the socket never opens, so the RealtimeClient times out and falls back to
 * polling — Phase 20 step 9, visible in the UI as "POLLING".
 */
function blockedSocketForDemo(): WebSocketLike {
  return {
    readyState: 0,
    onopen: null,
    onerror: null,
    onclose: null,
    onmessage: null,
    send: () => undefined,
    close: () => undefined,
  };
}

/** Pull one mock event per poll tick — the polling fallback's data source. */
function nextMockMessage(channelName: string): RealtimeMessage {
  const source = pick(POOL);
  return {
    id: `${channelName}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: source.type,
    payload: { message: pick(source.messages) },
    at: new Date().toISOString(),
  };
}

/**
 * Simulated Supabase Realtime channel backed by the real RealtimeClient.
 * The WebSocket transport is intentionally blocked so the client demonstrates
 * the polling fallback; `status` tells the UI whether it is LIVE or POLLING.
 */
export function useMockRealtime(channelName: string): {
  liveEvents: RealtimeEvent[];
  status: RealtimeStatus;
  simulated: boolean;
} {
  const [liveEvents, setLiveEvents] = useState<RealtimeEvent[]>([]);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  const [simulated, setSimulated] = useState(false);
  useEffect(() => {
    const demo = isDemoModeEnabled();
    setSimulated(demo);
    const client = createRealtimeClient({
      primary: demo
        ? new WebSocketTransport({
            url: `wss://realtime.demo.local/v1/${channelName}`,
            socketFactory: () => blockedSocketForDemo(),
            connectTimeoutMs: 1200,
          })
        : undefined,
      fallback: new PollingTransport({
        poll: async () => {
          if (demo) return [nextMockMessage(channelName)];
          const response = await fetch("/api/alerts?limit=40", {
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) {
            setStatus("offline");
            return [];
          }
          const data = (await response.json()) as {
            alerts?: Array<{ id: string; message: string; createdAt: string }>;
          };
          setStatus("polling");
          return (data.alerts ?? []).map((alert) => ({
            id: alert.id,
            type: "CRITICAL_ALERT",
            payload: { message: alert.message },
            at: alert.createdAt,
          }));
        },
        intervalMs: demo ? 4000 : 15000,
      }),
    });

    const offMessage = client.onMessage((msg) => {
      const event: RealtimeEvent = {
        id: msg.id,
        type: msg.type as RealtimeEventType,
        message: (msg.payload as { message?: string }).message ?? msg.type,
        at: msg.at,
      };
      setLiveEvents((prev) => [event, ...prev].slice(0, 40));
    });
    const offStatus = client.onStatus(setStatus);
    client.connect().catch((err) => {
      console.error("[useMockRealtime] connection failed:", err);
    });

    return () => {
      offMessage();
      offStatus();
      client.disconnect();
    };
  }, [channelName]);

  return { liveEvents, status, simulated };
}
