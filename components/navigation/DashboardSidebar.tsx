// ---------------------------------------------------------------------
// components/navigation/DashboardSidebar.tsx
// UI/UX Phase 2 · Step 3 — the full composed sidebar nav.
//
// Config-driven: maps over lib/config/navigation.ts (NAVIGATION_ROUTES),
// filters it by the active user's role, groups the survivors by section,
// and renders SidebarSection + SidebarNavItem for each.
//
// Phase 9 updates: user profile in header, badge colors from config,
// keyboard shortcut hints, fade transitions on role change.
// ---------------------------------------------------------------------

"use client";

import type { Role } from "@/lib/validations/user";
import {
  NAV_SECTION_LABELS,
  NAV_SECTIONS,
  NAVIGATION_ROUTES,
  filterRoutesByRole,
} from "@/lib/config/navigation";
import { LogOut } from "lucide-react";
import { clearGuestMode, signOutAction } from "@/app/actions/auth";
import useHotkeys from "@/hooks/useHotkeys";
import Sidebar, { type SidebarVariant } from "./Sidebar";
import SidebarSection from "./SidebarSection";
import SidebarNavItem from "./SidebarNavItem";
import { useSidebar } from "./sidebar-context";

// Global keyboard shortcuts (Prompt 9.6)
const NAV_SHORTCUTS: Record<string, string> = {
  "mod+1": "/gov/dashboard",
  "mod+2": "/command-center",
  "mod+3": "/alerts",
  "mod+k": "__search__",
  "mod+/": "/ai-planner",
  "mod+.": "__toggle_sidebar__",
};

const NAV_SHORTCUT_LABELS: Record<string, string> = {
  "/gov/dashboard": "⌘1",
  "/command-center": "⌘2",
  "/alerts": "⌘3",
  "/ai-planner": "⌘/",
};

type DashboardSidebarProps = {
  alertsBadgeCount?: number;
  userRole?: Role;
  guest?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  variant?: SidebarVariant;
  displayName?: string;
  avatarUrl?: string | null;
  className?: string;
};

const MOCK_ROLE: Role = "district_admin";

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  district_admin: "District Commander",
  field_responder: "Field Responder",
  viewer: "Viewer",
};

export function DashboardSidebar({
  alertsBadgeCount,
  userRole = MOCK_ROLE,
  guest = false,
  collapsed,
  onToggle,
  isOpenMobile,
  onCloseMobile,
  variant = "fixed",
  displayName = "District Control Room",
  avatarUrl,
  className = "",
}: DashboardSidebarProps) {
  const visibleRoutes = filterRoutesByRole(NAVIGATION_ROUTES, userRole);

  // Global keyboard shortcuts
  useHotkeys(NAV_SHORTCUTS);

  // Recompute on every render so server and client show the same hints.
  const shortcutAssigned = new Set<string>();

  return (
    <Sidebar
      collapsed={collapsed}
      onToggle={onToggle}
      isOpenMobile={isOpenMobile}
      onCloseMobile={onCloseMobile}
      variant={variant}
      className={className}
      footer={<SignOutButton guest={guest} />}
      headerProps={{
        displayName,
        roleLabel: ROLE_LABELS[userRole],
        districtStatus: "critical",
        avatarUrl,
      }}
    >
      {/* Fade transition wrapper for role-based nav changes */}
      <div className="animate-in fade-in duration-200">
        {NAV_SECTIONS.map((section) => {
          const sectionRoutes = visibleRoutes.filter(
            (route) => route.section === section,
          );
          if (sectionRoutes.length === 0) return null;

          return (
            <SidebarSection key={section} label={NAV_SECTION_LABELS[section]}>
              {sectionRoutes.map((route) => {
                const shortcut = shortcutAssigned.has(route.href)
                  ? undefined
                  : NAV_SHORTCUT_LABELS[route.href];
                if (shortcut) shortcutAssigned.add(route.href);

                // Use config badgeCount/badgeColor, or override for alerts
                const badge =
                  route.href === "/alerts" && alertsBadgeCount
                    ? { count: alertsBadgeCount, color: "bg-red-400/15 text-red-300" }
                    : route.badgeCount
                      ? { count: route.badgeCount, color: route.badgeColor }
                      : undefined;

                return (
                  <SidebarNavItem
                    key={route.label}
                    icon={route.icon}
                    label={route.label}
                    href={route.href}
                    badgeCount={badge?.count}
                    badgeColor={badge?.color}
                    shortcut={shortcut}
                    subRoutes={route.subRoutes}
                  />
                );
              })}
            </SidebarSection>
          );
        })}
      </div>
    </Sidebar>
  );
}

export default DashboardSidebar;

function SignOutButton({ guest }: { guest: boolean }) {
  const { collapsed } = useSidebar();
  const label = guest ? "Exit Demo" : "Sign Out";

  return (
    <div className="border-t border-white/5 p-2">
      <form action={guest ? clearGuestMode : signOutAction}>
        <button
          type="submit"
          aria-label={collapsed ? label : undefined}
          title={collapsed ? label : undefined}
          className={`flex h-11 w-full items-center gap-3 rounded-md border-l-2 border-transparent px-3 text-sm text-slate-400 transition-colors duration-150 motion-reduce:transition-none hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
          {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
        </button>
      </form>
    </div>
  );
}
