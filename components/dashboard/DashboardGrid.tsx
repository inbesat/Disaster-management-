"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------
// components/dashboard/DashboardGrid.tsx — UI/UX Phase 8 · Step 2 + Step 10.
//
// The Command Center's 12-column widget grid, wrapped in a Framer Motion
// stagger. Each grid cell is a motion.div carrying its own col-span class
// (so layout stays on the animated element) plus an item variant. Widgets
// visually "build" top-left → bottom-right as the dashboard mounts.
//
// Step 10 · Reduced-motion accessibility — when the user's OS reports
// prefers-reduced-motion (via Framer's `useReducedMotion`), we swap the
// staggered container + translate/scale variants for a flat, single-step
// "hidden → show" with zero delay and no translation. This keeps content
// fully reachable for motion-sensitive users (WCAG 2.3/2.3 Halt &
// Three-Flash guidance) while the ornate stagger remains for everyone else.
// ─────────────────────────────────────────────────────────────────────
// The widgets themselves keep ONLY their visual classes on the Panel root
// (e.g. glow-purple-soft); the responsive col-span moved here so the
// stagger wrapper can host it without a non-animatable `display: contents`
// bridge. Pass each widget's previous md/xl col-span via `className`.
// ─────────────────────────────────────────────────────────────────────

const gridContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const gridItem: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

/** Reduced-motion equivalents — instant opacity only, no stagger/translate. */
const fadeContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0,
      delayChildren: 0,
    },
  },
};

const fadeItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
};

type DashboardGridItem = {
  key: string;
  /** Responsive grid placement for this cell (e.g. "md:col-span-2 xl:col-span-8"). */
  className?: string;
  children: ReactNode;
};

type DashboardGridProps = {
  /** Widgets in visual build order — top-left → bottom-right. */
  items: DashboardGridItem[];
};

export function DashboardGrid({ items }: DashboardGridProps) {
  const reduceMotion = useReducedMotion();
  const container = reduceMotion ? fadeContainer : gridContainer;
  const itemVariants = reduceMotion ? fadeItem : gridItem;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12"
    >
      {items.map(({ key, className = "", children }) => (
        <motion.div key={key} variants={itemVariants} className={`min-w-0 ${className}`}>
          {children}
        </motion.div>
      ))}
    </motion.div>
  );
}

export default DashboardGrid;
