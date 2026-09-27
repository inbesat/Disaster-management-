"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Database, FileText, Send, Sparkles, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import VoiceInput from "@/components/public/ai/VoiceInput";
import RAGSourcesPanel, { type RAGSource } from "./RAGSourcesPanel";

const WELCOME_CONTENT =
  "Commander, the swarm is online. Ask about responder availability, shelter capacity or flood scenarios — or tap a suggested query below.";

type ToolPrompt = { label: string };

const TOOL_PROMPTS: ToolPrompt[] = [
  { label: "Plan evacuation for Patna" },
  { label: "Check shelter capacity" },
  { label: "Allocate boats to Village X" },
  { label: "Show flood prediction" },
  { label: "What if rainfall increases 50%?" },
];

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function renderMarkdown(text: string) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
}

function mapMetadataToRAGSources(
  meta: Record<string, unknown> | undefined,
): RAGSource[] | undefined {
  if (!meta || !meta.ragSources || !Array.isArray(meta.ragSources)) return undefined;
  const srcs = meta.ragSources as Array<{
    title: string;
    docType: string | null;
    score: number | null;
    snippet: string;
  }>;
  if (srcs.length === 0) return [];
  return srcs.map((s) => ({
    title: s.docType ? `${s.title} (${s.docType})` : s.title,
    icon: s.docType === "procedure" || s.docType === "guideline" ? ShieldCheck : FileText,
  }));
}

function getProviderBadge(
  meta: Record<string, unknown> | undefined,
): { label: string; isOffline: boolean } | null {
  if (!meta) return null;
  if (meta.offline === true)
    return { label: "OFFLINE · 61-rule fallback", isOffline: true };
  if (meta.aiProvider && typeof meta.aiProvider === "string")
    return { label: meta.aiProvider.toUpperCase(), isOffline: false };
  return null;
}

export function PlannerChat() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");

  const { messages, sendMessage, status, error } = useChat<
    UIMessage<Record<string, unknown>>
  >({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: [
      {
        id: "welcome",
        role: "assistant",
        parts: [{ type: "text", text: WELCOME_CONTENT }],
        metadata: { ragSources: [] },
      } as UIMessage<Record<string, unknown>>,
    ],
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`;
  }, [draft]);

  const handleSubmit = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || status === "submitted" || status === "streaming") return;
      setDraft("");
      void sendMessage(
        { text: text },
        { body: { currentDistrict: undefined, provider: undefined } },
      );
    },
    [sendMessage, status],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(draft);
      }
    },
    [draft, handleSubmit],
  );

  const handleToolPrompt = useCallback(
    (label: string) => {
      if (status === "submitted" || status === "streaming") return;
      setDraft("");
      void sendMessage(
        { text: label },
        { body: { currentDistrict: undefined, provider: undefined } },
      );
    },
    [sendMessage, status],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0a0f1a]">
      {/* Thread header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#111827]/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400 shadow-[0_0_12px_rgba(139,92,246,0.3)]">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">AI Commander</p>
            <p className="text-[0.625rem] uppercase tracking-wider text-slate-500">
              Gov planner · tool-calling
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "submitted" || status === "streaming" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/40 bg-purple-400/10 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-purple-400">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400"
                aria-hidden
              />
              Streaming
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/40 bg-purple-400/10 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-purple-400">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400"
                aria-hidden
              />
              Live
            </span>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="px-4 py-2 text-sm text-red-400">
          The AI request failed. Please retry shortly.
        </p>
      )}
      {/* Messages */}
      <div
        aria-live="polite"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const content = msg.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("");
          const isTypingMsg =
            !isUser &&
            (status === "streaming" || status === "submitted") &&
            msg.id === messages[messages.length - 1]?.id;
          const sources = mapMetadataToRAGSources(msg.metadata);
          const badge = getProviderBadge(msg.metadata);

          return isUser ? (
            <div key={msg.id} className="flex flex-col items-end gap-1">
              <div className="max-w-[85%] rounded-xl rounded-br-md bg-blue-600 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-[0_0_12px_rgba(37,99,235,0.2)]">
                {content}
              </div>
              <span className="text-[0.625rem] text-slate-400">
                {formatTime(new Date(Date.now()))}
              </span>
            </div>
          ) : (
            <div key={msg.id} className="flex flex-col items-start gap-1">
              <div className="max-w-[92%] rounded-xl rounded-bl-md border-l-[3px] border-purple-400 bg-[#111827] px-3.5 py-2.5 relative">
                {isTypingMsg ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/40 bg-purple-400/10 px-2 py-1 text-[0.625rem] font-bold uppercase tracking-wider text-purple-400">
                    <Database className="h-3 w-3 animate-pulse" aria-hidden />
                    Querying Database…
                  </span>
                ) : (
                  <>
                    <div className="whitespace-pre-wrap">{renderMarkdown(content)}</div>
                    {badge && (
                      <div className="absolute top-1 right-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider ${
                            badge.isOffline
                              ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                              : "border-emerald-400/50 bg-emerald-400/10 text-emerald-400"
                          }`}
                        >
                          {badge.isOffline ? (
                            <>
                              <span
                                className="h-1 w-1 animate-pulse rounded-full bg-amber-400"
                                aria-hidden
                              />
                              {badge.label}
                            </>
                          ) : (
                            badge.label
                          )}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <span className="text-[0.625rem] text-slate-400">
                {formatTime(new Date(Date.now()))}
              </span>
              {!isTypingMsg && sources && <RAGSourcesPanel sources={sources} />}
            </div>
          );
        })}
      </div>

      {/* Suggested prompts — horizontal scrollable chips */}
      <div className="shrink-0 px-3 pb-1">
        <p className="mb-1 px-1 text-[0.625rem] font-bold uppercase tracking-wider text-slate-500">
          Suggested prompts
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TOOL_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => handleToolPrompt(prompt.label)}
              disabled={status === "submitted" || status === "streaming"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-[#111827] px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="truncate">{prompt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-white/10 bg-[#111827]/80 px-3 py-2.5 backdrop-blur-md">
        <div className="flex items-end gap-2">
          <div className="flex min-h-[44px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#0a0f1a] px-3 py-2 focus-within:border-purple-400/60 focus-within:ring-1 focus-within:ring-purple-400/30">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the AI commander…"
              disabled={status === "submitted" || status === "streaming"}
              className="max-h-[108px] flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder:text-slate-400 disabled:opacity-50"
            />
            {/* Commander Voice Mode — speak a command; the transcript is
                sent straight through the same chat pipeline. Works outside
                LanguageProvider (i18n-free labels) and simulates a phrase
                when Web Speech API is unavailable so demos never stall. */}
            <VoiceInput
              onResult={(text) => handleSubmit(text)}
              tone="violet"
              disabled={status === "submitted" || status === "streaming"}
            />
          </div>

          <button
            type="button"
            onClick={() => handleSubmit(draft)}
            disabled={!draft.trim() || status === "submitted" || status === "streaming"}
            aria-label="Send message"
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-[0_0_16px_rgba(139,92,246,0.4)] transition hover:bg-purple-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlannerChat;
