"use client";

// Citizen chat. Emergency language opens the SOS form for explicit confirmation.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { AlertTriangle, ChevronDown, ChevronUp, MessageCircle, Navigation, Phone, Send, X } from "lucide-react";
import { triggerLightHaptic } from "@/hooks/useHaptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { showToast } from "@/components/ui/Toast";
import { useSOS } from "@/components/public/sos/SOSContext";
import { detectEmergency } from "@/lib/emergency-intent";
import { detectCenterIntent, nearestCenterOfType } from "@/lib/center-intent";
import { CENTER_TYPE_EMOJI, CENTER_TYPE_LABEL, type HelpCenter } from "@/lib/mock-data/help-centers";
import { googleMapsDirectionsUrl } from "@/lib/map/google-maps-directions";
import { estimateGoogleMapsEtaMinutes } from "@/lib/map/google-maps-directions";
import { readCitizenLocation } from "@/hooks/useSafetyStatus";
import { resolveCitizenMapView } from "@/lib/map/citizen-view";
import VoiceInput, { speechLocaleFor } from "./ai/VoiceInput";
import ShareRouteButton from "./ShareRouteButton";
import { resolveNovaReply } from "@/lib/nova/nova-reply";

/** Snap points as a fraction of the viewport height that stays visible. */
const SNAP_COLLAPSED = 0.6;
const SNAP_EXPANDED = 1.0;
/** Extra drag distance past 60% that counts as "dismiss". */
const CLOSED_MARGIN = 0.1;
/** How long the panel takes to fly off-screen before unmounting. */
const CLOSE_ANIM_MS = 420;


const spring = { type: "spring", stiffness: 320, damping: 34, mass: 0.9 } as const;
const none = { duration: 0 } as const;

const nowTime = () =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

const WELCOME =
  "Namaste! I'm Nova, your friendly safety companion. Ask me about shelters, safe routes or what to do in a flood — speak or type, whatever feels easier.";

/** Calming auto-reply when an emergency intent is detected. */
const EMERGENCY_REPLY =
  "I can help you send an SOS. Confirm the request in the emergency form that just opened. Nothing has been sent yet; call emergency services if you are in immediate danger.";

type ChatEntry = {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  /** Step 8 — when set, renders a center-recommendation card instead of text. */
  center?: HelpCenter;
};

export function NovaChat() {
  const { t, language } = useTranslation();
  const reduceMotion = useReducedMotion();
  // The map page has its own right-edge stack (Locate-Me + Report FAB);
  // Nova's FAB would sit exactly on top of Locate-Me, so it yields there.
  const pathname = usePathname();
  const showFab = !pathname?.startsWith("/public/map");
  // Global SOS controls — Nova sits under the public layout's SOSProvider,
  // so it can activate Emergency Mode + location sharing programmatically.
  const { open: openSOS } = useSOS();

  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<"collapsed" | "expanded">("collapsed");
  const [vh, setVh] = useState(0);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  // Emergency Mode (Step 2) — red-tinted sheet + larger text while active.
  const [emergencyActive, setEmergencyActive] = useState(false);
  // Guards the SOS side-effects so repeated emergency messages in one open
  // session fire the toast / banner / location share exactly once.
  // Typewriter intervals — cleared on unmount so reveals never tick on.
  const streamTimersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      streamTimersRef.current.forEach((timer) => window.clearInterval(timer));
    },
    [],
  );

  const fabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const dragControls = useDragControls();

  const snapToPx = useCallback(
    (fraction: number) => {
      if (vh > 0) return vh * (1 - fraction);
      if (typeof window === "undefined") return 0;
      return window.innerHeight * (1 - fraction);
    },
    [vh],
  );
  const closedPx = useCallback(
    () =>
      snapToPx(SNAP_COLLAPSED) +
      (typeof window === "undefined" ? 0 : window.innerHeight) * CLOSED_MARGIN,
    [snapToPx],
  );
  const settle = useCallback(
    (px: number) => animate(y, px, reduceMotion ? none : spring),
    [y, reduceMotion],
  );

  // Seed the friendly welcome on first mount.
  useEffect(() => {
    setMessages([
      { id: "welcome", role: "ai", content: WELCOME, timestamp: nowTime() },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the live viewport height while open (resize / rotation).
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const measure = () => setVh(window.innerHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  // Esc closes; focus returns to the FAB after unmount.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll new bubbles + typing dots into view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const openSheet = () => {
    triggerLightHaptic();
    setOpen(true);
    setSnap("collapsed");
    settle(snapToPx(SNAP_COLLAPSED));
  };

  const close = () => {
    settle(closedPx());
    window.setTimeout(() => {
      setOpen(false);
      fabRef.current?.focus();
    }, CLOSE_ANIM_MS);
  };

  useEffect(() => {
    if (open) {
      const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 320);
      return () => window.clearTimeout(focusTimer);
    }
  }, [open]);

  const toggleSnap = () => {
    triggerLightHaptic();
    const next = snap === "collapsed" ? "expanded" : "collapsed";
    setSnap(next);
    settle(snapToPx(next === "expanded" ? SNAP_EXPANDED : SNAP_COLLAPSED));
  };

  const handleDragEnd = () => {
    const current = y.get();
    if (current > snapToPx(SNAP_COLLAPSED) + vh * CLOSED_MARGIN) {
      close();
      return;
    }
    const expandedPx = snapToPx(SNAP_EXPANDED);
    const collapsedPx = snapToPx(SNAP_COLLAPSED);
    const next = Math.abs(current - expandedPx) < Math.abs(current - collapsedPx)
      ? "expanded"
      : "collapsed";
    setSnap(next);
    settle(snapToPx(next === "expanded" ? SNAP_EXPANDED : SNAP_COLLAPSED));
  };

  /** Open the SOS form when emergency language is detected. */
  const handleEmergency = (text: string) => {
    triggerLightHaptic();
    setEmergencyActive(true);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: text, timestamp: nowTime() },
      { id: `a-${Date.now()}`, role: "ai", content: EMERGENCY_REPLY, timestamp: nowTime() },
    ]);
    setDraft("");

    openSOS();
    showToast("warning", {
      title: "Confirm your SOS",
      description: "The request has not been sent yet. Call emergency services if in immediate danger.",
    });
  };

  /**
   * Step 8 — Center recommender. Called when a center intent (hospital /
   * police / ndrf / fire) is detected. Pins the user's words and replies
   * with a UI card (not text) showing the nearest matching center from the
   * Step 4 directory.
   */
  const handleCenterIntent = (text: string, center: HelpCenter) => {
    triggerLightHaptic();
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: text, timestamp: nowTime() },
      {
        id: `c-${Date.now()}`,
        role: "ai",
        content: `Here's the nearest ${CENTER_TYPE_LABEL[center.type].toLowerCase()} for you.`,
        timestamp: nowTime(),
        center,
      },
    ]);
    setDraft("");
  };

  const sendPrompt = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    // Step 2 — intercept BEFORE the reply path. An emergency intent never
    // reaches the normal LLM: Nova acts instead of chatting.
    if (detectEmergency(trimmed)) {
      handleEmergency(trimmed);
      return;
    }
    // Step 8 — a center lookup ("nearest hospital" / "I need police") gets a
    // UI card from the directory instead of a text answer.
    const centerType = detectCenterIntent(trimmed);
    if (centerType) {
      const center = nearestCenterOfType(centerType);
      if (center) {
        handleCenterIntent(trimmed, center);
        return;
      }
    }
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: trimmed, timestamp: nowTime() },
    ]);
    setDraft("");
    setTyping(true);

    // Build history for context (last 6 messages)
    const history = messages
      .slice(-6)
      .map((m) => ({ role: m.role as "user" | "ai", content: m.content }));

    // Resolve reply via cloud-first chain: /api/chat → 61-rule fallback → static
    // Reveals the answer chunk-by-chunk (typewriter) so Nova feels like it's
    // streaming, while the network layer stays one simple request.
    const streamReveal = (full: string) => {
      setTyping(false);
      const id = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id, role: "ai", content: "", timestamp: nowTime() },
      ]);
      let i = 0;
      const step = Math.max(2, Math.round(full.length / 140)); // ~140 ticks max
      const timer = window.setInterval(() => {
        i = Math.min(full.length, i + step);
        const slice = full.slice(0, i);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: slice } : m)),
        );
        if (i >= full.length) {
          window.clearInterval(timer);
        }
      }, 16);
      streamTimersRef.current.push(timer);
      if (!full) window.clearInterval(timer);
    };

    resolveNovaReply(trimmed, history, undefined)
      .then((result) => {
        streamReveal(result.source === "static" ? "AI is unavailable. Please retry shortly." : result.text);
      })
      .catch(() => {
        streamReveal("AI is unavailable. Please retry shortly.");
      });
  };

  const handleSend = () => sendPrompt(draft);

  // Step 2 — voice is the emergency channel: a spoken "help, I'm trapped"
  // must ACT immediately, no send-button required. Otherwise the transcript
  // drops into the composer as usual.
  const handleVoiceResult = (text: string) => {
    if (detectEmergency(text)) {
      handleEmergency(text);
      return;
    }
    setDraft(text);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const voiceLang = speechLocaleFor(language);
  const constraintBottom = vh > 0 ? closedPx() : snapToPx(SNAP_COLLAPSED) + 1;

  const Avatar = ({ size = "h-10 w-10", text = "text-lg" }: { size?: string; text?: string }) => (
    <span
      aria-hidden
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] ring-2 ring-[#c4b5fd]/30 shadow-[0_2px_14px_rgba(139,92,246,0.45)] ${size}`}
    >
      <span className={text} role="img" aria-label="Nova's friendly face">
        😊
      </span>
      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-severity-green-400 ring-2 ring-[#1e1b4b]" />
    </span>
  );

  return (
    <>
      {/* Floating 56px chat bubble — bottom-right, clear of the mobile nav
          and the desktop EmergencyContactCard (bottom-4 right-4) by lifting
          to bottom-24 on md+. */}
      <AnimatePresence>
        {!open && showFab && (
          <motion.button
            ref={fabRef}
            type="button"
            onClick={openSheet}
            aria-label="Open Nova"
            initial={{ opacity: 0, scale: 0.7, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.92 }}
            className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-4 z-[50] flex h-14 w-14 items-center justify-center rounded-full bg-[#8b5cf6] bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] text-white shadow-[0_10px_28px_rgba(139,92,246,0.5)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]"
            >
            {/* Continuous pulse ring to draw attention */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full animate-ping bg-[#8b5cf6]/30"
              style={{ animationDuration: "2s" }}
            />
            <MessageCircle className="h-7 w-7" strokeWidth={2} aria-hidden />
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#c4b5fd] ring-2 ring-[#7c3aed]/60"
            />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="nova-backdrop"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              className="fixed inset-0 z-[55] bg-black/50"
            />

            <motion.section
              key="nova-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Nova safety assistant"
              style={{ y, touchAction: "pan-y", willChange: "transform" }}
              transition={spring}
              drag="y"
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: constraintBottom }}
              dragElastic={{ top: 0.1, bottom: 0.05 }}
              dragMomentum={false}
              onDragEnd={handleDragEnd}
              className={`fixed inset-x-0 bottom-0 z-[60] flex h-screen flex-col overflow-hidden rounded-t-3xl border-t border-x shadow-[0_-16px_60px_rgba(0,0,0,0.55)] supports-[height:100dvh]:h-[100dvh] ${
                emergencyActive
                  ? "border-red-500/40 bg-[linear-gradient(180deg,#5f0f0f_0%,#1a0707_100%)]"
                  : "border-white/10 bg-[linear-gradient(180deg,#2e1065_0%,#140b33_100%)]"
              }`}
            >
              {/* Drag handle strip — the grab surface for the sheet. */}
              <div
                aria-hidden
                onPointerDown={(e) => dragControls.start(e)}
                className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-3 pb-1 active:cursor-grabbing"
              >
                <span className="h-1.5 w-12 rounded-full bg-white/25" />
              </div>

              {/* Header — friendly avatar, name, status, expand + close. */}
              <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-1">
                <Avatar />

                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold leading-tight text-white">Nova</p>
                  <p className="truncate text-xs text-[#c4b5fd]">
                    {t("nova_online")} · {t("nova_status")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleSnap}
                  aria-label={snap === "collapsed" ? "Expand chat" : "Collapse chat"}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {snap === "collapsed" ? (
                    <ChevronUp className="h-5 w-5" aria-hidden />
                  ) : (
                    <ChevronDown className="h-5 w-5" aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close Nova"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              {/* Step 2 — Emergency Mode strip: red banner pinned under the
                  header while an emergency intent is active. */}
              <AnimatePresence>
                {emergencyActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div
                      role="alert"
                      className="flex shrink-0 items-center gap-2.5 border-y-2 border-red-400/50 bg-[#b91c1c]/30 px-4 py-2.5"
                    >
                      <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse text-red-300" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-sm font-black uppercase tracking-widest text-red-200">
                          Emergency Mode
                        </p>
                        <p className="truncate text-xs text-red-200/90">
                          Control room notified · GPS sharing · status: trapped
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4"
              >
                {messages.map((m) =>
                  m.role === "ai" ? (
                    <div key={m.id} className="flex w-full items-end gap-2">
                      <Avatar size="h-8 w-8" text="text-base" />
                      <div className="flex max-w-[82%] flex-col items-start">
                        {m.center ? (
                          <CenterRecommendCard
                            center={m.center}
                            text={m.content}
                            emergencyActive={emergencyActive}
                          />
                        ) : (
                          <div
                            className={`rounded-2xl rounded-bl-chat bg-[#ede9fe] px-3.5 py-2.5 leading-relaxed text-[#2e1065] shadow-[var(--shadow-float-sm)] ${
                              emergencyActive ? "text-lg" : "text-[0.9375rem]"
                            }`}
                          >
                            {m.content}
                          </div>
                        )}
                        <span className="mt-1 px-1 text-[0.625rem] tabular-nums text-[#a78bfa]">
                          {m.timestamp}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex w-full items-end justify-end">
                      <div className="flex max-w-[82%] flex-col items-end">
                        <div
                          className={`rounded-2xl rounded-br-chat bg-[#ddd6fe] px-3.5 py-2.5 leading-relaxed text-[#1e1b4b] shadow-[var(--shadow-float-sm)] ${
                            emergencyActive ? "text-lg" : "text-[0.9375rem]"
                          }`}
                        >
                          {m.content}
                        </div>
                        <span className="mt-1 px-1 text-[0.625rem] tabular-nums text-[#a78bfa]">
                          {m.timestamp}
                        </span>
                      </div>
                    </div>
                  ),
                )}

                {/* Calm typing dots while the mock is "thinking". */}
                <AnimatePresence>
                  {typing && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="flex items-end gap-2"
                    >
                      <Avatar size="h-8 w-8" text="text-base" />
                      <span className="flex items-center gap-1.5 rounded-2xl rounded-bl-chat bg-[#ede9fe]/90 px-4 py-3 shadow-[var(--shadow-float-sm)]">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-2 w-2 animate-bounce rounded-full bg-[#4c1d95]/50"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Voice-first composer — the mic leads the row and is the
                  largest control; the text field is secondary. `relative`
                  anchors VoiceInput's floating listening strip. */}
              <div className="relative shrink-0 border-t border-white/10 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
                <div className="flex items-end gap-2">
                  <VoiceInput
                    onResult={handleVoiceResult}
                    lang={voiceLang}
                    tone="violet"
                    disabled={typing}
                  />
                  <div className="flex min-h-[48px] flex-1 items-center rounded-2xl border border-white/15 bg-white/5 px-4 focus-within:border-[#c4b5fd]/60 focus-within:ring-1 focus-within:ring-[#c4b5fd]/30">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleComposerKey}
                      placeholder="Ask Nova — try “Where is the nearest shelter?”"
                      aria-label="Message Nova"
                      className="max-h-[108px] min-h-[32px] flex-1 resize-none bg-transparent py-2 text-[0.9375rem] text-white outline-none placeholder:text-[#8b7fbf]"
                    />
                  </div>
                  <motion.button
                    type="button"
                    onClick={handleSend}
                    disabled={!draft.trim() || typing}
                    aria-label="Send message"
                    whileTap={{ scale: 0.92 }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white shadow-[0_6px_18px_rgba(139,92,246,0.35)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Send className="h-5 w-5" aria-hidden />
                  </motion.button>
                </div>
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Step 8 — the AI-recommended center card rendered inside a chat bubble.
 * Shows the center (emoji, name, distance, hours) plus three actions:
 * Navigate Here (Google Maps deep link, Step 6), Call Now (tel:), and
 * Share Location (WhatsApp wa.me, Step 7).
 */
function CenterRecommendCard({
  center,
  text,
  emergencyActive,
}: {
  center: HelpCenter;
  text: string;
  emergencyActive: boolean;
}) {
  const view = resolveCitizenMapView(readCitizenLocation());
  const origin = view.center;
  const mapsUrl = googleMapsDirectionsUrl(
    origin.lat,
    origin.lng,
    center.lat,
    center.lng,
  );
  const etaMinutes = estimateGoogleMapsEtaMinutes(
    origin.lat,
    origin.lng,
    center.lat,
    center.lng,
  );
  const overloaded = center.status === "overloaded";

  return (
    <div
      className={`w-full rounded-2xl rounded-bl-chat border border-[#c4b5fd]/30 bg-[#f3f0ff] p-3 shadow-[var(--shadow-float-sm)] ${
        emergencyActive ? "text-lg" : "text-[0.9375rem]"
      }`}
    >
      <p className="text-sm font-semibold text-[#2e1065]">{text}</p>

      {/* Center identity */}
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ede9fe] text-xl ring-1 ring-[#c4b5fd]/50">
          {CENTER_TYPE_EMOJI[center.type]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#1e1b4b]">{center.name}</p>
          <p className="text-[0.6875rem] font-semibold text-[#6d28d9]/80">
            {CENTER_TYPE_LABEL[center.type]} · {center.distanceKm.toFixed(1)} km ·{" "}
            {center.hours}
          </p>
        </div>
        <span
          className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide ring-1 ${
            overloaded
              ? "bg-red-100 text-red-600 ring-red-300"
              : "bg-emerald-100 text-emerald-700 ring-emerald-300"
          }`}
        >
          {overloaded ? "Overloaded" : "Open"}
        </span>
      </div>

      {/* Three actions — Navigate (Step 6) · Call · Share Location (Step 7) */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 rounded-xl bg-[#4f46e5] px-2 py-2 text-[0.6875rem] font-bold text-white transition hover:bg-[#4338ca] active:scale-95"
        >
          <Navigation aria-hidden="true" className="h-4 w-4" />
          Navigate Here
        </a>
        <a
          href={`tel:${center.phone}`}
          className="flex flex-col items-center gap-1 rounded-xl bg-emerald-600 px-2 py-2 text-[0.6875rem] font-bold text-white transition hover:bg-emerald-500 active:scale-95"
        >
          <Phone aria-hidden="true" className="h-4 w-4" />
          Call Now
        </a>
        <ShareRouteButton
          originLabel="My Location"
          destination={center.name}
          distanceKm={center.distanceKm}
          etaMinutes={etaMinutes}
          mapsUrl={mapsUrl}
          className="flex-col gap-1 !px-2 !py-2 !text-[0.6875rem]"
        />
      </div>
    </div>
  );
}

export default NovaChat;