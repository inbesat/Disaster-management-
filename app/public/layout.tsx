import type { ReactNode } from "react";
import { cookies } from "next/headers";
import GuestModeBanner from "@/components/GuestModeBanner";
import PreviewModeBanner from "@/components/gov/PreviewModeBanner";
import PublicAlertHost from "@/components/public/PublicAlertHost";
import BandwidthGate from "@/components/public/BandwidthGate";
import PublicSidebar from "@/components/public/PublicSidebar";
import { SOSProvider } from "@/components/public/sos/SOSContext";
import SOSModal from "@/components/public/sos/SOSModal";
import EmergencyModeBanner from "@/components/public/sos/EmergencyModeBanner";
import SafetyNudge from "@/components/public/sos/SafetyNudge";
import ShakeToSOSHost from "@/components/public/sos/ShakeToSOSHost";
import NovaChat from "@/components/public/NovaChat";
import PwaInstallPrompt from "@/components/pwa/PwaInstallPrompt";
import PublicLanguageFab from "@/components/public/PublicLanguageFab";
import { BandwidthProvider } from "@/lib/contexts/BandwidthContext";

// ---------------------------------------------------------------------
// app/public/layout.tsx — Phase 1 · Step 10. Wraps every citizen page
// (/public/*). While a gov official is previewing (view_as_public=true),
// the sticky red PreviewModeBanner renders at the top of every screen so
// they always know they're seeing the citizen app and can return to the
// command center. Citizens and guests never hold that cookie, so the
// banner is invisible to them.
//
// PublicAlertHost (client island, Phase 3 · Steps 9–10) mounts the
// shared citizen-alert chrome: the bottom-left Dev Tools judge trigger
// and the full-screen critical takeover overlay — both event-driven, so
// they work on every /public page.
//
// Phase 5 · Steps 1–5 — SOSProvider gives every /public page a global
// SOS modal (useSOS().open() — the BottomNav SOS tab is the trigger),
// the single SOSModal instance renders once here above every page, the
// EmergencyModeBanner pins a red bar + hold-to-cancel across all pages
// while an SOS is active, and the LocationTracker rides below it while
// live GPS is being shared.
// ---------------------------------------------------------------------
export default function PublicLayout({ children }: { children: ReactNode }) {
  const isGuest = cookies().get("guest_mode")?.value === "true";

  return (
    <SOSProvider>
      {/* Phase 13 · Step 2 — extreme low-bandwidth flag for every /public
          page (maps/images/AI hidden while active). */}
      <BandwidthProvider>
        <PreviewModeBanner />
        <GuestModeBanner isGuest={isGuest} />
        {/* Desktop layout: sticky left sidebar + content on the right.
            Mobile preserves the bottom nav (BottomNav is md:hidden inside
            each page). PublicSidebar is hidden md:flex — it renders only
            on md+ screens and never touches the mobile nav. */}
        <div className="flex flex-col md:flex-row">
          <PublicSidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>

        {/* Mobile-only language picker — floats above the BottomNav so the
            switch is reachable from every /public page (<md). Desktop uses
            the PublicSidebar footer selector. */}
        <PublicLanguageFab />

        <PublicAlertHost />

        {/* Phase 13 · Step 3 — install banner: appears above the BottomNav
            when the browser can install the app (beforeinstallprompt) and
            the citizen hasn't dismissed it. Renders nothing otherwise. */}
        <PwaInstallPrompt />
        <SOSModal />

      {/* Phase 5 · Steps 4–5 — one fixed top stack hosts the Emergency
          banner and the live-location tracker, so the tracker always sits
          exactly below the banner (both bars are static; this wrapper is
          fixed and pointer-events-none so empty space never blocks taps). */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[90]">
        <EmergencyModeBanner />
      </div>

      {/* Phase 5 · Step 8 — periodic safety check-in (also triggered via
          the Dev Tools simulator). Never interrupts an active SOS. */}
      <SafetyNudge />

      {/* Phase 5 · Step 9 — Shake-to-SOS (or 3 rapid Spacebar presses on
          desktop). Renders nothing; only opens the SOS modal. */}
      <ShakeToSOSHost />

      {/* Phase 1 · Step 1 — the "Nova" AI companion: 56px violet FAB +
          draggable 60%→100% bottom sheet with the voice-first composer.
          Hidden in low-bandwidth mode (it streams AI tokens — Phase 13 ·
          Step 2). Replaces the earlier Nova shell; NovaChat remains
          in the codebase for reference. */}
      <BandwidthGate>
        <NovaChat />
      </BandwidthGate>
      </BandwidthProvider>
    </SOSProvider>
  );
}
