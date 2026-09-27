import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import ToastViewport from "@/components/ui/Toast";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import LocalBusinessSchema from "@/components/seo/LocalBusinessSchema";
import SimulationToggle from "@/components/admin/SimulationToggle";
import DemoController from "@/components/demo/DemoController";
import DemoHotkeysHost from "@/components/demo/DemoHotkeysHost";
import DemoIndicators from "@/components/demo/DemoIndicators";
import ScenarioSelector from "@/components/demo/ScenarioSelector";
import ActionTriggersPanel from "@/components/demo/ActionTriggersPanel";
import DemoMode from "@/components/demo/DemoMode";
import ConversionBanner from "@/components/demo/ConversionBanner";
import ImpactMetrics from "@/components/demo/ImpactMetrics";
import LiveDemoQR from "@/components/demo/LiveDemoQR";
import QADrawer from "@/components/demo/QADrawer";
import DemoOrchestrator from "@/components/demo/DemoOrchestrator";
import ShortcutModal from "@/components/ui/ShortcutModal";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import PwaUpdateBanner from "@/components/pwa/PwaUpdateBanner";
import ThemeProvider from "@/components/providers/ThemeProvider";
import BackgroundSyncInit from "@/components/offline/BackgroundSyncInit";
import NetworkStatusWidget from "@/components/offline/NetworkStatusWidget";
import StoragePressureCard from "@/components/offline/StoragePressureCard";
import { HighContrastProvider } from "@/lib/contexts/HighContrastContext";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { MapSettingsProvider } from "@/lib/settings/MapSettingsContext";
import { ColorblindProvider } from "@/components/providers/ColorblindContext";
import { ReducedMotionProvider } from "@/components/providers/ReducedMotionContext";
import { LiveRegionProvider } from "@/components/ui/LiveRegion";
import SkipToContent from "@/components/ui/SkipToContent";
import { SIMULATION_COOKIE } from "@/lib/admin/simulation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SafeSphere Platform",
    template: "%s | SafeSphere Platform",
  },
  description:
    "AI-powered disaster response platform with flood prediction, emergency planning, real-time alerts, and resource allocation for communities across India.",
  keywords: [
    "disaster management",
    "flood prediction",
    "emergency response",
    "crisis management",
    "real-time alerts",
    "resource allocation",
    "disaster preparedness",
    "India",
  ],
  authors: [{ name: "SafeSphere Team" }],
  creator: "SafeSphere",
  publisher: "SafeSphere",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://safesphere.app"
  ),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "SafeSphere Platform",
    title: "SafeSphere Platform - AI-Powered Disaster Response",
    description:
      "Flood prediction, emergency planning, and resource allocation. Protecting communities with AI-driven early warnings and coordinated response.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SafeSphere Platform - Disaster Response Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SafeSphere Platform - AI-Powered Disaster Response",
    description:
      "Flood prediction, emergency planning, and resource allocation. Protecting communities with AI-driven early warnings.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your Google Search Console verification token here
    // google: "your-verification-token",
  },
  // Phase 13 · Step 1 — PWA hooks: manifest + installable web app metadata.
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SafeSphere",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const simulationActive = cookies().get(SIMULATION_COOKIE)?.value === "true";
  // Phase 2 — dual demo sessions pin a `demo_mode` cookie (govDemoLogin /
  // publicDemoLogin in app/actions/auth.ts). While active, the amber
  // sandbox strip + scenario switcher render for every surface.
  const demoMode = cookies().get("demo_mode")?.value === "true";
  const demoRole = cookies().get("role")?.value;
  const demoIndicatorMode = demoRole === "public" ? "citizen" : "government";

  return (
    <html lang="en" suppressHydrationWarning>
      {/* bg-primary / text-primary = the roadmap tokens (globals.css also
          sets them on body — these classes make it explicit). */}
      <body
        className={"bg-[var(--brand-navy)] text-primary antialiased scroll-smooth"}
      >
        {/* Phase 1 · SEO & Analytics — Local Business Schema + GA tracking */}
        <LocalBusinessSchema />
        <AnalyticsProvider />

        {simulationActive && (
          <div
            role="alert"
            className="relative z-50 flex h-9 items-center justify-center overflow-hidden bg-[repeating-linear-gradient(45deg,#facc15_0_28px,#111111_28px_56px)]"
          >
            <span className="animate-pulse font-bold tracking-widest text-black drop-shadow">
              ⚠️ TRAINING SIMULATION MODE ACTIVE - NO REAL ALERTS WILL BE SENT ⚠️
            </span>
          </div>
        )}

        {/* Phase 2 · Steps 5–6 — persistent sandbox indicators + live
            scenario switcher, shown only while a demo session is active.
            The amber strip sticks to the very top; the scenario dropdown
            sits an inch below it at the top-right; both render nothing
            outside demo mode. */}
        {demoMode && <DemoIndicators mode={demoIndicatorMode} />}
        {demoMode && <ScenarioSelector />}

        {/* Phase 2 · Steps 7 + 10 — God-Mode one-click action triggers
            (right edge, below the scenario switcher) and the demo→real
            conversion banner (bottom center). Both render nothing outside
            demo mode. */}
        {demoMode && <ActionTriggersPanel mode={demoIndicatorMode} />}
        {demoMode && <ConversionBanner mode={demoIndicatorMode} />}

        {/* Phase 12 · Step 2 — Demo Mode: floating Demo Controls panel
            (left edge) + diagonal watermark, toggled from settings. Renders
            nothing unless the "Demo Mode" toggle is on. */}
        <DemoMode />

        {/* SimulationToggle — bottom-LEFT so it never collides with the
            fixed elements that own the bottom-right corner: the emergency
            contact card (bottom-4 right-4 z-50, taller) used to fully cover
            this toggle on desktop, and on phones the one-handed Restore
            chip lives at bottom-[84px] right-3. Below md it clears the
            fixed mobile BottomNav (72px + safe area); at md+ it sits in the
            corner (no bottom nav there). Fixes the documented Phase-9/10
            overlay issue (the nav is z-30, this stays z-50). */}
        <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom)+12px)] left-4 z-50 md:bottom-4 md:left-4">
          <SimulationToggle active={simulationActive} />
        </div>

        {/* Phase 13 · Step 10 — high-contrast mode (a11y). Applies the
            `high-contrast` class to <html> for every surface. */}
        <HighContrastProvider>
        <ColorblindProvider>
        <ReducedMotionProvider>
        <LiveRegionProvider>
        <ThemeProvider>
          <LanguageProvider>
            <MapSettingsProvider>
              <SkipToContent />
              {children}
            </MapSettingsProvider>
          </LanguageProvider>
        </ThemeProvider>
        </LiveRegionProvider>
        </ReducedMotionProvider>
        </ColorblindProvider>
        </HighContrastProvider>

        {/* Phase 10 · Step 4 — secret pitch-day controller: renders nothing
            unless the URL carries ?demo=1. */}
        <DemoController />

        {/* Phase 15 · Step 3 — invisible demo hotkeys: Shift+1 flood,
            Shift+2 shelter full, Shift+3 responder arrival, Shift+9 impact
            overlay, Q sandbox QR, Shift+0 reset. Renders nothing; a single
            global keydown listener. */}
        <DemoHotkeysHost />

        {/* Phase 15 · Step 5 — live-impact metrics overlay (Shift+9).
            Renders nothing until toggled. */}
        <ImpactMetrics />

        {/* Phase 15 · Step 6 — judges' sandbox QR modal (Q key).
            Renders nothing until opened. */}
        <LiveDemoQR />

        {/* Phase 15 · Step 9 — Q&A anticipation drawer (Shift+4).
            Renders nothing until toggled. */}
        <QADrawer />

        {/* Phase 15 · Step 10 — draggable master dev-tools panel with the
            5-minute teleprompter. Renders nothing outside development mode
            (or when the URL carries ?devtools=1). */}
        <DemoOrchestrator />

        {/* Phase 13 · Step 1 — PWA service worker (production only). */}
        <ServiceWorkerRegister />

        {/* Phase 7 — invisible background sync: one-shot + periodic sync
            registration, and the SW sync-tick relay into IndexedDB. */}
        <BackgroundSyncInit />

        {/* Phase 7 · Step 5 — floating Network Status widget (bottom-right):
            green/orange/red connectivity pill + expandable sync log. */}
        <NetworkStatusWidget />

        {/* Phase 9 — storage pressure warning (top-center, renders nothing
            while usage is healthy). Offers one-tap space freeing. */}
        <StoragePressureCard />

        {/* Phase 13 · Step 3 — new-version banner ("Reload" once a fresh
            build takes over). Renders nothing until then. */}
        <PwaUpdateBanner />

        {/* Phase 11 · Step 5 — power-user shortcuts reference: renders
            nothing until "?" (Shift+/) is pressed. */}
        <ShortcutModal />

        <ToastViewport />
        <Script id="google-translate-init" strategy="afterInteractive">
          {`
            function googleTranslateElementInit() {
              new window.google.translate.TranslateElement({
                pageLanguage: 'en',
                includedLanguages: 'hi,bn,te,mr,ta,ur,gu,kn,ml,en', // Major Indian languages + English
                layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
              }, 'google_translate_element');
            }
          `}
        </Script>
        <Script
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
        {/* Analytics disabled to prevent 403 Forbidden POST errors on Vercel */}
        {/* <Analytics /> */}
        {/* <SpeedInsights /> */}
      </body>
    </html>
  );
}
