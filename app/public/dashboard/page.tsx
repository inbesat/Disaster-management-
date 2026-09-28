import Link from "next/link";
import { cookies } from "next/headers";
import { switchDemoPortal } from "@/app/actions/auth";
import { ArrowRight, Bell, HeartHandshake, MapPin, Siren } from "lucide-react";
import AITeaser from "@/components/public/AITeaser";
import BandwidthGate from "@/components/public/BandwidthGate";
import BatterySaverBanner from "@/components/public/BatterySaverBanner";
import BottomNav from "@/components/public/BottomNav";
import CenterDirectory from "@/components/public/CenterDirectory";
import EmergencyDial from "@/components/public/EmergencyDial";
import EvacuationLifelines from "@/components/public/lifelines/EvacuationLifelines";
import FamilyStrip from "@/components/public/FamilyStrip";
import NearbySheltersList from "@/components/public/NearbySheltersList";
import OfflineRouteCacheSync from "@/components/public/OfflineRouteCacheSync";
import PublicOfflineBanner from "@/components/public/PublicOfflineBanner";
import PullToRefresh from "@/components/public/PullToRefresh";
import PublicTransparencyPanel from "@/components/public/PublicTransparencyPanel";
import PublicContentColumn from "@/components/public/transparency/PublicContentColumn";
import PublicNavbar from "@/components/public/PublicNavbar";
import SafetyOverview from "@/components/public/SafetyOverview";
import SafetyTipsFeed from "@/components/public/ai/SafetyTipsFeed";
import NearestHelpCard from "@/components/public/sos/NearestHelpCard";
import Translated from "@/components/ui/Translated";
import type { TranslationKey } from "@/lib/i18n/LanguageContext";

// ---------------------------------------------------------------------
// app/public/dashboard/page.tsx — Phase 2 · Step 1 · Mobile-first
// "My Safety Status" dashboard shell (Steps 1–10 landed).
//
// Fully responsive: fills 100% of a phone screen, then expands to the full
// monitor on desktop. The content column rides a max-w-7xl container
// (px-4 / md:py-10) so it stays readable wide; the citizen BottomNav
// (Home/Alerts/Map/SOS) spans the full width on mobile and is hidden on
// md+ where navigation happens via the module grid + header links. The
// column content is wrapped in PullToRefresh (Step 10) — drag down from
// the top past 80px to re-run the mock status refresh (1.5s spinner +
// haptic + "Last updated" stamp). Stack: SafetyOverview (Steps 2–5:
// geo-fence status hero, contextual action, 3-day forecast) → FamilyStrip
// (Step 6) → NearbySheltersList (Step 7) → EmergencyDial (Step 8, tel:
// speed-dial — replaces the old standalone Call-1070 strip) → module grid
// → AITeaser (Step 9, pills deep-link to /public/ai?q=…). Guest banner
// (Step 9 of Phase 1) persists while guest_mode=true; mobile bottom
// padding clears the fixed 72px nav + safe area so no content hides
// behind it.
// ---------------------------------------------------------------------

const MODULES = [
  {
    icon: Siren,
    titleKey: "module_sos_report" as const,
    descriptionKey: "module_sos_report_desc" as const,
    href: "/public/report",
    accent: "text-red-300",
    ring: "group-hover:ring-red-400/40",
  },
  {
    icon: Bell,
    titleKey: "module_live_alerts" as const,
    descriptionKey: "module_live_alerts_desc" as const,
    href: "/public/alerts",
    accent: "text-orange-300",
    ring: "group-hover:ring-orange-400/40",
  },
  {
    icon: MapPin,
    titleKey: "nearby_shelters" as const,
    descriptionKey: "nearby_shelters_desc" as const,
    href: "/public/shelters",
    accent: "text-blue-300",
    ring: "group-hover:ring-blue-400/40",
  },
  {
    icon: HeartHandshake,
    titleKey: "module_family_circle" as const,
    descriptionKey: "module_family_circle_desc" as const,
    href: "/public/family",
    accent: "text-emerald-300",
    ring: "group-hover:ring-emerald-400/40",
  },
] satisfies {
  icon: typeof Siren;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  href: string;
  accent: string;
  ring: string;
}[];

export default function PublicDashboardPage() {
  const demo = cookies().get("demo_mode")?.value === "true";
  return (
    <div className="relative w-full min-h-screen flex flex-col bg-primary">
    <main className="relative flex w-full flex-1 flex-col bg-[var(--dl-navy)] pb-[140px] px-4 md:px-8 text-[var(--dl-text-on-navy)]">
      {demo && <div className="mx-auto flex w-full max-w-7xl flex-wrap gap-3 pt-3 text-xs text-amber-200"><span>Isolated demo session</span><form action={switchDemoPortal.bind(null, "field")}><button className="underline">Field responder view</button></form><form action={switchDemoPortal.bind(null, "gov")}><button className="underline">Government view</button></form></div>}
      <div className="mx-auto flex w-full max-w-7xl justify-end pt-4"><Link href="/public/reports" className="rounded-lg border border-cyan-400/50 px-4 py-2 text-sm font-semibold text-cyan-200">My reports and verification status →</Link></div>
      {/* Ambient backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_80%_-10%,rgba(37,99,235,0.22),transparent),radial-gradient(ellipse_45%_40%_at_0%_110%,rgba(249,115,22,0.14),transparent)]"
      />

      {/* Guest mode banner (persistent while guest_mode=true) — mounted
          in app/public/layout.tsx. */}

      {/* Phase 1 · Step 10 — sticky amber strip while offline. */}
      <PublicOfflineBanner />

      {/* Responsive content column — max-w-7xl on desktop, full width on
          phones. Mobile bottom padding clears the fixed 72px BottomNav;
          md+ drops it (the nav is hidden there) for md:py-10. */}
      <PublicContentColumn>
        {/* Phase 13 · Step 8 — yellow battery-saver banner while the
            device is under 20% (client island; renders nothing otherwise).
            Auto-refresh timers pause while it's visible. */}
        <BatterySaverBanner />

        {/* Phase 1 · Step 10 — passive cache builder (renders nothing);
            keeps the offline route snapshot fresh whenever we're online. */}
        <OfflineRouteCacheSync />

        {/* Pull-to-refresh wraps the entire dashboard content (Step 10) */}
        <PullToRefresh>
        {/* Server navbar — identity-aware avatar dropdown (guest vs user) */}
        <PublicNavbar />

        {/* Safety stack — live status (mock geo-fence) → hero card →
            contextual action → 3-day forecast (Phase 2 · Steps 2–5) */}
        <section className="mt-8">
          <SafetyOverview />
        </section>

        {/* Lifelines — "Find Nearest Safe Shelter" (geolocation → map
            routing) + "WhatsApp Lifeline" (subscribe + wa.me SOS). Public
            citizen actions only, no admin broadcast controls. */}
        <section className="mt-8">
          <EvacuationLifelines />
        </section>

        {/* Phase 6 · Step 8 — Nova's rotating safety tips (one every
            5s, pauses on hover). Proactive advice between chats. Hidden in
            low-bandwidth mode (Phase 13 · Step 2). */}
        <section className="mt-8">
          <BandwidthGate>
            <SafetyTipsFeed />
          </BandwidthGate>
        </section>

        {/* Phase 5 · Step 6 — "Help Nearby" auto-finder. Client island:
            renders nothing unless an SOS is active, so it's safe here. */}
        <section className="mt-8">
          <NearestHelpCard />
        </section>

        {/* Family safety strip — avatars with status dots, tap to nudge
            (Phase 2 · Step 6) */}
        <section className="mt-8">
          <FamilyStrip />
        </section>

        {/* Nearby shelters quick-list — exactly 3, with walk time &
            occupancy (Phase 2 · Step 7) */}
        <section className="mt-8">
          <NearbySheltersList />
        </section>

        {/* Emergency speed-dial — 4 tel: squares, red control room
            (Phase 2 · Step 8; replaces the old Call-1070 strip) */}
        <section className="mt-8">
          <EmergencyDial />
        </section>

        {/* Phase 1 · Step 4 — Disaster Management Center Directory:
            filterable NDRF/Police/Hospital/Fire cards with one-tap call
            + an emoji mini-map. */}
        <section className="mt-8">
          <CenterDirectory />
        </section>

        {/* Module grid — stacks on phones, two-up on desktop */}
        <section className="mt-8 flex-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MODULES.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="group relative flex min-h-[80px] items-center gap-4 overflow-hidden rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/5 p-4 ring-1 ring-transparent backdrop-blur transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-blue)]"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10 transition group-hover:ring-2 ${module.ring}`}
                >
                  <module.icon aria-hidden="true" className={`h-5 w-5 ${module.accent}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-1.5 text-base font-bold text-white">
                    <Translated k={module.titleKey} />
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 text-[var(--dl-text-muted)] transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[var(--dl-orange-light)]"
                    />
                  </h2>
                  <p className="mt-0.5 text-sm leading-relaxed text-[var(--dl-text-muted)]">
                    <Translated k={module.descriptionKey} />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* AI Safety Assistant teaser — prompt pills deep-link to
            /public/ai?q=… (Phase 2 · Step 9). Hidden in low-bandwidth
            mode (Phase 13 · Step 2). */}
        <section className="mt-8">
          <BandwidthGate>
            <AITeaser />
          </BandwidthGate>
        </section>
        </PullToRefresh>
        </PublicContentColumn>

        {/* Citizen bottom nav — Home (active) · Alerts · Map · SOS. Full-width on
            mobile; hidden on md+ where the expanded content + module grid take
            over navigation (this page no longer rides the phone frame). */}
        <BottomNav className="md:hidden !max-w-none" />

      {/* Public "Live Response Status" — read-only transparency panel.
          Fixed right rail on desktop (collapsible drawer); toggleable
          slide-up sheet on mobile. Contains no admin/action widgets. */}
      <PublicTransparencyPanel />
    </main>
    </div>
  );
}
