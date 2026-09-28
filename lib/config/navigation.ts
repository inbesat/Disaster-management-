// ---------------------------------------------------------------------
// lib/config/navigation.ts
// Phase 2 · Step 3 — navigation data & role filtering.
//
// Single source of truth for the dashboard sidebar: every route object
// carries its Lucide icon, section group, and the list of roles allowed
// to see it. The sidebar maps over NAVIGATION_ROUTES, filters by the
// active user's role, and renders only what they can access.
//
// Role matrix (Prompt 9.4):
//   field_responder → Dashboard, Map, Alerts, Routes, AI, Team, Settings
//   district_admin  → + Shelters, Resources, Satellite
//   super_admin     → everything + Admin Panel (Districts, Users, Audit Log, System Health)
//
// Sections (Prompt 9.3):
//   OPERATIONS: Dashboard, Live Map, Alerts & Notifications, Shelters, Resources, Evacuation Routes
//   INTELLIGENCE: AI Emergency Planner, Satellite & Ground Truth, Predictions
//   ADMIN: Team & Responders, Settings
// ---------------------------------------------------------------------

import {
  BarChart3,
  Bell,
  Bot,
  HeartHandshake,
  LayoutDashboard,
  Monitor,
  PackageOpen,
  Route,
  Satellite,
  Settings,
  Tent,
  UserSearch,
  Users,
  UserCheck,
  Stethoscope,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/lib/validations/user";
import type { SidebarSubRoute } from "@/components/navigation/SidebarNavItem";

/** Sidebar section groups, rendered in this order. */
export const NAV_SECTIONS = [
  "operations",
  "intelligence",
  "admin",
] as const;

export type NavSection = (typeof NAV_SECTIONS)[number];

/** Human label for each section heading. */
export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  operations: "OPERATIONS",
  intelligence: "INTELLIGENCE",
  admin: "ADMIN",
};

export type NavRoute = {
  /** Nav label — also the tooltip when the sidebar is collapsed. */
  label: string;
  /** Destination route. */
  href: string;
  /** Lucide icon for the nav item. */
  icon: LucideIcon;
  /** Section group the item belongs to. */
  section: NavSection;
  /** Roles permitted to see this route. */
  allowedRoles: Role[];
  /** Optional badge count (renders colored pill). */
  badgeCount?: number;
  /** Optional badge color override. */
  badgeColor?: string;
  /** Optional accordion sub-routes. */
  subRoutes?: SidebarSubRoute[];
};

/**
 * The full nav. Order within a section defines render order; section order
 * is fixed by NAV_SECTIONS.
 */
export const NAVIGATION_ROUTES: NavRoute[] = [
  // ------------------------------------------------------- OPERATIONS ----
  {
    label: "Overview",
    href: "/gov/dashboard",
    icon: LayoutDashboard,
    section: "operations",
    allowedRoles: ["super_admin", "district_admin", "field_responder"],
  },
  {
    label: "Command Center",
    href: "/dashboard",
    icon: Monitor,
    section: "operations",
    allowedRoles: ["super_admin", "district_admin", "field_responder"],
  },
  {
    label: "Global Map",
    href: "/global-map",
    icon: Globe,
    section: "operations",
    allowedRoles: ["super_admin", "district_admin"],
  },
  {
    label: "Alerts & Notifications",
    href: "/alerts",
    icon: Bell,
    section: "operations",
    allowedRoles: ["field_responder", "district_admin", "super_admin"],
    badgeCount: 12,
    badgeColor: "bg-red-400/15 text-red-300",
  },
  {
    label: "Shelters",
    href: "/shelters",
    icon: Tent,
    section: "operations",
    allowedRoles: ["district_admin", "super_admin"],
  },
  {
    label: "Missing Persons",
    href: "/gov/missing-persons",
    icon: UserSearch,
    section: "operations",
    allowedRoles: ["super_admin", "district_admin"],
  },
  {
    label: "Casualty Tracking",
    href: "/gov/casualties",
    icon: Stethoscope,
    section: "operations",
    allowedRoles: ["super_admin", "district_admin"],
  },
  {
    label: "NGO Coordination",
    href: "/gov/ngos",
    icon: HeartHandshake,
    section: "operations",
    allowedRoles: ["super_admin", "district_admin"],
  },
  {
    label: "Resources",
    href: "/inventory",
    icon: PackageOpen,
    section: "operations",
    allowedRoles: ["district_admin", "super_admin"],
  },
  {
    label: "Evacuation Routes",
    href: "/evacuations",
    icon: Route,
    section: "operations",
    allowedRoles: ["field_responder", "district_admin", "super_admin"],
  },
  // ----------------------------------------------------- INTELLIGENCE ----
  {
    label: "AI Emergency Planner",
    href: "/ai-planner",
    icon: Bot,
    section: "intelligence",
    allowedRoles: ["field_responder", "district_admin", "super_admin"],
    badgeCount: 3,
    badgeColor: "bg-purple-400/15 text-purple-300",
  },
  {
    label: "Satellite & Ground Truth",
    href: "/satellite",
    icon: Satellite,
    section: "intelligence",
    allowedRoles: ["district_admin", "super_admin"],
  },
  {
    label: "Predictions",
    href: "/predictions",
    icon: BarChart3,
    section: "intelligence",
    allowedRoles: ["district_admin", "super_admin"],
    badgeCount: 5,
    badgeColor: "bg-amber-400/15 text-amber-300",
  },
  // ------------------------------------------------------------- ADMIN ----
  {
    label: "Team & Responders",
    href: "/directory",
    icon: Users,
    section: "admin",
    allowedRoles: ["field_responder", "district_admin", "super_admin"],
  },
  {
    label: "Access Requests",
    href: "/access-requests",
    icon: UserCheck,
    section: "admin",
    allowedRoles: ["district_admin", "super_admin"],
    badgeCount: 1,
    badgeColor: "bg-amber-400/15 text-amber-300",
  },
  {
    label: "Settings",
    href: "/settings/profile",
    icon: Settings,
    section: "admin",
    allowedRoles: ["super_admin", "district_admin"],
    subRoutes: [
      { label: "Profile", href: "/settings/profile" },
      { label: "Notifications", href: "/settings/notifications" },
      { label: "Map", href: "/settings/map" },
      { label: "AI", href: "/settings/ai" },
    ],
  },
];

/** Routes a role can see, in config order. */
export function filterRoutesByRole(routes: NavRoute[], role: Role): NavRoute[] {
  return routes.filter((route) => route.allowedRoles.includes(role));
}
