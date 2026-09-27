import type { Metadata } from "next";
import { Phone } from "lucide-react";
import Link from "next/link";
import OfflineBanner from "@/components/field/OfflineBanner";
import EmergencyRecallBanner from "@/components/field/EmergencyRecallBanner";
import QuickStatusGrid from "@/components/field/QuickStatusGrid";
import TaskList from "@/components/field/TaskList";
import QRScannerModal from "@/components/field/QRScannerModal";
import ShiftHandover from "@/components/field/ShiftHandover";
import VoiceNoteReporter from "@/components/field/VoiceNoteReporter";
import GpsCheckIn from "@/components/field/GpsCheckIn";
import DamageReporterModal from "@/components/field/DamageReporterModal";
import RecallTestButton from "@/components/field/RecallTestButton";
import TaskDispatchButton from "@/components/field/TaskDispatchButton";

export const metadata: Metadata = {
  title: "Field Tasks | SafeSphere",
};

export default function FieldHomePage() {
  return (
    <div className="space-y-6">
      <OfflineBanner />
      <Link href="/portal" className="block rounded-xl border-2 border-cyan-400/50 bg-cyan-950/30 p-4 text-center font-bold text-cyan-200">Open public report verification queue →</Link>

      <EmergencyRecallBanner />

      {/* On-duty greeting */}
      <section className="rounded-xl border-2 border-cyan-400/30 bg-panel-deep p-5">
        <p className="text-2xl font-bold text-amber-300">On duty</p>
        <p className="mt-1 text-lg text-gray-200">
          Your district is on <span className="font-bold text-red-400">AMBER WATCH</span>.
          Priority tasks below — swipe left to act.
        </p>
      </section>

      {/* Phase 14 · Step 4 — one-tap tactical status grid */}
      <QuickStatusGrid />

      {/* Phase 14 · Steps 2+3 — prioritized swipeable task cards */}
      <TaskList />

      {/* Phase 14 · Step 5 — hardware QR / barcode scanning */}
      <section>
        <h2 className="mb-3 text-lg font-bold uppercase tracking-wider text-cyan-300">
          Resource Scanning
        </h2>
        <QRScannerModal />
      </section>

      {/* Voice-to-text field notes */}
      <VoiceNoteReporter />

      {/* GPS Check-In */}
      <GpsCheckIn />

      {/* Rapid Photo Inspection */}
      <DamageReporterModal />

      {/* Emergency line */}
      <section className="flex flex-col gap-3 rounded-xl border-2 border-red-400/40 bg-red-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Phone className="h-6 w-6 text-red-400" />
          <span className="text-lg font-bold text-red-300">District Control Room</span>
        </div>
        <a
          href="tel:+911123456789"
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg border-2 border-red-400 bg-red-500/15 px-6 text-lg font-bold text-red-300 transition hover:bg-red-500/25"
        >
          CALL NOW
        </a>
      </section>

      {/* Phase 14 · Step 10 — end-of-shift handover */}
      <ShiftHandover />

      {/* Simulation: command-room dispatch demos (recall + critical task) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RecallTestButton />
        <TaskDispatchButton />
      </div>
    </div>
  );
}
