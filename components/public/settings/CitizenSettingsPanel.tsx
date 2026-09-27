"use client";

// components/public/settings/CitizenSettingsPanel.tsx — Phase 2 · Step 1
// (Public Settings). Strictly CITIZEN-tailored emergency settings — no
// roles, no system config, no admin. Four mobile-first sections matching
// the public dashboard's dl-* design language:
//   1. Personal & Medical Info  — name, read-only phone, blood group.
//   2. Emergency Contacts       — Family Circle, up to 3 trusted numbers
//                                 (SMS'd on SOS / "I am safe").
//   3. Alert & Language         — language + Push/SMS/WhatsApp toggles
//                                 + Critical Alert Override (bypass DND).
//   4. Device & Connectivity    — Extreme Low-Bandwidth Mode, high
//                                 contrast, quick links.
// Persistence (all localStorage): `citizen_profile`, `citizen_family_contacts`
// (the exact shape /public/setup/family + FamilyStrip + SOS read), and
// `citizen_notification_prefs`. Language/low-bandwidth/high-contrast persist
// via their existing contexts and apply immediately.
// Rendered by app/public/settings/page.tsx (a server shell that passes the
// httpOnly `citizen_phone` cookie down).

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  DownloadCloud,
  FlaskConical,
  HeartPulse,
  History,
  Loader2,
  Phone,
  Plus,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  User,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { indianPhoneSchema } from "@/lib/validations/user";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { LOCALE_OPTIONS } from "@/lib/i18n/locales";
import { useBandwidth } from "@/lib/contexts/BandwidthContext";
import { useHighContrast } from "@/lib/contexts/HighContrastContext";
import { getLocalLLMProvider } from "@/lib/ai/LocalLLMProvider";
import {
  checkHardwareCapability,
  type HardwareCapability,
} from "@/lib/ai/AIBridge";
import { isDemoModeEnabled, setDemoModeEnabled } from "@/lib/demo/scenarios";
import { showToast } from "@/components/ui/Toast";
import BottomNav from "@/components/public/BottomNav";
import PwaInstallCard from "@/components/pwa/PwaInstallCard";

const PROFILE_KEY = "citizen_profile";
const CONTACTS_KEY = "citizen_family_contacts";
const NOTIF_KEY = "citizen_notification_prefs";
const MAX_CONTACTS = 3;

const BLOOD_GROUPS = [
  "Unknown",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

type Contact = { name: string; phone: string };

type NotifPrefs = {
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
  bypassDnd: boolean;
};

const DEFAULT_NOTIF: NotifPrefs = {
  push: true,
  sms: true,
  whatsapp: true,
  bypassDnd: true,
};

/** SSR-safe JSON read that merges a fallback under any stored value. */
function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

/** Citizen orange switch — role="switch", keyboard-usable. */
function ToggleRow({
  label,
  caption,
  checked,
  onChange,
  tone = "orange",
}: {
  label: string;
  caption?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  tone?: "orange" | "red";
}) {
  const activeTone = tone === "red" ? "#ef4444" : "#F97316";
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">{label}</p>
        {caption && <p className="mt-0.5 text-xs text-[var(--dl-text-muted)]">{caption}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)] ${
          checked ? "" : "bg-white/15"
        }`}
        style={checked ? { backgroundColor: activeTone } : undefined}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  caption,
  children,
}: {
  icon: LucideIcon;
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[var(--dl-radius)] border border-white/10 bg-white/5 p-4 backdrop-blur sm:p-5">
      <header className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F97316]/15 text-[var(--brand-orangeLight)] ring-1 ring-[#F97316]/30">
          <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />
        </span>
        <div>
          <h2 className="text-base font-bold text-white">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--dl-text-muted)]">
            {caption}
          </p>
        </div>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type CitizenSettingsPanelProps = {
  /** The citizen's verified phone (from the `citizen_phone` cookie). */
  initialPhone: string;
  /** True while browsing as a guest (no phone/identity). */
  isGuest: boolean;
};

export default function CitizenSettingsPanel({
  initialPhone,
  isGuest,
}: CitizenSettingsPanelProps) {
  const { language, setLanguage } = useTranslation();
  const { isLowBandwidthMode, setLowBandwidthMode } = useBandwidth();
  const { isHighContrast, setHighContrast } = useHighContrast();

  const [name, setName] = useState("");
  const [bloodGroup, setBloodGroup] = useState<string>("Unknown");
  const [contacts, setContacts] = useState<Contact[]>([{ name: "", phone: "" }]);
  const [notif, setNotif] = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Offline AI model download state — 0..1 while streaming, null when idle.
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // Device Capability Check — gates the ~1.3GB download on WebGPU + RAM.
  const [capability, setCapability] = useState<HardwareCapability | null>(null);
  useEffect(() => {
    setCapability(checkHardwareCapability());
  }, []);

  // Phase 12 · Demo Mode toggle — hydrates from localStorage (never SSR).
  const [demoMode, setDemoMode] = useState(false);
  useEffect(() => {
    setDemoMode(isDemoModeEnabled());
  }, []);

  async function handleDownloadModel() {
    if (modelProgress !== null || modelReady) return;
    setModelError(null);
    setModelProgress(0);
    try {
      const ok = await getLocalLLMProvider().initializeModel((p) =>
        setModelProgress(p),
      );
      if (ok) {
        setModelReady(true);
        setModelProgress(null);
        showToast("success", {
          id: "offline-ai-ready",
          title: "Local AI ready",
          description: "Nova can now answer without internet.",
        });
      } else {
        setModelProgress(null);
        setModelError(
          "The download couldn't start — WebLLM isn't available on this device or browser. Connect to the internet and try again.",
        );
      }
    } catch {
      setModelProgress(null);
      setModelError("The download couldn't start. Please try again.");
    }
  }

  // Hydrate from localStorage on mount (server snapshot = defaults so SSR
  // HTML and the first client paint agree — no hydration mismatch).
  useEffect(() => {
    const profile = readJSON<{ name?: string; bloodGroup?: string }>(PROFILE_KEY, {});
    if (profile.name) setName(profile.name);
    if (profile.bloodGroup) setBloodGroup(profile.bloodGroup);

    const saved = readJSON<{ contacts?: Contact[] }>(CONTACTS_KEY, {});
    setContacts(
      saved.contacts?.length
        ? saved.contacts.map((c) => ({ name: c.name, phone: c.phone }))
        : [{ name: "", phone: "" }],
    );

    setNotif(readJSON<NotifPrefs>(NOTIF_KEY, DEFAULT_NOTIF));
  }, []);

  function updateContact(index: number, patch: Partial<Contact>) {
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    setError(null);
  }

  function removeContact(index: number) {
    setContacts((prev) =>
      prev.length === 1
        ? [{ name: "", phone: "" }]
        : prev.filter((_, i) => i !== index),
    );
    setError(null);
  }

  function addContact() {
    if (contacts.length >= MAX_CONTACTS) return;
    setContacts((prev) => [...prev, { name: "", phone: "" }]);
    setError(null);
  }

  function setNotifChannel(key: keyof NotifPrefs, value: boolean) {
    setNotif((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable — the in-memory choice still applies.
      }
      return next;
    });
  }

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const filled = contacts.filter((c) => c.name.trim() || c.phone.trim());
    const normalized = filled.map((c) => ({
      name: c.name.trim(),
      phone: c.phone.replace(/[\s-]/g, ""),
    }));
    for (const contact of normalized) {
      if (contact.name.length < 2) {
        setError("Enter each trusted contact's name.");
        return;
      }
      if (!indianPhoneSchema.safeParse(contact.phone).success) {
        setError("Enter a valid Indian phone number (e.g. +919876543210).");
        return;
      }
    }

    try {
      window.localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ name: name.trim(), bloodGroup, savedAt: new Date().toISOString() }),
      );
      window.localStorage.setItem(
        CONTACTS_KEY,
        JSON.stringify({ contacts: normalized, savedAt: new Date().toISOString() }),
      );
      window.localStorage.setItem(NOTIF_KEY, JSON.stringify(notif));
    } catch {
      // Best-effort — a full store is not fatal.
    }

    setError(null);
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      showToast("success", {
        id: "citizen-settings-saved",
        title: "Settings saved",
        description: "Your profile, Family Circle and alert preferences are up to date.",
      });
    }, 450);
  }

  const filledContacts = contacts.filter((c) => c.name.trim() || c.phone.trim()).length;

  return (
    <main className="relative flex min-h-screen flex-col bg-[var(--dl-navy)] text-[var(--dl-text-on-navy)]">
      {/* Ambient backdrop — same treatment as the public dashboard */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_80%_-10%,rgba(37,99,235,0.22),transparent),radial-gradient(ellipse_45%_40%_at_0%_110%,rgba(249,115,22,0.14),transparent)]"
      />

      {/* Sticky header */}
      <header className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[var(--dl-navy)]/85 px-4 pb-3 pt-5 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <Link
            href="/public/dashboard"
            aria-label="Back to dashboard"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition hover:border-[var(--dl-orange)]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)]"
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Settings</h1>
            <p className="eoc-label text-[var(--dl-text-muted)]">CITIZEN APP</p>
          </div>
        </div>
        <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.6875rem] font-medium text-[var(--dl-text-muted)] sm:block">
          {isGuest
            ? "GUEST MODE"
            : initialPhone
              ? `+91 ${initialPhone.slice(-4).padStart(4, "\u2022")}`
              : "NOT SIGNED IN"}
        </span>
      </header>

      {/* Responsive column — max-w-3xl per the settings spec. */}
      <div className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-[calc(88px+env(safe-area-inset-bottom))]">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1 · Personal & Medical Info */}
          <SettingsSection
            icon={User}
            title="Personal & Medical Info"
            caption="Your identity for rescue teams on the ground."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="eoc-label mb-1.5 block text-[var(--dl-text-muted)]">
                  NAME
                </span>
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-[var(--dl-radius-sm)] border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-[var(--dl-text-muted)] transition focus:border-[var(--dl-orange)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="eoc-label mb-1.5 block text-[var(--dl-text-muted)]">
                  PHONE (VERIFIED)
                </span>
                <div className="relative">
                  <Phone
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dl-text-muted)]"
                  />
                  <input
                    type="tel"
                    value={isGuest ? "Not provided (guest)" : initialPhone || "Not provided"}
                    readOnly
                    disabled
                    aria-label="Phone number (verified)"
                    className="w-full rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-base text-[var(--dl-text-muted)] opacity-80"
                  />
                </div>
                <span className="mt-1 block text-[0.6875rem] text-[var(--dl-text-muted)]">
                  Verified on sign-in — phone can&apos;t be edited here.
                </span>
              </label>
            </div>

            <label className="mt-4 block">
              <span className="eoc-label mb-1.5 block text-[var(--dl-text-muted)]">
                BLOOD GROUP (MEDICAL RESCUE)
              </span>
              <div className="relative">
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  aria-label="Blood group"
                  className="w-full appearance-none rounded-[var(--dl-radius-sm)] border border-white/15 bg-[var(--brand-navy2)] px-4 py-3 text-base text-white transition focus:border-[var(--dl-orange)] focus:outline-none"
                >
                  {BLOOD_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group === "Unknown" ? "Not sure / unknown" : group}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dl-text-muted)]"
                />
              </div>
            </label>
          </SettingsSection>

          {/* Section 2 · Emergency Contacts (Family Circle) */}
          <SettingsSection
            icon={HeartPulse}
            title="Emergency Contacts (Family Circle)"
            caption={`SMS'd the moment you hit SOS or "I am safe" — up to ${MAX_CONTACTS} trusted numbers.`}
          >
            <div className="space-y-3">
              {contacts.map((contact, index) => (
                <div
                  key={index}
                  className="rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="eoc-label text-[var(--dl-text-muted)]">
                      CONTACT {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeContact(index)}
                      aria-label={`Remove contact ${index + 1}`}
                      className="rounded-full p-1.5 text-[var(--dl-text-muted)] transition hover:bg-white/10 hover:text-white"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Name"
                      aria-label={`Contact ${index + 1} name`}
                      value={contact.name}
                      onChange={(e) => updateContact(index, { name: e.target.value })}
                      className="w-full rounded-[var(--dl-radius-sm)] border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--dl-text-muted)] transition focus:border-[var(--dl-orange)] focus:outline-none"
                    />
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+91 98765 43210"
                      aria-label={`Contact ${index + 1} phone`}
                      value={contact.phone}
                      onChange={(e) => updateContact(index, { phone: e.target.value })}
                      className="w-full rounded-[var(--dl-radius-sm)] border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--dl-text-muted)] transition focus:border-[var(--dl-orange)] focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              {contacts.length < MAX_CONTACTS ? (
                <button
                  type="button"
                  onClick={addContact}
                  className="flex w-full items-center justify-center gap-2 rounded-[var(--dl-radius-sm)] border-2 border-dashed border-[var(--dl-orange)]/40 bg-transparent px-4 py-3 text-sm font-semibold text-[var(--dl-orange-light)] transition hover:border-[var(--dl-orange)] hover:bg-[var(--dl-orange)]/10"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Add Trusted Contact
                </button>
              ) : (
                <p className="rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm text-[var(--dl-text-on-navy)]">
                  Family Circle full — up to {MAX_CONTACTS} trusted numbers.
                </p>
              )}
              <p className="mt-2 text-center font-mono text-[0.6875rem] uppercase tracking-widest text-[var(--dl-text-muted)]">
                {filledContacts} of {MAX_CONTACTS} slots used
              </p>
            </div>
          </SettingsSection>

          {/* Section 3 · Alert & Language Preferences */}
          <SettingsSection
            icon={Bell}
            title="Alert & Language Preferences"
            caption="How and in which language you want to be reached."
          >
            <label className="block">
              <span className="eoc-label mb-1.5 block text-[var(--dl-text-muted)]">
                LANGUAGE
              </span>
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) =>
                    setLanguage(e.target.value as (typeof LOCALE_OPTIONS)[number]["code"])
                  }
                  aria-label="App language"
                  className="w-full appearance-none rounded-[var(--dl-radius-sm)] border border-white/15 bg-[var(--brand-navy2)] px-4 py-3 text-base text-white transition focus:border-[var(--dl-orange)] focus:outline-none"
                >
                  {LOCALE_OPTIONS.map(({ code, nativeLabel }) => (
                    <option key={code} value={code}>
                      {nativeLabel}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dl-text-muted)]"
                />
              </div>
              <span className="mt-1 block text-[0.6875rem] text-[var(--dl-text-muted)]">
                Applies instantly — alerts read in this language.
              </span>
            </label>

            <div className="mt-5 divide-y divide-white/5 rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/5">
              <ToggleRow
                label="Push Notifications"
                caption="Banner + sound for live alerts on this device."
                checked={notif.push}
                onChange={(next) => setNotifChannel("push", next)}
              />
              <ToggleRow
                label="SMS Alerts"
                caption="Text message fallback when data networks fail."
                checked={notif.sms}
                onChange={(next) => setNotifChannel("sms", next)}
              />
              <ToggleRow
                label="WhatsApp Alerts"
                caption="Alert copies pushed to your WhatsApp."
                checked={notif.whatsapp}
                onChange={(next) => setNotifChannel("whatsapp", next)}
              />
            </div>

            {/* Critical Alert Override — the ShieldAlert call-out */}
            <div className="mt-4 rounded-[var(--dl-radius-sm)] border border-severity-red-500/30 bg-severity-red-500/10 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-severity-red-500/15 text-severity-red-300">
                  <ShieldAlert aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">
                    Critical Alert Override
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--dl-text-muted)]">
                    Bypass Do-Not-Disturb for critical evacuation warnings — the
                    siren always breaks through, even on silent.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notif.bypassDnd}
                  aria-label="Bypass do-not-disturb for critical evacuations"
                  onClick={() => setNotifChannel("bypassDnd", !notif.bypassDnd)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-severity-red-400 ${
                    notif.bypassDnd ? "" : "bg-white/15"
                  }`}
                  style={notif.bypassDnd ? { backgroundColor: "#ef4444" } : undefined}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
                      notif.bypassDnd ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </SettingsSection>

          {/* Section 4 · Device & Connectivity */}
          <SettingsSection
            icon={Wifi}
            title="Device & Connectivity"
            caption="Stay reachable when the network gets rough."
          >
            <div className="divide-y divide-white/5 rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/5">
              <ToggleRow
                label="Extreme Low-Bandwidth Mode"
                caption="Disables maps and images to save battery/data during outages."
                checked={isLowBandwidthMode}
                onChange={(next) => setLowBandwidthMode(next)}
              />
              <ToggleRow
                label="High Contrast Mode"
                caption="Pure black & white for low-light and low-vision conditions."
                checked={isHighContrast}
                onChange={(next) => setHighContrast(next)}
              />
            </div>

            {isLowBandwidthMode && (
              <p className="mt-3 flex items-start gap-2 rounded-[var(--dl-radius-sm)] border border-[var(--dl-orange)]/30 bg-[var(--dl-orange)]/10 px-3 py-2.5 text-[0.75rem] font-medium text-[var(--dl-orange-light)]">
                <WifiOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                Active — maps, images and the AI assistant are hidden until you
                switch this off.
              </p>
            )}

            {/* Quick links to the deeper citizen settings */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Link
                href="/public/settings/alerts"
                className="flex items-center gap-3 rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/20 active:scale-[0.99]"
              >
                <Bell aria-hidden="true" className="h-4 w-4 text-[var(--dl-orange-light)]" />
                <span className="flex-1 text-sm font-semibold text-white">
                  Alert Preferences
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 -rotate-90 text-[var(--dl-text-muted)]"
                />
              </Link>
              <Link
                href="/public/settings/sos-history"
                className="flex items-center gap-3 rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/20 active:scale-[0.99]"
              >
                <History aria-hidden="true" className="h-4 w-4 text-[var(--dl-orange-light)]" />
                <span className="flex-1 text-sm font-semibold text-white">SOS History</span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 -rotate-90 text-[var(--dl-text-muted)]"
                />
              </Link>
            </div>
          </SettingsSection>

          {/* Section 5 · Offline AI Safety Model */}
          <SettingsSection
            icon={Bot}
            title="Offline AI Safety Model"
            caption="Download the small safety model so Nova keeps answering during a network blackout — it runs entirely on this device."
          >
            {/* Device Capability Check — gates the ~1.3GB download on WebGPU + RAM. */}
            {capability && (
              <div className="mb-4 rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/5 p-4">
                <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--dl-text-muted)]">
                  Device Capability Check
                </p>
                <div className="mt-2 space-y-1.5 text-xs font-semibold">
                  <div className="flex items-center justify-between">
                    <span className="text-white/80">WebGPU Supported</span>
                    <span className={capability.webgpu ? "text-[#86efac]" : "text-severity-red-300"}>
                      {capability.webgpu ? "Yes ✅" : "No ❌"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/80">RAM &gt; 4GB</span>
                    <span className={capability.memoryGb >= 4 ? "text-[#86efac]" : "text-severity-red-300"}>
                      {capability.memoryGb >= 4 ? "Yes ✅" : "No ❌"}
                    </span>
                  </div>
                </div>
                {!capability.supported && (
                  <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--dl-text-muted)]">
                    Your device uses the Lightweight Offline Logic Engine to
                    save memory — safety answers still work offline.
                  </p>
                )}
              </div>
            )}
            {modelReady ? (
              <div className="flex items-start gap-3 rounded-[var(--dl-radius-sm)] border border-[#16a34a]/40 bg-[#16a34a]/10 p-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#16a34a]/15 text-[#86efac]">
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#86efac]">Local AI Ready ✅</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--dl-text-muted)]">
                    Nova can answer offline — safety questions work with no
                    internet at all.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleDownloadModel()}
                  disabled={modelProgress !== null || (capability !== null && !capability.supported)}
                  className="flex w-full items-center justify-center gap-2 rounded-[var(--dl-radius-sm)] bg-[var(--dl-orange)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#EA5B0C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {modelProgress !== null ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <DownloadCloud aria-hidden="true" className="h-4 w-4" />
                  )}
                  {modelProgress !== null
                    ? "Downloading…"
                    : "Download Local AI (~1.3GB)"}
                </button>

                {/* Live download progress from the initializeModel callback. */}
                {modelProgress !== null && (
                  <div className="mt-3">
                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(modelProgress * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="AI model download progress"
                      className="h-2.5 w-full overflow-hidden rounded-full bg-white/10"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--brand-orange)] to-[#16a34a] transition-[width] duration-200"
                        style={{ width: `${Math.round(modelProgress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-right font-mono text-[0.6875rem] text-[var(--dl-text-muted)]">
                      {Math.round(modelProgress * 100)}% downloaded
                    </p>
                  </div>
                )}

                {modelError && (
                  <p
                    role="alert"
                    className="mt-3 flex items-start gap-2 rounded-[var(--dl-radius-sm)] border border-severity-red-500/30 bg-severity-red-500/10 px-3 py-2.5 text-[0.75rem] font-medium text-severity-red-300"
                  >
                    <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    {modelError}
                  </p>
                )}
              </>
            )}

            {!modelReady && modelProgress === null && !modelError && (
              <p className="mt-3 text-[0.6875rem] leading-relaxed text-[var(--dl-text-muted)]">
                {capability && !capability.supported
                  ? "Your device uses the Lightweight Offline Logic Engine to save memory — safety answers still work offline."
                  : "~1.3GB · downloads once into your browser · requires WebGPU or a modern browser."}
              </p>
            )}
          </SettingsSection>

          {/* Phase 12 · Step 2 — Demo Mode toggle for the live pitch. */}
          <SettingsSection
            icon={FlaskConical}
            title="Testing & Demo"
            caption="Pitch-day extras — rehearse the offline, low-battery and model-failure scenarios judges love to ask about."
          >
            <div className="divide-y divide-white/5 rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/5">
              <ToggleRow
                label="Demo Mode"
                caption="Shows the floating scenario controls."
                checked={demoMode}
                tone="red"
                onChange={(next) => {
                  setDemoModeEnabled(next);
                  setDemoMode(next);
                  showToast(next ? "success" : "info", {
                    id: "demo-mode-toggle",
                    title: next ? "🖥️ Demo Mode ON" : "Demo Mode OFF",
                    description: next
                      ? "Look for the red 'Demo' tab on the left edge."
                      : "Demo controls hidden until re-enabled.",
                  });
                }}
              />
            </div>
          </SettingsSection>

          {error && (
            <p
              role="alert"
              className="rounded-[var(--dl-radius-sm)] border border-[var(--dl-orange)]/40 bg-[var(--dl-orange)]/10 px-3 py-2.5 text-sm text-[var(--dl-orange-light)]"
            >
              {error}
            </p>
          )}

          {/* Save bar */}
          <div className="mt-8 block">
            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--dl-radius)] bg-[var(--dl-orange)] px-6 py-4 text-base font-bold text-white shadow-[0_10px_32px_rgba(234,88,12,0.4)] transition hover:bg-[#EA5B0C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)] disabled:opacity-60"
            >
              {saving ? (
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="h-5 w-5" />
              )}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>

        {/* Phase 13 · Step 3 — PWA install status / action. */}
        <div className="mt-6">
          <PwaInstallCard />
        </div>
      </div>

      {/* Sticky citizen bottom nav */}
      <BottomNav />
    </main>
  );
}
