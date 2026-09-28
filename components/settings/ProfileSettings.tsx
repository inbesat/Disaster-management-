"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, UserRound } from "lucide-react";
import SettingsSection from "./SettingsSection";
import ColorblindToggle from "./ColorblindToggle";
import ReducedMotionToggle from "./ReducedMotionToggle";
import { useTranslation, type Locale } from "@/lib/i18n/LanguageContext";
import {
  AVATAR_ACCEPT,
  AVATAR_MAX_BYTES,
  AVATAR_CHANGED_EVENT,
  getStoredAvatar,
  initialsFor,
  isAvatarFile,
  setStoredAvatar,
} from "@/lib/settings/avatar";
import { ROLE_LABELS, type Role } from "@/lib/validations/user";

type Member = { id: string; name: string; relation: string; phone: string };
type Profile = {
  name: string;
  email: string;
  phone: string;
  org: string;
  location: string;
  family: Member[];
};
const EMPTY: Profile = {
  name: "",
  email: "",
  phone: "",
  org: "",
  location: "",
  family: [],
};
const LANGUAGES: [Locale, string][] = [
  ["en", "English"],
  ["hi", "Hindi"],
  ["bn", "Bengali"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["mr", "Marathi"],
  ["gu", "Gujarati"],
  ["kn", "Kannada"],
  ["ml", "Malayalam"],
  ["pa", "Punjabi"],
  ["or", "Odia"],
  ["as", "Assamese"],
];
const inputClass =
  "mt-1 w-full rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white";

export default function ProfileSettings({
  storageKey,
  role,
}: {
  storageKey: string;
  role: string;
}) {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState<Profile>(EMPTY);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [member, setMember] = useState({ name: "", relation: "", phone: "" });
  const [avatar, setAvatar] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const { language, setLanguage } = useTranslation();
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const data = JSON.parse(raw) as Profile;
        if (
          ![data.name, data.email, data.phone, data.org, data.location].every(
            (v) => typeof v === "string",
          ) ||
          !Array.isArray(data.family)
        )
          throw new Error("Invalid saved profile");
        setProfile(data);
        setSaved(data);
      }
      setAvatar(getStoredAvatar());
    } catch {
      setError(
        "Your saved profile could not be loaded. Browser storage may be unavailable.",
      );
    }
    setReady(true);
  }, [storageKey]);
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);
  function change(key: keyof Omit<Profile, "family">, value: string) {
    setProfile((p) => ({ ...p, [key]: value }));
    setNotice("");
  }
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(profile));
      setSaved(profile);
      setError("");
      setNotice("Profile saved on this device.");
    } catch {
      setError(
        "Profile could not be saved. Allow site storage or free some space, then retry.",
      );
    }
  }
  async function upload(image: File | undefined) {
    if (!image) return;
    if (!isAvatarFile(image) || image.size > AVATAR_MAX_BYTES) {
      setError("Choose a PNG, JPEG or WebP image under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const value = String(reader.result);
        setStoredAvatar(value);
        if (getStoredAvatar() !== value) throw new Error("Storage unavailable");
        setAvatar(value);
        window.dispatchEvent(new Event(AVATAR_CHANGED_EVENT));
        setNotice("Photo saved on this device.");
        setError("");
      } catch {
        setError("Photo could not be saved. Try a smaller image.");
      }
    };
    reader.onerror = () => setError("The photo could not be read.");
    reader.readAsDataURL(image);
  }
  function locate() {
    if (!navigator.geolocation) {
      setError("Location is not supported by this browser.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        change(
          "location",
          `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`,
        );
        setLocating(false);
      },
      () => {
        setError(
          "Location could not be obtained. Allow location access or enter it manually.",
        );
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }
  return (
    <div className="space-y-6">
      <SettingsSection
        title="Identity & Profile"
        description="Your details and emergency contacts, saved on this device."
        icon={UserRound}
      >
        <div className="flex items-center gap-4">
          <input
            type="file"
            ref={file}
            accept={AVATAR_ACCEPT.join(",")}
            hidden
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => file.current?.click()}
            aria-label="Upload profile photo"
            className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-slate-800 text-2xl"
          >
            {avatar ? (
              <Image
                src={avatar}
                alt="Your profile photo"
                width={96}
                height={96}
                unoptimized
              />
            ) : (
              initialsFor(profile.name || "SafeSphere")
            )}
            <Camera className="absolute bottom-2 right-2 h-5 w-5 rounded bg-slate-900" />
          </button>
          <p className="text-sm text-slate-300">
            Portal role: {ROLE_LABELS[role as Role] ?? role.replaceAll("_", " ")}
          </p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(
            [
              ["name", "Full name"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["org", "Organization"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm text-slate-300">
              {label}
              <input
                className={inputClass}
                value={profile[key]}
                onChange={(e) => change(key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </SettingsSection>
      <section className="rounded-xl border border-white/10 p-5">
        <h2 className="font-semibold">Language</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {LANGUAGES.map(([code, label]) => (
            <button
              key={code}
              type="button"
              aria-pressed={language === code}
              onClick={() => setLanguage(code)}
              className={`rounded-lg border px-3 py-2 text-sm ${language === code ? "border-cyan-400 bg-cyan-400/10" : "border-white/20"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Family contacts</h2>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="rounded-lg border border-cyan-400/40 px-3 py-2 text-sm text-cyan-200"
          >
            {adding ? "Cancel" : "+ Add Member"}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Private contact list on this device. Adding someone does not send them a
          message.
        </p>
        {adding && (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              setProfile((p) => ({
                ...p,
                family: [...p.family, { ...member, id: crypto.randomUUID() }],
              }));
              setMember({ name: "", relation: "", phone: "" });
              setAdding(false);
            }}
          >
            {(
              [
                ["name", "Member name"],
                ["relation", "Relationship"],
                ["phone", "Contact phone"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-sm">
                {label}
                <input
                  required
                  className={inputClass}
                  value={member[key]}
                  onChange={(e) => setMember((m) => ({ ...m, [key]: e.target.value }))}
                />
              </label>
            ))}
            <button className="rounded-lg bg-cyan-400 px-3 py-2 font-bold text-slate-950">
              Add contact
            </button>
          </form>
        )}
        <ul className="mt-3 space-y-2">
          {profile.family.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 p-3"
            >
              <div>
                <p>{m.name}</p>
                <p className="text-xs text-slate-400">
                  {m.relation} · {m.phone}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${m.name}`}
                onClick={() =>
                  setProfile((p) => ({
                    ...p,
                    family: p.family.filter((v) => v.id !== m.id),
                  }))
                }
                className="text-sm text-red-300"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        {!profile.family.length && (
          <p className="mt-3 text-sm text-slate-400">No family contacts saved.</p>
        )}
      </section>
      <section className="rounded-xl border border-white/10 p-5">
        <label className="text-sm font-semibold">
          Home location
          <input
            value={profile.location}
            onChange={(e) => change("location", e.target.value)}
            className={inputClass}
            placeholder="Address or coordinates"
          />
        </label>
        <button
          type="button"
          disabled={locating}
          onClick={locate}
          className="mt-3 rounded-lg border border-cyan-400/40 px-3 py-2 text-sm"
        >
          {locating ? "Locating…" : "Use GPS"}
        </button>
      </section>
      <section className="space-y-3 rounded-xl border border-white/10 p-5">
        <h2 className="font-semibold">Accessibility</h2>
        <ColorblindToggle />
        <ReducedMotionToggle />
      </section>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-300">
          {notice}
        </p>
      )}
      <div className="flex justify-end gap-3 pb-5">
        <button
          type="button"
          disabled={!dirty}
          onClick={() => {
            setProfile(saved);
            setNotice("Changes discarded.");
          }}
          className="rounded-lg border border-white/20 px-4 py-3 disabled:opacity-40"
        >
          Discard
        </button>
        <button
          type="button"
          disabled={!ready || !dirty}
          onClick={save}
          className="rounded-lg bg-cyan-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-40"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
