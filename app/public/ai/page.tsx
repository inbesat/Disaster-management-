import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import BottomNav from "@/components/public/BottomNav";
import HouseholdPlanner from "@/components/public/HouseholdPlanner";

// ---------------------------------------------------------------------
// app/public/ai/page.tsx — Phase 2 · Step 9 · AI Safety Assistant,
// powered by the Phase 5/6 dual-mode chat (cloud ↔ offline Gemma).
//
// The AITeaser pills on /public/dashboard deep-link here with ?q=<prompt>.
// The picked-up prompt surfaces as a hint chip above the composer.
// ---------------------------------------------------------------------

export default function PublicAiPage({
  searchParams,
}: {
  searchParams: { q?: string; district?: string };
}) {
  const prompt = typeof searchParams.q === "string" ? searchParams.q : null;

  return (
    <main className="relative flex min-h-screen flex-col bg-[var(--dl-navy)] pb-[100px] text-[var(--dl-text-on-navy)]">
      {/* Ambient backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_80%_-10%,rgba(37,99,235,0.22),transparent),radial-gradient(ellipse_45%_40%_at_0%_110%,rgba(249,115,22,0.14),transparent)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-5">
        {/* Header */}
        <header className="flex items-center gap-3">
          <Link
            href="/public/dashboard"
            aria-label="Back to dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition hover:border-[var(--dl-orange)]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)]"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316]/20 ring-1 ring-[#F97316]/40">
              <Bot aria-hidden="true" className="h-4 w-4 text-[var(--brand-orangeLight)]" />
            </span>
            <div>
              <h1 className="text-sm font-bold text-white">AI Safety Assistant</h1>
              <p className="eoc-label text-[var(--dl-text-muted)]">
                PERSONAL PREPARATION & EVACUATION PLAN
              </p>
            </div>
          </div>
        </header>

        {prompt && (
          <p className="mt-4 rounded-[var(--dl-radius-sm)] border border-[#F97316]/40 bg-[#F97316]/10 px-4 py-2.5 text-sm font-semibold text-[var(--brand-orangeLight)]">
            You asked: &ldquo;{prompt}&rdquo;
          </p>
        )}

        <HouseholdPlanner initialQuestion={prompt ?? undefined} initialDistrict={searchParams.district} />
      </div>

      <BottomNav />
    </main>
  );
}
