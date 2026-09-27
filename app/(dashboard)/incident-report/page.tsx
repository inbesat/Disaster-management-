import { CitizenReportForm } from "@/components/public/report/CitizenReportForm";

export default function IncidentReportPage() {
  return (
    <main className="min-h-screen bg-[#0A0F1D] text-white">
      <CitizenReportForm
        trackingHref="/portal/admin"
        trackingLabel="Review report queue"
      />
    </main>
  );
}
