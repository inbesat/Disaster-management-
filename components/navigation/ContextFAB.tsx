"use client";

// ---------------------------------------------------------------------
// components/navigation/ContextFAB.tsx
// UI/UX Phase 9 · Step 5 — context-aware floating quick-action button.
//
// A single floating action button (FAB) that changes its meaning based on
// the route the responder is currently on. Instead of a static "+", the
// icon morphs to the action appropriate to the screen:
//
//   • /map      → "Add Shelter"      (MapPin type + Plus)
//   • /team     → "Mark Attendance"  (CheckCircle + users)
//   • /chat     → "New Message"      (MessageSquare)
//   • anything else → hidden (a context-less FAB is a dead affordance)
//
// Route detection uses `usePathname()` and a prefix match so it survives
// nested routes (`/map/123`, `/team/patna`). The switch drives an
// <AnimatePresence> icon swap so the glyph morphs (scale + rotate + fade)
// on every route change instead of blinking.
//
// Mount it once in the root layout (e.g. next to <BottomNav>) — it stays
// out of the way of the board's bottom-right meters (top-34+ controls).
// -------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckSquare, MapPinPlus, MessageSquare, type LucideIcon } from "lucide-react";
import { triggerLightHaptic } from "@/hooks/useHaptics";

/** Every local route pattern + its FAB action. */
type FabTask = {
  /** Route prefix — pathname.startsWith() match (kept prefix-robust). */
  route: string;
  /** Primary icon glyph (the quick action). */
  icon: LucideIcon;
  /** Tooltip / aria label. */
  label: string;
  href: string;
};

const FAB_TASKS: FabTask[] = [
  {
    route: "/map",
    icon: MapPinPlus,
    label: "Update shelter",
    href: "/shelter-update",
  },
  {
    route: "/team",
    icon: CheckSquare,
    label: "Responder profile",
    href: "/portal/profile",
  },
  {
    route: "/chat",
    icon: MessageSquare,
    label: "New Message",
    href: "/ai-advisor",
  },
];

/** Current FAB task for a pathname, or null (hide the FAB off-context). */
function taskForPath(pathname: string): FabTask | null {
  return FAB_TASKS.find((t) => pathname.startsWith(t.route)) ?? null;
}

export function ContextFAB() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [active, setActive] = useState<FabTask | null>(null);

  // Re-evaluate the task whenever the route changes so the icon morphs.
  useEffect(() => {
    setActive(taskForPath(pathname));
  }, [pathname]);

  const trigger = () => {
    if (!active) return;
    triggerLightHaptic(); // physical confirmation of the tap
    router.push(active.href);
  };

  return (
    <AnimatePresence>
      {active && (
        <motion.button
          type="button"
          onClick={trigger}
          aria-label={active.label}
          title={active.label}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 24 }}
          whileTap={{ scale: 0.95 }}
          className="fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom)+1rem)] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a] md:bottom-6"
        >
          {/* Morphing icon — AnimatePresence swaps the glyph on route change. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={active.route}
              initial={{ rotate: -90, scale: 0.3, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.3, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              className="flex"
            >
              <active.icon className="h-6 w-6" strokeWidth={2} aria-hidden />
            </motion.span>
          </AnimatePresence>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default ContextFAB;
