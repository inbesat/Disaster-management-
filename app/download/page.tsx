import Link from "next/link";
import {
  Apple,
  ArrowLeft,
  Check,
  Download,
  Globe,
  Info,
  Satellite,
  Smartphone,
} from "lucide-react";

export const metadata = {
  title: "Download SafeSphere",
  description:
    "Get the SafeSphere app for Android — Standard or Field Ops edition — plus iOS, iPadOS and the Progressive Web App for the official disaster response platform.",
};

// ---------------------------------------------------------------------
// app/download/page.tsx — two Android APK editions side by side, each
// with its file size and an (i) hover tooltip explaining the technical
// trade-off, plus a compact row for the remaining platforms.
// ---------------------------------------------------------------------

type ApkEdition = {
  title: string;
  target: string;
  size: string;
  tooltip: string;
  href: string;
  downloadName: string;
  icon: typeof Smartphone;
  /** Accent color treated per-card below (keeps Tailwind classes static). */
  iconTile: string;
  buttonClass: string;
  glowClass: string;
  features: string[];
};

const APK_EDITIONS: ApkEdition[] = [
  {
    title: "Standard Edition",
    target: "For general citizens",
    size: "4.0 MB",
    tooltip:
      "Lightweight cloud-connected version. Requires internet for AI planning and live maps.",
    href: "/safesphere.apk",
    downloadName: "safesphere.apk",
    icon: Smartphone,
    iconTile: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
    buttonClass:
      "bg-sky-500 text-white shadow-[0_4px_20px_rgba(59,130,246,0.35)] hover:bg-sky-400 hover:shadow-[0_6px_28px_rgba(59,130,246,0.5)] focus-visible:outline-sky-400",
    glowClass:
      "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_12px_40px_-12px_rgba(59,130,246,0.35)]",
    features: ["Cloud AI planning", "Live map routing", "Small footprint"],
  },
  {
    title: "Field Ops Edition",
    target: "For responders and offline preparation",
    size: "73.4 MB",
    tooltip:
      "Cloud AI when connected; clearly marked offline guidance and cached field tools when disconnected. Maps require previously downloaded data. Sending SOS reports requires connectivity.",
    href: "/safesphere-field-ops.apk",
    downloadName: "safesphere-field-ops.apk",
    icon: Satellite,
    iconTile: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    buttonClass:
      "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-[0_4px_20px_rgba(249,115,22,0.35)] hover:from-amber-400 hover:to-orange-400 hover:shadow-[0_6px_28px_rgba(249,115,22,0.5)] focus-visible:outline-amber-400",
    glowClass:
      "hover:shadow-[0_0_0_1px_rgba(249,115,22,0.25),0_12px_40px_-12px_rgba(249,115,22,0.4)]",
    features: [
      "Cloud AI + offline guidance",
      "TFLite triage classifier",
      "Offline MapLibre maps",
      "GPS SOS with 3-2-1 countdown",
      "Cached data when offline",
    ],
  },
];

const OTHER_PLATFORMS = [
  {
    icon: Apple,
    title: "iOS & iPadOS",
    subtitle: "App Store & TestFlight",
    badge: "Not yet",
    badgeClass: "text-slate-600 border-slate-800",
  },
  {
    icon: Globe,
    title: "Progressive Web App",
    subtitle: "No installation required.",
    badge: "Fastest",
    badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  },
];

/** Size label + (i) icon with a floating hover tooltip (group/info-scoped). */
function SizeTooltip({ size, tip }: { size: string; tip: string }) {
  return (
    <span className="group/info relative inline-flex items-center gap-1.5">
      <span className="font-mono text-xs text-slate-400">{size}</span>
      <span className="relative inline-flex">
        <Info
          aria-hidden="true"
          className="h-3.5 w-3.5 cursor-help text-slate-500 transition-colors group-hover/info:text-sky-300"
        />
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 translate-y-1 rounded-lg border border-slate-700 bg-panel-deep/95 px-3 py-2.5 text-xs leading-relaxed text-slate-200 opacity-0 shadow-[var(--shadow-float-lg)] backdrop-blur transition-all duration-200 group-hover/info:translate-y-0 group-hover/info:opacity-100"
        >
          {tip}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-full -mt-px h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-slate-700 bg-panel-deep"
          />
        </span>
      </span>
    </span>
  );
}

export default function DownloadPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-primary px-4 py-16 text-white">
      {/* Header */}
      <header className="mx-auto w-full max-w-2xl text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>
        <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl">
          Download <span className="text-sky-400">SafeSphere</span>
        </h1>
        <p className="mt-4 text-base text-slate-400 sm:text-lg">
          Pick the Android edition that matches your role — hover the{" "}
          <Info className="inline h-4 w-4 text-slate-500" aria-hidden="true" /> for the
          technical difference.
        </p>
      </header>

      <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-amber-200">
        Android test builds. Online features connect to the deployed SafeSphere server;
        server updates require a separate deployment.
      </p>

      {/* Android APK edition cards */}
      <div className="mx-auto mt-12 grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
        {APK_EDITIONS.map((edition) => {
          const Icon = edition.icon;
          return (
            <section
              key={edition.title}
              className={`group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur transition-all duration-300 hover:border-slate-600 ${edition.glowClass}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${edition.iconTile}`}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                {/* Size + info tooltip sits next to the header, still adjacent
                    to the size readout on each card. */}
                <SizeTooltip size={edition.size} tip={edition.tooltip} />
              </div>

              <h2 className="mt-5 text-xl font-bold tracking-tight">{edition.title}</h2>
              <p className="mt-1 text-sm text-slate-400">{edition.target}</p>

              {/* Feature bullets */}
              <ul className="mt-5 space-y-2">
                {edition.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-slate-300"
                  >
                    <Check className="h-4 w-4 shrink-0 text-sky-400" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex-1" />

              <a
                href={edition.href}
                download={edition.downloadName}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99] ${edition.buttonClass}`}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download {edition.title}
              </a>

              <p className="mt-3 text-center font-mono text-[0.6875rem] text-slate-500">
                {edition.downloadName}
              </p>
            </section>
          );
        })}
      </div>

      {/* Other platforms */}
      <div className="mx-auto mt-10 grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
        {OTHER_PLATFORMS.map((platform) => {
          const Icon = platform.icon;
          return (
            <section
              key={platform.title}
              className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-6 transition-colors duration-200 hover:border-slate-600"
            >
              <span
                className={`self-start rounded-full border px-2.5 py-1 text-eoc-tiny font-bold uppercase tracking-wider ${platform.badgeClass}`}
              >
                {platform.badge}
              </span>
              <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/80">
                <Icon className="h-6 w-6 text-slate-200" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-lg font-bold">{platform.title}</h2>
              <p className="mt-1 text-sm text-slate-400">{platform.subtitle}</p>
              <div className="mt-6 flex-1" />
              {platform.title === "Progressive Web App" ? (
                <Link
                  href="/"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:scale-[0.99]"
                >
                  Open Web App
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-slate-800/60 px-4 py-3 text-sm font-semibold text-slate-500 opacity-70"
                >
                  Coming Soon
                </button>
              )}
            </section>
          );
        })}
      </div>

      <footer className="mt-12 text-center text-xs text-slate-500">
        SafeSphere builds signed releases for every supported platform. Verify the
        checksum before sideloading an APK.
      </footer>
    </main>
  );
}
