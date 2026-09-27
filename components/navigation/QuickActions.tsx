// ---------------------------------------------------------------------
// components/navigation/QuickActions.tsx
// UI/UX Phase 2 · Step 8 — emergency quick-action panel.
//
// Floating (in-shell) panel that sits above the collapse footer in the
// sidebar — one-click shortcuts for the highest-priority emergency tasks.
// Expanded: 3 full-width buttons. Collapsed: 3 stacked icon buttons.
// ---------------------------------------------------------------------

"use client";

import { AlertTriangle, Bot, Siren } from "lucide-react";
import Link from "next/link";
import { useSidebar } from "./sidebar-context";

export function QuickActions() {
  const { collapsed } = useSidebar();
  const actions = [
    {
      label: "Send Alert",
      icon: Siren,
      color: "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25",
      collapsedColor: "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25",
      href: "/gov/alerts",
    },
    {
      label: "Run AI Plan",
      icon: Bot,
      color: "bg-purple-500/15 text-purple-400 hover:bg-purple-500/25",
      collapsedColor: "bg-purple-500/15 text-purple-400 hover:bg-purple-500/25",
      href: "/gov/ai-planner",
    },
    {
      label: "Report Incident",
      icon: AlertTriangle,
      color: "bg-red-500/15 text-red-400 hover:bg-red-500/25",
      collapsedColor: "bg-red-500/15 text-red-400 hover:bg-red-500/25",
      href: "/incident-report",
    },
  ];

  // Collapsed mode: stacked icon buttons
  if (collapsed) {
    return (
      <div className="mx-2 mb-1 flex flex-col gap-1">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            aria-label={action.label}
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-150 ${action.collapsedColor}`}
          >
            <action.icon className="h-4 w-4" aria-hidden />
          </Link>
        ))}
      </div>
    );
  }

  // Expanded mode: full-width buttons
  return (
    <div className="mx-2 mb-1 rounded-lg border border-white/5 bg-[#111827] p-2">
      <p className="px-1 pb-2 text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">
        Quick actions
      </p>
      <div className="space-y-1">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={`flex h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all duration-150 hover:shadow-[0_0_12px_rgba(255,255,255,0.05)] ${action.color}`}
          >
            <action.icon className="h-4 w-4 shrink-0" aria-hidden />
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;
