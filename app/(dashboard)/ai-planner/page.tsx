"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isTextUIPart,
  isToolUIPart,
  type UIDataTypes,
  type UITools,
  type UIMessagePart,
  type UIMessage,
} from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { useRef, useState, useEffect } from "react";
import toast from "react-hot-toast";
import SourcesAccordion, {
  type SourceInvocation,
} from "@/components/ai/SourcesAccordion";
import TypingIndicator from "@/components/ai/TypingIndicator";
import MessageActions from "@/components/ai/MessageActions";
import QuickActions from "@/components/ai/QuickActions";
import { readChatPreferences } from "@/lib/settings/chat-preferences";
import ChatInputBar from "@/components/ai/ChatInputBar";

// ---------------------------------------------------------------------
// Chat persistence — the evacuation plan must survive a page refresh.
// Messages are round-tripped to localStorage under a STABLE, per-district
// key, so each disaster event keeps its own isolated conversation memory
// (Phase 10: per-disaster-event chat history). A district change therefore
// starts a fresh thread for that event.
// ---------------------------------------------------------------------
const CURRENT_DISTRICT = "Patna"; // Step 8 — map context (mock for now)
const STORAGE_KEY = `ai-emergency-chat:${CURRENT_DISTRICT}`;

// The canned message is only a last resort — prefer the real error text the
// API returns so the operator sees exactly why a request failed.
function describePlannerError(error: unknown): string {
  const e = error as { message?: string; body?: string; cause?: unknown } | null;
  let raw = e?.message ?? String(error ?? "");
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (typeof parsed?.error === "string" && parsed.error) return parsed.error;
  } catch {
    // not JSON — fall through
  }
  raw =
    typeof e?.body === "string"
      ? e.body
      : e?.cause instanceof Error
        ? e.cause.message
        : "";
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown };
      if (typeof parsed?.error === "string" && parsed.error) return parsed.error;
    } catch {
      if (raw.trim().length > 4) return raw.trim();
    }
  }
  return "Planner error — the AI provider is unreachable right now (all providers probed: OpenRouter → Groq → Bluesminds). Retry in a minute.";
}

function loadStoredMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------
// Tactical markdown overrides — render the AI's output like an official
// SOP/operations document (uppercase tracked headings with an amber rule,
// data-grid tables, and severity-coloured emphasis).
// ---------------------------------------------------------------------
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node: _node, ...props }) => {
    void _node;
    return (
      <h1
        className="mb-3 mt-6 border-b border-severity-amber-500/60 pb-2 text-sm font-bold uppercase tracking-[0.22em] text-slate-100 first:mt-0"
        {...props}
      />
    );
  },
  h2: ({ node: _node, ...props }) => {
    void _node;
    return (
      <h2
        className="mb-2 mt-5 border-b border-severity-amber-500/40 pb-1.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-200"
        {...props}
      />
    );
  },
  h3: ({ node: _node, ...props }) => {
    void _node;
    return (
      <h3
        className="mb-1 mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-300"
        {...props}
      />
    );
  },
  strong: ({ node: _node, ...props }) => {
    void _node;
    return <strong className="font-semibold text-severity-red-400" {...props} />;
  },
  table: ({ node: _node, ...props }) => {
    void _node;
    return (
      <div className="my-3 overflow-x-auto rounded-lg border border-slate-700 shadow-lg shadow-black/30">
        <table className="w-full border-collapse text-xs" {...props} />
      </div>
    );
  },
  thead: ({ node: _node, ...props }) => {
    void _node;
    return <thead className="bg-slate-900" {...props} />;
  },
  th: ({ node: _node, ...props }) => {
    void _node;
    return (
      <th
        className="border border-slate-700 px-3 py-2 text-left font-bold uppercase tracking-wider text-severity-amber-300"
        {...props}
      />
    );
  },
  td: ({ node: _node, ...props }) => {
    void _node;
    return (
      <td
        className="border border-slate-700 px-3 py-2 align-top text-slate-300"
        {...props}
      />
    );
  },
  tr: ({ node: _node, ...props }) => {
    void _node;
    return <tr className="odd:bg-slate-900 even:bg-slate-900/40" {...props} />;
  },
};

const TOOL_BADGES: Record<string, { icon: string; label: string; tone: string }> = {
  getShelterStatus: {
    icon: "🏥",
    label: "Querying Shelter Database",
    tone: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  },
  getFloodPrediction: {
    icon: "🛰️",
    label: "Accessing Satellite Flood Data",
    tone: "border-red-500/40 bg-red-500/10 text-red-300",
  },
};

function getDistrict(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const district = (input as Record<string, unknown>).district;
  return typeof district === "string" ? district : "";
}

function ToolBadge({ part }: { part: UIMessagePart<UIDataTypes, UITools> }) {
  if (!isToolUIPart(part)) return null;
  const toolName = "toolName" in part ? (part.toolName as string) : "";
  const meta = TOOL_BADGES[toolName] ?? {
    icon: "⚙️",
    label: toolName,
    tone: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  };
  const district = getDistrict(part.input);
  const running = part.state === "input-streaming";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] tracking-wide ${meta.tone}`}
    >
      <span className={running ? "animate-pulse" : ""}>{meta.icon}</span>
      <span className="font-semibold">
        {meta.label}
        {running ? "…" : " ✓"}
      </span>
      {district && <span className="opacity-70">[{district}]</span>}
    </span>
  );
}

/** Normalise a tool UI part into the SourcesAccordion's plain shape. */
function toSourceInvocation(part: UIMessagePart<UIDataTypes, UITools>): SourceInvocation {
  const anyPart = part as {
    toolName?: unknown;
    input?: unknown;
    output?: unknown;
    state?: unknown;
    errorText?: unknown;
  };
  return {
    toolName: typeof anyPart.toolName === "string" ? anyPart.toolName : "tool",
    input: anyPart.input,
    output: anyPart.output,
    state: typeof anyPart.state === "string" ? anyPart.state : undefined,
    errorText: typeof anyPart.errorText === "string" ? anyPart.errorText : undefined,
  };
}

const CONTEXT_STATS: Array<{ label: string; value: string; critical?: boolean }> = [
  { label: "Active District", value: "Patna (Bihar)", critical: true },
  { label: "48-Hour Risk Level", value: "CRITICAL", critical: true },
  { label: "Projected Rainfall", value: "120 mm" },
  { label: "Open Shelters", value: "4 / 6" },
  { label: "Estimated Evacuees", value: "2,400" },
  { label: "Fleet Standing By", value: "12 buses / 4 boats" },
];

const CONTEXT_HEADERS: string[] = [
  "Ganga water level rising 3 cm/hr.",
  "Kankarbagh low-lying ward evacuation before 06:00.",
  "Alert pushed to 4,812 subscribed phones.",
];

const SUGGESTIONS: string[] = [
  "Draft a 48-hour evacuation plan for Kankarbagh",
  "Which shelters have open beds in Patna?",
  "What is the flood risk for the next 24 hours?",
];

function OperationContextPanel({ tokensLeft }: { tokensLeft: number }) {
  const [notesOpen, setNotesOpen] = useState(true);
  return (
    <>
      <div className="border-b border-slate-800 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Active Operation Context
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Live picture of the current response
        </p>
      </div>

      {/* AI rate-limit gauge (Step 9) */}
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            AI Tokens Remaining
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums ${
              tokensLeft === 0
                ? "text-severity-red-400"
                : tokensLeft <= 2
                  ? "text-severity-amber-400"
                  : "text-emerald-300"
            }`}
          >
            {tokensLeft}/5
          </span>
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < tokensLeft
                  ? tokensLeft <= 2
                    ? "bg-severity-amber-500"
                    : "bg-emerald-500"
                  : "bg-slate-800"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1 p-3">
        {CONTEXT_STATS.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-slate-900"
          >
            <span className="text-xs text-slate-500">{stat.label}</span>
            <span
              className={`text-xs font-semibold ${
                stat.critical ? "text-red-400" : "text-slate-200"
              }`}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-3 border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => setNotesOpen((o) => !o)}
          className="flex w-full items-center justify-between px-2 text-xs font-semibold text-slate-400"
        >
          Intelligence Notes
          <span className="flex items-center gap-1">
            <span className="rounded-full bg-slate-800 px-1.5 py-0.5 font-mono text-eoc-tiny text-slate-400">
              {CONTEXT_HEADERS.length}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${notesOpen ? "rotate-180" : ""}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
        {notesOpen && (
          <div className="mt-2 space-y-2 px-2 pb-4">
            {CONTEXT_HEADERS.map((note) => (
              <div
                key={note}
                className="flex items-start gap-2 rounded-lg border border-slate-800/70 bg-slate-900/50 px-3 py-2"
              >
                <span className="mt-0.5 text-eoc-tiny text-amber-400">⚠</span>
                <span className="text-xs text-slate-300">{note}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function AiPlannerPage() {
  const [historyReady, setHistoryReady] = useState(false);
  const { status, messages, setMessages, sendMessage, error } = useChat({
    // AI SDK v7: the endpoint is set on the transport (no top-level `api`).
    // Securely calling the local Next.js backend API route to bypass CORS and hide API keys
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: [],
    // Surface backend failures (missing API key → 500, rate limit → 429,
    // provider outage → 502) in the browser console instead of failing
    // silently in the UI.
    onError: (err) => {
      console.error("[AiPlanner] chat request failed:", err);
    },
  });

  // Load after hydration so saved browser messages do not disagree with SSR.
  useEffect(() => {
    setMessages(loadStoredMessages());
    setHistoryReady(true);
  }, [setMessages]);

  // Do not overwrite saved history with the initial empty server render.
  useEffect(() => {
    if (!historyReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // storage full / unavailable — non-fatal
    }
  }, [messages, historyReady]);

  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [queriesRemaining, setQueriesRemaining] = useState(5);
  const [rateLimited, setRateLimited] = useState(false);

  // Step 9 — mock rate limit: when the bucket empties, lock the input for 60s.
  useEffect(() => {
    if (queriesRemaining > 0) return;
    setRateLimited(true);
    const timer = setTimeout(() => {
      setQueriesRemaining(5);
      setRateLimited(false);
    }, 60_000);
    return () => clearTimeout(timer);
  }, [queriesRemaining]);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const clearSession = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setMessages([]);
    setInput("");
    toast.success("Session cleared.");
  };

  const isLoading = status === "submitted" || status === "streaming";
  const lastMessageIsUser =
    messages.length > 0 && messages[messages.length - 1].role === "user";
  const showTyping = isLoading && lastMessageIsUser;
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const submit = (text: string) => {
    const value = text.trim();
    if (!historyReady || !value || isLoading || rateLimited) return;
    setQueriesRemaining((q) => Math.max(0, q - 1));
    // Step 8 — pass the currently-viewed district as hidden context so the
    // AI knows where the commander is looking. Settings · AI → provider
    // preference (non-secret) rides along so the planner honors the
    // operator-chosen provider on the server.
    void sendMessage(
      { text: value },
      {
        body: {
          currentDistrict: CURRENT_DISTRICT,
          ...readChatPreferences(),
        },
      },
    );
    setInput("");
    setTimeout(scrollToBottom, 50);
  };

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col gap-4 overflow-hidden p-4 lg:flex-row">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl shadow-black/40">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.6)]" />
            <div>
              <h1 className="text-sm font-semibold text-slate-100">
                SafeSphere Emergency AI
              </h1>
              <p className="text-[11px] text-slate-500">
                Tactical 48-hour evacuation planner
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSession}
              title="Clear saved chat history"
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-severity-red-500/50 hover:text-severity-red-300"
            >
              Clear Session
            </button>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                isLoading
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-emerald-500/15 text-emerald-300"
              }`}
            >
              {isLoading ? "THINKING" : "ONLINE"}
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-red-500/50 lg:hidden"
            >
              View Context
            </button>
          </div>
        </header>

        <div className="h-[calc(100vh-200px)] w-full space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 text-4xl">🛟</div>
              <h2 className="text-lg font-semibold text-slate-200">
                Ready for tactical planning.
              </h2>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Ask the commander AI about flood zones, shelter capacity, or to draft a
                48-hour evacuation plan.
              </p>
              <div className="mt-6 w-full max-w-md space-y-2">
                {SUGGESTIONS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => submit(chip)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-left text-sm text-slate-300 transition-colors hover:border-red-500/50 hover:bg-slate-800/60"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            if (m.role === "user") {
              const text = m.parts
                .filter(isTextUIPart)
                .map((p) => p.text)
                .join("");
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm text-white shadow">
                    {text}
                  </div>
                </div>
              );
            }

            const text = m.parts
              .filter(isTextUIPart)
              .map((p) => p.text)
              .join("");
            const toolParts = m.parts.filter(isToolUIPart);
            const hasToolCalls = toolParts.length > 0;
            const hasContent = text.trim().length > 0;

            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 shadow sm:max-w-[85%] md:max-w-[78%]">
                  {hasToolCalls && (
                    <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-800/80 pb-3">
                      {toolParts.map((part, i) => (
                        <ToolBadge key={i} part={part} />
                      ))}
                    </div>
                  )}

                  {hasContent && (
                    <div className="prose prose-invert prose-sm max-w-none text-slate-200 prose-headings:text-slate-100 prose-strong:text-red-300 prose-a:text-sky-400 prose-blockquote:border-red-500 prose-blockquote:text-slate-300 prose-th:border-slate-700 prose-td:border-slate-700 prose-table:text-slate-300">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={MARKDOWN_COMPONENTS}
                      >
                        {text}
                      </ReactMarkdown>
                    </div>
                  )}

                  {!hasContent && isLoading && <span className="text-slate-400">…</span>}

                  {hasToolCalls && (
                    <SourcesAccordion invocations={toolParts.map(toSourceInvocation)} />
                  )}

                  {hasContent && <MessageActions markdown={text} messageId={m.id} />}
                </div>
              </div>
            );
          })}

          {showTyping && (
            <div className="flex justify-start">
              <TypingIndicator />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <footer className="border-t border-slate-800 p-4">
          <QuickActions onSelect={submit} disabled={isLoading || rateLimited} />

          {rateLimited && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-severity-red-600 bg-severity-red-600/10 px-3 py-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-severity-red-500" />
              <p className="text-[11px] font-semibold text-severity-red-400">
                Rate limit exceeded. Please wait 1 minute.
              </p>
            </div>
          )}

          <ChatInputBar
            value={input}
            onChange={setInput}
            onSend={() => submit(input)}
            isProcessing={isLoading}
            disabled={rateLimited || !historyReady}
            placeholder={
              rateLimited
                ? "Please wait before sending another request…"
                : "Ask about flood zones, shelter capacity, or a 48-hour plan…"
            }
          />

          {error && (
            <p className="mt-2 text-[11px] text-red-400">{describePlannerError(error)}</p>
          )}
        </footer>
      </main>

      {/* Desktop sidebar — 30% width */}
      <aside className="hidden w-[30%] shrink-0 flex-col overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 shadow-xl shadow-black/40 lg:flex">
        <OperationContextPanel tokensLeft={queriesRemaining} />
      </aside>

      {/* Mobile context drawer — chat stays 100% wide behind it */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[85%] max-w-sm flex-col overflow-hidden border-l border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Operation Context
              </span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-red-500/50"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <OperationContextPanel tokensLeft={queriesRemaining} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
