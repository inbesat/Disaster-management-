"use client";

import { Boxes, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// ---------------------------------------------------------------------
// components/gov/dashboard/ResourceWidget.tsx — Phase 7 · Step 5.
//
// 1×1 donut chart showing resource utilization by category: boats (blue),
// medical (red), food (amber), tents (green), vehicles (purple). Center
// shows total utilization %. Low stock items get warning badge.
// ---------------------------------------------------------------------

const RESOURCE_DATA = [
  { name: "Boats", value: 45, color: "#3b82f6" },
  { name: "Medical", value: 78, color: "#ef4444" },
  { name: "Food", value: 120, color: "#f59e0b" },
  { name: "Tents", value: 95, color: "#10b981" },
  { name: "Vehicles", value: 62, color: "#a855f7" },
];

const TOTAL = RESOURCE_DATA.reduce((s, d) => s + d.value, 0);
const UTILIZATION_PCT = Math.round((TOTAL / (TOTAL + 200)) * 100);

const LOW_STOCK: Array<{ name: string; color: string; level: "low" | "critical" }> = [
  { name: "Boats", color: "#3b82f6", level: "low" },
  { name: "Medical", color: "#ef4444", level: "critical" },
];

export function ResourceWidget() {
  return (
    <section className="flex flex-col rounded-xl border border-white/10 bg-[#111827] backdrop-blur transition hover:border-white/20">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Boxes aria-hidden="true" className="h-4 w-4 text-blue-400" />
          <h2 className="eoc-label text-white">Resource Inventory</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[0.6875rem] font-semibold text-amber-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden />
          {LOW_STOCK.length} low-stock
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center gap-1 p-5">
        {/* Donut */}
        <div className="relative h-40 w-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}
                itemStyle={{ color: "#f1f5f9" }}
                formatter={(value, name) => [`${Number(value ?? 0).toLocaleString()} units`, name]}
              />
              <Pie
                data={RESOURCE_DATA}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={3}
                stroke="#0a0f1a"
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
              >
                {RESOURCE_DATA.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-white">{UTILIZATION_PCT}%</span>
            <span className="text-[0.625rem] uppercase tracking-wider text-slate-500">
              allocated
            </span>
          </div>
        </div>

        {/* Legend */}
        <ul className="flex w-full max-w-[200px] flex-col gap-1 pt-2">
          {RESOURCE_DATA.map((d) => (
            <li key={d.name} className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
                {d.name}
              </span>
              <span className="font-semibold tabular-nums text-white/80">{d.value}</span>
            </li>
          ))}
        </ul>

        {/* Low-stock warning */}
        <div className="mt-3 w-full space-y-1.5">
          {LOW_STOCK.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-white/85">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /> {item.name}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide ${
                  item.level === "critical"
                    ? "bg-red-400/15 text-red-300"
                    : "bg-amber-400/15 text-amber-300"
                }`}
              >
                {item.level}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/inventory"
          className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-400 transition hover:text-blue-300"
        >
          View Inventory <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}

export default ResourceWidget;
