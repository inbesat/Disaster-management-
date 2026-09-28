"use client";

// ---------------------------------------------------------------------
// app/(dashboard)/settings/organization/page.tsx — UI/UX Phase 7 · Step 7.
//
// Admin organisation parameters:
//   • district cards with mini map thumbnails
//   • "Danger Mark" sliders whose live preview badges shift green → red as
//     the river level rises
//   • role × action permission matrix (sticky headers, checkbox cells)
// All wrapped in SettingsSection with a red "Admin Only" badge on the title.
// ---------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Building2, MapPin, ShieldAlert, Users, Package } from "lucide-react";
import SettingsSection from "@/components/settings/SettingsSection";
import Toggle from "@/components/settings/Toggle";
import Link from "next/link";

type District = {
  id: string;
  name: string;
  population: string;
  active: boolean;
  warning: number;
  critical: number;
};

const DEFAULT_DISTRICTS: District[] = [
  {
    id: "d1",
    name: "Patna",
    population: "1.9M",
    active: true,
    warning: 2.5,
    critical: 3.4,
  },
  {
    id: "d2",
    name: "Purba Champaran",
    population: "0.9M",
    active: true,
    warning: 2.2,
    critical: 3.1,
  },
  {
    id: "d3",
    name: "Ernakulam",
    population: "0.7M",
    active: false,
    warning: 2.0,
    critical: 2.9,
  },
];

const ROLES = ["Super Admin", "Admin", "Incident Cmdr", "Responder", "Viewer"] as const;
const ACTIONS = [
  "Approve evacuation",
  "Dispatch boats",
  "Modify thresholds",
  "Read audit log",
  "Review field reports",
] as const;

// baseRoles: role index → allowed action flags
const DEFAULT_MATRIX: boolean[][] = [
  [true, true, true, true, true],
  [true, true, false, true, true],
  [true, true, false, false, false],
  [false, false, false, false, false],
  [false, false, false, true, false],
];

function dangerHue(value: number, min: number, max: number): number {
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return Math.round(142 - t * 142); // 142 (green) → 0 (red)
}

const dangerBadge = (hue: number) => ({
  color: `hsl(${hue} 85% 55%)`,
  borderColor: `hsl(${hue} 85% 55% / 0.4)`,
  backgroundColor: `hsl(${hue} 85% 55% / 0.12)`,
});

function DangerSlider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const hue = dangerHue(value, min, max);
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span
          className="rounded-full border px-2 py-px font-mono text-eoc-tiny font-bold tabular-nums"
          style={dangerBadge(hue)}
        >
          {label} · {value.toFixed(1)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.1}
        value={value}
        aria-label={`${label} for river level`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-purple-500"
        style={{
          background: `linear-gradient(to right, hsl(${hue} 85% 55%) 0%, hsl(${hue} 85% 55%) ${pct}%, #1e293b ${pct}%, #1e293b 100%)`,
        }}
      />
    </div>
  );
}

export default function OrganizationSettingsPage() {
  const [districts, setDistricts] = useState<District[]>(DEFAULT_DISTRICTS);
  const [matrix, setMatrix] = useState<boolean[][]>(DEFAULT_MATRIX);

  const [shelterWarning, setShelterWarning] = useState(80);
  const [lowStock, setLowStock] = useState(20);
  const [escalation, setEscalation] = useState(30);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem("safesphere:operations") || "null");
      if (!data) return;
      if (
        Array.isArray(data.districts) &&
        data.districts.length === DEFAULT_DISTRICTS.length &&
        data.districts.every(
          (d: District) =>
            typeof d.name === "string" &&
            Number.isFinite(d.warning) &&
            Number.isFinite(d.critical),
        )
      )
        setDistricts(data.districts);
      if (
        Array.isArray(data.matrix) &&
        data.matrix.length === ROLES.length &&
        data.matrix.every(
          (row: unknown) =>
            Array.isArray(row) &&
            row.length === ACTIONS.length &&
            row.every((v) => typeof v === "boolean"),
        )
      )
        setMatrix(data.matrix);
      if (Number.isFinite(data.lowStock) && data.lowStock >= 5 && data.lowStock <= 50)
        setLowStock(data.lowStock);
      if (
        Number.isFinite(data.shelterWarning) &&
        data.shelterWarning >= 50 &&
        data.shelterWarning <= 100
      )
        setShelterWarning(data.shelterWarning);
      if (
        Number.isFinite(data.escalation) &&
        data.escalation >= 5 &&
        data.escalation <= 120
      )
        setEscalation(data.escalation);
    } catch {
      setError("Saved planning preferences could not be loaded.");
    }
  }, []);
  function save() {
    if (districts.some((d) => d.warning >= d.critical)) {
      setError("Each danger mark must be above its warning mark.");
      return;
    }
    try {
      localStorage.setItem(
        "safesphere:operations",
        JSON.stringify({ districts, matrix, shelterWarning, lowStock, escalation }),
      );
      setNotice(
        "Planning preferences saved on this device. The low-stock threshold is applied in Inventory.",
      );
      setError("");
    } catch {
      setError("Preferences could not be saved. Check browser storage and retry.");
    }
  }

  const updateDistrict = (id: string, patch: Partial<District>) => {
    setDistricts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const toggleCell = (roleIdx: number, actionIdx: number) => {
    if (roleIdx === 0) return; // Super Admin permissions are locked
    setMatrix((prev) =>
      prev.map((row, r) =>
        r === roleIdx ? row.map((v, c) => (c === actionIdx ? !v : v)) : row,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title={
          <span className="flex items-center gap-2">
            Organization &amp; Districts
            <span className="flex items-center gap-1 rounded-full border border-accent-danger/40 bg-accent-danger/10 px-2 py-0.5 text-eoc-tiny font-bold uppercase tracking-widest text-accent-danger">
              <ShieldAlert className="h-3 w-3" aria-hidden />
              Admin Only
            </span>
          </span>
        }
        description="Planning references saved on this device. Saving does not send alerts, dispatch resources or change login access."
        icon={Building2}
      >
        <div>
          {/* District cards */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {districts.map((district) => (
              <div
                key={district.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
              >
                {/* Mini map thumbnail placeholder */}
                <div className="relative h-24 bg-gradient-to-br from-[#1e293b] to-[#0b1220]">
                  <div className="absolute left-4 right-4 top-1/2 h-8 -translate-y-1/2 rounded-md border border-white/10" />
                  <div className="absolute left-1/2 top-3 h-16 w-16 -translate-x-1/2 rotate-6 rounded-sm border border-white/10" />
                  <div className="absolute left-[30%] top-[30%] h-8 w-8 rotate-45 rounded-sm border border-purple-400/30" />
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 font-mono text-eoc-tiny text-slate-200">
                    <MapPin className="h-3 w-3 text-purple-400" aria-hidden />
                    {district.name}
                  </span>
                </div>

                <div className="flex flex-col gap-4 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-200">{district.name}</p>
                      <p className="text-[11px] text-slate-500">
                        Population {district.population}
                      </p>
                    </div>
                    <Toggle
                      checked={district.active}
                      onChange={(v) => updateDistrict(district.id, { active: v })}
                      label={`${district.name} active`}
                    />
                  </div>

                  <DangerSlider
                    label="Warning mark"
                    value={district.warning}
                    min={1.5}
                    max={2.9}
                    unit="m"
                    onChange={(v) => updateDistrict(district.id, { warning: v })}
                  />
                  <DangerSlider
                    label="Danger mark"
                    value={district.critical}
                    min={2.6}
                    max={4}
                    unit="m"
                    onChange={(v) => updateDistrict(district.id, { critical: v })}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            Slider badges interpolate green → red: keep danger marks high enough for early
            warning while avoiding fatigue.
          </p>
        </div>
      </SettingsSection>

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
      {/* Team Member Grid */}
      <SettingsSection
        title="Team Members"
        description="View the shared responder directory and profile details."
        icon={Users}
      >
        <Link
          href="/directory"
          className="inline-block rounded-lg border border-cyan-400/40 px-4 py-3 text-cyan-200"
        >
          Open Team &amp; Responders →
        </Link>
      </SettingsSection>

      {/* Operational Parameters */}
      <SettingsSection
        title="Operational Parameters"
        description="Inventory uses the low-stock threshold. Shelter and escalation values are planning references for manual review."
        icon={Package}
      >
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Shelter capacity warning</span>
              <span className="text-sm font-mono font-bold text-purple-300">
                {shelterWarning}%
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={shelterWarning}
              aria-label="Shelter capacity warning"
              onChange={(e) => setShelterWarning(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Reference occupancy for a manual capacity review.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Low-stock threshold</span>
              <span className="text-sm font-mono font-bold text-purple-300">
                {lowStock} units
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={lowStock}
              aria-label="Low-stock threshold"
              onChange={(e) => setLowStock(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Highlight available inventory rows below this quantity.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Escalation review time</span>
              <span className="text-sm font-mono font-bold text-purple-300">
                {escalation} min
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={escalation}
              aria-label="Escalation review time"
              onChange={(e) => setEscalation(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Suggested interval before a coordinator reviews unresolved alerts.
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-purple-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-purple-400 active:scale-[0.98]"
          >
            Save Parameters
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title={
          <span className="flex items-center gap-2">
            Role × Action Planning
            <span className="flex items-center gap-1 rounded-full border border-accent-danger/40 bg-accent-danger/10 px-2 py-0.5 text-eoc-tiny font-bold uppercase tracking-widest text-accent-danger">
              Admin Only
            </span>
          </span>
        }
        description="A saved planning worksheet for responsibilities; it does not grant or revoke access."
        icon={ShieldAlert}
      >
        <div className="max-h-80 w-full overflow-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#0a0f1a]">
              <tr className="text-left text-eoc-tiny uppercase tracking-wider text-slate-500">
                <th className="border-b border-white/10 px-3 py-3 font-semibold">
                  Action
                </th>
                {ROLES.map((role) => (
                  <th
                    key={role}
                    className="border-b border-white/10 px-2 py-3 text-center font-semibold"
                  >
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-white/[0.02]">
              {ACTIONS.map((action, actionIdx) => (
                <tr key={action} className="hover:bg-white/5">
                  <td className="sticky left-0 bg-[#0a0f1a] px-3 py-2.5 font-semibold text-slate-100">
                    {action}
                  </td>
                  {ROLES.map((role, roleIdx) => {
                    const checked = matrix[roleIdx][actionIdx];
                    return (
                      <td key={role} className="px-2 py-2.5">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            aria-label={`${action} · ${role}`}
                            disabled={roleIdx === 0}
                            onClick={() => toggleCell(roleIdx, actionIdx)}
                            className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                              checked
                                ? "border-purple-400 bg-purple-400 text-slate-950"
                                : "border-white/20 bg-white/5"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {checked && (
                              <svg
                                viewBox="0 0 12 12"
                                className="h-2.5 w-2.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <path d="M2 6.5 5 9l5-6" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Super Admin cells are fixed in this worksheet. Use Save Parameters to keep your
          changes.
        </p>
      </SettingsSection>
    </div>
  );
}
