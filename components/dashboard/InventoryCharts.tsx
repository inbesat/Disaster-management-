"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { InventoryResource } from "@/app/actions/resources";
import { inventoryChartData } from "@/lib/inventory/model";

const CATEGORY_COLORS: Record<string, string> = {
  boat: "#38bdf8",
  medical: "#f472b6",
  food: "#fbbf24",
  water: "#60a5fa",
  personnel: "#a78bfa",
  vehicle: "#34d399",
  communication: "#22d3ee",
  power: "#fb923c",
  shelter: "#c084fc",
};

const STATUS_COLORS: Record<string, string> = {
  available: "#34d399",
  deployed: "#fbbf24",
  maintenance: "#f87171",
  retired: "#64748b",
};

export default function InventoryCharts({
  resources,
  loading = false,
  unavailable = false,
}: {
  resources: InventoryResource[];
  loading?: boolean;
  unavailable?: boolean;
}) {
  const { pie, bars } = useMemo(() => inventoryChartData(resources), [resources]);

  const sliceColor = (name: string) => CATEGORY_COLORS[name.toLowerCase()] ?? "#94a3b8";
  if (loading || unavailable || pie.length === 0)
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {["Inventory Composition", "Available vs Deployed"].map((title) => (
          <section
            key={title}
            className="rounded-eoc border border-border bg-surface p-5"
          >
            <h3 className="text-sm font-bold">{title}</h3>
            <p
              role="status"
              className="flex h-64 items-center justify-center text-sm text-slate-400"
            >
              {loading
                ? "Loading charts…"
                : unavailable
                  ? "Charts will return when inventory is available."
                  : "No stock matches these filters."}
            </p>
          </section>
        ))}
      </div>
    );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div
        className="min-w-0 rounded-eoc border border-border bg-surface p-5"
        aria-label="Inventory composition chart"
      >
        <p className="eoc-label text-accent">RESOURCES BY CATEGORY</p>
        <h3 className="mt-1 text-sm font-bold">Inventory Composition</h3>
        <div className="mt-3 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pie}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={88}
                paddingAngle={2}
                stroke="#0b0f19"
                isAnimationActive={false}
              >
                {pie.map((entry) => (
                  <Cell key={entry.name} fill={sliceColor(entry.name)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#0b0f19",
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        className="min-w-0 rounded-eoc border border-border bg-surface p-5"
        aria-label="Inventory availability chart"
      >
        <p className="eoc-label text-accent">AVAILABILITY BY CATEGORY</p>
        <h3 className="mt-1 text-sm font-bold">Available vs Deployed</h3>
        <div className="mt-3 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bars}
              layout="vertical"
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                type="number"
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={100}
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: "#0b0f19",
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar
                dataKey="available"
                stackId="a"
                fill={STATUS_COLORS.available}
                name="Available"
                isAnimationActive={false}
              />
              <Bar
                dataKey="deployed"
                stackId="a"
                fill={STATUS_COLORS.deployed}
                name="Deployed"
                isAnimationActive={false}
              />
              <Bar
                dataKey="maintenance"
                stackId="a"
                fill={STATUS_COLORS.maintenance}
                name="Maintenance"
                isAnimationActive={false}
              />
              <Bar
                dataKey="retired"
                stackId="a"
                fill={STATUS_COLORS.retired}
                name="Retired"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
