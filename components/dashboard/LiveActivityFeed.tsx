"use client";

import { useEffect, useRef, useState } from "react";
import {
  Warehouse,
  Truck,
  AlertOctagon,
  MapPinOff,
  SatelliteDish,
  Radio,
  RefreshCw,
} from "lucide-react";
import {
  useMockRealtime,
  type RealtimeEvent,
  type RealtimeEventType,
} from "@/hooks/useMockRealtime";
import type { RealtimeStatus } from "@/lib/realtime";
import { DEMO_ACTIVITY_EVENT, type DemoActivityEvent } from "@/hooks/useDemoSimulation";

const STATUS_BADGE: Record<
  RealtimeStatus,
  { text: string; cls: string; dot: string; title: string }
> = {
  live: {
    text: "LIVE",
    cls: "text-emerald-300",
    dot: "animate-pulse bg-emerald-400",
    title: "Connected over WebSocket (Supabase Realtime)",
  },
  polling: {
    text: "POLLING",
    cls: "text-amber-300",
    dot: "bg-amber-400",
    title: "Refreshing recorded alerts from the server",
  },
  connecting: {
    text: "CONNECTING…",
    cls: "text-amber-300",
    dot: "bg-amber-400",
    title: "Attempting a Realtime WebSocket connection…",
  },
  offline: {
    text: "OFFLINE",
    cls: "text-red-400",
    dot: "bg-red-500",
    title: "No transport available — reconnecting…",
  },
};

const EVENT_STYLE: Record<
  RealtimeEventType,
  { bar: string; badge: string; icon: React.ReactNode; label: string }
> = {
  SHELTER_UPDATE: {
    bar: "bg-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
    icon: <Warehouse className="h-4 w-4" />,
    label: "Shelter",
  },
  RESOURCE_MOVE: {
    bar: "bg-sky-400",
    badge: "bg-sky-500/15 text-sky-300 border-sky-400/40",
    icon: <Truck className="h-4 w-4" />,
    label: "Resource",
  },
  CRITICAL_ALERT: {
    bar: "bg-red-500",
    badge: "bg-red-500/15 text-red-300 border-red-400/40",
    icon: <AlertOctagon className="h-4 w-4" />,
    label: "Critical",
  },
  ROAD_CLOSURE: {
    bar: "bg-amber-400",
    badge: "bg-amber-500/15 text-amber-300 border-amber-400/40",
    icon: <MapPinOff className="h-4 w-4" />,
    label: "Road",
  },
  FIELD_REPORT: {
    bar: "bg-violet-400",
    badge: "bg-violet-500/15 text-violet-300 border-violet-400/40",
    icon: <SatelliteDish className="h-4 w-4" />,
    label: "Field",
  },
};

export default function LiveActivityFeed({
  channelName = "command-room-events",
}: {
  channelName?: string;
}) {
  const { liveEvents, status, simulated } = useMockRealtime(channelName);
  const badge = STATUS_BADGE[status];
  const [now, setNow] = useState(Date.now());
  const [simEvents, setSimEvents] = useState<RealtimeEvent[]>([]);
  const listRef = useRef<HTMLUListElement>(null);

  // Tick the relative timestamps every 30s.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // Phase 10 · Step 3 — demo simulation injects fake "Resource Deployed"
  // logs (drip:demo-sim:activity). They're prepended above the realtime
  // feed so the pitch demo visibly moves the feed on its own.
  useEffect(() => {
    const onDemoActivity = (e: Event) => {
      const { event } = (e as DemoActivityEvent).detail;
      setSimEvents((prev) => [event, ...prev].slice(0, 40));
    };
    window.addEventListener(DEMO_ACTIVITY_EVENT, onDemoActivity);
    return () => window.removeEventListener(DEMO_ACTIVITY_EVENT, onDemoActivity);
  }, []);

  const allEvents = [...(simulated ? simEvents : []), ...liveEvents];

  function timeAgo(iso: string): string {
    const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  }

  return (
    <section className="flex flex-col rounded-eoc border border-border bg-surface shadow-glow-accent">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="eoc-label flex items-center gap-2 text-accent">
          <Radio className="h-4 w-4" />
          {simulated ? "DEMO ACTIVITY" : "RECORDED ALERTS"}
        </h2>
        <span
          title={badge.title}
          className={`flex cursor-help items-center gap-1.5 text-xs font-bold ${badge.cls}`}
        >
          <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
          {simulated ? "DEMO DATA" : badge.text}
          {status === "polling" && (
            <RefreshCw className="ml-0.5 h-3 w-3" aria-label="Polling fallback active" />
          )}
        </span>
      </header>

      <ul
        ref={listRef}
        aria-live="polite"
        className="feed-scroll flex max-h-[40vh] sm:max-h-[420px] flex-col gap-2 overflow-y-auto p-3"
      >
        {allEvents.map((event) => {
          const style = EVENT_STYLE[event.type];
          return (
            <EventRow key={event.id} event={event} style={style} timeAgo={timeAgo} />
          );
        })}
        {allEvents.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-slate-400">
            Waiting for the first broadcast…
          </li>
        )}
      </ul>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .feed-enter {
          animation: slideIn 0.35s ease-out;
        }
        .feed-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(74, 222, 128, 0.35) transparent;
        }
      `}</style>
    </section>
  );
}

function EventRow({
  event,
  style,
  timeAgo,
}: {
  event: RealtimeEvent;
  style: (typeof EVENT_STYLE)[RealtimeEventType];
  timeAgo: (iso: string) => string;
}) {
  return (
    <li className="feed-enter relative flex items-start gap-3 overflow-hidden rounded-lg border border-border bg-surface-elevated p-3">
      <span className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${style.badge}`}
      >
        {style.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-eoc-tiny font-bold uppercase tracking-wider ${style.badge}`}
          >
            {style.label}
          </span>
          <span className="text-[11px] tabular-nums text-slate-500">
            {timeAgo(event.at)}
          </span>
        </span>
        <span className="mt-1 block text-sm leading-snug text-slate-200">
          {event.message}
        </span>
      </span>
    </li>
  );
}
