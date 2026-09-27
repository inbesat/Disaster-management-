"use client";

import { useEffect, useMemo, useState } from "react";
import { downsampleDataset, useChartVisibility } from "@/lib/perf/chart-utils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

const ACCENT = "#38bdf8"; // sky accent
const AMBER = "#f59e0b";
const RED = "#ef4444";

type HistoryResponse = {
  source: "real" | "unavailable";
  points: Array<{ day: string; riskIndex: number; predictions: number }>;
};

// Recharts line for the real "risk index" (0 Safe → 3 Evacuate) series.
function RiskChart({ points }: { points: HistoryResponse["points"] }) {
  const isTabVisible = useChartVisibility();
  const sampledPoints = useMemo(() => downsampleDataset(points, 500), [points]);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={sampledPoints}
          margin={{ top: 6, right: 12, left: -16, bottom: 0 }}
        >
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            stroke="#64748b"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            domain={[0, 3]}
            ticks={[0, 1, 2, 3]}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #b45309",
              borderRadius: "0.625rem",
              fontSize: 12,
            }}
            labelStyle={{ color: "#e2e8f0" }}
            formatter={(value, name) => [`${name} ${value}`, "Risk index"]}
          />

          <ReferenceLine
            y={2}
            stroke={RED}
            strokeDasharray="4 4"
            label={{
              value: "Warning",
              position: "insideTopRight",
              fill: "#f87171",
              fontSize: 11,
            }}
          />
          <ReferenceLine
            y={1}
            stroke={AMBER}
            strokeDasharray="4 4"
            label={{
              value: "Watch",
              position: "insideTopLeft",
              fill: "#fbbf24",
              fontSize: 11,
            }}
          />

          <Legend wrapperStyle={{ fontSize: 12 }} />

          <Line
            type="monotone"
            dataKey="riskIndex"
            name="Avg Risk Index"
            stroke={ACCENT}
            strokeWidth={2.5}
            dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={isTabVisible}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PredictionChart() {
  const [history, setHistory] = useState<HistoryResponse | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/predictions/history?days=7")
      .then((res) => {
        if (!res.ok) throw new Error("Prediction history unavailable");
        return res.json();
      })
      .then((data: HistoryResponse) => {
        if (active) setHistory(data);
      })
      .catch(() => {
        if (active) setHistory({ source: "unavailable", points: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  const isReal = history?.source === "real" && (history.points?.length ?? 0) > 0;

  return (
    <div className="eoc-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="eoc-label text-accent">
          {isReal ? "MODEL OUTPUT · FLOOD RISK TREND" : "FLOOD RISK HISTORY"}
        </p>
        {isReal ? (
          <span className="rounded-full border border-severity-green-600 bg-severity-green-600/10 px-2 py-0.5 text-eoc-tiny font-semibold uppercase text-severity-green-400">
            Live
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="rounded-full border border-severity-amber-600 bg-severity-amber-600/10 px-2 py-0.5 text-eoc-tiny font-semibold uppercase text-severity-amber-400">
              Unavailable
            </span>
            <span className="text-eoc-tiny uppercase tracking-wider text-slate-500">
              No verified predictions
            </span>
          </span>
        )}
      </div>

      {isReal ? (
        <RiskChart points={history.points} />
      ) : (
        <div
          className="flex h-64 w-full items-center justify-center text-sm text-slate-400"
          role="status"
        >
          No verified flood predictions are available yet.
        </div>
      )}

      <p className="mt-1 text-xs text-slate-500">
        {isReal
          ? "Daily average model risk index — 0 Safe · 1 Watch · 2 Warning · 3 Evacuate"
          : "Prediction history appears after live model results are saved."}
      </p>
    </div>
  );
}
