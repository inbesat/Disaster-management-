"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, X } from "lucide-react";

export type CitizenReportType = "flooding" | "road_blocked" | "rescue";
const OPTIONS: { type: CitizenReportType; label: string }[] = [
  { type: "flooding", label: "🌊 Flooding here" },
  { type: "road_blocked", label: "🚧 Road blocked" },
  { type: "rescue", label: "👥 People need rescue" },
];

/** A quick entry to the persisted citizen report form; no fake success toast. */
export default function ReportIncidentFAB() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute bottom-[calc(152px+env(safe-area-inset-bottom))] right-4 z-20 flex flex-col items-end gap-3">
      {open && (
        <div className="w-60 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1120]/95 shadow-xl">
          <p className="px-4 pt-3 text-xs font-bold uppercase text-slate-400">
            Report what you see
          </p>
          {OPTIONS.map((option) => (
            <Link
              key={option.type}
              href={`/public/report?type=${option.type}`}
              className="block px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              {option.label}
            </Link>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close report menu" : "Report an incident"}
        aria-expanded={open}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--dl-orange)] text-white shadow-lg"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
