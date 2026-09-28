"use client";

// ---------------------------------------------------------------------
// components/ui/VoiceInputButton.tsx — UI/UX Phase 9 · Step 6.
//
// Rain-proof field reporting: a circular microphone button that speaks the
// standard Web Speech API (SpeechRecognition / webkitSpeechRecognition) to
// turn a verbal field update straight into text. Designed to mount anywhere
// a text input lives (alert reports, resource requests, AI plan prompts):
//
//   1. Tap the mic → recognition starts; a floating overlay pops open with
//      three animated "soundwave" bars + "Listening…".
//   2. Interim results stream into the live transcript line.
//   3. Tap again (or the engine auto-ends) → the finalized text is returned
//      via the onTranscription prop and the overlay closes.
//
// Notes:
//   • The Web Speech API types are not shipped by TypeScript, so the window
//     surface (SRWindow) and instance shape (SRInstance) are declared here —
//     matching the project's existing VoiceNoteReporter pattern.
//   • Unsupported browsers explain that typed input is required.
//   • The whole control is `use client` and never touches SSR.
// -------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, X } from "lucide-react";
import { triggerLightHaptic } from "@/hooks/useHaptics";
import { showToast } from "@/components/ui/Toast";

/* ---------------------------------------------------------------------
   Minimal Web Speech API typings (kept in sync with VoiceNoteReporter).
   --------------------------------------------------------------------- */
type SRWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: new () => SRInstance;
    webkitSpeechRecognition?: new () => SRInstance;
  };

type SRInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: SRResultEvent) => void;
  onend: (() => void) | null;
  onerror: (e: { error?: string }) => void;
  start: () => void;
  stop: () => void;
};

type SRResultEvent = {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { isFinal: boolean; [j: number]: { transcript: string } };
  };
};

type VoiceInputButtonProps = {
  /** Final transcript delivered when the user stops dictating. */
  onTranscription: (text: string) => void;
  /** Accessible label for the button. */
  label?: string;
  /** Speech locale. Defaults to Indian English. */
  lang?: string;
  /** Disable the button (e.g. while a parent is submitting). */
  disabled?: boolean;
};

export function VoiceInputButton({
  onTranscription,
  label = "Dictate response with voice",
  lang = "en-IN",
  disabled = false,
}: VoiceInputButtonProps) {
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [final, setFinal] = useState("");
  const recRef = useRef<SRInstance | null>(null);
  // Refs mirror the transcript so the recognition callbacks (bound once)
  // always read the freshest accumulated text without stale closures.
  const finalRef = useRef("");
  const interimRef = useRef("");
  // Prevents double-delivery when both stop() AND the engine's onend fire.
  const deliveredRef = useRef(false);

  const supported =
    typeof window !== "undefined" &&
    Boolean(
      (window as SRWindow).SpeechRecognition ||
      (window as SRWindow).webkitSpeechRecognition,
    );

  const deliver = useCallback(
    (text: string) => {
      if (deliveredRef.current) return;
      deliveredRef.current = true;
      const trimmed = text.trim();
      if (trimmed) onTranscription(trimmed);
      setRecording(false);
      setInterim("");
      setFinal("");
      finalRef.current = "";
      interimRef.current = "";
    },
    [onTranscription],
  );

  const stopAndDeliver = useCallback(() => {
    recRef.current?.stop();
    deliver(
      `${finalRef.current}${finalRef.current && interimRef.current ? " " : ""}${interimRef.current}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliver]);

  const makeRecognition = useCallback((): SRInstance | null => {
    const w = window as SRWindow;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e) => {
      let live = "";
      let done = finalRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          done = done ? `${done} ${res[0].transcript}` : res[0].transcript;
        } else {
          live += res[0].transcript;
        }
      }
      finalRef.current = done;
      interimRef.current = live;
      setFinal(done);
      setInterim(live);
    };
    rec.onerror = () => {
      deliver("");
      showToast("error", {
        title: "Voice input unavailable",
        description: "Check microphone permission or type your message.",
      });
    };
    rec.onend = () => {
      // continuous=true ⇒ fires on stop() — ship whatever we captured.
      deliver(`${finalRef.current} ${interimRef.current}`);
    };
    return rec;
  }, [lang, deliver]);

  const startSpeaking = () => {
    if (disabled) return;
    deliveredRef.current = false;
    setInterim("");
    setFinal("");
    finalRef.current = "";
    interimRef.current = "";
    if (!supported) {
      showToast("info", {
        title: "Voice input is not supported here",
        description: "Use a browser with speech recognition, or type your message.",
      });
      return;
    }
    const rec = makeRecognition();
    if (!rec) {
      return;
    }
    recRef.current = rec;
    setRecording(true);
    triggerLightHaptic();
    try {
      rec.start();
    } catch {
      setRecording(false);
      showToast("error", {
        title: "Microphone could not start",
        description: "Allow microphone access and retry.",
      });
    }
  };

  const stopSpeaking = () => {
    if (!recording) return;
    triggerLightHaptic();
    stopAndDeliver();
  };

  useEffect(() => {
    return () => {
      deliveredRef.current = true;
      if (recRef.current) recRef.current.onend = null;
      recRef.current?.stop();
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={recording ? stopSpeaking : startSpeaking}
        disabled={disabled}
        aria-label={recording ? "Stop dictation" : label}
        aria-pressed={recording}
        title={recording ? "Stop dictation" : label}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1a] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
          recording
            ? "border-severity-red-500 bg-red-500/25 text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.4)]"
            : "border-white/10 bg-white/5 text-slate-300 hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
        }`}
      >
        {recording ? (
          <MicOff className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        ) : (
          <Mic className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        )}
      </button>

      {/* Listening overlay — soundwave bars + "Listening…", closeable. */}
      <AnimatePresence>
        {recording && (
          <motion.div
            key="voice-overlay"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom)+1rem)] z-50 mx-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-white/10 bg-[rgb(var(--bg-secondary-rgb)/95)] p-4 shadow-2xl shadow-black/50 backdrop-blur-lg"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Waveform />
                <span className="text-sm font-semibold text-white">Listening…</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  deliveredRef.current = true;
                  recRef.current?.stop();
                  setRecording(false);
                }}
                aria-label="Cancel dictation"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p
              className="mt-2 min-h-[1.25em] truncate text-sm text-slate-300"
              aria-live="polite"
            >
              {interim || final || "Speak now — your words will appear here…"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------------------------------------------------------------------
   Soundwave — three vertical bars animating a random-feeling height cycle.
   Pure CSS keyframes (no re-renders while listening); the heights drift
   with per-bar durations so they never move in lockstep.
   --------------------------------------------------------------------- */
function Waveform() {
  return (
    <span className="flex h-8 items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="wave-bar bg-red-400"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
      <style>{`
        @keyframes waveUp {
          0%, 100% { height: 6px }
          25% { height: 26px }
          50% { height: 12px }
          75% { height: 22px }
        }
        .wave-bar {
          width: 4px;
          height: 6px;
          animation: waveUp 0.9s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
}

export default VoiceInputButton;
