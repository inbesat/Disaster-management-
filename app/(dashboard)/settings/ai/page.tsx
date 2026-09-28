"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import SettingsSection from "@/components/settings/SettingsSection";
import {
  DEFAULT_AI_SETTINGS,
  DRIP_AI_SETTINGS_KEY,
  readStoredAiSettings,
  type AiSettings,
} from "@/lib/settings/ai-settings";

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const saved = readStoredAiSettings();
    if (saved) setSettings(saved);
  }, []);
  function save() {
    try {
      localStorage.setItem(DRIP_AI_SETTINGS_KEY, JSON.stringify(settings));
      setError("");
      setNotice("Saved. New AI chat requests will use these preferences.");
    } catch {
      setError("Preferences could not be saved. Allow site storage and retry.");
    }
  }
  return (
    <div className="space-y-6">
      <SettingsSection
        title="AI response preferences"
        description="Saved on this device and applied to new command-advisor chats."
        icon={Bot}
      >
        <label className="block text-sm">
          Preferred provider
          <select
            className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-900 p-3"
            value={settings.provider}
            onChange={(e) => {
              setSettings((s) => ({
                ...s,
                provider: e.target.value as AiSettings["provider"],
              }));
              setNotice("");
            }}
          >
            <option value="groq-llama3">Groq</option>
            <option value="openai-gpt4o">OpenRouter</option>
            <option value="anthropic-claude35">OpenRouter (existing preference)</option>
            <option value="local-airgapped">Automatic provider selection</option>
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-400">
          The server selects an available configured model and falls back to another
          provider if needed.
        </p>
        <label className="mt-5 block text-sm">
          Response detail
          <select
            className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-900 p-3"
            value={settings.responseVerbosity}
            onChange={(e) => {
              setSettings((s) => ({
                ...s,
                responseVerbosity: e.target.value as AiSettings["responseVerbosity"],
              }));
              setNotice("");
            }}
          >
            <option value="concise">Concise</option>
            <option value="balanced">Balanced</option>
            <option value="detailed">Detailed</option>
          </select>
        </label>
        <fieldset className="mt-5">
          <legend className="text-sm">AI personality</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {(["professional", "collaborative", "urgent"] as const).map((personality) => (
              <button
                key={personality}
                type="button"
                aria-pressed={settings.personality === personality}
                onClick={() => {
                  setSettings((s) => ({ ...s, personality }));
                  setNotice("");
                }}
                className={`rounded-xl border p-3 capitalize ${settings.personality === personality ? "border-cyan-400 bg-cyan-400/10" : "border-white/20"}`}
              >
                {personality}
              </button>
            ))}
          </div>
        </fieldset>
        <button
          onClick={save}
          className="mt-6 rounded-lg bg-cyan-400 px-4 py-3 font-bold text-slate-950"
        >
          Save AI preferences
        </button>
        {notice && (
          <p role="status" className="mt-3 text-sm text-emerald-300">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </SettingsSection>
      <section className="space-y-3 rounded-xl border border-white/10 p-5">
        <h2 className="font-semibold">Connections and knowledge</h2>
        <p className="text-sm text-slate-400">
          Provider keys, available knowledge sources and tool access are managed by the
          server. Operational plans remain drafts for human review.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/settings/ai-setup"
            className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm"
          >
            Test AI connection
          </Link>
          <Link
            href="/knowledge-base"
            className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm"
          >
            Manage knowledge base
          </Link>
          <Link
            href="/settings/storage"
            className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm"
          >
            Offline model storage
          </Link>
        </div>
      </section>
    </div>
  );
}
