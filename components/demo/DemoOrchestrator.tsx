"use client";

// ---------------------------------------------------------------------
// components/demo/DemoOrchestrator.tsx — Phase 15 · Step 10 · Master panel.
//
// A floating, draggable "Dev Tools" window that drives the WHOLE demo from
// one place — the hotkeys stay, this is the mouse-friendly override.
//
//   • Visible only when explicitly opened with ?devtools=1. Escape
//     hatch: append ?devtools=1 to any URL to force it on in a production
//     build for rehearsal.
//   • Master toggles mirror the hidden hotkeys by dispatching the same
//     global events (demo:toggle-impact / demo:toggle-qr / demo:toggle-qa
//     / demo:reset), and listen back so the switches stay in sync even
//     when the presenter uses the keyboard instead.
//   • Teleprompter — a 5-minute script outline that auto-scrolls as the
//     clock runs, so the presenter stays on track to the second.
//
// Mount once at the app root (app/layout.tsx). Renders nothing otherwise.
// ---------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  QrCode,
  MessagesSquare,
  RotateCcw,
  Play,
  Pause,
  Square,
  ChevronUp,
  GripHorizontal,
} from "lucide-react";

// 5-minute script outline — `at` is seconds since the prompter started.
const SCRIPT = [
  { at: 0, text: "Hook: “In the first 72 hours of a flood, minutes decide lives.”" },
  { at: 20, text: "Context: Bihar, Ganga at danger mark — both dashboards live." },
  { at: 45, text: "Shift+1 → Critical Flood Warning issues; alerts fan out." },
  { at: 75, text: "Shift+2 → Central Community Hall fills to capacity (FULL)." },
  { at: 105, text: "Shift+3 → responder arrives on-scene; map updates." },
  { at: 135, text: "Prediction: xgboost, 24h horizon, per-village confidence." },
  { at: 165, text: "Shift+9 → impact metrics count up (12,450 citizens alerted)." },
  { at: 195, text: "Q → QR modal: “Try the Citizen Experience” on their phone." },
  { at: 225, text: "Shift+4 → Q&A drawer: offline, privacy, AI — ready." },
  { at: 255, text: "Shift+0 → reset to the clean hero scenario for the next run." },
  {
    at: 285,
    text: "Close: “Built for Bharat Shakti — prediction to rescue in minutes.”",
  },
];

const TOTAL_SECONDS = 300;

type DevToolsProps = {
  className?: string;
};

export default function DemoOrchestrator({ className = "" }: DevToolsProps) {
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [metricsOn, setMetricsOn] = useState(false);
  const [qrOn, setQrOn] = useState(false);
  const [qaOn, setQaOn] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Teleprompter state.
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const boundsRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Opt-in so the floating panel never covers normal portal controls.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const forced = new URLSearchParams(window.location.search).get("devtools") === "1";
    setVisible(forced);
    setCollapsed(window.matchMedia("(max-width: 639px)").matches);
  }, [pathname]);

  // Keep the master switches in sync when the hotkeys drive the demo.
  useEffect(() => {
    const toggle = (event: Event) => {
      const name = (event as CustomEvent).type;
      if (name === "demo:toggle-impact") setMetricsOn((v) => !v);
      if (name === "demo:toggle-qr") setQrOn((v) => !v);
      if (name === "demo:toggle-qa") setQaOn((v) => !v);
    };
    const onReset = () => {
      setResetting(true);
      window.setTimeout(() => setResetting(false), 1400);
    };
    window.addEventListener("demo:toggle-impact", toggle);
    window.addEventListener("demo:toggle-qr", toggle);
    window.addEventListener("demo:toggle-qa", toggle);
    window.addEventListener("demo:reset", onReset);
    return () => {
      window.removeEventListener("demo:toggle-impact", toggle);
      window.removeEventListener("demo:toggle-qr", toggle);
      window.removeEventListener("demo:toggle-qa", toggle);
      window.removeEventListener("demo:reset", onReset);
    };
  }, []);

  // Teleprompter clock.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // Auto-scroll the script to the active line.
  const currentIndex = useMemo(() => {
    let index = -1;
    SCRIPT.forEach((line, i) => {
      if (elapsed >= line.at) index = i;
    });
    return index;
  }, [elapsed]);

  useEffect(() => {
    if (currentIndex < 0) return;
    const container = promptRef.current;
    const active = container?.querySelector<HTMLElement>(`[data-line="${currentIndex}"]`);
    active?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentIndex]);

  if (!visible) return null;

  const fire = (event: string) => window.dispatchEvent(new CustomEvent(event));

  const resetPrompt = () => {
    setRunning(false);
    setElapsed(0);
  };

  const mmss = (total: number) => {
    const m = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const s = (total % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const toggleButton = (
    label: string,
    icon: React.ReactNode,
    active: boolean,
    onClick: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition active:scale-[0.97] ${
        active
          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
        {icon}
        {label}
      </span>
      <span className="text-[9px] text-slate-500">
        {active ? "active" : "press to trigger"}
      </span>
    </button>
  );

  return (
    <div ref={boundsRef} className="pointer-events-none fixed inset-0 z-[800]">
      <motion.div
        drag
        dragConstraints={boundsRef}
        dragElastic={0}
        dragMomentum={false}
        whileDrag={{ scale: 1.02 }}
        className={`pointer-events-auto absolute bottom-4 right-4 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/15 bg-[rgb(var(--bg-primary-rgb)/95)] text-white shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-md ${className}`}
      >
        {/* Title bar — the drag handle */}
        <div className="flex cursor-grab items-center justify-between border-b border-white/10 bg-panel-deep px-3 py-2 active:cursor-grabbing">
          <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-300">
            <GripHorizontal className="h-3.5 w-3.5 text-slate-500" aria-hidden />
            Dev Tools · Demo Orchestrator
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand" : "Collapse"}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-400 transition hover:text-white active:scale-[0.97]"
          >
            <ChevronUp
              className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </div>

        {!collapsed && (
          <>
            {/* Master toggles */}
            <div className="grid grid-cols-2 gap-2 p-3">
              {toggleButton(
                "Metric Animation",
                <Activity className="h-3.5 w-3.5" aria-hidden />,
                metricsOn,
                () => fire("demo:toggle-impact"),
              )}
              {toggleButton(
                "Show QR Code",
                <QrCode className="h-3.5 w-3.5" aria-hidden />,
                qrOn,
                () => fire("demo:toggle-qr"),
              )}
              {toggleButton(
                "Q&A Drawer",
                <MessagesSquare className="h-3.5 w-3.5" aria-hidden />,
                qaOn,
                () => fire("demo:toggle-qa"),
              )}
              <button
                type="button"
                onClick={() => fire("demo:reset")}
                disabled={resetting}
                className="flex flex-col items-start gap-1 rounded-lg border border-rose-400/50 bg-rose-500/15 px-3 py-2.5 text-left text-rose-200 transition hover:bg-rose-500/25 active:scale-[0.97] disabled:opacity-60"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
                  <RotateCcw
                    className={`h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`}
                    aria-hidden
                  />
                  Reset DB
                </span>
                <span className="text-[9px] text-rose-300/70">
                  {resetting ? "reseeding hero scenario…" : "wipe + reseed demo data"}
                </span>
              </button>
            </div>

            {/* Teleprompter */}
            <div className="border-t border-white/10 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-eoc-tiny font-bold uppercase tracking-[0.22em] text-cyan-300">
                  Teleprompter
                </span>
                <span className="font-mono text-eoc-tiny text-slate-400">
                  {mmss(elapsed)} / {mmss(TOTAL_SECONDS)}
                </span>
              </div>

              <div
                ref={promptRef}
                className="h-32 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-2"
              >
                {SCRIPT.map((line, i) => (
                  <p
                    key={line.at}
                    data-line={i}
                    className={`rounded-md px-2 py-1 text-[11px] leading-snug transition-colors ${
                      i === currentIndex
                        ? "bg-cyan-500/15 font-semibold text-cyan-100"
                        : i < currentIndex
                          ? "text-slate-600"
                          : "text-slate-300"
                    }`}
                  >
                    <span className="mr-1.5 font-mono text-[9px] text-slate-500">
                      {mmss(line.at)}
                    </span>
                    {line.text}
                  </p>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-1.5">
                {running ? (
                  <button
                    type="button"
                    onClick={() => setRunning(false)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-200 transition hover:bg-white/10 active:scale-[0.97]"
                  >
                    <Pause className="h-3 w-3" aria-hidden />
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRunning(true)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-400/50 bg-emerald-500/15 py-2.5 text-[11px] font-bold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/25 active:scale-[0.97]"
                  >
                    <Play className="h-3 w-3" aria-hidden />
                    Start script
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetPrompt}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-300 transition hover:bg-white/10 active:scale-[0.97]"
                >
                  <Square className="h-3 w-3" aria-hidden />
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
