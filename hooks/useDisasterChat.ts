"use client";

// ---------------------------------------------------------------------
// hooks/useDisasterChat.ts — Offline-First Architecture · Phase 6
// useDisasterChat(): the unified dual-mode chat hook. Works identically
// online and offline:
//
//   • sendMessage() — routes through the AIBridge (cloud ↔ local), records
//     which source answered, and streams local replies token-by-token.
//   • IndexedDB persistence — every turn is written to the `chatHistory`
//     table (Phase 3 schema) so the conversation survives refresh/blackout.
//   • Retry logic — a failed local call offers "Try Cloud"; a failed cloud
//     call steps down to local automatically (bridge behavior) with
//     "Retry" available.
//   • aiMode — 'cloud' | 'local' | 'fallback' for the top-bar pill.
//
// Usage:
//   const { messages, sendMessage, isLoading, aiMode, retry } = useDisasterChat("Patna");
// ---------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import { getAIBridge } from "@/lib/ai-bridge/ai-bridge";
import type {
  AIProvider,
  ChatContext,
  ChatMessage,
  BridgeMode,
} from "@/lib/ai-bridge/types";
import { getOfflineDb } from "@/lib/offline-sync/db";
import { WorkerLLMProvider } from "@/lib/ai-bridge/worker-provider";

export type ChatAIMode = "cloud" | "local" | "fallback";

export interface DisasterChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  timestamp: number;
  /** Which path answered (assistant rows only). */
  source?: BridgeMode;
  /** WebLLM streaming tokens accumulate here before commit. */
  streaming?: boolean;
}

/** A local provider with streaming, as the chat uses for offline replies. */
export interface ChatLocalProvider extends AIProvider {
  streamResponse(
    prompt: string,
    context: ChatContext,
  ): AsyncGenerator<{ text: string; done: boolean; mode: "local" | "error" }>;
}

interface DisasterChatOptions {
  /** District scoping sent to the cloud planner + offline context builder. */
  district?: string;
  /** Session id for the persisted chat log (defaults to a shared session). */
  sessionId?: string;
  /** Persist turns to IndexedDB (default true). */
  persist?: boolean;
  /** Local model provider override (tests / demo). Defaults to the Web Worker. */
  localProvider?: ChatLocalProvider;
}

const DEFAULT_SESSION = "main";

let idCounter = 0;
function makeId(role: string): string {
  idCounter += 1;
  return `${role}-${Date.now()}-${idCounter}`;
}

export function useDisasterChat(options: DisasterChatOptions = {}) {
  const bridge = getAIBridge();
  const district = options.district;
  const sessionId = options.sessionId ?? DEFAULT_SESSION;
  const persist = options.persist ?? true;
  const localProviderRef = useRef<ChatLocalProvider | null>(
    options.localProvider ?? null,
  );

  const [messages, setMessages] = useState<DisasterChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiMode, setAiMode] = useState<ChatAIMode>("cloud");
  const [lastFailed, setLastFailed] = useState(false);
  const messagesRef = useRef<DisasterChatMessage[]>([]);
  messagesRef.current = messages;

  const localProvider = (): ChatLocalProvider => {
    // Phase 10 · default local inference runs on a Web Worker so token
    // generation never blocks the UI; it degrades to the main-thread
    // WebLLMProvider when Workers are unavailable.
    if (!localProviderRef.current) localProviderRef.current = new WorkerLLMProvider();
    return localProviderRef.current;
  };

  // Load prior session turns from IndexedDB on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!persist || typeof indexedDB === "undefined") return;
      try {
        const db = getOfflineDb();
        const rows = await db.chatHistory.where("sessionId").equals(sessionId).toArray();
        const restored: DisasterChatMessage[] = rows
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          .map((r) => ({
            id: r.id,
            role: (r.role === "user" || r.role === "assistant" ? r.role : "assistant") as
              "user" | "assistant",
            content: r.content,
            timestamp: new Date(r.timestamp).getTime(),
            source: (r as unknown as { source?: BridgeMode }).source,
          }));
        if (!cancelled && restored.length) setMessages(restored);
      } catch {
        // IndexedDB unavailable — chat still works for the session.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, persist]);

  // Persist every new turn to IndexedDB.
  useEffect(() => {
    if (!persist || typeof indexedDB === "undefined" || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest.streaming) return;
    void (async () => {
      try {
        const db = getOfflineDb();
        await db.chatHistory.put({
          id: latest.id,
          sessionId,
          role: latest.role === "error" ? "assistant" : latest.role,
          content: latest.content,
          timestamp: new Date(latest.timestamp).toISOString(),
          district,
        } as never);
      } catch {
        // ignore persistence failures — session memory is enough
      }
    })();
  }, [messages, persist, sessionId, district]);

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: DisasterChatMessage = {
        id: makeId("user"),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      const history: ChatMessage[] = messagesRef.current
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-20)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setLastFailed(false);

      const context = { currentDistrict: district, history };

      try {
        const response = await bridge.route(trimmed, context);
        const mode: ChatAIMode =
          response.error || response.mode === "error"
            ? "fallback"
            : response.mode === "local"
              ? "local"
              : "cloud";
        setAiMode(mode);
        setLastFailed(response.error === true);

        const aiMsg: DisasterChatMessage = {
          id: makeId("assistant"),
          role: "assistant",
          content: response.text,
          timestamp: Date.now(),
          source: response.mode,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch {
        setAiMode("fallback");
        setLastFailed(true);
        setMessages((prev) => [
          ...prev,
          {
            id: makeId("error"),
            role: "error",
            content:
              "Unable to process. Please check your connection or ensure the local AI is downloaded.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [bridge, district, isLoading],
  );

  /**
   * Phase 6 · streaming send: appends the user turn, then streams the local
   * model's reply token-by-token (falls back to cloud for the whole block).
   */
  const sendMessageStreaming = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: DisasterChatMessage = {
        id: makeId("user"),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setLastFailed(false);

      const streamingMsg: DisasterChatMessage = {
        id: makeId("assistant"),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        source: "local",
        streaming: true,
      };
      setMessages((prev) => [...prev, streamingMsg]);
      setAiMode("local");

      try {
        let full = "";
        const provider = localProvider();
        for await (const chunk of provider.streamResponse(trimmed, {
          currentDistrict: district,
          history: messagesRef.current
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-20)
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        })) {
          if (chunk.mode === "error") {
            setAiMode("fallback");
            setLastFailed(true);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMsg.id
                  ? {
                      ...m,
                      content: chunk.text || "Local model unavailable.",
                      streaming: false,
                    }
                  : m,
              ),
            );
            setIsLoading(false);
            return;
          }
          if (chunk.done) break;
          full += chunk.text;
          setMessages((prev) =>
            prev.map((m) => (m.id === streamingMsg.id ? { ...m, content: full } : m)),
          );
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === streamingMsg.id ? { ...m, streaming: false } : m)),
        );
      } catch {
        setAiMode("fallback");
        setLastFailed(true);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMsg.id
              ? { ...m, streaming: false, content: "Local model stream failed." }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [district, isLoading],
  );

  /** Retries the last assistant/error turn (e.g. after the link returns). */
  const retry = useCallback(() => {
    setMessages((prev) => {
      const lastUser = [...prev].reverse().find((m) => m.role === "user");
      if (lastUser) void sendMessage(lastUser.content);
      return prev;
    });
  }, [sendMessage]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    if (persist && typeof indexedDB !== "undefined") {
      try {
        const db = getOfflineDb();
        await db.chatHistory.where("sessionId").equals(sessionId).delete();
      } catch {
        // ignore
      }
    }
  }, [persist, sessionId]);

  return {
    messages,
    isLoading,
    aiMode,
    lastFailed,
    sendMessage,
    sendMessageStreaming,
    retry,
    clearChat,
  };
}

export default useDisasterChat;
