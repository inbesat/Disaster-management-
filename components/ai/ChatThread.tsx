"use client";

import ChatInputBar from "./ChatInputBar";
import SuggestedPrompts from "./SuggestedPrompts";
import SourcesPanel from "./SourcesPanel";
import { History, Sparkles } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useCallback } from "react";

const WELCOME_CONTENT =
  "Ask me about flood risk, evacuation plans, resource allocation, or scenario modeling for your district.";

function mapMetadataToSources(
  meta: Record<string, unknown> | undefined,
): string[] | undefined {
  if (!meta || !meta.ragSources || !Array.isArray(meta.ragSources)) return undefined;
  const srcs = meta.ragSources as Array<{ title: string; docType: string | null }>;
  if (srcs.length === 0) return undefined;
  return srcs.map((s) => (s.docType ? `${s.title} (${s.docType})` : s.title));
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

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function ChatThread({ onHistoryToggle }: { onHistoryToggle?: () => void }) {
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

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    void sendMessage(
      { text: text },
      { body: { currentDistrict: undefined, provider: undefined } },
    );
    setDraft("");
  }, [sendMessage, draft, status]);

  const handleToolPrompt = useCallback(
    (prompt: string) => {
      if (status === "submitted" || status === "streaming") return;
      void sendMessage(
        { text: prompt },
        { body: { currentDistrict: undefined, provider: undefined } },
      );
    },
    [sendMessage, status],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-primary">
      {/* Thread header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-purple/15 text-accent-purple">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-primary">AI Command Advisor</p>
        </div>
        <div className="flex items-center gap-2">
          {onHistoryToggle && (
            <button
              type="button"
              onClick={onHistoryToggle}
              aria-label="Toggle chat history"
              title="Chat history"
              className="rounded-md p-1.5 text-muted transition hover:bg-tertiary hover:text-accent-purple"
            >
              <History className="h-4 w-4" aria-hidden />
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/40 bg-accent-purple/10 px-2 py-0.5 text-eoc-tiny font-bold uppercase tracking-wider text-accent-purple">
            <span
              className={`h-1.5 w-1.5 animate-pulse rounded-full ${
                status === "submitted" || status === "streaming"
                  ? "bg-accent-purple"
                  : "bg-accent-purple"
              }`}
              aria-hidden
            />
            {status === "submitted" || status === "streaming" ? "Streaming" : "Live"}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="px-4 py-2 text-sm text-red-400">
          The AI request failed. Please retry shortly.
        </p>
      )}
      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
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
          const sources = mapMetadataToSources(msg.metadata);
          const badge = getProviderBadge(msg.metadata);

          return (
            <div
              key={msg.id}
              className={`flex w-full flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2.5 ${
                  isUser
                    ? "border border-border bg-[var(--bg-tertiary)] text-slate-50"
                    : "border-l-4 border-accent-purple bg-secondary text-slate-100"
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
                ) : (
                  <>
                    {isTypingMsg ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-purple/40 bg-accent-purple/10 px-2 py-1 text-eoc-tiny font-bold uppercase tracking-wider text-accent-purple">
                        <span className="flex items-center gap-1" aria-hidden>
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-purple"
                              style={{ animationDelay: `${i * 150}ms` }}
                            />
                          ))}
                        </span>
                        AI Advisor is drafting…
                      </span>
                    ) : (
                      <>
                        <p className="mb-1.5 flex items-center gap-1.5 text-eoc-tiny font-bold uppercase tracking-wider text-accent-purple">
                          <span className="flex h-3 w-3 items-center justify-center rounded-md bg-accent-purple/15 text-accent-purple">
                            <span className="h-4 w-4" aria-hidden>
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="h-4 w-4"
                              >
                                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
                                <path d="M12 16v-4" />
                                <path d="M12 8h.01" />
                              </svg>
                            </span>
                          </span>
                          AI Advisor
                        </p>
                        <div className="prose prose-invert max-w-none text-sm leading-relaxed [&_h3]:mt-3 [&_h3]:text-[11px] [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-accent-purple [&_h4]:mt-2 [&_h4]:text-xs [&_h4]:font-bold [&_h4]:uppercase [&_h4]:tracking-wider [&_h4]:text-slate-200 [&_p]:mt-0 [&_ul]:my-1 [&_ol]:my-1 [&_table]:mt-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_thead_th]:border [&_thead_th]:border-border-subtle [&_thead_th]:bg-tertiary [&_thead_th]:px-2 [&_thead_th]:py-1.5 [&_thead_th]:text-left [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-wider [&_tbody_td]:border [&_tbody_td]:border-border-subtle [&_tbody_td]:px-2 [&_tbody_td]:py-1.5 [&_tbody_tr:nth-child(even)]:bg-[var(--bg-tertiary)]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                          </ReactMarkdown>
                        </div>
                        {badge && (
                          <div className="mt-1 flex justify-end">
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
                  </>
                )}
              </div>
              {!isUser && !isTypingMsg && sources && sources.length > 0 && (
                <SourcesPanel sources={sources} />
              )}
              <div className="mt-1 flex items-center gap-2 px-1">
                {!isUser && !isTypingMsg && (
                  <span className="text-[0.625rem] text-slate-400">
                    {formatTime(new Date(Date.now()))}
                  </span>
                )}
                {isUser && (
                  <span className="text-[0.625rem] text-slate-400">
                    {formatTime(new Date(Date.now()))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Prompts + composer */}
      <SuggestedPrompts onSelect={handleToolPrompt} />
      <ChatInputBar
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        isProcessing={status === "submitted" || status === "streaming"}
      />
    </div>
  );
}

export default ChatThread;
