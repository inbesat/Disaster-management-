"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Download, Plus, Siren, Truck, X } from "lucide-react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------
// components/gov/dashboard/QuickActionDock.tsx — Phase 7 · Step 7.
//
// Floating speed-dial dock pinned to the bottom-right of the Command
// Center. A single FAB expands a vertical stack of four circular action
// buttons (Alert / Deploy Resource / Run AI Plan / Export Report), each
// with a hover tooltip. Actions fire the relevant command through the
// toast system in the demo; in production they route to the broadcast,
// dispatch, plan and export flows. `fixed` (not `absolute`) so the dock
// stays on-screen while the dashboard scrolls. Rendered in the gov
// layout, above the shell's own chrome (z-50).
// ---------------------------------------------------------------------

type DockAction = {
  id: string;
  label: string;
  hint: string;
  icon: typeof Siren;
  tone: string;
  fire: () => void;
};

export function QuickActionDock() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  // Close the dial when clicking elsewhere or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!dockRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ACTIONS: DockAction[] = [
    {
      id: "alert",
      label: "Broadcast Alert",
      hint: "SMS + push to district",
      icon: Siren,
      tone: "border-severity-red-400/40 bg-severity-red-400/15 text-severity-red-300 hover:bg-severity-red-400/25",
      fire: () => {
        router.push("/gov/alerts");
        setOpen(false);
      },
    },
    {
      id: "deploy",
      label: "Deploy Resource",
      hint: "Stage boats + teams",
      icon: Truck,
      tone: "border-severity-amber-400/40 bg-severity-amber-400/15 text-severity-amber-300 hover:bg-severity-amber-400/25",
      fire: () => {
        router.push("/allocations");
        setOpen(false);
      },
    },
    {
      id: "ai",
      label: "Run AI Plan",
      hint: "Draft evacuation plan",
      icon: Bot,
      tone: "border-severity-purple-400/40 bg-severity-purple-400/15 text-severity-purple-300 hover:bg-severity-purple-400/25",
      fire: () => {
        router.push("/gov/ai-planner");
        setOpen(false);
      },
    },
    {
      id: "export",
      label: "View Printable Report",
      hint: "Broadcast history for printing",
      icon: Download,
      tone: "border-[var(--dl-blue-light)]/40 bg-[var(--dl-blue)]/15 text-[var(--dl-blue-light)] hover:bg-[var(--dl-blue)]/25",
      fire: () => {
        window.open("/api/broadcast/fm/export/pdf", "_blank", "noopener,noreferrer");
        setOpen(false);
      },
    },
  ];

  return (
    <div
      ref={dockRef}
      className="fixed bottom-20 right-5 z-50 flex flex-col items-end gap-3 md:bottom-6 md:right-6"
    >
      {/* Expanded stack — vertical speed dial */}
      <AnimatePresence>
        {open && (
          <motion.ul
            initial="closed"
            animate="open"
            exit="closed"
            variants={{ open: {}, closed: {} }}
            className="flex flex-col items-end gap-3"
          >
            {ACTIONS.map((action) => (
              <motion.li
                key={action.id}
                variants={{
                  open: {
                    opacity: 1,
                    y: 0,
                    transition: { type: "spring", stiffness: 400, damping: 26 },
                  },
                  closed: { opacity: 0, y: 12, transition: { duration: 0.12 } },
                }}
                className="group relative flex items-center"
              >
                {/* Tooltip */}
                <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg border border-white/10 bg-panel-deep/95 px-3 py-1.5 text-right opacity-0 shadow-lg backdrop-blur transition-opacity duration-150 group-hover:opacity-100">
                  <span className="block text-xs font-semibold text-white">
                    {action.label}
                  </span>
                  <span className="block text-[0.625rem] text-[var(--dl-text-muted)]">
                    {action.hint}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={action.fire}
                  aria-label={action.label}
                  title={action.label}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur transition hover:scale-105 active:scale-95 ${action.tone}`}
                >
                  <action.icon aria-hidden="true" className="h-5 w-5" />
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        className={`flex h-14 w-14 items-center justify-center rounded-full border shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur transition hover:scale-105 active:scale-95 ${
          open
            ? "border-white/20 bg-white/10 text-white"
            : "border-[var(--dl-blue-light)]/50 bg-[var(--dl-blue)]/25 text-[var(--dl-blue-light)] hover:bg-[var(--dl-blue)]/35"
        }`}
      >
        {open ? (
          <X aria-hidden="true" className="h-6 w-6" />
        ) : (
          <Plus aria-hidden="true" className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}

export default QuickActionDock;
