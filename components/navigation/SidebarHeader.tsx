// ---------------------------------------------------------------------
// components/navigation/SidebarHeader.tsx
// UI/UX Phase 2 · Step 1 — sidebar brand header.
//
// Top of the Sidebar shell:
//   • logo tile       — Shield with wave icon (32px, blue)
//   • brand           — "DRIP" name (visible expanded)
//   • district status — pulsing red dot if critical, green if safe
//   • user profile    — avatar 32px + name + role badge (collapsed: avatar only)
//   • bottom border   — border-white/5
// ---------------------------------------------------------------------

"use client";

import Image from "next/image";
import { Shield } from "lucide-react";
import { useSidebar } from "./sidebar-context";

type SidebarHeaderProps = {
  /** Sidebar expansion state — hides the brand text when false. */
  expanded: boolean;
  /** User display name. */
  displayName?: string;
  /** User role label. */
  roleLabel?: string;
  /** District flood status — "critical" | "safe". */
  districtStatus?: "critical" | "safe";
  /** User avatar URL or null for initials fallback. */
  avatarUrl?: string | null;
  className?: string;
};

export function SidebarHeader({
  expanded,
  displayName = "District Control Room",
  roleLabel = "District Commander",
  districtStatus = "critical",
  avatarUrl,
  className = "",
}: SidebarHeaderProps) {
  const statusDot =
    districtStatus === "critical" ? "bg-red-400 animate-pulse" : "bg-emerald-400";

  return (
    <div className={`flex shrink-0 flex-col border-b border-white/5 ${className}`}>
      {/* Brand row */}
      <div className="flex h-16 items-center gap-3 px-3">
        {/* Shield logo with status dot */}
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
          <Shield className="h-5 w-5 text-blue-400" aria-hidden />
          <span
            className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#0a0f1a] ${statusDot}`}
            aria-label={`District status: ${districtStatus}`}
          />
        </span>

        {/* Brand text — kept mounted so collapse animates */}
        <div
          className={`overflow-hidden transition-all duration-300 motion-reduce:transition-none ${
            expanded ? "w-auto opacity-100" : "w-0 opacity-0"
          }`}
        >
          <p className="whitespace-nowrap text-sm font-bold tracking-widest text-white">
            SafeSphere
          </p>
          <p className="whitespace-nowrap text-[0.625rem] font-medium uppercase tracking-widest text-slate-500">
            Command Center
          </p>
        </div>
      </div>

      {/* User mini-profile — visible expanded, avatar-only when collapsed */}
      <div className="flex items-center gap-2.5 px-3 pb-3">
        {/* Avatar */}
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-xs font-bold text-white ring-2 ring-white/10">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={32}
              height={32}
              priority
              unoptimized
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            displayName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
          )}
        </span>

        {/* Name + role — hidden when collapsed */}
        <div
          className={`overflow-hidden transition-all duration-300 motion-reduce:transition-none ${
            expanded ? "w-auto opacity-100" : "w-0 opacity-0"
          }`}
        >
          <p className="whitespace-nowrap text-xs font-semibold text-white/90 truncate max-w-[140px]">
            {displayName}
          </p>
          <span className="inline-block whitespace-nowrap rounded-full border border-blue-400/30 bg-blue-400/10 px-1.5 py-px text-[0.5625rem] font-semibold text-blue-400">
            {roleLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SidebarHeader;
