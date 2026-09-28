"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import useSWR from "swr";
import { PackageOpen } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import type { InventoryResource } from "@/app/actions/resources";
import { useInventoryActions } from "./InventoryProvider";
import {
  RESOURCE_CATEGORIES as CATEGORIES,
  RESOURCE_STATUSES as STATUSES,
} from "@/lib/inventory/model";
import InventoryCharts from "@/components/dashboard/InventoryCharts";
import ResourceCSVUploader from "@/components/dashboard/ResourceCSVUploader";
import ResourceFormModal from "@/components/dashboard/ResourceFormModal";
import ResourceMovementsPanel from "@/components/dashboard/ResourceMovementsPanel";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const STATUS_BADGE: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
  deployed: "bg-amber-500/10 text-amber-300 border-amber-500/40",
  maintenance: "bg-red-500/10 text-red-300 border-red-500/40",
};
const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-400",
  deployed: "bg-amber-400",
  maintenance: "bg-red-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${STATUS_BADGE[status] ?? STATUS_BADGE.other ?? ""}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status] ?? "bg-slate-400"}`}
      />
      {status}
    </span>
  );
}

export default function InventoryWorkspace({ demo = false }: { demo?: boolean }) {
  const { getInventory } = useInventoryActions();
  const { t } = useTranslation();
  const [lowStock, setLowStock] = useState(20);
  useEffect(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("safesphere:operations") || "null",
      )?.lowStock;
      if (Number.isFinite(value) && value >= 5 && value <= 50) setLowStock(value);
    } catch {
      /* Use the default threshold. */
    }
  }, []);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<InventoryResource | null>(null);

  // Phase 14 · SWR caching: inventory is revalidated every 30s + on-demand
  // after edits, so the dashboard never refetches on every mount.
  const {
    data: resources = [] as InventoryResource[],
    mutate,
    isLoading: loading,
    error,
    isValidating,
  } = useSWR<InventoryResource[]>(["inventory", getInventory], () => getInventory(), {
    refreshInterval: 30_000,
  });

  function reload() {
    void mutate();
  }

  function exportCsv() {
    const csv = Papa.unparse(
      filtered.map(({ name, category, quantity, unit, lat, lng, status, depotName }) => ({
        name,
        category,
        quantity,
        unit,
        lat,
        lng,
        status,
        depotName,
      })),
      { escapeFormulae: true },
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "safesphere-inventory.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(
    () =>
      resources.filter(
        (r) =>
          (category === "all" || r.category === category) &&
          (status === "all" || r.status === status),
      ),
    [resources, category, status],
  );

  const totals = useMemo(() => {
    let total = 0;
    let deployed = 0;
    for (const r of resources) {
      total += r.quantity;
      if (r.status === "deployed") deployed += r.quantity;
    }
    return { total, deployed };
  }, [resources]);

  return (
    <main className="mx-auto min-w-0 max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eoc-label text-accent">{t("command_center").toUpperCase()}</p>
          <h1 className="text-2xl font-bold">{t("resource_inventory")}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {totals.total.toLocaleString()} units in inventory ·{" "}
            {totals.deployed.toLocaleString()} deployed
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reload}
            disabled={isValidating}
            className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
          >
            {isValidating ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filtered.length}
            className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-bold uppercase tracking-wider text-foreground transition hover:bg-surface-muted"
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-bold uppercase tracking-wider text-slate-950 shadow-glow transition hover:bg-sky-300"
          >
            + Add Resource
          </button>
        </div>
      </header>

      {demo && (
        <p className="mt-2 text-xs text-slate-400">
          Sample inventory · edits are saved on this device for this session.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-400/40 p-4 text-sm text-red-200"
        >
          Inventory could not be loaded.{" "}
          {demo
            ? "Check that this browser allows site storage."
            : "Check the database connection."}{" "}
          <button onClick={reload} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      <section className="mt-6">
        <InventoryCharts
          resources={filtered}
          loading={loading}
          unavailable={Boolean(error)}
        />
      </section>

      <section className="mt-6 rounded-eoc border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="all">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="all">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <span className="ml-auto text-[11px] text-slate-500">
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted/60 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Resource</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Quantity</th>
                <th className="px-4 py-3 font-semibold">Unit</th>
                <th className="px-4 py-3 font-semibold">Depot</th>
                <th className="px-4 py-3 font-semibold">Coordinates</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/60 transition-colors hover:bg-surface-muted/40"
                >
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {r.name}
                    {r.status === "available" && r.quantity < lowStock && (
                      <span className="ml-2 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
                        Low stock
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-300">{r.category}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <b className="text-foreground">{r.quantity.toLocaleString()}</b>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{r.unit ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{r.depotName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingResource(r)}
                      className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:border-accent hover:text-accent"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6">
                    <EmptyState
                      icon={PackageOpen}
                      title={
                        resources.length === 0
                          ? "No resources in inventory"
                          : "No resources match the filters"
                      }
                      description={
                        resources.length === 0
                          ? "Add your first resource to start tracking stockpiles, depots, and deployments."
                          : "Try a different category or status filter to see stock again."
                      }
                      actionButton={
                        resources.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => setAddOpen(true)}
                            className="rounded-md bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-glow transition hover:bg-sky-300"
                          >
                            + Add First Resource
                          </button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    Loading inventory…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <ResourceMovementsPanel />
      </section>

      {/* Import CSV modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Import resources"
            className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-eoc border border-border bg-surface p-6 shadow-2xl"
          >
            <ResourceCSVUploader onClose={() => setImportOpen(false)} onSaved={reload} />
          </div>
        </div>
      )}

      {/* Add Resource modal */}
      {addOpen && (
        <ResourceFormModal onClose={() => setAddOpen(false)} onSaved={reload} />
      )}

      {/* Edit Resource modal */}
      {editingResource && (
        <ResourceFormModal
          resource={editingResource}
          onClose={() => setEditingResource(null)}
          onSaved={reload}
          onDeleted={reload}
        />
      )}
    </main>
  );
}
