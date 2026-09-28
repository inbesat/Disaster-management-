"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ResourceMovement } from "@/app/actions/resources";
import { useInventoryActions } from "./InventoryProvider";
import { movementInputError } from "@/lib/inventory/model";

// ---------------------------------------------------------------------
// components/dashboard/ResourceMovementsPanel.tsx
// Phase 12 · Resource Movement Tracking — immutable trail of where
// resources went (depot → disaster site) with timestamps. Shows the
// latest movements and lets admins log new ones from the inventory page.
// ---------------------------------------------------------------------

const ACTION_BADGE: Record<
  string,
  { className: string; icon: "dispatch" | "deliver" | "return" | "adjust" }
> = {
  dispatched: {
    className: "bg-amber-500/10 text-amber-300 border-amber-500/40",
    icon: "dispatch",
  },
  delivered: {
    className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
    icon: "deliver",
  },
  returned: { className: "bg-sky-500/10 text-sky-300 border-sky-500/40", icon: "return" },
  adjusted: {
    className: "bg-slate-500/10 text-slate-300 border-slate-500/40",
    icon: "adjust",
  },
};

const ACTIONS = ["dispatched", "delivered", "returned", "adjusted"];

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_BADGE[action] ?? ACTION_BADGE.adjusted;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${style.className}`}
    >
      {style.icon === "dispatch" && <ArrowUpRight className="h-3 w-3" aria-hidden />}
      {style.icon === "deliver" && <ArrowDownRight className="h-3 w-3" aria-hidden />}
      {style.icon === "return" && <RotateCcw className="h-3 w-3" aria-hidden />}
      {style.icon === "adjust" && <SlidersHorizontal className="h-3 w-3" aria-hidden />}
      {action}
    </span>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// Patna centre is the default landing point for the movement; operators can
// override with the destination lat/lng captured by GPS in the field.
const PATNA_CENTER = { lat: 25.5941, lng: 85.1376 };

const EMPTY_FORM = {
  resourceName: "",
  action: "dispatched",
  fromLabel: "",
  toLabel: "",
  quantity: "",
  lat: "",
  lng: "",
  note: "",
};

export default function ResourceMovementsPanel() {
  const { getResourceMovements, logResourceMovement } = useInventoryActions();
  const [movements, setMovements] = useState<ResourceMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setMovements(await getResourceMovements());
    } catch {
      setError("Movement history could not be loaded. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.resourceName.trim() || !form.toLabel.trim()) {
      toast.error("Resource name and destination are required.");
      return;
    }
    setSaving(true);
    setError("");
    const lat = form.lat.trim() ? Number(form.lat) : PATNA_CENTER.lat;
    const lng = form.lng.trim() ? Number(form.lng) : PATNA_CENTER.lng;
    try {
      const input = {
        resourceName: form.resourceName.trim(),
        action: form.action,
        fromLabel: form.fromLabel.trim() || null,
        toLabel: form.toLabel.trim(),
        toLat: lat,
        toLng: lng,
        quantity: Number(form.quantity),
        note: form.note.trim() || null,
      };
      const validation = movementInputError(input);
      if (validation) {
        setError(validation);
        return;
      }
      const res = await logResourceMovement(input);
      if (res.ok) {
        toast.success("Movement recorded.");
        setRecording(false);
        setForm(EMPTY_FORM);
        void load();
      } else setError("Movement could not be saved. Check the connection and retry.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Movement could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-eoc border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <p className="eoc-label text-accent">RESOURCE MOVEMENTS</p>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs tabular-nums text-slate-300">
          {movements.length}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition hover:border-accent hover:text-accent"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Refresh
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setRecording((r) => !r)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-950 transition hover:bg-sky-300"
          >
            {recording ? "Cancel" : "+ Record Movement"}
          </button>
        </div>
      </div>

      {/* Record Movement form */}
      {error && (
        <p role="alert" className="m-4 text-sm text-red-300">
          {error}
        </p>
      )}
      {recording && (
        <form
          onSubmit={(e) => void submit(e)}
          className="grid gap-3 border-b border-border bg-surface-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-6"
        >
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 lg:col-span-2">
            Resource
            <input
              value={form.resourceName}
              onChange={(e) => setField("resourceName", e.target.value)}
              placeholder="e.g. NDRF Rescue Boats"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm normal-case text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Action
            <select
              value={form.action}
              onChange={(e) => setField("action", e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            From
            <input
              value={form.fromLabel}
              onChange={(e) => setField("fromLabel", e.target.value)}
              placeholder="Depot / origin"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm normal-case text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            To (destination)
            <input
              value={form.toLabel}
              onChange={(e) => setField("toLabel", e.target.value)}
              placeholder="Disaster site / relief camp"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm normal-case text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Qty
            <input
              type="number"
              min={1}
              max={1000000}
              required
              value={form.quantity}
              onChange={(e) => setField("quantity", e.target.value)}
              placeholder="1"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Lat
            <input
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => setField("lat", e.target.value)}
              placeholder={String(PATNA_CENTER.lat)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Lng
            <input
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => setField("lng", e.target.value)}
              placeholder={String(PATNA_CENTER.lng)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:col-span-2 lg:col-span-6">
            Note
            <input
              value={form.note}
              onChange={(e) => setField("note", e.target.value)}
              placeholder="Optional context (e.g. 'Priority: high')"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm normal-case text-foreground outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-sky-300 disabled:opacity-50 sm:col-span-2 lg:col-span-6"
          >
            {saving ? "Recording…" : "Record Movement"}
          </button>
        </form>
      )}

      {/* Timeline */}
      <div className="max-h-80 divide-y divide-border/60 overflow-y-auto">
        {loading && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Loading movements…
          </p>
        )}
        {!loading && !error && movements.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No movements recorded yet.
          </p>
        )}
        {!loading &&
          movements.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {m.resourceName}
                  {m.quantity > 0 && (
                    <span className="ml-2 tabular-nums text-slate-400">
                      ×{m.quantity.toLocaleString()}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {m.fromLabel ? (
                    <>
                      <span>{m.fromLabel}</span>
                      <span className="mx-1.5 text-slate-600">→</span>
                    </>
                  ) : null}
                  <span className="font-medium text-slate-300">{m.toLabel}</span>
                  {m.note ? (
                    <span className="ml-2 text-slate-500">· {m.note}</span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <ActionBadge action={m.action} />
                <span className="w-14 text-right font-mono text-[11px] text-slate-500">
                  {relativeTime(m.createdAt)}
                </span>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
