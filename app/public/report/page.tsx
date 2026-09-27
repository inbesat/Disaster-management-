import { CitizenReportForm } from "@/components/public/report/CitizenReportForm";

export default function PublicReportPage({ searchParams }: { searchParams?: { type?: string } }) {
  return (
    <div className="relative w-full min-h-screen flex flex-col bg-[var(--dl-navy)] text-[var(--dl-text-on-navy)]">
      {/* Ambient backdrop matching dashboard */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_80%_-10%,rgba(37,99,235,0.22),transparent),radial-gradient(ellipse_45%_40%_at_0%_110%,rgba(249,115,22,0.14),transparent)]"
      />

      <CitizenReportForm initialType={searchParams?.type} />
    </div>
  );
}
