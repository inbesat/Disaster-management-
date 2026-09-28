"use client";

// ---------------------------------------------------------------------
// components/ai/DualModeChat.tsx — Offline-First Architecture · Phase 6
// The dual-mode chat UI. Works identically online and offline:
//
//   • Top bar — connection-status pill: green "Online — Cloud" / orange
//     "Offline — Gemma Local" / red "No AI Available", with a mode switch.
//   • Message bubbles — user messages right-aligned with a blue gradient;
//     AI messages left-aligned dark gray, each with a Cloud/Local source
//     chip in the corner. Message enter animation (slide up + fade).
//   • Typing indicator — animated pulse "Gemma is thinking…" while a reply
//     is streaming.
//   • Per-message actions — Copy to clipboard + Report incorrect.
//   • Input bar — mic, textarea, send; subtle orange glow border when
//     offline.
// ---------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  ClipboardCopy,
  Cloud,
  Flag,
  RefreshCw,
  Send,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useDisasterChat, type DisasterChatMessage } from "@/hooks/useDisasterChat";
import VoiceInputButton from "@/components/ui/VoiceInputButton";
import { showToast } from "@/components/ui/Toast";

interface DualModeChatProps {
  district?: string;
  /** Route sends through the streaming path when true. */
  stream?: boolean;
}

export function DualModeChat({ district, stream = true }: DualModeChatProps) {
  const {
    messages,
    isLoading,
    aiMode,
    lastFailed,
    sendMessage,
    sendMessageStreaming,
    retry,
  } = useDisasterChat({ district });
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isLoading) return;
    setDraft("");
    if (stream) void sendMessageStreaming(text);
    else void sendMessage(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-subtle bg-primary">
      {/* Top bar */}
      <ModeBar aiMode={aiMode} onRetry={retry} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Bot className="h-10 w-10 text-accent-purple/60" aria-hidden />
            <p className="text-sm font-semibold text-slate-300">SafeSphere AI</p>
            <p className="max-w-xs text-xs text-muted">
              Ask about flood risk, shelters, or evacuation routes. Works the same online
              and offline.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isLoading && messages[messages.length - 1]?.streaming !== true && (
          <TypingIndicator />
        )}
      </div>

      {/* Composer */}
      <div
        className={`sticky bottom-0 border-t px-4 py-3 backdrop-blur ${
          aiMode !== "cloud"
            ? "border-amber-500/30 bg-[rgb(var(--bg-primary-rgb)/95)]"
            : "border-border bg-[rgb(var(--bg-primary-rgb)/95)]"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`flex min-h-[44px] flex-1 items-center gap-2 rounded-xl border px-3 py-2 transition ${
              aiMode !== "cloud"
                ? "border-amber-500/40 ring-1 ring-amber-500/20"
                : "border-border bg-[var(--bg-secondary)]"
            }`}
          >
            <VoiceInputButton
              label="Voice input"
              disabled={isLoading}
              onTranscription={(text) => setDraft((d) => `${d}${d ? " " : ""}${text}`)}
            />
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder={
                aiMode !== "cloud"
                  ? "Offline — local model ready…"
                  : "Message SafeSphere AI…"
              }
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-50 outline-none placeholder:text-muted"
            />
            {lastFailed && (
              <button
                type="button"
                onClick={retry}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-subtle bg-tertiary px-2 py-1 text-[10px] font-bold text-slate-200 transition hover:bg-[var(--bg-tertiary)]"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Retry
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || isLoading}
            aria-label="Send message"
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeBar({
  aiMode,
  onRetry,
}: {
  aiMode: "cloud" | "local" | "fallback";
  onRetry: () => void;
}) {
  const palette =
    aiMode === "cloud"
      ? {
          bg: "bg-emerald-500/10",
          text: "text-emerald-300",
          border: "border-emerald-500/40",
          dot: "bg-emerald-400",
          label: "Online — Cloud",
        }
      : aiMode === "local"
        ? {
            bg: "bg-amber-500/10",
            text: "text-amber-300",
            border: "border-amber-500/40",
            dot: "bg-amber-400",
            label: "Offline — Gemma Local",
          }
        : {
            bg: "bg-red-500/10",
            text: "text-red-300",
            border: "border-red-500/40",
            dot: "bg-red-400",
            label: "No AI Available",
          };
  const Icon = aiMode === "cloud" ? Wifi : aiMode === "local" ? WifiOff : RefreshCw;

  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-purple/15 text-accent-purple">
          <Bot className="h-4 w-4" aria-hidden />
        </span>
        <div className="flex flex-col leading-tight">
          <p className="text-sm font-bold text-slate-100">AI Command Advisor</p>
          <p className="text-[10px] text-muted">Dual-mode · cloud + offline</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${palette.bg} ${palette.border} ${palette.text}`}
        >
          <span
            className={`h-1.5 w-1.5 animate-pulse rounded-full ${palette.dot}`}
            aria-hidden
          />
          <Icon className="h-3 w-3" aria-hidden />
          {palette.label}
        </span>
        {aiMode === "fallback" && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-md border border-subtle bg-tertiary px-2 py-1 text-[10px] font-bold text-slate-200 transition hover:bg-[var(--bg-tertiary)]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: DisasterChatMessage }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("error", {
        title: "Could not copy",
        description: "Select the message text and copy it manually.",
      });
    }
  };

  if (message.role === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5">
        <Flag className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
        <p className="text-xs text-red-200">{message.content}</p>
      </div>
    );
  }

  const isUser = message.role === "user";
  const isStreaming = !!message.streaming;

  return (
    <div
      className={`message-enter flex w-full flex-col ${isUser ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-md ${
          isUser
            ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white"
            : "border border-subtle bg-[var(--bg-secondary)] text-slate-100"
        }`}
      >
        {!isUser && (
          <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-accent-purple">
            <Bot className="h-3 w-3" aria-hidden />
            {isStreaming ? "Gemma streaming…" : "AI Advisor"}
          </span>
        )}
        <p
          className={`whitespace-pre-wrap text-sm leading-relaxed ${isStreaming ? "streaming-caret" : ""}`}
        >
          {message.content || "…"}
        </p>
      </div>

      <div className="mt-1 flex items-center gap-2 px-1">
        {!isUser && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
              message.source === "local"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {message.source === "local" ? (
              <Bot className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <Cloud className="h-2.5 w-2.5" aria-hidden />
            )}
            {message.source === "local" ? "Local" : "Cloud"}
          </span>
        )}
        <span className="text-[10px] tabular-nums text-muted">
          {new Intl.DateTimeFormat("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }).format(new Date(message.timestamp))}
        </span>
        {!isUser && (
          <>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label="Copy to clipboard"
              title="Copy"
              className="rounded p-1 text-muted transition hover:bg-tertiary hover:text-slate-200"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" aria-hidden />
              ) : (
                <ClipboardCopy className="h-3 w-3" aria-hidden />
              )}
            </button>
            <button
              type="button"
              aria-label="Report incorrect"
              onClick={() => {
                const reason = window.prompt(
                  "What was incorrect? Feedback is saved on this device.",
                );
                if (!reason?.trim()) return;
                try {
                  const key = "safesphere:ai-feedback";
                  const history = JSON.parse(localStorage.getItem(key) || "[]");
                  localStorage.setItem(
                    key,
                    JSON.stringify([
                      ...history,
                      {
                        message: message.content,
                        reason: reason.trim(),
                        createdAt: new Date().toISOString(),
                      },
                    ]),
                  );
                  showToast("success", { title: "Feedback saved on this device" });
                } catch {
                  showToast("error", { title: "Feedback could not be saved" });
                }
              }}
              title="Report incorrect"
              className="rounded p-1 text-muted transition hover:bg-tertiary hover:text-red-400"
            >
              <Flag className="h-3 w-3" aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 pl-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
        Gemma is thinking
      </span>
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-purple"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

export default DualModeChat;
