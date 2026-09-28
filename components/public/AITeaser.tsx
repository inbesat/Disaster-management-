// ---------------------------------------------------------------------
// components/public/AITeaser.tsx — Phase 2 · Step 9 · AI Safety Assistant
// Teaser.
//
// A distinct, rounded card at the very bottom of the dashboard that
// guides the citizen toward the AI agent without overwhelming them. The
// two "suggested prompt" pills deep-link to the placeholder /public/ai
// route carrying the exact prompt as a ?q= query param, so the future
// chat page can prefill the composer with zero changes here.
//
// Server-safe pure component (plain <Link>s, no state/hooks) — renders
// with the page and never flashes.
// ---------------------------------------------------------------------

import Link from "next/link";
import { ArrowRight, Bot, Sparkles } from "lucide-react";

// Single edit point — pill copy ↔ ?q= prefill stay in sync.
const PROMPTS = [
  { text: "Build my complete safety plan", q: "Create my complete household flood preparedness and evacuation plan." },
  { text: "What should I pack?", q: "What should I pack?" },
  { text: "Is my route safe?", q: "Is my route safe?" },
];

export function AITeaser() {
  return (
    <section
      aria-label="AI safety assistant"
      className="relative overflow-hidden rounded-2xl border border-[#F97316]/40 bg-gradient-to-br from-[#F97316]/15 via-white/[0.04] to-white/[0.02] p-5"
    >
      {/* Soft orange glow in the corner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#F97316]/20 blur-2xl"
      />

      <div className="relative flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F97316]/20 ring-1 ring-[#F97316]/40">
          <Bot aria-hidden="true" className="h-5 w-5 text-[var(--brand-orangeLight)]" />
        </span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-base font-bold text-white">
            Need help preparing?
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F97316]/20 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-[var(--brand-orangeLight)]">
              <Sparkles aria-hidden="true" className="h-3 w-3" />
              AI
            </span>
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--dl-text-muted)]">
            Create a household plan using the local outlook: what to do now,
            packing, shelter options, route checks and family needs.
          </p>
        </div>
      </div>

      {/* Suggested prompt pills */}
      <div className="relative mt-4 flex flex-wrap gap-2">
        {PROMPTS.map((prompt) => (
          <Link
            key={prompt.text}
            href={`/public/ai?q=${encodeURIComponent(prompt.q)}`}
            className="group inline-flex items-center gap-1.5 rounded-full border border-[#F97316]/40 bg-[#F97316]/10 px-3.5 py-2 text-[0.8125rem] font-semibold text-[var(--brand-orangeLight)] transition hover:border-[var(--brand-orange)] hover:bg-[#F97316]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)]"
          >
            {prompt.text}
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default AITeaser;
