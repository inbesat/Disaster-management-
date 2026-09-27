"use client";

import { useEffect, useMemo, useState } from "react";
import { getInventory, type InventoryResource } from "@/app/actions/resources";

const CRITICAL_CATEGORIES: Record<string, string> = {
  boat: "Boats",
  medical: "Medical Supplies",
  food: "Food Rations",
  water: "Water",
  personnel: "Rescue Teams",
};

const LOW_STOCK_THRESHOLD = 10;

type Shortage = {
  category: string;
  label: string;
  available: number;
};

export default function LowStockWidget() {
  const [resources, setResources] = useState<InventoryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    void getInventory()
      .then((rows) => {
        if (active) setResources(rows);
      })
      .catch((error) => {
        console.error("Failed to load inventory:", error);
        if (active) setUnavailable(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const shortages = useMemo<Shortage[]>(() => {
    // Total "available" quantity per category (es5-safe: no Map iteration).
    const available: Record<string, number> = {};
    for (const r of resources) {
      if (r.status !== "available") continue;
      available[r.category] = (available[r.category] ?? 0) + r.quantity;
    }

    const list: Shortage[] = [];
    for (const [category, label] of Object.entries(CRITICAL_CATEGORIES)) {
      const count = available[category] ?? 0;
      if (count < LOW_STOCK_THRESHOLD) {
        list.push({ category, label, available: count });
      }
    }
    return list;
  }, [resources]);

  return (
    <div className="eoc-panel p-5">
      <p className="eoc-label text-accent">LOW-STOCK MONITOR</p>
      <h2 className="mt-1 font-bold">Critical Stock Levels</h2>

      {loading && <p className="mt-3 text-sm text-slate-400">Checking inventory…</p>}

      {unavailable && (
        <p role="status" className="mt-3 text-sm text-amber-300">
          Inventory is unavailable. Stock levels cannot be verified.
        </p>
      )}

      {!loading && !unavailable && shortages.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">
          All critical categories above threshold. ✓
        </p>
      )}

      {!unavailable &&
        shortages.map((s) => (
          <div
            key={s.category}
            role="alert"
            className="mt-3 animate-pulse rounded-lg border-2 border-severity-red-600 bg-severity-red-600/15 px-4 py-3"
          >
            <p className="text-sm font-black uppercase tracking-wider text-severity-red-400">
              ⚠️ CRITICAL SHORTAGE: Only {s.available} {s.label} remaining in District.
            </p>
          </div>
        ))}
    </div>
  );
}
