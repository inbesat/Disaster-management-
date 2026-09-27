"use client";

// ---------------------------------------------------------------------
// components/gov/alerts/AlertComposer.tsx — Phase 11 · Steps 1–2 ·
// Omni-Channel Alert Composer.
//
// The Command Center's single form for raising a district alert.
//
// Step 1 — Alert Details: alert type (dropdown), severity (segmented),
// message area, channel multi-select (In-App Push / SMS / WhatsApp /
// Voice Call) and an Immediate vs Scheduled send toggle.
//
// Step 2 — Geospatial Target Area: sits ABOVE the message area. A mini
// MapLibre widget (250px) with three targeting modes — Entire District,
// Select Villages, Draw Custom Polygon — where the drawn polygon's
// coordinates are captured and streamed into the recipient estimate.
//
// The footer shows a live recipient estimate (deterministic mock from
// lib/mock-data/gov-alert-targets) and the send/schedule action.
// ---------------------------------------------------------------------

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarClock,
  FileText,
  FlaskConical,
  Languages,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Radio,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import {
  GOV_ALERT_CHANNELS,
  GOV_ALERT_TEMPLATES,
  GOV_ALERT_TYPES,
  GOV_ALERT_VILLAGES,
  GOV_DISTRICTS,
  GOV_DISTRICT_CENTERS,
  GOV_SEVERITIES,
  estimateRecipients,
  formatCompact,
  polygonAreaKm2,
  type GovAlertChannel,
  type GovAlertSeverity,
  type GovAlertType,
  type AlertTargetMode,
} from "@/lib/mock-data/gov-alert-targets";
import {
  ALERT_VARIABLE_SAMPLES,
  QUICK_ALERT_TEMPLATES,
  detectTemplateId,
  extractTemplateVariables,
  splitByVariables,
  translateAll,
  type AlertTemplate,
  type TranslateLang,
} from "@/lib/mock-data/gov-alert-templates";
import TemplateLibrary from "@/components/gov/alerts/TemplateLibrary";
import TranslationPreview from "@/components/gov/alerts/TranslationPreview";

const AlertTargetMap = dynamic(() => import("@/components/gov/alerts/AlertTargetMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[250px] w-full items-center justify-center rounded-xl border border-white/10 bg-panel-deep">
      <p className="text-xs text-slate-400">Loading targeting map…</p>
    </div>
  ),
});

const CHANNEL_ICONS: Record<GovAlertChannel, LucideIcon> = {
  push: Bell,
  sms: MessageSquare,
  whatsapp: MessageCircle,
  voice: Phone,
  fm_radio: Radio,
  social: MessageCircle,
};

const TARGET_TABS: Array<{ mode: AlertTargetMode; label: string }> = [
  { mode: "entire", label: "Entire District" },
  { mode: "villages", label: "Select Villages" },
  { mode: "polygon", label: "Draw Custom Polygon" },
];

/** Section card used for every form block. */
function Card({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-secondary p-5">
      <header className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-purple/30 bg-accent-purple/10 text-accent-purple">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400"
    >
      {children}
    </label>
  );
}

export function AlertComposer() {
  const toast = useToast();

  // Step 1 — alert details.
  const [type, setType] = useState<GovAlertType>("flood_warning");
  const [severity, setSeverity] = useState<GovAlertSeverity>("warning");
  const [message, setMessage] = useState("");
  const [channels, setChannels] = useState<ReadonlySet<GovAlertChannel>>(
    new Set<GovAlertChannel>(["push", "sms"]),
  );
  const [scheduleMode, setScheduleMode] = useState<"immediate" | "scheduled">(
    "immediate",
  );
  const [scheduledAt, setScheduledAt] = useState("");

  // Phase 11 · Step 5 — A/B messaging test across the target zone.
  const [abEnabled, setAbEnabled] = useState(false);
  const [messageB, setMessageB] = useState("");

  // Hydration-safe clock: localDatetimeMin() depends on Date.now(), which
  // differs between SSR and the client — gate it behind a mounted flag
  // (same pattern as LiveClock / AlertCard) so the `min` prop can't
  // mismatch during hydration.
  const [mounted, setMounted] = useState(false);

  // Step 2 — geospatial target area.
  const [district, setDistrict] = useState<string>("Patna");
  const [targetMode, setTargetMode] = useState<AlertTargetMode>("entire");
  const [selectedVillages, setSelectedVillages] = useState<ReadonlySet<string>>(
    new Set<string>(),
  );
  const [polygonCoords, setPolygonCoords] = useState<[number, number][]>([]);

  // Phase 11 · Step 3 — template library modal.
  const [showLibrary, setShowLibrary] = useState(false);

  // Phase 11 · Step 4 — mock AI multi-lingual auto-translation.
  const [translations, setTranslations] = useState<Record<TranslateLang, string> | null>(
    null,
  );
  const [translating, setTranslating] = useState(false);
  const [activeLang, setActiveLang] = useState<TranslateLang>("hi");
  const [editingLang, setEditingLang] = useState<TranslateLang | null>(null);
  const translateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const districtCenter = GOV_DISTRICT_CENTERS[district] ?? GOV_DISTRICT_CENTERS["Patna"];
  const areaKm2 = useMemo(() => polygonAreaKm2(polygonCoords), [polygonCoords]);
  const estimate = useMemo(
    () =>
      estimateRecipients({
        district,
        severity,
        channels: Array.from(channels),
        mode: targetMode,
        selectedVillages: selectedVillages.size,
        polygonAreaKm2: areaKm2,
      }),
    [district, severity, channels, targetMode, selectedVillages, areaKm2],
  );

  const toggleChannel = (channel: GovAlertChannel) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  };

  const toggleVillage = (id: string) => {
    setSelectedVillages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const switchMode = (mode: AlertTargetMode) => {
    setTargetMode(mode);
  };

  // Insert the SOP quick-template that matches the selected alert type so
  // the {variables} stay highlighted AND Auto-Translate recognises the
  // message (the long GOV_ALERT_TEMPLATES bodies aren't in the translation
  // catalogue — using them here would break the Step 3 → Step 4 flow).
  const useTemplate = () => {
    const quickId =
      type === "flood_warning"
        ? ("flood" as const)
        : type === "evac_order"
          ? ("evac" as const)
          : null;
    const quick = quickId
      ? QUICK_ALERT_TEMPLATES.find((t) => t.id === quickId)
      : undefined;
    setMessage(quick ? quick.body : GOV_ALERT_TEMPLATES[type](district));
  };

  /** Step 3 — a library template drops into the message box, tokens intact
   * so the {variables} stay highlighted for the official to complete. */
  const applyLibraryTemplate = (template: AlertTemplate) => {
    setMessage(template.body);
    setTranslations(null);
    setShowLibrary(false);
    toast.info({
      title: `${template.label} loaded`,
      description: extractTemplateVariables(template.body).length
        ? `Fill the highlighted {variables} then Auto-Translate.`
        : "Ready to review and send.",
    });
  };

  // Step 4 — simulate a fast LLM translation call (~1.2s) and render the
  // four-language preview. Non-template messages are politely declined.
  const runAutoTranslate = () => {
    if (translating) return;
    if (!message.trim()) {
      toast.warning({
        title: "Nothing to translate",
        description: "Compose a message first.",
      });
      return;
    }
    const result = translateAll(message);
    if (!result) {
      toast.warning({
        title: "Template not recognised",
        description: "Use the Template Library so the AI can auto-translate accurately.",
      });
      setShowLibrary(true);
      return;
    }

    setTranslating(true);
    translateTimerRef.current = setTimeout(() => {
      setTranslations(result);
      setActiveLang("hi");
      setEditingLang(null);
      setTranslating(false);
      toast.success({
        title: "Auto-translated",
        description:
          "Hindi · Bengali · Tamil · Malayalam — edit any language before sending.",
      });
    }, 1200);
  };

  const saveTranslation = (lang: TranslateLang, text: string) => {
    setTranslations((prev) => (prev ? { ...prev, [lang]: text } : prev));
  };

  const clearPolygon = () => setPolygonCoords([]);

  // Clear the mock translation timer if the composer unmounts mid-call.
  useEffect(() => {
    return () => {
      if (translateTimerRef.current) clearTimeout(translateTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const localDatetimeMin = () => {
    const d = new Date(Date.now() + 5 * 60_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  };

  const handleSubmit = () => {
    if (!message.trim()) {
      toast.warning({
        title: "Message required",
        description: "Compose or use the official template before sending.",
      });
      return;
    }
    if (channels.size === 0) {
      toast.warning({
        title: "Pick a channel",
        description: "Select at least one delivery channel.",
      });
      return;
    }
    if (targetMode === "villages" && selectedVillages.size === 0) {
      toast.warning({
        title: "Select villages",
        description: "Choose at least one village to target.",
      });
      return;
    }
    if (targetMode === "polygon" && polygonCoords.length < 3) {
      toast.warning({
        title: "Draw a polygon",
        description: "Draw the alert radius on the map before sending.",
      });
      return;
    }
    if (
      scheduleMode === "scheduled" &&
      (!scheduledAt || new Date(scheduledAt) <= new Date())
    ) {
      toast.warning({
        title: "Pick a future time",
        description: "Scheduled alerts must go out in the future.",
      });
      return;
    }

    const when =
      scheduleMode === "scheduled"
        ? new Date(scheduledAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Immediately";
    const typeMeta = GOV_ALERT_TYPES.find((t) => t.value === type)!;
    const channelLabels = Array.from(channels)
      .map((c) => GOV_ALERT_CHANNELS.find((ch) => ch.value === c)?.label)
      .join(", ");
    const multilingual = translations
      ? ` · translations: ${Object.keys(translations)
          .map((code) => code.toUpperCase())
          .join(", ")}`
      : "";
    const abNote = abEnabled
      ? ` · A/B split: A=${message.length}ch / B=${messageB.length}ch`
      : "";

    console.log(
      `[alert] ${type} (${severity}) → ${estimate.targetLabel} · ${formatCompact(estimate.total)} recipients via ${channelLabels} · ${when}${multilingual}${abNote}`,
    );
    toast.success({
      title: `${typeMeta.emoji} Alert ${scheduleMode === "scheduled" ? "scheduled" : "dispatched"}`,
      description: `${estimate.targetLabel} · ≈ ${formatCompact(estimate.total)} recipients via ${channelLabels} · ${when}${multilingual}${abNote}`,
      duration: 6000,
    });
  };

  const selectedTypeMeta = GOV_ALERT_TYPES.find((t) => t.value === type)!;
  const selectedSeverityMeta = GOV_SEVERITIES.find((s) => s.value === severity)!;

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {/* ── Left column (2/3): details → target map → message ─────────── */}
      <div className="space-y-5 xl:col-span-2">
        {/* Step 1 — Alert type + severity */}
        <Card
          icon={ShieldAlert}
          title="Alert Details"
          subtitle="What kind of alert, and how urgent?"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="alert-type">Alert Type</FieldLabel>
              <select
                id="alert-type"
                value={type}
                onChange={(e) => setType(e.target.value as GovAlertType)}
                className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-accent-purple/60 focus:outline-none [&>option]:bg-panel-deep"
              >
                {GOV_ALERT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.emoji} {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Severity</FieldLabel>
              <div
                role="group"
                aria-label="Severity"
                className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-white/5 p-1"
              >
                {GOV_SEVERITIES.map((s) => {
                  const active = s.value === severity;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSeverity(s.value)}
                      className={`rounded-md px-2 py-2 text-xs font-bold uppercase tracking-wider transition ${
                        active
                          ? s.tone
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* Step 2 — Geospatial target area (above the message area). */}
        <Card
          icon={MapPin}
          title="Target Area"
          subtitle="Alert only the people in the danger zone."
        >
          {/* Segmented control (aria-pressed buttons — the codebase's
              convention, avoids half-implemented ARIA tabs). */}
          <div
            role="group"
            aria-label="Targeting mode"
            className="mb-3 grid grid-cols-1 gap-1 rounded-lg border border-white/10 bg-white/5 p-1 sm:grid-cols-3"
          >
            {TARGET_TABS.map((tab) => {
              const active = targetMode === tab.mode;
              return (
                <button
                  key={tab.mode}
                  type="button"
                  aria-pressed={active}
                  onClick={() => switchMode(tab.mode)}
                  className={`rounded-md px-2 py-2 text-[0.6875rem] font-bold uppercase tracking-wider transition ${
                    active
                      ? "bg-accent-purple text-white shadow-[0_2px_10px_rgba(139,92,246,0.45)]"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* District picker (applies to every mode). */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <FieldLabel htmlFor="target-district">District</FieldLabel>
            <select
              id="target-district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="h-9 w-44 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm text-white focus:border-accent-purple/60 focus:outline-none [&>option]:bg-panel-deep"
            >
              {GOV_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              Centre {districtCenter.lat.toFixed(3)}, {districtCenter.lng.toFixed(3)}
            </span>
          </div>

          <AlertTargetMap
            mode={targetMode}
            district={district}
            selectedVillages={selectedVillages}
            onVillageToggle={toggleVillage}
            polygonCoords={polygonCoords}
            onPolygonChange={setPolygonCoords}
          />

          {/* Polygon capture readout — live coordinates of the alert radius. */}
          {targetMode === "polygon" && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/40 bg-accent-purple/10 px-2.5 py-1 text-[0.6875rem] font-bold text-accent-purple">
                <Radio className="h-3.5 w-3.5" aria-hidden />
                {polygonCoords.length} vertices captured
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.6875rem] font-semibold text-slate-300">
                ≈ {areaKm2.toFixed(1)} km² alert radius
              </span>
              {polygonCoords.length > 0 && (
                <button
                  type="button"
                  onClick={clearPolygon}
                  className="inline-flex items-center gap-1.5 rounded-full border border-severity-red-500/40 bg-severity-red-500/10 px-2.5 py-1 text-[0.6875rem] font-bold text-severity-red-300 transition hover:bg-severity-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Clear shape
                </button>
              )}
            </div>
          )}

          {/* Village selection readout. */}
          {targetMode === "villages" && (
            <p className="mt-2.5 text-xs text-muted">
              {selectedVillages.size === 0
                ? "No villages selected yet — tap markers on the map."
                : `${selectedVillages.size} village${
                    selectedVillages.size === 1 ? "" : "s"
                  } targeted · ${Array.from(selectedVillages)
                    .map((id) => GOV_ALERT_VILLAGES.find((v) => v.id === id)?.name ?? id)
                    .join(", ")}`}
            </p>
          )}
        </Card>

        {/* Step 1 — Message text area (target area sits above it). */}
        <Card
          icon={FileText}
          title="Message"
          subtitle="Plain language. No jargon — a scared resident must get it instantly."
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {abEnabled
                ? `${message.length + messageB.length} / 1000 characters`
                : `${message.length} / 500 characters`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      const quick = QUICK_ALERT_TEMPLATES.find((t) => t.id === e.target.value);
                      if (quick) {
                        setMessage(quick.body);
                        setTranslations(null);
                      }
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                  className="h-8 appearance-none rounded-md border border-white/10 bg-white/5 px-2.5 pr-7 text-[0.6875rem] font-bold text-slate-300 transition hover:bg-white/10 hover:text-white [&>option]:bg-[#111827]"
                >
                  <option value="" disabled>Insert Template</option>
                  {QUICK_ALERT_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <BookOpen className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" aria-hidden />
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={abEnabled}
                onClick={() => setAbEnabled((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[0.6875rem] font-bold transition ${
                  abEnabled
                    ? "border-blue-400/50 bg-blue-400/10 text-blue-400"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <FlaskConical className="h-3.5 w-3.5" aria-hidden />
                A/B Testing {abEnabled ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => setShowLibrary(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-purple-400/40 bg-purple-400/10 px-2.5 py-1.5 text-[0.6875rem] font-bold text-purple-400 transition hover:bg-purple-400/20"
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                Template Library
              </button>
            </div>
          </div>

          {/* Step 5 — A/B split helper text. */}
          {abEnabled && (
            <div className="mt-2 rounded-lg border border-accent-primary/30 bg-accent-primary/5 p-3">
              <p className="text-[0.6875rem] leading-relaxed text-slate-300">
                The system will send <strong className="text-white">Variant A</strong> to
                50% of the target zone and{" "}
                <strong className="text-white">Variant B</strong> to the other 50%. The
                variant with the fastest public{" "}
                <strong className="text-white">&quot;Acknowledgment&quot;</strong> rate
                will be used for future follow-ups.
              </p>
            </div>
          )}

          <FieldLabel>Variant A</FieldLabel>
          <textarea
            value={message}
            onChange={(e) => {
              // Any manual edit invalidates the mock translations.
              setTranslations(null);
              setEditingLang(null);
              setMessage(e.target.value.slice(0, 500));
            }}
            rows={7}
            placeholder="Heavy rainfall has pushed river levels above the danger mark…"
            className="w-full resize-y rounded-lg border border-white/10 bg-white/5 p-3 text-sm leading-relaxed text-white placeholder:text-muted focus:border-accent-purple/60 focus:outline-none"
          />

          {abEnabled && (
            <div className="mt-3">
              <FieldLabel>Variant B</FieldLabel>
              <textarea
                value={messageB}
                onChange={(e) => setMessageB(e.target.value.slice(0, 500))}
                rows={7}
                placeholder="Danger! River levels are rising fast — evacuate to higher ground now…"
                className="w-full resize-y rounded-lg border border-accent-primary/30 bg-accent-primary/5 p-3 text-sm leading-relaxed text-white placeholder:text-muted focus:border-accent-primary/60 focus:outline-none"
              />
            </div>
          )}

          {/* Step 3 — {variable} highlight preview, so officials see what
              still needs filling in before they send. */}
          <VariableHighlight text={message} />

          {/* Step 4 — Auto-Translate + tabbed preview. */}
          <button
            type="button"
            onClick={runAutoTranslate}
            disabled={translating}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-accent-primary/50 bg-accent-primary/10 px-3.5 text-xs font-bold uppercase tracking-wider text-[var(--dl-blue-light)] transition hover:bg-accent-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {translating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Languages className="h-4 w-4" aria-hidden />
            )}
            {translating ? "Translating via AI…" : "Auto-Translate"}
          </button>

          {translations && (
            <TranslationPreview
              translations={translations}
              activeLang={activeLang}
              onActiveLangChange={setActiveLang}
              editingLang={editingLang}
              onStartEdit={(lang) => setEditingLang(lang)}
              onSaveEdit={(lang, text) => saveTranslation(lang, text)}
              onCancelEdit={() => setEditingLang(null)}
              originalText={message}
            />
          )}
        </Card>
      </div>

      {/* ── Right column (1/3): preview → channels → schedule → send ────── */}
      <div className="space-y-5">
        {/* Live Preview — how the alert looks on the public app. */}
        <section className="rounded-xl border border-white/10 bg-[#111827] p-5">
          <header className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-purple-400/30 bg-purple-400/10 text-purple-400">
              <FileText className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Live Preview
              </h2>
              <p className="text-xs text-slate-500">How it looks on the public app</p>
            </div>
          </header>

          {/* Phone frame mockup */}
          <div className="rounded-xl border border-white/10 bg-[#0a0f1a] p-3">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="ml-auto text-[0.5rem] font-mono text-slate-600">SafeSphere</span>
            </div>

            {/* Alert header */}
            <div className={`rounded-lg p-3 mb-2 ${
              severity === "critical"
                ? "bg-red-400/10 border border-red-400/30"
                : severity === "warning"
                  ? "bg-amber-400/10 border border-amber-400/30"
                  : "bg-blue-400/10 border border-blue-400/30"
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{selectedTypeMeta.emoji}</span>
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  severity === "critical"
                    ? "text-red-400"
                    : severity === "warning"
                      ? "text-amber-400"
                      : "text-blue-400"
                }`}>
                  {selectedSeverityMeta.label}
                </span>
              </div>
              <p className="text-xs font-bold text-white">{selectedTypeMeta.label}</p>
            </div>

            {/* Message preview */}
            <div className="rounded-lg bg-white/5 p-2.5 mb-2">
              {message ? (
                <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap line-clamp-6">
                  {message}
                </p>
              ) : (
                <p className="text-xs text-slate-600 italic">Your message will appear here…</p>
              )}
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between text-[0.5rem] text-slate-600">
              <span>{estimate.targetLabel}</span>
              <span>Just now</span>
            </div>
          </div>

          {/* Channel badges */}
          {channels.size > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {Array.from(channels).map((ch) => {
                const meta = GOV_ALERT_CHANNELS.find((c) => c.value === ch);
                return (
                  <span
                    key={ch}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.5625rem] font-semibold text-slate-400"
                  >
                    {meta?.label}
                  </span>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 1 — Channels multi-select. */}
        <Card icon={Radio} title="Channels" subtitle="Where the alert gets delivered.">
          <div className="space-y-2">
            {GOV_ALERT_CHANNELS.map((channel) => {
              const Icon = CHANNEL_ICONS[channel.value];
              const active = channels.has(channel.value);
              return (
                <button
                  key={channel.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleChannel(channel.value)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-accent-purple/60 bg-accent-purple/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                      active
                        ? "bg-accent-purple/25 text-accent-purple"
                        : "bg-white/5 text-slate-400"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">
                      {channel.label}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {channel.hint}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                      active
                        ? "border-accent-purple bg-accent-purple shadow-[0_0_8px_rgba(139,92,246,0.8)]"
                        : "border-white/20"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </Card>

        {/* Step 1 — Immediate vs Scheduled send. */}
        <Card icon={CalendarClock} title="Timing" subtitle="Send now, or stage it.">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              aria-pressed={scheduleMode === "immediate"}
              onClick={() => setScheduleMode("immediate")}
              className={`rounded-md px-2 py-2 text-xs font-bold uppercase tracking-wider transition ${
                scheduleMode === "immediate"
                  ? "bg-accent-primary text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              Immediate
            </button>
            <button
              type="button"
              aria-pressed={scheduleMode === "scheduled"}
              onClick={() => setScheduleMode("scheduled")}
              className={`rounded-md px-2 py-2 text-xs font-bold uppercase tracking-wider transition ${
                scheduleMode === "scheduled"
                  ? "bg-accent-primary text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              Scheduled
            </button>
          </div>

          {scheduleMode === "scheduled" && (
            <div className="mt-3">
              <FieldLabel htmlFor="scheduled-at">Send at</FieldLabel>
              <input
                id="scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                min={mounted ? localDatetimeMin() : undefined}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-accent-purple/60 focus:outline-none [color-scheme:dark]"
              />
            </div>
          )}
        </Card>

        {/* Recipient summary + primary action. */}
        <section className="rounded-xl border border-white/10 bg-secondary p-5">
          <header className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent-purple/30 bg-accent-purple/10 text-accent-purple">
              <Bell className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Recipients
              </h2>
              <p className="text-xs text-muted">Live estimate as you compose</p>
            </div>
          </header>

          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="eoc-label text-[0.625rem] text-slate-400">TARGET</p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {estimate.targetLabel}
            </p>

            <p className="eoc-label mt-3 text-[0.625rem] text-slate-400">ESTIMATED REACH</p>
            <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums text-accent-purple">
              ≈ {formatCompact(estimate.total)}
            </p>
            <p className="text-[0.6875rem] text-slate-400">
              people · {selectedSeverityMeta.label} severity · {selectedTypeMeta.emoji}{" "}
              {selectedTypeMeta.label}
            </p>

            <ul className="mt-3 space-y-1.5">
              {estimate.perChannel.map((row) => (
                <li
                  key={row.channel}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${selectedSeverityMeta.dot}`}
                    />
                    {row.label}
                  </span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {formatCompact(row.count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            aria-label={
              scheduleMode === "scheduled"
                ? `Schedule ${severity} ${type} alert for ${district} district`
                : `Send ${severity} ${type} alert now to ${district} district`
            }
            className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold uppercase tracking-wider transition active:scale-[0.99] ${
              severity === "critical"
                ? "bg-severity-red-600 text-white shadow-[0_4px_18px_rgba(220,38,38,0.45)] hover:bg-severity-red-500"
                : "bg-accent-primary text-white shadow-[0_4px_18px_rgba(59,130,246,0.4)] hover:brightness-110"
            }`}
          >
            <Send className="h-4 w-4" aria-hidden />
            {scheduleMode === "scheduled" ? "Schedule Alert" : "Send Alert"}
          </button>
          <p className="mt-2 text-center text-[0.625rem] leading-snug text-slate-500">
            {scheduleMode === "scheduled"
              ? "Staged in the dispatch queue — critical alerts bypass quiet hours."
              : "Dispatched over every selected channel. Logged & audited."}
          </p>
        </section>
      </div>

      {/* Phase 11 · Step 3 — Legal & SOP Template Library modal. */}
      <TemplateLibrary
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        onUse={applyLibraryTemplate}
      />
    </div>
  );
}

/**
 * Step 3 — live {variable} highlight. A textarea can't render rich text,
 * so the message is re-previewed here with {tokens} as amber chips, plus
 * suggested sample values to fill in. The templates are matched so the
 * badge (e.g. "Flood Warning template") stays honest.
 */
function VariableHighlight({ text }: { text: string }) {
  const variables = extractTemplateVariables(text);
  if (variables.length === 0) return null;

  const template = QUICK_ALERT_TEMPLATES.find((t) => detectTemplateId(text) === t.id);

  return (
    <div className="mt-2 rounded-lg border border-severity-amber-500/25 bg-severity-amber-500/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.5625rem] font-bold uppercase tracking-[0.2em] text-severity-amber-300">
          {template ? `${template.label} template` : "Variables to fill"}
        </span>
        {variables.length > 0 && (
          <span className="rounded-full border border-severity-amber-500/30 bg-severity-amber-500/10 px-2 py-0.5 text-[0.625rem] font-bold text-severity-amber-300">
            {variables.length} open
          </span>
        )}
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-slate-100">
        {splitByVariables(text).map((segment, i) =>
          /^\{[a-z_]+\}$/.test(segment) ? (
            <mark
              key={i}
              className="mx-0.5 rounded bg-severity-amber-500/25 px-1.5 py-0.5 font-mono text-[0.75rem] font-bold text-severity-amber-300"
            >
              {segment}
            </mark>
          ) : (
            <span key={i}>{segment}</span>
          ),
        )}
      </p>

      <p className="mt-1.5 text-[0.6875rem] leading-snug text-slate-400">
        Replace{" "}
        {variables
          .map(
            (v) =>
              `{${v}}` +
              (ALERT_VARIABLE_SAMPLES[v]
                ? ` → e.g. ${ALERT_VARIABLE_SAMPLES[v]}`
                : " → add value"),
          )
          .join(" · ")}
      </p>
    </div>
  );
}

export default AlertComposer;
