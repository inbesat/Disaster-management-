"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Battery, BatteryFull, BatteryLow, Wifi, WifiOff } from "lucide-react";
import FieldBottomNav from "@/components/field/FieldBottomNav";
import SosPanicModal from "@/components/field/SosPanicModal";
import SyncStatusBadge from "@/components/field/SyncStatusBadge";
import PreDeploymentChecklist from "@/components/field/PreDeploymentChecklist";
import BackButton from "@/components/ui/BackButton";
import LanguageSelector from "@/components/ui/LanguageSelector";

interface FieldProfile {
  name: string;
  role: string;
  district: string;
  team: string;
}

const MOCK_PROFILE: FieldProfile = {
  name: "Responder",
  role: "Field Responder",
  district: "District not assigned",
  team: "Field team",
};

function useIsOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function useBattery(initial = 78) {
  const [level, setLevel] = useState(initial);
  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number }>;
    };
    if (nav.getBattery) {
      void nav.getBattery().then((b) => setLevel(Math.round(b.level * 100)));
    }
  }, []);
  return level;
}

function BatteryIcon({ level }: { level: number }) {
  if (level < 20) return <BatteryLow className="h-5 w-5 text-red-400" />;
  if (level >= 80) return <BatteryFull className="h-5 w-5 text-amber-300" />;
  return <Battery className="h-5 w-5 text-amber-300" />;
}

export default function FieldShell({
  profile = MOCK_PROFILE,
  children,
}: {
  profile?: FieldProfile;
  children: ReactNode;
}) {
  const online = useIsOnline();
  const battery = useBattery(78);

  return (
    // Phase 14 · Step 1 — strict mobile shell: max-w-md column centered on
    // desktop, overflow-x hidden (no horizontal scroll on field devices),
    // safe-area insets handled by the bottom nav + pb below.
    <div className="min-h-screen overflow-x-hidden bg-[#0A0F1D] text-[1.0625rem] text-gray-100">
      {/* Header — mobile-first, high visibility */}
      <header className="sticky top-0 z-40 border-b-2 border-cyan-400/40 bg-[#0A0F1D]">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <BackButton />
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-500/15 text-lg font-bold text-amber-300">
              {profile.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-lg font-bold text-amber-300">{profile.name}</p>
              <p className="truncate text-base text-cyan-300">{profile.district}</p>
              <p className="text-sm font-medium text-gray-400">
                {profile.role} · {profile.team}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <LanguageSelector />

            <div className="flex flex-col items-center gap-0.5" title="Battery level">
              <BatteryIcon level={battery} />
              <span
                className={`text-sm font-bold ${
                  battery < 20 ? "text-red-400" : "text-amber-300"
                }`}
              >
                {battery}%
              </span>
            </div>

            <div
              className={`flex min-h-[48px] min-w-[48px] items-center gap-2 rounded-md border px-3 ${
                online
                  ? "border-emerald-400 bg-emerald-500/10 text-emerald-300"
                  : "border-red-400 bg-red-500/10 text-red-400"
              }`}
              role="status"
            >
              {online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
              <span className="text-base font-bold">{online ? "Online" : "Offline"}</span>
            </div>

            <SosPanicModal />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-32 pt-6">{children}</main>

      {/* Phase 14 · Step 1 — 5-tab responder bottom nav (Tasks/Map/Team/
          Chat/SOS). The older QuickActionsNav quick-action bar is replaced
          by the QuickStatusGrid living on the Tasks page (Step 4). */}
      <FieldBottomNav />

      <SyncStatusBadge />

      {/* Phase 14 · Step 9 — pre-deployment readiness checklist. Auto-opens
          once per shift (first login) on every field page; renders nothing
          once confirmed. */}
      <PreDeploymentChecklist />
    </div>
  );
}
