import PublicBackButton from "@/components/public/PublicBackButton";
import NearbySheltersList from "@/components/public/NearbySheltersList";
import CenterDirectory from "@/components/public/CenterDirectory";
import Link from "next/link";
import { Map, Home } from "lucide-react";

export default function PublicSheltersPage() {
  return (
    <div className="relative w-full min-h-screen flex flex-col bg-[var(--dl-navy)] text-[var(--dl-text-on-navy)]">
      {/* Ambient backdrop matching dashboard */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_80%_-10%,rgba(37,99,235,0.22),transparent),radial-gradient(ellipse_45%_40%_at_0%_110%,rgba(249,115,22,0.14),transparent)]"
      />

      <main className="relative flex-1">
        <PublicBackButton className="sm:left-4 sm:top-3 top-3 left-3 bg-black/20" />

        {/* Hero header */}
        <header className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">
          <div className="eoc-panel rounded-[var(--dl-radius-lg)] border border-white/10 bg-white/[0.04] p-6 md:p-8 backdrop-blur">
            <div className="flex items-start gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--dl-blue)]/20 ring-1 ring-[var(--dl-blue)]/40">
                <Home className="h-8 w-8 text-[var(--dl-blue-light)]" aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Illustrative Shelters & Help Centers
                </h1>
                <p className="mt-2 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
                  These listings are sample data. Distances, occupancy, operating status and contact details are unverified. Check official local sources before travelling or calling.
                </p>
              </div>
            </div>
          </div>

          {/* Primary CTA to map */}
          <div className="mt-6">
            <Link
              href="/public/map"
              className="inline-flex items-center gap-2 rounded-[var(--dl-radius-lg)] border-2 border-[var(--dl-orange)] bg-[var(--dl-orange)]/10 px-6 py-4 text-base font-semibold text-[var(--dl-orange)] transition hover:bg-[var(--dl-orange)]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)]"
            >
              <Map className="h-5 w-5" aria-hidden />
              Open Illustrative Map
            </Link>
          </div>
        </header>

        {/* Content sections */}
        <div className="mx-auto max-w-4xl px-4 pb-16 md:px-6">
          <NearbySheltersList />
          <CenterDirectory />
        </div>
      </main>
    </div>
  );
}